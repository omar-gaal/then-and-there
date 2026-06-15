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
  const { game, resetRound, startRound, triggerJump } = useTulipGame({
    isCalibrated: pose.tracking.isCalibrated,
    isRunning: pose.isRunning,
    jumpCount: pose.jumpCount,
  })

  const [countdown, setCountdown] = useState(null)
  const hoverStartRef = useRef(null)
  const firedRef = useRef(false)
  const [preRoundCountdown, setPreRoundCountdown] = useState(null)

  // Resume hand tracking whenever the round ends so user can hover "Run again"
  useEffect(() => {
    if (game.status === 'finished') {
      hand.resume()
    }
    // When a new round starts, clear any stale hover state
    if (game.status === 'playing') {
      firedRef.current = false
      hoverStartRef.current = null
      setCountdown(null)
    }
  }, [game.status, hand.resume])

  // Hover over zone → countdown → start camera (pre-game) or restart round (post-round)
  useEffect(() => {
    const isPreGame = !pose.isRunning && !pose.isLoading
    const isPostRound = pose.isRunning && game.status === 'finished'

    if (!isPreGame && !isPostRound) {
      hoverStartRef.current = null
      if (!isPostRound) firedRef.current = false
      setCountdown(null)
      return
    }

    if (!hand.fingerPos) {
      hoverStartRef.current = null
      setCountdown(null)
      return
    }

    const dist = Math.hypot(
      hand.fingerPos.x - HOVER_TARGET.x,
      hand.fingerPos.y - HOVER_TARGET.y,
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
      hand.stop()
      if (isPreGame) {
        pose.startCamera()
      } else {
        startRound()
      }
    }
  }, [hand.fingerPos, hand.stop, pose.isRunning, pose.isLoading, pose.startCamera, game.status, startRound])

  // After calibration completes, count down then auto-start the round
  useEffect(() => {
    if (!pose.tracking.isCalibrated || game.status !== 'ready') {
      setPreRoundCountdown(null)
      return
    }
    setPreRoundCountdown(AUTO_START_SECONDS)
  }, [pose.tracking.isCalibrated, game.status])

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
    pose.stopCamera()
    setCountdown(null)
    firedRef.current = false
  }

  return (
    <>
      <header className="topbar">
        <div><p className="eyebrow">Amsterdam prototype</p><h1>Tulip Canal Run</h1></div>
        <StatusPill mode={pose.tracking.mode} label={pose.tracking.label} />
      </header>
      <section className="workspace" aria-label="Amsterdam tulip jumping game">
        <AmsterdamStage
          canvasRef={pose.canvasRef}
          countdown={countdown}
          fingerPos={hand.fingerPos}
          game={game}
          handCanvasRef={hand.canvasRef}
          handIsReady={hand.isReady}
          handWebcamRef={hand.webcamRef}
          hoverTarget={HOVER_TARGET}
          isCalibrated={pose.tracking.isCalibrated}
          isLoading={pose.isLoading}
          isRunning={pose.isRunning}
          onCameraError={pose.handleCameraError}
          onCameraReady={pose.handleCameraReady}
          onHandCameraReady={hand.handleCameraReady}
          onJump={triggerJump}
          onStartCamera={pose.startCamera}
          onStartRound={startRound}
          preRoundCountdown={preRoundCountdown}
          tracking={pose.tracking}
          videoConstraints={pose.videoConstraints}
          webcamRef={pose.webcamRef}
        />
        <AmsterdamPanel
          game={game}
          isLoading={pose.isLoading}
          isRunning={pose.isRunning}
          onStartCamera={pose.startCamera}
          onStopCamera={handleStopCamera}
          tracking={pose.tracking}
        />
      </section>
    </>
  )
}
