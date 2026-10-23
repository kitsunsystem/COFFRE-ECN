// Monthly death watch against the INSEE "fichier des personnes décédées" (open data, data.gouv.fr).
// Pure TypeScript, no imports: runs in the Supabase Edge Function (Deno) and in the app tests.
//
// Fixed-width line format (INSEE documentation):
//   1-80   nom*prénoms/   81 sexe   82-89 date de naissance AAAAMMJJ   90-94 code lieu de naissance
//   95-124 commune de naissance   125-154 pays de naissance   155-162 date de décès   163-167 code lieu de décès   168-176 n° d'acte

export interface DeathRecord {
  lastName: string;
  firstNames: string[];
  sex: string;
  birthDate: string; // AAAAMMJJ, "00" allowed for unknown day/month
  birthPlaceCode: string;
  birthCity: string;
  deathDate: string;
  deathPlaceCode: string;
}

export interface Member {
  id: string;
  lastName: string;
  firstNames: string; // as typed during KYC
  birthDate: string; // AAAA-MM-JJ
  birthCity: string;
}

export interface Match {
  memberId: string;
  record: DeathRecord;
  score: number;
  doubtful: boolean; // spelling or compound-name differences: AI check, then human check
  reasons: string[];
}

export function parseLine(line: string): DeathRecord | null {
  if (line.length < 162) return null;
  const names = line.slice(0, 80).trim();
  const [last, first = ""] = names.replace(/\/$/, "").split("*");
  return {
    lastName: last.trim(),
    firstNames: first.trim().split(/\s+/).filter(Boolean),
    sex: line.slice(80, 81),
    birthDate: line.slice(81, 89),
    birthPlaceCode: line.slice(89, 94).trim(),
    birthCity: line.slice(94, 124).trim(),
    deathDate: line.slice(154, 162),
    deathPlaceCode: line.slice(162, 167).trim(),
  };
}

export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z ]/g, " ").replace(/\s+/g, " ").trim();

export function distance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

const sameName = (a: string, b: string) => {
  const x = normalize(a), y = normalize(b);
  if (x === y) return 1;
  if (x.replace(/ /g, "") === y.replace(/ /g, "")) return 0.95; // "LE BRUN" / "LEBRUN"
  const parts = (s: string) => new Set(s.split(" "));
  const px = parts(x), py = parts(y);
  if ([...px].some((p) => py.has(p) && p.length > 2)) return 0.85; // part of a compound name
  return Math.max(0, 1 - distance(x, y) / Math.max(x.length, y.length));
};

export function matchRecord(member: Member, r: DeathRecord): Match | null {
  // Birth date is the hard filter: without it, homonyms would flood the check queue.
  if (member.birthDate.replaceAll("-", "") !== r.birthDate) return null;
  const last = sameName(member.lastName, r.lastName);
  const memberFirst = normalize(member.firstNames).split(" ")[0] ?? "";
  const first = r.firstNames.length ? Math.max(...r.firstNames.map((f) => sameName(memberFirst, f))) : 0;
  const city = member.birthCity && r.birthCity ? sameName(member.birthCity, r.birthCity) : 0.5;
  const score = Math.round((last * 0.45 + first * 0.35 + city * 0.2) * 100) / 100;
  if (score < 0.7) return null;
  const reasons: string[] = [];
  if (last < 1) reasons.push("nom écrit différemment");
  if (first < 1) reasons.push("prénom écrit différemment");
  if (city < 1) reasons.push("lieu de naissance différent ou absent");
  return { memberId: member.id, record: r, score, doubtful: reasons.length > 0, reasons };
}

export function findMatches(members: Member[], lines: string[]): Match[] {
  const byBirth = new Map<string, Member[]>();
  for (const m of members) {
    const k = m.birthDate.replaceAll("-", "");
    byBirth.set(k, [...(byBirth.get(k) ?? []), m]);
  }
  const out: Match[] = [];
  for (const line of lines) {
    const r = parseLine(line);
    if (!r) continue;
    for (const m of byBirth.get(r.birthDate) ?? []) {
      const hit = matchRecord(m, r);
      if (hit) out.push(hit);
    }
  }
  return out;
}

export function formatLine(r: { last: string; first: string; sex: string; birth: string; city: string; death: string }) {
  const pad = (s: string, n: number) => s.slice(0, n).padEnd(n, " ");
  return pad(`${r.last}*${r.first}/`, 80) + r.sex + r.birth + pad("", 5) + pad(r.city, 30) + pad("", 30) + r.death + pad("", 5) + pad("", 9);
}
