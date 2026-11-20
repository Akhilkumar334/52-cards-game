import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ThullaEngine,
  DEFAULT_THULLA_RULESET,
  getRankPower,
  type ThullaGameState,
  type ThullaMove,
  type ThullaRuleset,
  type PlayerConfig,
  type ThullaTrickCard,
} from '@cards/engine';
import { ThullaBot } from '@cards/bots';
import { ThullaTable, type ResolvingTrick } from './ThullaTable';
import { ThullaSidebar } from './ThullaSidebar';
import { Card } from '../../components/shared/Card';
import { type CardThrowAction } from '../../components/table/CardThrowOverlay';
import { getPlayerSeatPosition } from '../../components/table/PlayerSeat';

// Synthesize casino card sounds via Web Audio API
class SoundFx {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playCardSnap() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch {}
  }

  // Crazy dramatic punch / bass boom / slap sound for Thulla
  playThullaSlap() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // 1. Deep sub-bass boom
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(160, now);
      osc1.frequency.exponentialRampToValueAtTime(32, now + 0.55);
      gain1.gain.setValueAtTime(0.45, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
      osc1.connect(gain1);
      gain1.connect(this.ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.55);

      // 2. High crack / whip slap
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(750, now);
      osc2.frequency.exponentialRampToValueAtTime(90, now + 0.22);
      gain2.gain.setValueAtTime(0.35, now);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
      osc2.connect(gain2);
      gain2.connect(this.ctx.destination);
      osc2.start(now);
      osc2.stop(now + 0.22);
    } catch {}
  }

  playEscape() {
    try {
      this.init();
      if (!this.ctx) return;
      const notes = [329.63, 440.0, 554.37, 659.25];
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.09);
        gain.gain.setValueAtTime(0.2, this.ctx.currentTime + idx * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + idx * 0.09 + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + idx * 0.09);
        osc.stop(this.ctx.currentTime + idx * 0.09 + 0.35);
      });
    } catch {}
  }

  playDealSwoosh() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(500, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, this.ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.05);
    } catch {}
  }
}

const sfx = new SoundFx();

const DEFAULT_PLAYERS: PlayerConfig[] = [
  { id: 'player-human', name: 'You', isBot: false },
  { id: 'bot-1', name: 'Karan (Bot)', isBot: true },
  { id: 'bot-2', name: 'Priya (Bot)', isBot: true },
  { id: 'bot-3', name: 'Rohan (Bot)', isBot: true },
];

export const ThullaPage: React.FC = () => {
  const [ruleset, setRuleset] = useState<ThullaRuleset>(DEFAULT_THULLA_RULESET);
  const [gameState, setGameState] = useState<ThullaGameState>(() =>
    ThullaEngine.createGame(DEFAULT_THULLA_RULESET, DEFAULT_PLAYERS, Date.now()),
  );
  const [isProcessingBot, setIsProcessingBot] = useState(false);
  const [botThinkingText, setBotThinkingText] = useState<string | null>(null);
  const [botThinkingPlayerName, setBotThinkingPlayerName] = useState<string | null>(null);
  const [isDealingAnimation, setIsDealingAnimation] = useState(true);
  const [showRulesetModal, setShowRulesetModal] = useState(false);
  const [showMobileLog, setShowMobileLog] = useState(false);

  // Crazy Thulla animation state and Trick resolution preservation
  const [resolvingTrick, setResolvingTrick] = useState<ResolvingTrick | null>(null);
  const [crazyThullaActive, setCrazyThullaActive] = useState(false);
  const [playerActionBubbles, setPlayerActionBubbles] = useState<
    Record<string, { text: string; type: 'think' | 'play' | 'pass' | 'challenge' | 'thulla' }>
  >({});
  const [activeThrowAction, setActiveThrowAction] = useState<CardThrowAction | null>(null);

  // Instantiated bot controllers
  const botsRef = useRef<Map<string, ThullaBot>>(new Map());

  // Dealing animation
  const triggerDealAnimation = useCallback(() => {
    setIsDealingAnimation(true);
    let count = 0;
    const soundInterval = setInterval(() => {
      sfx.playDealSwoosh();
      count++;
      if (count > 6) clearInterval(soundInterval);
    }, 180);

    const timer = setTimeout(() => {
      setIsDealingAnimation(false);
      clearInterval(soundInterval);
    }, 1800);

    return () => {
      clearTimeout(timer);
      clearInterval(soundInterval);
    };
  }, []);

  useEffect(() => {
    triggerDealAnimation();
  }, [triggerDealAnimation]);

  const getBot = useCallback((id: string) => {
    let bot = botsRef.current.get(id);
    if (!bot) {
      bot = new ThullaBot({ seed: Math.floor(Math.random() * 1_000_000) });
      botsRef.current.set(id, bot);
    }
    return bot;
  }, []);

  const startNewGame = useCallback(
    (customRuleset?: ThullaRuleset) => {
      const activeRuleset = customRuleset ?? ruleset;
      botsRef.current.clear();
      const newSeed = Math.floor(Math.random() * 1_000_000);
      const initial = ThullaEngine.createGame(activeRuleset, DEFAULT_PLAYERS, newSeed);
      setGameState(initial);
      setResolvingTrick(null);
      setCrazyThullaActive(false);
      setActiveThrowAction(null);
      setPlayerActionBubbles({});
      setBotThinkingText(null);
      setBotThinkingPlayerName(null);
      triggerDealAnimation();
    },
    [ruleset, triggerDealAnimation],
  );

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const handleApplyMove = useCallback((move: ThullaMove) => {
    try {
      setGameState((prev) => {
        // Strict engine legality check: must be a legal move according to follow suit rules!
        const legalMoves = ThullaEngine.getLegalMoves(prev, move.playerId);
        const isLegal = legalMoves.some((m) => m.cardId === move.cardId);
        if (!isLegal) {
          console.warn(
            `[Thulla] Rejected illegal move: Player ${move.playerId} attempted ${move.cardId}. Table suit must be followed!`,
          );
          return prev;
        }

        const playerIndex = prev.players.findIndex((p) => p.id === move.playerId);
        const player = prev.players[playerIndex]!;
        const humanIndex = prev.players.findIndex((p) => p.id === 'player-human');
        const throwerPos = getPlayerSeatPosition(playerIndex, humanIndex, prev.players.length);
        const cardToPlay = player.hand.find((c) => c.id === move.cardId)!;

        // Check whether this move triggers a Thulla or finishes the trick
        const currentTrick = prev.currentTrick;
        const isOffSuit = currentTrick !== null && cardToPlay.suit !== currentTrick.ledSuit;

        // Calculate if trick will be completed by this move
        const remainingActive = prev.players.filter((p) => !p.hasEscaped && p.hand.length > 0);
        const cardsInTrickCount = currentTrick ? currentTrick.cards.length + 1 : 1;
        const isTrickComplete = !isOffSuit && currentTrick !== null && cardsInTrickCount >= remainingActive.length;

        // 1. THULLA HIT TRIGGERED!
        if (isOffSuit && currentTrick !== null) {
          sfx.playThullaSlap();
          setCrazyThullaActive(true);

          const newCardEntry: ThullaTrickCard = {
            playerId: player.id,
            playerIndex,
            card: cardToPlay,
            isThulla: true,
          };
          const fullTrickCards = [...currentTrick.cards, newCardEntry];
          const penaltyPlayer = prev.players[currentTrick.highestPlayerIndex]!;
          const penaltyPos = getPlayerSeatPosition(currentTrick.highestPlayerIndex, humanIndex, prev.players.length);

          // Show action bubbles on table
          setPlayerActionBubbles({
            [player.id]: { text: `💥 THULLA (${cardToPlay.rank}${cardToPlay.suit})`, type: 'thulla' },
            [penaltyPlayer.id]: { text: `🤦 Takes ${fullTrickCards.length} cards`, type: 'thulla' },
          });

          // Trigger throwing and eating overlay animation
          setActiveThrowAction({
            id: String(Date.now()),
            throwerName: player.name,
            throwerAvatar: player.id === 'player-human' ? '🤠' : '🤖',
            throwerPosition: throwerPos,
            cards: [cardToPlay],
            actionText: `💥 Hit THULLA with ${cardToPlay.rank}${cardToPlay.suit}!`,
            isEating: true,
            eaterName: penaltyPlayer.name,
            eaterPosition: penaltyPos,
            eaterTitle: `🤦 ${penaltyPlayer.name} EATS all ${fullTrickCards.length} penalty cards!`,
            eatenCards: fullTrickCards.map((tc) => tc.card),
            phase: 'throwing',
          });

          setTimeout(() => {
            setActiveThrowAction((act) => (act ? { ...act, phase: 'eating' } : null));
            setTimeout(() => {
              setActiveThrowAction((act) => (act ? { ...act, phase: 'vanishing' } : null));
              setTimeout(() => setActiveThrowAction(null), 450);
            }, 900);
          }, 350);

          // Phase 1: Freeze with all cards visible and crazy animation
          setResolvingTrick({
            cards: fullTrickCards,
            ledSuit: currentTrick.ledSuit,
            highestPlayerIndex: currentTrick.highestPlayerIndex,
            isThulla: true,
            thullaCard: newCardEntry,
            penaltyPlayerName: penaltyPlayer.name,
            phase: 'freeze',
          });

          // Phase 2: Start clearing cards animation at 1600ms
          setTimeout(() => {
            setResolvingTrick((r) => (r ? { ...r, phase: 'clearing' } : null));
          }, 1600);

          // Phase 3: Transition to next game state after animation at 2150ms
          setTimeout(() => {
            const next = ThullaEngine.applyMove(prev, move);
            setResolvingTrick(null);
            setCrazyThullaActive(false);
            setGameState(next);
            if (next.escapedPlayerIds.length > prev.escapedPlayerIds.length) {
              sfx.playEscape();
            }
          }, 2150);

          return prev; // Hold state while animating trick
        }

        // 2. CLEAN TRICK COMPLETION (All players followed suit)
        if (isTrickComplete && currentTrick !== null) {
          sfx.playCardSnap();

          const newCardEntry: ThullaTrickCard = {
            playerId: player.id,
            playerIndex,
            card: cardToPlay,
            isThulla: false,
          };
          const fullTrickCards = [...currentTrick.cards, newCardEntry];

          // Determine trick winner among cards of ledSuit
          let winningIdx = currentTrick.highestPlayerIndex;
          let highestPwr = getRankPower(fullTrickCards.find((c) => c.playerIndex === currentTrick.highestPlayerIndex)!.card.rank);
          const newCardPwr = getRankPower(cardToPlay.rank);
          if (newCardPwr > highestPwr) {
            winningIdx = playerIndex;
          }
          const winnerPlayer = prev.players[winningIdx]!;
          const winnerPos = getPlayerSeatPosition(winningIdx, humanIndex, prev.players.length);

          setPlayerActionBubbles({
            [winnerPlayer.id]: { text: `👑 Won Trick (${fullTrickCards.length} burned)`, type: 'play' },
          });

          // Trigger throwing & eating animation
          setActiveThrowAction({
            id: String(Date.now()),
            throwerName: player.name,
            throwerAvatar: player.id === 'player-human' ? '🤠' : '🤖',
            throwerPosition: throwerPos,
            cards: [cardToPlay],
            actionText: `throws ${cardToPlay.rank}${cardToPlay.suit}`,
            isEating: true,
            eaterName: winnerPlayer.name,
            eaterPosition: winnerPos,
            eaterTitle: `👑 ${winnerPlayer.name} EATS / WINS the trick (${fullTrickCards.length} cards)!`,
            eatenCards: fullTrickCards.map((tc) => tc.card),
            phase: 'throwing',
          });

          setTimeout(() => {
            setActiveThrowAction((act) => (act ? { ...act, phase: 'eating' } : null));
            setTimeout(() => {
              setActiveThrowAction((act) => (act ? { ...act, phase: 'vanishing' } : null));
              setTimeout(() => setActiveThrowAction(null), 450);
            }, 650);
          }, 350);

          // Phase 1: Freeze with 4th card displayed and winner highlighted
          setResolvingTrick({
            cards: fullTrickCards,
            ledSuit: currentTrick.ledSuit,
            highestPlayerIndex: winningIdx,
            isThulla: false,
            winnerPlayerName: winnerPlayer.name,
            phase: 'freeze',
          });

          // Phase 2: Animate cards burning into discard pile at 1200ms
          setTimeout(() => {
            setResolvingTrick((r) => (r ? { ...r, phase: 'clearing' } : null));
          }, 1200);

          // Phase 3: Complete transition to next state at 1750ms
          setTimeout(() => {
            const next = ThullaEngine.applyMove(prev, move);
            setResolvingTrick(null);
            setGameState(next);
            if (next.escapedPlayerIds.length > prev.escapedPlayerIds.length) {
              sfx.playEscape();
            }
          }, 1750);

          return prev; // Hold state while animating trick
        }

        // 3. Normal intermediate card play during trick
        sfx.playCardSnap();
        setPlayerActionBubbles((bubbles) => ({
          ...bubbles,
          [player.id]: { text: `🃏 Played ${cardToPlay.rank}${cardToPlay.suit}`, type: 'play' },
        }));

        setActiveThrowAction({
          id: String(Date.now()),
          throwerName: player.name,
          throwerAvatar: player.id === 'player-human' ? '🤠' : '🤖',
          throwerPosition: throwerPos,
          cards: [cardToPlay],
          actionText: `throws ${cardToPlay.rank}${cardToPlay.suit}`,
          phase: 'throwing',
        });
        setTimeout(() => {
          setActiveThrowAction(null);
        }, 550);

        const next = ThullaEngine.applyMove(prev, move);
        if (next.escapedPlayerIds.length > prev.escapedPlayerIds.length) {
          sfx.playEscape();
        }
        return next;
      });
    } catch (err) {
      console.error('Failed to apply Thulla move:', err);
    }
  }, []);

  // Bot Turn Loop
  useEffect(() => {
    if (isDealingAnimation || resolvingTrick !== null) return;
    if (ThullaEngine.isGameOver(gameState)) {
      setBotThinkingText(null);
      return;
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer || !currentPlayer.isBot || currentPlayer.hasEscaped) {
      setIsProcessingBot(false);
      setBotThinkingText(null);
      setBotThinkingPlayerName(null);
      return;
    }

    setIsProcessingBot(true);
    setBotThinkingPlayerName(currentPlayer.name);

    // Table thought bubble on the bot's avatar
    setPlayerActionBubbles((prev) => ({
      ...prev,
      [currentPlayer.id]: { text: '💭 Deciding card...', type: 'think' },
    }));

    // Initial thought
    if (!gameState.currentTrick) {
      setBotThinkingText('Leading trick: choosing safe low card...');
    } else {
      const suitName = gameState.currentTrick.ledSuit;
      setBotThinkingText(`Evaluating hand against ${suitName} lead...`);
    }

    // Mid-thought after 600ms
    const thoughtTimer = setTimeout(() => {
      if (!gameState.currentTrick) {
        setBotThinkingText('Checking cards to lead...');
      } else {
        const hasSuit = currentPlayer.hand.some((c) => c.suit === gameState.currentTrick?.ledSuit);
        if (hasSuit) {
          setBotThinkingText('Following suit safely...');
        } else {
          setBotThinkingText('💥 Off-suit available: preparing Thulla penalty!');
        }
      }
    }, 600);

    // Apply move after 1500ms
    const executeTimer = setTimeout(() => {
      try {
        const latestState = gameStateRef.current;
        if (
          ThullaEngine.isGameOver(latestState) ||
          latestState.currentPlayerIndex !== gameState.currentPlayerIndex
        ) {
          return;
        }

        const visibleState = ThullaEngine.getVisibleState(latestState, currentPlayer.id);
        const legalMoves = ThullaEngine.getLegalMoves(visibleState, currentPlayer.id);

        if (legalMoves.length > 0) {
          const bot = getBot(currentPlayer.id);
          const chosenMove = bot.chooseMove(visibleState, legalMoves);
          handleApplyMove(chosenMove);
        }
      } catch (e) {
        console.error('Bot turn failed:', e);
      } finally {
        setIsProcessingBot(false);
        setBotThinkingText(null);
        setBotThinkingPlayerName(null);
      }
    }, 1500);

    return () => {
      clearTimeout(thoughtTimer);
      clearTimeout(executeTimer);
    };
  }, [gameState, getBot, handleApplyMove, isDealingAnimation, resolvingTrick]);

  const activePlayers = gameState.players.filter((p) => !p.hasEscaped);
  const isGameOver = ThullaEngine.isGameOver(gameState);
  const bhabhiPlayer = gameState.bhabhiPlayerId
    ? gameState.players.find((p) => p.id === gameState.bhabhiPlayerId) ?? null
    : null;

  const escapedPlayers = gameState.escapedPlayerIds.map((id, idx) => ({
    playerId: id,
    name: gameState.players.find((p) => p.id === id)?.name ?? id,
    position: idx + 1,
  }));

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '4px 16px',
        maxWidth: 1440,
        margin: '0 auto',
        gap: 6,
        height: 'calc(100vh - 48px)',
        maxHeight: 'calc(100vh - 48px)',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Bar / Controls */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.25rem',
              color: '#38bdf8',
              letterSpacing: '0.02em',
              margin: 0,
            }}
          >
            ⚡ Thulla (Bhabhi)
          </h2>
          <span
            style={{
              fontSize: '0.72rem',
              color: '#94a3b8',
              background: 'rgba(255, 255, 255, 0.06)',
              padding: '2px 8px',
              borderRadius: 6,
            }}
          >
            Phase 2 Engine
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="mobile-log-toggle-btn"
            onClick={() => setShowMobileLog(!showMobileLog)}
            style={{
              background: showMobileLog ? '#0284c7' : 'rgba(255, 255, 255, 0.08)',
              color: '#fff',
              padding: '5px 10px',
              borderRadius: 8,
              fontSize: '0.78rem',
              fontWeight: 600,
              border: '1px solid rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              cursor: 'pointer',
            }}
          >
            <span>💬</span>
            <span>Log</span>
            <span style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 10, padding: '1px 5px', fontSize: '0.7rem' }}>
              {gameState.log.length}
            </span>
          </button>

          <button
            onClick={() => setShowRulesetModal(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#e2e8f0',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: '0.8rem',
              fontWeight: 600,
              border: '1px solid rgba(255, 255, 255, 0.15)',
              cursor: 'pointer',
            }}
          >
            ⚙️ Ruleset Config
          </button>
          <button
            onClick={() => startNewGame()}
            style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#fff',
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: '0.8rem',
              fontWeight: 700,
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
              cursor: 'pointer',
            }}
          >
            🔄 New Game
          </button>
        </div>
      </div>

      {/* Main Layout: Unclipped Table Arena + Live Sidebar */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          gap: 12,
          alignItems: 'stretch',
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Table Arena */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: 'relative' }}>
          {/* Card Distribution Dealing Overlay Animation */}
          {isDealingAnimation && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(5, 12, 24, 0.75)',
                backdropFilter: 'blur(5px)',
                zIndex: 90,
                borderRadius: 24,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <div style={{ position: 'relative', width: 90, height: 130 }}>
                {/* Central Deck Base */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    transform: 'translate(-3px, -3px)',
                    opacity: 0.4,
                  }}
                >
                  <Card faceDown size="md" />
                </div>
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                  }}
                >
                  <Card faceDown size="md" />
                </div>

                {/* Flying Card to Top Opponent */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    animation: 'dealFlyTop 0.8s ease-out infinite alternate',
                  }}
                >
                  <Card faceDown size="md" />
                </div>

                {/* Flying Card to Left Opponent */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    animation: 'dealFlyLeft 0.8s ease-out infinite alternate 0.2s',
                  }}
                >
                  <Card faceDown size="md" />
                </div>

                {/* Flying Card to Right Opponent */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    animation: 'dealFlyRight 0.8s ease-out infinite alternate 0.4s',
                  }}
                >
                  <Card faceDown size="md" />
                </div>

                {/* Flying Card to Bottom (You) */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    animation: 'dealFlyBottom 0.8s ease-out infinite alternate 0.6s',
                  }}
                >
                  <Card faceDown size="md" />
                </div>
              </div>

              <div
                style={{
                  marginTop: 28,
                  color: '#38bdf8',
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textShadow: '0 2px 10px rgba(0,0,0,0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span>🃏</span>
                <span>Dealing 13 Cards to Each Player...</span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.84rem', marginTop: 4 }}>
                Player holding Ace of Spades (A♠) will lead the opening trick
              </div>
            </div>
          )}

          <ThullaTable
            gameState={gameState}
            humanPlayerId="player-human"
            onMove={handleApplyMove}
            isProcessingBot={isProcessingBot}
            playerActionBubbles={playerActionBubbles}
            resolvingTrick={resolvingTrick}
            crazyThullaActive={crazyThullaActive}
            activeThrowAction={activeThrowAction}
          />
        </div>

        {/* Live Broadcast & Status Sidebar (Desktop) */}
        <div className="desktop-sidebar-only">
          <ThullaSidebar
            ledSuit={gameState.currentTrick?.ledSuit ?? null}
            trickNumber={gameState.trickNumber}
            burnedCount={gameState.discardPile.length}
            activePlayerCount={activePlayers.length}
            escapedPlayers={escapedPlayers}
            log={gameState.log}
            botThinkingText={botThinkingText}
            botThinkingPlayerName={botThinkingPlayerName}
          />
        </div>
      </div>

      {/* Mobile Slide-over Drawer for Sidebar */}
      {showMobileLog && (
        <div className="mobile-sidebar-drawer" onClick={() => setShowMobileLog(false)}>
          <div className="mobile-sidebar-drawer-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 700, color: '#38bdf8' }}>💬 Trick Log & Status</span>
              <button
                onClick={() => setShowMobileLog(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 8px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
            <ThullaSidebar
              ledSuit={gameState.currentTrick?.ledSuit ?? null}
              trickNumber={gameState.trickNumber}
              burnedCount={gameState.discardPile.length}
              activePlayerCount={activePlayers.length}
              escapedPlayers={escapedPlayers}
              log={gameState.log}
              botThinkingText={botThinkingText}
              botThinkingPlayerName={botThinkingPlayerName}
            />
          </div>
        </div>
      )}

      {/* Game Over Announcement Modal */}
      {isGameOver && bhabhiPlayer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: 500,
              width: '100%',
              padding: 32,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              border: '1px solid rgba(239, 68, 68, 0.4)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div style={{ fontSize: '3.5rem' }}>
              {bhabhiPlayer.id === 'player-human' ? '🤦‍♂️' : '🎉'}
            </div>
            <div>
              <h2 style={{ fontSize: '1.8rem', color: '#f8fafc', marginBottom: 6 }}>
                Match Concluded!
              </h2>
              <div style={{ fontSize: '1.1rem', color: '#ef4444', fontWeight: 700 }}>
                {bhabhiPlayer.name} is the Bhabhi (Loser)!
              </div>
            </div>

            {/* Escaped Ranking Ladder */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Podium Standings
              </div>
              {escapedPlayers.map((p) => {
                const medal = p.position === 1 ? '🥇' : p.position === 2 ? '🥈' : '🥉';
                return (
                  <div
                    key={p.playerId}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: p.playerId === 'player-human' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    }}
                  >
                    <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                      {medal} {p.name}
                    </span>
                    <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.85rem' }}>
                      #{p.position} Escaped
                    </span>
                  </div>
                );
              })}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                <span style={{ fontWeight: 700, color: '#fca5a5' }}>
                  💩 {bhabhiPlayer.name}
                </span>
                <span style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.85rem' }}>
                  BHABHI
                </span>
              </div>
            </div>

            <button
              onClick={() => startNewGame()}
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#fff',
                padding: '12px 24px',
                borderRadius: 10,
                fontSize: '1rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              🔄 Play Again
            </button>
          </div>
        </div>
      )}

      {/* Ruleset Configuration Modal */}
      {showRulesetModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: 520,
              width: '100%',
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.3rem', color: '#f8fafc' }}>⚙️ Thulla Ruleset Configuration</h3>
              <button
                onClick={() => setShowRulesetModal(false)}
                style={{ background: 'transparent', color: '#94a3b8', fontSize: '1.2rem', padding: 4 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Deck Count */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: 6 }}>
                  Deck Count:
                </label>
                <select
                  value={ruleset.deckCount}
                  onChange={(e) =>
                    setRuleset((r) => ({ ...r, deckCount: Number(e.target.value) as 1 | 2 }))
                  }
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.4)',
                    color: '#f8fafc',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                  }}
                >
                  <option value={1}>1 Standard Deck (52 cards - 13 per player)</option>
                  <option value={2}>2 Decks (104 cards - 26 per player)</option>
                </select>
              </div>

              {/* First Leader Rule */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: 6 }}>
                  Opening First Trick Rule:
                </label>
                <select
                  value={ruleset.firstLeaderRule}
                  onChange={(e) =>
                    setRuleset((r) => ({
                      ...r,
                      firstLeaderRule: e.target.value as 'aceOfSpades' | 'lowestCard' | 'random',
                    }))
                  }
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.4)',
                    color: '#f8fafc',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                  }}
                >
                  <option value="aceOfSpades">Ace of Spades (Compulsory A♠ lead - Authentic)</option>
                  <option value="random">Random Player Leads Any Card</option>
                  <option value="lowestCard">Lowest Card Holder Leads</option>
                </select>
              </div>

              {/* Who Leads After Thulla */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: 6 }}>
                  Who Leads After a Thulla:
                </label>
                <select
                  value={ruleset.whoLeadsAfterThulla}
                  onChange={(e) =>
                    setRuleset((r) => ({
                      ...r,
                      whoLeadsAfterThulla: e.target.value as 'highestCardHolder' | 'thullaPlayer',
                    }))
                  }
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.4)',
                    color: '#f8fafc',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                  }}
                >
                  <option value="highestCardHolder">
                    Penalty Receiver (Highest card holder who picked up)
                  </option>
                  <option value="thullaPlayer">
                    Thulla Player (The one who delivered the Thulla)
                  </option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <button
                onClick={() => setShowRulesetModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  color: '#94a3b8',
                  padding: '8px 16px',
                  borderRadius: 8,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowRulesetModal(false);
                  startNewGame(ruleset);
                }}
                style={{
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  color: '#fff',
                  padding: '8px 20px',
                  borderRadius: 8,
                  fontWeight: 700,
                }}
              >
                Apply & Restart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
