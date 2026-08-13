import { manualMeasureClass } from "@/components/public/manual-prose";
import { cn } from "@/lib/utils";

type ManualScreenshotProps = {
  src: string;
  alt: string;
  className?: string;
};

export function ManualScreenshot({
  src,
  alt,
  className,
}: ManualScreenshotProps) {
  return (
    <figure className={cn(manualMeasureClass, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local guide screenshots; avoid Image optimizer for large JPGs */}
      <img
        src={src}
        alt={alt}
        className="w-full rounded-sm border border-[var(--mt-border)] bg-[var(--mt-surface)]"
      />
    </figure>
  );
}
