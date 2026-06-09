import { useTulipGame } from '../hooks/useTulipGame'
import { usePoseTracking } from '../hooks/usePoseTracking'
import { AmsterdamPanel } from './AmsterdamPanel'
import { AmsterdamStage } from './AmsterdamStage'
import { StatusPill } from './StatusPill'

export function AmsterdamExperience() {
  const pose = usePoseTracking()
  const { game, resetRound, startRound, triggerJump } = useTulipGame({ isCalibrated: pose.tracking.isCalibrated, isRunning: pose.isRunning, jumpCount: pose.jumpCount })

  function handleStopCamera() {
    resetRound()
    pose.stopCamera()
  }

  return (
    <>
      <header className="topbar"><div><p className="eyebrow">Amsterdam prototype</p><h1>Tulip Canal Run</h1></div><StatusPill mode={pose.tracking.mode} label={pose.tracking.label} /></header>
      <section className="workspace" aria-label="Amsterdam tulip jumping game">
        <AmsterdamStage canvasRef={pose.canvasRef} game={game} isCalibrated={pose.tracking.isCalibrated} isLoading={pose.isLoading} isRunning={pose.isRunning} onCameraError={pose.handleCameraError} onCameraReady={pose.handleCameraReady} onJump={triggerJump} onStartCamera={pose.startCamera} onStartRound={startRound} tracking={pose.tracking} videoConstraints={pose.videoConstraints} webcamRef={pose.webcamRef} />
        <AmsterdamPanel game={game} isLoading={pose.isLoading} isRunning={pose.isRunning} onStartCamera={pose.startCamera} onStopCamera={handleStopCamera} tracking={pose.tracking} />
      </section>
    </>
  )
}
