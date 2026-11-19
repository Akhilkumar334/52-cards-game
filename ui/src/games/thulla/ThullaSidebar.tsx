import React, { useEffect, useRef } from 'react';
import type { Suit } from '@cards/engine';

export interface ThullaSidebarProps {
  ledSuit: Suit | null;
  trickNumber: number;
  burnedCount: number;
  activePlayerCount: number;
  escapedPlayers: readonly { playerId: string; name: string; position: number }[];
  log: readonly string[];
  botThinkingText?: string | null;
  botThinkingPlayerName?: string | null;
}

const SUIT_DISPLAY: Record<Suit, { symbol: string; name: string; color: string }> = {
  S: { symbol: '♠', name: 'Spades', color: '#cbd5e1' },
  H: { symbol: '♥', name: 'Hearts', color: '#ef4444' },
  D: { symbol: '♦', name: 'Diamonds', color: '#ef4444' },
  C: { symbol: '♣', name: 'Clubs', color: '#cbd5e1' },
};

export const ThullaSidebar: React.FC<ThullaSidebarProps> = ({
  ledSuit,
  trickNumber,
  burnedCount,
  activePlayerCount,
  escapedPlayers,
  log,
  botThinkingText,
  botThinkingPlayerName,
}) => {
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest log message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [log, botThinkingText]);

  const suitInfo = ledSuit ? SUIT_DISPLAY[ledSuit] : null;

  return (
    <div
      className="glass-panel"
      style={{
        width: 270,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        fontSize: '0.82rem',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '6px 8px',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Led Suit
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: suitInfo ? suitInfo.color : '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            {suitInfo ? (
              <>
                <span>{suitInfo.symbol}</span>
                <span style={{ fontSize: '0.85rem', color: '#f8fafc' }}>{suitInfo.name}</span>
              </>
            ) : (
              <span style={{ fontSize: '0.8rem', fontStyle: 'italic', color: '#64748b' }}>Waiting Lead</span>
            )}
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '6px 8px',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Trick / Burned
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#38bdf8', marginTop: 2 }}>
            #{trickNumber + 1} <span style={{ fontSize: '0.74rem', color: '#94a3b8', fontWeight: 500 }}>({burnedCount} burned)</span>
          </div>
        </div>
      </div>

      {/* Escaped Players Podium */}
      {escapedPlayers.length > 0 && (
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 8,
            padding: '6px 10px',
          }}
        >
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
            🏆 Escaped Players ({escapedPlayers.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {escapedPlayers.map((p) => {
              const medal = p.position === 1 ? '🥇' : p.position === 2 ? '🥈' : '🥉';
              return (
                <div key={p.playerId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                  <span style={{ color: '#f8fafc', fontWeight: 600 }}>
                    {medal} {p.name}
                  </span>
                  <span style={{ color: '#10b981', fontSize: '0.72rem', fontWeight: 700 }}>
                    #{p.position} Place
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Live Table Broadcast & Chat Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 4 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#94a3b8',
            fontSize: '0.72rem',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          <span>Live Match Commentary</span>
          <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            {activePlayerCount} active
          </span>
        </div>

        <div
          ref={chatScrollRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            background: 'rgba(0, 0, 0, 0.3)',
            borderRadius: 8,
            padding: '8px 10px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {log.map((entry, idx) => {
            const isThulla = entry.includes('THULLA') || entry.includes('💥');
            const isEscape = entry.includes('escaped') || entry.includes('🏆');
            const isClean = entry.includes('won the trick');
            return (
              <div
                key={idx}
                style={{
                  fontSize: '0.8rem',
                  lineHeight: 1.4,
                  padding: '4px 6px',
                  borderRadius: 4,
                  background: isThulla
                    ? 'rgba(239, 68, 68, 0.15)'
                    : isEscape
                    ? 'rgba(16, 185, 129, 0.15)'
                    : isClean
                    ? 'rgba(56, 189, 248, 0.08)'
                    : 'transparent',
                  borderLeft: isThulla
                    ? '3px solid #ef4444'
                    : isEscape
                    ? '3px solid #10b981'
                    : isClean
                    ? '3px solid #38bdf8'
                    : '3px solid transparent',
                  color: isThulla ? '#fca5a5' : isEscape ? '#86efac' : '#cbd5e1',
                }}
              >
                {entry}
              </div>
            );
          })}

          {/* Bot Thinking Live Indicator */}
          {botThinkingText && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                background: 'rgba(59, 130, 246, 0.12)',
                borderLeft: '3px solid #3b82f6',
                borderRadius: 4,
                color: '#93c5fd',
                fontSize: '0.8rem',
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#60a5fa',
                  animation: 'pulse 1s infinite alternate',
                }}
              />
              <div>
                <strong style={{ color: '#bfdbfe' }}>{botThinkingPlayerName ?? 'Bot'}:</strong>{' '}
                <span style={{ fontStyle: 'italic' }}>{botThinkingText}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
