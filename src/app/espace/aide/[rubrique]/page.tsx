import { notFound } from "next/navigation";
import { RUBRICS, rubric } from "@/lib/aide";
import { RubriqueView } from "./view";

export const dynamicParams = false;
export const generateStaticParams = () => RUBRICS.map((r) => ({ rubrique: r.id }));

export default async function Page({ params }: { params: Promise<{ rubrique: string }> }) {
  const { rubrique } = await params;
  if (!rubric(rubrique)) notFound();
  return <RubriqueView id={rubrique} />;
}
