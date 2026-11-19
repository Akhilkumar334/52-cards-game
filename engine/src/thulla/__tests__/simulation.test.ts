// ---------------------------------------------------------------------------
// Thulla simulation test — 1000 bot-vs-bot games with seeds 0–999.
// Asserts: game terminates, no crash, card conservation on every move, scores valid.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { ThullaEngine } from '../engine';
import { DEFAULT_THULLA_RULESET } from '../schema';
import type { ThullaGameState } from '../state';
import type { ThullaMove } from '../moves';
import type { PlayerConfig } from '../../core/types';
import { createRng } from '../../core/rng';
import { countCards, assertNoDuplicateCards } from '../../core/invariants';

function pickBotMove(
  fullState: ThullaGameState,
  actorId: string,
  turnRng: ReturnType<typeof createRng>,
): ThullaMove {
  const visible = ThullaEngine.getVisibleState(fullState, actorId);
  const legalMoves = ThullaEngine.getLegalMoves(visible, actorId);
  if (legalMoves.length === 0) throw new Error(`No legal moves for ${actorId}`);

  // Pick random legal move
  const idx = turnRng.nextInt(0, legalMoves.length - 1);
  return legalMoves[idx]!;
}

function zones(s: ThullaGameState) {
  const currentTrickCards = s.currentTrick ? s.currentTrick.cards.map((tc) => tc.card) : [];
  return [...s.players.map((p) => [...p.hand]), [...currentTrickCards], [...s.discardPile]];
}

describe('Thulla simulation (1000 games, 4 bots, default ruleset)', () => {
  const players: PlayerConfig[] = Array.from({ length: 4 }, (_, i) => ({
    id: `p${i}`,
    name: `Bot${i}`,
    isBot: true,
  }));

  const MAX_MOVES_PER_GAME = 10_000;

  it('all 1000 games terminate with valid state and strict card conservation', () => {
    for (let seed = 0; seed < 1000; seed++) {
      const turnRng = createRng(seed * 77777);
      let state = ThullaEngine.createGame(DEFAULT_THULLA_RULESET, players, seed);
      let moves = 0;

      while (!ThullaEngine.isGameOver(state)) {
        expect(moves).toBeLessThan(MAX_MOVES_PER_GAME);
        expect(countCards(zones(state))).toBe(state.totalCards);
        assertNoDuplicateCards(zones(state), `seed=${seed} move=${moves}`);

        const activePlayer = state.players[state.currentPlayerIndex]!;
        const chosenMove = pickBotMove(state, activePlayer.id, turnRng);
        state = ThullaEngine.applyMove(state, chosenMove);
        moves++;
      }

      // Game Over asserts
      expect(ThullaEngine.isGameOver(state)).toBe(true);
      expect(state.bhabhiPlayerId).not.toBeNull();
      expect(state.escapedPlayerIds.length).toBe(players.length - 1); // all except Bhabhi escaped

      const scores = ThullaEngine.getScores(state);
      expect(scores[state.bhabhiPlayerId!]).toBe(0); // Bhabhi gets 0
      for (const id of state.escapedPlayerIds) {
        expect(scores[id]).toBe(1); // Winners get 1
      }

      // Final conservation
      expect(countCards(zones(state))).toBe(state.totalCards);
    }
  });
});
