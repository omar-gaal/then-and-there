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

const WALKING_THRESHOLD = 0.28
const MOTION_INTENSITY_DEADZONE = 0.055
const KNEE_LIFT_THRESHOLD = 0.035
const MOVEMENT_DIRECTION_INVERT = 1
const MIN_WALK_SPEED = 0.07
const MAX_WALK_SPEED = 0.18
const MIN_SPEED_MULTIPLIER = 0.8
const MAX_SPEED_MULTIPLIER = 2.9
const MOTION_INTENSITY_SCALE = 10.5
const SPEED_SMOOTHING = 0.16

export function useCopenhagenTracking({ playtestSettings } = {}) {
  const webcamRef = useRef(null)
  const canvasRef = useRef(null)
  const puckRef = useRef(null)
  const handLandmarkerRef = useRef(null)
  const poseLandmarkerRef = useRef(null)
  const playtestSettingsRef = useRef(playtestSettings)
  const animationRef = useRef(0)
  const lastVideoTimeRef = useRef(-1)
  const neutralPoseRef = useRef(null)
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
    intensity: 0,
    previous: null,
    speedMultiplier: 0,
  })
  const directionRef = useRef({ rawTurn: 0, x: 0, z: -1 })
  const smoothedMotionRef = useRef(READY_STATUS.motion)
  const smoothedReachRef = useRef(READY_STATUS.handReach)
  const performanceRef = useRef(READY_STATUS.performance)

  const [isRunning, setIsRunning] = useState(false)
  const [tracking, setTracking] = useState(READY_STATUS)

  function stopCamera() {
    cancelAnimationFrame(animationRef.current)

    animationRef.current = 0
    lastVideoTimeRef.current = -1
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
        neutralPoseRef,
        smoothedMotionRef,
        legMotionRef,
        armSwingRef,
        motionIntensityRef,
        directionRef
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
  neutralPoseRef,
  smoothedMotionRef,
  legMotionRef,
  armSwingRef,
  motionIntensityRef,
  directionRef
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
  const bodyCenterX = (shoulderCenterX + hipCenterX) / 2
  const shoulderSpan = Math.abs(leftShoulder.x - rightShoulder.x)

  if (!neutralPoseRef.current) {
    neutralPoseRef.current = {
      centerX: bodyCenterX,
      shoulderSpan,
    }
  }

  const neutral = neutralPoseRef.current
  const rawLateral = clamp((neutral.centerX - bodyCenterX) * 4.4, -1, 1)
  const leanForward = clamp(((shoulderSpan - neutral.shoulderSpan) / Math.max(neutral.shoulderSpan, 0.05)) * 3.2, -1, 1)
  const legMotion = getLegMotion({ leftAnkle, leftKnee, leftHip, rightAnkle, rightKnee, rightHip }, legMotionRef)
  const armMotion = getArmSwingMotion({ leftShoulder, leftWrist, rightShoulder, rightWrist }, armSwingRef)
  const motionIntensity = getMotionIntensity(
    { leftAnkle, leftElbow, leftKnee, leftWrist, rightAnkle, rightElbow, rightKnee, rightWrist },
    motionIntensityRef
  )
  const bodyDirection = getBodyDirection(
    { armSide: armMotion.sideDirection, leftHip, leftShoulder, rightHip, rightShoulder },
    directionRef
  )
  const walkingConfidence = Math.max(legMotion.walkingConfidence, armMotion.armSwingConfidence)
  const rawForward = clamp(Math.max(leanForward, walkingConfidence, legMotion.stride * 3.2), -1, 1)
  const walking =
    walkingConfidence >= WALKING_THRESHOLD &&
    motionIntensity.intensity >= MOTION_INTENSITY_DEADZONE &&
    (
      legMotion.alternating ||
      armMotion.alternating ||
      legMotion.stride > KNEE_LIFT_THRESHOLD * 1.4
    )
  const activeSpeed = walking
    ? clamp(
        (MIN_WALK_SPEED + walkingConfidence * 0.13) * motionIntensity.speedMultiplier,
        0,
        MAX_WALK_SPEED * MAX_SPEED_MULTIPLIER
      )
    : 0

  return {
    bodyCenter: {
      visible: true,
      x: 1 - clamp(bodyCenterX, 0, 1),
      y: clamp(((leftShoulder.y + rightShoulder.y) / 2 + (leftHip?.y ?? leftShoulder.y) + (rightHip?.y ?? rightShoulder.y)) / 4, 0, 1),
    },
    motion: smoothMotion(
      smoothedMotionRef,
      {
        bodyDirection: bodyDirection.label,
        armSwingConfidence: armMotion.armSwingConfidence,
        directionX: bodyDirection.x,
        directionZ: bodyDirection.z,
        finalDirectionX: bodyDirection.finalDirectionX,
        forward: rawForward,
        idleDriftBlocked: !walking && (walkingConfidence > 0.02 || motionIntensity.intensity > 0.015),
        kneeMotionAmount: legMotion.motionAmount,
        kneeWalkingConfidence: legMotion.walkingConfidence,
        lateral: rawLateral,
        leftKneeHeight: legMotion.leftKneeHeight,
        finalSpeed: activeSpeed,
        motionIntensity: motionIntensity.intensity,
        rawDirectionX: bodyDirection.rawDirectionX,
        rawTurn: bodyDirection.finalDirectionX,
        rightKneeHeight: legMotion.rightKneeHeight,
        speed: activeSpeed,
        speedMultiplier: walking ? motionIntensity.speedMultiplier : 0,
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
  const next = {
    bodyDirection: target.bodyDirection,
    armSwingConfidence: current.armSwingConfidence + (target.armSwingConfidence - current.armSwingConfidence) * amount,
    directionX: current.directionX + (target.directionX - current.directionX) * amount,
    directionZ: current.directionZ + (target.directionZ - current.directionZ) * amount,
    finalDirectionX: current.finalDirectionX + (target.finalDirectionX - current.finalDirectionX) * amount,
    finalSpeed: target.walking ? current.finalSpeed + (target.finalSpeed - current.finalSpeed) * SPEED_SMOOTHING : 0,
    forward: current.forward + (target.forward - current.forward) * amount,
    idleDriftBlocked: Boolean(target.idleDriftBlocked),
    kneeMotionAmount: current.kneeMotionAmount + (target.kneeMotionAmount - current.kneeMotionAmount) * amount,
    kneeWalkingConfidence: current.kneeWalkingConfidence + (target.kneeWalkingConfidence - current.kneeWalkingConfidence) * amount,
    lateral: current.lateral + (target.lateral - current.lateral) * amount,
    leftKneeHeight: current.leftKneeHeight + (target.leftKneeHeight - current.leftKneeHeight) * amount,
    motionIntensity: current.motionIntensity + (target.motionIntensity - current.motionIntensity) * SPEED_SMOOTHING,
    rawDirectionX: current.rawDirectionX + (target.rawDirectionX - current.rawDirectionX) * amount,
    rawTurn: current.rawTurn + (target.rawTurn - current.rawTurn) * amount,
    rightKneeHeight: current.rightKneeHeight + (target.rightKneeHeight - current.rightKneeHeight) * amount,
    speed: target.walking ? current.speed + (target.speed - current.speed) * SPEED_SMOOTHING : 0,
    speedMultiplier: target.walking ? current.speedMultiplier + (target.speedMultiplier - current.speedMultiplier) * SPEED_SMOOTHING : 0,
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
    alternating: state.stepEnergy > WALKING_THRESHOLD * 0.65,
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
    alternating: state.swingEnergy > WALKING_THRESHOLD * 0.7,
    armSwingConfidence,
    sideDirection,
  }
}

function getMotionIntensity(landmarks, motionIntensityRef) {
  const entries = Object.entries(landmarks).filter(([, point]) => isValidLandmark(point))
  const previous = motionIntensityRef.current?.previous

  if (!previous || entries.length === 0) {
    motionIntensityRef.current = {
      intensity: 0,
      previous: createMotionSnapshot(entries),
      speedMultiplier: 0,
    }

    return motionIntensityRef.current
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

    totalMotion += Math.hypot(dx, dy, dz * 0.35)
    count += 1
  }

  const rawIntensity = count > 0 ? clamp((totalMotion / count) * MOTION_INTENSITY_SCALE, 0, 1) : 0
  const current = motionIntensityRef.current ?? { intensity: 0, previous: null, speedMultiplier: 0 }
  const intensity = current.intensity + (rawIntensity - current.intensity) * SPEED_SMOOTHING
  const targetMultiplier =
    intensity < 0.035
      ? 0
      : MIN_SPEED_MULTIPLIER + intensity * (MAX_SPEED_MULTIPLIER - MIN_SPEED_MULTIPLIER)
  const speedMultiplier = current.speedMultiplier + (targetMultiplier - current.speedMultiplier) * SPEED_SMOOTHING

  motionIntensityRef.current = {
    intensity,
    previous: createMotionSnapshot(entries),
    speedMultiplier: clamp(speedMultiplier, 0, MAX_SPEED_MULTIPLIER),
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

function getBodyDirection({ armSide, leftHip, leftShoulder, rightHip, rightShoulder }, directionRef) {
  if (!leftShoulder || !rightShoulder) {
    return {
      label: 'forward',
      finalDirectionX: 0,
      rawDirectionX: 0,
      x: 0,
      z: -1,
    }
  }

  const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2
  const hipCenterX = leftHip && rightHip ? (leftHip.x + rightHip.x) / 2 : shoulderCenterX
  const shoulderDepthTurn = (rightShoulder.z ?? 0) - (leftShoulder.z ?? 0)
  const hipDepthTurn = leftHip && rightHip ? (rightHip.z ?? 0) - (leftHip.z ?? 0) : shoulderDepthTurn
  const centerSkew = shoulderCenterX - hipCenterX
  const rawDirectionX = clamp(shoulderDepthTurn * 3.9 + hipDepthTurn * 2.2 + centerSkew * 1.7 + armSide, -1, 1)
  const finalDirectionX = clamp(rawDirectionX * MOVEMENT_DIRECTION_INVERT, -1, 1)
  const state = directionRef.current ?? { rawTurn: 0, x: 0, z: -1 }
  const deadZone = 0.18
  const targetX = Math.abs(finalDirectionX) < deadZone ? 0 : finalDirectionX
  const targetZ = -Math.max(0.28, 1 - Math.abs(targetX) * 0.72)

  state.rawTurn += (finalDirectionX - state.rawTurn) * 0.18
  state.x += (targetX - state.x) * 0.16
  state.z += (targetZ - state.z) * 0.16
  directionRef.current = state

  return {
    label: getDirectionLabel(state.x),
    finalDirectionX,
    rawDirectionX,
    x: state.x,
    z: state.z,
  }
}

function isValidLandmark(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y)
}

function getDirectionLabel(directionX) {
  if (directionX > 0.22) {
    return 'right'
  }

  if (directionX < -0.22) {
    return 'left'
  }

  return 'forward'
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}
