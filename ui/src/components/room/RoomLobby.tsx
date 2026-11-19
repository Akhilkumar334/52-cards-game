import React, { useState } from 'react';
import { useRoomStore } from '../../network/useRoomStore';

export const RoomLobby: React.FC = () => {
  const {
    room,
    localPlayer,
    chatMessages,
    claimSeat,
    toggleBotSeat,
    startGame,
    sendChatMessage,
    leaveRoom,
  } = useRoomStore();

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [chatInput, setChatInput] = useState('');

  // Start game slot completion prompt state
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptType, setPromptType] = useState<'seep' | 'single' | 'partial' | null>(null);

  if (!room || !localPlayer) return null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${room.code}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput.trim());
    setChatInput('');
  };

  const handleQuickReaction = (text: string) => {
    sendChatMessage(text);
  };

  const isHost = localPlayer.isHost;
  const gameTitles: Record<string, string> = {
    bluff: '🃏 Bluff (Cheat)',
    thulla: '⚡ Thulla (Bhabhi)',
    seep: '🏰 Seep (Sweep)',
  };

  const seatedCount = room.seats.filter((s) => s.player !== null).length;
  const emptyCount = 4 - seatedCount;

  const handleStartGameClick = () => {
    // If all 4 slots are filled, start immediately
    if (seatedCount === 4) {
      startGame(false);
      return;
    }

    // Seep requires exactly 4 players (compulsory partnership)
    if (room.game === 'seep') {
      setPromptType('seep');
      setShowPromptModal(true);
      return;
    }

    // Bluff and Thulla:
    if (seatedCount === 1) {
      setPromptType('single');
      setShowPromptModal(true);
      return;
    }

    // 2 or 3 players: host chooses whether to play with current players or add bots
    setPromptType('partial');
    setShowPromptModal(true);
  };

  return (
    <div
      style={{
        maxWidth: 980,
        margin: '0 auto',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {/* Top Banner / Room Header */}
      <div
        className="glass-panel"
        style={{
          padding: '20px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          border: '1px solid rgba(212, 175, 55, 0.3)',
          background:
            'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.5rem' }}>🌐</span>
            <span
              style={{
                fontSize: '1.7rem',
                fontWeight: 800,
                color: '#60a5fa',
                letterSpacing: '0.08em',
                fontFamily: 'monospace',
              }}
            >
              {room.code}
            </span>
            <span
              style={{
                fontSize: '0.8rem',
                padding: '3px 9px',
                borderRadius: 12,
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#6ee7b7',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                fontWeight: 700,
              }}
            >
              🟢 Waiting for Players ({seatedCount}/4)
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              color: '#94a3b8',
              fontSize: '0.85rem',
            }}
          >
            <span>
              Game: <strong style={{ color: '#facc15' }}>{gameTitles[room.game] || room.game}</strong>
            </span>
            <span>•</span>
            <span>
              Host: <strong style={{ color: '#fff' }}>{room.seats[0]?.player?.name || 'You'}</strong>
            </span>
          </div>
        </div>

        {/* Share buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleCopyCode}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              color: copiedCode ? '#4ade80' : '#e2e8f0',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {copiedCode ? '✓ Copied Code!' : '📋 Copy Code'}
          </button>
          <button
            onClick={handleCopyLink}
            style={{
              background: 'rgba(59, 130, 246, 0.2)',
              color: copiedLink ? '#4ade80' : '#93c5fd',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {copiedLink ? '✓ Copied Link!' : '🔗 Copy Invite Link'}
          </button>
        </div>
      </div>

      {/* Main Grid: Seats (Left) & Chat/Activity (Right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20 }}>
        {/* Left: Table Seats */}
        <div
          className="glass-panel"
          style={{
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4
              style={{
                color: '#facc15',
                fontSize: '1rem',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>🪑</span> Table Seats (4 Seats)
            </h4>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              {emptyCount > 0 ? `${emptyCount} empty slot${emptyCount > 1 ? 's' : ''}` : 'Table Full'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {room.seats.map((seat) => {
              const occupant = seat.player;
              const isLocal = occupant?.id === localPlayer.id;

              return (
                <div
                  key={seat.seatIndex}
                  style={{
                    background: isLocal
                      ? 'rgba(245, 197, 66, 0.1)'
                      : occupant
                      ? 'rgba(255, 255, 255, 0.04)'
                      : 'rgba(255, 255, 255, 0.01)',
                    border: isLocal
                      ? '1px solid #facc15'
                      : occupant
                      ? '1px solid rgba(255, 255, 255, 0.12)'
                      : '1px dashed rgba(255, 255, 255, 0.15)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    position: 'relative',
                    minHeight: 110,
                  }}
                >
                  {/* Seat Header */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: '#94a3b8',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                      }}
                    >
                      Seat {seat.seatIndex + 1}
                    </span>
                    {occupant?.isHost && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          background: 'rgba(245, 197, 66, 0.25)',
                          color: '#facc15',
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontWeight: 700,
                        }}
                      >
                        👑 Host
                      </span>
                    )}
                    {isLocal && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          background: 'rgba(59, 130, 246, 0.25)',
                          color: '#60a5fa',
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontWeight: 700,
                        }}
                      >
                        You
                      </span>
                    )}
                  </div>

                  {/* Player Info */}
                  {occupant ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: '1.6rem' }}>{occupant.avatar}</span>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#f8fafc' }}>
                          {occupant.name}
                        </span>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            color: occupant.isBot ? '#93c5fd' : '#4ade80',
                          }}
                        >
                          {occupant.isBot ? '🤖 AI Bot' : '🟢 Ready'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: 0.6 }}>
                      <span style={{ fontSize: '1.6rem' }}>🪑</span>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>
                          Empty Seat
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          Waiting for player...
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Seat Actions */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                    {!isLocal && (!occupant || occupant.isBot) && (
                      <button
                        onClick={() => claimSeat(seat.seatIndex)}
                        style={{
                          flex: 1,
                          background: 'rgba(59, 130, 246, 0.2)',
                          color: '#93c5fd',
                          border: '1px solid rgba(59, 130, 246, 0.4)',
                          padding: '5px 8px',
                          borderRadius: 6,
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Sit Here
                      </button>
                    )}

                    {isHost && !isLocal && (
                      <button
                        onClick={() => toggleBotSeat(seat.seatIndex)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#cbd5e1',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          padding: '5px 8px',
                          borderRadius: 6,
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {seat.isBot ? '- Remove Bot' : '+ Add Bot'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: '0.75rem',
              color: '#94a3b8',
              lineHeight: 1.4,
            }}
          >
            {room.game === 'seep' ? (
              <span>
                ℹ️ <strong>Seep Rule:</strong> Seep requires strictly 4 players for 2v2 partnership.
                If any seats remain empty when you start, you will be prompted to add bots to complete the 4 seats.
              </span>
            ) : (
              <span>
                ℹ️ <strong>{room.game === 'bluff' ? 'Bluff' : 'Thulla'} Rule:</strong> You can play
                with only the human players who joined (2 or 3 players), or choose to fill remaining
                empty slots with bots when you start!
              </span>
            )}
          </div>
        </div>

        {/* Right: Live Chat & Activity Stream */}
        <div
          className="glass-panel"
          style={{
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            height: 380,
          }}
        >
          <h4
            style={{
              color: '#facc15',
              fontSize: '1rem',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>💬</span> Room Chat & Log
          </h4>

          {/* Messages Container */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              paddingRight: 4,
            }}
          >
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  background: msg.isSystem
                    ? 'rgba(59, 130, 246, 0.1)'
                    : 'rgba(255, 255, 255, 0.04)',
                  border: msg.isSystem
                    ? '1px solid rgba(59, 130, 246, 0.25)'
                    : '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 6,
                }}
              >
                <span>{msg.senderAvatar}</span>
                <span style={{ fontWeight: 700, color: msg.isSystem ? '#93c5fd' : '#facc15' }}>
                  {msg.senderName}:
                </span>
                <span style={{ color: '#e2e8f0', wordBreak: 'break-word' }}>{msg.text}</span>
              </div>
            ))}
          </div>

          {/* Quick Reactions */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['👋 Hey!', '🃏 Ready to play!', '🔥 Deal cards!', '⏳ Waiting for 1 more!'].map((rx) => (
              <button
                key={rx}
                onClick={() => handleQuickReaction(rx)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#cbd5e1',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 12,
                  padding: '3px 8px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                }}
              >
                {rx}
              </button>
            ))}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendChat} style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Send message to room..."
              style={{
                flex: 1,
                background: '#0f172a',
                border: '1px solid #334155',
                color: '#fff',
                padding: '7px 10px',
                borderRadius: 6,
                fontSize: '0.82rem',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              style={{
                background: chatInput.trim() ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)',
                color: chatInput.trim() ? '#fff' : '#64748b',
                padding: '7px 14px',
                borderRadius: 6,
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Send
            </button>
          </form>
        </div>
      </div>

      {/* Bottom Actions Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <button
          onClick={leaveRoom}
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            color: '#f87171',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          🚪 Leave Room
        </button>

        {isHost ? (
          <button
            onClick={handleStartGameClick}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              padding: '10px 24px',
              borderRadius: 8,
              fontSize: '1rem',
              fontWeight: 800,
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
              cursor: 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            🚀 Start Game & Deal 52 Cards
          </button>
        ) : (
          <div
            style={{
              color: '#93c5fd',
              fontSize: '0.88rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>⏳</span> Waiting for Host (
            {room.seats.find((s) => s.player?.isHost)?.player?.name || 'Host'}) to start the match...
          </div>
        )}
      </div>

      {/* Start Game Prompt Modal for Empty Slots */}
      {showPromptModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 150,
            padding: 16,
          }}
          onClick={() => setShowPromptModal(false)}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: 480,
              width: '100%',
              padding: 26,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              border: '1px solid rgba(212, 175, 55, 0.35)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 25px rgba(212, 175, 55, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {promptType === 'seep' ? (
              /* Case 1: Seep 4-player compulsion */
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.6rem' }}>🏰</span>
                  <h3 style={{ margin: 0, color: '#10b981', fontSize: '1.25rem' }}>
                    Seep Requires 4 Players
                  </h3>
                </div>

                <p style={{ margin: 0, fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                  In Seep, there is a strict compulsion that <strong>exactly 4 players</strong> must be at
                  the table to form 2v2 partnership teams.
                </p>

                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    padding: '10px 14px',
                    borderRadius: 8,
                    fontSize: '0.82rem',
                    color: '#a7f3d0',
                  }}
                >
                  Currently <strong>{seatedCount} of 4</strong> seats are occupied. Would you like to
                  complete the table by adding <strong>{emptyCount} AI Bot{emptyCount > 1 ? 's' : ''}</strong>?
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => {
                      setShowPromptModal(false);
                      startGame(true); // Fill empty with bots
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#fff',
                      padding: '11px',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: '0.92rem',
                      cursor: 'pointer',
                    }}
                  >
                    🤖 Add {emptyCount} Bot{emptyCount > 1 ? 's' : ''} & Start Seep
                  </button>

                  <button
                    onClick={() => setShowPromptModal(false)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: '#cbd5e1',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      padding: '9px',
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    ⏳ Keep Waiting for Players
                  </button>
                </div>
              </>
            ) : promptType === 'single' ? (
              /* Case 2: Only 1 player in Bluff / Thulla */
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.6rem' }}>🃏</span>
                  <h3 style={{ margin: 0, color: '#facc15', fontSize: '1.25rem' }}>
                    Need at Least 2 Players
                  </h3>
                </div>

                <p style={{ margin: 0, fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                  You are currently the only player at the table (<strong>{localPlayer.name}</strong>). Card games require at least 2 players to play.
                </p>

                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.1)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    padding: '10px 14px',
                    borderRadius: 8,
                    fontSize: '0.82rem',
                    color: '#fde68a',
                  }}
                >
                  Would you like to complete the table by adding 3 AI Bots to start playing right away?
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                  <button
                    onClick={() => {
                      setShowPromptModal(false);
                      startGame(true); // Fill empty with bots
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#fff',
                      padding: '11px',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: '0.92rem',
                      cursor: 'pointer',
                    }}
                  >
                    🤖 Fill Table with 3 Bots & Start
                  </button>

                  <button
                    onClick={() => setShowPromptModal(false)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: '#cbd5e1',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      padding: '9px',
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    ⏳ Keep Waiting for Friends
                  </button>
                </div>
              </>
            ) : (
              /* Case 3: 2 or 3 players in Bluff / Thulla */
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '1.6rem' }}>👥</span>
                  <h3 style={{ margin: 0, color: '#60a5fa', fontSize: '1.25rem' }}>
                    Start Match with Open Slots?
                  </h3>
                </div>

                <p style={{ margin: 0, fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                  You have <strong>{seatedCount} players</strong> at the table:{' '}
                  <span style={{ color: '#facc15' }}>
                    {room.seats
                      .filter((s) => s.player)
                      .map((s) => s.player!.name)
                      .join(', ')}
                  </span>
                  . {emptyCount} seat{emptyCount > 1 ? 's are' : ' is'} currently open.
                </p>

                <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
                  How would you like to play?
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
                  {/* Option 1: Start with ONLY players in room */}
                  <button
                    onClick={() => {
                      setShowPromptModal(false);
                      startGame(false); // Only players currently in room!
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                      color: '#fff',
                      padding: '11px',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: '0.92rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <span>👥</span>
                    <span>Play with Current {seatedCount} Players Only (No Bots)</span>
                  </button>

                  {/* Option 2: Add bots to fill empty slots */}
                  <button
                    onClick={() => {
                      setShowPromptModal(false);
                      startGame(true); // Fill empty with bots
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#fff',
                      padding: '11px',
                      borderRadius: 8,
                      fontWeight: 700,
                      fontSize: '0.92rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <span>🤖</span>
                    <span>Fill Remaining {emptyCount} Slot{emptyCount > 1 ? 's' : ''} with Bots & Start</span>
                  </button>

                  {/* Option 3: Keep waiting */}
                  <button
                    onClick={() => setShowPromptModal(false)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: '#cbd5e1',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      padding: '9px',
                      borderRadius: 8,
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    ⏳ Keep Waiting for More Players
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
