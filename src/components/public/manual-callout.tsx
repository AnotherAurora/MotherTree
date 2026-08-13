import type { ReactNode } from "react";
import { manualMeasureClass, manualStepHeadingClass } from "@/components/public/manual-prose";
import { cn } from "@/lib/utils";

type ManualCalloutProps = {
  id?: string;
  title: string;
  children: ReactNode;
  className?: string;
};

export function ManualCallout({
  id,
  title,
  children,
  className,
}: ManualCalloutProps) {
  return (
    <aside
      id={id}
      className={cn(
        manualMeasureClass,
        "scroll-mt-24 space-y-3 rounded-md border border-[rgb(185_28_28_/_0.35)] bg-[var(--mt-surface-strong)] px-4 py-4 sm:px-5 sm:py-5",
        className,
      )}
    >
      <h3 className={manualStepHeadingClass}>{title}</h3>
      {children}
    </aside>
  );
}
