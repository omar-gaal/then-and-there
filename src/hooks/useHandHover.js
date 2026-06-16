import { useCallback, useEffect, useRef, useState } from 'react'
import { clearCanvas, createHandLandmarker, drawHand, resizeCanvasToVideo } from '../handTracking'
import { getHandGesture } from '../gestures'

export function useHandHover() {
  const webcamRef = useRef(null)
  const canvasRef = useRef(null)
  const landmarkerRef = useRef(null)
  const animationRef = useRef(0)
  const lastVideoTimeRef = useRef(-1)
  const activeRef = useRef(false)
  const runLoopRef = useRef(() => {})

  const [isReady, setIsReady] = useState(false)
  const [fingerPos, setFingerPos] = useState(null) // { x, y } normalized 0-1, mirrored

  const runLoop = useCallback(() => {
    if (!activeRef.current) return
    const video = webcamRef.current?.video
    const canvas = canvasRef.current
    const landmarker = landmarkerRef.current

    if (!video || !canvas || !landmarker) {
      animationRef.current = requestAnimationFrame(runLoopRef.current)
      return
    }

    resizeCanvasToVideo(canvas, video)

    if (
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      video.videoWidth > 0 &&
      video.currentTime !== lastVideoTimeRef.current
    ) {
      lastVideoTimeRef.current = video.currentTime
      const results = landmarker.detectForVideo(video, performance.now())
      const landmarks = results.landmarks?.[0]

      if (landmarks) {
        drawHand(canvas, landmarks)
        const gesture = getHandGesture(landmarks)
        // Mirror x so hand matches what user sees (like a mirror)
        setFingerPos({ x: 1 - gesture.indexTip.x, y: gesture.indexTip.y })
      } else {
        clearCanvas(canvas)
        setFingerPos(null)
      }
    }

    animationRef.current = requestAnimationFrame(runLoopRef.current)
  }, [])

  useEffect(() => {
    runLoopRef.current = runLoop
  }, [runLoop])

  const handleCameraReady = useCallback(() => {
    activeRef.current = true
    cancelAnimationFrame(animationRef.current)
    runLoop()
  }, [runLoop])

  const stop = useCallback(() => {
    activeRef.current = false
    cancelAnimationFrame(animationRef.current)
    clearCanvas(canvasRef.current)
    setFingerPos(null)
  }, [])

  // Call after remounting the webcam (e.g. when round ends and webcam re-appears)
  const resume = useCallback(() => {
    if (!landmarkerRef.current) return
    lastVideoTimeRef.current = -1
    activeRef.current = true
    cancelAnimationFrame(animationRef.current)
    runLoop()
  }, [runLoop])

  useEffect(() => {
    let mounted = true
    createHandLandmarker()
      .then((lm) => {
        if (mounted) {
          landmarkerRef.current = lm
          setIsReady(true)
        } else {
          lm.close()
        }
      })
      .catch(console.error)

    return () => {
      mounted = false
      activeRef.current = false
      cancelAnimationFrame(animationRef.current)
      landmarkerRef.current?.close()
    }
  }, [])

  return { webcamRef, canvasRef, fingerPos, isReady, stop, resume, handleCameraReady }
}
