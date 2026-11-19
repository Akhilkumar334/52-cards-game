import React from 'react';
import type { PlayerId } from '@cards/engine';

export interface PlayerSeatProps {
  id: PlayerId;
  name: string;
  isBot: boolean;
  isHuman: boolean;
  isCurrentTurn: boolean;
  cardCount: number;
  statusBadge?: string;
  actionBubble?: {
    text: string;
    type: 'think' | 'play' | 'pass' | 'challenge' | 'thulla';
  };
  isWinner?: boolean;
  position: 'bottom' | 'top' | 'left' | 'right';
}

export function getPlayerSeatPosition(
  playerIdx: number,
  humanIdx: number,
  totalPlayers: number = 4,
): 'bottom' | 'left' | 'top' | 'right' {
  if (humanIdx === -1) {
    const pos = ['bottom', 'left', 'top', 'right'] as const;
    return pos[playerIdx % totalPlayers] ?? 'bottom';
  }
  const offset = (playerIdx - humanIdx + totalPlayers) % totalPlayers;
  if (totalPlayers === 2) {
    return offset === 0 ? 'bottom' : 'top';
  }
  if (totalPlayers === 3) {
    if (offset === 0) return 'bottom';
    if (offset === 1) return 'left';
    return 'top';
  }
  if (offset === 0) return 'bottom';
  if (offset === 1) return 'left';
  if (offset === 2) return 'top';
  if (offset === 3) return 'right';
  return 'top';
}

export const PlayerSeat: React.FC<PlayerSeatProps> = ({
  name,
  isBot,
  isHuman,
  isCurrentTurn,
  cardCount,
  statusBadge,
  actionBubble,
  isWinner,
  position,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: position === 'bottom' ? 'row' : position === 'top' ? 'column-reverse' : 'column',
        alignItems: 'center',
        gap: 10,
        userSelect: 'none',
        zIndex: 10,
      }}
    >
      {/* Avatar Container */}
      <div
        style={{
          position: 'relative',
          width: 58,
          height: 58,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isHuman
            ? 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)'
            : 'linear-gradient(135deg, #334155 0%, #0f172a 100%)',
          border: isCurrentTurn
            ? '3px solid #facc15'
            : isWinner
              ? '3px solid #10b981'
              : '2px solid rgba(255, 255, 255, 0.2)',
          boxShadow: isCurrentTurn
            ? '0 0 24px rgba(250, 204, 21, 0.8), 0 4px 12px rgba(0,0,0,0.5)'
            : '0 4px 12px rgba(0,0,0,0.4)',
          transition: 'all 0.3s ease',
          animation: isCurrentTurn ? 'pulseGlow 2s infinite' : undefined,
        }}
      >
        {/* Floating Action / Speech Bubble */}
        {actionBubble && (
          <div
            style={{
              position: 'absolute',
              top: position === 'top' ? '50%' : -36,
              bottom: 'auto',
              left: position === 'top' ? '100%' : 'auto',
              marginLeft: position === 'top' ? 10 : 0,
              transform: position === 'top' ? 'translateY(-50%)' : 'none',
              background:
                actionBubble.type === 'challenge'
                  ? 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
                  : actionBubble.type === 'thulla'
                    ? 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)'
                    : actionBubble.type === 'play'
                      ? 'linear-gradient(135deg, #10b981 0%, #047857 100%)'
                      : actionBubble.type === 'pass'
                        ? 'rgba(30, 41, 59, 0.95)'
                        : 'rgba(14, 165, 233, 0.95)',
              color: '#fff',
              padding: '4px 10px',
              borderRadius: 14,
              fontSize: '0.78rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              boxShadow:
                actionBubble.type === 'challenge' || actionBubble.type === 'thulla'
                  ? '0 0 16px rgba(239, 68, 68, 0.8), 0 4px 12px rgba(0,0,0,0.6)'
                  : '0 4px 12px rgba(0,0,0,0.4)',
              zIndex: 50,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              border: '1.5px solid rgba(255, 255, 255, 0.3)',
              pointerEvents: 'none',
            }}
          >
            <span>{actionBubble.text}</span>
          </div>
        )}

        <span style={{ fontSize: '1.4rem' }}>
          {isWinner ? '👑' : isHuman ? '🤠' : '🤖'}
        </span>

        {/* Card count pill */}
        <div
          style={{
            position: 'absolute',
            bottom: -6,
            right: -6,
            background: cardCount === 0 ? '#10b981' : cardCount <= 2 ? '#ef4444' : '#1e293b',
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 999,
            border: '2px solid #0f172a',
            boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
          }}
          title={`${cardCount} cards remaining`}
        >
          {cardCount}
        </div>
      </div>

      {/* Name and Tag */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: position === 'bottom' ? 'flex-start' : 'center',
          gap: 2,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              fontSize: '0.85rem',
              fontWeight: 600,
              color: isCurrentTurn ? '#facc15' : '#e2e8f0',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            }}
          >
            {name}
          </span>
          {isHuman && (
            <span
              style={{
                fontSize: '0.65rem',
                backgroundColor: 'rgba(245, 158, 11, 0.25)',
                color: '#fcd34d',
                padding: '1px 5px',
                borderRadius: 4,
                fontWeight: 600,
              }}
            >
              YOU
            </span>
          )}
        </div>

        {statusBadge && (
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              color: '#38bdf8',
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
              padding: '1px 8px',
              borderRadius: 8,
              border: '1px solid rgba(56, 189, 248, 0.3)',
            }}
          >
            {statusBadge}
          </span>
        )}
      </div>
    </div>
  );
};
