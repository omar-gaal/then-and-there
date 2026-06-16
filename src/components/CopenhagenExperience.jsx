import { useCallback, useEffect, useState } from "react";
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

export function CopenhagenExperience() {
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

      <section className="workspace" aria-label="Copenhagen bike part game">
        <div className="street-frame">
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
        </div>
      </section>
    </>
  );
}
