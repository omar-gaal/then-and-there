import { DrawingUtils, FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision'

const VISION_WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'

const HAND_MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'
const POSE_MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task'

export const VIDEO_CONSTRAINTS = {
  facingMode: 'user',
  width: { ideal: 1280 },
  height: { ideal: 720 },
}

export const READY_STATUS = {
  mode: 'idle',
  label: 'Ready',
  hand: 'No hand',
  confidence: 0,
  gesture: 'None',
  body: 'No pose',
  leftHand: createEmptyHand('Left'),
  rightHand: createEmptyHand('Right'),
  activeHand: null,
  handReach: {
    visible: false,
    x: 0.5,
    y: 0.5,
    handedness: '',
    confidence: 0,
  },
  bodyCenter: {
    visible: false,
    x: 0.5,
    y: 0.5,
  },
  pose: {
    nose: null,
    leftShoulder: null,
    rightShoulder: null,
    leftElbow: null,
    rightElbow: null,
    leftWrist: null,
    rightWrist: null,
    leftHip: null,
    rightHip: null,
    leftKnee: null,
    rightKnee: null,
    leftAnkle: null,
    rightAnkle: null,
  },
  motion: {
    bodyDirection: 'forward',
    armTurnCooldownMs: 0,
    armSwingConfidence: 0,
    directionX: 0,
    directionZ: -1,
    finalDirectionX: 0,
    forward: 0,
    idleDriftBlocked: false,
    kneeMotionAmount: 0,
    kneeWalkingConfidence: 0,
    lateral: 0,
    leftArmOut: false,
    leftKneeHeight: 0,
    finalSpeed: 0,
    motionIntensity: 0,
    rawDirectionX: 0,
    rawTurn: 0,
    rightArmOut: false,
    rightKneeHeight: 0,
    speed: 0,
    speedMultiplier: 0,
    walkingConfidence: 0,
    walking: false,
  },
  performance: {
    avgFrameMs: 0,
    avgHandMs: 0,
    avgPoseMs: 0,
    avgPostMs: 0,
    mediaPipeActive: false,
  },
  pinching: false,
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

export async function createHandLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(VISION_WASM_PATH)

  try {
    return await createLandmarker(vision, 'GPU')
  } catch (error) {
    console.warn('GPU hand tracking unavailable, falling back to CPU.', error)
    return createLandmarker(vision, 'CPU')
  }
}

export async function createPoseLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(VISION_WASM_PATH)

  try {
    return await createPoseTracker(vision, 'GPU')
  } catch (error) {
    console.warn('GPU pose tracking unavailable, falling back to CPU.', error)
    return createPoseTracker(vision, 'CPU')
  }
}

export function resizeCanvasToVideo(canvas, video) {
  const width = video.videoWidth || 1280
  const height = video.videoHeight || 720

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
}

export function clearCanvas(canvas) {
  const context = canvas?.getContext('2d')

  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height)
  }
}

export function drawHand(canvas, landmarks) {
  const context = canvas.getContext('2d')

  if (!context) {
    return
  }

  context.clearRect(0, 0, canvas.width, canvas.height)

  const drawing = new DrawingUtils(context)
  drawing.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
    color: 'rgba(41, 210, 178, 0.92)',
    lineWidth: 5,
  })
  drawing.drawLandmarks(landmarks, {
    fillColor: getLandmarkColor,
    lineWidth: 1,
    radius: ({ index }) => (index === 4 || index === 8 ? 9 : 6),
  })
}

export function drawTracking(canvas, handLandmarks, poseLandmarks) {
  const context = canvas.getContext('2d')

  if (!context) {
    return
  }

  context.clearRect(0, 0, canvas.width, canvas.height)

  const drawing = new DrawingUtils(context)

  if (poseLandmarks) {
    drawing.drawConnectors(poseLandmarks, PoseLandmarker.POSE_CONNECTIONS, {
      color: 'rgba(47, 128, 237, 0.48)',
      lineWidth: 4,
    })
    drawing.drawLandmarks(poseLandmarks, {
      fillColor: '#f3c84b',
      lineWidth: 1,
      radius: ({ index }) => (index <= 10 ? 4 : 5),
    })
  }

  const hands = Array.isArray(handLandmarks?.[0]) ? handLandmarks : handLandmarks ? [handLandmarks] : []

  for (const landmarks of hands) {
    drawing.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
      color: 'rgba(41, 210, 178, 0.92)',
      lineWidth: 5,
    })
    drawing.drawLandmarks(landmarks, {
      fillColor: getLandmarkColor,
      lineWidth: 1,
      radius: ({ index }) => (index === 4 || index === 8 ? 9 : 6),
    })
  }
}

function createLandmarker(vision, delegate) {
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: HAND_MODEL_PATH,
      delegate,
    },
    runningMode: 'VIDEO',
    numHands: 2,
  })
}

function createPoseTracker(vision, delegate) {
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: POSE_MODEL_PATH,
      delegate,
    },
    runningMode: 'VIDEO',
    numPoses: 1,
  })
}

function getLandmarkColor({ index }) {
  if (index === 8) {
    return '#ffb84d'
  }

  if (index === 4) {
    return '#ff6f61'
  }

  return '#f8f4ea'
}
