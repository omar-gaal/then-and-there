import Webcam from "react-webcam";
import { VIDEO_CONSTRAINTS } from "../handTracking";
import { StatusPill } from "./StatusPill";

export function TrackingStage({
  activeHoverId,
  canvasRef,
  countdown,
  fingerPos,
  game,
  handCanvasRef,
  handIsReady,
  handWebcamRef,
  isLoading,
  isRunning,
  mapHoverRef,
  onBackToMap,
  onCameraError,
  onCameraReady,
  onHandCameraReady,
  onPointerAim,
  onStartCamera,
  onStartRound,
  playAgainHoverRef,
  puckRef,
  stageRef,
  startHoverRef,
  tracking,
  webcamRef
}) {
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

  const showHandTracking = !isRunning || game.status === 'finished'
  const showFingerCursor = showHandTracking && fingerPos
  const isPlaying = isRunning && game.status === 'playing'

  return (
    <div
      ref={stageRef}
      className="stage"
      data-round={game.status}
      data-running={isRunning ? "true" : "false"}
      onPointerDown={handlePointerMove}
      onPointerMove={handlePointerMove}
    >
      {/* Hand hover webcam , always mounted to avoid camera re-init flash */}
      {handIsReady && (
        <Webcam
          ref={handWebcamRef}
          audio={false}
          className="webcam-feed"
          onUserMedia={onHandCameraReady}
          playsInline
          videoConstraints={VIDEO_CONSTRAINTS}
          style={{ display: showHandTracking ? undefined : 'none' }}
        />
      )}

      {/* Game webcam , visible only while playing */}
      {isRunning && (
        <Webcam
          ref={webcamRef}
          audio={false}
          className="webcam-feed"
          onUserMedia={onCameraReady}
          onUserMediaError={onCameraError}
          playsInline
          videoConstraints={VIDEO_CONSTRAINTS}
          style={{ display: game.status !== 'finished' ? undefined : 'none' }}
        />
      )}

      {/* Hand hover landmarks canvas */}
      {handIsReady && showHandTracking && (
        <canvas ref={handCanvasRef} className="landmark-layer" aria-hidden="true" />
      )}

      <canvas ref={canvasRef} className="landmark-layer" aria-hidden="true" />

      <div className="catch-layer" aria-hidden="true">
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
        <img src="/paris%20background/basket-paris.png" alt="" aria-hidden="true" />
      </div>

      {/* HUD chips , top-left, visible while playing */}
      {isPlaying && (
        <div className="stage-chips" aria-live="polite">
          <div className="stage-chip">
            <span className="stage-chip-icon">⏱</span>
            {formatChipTime(game.timeLeft)}
          </div>
          <div className="stage-chip">
            <span className="stage-chip-icon">🎯</span>
            {game.caught}
          </div>
          <div className="stage-chip" data-warning={game.missed >= game.maxMisses - 2 ? "true" : undefined}>
            <span className="stage-chip-icon">💥</span>
            {game.missed}/{game.maxMisses}
          </div>
        </div>
      )}

      {/* Status pill , top-right, visible while playing */}
      {isPlaying && tracking && (
        <div className="stage-status">
          <StatusPill mode={tracking.mode} label={tracking.label} />
        </div>
      )}

      {/* Pre-game overlay */}
      {!isRunning && (
        <div className="round-overlay">
          <p className="round-overlay-eyebrow">Paris challenge</p>
          <strong>Catch the pastries</strong>
          <div className="how-to-play-card">
            <span className="how-to-play-label">How to play</span>
            <ul className="how-to-play-steps">
              <li>Move your hand to guide the 🧺 basket</li>
              <li>Catch falling croissants, baguettes &amp; éclairs</li>
              <li>Miss {game.maxMisses} and the round ends early</li>
              <li>You have 20 seconds , catch as many as you can!</li>
            </ul>
          </div>
          <HoverZone
            countdown={activeHoverId === 'start' ? countdown : null}
            disabled={isLoading}
            label={isLoading ? 'Loading…' : 'Begin round'}
            onClick={onStartCamera}
            targetRef={startHoverRef}
            variant="start"
          />
          <p className="hover-hint">
            {fingerPos ? 'Hold still…' : 'Point your finger at the button'}
          </p>
        </div>
      )}

      {/* Post-round overlay */}
      {isRunning && game.status === 'finished' && (
        <div className="round-overlay">
          <p className="round-overlay-eyebrow">Round complete</p>
          <strong>{game.score} pts</strong>
          {game.funFact && (
            <div className="fun-fact-card">
              <span className="fun-fact-label">Paris fun fact</span>
              <p className="fun-fact-text">{game.funFact}</p>
            </div>
          )}
          <div className="post-round-actions">
            <HoverZone
              countdown={activeHoverId === 'again' ? countdown : null}
              label="Play again"
              onClick={onStartRound}
              targetRef={playAgainHoverRef}
              variant="again"
            />
            <HoverZone
              countdown={activeHoverId === 'map' ? countdown : null}
              label="Back to map"
              onClick={onBackToMap}
              targetRef={mapHoverRef}
              variant="map"
            />
          </div>
          <p className="hover-hint">
            {fingerPos ? 'Hold still…' : 'Point your finger at the button'}
          </p>
        </div>
      )}

      {showFingerCursor && <FingerCursor fingerPos={fingerPos} countdown={countdown} />}
    </div>
  );
}

export function HoverZone({ countdown, disabled, label, onClick, targetRef, variant = 'start' }) {
  return (
    <div className="hover-zone" data-variant={variant} ref={targetRef}>
      <button type="button" className="hover-start-btn" onClick={onClick} disabled={disabled}>
        {disabled ? 'Loading…' : countdown !== null ? (countdown || '✓') : label}
      </button>
    </div>
  )
}

export function FingerCursor({ fingerPos, countdown }) {
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

function formatChipTime(timeLeft) {
  const s = Math.ceil(Math.max(0, timeLeft))
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}:${String(rem).padStart(2, '0')}`
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
