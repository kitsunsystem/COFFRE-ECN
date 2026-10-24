"use client";
import { motion } from "motion/react";
import { ArrowLeft, Check, ChevronRight, ClipboardCopy, EyeOff, Lock, Paperclip, Plus, Smartphone } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { NamedIcon } from "@/components/icons";
import { ItemEditor, ItemView, type Entry } from "@/components/item-editor";
import { useNow } from "@/components/providers";
import { Button, Sheet } from "@/components/ui";
import { rise, stagger } from "@/components/visuals";
import { SECTIONS } from "@/lib/sections";
import { useApp, useSession } from "@/lib/store";
import { readItems, visibleSubsections } from "@/lib/vault";

export function SectionView({ id }: { id: string }) {
  const section = SECTIONS.find((s) => s.id === id)!;
  const items = useApp((s) => s.vault.items);
  const envelopes = useApp((s) => s.vault.envelopes);
  const account = useApp((s) => s.account);
  const launched = useApp((s) => s.phase) === "lancement";
  const [copied, setCopied] = useState(false);
  useApp((s) => s.procedures);
  useNow(5000);
  const mode = useSession((s) => s.session.mode);
  const owner = mode === "owner";
  const visible = visibleSubsections();
  const subs = section.subsections.filter((x) => owner || visible.includes(x.id));
  const [entries, setEntries] = useState<Record<string, Entry[]>>({});
  const [open, setOpen] = useState<{ subId: string; entry?: Entry } | null>(null);
  const subKey = subs.map((s) => s.id).join();

  useEffect(() => {
    let live = true;
    // Decrypt on the phone, in memory only.
    Promise.all(subs.map(async (s) => [s.id, await readItems(s.id)] as const)).then((r) => live && setEntries(Object.fromEntries(r)));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, envelopes, subKey]);

  if (section.optional && !account?.isBusinessOwner)
    return (
      <div className="text-center">
        <p className="text-paper/75">La rubrique « {section.title} » est réservée aux chefs d'entreprise.</p>
        <Button className="mt-4" variant="light" href="/espace/compte">
          L'activer dans mon compte
        </Button>
      </div>
    );

  const current = open && subs.find((s) => s.id === open.subId);

  // The emergency sheet lives outside the card: the person pastes it into the phone's medical ID, readable from the lock screen.
  async function copyMedical() {
    const f = (sub: string) => (entries[sub] ?? []).map((e) => e.payload.fields);
    const line = (label: string, v?: string) => (v?.trim() ? [`${label} : ${v.trim()}`] : []);
    const text = [
      `FICHE D'URGENCE${account ? ` — ${account.firstName} ${account.lastName}` : ""}`,
      ...f("groupe-allergies").flatMap((x) => [...line("Groupe sanguin", x.blood), ...line("Allergies", x.allergies)]),
      ...f("traitements").flatMap((x) => line("Traitement", [x.drug, x.dose].filter(Boolean).join(", "))),
      ...f("medecins").flatMap((x) => line("Médecin", [x.name, x.phone].filter(Boolean).join(" — "))),
      ...f("a-prevenir").flatMap((x) => line("À prévenir", [x.name, x.phone].filter(Boolean).join(" — "))),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={rise}>
        <Link href="/coffre/rubriques" className="inline-flex items-center gap-2 text-[0.95rem] font-semibold text-paper/70">
          <ArrowLeft className="h-4 w-4" /> Rubriques
        </Link>
      </motion.div>
      <motion.header variants={rise} className="flex items-start gap-4">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[1.4rem] bg-gradient-to-br from-gold-soft to-gold text-ink shadow-glow">
          <NamedIcon name={section.icon} className="h-8 w-8" />
        </span>
        <div>
          <h1 className="text-[1.9rem] font-semibold leading-tight">{section.title}</h1>
          <p className="mt-1 text-paper/65">{section.tagline}</p>
        </div>
      </motion.header>

      {section.id === "urgence" && subs.length > 0 && (
        <motion.div variants={rise} className="rounded-[1.6rem] bg-gradient-to-br from-sage/30 to-night-2 p-4 ring-1 ring-sage/30">
          <div className="flex items-start gap-3">
            <Smartphone className="mt-0.5 h-6 w-6 shrink-0 text-sage-soft" />
            <div className="flex-1">
              <div className="font-semibold">Fiche médicale du téléphone</div>
              <p className="text-[0.88rem] text-paper/65">Un pompier peut la lire depuis l&apos;écran verrouillé, sans carte.</p>
            </div>
          </div>
          <Button className="mt-3" full variant="light" icon={copied ? <Check className="h-5 w-5" /> : <ClipboardCopy className="h-5 w-5" />} onClick={copyMedical}>
            {copied ? "Copié : collez-le dans votre téléphone" : "Copier dans la fiche médicale de mon téléphone"}
          </Button>
          {copied && <p className="mt-3 text-[0.85rem] text-paper/70">iPhone : app Santé › votre photo › Fiche médicale › Modifier. Android : Paramètres › Sécurité et urgence › Informations médicales. Collez le texte, puis activez « Afficher en mode verrouillé ».</p>}
        </motion.div>
      )}

      {owner && !launched && (
        <motion.div variants={rise} className="flex items-start gap-3 rounded-2xl bg-gold/15 p-4 ring-1 ring-gold/30">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-gold-soft" />
          <p className="text-[0.92rem] text-paper/80">Phase découverte : l&apos;ajout de documents ouvrira au lancement officiel. Rien n&apos;est stocké avant que l&apos;hébergement certifié et le chiffrement définitif soient en place.</p>
        </motion.div>
      )}

      {section.id === "effacer" && (
        <motion.div variants={rise} className="flex items-start gap-3 rounded-2xl bg-paper/5 p-4 ring-1 ring-paper/10">
          <EyeOff className="mt-0.5 h-5 w-5 shrink-0 text-gold-soft" />
          <p className="text-[0.95rem] text-paper/75">Cette rubrique n'est attribuée à personne et ne peut pas l'être. Au décès confirmé, elle est détruite sans avoir été lue.</p>
        </motion.div>
      )}

      {subs.map((sub) => {
        const list = entries[sub.id] ?? [];
        return (
          <motion.section key={sub.id} variants={rise} className="rounded-[1.6rem] bg-night-2 p-4 ring-1 ring-paper/10">
            <div className="flex items-start gap-3 px-1">
              <div className="flex-1">
                <h2 className="text-[1.15rem] font-semibold">{sub.title}</h2>
                <p className="text-[0.85rem] text-paper/55">{sub.hint}</p>
              </div>
              {owner && launched && (
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setOpen({ subId: sub.id })} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold text-ink" aria-label={`Ajouter dans ${sub.title}`}>
                  <Plus className="h-5 w-5" />
                </motion.button>
              )}
            </div>
            {list.length > 0 && (
              <div className="mt-3 space-y-2">
                {list.map((e) => (
                  <motion.button key={e.item.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onClick={() => setOpen({ subId: sub.id, entry: e })} className="flex w-full items-center gap-3 rounded-2xl bg-paper/[0.06] p-3.5 text-left ring-1 ring-paper/10 hover:bg-paper/10">
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
                  </motion.button>
                ))}
              </div>
            )}
            {list.length === 0 && owner && launched && (
              <button onClick={() => setOpen({ subId: sub.id })} className="mt-3 w-full rounded-2xl border border-dashed border-paper/15 p-4 text-[0.9rem] text-paper/50 hover:border-gold/50 hover:text-paper/80">
                Rien pour l'instant. Ajouter un élément
              </button>
            )}
          </motion.section>
        );
      })}

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.entry ? open.entry.payload.title : current ? current.title : ""}>
        {open && (owner ? <ItemEditor key={open.entry?.item.id ?? open.subId} subId={open.subId} entry={open.entry} onDone={() => setOpen(null)} /> : open.entry && <ItemView subId={open.subId} entry={open.entry} />)}
      </Sheet>
    </motion.div>
  );
}
