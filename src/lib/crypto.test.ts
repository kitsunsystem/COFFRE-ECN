import { describe, expect, it } from "vitest";
import { combine, na, newKey, newSalt, open, openFrom, openJson, pinKey, seal, sealJson, sealTo, toB64 } from "./crypto";

describe("Coffre crypto", () => {
  it("round-trips and binds the ciphertext to its context", async () => {
    const k = await newKey();
    const s = await sealJson(k, { title: "Passeport" }, "item:1");
    expect(await openJson(k, s, "item:1")).toEqual({ title: "Passeport" });
    // Swapping two items' ciphertexts must fail: the id is authenticated.
    await expect(openJson(k, s, "item:2")).rejects.toThrow();
    await expect(open(await newKey(), s, "item:1")).rejects.toThrow();
  });

  it("a card holder opens only what was sealed to their card", async () => {
    const sodium = await na();
    const holder = sodium.crypto_box_keypair();
    const other = sodium.crypto_box_keypair();
    const ssk = await newKey();
    const env = await sealTo(toB64(sodium, holder.publicKey), ssk);
    expect(await openFrom(env, holder.publicKey, holder.privateKey)).toEqual(ssk);
    await expect(openFrom(env, other.publicKey, other.privateKey)).rejects.toThrow();
  });

  it("card secret and code are both required", async () => {
    const salt = await newSalt();
    const card = new Uint8Array(32).fill(7);
    const kek = await combine(card, await pinKey("123456", salt));
    const wrapped = await seal(kek, await newKey(), "vmk:card");
    await expect(open(await combine(card, await pinKey("654321", salt)), wrapped, "vmk:card")).rejects.toThrow();
    await expect(open(await combine(new Uint8Array(32).fill(8), await pinKey("123456", salt)), wrapped, "vmk:card")).rejects.toThrow();
    expect((await open(kek, wrapped, "vmk:card")).length).toBe(32);
  });
});
