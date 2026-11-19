// ---------------------------------------------------------------------------
// Card conservation invariant helpers.
// Every test that applies a move MUST call assertCardConservation afterwards.
// ---------------------------------------------------------------------------

import type { Card } from './types';

/** Sum of card counts across all zones. */
export function countCards(zones: ReadonlyArray<readonly Card[]>): number {
  return zones.reduce((sum, zone) => sum + zone.length, 0);
}

/**
 * Throws if the total card count across zones differs from `expected`.
 * Call after every move in tests to catch leaks or duplications early.
 */
export function assertCardConservation(
  zones: ReadonlyArray<readonly Card[]>,
  expected: number,
  context: string,
): void {
  const actual = countCards(zones);
  if (actual !== expected) {
    throw new Error(
      `[CardConservation] ${context}: expected ${expected} cards, found ${actual}`,
    );
  }
}

/**
 * Verify all card IDs in `zones` are unique (no duplicates across zones).
 * Useful for catching the "same card appeared twice" bug class.
 */
export function assertNoDuplicateCards(
  zones: ReadonlyArray<readonly Card[]>,
  context: string,
): void {
  const seen = new Set<string>();
  for (const zone of zones) {
    for (const card of zone) {
      if (seen.has(card.id)) {
        throw new Error(`[DuplicateCard] ${context}: card ${card.id} appears more than once`);
      }
      seen.add(card.id);
    }
  }
}
