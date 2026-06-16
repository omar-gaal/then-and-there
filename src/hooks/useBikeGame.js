import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const ROUND_SECONDS = 120
const COMPLETION_FACT =
  'Copenhagen has more bicycles than cars, and many residents use protected cycle lanes every day.'
const UNLOCK_MESSAGE = 'Nové kolo: Meadow Cruiser. Nová mapa: Riverside Market.'

export const BIKE_PARTS = [
  { kind: 'frame', label: 'Rám', shortLabel: 'RM' },
  { kind: 'frontWheel', label: 'Přední kolo', shortLabel: 'PK' },
  { kind: 'backWheel', label: 'Zadní kolo', shortLabel: 'ZK' },
  { kind: 'saddle', label: 'Sedlo', shortLabel: 'SD' },
  { kind: 'handlebar', label: 'Řídítka', shortLabel: 'RD' },
  { kind: 'chain', label: 'Řetěz', shortLabel: 'RT' },
  { kind: 'pedals', label: 'Pedály', shortLabel: 'PD' },
  { kind: 'crank', label: 'Kliky', shortLabel: 'KL' },
  { kind: 'brakes', label: 'Brzdy', shortLabel: 'BR' },
  { kind: 'bell', label: 'Zvonek', shortLabel: 'ZV' },
  { kind: 'basket', label: 'Košík', shortLabel: 'KS' },
]

const STREET_PART_LAYOUT = [
  { kind: 'frame', size: 74, spin: -8, worldX: -3.55, worldZ: -5.8 },
  { kind: 'frontWheel', size: 70, spin: -5, worldX: 3.35, worldZ: -11.6 },
  { kind: 'backWheel', size: 70, spin: 7, worldX: -3.45, worldZ: -17.6 },
  { kind: 'saddle', size: 50, spin: -12, worldX: 3.7, worldZ: -24.6 },
  { kind: 'handlebar', size: 60, spin: 12, worldX: -3.7, worldZ: -31.0 },
  { kind: 'chain', size: 56, spin: 18, worldX: 3.5, worldZ: -37.6 },
  { kind: 'pedals', size: 48, spin: -18, worldX: -3.8, worldZ: -44.6 },
  { kind: 'crank', size: 48, spin: 22, worldX: 3.45, worldZ: -51.4 },
  { kind: 'brakes', size: 46, spin: -20, worldX: -3.55, worldZ: -58.0 },
  { kind: 'bell', size: 42, spin: -11, worldX: 3.82, worldZ: -64.8 },
  { kind: 'basket', size: 58, spin: 4, worldX: -3.92, worldZ: -71.4 },
]

const PICKUP_GRACE_MS = 240

// Pickup radii tuning lives here. Playtest Settings multiply screenRadius live.
const PICKUP_SETTINGS = {
  backWheel: { worldRadius: 1.02, screenRadius: 0.118, handNearRadius: 0.22 },
  basket: { worldRadius: 1.04, screenRadius: 0.108, handNearRadius: 0.21 },
  bell: { worldRadius: 0.78, screenRadius: 0.112, handNearRadius: 0.22 },
  brakes: { worldRadius: 0.82, screenRadius: 0.092, handNearRadius: 0.19 },
  chain: { worldRadius: 0.9, screenRadius: 0.098, handNearRadius: 0.2 },
  crank: { worldRadius: 0.84, screenRadius: 0.092, handNearRadius: 0.19 },
  frame: { worldRadius: 1.16, screenRadius: 0.126, handNearRadius: 0.24 },
  frontWheel: { worldRadius: 1.02, screenRadius: 0.118, handNearRadius: 0.22 },
  handlebar: { worldRadius: 0.94, screenRadius: 0.104, handNearRadius: 0.21 },
  pedals: { worldRadius: 0.82, screenRadius: 0.09, handNearRadius: 0.18 },
  saddle: { worldRadius: 0.82, screenRadius: 0.092, handNearRadius: 0.19 },
}

const DEFAULT_PICKUP_SETTINGS = {
  worldRadius: 0.9,
  screenRadius: 0.095,
  handNearRadius: 0.2,
}

const ASSEMBLY_ORDER = [
  'frame',
  'frontWheel',
  'backWheel',
  'saddle',
  'handlebar',
  'chain',
  'pedals',
  'crank',
  'brakes',
  'bell',
  'basket',
]

export const ASSEMBLY_SNAP_POINTS = {
  backWheel: { x: 0.31, y: 0.58, radius: 0.09 },
  basket: { x: 0.83, y: 0.45, radius: 0.08 },
  bell: { x: 0.76, y: 0.27, radius: 0.07 },
  brakes: { x: 0.74, y: 0.48, radius: 0.08 },
  chain: { x: 0.5, y: 0.62, radius: 0.085 },
  crank: { x: 0.52, y: 0.59, radius: 0.075 },
  frame: { x: 0.5, y: 0.5, radius: 0.11 },
  frontWheel: { x: 0.7, y: 0.58, radius: 0.09 },
  handlebar: { x: 0.74, y: 0.34, radius: 0.08 },
  pedals: { x: 0.52, y: 0.61, radius: 0.075 },
  saddle: { x: 0.48, y: 0.33, radius: 0.075 },
}

// Assembly snap radii tuning lives here. Playtest Settings multiply snap radii live.
const ASSEMBLY_TRAY_RADIUS = 0.052
const ASSEMBLY_SELECT_COOLDOWN_MS = 420
const ASSEMBLY_PLACE_COOLDOWN_MS = 520
const ASSEMBLY_PLACE_GRACE_MS = 240
const ASSEMBLY_DESELECT_MS = 950

const ASSEMBLY_PLACE_HINTS = {
  backWheel: 'Place the Rear Wheel on the rear wheel circle.',
  basket: 'Place the Basket at the front of the bike.',
  bell: 'Place the Bell near the handlebar.',
  brakes: 'Place the Brakes near the handlebar and wheels.',
  chain: 'Place the Chain along the lower frame.',
  crank: 'Place the Crank at the pedal hub.',
  frame: 'Place the Frame in the center triangle.',
  frontWheel: 'Place the Front Wheel on the front wheel circle.',
  handlebar: 'Place the Handlebar at the front top.',
  pedals: 'Place the Pedals at the lower center.',
  saddle: 'Place the Saddle on top of the frame.',
}

export const TOTAL_PARTS = BIKE_PARTS.length

export function useBikeGame({ handReach, isRunning, partProjectionRef, playerWorldRef, playtestSettings }) {
  const animationRef = useRef(0)
  const assemblyCooldownUntilRef = useRef(0)
  const assemblyDeselectAtRef = useRef(0)
  const assemblySnapGraceUntilRef = useRef({})
  const bestScoreRef = useRef(0)
  const gameRef = useRef(createReadyGame())
  const graceUntilRef = useRef({})
  const handReachRef = useRef(handReach)
  const lastFrameRef = useRef(0)
  const tickRef = useRef(null)

  const [game, setGame] = useState(createReadyGame)

  const partByKind = useMemo(
    () => Object.fromEntries(BIKE_PARTS.map((part) => [part.kind, part])),
    []
  )

  const commitGame = useCallback((nextGame) => {
    gameRef.current = nextGame
    setGame(nextGame)
  }, [])

  const startRound = useCallback(() => {
    if (!isRunning) {
      return
    }

    graceUntilRef.current = {}
    assemblyCooldownUntilRef.current = 0
    assemblyDeselectAtRef.current = 0
    assemblySnapGraceUntilRef.current = {}
    lastFrameRef.current = 0
    if (partProjectionRef?.current) {
      partProjectionRef.current = {}
    }
    commitGame(createCollectingGame(bestScoreRef.current))
  }, [commitGame, isRunning, partProjectionRef])

  const resetRound = useCallback(() => {
    graceUntilRef.current = {}
    assemblyCooldownUntilRef.current = 0
    assemblyDeselectAtRef.current = 0
    assemblySnapGraceUntilRef.current = {}
    lastFrameRef.current = 0
    if (partProjectionRef?.current) {
      partProjectionRef.current = {}
    }
    commitGame(createReadyGame(bestScoreRef.current))
  }, [commitGame, partProjectionRef])

  const showAssemblyPreview = useCallback(() => {
    const currentGame = gameRef.current

    if (currentGame.status !== 'searchComplete') {
      return
    }

    commitGame({
      ...currentGame,
      assemblyBaseScore: currentGame.score,
      assemblyFeedback: '',
      assemblyHint: 'Reach toward a part in the tray to select it.',
      assemblyHoverSnap: '',
      assemblyHoverTray: '',
      assemblyLastInstalled: '',
      assemblyMessage: 'Select a part, then move it to the highlighted snap point.',
      assemblySelected: '',
      status: 'assemblyPreview',
    })
  }, [commitGame])

  const resetAssembly = useCallback(() => {
    const currentGame = gameRef.current

    if (!isRunning || currentGame.found.length !== TOTAL_PARTS) {
      return
    }

    assemblyCooldownUntilRef.current = 0
    assemblyDeselectAtRef.current = 0
    assemblySnapGraceUntilRef.current = {}
    commitGame({
      ...currentGame,
      assembled: [],
      assemblyFeedback: '',
      assemblyFeedbackId: currentGame.assemblyFeedbackId + 1,
      assemblyBaseScore: currentGame.assemblyBaseScore,
      assemblyHint: 'Reach toward a part in the tray to select it.',
      assemblyHoverSnap: '',
      assemblyHoverTray: '',
      assemblyLastInstalled: '',
      assemblyMessage: 'Select a part, then move it to the highlighted snap point.',
      assemblySelected: '',
      score: currentGame.assemblyBaseScore,
      status: 'assemblyPreview',
    })
  }, [commitGame, isRunning])

  useEffect(() => {
    handReachRef.current = handReach
  }, [handReach])

  const assemblePart = useCallback(
    (kind) => {
      const currentGame = gameRef.current

      if (currentGame.status !== 'assembling') {
        return
      }

      const expectedKind = ASSEMBLY_ORDER[currentGame.assembled.length]

      if (kind !== expectedKind) {
        commitGame({
          ...currentGame,
          assemblyMessage: `Další díl: ${partByKind[expectedKind].label}`,
        })
        return
      }

      const assembled = [...currentGame.assembled, kind]
      const isComplete = assembled.length === TOTAL_PARTS
      const score = currentGame.score + 25 + assembled.length * 5
      const bestScore = Math.max(bestScoreRef.current, score)
      bestScoreRef.current = bestScore

      commitGame({
        ...currentGame,
        assembled,
        assemblyMessage: isComplete
          ? 'Kolo je připravené na první klidnou vyjížďku'
          : `Další díl: ${partByKind[ASSEMBLY_ORDER[assembled.length]].label}`,
        bestScore,
        score,
        status: isComplete ? 'complete' : 'assembling',
        unlockMessage: isComplete ? UNLOCK_MESSAGE : currentGame.unlockMessage,
      })
    },
    [commitGame, partByKind]
  )

  const tick = useCallback(
    (timestamp) => {
      const currentGame = gameRef.current

      if (!isRunning) {
        return
      }

      if (currentGame.status === 'assemblyPreview') {
        const nextGame = updateAssemblyGame(
          currentGame,
          handReachRef.current,
          timestamp,
          assemblyCooldownUntilRef,
          assemblyDeselectAtRef,
          assemblySnapGraceUntilRef,
          playtestSettings
        )

        if (nextGame !== currentGame) {
          const bestScore = Math.max(bestScoreRef.current, nextGame.score)
          bestScoreRef.current = bestScore
          commitGame({
            ...nextGame,
            bestScore,
          })
        }

        if (tickRef.current && gameRef.current.status === 'assemblyPreview') {
          animationRef.current = requestAnimationFrame(tickRef.current)
        }
        return
      }

      if (currentGame.status !== 'collecting') {
        return
      }

      const lastFrame = lastFrameRef.current || timestamp
      const deltaSeconds = Math.min((timestamp - lastFrame) / 1000, 0.05)
      lastFrameRef.current = timestamp

      const player = getPlayerWorld(playerWorldRef.current)
      const currentHandReach = handReachRef.current
      const debugCandidates = []
      const nextItems = []
      let found = currentGame.found
      let lastFound = currentGame.lastFound
      let score = currentGame.score
      let streak = currentGame.streak
      let collectedCount = 0

      for (const item of currentGame.items) {
        const projection = partProjectionRef?.current?.[item.id]
        const nextItem = {
          ...item,
          ...(player ? getProjectedHint(item, player) : null),
          ...(projection ? getProjectedPartState(projection) : null),
        }
        const settings = getPickupSettings(nextItem, playtestSettings)
        const worldDistance = player ? getWorldDistance(nextItem, player) : Number.POSITIVE_INFINITY
        const screenDistance = getScreenDistance(nextItem, currentHandReach)
        const playerClose = worldDistance <= player.radius + settings.worldRadius
        const handVisible = Boolean(currentHandReach?.visible)
        const handNear = playerClose && handVisible && screenDistance <= settings.handNearRadius
        const handOver = playerClose && handVisible && screenDistance <= settings.screenRadius

        if (handOver) {
          graceUntilRef.current[nextItem.id] = timestamp + PICKUP_GRACE_MS
        }

        const inGrace = playerClose && handVisible && timestamp <= (graceUntilRef.current[nextItem.id] ?? 0)
        const pickupReady = handOver || inGrace
        const pickupState = getPickupState({ handNear, handVisible, pickupReady, playerClose })
        const reachProximity = getReachProximity(nextItem, currentHandReach, settings)

        nextItem.debug = {
          handVisible,
          pickupReady,
          screenDistance,
          worldDistance,
        }
        nextItem.glow = getItemGlow(nextItem, playerClose, reachProximity, pickupState)
        nextItem.nearPrompt = pickupState === 'nearby'
        nextItem.pickupReady = pickupReady
        nextItem.pickupState = pickupState
        nextItem.reachPrompt = pickupState === 'handNear'

        debugCandidates.push({
          id: nextItem.id,
          kind: nextItem.kind,
          pickupReady,
          pickupState,
          screenDistance,
          worldDistance,
        })

        if (pickupReady) {
          streak += 1
          found = [...found, nextItem.kind]
          lastFound = nextItem.label
          score += 22 + Math.min(streak, 6) * 5
          collectedCount += 1
          graceUntilRef.current[nextItem.id] = 0
        } else {
          nextItems.push(nextItem)
        }
      }

      const allFound = found.length === TOTAL_PARTS
      const timeLeft = Math.max(0, currentGame.timeLeft - deltaSeconds)
      const failed = timeLeft <= 0
      const status = allFound ? 'searchComplete' : failed ? 'failed' : 'collecting'
      const bestScore = Math.max(bestScoreRef.current, score)
      bestScoreRef.current = bestScore

      commitGame({
        ...currentGame,
        assemblyMessage: allFound
          ? 'Next step: assemble the bike.'
          : currentGame.assemblyMessage,
        bestScore,
        comboMessage: getComboMessage(streak, collectedCount),
        culturalFact: allFound ? COMPLETION_FACT : currentGame.culturalFact,
        feedbackId: currentGame.feedbackId + collectedCount,
        found,
        items: status === 'collecting' ? nextItems : [],
        lastFound,
        missed: 0,
        pickupDebug: createPickupDebug(debugCandidates, currentHandReach),
        score,
        status,
        streak,
        timeLeft,
      })

      if (status === 'collecting' && tickRef.current) {
        animationRef.current = requestAnimationFrame(tickRef.current)
      }
    },
    [commitGame, isRunning, partProjectionRef, playerWorldRef, playtestSettings]
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
    if (!isRunning || (game.status !== 'collecting' && game.status !== 'assemblyPreview')) {
      return undefined
    }

    cancelAnimationFrame(animationRef.current)
    animationRef.current = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(animationRef.current)
    }
  }, [game.status, isRunning, tick])

  return {
    assemblePart,
    game,
    resetAssembly,
    resetRound,
    showAssemblyPreview,
    startRound,
  }
}

function createReadyGame(bestScore = 0) {
  return {
    assembled: [],
    assemblyBaseScore: 0,
    assemblyFeedback: '',
    assemblyFeedbackId: 0,
    assemblyHint: 'Collect every part before assembly.',
    assemblyHoverSnap: '',
    assemblyHoverTray: '',
    assemblyLastInstalled: '',
    assemblyMessage: 'Nejdřív najdi všechny součástky kola',
    assemblySelected: '',
    bestScore,
    comboMessage: '',
    culturalFact: '',
    feedbackId: 0,
    found: [],
    items: [],
    lastFound: '',
    missed: 0,
    pickupDebug: createEmptyPickupDebug(),
    roundSeconds: ROUND_SECONDS,
    score: 0,
    status: 'ready',
    streak: 0,
    timeLeft: ROUND_SECONDS,
    unlockMessage: '',
  }
}

function updateAssemblyGame(
  currentGame,
  handReach,
  timestamp,
  assemblyCooldownUntilRef,
  assemblyDeselectAtRef,
  assemblySnapGraceUntilRef,
  playtestSettings
) {
  const handVisible = Boolean(handReach?.visible)
  const selectedKind = currentGame.assemblySelected
  const assembled = currentGame.assembled
  const availableKinds = currentGame.found.filter((kind) => !assembled.includes(kind))
  const traySlots = getAssemblyTraySlots(currentGame.found)
  const snapRadiusMultiplier = getAssemblySnapRadiusMultiplier(playtestSettings)
  const deselectTimeoutMs = getDeselectTimeoutMs(playtestSettings)
  const hoverTray = handVisible
    ? traySlots.find((slot) => availableKinds.includes(slot.kind) && getPointDistance(slot, handReach) <= ASSEMBLY_TRAY_RADIUS)
    : null
  const correctSnap = selectedKind ? ASSEMBLY_SNAP_POINTS[selectedKind] : null
  const hoverCorrectSnap = handVisible && correctSnap
    ? getPointDistance(correctSnap, handReach) <= correctSnap.radius * snapRadiusMultiplier
    : false
  const hoverWrongSnap = handVisible && selectedKind
    ? Object.entries(ASSEMBLY_SNAP_POINTS).some(([kind, snap]) => (
      kind !== selectedKind && getPointDistance(snap, handReach) <= snap.radius * snapRadiusMultiplier * 0.86
    ))
    : false
  const hoverAnySnap = handVisible
    ? Object.values(ASSEMBLY_SNAP_POINTS).some((snap) => getPointDistance(snap, handReach) <= snap.radius * snapRadiusMultiplier * 0.92)
    : false
  const onCooldown = timestamp < assemblyCooldownUntilRef.current
  const graceUntil = selectedKind ? (assemblySnapGraceUntilRef.current[selectedKind] ?? 0) : 0
  const inPlacementGrace = selectedKind && timestamp <= graceUntil
  const placementReady = (hoverCorrectSnap || inPlacementGrace) && !onCooldown
  let nextGame = currentGame

  if (hoverCorrectSnap && selectedKind) {
    assemblySnapGraceUntilRef.current[selectedKind] = timestamp + ASSEMBLY_PLACE_GRACE_MS
  }

  if (!handVisible && !placementReady) {
    assemblyDeselectAtRef.current = 0
    nextGame = patchAssemblyGame(nextGame, {
      assemblyHint: selectedKind
        ? `Show your hand. ${getAssemblyPlaceHint(selectedKind)}`
        : 'Show your hand and reach toward a part in the tray.',
      assemblyHoverSnap: '',
      assemblyHoverTray: '',
    })
    return nextGame
  }

  if (!selectedKind && hoverTray && !onCooldown) {
    assemblyCooldownUntilRef.current = timestamp + ASSEMBLY_SELECT_COOLDOWN_MS
    return patchAssemblyGame(nextGame, {
      assemblyFeedback: `Selected: ${getPartLabel(hoverTray.kind)}`,
      assemblyFeedbackId: currentGame.assemblyFeedbackId + 1,
      assemblyHint: getAssemblyPlaceHint(hoverTray.kind),
      assemblyHoverSnap: hoverTray.kind,
      assemblyHoverTray: hoverTray.kind,
      assemblyLastInstalled: '',
      assemblySelected: hoverTray.kind,
    })
  }

  if (selectedKind && placementReady) {
    const nextAssembled = [...assembled, selectedKind]
    const isComplete = nextAssembled.length === TOTAL_PARTS
    const score = currentGame.assemblyBaseScore + nextAssembled.length * 35 + nextAssembled.length * 8
    assemblyCooldownUntilRef.current = timestamp + ASSEMBLY_PLACE_COOLDOWN_MS
    assemblyDeselectAtRef.current = 0
    assemblySnapGraceUntilRef.current[selectedKind] = 0

    return patchAssemblyGame(nextGame, {
      assembled: nextAssembled,
      assemblyFeedback: isComplete
        ? 'Bike assembled!'
        : `${getPartLabel(selectedKind)} installed!`,
      assemblyFeedbackId: currentGame.assemblyFeedbackId + 1,
      assemblyHint: isComplete
        ? 'The bike is complete.'
        : 'Reach toward another part in the tray.',
      assemblyHoverSnap: '',
      assemblyHoverTray: '',
      assemblyLastInstalled: selectedKind,
      assemblyMessage: isComplete
        ? 'Congratulations! You assembled the bike.'
        : 'Select a part, then move it to the highlighted snap point.',
      assemblySelected: '',
      culturalFact: isComplete ? COMPLETION_FACT : currentGame.culturalFact,
      score,
      status: isComplete ? 'complete' : 'assemblyPreview',
      unlockMessage: isComplete ? UNLOCK_MESSAGE : currentGame.unlockMessage,
    })
  }

  if (selectedKind && handVisible && !hoverTray && !hoverAnySnap && !onCooldown) {
    if (!assemblyDeselectAtRef.current) {
      assemblyDeselectAtRef.current = timestamp + deselectTimeoutMs
    }

    if (timestamp >= assemblyDeselectAtRef.current) {
      assemblyDeselectAtRef.current = 0
      return patchAssemblyGame(nextGame, {
        assemblyFeedback: `${getPartLabel(selectedKind)} deselected`,
        assemblyFeedbackId: currentGame.assemblyFeedbackId + 1,
        assemblyHint: 'Reach toward a part in the tray to select it.',
        assemblyHoverSnap: '',
        assemblyHoverTray: '',
        assemblySelected: '',
      })
    }
  } else {
    assemblyDeselectAtRef.current = 0
  }

  return patchAssemblyGame(nextGame, {
    assemblyHint: getAssemblyHint({ hoverTray, hoverWrongSnap, selectedKind }),
    assemblyHoverSnap: selectedKind || '',
    assemblyHoverTray: hoverTray?.kind ?? '',
  })
}

function getAssemblyHint({ hoverTray, hoverWrongSnap, selectedKind }) {
  if (selectedKind && hoverWrongSnap) {
    return 'Move this part to the highlighted spot.'
  }

  if (selectedKind) {
    return getAssemblyPlaceHint(selectedKind)
  }

  if (hoverTray) {
    return `Hold on ${getPartLabel(hoverTray.kind)} to select it.`
  }

  return 'Reach toward a part in the tray to select it.'
}

function getAssemblyPlaceHint(kind) {
  return ASSEMBLY_PLACE_HINTS[kind] ?? `Place ${getPartLabel(kind)} on the highlighted spot.`
}

function patchAssemblyGame(currentGame, patch) {
  const hasChange = Object.entries(patch).some(([key, value]) => currentGame[key] !== value)

  return hasChange ? { ...currentGame, ...patch } : currentGame
}

function getAssemblyTraySlots(kinds) {
  return kinds.map((kind, index) => {
    const row = Math.floor(index / 6)
    const column = index % 6

    return {
      kind,
      x: 0.17 + column * 0.132,
      y: 0.82 + row * 0.095,
    }
  })
}

function getPointDistance(point, handReach) {
  return Math.hypot(point.x - handReach.x, point.y - handReach.y)
}

function getPartLabel(kind) {
  return BIKE_PARTS.find((part) => part.kind === kind)?.label ?? kind
}

function getComboMessage(streak, collectedCount) {
  if (collectedCount === 0) {
    return ''
  }

  if (streak >= 4) {
    return `${streak} dílů v řadě`
  }

  return 'Součástka sebrána'
}

function createCollectingGame(bestScore = 0) {
  return {
    ...createReadyGame(bestScore),
    items: createStreetParts(),
    status: 'collecting',
  }
}

function createStreetParts() {
  const partByKind = Object.fromEntries(BIKE_PARTS.map((part) => [part.kind, part]))

  return STREET_PART_LAYOUT.map((item, index) => {
    const part = partByKind[item.kind]

    return {
      ...item,
      glow: 0,
      hintX: 0.5,
      hintY: 0.5,
      id: index,
      label: part.label,
      shortLabel: part.shortLabel,
    }
  })
}

function getPlayerWorld(playerWorld) {
  const x = Number(playerWorld?.dataset.x)
  const z = Number(playerWorld?.dataset.z)

  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    return null
  }

  return {
    radius: 1.05,
    x,
    z,
  }
}

function getWorldDistance(item, player) {
  if (!player) {
    return Number.POSITIVE_INFINITY
  }

  return Math.hypot(item.worldX - player.x, item.worldZ - player.z)
}

function getProjectedHint(item, player) {
  const depth = Math.max(2.5, Math.abs(item.worldZ - player.z))
  const x = 0.5 + (item.worldX - player.x) / (depth * 0.34 + 4.8)
  const y = 0.76 - Math.min(depth, 18) / 44

  return {
    hintX: Math.min(Math.max(x, 0.12), 0.88),
    hintY: Math.min(Math.max(y, 0.2), 0.82),
  }
}

function getProjectedPartState(projection) {
  return {
    hintX: projection.screenX,
    hintY: projection.screenY,
    screenX: projection.screenX,
    screenY: projection.screenY,
    visibleOnScreen: projection.visibleOnScreen,
  }
}

function getReachProximity(item, handReach, settings = getPickupSettings(item)) {
  if (!handReach?.visible || !item.visibleOnScreen) {
    return 0
  }

  return Math.max(0, 1 - getScreenDistance(item, handReach) / settings.handNearRadius)
}

function getScreenDistance(item, handReach) {
  const screenX = Number(item.screenX)
  const screenY = Number(item.screenY)

  if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) {
    return Number.POSITIVE_INFINITY
  }

  return Math.hypot(screenX - handReach.x, screenY - handReach.y)
}

function getItemGlow(item, playerClose, reachProximity, pickupState) {
  if (pickupState === 'collectible') {
    return 1
  }

  if (!playerClose) {
    return 0.05
  }

  if (pickupState === 'handNear') {
    return Math.max(0.62, reachProximity)
  }

  return Math.max(0.52, reachProximity * 0.5)
}

function getPickupSettings(item, playtestSettings) {
  const settings = PICKUP_SETTINGS[item.kind] ?? DEFAULT_PICKUP_SETTINGS
  const pickupMultiplier = clampNumber(playtestSettings?.pickupScreenRadiusMultiplier ?? 1, 0.6, 1.8)

  return {
    ...settings,
    screenRadius: settings.screenRadius * pickupMultiplier,
  }
}

function getAssemblySnapRadiusMultiplier(playtestSettings) {
  return clampNumber(playtestSettings?.assemblySnapRadiusMultiplier ?? 1, 0.6, 1.8)
}

function getDeselectTimeoutMs(playtestSettings) {
  return clampNumber(playtestSettings?.deselectTimeoutMs ?? ASSEMBLY_DESELECT_MS, 400, 1800)
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(Number(value) || min, min), max)
}

function getPickupState({ handNear, handVisible, pickupReady, playerClose }) {
  if (pickupReady) {
    return 'collectible'
  }

  if (handNear) {
    return 'handNear'
  }

  if (playerClose && handVisible) {
    return 'nearby'
  }

  if (playerClose) {
    return 'nearby'
  }

  return 'hidden'
}

function createPickupDebug(candidates, handReach) {
  const nearest = candidates
    .filter((candidate) => Number.isFinite(candidate.worldDistance))
    .sort((candidateA, candidateB) => candidateA.worldDistance - candidateB.worldDistance)[0]

  return {
    handVisible: Boolean(handReach?.visible),
    handX: handReach?.visible ? handReach.x : null,
    handY: handReach?.visible ? handReach.y : null,
    nearestPartDistance: nearest?.worldDistance ?? null,
    nearestPartId: nearest?.id ?? null,
    nearestPartKind: nearest?.kind ?? '',
    pickupReady: Boolean(nearest?.pickupReady),
    pickupState: nearest?.pickupState ?? 'hidden',
    screenOverlapDistance: Number.isFinite(nearest?.screenDistance) ? nearest.screenDistance : null,
  }
}

function createEmptyPickupDebug() {
  return {
    handVisible: false,
    handX: null,
    handY: null,
    nearestPartDistance: null,
    nearestPartId: null,
    nearestPartKind: '',
    pickupReady: false,
    pickupState: 'hidden',
    screenOverlapDistance: null,
  }
}
