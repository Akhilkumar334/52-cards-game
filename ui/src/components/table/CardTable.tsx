import { Card } from '../shared/Card';
import type { BluffGameState } from '@cards/engine';
import { CardThrowOverlay, type CardThrowAction } from './CardThrowOverlay';

export interface CardTableProps {
  gameState: BluffGameState;
  humanPlayerId: string;
  topSeat?: React.ReactNode;
  leftSeat?: React.ReactNode;
  rightSeat?: React.ReactNode;
  bottomSeat?: React.ReactNode;
  actionsBar?: React.ReactNode;
  activeThrowAction?: CardThrowAction | null;
}

export const CardTable: React.FC<CardTableProps> = ({
  gameState,
  topSeat,
  leftSeat,
  rightSeat,
  bottomSeat,
  actionsBar,
  activeThrowAction,
}) => {
  const pileCount = gameState.pile.length;
  const lastPlay = gameState.lastPlay;

  // Render a visual stack of cards in the pile with slight organic rotations
  const pileCardsToRender = Math.min(pileCount, 8);

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
      {/* 1. TOP FELT ARENA (Opponents & Center Pile) */}
      <div
        className="felt-arena-responsive"
        style={{
          position: 'relative',
          width: '100%',
          height: 295,
          borderRadius: 155,
          background: 'radial-gradient(ellipse at center, #134e3a 0%, #062b1e 75%, #041c13 100%)',
          border: '8px solid #29180c',
          outline: '2px solid #d4af37',
          boxShadow:
            'inset 0 0 50px rgba(0, 0, 0, 0.8), 0 12px 35px rgba(0, 0, 0, 0.6), 0 0 18px rgba(212, 175, 55, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '8px 20px',
        }}
      >
        {/* Table Felt Subtle Inner Ring */}
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            right: 6,
            bottom: 6,
            borderRadius: 147,
            border: '1px solid rgba(212, 175, 55, 0.15)',
            pointerEvents: 'none',
          }}
        />

        {/* Card Throw & Eating Animation Overlay */}
        <CardThrowOverlay action={activeThrowAction ?? null} />

        {/* Top Seat Area */}
        <div style={{ display: 'flex', justifyContent: 'center', minHeight: 46 }}>
          {topSeat}
        </div>

        {/* Middle Row (Left Seat, Center Pile, Right Seat) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flex: 1,
            padding: '0 8px',
          }}
        >
          <div style={{ width: 120, display: 'flex', justifyContent: 'center' }}>
            {leftSeat}
          </div>

          {/* Center Felt Area: Pile & Status */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minWidth: 320,
            }}
          >
            {/* Active Round & Last Play Declaration Banner */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              {lastPlay ? (
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(245, 197, 66, 0.6)',
                    padding: '6px 18px',
                    borderRadius: 20,
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span>{gameState.players[lastPlay.playerIndex]?.name} played</span>
                  <span style={{ color: '#facc15', fontWeight: 800 }}>
                    {lastPlay.cardCount} {lastPlay.declaredRank === 'T' ? '10' : lastPlay.declaredRank}
                    {lastPlay.cardCount > 1 ? "'s" : ''}
                  </span>
                </div>
              ) : (
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    padding: '4px 14px',
                    borderRadius: 16,
                    color: '#94a3b8',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}
                >
                  {gameState.canLeadRank ? '👑 Waiting for round leader' : `Round Rank: ${gameState.currentRank}`}
                </div>
              )}

              {/* Turn returned to last player after all opponents skipped */}
              {gameState.lastPlayedPlayerIndex !== null &&
                gameState.currentPlayerIndex === gameState.lastPlayedPlayerIndex &&
                gameState.pile.length > 0 && (
                  <div
                    style={{
                      background: 'rgba(34, 197, 94, 0.2)',
                      border: '1px solid rgba(74, 222, 128, 0.5)',
                      padding: '3px 14px',
                      borderRadius: 14,
                      color: '#86efac',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>🎉</span>
                    <span>
                      All opponents skipped!{' '}
                      <strong style={{ color: '#fff' }}>
                        {gameState.players[gameState.lastPlayedPlayerIndex]?.name}
                      </strong>{' '}
                      can play more or Skip to clear table
                    </span>
                  </div>
                )}

              {/* Consecutive passes indicator (while opponents are skipping) */}
              {gameState.consecutivePasses > 0 &&
                gameState.pile.length > 0 &&
                gameState.currentPlayerIndex !== gameState.lastPlayedPlayerIndex && (
                  <div
                    style={{
                      background: 'rgba(234, 179, 8, 0.18)',
                      border: '1px solid rgba(234, 179, 8, 0.4)',
                      padding: '2px 10px',
                      borderRadius: 12,
                      color: '#fde047',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                    }}
                  >
                    ⏭ {gameState.consecutivePasses} / {gameState.players.length - 1} opponents skipped
                  </div>
                )}
            </div>

            {/* Pile of Cards */}
            <div
              className="table-center-pile"
              style={{
                position: 'relative',
                width: 60,
                height: 84,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {pileCount === 0 ? (
                <div
                  style={{
                    width: 56,
                    height: 80,
                    borderRadius: 6,
                    border: '2px dashed rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255, 255, 255, 0.3)',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  Empty
                </div>
              ) : (
                Array.from({ length: pileCardsToRender }).map((_, i) => {
                  const rot = ((i * 17) % 25) - 12;
                  const offsetX = ((i * 7) % 11) - 5;
                  const offsetY = ((i * 5) % 9) - 4;
                  return (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        transform: `translate(${offsetX}px, ${offsetY}px) rotate(${rot}deg)`,
                        zIndex: i + 1,
                      }}
                    >
                      <Card faceDown size="sm" />
                    </div>
                  );
                })
              )}

              {pileCount > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    zIndex: 20,
                    background: 'rgba(0, 0, 0, 0.85)',
                    color: '#facc15',
                    padding: '3px 9px',
                    borderRadius: 12,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    border: '1px solid rgba(250, 204, 21, 0.4)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
                  }}
                >
                  {pileCount} {pileCount === 1 ? 'card' : 'cards'}
                </div>
              )}
            </div>
          </div>

          <div style={{ width: 140, display: 'flex', justifyContent: 'center' }}>
            {rightSeat}
          </div>
        </div>
      </div>

      {/* 2. ACTION CONTROLS BAR (Show, Play, Pass) */}
      {actionsBar && (
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', zIndex: 30 }}>
          {actionsBar}
        </div>
      )}

      {/* 3. PLAYER HAND CONSOLE (Your Cards & Status) */}
      <div style={{ width: '100%', zIndex: 20 }}>
        {bottomSeat}
      </div>
    </div>
  );
};
