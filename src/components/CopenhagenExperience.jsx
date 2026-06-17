/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { VIDEO_CONSTRAINTS } from "../handTracking";
import { getPartMapPosition } from "../game/mapMarkers";
import { useCopenhagenTracking } from "../hooks/useCopenhagenTracking";
import { useMapGestureToggle } from "../hooks/useMapGestureToggle";
import { CollectionPanel } from "./CollectionPanel";
import { DebugPanel } from "./DebugPanel";
import { ThreeStreetScene } from "./ThreeStreetScene";
import { TownMap } from "./TownMap";

const FALLBACK_PARTS = [
  { id: "frontWheel", label: "front wheel", collected: false },
  { id: "rearWheel", label: "rear wheel", collected: false },
  { id: "handlebar", label: "handlebar", collected: false },
  { id: "frame", label: "bike frame", collected: false },
  { id: "saddle", label: "saddle", collected: false },
];

const DEFAULT_MAP_DATA = {
  areaId: "mainStreet",
  player: {
    progress: 0,
    side: "center",
    sidePosition: 0.5,
  },
  parts: FALLBACK_PARTS.map((part) => ({
    ...part,
    ...getPartMapPosition(part.id),
  })),
  transitionLabel: "",
  turnHint: "",
};

const DEBUG_OPEN_STORAGE_KEY = "copenhagenBikeGame.debugOpen";

const DEFAULT_WORLD_DEBUG = {
  armTurnCooldownMs: 0,
  armTurnBlockedReason: "ready",
  armTurnReleased: true,
  armTurnTriggerAccepted: false,
  armTurnTriggerAttempted: false,
  armTurnTriggered: "",
  avatarBaseYaw: Math.PI,
  currentAreaId: "mainStreet",
  effectiveAvatarYaw: Math.PI,
  facingAngle: Math.PI,
  heading: 0,
  keyboardActive: false,
  keyboardForward: 0,
  keyboardMovementValue: 0,
  keyboardSide: 0,
  keyboardSpeedMultiplier: 1.5,
  keyboardSmoothing: 0.5,
  leftArmOut: false,
  leftWristDeltaX: 0,
  leftWristAvatarX: 0,
  rawLeftWristX: 0.5,
  movementSmoothing: 0.08,
  poseDebugMode: false,
  poseMode: "screen-mirror",
  poseMirrorX: -1,
  perf: {
    avgAmbientMs: 0,
    avgAvatarMs: 0,
    avgFrameMs: 0,
    avgHeadingMs: 0,
    avgMapDebugMs: 0,
    avgPickupMs: 0,
    avgRenderMs: 0,
    avgWorldMs: 0,
    drawCalls: 0,
    fps: 0,
    mediaPipeActive: false,
    mediaPipeFrameMs: 0,
    mediaPipeHandMs: 0,
    mediaPipePoseMs: 0,
    mediaPipePostMs: 0,
    meshCount: 0,
    totalObjects: 0,
    visibleObjects: 0,
  },
  rightWristAvatarX: 0,
  rightArmOut: false,
  rightWristDeltaX: 0,
  rawRightWristX: 0.5,
  screenLeftKneeSource: "none",
  screenLeftWristSource: "none",
  screenRightKneeSource: "none",
  screenRightWristSource: "none",
  scrolling: false,
  smoothedSpeed: 0,
  swipeLeftDetected: false,
  swipeRightDetected: false,
  worldZ: 0,
  yawInfluence: 0.04,
};

const COUNTDOWN_SECONDS = 3

function CopenhagenFingerCursor({ fingerPos, countdown }) {
  const isHovering = countdown !== null
  const progress = isHovering ? ((3 - countdown) / 3) * 276.5 : 0
  return (
    <div
      className="hand-cursor copenhagen-finger-cursor"
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

export function CopenhagenExperience({ onBackToMap }) {
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(() => {
    try {
      return window.localStorage.getItem(DEBUG_OPEN_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [mapData, setMapData] = useState(DEFAULT_MAP_DATA);
  const [worldDebug, setWorldDebug] = useState(DEFAULT_WORLD_DEBUG);
  const [pickupDebug, setPickupDebug] = useState({
    feedback: "",
    gestureState: "waiting",
    handsLow: false,
    nearbyPart: "none",
    parts: FALLBACK_PARTS,
  });
  const {
    canvasRef,
    handleCameraError,
    handleCameraReady,
    isLoading,
    isRunning,
    puckRef,
    startCamera,
    tracking,
    webcamRef,
  } = useCopenhagenTracking();
  const stageRef = useRef(null)
  const mapExitHoverRef = useRef(null)
  const mapExitHoverStartRef = useRef(null)
  const mapExitFiredRef = useRef(false)
  const [mapExitCountdown, setMapExitCountdown] = useState(null)

  // Hover "← Map" button for 3s to go back — reuses existing hand tracking, no extra camera
  useEffect(() => {
    const activeHand = tracking.leftHand?.visible ? tracking.leftHand
      : tracking.rightHand?.visible ? tracking.rightHand : null
    const fingerPos = activeHand?.visible ? { x: activeHand.x, y: activeHand.y } : null

    if (!fingerPos || !onBackToMap) {
      mapExitHoverStartRef.current = null
      setMapExitCountdown(null)
      return
    }

    const stageRect = stageRef.current?.getBoundingClientRect()
    const btnRect = mapExitHoverRef.current?.getBoundingClientRect()

    if (!stageRect || !btnRect) {
      mapExitHoverStartRef.current = null
      setMapExitCountdown(null)
      return
    }

    const pointX = stageRect.left + fingerPos.x * stageRect.width
    const pointY = stageRect.top + fingerPos.y * stageRect.height
    const isOver = pointX >= btnRect.left && pointX <= btnRect.right
      && pointY >= btnRect.top && pointY <= btnRect.bottom

    if (!isOver) {
      mapExitHoverStartRef.current = null
      mapExitFiredRef.current = false
      setMapExitCountdown(null)
      return
    }

    if (mapExitHoverStartRef.current === null) mapExitHoverStartRef.current = Date.now()

    const elapsed = (Date.now() - mapExitHoverStartRef.current) / 1000
    const remaining = Math.ceil(Math.max(0, COUNTDOWN_SECONDS - elapsed))
    setMapExitCountdown(remaining)

    if (remaining === 0 && !mapExitFiredRef.current) {
      mapExitFiredRef.current = true
      onBackToMap()
    }
  }, [onBackToMap, tracking])

  const toggleMap = useCallback(() => {
    setIsMapOpen((current) => !current);
  }, []);
  const mapGestureDebug = useMapGestureToggle({
    onToggle: toggleMap,
    pose: tracking.pose,
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(DEBUG_OPEN_STORAGE_KEY, String(isDebugOpen));
    } catch {
      // Debug persistence is optional; the panel still works without storage.
    }
  }, [isDebugOpen]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.code === "KeyM" && !event.repeat) {
        toggleMap();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleMap]);

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Copenhagen prototype</p>
          <h1>Bike Part Hunt</h1>
        </div>
      </header>

      <section className="copenhagen-game" aria-label="Copenhagen bike part game">
        <div className="street-frame" ref={stageRef}>
          <ThreeStreetScene
            onMapData={setMapData}
            onPickupDebug={setPickupDebug}
            onWorldDebug={setWorldDebug}
            tracking={tracking}
          />

          {isRunning && (
            <div className="webcam-preview">
              <Webcam
                ref={webcamRef}
                audio={false}
                className="webcam-feed"
                onUserMedia={handleCameraReady}
                onUserMediaError={handleCameraError}
                playsInline
                videoConstraints={VIDEO_CONSTRAINTS}
              />
              <canvas ref={canvasRef} className="landmark-layer" aria-hidden="true" />
            </div>
          )}

          <DebugPanel
            currentAreaId={mapData.areaId}
            isOpen={isDebugOpen}
            isMapOpen={isMapOpen}
            mapGestureDebug={mapGestureDebug}
            onToggle={() => setIsDebugOpen((current) => !current)}
            pickupDebug={pickupDebug}
            tracking={tracking}
            worldDebug={worldDebug}
          />

          {pickupDebug.nearbyPart !== "none" &&
            pickupDebug.gestureState !== "collected" && (
              <div className="pickup-prompt" aria-live="polite">
                Bend down to pick up {pickupDebug.nearbyPart}
              </div>
            )}

          {pickupDebug.feedback && (
            <div className="pickup-toast" aria-live="polite">
              {pickupDebug.feedback}
            </div>
          )}

          <div className="keyboard-hint" aria-live="polite">
            Use arrows to move. Press down to bend and pick up.
          </div>

          <button
            type="button"
            className="map-toggle"
            aria-expanded={isMapOpen}
            aria-label={isMapOpen ? "Close map" : "Open map"}
            onClick={toggleMap}
          >
            Map
          </button>

          {mapData.transitionLabel && (
            <div className="area-transition-label" aria-live="polite">
              {mapData.transitionLabel}
            </div>
          )}

          {mapData.turnHint && (
            <div className="turn-hint" aria-live="polite">
              {mapData.turnHint}
            </div>
          )}

          {isMapOpen && <TownMap mapData={mapData} onClose={() => setIsMapOpen(false)} />}

          <CollectionPanel parts={pickupDebug.parts ?? FALLBACK_PARTS} />

          {!isRunning && (
            <button
              type="button"
              className="camera-start"
              onClick={startCamera}
              disabled={isLoading}
            >
              {isLoading ? "Loading MediaPipe..." : "Start webcam"}
            </button>
          )}

          <div ref={puckRef} className="hidden-tracking-puck" aria-hidden="true" />

          {onBackToMap && (
            <div className="hover-zone copenhagen-map-exit" ref={mapExitHoverRef} data-variant="map">
              <button type="button" className="hover-start-btn" onClick={onBackToMap}>
                {mapExitCountdown !== null ? (mapExitCountdown || '✓') : '← Map'}
              </button>
            </div>
          )}

          {(tracking.leftHand?.visible || tracking.rightHand?.visible) && (
            <CopenhagenFingerCursor
              fingerPos={tracking.leftHand?.visible ? { x: tracking.leftHand.x, y: tracking.leftHand.y } : { x: tracking.rightHand.x, y: tracking.rightHand.y }}
              countdown={mapExitCountdown}
            />
          )}
        </div>
      </section>
    </>
  );
}
