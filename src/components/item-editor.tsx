"use client";
import { motion } from "motion/react";
import { ConciergeBell, Download, Eye, EyeOff, Lock, Paperclip, Trash, X } from "lucide-react";
import { useRef, useState } from "react";
import { subsection, type Field as FieldDef } from "@/lib/sections";
import { useApp, type VaultItem } from "@/lib/store";
import { decryptFile, deleteItem, encryptFile, saveItem, shareWithConcierge, type FileMeta, type ItemPayload } from "@/lib/vault";
import { Button, Field, Notice, Toggle } from "./ui";

export type Entry = { item: VaultItem; payload: ItemPayload };

const MAX_FILE = 20 * 1024 * 1024;
const size = (n: number) => (n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`);

async function download(subId: string, f: FileMeta) {
  const url = URL.createObjectURL(await decryptFile(subId, f));
  const a = Object.assign(document.createElement("a"), { href: url, download: f.name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function SecretInput({ f, value, onChange }: { f: FieldDef; value: string; onChange: (v: string) => void }) {
  const [shown, setShown] = useState(false);
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[0.92rem] font-semibold text-ink-soft">
        <Lock className="h-3.5 w-3.5" /> {f.label}
      </span>
      <span className="flex items-center rounded-2xl bg-paper ring-1 ring-line focus-within:ring-2 focus-within:ring-gold">
        <input type={shown ? "text" : "password"} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 bg-transparent px-4 py-3.5 text-[1.05rem] outline-none" />
        <button type="button" onClick={() => setShown(!shown)} className="p-3 text-mist" aria-label={shown ? "Masquer" : "Afficher"}>
          {shown ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </span>
    </label>
  );
}

export function ItemEditor({ subId, entry, onDone }: { subId: string; entry?: Entry; onDone: () => void }) {
  const sub = subsection(subId);
  const concierge = useApp((s) => s.concierge).filter((c) => c.status !== "demande" && c.status !== "termine");
  const hasReminder = useApp((s) => s.reminders.some((r) => r.itemId === entry?.item.id));
  const [title, setTitle] = useState(entry?.payload.title ?? "");
  const [fields, setFields] = useState<Record<string, string>>(entry?.payload.fields ?? {});
  const [files, setFiles] = useState<FileMeta[]>(entry?.payload.files ?? []);
  const [pending, setPending] = useState<File[]>([]);
  const [remind, setRemind] = useState(entry ? hasReminder : true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shared, setShared] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const dated = sub.fields.some((f) => f.kind === "date");

  async function save() {
    setBusy(true);
    setError(null);
    try {
      // Files are encrypted on the phone before being stored; only ciphertext ever leaves it.
      const added = await Promise.all(pending.map((f) => encryptFile(subId, f)));
      await saveItem(subId, { title: title.trim(), fields, files: [...files, ...added] }, entry?.item.id, remind);
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Titre" value={title} onChange={setTitle} placeholder={sub.fields[0]?.placeholder ?? sub.title} autoFocus={!entry} />
      {sub.fields.map((f) =>
        f.kind === "secret" ? (
          <SecretInput key={f.key} f={f} value={fields[f.key] ?? ""} onChange={(v) => setFields({ ...fields, [f.key]: v })} />
        ) : (
          <Field
            key={f.key}
            label={f.label}
            type={f.kind === "date" ? "date" : f.kind === "phone" ? "tel" : "text"}
            inputMode={f.kind === "phone" ? "tel" : undefined}
            multiline={f.kind === "long"}
            placeholder={f.placeholder}
            value={fields[f.key] ?? ""}
            onChange={(v) => setFields({ ...fields, [f.key]: v })}
          />
        ),
      )}
      {dated && <Toggle checked={remind} onChange={setRemind} label="Me prévenir avant la date" hint="Un e-mail vous prévient, sans dire de quoi il s'agit" />}

      <div>
        <div className="mb-2 text-[0.92rem] font-semibold text-ink-soft">Documents</div>
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-3 rounded-2xl bg-paper p-3 ring-1 ring-line">
              <Paperclip className="h-5 w-5 shrink-0 text-mist" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-[0.8rem] text-mist">{size(f.size)}</span>
              <button type="button" onClick={() => download(subId, f)} className="p-1.5" aria-label={`Télécharger ${f.name}`}>
                <Download className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setFiles(files.filter((x) => x.id !== f.id))} className="p-1.5 text-coral" aria-label={`Retirer ${f.name}`}>
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          {pending.map((f, i) => (
            <motion.div key={f.name + i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 rounded-2xl bg-gold-soft/40 p-3 ring-1 ring-gold/30">
              <Lock className="h-5 w-5 shrink-0 text-gold-deep" />
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="text-[0.8rem] text-mist">chiffré à l'enregistrement</span>
              <button type="button" onClick={() => setPending(pending.filter((_, j) => j !== i))} className="p-1.5 text-coral" aria-label={`Retirer ${f.name}`}>
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </div>
        <input
          ref={input}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const list = [...(e.target.files ?? [])];
            const tooBig = list.filter((f) => f.size > MAX_FILE);
            setError(tooBig.length ? `Fichier trop lourd (20 Mo maximum) : ${tooBig.map((f) => f.name).join(", ")}` : null);
            setPending([...pending, ...list.filter((f) => f.size <= MAX_FILE)]);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" full className="mt-2" icon={<Paperclip className="h-5 w-5" />} onClick={() => input.current?.click()}>
          Ajouter une photo ou un PDF
        </Button>
      </div>

      {error && <p className="font-semibold text-coral">{error}</p>}
      <Button full variant="gold" disabled={busy || !title.trim()} onClick={save}>
        {busy ? "Chiffrement…" : "Enregistrer dans le Coffre"}
      </Button>

      {entry && concierge.length > 0 && (
        <div className="rounded-2xl bg-ink/[0.04] p-4">
          <div className="flex items-center gap-2 font-semibold">
            <ConciergeBell className="h-5 w-5 text-gold-deep" /> Confier à la conciergerie
          </div>
          <p className="mt-1 text-[0.88rem] text-mist">Seul cet élément lui sera transmis, chiffré pour elle, dans le cadre de votre mandat.</p>
          <div className="mt-2 space-y-2">
            {concierge.map((c) => (
              <Button
                key={c.id}
                variant="outline"
                full
                disabled={shared === c.id || c.shared.some((x) => x.itemId === entry.item.id)}
                onClick={async () => {
                  await shareWithConcierge(c.id, entry.item, entry.payload);
                  setShared(c.id);
                }}
              >
                {c.shared.some((x) => x.itemId === entry.item.id) || shared === c.id ? "Déjà confié" : c.kind}
              </Button>
            ))}
          </div>
        </div>
      )}

      {entry &&
        (confirmDelete ? (
          <Notice tone="coral">
            <p className="font-semibold">Supprimer définitivement cet élément et ses documents ?</p>
            <div className="mt-3 flex gap-2">
              <Button variant="danger" onClick={async () => { await deleteItem(entry.item.id); onDone(); }}>
                Supprimer
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Annuler
              </Button>
            </div>
          </Notice>
        ) : (
          <Button full variant="ghost" className="!text-coral" icon={<Trash className="h-4 w-4" />} onClick={() => setConfirmDelete(true)}>
            Supprimer
          </Button>
        ))}
    </div>
  );
}

// What a card holder sees: read-only, documents downloadable.
export function ItemView({ subId, entry }: { subId: string; entry: Entry }) {
  const sub = subsection(subId);
  return (
    <div className="space-y-3">
      {sub.fields.map((f) => {
        const v = entry.payload.fields[f.key];
        if (!v) return null;
        return (
          <div key={f.key} className="rounded-2xl bg-paper p-4 ring-1 ring-line">
            <div className="text-[0.8rem] font-semibold text-mist">{f.label}</div>
            <div className="mt-0.5 whitespace-pre-wrap text-[1.05rem]">{f.kind === "date" ? new Date(v).toLocaleDateString("fr-FR", { dateStyle: "long" }) : v}</div>
          </div>
        );
      })}
      {entry.payload.files.map((f) => (
        <button key={f.id} type="button" onClick={() => download(subId, f)} className="flex w-full items-center gap-3 rounded-2xl bg-paper p-4 text-left ring-1 ring-line">
          <Paperclip className="h-5 w-5 text-mist" />
          <span className="flex-1 truncate font-semibold">{f.name}</span>
          <Download className="h-5 w-5" />
        </button>
      ))}
    </div>
  );
}
