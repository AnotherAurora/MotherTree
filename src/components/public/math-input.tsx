"use client";

import { useState, type ComponentProps } from "react";
import {
  evaluateExpression,
  formatExpressionResult,
  isValidExpressionDraft,
} from "@/components/public/math-expression";
import { Input } from "@/components/ui/input";

type MathInputProps = Omit<
  ComponentProps<typeof Input>,
  "value" | "onChange"
> & {
  value: string;
  onValueChange: (next: string) => void;
};

/**
 * A calculator numeric field that also accepts a small arithmetic expression
 * (e.g. "30+50"). The expression is evaluated on blur or Enter and the field is
 * replaced by the canonical numeric result. Invalid or incomplete input reverts
 * to the previous committed value; empty input commits as 0.
 */
export function MathInput({ value, onValueChange, ...props }: MathInputProps) {
  const [draft, setDraft] = useState<string | null>(null);

  function commit() {
    if (draft === null) return;
    const result = evaluateExpression(draft);
    setDraft(null);
    if (result === null) return; // invalid → revert to previous value
    const next = formatExpressionResult(result);
    if (next !== value) onValueChange(next);
  }

  return (
    <Input
      {...props}
      inputMode={props.inputMode ?? "decimal"}
      autoComplete={props.autoComplete ?? "off"}
      value={draft ?? value}
      onChange={(e) => {
        const next = e.target.value;
        if (!isValidExpressionDraft(next)) return;
        setDraft(next);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        props.onKeyDown?.(e);
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
    />
  );
}
