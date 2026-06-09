import { useRef } from 'react'
import { ControlPanel } from './components/ControlPanel'
import { StatusPill } from './components/StatusPill'
import { TrackingStage } from './components/TrackingStage'
import { movePuckToPoint } from './gestures'
import { useCatchGame } from './hooks/useCatchGame'
import { useHandTracking } from './hooks/useHandTracking'
import './App.css'

function App() {
  const stageRef = useRef(null)
  const {
    canvasRef,
    handleCameraError,
    handleCameraReady,
    isLoading,
    isRunning,
    puckRef,
    startCamera,
    stopCamera,
    tracking,
    webcamRef,
  } = useHandTracking()
  const { game, startRound } = useCatchGame({ isRunning, puckRef, stageRef })

  function handlePointerAim(point) {
    movePuckToPoint({ ...point, scale: 1.02 }, puckRef.current)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Paris prototype</p>
          <h1>Paris Pastry Catch</h1>
        </div>
        <StatusPill mode={tracking.mode} label={tracking.label} />
      </header>

      <section className="workspace" aria-label="Paris pastry catching game">
        <TrackingStage
          canvasRef={canvasRef}
          onCameraError={handleCameraError}
          onCameraReady={handleCameraReady}
          isLoading={isLoading}
          isRunning={isRunning}
          game={game}
          onStartCamera={startCamera}
          onPointerAim={handlePointerAim}
          onStartRound={startRound}
          puckRef={puckRef}
          stageRef={stageRef}
          webcamRef={webcamRef}
        />

        <ControlPanel
          game={game}
          isLoading={isLoading}
          isRunning={isRunning}
          onStartCamera={startCamera}
          onStopCamera={stopCamera}
          tracking={tracking}
        />
      </section>
    </main>
  )
}

export default App
