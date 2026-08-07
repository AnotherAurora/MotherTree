"use client";

import {
  baseDeathResistToInMission,
  inMissionToCauseTrigger,
} from "@/lib/path-carver/death-resist-trigger";

type DeathResistTriggerChartProps = {
  /** Raw Death Resist percent (same units as the text box). */
  rawPercent: number;
  className?: string;
};

const WIDTH = 360;
const HEIGHT = 232;
const PAD = { top: 16, right: 16, bottom: 48, left: 44 };

/** Horizontal gap (px) below which x-axis labels are treated as overlapping. */
const LABEL_COLLIDE_PX = 32;
const LABEL_Y_BASE = HEIGHT - 30;
const LABEL_Y_STAGGER = HEIGHT - 16;

function formatAxis(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 100) return n.toFixed(0);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

function guaranteedTriggersFromRawPercent(rawPercent: number): number {
  if (rawPercent <= 0) return 0;
  return inMissionToCauseTrigger(
    baseDeathResistToInMission(rawPercent / 100),
  );
}

/**
 * Minimum raw % such that Guaranteed Trigger reaches `level`.
 * Null when level is non-positive (or unreachable).
 */
export function rawPercentAtTriggerLevel(level: number): number | null {
  if (level <= 0) return null;

  let hi = 400;
  while (guaranteedTriggersFromRawPercent(hi) < level) {
    hi *= 2;
    if (hi > 1e12) return null;
  }

  let lo = 0;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (guaranteedTriggersFromRawPercent(mid) >= level) hi = mid;
    else lo = mid;
  }

  // Binary search can land on the failing side of an In Mission ceil edge; nudge up.
  let result = hi;
  if (guaranteedTriggersFromRawPercent(result) < level) {
    let step = Number.EPSILON * Math.max(1, Math.abs(result)) * 8;
    for (
      let i = 0;
      i < 64 && guaranteedTriggersFromRawPercent(result) < level;
      i++
    ) {
      result += step;
      step *= 2;
    }
  }
  if (guaranteedTriggersFromRawPercent(result) < level) return null;
  return result;
}

/**
 * Extra raw % needed for +1 Guaranteed Trigger, snapped up to 0.1% so the
 * displayed step actually crosses the next trigger (avoids 0% on ceil edges).
 */
export function rawPercentNeededForNextTrigger(rawPercent: number): number {
  const current = guaranteedTriggersFromRawPercent(rawPercent);
  const threshold = rawPercentAtTriggerLevel(current + 1);
  if (threshold == null) return 0;

  const delta = threshold - rawPercent;
  let step =
    delta <= 0 ? 0.1 : Math.ceil(delta * 10 - 1e-9) / 10;
  if (delta > 0 && step <= 0) step = 0.1;

  while (
    guaranteedTriggersFromRawPercent(rawPercent + step) <= current &&
    step < 1e9
  ) {
    step = Math.round((step + 0.1) * 10) / 10;
  }
  return step;
}

type BreakpointWindow = {
  current: number;
  lastRaw: number;
  nextRaw: number | null;
  xMin: number;
  xMax: number;
};

function breakpointWindow(rawPercent: number): BreakpointWindow {
  const current = guaranteedTriggersFromRawPercent(rawPercent);
  const lastRaw =
    current <= 0 ? 0 : (rawPercentAtTriggerLevel(current) ?? 0);
  const nextRaw = rawPercentAtTriggerLevel(current + 1);

  let xMin: number;
  let xMax: number;

  if (nextRaw == null) {
    const span = Math.max(20, Math.abs(rawPercent - lastRaw) * 2, 1);
    xMin = Math.max(0, lastRaw - span * 0.15);
    xMax = Math.max(rawPercent, lastRaw) + span * 0.85;
  } else {
    const span = nextRaw - lastRaw;
    const pad = Math.max(span * 0.12, 0.05);
    xMin = lastRaw - pad;
    xMax = nextRaw + pad;
  }

  xMin = Math.min(xMin, rawPercent);
  xMax = Math.max(xMax, rawPercent);
  if (xMax <= xMin) xMax = xMin + 1;

  return { current, lastRaw, nextRaw, xMin, xMax };
}

function buildStepPath(
  win: BreakpointWindow,
  toX: (x: number) => number,
  toY: (y: number) => number,
): string {
  const { current, lastRaw, nextRaw, xMin, xMax } = win;
  const prev = current - 1;
  const next = current + 1;

  const parts: string[] = [];
  const move = (x: number, y: number) => {
    parts.push(`M ${toX(x).toFixed(2)} ${toY(y).toFixed(2)}`);
  };
  const line = (x: number, y: number) => {
    parts.push(`L ${toX(x).toFixed(2)} ${toY(y).toFixed(2)}`);
  };

  if (lastRaw > xMin) {
    move(xMin, prev);
    line(lastRaw, prev);
    line(lastRaw, current);
  } else {
    move(xMin, current);
  }

  const plateauEnd = nextRaw != null ? Math.min(nextRaw, xMax) : xMax;
  line(plateauEnd, current);

  if (nextRaw != null && nextRaw <= xMax) {
    line(nextRaw, next);
    if (nextRaw < xMax) line(xMax, next);
  }

  return parts.join(" ");
}

type XTick = {
  value: number;
  kind: "breakpoint" | "user";
};

function buildXTicks(
  lastRaw: number,
  nextRaw: number | null,
  rawPercent: number,
  xMin: number,
  xMax: number,
): XTick[] {
  const ticks: XTick[] = [];
  const inView = (t: number) => t >= xMin - 1e-9 && t <= xMax + 1e-9;

  if (Number.isFinite(lastRaw) && inView(lastRaw)) {
    ticks.push({ value: lastRaw, kind: "breakpoint" });
  }
  if (nextRaw != null && Number.isFinite(nextRaw) && inView(nextRaw)) {
    ticks.push({ value: nextRaw, kind: "breakpoint" });
  }
  if (Number.isFinite(rawPercent) && inView(rawPercent)) {
    const sameAsBreakpoint = ticks.some(
      (t) => Math.abs(t.value - rawPercent) < 1e-9,
    );
    if (!sameAsBreakpoint) {
      ticks.push({ value: rawPercent, kind: "user" });
    }
  }

  return ticks.sort((a, b) => a.value - b.value);
}

function labelYForTick(
  tick: XTick,
  all: XTick[],
  toX: (x: number) => number,
): number {
  if (tick.kind !== "user") return LABEL_Y_BASE;

  const x = toX(tick.value);
  const overlapsBreakpoint = all.some(
    (other) =>
      other.kind === "breakpoint" &&
      Math.abs(toX(other.value) - x) < LABEL_COLLIDE_PX,
  );
  return overlapsBreakpoint ? LABEL_Y_STAGGER : LABEL_Y_BASE;
}

export function DeathResistTriggerChart({
  rawPercent,
  className,
}: DeathResistTriggerChartProps) {
  const win = breakpointWindow(rawPercent);
  const { current, lastRaw, nextRaw, xMin, xMax } = win;
  const span = xMax - xMin;

  const yMin = current - 1.5;
  const yMax = current + 1.5;
  const ySpan = yMax - yMin;

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const toX = (x: number) => PAD.left + ((x - xMin) / span) * plotW;
  const toY = (y: number) => PAD.top + ((yMax - y) / ySpan) * plotH;

  const pathD = buildStepPath(win, toX, toY);

  const clampedRaw = Math.min(xMax, Math.max(xMin, rawPercent));
  const dotX = toX(clampedRaw);
  const dotY = toY(current);

  const xTicks = buildXTicks(lastRaw, nextRaw, rawPercent, xMin, xMax);
  const yTicks = [current - 1, current, current + 1];

  return (
    <figure className={className}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full max-w-md"
        role="img"
        aria-label={`Guaranteed Trigger breakpoints around ${current}, raw ${formatAxis(rawPercent)}`}
      >
        <rect
          x={PAD.left}
          y={PAD.top}
          width={plotW}
          height={plotH}
          fill="rgb(255 245 235 / 0.35)"
          stroke="var(--mt-border)"
          strokeWidth={1}
        />

        {xTicks.map((t) => (
          <line
            key={`vx-${t.kind}-${t.value}`}
            x1={toX(t.value)}
            y1={PAD.top}
            x2={toX(t.value)}
            y2={PAD.top + plotH}
            stroke="var(--mt-border)"
            strokeOpacity={0.45}
            strokeWidth={1}
            strokeDasharray={t.kind === "user" ? undefined : "3 3"}
          />
        ))}
        {yTicks.map((t) => (
          <line
            key={`hy-${t}`}
            x1={PAD.left}
            y1={toY(t)}
            x2={PAD.left + plotW}
            y2={toY(t)}
            stroke="var(--mt-border)"
            strokeOpacity={0.45}
            strokeWidth={1}
          />
        ))}

        <path
          d={pathD}
          fill="none"
          stroke="var(--mt-ink)"
          strokeWidth={2}
          strokeLinejoin="miter"
          strokeLinecap="square"
        />

        <circle
          cx={dotX}
          cy={dotY}
          r={5}
          fill="var(--mt-ember)"
          stroke="var(--mt-ember-deep)"
          strokeWidth={1.5}
        />

        {xTicks.map((t) => (
          <text
            key={`xl-${t.kind}-${t.value}`}
            x={toX(t.value)}
            y={labelYForTick(t, xTicks, toX)}
            textAnchor="middle"
            fill={
              t.kind === "user" ? "var(--mt-ember)" : "var(--mt-ink-muted)"
            }
            fontSize={10}
          >
            {formatAxis(t.value)}
          </text>
        ))}
        {yTicks.map((t) => (
          <text
            key={`yl-${t}`}
            x={PAD.left - 8}
            y={toY(t) + 3}
            textAnchor="end"
            fill="var(--mt-ink-muted)"
            fontSize={10}
          >
            {t}
          </text>
        ))}

        <text
          x={PAD.left + plotW / 2}
          y={HEIGHT - 2}
          textAnchor="middle"
          fill="var(--mt-ink-muted)"
          fontSize={9}
        >
          Raw Death Resist
        </text>
        <text
          x={12}
          y={PAD.top + plotH / 2}
          textAnchor="middle"
          fill="var(--mt-ink-muted)"
          fontSize={9}
          transform={`rotate(-90 12 ${PAD.top + plotH / 2})`}
        >
          Guaranteed Trigger
        </text>
      </svg>
      <figcaption className="mt-1 text-center text-xs text-[var(--mt-ink-muted)]">
        Red mark is your current raw
      </figcaption>
    </figure>
  );
}
