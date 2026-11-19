// ---------------------------------------------------------------------------
// Bluff game engine — implements the GameEngine<BluffGameState,BluffMove,BluffRuleset> interface.
// All functions are pure. No DOM, no React, no global state.
// ---------------------------------------------------------------------------

import type { GameEngine } from '../interface';
import { GameError } from '../interface';
import type { PlayerConfig, PlayerId } from '../core/types';
import { createRng } from '../core/rng';
import { buildDeck, shuffle } from '../core/deck';
import { dealEvenly } from '../core/deal';
import { BluffRulesetSchema, type BluffRuleset } from './schema';
import type { BluffGameState, BluffLastPlay, BluffPhase } from './state';
import type { BluffMove } from './moves';
import {
  advanceRank,
  resolveCardIds,
  removeCards,
  findAceOfSpadesHolder,
  getNextPlayerAfterChallenge,
  getBluffVisibleState,
} from './helpers';

// ─── createGame ─────────────────────────────────────────────────────────────

function createGame(
  ruleset: BluffRuleset,
  players: PlayerConfig[],
  seed: number,
): BluffGameState {
  const parsed = BluffRulesetSchema.parse(ruleset);
  if (players.length < 2 || players.length > 12) {
    throw new GameError('Bluff requires 2–12 players', 'INVALID_PLAYER_COUNT');
  }
  const rng = createRng(seed);
  const deck = shuffle(buildDeck(parsed.deckCount), rng);
  const hands = dealEvenly(deck, players.length);

  const bluffPlayers = players.map((p, i) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    hand: hands[i] ?? [],
  }));

  const startIndex = findAceOfSpadesHolder(bluffPlayers);

  return {
    ruleset: parsed,
    players: bluffPlayers,
    currentPlayerIndex: startIndex,
    currentRank: 'A',
    canLeadRank: parsed.rankProgression === 'tableClearOnAllPass',
    pile: [],
    discardPile: [],
    consecutivePasses: 0,
    lastPlayedPlayerIndex: null,
    lastPlay: null,
    phase: { type: 'play' },
    winnerId: null,
    totalCards: deck.length,
    turnNumber: 0,
    log: [`Game started. ${bluffPlayers[startIndex]!.name} goes first (holds A♠).`],
  };
}

// ─── getLegalMoves ──────────────────────────────────────────────────────────

function getLegalMoves(state: BluffGameState, playerId: PlayerId): BluffMove[] {
  if (state.phase.type === 'gameover') return [];
  const playerIdx = state.players.findIndex(p => p.id === playerId);
  if (playerIdx === -1) return [];

  if (state.phase.type === 'play') {
    if (playerIdx !== state.currentPlayerIndex) return [];
    const player = state.players[playerIdx]!;
    if (player.hand.length === 0) return [];

    const isTableClearMode = state.ruleset.rankProgression === 'tableClearOnAllPass';
    const moves: BluffMove[] = [];

    // In tableClear mode, if someone else played cards previously, current player can CHALLENGE (Show)!
    if (isTableClearMode && state.lastPlay && state.lastPlay.playerIndex !== playerIdx) {
      moves.push({ type: 'CHALLENGE', playerId });
    }

    // PLAY moves
    const allowedMax =
      state.ruleset.deckCount === 1
        ? Math.min(4, state.ruleset.maxCardsPerPlay)
        : state.ruleset.maxCardsPerPlay;
    const maxCards = Math.min(allowedMax, player.hand.length);

    if (state.canLeadRank) {
      const ranksToOffer =
        player.hand.length > 0
          ? Array.from(new Set(player.hand.map(c => c.rank)))
          : [state.currentRank];
      for (const rank of ranksToOffer) {
        for (let count = 1; count <= maxCards; count++) {
          const cardIds = player.hand.slice(0, count).map(c => c.id);
          moves.push({ type: 'PLAY', playerId, cardIds, declaredRank: rank });
        }
      }
    } else {
      for (let count = 1; count <= maxCards; count++) {
        const cardIds = player.hand.slice(0, count).map(c => c.id);
        moves.push({ type: 'PLAY', playerId, cardIds, declaredRank: state.currentRank });
      }
    }

    // PASS_TURN moves
    // Allowed if allowPass=true, or in tableClear mode once cards have been played onto the table
    if (state.ruleset.allowPass || (isTableClearMode && state.lastPlay !== null)) {
      moves.push({ type: 'PASS_TURN', playerId });
    }
    return moves;
  }

  if (state.phase.type === 'challenge') {
    if (state.phase.pendingIndices[0] !== playerIdx) return [];
    return [
      { type: 'CHALLENGE', playerId },
      { type: 'PASS_CHALLENGE', playerId },
    ];
  }

  return [];
}

// ─── applyMove helpers ──────────────────────────────────────────────────────

function applyPlay(
  state: BluffGameState,
  move: Extract<BluffMove, { type: 'PLAY' }>,
): BluffGameState {
  if (state.phase.type !== 'play') throw new GameError('Not in play phase', 'WRONG_PHASE');
  const current = state.players[state.currentPlayerIndex]!;
  if (move.playerId !== current.id) throw new GameError('Not your turn', 'WRONG_PLAYER');

  if (!state.canLeadRank && move.declaredRank !== state.currentRank) {
    throw new GameError(`Must declare rank ${state.currentRank}`, 'WRONG_DECLARED_RANK');
  }

  const count = move.cardIds.length;
  const allowedMax =
    state.ruleset.deckCount === 1
      ? Math.min(4, state.ruleset.maxCardsPerPlay)
      : state.ruleset.maxCardsPerPlay;
  if (count < 1 || count > allowedMax) {
    throw new GameError(`Play 1–${allowedMax} cards`, 'INVALID_CARD_COUNT');
  }

  let cards;
  try { cards = resolveCardIds(move.cardIds, current.hand); }
  catch (e) { throw new GameError((e as Error).message, 'CARD_NOT_IN_HAND'); }

  const newHand = removeCards(current.hand, cards);
  const newPile = [...state.pile, ...cards];
  const lastPlay: BluffLastPlay = {
    playerId: current.id,
    playerIndex: state.currentPlayerIndex,
    cards,
    declaredRank: move.declaredRank,
    cardCount: count,
  };
  const updatedPlayers = state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, hand: newHand } : p,
  );
  const logEntry = `${current.name} plays ${count} card(s) as ${move.declaredRank}.`;
  const handEmpty = newHand.length === 0;

  if (handEmpty && !state.ruleset.mustSurviveCallOnLastPlay) {
    return {
      ...state,
      players: updatedPlayers,
      pile: newPile,
      lastPlay,
      lastPlayedPlayerIndex: state.currentPlayerIndex,
      consecutivePasses: 0,
      currentRank: move.declaredRank,
      canLeadRank: false,
      phase: { type: 'gameover' },
      winnerId: current.id,
      turnNumber: state.turnNumber + 1,
      log: [...state.log, logEntry, `🏆 ${current.name} wins!`],
    };
  }

  const isTableClearMode = state.ruleset.rankProgression === 'tableClearOnAllPass';

  if (isTableClearMode) {
    // In tableClear mode (continuous round), advance turn to next player in seat order!
    // Next player can SHOW (challenge), PASS, or PLAY cards as currentRank!
    const nextIdx = (state.currentPlayerIndex + 1) % state.players.length;
    return {
      ...state,
      players: updatedPlayers,
      pile: newPile,
      lastPlay,
      lastPlayedPlayerIndex: state.currentPlayerIndex,
      consecutivePasses: 0,
      currentRank: move.declaredRank,
      canLeadRank: false,
      currentPlayerIndex: nextIdx,
      turnNumber: state.turnNumber + 1,
      log: [...state.log, logEntry],
    };
  }

  // In cycle mode (traditional Western Bluff), transition to challenge phase
  const pendingIndices = state.players.map((_, i) => i).filter(i => i !== state.currentPlayerIndex);
  return {
    ...state,
    players: updatedPlayers,
    pile: newPile,
    lastPlay,
    lastPlayedPlayerIndex: state.currentPlayerIndex,
    consecutivePasses: 0,
    currentRank: move.declaredRank,
    canLeadRank: false,
    phase: { type: 'challenge', pendingIndices },
    turnNumber: state.turnNumber + 1,
    log: [...state.log, logEntry],
  };
}

function applyPassTurn(
  state: BluffGameState,
  move: Extract<BluffMove, { type: 'PASS_TURN' }>,
): BluffGameState {
  if (state.phase.type !== 'play') throw new GameError('Not in play phase', 'WRONG_PHASE');
  const current = state.players[state.currentPlayerIndex]!;
  if (move.playerId !== current.id) throw new GameError('Not your turn', 'WRONG_PLAYER');

  const isTableClearMode = state.ruleset.rankProgression === 'tableClearOnAllPass';
  if (!state.ruleset.allowPass && !(isTableClearMode && state.lastPlay !== null)) {
    throw new GameError('Passing not allowed', 'PASS_NOT_ALLOWED');
  }

  const passLog = `${current.name} passes their turn.`;

  if (isTableClearMode) {
    const nextPasses = state.consecutivePasses + 1;
    const activePlayerCount = state.players.length;

    // If the player who made the last play is now passing on their own turn (after everyone else passed):
    if (state.lastPlayedPlayerIndex !== null && state.currentPlayerIndex === state.lastPlayedPlayerIndex) {
      const newDiscardPile = [...state.discardPile, ...state.pile];
      const clearedCount = state.pile.length;
      return {
        ...state,
        pile: [],
        discardPile: newDiscardPile,
        lastPlay: null,
        consecutivePasses: 0,
        lastPlayedPlayerIndex: null,
        currentPlayerIndex: state.currentPlayerIndex,
        canLeadRank: true,
        turnNumber: state.turnNumber + 1,
        log: [
          ...state.log,
          passLog,
          `🧹 Table cleared (${clearedCount} cards burned)!`,
          `👉 ${current.name} leads the next round.`,
        ],
      };
    }

    // If everyone else passed consecutively after the last played player:
    if (nextPasses >= activePlayerCount - 1 && state.lastPlayedPlayerIndex !== null) {
      const lastPlayedPlayer = state.players[state.lastPlayedPlayerIndex]!;

      // If the player who made the last play emptied their hand and survived:
      if (lastPlayedPlayer.hand.length === 0) {
        return {
          ...state,
          pile: [],
          discardPile: [...state.discardPile, ...state.pile],
          lastPlay: null,
          consecutivePasses: 0,
          lastPlayedPlayerIndex: null,
          phase: { type: 'gameover' },
          winnerId: lastPlayedPlayer.id,
          turnNumber: state.turnNumber + 1,
          log: [
            ...state.log,
            passLog,
            `🧹 Table cleared (${state.pile.length} cards burned)!`,
            `🏆 ${lastPlayedPlayer.name} has no cards left and wins the game!`,
          ],
        };
      }

      // Hand continues! Turn returns to the player who played last on the same rank.
      return {
        ...state,
        currentPlayerIndex: state.lastPlayedPlayerIndex,
        consecutivePasses: 0,
        canLeadRank: false,
        turnNumber: state.turnNumber + 1,
        log: [
          ...state.log,
          passLog,
          `👉 Everyone passed! Turn returns to ${lastPlayedPlayer.name} on ${state.currentRank}s.`,
        ],
      };
    }

    // Not everyone passed yet: advance to next player
    const nextIdx = (state.currentPlayerIndex + 1) % state.players.length;
    return {
      ...state,
      currentPlayerIndex: nextIdx,
      consecutivePasses: nextPasses,
      turnNumber: state.turnNumber + 1,
      log: [...state.log, passLog],
    };
  }

  // Rank progression 'cycle'
  const nextIdx = (state.currentPlayerIndex + 1) % state.players.length;
  return {
    ...state,
    currentPlayerIndex: nextIdx,
    currentRank: advanceRank(state.currentRank),
    turnNumber: state.turnNumber + 1,
    log: [...state.log, passLog],
  };
}

function applyChallenge(
  state: BluffGameState,
  move: Extract<BluffMove, { type: 'CHALLENGE' }>,
): BluffGameState {
  const isTableClearMode = state.ruleset.rankProgression === 'tableClearOnAllPass';
  let challengerIdx: number;

  if (isTableClearMode) {
    if (state.phase.type !== 'play') throw new GameError('Not in play phase', 'WRONG_PHASE');
    challengerIdx = state.currentPlayerIndex;
    const challenger = state.players[challengerIdx]!;
    if (move.playerId !== challenger.id) throw new GameError('Not your turn to challenge', 'WRONG_PLAYER');
  } else {
    if (state.phase.type !== 'challenge') throw new GameError('Not in challenge phase', 'WRONG_PHASE');
    const pendingIdx = state.phase.pendingIndices[0];
    if (pendingIdx === undefined) throw new GameError('No pending challenger', 'NO_CHALLENGER');
    challengerIdx = pendingIdx;
    const challenger = state.players[pendingIdx]!;
    if (move.playerId !== challenger.id) throw new GameError('Not your turn to challenge', 'WRONG_PLAYER');
  }

  const { lastPlay } = state;
  if (!lastPlay) throw new GameError('No play to challenge', 'NO_LAST_PLAY');

  const challenger = state.players[challengerIdx]!;
  const wasLying = lastPlay.cards.some(c => c.rank !== lastPlay.declaredRank);
  const loserIdx = wasLying ? lastPlay.playerIndex : challengerIdx;
  const winnerIdx = wasLying ? challengerIdx : lastPlay.playerIndex;

  const updatedPlayers = state.players.map((p, i) =>
    i === loserIdx ? { ...p, hand: [...p.hand, ...state.pile] } : p,
  );

  const loserName = state.players[loserIdx]!.name;
  const resultLog = wasLying
    ? `🚨 ${challenger.name} called BLUFF! ${loserName} was lying → picks up ${state.pile.length} card(s).`
    : `✅ Bluff call wrong! ${state.players[lastPlay.playerIndex]!.name} was truthful → ${challenger.name} picks up ${state.pile.length} card(s).`;

  // Truthful play + empty hand = win
  if (!wasLying && updatedPlayers[lastPlay.playerIndex]!.hand.length === 0) {
    return {
      ...state,
      players: updatedPlayers,
      pile: [],
      lastPlay: null,
      consecutivePasses: 0,
      lastPlayedPlayerIndex: null,
      phase: { type: 'gameover' },
      winnerId: lastPlay.playerId,
      log: [...state.log, resultLog, `🏆 ${state.players[lastPlay.playerIndex]!.name} wins!`],
    };
  }

  const nextIdx = getNextPlayerAfterChallenge(
    state.ruleset.whoStartsAfterChallenge,
    loserIdx,
    winnerIdx,
    lastPlay.playerIndex,
    state.players.length,
  );
  const nextLeaderName = state.players[nextIdx]!.name;

  return {
    ...state,
    players: updatedPlayers,
    pile: [],
    lastPlay: null,
    consecutivePasses: 0,
    lastPlayedPlayerIndex: null,
    phase: { type: 'play' },
    currentPlayerIndex: nextIdx,
    currentRank: isTableClearMode ? state.currentRank : advanceRank(state.currentRank),
    canLeadRank: isTableClearMode,
    turnNumber: state.turnNumber + 1,
    log: [...state.log, `${resultLog} 👉 ${nextLeaderName} leads the next round.`],
  };
}

function applyPassChallenge(
  state: BluffGameState,
  move: Extract<BluffMove, { type: 'PASS_CHALLENGE' }>,
): BluffGameState {
  if (state.phase.type !== 'challenge') throw new GameError('Not in challenge phase', 'WRONG_PHASE');
  const passerIdx = state.phase.pendingIndices[0];
  if (passerIdx === undefined) throw new GameError('No pending player', 'NO_CHALLENGER');
  const passer = state.players[passerIdx]!;
  if (move.playerId !== passer.id) throw new GameError('Not your turn', 'WRONG_PLAYER');

  const newPending = state.phase.pendingIndices.slice(1);
  const passLog = `${passer.name} does not challenge.`;

  if (newPending.length > 0) {
    return { ...state, phase: { type: 'challenge', pendingIndices: newPending }, log: [...state.log, passLog] };
  }

  // All passed — play accepted!
  const lastPlay = state.lastPlay!;
  const playedPlayer = state.players[lastPlay.playerIndex]!;

  if (playedPlayer.hand.length === 0) {
    // mustSurviveCallOnLastPlay=true case: player emptied hand, survived window → win
    return {
      ...state, lastPlay: null, phase: { type: 'gameover' }, winnerId: lastPlay.playerId,
      log: [...state.log, passLog, `🏆 ${playedPlayer.name} wins!`],
    };
  }

  if (state.ruleset.rankProgression === 'tableClearOnAllPass') {
    const newDiscardPile = [...state.discardPile, ...state.pile];
    const clearedCount = state.pile.length;
    return {
      ...state,
      pile: [],
      discardPile: newDiscardPile,
      lastPlay: null,
      phase: { type: 'play' },
      currentPlayerIndex: lastPlay.playerIndex,
      canLeadRank: true,
      turnNumber: state.turnNumber + 1,
      log: [
        ...state.log,
        passLog,
        `🧹 Table cleared (${clearedCount} cards)!`,
        `👉 ${playedPlayer.name} continues and leads the next round.`,
      ],
    };
  } else {
    const nextIdx = (lastPlay.playerIndex + 1) % state.players.length;
    return {
      ...state, lastPlay: null, phase: { type: 'play' },
      currentPlayerIndex: nextIdx, currentRank: advanceRank(state.currentRank),
      canLeadRank: false,
      turnNumber: state.turnNumber + 1,
      log: [...state.log, passLog, 'Play accepted.'],
    };
  }
}

// ─── Public engine ──────────────────────────────────────────────────────────

function applyMove(state: BluffGameState, move: BluffMove): BluffGameState {
  if (state.phase.type === 'gameover') throw new GameError('Game is over', 'GAME_OVER');
  switch (move.type) {
    case 'PLAY':          return applyPlay(state, move);
    case 'PASS_TURN':     return applyPassTurn(state, move);
    case 'CHALLENGE':     return applyChallenge(state, move);
    case 'PASS_CHALLENGE': return applyPassChallenge(state, move);
  }
}

function isGameOver(state: BluffGameState): boolean {
  return state.phase.type === 'gameover';
}

function getScores(state: BluffGameState): Record<PlayerId, number> {
  if (!isGameOver(state)) throw new GameError('Game not over', 'NOT_OVER');
  const scores: Record<PlayerId, number> = {};
  for (const p of state.players) scores[p.id] = p.id === state.winnerId ? 1 : 0;
  return scores;
}

export const BluffEngine: GameEngine<BluffGameState, BluffMove, BluffRuleset> & {
  getVisibleState: typeof getBluffVisibleState;
} = { createGame, getLegalMoves, applyMove, isGameOver, getScores, getVisibleState: getBluffVisibleState };
