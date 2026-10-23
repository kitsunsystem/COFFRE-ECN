"use client";
import { motion } from "motion/react";
import { FileSignature, Pencil, Plus, ShieldCheck, Trash, UserPlus } from "lucide-react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Badge, Button, Card, Field, Notice, PageTitle, Sheet, Toggle } from "@/components/ui";
import { rise, stagger } from "@/components/visuals";
import { RUBRICS, downloadLetter } from "@/lib/aide";
import { uid, useApp, type Person } from "@/lib/store";

const RELATIONS = ["Conjoint(e)", "Enfant", "Parent", "Frère ou sœur", "Ami(e)", "Autre"];
const empty: Person = { id: "", firstName: "", lastName: "", relation: "Enfant", email: "", phone: "" };
const procuration = RUBRICS.flatMap((r) => r.letters).find((l) => l.id === "procuration-coffre");

export default function Famille() {
  const s = useApp(useShallow((x) => ({ people: x.people, guarantors: x.guarantors, cards: x.cards, account: x.account!, set: x.set, email: x.email })));
  const [edit, setEdit] = useState<Person | null>(null);
  const [garant, setGarant] = useState<{ personId: string; role: string } | null>(null);
  const owner = `${s.account.firstName} ${s.account.lastName}`;

  function savePerson(p: Person) {
    const isNew = !p.id;
    const person = { ...p, id: p.id || uid() };
    s.set((x) => ({ people: isNew ? [...x.people, person] : x.people.map((y) => (y.id === person.id ? person : y)) }));
    setEdit(null);
  }

  function removePerson(id: string) {
    // Their cards stop opening anything at once.
    const cardIds = s.cards.filter((c) => c.holderId === id).map((c) => c.id);
    s.set((x) => ({
      people: x.people.filter((p) => p.id !== id),
      guarantors: x.guarantors.filter((g) => g.personId !== id),
      cards: x.cards.map((c) => (cardIds.includes(c.id) ? { ...c, status: "perdue", boxPk: undefined } : c)),
      rights: Object.fromEntries(Object.entries(x.rights).filter(([k]) => !cardIds.includes(k))),
      vault: { ...x.vault, envelopes: x.vault.envelopes.filter((e) => !cardIds.includes(e.cardId)) },
    }));
    setEdit(null);
  }

  function saveGarant(g: { personId: string; role: string }) {
    const exists = s.guarantors.some((x) => x.personId === g.personId);
    s.set((x) => ({ guarantors: exists ? x.guarantors.map((y) => (y.personId === g.personId ? g : y)) : [...x.guarantors, g] }));
    if (!exists) {
      const p = s.people.find((x) => x.id === g.personId)!;
      s.email(p.email || `${p.firstName} ${p.lastName}`, "invitation-garant", { ownerName: owner, role: g.role });
    }
    setGarant(null);
  }

  const card = (id: string) => s.cards.find((c) => c.holderId === id && c.status !== "perdue");

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      <PageTitle eyebrow="Ma famille" title="Ceux qui comptent" lead="Vos proches, vos garants, et ceux qui pourront vous aider. Ici, seulement des noms et des coordonnées : rien de personnel." />

      <motion.section variants={rise}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[1.4rem] font-semibold">Mes proches</h2>
          <Button className="!min-h-10 !px-4 !text-[0.9rem]" icon={<UserPlus className="h-4 w-4" />} onClick={() => setEdit({ ...empty })}>
            Ajouter
          </Button>
        </div>
        {s.people.length === 0 && <Notice tone="ink">Ajoutez votre conjoint, vos enfants, vos parents… Vous choisirez ensuite qui reçoit une carte et ce qu'il peut ouvrir.</Notice>}
        <div className="space-y-2.5">
          {s.people.map((p, i) => (
            <motion.button
              key={p.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setEdit(p)}
              className="flex w-full items-center gap-4 rounded-[1.4rem] bg-paper p-4 text-left shadow-soft ring-1 ring-line/70"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-soft to-sand font-display text-[1.1rem] font-semibold">
                {p.firstName[0]}
                {p.lastName[0]}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {p.firstName} {p.lastName}
                </span>
                <span className="flex flex-wrap gap-1.5 pt-1">
                  <Badge>{p.relation}</Badge>
                  {s.guarantors.some((g) => g.personId === p.id) && <Badge tone="gold">Garant</Badge>}
                  {card(p.id) && <Badge tone="sage">Carte</Badge>}
                  {p.managesMe && <Badge tone="coral">Gère mon compte</Badge>}
                </span>
              </span>
              <Pencil className="h-4 w-4 shrink-0 text-mist" />
            </motion.button>
          ))}
        </div>
      </motion.section>

      <motion.section variants={rise} className="mt-10">
        <h2 className="text-[1.4rem] font-semibold">Mes garants</h2>
        <p className="mt-1 text-ink-soft">Ce sont eux qui pourront signaler un coup dur ou un décès. Choisissez autant de garants que vous voulez, et écrivez vous-même le rôle de chacun.</p>
        <div className="mt-4 space-y-2.5">
          {s.guarantors.map((g) => {
            const p = s.people.find((x) => x.id === g.personId);
            if (!p) return null;
            return (
              <Card key={g.personId} className="!p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-gold-deep" />
                  <div className="flex-1">
                    <div className="font-semibold">
                      {p.firstName} {p.lastName}
                    </div>
                    <p className="text-[0.95rem] text-ink-soft">« {g.role} »</p>
                  </div>
                  <button onClick={() => setGarant(g)} aria-label="Modifier le rôle" className="rounded-full p-2 hover:bg-ink/5">
                    <Pencil className="h-4 w-4 text-mist" />
                  </button>
                  <button onClick={() => s.set((x) => ({ guarantors: x.guarantors.filter((y) => y.personId !== g.personId) }))} aria-label="Retirer ce garant" className="rounded-full p-2 hover:bg-coral/10">
                    <Trash className="h-4 w-4 text-coral" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
        <Button
          className="mt-4"
          variant="outline"
          full
          icon={<Plus className="h-5 w-5" />}
          disabled={s.people.every((p) => s.guarantors.some((g) => g.personId === p.id))}
          onClick={() => setGarant({ personId: s.people.find((p) => !s.guarantors.some((g) => g.personId === p.id))!.id, role: "" })}
        >
          Désigner un garant
        </Button>
      </motion.section>

      <motion.section variants={rise} className="mt-10">
        <Card className="bg-gradient-to-br from-paper to-sand/60">
          <FileSignature className="h-8 w-8 text-gold-deep" />
          <h2 className="mt-3 text-[1.3rem] font-semibold">Un enfant peut gérer le compte d'un parent</h2>
          <p className="mt-2 text-ink-soft">Si votre parent n'est pas à l'aise avec le téléphone, vous pouvez gérer son compte à sa place, avec une procuration signée. Le modèle est prêt : imprimez-le, faites-le signer, puis activez l'option sur la fiche du proche concerné.</p>
          {procuration && (
            <Button className="mt-4" variant="outline" onClick={() => downloadLetter(procuration)}>
              Télécharger le modèle de procuration
            </Button>
          )}
        </Card>
      </motion.section>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Modifier ce proche" : "Ajouter un proche"}>
        {edit && <PersonForm value={edit} onSave={savePerson} onDelete={edit.id ? () => removePerson(edit.id) : undefined} />}
      </Sheet>

      <Sheet open={!!garant} onClose={() => setGarant(null)} title="Garant">
        {garant && (
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[0.92rem] font-semibold text-ink-soft">Qui ?</span>
              <select
                value={garant.personId}
                onChange={(e) => setGarant({ ...garant, personId: e.target.value })}
                disabled={s.guarantors.some((g) => g.personId === garant.personId) && !!garant.role}
                className="w-full rounded-2xl bg-paper px-4 py-3.5 text-[1.05rem] ring-1 ring-line outline-none focus:ring-2 focus:ring-gold"
              >
                {s.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </option>
                ))}
              </select>
            </label>
            <Field label="Son rôle, avec vos mots" multiline value={garant.role} onChange={(role) => setGarant({ ...garant, role })} placeholder="Ex. Prévenir les enfants et appeler le notaire" />
            <p className="text-[0.88rem] text-mist">Il ou elle recevra un e-mail pour l'en informer. Être garant ne donne accès à rien dans votre Coffre.</p>
            <Button full variant="gold" disabled={!garant.role.trim()} onClick={() => saveGarant({ ...garant, role: garant.role.trim() })}>
              Enregistrer
            </Button>
          </div>
        )}
      </Sheet>
    </motion.div>
  );
}

function PersonForm({ value, onSave, onDelete }: { value: Person; onSave: (p: Person) => void; onDelete?: () => void }) {
  const [p, setP] = useState(value);
  const up = (k: keyof Person) => (v: string) => setP({ ...p, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom" value={p.firstName} onChange={up("firstName")} autoFocus />
        <Field label="Nom" value={p.lastName} onChange={up("lastName")} />
      </div>
      <div>
        <span className="mb-1.5 block text-[0.92rem] font-semibold text-ink-soft">Lien</span>
        <div className="flex flex-wrap gap-2">
          {RELATIONS.map((r) => (
            <button key={r} type="button" onClick={() => setP({ ...p, relation: r })} className={`rounded-full px-4 py-2 text-[0.92rem] font-semibold ring-1 ${p.relation === r ? "bg-ink text-paper ring-ink" : "bg-paper ring-line"}`}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <Field label="E-mail" type="email" inputMode="email" value={p.email ?? ""} onChange={up("email")} hint="Pour le prévenir s'il reçoit une carte ou devient garant." />
      <Field label="Téléphone" type="tel" inputMode="tel" value={p.phone ?? ""} onChange={up("phone")} />
      {p.relation === "Enfant" && <Toggle checked={!!p.managesMe} onChange={(managesMe) => setP({ ...p, managesMe })} label="Gère mon compte" hint="Avec une procuration signée" />}
      <Button full variant="gold" disabled={!p.firstName.trim() || !p.lastName.trim()} onClick={() => onSave({ ...p, firstName: p.firstName.trim(), lastName: p.lastName.trim() })}>
        Enregistrer
      </Button>
      {onDelete && (
        <Button full variant="ghost" className="!text-coral" onClick={onDelete}>
          Retirer ce proche
        </Button>
      )}
    </div>
  );
}
