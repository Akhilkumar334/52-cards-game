// ---------------------------------------------------------------------------
// Seep (Sweep) Ruleset Schema & Types
// Pure TypeScript + Zod schema validation.
// All fields required with explicit defaults matching the Phase 3 specification.
// ---------------------------------------------------------------------------

import { z } from 'zod';

export const CourtCardsOnInitialFloorSchema = z.enum(['redeal', 'keep', 'bottom_of_deck']);
export type CourtCardsOnInitialFloor = z.infer<typeof CourtCardsOnInitialFloorSchema>;

export const FirstSeepCompulsoryModeSchema = z.enum(['anyFullClear', 'singleItemOnly']);
export type FirstSeepCompulsoryMode = z.infer<typeof FirstSeepCompulsoryModeSchema>;

export const DealRemainingCardsSchema = z.enum(['after_first_move', 'batches_of_four']);
export type DealRemainingCards = z.infer<typeof DealRemainingCardsSchema>;

export const SeepRulesetSchema = z.object({
  openingSeepBonus: z.number().int().min(0).default(25),
  openingSeepPermanent: z.boolean().default(true),
  laterSeepBonus: z.number().int().min(0).default(25),
  maxAdditionalSeeps: z.number().int().min(0).default(2),
  takedownEnabled: z.boolean().default(true),
  takedownAwardsBonus: z.boolean().default(false),
  firstSeepCompulsory: z.boolean().default(true),
  firstSeepCompulsoryMode: FirstSeepCompulsoryModeSchema.default('anyFullClear'),
  takedownCompulsory: z.boolean().default(true),
  dealRemainingCards: DealRemainingCardsSchema.default('after_first_move'),
  openingTrailOnlyIfCannotBuild: z.boolean().default(true),
  trailAlwaysAllowed: z.boolean().default(true),
  allowBuildOnOpponentHouse: z.boolean().default(true),
  multipleHousesAllowed: z.boolean().default(false),
  maxHousesOnFloor: z.number().int().min(1).default(2),
  captureCompulsory: z.boolean().default(false),
  leftoverFloorGoesToLastCapturer: z.boolean().default(true),
  courtCardsOnInitialFloor: CourtCardsOnInitialFloorSchema.default('redeal'),
  cementedHouses: z.boolean().default(true),
  thirdSeepDownsBoth: z.boolean().default(true),
  targetScore: z.number().int().min(1).default(100),
});

export type SeepRuleset = z.infer<typeof SeepRulesetSchema>;

export const DEFAULT_SEEP_RULESET: SeepRuleset = {
  openingSeepBonus: 25,
  openingSeepPermanent: true,
  laterSeepBonus: 25,
  maxAdditionalSeeps: 2,
  takedownEnabled: true,
  takedownAwardsBonus: false,
  firstSeepCompulsory: true,
  firstSeepCompulsoryMode: 'anyFullClear',
  takedownCompulsory: true,
  dealRemainingCards: 'after_first_move',
  openingTrailOnlyIfCannotBuild: true,
  trailAlwaysAllowed: true,
  allowBuildOnOpponentHouse: true,
  multipleHousesAllowed: false,
  maxHousesOnFloor: 2,
  captureCompulsory: false,
  leftoverFloorGoesToLastCapturer: true,
  courtCardsOnInitialFloor: 'redeal',
  cementedHouses: true,
  thirdSeepDownsBoth: true,
  targetScore: 100,
};
