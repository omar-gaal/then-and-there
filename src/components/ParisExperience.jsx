import { useEffect, useRef, useState } from 'react'
import { movePuckToPoint } from '../gestures'
import { useCatchGame } from '../hooks/useCatchGame'
import { useHandHover } from '../hooks/useHandHover'
import { useHandTracking } from '../hooks/useHandTracking'
import { ParisPanel } from './ParisPanel'
import { StatusPill } from './StatusPill'
import { TrackingStage } from './TrackingStage'

const HOVER_TARGET = { x: 0.5, y: 0.62, radius: 0.22 }
const COUNTDOWN_SECONDS = 3

export function ParisExperience() {
  const stageRef = useRef(null)
  const { canvasRef, handleCameraError, handleCameraReady, isLoading, isRunning, puckRef, startCamera, stopCamera, tracking, webcamRef } = useHandTracking()
  const { game, startRound } = useCatchGame({ isRunning, puckRef, stageRef })
  const hand = useHandHover()

  const [countdown, setCountdown] = useState(null)
  const hoverStartRef = useRef(null)
  const firedRef = useRef(false)

  // Auto-start the round as soon as the camera is running
  useEffect(() => {
    if (isRunning && game.status === 'ready') {
      startRound()
    }
  }, [isRunning, game.status, startRound])

  // Resume hand hover when round ends so user can hover "Play again"
  useEffect(() => {
    if (game.status === 'finished') {
      hand.resume()
    }
    if (game.status === 'playing') {
      firedRef.current = false
      hoverStartRef.current = null
      setCountdown(null)
    }
  }, [game.status, hand.resume])

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
        startCamera()
      } else {
        startRound()
      }
    }
  }, [hand.fingerPos, hand.stop, isRunning, isLoading, startCamera, game.status, startRound])

  function handlePointerAim(point) {
    movePuckToPoint({ ...point, scale: 1.02 }, puckRef.current)
  }

  return (
    <>
      <header className="topbar"><div><p className="eyebrow">Paris prototype</p><h1>Paris Pastry Catch</h1></div><StatusPill mode={tracking.mode} label={tracking.label} /></header>
      <section className="workspace" aria-label="Paris pastry catching game">
        <TrackingStage
          canvasRef={canvasRef}
          countdown={countdown}
          fingerPos={hand.fingerPos}
          game={game}
          handCanvasRef={hand.canvasRef}
          handIsReady={hand.isReady}
          handWebcamRef={hand.webcamRef}
          isLoading={isLoading}
          isRunning={isRunning}
          onCameraError={handleCameraError}
          onCameraReady={handleCameraReady}
          onHandCameraReady={hand.handleCameraReady}
          onPointerAim={handlePointerAim}
          onStartCamera={startCamera}
          onStartRound={startRound}
          puckRef={puckRef}
          stageRef={stageRef}
          webcamRef={webcamRef}
        />
        <ParisPanel game={game} isLoading={isLoading} isRunning={isRunning} onStartCamera={startCamera} onStopCamera={stopCamera} tracking={tracking} />
      </section>
    </>
  )
}
