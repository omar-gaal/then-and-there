/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTulipGame } from '../hooks/useTulipGame'
import { usePoseTracking } from '../hooks/usePoseTracking'
import { useHandHover } from '../hooks/useHandHover'
import { AmsterdamStage } from './AmsterdamStage'

const AUTO_START_SECONDS = 3

const COUNTDOWN_SECONDS = 3

export function AmsterdamExperience({ onBackToMap }) {
  const pose = usePoseTracking()
  const hand = useHandHover()
  const {
    canvasRef: poseCanvasRef,
    handleCameraError,
    handleCameraReady,
    isLoading,
    isRunning,
    jumpCount,
    startCamera,
    stopCamera,
    tracking,
    videoConstraints,
    webcamRef,
  } = pose
  const {
    canvasRef: handCanvasRef,
    fingerPos,
    handleCameraReady: handleHandCameraReady,
    isReady: handIsReady,
    resume: resumeHand,
    stop: stopHand,
    webcamRef: handWebcamRef,
  } = hand
  const { game, resetRound, startRound, triggerJump } = useTulipGame({
    isCalibrated: tracking.isCalibrated,
    isRunning,
    jumpCount,
  })

  const [countdown, setCountdown] = useState(null)
  const [activeHoverId, setActiveHoverId] = useState(null)
  const hoverStartRef = useRef(null)
  const hoverTargetIdRef = useRef(null)
  const firedRef = useRef(false)
  const mapHoverRef = useRef(null)
  const [preRoundCountdown, setPreRoundCountdown] = useState(null)
  const runAgainHoverRef = useRef(null)
  const stageRef = useRef(null)
  const startHoverRef = useRef(null)

  const handleBackToMap = useCallback(() => {
    resetRound()
    stopCamera()
    stopHand()
    setCountdown(null)
    setActiveHoverId(null)
    hoverTargetIdRef.current = null
    firedRef.current = false
    onBackToMap?.()
  }, [onBackToMap, resetRound, stopCamera, stopHand])

  // Resume hand tracking whenever the round ends so user can hover "Run again"
  useEffect(() => {
    if (game.status === 'finished') {
      resumeHand()
    }
    // When a new round starts, clear any stale hover state
    if (game.status === 'playing') {
      firedRef.current = false
      hoverStartRef.current = null
      hoverTargetIdRef.current = null
      setCountdown(null)
      setActiveHoverId(null)
    }
  }, [game.status, resumeHand])

  // Hover over zone → countdown → start camera (pre-game) or restart round (post-round)
  useEffect(() => {
    const isPreGame = !isRunning && !isLoading
    const isPostRound = isRunning && game.status === 'finished'

    if (!isPreGame && !isPostRound) {
      hoverStartRef.current = null
      hoverTargetIdRef.current = null
      if (!isPostRound) firedRef.current = false
      setCountdown(null)
      setActiveHoverId(null)
      return
    }

    if (!fingerPos) {
      hoverStartRef.current = null
      hoverTargetIdRef.current = null
      setCountdown(null)
      setActiveHoverId(null)
      return
    }

    const stageRect = stageRef.current?.getBoundingClientRect()
    const hoverTargets = isPostRound
      ? [
          { id: 'again', ref: runAgainHoverRef },
          { id: 'map', ref: mapHoverRef },
        ]
      : [{ id: 'start', ref: startHoverRef }]
    const hoverTarget = hoverTargets.find((target) => {
      const rect = target.ref.current?.getBoundingClientRect()

      if (!stageRect || !rect) {
        return false
      }

      const pointX = stageRect.left + fingerPos.x * stageRect.width
      const pointY = stageRect.top + fingerPos.y * stageRect.height

      return pointX >= rect.left && pointX <= rect.right && pointY >= rect.top && pointY <= rect.bottom
    })

    if (!hoverTarget) {
      hoverStartRef.current = null
      hoverTargetIdRef.current = null
      setCountdown(null)
      setActiveHoverId(null)
      return
    }

    if (hoverTargetIdRef.current !== hoverTarget.id) {
      hoverStartRef.current = null
      firedRef.current = false
    }

    hoverTargetIdRef.current = hoverTarget.id
    setActiveHoverId(hoverTarget.id)

    if (hoverStartRef.current === null) hoverStartRef.current = Date.now()

    const elapsed = (Date.now() - hoverStartRef.current) / 1000
    const remaining = Math.ceil(Math.max(0, COUNTDOWN_SECONDS - elapsed))
    setCountdown(remaining)

    if (remaining === 0 && !firedRef.current) {
      firedRef.current = true
      stopHand()
      if (isPreGame) {
        startCamera()
      } else if (hoverTarget.id === 'map') {
        handleBackToMap()
      } else {
        startRound()
      }
    }
  }, [fingerPos, game.status, handleBackToMap, isLoading, isRunning, startCamera, startRound, stopHand])

  // After calibration completes, count down then auto-start the round
  useEffect(() => {
    if (!tracking.isCalibrated || game.status !== 'ready') {
      setPreRoundCountdown(null)
      return
    }
    setPreRoundCountdown(AUTO_START_SECONDS)
  }, [tracking.isCalibrated, game.status])

  useEffect(() => {
    if (preRoundCountdown === null || preRoundCountdown <= 0) {
      if (preRoundCountdown === 0) startRound()
      return
    }
    const t = setTimeout(() => setPreRoundCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [preRoundCountdown, startRound])

  // function handleStopCamera() {
  //   resetRound()
  //   stopCamera()
  //   setCountdown(null)
  //   setActiveHoverId(null)
  //   hoverTargetIdRef.current = null
  //   firedRef.current = false
  // }

  return (
    <>
      <header className="topbar">
        <div><p className="eyebrow">Amsterdam prototype</p><h1>Tulip Canal Run</h1></div>
      </header>
      <section className="workspace workspace--stage-only" aria-label="Amsterdam tulip jumping game">
        <AmsterdamStage
          activeHoverId={activeHoverId}
          canvasRef={poseCanvasRef}
          countdown={countdown}
          fingerPos={fingerPos}
          game={game}
          handCanvasRef={handCanvasRef}
          handIsReady={handIsReady}
          handWebcamRef={handWebcamRef}
          isCalibrated={tracking.isCalibrated}
          isLoading={isLoading}
          isRunning={isRunning}
          onBackToMap={handleBackToMap}
          onCameraError={handleCameraError}
          onCameraReady={handleCameraReady}
          onHandCameraReady={handleHandCameraReady}
          onJump={triggerJump}
          onStartCamera={startCamera}
          onStartRound={startRound}
          preRoundCountdown={preRoundCountdown}
          mapHoverRef={mapHoverRef}
          runAgainHoverRef={runAgainHoverRef}
          stageRef={stageRef}
          startHoverRef={startHoverRef}
          tracking={tracking}
          videoConstraints={videoConstraints}
          webcamRef={webcamRef}
        />
      </section>
    </>
  )
}
