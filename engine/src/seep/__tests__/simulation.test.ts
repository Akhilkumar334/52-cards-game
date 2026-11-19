// ---------------------------------------------------------------------------
// Seep 1000-Game Simulation Tests per Player Count (2, 3, 4)
// Asserts no crashes, no illegal states, game termination, 52-card conservation,
// and exact 100-point card totals plus net seep bonuses.
// ---------------------------------------------------------------------------

import { describe, it, expect } from 'vitest';
import { SeepEngine } from '../engine';
import { DEFAULT_SEEP_RULESET } from '../schema';
import type { SeepGameState } from '../state';
import type { PlayerConfig } from '../../core/types';
import { countCapturedCardPoints } from '../helpers';

const mkPlayers = (count: number): PlayerConfig[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `p${i}`,
    name: `Player ${i}`,
    isBot: true,
  }));

function assertSeepCardConservation(s: SeepGameState) {
  const handCards = s.players.flatMap((p) => p.hand);
  const loose = s.floor.looseCards;
  const houseCards = s.floor.houses.flatMap((h) => h.cards);
  const capturedCards = s.teams.flatMap((t) => t.capturedCards);
  const undealt = s.undealtDeck ?? [];

  const total =
    handCards.length +
    loose.length +
    houseCards.length +
    capturedCards.length +
    undealt.length;
  expect(total).toBe(52);
}

function runSimulation(numPlayers: number, numGames: number) {
  const players = mkPlayers(numPlayers);

  for (let seed = 0; seed < numGames; seed++) {
    let state = SeepEngine.createGame(DEFAULT_SEEP_RULESET, players, seed);
    assertSeepCardConservation(state);

    let turnCount = 0;
    const maxTurns = 250;

    while (
      state.phase.type !== 'round_over' &&
      state.phase.type !== 'game_over' &&
      turnCount < maxTurns
    ) {
      const currentPlayer = state.players[state.currentPlayerIndex]!;
      const legalMoves = SeepEngine.getLegalMoves(state, currentPlayer.id);

      expect(legalMoves.length).toBeGreaterThan(0);

      // Deterministic priority: CAPTURE > BUILD > CEMENT > DECLARE_BID > TRAIL
      let chosenMove = legalMoves[0]!;
      const captureMove = legalMoves.find((m) => m.type === 'CAPTURE');
      const buildMove = legalMoves.find((m) => m.type === 'BUILD' || m.type === 'BUILD_HOUSE');
      const cementMove = legalMoves.find((m) => m.type === 'CEMENT_HOUSE');
      const declareMove = legalMoves.find((m) => m.type === 'DECLARE_BID');

      if (captureMove) {
        chosenMove = captureMove;
      } else if (buildMove) {
        chosenMove = buildMove;
      } else if (cementMove) {
        chosenMove = cementMove;
      } else if (declareMove) {
        chosenMove = declareMove;
      }

      state = SeepEngine.applyMove(state, chosenMove);
      turnCount++;

      assertSeepCardConservation(state);
    }

    // Verify game terminated
    expect(state.phase.type === 'round_over' || state.phase.type === 'game_over').toBe(true);

    // Verify 100-Point Card Scoring Invariant
    const totalCapturedCardPoints = state.teams.reduce(
      (sum, t) => sum + countCapturedCardPoints(t.capturedCards),
      0,
    );
    expect(totalCapturedCardPoints).toBe(100);

    // Verify Hand scores always total 100 plus net seep bonuses
    const totalRoundScores = state.teams.reduce((sum, t) => sum + t.roundScore, 0);
    const netSeepBonuses = state.teams.reduce((sum, t) => {
      const permBonus = t.permanentSeep ? DEFAULT_SEEP_RULESET.openingSeepBonus : 0;
      const actBonus = t.activeSeeps * DEFAULT_SEEP_RULESET.laterSeepBonus;
      return sum + permBonus + actBonus;
    }, 0);

    expect(totalRoundScores).toBe(100 + netSeepBonuses);
  }
}

describe('Seep 1000-Game Deterministic Simulations', () => {
  it('runs 1000 complete 4-player partnership games without crashes or illegal states', () => {
    runSimulation(4, 1000);
  });

  it('runs 1000 complete 2-player individual games without crashes or illegal states', () => {
    runSimulation(2, 1000);
  });

  it('runs 1000 complete 3-player individual games without crashes or illegal states', () => {
    runSimulation(3, 1000);
  });
});
