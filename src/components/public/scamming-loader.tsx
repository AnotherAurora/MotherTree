import { cn } from "@/lib/utils";

type ScammingLoaderSize = "sm" | "md" | "lg";

const GIF_PX: Record<ScammingLoaderSize, number> = {
  sm: 36,
  md: 64,
  lg: 96,
};

export type ScammingLoaderProps = {
  label?: string;
  size?: ScammingLoaderSize;
  inline?: boolean;
  className?: string;
};

/**
 * Playful loading indicator using the Caraball emote. Only render while a
 * loading state is active so the animated GIF has no idle cost.
 */
export function ScammingLoader({
  label = "Scamming...",
  size = "md",
  inline = false,
  className,
}: ScammingLoaderProps) {
  const px = GIF_PX[size];
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex text-[var(--mt-ink-muted)]",
        inline ? "flex-row items-center gap-1.5" : "flex-col items-center gap-1",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/emotes/Caraball.gif"
        alt=""
        aria-hidden="true"
        width={px}
        height={px}
        className="shrink-0"
        style={{ width: px, height: px }}
      />
      <span
        className={cn(
          "font-medium",
          size === "sm" ? "text-xs" : "text-sm",
        )}
      >
        {label}
      </span>
    </span>
  );
}
