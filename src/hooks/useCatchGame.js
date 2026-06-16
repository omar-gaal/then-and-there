import { useCallback, useEffect, useRef, useState } from 'react'

const ROUND_SECONDS = 45
const MAX_MISSES = 6

const TARGET_KINDS = ['croissant', 'baguette', 'eclair']

const PARIS_FUN_FACTS = [
  "Paris has over 1,800 bakeries — French law requires boulangeries to bake their bread on-site.",
  "The croissant was actually invented in Austria, not France — Viennese bakers brought it to Paris in the 1830s.",
  "France produces more than 320 officially recognised varieties of cheese.",
  "The Eiffel Tower grows up to 15 cm taller in summer because the iron expands in heat.",
  "Paris has 37 bridges crossing the Seine — the oldest, Pont Neuf, was completed in 1607.",
  "There are around 6,000 km of underground tunnels beneath Paris, including the famous Catacombs.",
  "A French baguette must weigh exactly 250 grams by law and can only contain four ingredients.",
  "The Louvre is the world's most visited art museum, with over 9 million visitors a year.",
]

export function useCatchGame({ isRunning, puckRef, stageRef }) {
  const animationRef = useRef(0)
  const bestScoreRef = useRef(0)
  const gameRef = useRef(createReadyGame())
  const itemIdRef = useRef(0)
  const lastFrameRef = useRef(0)
  const spawnTimerRef = useRef(0)
  const tickRef = useRef(null)

  const [game, setGame] = useState(createReadyGame)

  const commitGame = useCallback((nextGame) => {
    gameRef.current = nextGame
    setGame(nextGame)
  }, [])

  const startRound = useCallback(() => {
    if (!isRunning) {
      return
    }

    itemIdRef.current = 0
    lastFrameRef.current = 0
    spawnTimerRef.current = 0
    commitGame(createPlayingGame(bestScoreRef.current))
  }, [commitGame, isRunning])

  const resetRound = useCallback(() => {
    itemIdRef.current = 0
    lastFrameRef.current = 0
    spawnTimerRef.current = 0
    commitGame(createReadyGame(bestScoreRef.current))
  }, [commitGame])

  const tick = useCallback(
    (timestamp) => {
      const currentGame = gameRef.current

      if (!isRunning || currentGame.status !== 'playing') {
        return
      }

      const lastFrame = lastFrameRef.current || timestamp
      const deltaSeconds = Math.min((timestamp - lastFrame) / 1000, 0.05)
      lastFrameRef.current = timestamp

      const stageSize = getStageSize(stageRef.current)
      const puck = getPuckShape(puckRef.current, stageSize)
      const nextItems = []
      let caught = currentGame.caught
      let missed = currentGame.missed
      let score = currentGame.score
      let streak = currentGame.streak

      for (const item of currentGame.items) {
        const nextItem = {
          ...item,
          y: item.y + item.speed * deltaSeconds,
          spin: item.spin + item.spinSpeed * deltaSeconds,
        }

        if (puck && isItemCaught(nextItem, puck, stageSize)) {
          caught += 1
          streak += 1
          score += 10 + Math.min(streak, 6) * 3
        } else if (nextItem.y > 1.12) {
          missed += 1
          streak = 0
        } else {
          nextItems.push(nextItem)
        }
      }

      spawnTimerRef.current -= deltaSeconds

      if (spawnTimerRef.current <= 0 && currentGame.timeLeft > 1) {
        nextItems.push(createCatchItem(itemIdRef.current, currentGame))
        itemIdRef.current += 1
        spawnTimerRef.current = getSpawnDelay(currentGame)
      }

      const timeLeft = Math.max(0, currentGame.timeLeft - deltaSeconds)
      const status = timeLeft <= 0 || missed >= MAX_MISSES ? 'finished' : 'playing'
      const bestScore = Math.max(bestScoreRef.current, score)
      bestScoreRef.current = bestScore

      const funFact =
        status === 'finished' && !currentGame.funFact
          ? PARIS_FUN_FACTS[Math.floor(Math.random() * PARIS_FUN_FACTS.length)]
          : currentGame.funFact ?? null

      commitGame({
        ...currentGame,
        bestScore,
        caught,
        funFact,
        items: status === 'playing' ? nextItems : [],
        missed,
        score,
        status,
        streak,
        timeLeft,
      })

      if (status === 'playing' && tickRef.current) {
        animationRef.current = requestAnimationFrame(tickRef.current)
      }
    },
    [commitGame, isRunning, puckRef, stageRef]
  )

  useEffect(() => {
    tickRef.current = tick
  }, [tick])

  useEffect(() => {
    if (!isRunning) {
      cancelAnimationFrame(animationRef.current)
      resetRound()
    }
  }, [isRunning, resetRound])

  useEffect(() => {
    if (!isRunning || game.status !== 'playing') {
      return undefined
    }

    cancelAnimationFrame(animationRef.current)
    animationRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [game.status, isRunning, tick])

  return {
    game,
    resetRound,
    startRound,
  }
}

function createReadyGame(bestScore = 0) {
  return {
    bestScore,
    caught: 0,
    funFact: null,
    items: [],
    maxMisses: MAX_MISSES,
    missed: 0,
    roundSeconds: ROUND_SECONDS,
    score: 0,
    status: 'ready',
    streak: 0,
    timeLeft: ROUND_SECONDS,
  }
}

function createPlayingGame(bestScore = 0) {
  return {
    ...createReadyGame(bestScore),
    status: 'playing',
  }
}

function createCatchItem(id, game) {
  const paceBoost = Math.min(game.caught * 0.006, 0.13)

  return {
    id,
    kind: TARGET_KINDS[id % TARGET_KINDS.length],
    size: randomBetween(100, 200),
    speed: randomBetween(0.50 + paceBoost, 0.28 + paceBoost),
    spin: randomBetween(-18, 18),
    spinSpeed: randomBetween(-120, 120),
    x: randomBetween(0.09, 0.91),
    y: -0.1,
  }
}

function getSpawnDelay(game) {
  const baseDelay = Math.max(0.42, 0.82 - game.caught * 0.012)

  return randomBetween(baseDelay, baseDelay + 0.32)
}

function getStageSize(stage) {
  const bounds = stage?.getBoundingClientRect()

  return {
    height: bounds?.height || 540,
    width: bounds?.width || 960,
  }
}

function getPuckShape(puck, stageSize) {
  const x = Number(puck?.dataset.x)
  const y = Number(puck?.dataset.y)

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null
  }

  const scale = Number(puck?.style.getPropertyValue('--scale')) || 1
  const size = (puck?.offsetWidth || 72) * scale

  return {
    radius: size * 0.48,
    x: x * stageSize.width,
    y: y * stageSize.height,
  }
}

function isItemCaught(item, puck, stageSize) {
  const itemX = item.x * stageSize.width
  const itemY = item.y * stageSize.height
  const itemRadius = item.size * 0.38
  const distance = Math.hypot(itemX - puck.x, itemY - puck.y)

  return distance <= puck.radius + itemRadius
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}
