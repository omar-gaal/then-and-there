/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from 'react'
import { useTulipGame } from '../hooks/useTulipGame'
import { usePoseTracking } from '../hooks/usePoseTracking'
import { useHandHover } from '../hooks/useHandHover'
import { AmsterdamPanel } from './AmsterdamPanel'
import { AmsterdamStage } from './AmsterdamStage'
import { StatusPill } from './StatusPill'

const AUTO_START_SECONDS = 3

// The hover zone covers the lower-center of the stage where the start button lives
const HOVER_TARGET = { x: 0.5, y: 0.62, radius: 0.22 }
const COUNTDOWN_SECONDS = 3

export function AmsterdamExperience() {
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
  const hoverStartRef = useRef(null)
  const firedRef = useRef(false)
  const [preRoundCountdown, setPreRoundCountdown] = useState(null)

  // Resume hand tracking whenever the round ends so user can hover "Run again"
  useEffect(() => {
    if (game.status === 'finished') {
      resumeHand()
    }
    // When a new round starts, clear any stale hover state
    if (game.status === 'playing') {
      firedRef.current = false
      hoverStartRef.current = null
      setCountdown(null)
    }
  }, [game.status, resumeHand])

  // Hover over zone → countdown → start camera (pre-game) or restart round (post-round)
  useEffect(() => {
    const isPreGame = !isRunning && !isLoading
    const isPostRound = isRunning && game.status === 'finished'

    if (!isPreGame && !isPostRound) {
      hoverStartRef.current = null
      if (!isPostRound) firedRef.current = false
      setCountdown(null)
      return
    }

    if (!fingerPos) {
      hoverStartRef.current = null
      setCountdown(null)
      return
    }

    const dist = Math.hypot(
      fingerPos.x - HOVER_TARGET.x,
      fingerPos.y - HOVER_TARGET.y,
    )

    if (dist > HOVER_TARGET.radius) {
      hoverStartRef.current = null
      setCountdown(null)
      return
    }

    if (hoverStartRef.current === null) hoverStartRef.current = Date.now()

    const elapsed = (Date.now() - hoverStartRef.current) / 1000
    const remaining = Math.ceil(Math.max(0, COUNTDOWN_SECONDS - elapsed))
    setCountdown(remaining)

    if (remaining === 0 && !firedRef.current) {
      firedRef.current = true
      stopHand()
      if (isPreGame) {
        startCamera()
      } else {
        startRound()
      }
    }
  }, [fingerPos, game.status, isLoading, isRunning, startCamera, startRound, stopHand])

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

  function handleStopCamera() {
    resetRound()
    stopCamera()
    setCountdown(null)
    firedRef.current = false
  }

  return (
    <>
      <header className="topbar">
        <div><p className="eyebrow">Amsterdam prototype</p><h1>Tulip Canal Run</h1></div>
        <StatusPill mode={tracking.mode} label={tracking.label} />
      </header>
      <section className="workspace" aria-label="Amsterdam tulip jumping game">
        <AmsterdamStage
          canvasRef={poseCanvasRef}
          countdown={countdown}
          fingerPos={fingerPos}
          game={game}
          handCanvasRef={handCanvasRef}
          handIsReady={handIsReady}
          handWebcamRef={handWebcamRef}
          hoverTarget={HOVER_TARGET}
          isCalibrated={tracking.isCalibrated}
          isLoading={isLoading}
          isRunning={isRunning}
          onCameraError={handleCameraError}
          onCameraReady={handleCameraReady}
          onHandCameraReady={handleHandCameraReady}
          onJump={triggerJump}
          onStartCamera={startCamera}
          onStartRound={startRound}
          preRoundCountdown={preRoundCountdown}
          tracking={tracking}
          videoConstraints={videoConstraints}
          webcamRef={webcamRef}
        />
        <AmsterdamPanel
          game={game}
          isLoading={isLoading}
          isRunning={isRunning}
          onStartCamera={startCamera}
          onStopCamera={handleStopCamera}
          tracking={tracking}
        />
      </section>
    </>
  )
}
