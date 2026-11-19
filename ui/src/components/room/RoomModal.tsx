import React, { useState, useEffect } from 'react';
import type { GameType } from '../../network/types';
import { useRoomStore } from '../../network/useRoomStore';

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialGame?: GameType;
  initialCode?: string;
}

const AVATARS = ['🤠', '🎩', '🦊', '🦁', '🐯', '🐼', '🦹', '🧙'];

export const RoomModal: React.FC<RoomModalProps> = ({
  isOpen,
  onClose,
  initialGame = 'bluff',
  initialCode = '',
}) => {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [selectedGame, setSelectedGame] = useState<GameType>(initialGame);
  const [playerName, setPlayerName] = useState(() => {
    return localStorage.getItem('52cards_player_name') || 'Player 1';
  });
  const [selectedAvatar, setSelectedAvatar] = useState(() => {
    return localStorage.getItem('52cards_player_avatar') || '🤠';
  });
  const [joinCodeInput, setJoinCodeInput] = useState(initialCode);

  const { createRoom, joinRoom } = useRoomStore();

  useEffect(() => {
    if (initialCode) {
      setTab('join');
      setJoinCodeInput(initialCode);
    }
  }, [initialCode]);

  useEffect(() => {
    setSelectedGame(initialGame);
  }, [initialGame]);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = playerName.trim() || 'Player 1';
    localStorage.setItem('52cards_player_name', finalName);
    localStorage.setItem('52cards_player_avatar', selectedAvatar);

    // Generate room code only upon clicking Create Table
    const generatedCode = `${selectedGame.toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
    createRoom(selectedGame, finalName, selectedAvatar, generatedCode, 4, false);
    onClose();
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    const finalName = playerName.trim() || 'Player 2';
    localStorage.setItem('52cards_player_name', finalName);
    localStorage.setItem('52cards_player_avatar', selectedAvatar);

    joinRoom(joinCodeInput.trim(), finalName, selectedAvatar);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 120,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: 480,
          width: '100%',
          padding: '24px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          border: '1px solid rgba(212, 175, 55, 0.3)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 25px rgba(212, 175, 55, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.4rem' }}>🌐</span>
            <h3
              style={{
                fontSize: '1.25rem',
                fontFamily: 'var(--font-serif)',
                color: '#facc15',
                letterSpacing: '0.03em',
                margin: 0,
              }}
            >
              Multiplayer Room
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              color: '#94a3b8',
              fontSize: '1.2rem',
              padding: '4px 8px',
              borderRadius: 6,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 8,
            padding: 3,
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <button
            type="button"
            onClick={() => setTab('create')}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 6,
              fontSize: '0.85rem',
              fontWeight: 700,
              background:
                tab === 'create'
                  ? 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)'
                  : 'transparent',
              color: tab === 'create' ? '#fff' : '#94a3b8',
            }}
          >
            Create Table
          </button>
          <button
            type="button"
            onClick={() => setTab('join')}
            style={{
              flex: 1,
              padding: '8px 0',
              borderRadius: 6,
              fontSize: '0.85rem',
              fontWeight: 700,
              background:
                tab === 'join'
                  ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                  : 'transparent',
              color: tab === 'join' ? '#fff' : '#94a3b8',
            }}
          >
            Join Table
          </button>
        </div>

        {/* Shared Player Profile Settings */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 8,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 600 }}>
                Your Name:
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={18}
                placeholder="Enter your name"
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  padding: '7px 10px',
                  borderRadius: 6,
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
              <label style={{ fontSize: '0.75rem', color: '#cbd5e1', fontWeight: 600 }}>
                Avatar:
              </label>
              <div
                style={{
                  fontSize: '1.6rem',
                  background: '#1e293b',
                  padding: '2px 8px',
                  borderRadius: 6,
                  border: '1px solid #475569',
                }}
              >
                {selectedAvatar}
              </div>
            </div>
          </div>

          {/* Avatar Picker Bar */}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
            {AVATARS.map((av) => (
              <button
                type="button"
                key={av}
                onClick={() => setSelectedAvatar(av)}
                style={{
                  background:
                    selectedAvatar === av
                      ? 'rgba(245, 197, 66, 0.3)'
                      : 'rgba(255, 255, 255, 0.05)',
                  border:
                    selectedAvatar === av
                      ? '1px solid #facc15'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 6,
                  fontSize: '1.1rem',
                  padding: '3px 6px',
                  cursor: 'pointer',
                  transform: selectedAvatar === av ? 'scale(1.15)' : 'none',
                }}
              >
                {av}
              </button>
            ))}
          </div>
        </div>

        {tab === 'create' ? (
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Game Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600 }}>
                Choose Game:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {[
                  { id: 'bluff' as GameType, name: 'Bluff', icon: '🃏', color: '#f59e0b' },
                  { id: 'thulla' as GameType, name: 'Thulla', icon: '⚡', color: '#3b82f6' },
                  { id: 'seep' as GameType, name: 'Seep', icon: '🏰', color: '#10b981' },
                ].map((g) => (
                  <button
                    type="button"
                    key={g.id}
                    onClick={() => setSelectedGame(g.id)}
                    style={{
                      background:
                        selectedGame === g.id
                          ? `linear-gradient(135deg, ${g.color}33 0%, ${g.color}11 100%)`
                          : 'rgba(255, 255, 255, 0.04)',
                      border:
                        selectedGame === g.id
                          ? `1px solid ${g.color}`
                          : '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: 8,
                      padding: '8px 4px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>{g.icon}</span>
                    <span
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: selectedGame === g.id ? '#fff' : '#94a3b8',
                      }}
                    >
                      {g.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Waiting Room Flow Notice */}
            <div
              style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                borderRadius: 8,
                padding: '10px 12px',
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>ℹ️</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: '0.78rem', color: '#93c5fd', fontWeight: 600 }}>
                  Room Code generated on creation
                </span>
                <span style={{ fontSize: '0.73rem', color: '#94a3b8', lineHeight: 1.4 }}>
                  Your unique room code will be generated once you click below. You will enter the Waiting Lobby to invite friends. If seats remain empty when you decide to start, you will be prompted whether to add bots.
                </span>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              style={{
                background: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)',
                color: '#fff',
                padding: '12px',
                borderRadius: 8,
                fontSize: '0.95rem',
                fontWeight: 700,
                boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)',
                marginTop: 2,
                cursor: 'pointer',
              }}
            >
              🚀 Create Table & Get Room Code
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: '0.78rem', color: '#cbd5e1', fontWeight: 600 }}>
                Enter Room Code:
              </label>
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="e.g. BLUFF-784"
                style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  color: '#60a5fa',
                  padding: '10px 14px',
                  borderRadius: 6,
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textAlign: 'center',
                }}
              />
            </div>

            <div
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                padding: '10px 12px',
                borderRadius: 6,
                color: '#93c5fd',
                fontSize: '0.78rem',
                lineHeight: 1.4,
              }}
            >
              💡 <strong>Instant Multi-Tab / Multi-Device:</strong> Open this app in another window or tab, join with this room code, and both players will sit at the same live table in real time!
            </div>

            <button
              type="submit"
              disabled={!joinCodeInput.trim()}
              style={{
                background: joinCodeInput.trim()
                  ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                  : 'rgba(255, 255, 255, 0.08)',
                color: joinCodeInput.trim() ? '#fff' : '#64748b',
                padding: '11px',
                borderRadius: 8,
                fontSize: '0.95rem',
                fontWeight: 700,
                boxShadow: joinCodeInput.trim() ? '0 4px 15px rgba(59, 130, 246, 0.4)' : 'none',
                marginTop: 4,
              }}
            >
              🎯 Join Table
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
