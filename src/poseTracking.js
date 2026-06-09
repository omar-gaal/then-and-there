import { DrawingUtils, FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import { VIDEO_CONSTRAINTS, clearCanvas, resizeCanvasToVideo } from './handTracking'

const VISION_WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const POSE_MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

export const POSE_VIDEO_CONSTRAINTS = VIDEO_CONSTRAINTS
export const HIP_LANDMARKS = { LEFT: 23, RIGHT: 24 }

let lastHipDebugAt = 0

export async function createPoseLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(VISION_WASM_PATH)

  try {
    return await createLandmarker(vision, 'GPU')
  } catch (error) {
    console.warn('GPU pose tracking unavailable, falling back to CPU.', error)
    return createLandmarker(vision, 'CPU')
  }
}

export function getHipReading(landmarks, videoHeight) {
  const leftHip = landmarks?.[HIP_LANDMARKS.LEFT]
  const rightHip = landmarks?.[HIP_LANDMARKS.RIGHT]
  const hips = [
    leftHip,
    rightHip,
  ].filter((hip) => hip && (hip.visibility ?? 0) >= 0.35)

  if (hips.length === 0) {
    logHipDebug({
      leftVisibility: leftHip?.visibility ?? 0,
      rightVisibility: rightHip?.visibility ?? 0,
      status: 'no-visible-hips',
    })
    return null
  }

  const reading = {
    confidence: hips.reduce((sum, hip) => sum + (hip.visibility ?? 0), 0) / hips.length,
    hipCount: hips.length,
    y: (hips.reduce((sum, hip) => sum + hip.y, 0) / hips.length) * videoHeight,
  }

  logHipDebug({
    confidence: reading.confidence,
    hipCount: reading.hipCount,
    leftVisibility: leftHip?.visibility ?? 0,
    rightVisibility: rightHip?.visibility ?? 0,
    status: 'reading',
    y: reading.y,
  })

  return reading
}

export function drawPose(canvas, landmarks) {
  const context = canvas.getContext('2d')

  if (!context) {
    return
  }

  clearCanvas(canvas)
  const drawing = new DrawingUtils(context)

  drawing.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
    color: 'rgba(255, 220, 93, 0.86)',
    lineWidth: 4,
  })
  drawing.drawLandmarks(landmarks, {
    fillColor: '#f8f4ea',
    lineWidth: 1,
    radius: ({ index }) => (index === HIP_LANDMARKS.LEFT || index === HIP_LANDMARKS.RIGHT ? 8 : 4),
  })
}

export { clearCanvas, resizeCanvasToVideo }

function logHipDebug(details) {
  const now = performance.now()

  if (now - lastHipDebugAt < 500) {
    return
  }

  lastHipDebugAt = now
  console.log('[PoseDebug] Hip reader', details)
}

function createLandmarker(vision, delegate) {
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: POSE_MODEL_PATH, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.45,
    minPosePresenceConfidence: 0.45,
    minTrackingConfidence: 0.45,
  })
}
