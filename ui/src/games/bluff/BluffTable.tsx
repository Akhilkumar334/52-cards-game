import React, { useState, useEffect } from 'react';
import type { BluffGameState, BluffMove, Rank } from '@cards/engine';
import { CardTable } from '../../components/table/CardTable';
import { PlayerSeat } from '../../components/table/PlayerSeat';
import { CardFan } from '../../components/table/CardFan';
import { type CardThrowAction } from '../../components/table/CardThrowOverlay';

export interface BluffTableProps {
  gameState: BluffGameState;
  humanPlayerId: string;
  onMove: (move: BluffMove) => void;
  isProcessingBot: boolean;
  playerActionBubbles?: Record<string, { text: string; type: 'think' | 'play' | 'pass' | 'challenge' }>;
  activeThrowAction?: CardThrowAction | null;
}

const ALL_RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];

export const BluffTable: React.FC<BluffTableProps> = ({
  gameState,
  humanPlayerId,
  onMove,
  isProcessingBot,
  playerActionBubbles,
  activeThrowAction,
}) => {
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [declaredRankChoice, setDeclaredRankChoice] = useState<Rank>(gameState.currentRank);

  const humanIndex = gameState.players.findIndex((p) => p.id === humanPlayerId);
  const humanPlayer = gameState.players[humanIndex];

  // Enforce max cards per play rule:
  // 52 cards (1 deck) -> max 4 cards
  // 104 cards (2 decks) -> up to 8 cards
  const deckCount = gameState.ruleset.deckCount ?? 1;
  const maxCardsPerPlay =
    deckCount === 1
      ? Math.min(4, gameState.ruleset.maxCardsPerPlay)
      : Math.min(8, gameState.ruleset.maxCardsPerPlay);

  // Sync declaredRankChoice when currentRank changes or when leading
  useEffect(() => {
    if (!gameState.canLeadRank) {
      setDeclaredRankChoice(gameState.currentRank);
    }
  }, [gameState.currentRank, gameState.canLeadRank]);

  // Seat order relative to human player (at bottom):
  const totalPlayers = gameState.players.length;
  const getRelativePlayer = (offset: number) => {
    if (humanIndex === -1) return gameState.players[offset % totalPlayers];
    const idx = (humanIndex + offset) % totalPlayers;
    return gameState.players[idx];
  };

  const bottomPlayer = humanPlayer;
  const leftPlayer = totalPlayers === 2 ? undefined : totalPlayers >= 3 ? getRelativePlayer(1) : undefined;
  const topPlayer = totalPlayers === 2 ? getRelativePlayer(1) : totalPlayers >= 3 ? getRelativePlayer(totalPlayers === 3 ? 2 : 2) : undefined;
  const rightPlayer = totalPlayers >= 4 ? getRelativePlayer(3) : undefined;

  // Active turn checks
  const isPlayPhase = gameState.phase.type === 'play';
  const isChallengePhase = gameState.phase.type === 'challenge';

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isHumanTurnToPlay = isPlayPhase && currentPlayer?.id === humanPlayerId;

  const currentChallengerIndex = isChallengePhase ? gameState.phase.pendingIndices[0] : undefined;
  const currentChallenger =
    currentChallengerIndex !== undefined ? gameState.players[currentChallengerIndex] : undefined;
  const isHumanTurnToChallenge = isChallengePhase && currentChallenger?.id === humanPlayerId;

  const handleCardToggle = (cardId: string) => {
    if (selectedCardIds.includes(cardId)) {
      setSelectedCardIds(selectedCardIds.filter((id) => id !== cardId));
    } else {
      if (selectedCardIds.length < maxCardsPerPlay) {
        const nextSelected = [...selectedCardIds, cardId];
        setSelectedCardIds(nextSelected);

        // When leading a new round, auto-default the declared rank to the rank of the first clicked card!
        if (gameState.canLeadRank && selectedCardIds.length === 0) {
          const clickedCard = humanPlayer?.hand.find((c) => c.id === cardId);
          if (clickedCard) {
            setDeclaredRankChoice(clickedCard.rank);
          }
        }
      }
    }
  };

  const handlePlaySubmit = () => {
    if (!isHumanTurnToPlay || selectedCardIds.length === 0) return;
    const finalRank = gameState.canLeadRank ? declaredRankChoice : gameState.currentRank;
    onMove({
      type: 'PLAY',
      playerId: humanPlayerId,
      cardIds: selectedCardIds,
      declaredRank: finalRank,
    });
    setSelectedCardIds([]);
  };

  const handlePassTurn = () => {
    if (!isHumanTurnToPlay) return;
    onMove({
      type: 'PASS_TURN',
      playerId: humanPlayerId,
    });
    setSelectedCardIds([]);
  };

  const handleChallenge = () => {
    if (!isHumanTurnToChallenge && !isHumanTurnToPlay) return;
    onMove({
      type: 'CHALLENGE',
      playerId: humanPlayerId,
    });
    setSelectedCardIds([]);
  };

  const handlePassChallenge = () => {
    if (!isHumanTurnToChallenge) return;
    onMove({
      type: 'PASS_CHALLENGE',
      playerId: humanPlayerId,
    });
  };

  const renderSeat = (
    player: typeof humanPlayer,
    position: 'bottom' | 'top' | 'left' | 'right',
  ) => {
    if (!player) return null;
    const isCurrentTurn =
      (isPlayPhase && currentPlayer?.id === player.id) ||
      (isChallengePhase && currentChallenger?.id === player.id);

    let statusBadge: string | undefined;
    if (isChallengePhase && currentChallenger?.id === player.id) {
      statusBadge = 'Deciding...';
    } else if (isPlayPhase && currentPlayer?.id === player.id) {
      statusBadge = 'Playing';
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
        isWinner={gameState.winnerId === player.id}
        position={position}
      />
    );
  };

  const renderActionsBar = () => {
    if (gameState.phase.type === 'gameover') {
      return (
        <div
          style={{
            color: '#10b981',
            fontWeight: 700,
            fontSize: '1.1rem',
            textShadow: '0 0 10px rgba(16, 185, 129, 0.5)',
            background: 'rgba(0, 0, 0, 0.7)',
            padding: '8px 20px',
            borderRadius: 20,
          }}
        >
          Game Over! {gameState.players.find((p) => p.id === gameState.winnerId)?.name} Won! 🏆
        </div>
      );
    }

    // 1. CHALLENGE PHASE (It's Human's turn to challenge or pass)
    if (isHumanTurnToChallenge) {
      const lastPlay = gameState.lastPlay;
      const lastPlayerName = lastPlay
        ? gameState.players[lastPlay.playerIndex]?.name ?? 'Opponent'
        : 'Opponent';
      const claimedRank = lastPlay ? (lastPlay.declaredRank === 'T' ? '10' : lastPlay.declaredRank) : '';
      const claimedCount = lastPlay ? lastPlay.cardCount : 1;

      return (
        <div
          className="glass-panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            padding: '8px 18px',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '2px solid rgba(239, 68, 68, 0.6)',
            boxShadow: '0 0 25px rgba(239, 68, 68, 0.4), 0 6px 18px rgba(0,0,0,0.6)',
            borderRadius: 14,
            animation: 'challengePulse 2s infinite',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#f8fafc', fontWeight: 700, fontSize: '0.9rem' }}>
              🚨 {lastPlayerName} claims {claimedCount} {claimedRank}
              {claimedCount > 1 ? "'s" : ''}!
            </div>
            <div style={{ color: '#cbd5e1', fontSize: '0.75rem', marginTop: 1 }}>
              Do you believe them, or do you want to call BLUFF?
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={handleChallenge}
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                color: '#fff',
                fontWeight: 800,
                fontSize: '0.88rem',
                letterSpacing: '0.04em',
                padding: '6px 18px',
                borderRadius: 20,
                boxShadow: '0 0 16px rgba(239, 68, 68, 0.8)',
              }}
            >
              CALL BLUFF! 🚨
            </button>

            <button
              onClick={handlePassChallenge}
              style={{
                background: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
                color: '#f1f5f9',
                fontWeight: 600,
                fontSize: '0.84rem',
                padding: '6px 16px',
                borderRadius: 20,
                border: '1px solid rgba(255, 255, 255, 0.25)',
              }}
            >
              ✓ Pass (Believe)
            </button>
          </div>
        </div>
      );
    }

    // 2. PLAY PHASE (It's Human's turn to play cards, show, or pass)
    if (isHumanTurnToPlay) {
      const activeRankDisplay = gameState.canLeadRank
        ? declaredRankChoice === 'T'
          ? '10'
          : declaredRankChoice
        : gameState.currentRank === 'T'
          ? '10'
          : gameState.currentRank;

      const lastPlay = gameState.lastPlay;
      const canChallenge =
        lastPlay !== null && lastPlay.playerIndex !== humanIndex;
      const lastPlayerName = lastPlay
        ? gameState.players[lastPlay.playerIndex]?.name ?? 'Opponent'
        : '';
      const lastPlayRank = lastPlay
        ? lastPlay.declaredRank === 'T'
          ? '10'
          : lastPlay.declaredRank
        : '';

      const canPass =
        gameState.ruleset.allowPass ||
        (gameState.ruleset.rankProgression === 'tableClearOnAllPass' &&
          lastPlay !== null);

      return (
        <div
          className="glass-panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 5,
            padding: '6px 14px',
            background: 'rgba(15, 23, 42, 0.95)',
            border: canChallenge
              ? '2px solid rgba(250, 204, 21, 0.7)'
              : '2px solid rgba(250, 204, 21, 0.5)',
            boxShadow: '0 0 20px rgba(250, 204, 21, 0.3)',
            borderRadius: 14,
            maxWidth: 820,
            width: '100%',
          }}
        >
          {/* Header guidance */}
          <div style={{ textAlign: 'center' }}>
            {gameState.lastPlayedPlayerIndex === humanIndex && !gameState.canLeadRank ? (
              <>
                <div
                  style={{
                    color: '#4ade80',
                    fontWeight: 800,
                    fontSize: '0.92rem',
                    marginBottom: 2,
                  }}
                >
                  🎉 All opponents skipped! Add more {activeRankDisplay}'s or click "Skip & Clear Table".
                </div>
                <div
                  style={{ color: '#cbd5e1', fontSize: '0.74rem', marginTop: 1 }}
                >
                  {selectedCardIds.length === 0
                    ? `Cards will only be removed from the table once you also skip. Select cards to add more ${activeRankDisplay}'s, or skip to clear table.`
                    : `${selectedCardIds.length} card(s) selected to add as ${activeRankDisplay}`}
                </div>
              </>
            ) : (
              <>
                {lastPlay && (
                  <div
                    style={{
                      color: '#f8fafc',
                      fontWeight: 700,
                      fontSize: '0.88rem',
                      marginBottom: 1,
                    }}
                  >
                    🚨 {lastPlayerName} placed {lastPlay.cardCount}{' '}
                    <span style={{ color: '#facc15' }}>
                      {lastPlayRank}
                      {lastPlay.cardCount > 1 ? "'s" : ''}
                    </span>{' '}
                    on table
                  </div>
                )}
                <div
                  style={{
                    color: '#facc15',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                  }}
                >
                  {gameState.canLeadRank
                    ? '👑 YOUR TURN: Choose Rank & Lead with 1–' +
                      maxCardsPerPlay +
                      ' cards'
                    : canChallenge
                    ? `👉 Your Turn: You can SHOW, PASS, or PLAY cards as ${activeRankDisplay}!`
                    : `🃏 YOUR TURN: Declare as ${activeRankDisplay} (1–${maxCardsPerPlay} cards)`}
                </div>
                <div
                  style={{ color: '#cbd5e1', fontSize: '0.74rem', marginTop: 1 }}
                >
                  {selectedCardIds.length === 0
                    ? canChallenge
                      ? 'Call Show on previous cards, pass, or click cards below to play'
                      : 'Click cards below to select them (Truth or Bluff!)'
                    : `${selectedCardIds.length} card(s) selected to play as ${activeRankDisplay}`}
                </div>
              </>
            )}
          </div>

          {/* If canLeadRank is true, let player pick which rank to declare */}
          {gameState.canLeadRank && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                Declare As:
              </span>
              <div
                style={{
                  display: 'flex',
                  gap: 3,
                  flexWrap: 'wrap',
                  maxWidth: 420,
                  justifyContent: 'center',
                }}
              >
                {ALL_RANKS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setDeclaredRankChoice(r)}
                    style={{
                      background:
                        declaredRankChoice === r
                          ? '#f59e0b'
                          : 'rgba(255, 255, 255, 0.08)',
                      color: declaredRankChoice === r ? '#000' : '#fff',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      padding: '2px 7px',
                      borderRadius: 6,
                      border:
                        declaredRankChoice === r
                          ? '1px solid #facc15'
                          : '1px solid rgba(255,255,255,0.1)',
                      cursor: 'pointer',
                    }}
                  >
                    {r === 'T' ? '10' : r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons: SHOW, PLAY, PASS */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            {/* 1. SHOW / CALL BLUFF */}
            {canChallenge && (
              <button
                type="button"
                onClick={handleChallenge}
                style={{
                  background:
                    'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '0.82rem',
                  letterSpacing: '0.02em',
                  padding: '6px 14px',
                  borderRadius: 16,
                  boxShadow: '0 0 14px rgba(239, 68, 68, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                🚨 SHOW (Call Bluff)
              </button>
            )}

            {/* 2. PLAY CARDS */}
            <button
              type="button"
              onClick={handlePlaySubmit}
              disabled={selectedCardIds.length === 0}
              style={{
                background:
                  selectedCardIds.length > 0
                    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                    : 'rgba(255, 255, 255, 0.08)',
                color: selectedCardIds.length > 0 ? '#fff' : '#64748b',
                fontWeight: 700,
                fontSize: '0.82rem',
                padding: '6px 16px',
                borderRadius: 16,
                boxShadow:
                  selectedCardIds.length > 0
                    ? '0 0 14px rgba(245, 158, 11, 0.6)'
                    : 'none',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                cursor:
                  selectedCardIds.length > 0 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              🃏{' '}
              {selectedCardIds.length > 0
                ? `Play ${selectedCardIds.length} card(s) as ${activeRankDisplay}`
                : `Select cards to play as ${activeRankDisplay}`}
            </button>

            {/* 3. PASS / SKIP TURN */}
            {canPass && (
              <button
                type="button"
                onClick={handlePassTurn}
                style={{
                  background:
                    gameState.lastPlayedPlayerIndex === humanIndex
                      ? 'linear-gradient(135deg, #15803d 0%, #166534 100%)'
                      : 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
                  color: '#f1f5f9',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  padding: '6px 14px',
                  borderRadius: 16,
                  border:
                    gameState.lastPlayedPlayerIndex === humanIndex
                      ? '1px solid rgba(74, 222, 128, 0.5)'
                      : '1px solid rgba(255, 255, 255, 0.25)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  boxShadow:
                    gameState.lastPlayedPlayerIndex === humanIndex
                      ? '0 0 14px rgba(34, 197, 94, 0.4)'
                      : 'none',
                }}
              >
                {gameState.lastPlayedPlayerIndex === humanIndex
                  ? '🧹 Skip & Clear Table Cards'
                  : '⏭ Skip Turn'}
              </button>
            )}
          </div>
        </div>
      );
    }

    // 3. BOT'S TURN (Waiting for bot action)
    const activePlayerName = isPlayPhase ? currentPlayer?.name : currentChallenger?.name;
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: '#cbd5e1',
          fontSize: '0.8rem',
          background: 'rgba(0, 0, 0, 0.65)',
          padding: '6px 16px',
          borderRadius: 20,
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <span style={{ display: 'inline-block', animation: 'pulseGlow 1s infinite' }}>⏳</span>
        <span>
          {isProcessingBot
            ? `${activePlayerName ?? 'Bot'} is deciding...`
            : `Waiting for ${activePlayerName ?? 'next turn'}...`}
        </span>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 6 }}>
      <CardTable
        gameState={gameState}
        humanPlayerId={humanPlayerId}
        topSeat={renderSeat(topPlayer, 'top')}
        leftSeat={renderSeat(leftPlayer, 'left')}
        rightSeat={renderSeat(rightPlayer, 'right')}
        activeThrowAction={activeThrowAction}
        bottomSeat={
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.88)',
              backdropFilter: 'blur(16px)',
              border: isHumanTurnToPlay
                ? '2px solid rgba(250, 204, 21, 0.65)'
                : '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 14,
              padding: '6px 14px',
              boxShadow: isHumanTurnToPlay
                ? '0 0 24px rgba(250, 204, 21, 0.22), 0 6px 20px rgba(0,0,0,0.6)'
                : '0 6px 20px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              width: '100%',
              transition: 'all 0.3s ease',
            }}
          >
            {/* Header row: Left has Player Identity; Right has Status */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    color: isHumanTurnToPlay ? '#facc15' : '#94a3b8',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                  }}
                >
                  {isHumanTurnToPlay ? '👉 Your Turn to Play!' : 'Waiting for opponents...'}
                </span>
              </div>
            </div>

            {/* The 13 Cards in Hand */}
            <CardFan
              cards={bottomPlayer?.hand ?? []}
              selectedCardIds={selectedCardIds}
              maxSelectable={maxCardsPerPlay}
              onCardClick={handleCardToggle}
              disabled={!isHumanTurnToPlay}
            />
          </div>
        }
        actionsBar={renderActionsBar()}
      />
    </div>
  );
};
