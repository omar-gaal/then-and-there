// Debug overlay: displays live tracking, movement, map gesture, and pickup state.
import { getTownAreaLabel } from '../game/townAreas'

export function DebugPanel({
  currentAreaId,
  isMapOpen,
  isOpen,
  mapGestureDebug,
  onToggle,
  pickupDebug,
  tracking,
  worldDebug,
}) {
  const poseKeys = Object.keys(tracking.pose ?? {})
  const leftWrist = tracking.pose?.leftWrist
  const rightWrist = tracking.pose?.rightWrist
  const leftShoulder = tracking.pose?.leftShoulder
  const rightShoulder = tracking.pose?.rightShoulder
  const perf = worldDebug.perf ?? {}

  return (
    <div className="debug-panel-shell" data-open={isOpen ? 'true' : 'false'}>
      <button
        type="button"
        className="debug-toggle"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        {isOpen ? '▼ Debug' : '▶ Debug'}
      </button>

      <div className="debug-panel-content">
        <div className="avatar-debug" aria-live="polite">
          <span>body detected: {tracking.bodyCenter?.visible ? 'yes' : 'no'}</span>
          <span>body direction: {tracking.motion?.bodyDirection ?? 'forward'}</span>
          <span>raw directionX: {formatSpeed(tracking.motion?.rawDirectionX)}</span>
          <span>final directionX: {formatSpeed(tracking.motion?.finalDirectionX)}</span>
          <span>walking in place: {tracking.motion?.walking ? 'true' : 'false'}</span>
          <span>final direction: {tracking.motion?.bodyDirection ?? 'forward'}</span>
          <span>left knee height: {formatSpeed(tracking.motion?.leftKneeHeight)}</span>
          <span>right knee height: {formatSpeed(tracking.motion?.rightKneeHeight)}</span>
          <span>knee motion amount: {formatSpeed(tracking.motion?.kneeMotionAmount)}</span>
          <span>knee walking confidence: {formatSpeed(tracking.motion?.kneeWalkingConfidence)}</span>
          <span>arm swing confidence: {formatSpeed(tracking.motion?.armSwingConfidence)}</span>
          <span>walking confidence: {formatSpeed(tracking.motion?.walkingConfidence)}</span>
          <span>final walking: {tracking.motion?.walking ? 'true' : 'false'}</span>
          <span>idle drift blocked: {tracking.motion?.idleDriftBlocked ? 'true' : 'false'}</span>
          <span>movement vector x/z: {formatVector(tracking.motion)}</span>
          <span>player/world z: {formatSpeed(worldDebug.worldZ)}</span>
          <span>world scrolling: {worldDebug.scrolling ? 'true' : 'false'}</span>
          <span>movement speed: {formatSpeed(tracking.motion?.speed)}</span>
          <span>motion intensity: {formatSpeed(tracking.motion?.motionIntensity)}</span>
          <span>speed multiplier: {formatSpeed(tracking.motion?.speedMultiplier)}</span>
          <span>final speed: {formatSpeed(tracking.motion?.finalSpeed)}</span>
          <span>smoothed speed: {formatSpeed(worldDebug.smoothedSpeed)}</span>
          <span>keyboard active: {worldDebug.keyboardActive ? 'true' : 'false'}</span>
          <span>keyboard forward: {formatSpeed(worldDebug.keyboardForward)}</span>
          <span>keyboard side: {formatSpeed(worldDebug.keyboardSide)}</span>
          <span>keyboard speed multiplier: {formatSpeed(worldDebug.keyboardSpeedMultiplier)}</span>
          <span>keyboard smoothing: {formatSpeed(worldDebug.keyboardSmoothing)}</span>
          <span>movement smoothing: {formatSpeed(worldDebug.movementSmoothing)}</span>
          <span>smoothed movement value: {formatSpeed(worldDebug.keyboardMovementValue)}</span>
          <span>tracking.pose exists: {tracking.pose ? 'true' : 'false'}</span>
          <span>tracking.pose keys: {poseKeys.length > 0 ? poseKeys.join(', ') : 'none'}</span>
          <span>pose wrist indices: left=15 right=16</span>
          <span>pose shoulder indices: left=11 right=12</span>
          <span>pose leftWrist exists: {leftWrist ? 'true' : 'false'}</span>
          <span>pose rightWrist exists: {rightWrist ? 'true' : 'false'}</span>
          <span>raw leftWrist x/y: {formatPointXY(leftWrist)}</span>
          <span>raw rightWrist x/y: {formatPointXY(rightWrist)}</span>
          <span>raw leftShoulder x/y: {formatPointXY(leftShoulder)}</span>
          <span>raw rightShoulder x/y: {formatPointXY(rightShoulder)}</span>
          <span>left wrist visibility: {formatLandmarkConfidence(leftWrist)}</span>
          <span>right wrist visibility: {formatLandmarkConfidence(rightWrist)}</span>
          <span>left wrist normalized: {isNormalizedPoint(leftWrist) ? 'true' : 'false'}</span>
          <span>right wrist normalized: {isNormalizedPoint(rightWrist) ? 'true' : 'false'}</span>
          <span>raw leftWrist.x: {formatSpeed(worldDebug.rawLeftWristX)}</span>
          <span>raw rightWrist.x: {formatSpeed(worldDebug.rawRightWristX)}</span>
          <span>left wrist delta x: {formatSpeed(worldDebug.leftWristDeltaX)}</span>
          <span>right wrist delta x: {formatSpeed(worldDebug.rightWristDeltaX)}</span>
          <span>swipe left detected: {worldDebug.swipeLeftDetected ? 'true' : 'false'}</span>
          <span>swipe right detected: {worldDebug.swipeRightDetected ? 'true' : 'false'}</span>
          <span>gesture released: {worldDebug.armTurnReleased ? 'true' : 'false'}</span>
          <span>gesture trigger attempted: {worldDebug.armTurnTriggerAttempted ? 'true' : 'false'}</span>
          <span>gesture trigger accepted: {worldDebug.armTurnTriggerAccepted ? 'true' : 'false'}</span>
          <span>gesture blocked reason: {worldDebug.armTurnBlockedReason ?? 'ready'}</span>
          <span>gesture triggered: {worldDebug.armTurnTriggered || 'none'}</span>
          <span>arm turn cooldown: {(worldDebug.armTurnCooldownMs / 1000).toFixed(1)}s</span>
          <span>current heading: {formatAngle(worldDebug.heading)}</span>
          <span>effective avatar yaw: {formatAngle(worldDebug.effectiveAvatarYaw)}</span>
          <span>avatar facing angle: {formatAngle(worldDebug.facingAngle)}</span>
          <span>avatar base yaw: {formatAngle(worldDebug.avatarBaseYaw ?? Math.PI)}</span>
          <span>avatar yaw influence: {formatSpeed(worldDebug.yawInfluence)}</span>
          <span>left wrist avatar x: {formatSpeed(worldDebug.leftWristAvatarX)}</span>
          <span>right wrist avatar x: {formatSpeed(worldDebug.rightWristAvatarX)}</span>
          <span>pose mode: {worldDebug.poseMode}</span>
          <span>screen-left wrist source: {worldDebug.screenLeftWristSource}</span>
          <span>screen-right wrist source: {worldDebug.screenRightWristSource}</span>
          <span>screen-left knee source: {worldDebug.screenLeftKneeSource}</span>
          <span>screen-right knee source: {worldDebug.screenRightKneeSource}</span>
          <span>pose mirror x: {worldDebug.poseMirrorX}</span>
          <span>pose debug mode: {worldDebug.poseDebugMode ? 'true' : 'false'}</span>
          <span>nearby part: {pickupDebug.nearbyPart}</span>
          <span>hands low: {pickupDebug.handsLow ? 'true' : 'false'}</span>
          <span>pickup gesture: {pickupDebug.gestureState}</span>
          <span>perf fps: {formatSpeed(perf.fps)}</span>
          <span>perf frame ms: {formatMs(perf.avgFrameMs)}</span>
          <span>perf meshes: {formatCount(perf.meshCount)}</span>
          <span>perf draw calls: {formatCount(perf.drawCalls)}</span>
          <span>perf visible objects: {formatCount(perf.visibleObjects)}</span>
          <span>perf total objects: {formatCount(perf.totalObjects)}</span>
          <span>perf render ms: {formatMs(perf.avgRenderMs)}</span>
          <span>perf ambient loop ms: {formatMs(perf.avgAmbientMs)}</span>
          <span>perf avatar loop ms: {formatMs(perf.avgAvatarMs)}</span>
          <span>perf heading loop ms: {formatMs(perf.avgHeadingMs)}</span>
          <span>perf world/camera ms: {formatMs(perf.avgWorldMs)}</span>
          <span>perf pickup loop ms: {formatMs(perf.avgPickupMs)}</span>
          <span>perf map/debug ms: {formatMs(perf.avgMapDebugMs)}</span>
          <span>MediaPipe active: {perf.mediaPipeActive ? 'true' : 'false'}</span>
          <span>MediaPipe frame ms: {formatMs(perf.mediaPipeFrameMs)}</span>
          <span>MediaPipe hand ms: {formatMs(perf.mediaPipeHandMs)}</span>
          <span>MediaPipe pose ms: {formatMs(perf.mediaPipePoseMs)}</span>
          <span>MediaPipe post ms: {formatMs(perf.mediaPipePostMs)}</span>
        </div>

        <div className="map-gesture-debug" aria-live="polite">
          <span>current area: {getTownAreaLabel(worldDebug.currentAreaId ?? currentAreaId)}</span>
          <span>hands raised: {mapGestureDebug.handsRaised ? 'true' : 'false'}</span>
          <span>map cooldown: {(mapGestureDebug.cooldownMs / 1000).toFixed(1)}s</span>
          <span>map open: {isMapOpen ? 'true' : 'false'}</span>
        </div>
      </div>
    </div>
  )
}

function formatSpeed(speed) {
  return (speed ?? 0).toFixed(2)
}

function formatMs(value) {
  return `${formatSpeed(value)}ms`
}

function formatCount(value) {
  return Math.round(value ?? 0).toString()
}

function formatPointXY(point) {
  if (!point) {
    return 'missing'
  }

  return `${formatSpeed(point.x)} / ${formatSpeed(point.y)}`
}

function formatLandmarkConfidence(point) {
  if (!point) {
    return 'missing'
  }

  const visibility = Number.isFinite(point.visibility) ? point.visibility : null
  const presence = Number.isFinite(point.presence) ? point.presence : null

  if (visibility === null && presence === null) {
    return 'none'
  }

  return `visibility ${visibility === null ? 'n/a' : formatSpeed(visibility)}, presence ${presence === null ? 'n/a' : formatSpeed(presence)}`
}

function isNormalizedPoint(point) {
  return (
    Number.isFinite(point?.x) &&
    Number.isFinite(point?.y) &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1
  )
}

function formatAngle(angle) {
  return `${(((angle ?? Math.PI) * 180) / Math.PI).toFixed(0)} deg`
}

function formatVector(motion) {
  const x = motion?.directionX ?? 0
  const z = motion?.directionZ ?? -1

  return `${x.toFixed(2)} / ${z.toFixed(2)}`
}
