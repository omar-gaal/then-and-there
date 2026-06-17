import { useCallback, useEffect, useMemo, useState } from "react";
import Webcam from "react-webcam";
import completedBicycleIllustration from "../assets/copenhagen-bicycle-postcard.svg";
import { VIDEO_CONSTRAINTS } from "../handTracking";
import { getPartMapPosition } from "../game/mapMarkers";
import { useCopenhagenTracking } from "../hooks/useCopenhagenTracking";
import { useMapGestureToggle } from "../hooks/useMapGestureToggle";
import { PICKUP_ANIMATION_DURATION } from "../scene/constants";
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

const TUTORIAL_STEPS = [
  {
    body: "Move your body gently left or right.",
    title: "Side movement",
  },
  {
    body: "Swing your arms and lift your knees to walk.",
    title: "Walking",
  },
  {
    body: "Stop moving and lower your hands to stop.",
    title: "Stopping",
  },
  {
    body: "Raise both hands to open the map.",
    mapOpenBody: "Great! Raise both hands again to close it.",
    title: "Map gesture",
  },
  {
    body: "Wave your hand left to turn left.",
    rightBody: "Wave your hand right to turn right.",
    title: "Turning",
  },
  {
    body: "Cross your arms to turn around. Keyboard: R",
    title: "Turn around",
  },
  {
    body: "Bend down to pick up the wheel.",
    title: "Pickup",
  },
];

const TUTORIAL_CAMERA_TITLE = "Welcome to Bike Hunt Copenhagen!";
const TUTORIAL_CAMERA_BODY = "Start the camera, then copy the guide's body movements to learn how to play.";
const TUTORIAL_DONE_MESSAGE = "Now find the rest of the bike parts!";
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
  lastTurnAroundTrigger: "none",
  lateralOffset: 0,
  localForward: 0,
  localLateral: 0,
  leftArmOut: false,
  leftWristDeltaX: 0,
  leftWristAvatarX: 0,
  rawLeftWristX: 0.5,
  movementSmoothing: 0.08,
  mapPlayerX: 0.66,
  mapPlayerY: 0.88,
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
  turnAroundCooldownMs: 0,
  playerWorldX: 0,
  playerWorldZ: 0,
  worldZ: 0,
  yawInfluence: 0.04,
};

export function CopenhagenExperience({ onBackToCities }) {
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [tutorialActive, setTutorialActive] = useState(true);
  const [currentTutorialStep, setCurrentTutorialStep] = useState(0);
  const [completedTutorialSteps, setCompletedTutorialSteps] = useState([]);
  const [tutorialMapOpened, setTutorialMapOpened] = useState(false);
  const [tutorialTurnLeftDone, setTutorialTurnLeftDone] = useState(false);
  const [tutorialDoneMessageVisible, setTutorialDoneMessageVisible] = useState(false);
  const [isKeyboardHelpOpen, setIsKeyboardHelpOpen] = useState(false);
  const [completionPhase, setCompletionPhase] = useState("idle");
  const [completionFact, setCompletionFact] = useState("");
  const [completionTriggered, setCompletionTriggered] = useState(false);
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
  const shouldShowCameraIntro = tutorialActive && !isRunning && !completionActive;
  const shouldRunTutorial = tutorialActive && isRunning && !completionActive;
  const tutorialStep = TUTORIAL_STEPS[currentTutorialStep];
  const tutorialMessage = useMemo(() => {
    if (shouldShowCameraIntro) {
      return TUTORIAL_CAMERA_BODY;
    }

    if (!shouldRunTutorial) {
      return tutorialDoneMessageVisible ? TUTORIAL_DONE_MESSAGE : "";
    }

    if (!tutorialStep) {
      return "";
    }

    if (currentTutorialStep === 3 && tutorialMapOpened && isMapOpen) {
      return tutorialStep.mapOpenBody;
    }

    if (currentTutorialStep === 4 && tutorialTurnLeftDone) {
      return tutorialStep.rightBody;
    }

    return tutorialStep.body;
  }, [
    currentTutorialStep,
    isMapOpen,
    shouldRunTutorial,
    shouldShowCameraIntro,
    tutorialDoneMessageVisible,
    tutorialMapOpened,
    tutorialStep,
    tutorialTurnLeftDone,
  ]);

  const completeTutorialStep = useCallback((stepIndex) => {
    setCompletedTutorialSteps((steps) => (
      steps.includes(stepIndex) ? steps : [...steps, stepIndex]
    ));
    setCurrentTutorialStep((current) => Math.max(current, stepIndex + 1));
  }, []);

  const finishTutorial = useCallback(() => {
    setTutorialActive(false);
    setTutorialDoneMessageVisible(true);
    window.setTimeout(() => {
      setTutorialDoneMessageVisible(false);
    }, 3200);
  }, []);

  const skipTutorial = useCallback(() => {
    setTutorialActive(false);
    setTutorialDoneMessageVisible(false);
  }, []);

  const resetTutorial = useCallback(() => {
    setTutorialActive(true);
    setCurrentTutorialStep(0);
    setCompletedTutorialSteps([]);
    setTutorialMapOpened(false);
    setTutorialTurnLeftDone(false);
    setTutorialDoneMessageVisible(false);
  }, []);

  const handleBackToCities = useCallback(() => {
    onBackToCities?.();
  }, [onBackToCities]);

  const handlePlayAgain = useCallback(() => {
    setCompletionPhase("idle");
    setCompletionTriggered(false);
    setCompletionFact("");
    setIsMapOpen(false);
    setMapData(DEFAULT_MAP_DATA);
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
    resetTutorial();
    setRunResetKey((key) => key + 1);
  }, [resetTutorial]);

  useEffect(() => {
    try {
      window.localStorage.setItem(DEBUG_OPEN_STORAGE_KEY, String(isDebugOpen));
    } catch {
      // Debug persistence is optional; the panel still works without storage.
    }
  }, [isDebugOpen]);

  useEffect(() => {
    const totalParts = pickupDebug.totalParts ?? pickupDebug.parts?.length ?? FALLBACK_PARTS.length;
    const collectedCount = pickupDebug.collectedCount
      ?? pickupDebug.parts?.filter((part) => part.collected).length
      ?? 0;
    const allPartsCollected = totalParts > 0 && collectedCount === totalParts;

    if (!allPartsCollected || completionTriggered) {
      return undefined;
    }

    let postcardTimer = 0;

    const triggerTimer = window.setTimeout(() => {
      setCompletionTriggered(true);
      setCompletionPhase("found");
      setTutorialActive(false);
      setTutorialDoneMessageVisible(false);
      setCompletionFact(COMPLETION_FACTS[Math.floor(Math.random() * COMPLETION_FACTS.length)]);

      postcardTimer = window.setTimeout(() => {
        setCompletionPhase("postcard");
      }, PICKUP_ANIMATION_DURATION * 1000);
    }, 0);

    return () => {
      window.clearTimeout(triggerTimer);
      window.clearTimeout(postcardTimer);
    };
  }, [completionTriggered, pickupDebug.collectedCount, pickupDebug.parts, pickupDebug.totalParts]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.code === "KeyM" && !event.repeat) {
        toggleMap();
      }

      if (!shouldRunTutorial || event.repeat || currentTutorialStep !== 4) {
        return;
      }

      if (event.code === "KeyQ" || event.code === "ArrowLeft" || event.code === "KeyA") {
        setTutorialTurnLeftDone(true);
      }

      if (
        tutorialTurnLeftDone &&
        (event.code === "KeyE" || event.code === "ArrowRight" || event.code === "KeyD")
      ) {
        completeTutorialStep(4);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    completeTutorialStep,
    currentTutorialStep,
    shouldRunTutorial,
    toggleMap,
    tutorialTurnLeftDone,
  ]);

  useEffect(() => {
    if (!shouldRunTutorial || currentTutorialStep !== 0) {
      return undefined;
    }

    if (Math.abs(worldDebug.lateralOffset) > 0.22 || Math.abs(worldDebug.keyboardSide) > 0) {
      const timeoutId = window.setTimeout(() => {
        completeTutorialStep(0);
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    return undefined;
  }, [
    completeTutorialStep,
    currentTutorialStep,
    shouldRunTutorial,
    worldDebug.keyboardSide,
    worldDebug.lateralOffset,
  ]);

  useEffect(() => {
    if (!shouldRunTutorial || currentTutorialStep !== 1) {
      return undefined;
    }

    if (worldDebug.smoothedSpeed > 0.008 || worldDebug.keyboardForward > 0) {
      const timeoutId = window.setTimeout(() => {
        completeTutorialStep(1);
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    return undefined;
  }, [
    completeTutorialStep,
    currentTutorialStep,
    shouldRunTutorial,
    worldDebug.keyboardForward,
    worldDebug.smoothedSpeed,
  ]);

  useEffect(() => {
    if (!shouldRunTutorial || currentTutorialStep !== 2) {
      return undefined;
    }

    if (worldDebug.smoothedSpeed < 0.004 && worldDebug.keyboardForward === 0) {
      const timeoutId = window.setTimeout(() => {
        completeTutorialStep(2);
      }, 700);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    return undefined;
  }, [
    completeTutorialStep,
    currentTutorialStep,
    shouldRunTutorial,
    worldDebug.keyboardForward,
    worldDebug.smoothedSpeed,
  ]);

  useEffect(() => {
    if (!shouldRunTutorial || currentTutorialStep !== 3) {
      return undefined;
    }

    let timeoutId = 0;

    if (isMapOpen) {
      timeoutId = window.setTimeout(() => {
        setTutorialMapOpened(true);
      }, 0);
      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    if (tutorialMapOpened) {
      timeoutId = window.setTimeout(() => {
        completeTutorialStep(3);
      }, 0);
    }

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    completeTutorialStep,
    currentTutorialStep,
    isMapOpen,
    shouldRunTutorial,
    tutorialMapOpened,
  ]);

  useEffect(() => {
    if (!shouldRunTutorial || currentTutorialStep !== 4) {
      return undefined;
    }

    let timeoutId = 0;

    if (worldDebug.swipeLeftDetected || worldDebug.armTurnTriggered === "Q") {
      timeoutId = window.setTimeout(() => {
        setTutorialTurnLeftDone(true);
      }, 0);
      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    if (
      tutorialTurnLeftDone &&
      (worldDebug.swipeRightDetected || worldDebug.armTurnTriggered === "E")
    ) {
      timeoutId = window.setTimeout(() => {
        completeTutorialStep(4);
      }, 0);
    }

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    completeTutorialStep,
    currentTutorialStep,
    shouldRunTutorial,
    tutorialTurnLeftDone,
    worldDebug.armTurnTriggered,
    worldDebug.swipeLeftDetected,
    worldDebug.swipeRightDetected,
  ]);

  useEffect(() => {
    if (!shouldRunTutorial || currentTutorialStep !== 5) {
      return undefined;
    }

    if (worldDebug.lastTurnAroundTrigger !== "none") {
      const timeoutId = window.setTimeout(() => {
        completeTutorialStep(5);
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    return undefined;
  }, [
    completeTutorialStep,
    currentTutorialStep,
    shouldRunTutorial,
    worldDebug.lastTurnAroundTrigger,
  ]);

  useEffect(() => {
    if (!shouldRunTutorial || currentTutorialStep !== 6) {
      return undefined;
    }

    const firstPartCollected = pickupDebug.parts?.some(
      (part) => part.id === "frontWheel" && part.collected,
    );

    if (firstPartCollected) {
      const timeoutId = window.setTimeout(() => {
        completeTutorialStep(6);
        finishTutorial();
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    return undefined;
  }, [
    completeTutorialStep,
    currentTutorialStep,
    finishTutorial,
    pickupDebug.parts,
    shouldRunTutorial,
  ]);

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
            onMapData={setMapData}
            onPickupDebug={setPickupDebug}
            onWorldDebug={setWorldDebug}
            currentTutorialStep={currentTutorialStep}
            resetRunKey={runResetKey}
            tracking={tracking}
            tutorialActive={shouldRunTutorial}
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
            collectedCount={pickupDebug.collectedCount ?? 0}
            completionTriggered={completionTriggered}
            currentAreaId={mapData.areaId}
            isOpen={isDebugOpen}
            isMapOpen={isMapOpen}
            mapGestureDebug={mapGestureDebug}
            onToggle={() => setIsDebugOpen((current) => !current)}
            postcardVisible={completionPhase === "postcard"}
            pickupDebug={pickupDebug}
            totalParts={pickupDebug.totalParts ?? pickupDebug.parts?.length ?? FALLBACK_PARTS.length}
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

          {completionPhase === "found" && (
            <div className="completion-toast" aria-live="polite">
              You found all bike parts!
            </div>
          )}

          {(tutorialActive || tutorialDoneMessageVisible) && (
            <aside
              className={`tutorial-panel${shouldShowCameraIntro ? " is-camera-intro" : ""}`}
              aria-live="polite"
              data-completed-steps={completedTutorialSteps.length}
            >
              <div>
                <span>
                  {shouldShowCameraIntro
                    ? "Camera setup"
                    : shouldRunTutorial
                    ? `Step ${Math.min(currentTutorialStep + 1, TUTORIAL_STEPS.length)} / ${TUTORIAL_STEPS.length}`
                    : "Ready"}
                </span>
                <strong>
                  {shouldShowCameraIntro
                    ? TUTORIAL_CAMERA_TITLE
                    : shouldRunTutorial
                      ? tutorialStep?.title
                      : TUTORIAL_DONE_MESSAGE}
                </strong>
              </div>
              {tutorialMessage && <p>{tutorialMessage}</p>}
              {shouldShowCameraIntro && (
                <>
                  <button type="button" onClick={startCamera} disabled={isLoading}>
                    {isLoading ? "Loading..." : "Start camera"}
                  </button>
                  <button type="button" onClick={skipTutorial}>
                    Skip tutorial
                  </button>
                </>
              )}
              {shouldRunTutorial && (
                <button type="button" onClick={skipTutorial}>
                  Skip tutorial
                </button>
              )}
            </aside>
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
                <p>Cross arms = Turn around</p>
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

          {completionPhase === "postcard" && (
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

          <CollectionPanel parts={pickupDebug.parts ?? FALLBACK_PARTS} />

          {!isRunning && !tutorialActive && (
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
