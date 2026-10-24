"use client";
// "Partie sensible": a sandbox where the owner creates their own categories and decides what each one holds.
import { motion } from "motion/react";
import { Check, ChevronRight, FolderPlus, Paperclip, Pencil, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { ACCEPTS, type Accept } from "@/lib/sections";
import { useApp } from "@/lib/store";
import { createCategory, deleteCategory, readCategories, readItems, updateCategory, type CategoryMeta } from "@/lib/vault";
import { ItemEditor, ItemView, type Entry } from "./item-editor";
import { useNow } from "./providers";
import { Button, Field, Notice, Sheet } from "./ui";
import { rise } from "./visuals";

// <input accept> list for a category; "" = notes only.
const mimeOf = (accept: Accept[]) => (accept.includes("any") ? "*/*" : accept.map((a) => ACCEPTS.find((x) => x.id === a)!.mime).filter(Boolean).join(","));
const labelOf = (a: Accept) => ACCEPTS.find((x) => x.id === a)!.label;

export function SensibleView({ owner, launched }: { owner: boolean; launched: boolean }) {
  const items = useApp((s) => s.vault.items);
  const custom = useApp((s) => s.vault.custom);
  const envelopes = useApp((s) => s.vault.envelopes);
  useApp((s) => s.procedures); // re-read when a moment is reached
  useNow(5000);
  const [cats, setCats] = useState<{ id: string; meta: CategoryMeta }[]>([]);
  const [entries, setEntries] = useState<Record<string, Entry[]>>({});
  const [editing, setEditing] = useState<{ id?: string; meta: CategoryMeta } | null>(null);
  const [open, setOpen] = useState<{ catId: string; entry?: Entry } | null>(null);

  useEffect(() => {
    let live = true;
    // Names and contents are decrypted on the phone, in memory only.
    (async () => {
      const list = await readCategories();
      const all = Object.fromEntries(await Promise.all(list.map(async (c) => [c.id, await readItems(c.id)] as const)));
      if (live) {
        setCats(list);
        setEntries(all);
      }
    })();
    return () => {
      live = false;
    };
  }, [items, custom, envelopes]);

  const current = open && cats.find((c) => c.id === open.catId);

  return (
    <>
      <motion.div variants={rise} className="rounded-[1.4rem] bg-paper/5 p-4 text-[0.92rem] text-paper/75 ring-1 ring-paper/10">
        {owner
          ? "Votre espace libre : créez vos propres catégories et choisissez ce que chacune peut contenir (PDF, images, notes, tout fichier). Même les noms des catégories sont chiffrés."
          : "Les catégories de la partie sensible qui vous ont été confiées."}
      </motion.div>

      {owner && (
        <motion.div variants={rise}>
          <Button full variant="gold" icon={<FolderPlus className="h-5 w-5" />} onClick={() => setEditing({ meta: { title: "", accept: ["pdf", "image", "note"] } })}>
            Créer une catégorie
          </Button>
        </motion.div>
      )}

      {cats.length === 0 && <p className="text-center text-[0.92rem] text-paper/55">{owner ? "Aucune catégorie pour l'instant." : "Rien ne vous est encore ouvert ici."}</p>}

      {cats.map((c) => {
        const list = entries[c.id] ?? [];
        return (
          <motion.section key={c.id} variants={rise} className="rounded-[1.6rem] bg-night-2 p-4 ring-1 ring-paper/10">
            <div className="flex items-start gap-3 px-1">
              <div className="min-w-0 flex-1">
                <h2 className="text-[1.15rem] font-semibold [overflow-wrap:anywhere]">{c.meta.title}</h2>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {c.meta.accept.map((a) => (
                    <span key={a} className="rounded-full bg-paper/10 px-2 py-0.5 text-[0.72rem] font-bold text-paper/75">
                      {labelOf(a)}
                    </span>
                  ))}
                </div>
              </div>
              {owner && (
                <button onClick={() => setEditing({ id: c.id, meta: c.meta })} className="grid h-11 w-11 shrink-0 place-items-center rounded-full ring-1 ring-paper/15" aria-label={`Modifier ${c.meta.title}`}>
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {owner && launched && (
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setOpen({ catId: c.id })} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold text-ink" aria-label={`Ajouter dans ${c.meta.title}`}>
                  <Plus className="h-5 w-5" />
                </motion.button>
              )}
            </div>
            {list.length > 0 && (
              <div className="mt-3 space-y-2">
                {list.map((e) => (
                  <button key={e.item.id} onClick={() => setOpen({ catId: c.id, entry: e })} className="flex w-full items-center gap-3 rounded-2xl bg-paper/[0.06] p-3.5 text-left ring-1 ring-paper/10 hover:bg-paper/10">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{e.payload.title}</span>
                      <span className="flex items-center gap-3 text-[0.8rem] text-paper/50">
                        Modifié le {new Date(e.item.updatedAt).toLocaleDateString("fr-FR")}
                        {e.payload.files.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Paperclip className="h-3 w-3" /> {e.payload.files.length}
                          </span>
                        )}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-paper/40" />
                  </button>
                ))}
              </div>
            )}
            {list.length === 0 && owner && launched && (
              <button onClick={() => setOpen({ catId: c.id })} className="mt-3 w-full rounded-2xl border border-dashed border-paper/15 p-4 text-[0.9rem] text-paper/50 hover:border-gold/50 hover:text-paper/80">
                Vide pour l&apos;instant. Ajouter un document
              </button>
            )}
          </motion.section>
        );
      })}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? "Modifier la catégorie" : "Nouvelle catégorie"}>
        {editing && <CategoryForm value={editing} onDone={() => setEditing(null)} />}
      </Sheet>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.entry ? open.entry.payload.title : current ? current.meta.title : ""}>
        {open && current && (owner ? <ItemEditor key={open.entry?.item.id ?? open.catId} subId={open.catId} entry={open.entry} accept={mimeOf(current.meta.accept)} onDone={() => setOpen(null)} /> : open.entry && <ItemView subId={open.catId} entry={open.entry} />)}
      </Sheet>
    </>
  );
}

function CategoryForm({ value, onDone }: { value: { id?: string; meta: CategoryMeta }; onDone: () => void }) {
  const [title, setTitle] = useState(value.meta.title);
  const [accept, setAccept] = useState<Accept[]>(value.meta.accept);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  // "Tous fichiers" covers the others, so it is exclusive.
  const toggle = (a: Accept) =>
    setAccept((cur) => (a === "any" ? (cur.includes("any") ? [] : ["any"]) : cur.includes(a) ? cur.filter((x) => x !== a) : [...cur.filter((x) => x !== "any"), a]));

  async function save() {
    setBusy(true);
    const meta = { title: title.trim(), accept };
    if (value.id) await updateCategory(value.id, meta);
    else await createCategory(meta);
    onDone();
  }

  return (
    <div className="space-y-4">
      <Field label="Nom de la catégorie" value={title} onChange={setTitle} placeholder="Ex. Contrats privés, Photos, Codes…" autoFocus={!value.id} />
      <div>
        <span className="mb-1.5 block text-[0.92rem] font-semibold text-ink-soft">Ce qu&apos;elle peut contenir</span>
        <div className="flex flex-wrap gap-2">
          {ACCEPTS.map((a) => {
            const on = accept.includes(a.id);
            return (
              <button key={a.id} type="button" aria-pressed={on} onClick={() => toggle(a.id)} className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.92rem] font-semibold ring-1 ${on ? "bg-ink text-paper ring-ink" : "bg-paper ring-line"}`}>
                {on && <Check className="h-4 w-4" />} {a.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[0.85rem] text-mist">Chaque document a toujours un titre et des notes ; les fichiers sont limités aux types choisis.</p>
      </div>
      <Button full variant="gold" disabled={busy || !title.trim() || accept.length === 0} onClick={save}>
        {value.id ? "Enregistrer" : "Créer la catégorie"}
      </Button>
      {value.id &&
        (confirm ? (
          <Notice tone="coral">
            <p className="font-semibold">Supprimer la catégorie et tout ce qu&apos;elle contient ? C&apos;est définitif.</p>
            <div className="mt-3 flex gap-2">
              <Button variant="danger" onClick={async () => { await deleteCategory(value.id!); onDone(); }}>
                Supprimer
              </Button>
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Annuler
              </Button>
            </div>
          </Notice>
        ) : (
          <Button full variant="ghost" className="!text-coral" onClick={() => setConfirm(true)}>
            Supprimer la catégorie
          </Button>
        ))}
    </div>
  );
}
