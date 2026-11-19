import React, { useState } from 'react';
import { useRoomStore } from '../../network/useRoomStore';

export const RoomBanner: React.FC = () => {
  const { room, localPlayer, leaveRoom, restartGame } = useRoomStore();
  const [copied, setCopied] = useState(false);

  if (!room || !localPlayer) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const humanCount = room.seats.filter((s) => s.player && !s.player.isBot).length;
  const botCount = room.seats.filter((s) => s.player && s.player.isBot).length;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 1140,
        margin: '0 auto 8px auto',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(212, 175, 55, 0.25)',
        borderRadius: 10,
        padding: '6px 14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* Left: Room & Player Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.9rem' }}>🌐</span>
          <span
            style={{
              fontWeight: 800,
              color: '#60a5fa',
              fontFamily: 'monospace',
              fontSize: '0.95rem',
              letterSpacing: '0.05em',
            }}
          >
            {room.code}
          </span>
          <button
            onClick={handleCopyCode}
            title="Copy room code"
            style={{
              background: 'transparent',
              color: copied ? '#4ade80' : '#94a3b8',
              fontSize: '0.72rem',
              padding: '2px 5px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 4,
            }}
          >
            {copied ? '✓ Copied' : '📋'}
          </button>
        </div>

        <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>|</span>

        {/* Local player badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem' }}>
          <span>{localPlayer.avatar}</span>
          <span style={{ fontWeight: 700, color: '#facc15' }}>{localPlayer.name}</span>
          <span
            style={{
              fontSize: '0.7rem',
              background: 'rgba(245, 197, 66, 0.2)',
              color: '#facc15',
              padding: '1px 6px',
              borderRadius: 10,
              fontWeight: 600,
            }}
          >
            Seat {localPlayer.seatIndex + 1}
          </span>
        </div>

        <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>|</span>

        {/* Roster Badge */}
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', gap: 8 }}>
          <span>👥 {humanCount} Human{humanCount !== 1 ? 's' : ''}</span>
          <span>🤖 {botCount} Bot{botCount !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {localPlayer.isHost && (
          <button
            onClick={() => restartGame()}
            style={{
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#6ee7b7',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            🔄 Next Round
          </button>
        )}

        <button
          onClick={leaveRoom}
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#f87171',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: '0.75rem',
            fontWeight: 600,
          }}
        >
          🚪 Leave Room
        </button>
      </div>
    </div>
  );
};
