import type { IngameTokenDictionaries } from "./ingame-token-dictionaries";
import type { DecodedIngameSlot, DecodedIngameTeam, IngameImportWarning } from "./types";

const INGAME_WRAPPER = "@@";
const TEAM_SLOT_COUNT = 4;
const EMPTY_COVENANT_TOKEN = "a";
const POSSE_TOKEN_LENGTH = 1;
const WHEEL_TOKENS_PER_SLOT = 2;
const WARNING_TOKEN_PREVIEW_LIMIT = 32;

type WheelCandidate = {
  token: string;
  wheelId?: string;
  candidateIds?: string[];
  unknown?: boolean;
};

function createEmptySlots(): DecodedIngameSlot[] {
  return Array.from({ length: TEAM_SLOT_COUNT }, () => ({
    awakenerId: null,
    wheel1Id: null,
    wheel2Id: null,
    covenantId: null,
  }));
}

function truncateWarningToken(token: string): string {
  return token.length > WARNING_TOKEN_PREVIEW_LIMIT
    ? token.slice(0, WARNING_TOKEN_PREVIEW_LIMIT)
    : token;
}

function normalizeWrappedPayload(code: string): string {
  const trimmed = code.trim();
  if (!trimmed.startsWith(INGAME_WRAPPER) || !trimmed.endsWith(INGAME_WRAPPER)) {
    throw new Error("Invalid in-game code wrapper. Expected @@...@@.");
  }
  const payload = trimmed.slice(INGAME_WRAPPER.length, -INGAME_WRAPPER.length);
  if (!payload) {
    throw new Error("In-game code payload is empty.");
  }
  return payload;
}

function buildLongestTokenList(tokens: Iterable<string>): string[] {
  return Array.from(tokens).sort((left, right) => {
    if (right.length !== left.length) {
      return right.length - left.length;
    }
    return left.localeCompare(right);
  });
}

function findLongestTokenAt(
  payload: string,
  cursor: number,
  tokenList: string[],
): string | null {
  for (const token of tokenList) {
    if (payload.startsWith(token, cursor)) {
      return token;
    }
  }
  return null;
}

function getWheelCandidatesAt(
  payload: string,
  cursor: number,
  wheelIdsByToken: Map<string, string[]>,
  sortedWheelTokens: string[],
): WheelCandidate[] {
  const candidates: WheelCandidate[] = [];
  if (payload[cursor] === "a") {
    candidates.push({ token: "a" });
  }

  for (const token of sortedWheelTokens) {
    if (!payload.startsWith(token, cursor)) {
      continue;
    }
    const candidateIds = wheelIdsByToken.get(token) ?? [];
    candidates.push({
      token,
      wheelId: candidateIds.length === 1 ? candidateIds[0] : undefined,
      candidateIds,
    });
  }

  if (candidates.length === 0 && cursor < payload.length) {
    candidates.push({ token: payload[cursor]!, unknown: true });
  }

  return candidates;
}

function parseWheelToken(
  payload: string,
  cursor: number,
  wheelIdsByToken: Map<string, string[]>,
  sortedWheelTokens: string[],
): { candidate: WheelCandidate; nextCursor: number } {
  const candidates = getWheelCandidatesAt(
    payload,
    cursor,
    wheelIdsByToken,
    sortedWheelTokens,
  );
  const candidate = candidates[0] ?? { token: payload[cursor] ?? "a", unknown: true };
  return {
    candidate,
    nextCursor: cursor + candidate.token.length,
  };
}

function pushAmbiguousWarning(
  warnings: IngameImportWarning[],
  section: IngameImportWarning["section"],
  token: string,
  candidateIds: string[],
  options: { slotIndex?: number; field?: "wheelOne" | "wheelTwo" } = {},
) {
  warnings.push({
    section,
    slotIndex: options.slotIndex,
    field: options.field,
    token: truncateWarningToken(token),
    reason: "ambiguous_parse",
    candidateIds,
  });
}

function pushUnknownAwakenerWarning(
  warnings: IngameImportWarning[],
  slotIndex: number,
  token: string,
) {
  warnings.push({
    section: "awakener",
    slotIndex,
    token: truncateWarningToken(token),
    reason: "unknown_token",
  });
}

function decodeAwakenerSlots(
  payload: string,
  dictionaries: IngameTokenDictionaries,
  warnings: IngameImportWarning[],
): { slots: DecodedIngameSlot[]; cursor: number } {
  const awakenerTokenList = buildLongestTokenList(
    dictionaries.awakeners.byTokenIds.keys(),
  );
  let cursor = 0;
  const slots = createEmptySlots();

  for (let slotIndex = 0; slotIndex < TEAM_SLOT_COUNT; slotIndex += 1) {
    if (cursor >= payload.length) {
      throw new Error("Corrupted in-game code: missing awakener tokens.");
    }

    const token = findLongestTokenAt(payload, cursor, awakenerTokenList);
    if (!token) {
      pushUnknownAwakenerWarning(warnings, slotIndex, payload[cursor]!);
      cursor += 1;
      continue;
    }

    const candidateIds = dictionaries.awakeners.byTokenIds.get(token) ?? [];
    if (candidateIds.length > 1) {
      pushAmbiguousWarning(warnings, "awakener", token, candidateIds, { slotIndex });
      cursor += token.length;
      continue;
    }

    const awakenerId = candidateIds[0];
    if (!awakenerId) {
      pushUnknownAwakenerWarning(warnings, slotIndex, token);
      cursor += token.length;
      continue;
    }

    slots[slotIndex] = {
      ...slots[slotIndex]!,
      awakenerId,
    };
    cursor += token.length;
  }

  return { slots, cursor };
}

function decodeWheelCandidates(
  payload: string,
  cursor: number,
  dictionaries: IngameTokenDictionaries,
): { wheelCandidates: WheelCandidate[]; cursor: number } {
  const wheelTokenList = buildLongestTokenList(dictionaries.wheels.byTokenIds.keys());
  const wheelCandidates: WheelCandidate[] = [];

  for (let index = 0; index < TEAM_SLOT_COUNT * WHEEL_TOKENS_PER_SLOT; index += 1) {
    if (cursor >= payload.length - POSSE_TOKEN_LENGTH) {
      throw new Error("Corrupted in-game code: missing wheel token block.");
    }

    const parsed = parseWheelToken(
      payload,
      cursor,
      dictionaries.wheels.byTokenIds,
      wheelTokenList,
    );
    wheelCandidates.push(parsed.candidate);
    cursor = parsed.nextCursor;
  }

  return { wheelCandidates, cursor };
}

function resolveDecodedWheelId(
  candidate: WheelCandidate | undefined,
  slotIndex: number,
  field: "wheelOne" | "wheelTwo",
  warnings: IngameImportWarning[],
): string | null {
  const wheelId = candidate?.wheelId;
  const candidateIds = candidate?.candidateIds ?? [];
  if (candidate && candidateIds.length > 1) {
    pushAmbiguousWarning(warnings, "wheel", candidate.token, candidateIds, {
      slotIndex,
      field,
    });
    return null;
  }

  if (wheelId) {
    return wheelId;
  }

  if (candidate && candidate.token !== "a") {
    warnings.push({
      section: "wheel",
      slotIndex,
      field,
      token: truncateWarningToken(candidate.token),
      reason: "unknown_token",
    });
  }

  return null;
}

function parseCovenantToken(
  covenantBlock: string,
  cursor: number,
  tokenList: string[],
): { token: string; nextCursor: number; unknown?: boolean } {
  if (covenantBlock[cursor] === "a") {
    return {
      token: "a",
      nextCursor: cursor + 1,
    };
  }

  const token = findLongestTokenAt(covenantBlock, cursor, tokenList);
  if (token) {
    return {
      token,
      nextCursor: cursor + token.length,
    };
  }

  return {
    token: covenantBlock[cursor] ?? "a",
    nextCursor: cursor + 1,
    unknown: true,
  };
}

function decodeCovenantTokens(
  covenantBlock: string,
  dictionaries: IngameTokenDictionaries,
  warnings: IngameImportWarning[],
): string[] {
  const tokenList = buildLongestTokenList(dictionaries.covenants.byTokenIds.keys());
  const tokensBySlot: string[] = [];
  let cursor = 0;

  for (let slotIndex = 0; slotIndex < TEAM_SLOT_COUNT; slotIndex += 1) {
    if (cursor >= covenantBlock.length) {
      throw new Error("Corrupted in-game code: incomplete covenant block.");
    }
    const parsed = parseCovenantToken(covenantBlock, cursor, tokenList);
    if (parsed.unknown) {
      warnings.push({
        section: "covenant",
        slotIndex,
        token: truncateWarningToken(parsed.token),
        reason: "unknown_token",
      });
    }
    tokensBySlot.push(parsed.token);
    cursor = parsed.nextCursor;
  }

  if (cursor < covenantBlock.length) {
    warnings.push({
      section: "covenant",
      slotIndex: TEAM_SLOT_COUNT - 1,
      token: truncateWarningToken(covenantBlock.slice(cursor)),
      reason: "unknown_token",
    });
  }

  return tokensBySlot;
}

function resolveDecodedCovenantId(
  token: string | undefined,
  slotIndex: number,
  dictionaries: IngameTokenDictionaries,
  warnings: IngameImportWarning[],
): string | null {
  if (!token || token === EMPTY_COVENANT_TOKEN) {
    return null;
  }

  const candidateIds = dictionaries.covenants.byTokenIds.get(token) ?? [];
  if (candidateIds.length > 1) {
    pushAmbiguousWarning(warnings, "covenant", token, candidateIds, { slotIndex });
    return null;
  }

  const covenantId = candidateIds[0];
  if (!covenantId) {
    warnings.push({
      section: "covenant",
      slotIndex,
      token: truncateWarningToken(token),
      reason: "unknown_token",
    });
    return null;
  }

  return covenantId;
}

function normalizeDecodedEquipment(
  slots: DecodedIngameSlot[],
  wheelCandidates: WheelCandidate[],
  covenantBlock: string,
  dictionaries: IngameTokenDictionaries,
  warnings: IngameImportWarning[],
): DecodedIngameSlot[] {
  const covenantTokensBySlot = decodeCovenantTokens(
    covenantBlock,
    dictionaries,
    warnings,
  );

  return slots.map((slot, slotIndex) => ({
    ...slot,
    wheel1Id: resolveDecodedWheelId(
      wheelCandidates[slotIndex * 2],
      slotIndex,
      "wheelOne",
      warnings,
    ),
    wheel2Id: resolveDecodedWheelId(
      wheelCandidates[slotIndex * 2 + 1],
      slotIndex,
      "wheelTwo",
      warnings,
    ),
    covenantId: resolveDecodedCovenantId(
      covenantTokensBySlot[slotIndex],
      slotIndex,
      dictionaries,
      warnings,
    ),
  }));
}

function decodePosseId(
  payload: string,
  dictionaries: IngameTokenDictionaries,
  warnings: IngameImportWarning[],
): string | null {
  const posseToken = payload[payload.length - 1]!;
  const candidateIds = dictionaries.posses.byTokenIds.get(posseToken) ?? [];
  if (candidateIds.length > 1) {
    pushAmbiguousWarning(warnings, "posse", posseToken, candidateIds);
    return null;
  }

  const posseId = candidateIds[0];
  if (posseToken !== "a" && !posseId) {
    warnings.push({
      section: "posse",
      token: truncateWarningToken(posseToken),
      reason: "unknown_token",
    });
  }

  return posseId ?? null;
}

export function decodeIngameTeamCode(
  code: string,
  dictionaries: IngameTokenDictionaries,
): DecodedIngameTeam {
  const payload = normalizeWrappedPayload(code);
  const warnings: IngameImportWarning[] = [];

  const decodedAwakeners = decodeAwakenerSlots(payload, dictionaries, warnings);
  const decodedWheels = decodeWheelCandidates(payload, decodedAwakeners.cursor, dictionaries);

  if (decodedWheels.cursor >= payload.length) {
    throw new Error("Corrupted in-game code: missing posse token.");
  }

  const covenantBlock = payload.slice(
    decodedWheels.cursor,
    payload.length - POSSE_TOKEN_LENGTH,
  );
  const slots = normalizeDecodedEquipment(
    decodedAwakeners.slots,
    decodedWheels.wheelCandidates,
    covenantBlock,
    dictionaries,
    warnings,
  );
  const posseId = decodePosseId(payload, dictionaries, warnings);

  return { slots, posseId, warnings };
}
