// ---------------------------------------------------------------------------
// Thulla (Bhabhi) ruleset schema — Zod-validated.
// All rule options read from here; zero hardcoded rule parameters in logic.
// ---------------------------------------------------------------------------

import { z } from 'zod';

export const ThullaRulesetSchema = z.object({
  /** 1 = 52 cards, 2 = 104 cards. */
  deckCount: z.union([z.literal(1), z.literal(2)]).default(1),

  /**
   * Rule for who starts the very first trick of the game:
   *   'aceOfSpades' — Player holding Ace of Spades (must lead A♠).
   *   'lowestCard'  — Player holding the lowest card (e.g. 2♣ or 2♠).
   *   'random'      — Chosen at random.
   */
  firstLeaderRule: z.enum(['aceOfSpades', 'lowestCard', 'random']).default('aceOfSpades'),

  /**
   * Who leads the next trick after a Thulla (penalty pickup) occurs:
   *   'highestCardHolder' — The player who played the highest card of the led suit and picked up the pile.
   *   'thullaPlayer'      — The player who slapped/hit the Thulla (void player).
   */
  whoLeadsAfterThulla: z.enum(['highestCardHolder', 'thullaPlayer']).default('highestCardHolder'),
});

export type ThullaRuleset = z.infer<typeof ThullaRulesetSchema>;

export const DEFAULT_THULLA_RULESET: ThullaRuleset = ThullaRulesetSchema.parse({});
