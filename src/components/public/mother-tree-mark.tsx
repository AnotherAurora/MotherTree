import { cn } from "@/lib/utils";

type MotherTreeMarkProps = {
  className?: string;
  as?: "p" | "span" | "h1";
};

export function MotherTreeMark({
  className,
  as: Tag = "p",
}: MotherTreeMarkProps) {
  return (
    <Tag className={cn("mt-brand-mark", className)}>Mother Tree</Tag>
  );
}
