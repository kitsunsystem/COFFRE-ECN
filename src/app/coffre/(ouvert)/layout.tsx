import { CoffreShell } from "@/components/shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CoffreShell>{children}</CoffreShell>;
}
