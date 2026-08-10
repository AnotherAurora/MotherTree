import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalculatorToolShell } from "@/components/public/calculator-tool-shell";
import {
  CALCULATOR_CATALOG,
  getCalculatorBySlug,
  getGroupLabel,
  isCalculatorGroup,
} from "@/lib/public/calculator-catalog";

type CalculatorToolPageProps = {
  params: Promise<{ group: string; slug: string }>;
};

export function generateStaticParams() {
  return CALCULATOR_CATALOG.map((entry) => ({
    group: entry.group,
    slug: entry.slug,
  }));
}

export async function generateMetadata({
  params,
}: CalculatorToolPageProps): Promise<Metadata> {
  const { group, slug } = await params;
  const entry = getCalculatorBySlug(slug);
  if (!entry || entry.group !== group) {
    return { title: "Calculators" };
  }
  return { title: `${entry.title} · ${getGroupLabel(entry.group)}` };
}

export default async function CalculatorToolPage({
  params,
}: CalculatorToolPageProps) {
  const { group, slug } = await params;

  if (!isCalculatorGroup(group)) {
    notFound();
  }

  const entry = getCalculatorBySlug(slug);
  if (!entry || entry.group !== group) {
    notFound();
  }

  return <CalculatorToolShell entry={entry} />;
}
