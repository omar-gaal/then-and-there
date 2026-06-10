import { useEffect, useRef, useState } from 'react'
import { ControlPanel } from './components/ControlPanel'
import { StatusPill } from './components/StatusPill'
import { TrackingStage } from './components/TrackingStage'
import { movePuckToPoint } from './gestures'
import { useCatchGame } from './hooks/useCatchGame'
import { useHandTracking } from './hooks/useHandTracking'
import './App.css'

function App() {
  const stageRef = useRef(null)
  const [isSplashVisible, setIsSplashVisible] = useState(true)
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

  useEffect(() => {
    const splashTimer = window.setTimeout(() => {
      setIsSplashVisible(false)
    }, 2200)

    return () => window.clearTimeout(splashTimer)
  }, [])

  function handlePointerAim(point) {
    movePuckToPoint({ ...point, scale: 1.02 }, puckRef.current)
  }

  if (isSplashVisible) {
    return (
      <main className="splash-screen" aria-label="Welcome screen">
        <div className="splash-card" role="status" aria-live="polite">
          <p className="splash-eyebrow">Then &amp; There</p>
          <h1>Then & There </h1>
          <p className="splash-copy">
            Gamifying Europe
          </p>
          <span className="splash-loader" aria-hidden="true" />
        </div>
      </main>
    )
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
