// ---------------------------------------------------------------------------
// Seep helper utilities — scoring, point calculations, floor partition solver, visibility
// ---------------------------------------------------------------------------

import type { Card, CardId, PlayerId, Rank } from '../core/types';
import { SEEP_VALUES } from '../core/types';
import type { FloorItem, SeepFloor, SeepGameState, SeepHouse } from './state';
import type { SeepMove } from './moves';
import type { FirstSeepCompulsoryMode } from './schema';

/** Card points counting towards the 100-point round total. */
export function getCardPointValue(card: Card): number {
  if (card.suit === 'S') {
    return SEEP_VALUES[card.rank]; // A=1, 2-10=face, J=11, Q=12, K=13 (total 91)
  }
  if (card.rank === 'A') {
    return 1; // A♥, A♦, A♣ (1 pt each, total 3)
  }
  if (card.suit === 'D' && card.rank === 'T') {
    return 6; // 10♦ "Bada Patta" (6 pts)
  }
  return 0; // Total 91 + 3 + 6 = 100 points
}

/** Numeric capture value for building and capturing (A=1, 2-10 face, J=11, Q=12, K=13). */
export function getCardNumericValue(card: Card): number {
  return SEEP_VALUES[card.rank];
}

/** Get numeric effective value of a FloorItem (loose card or house). */
export function getFloorItemValue(item: FloorItem): number {
  return item.type === 'loose' ? getCardNumericValue(item.card) : item.house.buildValue;
}

/** Get ID of a FloorItem. */
export function getFloorItemId(item: FloorItem): string {
  return item.id;
}

/** Total card points of a pile. */
export function countCapturedCardPoints(cards: readonly Card[]): number {
  return cards.reduce((sum, c) => sum + getCardPointValue(c), 0);
}

/** Check if table is cleared (no loose cards and no houses left). */
export function isTableCleared(floor: SeepFloor): boolean {
  return floor.items.length === 0;
}

// ─── Floor Partition Solver ──────────────────────────────────────────────────

/**
 * Checks whether an array of floor items can be partitioned into one or more
 * disjoint subsets such that every subset sums strictly to targetValue.
 *
 * Houses count as atomic items with their house value.
 */
export function canPartitionIntoTarget(
  items: readonly FloorItem[],
  targetValue: number,
): boolean {
  if (items.length === 0) return false;

  const values = items.map((i) => getFloorItemValue(i));
  const totalSum = values.reduce((acc, v) => acc + v, 0);

  // Total sum MUST be a positive integer multiple of targetValue
  if (totalSum === 0 || totalSum % targetValue !== 0) {
    return false;
  }

  // Any item strictly greater than targetValue cannot be partitioned
  if (values.some((v) => v > targetValue)) {
    return false;
  }

  // Sort values descending for efficient branch pruning
  const sortedValues = [...values].sort((a, b) => b - a);
  const used = new Array<boolean>(sortedValues.length).fill(false);
  const numGroups = totalSum / targetValue;

  function backtrack(groupIndex: number, currentSum: number, startIndex: number): boolean {
    if (groupIndex === numGroups) {
      return true;
    }

    if (currentSum === targetValue) {
      // Find the first unassigned item for the next group
      let nextUnassigned = 0;
      while (nextUnassigned < sortedValues.length && used[nextUnassigned]) {
        nextUnassigned++;
      }
      used[nextUnassigned] = true;
      const res = backtrack(groupIndex + 1, sortedValues[nextUnassigned]!, nextUnassigned + 1);
      used[nextUnassigned] = false;
      return res;
    }

    for (let i = startIndex; i < sortedValues.length; i++) {
      if (!used[i] && currentSum + sortedValues[i]! <= targetValue) {
        // Prune duplicate sibling branches
        if (i > startIndex && sortedValues[i] === sortedValues[i - 1] && !used[i - 1]) {
          continue;
        }

        used[i] = true;
        if (backtrack(groupIndex, currentSum + sortedValues[i]!, i + 1)) {
          return true;
        }
        used[i] = false;
      }
    }

    return false;
  }

  // Start by putting the largest item in the first group
  used[0] = true;
  return backtrack(0, sortedValues[0]!, 1);
}

/**
 * Checks if the entire floor can be partitioned into groups each summing to targetValue.
 * If true, capturing with targetValue will clear the whole floor (SEEP).
 */
export function isFullFloorSeep(floor: SeepFloor, targetValue: number): boolean {
  return floor.items.length > 0 && canPartitionIntoTarget(floor.items, targetValue);
}

/**
 * Finds all maximal capturable items on the floor for a given card value.
 * In Seep, playing a card of value V captures:
 * 1. All single items (loose cards or houses) of value V.
 * 2. Combinations of items whose values sum to V.
 *
 * Returns list of FloorItems that can be legally captured.
 */
export function findCapturableItems(
  floorItems: readonly FloorItem[],
  targetValue: number,
): FloorItem[] {
  // If the entire floor partitions into targetValue, ALL items are captured (Seep)
  if (canPartitionIntoTarget(floorItems, targetValue)) {
    return [...floorItems];
  }

  // Otherwise, collect direct matches and combinations summing to targetValue
  const capturedSet = new Set<string>();

  // 1. Direct matches
  const directMatches = floorItems.filter((i) => getFloorItemValue(i) === targetValue);
  for (const item of directMatches) {
    capturedSet.add(item.id);
  }

  // 2. Subsets of remaining items summing to targetValue
  const remaining = floorItems.filter((i) => !capturedSet.has(i.id));
  const validSubsets = findDisjointSubsetsSummingTo(remaining, targetValue);
  for (const subset of validSubsets) {
    for (const item of subset) {
      capturedSet.add(item.id);
    }
  }

  return floorItems.filter((i) => capturedSet.has(i.id));
}

/**
 * Greedily finds disjoint subsets of items where each subset sums to targetValue.
 */
export function findDisjointSubsetsSummingTo(
  items: readonly FloorItem[],
  targetValue: number,
): FloorItem[][] {
  const result: FloorItem[][] = [];
  const used = new Set<string>();

  function search(startIndex: number, currentSum: number, currentGroup: FloorItem[]): boolean {
    if (currentSum === targetValue) {
      result.push([...currentGroup]);
      for (const item of currentGroup) {
        used.add(item.id);
      }
      return true;
    }
    if (currentSum > targetValue || startIndex >= items.length) {
      return false;
    }

    for (let i = startIndex; i < items.length; i++) {
      const item = items[i]!;
      if (used.has(item.id)) continue;
      const val = getFloorItemValue(item);
      if (currentSum + val <= targetValue) {
        currentGroup.push(item);
        if (search(i + 1, currentSum + val, currentGroup)) {
          return true;
        }
        currentGroup.pop();
      }
    }
    return false;
  }

  // Try to find as many disjoint subsets as possible
  let found = true;
  while (found) {
    found = false;
    const available = items.filter((i) => !used.has(i.id));
    if (search(0, 0, [])) {
      found = true;
    }
  }

  return result;
}

/** Find all subsets of items whose numeric values sum up to neededValue (for building). */
export function findSubsetsSummingTo(
  items: readonly Card[],
  targetValue: number,
  maxSize = 4,
): Card[][] {
  const results: Card[][] = [];

  function search(idx: number, currentSum: number, currentSet: Card[]) {
    if (currentSum === targetValue) {
      results.push([...currentSet]);
      return;
    }
    if (currentSum > targetValue || currentSet.length >= maxSize || idx >= items.length) {
      return;
    }

    for (let i = idx; i < items.length; i++) {
      const card = items[i]!;
      const val = getCardNumericValue(card);
      if (currentSum + val <= targetValue) {
        currentSet.push(card);
        search(i + 1, currentSum + val, currentSet);
        currentSet.pop();
      }
    }
  }

  search(0, 0, []);
  return results;
}

/** Construct a Floor object from loose cards and houses. */
export function createFloor(looseCards: readonly Card[], houses: readonly SeepHouse[]): SeepFloor {
  const items: FloorItem[] = [
    ...looseCards.map((c) => ({ type: 'loose' as const, id: c.id, card: c })),
    ...houses.map((h) => ({ type: 'house' as const, id: h.id, house: h })),
  ];
  return {
    items,
    looseCards,
    houses,
  };
}

/** Mask opponent hands for visible state. */
export function getSeepVisibleState(
  state: SeepGameState,
  forPlayerId: PlayerId,
): SeepGameState {
  const emptyHand: readonly Card[] = Object.freeze([]);
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === forPlayerId ? p : { ...p, hand: emptyHand },
    ),
  };
}

/**
 * Computes all full-floor clearing capture moves (Seeps) available for a player's hand.
 *
 * Rules:
 * - In "anyFullClear" mode (default): A move is a seep ONLY IF all items on the floor
 *   can be partitioned into groups where every group sums strictly to that card's value,
 *   with no item left over.
 * - In "singleItemOnly" mode: The rule fires ONLY when the floor contains exactly ONE item
 *   (one house or one loose card) and the player holds a matching card.
 */
export function getFloorClearingSeepMoves(
  floor: SeepFloor,
  hand: readonly Card[],
  playerId: PlayerId,
  mode: FirstSeepCompulsoryMode = 'anyFullClear',
): Extract<SeepMove, { type: 'CAPTURE' }>[] {
  if (floor.items.length === 0) return [];

  // In singleItemOnly mode: only fires when floor is exactly one item
  if (mode === 'singleItemOnly' && floor.items.length !== 1) {
    return [];
  }

  const seepMoves: Extract<SeepMove, { type: 'CAPTURE' }>[] = [];
  const allItemIds = floor.items.map((i) => i.id);
  const looseCardIds = floor.items.filter((i) => i.type === 'loose').map((i) => i.id);
  const houseIds = floor.items.filter((i) => i.type === 'house').map((i) => i.id);

  for (const hCard of hand) {
    const cardVal = getCardNumericValue(hCard);
    if (canPartitionIntoTarget(floor.items, cardVal)) {
      seepMoves.push({
        type: 'CAPTURE',
        playerId,
        handCardId: hCard.id,
        itemIds: allItemIds,
        capturedLooseCardIds: looseCardIds,
        capturedHouseIds: houseIds,
      });
    }
  }

  return seepMoves;
}

export interface CompulsoryRestriction {
  readonly reason: string | null;
  readonly forcedMoves: readonly SeepMove[] | null;
}

/**
 * Computes whether a compulsory move restriction applies to the current player.
 *
 * Priority order:
 * 1. Compulsory Takedown (if opponent has active seeps and player can clear the entire floor)
 * 2. Compulsory First Seep (if no seep has occurred yet and player can clear the entire floor per ruleset mode)
 * 3. Compulsory Capture (if ruleset.captureCompulsory is enabled and any capture exists)
 */
export function getCompulsoryRestriction(
  state: SeepGameState,
  playerId: PlayerId,
): CompulsoryRestriction {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (
    playerIndex === -1 ||
    playerIndex !== state.currentPlayerIndex ||
    state.phase.type !== 'playing'
  ) {
    return { reason: null, forcedMoves: null };
  }

  const player = state.players[playerIndex]!;
  const hand = player.hand;
  const floor = state.floor;
  const ruleset = state.ruleset;
  const opponentTeams = state.teams.filter((t) => t.teamIndex !== player.teamIndex);

  // 1. Takedown requires clearing the entire floor
  const fullSeepMoves = getFloorClearingSeepMoves(floor, hand, playerId, 'anyFullClear');
  const hasOpponentActiveSeeps = opponentTeams.some((t) => t.activeSeeps > 0);
  const takedownApplies =
    ruleset.takedownCompulsory && hasOpponentActiveSeeps && fullSeepMoves.length > 0;

  if (takedownApplies) {
    return {
      reason: 'Forced Move: Compulsory Takedown — You must take down the opponent’s active seep!',
      forcedMoves: fullSeepMoves,
    };
  }

  // 2. Compulsory First Seep requires clearing the entire floor per firstSeepCompulsoryMode
  const firstSeepMode = ruleset.firstSeepCompulsoryMode ?? 'anyFullClear';
  const firstSeepMoves = getFloorClearingSeepMoves(floor, hand, playerId, firstSeepMode);
  const firstSeepApplies =
    ruleset.firstSeepCompulsory && !state.firstSeepOccurred && firstSeepMoves.length > 0;

  if (firstSeepApplies) {
    return {
      reason: 'Forced Move: Compulsory First Seep — You must capture to score the first seep!',
      forcedMoves: firstSeepMoves,
    };
  }

  // 3. Compulsory Capture (captures any floor item, does not have to clear floor)
  if (ruleset.captureCompulsory) {
    const allCaptureMoves: Extract<SeepMove, { type: 'CAPTURE' }>[] = [];
    for (const hCard of hand) {
      const cardVal = getCardNumericValue(hCard);
      const capturable = findCapturableItems(floor.items, cardVal);
      if (capturable.length > 0) {
        allCaptureMoves.push({
          type: 'CAPTURE',
          playerId,
          handCardId: hCard.id,
          itemIds: capturable.map((i) => i.id),
          capturedLooseCardIds: capturable.filter((i) => i.type === 'loose').map((i) => i.id),
          capturedHouseIds: capturable.filter((i) => i.type === 'house').map((i) => i.id),
        });
      }
    }
    if (allCaptureMoves.length > 0) {
      return {
        reason: 'Forced Move: Compulsory Capture — Captures are mandatory!',
        forcedMoves: allCaptureMoves,
      };
    }
  }

  return { reason: null, forcedMoves: null };
}

/**
 * Returns the human-readable compulsory reason string if a restriction applies,
 * or null if no restriction applies. Derived from getCompulsoryRestriction.
 */
export function getSeepForcedMoveReason(state: SeepGameState, playerId: PlayerId): string | null {
  return getCompulsoryRestriction(state, playerId).reason;
}
