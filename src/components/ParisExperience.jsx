import { useRef } from 'react'
import { movePuckToPoint } from '../gestures'
import { useCatchGame } from '../hooks/useCatchGame'
import { useHandTracking } from '../hooks/useHandTracking'
import { ParisPanel } from './ParisPanel'
import { StatusPill } from './StatusPill'
import { TrackingStage } from './TrackingStage'

export function ParisExperience() {
  const stageRef = useRef(null)
  const { canvasRef, handleCameraError, handleCameraReady, isLoading, isRunning, puckRef, startCamera, stopCamera, tracking, webcamRef } = useHandTracking()
  const { game, startRound } = useCatchGame({ isRunning, puckRef, stageRef })

  function handlePointerAim(point) {
    movePuckToPoint({ ...point, scale: 1.02 }, puckRef.current)
  }

  return (
    <>
      <header className="topbar"><div><p className="eyebrow">Paris prototype</p><h1>Paris Pastry Catch</h1></div><StatusPill mode={tracking.mode} label={tracking.label} /></header>
      <section className="workspace" aria-label="Paris pastry catching game">
        <TrackingStage canvasRef={canvasRef} onCameraError={handleCameraError} onCameraReady={handleCameraReady} isLoading={isLoading} isRunning={isRunning} game={game} onStartCamera={startCamera} onPointerAim={handlePointerAim} onStartRound={startRound} puckRef={puckRef} stageRef={stageRef} webcamRef={webcamRef} />
        <ParisPanel game={game} isLoading={isLoading} isRunning={isRunning} onStartCamera={startCamera} onStopCamera={stopCamera} tracking={tracking} />
      </section>
    </>
  )
}
