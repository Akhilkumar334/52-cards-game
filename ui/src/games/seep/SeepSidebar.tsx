import React, { useEffect, useRef } from 'react';
import type { SeepTeam } from '@cards/engine';

export interface SeepSidebarProps {
  teams: readonly SeepTeam[];
  targetScore: number;
  looseCount: number;
  houseCount: number;
  log: readonly string[];
  botThinkingText?: string | null;
  botThinkingPlayerName?: string | null;
}

export const SeepSidebar: React.FC<SeepSidebarProps> = ({
  teams,
  targetScore,
  looseCount,
  houseCount,
  log,
  botThinkingText,
  botThinkingPlayerName,
}) => {
  const chatScrollRef = useRef<HTMLDivElement>(null);

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
      {/* Target & Match Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 8,
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <span style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
          Target: {targetScore} Points
        </span>
        <span
          style={{
            fontSize: '0.75rem',
            background: 'rgba(56, 189, 248, 0.15)',
            color: '#38bdf8',
            padding: '2px 8px',
            borderRadius: 6,
            fontWeight: 700,
          }}
        >
          100 Pts / Hand
        </span>
      </div>

      {/* Teams Scoring & Seep Indicators */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {teams.map((team, idx) => {
          const progress = Math.min(100, Math.round((team.totalScore / targetScore) * 100));
          const isUserTeam = idx === 0;
          const themeColor = isUserTeam ? '#3b82f6' : idx === 1 ? '#ef4444' : '#10b981';
          const themeBg = isUserTeam
            ? 'rgba(59, 130, 246, 0.08)'
            : idx === 1
            ? 'rgba(239, 68, 68, 0.08)'
            : 'rgba(16, 185, 129, 0.08)';

          return (
            <div
              key={team.teamIndex}
              style={{
                background: themeBg,
                border: `1px solid ${themeColor}44`,
                borderRadius: 10,
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: isUserTeam ? '#60a5fa' : '#f87171' }}>
                  {isUserTeam ? '🔵 ' : '🔴 '} {team.name}
                </span>
                <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc' }}>
                  {team.totalScore} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>pts</span>
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#cbd5e1' }}>
                <span>Hand: {team.roundScore} pts</span>
                <span>{team.capturedCards.length} cards</span>
              </div>

              {/* Seep Indicators: Permanent, Active, Downed */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                {team.permanentSeep && (
                  <span
                    style={{
                      background: 'rgba(234, 179, 8, 0.25)',
                      border: '1px solid #facc15',
                      color: '#fef08a',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 6,
                    }}
                  >
                    🌟 Permanent Seep
                  </span>
                )}
                {team.activeSeeps > 0 && (
                  <span
                    style={{
                      background: 'rgba(56, 189, 248, 0.2)',
                      border: '1px solid #38bdf8',
                      color: '#bae6fd',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 6,
                    }}
                  >
                    ⚡ {team.activeSeeps} Active Seep{team.activeSeeps > 1 ? 's' : ''}
                  </span>
                )}
                {team.downedSeeps > 0 && (
                  <span
                    style={{
                      background: 'rgba(239, 68, 68, 0.2)',
                      border: '1px solid #f87171',
                      color: '#fca5a5',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 6,
                    }}
                  >
                    💥 {team.downedSeeps} Downed
                  </span>
                )}
                {!team.permanentSeep && team.activeSeeps === 0 && team.downedSeeps === 0 && (
                  <span style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic' }}>
                    0 Seeps
                  </span>
                )}
              </div>

              {/* Progress Bar */}
              <div
                style={{
                  width: '100%',
                  height: 6,
                  background: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: 3,
                  overflow: 'hidden',
                  marginTop: 2,
                }}
              >
                <div
                  style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: isUserTeam
                      ? 'linear-gradient(90deg, #3b82f6, #60a5fa)'
                      : 'linear-gradient(90deg, #ef4444, #f87171)',
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Table Floor Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: '0.72rem', textTransform: 'uppercase' }}>
            Loose Cards
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginTop: 2 }}>
            {looseCount}
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ color: '#94a3b8', fontSize: '0.72rem', textTransform: 'uppercase' }}>
            Built Houses
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8', marginTop: 2 }}>
            {houseCount}
          </div>
        </div>
      </div>

      {/* Live Match Commentary Log */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          background: 'rgba(0, 0, 0, 0.35)',
          borderRadius: 10,
          border: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '8px 10px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            fontSize: '0.75rem',
            color: '#94a3b8',
            fontWeight: 700,
            textTransform: 'uppercase',
            marginBottom: 6,
            letterSpacing: '0.04em',
          }}
        >
          Match Commentary
        </div>

        <div
          ref={chatScrollRef}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
            paddingRight: 4,
          }}
        >
          {log.map((entry, idx) => (
            <div
              key={idx}
              style={{
                fontSize: '0.78rem',
                color: entry.includes('SEEP')
                  ? '#fde047'
                  : entry.includes('TAKEDOWN')
                  ? '#f87171'
                  : entry.includes('bid')
                  ? '#38bdf8'
                  : '#cbd5e1',
                fontWeight: entry.includes('SEEP') || entry.includes('TAKEDOWN') ? 700 : 400,
                lineHeight: 1.35,
              }}
            >
              {entry}
            </div>
          ))}

          {botThinkingText && (
            <div
              style={{
                fontSize: '0.78rem',
                color: '#38bdf8',
                fontStyle: 'italic',
                animation: 'pulseGlow 1.5s infinite alternate',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>💭</span>
              <span>
                {botThinkingPlayerName ? `${botThinkingPlayerName}: ` : ''}
                {botThinkingText}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
