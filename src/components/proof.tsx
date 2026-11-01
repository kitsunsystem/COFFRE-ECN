"use client";
// Documents for the verification team: a proof, the ID and a photo of the face taken now. They never go to the Coffre.
import { Camera, Check, FileUp } from "lucide-react";
import { useState, type ReactNode } from "react";
import { requestCoupDur, type Proofs } from "@/lib/api";
import { DELAYS } from "@/lib/config";
import { MOTIFS, type Motif } from "@/lib/rules";
import { Button, Segmented } from "./ui";

const MAX = 20 * 1024 * 1024;
const DOCS = [
  { key: "id", label: "Votre pièce d'identité", hint: "Carte d'identité ou passeport, photo ou PDF" },
  { key: "face", label: "Une photo de votre visage", hint: "Prise maintenant, de face, bien éclairée" },
] as const;

export function ProofForm({ proofLabel, note, submit, children }: { proofLabel: string; note: string; submit: (f: Proofs) => Promise<boolean>; children?: ReactNode }) {
  const [files, setFiles] = useState<Partial<Proofs>>({});
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pick = (key: keyof Proofs, f?: File) => {
    const ok = f && f.size <= MAX && (f.type.startsWith("image/") || (key !== "face" && f.type === "application/pdf"));
    if (f && !ok) return setError(key === "face" ? "Une photo uniquement, 20 Mo maximum." : "Photo ou PDF uniquement, 20 Mo maximum.");
    setError(null);
    setFiles((x) => ({ ...x, [key]: f }));
  };
  return (
    <div className="space-y-4">
      {children}
      {[{ key: "proof" as const, label: proofLabel, hint: "Photo ou PDF" }, ...DOCS].map((d) => (
        <label key={d.key} className="flex cursor-pointer items-center gap-3 rounded-2xl bg-paper p-4 ring-1 ring-line">
          {d.key === "face" ? <Camera className="h-6 w-6 shrink-0 text-gold-deep" /> : <FileUp className="h-6 w-6 shrink-0 text-gold-deep" />}
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{d.label}</span>
            <span className="block truncate text-[0.85rem] text-mist">{files[d.key]?.name ?? d.hint}</span>
          </span>
          {files[d.key] && <Check className="h-5 w-5 text-sage" />}
          {d.key === "face" ? (
            <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => pick(d.key, e.target.files?.[0])} />
          ) : (
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => pick(d.key, e.target.files?.[0])} />
          )}
        </label>
      ))}
      {error && <p className="font-semibold text-coral">{error}</p>}
      <button type="button" onClick={() => setSure(!sure)} aria-pressed={sure} className="flex w-full items-start gap-3 text-left">
        <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md ring-2 ${sure ? "bg-ink ring-ink" : "ring-line"}`}>{sure && <Check className="h-4 w-4 text-paper" strokeWidth={3} />}</span>
        <span className="text-[0.92rem]">Je certifie que ces documents sont authentiques et que la photo est bien la mienne.</span>
      </button>
      <p className="text-[0.85rem] text-mist">{note}</p>
      <Button
        full
        variant="gold"
        disabled={!files.proof || !files.id || !files.face || !sure || busy}
        onClick={async () => {
          setBusy(true);
          const ok = await submit(files as Proofs);
          setBusy(false);
          if (ok) {
            setFiles({});
            setSure(false);
          }
        }}
      >
        {busy ? "Envoi…" : "Envoyer pour vérification"}
      </Button>
    </div>
  );
}

// A relative's request to open what is planned for them in a coup dur (hospitalisation, coma, incapacity).
export function CoupDurRequest({ ownerId, ownerName, personId, who, onDone }: { ownerId: string | null; ownerName: string; personId: string; who: string; onDone: () => void }) {
  const [motif, setMotif] = useState<Motif>("hospitalisation");
  const first = ownerName.split(" ")[0];
  return (
    <ProofForm
      proofLabel="Le justificatif (ex. bulletin d'hospitalisation)"
      note={`Notre équipe vérifie le justificatif et votre identité ; une IA l'aide à repérer un document douteux, une personne décide toujours. Une fois validée, la partie que ${first} a prévue pour vous en cas de coup dur s'ouvre, pour vous seul(e), pendant ${Math.round(DELAYS.coupDurAccess / 86_400_000)} jours, avec Face ID et votre code. ${ownerName} est prévenu(e) partout et peut fermer l'accès à tout moment.`}
      submit={async (f) => {
        const ok = await requestCoupDur(ownerId, personId, who, motif, f);
        if (ok) onDone();
        return ok;
      }}
    >
      <Segmented layoutKey="motif" value={motif} onChange={setMotif} options={MOTIFS.map((m) => ({ id: m.id, label: m.label }))} />
    </ProofForm>
  );
}
