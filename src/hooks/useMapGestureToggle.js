// Map gesture hook: toggles the map after a debounced both-hands-raised pose.
import { useEffect, useRef, useState } from 'react'

const MAP_GESTURE_HOLD_MS = 500
const MAP_GESTURE_COOLDOWN_MS = 1000

export function useMapGestureToggle({ pose, onToggle }) {
  const [mapGestureDebug, setMapGestureDebug] = useState({
    cooldownMs: 0,
    handsRaised: false,
  })
  const mapGestureArmedRef = useRef(true)
  const mapGestureCooldownUntilRef = useRef(0)
  const mapGestureRaisedSinceRef = useRef(null)

  useEffect(() => {
    const now = performance.now()
    const handsRaised = getHandsRaisedForMap(pose)
    const cooldownMs = Math.max(0, mapGestureCooldownUntilRef.current - now)

    if (!handsRaised) {
      mapGestureArmedRef.current = true
      mapGestureRaisedSinceRef.current = null
      setMapGestureDebug({ cooldownMs, handsRaised: false })
      return
    }

    if (!mapGestureRaisedSinceRef.current) {
      mapGestureRaisedSinceRef.current = now
    }

    const heldMs = now - mapGestureRaisedSinceRef.current
    if (mapGestureArmedRef.current && cooldownMs <= 0 && heldMs >= MAP_GESTURE_HOLD_MS) {
      onToggle()
      mapGestureArmedRef.current = false
      mapGestureCooldownUntilRef.current = now + MAP_GESTURE_COOLDOWN_MS
      setMapGestureDebug({ cooldownMs: MAP_GESTURE_COOLDOWN_MS, handsRaised: true })
      return
    }

    setMapGestureDebug({
      cooldownMs,
      handsRaised: true,
    })
  }, [onToggle, pose])

  return mapGestureDebug
}

function getHandsRaisedForMap(pose) {
  const leftWrist = pose?.leftWrist
  const rightWrist = pose?.rightWrist
  const nose = pose?.nose
  const leftShoulder = pose?.leftShoulder
  const rightShoulder = pose?.rightShoulder

  if (!isUsableLandmark(leftWrist) || !isUsableLandmark(rightWrist)) {
    return false
  }

  const aboveNose = isUsableLandmark(nose) && leftWrist.y < nose.y && rightWrist.y < nose.y
  const aboveShoulders =
    isUsableLandmark(leftShoulder) &&
    isUsableLandmark(rightShoulder) &&
    leftWrist.y < leftShoulder.y - 0.08 &&
    rightWrist.y < rightShoulder.y - 0.08

  return aboveNose || aboveShoulders
}

function isUsableLandmark(point) {
  return Number.isFinite(point?.x) && Number.isFinite(point?.y)
}
