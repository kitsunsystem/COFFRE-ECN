import { EspaceShell } from "@/components/shell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <EspaceShell>{children}</EspaceShell>;
}
