import Webcam from 'react-webcam'

export function AmsterdamStage({
  canvasRef,
  game,
  isCalibrated,
  isLoading,
  isRunning,
  onCameraError,
  onCameraReady,
  onJump,
  onStartCamera,
  onStartRound,
  tracking,
  videoConstraints,
  webcamRef,
}) {
  return (
    <div className="amsterdam-stage" data-round={game.status}>
      <div className="canal-sky"><span></span><span></span><span></span></div>
      <div className="canal-water"></div>
      <div className="tulip-track" aria-hidden="true">
        {game.obstacles.map((tulip) => (
          <div
            className={`tulip-obstacle is-${tulip.kind}`}
            key={tulip.id}
            style={{ '--scale': tulip.scale, '--x': `${tulip.x * 100}%` }}
          ><i></i><i></i><i></i></div>
        ))}
      </div>
      <div className="runner-shadow" style={{ '--shadow-scale': Math.max(0.35, 1 - game.avatarY * 0.7), '--shadow-opacity': Math.max(0.18, 0.52 - game.avatarY * 0.3) }}></div>
      <div className="runner" data-jumping={game.avatarY > 0.04 ? 'true' : 'false'} style={{ '--jump-y': `${game.avatarY * 800}px` }} aria-label="Player avatar">
        <span className="runner-head"></span><span className="runner-body"></span><span className="runner-leg runner-leg-a"></span><span className="runner-leg runner-leg-b"></span>
      </div>

      <div className="pose-preview">
        {isRunning && <Webcam ref={webcamRef} audio={false} className="pose-webcam" onUserMedia={onCameraReady} onUserMediaError={onCameraError} playsInline videoConstraints={videoConstraints} />}
        <canvas ref={canvasRef} className="pose-canvas" aria-hidden="true" />
        <span>{tracking.label}</span>
      </div>

      {isRunning && <div className="stage-hud"><span>{game.score} pts</span><span>{Math.ceil(game.timeLeft)}s</span><span>Lives {game.lives}</span></div>}

      {!isRunning && <div className="round-overlay"><p>Amsterdam challenge</p><strong>Jump the tulips</strong><button type="button" onClick={onStartCamera} disabled={isLoading}>{isLoading ? 'Loading pose model...' : 'Start camera'}</button></div>}

      {isRunning && !isCalibrated && <div className="calibration-card"><strong>Stand still</strong><span>Calibrating hips {Math.round(tracking.calibrationProgress * 100)}%</span><div><i style={{ width: `${tracking.calibrationProgress * 100}%` }}></i></div></div>}

      {isRunning && isCalibrated && game.status !== 'playing' && <div className="round-overlay"><p>{game.status === 'finished' ? 'Canal run complete' : 'Pose calibrated'}</p><strong>{game.status === 'finished' ? `${game.score} pts` : 'Ready to jump'}</strong><button type="button" onClick={onStartRound}>{game.status === 'finished' ? 'Run again' : 'Start round'}</button></div>}

      {isRunning && isCalibrated && game.status === 'playing' && <button className="jump-test-button" type="button" onClick={onJump}>Test jump</button>}
    </div>
  )
}
