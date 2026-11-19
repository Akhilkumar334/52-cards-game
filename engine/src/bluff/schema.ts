// ---------------------------------------------------------------------------
// Bluff ruleset schema — Zod-validated, all rule variations are fields here.
// No rule values are ever hardcoded in game logic; always read from the ruleset.
// ---------------------------------------------------------------------------

import { z } from 'zod';

export const BluffRulesetSchema = z.object({
  /** 1 = 52 cards, 2 = 104 cards. */
  deckCount: z.union([z.literal(1), z.literal(2)]).default(1),

  /**
   * Maximum cards a player may place on one turn.
   * Capped at 4 for 1 deck (52 cards), up to 8 for 2 decks (104 cards).
   */
  maxCardsPerPlay: z.number().int().min(1).max(8).default(4),

  /**
   * Who plays next after a challenge is resolved?
   *   'loser'    — the player who picked up the pile.
   *   'winner'   — the player who won the challenge.
   *   'sequence' — the next seat after the player who made the challenged play.
   */
  whoStartsAfterChallenge: z.enum(['loser', 'winner', 'sequence']).default('winner'),

  /**
   * If true: when a player plays their final cards, other players may still call
   * Bluff. The player only wins once the challenge window closes without a call,
   * or if they survive a challenge (i.e., they were truthful).
   * If false: playing the last card is an immediate win — no challenge possible.
   */
  mustSurviveCallOnLastPlay: z.boolean().default(true),

  /**
   * If true, the current player may pass their turn without playing.
   * The required rank still advances. Default false (passing is unusual in Bluff).
   */
  allowPass: z.boolean().default(false),

  /**
   * How rank progresses:
   *   'tableClearOnAllPass' — (Classic Indian Bluff) Leader declares any rank (e.g. Kings).
   *                           Subsequent plays must match that rank or pass/challenge.
   *                           When all players pass, the same hand continues and returns to the
   *                           last player to add more cards of that rank or pass to clear the table.
   *   'cycle'               — Sequential rank cycle: A -> 2 -> 3 -> ... -> K -> A.
   */
  rankProgression: z.enum(['tableClearOnAllPass', 'cycle']).default('cycle'),
});

export type BluffRuleset = z.infer<typeof BluffRulesetSchema>;

/** Parse an empty object to get the schema defaults. */
export const DEFAULT_BLUFF_RULESET: BluffRuleset = BluffRulesetSchema.parse({});
