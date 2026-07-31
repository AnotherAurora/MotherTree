/** Hardcoded awakener pairs that cannot share a team. */
const MUTEX_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [22, 44], // Ramona: Timeworn, Ramona
];

const MUTEX_MESSAGES = new Map<string, string>([
  ["22:44", "Ramona and Ramona: Timeworn cannot be on the same team"],
]);

function pairKey(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function messageForPair(a: number, b: number): string {
  return (
    MUTEX_MESSAGES.get(pairKey(a, b)) ??
    `Awakeners ${a} and ${b} cannot be on the same team`
  );
}

/** True if `candidateId` is mutex-paired with any id already selected. */
export function conflictsWithSelected(
  candidateId: number,
  selectedIds: Set<number>,
): boolean {
  for (const [a, b] of MUTEX_PAIRS) {
    if (candidateId === a && selectedIds.has(b)) return true;
    if (candidateId === b && selectedIds.has(a)) return true;
  }
  return false;
}

/** Mutex pairs present among the selected awakener ids. */
export function findMutexViolations(
  selectedIds: Iterable<number>,
): Array<[number, number]> {
  const ids = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
  const violations: Array<[number, number]> = [];
  for (const [a, b] of MUTEX_PAIRS) {
    if (ids.has(a) && ids.has(b)) violations.push([a, b]);
  }
  return violations;
}

/** Human-readable errors for mutex violations among selected ids. */
export function mutexViolationMessages(
  selectedIds: Iterable<number>,
): string[] {
  return findMutexViolations(selectedIds).map(([a, b]) => messageForPair(a, b));
}
