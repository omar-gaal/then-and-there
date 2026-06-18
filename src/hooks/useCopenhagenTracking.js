// Webcam tracking hook: runs MediaPipe hand/pose detection and exposes motion/debug state.
import { useEffect, useRef, useState } from 'react'
import {
  READY_STATUS,
  clearCanvas,
  createHandLandmarker,
  createPoseLandmarker,
  drawTracking,
  resizeCanvasToVideo,
} from '../handTracking'
import { getHandGesture, movePuckWithGesture } from '../gestures'

const WALK_THRESHOLD = 0.34
const IDLE_DEADZONE = 0.04
const MAX_WALK_SPEED = 0.28
const SPEED_SMOOTHING = 0.18
const BODY_LEAN_DEADZONE = 0.04
const MAX_SIDE_SPEED = 0.22
const SIDE_SPEED_SMOOTHING = 0.2
const LEAN_AUTO_CALIBRATE_AFTER_MS = 1000
const LEAN_AUTO_CALIBRATE_SMOOTHING = 0.018
const IDLE_HOLD_MS = 260
const MIN_WALK_SPEED = 0.08
const KNEE_LIFT_THRESHOLD = 0.04
const MOTION_INTENSITY_SCALE = 10.5

export function useCopenhagenTracking({ playtestSettings } = {}) {
  const webcamRef = useRef(null)
  const canvasRef = useRef(null)
  const puckRef = useRef(null)
  const handLandmarkerRef = useRef(null)
  const poseLandmarkerRef = useRef(null)
  const playtestSettingsRef = useRef(playtestSettings)
  const animationRef = useRef(0)
  const lastVideoTimeRef = useRef(-1)
  const bodyLeanRef = useRef({
    autoCalibrating: false,
    idleSince: 0,
    neutralCenterX: null,
    sideMovement: 0,
  })
  const legMotionRef = useRef({
    lastLeftKneeY: null,
    lastRightKneeY: null,
    lastStepSign: 0,
    lastSwitchTime: 0,
    motionAmount: 0,
    stepEnergy: 0,
  })
  const armSwingRef = useRef({
    lastLeftWristY: null,
    lastRightWristY: null,
    lastSwingSign: 0,
    lastSwitchTime: 0,
    swingEnergy: 0,
  })
  const motionIntensityRef = useRef({
    ankleMotion: 0,
    idleDetected: false,
    idleSince: 0,
    intensity: 0,
    previous: null,
    rawIntensity: 0,
    speedMultiplier: 0,
    wristMotion: 0,
  })
  const smoothedMotionRef = useRef(READY_STATUS.motion)
  const smoothedReachRef = useRef(READY_STATUS.handReach)
  const performanceRef = useRef(READY_STATUS.performance)

  const [isRunning, setIsRunning] = useState(false)
  const [tracking, setTracking] = useState(READY_STATUS)

  function resetBodyLeanCenter() {
    bodyLeanRef.current = {
      autoCalibrating: false,
      idleSince: 0,
      neutralCenterX: null,
      sideMovement: 0,
    }
  }

  function stopCamera() {
    cancelAnimationFrame(animationRef.current)

    animationRef.current = 0
    lastVideoTimeRef.current = -1
    resetBodyLeanCenter()
    performanceRef.current = {
      ...performanceRef.current,
      mediaPipeActive: false,
    }

    clearCanvas(canvasRef.current)
    showSearchingPuck(puckRef.current)
    setIsRunning(false)
    setTracking(READY_STATUS)
  }

  function runFrameLoop() {
    const video = webcamRef.current?.video
    const canvas = canvasRef.current
    const puck = puckRef.current
    const handLandmarker = handLandmarkerRef.current
    const poseLandmarker = poseLandmarkerRef.current

    if (!video || !canvas || !puck || !handLandmarker || !poseLandmarker) {
      return
    }

    resizeCanvasToVideo(canvas, video)

    if (hasNewVideoFrame(video, lastVideoTimeRef.current)) {
      const frameStartedAt = performance.now()
      lastVideoTimeRef.current = video.currentTime
      const timestamp = performance.now()
      const handStartedAt = performance.now()
      const results = handLandmarker.detectForVideo(video, timestamp)
      const handMs = performance.now() - handStartedAt
      const poseStartedAt = performance.now()
      const poseResults = poseLandmarker.detectForVideo(video, timestamp)
      const poseMs = performance.now() - poseStartedAt
      const postStartedAt = performance.now()
      const hands = createTrackedHands(results)
      const activeHand = chooseActiveHand(hands)
      const landmarks = activeHand?.landmarks
      const poseLandmarks = poseResults.landmarks?.[0]
      const poseTracking = updatePoseMotion(
        poseLandmarks,
        bodyLeanRef,
        smoothedMotionRef,
        legMotionRef,
        armSwingRef,
        motionIntensityRef
      )
      // Hand smoothing tuning lives here; Playtest Settings can adjust it live.
      const handReach = updateHandReach(activeHand, smoothedReachRef, playtestSettingsRef.current)
      const trackingPerformance = updateTrackingPerformance(performanceRef, {
        frameMs: performance.now() - frameStartedAt,
        handMs,
        poseMs,
        postMs: performance.now() - postStartedAt,
      })

      if (landmarks) {
        drawTracking(canvas, results.landmarks, poseLandmarks)
        const gesture = getHandGesture(landmarks)

        movePuckWithGesture(gesture, puck)
        setTracking(createTrackingStatus(results, gesture, poseLandmarks, poseTracking, hands, activeHand, handReach, trackingPerformance))
      } else {
        if (poseLandmarks) {
          drawTracking(canvas, null, poseLandmarks)
        } else {
          clearCanvas(canvas)
        }
        showSearchingPuck(puck)
        setTracking(createSearchingStatus(poseLandmarks, poseTracking, hands, handReach, trackingPerformance))
      }
    }

    animationRef.current = requestAnimationFrame(runFrameLoop)
  }

  async function startCamera() {
    if (isRunning || tracking.mode === 'loading') {
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setTracking(createErrorStatus('Camera unavailable'))
      return
    }

    setTracking({
      ...READY_STATUS,
      mode: 'loading',
      label: 'Loading model',
    })
    resetBodyLeanCenter()

    try {
      if (!handLandmarkerRef.current) {
        handLandmarkerRef.current = await createHandLandmarker()
      }

      if (!poseLandmarkerRef.current) {
        poseLandmarkerRef.current = await createPoseLandmarker()
      }

      setIsRunning(true)
      setTracking(createSearchingStatus())
    } catch (error) {
      console.error(error)
      stopCamera()
      setTracking(createErrorStatus(getCameraErrorLabel(error)))
    }
  }

  function handleCameraReady() {
    cancelAnimationFrame(animationRef.current)
    runFrameLoop()
  }

  function handleCameraError(error) {
    console.error(error)
    stopCamera()
    setTracking(createErrorStatus(getCameraErrorLabel(error)))
  }

  useEffect(() => {
    showSearchingPuck(puckRef.current)

    return () => {
      cancelAnimationFrame(animationRef.current)
      handLandmarkerRef.current?.close()
      poseLandmarkerRef.current?.close()
    }
  }, [])

  useEffect(() => {
    playtestSettingsRef.current = playtestSettings
  }, [playtestSettings])

  return {
    canvasRef,
    handleCameraError,
    handleCameraReady,
    isLoading: tracking.mode === 'loading',
    isRunning,
    puckRef,
    startCamera,
    stopCamera,
    resetBodyLeanCenter,
    tracking,
    webcamRef,
  }
}

function hasNewVideoFrame(video, lastVideoTime) {
  return (
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    video.videoWidth > 0 &&
    video.currentTime !== lastVideoTime
  )
}

function showSearchingPuck(puck) {
  puck?.setAttribute('data-searching', 'true')
  puck?.removeAttribute('data-gripped')
}

function createSearchingStatus(
  poseLandmarks,
  poseTracking = createEmptyPoseTracking(),
  hands = createEmptyHands(),
  handReach = READY_STATUS.handReach,
  performance = READY_STATUS.performance
) {
  return {
    ...READY_STATUS,
    mode: 'searching',
    label: 'Looking for hand',
    body: poseLandmarks ? getBodyLabel(poseTracking.motion) : READY_STATUS.body,
    leftHand: hands.leftHand,
    rightHand: hands.rightHand,
    activeHand: null,
    handReach,
    bodyCenter: poseTracking.bodyCenter,
    pose: poseTracking.pose,
    motion: poseTracking.motion,
    performance,
  }
}

function createTrackingStatus(results, gesture, poseLandmarks, poseTracking, hands, activeHand, handReach, performance = READY_STATUS.performance) {
  const hand = activeHand?.summary ?? results.handednesses?.[0]?.[0]

  return {
    mode: 'tracking',
    label: gesture.isPinching ? 'Pinch active' : gesture.name,
    hand: hand?.handedness ?? hand?.categoryName ?? 'Hand',
    confidence: hand?.confidence ?? hand?.score ?? gesture.grip,
    gesture: gesture.name,
    body: poseLandmarks ? getBodyLabel(poseTracking.motion) : READY_STATUS.body,
    leftHand: hands.leftHand,
    rightHand: hands.rightHand,
    activeHand: activeHand?.summary ?? null,
    handReach,
    bodyCenter: poseTracking.bodyCenter,
    pose: poseTracking.pose,
    motion: poseTracking.motion,
    performance,
    pinching: gesture.isPinching,
  }
}

function updateTrackingPerformance(performanceRef, sample) {
  performanceRef.current = {
    avgFrameMs: smoothPerformanceMetric(performanceRef.current.avgFrameMs, sample.frameMs),
    avgHandMs: smoothPerformanceMetric(performanceRef.current.avgHandMs, sample.handMs),
    avgPoseMs: smoothPerformanceMetric(performanceRef.current.avgPoseMs, sample.poseMs),
    avgPostMs: smoothPerformanceMetric(performanceRef.current.avgPostMs, sample.postMs),
    mediaPipeActive: true,
  }

  return performanceRef.current
}

function smoothPerformanceMetric(current, next, smoothing = 0.16) {
  if (!Number.isFinite(current) || current === 0) {
    return next
  }

  return current + (next - current) * smoothing
}

function createErrorStatus(label) {
  return {
    ...READY_STATUS,
    mode: 'error',
    label,
  }
}

function getCameraErrorLabel(error) {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'Camera blocked'
  }

  return 'Tracking failed'
}

function updatePoseMotion(
  poseLandmarks,
  bodyLeanRef,
  smoothedMotionRef,
  legMotionRef,
  armSwingRef,
  motionIntensityRef
) {
  if (!poseLandmarks) {
    return {
      ...createEmptyPoseTracking(),
      motion: smoothMotion(smoothedMotionRef, READY_STATUS.motion, 0.08),
    }
  }

  const leftShoulder = poseLandmarks[11]
  const rightShoulder = poseLandmarks[12]
  const leftElbow = poseLandmarks[13]
  const rightElbow = poseLandmarks[14]
  const leftWrist = poseLandmarks[15]
  const rightWrist = poseLandmarks[16]
  const leftHip = poseLandmarks[23]
  const rightHip = poseLandmarks[24]
  const leftKnee = poseLandmarks[25]
  const rightKnee = poseLandmarks[26]
  const leftAnkle = poseLandmarks[27]
  const rightAnkle = poseLandmarks[28]

  if (!leftShoulder || !rightShoulder) {
    return {
      ...createEmptyPoseTracking(),
      motion: smoothMotion(smoothedMotionRef, READY_STATUS.motion, 0.08),
    }
  }

  const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2
  const hipCenterX = leftHip && rightHip ? (leftHip.x + rightHip.x) / 2 : shoulderCenterX
  const rawBodyCenterX = (shoulderCenterX + hipCenterX) / 2
  const bodyCenterX = 1 - clamp(rawBodyCenterX, 0, 1)

  const handsUp = getHandsUpForMotion({ leftShoulder, leftWrist, rightShoulder, rightWrist })
  const bending = getBendingForMotion({ leftHip, leftKnee, leftWrist, rightHip, rightKnee, rightWrist })
  const legMotion = getLegMotion({ leftAnkle, leftKnee, leftHip, rightAnkle, rightKnee, rightHip }, legMotionRef)
  const armMotion = getArmSwingMotion({ leftShoulder, leftWrist, rightShoulder, rightWrist }, armSwingRef)
  const motionIntensity = getMotionIntensity(
    { leftAnkle, leftElbow, leftKnee, leftWrist, rightAnkle, rightElbow, rightKnee, rightWrist },
    motionIntensityRef
  )
  const walkingSignal = Math.max(legMotion.walkingConfidence, armMotion.armSwingConfidence)
  const hasSimpleWalkingPattern =
    legMotion.alternating ||
    legMotion.ankleMotion > 0.035 ||
    armMotion.alternating ||
    armMotion.armSwingConfidence > 0.45
  const idleDetected =
    motionIntensity.idleDetected ||
    (
      motionIntensity.intensity < IDLE_DEADZONE &&
      legMotion.motionAmount < 0.08 &&
      armMotion.wristMotion < 0.022 &&
      motionIntensity.ankleMotion < 0.02
    )
  const bodyLean = getBodyLeanSideMovement(bodyCenterX, bodyLeanRef, idleDetected)
  const walkingConfidence = idleDetected || bending || handsUp ? 0 : walkingSignal
  const walking =
    !idleDetected &&
    !bending &&
    !handsUp &&
    hasSimpleWalkingPattern &&
    walkingConfidence >= WALK_THRESHOLD &&
    motionIntensity.intensity >= IDLE_DEADZONE
  const motionSpeedScore = clamp(
    (motionIntensity.intensity - IDLE_DEADZONE) / Math.max(1 - IDLE_DEADZONE, 0.001),
    0,
    1,
  )
  const activeSpeed = walking
    ? clamp(
        MIN_WALK_SPEED + walkingConfidence * 0.08 + motionSpeedScore * 0.16,
        0,
        MAX_WALK_SPEED
      )
    : 0
  const trackingStable = Boolean(
    leftHip &&
    rightHip &&
    leftKnee &&
    rightKnee &&
    leftAnkle &&
    rightAnkle &&
    motionIntensity.rawIntensity < 0.75
  )

  return {
    bodyCenter: {
      visible: true,
      x: bodyCenterX,
      y: clamp(((leftShoulder.y + rightShoulder.y) / 2 + (leftHip?.y ?? leftShoulder.y) + (rightHip?.y ?? rightShoulder.y)) / 4, 0, 1),
    },
    motion: smoothMotion(
      smoothedMotionRef,
      {
        bodyDirection: 'forward',
        bodyCenterX,
        bending,
        armSwingConfidence: armMotion.armSwingConfidence,
        directionX: 0,
        directionZ: -1,
        finalDirectionX: 0,
        forward: walking ? 1 : 0,
        handsUp,
        idleDetected,
        idleDriftBlocked: !walking && (walkingConfidence > 0.02 || motionIntensity.intensity > 0.015),
        kneeMotionAmount: legMotion.motionAmount,
        kneeWalkingConfidence: legMotion.walkingConfidence,
        lateral: bodyLean.sideMovement,
        leanAmount: bodyLean.leanAmount,
        leanLeft: bodyLean.leanLeft,
        leanRight: bodyLean.leanRight,
        autoCalibrating: bodyLean.autoCalibrating,
        leftKneeHeight: legMotion.leftKneeHeight,
        finalSpeed: activeSpeed,
        motionIntensity: idleDetected ? 0 : motionIntensity.intensity,
        rawDirectionX: 0,
        rawTurn: 0,
        rightKneeHeight: legMotion.rightKneeHeight,
        neutralCenterX: bodyLean.neutralCenterX,
        sideMovement: bodyLean.sideMovement,
        speed: activeSpeed,
        speedMultiplier: walking ? motionIntensity.speedMultiplier : 0,
        trackingStable,
        turnGestureActive: false,
        walkingConfidence,
        walking,
      },
      0.18
    ),
    pose: {
      nose: poseLandmarks[0] ?? null,
      leftShoulder,
      rightShoulder,
      leftElbow: leftElbow ?? null,
      rightElbow: rightElbow ?? null,
      leftWrist: leftWrist ?? null,
      rightWrist: rightWrist ?? null,
      leftHip: leftHip ?? null,
      rightHip: rightHip ?? null,
      leftKnee: leftKnee ?? null,
      rightKnee: rightKnee ?? null,
      leftAnkle: leftAnkle ?? null,
      rightAnkle: rightAnkle ?? null,
    },
  }
}

function createTrackedHands(results) {
  const hands = createEmptyHands()

  for (let index = 0; index < (results.landmarks?.length ?? 0); index += 1) {
    const landmarks = results.landmarks[index]
    const handednessResult = results.handednesses?.[index]?.[0]
    const handedness = handednessResult?.categoryName ?? `Hand ${index + 1}`
    const summary = createHandSummary(landmarks, handedness, handednessResult?.score ?? 0)
    const trackedHand = {
      landmarks,
      summary,
    }

    if (handedness === 'Left') {
      hands.leftHand = summary
      hands.trackedLeft = trackedHand
    } else if (handedness === 'Right') {
      hands.rightHand = summary
      hands.trackedRight = trackedHand
    } else if (!hands.trackedLeft) {
      hands.leftHand = {
        ...summary,
        handedness: 'Left',
      }
      hands.trackedLeft = {
        landmarks,
        summary: hands.leftHand,
      }
    } else {
      hands.rightHand = {
        ...summary,
        handedness: 'Right',
      }
      hands.trackedRight = {
        landmarks,
        summary: hands.rightHand,
      }
    }
  }

  return hands
}

function createEmptyHands() {
  return {
    leftHand: createEmptyHand('Left'),
    rightHand: createEmptyHand('Right'),
    trackedLeft: null,
    trackedRight: null,
  }
}

function createEmptyHand(handedness) {
  return {
    visible: false,
    x: 0.5,
    y: 0.5,
    handedness,
    confidence: 0,
    indexTip: null,
    wrist: null,
  }
}

function createHandSummary(landmarks, handedness, confidence) {
  const indexTip = landmarks?.[8] ?? null
  const wrist = landmarks?.[0] ?? null
  const x = indexTip ? 1 - clamp(indexTip.x, 0, 1) : 0.5
  const y = indexTip ? clamp(indexTip.y, 0, 1) : 0.5

  return {
    visible: Boolean(indexTip),
    x,
    y,
    handedness,
    confidence,
    indexTip,
    wrist,
  }
}

function chooseActiveHand(hands) {
  const visibleHands = [hands.trackedLeft, hands.trackedRight].filter((hand) => hand?.summary.visible)

  if (visibleHands.length === 0) {
    return null
  }

  return visibleHands.sort((handA, handB) => getHandScore(handB.summary) - getHandScore(handA.summary))[0]
}

function getHandScore(hand) {
  const centerCloseness = 1 - Math.min(Math.abs(hand.x - 0.5) * 2, 1)

  return hand.confidence * 0.62 + centerCloseness * 0.38
}

function updateHandReach(activeHand, smoothedReachRef, playtestSettings) {
  if (!activeHand?.summary.visible) {
    smoothedReachRef.current = {
      ...(smoothedReachRef.current ?? READY_STATUS.handReach),
      visible: false,
      handedness: '',
      confidence: 0,
    }

    return smoothedReachRef.current
  }

  const current = smoothedReachRef.current ?? READY_STATUS.handReach
  const target = activeHand.summary
  const distance = Math.hypot(target.x - current.x, target.y - current.y)
  const smoothingMultiplier = clamp(playtestSettings?.handReachSmoothing ?? 1, 0.45, 1.8)
  const baseSmoothing = distance > 0.18 ? 0.42 : 0.24 + clamp(target.confidence, 0, 1) * 0.1
  const smoothing = clamp(baseSmoothing * smoothingMultiplier, 0.08, 0.74)
  const next = {
    visible: true,
    x: distance < 0.006 ? current.x : current.x + (target.x - current.x) * smoothing,
    y: distance < 0.006 ? current.y : current.y + (target.y - current.y) * smoothing,
    handedness: target.handedness,
    confidence: target.confidence,
  }

  smoothedReachRef.current = next
  return next
}

function createEmptyPoseTracking() {
  return {
    bodyCenter: READY_STATUS.bodyCenter,
    motion: READY_STATUS.motion,
    pose: READY_STATUS.pose,
  }
}

function smoothMotion(ref, target, amount) {
  const current = ref.current ?? READY_STATUS.motion
  if (target.idleDetected) {
    const nextIdle = {
      ...current,
      bodyDirection: target.bodyDirection,
      bodyCenterX: target.bodyCenterX,
      armSwingConfidence: 0,
      autoCalibrating: Boolean(target.autoCalibrating),
      bending: Boolean(target.bending),
      directionX: 0,
      directionZ: -1,
      finalDirectionX: 0,
      finalSpeed: 0,
      forward: 0,
      handsUp: Boolean(target.handsUp),
      idleDetected: true,
      idleDriftBlocked: false,
      kneeMotionAmount: 0,
      kneeWalkingConfidence: 0,
      lateral: target.lateral === 0 ? 0 : current.lateral + (target.lateral - current.lateral) * amount,
      leanAmount: target.leanAmount,
      leanLeft: Boolean(target.leanLeft),
      leanRight: Boolean(target.leanRight),
      leftKneeHeight: current.leftKneeHeight + (target.leftKneeHeight - current.leftKneeHeight) * amount,
      motionIntensity: 0,
      rawDirectionX: 0,
      rawTurn: 0,
      rightKneeHeight: current.rightKneeHeight + (target.rightKneeHeight - current.rightKneeHeight) * amount,
      neutralCenterX: target.neutralCenterX,
      sideMovement: target.sideMovement === 0 ? 0 : current.sideMovement + (target.sideMovement - current.sideMovement) * SIDE_SPEED_SMOOTHING,
      speed: 0,
      speedMultiplier: 0,
      trackingStable: Boolean(target.trackingStable),
      turnGestureActive: Boolean(target.turnGestureActive),
      walkingConfidence: 0,
      walking: false,
    }

    ref.current = nextIdle
    return nextIdle
  }

  const next = {
    bodyDirection: target.bodyDirection,
    bodyCenterX: target.bodyCenterX,
    armSwingConfidence: current.armSwingConfidence + (target.armSwingConfidence - current.armSwingConfidence) * amount,
    autoCalibrating: Boolean(target.autoCalibrating),
    bending: Boolean(target.bending),
    directionX: current.directionX + (target.directionX - current.directionX) * amount,
    directionZ: current.directionZ + (target.directionZ - current.directionZ) * amount,
    finalDirectionX: current.finalDirectionX + (target.finalDirectionX - current.finalDirectionX) * amount,
    finalSpeed: target.walking ? current.finalSpeed + (target.finalSpeed - current.finalSpeed) * SPEED_SMOOTHING : 0,
    forward: current.forward + (target.forward - current.forward) * amount,
    handsUp: Boolean(target.handsUp),
    idleDetected: false,
    idleDriftBlocked: Boolean(target.idleDriftBlocked),
    kneeMotionAmount: current.kneeMotionAmount + (target.kneeMotionAmount - current.kneeMotionAmount) * amount,
    kneeWalkingConfidence: current.kneeWalkingConfidence + (target.kneeWalkingConfidence - current.kneeWalkingConfidence) * amount,
    lateral: target.lateral === 0 ? 0 : current.lateral + (target.lateral - current.lateral) * amount,
    leanAmount: target.leanAmount,
    leanLeft: Boolean(target.leanLeft),
    leanRight: Boolean(target.leanRight),
    leftKneeHeight: current.leftKneeHeight + (target.leftKneeHeight - current.leftKneeHeight) * amount,
    motionIntensity: current.motionIntensity + (target.motionIntensity - current.motionIntensity) * SPEED_SMOOTHING,
    rawDirectionX: current.rawDirectionX + (target.rawDirectionX - current.rawDirectionX) * amount,
    rawTurn: current.rawTurn + (target.rawTurn - current.rawTurn) * amount,
    rightKneeHeight: current.rightKneeHeight + (target.rightKneeHeight - current.rightKneeHeight) * amount,
    neutralCenterX: target.neutralCenterX,
    sideMovement: target.sideMovement === 0 ? 0 : current.sideMovement + (target.sideMovement - current.sideMovement) * SIDE_SPEED_SMOOTHING,
    speed: target.walking ? current.speed + (target.speed - current.speed) * SPEED_SMOOTHING : 0,
    speedMultiplier: target.walking ? current.speedMultiplier + (target.speedMultiplier - current.speedMultiplier) * SPEED_SMOOTHING : 0,
    trackingStable: Boolean(target.trackingStable),
    turnGestureActive: Boolean(target.turnGestureActive),
    walkingConfidence: current.walkingConfidence + (target.walkingConfidence - current.walkingConfidence) * amount,
    walking: target.walking,
  }

  ref.current = next
  return next
}

function getBodyLabel(motion) {
  if (motion.walking) {
    return 'Walking'
  }

  return 'Pose visible'
}

function getHandsUpForMotion({ leftShoulder, leftWrist, rightShoulder, rightWrist }) {
  if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist) {
    return false
  }

  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2
  const raisedThreshold = shoulderY - 0.08

  return leftWrist.y < raisedThreshold && rightWrist.y < raisedThreshold
}

function getBendingForMotion({ leftHip, leftKnee, leftWrist, rightHip, rightKnee, rightWrist }) {
  if (!leftHip || !rightHip || !leftWrist || !rightWrist) {
    return false
  }

  const hipY = (leftHip.y + rightHip.y) / 2
  const kneeY = leftKnee && rightKnee ? (leftKnee.y + rightKnee.y) / 2 : hipY + 0.16
  const bendThreshold = Math.min(hipY + 0.08, hipY + (kneeY - hipY) * 0.52)

  return leftWrist.y > bendThreshold && rightWrist.y > bendThreshold
}

function getBodyLeanSideMovement(bodyCenterX, bodyLeanRef, idleDetected) {
  const state = bodyLeanRef.current ?? {
    autoCalibrating: false,
    idleSince: 0,
    neutralCenterX: null,
    sideMovement: 0,
  }
  const now = performance.now()

  if (!Number.isFinite(state.neutralCenterX)) {
    state.neutralCenterX = bodyCenterX
  }

  const initialLeanAmount = bodyCenterX - state.neutralCenterX
  const initialLeanMagnitude = Math.abs(initialLeanAmount)
  const smallIdleLean = idleDetected && initialLeanMagnitude <= BODY_LEAN_DEADZONE

  if (idleDetected) {
    state.idleSince ||= now
  } else {
    state.idleSince = 0
  }

  state.autoCalibrating = Boolean(
    idleDetected &&
    state.idleSince &&
    now - state.idleSince >= LEAN_AUTO_CALIBRATE_AFTER_MS
  )

  if (state.autoCalibrating) {
    state.neutralCenterX += (bodyCenterX - state.neutralCenterX) * LEAN_AUTO_CALIBRATE_SMOOTHING
  }

  const leanAmount = bodyCenterX - state.neutralCenterX
  const leanMagnitude = Math.abs(leanAmount)
  const leanDirection = Math.sign(leanAmount)
  const leanStrength = smallIdleLean || leanMagnitude <= BODY_LEAN_DEADZONE
    ? 0
    : clamp((leanMagnitude - BODY_LEAN_DEADZONE) / (0.22 - BODY_LEAN_DEADZONE), 0, 1)
  const targetSideMovement = leanDirection * leanStrength * MAX_SIDE_SPEED

  state.sideMovement = targetSideMovement === 0
    ? 0
    : state.sideMovement + (targetSideMovement - state.sideMovement) * SIDE_SPEED_SMOOTHING
  bodyLeanRef.current = state

  return {
    autoCalibrating: state.autoCalibrating,
    leanAmount,
    leanLeft: leanAmount < -BODY_LEAN_DEADZONE,
    leanRight: leanAmount > BODY_LEAN_DEADZONE,
    neutralCenterX: state.neutralCenterX,
    sideMovement: state.sideMovement,
  }
}

function getLegMotion({ leftAnkle, leftKnee, leftHip, rightAnkle, rightKnee, rightHip }, legMotionRef) {
  if (!leftAnkle || !rightAnkle || !leftKnee || !rightKnee) {
    return {
      alternating: false,
      leftKneeHeight: 0,
      motionAmount: 0,
      rightKneeHeight: 0,
      stepEnergy: 0,
      stride: 0,
      walkingConfidence: 0,
    }
  }

  const hipY = leftHip && rightHip ? (leftHip.y + rightHip.y) / 2 : Math.min(leftKnee.y, rightKnee.y) - 0.18
  const leftKneeHeight = clamp(hipY - leftKnee.y, 0, 0.45)
  const rightKneeHeight = clamp(hipY - rightKnee.y, 0, 0.45)
  const kneeLift = Math.max(leftKneeHeight, rightKneeHeight)
  const ankleStep = Math.abs(leftAnkle.y - rightAnkle.y)
  const kneeStep = Math.abs(leftKnee.y - rightKnee.y)
  const previousLeftKneeY = legMotionRef.current?.lastLeftKneeY ?? leftKnee.y
  const previousRightKneeY = legMotionRef.current?.lastRightKneeY ?? rightKnee.y
  const kneeVelocity = Math.abs(leftKnee.y - previousLeftKneeY) + Math.abs(rightKnee.y - previousRightKneeY)
  const ankleMotion = Math.abs(leftAnkle.y - rightAnkle.y) + Math.abs(leftAnkle.x - rightAnkle.x) * 0.4
  const motionAmount = clamp(kneeVelocity * 5.8 + ankleMotion * 0.65 + kneeStep * 0.8, 0, 1)
  const stride = clamp(ankleStep * 0.55 + kneeStep * 0.75 + kneeLift * 1.15, 0, 0.45)
  const legDelta = leftKneeHeight - rightKneeHeight + (leftAnkle.y - rightAnkle.y) * 0.35
  const stepSign = Math.abs(legDelta) > KNEE_LIFT_THRESHOLD * 0.55 ? Math.sign(legDelta) : 0
  const now = performance.now()
  const state = legMotionRef.current ?? {
    lastLeftKneeY: leftKnee.y,
    lastRightKneeY: rightKnee.y,
    lastStepSign: 0,
    lastSwitchTime: 0,
    motionAmount: 0,
    stepEnergy: 0,
  }

  if (stepSign !== 0 && state.lastStepSign !== 0 && stepSign !== state.lastStepSign) {
    const switchGap = now - state.lastSwitchTime

    state.stepEnergy = switchGap > 90 && switchGap < 1250 ? Math.min(state.stepEnergy + 0.42, 1) : state.stepEnergy
    state.lastSwitchTime = now
  } else if (state.lastSwitchTime === 0 && stepSign !== 0) {
    state.lastSwitchTime = now
  }

  if (stepSign !== 0) {
    state.lastStepSign = stepSign
  }

  state.lastLeftKneeY = leftKnee.y
  state.lastRightKneeY = rightKnee.y
  state.motionAmount = state.motionAmount + (motionAmount - state.motionAmount) * 0.32
  state.stepEnergy *= 0.94
  legMotionRef.current = state
  const kneeLiftScore = clamp((kneeLift - KNEE_LIFT_THRESHOLD * 0.45) / Math.max(KNEE_LIFT_THRESHOLD, 0.001), 0, 1)
  const alternatingScore = state.stepEnergy
  const motionScore = state.motionAmount
  const walkingConfidence = clamp(
    kneeLiftScore * 0.42 + alternatingScore * 0.34 + motionScore * 0.24,
    0,
    1
  )

  return {
    alternating: state.stepEnergy > WALK_THRESHOLD * 0.65,
    leftKneeHeight,
    motionAmount: state.motionAmount,
    rightKneeHeight,
    stepEnergy: state.stepEnergy,
    stride,
    walkingConfidence,
  }
}

function getArmSwingMotion({ leftShoulder, leftWrist, rightShoulder, rightWrist }, armSwingRef) {
  if (!leftShoulder || !rightShoulder || !leftWrist || !rightWrist) {
    return {
      alternating: false,
      armSwingConfidence: 0,
      sideDirection: 0,
      wristMotion: 0,
    }
  }

  const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2
  const shoulderCenterZ = ((leftShoulder.z ?? 0) + (rightShoulder.z ?? 0)) / 2
  const leftDepth = (leftWrist.z ?? 0) - shoulderCenterZ
  const rightDepth = (rightWrist.z ?? 0) - shoulderCenterZ
  const leftHeight = leftWrist.y - leftShoulder.y
  const rightHeight = rightWrist.y - rightShoulder.y
  const previousLeftWristY = armSwingRef.current?.lastLeftWristY ?? leftWrist.y
  const previousRightWristY = armSwingRef.current?.lastRightWristY ?? rightWrist.y
  const wristVelocity = Math.abs(leftWrist.y - previousLeftWristY) + Math.abs(rightWrist.y - previousRightWristY)
  const oppositeDepth = Math.abs(leftDepth - rightDepth)
  const oppositeHeight = Math.abs(leftHeight - rightHeight)
  const swingSignal = (leftDepth - rightDepth) + (leftHeight - rightHeight) * 0.35
  const swingSign = Math.abs(swingSignal) > 0.035 ? Math.sign(swingSignal) : 0
  const bothArmsSide = clamp((shoulderCenterX - (leftWrist.x + rightWrist.x) / 2) * 5.2, -1, 1)
  const sideDirection = Math.abs(bothArmsSide) > 0.34 ? bothArmsSide * 0.28 : 0
  const now = performance.now()
  const state = armSwingRef.current ?? {
    lastLeftWristY: leftWrist.y,
    lastRightWristY: rightWrist.y,
    lastSwingSign: 0,
    lastSwitchTime: 0,
    swingEnergy: 0,
  }

  if (swingSign !== 0 && state.lastSwingSign !== 0 && swingSign !== state.lastSwingSign) {
    const switchGap = now - state.lastSwitchTime

    state.swingEnergy = switchGap > 120 && switchGap < 1400 ? Math.min(state.swingEnergy + 0.34, 1) : state.swingEnergy
    state.lastSwitchTime = now
  } else if (state.lastSwitchTime === 0 && swingSign !== 0) {
    state.lastSwitchTime = now
  }

  if (swingSign !== 0) {
    state.lastSwingSign = swingSign
  }

  state.lastLeftWristY = leftWrist.y
  state.lastRightWristY = rightWrist.y
  state.swingEnergy *= 0.94
  armSwingRef.current = state

  const swingShapeScore = clamp(oppositeDepth * 2.8 + oppositeHeight * 1.2, 0, 1)
  const wristMotionScore = clamp(wristVelocity * 5.4, 0, 1)
  const armSwingConfidence = clamp(
    state.swingEnergy * 0.45 + swingShapeScore * 0.35 + wristMotionScore * 0.2,
    0,
    1
  )

  return {
    alternating: state.swingEnergy > WALK_THRESHOLD * 0.7,
    armSwingConfidence,
    sideDirection,
    wristMotion: wristVelocity,
  }
}

function getMotionIntensity(landmarks, motionIntensityRef) {
  const entries = Object.entries(landmarks).filter(([, point]) => isValidLandmark(point))
  const previous = motionIntensityRef.current?.previous
  const now = performance.now()

  if (!previous || entries.length === 0) {
    motionIntensityRef.current = {
      ankleMotion: 0,
      idleDetected: false,
      idleSince: now,
      intensity: 0,
      previous: createMotionSnapshot(entries),
      rawIntensity: 0,
      speedMultiplier: 0,
      wristMotion: 0,
    }

    return motionIntensityRef.current
  }

  const groupMotion = {
    ankle: { count: 0, total: 0 },
    knee: { count: 0, total: 0 },
    wrist: { count: 0, total: 0 },
  }
  let totalMotion = 0
  let count = 0

  for (const [key, point] of entries) {
    const before = previous[key]

    if (!before) {
      continue
    }

    const dx = point.x - before.x
    const dy = point.y - before.y
    const dz = (point.z ?? 0) - (before.z ?? 0)
    const movement = Math.hypot(dx, dy, dz * 0.35)

    totalMotion += movement
    count += 1
    if (key.includes('Ankle')) {
      groupMotion.ankle.total += movement
      groupMotion.ankle.count += 1
    } else if (key.includes('Knee')) {
      groupMotion.knee.total += movement
      groupMotion.knee.count += 1
    } else if (key.includes('Wrist')) {
      groupMotion.wrist.total += movement
      groupMotion.wrist.count += 1
    }
  }

  const rawIntensity = count > 0 ? clamp((totalMotion / count) * MOTION_INTENSITY_SCALE, 0, 1) : 0
  const ankleMotion = groupMotion.ankle.count > 0 ? groupMotion.ankle.total / groupMotion.ankle.count : 0
  const kneeMotion = groupMotion.knee.count > 0 ? groupMotion.knee.total / groupMotion.knee.count : 0
  const wristMotion = groupMotion.wrist.count > 0 ? groupMotion.wrist.total / groupMotion.wrist.count : 0
  const idleCandidate =
    rawIntensity < IDLE_DEADZONE &&
    ankleMotion < 0.006 &&
    kneeMotion < 0.006 &&
    wristMotion < 0.006
  const current = motionIntensityRef.current ?? {
    idleSince: 0,
    intensity: 0,
    previous: null,
    speedMultiplier: 0,
  }
  const idleSince = idleCandidate
    ? current.idleSince || now
    : 0
  const idleDetected = idleCandidate && now - idleSince >= IDLE_HOLD_MS
  const intensity = current.intensity + (rawIntensity - current.intensity) * SPEED_SMOOTHING
  const targetMultiplier =
    intensity < IDLE_DEADZONE
      ? 0
      : 1
  const speedMultiplier = current.speedMultiplier + (targetMultiplier - current.speedMultiplier) * SPEED_SMOOTHING

  motionIntensityRef.current = {
    ankleMotion,
    idleDetected,
    idleSince,
    intensity: idleDetected ? 0 : intensity,
    previous: createMotionSnapshot(entries),
    rawIntensity,
    speedMultiplier: clamp(speedMultiplier, 0, 1),
    wristMotion,
  }

  return motionIntensityRef.current
}

function createMotionSnapshot(entries) {
  return Object.fromEntries(
    entries.map(([key, point]) => [
      key,
      {
        x: point.x,
        y: point.y,
        z: point.z ?? 0,
      },
    ])
  )
}

function isValidLandmark(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y)
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}
