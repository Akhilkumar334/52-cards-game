import React, { useState, useEffect, useMemo } from 'react';
import {
  ThullaEngine,
  type ThullaGameState,
  type ThullaMove,
  type Suit,
  type Card as CardType,
  type ThullaTrickCard,
} from '@cards/engine';
import { Card } from '../../components/shared/Card';
import { PlayerSeat } from '../../components/table/PlayerSeat';
import { CardFan } from '../../components/table/CardFan';
import { CardThrowOverlay, type CardThrowAction } from '../../components/table/CardThrowOverlay';

export interface ResolvingTrick {
  cards: readonly ThullaTrickCard[];
  ledSuit: Suit;
  highestPlayerIndex: number;
  isThulla: boolean;
  thullaCard?: ThullaTrickCard;
  penaltyPlayerName?: string;
  winnerPlayerName?: string;
  phase: 'freeze' | 'clearing';
}

export interface ThullaTableProps {
  gameState: ThullaGameState;
  humanPlayerId: string;
  onMove: (move: ThullaMove) => void;
  isProcessingBot: boolean;
  playerActionBubbles?: Record<string, { text: string; type: 'think' | 'play' | 'pass' | 'challenge' | 'thulla' }>;
  resolvingTrick?: ResolvingTrick | null;
  crazyThullaActive?: boolean;
  activeThrowAction?: CardThrowAction | null;
}

export const ThullaTable: React.FC<ThullaTableProps> = ({
  gameState,
  humanPlayerId,
  onMove,
  isProcessingBot,
  playerActionBubbles,
  resolvingTrick,
  crazyThullaActive,
  activeThrowAction,
}) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const humanIndex = gameState.players.findIndex((p) => p.id === humanPlayerId);
  const humanPlayer = gameState.players[humanIndex];

  const totalPlayers = gameState.players.length;
  const getRelativePlayer = (offset: number) => {
    if (humanIndex === -1) return gameState.players[offset % totalPlayers];
    const idx = (humanIndex + offset) % totalPlayers;
    return gameState.players[idx];
  };

  const bottomPlayer = humanPlayer;
  const leftPlayer = totalPlayers >= 2 ? getRelativePlayer(1) : undefined;
  const topPlayer = totalPlayers >= 3 ? getRelativePlayer(2) : undefined;
  const rightPlayer = totalPlayers >= 4 ? getRelativePlayer(3) : undefined;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isHumanTurn =
    currentPlayer?.id === humanPlayerId &&
    gameState.phase.type !== 'gameover' &&
    !resolvingTrick;

  // Legal moves for the human player directly from the authoritative engine
  const humanHand = humanPlayer?.hand ?? [];
  const currentTrick = gameState.currentTrick;
  const activeTrickCards = resolvingTrick ? resolvingTrick.cards : currentTrick ? currentTrick.cards : [];
  const activeLedSuit = resolvingTrick ? resolvingTrick.ledSuit : currentTrick?.ledSuit ?? null;
  const activeHighestIndex = resolvingTrick ? resolvingTrick.highestPlayerIndex : currentTrick?.highestPlayerIndex ?? -1;

  const hasLedSuit = currentTrick ? humanHand.some((c) => c.suit === currentTrick.ledSuit) : false;

  const legalMoves = useMemo(() => {
    if (!isHumanTurn) return [];
    return ThullaEngine.getLegalMoves(gameState, humanPlayerId);
  }, [gameState, humanPlayerId, isHumanTurn]);

  const legalCardIds = useMemo(() => legalMoves.map((m) => m.cardId), [legalMoves]);

  // Immediately deselect if currently selected card is not in legal moves or turn changed
  useEffect(() => {
    if (selectedCardId && (!isHumanTurn || !legalCardIds.includes(selectedCardId))) {
      setSelectedCardId(null);
    }
  }, [isHumanTurn, legalCardIds, selectedCardId]);

  const handleCardClick = (cardId: string) => {
    if (!isHumanTurn) return;

    // Strict legality: card MUST be in legalCardIds
    if (!legalCardIds.includes(cardId)) {
      return; // Cannot select any illegal or off-suit card
    }

    setSelectedCardId(selectedCardId === cardId ? null : cardId);
  };

  const handlePlaySubmit = () => {
    if (!isHumanTurn || !selectedCardId) return;
    if (!legalCardIds.includes(selectedCardId)) {
      setSelectedCardId(null);
      return;
    }
    onMove({
      type: 'PLAY_CARD',
      playerId: humanPlayerId,
      cardId: selectedCardId,
    });
    setSelectedCardId(null);
  };

  const renderSeat = (
    player: typeof humanPlayer,
    position: 'bottom' | 'top' | 'left' | 'right',
  ) => {
    if (!player) return null;
    const isCurrentTurn = currentPlayer?.id === player.id && gameState.phase.type !== 'gameover' && !resolvingTrick;

    let statusBadge: string | undefined;
    if (player.hasEscaped) {
      const ord = player.finishOrder ?? 1;
      statusBadge = ord === 1 ? '🥇 1st Place' : ord === 2 ? '🥈 2nd Place' : ord === 3 ? '🥉 3rd Place' : 'Escaped';
    } else if (gameState.bhabhiPlayerId === player.id) {
      statusBadge = '💀 BHABHI';
    } else if (isCurrentTurn) {
      statusBadge = player.id === humanPlayerId ? 'Your Turn' : 'Playing';
    }

    return (
      <PlayerSeat
        id={player.id}
        name={player.name}
        isBot={player.isBot}
        isHuman={player.id === humanPlayerId}
        isCurrentTurn={isCurrentTurn}
        cardCount={player.hand.length}
        statusBadge={statusBadge}
        actionBubble={playerActionBubbles?.[player.id]}
        isWinner={player.hasEscaped}
        position={position}
      />
    );
  };

  // Guidance message
  let turnGuidance = '';
  if (isHumanTurn) {
    if (gameState.trickNumber === 0 && currentTrick === null && gameState.ruleset.firstLeaderRule === 'aceOfSpades') {
      turnGuidance = '👉 Lead the game with the Ace of Spades ♠';
    } else if (currentTrick === null) {
      turnGuidance = '👉 Lead a new trick: select any card from your hand';
    } else if (hasLedSuit) {
      const suitName = currentTrick.ledSuit === 'S' ? 'Spades ♠' : currentTrick.ledSuit === 'H' ? 'Hearts ♥' : currentTrick.ledSuit === 'D' ? 'Diamonds ♦' : 'Clubs ♣';
      turnGuidance = `👉 Compulsory follow suit: play a ${suitName} card`;
    } else {
      turnGuidance = '💥 Void in led suit! Play any card to hit a THULLA on the leader!';
    }
  }

  const selectedCard = humanHand.find((c) => c.id === selectedCardId);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        maxWidth: 1140,
        margin: '0 auto',
        gap: 6,
      }}
    >
      {/* 1. CASINO FELT ARENA (Opponents & Center Trick) */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 295,
          borderRadius: 155,
          background: crazyThullaActive
            ? 'radial-gradient(ellipse at center, #7f1d1d 0%, #450a0a 70%, #1c0505 100%)'
            : 'radial-gradient(ellipse at center, #1e3a8a 0%, #0f172a 75%, #020617 100%)',
          border: crazyThullaActive ? '10px solid #4a0404' : '8px solid #29180c',
          outline: crazyThullaActive ? '3px solid #ef4444' : '2px solid #38bdf8',
          boxShadow: crazyThullaActive
            ? 'inset 0 0 60px rgba(239, 68, 68, 0.95), 0 0 40px rgba(239, 68, 68, 0.8), 0 16px 40px rgba(0,0,0,0.8)'
            : 'inset 0 0 50px rgba(0, 0, 0, 0.8), 0 12px 35px rgba(0, 0, 0, 0.6), 0 0 18px rgba(56, 189, 248, 0.2)',
          animation: crazyThullaActive ? 'thullaShake 0.6s ease-in-out infinite' : undefined,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '8px 20px',
          overflow: 'hidden',
          transition: 'background 0.3s ease, border 0.3s ease, outline 0.3s ease',
        }}
      >
        {/* Card Throw & Eating Animation Overlay */}
        <CardThrowOverlay action={activeThrowAction ?? null} />

        {/* Shockwave background ring if Thulla */}
        {crazyThullaActive && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 155,
              animation: 'thullaShockwave 1s ease-out infinite',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          />
        )}

        {/* Felt ring */}
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            right: 6,
            bottom: 6,
            borderRadius: 147,
            border: crazyThullaActive ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(56, 189, 248, 0.2)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />

        {/* Top Seat */}
        <div style={{ display: 'flex', justifyContent: 'center', minHeight: 46, zIndex: 10 }}>
          {renderSeat(topPlayer, 'top')}
        </div>

        {/* Middle Row (Left Seat, Center Trick Arena, Right Seat) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flex: 1,
            padding: '0 10px',
            zIndex: 10,
          }}
        >
          <div style={{ width: 140, display: 'flex', justifyContent: 'center' }}>
            {renderSeat(leftPlayer, 'left')}
          </div>

          {/* Center Trick Area */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minWidth: 320,
              position: 'relative',
            }}
          >
            {/* Crazy Thulla Popover Banner */}
            {crazyThullaActive && resolvingTrick && (
              <div
                style={{
                  position: 'absolute',
                  top: -24,
                  zIndex: 80,
                  animation: 'comicPop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  pointerEvents: 'none',
                }}
              >
                <div
                  style={{
                    background: 'linear-gradient(135deg, #ef4444 0%, #991b1b 100%)',
                    border: '3px solid #facc15',
                    borderRadius: 18,
                    padding: '8px 24px',
                    boxShadow: '0 0 35px rgba(239, 68, 68, 1), 0 8px 30px rgba(0,0,0,0.85)',
                    textAlign: 'center',
                    transform: 'rotate(-2deg)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '1.45rem',
                      fontWeight: 900,
                      color: '#fff',
                      letterSpacing: '0.04em',
                      textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                    }}
                  >
                    💥 THULLA HIT! 💥
                  </div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fef08a' }}>
                    {resolvingTrick.penaltyPlayerName} takes all {resolvingTrick.cards.length} trick cards!
                  </div>
                </div>
              </div>
            )}

            {/* Trick Header Banner */}
            {activeLedSuit ? (
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.92)',
                  border: resolvingTrick?.isThulla
                    ? '1.5px solid rgba(239, 68, 68, 0.8)'
                    : '1px solid rgba(56, 189, 248, 0.5)',
                  padding: '5px 18px',
                  borderRadius: 20,
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
                }}
              >
                <span>Led Suit:</span>
                <span
                  style={{
                    color: activeLedSuit === 'H' || activeLedSuit === 'D' ? '#ef4444' : '#38bdf8',
                    fontWeight: 800,
                  }}
                >
                  {activeLedSuit === 'S'
                    ? '♠ Spades'
                    : activeLedSuit === 'H'
                      ? '♥ Hearts'
                      : activeLedSuit === 'D'
                        ? '♦ Diamonds'
                        : '♣ Clubs'}
                </span>
                <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                  ({activeTrickCards.length} / {gameState.players.filter((p) => !p.hasEscaped).length} played)
                </span>
              </div>
            ) : gameState.lastResolvedTrick && !resolvingTrick ? (
              <div
                style={{
                  background: gameState.lastResolvedTrick.wasThulla
                    ? 'rgba(239, 68, 68, 0.25)'
                    : 'rgba(16, 185, 129, 0.2)',
                  border: gameState.lastResolvedTrick.wasThulla
                    ? '1px solid rgba(239, 68, 68, 0.6)'
                    : '1px solid rgba(16, 185, 129, 0.5)',
                  padding: '5px 16px',
                  borderRadius: 20,
                  color: '#fff',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                }}
              >
                {gameState.lastResolvedTrick.wasThulla
                  ? `💥 THULLA! ${gameState.players.find((p) => p.id === gameState.lastResolvedTrick?.penaltyPlayerId)?.name} took cards`
                  : `✓ Trick won by ${gameState.players.find((p) => p.id === gameState.lastResolvedTrick?.winnerPlayerId)?.name}`}
              </div>
            ) : (
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.7)',
                  padding: '4px 14px',
                  borderRadius: 16,
                  color: '#94a3b8',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                }}
              >
                Waiting for trick lead...
              </div>
            )}

            {/* Trick Cards Display — Includes Last Card + Animates Cards Out */}
            <div
              style={{
                position: 'relative',
                width: 240,
                height: 130,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {activeTrickCards.length > 0 ? (
                activeTrickCards.map((tc, idx) => {
                  const isHighest = tc.playerIndex === activeHighestIndex;
                  const playerWhoPlayed = gameState.players[tc.playerIndex];

                  // Distribute cards organically around the center trick
                  const angle = (idx * 360) / Math.max(activeTrickCards.length, 3);
                  const rad = (angle * Math.PI) / 180;
                  const x = Math.cos(rad) * 48;
                  const y = Math.sin(rad) * 22;

                  // Animation when trick is clearing
                  const isClearing = resolvingTrick?.phase === 'clearing';
                  const clearingAnimation = isClearing
                    ? resolvingTrick?.isThulla
                      ? 'pickupCardsOut 0.5s ease-in forwards'
                      : 'burnCardsOut 0.5s ease-in forwards'
                    : 'cardDropIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)';

                  return (
                    <div
                      key={`${tc.card.id}-${idx}`}
                      style={{
                        position: 'absolute',
                        transform: `translate(${x}px, ${y}px) rotate(${angle * 0.15}deg)`,
                        zIndex: isHighest ? 35 : tc.isThulla ? 40 : idx + 5,
                        transition: 'transform 0.25s ease',
                        animation: clearingAnimation,
                      }}
                    >
                      <div style={{ position: 'relative' }}>
                        {/* Player Attribution Label Pill */}
                        <div
                          style={{
                            position: 'absolute',
                            top: -16,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background:
                              tc.playerIndex === humanIndex
                                ? 'rgba(245, 158, 11, 0.95)'
                                : 'rgba(15, 23, 42, 0.95)',
                            color: '#fff',
                            padding: '1px 6px',
                            borderRadius: 8,
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            zIndex: 40,
                          }}
                        >
                          {playerWhoPlayed?.name ?? 'Player'}
                        </div>

                        <Card card={tc.card} size="md" />

                        {/* HIGHEST Badge */}
                        {isHighest && !tc.isThulla && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: -8,
                              right: -8,
                              background: '#facc15',
                              color: '#000',
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              padding: '2px 6px',
                              borderRadius: 8,
                              boxShadow: '0 0 10px rgba(250, 204, 21, 0.8), 0 2px 6px rgba(0,0,0,0.6)',
                              zIndex: 42,
                            }}
                          >
                            👑 HIGHEST
                          </div>
                        )}

                        {/* THULLA Badge */}
                        {tc.isThulla && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: -8,
                              left: -12,
                              background: '#ef4444',
                              color: '#fff',
                              fontSize: '0.68rem',
                              fontWeight: 900,
                              padding: '2px 7px',
                              borderRadius: 8,
                              boxShadow: '0 0 15px rgba(239,68,68,1), 0 2px 6px rgba(0,0,0,0.8)',
                              zIndex: 45,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            💥 THULLA TRIGGER
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div
                  style={{
                    width: 78,
                    height: 110,
                    borderRadius: 8,
                    border: '2px dashed rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255, 255, 255, 0.3)',
                    fontSize: '1.2rem',
                  }}
                >
                  ⚡
                </div>
              )}
            </div>
          </div>

          <div style={{ width: 140, display: 'flex', justifyContent: 'center' }}>
            {renderSeat(rightPlayer, 'right')}
          </div>
        </div>

        {/* Bottom player identity placeholder */}
        <div style={{ height: 10 }} />
      </div>

      {/* 2. FLOATING ACTION CONTROLS BAR (Unclipped dock) */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 56,
        }}
      >
        {isHumanTurn ? (
          <div
            className="glass-panel"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '8px 24px',
              background: 'rgba(15, 23, 42, 0.95)',
              border: selectedCardId ? '2px solid rgba(56, 189, 248, 0.8)' : '1px solid rgba(56, 189, 248, 0.3)',
              boxShadow: selectedCardId ? '0 0 20px rgba(56, 189, 248, 0.4)' : 'none',
              borderRadius: 24,
            }}
          >
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
              {turnGuidance}
            </span>

            <button
              onClick={handlePlaySubmit}
              disabled={!selectedCardId || !legalCardIds.includes(selectedCardId)}
              style={{
                background:
                  selectedCardId && legalCardIds.includes(selectedCardId)
                    ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
                    : 'rgba(255, 255, 255, 0.08)',
                color: selectedCardId && legalCardIds.includes(selectedCardId) ? '#fff' : '#64748b',
                fontWeight: 700,
                fontSize: '0.88rem',
                padding: '8px 22px',
                borderRadius: 16,
                boxShadow:
                  selectedCardId && legalCardIds.includes(selectedCardId)
                    ? '0 0 15px rgba(2, 132, 199, 0.6)'
                    : 'none',
                cursor: selectedCardId && legalCardIds.includes(selectedCardId) ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>⚡</span>
              <span>
                {selectedCard
                  ? `Play ${selectedCard.rank}${selectedCard.suit === 'S' ? '♠' : selectedCard.suit === 'H' ? '♥' : selectedCard.suit === 'D' ? '♦' : '♣'}`
                  : 'Select a card below'}
              </span>
            </button>
          </div>
        ) : resolvingTrick ? (
          <div
            style={{
              color: resolvingTrick.isThulla ? '#fca5a5' : '#38bdf8',
              fontSize: '0.88rem',
              fontWeight: 700,
              padding: '6px 18px',
              borderRadius: 20,
              background: resolvingTrick.isThulla ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.15)',
              border: resolvingTrick.isThulla ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            {resolvingTrick.isThulla
              ? `💥 THULLA PENALTY! Cards moving to ${resolvingTrick.penaltyPlayerName}...`
              : `✓ Trick won by ${resolvingTrick.winnerPlayerName}! Discarding cards...`}
          </div>
        ) : (
          <div
            style={{
              color: '#94a3b8',
              fontSize: '0.85rem',
              fontWeight: 600,
              padding: '6px 18px',
              borderRadius: 20,
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            {isProcessingBot
              ? `${currentPlayer?.name ?? 'Bot'} is playing their turn...`
              : `Waiting for ${currentPlayer?.name ?? 'next player'}...`}
          </div>
        )}
      </div>

      {/* 3. DEDICATED PLAYER HAND CONSOLE (Full-width, unclipped) */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(16px)',
          border: isHumanTurn
            ? '2px solid rgba(56, 189, 248, 0.65)'
            : '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 14,
          padding: '6px 14px',
          boxShadow: isHumanTurn
            ? '0 0 24px rgba(56, 189, 248, 0.22), 0 6px 20px rgba(0,0,0,0.6)'
            : '0 6px 20px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          width: '100%',
          transition: 'all 0.3s ease',
        }}
      >
        {/* Header row: Identity and Status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            paddingBottom: 2,
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {renderSeat(bottomPlayer, 'bottom')}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {selectedCard && (
              <span style={{ fontSize: '0.82rem', color: '#38bdf8', fontWeight: 600 }}>
                Selected: {selectedCard.rank}{selectedCard.suit}
              </span>
            )}
            <span
              style={{
                color: isHumanTurn ? '#38bdf8' : '#94a3b8',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            >
              {isHumanTurn ? '👉 Select a card to play' : 'Waiting for turn...'}
            </span>
          </div>
        </div>

        {/* Card Fan (Sorted cleanly by suit and rank) */}
        <CardFan
          cards={bottomPlayer?.hand ?? []}
          selectedCardIds={selectedCardId ? [selectedCardId] : []}
          legalCardIds={isHumanTurn ? legalCardIds : undefined}
          maxSelectable={1}
          onCardClick={handleCardClick}
          disabled={!isHumanTurn}
        />
      </div>
    </div>
  );
};
