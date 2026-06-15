import Webcam from "react-webcam";
import { VIDEO_CONSTRAINTS } from "../handTracking";

export function TrackingStage({
  canvasRef,
  countdown,
  fingerPos,
  game,
  handCanvasRef,
  handIsReady,
  handWebcamRef,
  isLoading,
  isRunning,
  onCameraError,
  onCameraReady,
  onHandCameraReady,
  onPointerAim,
  onStartCamera,
  onStartRound,
  puckRef,
  stageRef,
  webcamRef
}) {
  const showHandTracking = !isRunning || game.status === 'finished'
  const showFingerCursor = showHandTracking && fingerPos

  function handlePointerMove(event) {
    const stage = stageRef.current

    if (!stage || !onPointerAim) {
      return
    }

    const bounds = stage.getBoundingClientRect()

    onPointerAim({
      x: clamp((event.clientX - bounds.left) / bounds.width, 0.03, 0.97),
      y: clamp((event.clientY - bounds.top) / bounds.height, 0.06, 0.94)
    })
  }

  return (
    <div
      ref={stageRef}
      className="stage"
      data-round={game.status}
      data-running={isRunning ? "true" : "false"}
      onPointerDown={handlePointerMove}
      onPointerMove={handlePointerMove}
    >
      {/* Hand hover webcam — always mounted to avoid camera re-init flash */}
      {handIsReady && (
        <Webcam
          ref={handWebcamRef}
          audio={false}
          className="webcam-feed"
          onUserMedia={onHandCameraReady}
          playsInline
          style={{ display: showHandTracking ? undefined : 'none' }}
          videoConstraints={VIDEO_CONSTRAINTS}
        />
      )}
      {/* Game webcam — while camera is running */}
      {isRunning && (
        <Webcam
          ref={webcamRef}
          audio={false}
          className="webcam-feed"
          onUserMedia={onCameraReady}
          onUserMediaError={onCameraError}
          playsInline
          style={{ display: game.status !== 'finished' ? undefined : 'none' }}
          videoConstraints={VIDEO_CONSTRAINTS}
        />
      )}
      <canvas ref={handCanvasRef} className="landmark-layer" aria-hidden="true" style={{ display: showHandTracking ? undefined : 'none' }} />
      <canvas ref={canvasRef} className="landmark-layer" aria-hidden="true" style={{ display: showHandTracking ? 'none' : undefined }} />

      <div aria-hidden="true">
        {game.items.map((item) => (
          <div
            key={item.id}
            className={`catch-target is-${item.kind}`}
            style={{
              "--size": `${item.size}px`,
              "--spin": `${item.spin}deg`,
              "--x": `${item.x * 100}%`,
              "--y": `${item.y * 100}%`
            }}
          >
            <img
              src={`/pastries/${item.kind}.png`}
              alt={item.kind}
              onError={(e) => {
                if (e.currentTarget.src.endsWith('.png')) {
                  e.currentTarget.src = `/pastries/${item.kind}.png`
                }
              }}
            />
          </div>
        ))}
      </div>
      <div ref={puckRef} className="control-object" role="img" aria-label="Pastry basket">
        <span></span>
      </div>

      {isRunning && game.status === 'playing' && (
        <div className="stage-hud" aria-live="polite">
          <span>{game.score}</span>
          <span>{formatTime(game.timeLeft)}</span>
        </div>
      )}

      {/* Pre-game overlay */}
      {!isRunning && (
        <div className="round-overlay">
          <p>Paris challenge</p>
          <strong>Catch the pastries</strong>
          <HoverZone countdown={countdown} label={isLoading ? 'Loading…' : 'Start'} onClick={onStartCamera} disabled={isLoading} />
          <p className="hover-hint">{fingerPos ? 'Hold still…' : 'Point your finger at the button'}</p>
        </div>
      )}

      {/* Post-round overlay */}
      {isRunning && game.status === 'finished' && (
        <div className="round-overlay">
          <p>Round complete</p>
          <strong>{game.score} pts</strong>
          {game.funFact && (
            <div className="fun-fact-card">
              <span className="fun-fact-label">🥐 Paris fun fact</span>
              <p className="fun-fact-text">{game.funFact}</p>
            </div>
          )}
          <HoverZone countdown={countdown} label="Play again" onClick={onStartRound} />
          <p className="hover-hint">{fingerPos ? 'Hold still…' : 'Point your finger at the button'}</p>
        </div>
      )}

      {/* Finger cursor */}
      {showFingerCursor && (
        <FingerCursor fingerPos={fingerPos} countdown={countdown} />
      )}
    </div>
  );
}

function HoverZone({ countdown, label, onClick, disabled }) {
  return (
    <div className="hover-zone">
      <button type="button" className="hover-start-btn" onClick={onClick} disabled={disabled}>
        {disabled ? 'Loading…' : countdown !== null ? (countdown || '✓') : label}
      </button>
    </div>
  )
}

function FingerCursor({ fingerPos, countdown }) {
  const isHovering = countdown !== null
  const progress = isHovering ? ((3 - countdown) / 3) * 276.5 : 0
  return (
    <div
      className="hand-cursor"
      data-hovering={isHovering}
      style={{ '--cx': `${fingerPos.x * 100}%`, '--cy': `${fingerPos.y * 100}%` }}
    >
      {isHovering && (
        <svg className="cursor-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="cursor-ring-track" cx="50" cy="50" r="44" />
          <circle className="cursor-ring-fill" cx="50" cy="50" r="44" style={{ '--progress': progress }} />
        </svg>
      )}
    </div>
  )
}

function formatTime(timeLeft) {
  return `${Math.ceil(timeLeft)}s`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
