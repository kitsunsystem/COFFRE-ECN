// Trusted computers: the phone approves (right number, one try), the sealed keys are taken back once, and nobody else
// can read, approve or redirect a request. The server only ever holds ciphertext it cannot open.
import { beforeAll, describe, expect, it } from "vitest";
import { as, freshDb, refused, user, type Db } from "./db";

let db: Db;
let claire: string, eve: string;
const pk = "A".repeat(43) + "=";
const otherPk = "B".repeat(43) + "=";

beforeAll(async () => {
  db = await freshDb();
  claire = await user(db, "claire@exemple.fr");
  eve = await user(db, "eve@exemple.fr");
}, 60_000);

type Req = { id: string; code: number; choices: number[]; pk: string; status: string };
const ask = async (who: string, kind: string, o: { pk?: string; name?: string; device?: string } = {}) =>
  (await as<{ r: { id: string; code: number } }>(db, who, "select request_device($1, $2, $3, $4) as r", [kind, o.pk ?? null, o.name ?? null, o.device ?? null]))[0].r;
const read = async (who: string, id: string) => (await as<{ r: Req | null }>(db, who, "select device_request($1) as r", [id]))[0].r;
const approve = async (who: string, id: string, choice: number, sealed = "c2NlbGzDqQ==") =>
  (await as<{ d: string | null }>(db, who, "select approve_device_request($1, $2, $3) as d", [id, choice, sealed]))[0].d;
const take = async (who: string, id: string) => (await as<{ r: { status: string; sealed: string | null; device_id: string | null } }>(db, who, "select take_device_request($1) as r", [id]))[0].r;

let device: string;

describe("appairage", () => {
  it("shows three choices on the phone, never the right number alone", async () => {
    const r = await ask(claire, "pairing", { pk, name: "Chrome · Windows" });
    const seen = (await read(claire, r.id))!;
    expect(seen.choices).toHaveLength(3);
    expect(new Set(seen.choices).size).toBe(3);
    expect(seen.choices).toContain(r.code);
    expect(seen).not.toHaveProperty("code");
    expect(await read(eve, r.id)).toBeNull();
  });

  it("a wrong number refuses the request for good, with nothing deposited", async () => {
    const r = await ask(claire, "pairing", { pk, name: "Chrome · Windows" });
    const wrong = (await read(claire, r.id))!.choices.find((n) => n !== r.code)!;
    expect(await approve(claire, r.id, wrong)).toBeNull();
    expect((await take(claire, r.id)).status).toBe("refused");
    await refused(approve(claire, r.id, r.code), /demande expirée/);
  });

  it("someone else cannot approve or take the request", async () => {
    const r = await ask(claire, "pairing", { pk, name: "Chrome · Windows" });
    await refused(approve(eve, r.id, r.code), /demande expirée/);
    await refused(take(eve, r.id), /demande inconnue/);
  });

  it("the right number makes the computer trusted, sends an alert, and the keys are taken back only once", async () => {
    const r = await ask(claire, "pairing", { pk, name: "Chrome · Windows" });
    device = (await approve(claire, r.id, r.code))!;
    expect(device).toBeTruthy();
    expect((await db.query("select to_email from outbox where template = 'nouvel-appareil'")).rows).toEqual([{ to_email: "claire@exemple.fr" }]);
    expect(await take(claire, r.id)).toEqual({ status: "approved", sealed: "c2NlbGzDqQ==", device_id: device });
    expect(await take(claire, r.id)).toEqual({ status: "used", sealed: null, device_id: device });
  });

  it("an expired request can no longer be approved", async () => {
    const r = await ask(claire, "pairing", { pk, name: "Chrome · Windows" });
    await db.query("update device_requests set expires_at = now() - interval '1 second' where id = $1", [r.id]);
    expect((await take(claire, r.id)).status).toBe("expired");
    await refused(approve(claire, r.id, r.code), /demande expirée/);
  });
});

describe("ouverture depuis un ordinateur de confiance", () => {
  it("reuses the key recorded at pairing: a request cannot point the keys elsewhere", async () => {
    const r = await ask(claire, "open", { device, pk: otherPk, name: "Pirate" });
    const seen = (await read(claire, r.id))!;
    expect(seen.pk).toBe(pk);
    expect(await approve(claire, r.id, r.code)).toBe(device);
  });

  it("refuses an opening for someone else's computer, or one past its 90 days", async () => {
    await refused(ask(eve, "open", { device }), /appareil inconnu/);
    await db.query("update trusted_devices set expires_at = now() - interval '1 day' where id = $1", [device]);
    await refused(ask(claire, "open", { device }), /à revalider/);
    // Revalidated with the QR code and the card: the same computer starts again for 90 days.
    const r = await ask(claire, "pairing", { pk, name: "Chrome · Windows" });
    device = (await approve(claire, r.id, r.code))!;
    expect((await as(db, claire, "select id from trusted_devices")).map((x) => x.id)).toEqual([device]);
  });
});

describe("liste des appareils et accès directs", () => {
  it("each person sees and removes only their own computers", async () => {
    expect(await as(db, eve, "select * from trusted_devices")).toHaveLength(0);
    await as(db, eve, "delete from trusted_devices where id = $1", [device]);
    expect(await as(db, claire, "select id from trusted_devices")).toHaveLength(1);
    await refused(as(db, claire, "insert into trusted_devices (user_id, name, pk) values ($1, 'X', $2)", [claire, otherPk]), /permission denied/);
    await refused(as(db, claire, "update trusted_devices set expires_at = now() + interval '10 years'"), /permission denied/);
    await as(db, claire, "delete from trusted_devices where id = $1", [device]);
    expect(await as(db, claire, "select id from trusted_devices")).toHaveLength(0);
  });

  it("requests and push tokens are never readable directly", async () => {
    await refused(as(db, claire, "select * from device_requests"), /permission denied/);
    await refused(as(db, claire, "select * from push_tokens"), /permission denied/);
    await refused(as(db, null, "select request_device('pairing', $1, 'X')", [pk]), /permission denied/);
  });

  it("a phone that changes account takes its push token along", async () => {
    await as(db, claire, "select register_push('token-telephone-1', 'ios')");
    await as(db, eve, "select register_push('token-telephone-1', 'android')");
    expect((await db.query("select user_id, platform from push_tokens")).rows).toEqual([{ user_id: eve, platform: "android" }]);
    await as(db, claire, "select unregister_push('token-telephone-1')");
    expect((await db.query("select count(*)::int as n from push_tokens")).rows[0]).toEqual({ n: 1 });
  });

  it("limits the number of requests", async () => {
    for (let i = 0; i < 10; i++) await ask(eve, "pairing", { pk, name: "Essai" }).catch(() => {});
    await refused(ask(eve, "pairing", { pk, name: "Essai" }), /trop de demandes/);
  });
});
