/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState } from 'react'
import { movePuckToPoint } from '../gestures'
import { useCatchGame } from '../hooks/useCatchGame'
import { useHandHover } from '../hooks/useHandHover'
import { useHandTracking } from '../hooks/useHandTracking'
import { ParisPanel } from './ParisPanel'
import { StatusPill } from './StatusPill'
import { TrackingStage } from './TrackingStage'

const COUNTDOWN_SECONDS = 3

export function ParisExperience({ onBackToMap }) {
  const stageRef = useRef(null)
  const startHoverRef = useRef(null)
  const playAgainHoverRef = useRef(null)
  const mapHoverRef = useRef(null)
  const hoverStartRef = useRef(null)
  const hoverTargetIdRef = useRef(null)
  const firedRef = useRef(false)

  const hand = useHandHover()
  const { canvasRef, handleCameraError, handleCameraReady, isLoading, isRunning, puckRef, startCamera, stopCamera, tracking, webcamRef } = useHandTracking()
  const { game, resetRound, startRound } = useCatchGame({ isRunning, puckRef, stageRef })
  const [countdown, setCountdown] = useState(null)
  const [activeHoverId, setActiveHoverId] = useState(null)

  const handleBackToMap = useCallback(() => {
    resetRound()
    stopCamera()
    hand.resume()
    hoverStartRef.current = null
    hoverTargetIdRef.current = null
    firedRef.current = false
    setCountdown(null)
    setActiveHoverId(null)
    onBackToMap?.()
  }, [hand, onBackToMap, resetRound, stopCamera])

  // Auto-start round as soon as camera is running
  useEffect(() => {
    if (isRunning && game.status === 'ready') startRound()
  }, [isRunning, game.status, startRound])

  // Resume hand hover when round ends; reset hover state when playing
  useEffect(() => {
    if (game.status === 'finished') hand.resume()
    if (game.status === 'playing') {
      firedRef.current = false
      hoverStartRef.current = null
      hoverTargetIdRef.current = null
      setCountdown(null)
      setActiveHoverId(null)
    }
  }, [game.status, hand])

  // Hover over button → 3s countdown → fire action (same pattern as Amsterdam)
  useEffect(() => {
    const fp = hand.fingerPos
    const isPreGame = !isRunning && !isLoading
    const isPostRound = isRunning && game.status === 'finished'

    if (!isPreGame && !isPostRound) {
      hoverStartRef.current = null
      hoverTargetIdRef.current = null
      setCountdown(null)
      setActiveHoverId(null)
      return
    }

    if (!fp) {
      hoverStartRef.current = null
      hoverTargetIdRef.current = null
      setCountdown(null)
      setActiveHoverId(null)
      return
    }

    const stageRect = stageRef.current?.getBoundingClientRect()
    const hoverTargets = isPostRound
      ? [
          { id: 'again', ref: playAgainHoverRef },
          { id: 'map', ref: mapHoverRef },
        ]
      : [{ id: 'start', ref: startHoverRef }]

    const hoverTarget = hoverTargets.find((target) => {
      const rect = target.ref.current?.getBoundingClientRect()
      if (!stageRect || !rect) return false
      const pointX = stageRect.left + fp.x * stageRect.width
      const pointY = stageRect.top + fp.y * stageRect.height
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
      hand.stop()
      if (isPreGame) {
        startCamera()
      } else if (hoverTarget.id === 'map') {
        handleBackToMap()
      } else {
        startRound()
      }
    }
  }, [hand, handleBackToMap, isRunning, isLoading, startCamera, game.status, startRound])

  function handlePointerAim(point) {
    movePuckToPoint({ ...point, scale: 1.02 }, puckRef.current)
  }

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Paris prototype</p>
          <h1>Paris Pastry Catch</h1>
        </div>
        <StatusPill mode={tracking.mode} label={tracking.label} />
      </header>
      <section className="workspace" aria-label="Paris pastry catching game">
        <TrackingStage
          activeHoverId={activeHoverId}
          canvasRef={canvasRef}
          countdown={countdown}
          fingerPos={hand.fingerPos}
          game={game}
          handCanvasRef={hand.canvasRef}
          handIsReady={hand.isReady}
          handWebcamRef={hand.webcamRef}
          isLoading={isLoading}
          isRunning={isRunning}
          mapHoverRef={mapHoverRef}
          onBackToMap={handleBackToMap}
          onCameraError={handleCameraError}
          onCameraReady={handleCameraReady}
          onHandCameraReady={hand.handleCameraReady}
          onPointerAim={handlePointerAim}
          onStartCamera={startCamera}
          onStartRound={startRound}
          playAgainHoverRef={playAgainHoverRef}
          puckRef={puckRef}
          stageRef={stageRef}
          startHoverRef={startHoverRef}
          webcamRef={webcamRef}
        />
        <ParisPanel game={game} isLoading={isLoading} isRunning={isRunning} onStartCamera={startCamera} onStopCamera={stopCamera} tracking={tracking} />
      </section>
    </>
  )
}
