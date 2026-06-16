import { useCallback, useEffect, useRef, useState } from "react";

const ROUND_SECONDS = 20;
const STARTING_LIVES = 3;
const PLAYER_X = 0.2;
const GRAVITY = 2.3;
const JUMP_VELOCITY = 2.15;
const CLEAR_HEIGHT = 0.14;
const TULIP_KINDS = ["red", "yellow", "pink", "purple"];

const AMSTERDAM_FUN_FACTS = [
  "The Netherlands grows over 4.3 billion tulip bulbs every year — about 80% of the world's total supply.",
  "Amsterdam has more than 1,200 bridges, making it one of the most bridge-dense cities in Europe.",
  "The tulip originally came from Central Asia and Turkey — Dutch traders brought it to the Netherlands in the 1600s.",
  "During 'Tulip Mania' in 1637, a single tulip bulb could cost more than a canal house in Amsterdam.",
  "Amsterdam's Keukenhof garden plants around 7 million flower bulbs each year, mostly tulips.",
  "The Dutch export roughly €5.5 billion worth of cut flowers every year, with tulips leading the way.",
  "Amsterdam has over 800,000 bicycles — more bikes than people in the city.",
  "The narrowest house in Amsterdam is just 2.02 metres wide on the Singel canal.",
];


export function useTulipGame({ isCalibrated, isRunning, jumpCount }) {
  const animationRef = useRef(0);
  const gameRef = useRef(createReadyGame());
  const itemIdRef = useRef(0);
  const lastFrameRef = useRef(0);
  const pendingJumpRef = useRef(false);
  const spawnTimerRef = useRef(0);
  const tickRef = useRef(null);
  const [game, setGame] = useState(createReadyGame);

  const commitGame = useCallback((nextGame) => {
    gameRef.current = nextGame;
    setGame(nextGame);
  }, []);

  const triggerJump = useCallback(() => {
    const current = gameRef.current;

    if (current.status === "ready" && isRunning && isCalibrated) {
      itemIdRef.current = 0;
      lastFrameRef.current = 0;
      spawnTimerRef.current = 0.8;
      pendingJumpRef.current = true;
      commitGame(createPlayingGame());
      console.log("[TulipGameDebug] First jump started round and queued jump");
      return;
    }

    if (current.status !== "playing") {
      console.log("[TulipGameDebug] Jump ignored", { status: current.status });
      return;
    }

    pendingJumpRef.current = true;
    console.log("[TulipGameDebug] Jump buffered", { avatarY: current.avatarY, waitingForLanding: current.avatarY > 0.04 });
  }, [commitGame, isCalibrated, isRunning]);

  const startRound = useCallback(() => {
    if (!isRunning || !isCalibrated) {
      return;
    }

    itemIdRef.current = 0;
    lastFrameRef.current = 0;
    pendingJumpRef.current = false;
    spawnTimerRef.current = 0.8;
    commitGame(createPlayingGame());
  }, [commitGame, isCalibrated, isRunning]);

  const resetRound = useCallback(() => {
    itemIdRef.current = 0;
    lastFrameRef.current = 0;
    pendingJumpRef.current = false;
    spawnTimerRef.current = 0;
    commitGame(createReadyGame());
  }, [commitGame]);

  const tick = useCallback(
    (timestamp) => {
      const current = gameRef.current;

      if (!isRunning || current.status !== "playing") {
        return;
      }

      const lastFrame = lastFrameRef.current || timestamp;
      const delta = Math.min((timestamp - lastFrame) / 1000, 0.05);
      lastFrameRef.current = timestamp;

      const shouldJump = pendingJumpRef.current && current.avatarY <= 0.04;
      if (shouldJump) {
        pendingJumpRef.current = false;
        console.log("[TulipGameDebug] Game loop launched buffered jump", { avatarY: current.avatarY });
      }
      const startingVelocity = shouldJump
        ? JUMP_VELOCITY
        : current.avatarVelocity;
      const avatarVelocity = startingVelocity - GRAVITY * delta;
      const avatarY = Math.max(0, current.avatarY + avatarVelocity * delta);
      const landedVelocity =
        avatarY === 0 && avatarVelocity < 0 ? 0 : avatarVelocity;
      const obstacles = [];
      let cleared = current.cleared;
      let lives = current.lives;
      let score = current.score;

      for (const obstacle of current.obstacles) {
        const nextObstacle = {
          ...obstacle,
          x: obstacle.x - obstacle.speed * delta,
        };

        if (!nextObstacle.scored) {
          const overlapsPlayer =
            nextObstacle.x <= PLAYER_X + 0.045 &&
            nextObstacle.x >= PLAYER_X - 0.055;

          if (overlapsPlayer) {
            nextObstacle.scored = true;
            if (avatarY >= CLEAR_HEIGHT) {
              cleared += 1;
              score += 100;
            } else {
              lives -= 1;
            }
          }
        }

        if (nextObstacle.x > -0.12) {
          obstacles.push(nextObstacle);
        }
      }

      spawnTimerRef.current -= delta;

      if (spawnTimerRef.current <= 0 && current.timeLeft > 2) {
        obstacles.push(createTulip(itemIdRef.current, current.cleared));
        itemIdRef.current += 1;
        spawnTimerRef.current = randomBetween(1.65, 2.35);
      }

      const timeLeft = Math.max(0, current.timeLeft - delta);
      const ranOutOfTime = timeLeft <= 0;
      const ranOutOfLives = lives <= 0;
      const finishing = ranOutOfTime || ranOutOfLives;
      const status = finishing ? "finished" : "playing";
      const funFact =
        ranOutOfTime && !current.funFact
          ? AMSTERDAM_FUN_FACTS[Math.floor(Math.random() * AMSTERDAM_FUN_FACTS.length)]
          : current.funFact ?? null;

      commitGame({
        ...current,
        avatarVelocity: landedVelocity,
        avatarY,
        cleared,
        funFact,
        lives: Math.max(0, lives),
        obstacles: status === "playing" ? obstacles : [],
        score,
        status,
        timeLeft,
      });

      if (status === "playing" && tickRef.current) {
        animationRef.current = requestAnimationFrame(tickRef.current);
      }
    },
    [commitGame, isRunning],
  );

  useEffect(() => {
    tickRef.current = tick;
  }, [tick]);

  useEffect(() => {
    if (jumpCount > 0) {
      console.log('[TulipGameDebug] Game received pose jump', { jumpCount })
      triggerJump();
    }
  }, [jumpCount, triggerJump]);

  useEffect(() => {
    if (!isRunning || game.status !== "playing") {
      return undefined;
    }

    cancelAnimationFrame(animationRef.current);
    animationRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationRef.current);
  }, [game.status, isRunning, tick]);

  return { game, resetRound, startRound, triggerJump };
}

function createReadyGame() {
  return {
    avatarVelocity: 0,
    avatarY: 0,
    cleared: 0,
    funFact: null,
    lives: STARTING_LIVES,
    obstacles: [],
    roundSeconds: ROUND_SECONDS,
    score: 0,
    status: "ready",
    timeLeft: ROUND_SECONDS,
  };
}

function createPlayingGame() {
  return { ...createReadyGame(), status: "playing" };
}

function createTulip(id, cleared) {
  return {
    id,
    kind: TULIP_KINDS[id % TULIP_KINDS.length],
    scale: randomBetween(0.86, 1.15),
    speed: randomBetween(0.19, 0.23) + Math.min(cleared * 0.003, 0.08),
    x: 1.08,
  };
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
