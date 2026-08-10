import { notFound, redirect } from "next/navigation";
import {
  getCalculatorHref,
  getDefaultCalculatorForGroup,
  isCalculatorGroup,
} from "@/lib/public/calculator-catalog";

type CalculatorGroupPageProps = {
  params: Promise<{ group: string }>;
};

export function generateStaticParams() {
  return [{ group: "core" }, { group: "realms" }];
}

export default async function CalculatorGroupPage({
  params,
}: CalculatorGroupPageProps) {
  const { group } = await params;

  if (!isCalculatorGroup(group)) {
    notFound();
  }

  const entry = getDefaultCalculatorForGroup(group);
  redirect(getCalculatorHref(entry));
}
