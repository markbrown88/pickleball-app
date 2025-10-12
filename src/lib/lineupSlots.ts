export function expectedGenderForIndex(index: number): 'MALE' | 'FEMALE' {
  return index < 2 ? 'MALE' : 'FEMALE';
}

const ISO_TO_SLOT = {
  MENS_DOUBLES: 'MENS_DOUBLES',
  WOMENS_DOUBLES: 'WOMENS_DOUBLES',
  MIXED_1: 'MIXED_1',
  MIXED_2: 'MIXED_2',
} as const;

type IsoSlot = keyof typeof ISO_TO_SLOT;

export const LINEUP_SLOT_ORDER = [
  ISO_TO_SLOT.MENS_DOUBLES,
  ISO_TO_SLOT.WOMENS_DOUBLES,
  ISO_TO_SLOT.MIXED_1,
  ISO_TO_SLOT.MIXED_2,
] as const;

export const LINEUP_SLOT_CONFIG: Record<string, { indices: [number, number]; gender?: 'MALE' | 'FEMALE' }> = {
  [ISO_TO_SLOT.MENS_DOUBLES]: { indices: [0, 1], gender: 'MALE' },
  [ISO_TO_SLOT.WOMENS_DOUBLES]: { indices: [2, 3], gender: 'FEMALE' },
  [ISO_TO_SLOT.MIXED_1]: { indices: [0, 2] },
  [ISO_TO_SLOT.MIXED_2]: { indices: [1, 3] },
};

export function normalizeSlot(slot: string | null | undefined): (typeof LINEUP_SLOT_ORDER)[number] | null {
  if (!slot) return null;
  const key = slot.toUpperCase().replace(/\s+/g, '_') as IsoSlot;
  return ISO_TO_SLOT[key] ?? null;
}

export function mapLineupToEntries(players: { id: string | undefined }[]) {
  return [
    { slot: 'MENS_DOUBLES', player1Id: players[0]?.id, player2Id: players[1]?.id },
    { slot: 'WOMENS_DOUBLES', player1Id: players[2]?.id, player2Id: players[3]?.id },
    { slot: 'MIXED_1', player1Id: players[0]?.id, player2Id: players[2]?.id },
    { slot: 'MIXED_2', player1Id: players[1]?.id, player2Id: players[3]?.id },
  ];
}

export function playersForSlot<T extends { id: string } | undefined>(lineupPlayers: T[], slot: string) {
  const normalized = normalizeSlot(slot);
  if (!normalized) return [undefined, undefined] as const;
  const config = LINEUP_SLOT_CONFIG[normalized];
  if (!config) return [undefined, undefined] as const;

  const first = lineupPlayers[config.indices[0]];
  const second = lineupPlayers[config.indices[1]];
  return [first, second] as const;
}

