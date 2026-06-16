import { DrawingUtils, FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import { VIDEO_CONSTRAINTS, clearCanvas, resizeCanvasToVideo } from './handTracking'

const VISION_WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
const POSE_MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

export const POSE_VIDEO_CONSTRAINTS = VIDEO_CONSTRAINTS
export const HIP_LANDMARKS = { LEFT: 23, RIGHT: 24 }
export const SHOULDER_LANDMARKS = { LEFT: 11, RIGHT: 12 }

const MIN_HIP_VISIBILITY = 0.5

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
  const hips = [leftHip, rightHip].filter((hip) => hip && (hip.visibility ?? 0) >= MIN_HIP_VISIBILITY)

  if (hips.length < 2) return null

  const hipY = (hips.reduce((sum, hip) => sum + hip.y, 0) / hips.length) * videoHeight

  const leftShoulder = landmarks?.[SHOULDER_LANDMARKS.LEFT]
  const rightShoulder = landmarks?.[SHOULDER_LANDMARKS.RIGHT]
  const shoulders = [leftShoulder, rightShoulder].filter((s) => s && (s.visibility ?? 0) >= 0.4)
  const shoulderY = shoulders.length > 0
    ? (shoulders.reduce((sum, s) => sum + s.y, 0) / shoulders.length) * videoHeight
    : null

  return {
    confidence: hips.reduce((sum, hip) => sum + (hip.visibility ?? 0), 0) / hips.length,
    hipCount: hips.length,
    shoulderY,
    y: hipY,
  }
}

export function drawPose(canvas, landmarks) {
  const context = canvas.getContext('2d')
  if (!context) return
  clearCanvas(canvas)
  const drawing = new DrawingUtils(context)
  drawing.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, {
    color: 'rgba(255, 220, 93, 0.86)',
    lineWidth: 4,
  })
  drawing.drawLandmarks(landmarks, {
    fillColor: '#f8f4ea',
    lineWidth: 1,
    radius: ({ index }) =>
      index === HIP_LANDMARKS.LEFT || index === HIP_LANDMARKS.RIGHT ? 8 : 4,
  })
}

export { clearCanvas, resizeCanvasToVideo }

function createLandmarker(vision, delegate) {
  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: POSE_MODEL_PATH, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
    minPoseDetectionConfidence: 0.4,
    minPosePresenceConfidence: 0.4,
    minTrackingConfidence: 0.4,
  })
}
