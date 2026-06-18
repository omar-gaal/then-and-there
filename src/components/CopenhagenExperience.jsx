import { useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import completedBicycleIllustration from "../assets/copenhagen-bicycle-postcard.svg";
import { BIKE_PARTS } from "../game/bikeParts";
import { VIDEO_CONSTRAINTS } from "../handTracking";
import { partToMapMarker } from "../game/mapMarkers";
import { useCopenhagenTracking } from "../hooks/useCopenhagenTracking";
import { useMapGestureToggle } from "../hooks/useMapGestureToggle";
import { CollectionPanel } from "./CollectionPanel";
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
  const [, setGuideCompletedWalk] = useState(false);
  const [, setGuideCompletedLeft] = useState(false);
  const [, setGuideCompletedRight] = useState(false);
  const [, setMapGuideCompleted] = useState(false);
  const [pickupGuideCompleted, setPickupGuideCompleted] = useState(false);
  const [turnGuideCompleted, setTurnGuideCompleted] = useState(false);
  const [isKeyboardHelpOpen, setIsKeyboardHelpOpen] = useState(false);
  const [completionPhase, setCompletionPhase] = useState("idle");
  const [completionFact, setCompletionFact] = useState("");
  const [postcardVisible, setPostcardVisible] = useState(false);
  const [runResetKey, setRunResetKey] = useState(0);
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
  useMapGestureToggle({
    onToggle: toggleMap,
    pose: tracking.pose,
  });
  const completionActive = completionPhase !== "idle" && completionPhase !== "dismissed";
  const activeGuideStep = isRunning && !completionActive ? guideStep : GUIDE_STEPS.HIDDEN;

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

  const handleResultBackToCities = useCallback(() => {
    clearCompletionTimers();
    completionTriggeredRef.current = false;
    setCompletionPhase("dismissed");
    setPostcardVisible(false);
    onBackToCities?.();
  }, [clearCompletionTimers, onBackToCities]);

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

          {isRunning && !postcardVisible && (
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
            <summary aria-label={isKeyboardHelpOpen ? "Close keyboard help" : "Open keyboard help"}>
              <svg className="keyboard-help-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M5 3.8v14.9l3.8-3.4 2.5 5.3 2.8-1.3-2.5-5.1 5.1-.5L5 3.8Z" />
              </svg>
            </summary>
            <div className="keyboard-help-panel">
              <strong>Keyboard controls</strong>
              <p><kbd>↑</kbd> / <kbd>W</kbd> = Walk forward</p>
              <p><kbd>←</kbd> / <kbd>A</kbd> = Move left</p>
              <p><kbd>→</kbd> / <kbd>D</kbd> = Move right</p>
              <p><kbd>↓</kbd> / <kbd>S</kbd> = Bend / pick up</p>
              <p><kbd>Q</kbd> = Turn left</p>
              <p><kbd>E</kbd> = Turn right</p>
              <p><kbd>M</kbd> = Open / close map</p>
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

          {!isRunning && (
            <CopenhagenStartOverlay
              isLoading={isLoading}
              onStartCamera={startCamera}
            />
          )}

          {postcardVisible && (
            <CopenhagenResultOverlay
              completionFact={completionFact}
              onBackToCities={handleResultBackToCities}
              onPlayAgain={handlePlayAgain}
            />
          )}

          <CollectionPanel parts={progressParts} />

          <div ref={puckRef} className="hidden-tracking-puck" aria-hidden="true" />
        </div>
      </section>
    </>
  );
}

function CopenhagenStartOverlay({
  isLoading,
  onStartCamera,
}) {
  return (
    <div className="round-overlay copenhagen-start-overlay" aria-live="polite">
      <p className="round-overlay-eyebrow">Copenhagen challenge</p>
      <strong>Bike Hunt Copenhagen</strong>
      <section className="how-to-play-card copenhagen-how-to-card" aria-label="How to play Bike Hunt Copenhagen">
        <p className="copenhagen-guide-intro">
          The ghost guide will show you what to do during your journey.
        </p>
        <span className="how-to-play-label">How to play</span>
        <ul className="how-to-play-steps">
          <li>Move your arms and legs to walk forward</li>
          <li>Move your body left or right to slide sideways</li>
          <li>Bend down to pick up bike parts</li>
          <li>Raise both hands to open and close the map</li>
          <li>Stretch your left arm to turn left</li>
          <li>Stretch your right arm to turn right</li>
        </ul>
      </section>
      <button
        type="button"
        className="action-btn btn-teal copenhagen-start-button"
        onClick={onStartCamera}
        disabled={isLoading}
      >
        {isLoading ? "Loading MediaPipe..." : "Start game"}
      </button>
      <p className="hover-hint">Point your body at the camera</p>
    </div>
  );
}

function CopenhagenResultOverlay({
  completionFact,
  onBackToCities,
  onPlayAgain,
}) {
  return (
    <div className="round-overlay copenhagen-result-overlay" aria-live="polite">
      <p className="round-overlay-eyebrow">Bike complete</p>
      <strong>You found all bike parts!</strong>
      <img
        className="copenhagen-result-bike"
        src={completedBicycleIllustration}
        alt="Completed bicycle illustration"
      />
      <div className="fun-fact-card copenhagen-result-fact">
        <span className="fun-fact-label">Copenhagen fun fact</span>
        <p className="fun-fact-text">{completionFact}</p>
      </div>
      <div className="post-round-actions copenhagen-result-actions">
        <button type="button" className="action-btn btn-amber" onClick={onPlayAgain}>
          Play again
        </button>
        <button type="button" className="action-btn btn-ghost copenhagen-map-button" onClick={onBackToCities}>
          Back to map
        </button>
      </div>
      <p className="hover-hint">Choose an option to continue</p>
    </div>
  );
}

function getAngleDelta(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}
