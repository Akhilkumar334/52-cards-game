// ---------------------------------------------------------------------------
// Seep (Sweep) Bot — implements BotPlayer<SeepGameState, SeepMove>
// Pure TypeScript with strategic heuristics for Seep:
// 1. Prioritize Seeps & Compulsory Takedowns
// 2. Maximize card capture points (Spades, 10♦, Aces)
// 3. Cement (lock) houses to secure them
// 4. Build houses with held matching cards
// 5. Trail lowest-point non-spade cards safely
// ---------------------------------------------------------------------------

import type { BotPlayer } from '../types';
import type { SeepGameState, SeepMove } from '@cards/engine';
import { getCardPointValue, getCardNumericValue, isTableCleared } from '@cards/engine';

export interface SeepBotConfig {
  readonly seed?: number;
}

export class SeepBot implements BotPlayer<SeepGameState, SeepMove> {
  constructor(config: SeepBotConfig = {}) {}

  chooseMove(visibleState: SeepGameState, legalMoves: readonly SeepMove[]): SeepMove {
    if (legalMoves.length === 0) {
      throw new Error('SeepBot: No legal moves available');
    }
    if (legalMoves.length === 1) {
      return legalMoves[0]!;
    }

    const playerIndex = visibleState.currentPlayerIndex;
    const player = visibleState.players[playerIndex]!;
    const floor = visibleState.floor;

    // 0. Redeal if hand is dead (Raddi)
    const redealMove = legalMoves.find((m) => m.type === 'REDEAL_BID');
    if (redealMove) {
      return redealMove;
    }

    // 1. Check for DECLARE_BID moves
    const declareBidMoves = legalMoves.filter(
      (m): m is Extract<SeepMove, { type: 'DECLARE_BID' }> => m.type === 'DECLARE_BID',
    );
    if (declareBidMoves.length > 0) {
      // Prefer house of 10 or 12 or highest value
      return declareBidMoves.sort((a, b) => b.houseValue - a.houseValue)[0]!;
    }

    const floorItems = floor.items ?? [
      ...(floor.looseCards ?? []).map((c) => ({ type: 'loose' as const, id: c.id, card: c })),
      ...(floor.houses ?? []).map((h) => ({ type: 'house' as const, id: h.id, house: h })),
    ];

    // Check 3rd Seep penalty condition: If bot's team already has 2 active seeps and opponent has no active seeps,
    // making a floor-clearing seep would trigger the 3rd seep penalty and down BOTH active seeps!
    const ownTeam = visibleState.teams[player.teamIndex]!;
    const hasOpponentActiveSeeps = visibleState.teams.some(
      (t) => t.teamIndex !== player.teamIndex && t.activeSeeps > 0,
    );
    const wouldTriggerThirdSeepPenalty =
      visibleState.ruleset.thirdSeepDownsBoth &&
      ownTeam.activeSeeps >= 2 &&
      !hasOpponentActiveSeeps;

    const isFloorClearingMove = (m: SeepMove) => {
      if (m.type !== 'CAPTURE') return false;
      const count =
        'itemIds' in m && m.itemIds
          ? m.itemIds.length
          : (m.capturedLooseCardIds?.length ?? 0) + (m.capturedHouseIds?.length ?? 0);
      return count === floorItems.length && floorItems.length > 0;
    };

    // If clearing the floor would down both of our active seeps, resist choosing floor-clearing moves!
    const safeMoves = wouldTriggerThirdSeepPenalty
      ? legalMoves.filter((m) => !isFloorClearingMove(m))
      : legalMoves;

    const candidateMoves = safeMoves.length > 0 ? safeMoves : legalMoves;

    // 2. Check for Immediate SEEP (floor clearing) — only if safe (does not trigger 3rd seep penalty)
    const seepMove = candidateMoves.find(isFloorClearingMove);
    if (seepMove) {
      return seepMove;
    }

    // 3. Score CAPTURE moves by point yield
    const captureMoves = candidateMoves.filter((m): m is Extract<SeepMove, { type: 'CAPTURE' }> => m.type === 'CAPTURE');
    if (captureMoves.length > 0) {
      let bestCapture = captureMoves[0]!;
      let highestPoints = -1;

      for (const cap of captureMoves) {
        let points = 0;
        const handCard = player.hand.find((c) => c.id === cap.handCardId);
        if (handCard) points += getCardPointValue(handCard);

        const capItemIds = new Set(
          cap.itemIds ?? [...(cap.capturedLooseCardIds ?? []), ...(cap.capturedHouseIds ?? [])],
        );
        const capturedFloorItems = floorItems.filter((i) => capItemIds.has(i.id));

        for (const item of capturedFloorItems) {
          if (item.type === 'loose') {
            points += getCardPointValue(item.card);
          } else {
            points += item.house.cards.reduce((sum, c) => sum + getCardPointValue(c), 0);
          }
        }

        if (points > highestPoints) {
          highestPoints = points;
          bestCapture = cap;
        }
      }

      if (highestPoints > 0) {
        return bestCapture;
      }
    }

    // 4. Cement (lock) an existing house
    const cementMoves = candidateMoves.filter((m): m is Extract<SeepMove, { type: 'CEMENT_HOUSE' }> => m.type === 'CEMENT_HOUSE');
    if (cementMoves.length > 0) {
      const ownCement = cementMoves.find((m) => {
        const h = floor.houses.find((house) => house.id === m.houseId);
        return h && h.ownerTeamIndex === player.teamIndex;
      });
      if (ownCement) {
        return ownCement;
      }
      return cementMoves[0]!;
    }

    // 5. Build a House
    const buildMoves = candidateMoves.filter(
      (m): m is Extract<SeepMove, { type: 'BUILD' | 'BUILD_HOUSE' }> =>
        m.type === 'BUILD' || m.type === 'BUILD_HOUSE',
    );
    if (buildMoves.length > 0) {
      return buildMoves[0]!;
    }

    // 6. Direct / Combined BID moves
    const bidMoves = legalMoves.filter((m): m is Extract<SeepMove, { type: 'BID' }> => m.type === 'BID');
    if (bidMoves.length > 0) {
      return bidMoves[0]!;
    }

    // 7. Safe TRAIL / THROW: pick lowest-value non-spade card
    const trailMoves = candidateMoves.filter(
      (m): m is Extract<SeepMove, { type: 'TRAIL' | 'THROW' }> =>
        m.type === 'TRAIL' || m.type === 'THROW',
    );
    if (trailMoves.length > 0) {
      let safestTrail = trailMoves[0]!;
      let lowestRisk = 999;

      for (const tm of trailMoves) {
        const card = player.hand.find((c) => c.id === tm.cardId);
        if (!card) continue;

        // Spades, 10♦, and Aces have high point risk
        const pointVal = getCardPointValue(card);
        const numVal = getCardNumericValue(card);
        const risk = pointVal * 10 + (card.suit === 'S' ? 5 : 0) + numVal;

        if (risk < lowestRisk) {
          lowestRisk = risk;
          safestTrail = tm;
        }
      }

      return safestTrail;
    }

    return candidateMoves[0]!;
  }
}
