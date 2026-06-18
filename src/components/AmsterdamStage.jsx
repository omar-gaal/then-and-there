import Webcam from "react-webcam";
import { StatusPill } from "./StatusPill";

const STARTING_LIVES = 3;
const TULIP_IMAGES = {
  blue: "/amsterdam background/blue-tulip.png",
  pink: "/amsterdam background/pink-tulip.png",
  yellow: "/amsterdam background/yellow-tulip.png",
};

export function AmsterdamStage({
  activeHoverId,
  canvasRef,
  countdown,
  fingerPos,
  game,
  handCanvasRef,
  handIsReady,
  handWebcamRef,
  isCalibrated,
  isLoading,
  isRunning,
  mapHoverRef,
  onBackToMap,
  onCameraError,
  onCameraReady,
  onHandCameraReady,
  onJump,
  onStartCamera,
  onStartRound,
  preRoundCountdown,
  runAgainHoverRef,
  stageRef,
  startHoverRef,
  tracking,
  videoConstraints,
  webcamRef,
}) {
  const showHandTracking = !isRunning || game.status === "finished";
  const showFingerCursor = showHandTracking && fingerPos;
  const isPlaying = isRunning && game.status === "playing";

  return (
    <div className="amsterdam-stage" data-round={game.status} ref={stageRef}>
      <div className="canal-sky">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <div className="canal-water"></div>
      <div className="amsterdam-ground" aria-hidden="true"></div>
      <div className="tulip-track" aria-hidden="true">
        {game.obstacles.map((tulip) => (
          <div
            className={`tulip-obstacle is-${tulip.kind}`}
            key={tulip.id}
            style={{ "--scale": tulip.scale, "--x": `${tulip.x * 100}%` }}
          >
            <img src={TULIP_IMAGES[tulip.kind]} alt="" draggable="false" />
          </div>
        ))}
      </div>
      <div
        className="runner-shadow"
        style={{
          "--shadow-scale": Math.max(0.35, 1 - game.avatarY * 0.7),
          "--shadow-opacity": Math.max(0.18, 0.52 - game.avatarY * 0.3),
        }}
      ></div>
      <div
        className="runner"
        data-jumping={game.avatarY > 0.04 ? "true" : "false"}
        aria-label="Player avatar"
      >
        <span className="runner-head"></span>
        <span className="runner-body"></span>
        <span className="runner-arm runner-arm-a"></span>
        <span className="runner-arm runner-arm-b"></span>
        <span className="runner-leg runner-leg-a"></span>
        <span className="runner-leg runner-leg-b"></span>
      </div>

      {/* Camera preview */}
      <div className="pose-preview">
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
        {isRunning && game.status !== "finished" && (
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
        <canvas
          ref={handCanvasRef}
          className="pose-canvas"
          aria-hidden="true"
          style={{ display: showHandTracking ? undefined : "none" }}
        />
        <canvas
          ref={canvasRef}
          className="pose-canvas"
          aria-hidden="true"
          style={{ display: showHandTracking ? "none" : undefined }}
        />
        <span>{showHandTracking ? "Hover to start" : tracking.label}</span>
      </div>

      {/* HUD chips — top-left, visible while playing */}
      {isPlaying && (
        <div className="stage-chips" aria-live="polite">
          <div className="stage-chip">
            <span className="stage-chip-icon">⏱</span>
            {formatChipTime(game.timeLeft)}
          </div>
          <div className="stage-chip">
            <span className="stage-chip-icon">🌷</span>
            {game.cleared}
          </div>
          <div
            className="stage-chip"
            data-warning={game.lives === 1 ? "true" : undefined}
          >
            {Array.from({ length: STARTING_LIVES }, (_, i) => (
              <span key={i} className="stage-chip-icon">
                {i < game.lives ? "❤️" : "🖤"}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Status pill — top-right, visible while playing */}
      {isPlaying && (
        <div className="stage-status">
          <StatusPill mode={tracking.mode} label={tracking.label} />
        </div>
      )}

      {/* Pre-game overlay */}
      {!isRunning && (
        <div className="round-overlay">
          <p className="round-overlay-eyebrow">Amsterdam challenge</p>
          <strong>Jump the tulips</strong>
          <div className="how-to-play-card">
            <span className="how-to-play-label">How to play</span>
            <ul className="how-to-play-steps">
              <li>Jump in place to make your character leap over tulips</li>
              <li>Hit a tulip and you lose a ❤️ life, you have 3</li>
              <li>Clear as many tulips as you can in 20 seconds</li>
              <li>Make sure your full body is visible to the camera!</li>
            </ul>
          </div>
          <HoverZone
            countdown={countdown}
            label={isLoading ? "Loading…" : "Begin round"}
            onClick={onStartCamera}
            disabled={isLoading}
            targetRef={startHoverRef}
            variant="start"
          />
          <p className="hover-hint">
            {fingerPos ? "Hold still…" : "Point your finger at the button"}
          </p>
        </div>
      )}

      {/* Post-round overlay */}
      {isRunning && isCalibrated && game.status === "finished" && (
        <div className="round-overlay">
          <p className="round-overlay-eyebrow">Canal run complete</p>
          <strong>{game.score} pts</strong>
          {game.funFact && (
            <div className="fun-fact-card">
              <span className="fun-fact-label">Amsterdam fun fact</span>
              <p className="fun-fact-text">{game.funFact}</p>
            </div>
          )}
          <div className="post-round-actions">
            <HoverZone
              countdown={activeHoverId === "again" ? countdown : null}
              label="Run again"
              onClick={onStartRound}
              targetRef={runAgainHoverRef}
              variant="again"
            />
            <HoverZone
              countdown={activeHoverId === "map" ? countdown : null}
              label="Back to map"
              onClick={onBackToMap}
              targetRef={mapHoverRef}
              variant="map"
            />
          </div>
          <p className="hover-hint">
            {fingerPos ? "Hold still…" : "Point your finger at the button"}
          </p>
        </div>
      )}

      {showFingerCursor && (
        <FingerCursor fingerPos={fingerPos} countdown={countdown} />
      )}

      {isRunning && !isCalibrated && (
        <div className="calibration-card">
          <strong>Stand still</strong>
          <span>
            {tracking.mode === "searching"
              ? "Back up until your full body is visible, hips must be in frame"
              : `Calibrating… ${Math.round(tracking.calibrationProgress * 100)}%`}
          </span>
          <div>
            <i style={{ width: `${tracking.calibrationProgress * 100}%` }}></i>
          </div>
        </div>
      )}

      {isRunning &&
        isCalibrated &&
        game.status === "ready" &&
        preRoundCountdown !== null && (
          <div className="round-overlay">
            <p>Calibrated — get ready!</p>
            <strong className="pre-round-count">
              {preRoundCountdown || "Go!"}
            </strong>
          </div>
        )}

      {isRunning && isCalibrated && game.status === "playing" && (
        <button className="jump-test-button" type="button" onClick={onJump}>
          Test jump
        </button>
      )}
    </div>
  );
}

function HoverZone({
  countdown,
  label,
  onClick,
  disabled,
  targetRef,
  variant = "start",
}) {
  return (
    <div className="hover-zone" data-variant={variant} ref={targetRef}>
      <button
        type="button"
        className="hover-start-btn"
        onClick={onClick}
        disabled={disabled}
      >
        {disabled ? "Loading…" : countdown !== null ? countdown || "✓" : label}
      </button>
    </div>
  );
}

function FingerCursor({ fingerPos, countdown }) {
  const isHovering = countdown !== null;
  const progress = isHovering ? ((3 - countdown) / 3) * 276.5 : 0;
  return (
    <div
      className="hand-cursor"
      data-hovering={isHovering}
      style={{
        "--cx": `${fingerPos.x * 100}%`,
        "--cy": `${fingerPos.y * 100}%`,
      }}
    >
      {isHovering && (
        <svg className="cursor-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="cursor-ring-track" cx="50" cy="50" r="44" />
          <circle
            className="cursor-ring-fill"
            cx="50"
            cy="50"
            r="44"
            style={{ "--progress": progress }}
          />
        </svg>
      )}
    </div>
  );
}

function formatChipTime(timeLeft) {
  const s = Math.ceil(Math.max(0, timeLeft));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}
