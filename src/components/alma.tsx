"use client";
import { AnimatePresence, motion } from "motion/react";
import { Mic, Play, Send, Volume2, VolumeX } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ask, DISCLAIMER, SUGGESTIONS } from "@/lib/assistant";
import { ASSISTANT_NAME } from "@/lib/config";
import { useApp } from "@/lib/store";
import { Sheet } from "./ui";

export function AlmaFace({ speaking, size = 64 }: { speaking?: boolean; size?: number }) {
  return (
    <motion.svg viewBox="0 0 100 100" width={size} height={size} aria-hidden animate={{ y: [0, -2, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
      <defs>
        <radialGradient id="almaSkin" cx="40%" cy="35%">
          <stop offset="0%" stopColor="#f6dcc4" />
          <stop offset="100%" stopColor="#e2b896" />
        </radialGradient>
        <linearGradient id="almaHair" x1="0" x2="1">
          <stop offset="0%" stopColor="#3a2a24" />
          <stop offset="100%" stopColor="#5b4034" />
        </linearGradient>
      </defs>
      <motion.circle cx="50" cy="50" r="48" fill="#ead7a8" opacity="0.35" animate={{ r: [46, 49, 46] }} transition={{ duration: 3, repeat: Infinity }} />
      <path d="M18 54 C14 22 40 10 54 12 C78 14 88 34 82 58 C80 40 70 30 52 30 C34 30 22 40 18 54Z" fill="url(#almaHair)" />
      <ellipse cx="50" cy="55" rx="28" ry="31" fill="url(#almaSkin)" />
      <path d="M22 50 C24 30 42 22 56 24 C70 26 78 36 79 48 C70 36 58 32 46 34 C34 36 26 42 22 50Z" fill="url(#almaHair)" />
      <motion.g animate={{ scaleY: [1, 1, 0.1, 1] }} transition={{ duration: 4.2, repeat: Infinity, times: [0, 0.92, 0.96, 1] }} style={{ originY: "52px" }}>
        <ellipse cx="39" cy="53" rx="3.2" ry="3.8" fill="#2a1d18" />
        <ellipse cx="61" cy="53" rx="3.2" ry="3.8" fill="#2a1d18" />
      </motion.g>
      <circle cx="33" cy="63" r="4" fill="#e9967a" opacity="0.35" />
      <circle cx="67" cy="63" r="4" fill="#e9967a" opacity="0.35" />
      <motion.ellipse cx="50" cy="70" rx="7" fill="#b5524a" animate={{ ry: speaking ? [1.6, 4, 2, 3.6, 1.6] : 1.6 }} transition={{ duration: 0.6, repeat: speaking ? Infinity : 0 }} />
    </motion.svg>
  );
}

type Msg = { from: "me" | "alma"; text: string };

function placeOf(path: string) {
  if (path.startsWith("/coffre")) return "coffre";
  if (path.startsWith("/espace/aide")) return "aide";
  if (path.startsWith("/espace/cartes")) return "cartes";
  return "default";
}

export function Alma({ dark }: { dark?: boolean }) {
  const path = usePathname();
  const place = placeOf(path);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const voice = useApp((s) => s.assistantVoice);
  const setApp = useApp((s) => s.set);
  const end = useRef<HTMLDivElement>(null);

  // Braces matter: recent browsers return a Promise from scrollIntoView, which React would take for a cleanup.
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  function speak(t: string) {
    if (!voice || typeof speechSynthesis === "undefined") return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = "fr-FR";
    u.rate = 0.95;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    speechSynthesis.speak(u);
  }

  async function send(q: string) {
    if (!q.trim()) return;
    setMsgs((m) => [...m, { from: "me", text: q }]);
    setText("");
    const a = await ask(q, place);
    setMsgs((m) => [...m, { from: "alma", text: a }]);
    speak(a);
  }

  function listen() {
    const SR = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike; SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!SR) return alert("La dictée vocale n'est pas disponible sur ce navigateur.");
    const r = new SR();
    r.lang = "fr-FR";
    r.onresult = (e) => void send(e.results[0][0].transcript);
    r.onend = () => setListening(false);
    setListening(true);
    r.start();
  }

  return (
    <>
      {/* Lives in the top bar: a floating button used to hide "Ajouter", "Jamais" and other controls. */}
      <motion.button
        onClick={() => setOpen(true)}
        aria-label={`Parler à ${ASSISTANT_NAME}`}
        className={`flex items-center gap-1.5 rounded-full p-1 ring-1 sm:pr-3 ${dark ? "bg-paper/10 text-paper ring-paper/15" : "bg-paper ring-line"}`}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, type: "spring", stiffness: 200, damping: 16 }}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.95 }}
      >
        <AlmaFace size={34} />
        <span className="hidden text-[0.85rem] font-semibold sm:inline">{ASSISTANT_NAME}</span>
      </motion.button>

      <Sheet open={open} onClose={() => { setOpen(false); speechSynthesis?.cancel(); }} title={`Bonjour, je suis ${ASSISTANT_NAME}`}>
        <div className="flex items-center gap-4">
          <AlmaFace speaking={speaking} size={84} />
          <p className="flex-1 text-[0.95rem] text-ink-soft">Je vous guide pas à pas. Je ne vois jamais ce que vous écrivez dans votre Coffre.</p>
          <button onClick={() => setApp({ assistantVoice: !voice })} aria-label={voice ? "Couper la voix" : "Activer la voix"} className="rounded-full p-2.5 ring-1 ring-line">
            {voice ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </button>
        </div>

        {msgs.length === 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            {["Créer mon compte", "Activer mes cartes"].map((v) => (
              <div key={v} className="relative overflow-hidden rounded-2xl bg-ink p-4 text-paper">
                <Play className="mb-6 h-6 w-6 text-gold" />
                <div className="text-[0.9rem] font-semibold">{v}</div>
                <div className="text-[0.75rem] text-paper/60">Vidéo explicative · bientôt</div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 space-y-3" aria-live="polite">
          <AnimatePresence initial={false}>
            {msgs.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`max-w-[88%] rounded-3xl px-4 py-3 text-[0.98rem] ${m.from === "me" ? "ml-auto rounded-br-md bg-ink text-paper" : "rounded-bl-md bg-paper ring-1 ring-line"}`}>
                {m.text}
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={end} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(SUGGESTIONS[place] ?? SUGGESTIONS.default).map((s) => (
            <button key={s} onClick={() => void send(s)} className="rounded-full bg-gold-soft/60 px-3.5 py-2 text-[0.85rem] font-semibold text-ink ring-1 ring-gold/30">
              {s}
            </button>
          ))}
        </div>

        <form onSubmit={(e) => { e.preventDefault(); void send(text); }} className="mt-4 flex items-center gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Posez votre question" className="min-h-[3.25rem] flex-1 rounded-full bg-paper px-5 ring-1 ring-line outline-none focus:ring-2 focus:ring-gold" />
          <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={listen} aria-label="Parler" className={`grid h-[3.25rem] w-[3.25rem] place-items-center rounded-full ring-1 ring-line ${listening ? "bg-coral text-paper" : "bg-paper"}`}>
            <Mic className="h-5 w-5" />
          </motion.button>
          <motion.button type="submit" whileTap={{ scale: 0.9 }} aria-label="Envoyer" className="grid h-[3.25rem] w-[3.25rem] place-items-center rounded-full bg-ink text-paper">
            <Send className="h-5 w-5" />
          </motion.button>
        </form>
        <p className="mt-4 text-[0.78rem] text-mist">{DISCLAIMER}</p>
      </Sheet>
    </>
  );
}

interface SpeechRecognitionLike {
  lang: string;
  start(): void;
  onresult: (e: { results: { 0: { 0: { transcript: string } } } }) => void;
  onend: () => void;
}
