import React, { useState, useMemo, useEffect } from 'react';
import type { SeepGameState, SeepMove, Card as CardType } from '@cards/engine';
import { getCardNumericValue, getSeepForcedMoveReason } from '@cards/engine';
import { Card } from '../../components/shared/Card';
import { PlayerSeat } from '../../components/table/PlayerSeat';
import { CardFan } from '../../components/table/CardFan';
import { CardThrowOverlay, type CardThrowAction } from '../../components/table/CardThrowOverlay';

export interface SeepTableProps {
  gameState: SeepGameState;
  humanPlayerId: string;
  legalMoves?: readonly SeepMove[];
  onMove: (move: SeepMove) => void;
  isProcessingBot: boolean;
  playerActionBubbles?: Record<string, { text: string; type: 'think' | 'play' | 'pass' | 'challenge' | 'thulla' }>;
  seepCelebrationActive?: boolean;
  activeThrowAction?: CardThrowAction | null;
}

export const SeepTable: React.FC<SeepTableProps> = ({
  gameState,
  humanPlayerId,
  legalMoves: passedLegalMoves = [],
  onMove,
  isProcessingBot,
  playerActionBubbles,
  seepCelebrationActive,
  activeThrowAction,
}) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedFloorItemIds, setSelectedFloorItemIds] = useState<Set<string>>(new Set());
  const [hoveredMoveItemIds, setHoveredMoveItemIds] = useState<Set<string>>(new Set());

  const humanIndex = gameState.players.findIndex((p) => p.id === humanPlayerId);
  const humanPlayer = gameState.players[humanIndex];

  const totalPlayers = gameState.players.length;
  const getRelativePlayer = (offset: number) => {
    if (humanIndex === -1) return gameState.players[offset % totalPlayers];
    const idx = (humanIndex + offset) % totalPlayers;
    return gameState.players[idx];
  };

  const bottomPlayer = humanPlayer; // You
  const leftPlayer = totalPlayers >= 2 ? getRelativePlayer(1) : undefined;
  const topPlayer = totalPlayers >= 3 ? getRelativePlayer(2) : undefined;
  const rightPlayer = totalPlayers >= 4 ? getRelativePlayer(3) : undefined;

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isHumanTurn =
    currentPlayer?.id === humanPlayerId &&
    gameState.phase.type !== 'game_over' &&
    gameState.phase.type !== 'round_over';

  const humanHand = humanPlayer?.hand ?? [];
  const selectedCard = humanHand.find((c) => c.id === selectedCardId);

  // Auto-clear selectedCardId if it is no longer in humanHand (e.g. after card played or deal)
  useEffect(() => {
    if (selectedCardId && !humanHand.some((c) => c.id === selectedCardId)) {
      setSelectedCardId(null);
    }
  }, [humanHand, selectedCardId]);

  // When turn changes or is not human turn, reset selections
  useEffect(() => {
    setSelectedCardId(null);
    setSelectedFloorItemIds(new Set());
  }, [gameState.currentPlayerIndex, gameState.turnNumber]);

  // Legal moves for the human player
  const legalMoves = isHumanTurn
    ? passedLegalMoves.length > 0
      ? passedLegalMoves
      : (window as unknown as { currentSeepLegalMoves?: SeepMove[] }).currentSeepLegalMoves ?? []
    : [];

  // Toggle selection for hand card
  const handleHandCardClick = (cardId: string) => {
    if (!isHumanTurn) return;
    setSelectedCardId(selectedCardId === cardId ? null : cardId);
  };

  // Toggle selection for floor items (loose cards or houses)
  const toggleFloorItemSelection = (itemId: string) => {
    if (!isHumanTurn) return;
    setSelectedFloorItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const clearFloorSelection = () => {
    setSelectedFloorItemIds(new Set());
  };

  // Floor items list
  const floorItems = useMemo(() => {
    return gameState.floor.items ?? [
      ...(gameState.floor.looseCards ?? []).map((c) => ({ type: 'loose' as const, id: c.id, card: c })),
      ...(gameState.floor.houses ?? []).map((h) => ({ type: 'house' as const, id: h.id, house: h })),
    ];
  }, [gameState.floor]);

  // Selected floor items breakdown and total sum
  const selectedFloorItems = useMemo(() => {
    return floorItems.filter((i) => selectedFloorItemIds.has(i.id));
  }, [floorItems, selectedFloorItemIds]);

  const selectedFloorSum = useMemo(() => {
    return selectedFloorItems.reduce((acc, item) => {
      if (item.type === 'loose') return acc + getCardNumericValue(item.card);
      return acc + item.house.buildValue;
    }, 0);
  }, [selectedFloorItems]);

  const selectedHandCardVal = useMemo(() => {
    return selectedCard ? getCardNumericValue(selectedCard) : null;
  }, [selectedCard]);

  // Preview highlighted floor items for the currently selected hand card or hovered move
  const previewHighlightSet = useMemo(() => {
    if (hoveredMoveItemIds.size > 0) return hoveredMoveItemIds;
    if (selectedFloorItemIds.size > 0) return selectedFloorItemIds;
    if (!selectedCardId) return new Set<string>();

    const matchingMoves = legalMoves.filter(
      (m) =>
        ('handCardId' in m && m.handCardId === selectedCardId) ||
        ('cardId' in m && m.cardId === selectedCardId),
    );

    const items = new Set<string>();
    for (const m of matchingMoves) {
      if (m.type === 'CAPTURE') {
        const ids = m.itemIds ?? [...(m.capturedLooseCardIds ?? []), ...(m.capturedHouseIds ?? [])];
        ids.forEach((id) => items.add(id));
      }
      if (m.type === 'BUILD') {
        m.floorItemIds.forEach((id) => items.add(id));
        if (m.extendHouseId) items.add(m.extendHouseId);
      }
      if (m.type === 'BUILD_HOUSE') {
        m.floorCardIds.forEach((id) => items.add(id));
      }
      if (m.type === 'CEMENT_HOUSE') {
        items.add(m.houseId);
        (m.additionalFloorCardIds ?? []).forEach((id) => items.add(id));
      }
    }
    return items;
  }, [selectedCardId, hoveredMoveItemIds, selectedFloorItemIds, legalMoves]);

  // Forced move banner: Derived strictly from engine's getSeepForcedMoveReason
  // It only appears when the engine restriction is actually applied to getLegalMoves
  const compulsoryForcedReason = useMemo(() => {
    if (!isHumanTurn) return null;
    return getSeepForcedMoveReason(gameState, humanPlayerId);
  }, [isHumanTurn, gameState, humanPlayerId]);

  const renderSeat = (
    player: typeof humanPlayer,
    position: 'bottom' | 'top' | 'left' | 'right',
  ) => {
    if (!player) return null;
    const isCurrentTurn = currentPlayer?.id === player.id;
    const playerTeam = gameState.teams[player.teamIndex];
    const isTeammate = player.teamIndex === humanPlayer?.teamIndex;

    let badgeText = isTeammate
      ? position === 'bottom'
        ? 'You'
        : 'Partner'
      : 'Opponent';

    if (playerTeam?.permanentSeep) badgeText += ' 🌟 (Perm Seep)';
    else if (playerTeam && playerTeam.activeSeeps > 0) badgeText += ` ⚡ (${playerTeam.activeSeeps} Seep)`;

    return (
      <div style={{ position: 'relative' }}>
        <PlayerSeat
          id={player.id}
          name={player.name}
          isBot={player.isBot}
          isHuman={player.id === humanPlayerId}
          isCurrentTurn={isCurrentTurn}
          cardCount={player.hand.length}
          statusBadge={badgeText}
          actionBubble={playerActionBubbles?.[player.id]}
          position={position}
        />
      </div>
    );
  };

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
      {/* 0. PERSISTENT OPENING BID BANNER (POSITIONED ABOVE THE TABLE TO PREVENT ANY OVERLAP) */}
      {gameState.openingBid && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.22) 0%, rgba(180, 83, 9, 0.22) 100%)',
            border: '1.5px solid #facc15',
            borderRadius: 24,
            padding: '4px 20px',
            color: '#fef08a',
            fontSize: '0.82rem',
            fontWeight: 800,
            boxShadow: '0 4px 18px rgba(234, 179, 8, 0.25)',
            zIndex: 15,
          }}
        >
          <span>👑 Opening Bid: {gameState.players[gameState.openingBid.playerIndex]?.name} declared House of {gameState.openingBid.houseValue}</span>
          {gameState.openingBid.isCaptured ? (
            <span
              style={{
                color: '#86efac',
                fontSize: '0.74rem',
                background: 'rgba(16, 185, 129, 0.25)',
                padding: '2px 10px',
                borderRadius: 12,
                border: '1px solid rgba(16, 185, 129, 0.4)',
              }}
            >
              Captured ✅
            </span>
          ) : (
            <span
              style={{
                color: '#fde047',
                fontSize: '0.74rem',
                background: 'rgba(234, 179, 8, 0.25)',
                padding: '2px 10px',
                borderRadius: 12,
                border: '1px solid rgba(234, 179, 8, 0.4)',
              }}
            >
              Active House 🏠
            </span>
          )}
        </div>
      )}

      {/* 1. CASINO FELT ARENA (STREAMLINED 295PX HEIGHT SO PLAYER HAND IS ALWAYS 100% VISIBLE) */}
      <div
        className="felt-arena-responsive"
        style={{
          position: 'relative',
          width: '100%',
          height: 295,
          borderRadius: 155,
          background: 'radial-gradient(ellipse at center, #064e3b 0%, #022c22 75%, #011a14 100%)',
          border: '8px solid #29180c',
          outline: '2px solid #10b981',
          boxShadow:
            'inset 0 0 50px rgba(0, 0, 0, 0.85), 0 12px 35px rgba(0, 0, 0, 0.6), 0 0 18px rgba(16, 185, 129, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '6px 20px',
          overflow: 'hidden',
        }}
      >
        {/* Card Throw & Eating Animation Overlay */}
        <CardThrowOverlay action={activeThrowAction ?? null} />

        {/* Seep Celebration Overlay */}
        {seepCelebrationActive && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle, rgba(234, 179, 8, 0.35) 0%, transparent 70%)',
              animation: 'pulseGlow 1s infinite alternate',
              pointerEvents: 'none',
              zIndex: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
                border: '3px solid #fde047',
                padding: '14px 36px',
                borderRadius: 24,
                boxShadow: '0 0 45px rgba(245, 158, 11, 0.9), 0 8px 30px rgba(0,0,0,0.8)',
                color: '#fff',
                textAlign: 'center',
                animation: 'comicPop 0.4s ease-out',
              }}
            >
              <div style={{ fontSize: '1.9rem', fontWeight: 900, letterSpacing: '0.05em' }}>
                🌟 SEEP! (+25 PTS) 🌟
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#fef08a' }}>
                Entire floor cleared!
              </div>
            </div>
          </div>
        )}

        {/* Felt inner oval ring */}
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            right: 6,
            bottom: 6,
            borderRadius: 147,
            border: '1px solid rgba(16, 185, 129, 0.2)',
            pointerEvents: 'none',
          }}
        />

        {/* Top Seat (North) — Completely unobstructed */}
        <div style={{ display: 'flex', justifyContent: 'center', minHeight: 46, zIndex: 10 }}>
          {renderSeat(topPlayer, 'top')}
        </div>

        {/* Middle Row (Left Seat, Center Floor Arena, Right Seat) */}
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
          {/* Left Player Seat (West) */}
          <div style={{ width: 140, display: 'flex', justifyContent: 'center' }}>
            {renderSeat(leftPlayer, 'left')}
          </div>

          {/* Center Floor (Houses & Loose Cards) */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minWidth: 460,
              maxWidth: 600,
            }}
          >
            {/* ZONE 1: ACTIVE HOUSES (At most maxHousesOnFloor houses side-by-side) */}
            {gameState.floor.houses.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                  }}
                >
                  🏠 Built Houses (Max {gameState.ruleset.maxHousesOnFloor ?? 2} • Tap to Select)
                </span>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                  {gameState.floor.houses.map((house) => {
                    const owner = gameState.players[house.ownerPlayerIndex];
                    const isSelected = selectedFloorItemIds.has(house.id);
                    const isHighlighted = previewHighlightSet.has(house.id);

                    return (
                      <div
                        key={house.id}
                        onClick={() => toggleFloorItemSelection(house.id)}
                        style={{
                          background: isSelected
                            ? 'rgba(234, 179, 8, 0.35)'
                            : house.isCemented
                            ? 'rgba(234, 179, 8, 0.18)'
                            : 'rgba(56, 189, 248, 0.18)',
                          border: isSelected
                            ? '3px solid #facc15'
                            : isHighlighted
                            ? '2.5px solid #10b981'
                            : house.isCemented
                            ? '1.5px solid #facc15'
                            : '1.5px dashed #38bdf8',
                          borderRadius: 14,
                          padding: '8px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 6,
                          boxShadow: isSelected
                            ? '0 0 24px rgba(250, 204, 21, 0.85), 0 4px 16px rgba(0,0,0,0.6)'
                            : isHighlighted
                            ? '0 0 20px rgba(16, 185, 129, 0.8)'
                            : '0 4px 12px rgba(0,0,0,0.4)',
                          transform: isSelected ? 'scale(1.06) translateY(-4px)' : isHighlighted ? 'scale(1.03)' : 'none',
                          transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                          cursor: isHumanTurn ? 'pointer' : 'default',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              fontSize: '0.78rem',
                              fontWeight: 800,
                              color: isSelected ? '#fef08a' : house.isCemented ? '#fde047' : '#bae6fd',
                            }}
                          >
                            {isSelected ? '✓ ' : ''}{house.isCemented ? '🔒 CEMENTED' : '🏠 HOUSE'} {house.buildValue}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: '#cbd5e1' }}>
                            ({owner?.name})
                          </span>
                        </div>
                        <div style={{ display: 'flex', marginLeft: 8 }}>
                          {house.cards.map((c, i) => (
                            <div key={`${c.id}-${i}`} style={{ marginLeft: i > 0 ? -18 : 0 }}>
                              <Card card={c} size="sm" />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ZONE 2: LOOSE CARDS ON FLOOR (Individually tappable) */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              {gameState.floor.looseCards.length > 0 && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    color: '#94a3b8',
                    textTransform: 'uppercase',
                  }}
                >
                  🃏 Floor Cards (Tap cards to pick or build)
                </span>
              )}

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  minHeight: 110,
                  alignItems: 'center',
                }}
              >
                {gameState.floor.looseCards.length > 0 ? (
                  gameState.floor.looseCards.map((c) => {
                    const isSelected = selectedFloorItemIds.has(c.id);
                    const isHighlighted = previewHighlightSet.has(c.id);
                    const cardNumVal = getCardNumericValue(c);

                    return (
                      <div
                        key={c.id}
                        onClick={() => toggleFloorItemSelection(c.id)}
                        style={{
                          animation: 'cardDropIn 0.3s ease-out',
                          transform: isSelected
                            ? 'scale(1.1) translateY(-10px)'
                            : isHighlighted
                            ? 'scale(1.06) translateY(-4px)'
                            : 'none',
                          transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                          cursor: isHumanTurn ? 'pointer' : 'default',
                          position: 'relative',
                        }}
                      >
                        <Card
                          card={c}
                          size="md"
                          selected={isSelected}
                          badge={isSelected ? `✓ Val: ${cardNumVal}` : undefined}
                        />
                      </div>
                    );
                  })
                ) : gameState.floor.houses.length === 0 ? (
                  <div
                    style={{
                      color: '#6ee7b7',
                      fontSize: '0.92rem',
                      fontStyle: 'italic',
                      padding: '12px 24px',
                      background: 'rgba(6, 78, 59, 0.4)',
                      borderRadius: 16,
                      border: '1px dashed #10b981',
                    }}
                  >
                    ✨ Floor is completely clear!
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Right Player Seat (East) */}
          <div style={{ width: 140, display: 'flex', justifyContent: 'center' }}>
            {renderSeat(rightPlayer, 'right')}
          </div>
        </div>

        {/* Bottom felt buffer space (ensures loose cards never touch bottom edge) */}
        <div style={{ height: 20 }} />
      </div>

      {/* 2. INTERACTIVE SELECTION HUD & MOVE PICKER */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          minHeight: 60,
        }}
      >
        {/* Compulsory Move Alert */}
        {compulsoryForcedReason && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid #f87171',
              color: '#fca5a5',
              padding: '6px 20px',
              borderRadius: 16,
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 10px rgba(239, 68, 68, 0.3)',
            }}
          >
            <span>⚠️</span>
            <span>{compulsoryForcedReason}</span>
          </div>
        )}

        {/* Live Selection HUD Bar when player tapped cards on table or hand */}
        {isHumanTurn && (selectedFloorItemIds.size > 0 || selectedCardId) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '6px 20px',
              borderRadius: 20,
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(250, 204, 21, 0.5)',
              boxShadow: '0 4px 15px rgba(250, 204, 21, 0.2)',
              flexWrap: 'wrap',
              justifyContent: 'center',
            }}
          >
            {/* Selected Hand Card */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Hand:</span>
              {selectedCard ? (
                <span
                  style={{
                    background: 'rgba(16, 185, 129, 0.25)',
                    border: '1px solid #10b981',
                    borderRadius: 10,
                    padding: '2px 8px',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    color: '#6ee7b7',
                  }}
                >
                  {selectedCard.rank}{selectedCard.suit} (Val {selectedHandCardVal})
                </span>
              ) : (
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>
                  None selected
                </span>
              )}
            </div>

            <span style={{ color: '#475569' }}>•</span>

            {/* Selected Floor Cards & Sum */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Table:</span>
              {selectedFloorItemIds.size > 0 ? (
                <span
                  style={{
                    background: 'rgba(234, 179, 8, 0.25)',
                    border: '1px solid #facc15',
                    borderRadius: 10,
                    padding: '2px 8px',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    color: '#fef08a',
                  }}
                >
                  {selectedFloorItems.length} items (Sum: {selectedFloorSum})
                </span>
              ) : (
                <span style={{ fontSize: '0.78rem', color: '#64748b', fontStyle: 'italic' }}>
                  Tap table cards to pick
                </span>
              )}
            </div>

            {/* Combined Sum if building */}
            {selectedCard && selectedFloorItemIds.size > 0 && (
              <>
                <span style={{ color: '#475569' }}>•</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#38bdf8' }}>
                  Combined: {selectedHandCardVal} + {selectedFloorSum} = {(selectedHandCardVal ?? 0) + selectedFloorSum}
                </span>
              </>
            )}

            {/* Clear Selection Button */}
            {selectedFloorItemIds.size > 0 && (
              <button
                onClick={clearFloorSelection}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  color: '#fca5a5',
                  padding: '2px 8px',
                  borderRadius: 8,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                ✖ Reset Table
              </button>
            )}
          </div>
        )}

        {/* Action Controls & Move Buttons */}
        {isHumanTurn ? (
          <div
            className="glass-panel"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 24px',
              background: 'rgba(15, 23, 42, 0.95)',
              border: selectedCardId || selectedFloorItemIds.size > 0
                ? '2px solid rgba(16, 185, 129, 0.8)'
                : '1px solid rgba(16, 185, 129, 0.3)',
              boxShadow: selectedCardId || selectedFloorItemIds.size > 0 ? '0 0 20px rgba(16, 185, 129, 0.4)' : 'none',
              borderRadius: 24,
            }}
          >
            {gameState.phase.type === 'bidding' ? (
              (() => {
                const redealMove = legalMoves.find((m) => m.type === 'REDEAL_BID');
                if (redealMove) {
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f87171' }}>
                          ⚠️ Dead Deal ("Raddi") — No 9–13 in Hand
                        </span>
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                          Under Seep rules, you cannot bid without holding a 9–13. Re-deal 4 fresh cards.
                        </span>
                      </div>
                      <button
                        onClick={() => onMove(redealMove)}
                        style={{
                          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                          color: '#fff',
                          padding: '8px 18px',
                          borderRadius: 14,
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)',
                          border: 'none',
                        }}
                      >
                        🔄 Re-deal Hand
                      </button>
                    </div>
                  );
                }

                // Stage 1: DECLARE_BID
                const declareBids = legalMoves.filter(
                  (m): m is Extract<SeepMove, { type: 'DECLARE_BID' }> => m.type === 'DECLARE_BID',
                );

                if (declareBids.length > 0 && !gameState.openingBid) {
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#facc15' }}>
                        👑 Declare Opening Bid (values in hand):
                      </span>
                      {declareBids.map((b) => (
                        <button
                          key={b.houseValue}
                          onClick={() => onMove(b)}
                          style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#fff',
                            padding: '6px 16px',
                            borderRadius: 14,
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            border: 'none',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                          }}
                        >
                          Bid {b.houseValue}
                        </button>
                      ))}
                    </div>
                  );
                }

                // Stage 2: Bidder's opening move options (Capture, Build, Trail)
                const openingCaptures = legalMoves.filter(
                  (m): m is Extract<SeepMove, { type: 'CAPTURE' }> => m.type === 'CAPTURE',
                );
                const openingBuilds = legalMoves.filter(
                  (m): m is Extract<SeepMove, { type: 'BUILD' }> => m.type === 'BUILD',
                );
                const openingTrails = legalMoves.filter(
                  (m): m is Extract<SeepMove, { type: 'TRAIL' }> => m.type === 'TRAIL',
                );

                const bidVal = gameState.openingBid?.houseValue ?? 0;

                // Interactive match for capture: table sum equals bid value
                const interactiveOpeningCapture = selectedFloorSum === bidVal && openingCaptures.length > 0;

                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#facc15' }}>
                      👑 Opening Play with Bid {bidVal}:
                    </span>

                    {/* Interactive Capture with Bid Button (if user tapped matching cards on table) */}
                    {interactiveOpeningCapture && (
                      <button
                        onClick={() => {
                          const capMove = openingCaptures[0]!;
                          onMove(capMove);
                          clearFloorSelection();
                        }}
                        style={{
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          color: '#fff',
                          padding: '8px 20px',
                          borderRadius: 14,
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          boxShadow: '0 0 20px rgba(16, 185, 129, 0.8)',
                          border: '2px solid #6ee7b7',
                        }}
                      >
                        👑 Pick Selected Cards with Bid {bidVal} (Sum: {selectedFloorSum})
                      </button>
                    )}

                    {/* Default Opening Capture Buttons (if not already captured interactively) */}
                    {!interactiveOpeningCapture &&
                      openingCaptures.map((cap, idx) => (
                        <button
                          key={`oc-${idx}`}
                          onClick={() => {
                            onMove(cap);
                            setSelectedCardId(null);
                            clearFloorSelection();
                          }}
                          onMouseEnter={() =>
                            setHoveredMoveItemIds(
                              new Set(cap.itemIds ?? [...(cap.capturedLooseCardIds ?? []), ...(cap.capturedHouseIds ?? [])]),
                            )
                          }
                          onMouseLeave={() => setHoveredMoveItemIds(new Set())}
                          style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#fff',
                            padding: '7px 16px',
                            borderRadius: 14,
                            fontWeight: 700,
                            fontSize: '0.82rem',
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.4)',
                            border: 'none',
                          }}
                        >
                          🃏 Capture Floor with Bid {bidVal}
                        </button>
                      ))}

                    {/* Opening Build Buttons */}
                    {openingBuilds.map((b, idx) => (
                      <button
                        key={`ob-${idx}`}
                        onClick={() => {
                          onMove(b);
                          setSelectedCardId(null);
                          clearFloorSelection();
                        }}
                        onMouseEnter={() => setHoveredMoveItemIds(new Set(b.floorItemIds))}
                        onMouseLeave={() => setHoveredMoveItemIds(new Set())}
                        style={{
                          background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                          color: '#fff',
                          padding: '7px 16px',
                          borderRadius: 14,
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(217, 119, 6, 0.4)',
                          border: 'none',
                        }}
                      >
                        🏠 Build House of {b.targetValue}
                      </button>
                    ))}

                    {/* Opening Trail */}
                    {openingTrails.length > 0 && selectedCardId && (
                      <button
                        onClick={() => {
                          const tm = openingTrails.find((t) => t.cardId === selectedCardId);
                          if (tm) onMove(tm);
                          setSelectedCardId(null);
                          clearFloorSelection();
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.1)',
                          color: '#e2e8f0',
                          padding: '7px 16px',
                          borderRadius: 14,
                          fontWeight: 600,
                          fontSize: '0.82rem',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          cursor: 'pointer',
                        }}
                      >
                        ⬇️ Trail {selectedCard?.rank}{selectedCard?.suit}
                      </button>
                    )}
                  </div>
                );
              })()
            ) : (
              // Playing Phase Move Picker (Capture, Build, Trail)
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f8fafc' }}>
                  {selectedCard
                    ? `Selected Hand: ${selectedCard.rank}${selectedCard.suit} (${selectedHandCardVal})`
                    : selectedFloorItemIds.size > 0
                    ? `Table Selected (${selectedFloorSum}) • Choose a hand card`
                    : 'Tap table cards or choose a card from hand to play'}
                </span>

                {/* Interactive Dynamic Action Button when user tapped specific cards on table */}
                {selectedCard &&
                  selectedFloorItemIds.size > 0 &&
                  (() => {
                    const buttons: React.ReactNode[] = [];

                    // 1. Direct capture with selectedCard
                    const captureMoves = legalMoves.filter(
                      (m): m is Extract<SeepMove, { type: 'CAPTURE' }> =>
                        m.type === 'CAPTURE' && m.handCardId === selectedCardId,
                    );
                    const canCaptureSelected =
                      selectedFloorSum === selectedHandCardVal && captureMoves.length > 0;
                    if (canCaptureSelected) {
                      const bestCap = captureMoves[0]!;
                      buttons.push(
                        <button
                          key="dyn-cap"
                          onClick={() => {
                            onMove(bestCap);
                            setSelectedCardId(null);
                            clearFloorSelection();
                          }}
                          style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#fff',
                            padding: '8px 20px',
                            borderRadius: 14,
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            boxShadow: '0 0 20px rgba(16, 185, 129, 0.8)',
                            border: '2px solid #6ee7b7',
                          }}
                        >
                          🃏 Capture Selected Items (Sum: {selectedFloorSum})
                        </button>,
                      );
                    }

                    // 2. Direct cement/contribution to a selected house (optionally collecting loose floor cards)
                    const selectedHouse = gameState.floor.houses.find((h) => selectedFloorItemIds.has(h.id));
                    const selectedLooseIds = Array.from(selectedFloorItemIds).filter((id) => id !== selectedHouse?.id);

                    const matchingCement = selectedHouse
                      ? legalMoves.find((m): m is Extract<SeepMove, { type: 'CEMENT_HOUSE' }> => {
                          if (m.type !== 'CEMENT_HOUSE' || m.handCardId !== selectedCardId || m.houseId !== selectedHouse.id) {
                            return false;
                          }
                          const mAdd = m.additionalFloorCardIds ?? [];
                          if (mAdd.length !== selectedLooseIds.length) return false;
                          return selectedLooseIds.every((id) => mAdd.includes(id));
                        }) ??
                        legalMoves.find(
                          (m): m is Extract<SeepMove, { type: 'CEMENT_HOUSE' }> =>
                            m.type === 'CEMENT_HOUSE' && m.handCardId === selectedCardId && m.houseId === selectedHouse.id,
                        )
                      : undefined;

                    if (matchingCement) {
                      const targetHouse = gameState.floor.houses.find((h) => h.id === matchingCement.houseId);
                      const houseVal = targetHouse?.buildValue ?? '?';
                      const addCards = (matchingCement.additionalFloorCardIds ?? [])
                        .map((id) => gameState.floor.looseCards.find((c) => c.id === id))
                        .filter(Boolean);
                      const addNames = addCards.map((c) => c!.rank + c!.suit).join(', ');
                      const cementLabel =
                        addCards.length > 0
                          ? `🔒 Contribute ${selectedCard.rank}${selectedCard.suit} + floor cards (${addNames}) to House ${houseVal} (Cement)`
                          : `🔒 Contribute ${selectedCard.rank}${selectedCard.suit} to House ${houseVal} (Cement)`;
                      buttons.push(
                        <button
                          key="dyn-cem"
                          onClick={() => {
                            onMove(matchingCement);
                            setSelectedCardId(null);
                            clearFloorSelection();
                          }}
                          style={{
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            color: '#fff',
                            padding: '8px 20px',
                            borderRadius: 14,
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            boxShadow: '0 0 20px rgba(99, 102, 241, 0.8)',
                            border: '2px solid #a5b4fc',
                          }}
                        >
                          {cementLabel}
                        </button>,
                      );
                    }

                    // 3. House build / extend with selected floor items + selectedCard
                    const selectedFloorItemArray = Array.from(selectedFloorItemIds);
                    const matchingBuild = legalMoves.find(
                      (m): m is Extract<SeepMove, { type: 'BUILD' | 'BUILD_HOUSE' }> => {
                        if (m.type !== 'BUILD' && m.type !== 'BUILD_HOUSE') return false;
                        if (m.handCardId !== selectedCardId) return false;
                        const floorIds = 'floorItemIds' in m ? m.floorItemIds : m.floorCardIds;
                        if ('extendHouseId' in m && m.extendHouseId) {
                          return selectedFloorItemIds.has(m.extendHouseId);
                        }
                        if (floorIds.length !== selectedFloorItemArray.length) return false;
                        return selectedFloorItemArray.every((id) => floorIds.includes(id));
                      },
                    );
                    if (matchingBuild) {
                      const isExtend = 'extendHouseId' in matchingBuild && !!matchingBuild.extendHouseId;
                      const targetHouse = isExtend
                        ? gameState.floor.houses.find(
                            (h) => h.id === (matchingBuild as { extendHouseId?: string }).extendHouseId,
                          )
                        : undefined;
                      const origVal = targetHouse?.buildValue ?? selectedFloorSum;
                      const isOpponent = targetHouse && targetHouse.ownerTeamIndex !== bottomPlayer?.teamIndex;
                      const floorIds =
                        'floorItemIds' in matchingBuild ? matchingBuild.floorItemIds : matchingBuild.floorCardIds;
                      const floorCards = floorIds
                        .map((id) => gameState.floor.looseCards.find((c) => c.id === id))
                        .filter(Boolean);
                      const floorNames = floorCards.map((c) => c!.rank + c!.suit).join(', ');
                      const floorSum = floorCards.reduce((s, c) => s + getCardNumericValue(c!), 0);
                      const isCemented =
                        selectedHandCardVal === matchingBuild.targetValue ||
                        (selectedHandCardVal ?? 0) + floorSum >= matchingBuild.targetValue * 2;

                      const label = isExtend
                        ? `🔨 Break House ${origVal} (${isOpponent ? 'Opponent' : 'Your'}) → Rebuild to House ${matchingBuild.targetValue} with ${selectedCard.rank}${selectedCard.suit}`
                        : `🏠 Build House of ${matchingBuild.targetValue} (${selectedCard.rank}${selectedCard.suit} + ${floorNames}) ${isCemented ? '🔒 (Cemented)' : ''}`;
                      buttons.push(
                        <button
                          key="dyn-bld"
                          onClick={() => {
                            onMove(matchingBuild);
                            setSelectedCardId(null);
                            clearFloorSelection();
                          }}
                          style={{
                            background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                            color: '#fff',
                            padding: '8px 20px',
                            borderRadius: 14,
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            boxShadow: '0 0 20px rgba(217, 119, 6, 0.8)',
                            border: '2px solid #fde047',
                          }}
                        >
                          {label}
                        </button>,
                      );
                    }

                    if (buttons.length === 0) return null;
                    return <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{buttons}</div>;
                  })()}

                {/* When table items (e.g. House 11) are selected, show quick pick buttons for matching hand cards */}
                {!selectedCard &&
                  selectedFloorItemIds.size > 0 &&
                  (() => {
                    const matchingCaptureMoves = legalMoves.filter(
                      (m): m is Extract<SeepMove, { type: 'CAPTURE' }> => {
                        if (m.type !== 'CAPTURE') return false;
                        const hCard = humanHand.find((c) => c.id === m.handCardId);
                        if (!hCard) return false;
                        return getCardNumericValue(hCard) === selectedFloorSum;
                      },
                    );

                    const matchingCementMoves = legalMoves.filter(
                      (m): m is Extract<SeepMove, { type: 'CEMENT_HOUSE' }> =>
                        m.type === 'CEMENT_HOUSE' && selectedFloorItemIds.has(m.houseId),
                    );

                    const matchingExtendMoves = legalMoves.filter(
                      (m): m is Extract<SeepMove, { type: 'BUILD' }> =>
                        m.type === 'BUILD' && !!m.extendHouseId && selectedFloorItemIds.has(m.extendHouseId),
                    );

                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {matchingCaptureMoves.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: '0.78rem', color: '#6ee7b7', fontWeight: 600 }}>Pick:</span>
                            {matchingCaptureMoves.map((cap, idx) => {
                              const hCard = humanHand.find((c) => c.id === cap.handCardId);
                              if (!hCard) return null;
                              return (
                                <button
                                  key={`q-cap-${idx}`}
                                  onClick={() => {
                                    onMove(cap);
                                    setSelectedCardId(null);
                                    clearFloorSelection();
                                  }}
                                  style={{
                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                    color: '#fff',
                                    padding: '5px 12px',
                                    borderRadius: 10,
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    border: '1px solid #6ee7b7',
                                  }}
                                >
                                  🃏 {hCard.rank}{hCard.suit}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {matchingCementMoves.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: '0.78rem', color: '#a5b4fc', fontWeight: 600 }}>Contribute:</span>
                            {matchingCementMoves.map((cem, idx) => {
                              const hCard = humanHand.find((c) => c.id === cem.handCardId);
                              if (!hCard) return null;
                              return (
                                <button
                                  key={`q-cem-${idx}`}
                                  onClick={() => {
                                    onMove(cem);
                                    setSelectedCardId(null);
                                    clearFloorSelection();
                                  }}
                                  style={{
                                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                    color: '#fff',
                                    padding: '5px 12px',
                                    borderRadius: 10,
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    border: '1px solid #a5b4fc',
                                  }}
                                >
                                  🔒 {hCard.rank}{hCard.suit}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {matchingExtendMoves.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: '0.78rem', color: '#fde047', fontWeight: 600 }}>Break / Rebuild:</span>
                            {matchingExtendMoves.map((bld, idx) => {
                              const hCard = humanHand.find((c) => c.id === bld.handCardId);
                              if (!hCard) return null;
                              return (
                                <button
                                  key={`q-ext-${idx}`}
                                  onClick={() => {
                                    onMove(bld);
                                    setSelectedCardId(null);
                                    clearFloorSelection();
                                  }}
                                  style={{
                                    background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                                    color: '#fff',
                                    padding: '5px 12px',
                                    borderRadius: 10,
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                    cursor: 'pointer',
                                    border: '1px solid #fde047',
                                  }}
                                >
                                  🔨 {hCard.rank}{hCard.suit} → House {bld.targetValue}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                {/* Standard Legal Move Buttons for the Selected Hand Card */}
                {selectedCard &&
                  (() => {
                    const captures = legalMoves.filter(
                      (m): m is Extract<SeepMove, { type: 'CAPTURE' }> =>
                        m.type === 'CAPTURE' && m.handCardId === selectedCardId,
                    );
                    const builds = legalMoves.filter(
                      (m): m is Extract<SeepMove, { type: 'BUILD' | 'BUILD_HOUSE' }> =>
                        (m.type === 'BUILD' || m.type === 'BUILD_HOUSE') && m.handCardId === selectedCardId,
                    );
                    const cements = legalMoves.filter(
                      (m): m is Extract<SeepMove, { type: 'CEMENT_HOUSE' }> =>
                        m.type === 'CEMENT_HOUSE' && m.handCardId === selectedCardId,
                    );
                    const trailMove = legalMoves.find(
                      (m): m is Extract<SeepMove, { type: 'TRAIL' | 'THROW' }> =>
                        (m.type === 'TRAIL' || m.type === 'THROW') && m.cardId === selectedCardId,
                    );

                    const hasActions =
                      captures.length > 0 || builds.length > 0 || cements.length > 0 || !!trailMove;

                    if (!hasActions) {
                      return (
                        <span style={{ fontSize: '0.8rem', color: '#fca5a5' }}>
                          No legal actions for this card
                        </span>
                      );
                    }

                    return (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {/* 1. CAPTURE Moves */}
                        {captures.map((cap, idx) => {
                          const targetHouses = gameState.floor.houses.filter(
                            (h) => cap.capturedHouseIds?.includes(h.id) || cap.itemIds?.includes(h.id),
                          );
                          const houseNames = targetHouses.map((h) => `House ${h.buildValue}`).join(', ');
                          const itemCount =
                            cap.itemIds?.length ??
                            (cap.capturedLooseCardIds?.length ?? 0) + (cap.capturedHouseIds?.length ?? 0);

                          const totalFloorItemsCount =
                            gameState.floor.items?.length ??
                            (gameState.floor.looseCards.length + gameState.floor.houses.length);
                          const isFullClear = itemCount === totalFloorItemsCount && totalFloorItemsCount > 0;
                          const ownTeam = bottomPlayer ? gameState.teams[bottomPlayer.teamIndex] : undefined;
                          const hasOppActiveSeeps = gameState.teams.some(
                            (t) => t.teamIndex !== bottomPlayer?.teamIndex && t.activeSeeps > 0,
                          );
                          const isThirdSeepRisk =
                            gameState.ruleset.thirdSeepDownsBoth &&
                            isFullClear &&
                            (ownTeam?.activeSeeps ?? 0) >= 2 &&
                            !hasOppActiveSeeps;

                          const captureLabel = isThirdSeepRisk
                            ? `⚠️ Clear Floor (3rd Seep Downs Both Seeps!)`
                            : houseNames
                            ? `🃏 Capture ${houseNames}`
                            : `🃏 Capture (${itemCount} item${itemCount > 1 ? 's' : ''})`;

                          return (
                            <button
                              key={`cap-${idx}`}
                              onClick={() => {
                                onMove(cap);
                                setSelectedCardId(null);
                                clearFloorSelection();
                              }}
                              onMouseEnter={() =>
                                setHoveredMoveItemIds(
                                  new Set(
                                    cap.itemIds ?? [
                                      ...(cap.capturedLooseCardIds ?? []),
                                      ...(cap.capturedHouseIds ?? []),
                                    ],
                                  ),
                                )
                              }
                              onMouseLeave={() => setHoveredMoveItemIds(new Set())}
                              style={{
                                background: isThirdSeepRisk
                                  ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
                                  : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                color: '#fff',
                                padding: '6px 16px',
                                borderRadius: 14,
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                boxShadow: isThirdSeepRisk
                                  ? '0 4px 12px rgba(220, 38, 38, 0.4)'
                                  : '0 4px 12px rgba(16, 185, 129, 0.4)',
                                border: isThirdSeepRisk ? '1px solid #fca5a5' : 'none',
                              }}
                            >
                              {captureLabel}
                            </button>
                          );
                        })}

                        {/* 2. CEMENT / CONTRIBUTE Moves */}
                        {cements.map((cem, idx) => {
                          const targetHouse = gameState.floor.houses.find((h) => h.id === cem.houseId);
                          const houseVal = targetHouse?.buildValue ?? '?';
                          const isOwn = targetHouse?.ownerTeamIndex === bottomPlayer?.teamIndex;
                          const ownerStr = isOwn ? 'Your House' : "Opponent's House";
                          const addCards = (cem.additionalFloorCardIds ?? [])
                            .map((id) => gameState.floor.looseCards.find((c) => c.id === id))
                            .filter(Boolean);
                          const addNames = addCards.map((c) => c!.rank + c!.suit).join(', ');
                          const label =
                            addCards.length > 0
                              ? `🔒 Contribute ${selectedCard?.rank}${selectedCard?.suit} + floor cards (${addNames}) to House ${houseVal} (${ownerStr})`
                              : `🔒 Contribute ${selectedCard?.rank}${selectedCard?.suit} to House ${houseVal} (${ownerStr})`;
                          return (
                            <button
                              key={`cem-${idx}`}
                              onClick={() => {
                                onMove(cem);
                                setSelectedCardId(null);
                                clearFloorSelection();
                              }}
                              onMouseEnter={() =>
                                setHoveredMoveItemIds(
                                  new Set([cem.houseId, ...(cem.additionalFloorCardIds ?? [])]),
                                )
                              }
                              onMouseLeave={() => setHoveredMoveItemIds(new Set())}
                              style={{
                                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                                color: '#fff',
                                padding: '6px 16px',
                                borderRadius: 14,
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
                                border: 'none',
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}

                        {/* 3. BUILD / EXTEND Moves */}
                        {builds.map((b, idx) => {
                          const targetVal = b.targetValue;
                          const floorIds = 'floorItemIds' in b ? b.floorItemIds : b.floorCardIds;
                          const isExtend = 'extendHouseId' in b && !!b.extendHouseId;
                          const targetHouse = isExtend
                            ? gameState.floor.houses.find(
                                (h) => h.id === (b as { extendHouseId?: string }).extendHouseId,
                              )
                            : undefined;
                          const origVal = targetHouse?.buildValue;
                          const isOpponent =
                            targetHouse && targetHouse.ownerTeamIndex !== bottomPlayer?.teamIndex;
                          const floorCards = floorIds
                            .map((id) => gameState.floor.looseCards.find((c) => c.id === id))
                            .filter(Boolean);
                          const floorNames = floorCards.map((c) => c!.rank + c!.suit).join(', ');
                          const floorSum = floorCards.reduce((s, c) => s + getCardNumericValue(c!), 0);
                          const isCemented =
                            selectedHandCardVal === targetVal ||
                            (selectedHandCardVal ?? 0) + floorSum >= targetVal * 2;

                          const label = isExtend
                            ? `🔨 Break House ${origVal} (${isOpponent ? 'Opponent' : 'Your'}) → Rebuild to House ${targetVal}`
                            : floorNames
                            ? `🏠 Build House of ${targetVal} with ${floorNames}${isCemented ? ' (Cemented 🔒)' : ''}`
                            : `🏠 Build House of ${targetVal}`;
                          return (
                            <button
                              key={`bld-${idx}`}
                              onClick={() => {
                                onMove(b);
                                setSelectedCardId(null);
                                clearFloorSelection();
                              }}
                              onMouseEnter={() => setHoveredMoveItemIds(new Set(floorIds))}
                              onMouseLeave={() => setHoveredMoveItemIds(new Set())}
                              style={{
                                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                                color: '#fff',
                                padding: '6px 16px',
                                borderRadius: 14,
                                fontWeight: 700,
                                fontSize: '0.82rem',
                                cursor: 'pointer',
                                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.4)',
                                border: 'none',
                              }}
                            >
                              {label}
                            </button>
                          );
                        })}

                        {/* 4. TRAIL Move */}
                        {trailMove && (
                          <button
                            onClick={() => {
                              onMove(trailMove);
                              setSelectedCardId(null);
                              clearFloorSelection();
                            }}
                            style={{
                              background: 'rgba(255, 255, 255, 0.1)',
                              color: '#e2e8f0',
                              padding: '6px 16px',
                              borderRadius: 14,
                              fontWeight: 600,
                              fontSize: '0.82rem',
                              border: '1px solid rgba(255, 255, 255, 0.2)',
                              cursor: 'pointer',
                            }}
                          >
                            ⬇️ Throw {selectedCard?.rank}{selectedCard?.suit} on Table
                          </button>
                        )}
                      </div>
                    );
                  })()}
              </div>
            )}
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
              ? `${currentPlayer?.name ?? 'Bot'} is thinking...`
              : `Waiting for ${currentPlayer?.name ?? 'next player'}...`}
          </div>
        )}
      </div>

      {/* 3. DEDICATED PLAYER HAND CONSOLE */}
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.88)',
          backdropFilter: 'blur(16px)',
          border: isHumanTurn
            ? '2px solid rgba(16, 185, 129, 0.65)'
            : '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 14,
          padding: '6px 14px',
          boxShadow: isHumanTurn
            ? '0 0 24px rgba(16, 185, 129, 0.25), 0 6px 20px rgba(0,0,0,0.6)'
            : '0 6px 20px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          width: '100%',
          transition: 'all 0.3s ease',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            paddingBottom: 6,
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {renderSeat(bottomPlayer, 'bottom')}
          <span
            style={{
              color: isHumanTurn ? '#10b981' : '#94a3b8',
              fontWeight: 700,
              fontSize: '0.85rem',
            }}
          >
            {isHumanTurn ? '👉 Your Turn to Play!' : 'Waiting for opponents...'}
          </span>
        </div>

        <CardFan
          cards={bottomPlayer?.hand ?? []}
          selectedCardIds={selectedCardId ? [selectedCardId] : []}
          maxSelectable={1}
          onCardClick={handleHandCardClick}
          disabled={!isHumanTurn}
        />
      </div>
    </div>
  );
};
