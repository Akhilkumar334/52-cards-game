import React, { useEffect, useRef } from 'react';
import type { Rank } from '@cards/engine';

export interface ScorePanelProps {
  currentRank: Rank;
  pileCount: number;
  turnNumber: number;
  log: readonly string[];
  botThinkingText?: string | null;
  botThinkingPlayerName?: string | null;
}

const RANK_CYCLE: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];

export const ScorePanel: React.FC<ScorePanelProps> = ({
  currentRank,
  pileCount,
  turnNumber,
  log,
  botThinkingText,
  botThinkingPlayerName,
}) => {
  const currentRankIdx = RANK_CYCLE.indexOf(currentRank);
  const nextRank = RANK_CYCLE[(currentRankIdx + 1) % RANK_CYCLE.length]!;
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [log, botThinkingText]);

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
      {/* Game State Metrics */}
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
            Current Rank
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#facc15', marginTop: 1 }}>
            {currentRank === 'T' ? '10' : currentRank}
            <span style={{ fontSize: '0.68rem', color: '#94a3b8', marginLeft: 4, fontWeight: 400 }}>
              (Next: {nextRank === 'T' ? '10' : nextRank})
            </span>
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
            Pile Cards
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8', marginTop: 1 }}>
            {pileCount}
          </div>
        </div>
      </div>

      {/* Activity / Chat Log */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minHeight: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: '#94a3b8',
            fontSize: '0.72rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            paddingBottom: 3,
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#e2e8f0', fontWeight: 600 }}>
            <span>💬</span> Table Chat & Moves
          </span>
          <span>Turn #{turnNumber}</span>
        </div>

        {/* Chat Stream Window — Fills the whole area left below the message box */}
        <div
          ref={chatScrollRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            background: 'rgba(0, 0, 0, 0.35)',
            borderRadius: 8,
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            fontSize: '0.78rem',
            lineHeight: 1.35,
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          {log.length === 0 ? (
            <div style={{ color: '#64748b', fontStyle: 'italic', padding: 8 }}>
              Dealing cards... game starting!
            </div>
          ) : (
            log.map((entry, idx) => {
              const isBluffAlert = entry.includes('BLUFF!') || entry.includes('CAUGHT') || entry.includes('lying');
              const isWin = entry.includes('wins') || entry.includes('🏆');
              const isClear = entry.includes('Table cleared') || entry.includes('🧹');
              const isPlay = entry.includes('plays') || entry.includes('placed');
              const isPass = entry.includes('does not challenge') || entry.includes('passes');

              let badgeColor = '#64748b';
              let badgeBg = 'rgba(255, 255, 255, 0.05)';
              let borderLeft = '3px solid rgba(255, 255, 255, 0.1)';

              if (isBluffAlert) {
                badgeColor = '#ef4444';
                badgeBg = 'rgba(239, 68, 68, 0.15)';
                borderLeft = '3px solid #ef4444';
              } else if (isWin) {
                badgeColor = '#10b981';
                badgeBg = 'rgba(16, 185, 129, 0.15)';
                borderLeft = '3px solid #10b981';
              } else if (isClear) {
                badgeColor = '#a855f7';
                badgeBg = 'rgba(168, 85, 247, 0.15)';
                borderLeft = '3px solid #a855f7';
              } else if (isPlay) {
                badgeColor = '#facc15';
                badgeBg = 'rgba(250, 204, 21, 0.1)';
                borderLeft = '3px solid #facc15';
              } else if (isPass) {
                badgeColor = '#94a3b8';
                badgeBg = 'rgba(255, 255, 255, 0.04)';
                borderLeft = '3px solid #64748b';
              }

              return (
                <div
                  key={idx}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    background: badgeBg,
                    borderLeft,
                    color: '#f1f5f9',
                    fontSize: '0.78rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  }}
                >
                  <div style={{ color: badgeColor, fontWeight: 600, marginBottom: 2 }}>
                    {isBluffAlert ? '🚨 Bluff Alert' : isPlay ? '🃏 Card Move' : isClear ? '🧹 Table Swept' : 'ℹ️ Table Event'}
                  </div>
                  <div>{entry}</div>
                </div>
              );
            })
          )}

          {/* Real-time bot thinking bubble like a chat typing indicator */}
          {botThinkingText && (
            <div
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: 'rgba(56, 189, 248, 0.12)',
                borderLeft: '3px solid #38bdf8',
                color: '#38bdf8',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.8rem',
                fontWeight: 500,
                animation: 'pulseGlow 1.8s infinite',
              }}
            >
              <div style={{ display: 'flex', gap: 3 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#38bdf8', animation: 'typingDot 1.4s infinite 0s' }} />
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#38bdf8', animation: 'typingDot 1.4s infinite 0.2s' }} />
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#38bdf8', animation: 'typingDot 1.4s infinite 0.4s' }} />
              </div>
              <span>
                <strong>{botThinkingPlayerName ?? 'Bot'}</strong>: {botThinkingText}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
