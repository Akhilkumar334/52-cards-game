// engine/src/index.ts — barrel export for the whole engine package.
// Downstream packages (bots, ui) import from '@cards/engine' or '@cards/engine/<path>'.

export type { GameEngine, PlayerConfig } from './interface';
export { GameError } from './interface';

export type { Suit, Rank, Card, CardId, PlayerId } from './core/types';
export { SUITS, RANKS, RANK_ORDER, SEEP_VALUES } from './core/types';

export type { SeededRng } from './core/rng';
export { createRng } from './core/rng';

export { buildDeck, shuffle } from './core/deck';
export { dealEvenly } from './core/deal';
export { countCards, assertCardConservation, assertNoDuplicateCards } from './core/invariants';

// Bluff
export type { BluffRuleset } from './bluff/schema';
export { BluffRulesetSchema, DEFAULT_BLUFF_RULESET } from './bluff/schema';
export type { BluffGameState, BluffPlayer, BluffLastPlay, BluffPhase } from './bluff/state';
export type { BluffMove } from './bluff/moves';
export { BluffEngine } from './bluff/engine';
export { getBluffVisibleState } from './bluff/helpers';

// Thulla
export type { ThullaRuleset } from './thulla/schema';
export { ThullaRulesetSchema, DEFAULT_THULLA_RULESET } from './thulla/schema';
export type { ThullaGameState, ThullaPlayer, ThullaTrick, ThullaTrickCard, ThullaPhase } from './thulla/state';
export type { ThullaMove } from './thulla/moves';
export { ThullaEngine } from './thulla/engine';
export { getThullaVisibleState, getRankPower, THULLA_RANK_POWER } from './thulla/helpers';

// Seep
export type { SeepRuleset, FirstSeepCompulsoryMode, DealRemainingCards } from './seep/schema';
export {
  SeepRulesetSchema,
  FirstSeepCompulsoryModeSchema,
  DealRemainingCardsSchema,
  DEFAULT_SEEP_RULESET,
} from './seep/schema';
export type {
  SeepGameState,
  SeepPlayer,
  SeepHouse,
  SeepFloor,
  SeepTeam,
  SeepPhase,
} from './seep/state';
export type { SeepMove } from './seep/moves';
export { SeepEngine } from './seep/engine';
export {
  getSeepVisibleState,
  getCardPointValue,
  getCardNumericValue,
  countCapturedCardPoints,
  isTableCleared,
  isFullFloorSeep,
  canPartitionIntoTarget,
  findCapturableItems,
  getFloorClearingSeepMoves,
  getCompulsoryRestriction,
  getSeepForcedMoveReason,
} from './seep/helpers';
