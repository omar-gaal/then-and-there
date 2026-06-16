import Webcam from "react-webcam";
import { VIDEO_CONSTRAINTS } from "../handTracking";
import { ASSEMBLY_SNAP_POINTS, BIKE_PARTS, TOTAL_PARTS } from "../hooks/useBikeGame";
import { ThreeStreetScene } from "./ThreeStreetScene";

export function TrackingStage({
  canvasRef,
  game,
  onCameraError,
  onCameraReady,
  onBackToSearch,
  isLoading,
  isRunning,
  playtestSettings,
  onPointerAim,
  onPlayAgain,
  onShowAssemblyPreview,
  onStartCamera,
  onStartRound,
  partProjectionRef,
  playerWorldRef,
  puckRef,
  stageRef,
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
      <ThreeStreetScene
        handReach={tracking.handReach}
        items={game.items}
        motion={tracking.motion}
        partProjectionRef={partProjectionRef}
        playerWorldRef={playerWorldRef}
        status={game.status}
        tracking={tracking}
      />
      <canvas ref={canvasRef} className="landmark-layer" aria-hidden="true" />
      {playtestSettings.showHandMarker && (
        <div
          className="hand-reach-marker"
          data-visible={tracking.handReach?.visible ? "true" : "false"}
          style={{
            "--reach-x": `${(tracking.handReach?.x ?? 0.5) * 100}%`,
            "--reach-y": `${(tracking.handReach?.y ?? 0.5) * 100}%`
          }}
          aria-hidden="true"
        ></div>
      )}
      <div ref={puckRef} className="control-object" role="img" aria-label="Bike parts magnet">
        <span></span>
      </div>
      {isRunning && (
        <div className="stage-hud" aria-live="polite">
          <span>{game.found.length}/{TOTAL_PARTS}</span>
          <span>{formatTime(game.timeLeft)}</span>
          <span>{game.score} pts</span>
        </div>
      )}

      {isRunning && game.status === "collecting" && (
        <div className="task-card" aria-live="polite">
          <span>{getTaskKicker(game, tracking)}</span>
          <strong>{getTaskTitle(game, tracking)}</strong>
          <small>{getTaskHint(game, tracking)}</small>
        </div>
      )}

      {isRunning && game.status === "collecting" && (
        <div className="part-hints" aria-hidden="true">
          {game.items
            .filter((item) => item.nearPrompt || item.reachPrompt || item.pickupReady)
            .map((item) => (
              <div
                key={item.id}
                className="part-hint"
                style={{
                  "--hint-x": `${item.hintX * 100}%`,
                  "--hint-y": `${item.hintY * 100}%`,
                  "--hint-glow": item.glow
                }}
              >
                <strong>{item.label}</strong>
                <span>{getPartHintText(item)}</span>
              </div>
            ))}
        </div>
      )}

      {isRunning && game.status === "collecting" && !tracking.handReach?.visible && hasNearbyPart(game) && (
        <div className="hand-pickup-hint" aria-live="polite">
          Show your hand to pick up the part
        </div>
      )}

      {playtestSettings.showPickupDebug && (
        <div className="pickup-debug" aria-hidden="true">
          <span>hand: {tracking.handReach?.visible ? "true" : "false"}</span>
          <span>x/y: {formatDebugNumber(tracking.handReach?.x)} / {formatDebugNumber(tracking.handReach?.y)}</span>
          <span>part: {formatDebugPart(game.pickupDebug)}</span>
          <span>world: {formatDebugNumber(game.pickupDebug?.nearestPartDistance)}</span>
          <span>screen: {formatDebugNumber(game.pickupDebug?.screenOverlapDistance)}</span>
          <span>ready: {game.pickupDebug?.pickupReady ? "true" : "false"}</span>
        </div>
      )}

      {isRunning && game.lastFound && game.status === "collecting" && (
        <div key={game.feedbackId} className="collect-toast" aria-live="polite">
          <span>{game.comboMessage || "Collected"}</span>
          <strong>Collected: {game.lastFound}</strong>
        </div>
      )}

      {!isRunning && (
        <div className="start-overlay">
          <div className="onboarding-card" aria-live="polite">
            <p>Before you start</p>
            <strong>Stand in front of the webcam</strong>
            <ul>
              <li>Move your body to walk through the street.</li>
              <li>Reach your hand toward a bike part to collect it.</li>
              <li>Collect every bicycle part to finish the search.</li>
            </ul>
            <button type="button" onClick={onStartCamera} disabled={isLoading}>
              {isLoading ? "Loading..." : "Start camera"}
            </button>
          </div>
        </div>
      )}

      {isRunning && game.status !== "collecting" && game.status !== "assemblyPreview" && (
        <div className="round-overlay">
          <p>{getOverlayKicker(game.status)}</p>
          <strong>
            {getOverlayTitle(game)}
          </strong>
          <span className="overlay-copy">{getOverlayCopy(game)}</span>
          {game.status === "ready" && (
            <ul className="overlay-steps">
              <li>Stand where your full body is visible.</li>
              <li>Step in place or lean forward to move.</li>
              <li>Show your hand and reach toward highlighted parts.</li>
            </ul>
          )}
          {game.status === "complete" && game.unlockMessage && (
            <span className="unlock-ribbon">{game.unlockMessage}</span>
          )}
          {game.status === "complete" && (
            <div className="final-bike-card" aria-label="Assembled bike summary">
              <div className="final-bike-visual" aria-hidden="true">
                <svg className="bike-silhouette" viewBox="0 0 100 64">
                  <circle cx="30" cy="43" r="13"></circle>
                  <circle cx="70" cy="43" r="13"></circle>
                  <path d="M30 43 L45 22 L57 43 Z"></path>
                  <path d="M45 22 L70 43"></path>
                  <path d="M45 22 L51 16"></path>
                  <path d="M51 16 L57 16"></path>
                  <path d="M70 43 L76 18"></path>
                  <path d="M76 18 C80 17 82 15 84 12"></path>
                  <path d="M45 43 L58 43"></path>
                  <circle cx="52" cy="43" r="3"></circle>
                  <path d="M58 33 L70 43"></path>
                  <path d="M79 31 L90 31 L87 43 L77 43 Z"></path>
                  <circle cx="78" cy="13" r="2.5"></circle>
                </svg>
                {BIKE_PARTS.map((part) => (
                  <span key={part.kind} className={`blueprint-part ${part.kind} is-installed`}></span>
                ))}
              </div>
              <div>
                <span>Found parts</span>
                <strong>{game.found.length} / {TOTAL_PARTS}</strong>
              </div>
              <div>
                <span>Final score</span>
                <strong>{game.score} pts</strong>
              </div>
            </div>
          )}
          {game.status === "searchComplete" ? (
            <div className="overlay-actions">
              <button type="button" onClick={onShowAssemblyPreview}>
                Continue to Assembly Preview
              </button>
              <button type="button" className="is-secondary" onClick={onPlayAgain}>
                Play Again
              </button>
            </div>
          ) : game.status === "complete" ? (
            <div className="overlay-actions">
              <button type="button" onClick={onPlayAgain}>
                Play Again
              </button>
              <button type="button" className="is-secondary" onClick={onBackToSearch}>
                Back to Search
              </button>
            </div>
          ) : (
            <button type="button" onClick={onStartRound}>
              {game.status === "complete" || game.status === "failed" ? "Hrát znovu" : "Hledat díly"}
            </button>
          )}
        </div>
      )}

      {isRunning && game.status === "assemblyPreview" && (
        <div className="assembly-overlay is-active" aria-live="polite">
          <div className="assembly-header">
            <p>Assembly Mode</p>
            <strong>{game.assemblyMessage}</strong>
            <span>{game.assemblyHint}</span>
          </div>
          <div className="assembly-workspace">
            <div className="bike-blueprint is-assembly" aria-label="Bike assembly blueprint">
              <svg className="bike-silhouette" viewBox="0 0 100 64" aria-hidden="true">
                <circle cx="30" cy="43" r="13"></circle>
                <circle cx="70" cy="43" r="13"></circle>
                <path d="M30 43 L45 22 L57 43 Z"></path>
                <path d="M45 22 L70 43"></path>
                <path d="M45 22 L51 16"></path>
                <path d="M51 16 L57 16"></path>
                <path d="M70 43 L76 18"></path>
                <path d="M76 18 C80 17 82 15 84 12"></path>
                <path d="M45 43 L58 43"></path>
                <circle cx="52" cy="43" r="3"></circle>
                <path d="M58 33 L70 43"></path>
                <path d="M79 31 L90 31 L87 43 L77 43 Z"></path>
                <circle cx="78" cy="13" r="2.5"></circle>
              </svg>
              {BIKE_PARTS.map((part) => (
                <div
                  key={part.kind}
                  className={`blueprint-part ${part.kind} ${isPartAssembled(game, part.kind) ? "is-installed" : ""} ${game.assemblySelected === part.kind ? "is-targeted" : ""} ${game.assemblyLastInstalled === part.kind ? "is-just-installed" : ""}`}
                ></div>
              ))}
              {BIKE_PARTS.map((part) => {
                const snap = ASSEMBLY_SNAP_POINTS[part.kind]

                if (!snap || isPartAssembled(game, part.kind)) {
                  return null
                }

                return (
                  <span
                    key={`snap-${part.kind}`}
                    className={`snap-point ${game.assemblySelected === part.kind ? "is-active" : ""} ${game.assemblyHoverSnap === part.kind ? "is-hovered" : ""} ${game.assemblySelected && game.assemblySelected !== part.kind ? "is-dimmed" : ""} ${game.assemblyLastInstalled === part.kind ? "is-success" : ""}`}
                    style={{
                      "--snap-x": `${snap.x * 100}%`,
                      "--snap-y": `${snap.y * 100}%`,
                    }}
                  >
                    <i>{part.shortLabel}</i>
                  </span>
                )
              })}
            </div>
            <aside className="assembly-progress" aria-label="Assembly progress">
              <span>Assembly</span>
              <strong>{game.assembled.length} / {TOTAL_PARTS}</strong>
              <div className="completion-meter" aria-label={`Assembly ${game.assembled.length} of ${TOTAL_PARTS}`}>
                <span style={{ "--progress": `${(game.assembled.length / TOTAL_PARTS) * 100}%` }}></span>
              </div>
              <small>
                {game.assemblySelected
                  ? `Selected: ${formatPartLabel(game.assemblySelected)}`
                  : "No part selected"}
              </small>
            </aside>
          </div>
          <div className="parts-tray" aria-label="Collected bike parts">
            {game.found.map((kind) => (
              <span
                key={kind}
                className={`part-chip is-assembly ${isPartAssembled(game, kind) ? "is-installed" : ""} ${game.assemblySelected === kind ? "is-selected" : ""} ${game.assemblyHoverTray === kind ? "is-hovered" : ""}`}
              >
                {formatPartLabel(kind)}
              </span>
            ))}
          </div>
          {game.assemblySelected && tracking.handReach?.visible && (
            <div
              className={`assembly-drag-preview ${game.assemblySelected}`}
              style={{
                "--drag-x": `${tracking.handReach.x * 100}%`,
                "--drag-y": `${tracking.handReach.y * 100}%`,
              }}
              aria-hidden="true"
            >
              <span>{getPartShortLabel(game.assemblySelected)}</span>
              <em>{formatPartLabel(game.assemblySelected)}</em>
            </div>
          )}
          {game.assemblyFeedback && (
            <div key={game.assemblyFeedbackId} className="assembly-feedback">
              {game.assemblyFeedback}
            </div>
          )}
          <button type="button" className="assembly-replay" onClick={onPlayAgain}>
            Play Again
          </button>
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

function getOverlayKicker(status) {
  if (status === "searchComplete") {
    return "Search complete";
  }

  if (status === "complete") {
    return "Kolo hotové";
  }

  if (status === "failed") {
    return "Hledání skončilo";
  }

  return "Městská ulice";
}

function getOverlayTitle(game) {
  if (game.status === "searchComplete") {
    return "Great job! You found all bike parts.";
  }

  if (game.status === "complete") {
    return "Congratulations! You assembled the bike.";
  }

  if (game.status === "failed") {
    return `${game.found.length}/${TOTAL_PARTS} dílů`;
  }

  return "Připraveno";
}

function getOverlayCopy(game) {
  if (game.status === "searchComplete") {
    return "Next step: assemble the bike.";
  }

  if (game.status === "complete") {
    return `Final score: ${game.score} pts. ${game.culturalFact}`;
  }

  if (game.status === "failed") {
    return "Zkus to znovu a přibliž ruku ke zvýrazněným dílům.";
  }

  return "Walk with body movement, then reach your real hand toward highlighted bike parts to pick them up.";
}

function formatPartLabel(kind) {
  const labels = Object.fromEntries(BIKE_PARTS.map((part) => [part.kind, part.label]));

  return labels[kind] ?? kind;
}

function getPartShortLabel(kind) {
  return BIKE_PARTS.find((part) => part.kind === kind)?.shortLabel ?? ""
}

function isPartAssembled(game, kind) {
  return game.assembled.includes(kind)
}

function getCurrentTarget(game) {
  const target = BIKE_PARTS.find((part) => !game.found.includes(part.kind))

  return target?.label ?? "Všechny díly nalezeny"
}

function getActivePickupItem(game) {
  return game.items.find((item) => item.pickupReady || item.reachPrompt || item.nearPrompt)
}

function isBodyVisible(tracking) {
  return tracking.body && tracking.body !== "No pose"
}

function getTaskKicker(game, tracking) {
  if (!isBodyVisible(tracking)) {
    return "Tracking"
  }

  const activeItem = getActivePickupItem(game)

  if (activeItem?.pickupReady || activeItem?.reachPrompt) {
    return "Reach"
  }

  if (activeItem && !tracking.handReach?.visible) {
    return "Hand needed"
  }

  return "Find"
}

function getTaskTitle(game, tracking) {
  if (!isBodyVisible(tracking)) {
    return "Stand in front of the camera"
  }

  const activeItem = getActivePickupItem(game)

  if (activeItem && !tracking.handReach?.visible) {
    return "Show your hand"
  }

  return activeItem?.label ?? getCurrentTarget(game)
}

function getTaskHint(game, tracking) {
  if (!isBodyVisible(tracking)) {
    return "Keep your shoulders and hips visible."
  }

  const activeItem = getActivePickupItem(game)

  if (activeItem?.pickupReady) {
    return "Collecting..."
  }

  if (activeItem?.reachPrompt) {
    return "Reach to pick up."
  }

  if (activeItem && !tracking.handReach?.visible) {
    return `Reach toward the ${activeItem.label}.`
  }

  if (activeItem) {
    return "Move your hand onto the label."
  }

  return "Walk the street and look near benches, trees, cars, and shops."
}

function getPartHintText(item) {
  if (item.pickupReady) {
    return "collecting"
  }

  if (item.reachPrompt) {
    return "reach to pick up"
  }

  return "nearby"
}

function hasNearbyPart(game) {
  return game.items.some((item) => item.pickupState === "nearby" || item.pickupState === "handNear")
}

function formatDebugPart(debug) {
  if (!debug?.nearestPartKind) {
    return "none"
  }

  return `${debug.nearestPartId}:${debug.nearestPartKind} ${debug.pickupState}`
}

function formatDebugNumber(value) {
  return Number.isFinite(value) ? value.toFixed(3) : "--"
}
