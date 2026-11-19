// ---------------------------------------------------------------------------
// Thulla (Bhabhi) game engine — implements GameEngine<ThullaGameState, ThullaMove, ThullaRuleset>.
// Pure TypeScript. No DOM, no React, no side-effects.
// ---------------------------------------------------------------------------

import type { GameEngine } from '../interface';
import { GameError } from '../interface';
import type { PlayerConfig, PlayerId } from '../core/types';
import { createRng } from '../core/rng';
import { buildDeck, shuffle } from '../core/deck';
import { dealEvenly } from '../core/deal';
import { ThullaRulesetSchema, type ThullaRuleset } from './schema';
import type { ThullaGameState, ThullaPlayer, ThullaTrick, ThullaTrickCard } from './state';
import type { ThullaMove } from './moves';
import {
  getRankPower,
  findAceOfSpadesHolder,
  getNextActivePlayerIndex,
  getRemainingActivePlayers,
  removeCardFromHand,
  getThullaVisibleState,
} from './helpers';

// ─── createGame ─────────────────────────────────────────────────────────────

function createGame(
  ruleset: ThullaRuleset,
  players: PlayerConfig[],
  seed: number,
): ThullaGameState {
  const parsed = ThullaRulesetSchema.parse(ruleset);
  if (players.length < 2 || players.length > 8) {
    throw new GameError('Thulla requires 2–8 players', 'INVALID_PLAYER_COUNT');
  }

  const rng = createRng(seed);
  const deck = shuffle(buildDeck(parsed.deckCount), rng);
  const hands = dealEvenly(deck, players.length);

  const thullaPlayers = players.map((p, i) => ({
    id: p.id,
    name: p.name,
    isBot: p.isBot,
    hand: hands[i] ?? [],
    hasEscaped: false,
    finishOrder: null,
  }));

  let startIndex = 0;
  if (parsed.firstLeaderRule === 'aceOfSpades') {
    startIndex = findAceOfSpadesHolder(thullaPlayers);
  } else if (parsed.firstLeaderRule === 'random') {
    startIndex = rng.nextInt(0, players.length - 1);
  }

  const firstPlayerName = thullaPlayers[startIndex]!.name;

  return {
    ruleset: parsed,
    players: thullaPlayers,
    currentPlayerIndex: startIndex,
    currentTrick: null,
    discardPile: [],
    lastResolvedTrick: null,
    phase: { type: 'play' },
    escapedPlayerIds: [],
    bhabhiPlayerId: null,
    totalCards: deck.length,
    trickNumber: 0,
    log: [
      `Game started. ${firstPlayerName} leads first (holding Ace of Spades ♠).`,
    ],
  };
}

// ─── getLegalMoves ──────────────────────────────────────────────────────────

function getLegalMoves(state: ThullaGameState, playerId: PlayerId): ThullaMove[] {
  if (state.phase.type === 'gameover') return [];

  const playerIdx = state.players.findIndex((p) => p.id === playerId);
  if (playerIdx === -1 || playerIdx !== state.currentPlayerIndex) return [];

  const player = state.players[playerIdx]!;
  if (player.hasEscaped || player.hand.length === 0) return [];

  // Special rule for the very first trick of the game: must lead Ace of Spades if holding it
  if (state.trickNumber === 0 && state.currentTrick === null && state.ruleset.firstLeaderRule === 'aceOfSpades') {
    const aceOfSpades = player.hand.find((c) => c.suit === 'S' && c.rank === 'A');
    if (aceOfSpades) {
      return [{ type: 'PLAY_CARD', playerId, cardId: aceOfSpades.id }];
    }
  }

  // 1. Leading a new trick: any card in hand is legal
  if (state.currentTrick === null) {
    return player.hand.map((c) => ({ type: 'PLAY_CARD', playerId, cardId: c.id }));
  }

  // 2. Following a trick in progress: MUST follow suit if holding cards of ledSuit
  const ledSuit = state.currentTrick.ledSuit;
  const suitCards = player.hand.filter((c) => c.suit === ledSuit);

  if (suitCards.length > 0) {
    return suitCards.map((c) => ({ type: 'PLAY_CARD', playerId, cardId: c.id }));
  }

  // 3. Void in led suit: player can play ANY card of ANY suit (triggering a Thulla!)
  return player.hand.map((c) => ({ type: 'PLAY_CARD', playerId, cardId: c.id }));
}

// ─── applyMove ──────────────────────────────────────────────────────────────

function applyMove(state: ThullaGameState, move: ThullaMove): ThullaGameState {
  if (state.phase.type === 'gameover') {
    throw new GameError('Game is already over', 'GAME_OVER');
  }

  const current = state.players[state.currentPlayerIndex]!;
  if (move.playerId !== current.id) {
    throw new GameError('Not your turn', 'WRONG_PLAYER');
  }

  const cardToPlay = current.hand.find((c) => c.id === move.cardId);
  if (!cardToPlay) {
    throw new GameError(`Card not in hand: ${move.cardId}`, 'CARD_NOT_IN_HAND');
  }

  // Rule verification: first trick opening with Ace of Spades
  if (state.trickNumber === 0 && state.currentTrick === null && state.ruleset.firstLeaderRule === 'aceOfSpades') {
    const hasAceOfSpades = current.hand.some((c) => c.suit === 'S' && c.rank === 'A');
    if (hasAceOfSpades && (cardToPlay.suit !== 'S' || cardToPlay.rank !== 'A')) {
      throw new GameError('Must open the game with Ace of Spades ♠', 'MUST_LEAD_ACE_OF_SPADES');
    }
  }

  // Rule verification: compulsory suit follow
  if (state.currentTrick !== null) {
    const ledSuit = state.currentTrick.ledSuit;
    const hasLedSuit = current.hand.some((c) => c.suit === ledSuit);
    if (hasLedSuit && cardToPlay.suit !== ledSuit) {
      throw new GameError(`Must follow suit (${ledSuit})`, 'MUST_FOLLOW_SUIT');
    }
  }

  // 1. Remove card from player hand
  const newHand = removeCardFromHand(current.hand, cardToPlay.id);
  const updatedPlayers = state.players.map((p, i) =>
    i === state.currentPlayerIndex ? { ...p, hand: newHand } : p,
  );

  // 2. Add to trick
  const isLead = state.currentTrick === null;
  const ledSuit = isLead ? cardToPlay.suit : state.currentTrick!.ledSuit;
  const isThulla = !isLead && cardToPlay.suit !== ledSuit;

  const trickCard: ThullaTrickCard = {
    playerId: current.id,
    playerIndex: state.currentPlayerIndex,
    card: cardToPlay,
    isThulla,
  };

  const currentCards = isLead ? [trickCard] : [...state.currentTrick!.cards, trickCard];

  // 3. Track highest card of led suit
  let highestIdx = isLead ? state.currentPlayerIndex : state.currentTrick!.highestPlayerIndex;
  if (!isLead) {
    const highestCard = currentCards.find(
      (tc) => tc.playerIndex === state.currentTrick!.highestPlayerIndex && tc.card.suit === ledSuit,
    );
    if (cardToPlay.suit === ledSuit) {
      if (!highestCard || getRankPower(cardToPlay.rank) > getRankPower(highestCard.card.rank)) {
        highestIdx = state.currentPlayerIndex;
      }
    }
  }

  const updatedTrick: ThullaTrick = {
    ledSuit,
    cards: currentCards,
    highestPlayerIndex: highestIdx,
  };

  const logMove = `${current.name} plays ${cardToPlay.rank}${cardToPlay.suit}${isThulla ? ' 💥 THULLA!' : ''}`;

  // 4. Handle Thulla (Penalty Pickup)
  if (isThulla) {
    const penaltyPlayer = updatedPlayers[highestIdx]!;
    const allTrickCards = currentCards.map((tc) => tc.card);

    // Highest card player picks up all trick cards
    const playersAfterPickup = updatedPlayers.map((p, i) =>
      i === highestIdx ? { ...p, hand: [...p.hand, ...allTrickCards] } : p,
    );

    // Check escapes for players who played in this trick and emptied hand without getting penalty
    const escapeResult = checkEscapes(playersAfterPickup, state.escapedPlayerIds);

    const nextLeader =
      state.ruleset.whoLeadsAfterThulla === 'thullaPlayer'
        ? state.currentPlayerIndex
        : highestIdx;

    const nextActiveLeader = escapeResult.players[nextLeader]!.hasEscaped
      ? getNextActivePlayerIndex(nextLeader, escapeResult.players)
      : nextLeader;

    const penaltyLog = `💥 THULLA! ${current.name} played off-suit → ${penaltyPlayer.name} picks up ${allTrickCards.length} card(s)!`;

    const nextState: ThullaGameState = {
      ...state,
      players: escapeResult.players,
      currentPlayerIndex: nextActiveLeader,
      currentTrick: null,
      lastResolvedTrick: {
        cards: currentCards,
        wasThulla: true,
        penaltyPlayerId: penaltyPlayer.id,
        winnerPlayerId: null,
      },
      escapedPlayerIds: escapeResult.escapedIds,
      bhabhiPlayerId: escapeResult.bhabhiId,
      phase: escapeResult.isOver ? { type: 'gameover' } : { type: 'play' },
      trickNumber: state.trickNumber + 1,
      log: [...state.log, logMove, penaltyLog, ...escapeResult.escapeLogs],
    };

    return nextState;
  }

  // 5. Check if Trick is complete (all active players have played a card)
  const activePlayers = getRemainingActivePlayers(updatedPlayers);
  const playersInTrick = new Set(currentCards.map((tc) => tc.playerIndex));
  const trickComplete = activePlayers.every((p) =>
    playersInTrick.has(state.players.findIndex((sp) => sp.id === p.id)),
  );

  if (trickComplete) {
    // Trick is clean (no Thulla). Highest card wins trick and cards are burned
    const winningPlayer = updatedPlayers[highestIdx]!;
    const trickCardsToBurn = currentCards.map((tc) => tc.card);
    const newDiscard = [...state.discardPile, ...trickCardsToBurn];

    // Check escapes
    const escapeResult = checkEscapes(updatedPlayers, state.escapedPlayerIds);

    const winnerIdx = highestIdx;
    const nextActiveLeader = escapeResult.players[winnerIdx]!.hasEscaped
      ? getNextActivePlayerIndex(winnerIdx, escapeResult.players)
      : winnerIdx;

    const cleanTrickLog = `✓ ${winningPlayer.name} wins trick with ${cardToPlay.rank}${cardToPlay.suit} (${trickCardsToBurn.length} cards burned).`;

    const nextState: ThullaGameState = {
      ...state,
      players: escapeResult.players,
      currentPlayerIndex: nextActiveLeader,
      currentTrick: null,
      discardPile: newDiscard,
      lastResolvedTrick: {
        cards: currentCards,
        wasThulla: false,
        penaltyPlayerId: null,
        winnerPlayerId: winningPlayer.id,
      },
      escapedPlayerIds: escapeResult.escapedIds,
      bhabhiPlayerId: escapeResult.bhabhiId,
      phase: escapeResult.isOver ? { type: 'gameover' } : { type: 'play' },
      trickNumber: state.trickNumber + 1,
      log: [...state.log, logMove, cleanTrickLog, ...escapeResult.escapeLogs],
    };

    return nextState;
  }

  // 6. Trick in progress: advance to next active player
  const nextPlayerIdx = getNextActivePlayerIndex(state.currentPlayerIndex, updatedPlayers);

  return {
    ...state,
    players: updatedPlayers,
    currentPlayerIndex: nextPlayerIdx,
    currentTrick: updatedTrick,
    log: [...state.log, logMove],
  };
}

// ─── Escape & Gameover Helper ───────────────────────────────────────────────

function checkEscapes(
  players: readonly ThullaPlayer[],
  currentEscapedIds: readonly PlayerId[],
): {
  players: ThullaPlayer[];
  escapedIds: PlayerId[];
  bhabhiId: PlayerId | null;
  isOver: boolean;
  escapeLogs: string[];
} {
  const newEscaped = [...currentEscapedIds];
  const logs: string[] = [];

  const updated = players.map((p) => {
    if (!p.hasEscaped && p.hand.length === 0) {
      newEscaped.push(p.id);
      const rankPlace = newEscaped.length;
      const rankSuffix = rankPlace === 1 ? '1st' : rankPlace === 2 ? '2nd' : rankPlace === 3 ? '3rd' : `${rankPlace}th`;
      logs.push(`🏆 ${p.name} shed all cards and got away (${rankSuffix} place)!`);
      return { ...p, hasEscaped: true, finishOrder: rankPlace };
    }
    return p;
  });

  const remaining = updated.filter((p) => !p.hasEscaped && p.hand.length > 0);

  if (remaining.length <= 1) {
    const bhabhi = remaining[0] ?? null;
    if (bhabhi) {
      logs.push(`💀 ${bhabhi.name} is the BHABHI (lost the game)!`);
    }
    return {
      players: updated,
      escapedIds: newEscaped,
      bhabhiId: bhabhi ? bhabhi.id : null,
      isOver: true,
      escapeLogs: logs,
    };
  }

  return {
    players: updated,
    escapedIds: newEscaped,
    bhabhiId: null,
    isOver: false,
    escapeLogs: logs,
  };
}

// ─── isGameOver & getScores ────────────────────────────────────────────────

function isGameOver(state: ThullaGameState): boolean {
  return state.phase.type === 'gameover';
}

function getScores(state: ThullaGameState): Record<PlayerId, number> {
  if (!isGameOver(state)) throw new GameError('Game is not over', 'NOT_OVER');

  const scores: Record<PlayerId, number> = {};
  for (const p of state.players) {
    // 1 for all players who escaped; 0 for Bhabhi (loser)
    scores[p.id] = p.id === state.bhabhiPlayerId ? 0 : 1;
  }
  return scores;
}

export const ThullaEngine: GameEngine<ThullaGameState, ThullaMove, ThullaRuleset> & {
  getVisibleState: typeof getThullaVisibleState;
} = {
  createGame,
  getLegalMoves,
  applyMove,
  isGameOver,
  getScores,
  getVisibleState: getThullaVisibleState,
};
