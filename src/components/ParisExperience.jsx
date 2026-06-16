/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState } from 'react'
import { movePuckToPoint } from '../gestures'
import { useCatchGame } from '../hooks/useCatchGame'
import { useHandTracking } from '../hooks/useHandTracking'
import { ParisPanel } from './ParisPanel'
import { StatusPill } from './StatusPill'
import { TrackingStage } from './TrackingStage'

const COUNTDOWN_SECONDS = 3

export function ParisExperience({ onBackToMap }) {
  const mapHoverRef = useRef(null)
  const playAgainHoverRef = useRef(null)
  const stageRef = useRef(null)
  const { canvasRef, handleCameraError, handleCameraReady, isLoading, isRunning, puckRef, startCamera, stopCamera, tracking, webcamRef } = useHandTracking()
  const { game, resetRound, startRound } = useCatchGame({ isRunning, puckRef, stageRef })
  const [activeHoverId, setActiveHoverId] = useState(null)
  const [countdown, setCountdown] = useState(null)
  const hoverStartRef = useRef(null)
  const hoverTargetIdRef = useRef(null)
  const firedRef = useRef(false)

  const handleBackToMap = useCallback(() => {
    resetRound()
    stopCamera()
    setActiveHoverId(null)
    setCountdown(null)
    hoverStartRef.current = null
    hoverTargetIdRef.current = null
    firedRef.current = false
    onBackToMap?.()
  }, [onBackToMap, resetRound, stopCamera])

  function handlePointerAim(point) {
    movePuckToPoint({ ...point, scale: 1.02 }, puckRef.current)
  }

  useEffect(() => {
    if (!isRunning || game.status !== 'finished') {
      hoverStartRef.current = null
      hoverTargetIdRef.current = null
      firedRef.current = false
      setActiveHoverId(null)
      setCountdown(null)
      return
    }

    const stageRect = stageRef.current?.getBoundingClientRect()
    const puck = puckRef.current
    const puckX = Number(puck?.dataset.x)
    const puckY = Number(puck?.dataset.y)

    if (!stageRect || !Number.isFinite(puckX) || !Number.isFinite(puckY)) {
      hoverStartRef.current = null
      hoverTargetIdRef.current = null
      setActiveHoverId(null)
      setCountdown(null)
      return
    }

    const pointX = stageRect.left + puckX * stageRect.width
    const pointY = stageRect.top + puckY * stageRect.height
    const hoverTargets = [
      { id: 'again', ref: playAgainHoverRef },
      { id: 'map', ref: mapHoverRef },
    ]
    const hoverTarget = hoverTargets.find((target) => {
      const rect = target.ref.current?.getBoundingClientRect()

      return rect && pointX >= rect.left && pointX <= rect.right && pointY >= rect.top && pointY <= rect.bottom
    })

    if (!hoverTarget) {
      hoverStartRef.current = null
      hoverTargetIdRef.current = null
      setActiveHoverId(null)
      setCountdown(null)
      return
    }

    if (hoverTargetIdRef.current !== hoverTarget.id) {
      hoverStartRef.current = null
      firedRef.current = false
    }

    hoverTargetIdRef.current = hoverTarget.id
    setActiveHoverId(hoverTarget.id)

    if (hoverStartRef.current === null) {
      hoverStartRef.current = Date.now()
    }

    const elapsed = (Date.now() - hoverStartRef.current) / 1000
    const remaining = Math.ceil(Math.max(0, COUNTDOWN_SECONDS - elapsed))
    setCountdown(remaining)

    if (remaining === 0 && !firedRef.current) {
      firedRef.current = true
      if (hoverTarget.id === 'map') {
        handleBackToMap()
      } else {
        startRound()
      }
    }
  }, [game.status, handleBackToMap, isRunning, puckRef, startRound, tracking])

  return (
    <>
      <header className="topbar"><div><p className="eyebrow">Paris prototype</p><h1>Paris Pastry Catch</h1></div><StatusPill mode={tracking.mode} label={tracking.label} /></header>
      <section className="workspace" aria-label="Paris pastry catching game">
        <TrackingStage activeHoverId={activeHoverId} canvasRef={canvasRef} countdown={countdown} game={game} mapHoverRef={mapHoverRef} onBackToMap={handleBackToMap} onCameraError={handleCameraError} onCameraReady={handleCameraReady} isLoading={isLoading} isRunning={isRunning} onPointerAim={handlePointerAim} onStartCamera={startCamera} onStartRound={startRound} playAgainHoverRef={playAgainHoverRef} puckRef={puckRef} stageRef={stageRef} webcamRef={webcamRef} />
        <ParisPanel game={game} isLoading={isLoading} isRunning={isRunning} onStartCamera={startCamera} onStopCamera={stopCamera} tracking={tracking} />
      </section>
    </>
  )
}
