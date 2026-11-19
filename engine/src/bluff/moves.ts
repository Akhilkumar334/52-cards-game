// ---------------------------------------------------------------------------
// Bluff move union type.
// ---------------------------------------------------------------------------

import type { Rank, PlayerId } from '../core/types';

export type BluffMove =
  | {
      /** Play cards face-down, declaring them as `declaredRank` (must equal currentRank). */
      readonly type: 'PLAY';
      readonly playerId: PlayerId;
      /** IDs of the actual cards being placed — may lie about rank. */
      readonly cardIds: readonly string[];
      /** Must equal state.currentRank. Validated in applyMove. */
      readonly declaredRank: Rank;
    }
  | {
      /** Accuse the last player of lying. Reveals lastPlay.cards. */
      readonly type: 'CHALLENGE';
      readonly playerId: PlayerId;
    }
  | {
      /** Decline to challenge this turn. Removes this player from pendingIndices. */
      readonly type: 'PASS_CHALLENGE';
      readonly playerId: PlayerId;
    }
  | {
      /** Skip this turn without playing (only legal when ruleset.allowPass = true). */
      readonly type: 'PASS_TURN';
      readonly playerId: PlayerId;
    };
