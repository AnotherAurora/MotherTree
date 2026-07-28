"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type AssetIconProps = {
  src: string | undefined;
  alt?: string;
  className?: string;
  size?: number;
  /** Dark backdrop for light-on-transparent art (e.g. posse icons). */
  darkChip?: boolean;
};

/** Small remote asset image that hides itself on load error. */
export function AssetIcon({
  src,
  alt = "",
  className,
  size = 20,
  darkChip = false,
}: AssetIconProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = src != null && failedSrc === src;

  if (!src || failed) {
    return null;
  }

  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- remote hotlink; hide on error
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={cn(
        "shrink-0 rounded-sm object-cover",
        !darkChip && className,
      )}
      onError={() => setFailedSrc(src)}
    />
  );

  if (!darkChip) {
    return image;
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-sm bg-zinc-900 p-0.5",
        className,
      )}
    >
      {image}
    </span>
  );
}
