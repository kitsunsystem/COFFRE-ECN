import { Button } from "@/components/ui";
import { Logo } from "@/components/visuals";

// A mistyped or cut link: the app's own page, in its colours and languages, with a way back (not Next's English one).
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-5 text-center">
      <div className="max-w-sm">
        <Logo />
        <h1 className="mt-8 text-[1.8rem] font-semibold leading-tight">Cette page n&apos;existe pas</h1>
        <p className="mt-3 text-ink-soft">Le lien est peut-être incomplet.</p>
        <Button href="/" className="mt-8">
          Retour à l&apos;accueil
        </Button>
      </div>
    </main>
  );
}
