import Webcam from 'react-webcam'

export function AmsterdamStage({
  canvasRef,
  countdown,
  fingerPos,
  game,
  handCanvasRef,
  handIsReady,
  handWebcamRef,
  hoverTarget,
  isCalibrated,
  isLoading,
  isRunning,
  onCameraError,
  onCameraReady,
  onHandCameraReady,
  onJump,
  onStartCamera,
  onStartRound,
  preRoundCountdown,
  tracking,
  videoConstraints,
  webcamRef,
}) {
  const showHandTracking = !isRunning || game.status === 'finished'
  const showFingerCursor = showHandTracking && fingerPos

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
      <div className="runner" data-jumping={game.avatarY > 0.04 ? 'true' : 'false'} style={{ '--jump-y': `${game.avatarY * 1800}px` }} aria-label="Player avatar">
        <span className="runner-head"></span>
        <span className="runner-body"></span>
        <span className="runner-arm runner-arm-a"></span>
        <span className="runner-arm runner-arm-b"></span>
        <span className="runner-leg runner-leg-a"></span>
        <span className="runner-leg runner-leg-b"></span>
      </div>

      {/* Camera preview */}
      <div className="pose-preview">
        {/* Hand tracking webcam — before game and after round ends */}
        {showHandTracking && handIsReady && (
          <Webcam
            ref={handWebcamRef}
            audio={false}
            className="pose-webcam"
            onUserMedia={onHandCameraReady}
            playsInline
            videoConstraints={videoConstraints}
          />
        )}
        {/* Pose webcam — while game is actively running */}
        {isRunning && game.status !== 'finished' && (
          <Webcam
            ref={webcamRef}
            audio={false}
            className="pose-webcam"
            onUserMedia={onCameraReady}
            onUserMediaError={onCameraError}
            playsInline
            videoConstraints={videoConstraints}
          />
        )}
        <canvas ref={handCanvasRef} className="pose-canvas" aria-hidden="true" style={{ display: showHandTracking ? undefined : 'none' }} />
        <canvas ref={canvasRef} className="pose-canvas" aria-hidden="true" style={{ display: showHandTracking ? 'none' : undefined }} />
        <span>{showHandTracking ? 'Hover to start' : tracking.label}</span>
      </div>

      {isRunning && game.status !== 'finished' && (
        <div className="stage-hud">
          <span>{game.score} pts</span>
          <span>{Math.ceil(game.timeLeft)}s</span>
          <span>Lives {game.lives}</span>
        </div>
      )}

      {/* Pre-game overlay */}
      {!isRunning && (
        <div className="round-overlay">
          <p>Amsterdam challenge</p>
          <strong>Jump the tulips</strong>
          <HoverZone countdown={countdown} label={isLoading ? 'Loading…' : 'Start'} onClick={onStartCamera} disabled={isLoading} fingerPos={fingerPos} />
          <p className="hover-hint">{fingerPos ? 'Hold still…' : 'Point your finger at the circle'}</p>
        </div>
      )}

      {/* Post-round overlay — same hover mechanic */}
      {isRunning && isCalibrated && game.status === 'finished' && (
        <div className="round-overlay">
          <p>Canal run complete</p>
          <strong>{game.score} pts</strong>
          <HoverZone countdown={countdown} label="Run again" onClick={onStartRound} fingerPos={fingerPos} />
          <p className="hover-hint">{fingerPos ? 'Hold still…' : 'Point your finger at the circle'}</p>
        </div>
      )}

      {/* Finger cursor — visible during any hover state */}
      {showFingerCursor && (
        <div
          className="hand-cursor"
          style={{ '--cx': `${fingerPos.x * 100}%`, '--cy': `${fingerPos.y * 100}%` }}
        />
      )}

      {isRunning && !isCalibrated && (
        <div className="calibration-card">
          <strong>Stand still</strong>
          <span>
            {tracking.mode === 'searching'
              ? 'Back up until your full body is visible — hips must be in frame'
              : `Calibrating… ${Math.round(tracking.calibrationProgress * 100)}%`}
          </span>
          <div><i style={{ width: `${tracking.calibrationProgress * 100}%` }}></i></div>
        </div>
      )}

      {isRunning && isCalibrated && game.status === 'ready' && preRoundCountdown !== null && (
        <div className="round-overlay">
          <p>Calibrated — get ready!</p>
          <strong className="pre-round-count">{preRoundCountdown || 'Go!'}</strong>
        </div>
      )}

      {isRunning && isCalibrated && game.status === 'playing' && (
        <button className="jump-test-button" type="button" onClick={onJump}>Test jump</button>
      )}
    </div>
  )
}

function HoverZone({ countdown, label, onClick, disabled, fingerPos }) {
  const progress = countdown !== null ? ((3 - countdown) / 3) * 276.5 : 0
  return (
    <div className="hover-zone">
      <svg className="hover-ring" viewBox="0 0 100 100">
        <circle className="hover-ring-track" cx="50" cy="50" r="44" />
        {countdown !== null && (
          <circle className="hover-ring-fill" cx="50" cy="50" r="44" style={{ '--progress': progress }} />
        )}
      </svg>
      <button type="button" className="hover-start-btn" onClick={onClick} disabled={disabled}>
        {disabled ? 'Loading…' : countdown !== null ? (countdown || '✓') : label}
      </button>
    </div>
  )
}
