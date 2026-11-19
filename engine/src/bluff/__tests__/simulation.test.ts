// ---------------------------------------------------------------------------
// Bluff simulation test — 1000 bot-vs-bot games with seeds 0–999.
// Asserts: no crash, game terminates, card conservation every move, valid scores.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { BluffEngine } from '../engine';
import { DEFAULT_BLUFF_RULESET } from '../schema';
import type { BluffGameState } from '../state';
import type { BluffMove } from '../moves';
import type { PlayerConfig } from '../../core/types';
import { createRng } from '../../core/rng';
import { countCards, assertNoDuplicateCards } from '../../core/invariants';

// ─── Deterministic inline bot (only uses visible state + legalMoves) ─────────

function pickBotMove(
  fullState: BluffGameState,
  actorId: string,
  turnRng: ReturnType<typeof createRng>,
): BluffMove {
  const visible = BluffEngine.getVisibleState(fullState, actorId);
  const legalMoves = BluffEngine.getLegalMoves(visible, actorId);
  if (legalMoves.length === 0) throw new Error(`No legal moves for ${actorId}`);

  const playMoves = legalMoves.filter(m => m.type === 'PLAY');

  if (playMoves.length > 0) {
    // Pick random card count; shuffle bot's own hand (visible to it)
    const playerIdx = fullState.players.findIndex(p => p.id === actorId);
    const hand = fullState.players[playerIdx]!.hand;
    const shuffled = [...hand];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = turnRng.nextInt(0, i);
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    const maxCards = Math.min(fullState.ruleset.maxCardsPerPlay, hand.length);
    const count = turnRng.nextInt(1, maxCards);
    const cardIds = shuffled.slice(0, count).map(c => c.id);
    return { type: 'PLAY', playerId: actorId, cardIds, declaredRank: fullState.currentRank };
  }

  // Challenge 40% of the time, pass 60%
  const challengeMoves = legalMoves.filter(m => m.type === 'CHALLENGE');
  if (challengeMoves.length > 0 && turnRng.next() < 0.4) return challengeMoves[0]!;

  return legalMoves.find(m => m.type === 'PASS_CHALLENGE') ?? legalMoves[0]!;
}

function getActorId(state: BluffGameState): string | null {
  if (state.phase.type === 'play') return state.players[state.currentPlayerIndex]!.id;
  if (state.phase.type === 'challenge') {
    const idx = state.phase.pendingIndices[0];
    return idx !== undefined ? state.players[idx]!.id : null;
  }
  return null;
}

function zones(s: BluffGameState) {
  return [...s.players.map(p => [...p.hand]), [...s.pile], [...(s.discardPile ?? [])]];
}

// ─── Simulation ──────────────────────────────────────────────────────────────

describe('Bluff simulation (1000 games, 4 bots, default ruleset)', () => {
  const players: PlayerConfig[] = Array.from({ length: 4 }, (_, i) => ({
    id: `p${i}`, name: `Bot${i}`, isBot: true,
  }));

  const MAX_MOVES_PER_GAME = 20_000;

  it('all 1000 games terminate with valid state', () => {
    for (let seed = 0; seed < 1000; seed++) {
      const turnRng = createRng(seed * 31337);
      let state = BluffEngine.createGame(DEFAULT_BLUFF_RULESET, players, seed);
      let moves = 0;

      while (!BluffEngine.isGameOver(state)) {
        expect(moves).toBeLessThan(MAX_MOVES_PER_GAME);
        // Card conservation every move
        expect(countCards(zones(state))).toBe(state.totalCards);
        assertNoDuplicateCards(zones(state), `seed=${seed} move=${moves}`);

        const actorId = getActorId(state);
        expect(actorId).not.toBeNull();

        state = BluffEngine.applyMove(state, pickBotMove(state, actorId!, turnRng));
        moves++;
      }

      // Game is over — verify final state
      expect(BluffEngine.isGameOver(state)).toBe(true);
      expect(state.winnerId).not.toBeNull();

      const scores = BluffEngine.getScores(state);
      const scoreValues = Object.values(scores);
      expect(scoreValues.filter(v => v === 1)).toHaveLength(1); // exactly one winner
      expect(scoreValues.filter(v => v === 0)).toHaveLength(3);

      // Final conservation
      expect(countCards(zones(state))).toBe(state.totalCards);
    }
  });
});
