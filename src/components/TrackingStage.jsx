import Webcam from "react-webcam";
import { VIDEO_CONSTRAINTS } from "../handTracking";

export function TrackingStage({
  activeHoverId,
  canvasRef,
  countdown,
  game,
  mapHoverRef,
  onBackToMap,
  onCameraError,
  onCameraReady,
  isLoading,
  isRunning,
  onPointerAim,
  onStartCamera,
  onStartRound,
  playAgainHoverRef,
  puckRef,
  stageRef,
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

  return (
    <div
      ref={stageRef}
      className="stage"
      data-round={game.status}
      data-running={isRunning ? "true" : "false"}
      onPointerDown={handlePointerMove}
      onPointerMove={handlePointerMove}
    >
      {isRunning && (
        <Webcam
          ref={webcamRef}
          audio={false}
          className="webcam-feed"
          onUserMedia={onCameraReady}
          onUserMediaError={onCameraError}
          playsInline
          videoConstraints={VIDEO_CONSTRAINTS}
        />
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
        <span></span>
      </div>
      {isRunning && (
        <div className="stage-hud" aria-live="polite">
          <span>{game.score}</span>
          <span>{formatTime(game.timeLeft)}</span>
        </div>
      )}

      {!isRunning && (
        <div className="start-overlay">
          <button type="button" onClick={onStartCamera} disabled={isLoading}>
            {isLoading ? "Loading..." : "Start camera"}
          </button>
        </div>
      )}

      {isRunning && game.status !== "playing" && (
        <div className="round-overlay">
          <p>{game.status === "finished" ? "Round complete" : "Pastry round"}</p>
          <strong>
            {game.status === "finished" ? `${game.score} pts` : "Ready"}
          </strong>
          {game.status === "finished" ? (
            <div className="post-round-actions">
              <button type="button" onClick={onStartRound} ref={playAgainHoverRef}>
                {activeHoverId === "again" && countdown !== null ? countdown || "✓" : "Play again"}
              </button>
              <button type="button" className="paris-map-button" onClick={onBackToMap} ref={mapHoverRef}>
                {activeHoverId === "map" && countdown !== null ? countdown || "✓" : "Map"}
              </button>
            </div>
          ) : (
            <button type="button" onClick={onStartRound}>
              Start round
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function formatTime(timeLeft) {
  return `${Math.ceil(timeLeft)}s`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
