import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  SeepEngine,
  DEFAULT_SEEP_RULESET,
  type SeepGameState,
  type SeepMove,
  type SeepRuleset,
  type PlayerConfig,
  type Card as CardType,
} from '@cards/engine';
import { SeepBot } from '@cards/bots';
import { SeepTable } from './SeepTable';
import { SeepSidebar } from './SeepSidebar';
import { Card } from '../../components/shared/Card';
import { type CardThrowAction } from '../../components/table/CardThrowOverlay';
import { getPlayerSeatPosition } from '../../components/table/PlayerSeat';

// Web Audio synthesizer for Seep casino sounds
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

  playCardThrow() {
    try {
      this.init();
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, this.ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch {}
  }

  playCardEat() {
    try {
      this.init();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.2, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.06 + 0.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.2);
      });
    } catch {}
  }

  playSeepTrumpet() {
    try {
      this.init();
      if (!this.ctx) return;
      const notes = [261.63, 329.63, 392.0, 523.25, 659.25];
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + idx * 0.1);
        gain.gain.setValueAtTime(0.3, this.ctx.currentTime + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + idx * 0.1 + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(this.ctx.currentTime + idx * 0.1);
        osc.stop(this.ctx.currentTime + idx * 0.1 + 0.4);
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
  { id: 'player-human', name: 'You (South)', isBot: false },
  { id: 'bot-1', name: 'Karan (East)', isBot: true },
  { id: 'bot-2', name: 'Rohan (Partner - North)', isBot: true },
  { id: 'bot-3', name: 'Priya (West)', isBot: true },
];

export const SeepPage: React.FC = () => {
  const [ruleset, setRuleset] = useState<SeepRuleset>(DEFAULT_SEEP_RULESET);
  const [gameState, setGameState] = useState<SeepGameState>(() =>
    SeepEngine.createGame(DEFAULT_SEEP_RULESET, DEFAULT_PLAYERS, Date.now()),
  );
  const [gameSpeed, setGameSpeed] = useState<'relaxed' | 'normal' | 'fast'>('relaxed');
  const [isTurnTransitioning, setIsTurnTransitioning] = useState(false);
  const [isProcessingBot, setIsProcessingBot] = useState(false);
  const [botThinkingText, setBotThinkingText] = useState<string | null>(null);
  const [botThinkingPlayerName, setBotThinkingPlayerName] = useState<string | null>(null);
  const [isDealingAnimation, setIsDealingAnimation] = useState(true);
  const [showRulesetModal, setShowRulesetModal] = useState(false);
  const [showMobileLog, setShowMobileLog] = useState(false);
  const [seepCelebrationActive, setSeepCelebrationActive] = useState(false);
  const [playerActionBubbles, setPlayerActionBubbles] = useState<
    Record<string, { text: string; type: 'think' | 'play' | 'pass' | 'challenge' | 'thulla' }>
  >({});

  const [activeThrowAction, setActiveThrowAction] = useState<CardThrowAction | null>(null);

  const botsRef = useRef<Map<string, SeepBot>>(new Map());

  // Ensure active game state ruleset has latest core defaults enabled
  useEffect(() => {
    setGameState((prev) => {
      if (
        !prev.ruleset.allowBuildOnOpponentHouse ||
        !prev.ruleset.cementedHouses ||
        !prev.ruleset.trailAlwaysAllowed ||
        prev.ruleset.thirdSeepDownsBoth === undefined
      ) {
        return {
          ...prev,
          ruleset: {
            ...prev.ruleset,
            allowBuildOnOpponentHouse: true,
            cementedHouses: true,
            trailAlwaysAllowed: true,
            thirdSeepDownsBoth: true,
          },
        };
      }
      return prev;
    });
  }, []);

  // Dealing Animation
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
      bot = new SeepBot({ seed: Math.floor(Math.random() * 1_000_000) });
      botsRef.current.set(id, bot);
    }
    return bot;
  }, []);

  const startNewGame = useCallback(
    (customRuleset?: SeepRuleset) => {
      const activeRuleset = customRuleset ?? ruleset;
      botsRef.current.clear();
      const newSeed = Math.floor(Math.random() * 1_000_000);
      const initial = SeepEngine.createGame(activeRuleset, DEFAULT_PLAYERS, newSeed);
      setGameState(initial);
      setPlayerActionBubbles({});
      setBotThinkingText(null);
      setBotThinkingPlayerName(null);
      setSeepCelebrationActive(false);
      setActiveThrowAction(null);
      triggerDealAnimation();
    },
    [ruleset, triggerDealAnimation],
  );

  const handleApplyMove = useCallback((move: SeepMove) => {
    try {
      const prev = gameState;
      const next = SeepEngine.applyMove(prev, move);

      // Check if redeal happened
      if (move.type === 'REDEAL_BID' || move.type === 'REDEAL_COURT') {
        triggerDealAnimation();
        setGameState(next);
        return;
      }

      const playerIndex = prev.players.findIndex((p) => p.id === move.playerId);
      const player = prev.players[playerIndex]!;
      const humanIndex = prev.players.findIndex((p) => p.id === 'player-human');
      const throwerPosition = getPlayerSeatPosition(playerIndex, humanIndex, prev.players.length);
      const throwerAvatar = player.id === 'player-human' ? '🤠' : '🤖';

      // Find the card thrown from hand
      const cardId = 'handCardId' in move ? move.handCardId : 'cardId' in move ? move.cardId : undefined;
      const handCard = cardId ? player.hand.find((c) => c.id === cardId) : undefined;
      const cardStr = handCard ? ` ${handCard.rank}${handCard.suit}` : '';

      // Check if Seep was scored
      const prevTotalSeeps = prev.teams.reduce((acc, t) => acc + t.seepCount, 0);
      const nextTotalSeeps = next.teams.reduce((acc, t) => acc + t.seepCount, 0);
      const isSeep = nextTotalSeeps > prevTotalSeeps;

      // Action bubbles with specific card details
      let bubbleText = 'Played';
      if (move.type === 'DECLARE_BID' || move.type === 'BID') bubbleText = `👑 Bid ${move.houseValue}`;
      if (move.type === 'CAPTURE') {
        const count =
          'itemIds' in move && move.itemIds
            ? move.itemIds.length
            : (move.capturedLooseCardIds?.length ?? 0) + (move.capturedHouseIds?.length ?? 0);
        bubbleText = `🃏 Captured ${count} items with${cardStr}`;
      }
      if (move.type === 'BUILD' || move.type === 'BUILD_HOUSE') {
        const isExtend = 'extendHouseId' in move && !!move.extendHouseId;
        bubbleText = isExtend
          ? `🔨 Rebuilt House ${move.targetValue} with${cardStr}`
          : `🏠 Built House ${move.targetValue} with${cardStr}`;
      }
      if (move.type === 'CEMENT_HOUSE') {
        const h = prev.floor.houses.find((house) => house.id === move.houseId);
        bubbleText = `🔒 Cemented House ${h?.buildValue ?? ''} with${cardStr}`;
      }
      if (move.type === 'TRAIL' || move.type === 'THROW') {
        bubbleText = `⬇️ Trailed${cardStr}`;
      }

      setPlayerActionBubbles((b) => ({
        ...b,
        [move.playerId]: { text: bubbleText, type: 'play' },
      }));

      // Gather captured cards for eating animation
      const capturedCards: CardType[] = [];
      if (move.type === 'CAPTURE') {
        if ('itemIds' in move && move.itemIds) {
          for (const itemId of move.itemIds) {
            const loose = prev.floor.looseCards.find((c) => c.id === itemId);
            if (loose) capturedCards.push(loose);
            const house = prev.floor.houses.find((h) => h.id === itemId);
            if (house) capturedCards.push(...house.cards);
          }
        } else {
          if (move.capturedLooseCardIds) {
            for (const id of move.capturedLooseCardIds) {
              const c = prev.floor.looseCards.find((card) => card.id === id);
              if (c) capturedCards.push(c);
            }
          }
          if (move.capturedHouseIds) {
            for (const id of move.capturedHouseIds) {
              const h = prev.floor.houses.find((house) => house.id === id);
              if (h) capturedCards.push(...h.cards);
            }
          }
        }
      }

      // Check if last hand eaten sweeps remaining floor items:
      const sweepsTableAtEnd =
        (next.phase.type === 'round_over' || next.phase.type === 'game_over') &&
        (prev.floor.looseCards.length > 0 || prev.floor.houses.length > 0) &&
        next.floor.looseCards.length === 0 &&
        next.floor.houses.length === 0;

      if (sweepsTableAtEnd) {
        for (const c of prev.floor.looseCards) {
          if (!capturedCards.some((item) => item.id === c.id)) capturedCards.push(c);
        }
        for (const h of prev.floor.houses) {
          for (const c of h.cards) {
            if (!capturedCards.some((item) => item.id === c.id)) capturedCards.push(c);
          }
        }
      }

      const isEating = move.type === 'CAPTURE';
      const throwCardList = handCard ? [handCard] : [];

      let actionDescription = `throws ${handCard ? `${handCard.rank}${handCard.suit}` : 'card'}`;
      if (move.type === 'BUILD' || move.type === 'BUILD_HOUSE') {
        actionDescription = `throws ${handCard ? `${handCard.rank}${handCard.suit}` : 'card'} to Build House ${move.targetValue}`;
      } else if (move.type === 'CEMENT_HOUSE') {
        actionDescription = `throws ${handCard ? `${handCard.rank}${handCard.suit}` : 'card'} to Cement House`;
      } else if (move.type === 'TRAIL' || move.type === 'THROW') {
        actionDescription = `throws ${handCard ? `${handCard.rank}${handCard.suit}` : 'card'} to Floor`;
      }

      setIsTurnTransitioning(true);
      sfx.playCardThrow();

      const actionId = String(Date.now());
      const initialAction: CardThrowAction = {
        id: actionId,
        throwerName: player.name,
        throwerAvatar,
        throwerPosition,
        cards: throwCardList,
        actionText: actionDescription,
        isEating,
        eaterName: player.name,
        eaterPosition: throwerPosition,
        eaterTitle: isSeep
          ? `🌟 SEEP! ${player.name} EATS the entire table!`
          : sweepsTableAtEnd
          ? `🧹 ${player.name} EATS the last hand & sweeps all table cards!`
          : `🍽️ ${player.name} EATS ${capturedCards.length + throwCardList.length} Cards!`,
        eatenCards: capturedCards,
        isSeepClear: isSeep || sweepsTableAtEnd,
        phase: 'throwing',
      };

      setActiveThrowAction(initialAction);

      if (isEating) {
        // Phase 1: Thrown card lands on top (380ms)
        setTimeout(() => {
          if (isSeep) {
            sfx.playSeepTrumpet();
            setSeepCelebrationActive(true);
            setTimeout(() => setSeepCelebrationActive(false), 2000);
          } else {
            sfx.playCardEat();
          }
          // Phase 2: EAT & cluster cards together on top (shows eating banner and all eaten cards)
          setActiveThrowAction((act) => (act ? { ...act, phase: 'eating' } : null));

          // Phase 3: Vanish cards by flying into eater's seat (at 1000ms)
          setTimeout(() => {
            setActiveThrowAction((act) => (act ? { ...act, phase: 'vanishing' } : null));

            // Phase 4: Finalize state and release turn transition (at 1420ms)
            setTimeout(() => {
              setGameState(next);
              setActiveThrowAction(null);
              setIsTurnTransitioning(false);
            }, 420);
          }, 650);
        }, 380);
      } else {
        // Simple throw (TRAIL, BUILD, CEMENT)
        setTimeout(() => {
          sfx.playCardSnap();
          setActiveThrowAction((act) => (act ? { ...act, phase: 'vanishing' } : null));
          setTimeout(() => {
            setGameState(next);
            setActiveThrowAction(null);
            setIsTurnTransitioning(false);
          }, 250);
        }, 380);
      }
    } catch (err) {
      console.error('Failed to apply Seep move:', err);
      setIsTurnTransitioning(false);
      setActiveThrowAction(null);
    }
  }, [gameState, triggerDealAnimation]);

  // Compute legal moves reactively for human player
  const humanLegalMoves = useMemo(() => {
    try {
      const visible = SeepEngine.getVisibleState(gameState, 'player-human');
      const moves = SeepEngine.getLegalMoves(visible, 'player-human');
      (window as unknown as { currentSeepLegalMoves?: SeepMove[] }).currentSeepLegalMoves = moves;
      return moves;
    } catch {
      return [];
    }
  }, [gameState]);

const SPEED_CONFIG = {
  relaxed: {
    strategyDelay: 1200,
    executeDelay: 2600,
    interTurnDelay: 1300,
    label: '🐢 Relaxed (Slow)',
  },
  normal: {
    strategyDelay: 800,
    executeDelay: 1800,
    interTurnDelay: 700,
    label: '🚶 Normal',
  },
  fast: {
    strategyDelay: 400,
    executeDelay: 1000,
    interTurnDelay: 300,
    label: '⚡ Fast',
  },
} as const;

  // Bot Turn Loop
  useEffect(() => {
    if (isDealingAnimation || isTurnTransitioning) return;
    if (SeepEngine.isGameOver(gameState)) {
      setBotThinkingText(null);
      return;
    }

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!currentPlayer || !currentPlayer.isBot) {
      setIsProcessingBot(false);
      setBotThinkingText(null);
      setBotThinkingPlayerName(null);
      return;
    }

    setIsProcessingBot(true);
    setBotThinkingPlayerName(currentPlayer.name);

    setPlayerActionBubbles((prev) => ({
      ...prev,
      [currentPlayer.id]: { text: '💭 Deciding move...', type: 'think' },
    }));

    if (gameState.phase.type === 'bidding') {
      setBotThinkingText('Evaluating hand & floor to declare opening house...');
    } else {
      setBotThinkingText('Scanning floor for captures, house builds, or cements...');
    }

    const currentSpeed = SPEED_CONFIG[gameSpeed];

    const thoughtTimer = setTimeout(() => {
      setBotThinkingText('Calculating optimal partnership strategy...');
    }, currentSpeed.strategyDelay);

    const executeTimer = setTimeout(() => {
      try {
        const visibleState = SeepEngine.getVisibleState(gameState, currentPlayer.id);
        const legalMoves = SeepEngine.getLegalMoves(visibleState, currentPlayer.id);

        if (legalMoves.length > 0) {
          const bot = getBot(currentPlayer.id);
          const chosenMove = bot.chooseMove(visibleState, legalMoves);
          handleApplyMove(chosenMove);

          // Brief inter-turn pause so user can clearly see what was played
          setIsTurnTransitioning(true);
          setTimeout(() => {
            setIsTurnTransitioning(false);
          }, currentSpeed.interTurnDelay);
        }
      } catch (e) {
        console.error('Bot turn failed:', e);
      } finally {
        setIsProcessingBot(false);
        setBotThinkingText(null);
        setBotThinkingPlayerName(null);
      }
    }, currentSpeed.executeDelay);

    return () => {
      clearTimeout(thoughtTimer);
      clearTimeout(executeTimer);
    };
  }, [gameState, getBot, handleApplyMove, isDealingAnimation, isTurnTransitioning, gameSpeed]);

  const isGameOver = SeepEngine.isGameOver(gameState);
  const matchWinnerTeam = isGameOver && gameState.phase.type === 'game_over'
    ? gameState.teams[gameState.phase.matchWinnerTeamIndex]
    : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '6px 16px',
        maxWidth: 1440,
        margin: '0 auto',
        gap: 6,
        height: 'calc(100vh - 48px)',
        maxHeight: 'calc(100vh - 48px)',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {/* Top Bar / Controls */}
      <div
        className="game-secondary-header"
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.25rem',
              color: '#10b981',
              letterSpacing: '0.02em',
              margin: 0,
            }}
          >
            🏰 Seep (Sweep)
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
            2v2 Partnerships
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Game Speed Toggle */}
          <button
            onClick={() => {
              setGameSpeed((prev) => (prev === 'relaxed' ? 'normal' : prev === 'normal' ? 'fast' : 'relaxed'));
            }}
            title="Adjust pacing for bot turns and move transitions"
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#e2e8f0',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: '0.8rem',
              fontWeight: 600,
              border: '1px solid rgba(255, 255, 255, 0.15)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span style={{ color: '#94a3b8' }}>Speed:</span>
            <span
              style={{
                color: gameSpeed === 'relaxed' ? '#6ee7b7' : gameSpeed === 'normal' ? '#fde047' : '#f87171',
                fontWeight: 700,
              }}
            >
              {SPEED_CONFIG[gameSpeed].label}
            </span>
          </button>

          <button
            type="button"
            className="mobile-log-toggle-btn"
            onClick={() => setShowMobileLog(!showMobileLog)}
            style={{
              background: showMobileLog ? '#10b981' : 'rgba(255, 255, 255, 0.08)',
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
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
            }}
          >
            🔄 New Match
          </button>
        </div>
      </div>

      {/* Main Layout */}
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
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          {/* Card Distribution Dealing Overlay Animation */}
          {isDealingAnimation && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(3, 20, 14, 0.8)',
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
                <div style={{ position: 'absolute', top: 0, left: 0 }}>
                  <Card faceDown size="md" />
                </div>
                <div style={{ position: 'absolute', top: 0, left: 0, animation: 'dealFlyTop 0.8s ease-out infinite alternate' }}>
                  <Card faceDown size="md" />
                </div>
                <div style={{ position: 'absolute', top: 0, left: 0, animation: 'dealFlyLeft 0.8s ease-out infinite alternate 0.2s' }}>
                  <Card faceDown size="md" />
                </div>
                <div style={{ position: 'absolute', top: 0, left: 0, animation: 'dealFlyRight 0.8s ease-out infinite alternate 0.4s' }}>
                  <Card faceDown size="md" />
                </div>
                <div style={{ position: 'absolute', top: 0, left: 0, animation: 'dealFlyBottom 0.8s ease-out infinite alternate 0.6s' }}>
                  <Card faceDown size="md" />
                </div>
              </div>

              <div
                style={{
                  marginTop: 28,
                  color: '#6ee7b7',
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
                <span>Dealing Seep Round: 4 cards to Bidder, 4 to Floor...</span>
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.84rem', marginTop: 4 }}>
                South bids house (9–12) to distribute remaining cards
              </div>
            </div>
          )}

          <SeepTable
            gameState={gameState}
            humanPlayerId="player-human"
            legalMoves={humanLegalMoves}
            onMove={handleApplyMove}
            isProcessingBot={isProcessingBot}
            playerActionBubbles={playerActionBubbles}
            seepCelebrationActive={seepCelebrationActive}
            activeThrowAction={activeThrowAction}
          />
        </div>

        {/* Sidebar (Desktop) */}
        <div className="desktop-sidebar-only">
          <SeepSidebar
            teams={gameState.teams}
            targetScore={gameState.ruleset.targetScore}
            looseCount={gameState.floor.looseCards.length}
            houseCount={gameState.floor.houses.length}
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
              <span style={{ fontWeight: 700, color: '#10b981' }}>💬 100-Pt Score & Log</span>
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
            <SeepSidebar
              teams={gameState.teams}
              targetScore={gameState.ruleset.targetScore}
              looseCount={gameState.floor.looseCards.length}
              houseCount={gameState.floor.houses.length}
              log={gameState.log}
              botThinkingText={botThinkingText}
              botThinkingPlayerName={botThinkingPlayerName}
            />
          </div>
        </div>
      )}

      {/* Round Over Modal */}
      {gameState.phase.type === 'round_over' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
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
              maxWidth: 520,
              width: '100%',
              padding: 28,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              border: '2px solid #38bdf8',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div style={{ fontSize: '3rem' }}>🏁</div>
            <div>
              <h2 style={{ fontSize: '1.6rem', color: '#f8fafc', marginBottom: 4 }}>
                Round {gameState.roundNumber} Complete!
              </h2>
              <div style={{ fontSize: '0.88rem', color: '#94a3b8' }}>
                All 52 cards played. Leftover table cards awarded to the last capturer!
              </div>
            </div>

            {/* Teams Round & Total Score Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {gameState.teams.map((t, idx) => (
                <div
                  key={idx}
                  style={{
                    background: idx === 0 ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: `1px solid ${idx === 0 ? '#3b82f6' : '#ef4444'}`,
                    padding: 14,
                    borderRadius: 12,
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: idx === 0 ? '#93c5fd' : '#fca5a5' }}>
                    {t.name}
                  </div>
                  <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Round Score:</span>
                      <strong style={{ color: '#fff' }}>+{t.roundScore} pts</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Total Match:</span>
                      <strong style={{ color: '#fde047' }}>{t.totalScore} / {gameState.ruleset.targetScore}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: '0.82rem', color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)', padding: 10, borderRadius: 8 }}>
              {gameState.lastActionAnnouncement}
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => {
                  const nextState = SeepEngine.startNextRound(gameState);
                  setGameState(nextState);
                  setPlayerActionBubbles({});
                  setBotThinkingText(null);
                  setBotThinkingPlayerName(null);
                  triggerDealAnimation();
                }}
                style={{
                  background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
                  color: '#fff',
                  padding: '12px 28px',
                  borderRadius: 10,
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  border: 'none',
                  boxShadow: '0 4px 15px rgba(2, 132, 199, 0.4)',
                }}
              >
                ▶️ Start Round {gameState.roundNumber + 1}
              </button>
              <button
                onClick={() => startNewGame()}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#cbd5e1',
                  padding: '12px 20px',
                  borderRadius: 10,
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                🔄 Reset Match
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match Over Modal */}
      {isGameOver && matchWinnerTeam && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
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
              border: '2px solid #10b981',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div style={{ fontSize: '3.5rem' }}>🏆</div>
            <div>
              <h2 style={{ fontSize: '1.8rem', color: '#f8fafc', marginBottom: 6 }}>
                Match Victory!
              </h2>
              <div style={{ fontSize: '1.2rem', color: '#34d399', fontWeight: 700 }}>
                {matchWinnerTeam.name} Won the Seep Match!
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.15)', padding: 14, borderRadius: 10 }}>
                <div style={{ color: '#93c5fd', fontSize: '0.85rem' }}>Your Team</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: 4 }}>
                  {gameState.teams[0]?.totalScore ?? 0} pts
                </div>
              </div>
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', padding: 14, borderRadius: 10 }}>
                <div style={{ color: '#fca5a5', fontSize: '0.85rem' }}>Opponents</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#fff', marginTop: 4 }}>
                  {gameState.teams[1]?.totalScore ?? 0} pts
                </div>
              </div>
            </div>

            <button
              onClick={() => startNewGame()}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#fff',
                padding: '12px 24px',
                borderRadius: 10,
                fontSize: '1rem',
                fontWeight: 700,
              }}
            >
              🔄 Play Another Match
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
              maxWidth: 500,
              width: '100%',
              padding: 28,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.3rem', color: '#f8fafc' }}>⚙️ Seep Ruleset Configuration</h3>
              <button
                onClick={() => setShowRulesetModal(false)}
                style={{ background: 'transparent', color: '#94a3b8', fontSize: '1.2rem', padding: 4 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: 6 }}>
                  Target Match Score:
                </label>
                <select
                  value={ruleset.targetScore}
                  onChange={(e) =>
                    setRuleset((r) => ({ ...r, targetScore: Number(e.target.value) as 100 | 350 | 500 }))
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
                  <option value={350}>350 Points (Standard Indian Match)</option>
                  <option value={500}>500 Points (Long Match)</option>
                  <option value={100}>100 Points (Single Round Quick Match)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: 6 }}>
                  Later Seep Bonus Points:
                </label>
                <select
                  value={ruleset.laterSeepBonus}
                  onChange={(e) =>
                    setRuleset((r) => ({ ...r, laterSeepBonus: Number(e.target.value) }))
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
                  <option value={25}>25 Bonus Points (Standard)</option>
                  <option value={50}>50 Bonus Points</option>
                  <option value={0}>0 (Card points only)</option>
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
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
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
