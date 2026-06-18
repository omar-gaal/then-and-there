import { useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import completedBicycleIllustration from "../assets/copenhagen-bicycle-postcard.svg";
import { BIKE_PARTS } from "../game/bikeParts";
import { VIDEO_CONSTRAINTS } from "../handTracking";
import { partToMapMarker } from "../game/mapMarkers";
import { useCopenhagenTracking } from "../hooks/useCopenhagenTracking";
import { useMapGestureToggle } from "../hooks/useMapGestureToggle";
import { CollectionPanel } from "./CollectionPanel";
import { DebugPanel } from "./DebugPanel";
import { ThreeStreetScene } from "./ThreeStreetScene";
import { TownMap } from "./TownMap";
import { LEFT_STREET_ENTRANCE_Z } from "../scene/constants";

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
    playerArrowRotation: 0,
    side: "center",
    sidePosition: 0.5,
    x: 0.64,
    y: 0.88,
  },
  parts: BIKE_PARTS.map((part) => ({
    ...part,
    collected: false,
    ...partToMapMarker(part),
  })),
  transitionLabel: "",
  turnHint: "",
};

const DEBUG_OPEN_STORAGE_KEY = "copenhagenBikeGame.debugOpen";
const FINAL_PICKUP_DELAY_MS = 1200;
const CELEBRATION_DURATION_MS = 2100;

const GUIDE_STEPS = {
  HIDDEN: "hidden",
  LEFT: "left",
  MAP: "map",
  PICKUP: "pickup",
  RIGHT: "right",
  TURN: "turn",
  WALK: "walk",
};
const INTERSECTION_GUIDE_RANGE = 16;
const COMPLETION_FACTS = [
  "More than half of Copenhagen residents use bicycles every day.",
  "Copenhagen has hundreds of kilometers of bicycle infrastructure.",
  "Many families in Copenhagen use cargo bikes instead of cars.",
  "Cycling is one of the most common ways to travel around the city.",
  "Copenhagen is often ranked among the world's most bicycle-friendly cities.",
];

const DEFAULT_WORLD_DEBUG = {
  armTurnCooldownMs: 0,
  armTurnBlockedReason: "ready",
  armTurnReleased: true,
  armTurnTriggerAccepted: false,
  armTurnTriggerAttempted: false,
  armTurnTriggered: "",
  armsCrossed: false,
  armsCrossedDisabled: true,
  gestureTriggerAccepted: false,
  gestureTriggerAttempted: false,
  avatarBaseYaw: Math.PI,
  avatarWorldX: 0,
  avatarWorldZ: 0,
  currentAreaId: "mainStreet",
  currentHeading: 0,
  distancePlayerToNearbyPartOnMap: null,
  distanceToNearestPart: null,
  effectiveAvatarYaw: Math.PI,
  facingAngle: Math.PI,
  finalLateralMovement: 0,
  heading: 0,
  headingAfter: 0,
  headingBefore: 0,
  idleDetected: false,
  keyboardActive: false,
  keyboardForward: 0,
  keyboardMovementValue: 0,
  keyboardSide: 0,
  keyboardSpeedMultiplier: 1.5,
  keyboardSmoothing: 0.5,
  lastTurnAroundTrigger: "none",
  lastTurnGesture: "none",
  lateralOffset: 0,
  localForward: 0,
  localLateral: 0,
  leftArmDetected: false,
  leftArmDistance: 0,
  leftArmOut: false,
  leftArmExtended: false,
  leftArmExtendedRaw: false,
  leftHoldMs: 0,
  leftShoulderX: 0.5,
  leftWristMinusShoulder: 0,
  leftWristDeltaX: 0,
  leftWristAvatarX: 0,
  armTurnDistanceThreshold: 0.12,
  armTurnTestThreshold: 0.12,
  rawLeftWristX: 0.5,
  movementSmoothing: 0.08,
  mapPlayerX: 0.66,
  mapPlayerY: 0.88,
  mapParts: [],
  nearbyPartMapX: null,
  nearbyPartMapY: null,
  nearbyPartWorldX: null,
  nearbyPartWorldZ: null,
  nearestPartId: "none",
  occlusionCameraInsideBuilding: false,
  occlusionFadedCount: 0,
  occlusionFadedIds: [],
  occlusionMode: "hide",
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
  rightArmDetected: false,
  rightArmDistance: 0,
  rightArmOut: false,
  rightArmExtended: false,
  rightArmExtendedRaw: false,
  rightHoldMs: 0,
  rightShoulderX: 0.5,
  rightWristMinusShoulder: 0,
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
  trackingStable: false,
  turnAroundCooldownMs: 0,
  turnGestureCooldownMs: 0,
  turnGestureActive: false,
  turnSource: "none",
  triggerBlockedReason: "ready",
  playerWorldX: 0,
  playerWorldZ: 0,
  playerMapX: 0.66,
  playerMapY: 0.88,
  playerArrowRotation: 0,
  playerPickupWorldX: 0,
  playerPickupWorldZ: 0,
  worldZ: 0,
  yawInfluence: 0.04,
};

export function CopenhagenExperience({ onBackToCities }) {
  const completionTriggeredRef = useRef(false);
  const finalPickupTimerRef = useRef(0);
  const postcardTimerRef = useRef(0);
  const turnGuideStartHeadingRef = useRef(null);
  const walkingDetectedAtRef = useRef(0);
  const walkStartWorldZRef = useRef(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(GUIDE_STEPS.WALK);
  const [guideCompletedWalk, setGuideCompletedWalk] = useState(false);
  const [guideCompletedLeft, setGuideCompletedLeft] = useState(false);
  const [guideCompletedRight, setGuideCompletedRight] = useState(false);
  const [mapGuideCompleted, setMapGuideCompleted] = useState(false);
  const [pickupGuideCompleted, setPickupGuideCompleted] = useState(false);
  const [turnGuideCompleted, setTurnGuideCompleted] = useState(false);
  const [isKeyboardHelpOpen, setIsKeyboardHelpOpen] = useState(false);
  const [completionPhase, setCompletionPhase] = useState("idle");
  const [completionFact, setCompletionFact] = useState("");
  const [completionTriggered, setCompletionTriggered] = useState(false);
  const [postcardVisible, setPostcardVisible] = useState(false);
  const [runResetKey, setRunResetKey] = useState(0);
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
    collectedCount: 0,
    debug: null,
    feedback: "",
    gestureState: "waiting",
    handsLow: false,
    isComplete: false,
    nearbyPart: "none",
    parts: FALLBACK_PARTS,
    totalParts: FALLBACK_PARTS.length,
  });
  const {
    canvasRef,
    handleCameraError,
    handleCameraReady,
    isLoading,
    isRunning,
    puckRef,
    resetBodyLeanCenter,
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
  const completionActive = completionPhase !== "idle" && completionPhase !== "dismissed";
  const activeGuideStep = isRunning && !completionActive ? guideStep : GUIDE_STEPS.HIDDEN;

  const handleBackToCities = useCallback(() => {
    onBackToCities?.();
  }, [onBackToCities]);

  const clearCompletionTimers = useCallback(() => {
    window.clearTimeout(finalPickupTimerRef.current);
    window.clearTimeout(postcardTimerRef.current);
    finalPickupTimerRef.current = 0;
    postcardTimerRef.current = 0;
  }, []);

  const handlePlayAgain = useCallback(() => {
    clearCompletionTimers();
    completionTriggeredRef.current = false;
    setCompletionPhase("idle");
    setCompletionTriggered(false);
    setPostcardVisible(false);
    setCompletionFact("");
    setIsMapOpen(false);
    setMapData(DEFAULT_MAP_DATA);
    turnGuideStartHeadingRef.current = null;
    walkingDetectedAtRef.current = 0;
    walkStartWorldZRef.current = null;
    setPickupDebug({
      collectedCount: 0,
      debug: null,
      feedback: "",
      gestureState: "waiting",
      handsLow: false,
      isComplete: false,
      nearbyPart: "none",
      parts: FALLBACK_PARTS,
      totalParts: FALLBACK_PARTS.length,
    });
    setGuideStep(GUIDE_STEPS.WALK);
    setGuideCompletedWalk(false);
    setGuideCompletedLeft(false);
    setGuideCompletedRight(false);
    setMapGuideCompleted(false);
    setPickupGuideCompleted(false);
    setTurnGuideCompleted(false);
    setRunResetKey((key) => key + 1);
  }, [clearCompletionTimers]);

  const handlePickupDebug = useCallback((nextPickupDebug) => {
    setPickupDebug(nextPickupDebug);

    const progressParts = nextPickupDebug.parts ?? FALLBACK_PARTS;
    const collectedCount = progressParts.filter((part) => part.collected).length;
    const totalParts = progressParts.length;
    const completionDetected = totalParts > 0 && collectedCount === totalParts;

    if (!completionDetected || completionTriggeredRef.current) {
      return;
    }

    completionTriggeredRef.current = true;
    setCompletionTriggered(true);
    setCompletionPhase("finalPickup");
    setGuideStep(GUIDE_STEPS.HIDDEN);
    setCompletionFact(COMPLETION_FACTS[Math.floor(Math.random() * COMPLETION_FACTS.length)]);

    finalPickupTimerRef.current = window.setTimeout(() => {
      setCompletionPhase("celebrating");

      postcardTimerRef.current = window.setTimeout(() => {
        setCompletionPhase("postcard");
        setPostcardVisible(true);
      }, CELEBRATION_DURATION_MS);
    }, FINAL_PICKUP_DELAY_MS);
  }, []);

  useEffect(() => () => clearCompletionTimers(), [clearCompletionTimers]);

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

  useEffect(() => {
    if (!isRunning || completionActive) {
      return undefined;
    }

    let nextGuideStep = "";
    let completeCurrentStep = null;
    const now = performance.now();

    if (guideStep === GUIDE_STEPS.WALK && walkStartWorldZRef.current === null) {
      walkStartWorldZRef.current = worldDebug.playerWorldZ ?? 0;
    }

    if (tracking.motion?.walking) {
      walkingDetectedAtRef.current ||= now;
    } else {
      walkingDetectedAtRef.current = 0;
    }

    const walkedForwardEnough =
      Math.abs((worldDebug.playerWorldZ ?? 0) - (walkStartWorldZRef.current ?? worldDebug.playerWorldZ ?? 0)) > 0.55 ||
      worldDebug.smoothedSpeed > 0.008;
    const walkingDetectedLongEnough = walkingDetectedAtRef.current > 0 && now - walkingDetectedAtRef.current >= 1000;

    if (guideStep === GUIDE_STEPS.WALK && (walkedForwardEnough || walkingDetectedLongEnough || worldDebug.keyboardForward > 0)) {
      nextGuideStep = GUIDE_STEPS.LEFT;
      completeCurrentStep = () => setGuideCompletedWalk(true);
    } else if (guideStep === GUIDE_STEPS.LEFT && (tracking.motion?.leanLeft || worldDebug.finalLateralMovement < -0.01 || worldDebug.keyboardSide < 0)) {
      nextGuideStep = GUIDE_STEPS.RIGHT;
      completeCurrentStep = () => setGuideCompletedLeft(true);
    } else if (guideStep === GUIDE_STEPS.RIGHT && (tracking.motion?.leanRight || worldDebug.finalLateralMovement > 0.01 || worldDebug.keyboardSide > 0)) {
      nextGuideStep = GUIDE_STEPS.MAP;
      completeCurrentStep = () => setGuideCompletedRight(true);
    }

    if (!nextGuideStep) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      completeCurrentStep?.();
      setGuideStep(nextGuideStep);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [
    completionActive,
    guideStep,
    isRunning,
    tracking.motion?.leanLeft,
    tracking.motion?.leanRight,
    tracking.motion?.walking,
    worldDebug.finalLateralMovement,
    worldDebug.keyboardForward,
    worldDebug.keyboardSide,
    worldDebug.playerWorldZ,
    worldDebug.smoothedSpeed,
  ]);

  useEffect(() => {
    if (guideStep !== GUIDE_STEPS.MAP) {
      return undefined;
    }

    if (isMapOpen) {
      const timeoutId = window.setTimeout(() => {
        setMapGuideCompleted(true);
        setGuideStep(GUIDE_STEPS.HIDDEN);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [guideStep, isMapOpen]);

  useEffect(() => {
    if (!isRunning || completionActive || pickupGuideCompleted || guideStep !== GUIDE_STEPS.HIDDEN) {
      return undefined;
    }

    if (pickupDebug.nearbyPart !== "none" && pickupDebug.gestureState !== "collected") {
      const timeoutId = window.setTimeout(() => setGuideStep(GUIDE_STEPS.PICKUP), 0);

      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [
    completionActive,
    guideStep,
    isRunning,
    pickupDebug.gestureState,
    pickupDebug.nearbyPart,
    pickupGuideCompleted,
  ]);

  useEffect(() => {
    if (guideStep !== GUIDE_STEPS.PICKUP) {
      return undefined;
    }

    if ((pickupDebug.parts ?? FALLBACK_PARTS).some((part) => part.collected)) {
      const timeoutId = window.setTimeout(() => {
        setPickupGuideCompleted(true);
        setGuideStep(GUIDE_STEPS.HIDDEN);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [guideStep, pickupDebug.parts]);

  useEffect(() => {
    if (!pickupGuideCompleted && (pickupDebug.parts ?? FALLBACK_PARTS).some((part) => part.collected)) {
      const timeoutId = window.setTimeout(() => setPickupGuideCompleted(true), 0);

      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [pickupDebug.parts, pickupGuideCompleted]);

  useEffect(() => {
    if (!isRunning || completionActive || turnGuideCompleted || guideStep !== GUIDE_STEPS.HIDDEN) {
      return undefined;
    }

    const nearIntersectionGuideZone =
      Math.abs((worldDebug.playerWorldZ ?? 0) - LEFT_STREET_ENTRANCE_Z) < INTERSECTION_GUIDE_RANGE;

    if (nearIntersectionGuideZone && worldDebug.currentAreaId === "mainStreet") {
      const timeoutId = window.setTimeout(() => setGuideStep(GUIDE_STEPS.TURN), 0);

      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [
    completionActive,
    guideStep,
    isRunning,
    turnGuideCompleted,
    worldDebug.currentAreaId,
    worldDebug.playerWorldZ,
  ]);

  useEffect(() => {
    if (guideStep !== GUIDE_STEPS.TURN) {
      turnGuideStartHeadingRef.current = null;
      return undefined;
    }

    if (turnGuideStartHeadingRef.current === null) {
      turnGuideStartHeadingRef.current = worldDebug.heading ?? 0;
    }

    const headingChanged =
      Math.abs(getAngleDelta(worldDebug.heading ?? 0, turnGuideStartHeadingRef.current)) > 0.18;

    if (
      worldDebug.turnSource === "webcam" ||
      worldDebug.turnSource === "keyboard" ||
      worldDebug.gestureTriggerAccepted ||
      headingChanged
    ) {
      const timeoutId = window.setTimeout(() => {
        setTurnGuideCompleted(true);
        setGuideStep(GUIDE_STEPS.HIDDEN);
      }, 0);

      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [guideStep, worldDebug.gestureTriggerAccepted, worldDebug.heading, worldDebug.turnSource]);

  useEffect(() => {
    if (!turnGuideCompleted && (worldDebug.turnSource === "webcam" || worldDebug.turnSource === "keyboard")) {
      const timeoutId = window.setTimeout(() => setTurnGuideCompleted(true), 0);

      return () => window.clearTimeout(timeoutId);
    }

    return undefined;
  }, [turnGuideCompleted, worldDebug.turnSource]);

  const progressParts = pickupDebug.parts ?? FALLBACK_PARTS;
  const collectedCount = progressParts.filter((part) => part.collected).length;
  const totalParts = progressParts.length;
  const nearIntersectionGuideZone =
    Math.abs((worldDebug.playerWorldZ ?? 0) - LEFT_STREET_ENTRANCE_Z) < INTERSECTION_GUIDE_RANGE &&
    worldDebug.currentAreaId === "mainStreet";
  const guideDebug = {
    activeGuideStep,
    guideVisible: activeGuideStep !== GUIDE_STEPS.HIDDEN,
    guideCompletedWalk,
    guideCompletedLeft,
    guideCompletedRight,
    mapGuideCompleted,
    nearIntersectionGuideZone,
    pickupGuideCompleted,
    turnGuideCompleted,
  };

  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">Copenhagen prototype</p>
          <h1>Bike Part Hunt</h1>
        </div>
      </header>

      <section className="copenhagen-game" aria-label="Copenhagen bike part game">
        <div className="street-frame">
          <ThreeStreetScene
            completionPhase={completionPhase}
            guideStep={activeGuideStep}
            onMapData={setMapData}
            onPickupDebug={handlePickupDebug}
            onRecalibrateBodyLean={resetBodyLeanCenter}
            onWorldDebug={setWorldDebug}
            isMapOpen={isMapOpen}
            resetRunKey={runResetKey}
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
            collectedCount={collectedCount}
            completionTriggered={completionTriggered}
            currentAreaId={mapData.areaId}
            isOpen={isDebugOpen}
            isMapOpen={isMapOpen}
            mapGestureDebug={mapGestureDebug}
            guideDebug={guideDebug}
            onToggle={() => setIsDebugOpen((current) => !current)}
            postcardVisible={postcardVisible}
            pickupDebug={pickupDebug}
            totalParts={totalParts}
            tracking={tracking}
            worldDebug={worldDebug}
          />

          {pickupDebug.nearbyPart !== "none" &&
            !completionActive &&
            pickupDebug.gestureState !== "collected" && (
              <div className="pickup-prompt" aria-live="polite">
                Bend down to pick up {pickupDebug.nearbyPart}
              </div>
            )}

          {pickupDebug.feedback && !completionActive && (
            <div className="pickup-toast" aria-live="polite">
              {pickupDebug.feedback}
            </div>
          )}

          {completionPhase === "celebrating" && (
            <>
              <div className="completion-toast" aria-live="polite">
                You found all bike parts!
              </div>
              <div className="completion-sparkles" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>
            </>
          )}

          <details
            className="keyboard-help"
            open={isKeyboardHelpOpen}
            onToggle={(event) => setIsKeyboardHelpOpen(event.currentTarget.open)}
          >
            <summary>Keyboard Help</summary>
            <div className="keyboard-help-panel">
              <strong>Keyboard Controls</strong>

              <section>
                <h2>Movement</h2>
                <p><kbd>↑</kbd> or <kbd>W</kbd> = Walk forward</p>
                <p><kbd>←</kbd> or <kbd>A</kbd> = Move left</p>
                <p><kbd>→</kbd> or <kbd>D</kbd> = Move right</p>
              </section>

              <section>
                <h2>Actions</h2>
                <p><kbd>↓</kbd> or <kbd>S</kbd> = Bend / Pick up item</p>
              </section>

              <section>
                <h2>Turning</h2>
                <p><kbd>Q</kbd> = Turn left at intersections</p>
                <p><kbd>E</kbd> = Turn right / return to Main Street</p>
                <p><kbd>R</kbd> = Turn around</p>
              </section>

              <section>
                <h2>Map</h2>
                <p><kbd>M</kbd> = Open / Close map</p>
              </section>

              <section>
                <h2>Gestures</h2>
                <p>Left arm out = Turn left</p>
                <p>Right arm out = Turn right</p>
              </section>

              <p className="keyboard-help-note">
                All actions can also be performed using body gestures.
              </p>
            </div>
          </details>

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

          {isMapOpen && <TownMap mapData={mapData} onClose={() => setIsMapOpen(false)} />}

          {postcardVisible && (
            <div className="completion-postcard-backdrop" aria-live="polite">
              <section className="completion-postcard">
                <span>Copenhagen Postcard</span>
                <h2>You found all bike parts!</h2>
                <p>Here is your completed bicycle.</p>
                <img
                  className="completion-bike-image"
                  src={completedBicycleIllustration}
                  alt="Completed bicycle illustration"
                />
                <div className="completion-fun-fact">
                  <span>Fun Fact</span>
                  <blockquote>{completionFact}</blockquote>
                </div>
                <div className="completion-actions">
                  <button type="button" onClick={handleBackToCities}>
                    Back to Cities
                  </button>
                  <button type="button" onClick={handlePlayAgain}>
                    Play Again
                  </button>
                </div>
              </section>
            </div>
          )}

          <CollectionPanel parts={progressParts} />

          {!isRunning && (
            <button
              type="button"
              className="camera-start"
              onClick={startCamera}
              disabled={isLoading}
            >
              {isLoading ? "Loading MediaPipe..." : "Start camera"}
            </button>
          )}

          <div ref={puckRef} className="hidden-tracking-puck" aria-hidden="true" />
        </div>
      </section>
    </>
  );
}

function getAngleDelta(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}
