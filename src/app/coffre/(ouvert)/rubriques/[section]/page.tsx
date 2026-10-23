import { notFound } from "next/navigation";
import { SECTIONS } from "@/lib/sections";
import { SectionView } from "./view";

export const dynamicParams = false;
export const generateStaticParams = () => SECTIONS.map((s) => ({ section: s.id }));

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!SECTIONS.some((s) => s.id === section)) notFound();
  return <SectionView id={section} />;
}
