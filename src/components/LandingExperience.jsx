import { useEffect, useState } from "react";
import Webcam from "react-webcam";
import { useHandHover } from "../hooks/useHandHover";
import { VIDEO_CONSTRAINTS } from "../handTracking";
import { FingerCursor, HoverChoiceButton } from "./FingerHoldButton";
import { StatusPill } from "./StatusPill";

const GESTURE_TIMEOUT_MS = 10_000;

export function LandingExperience({
  onChooseAmsterdam,
  onChooseCopenhagen,
  onChooseParis,
}) {
  const {
    canvasRef,
    handleCameraReady,
    isReady,
    fingerPos,
    stop,
    resume,
    webcamRef,
  } = useHandHover();
  const [hasWaitedLongEnough, setHasWaitedLongEnough] = useState(false);
  const [activeCountdown, setActiveCountdown] = useState(null);

  useEffect(() => {
    resume();

    return () => {
      stop();
    };
  }, [resume, stop]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setHasWaitedLongEnough(true);
    }, GESTURE_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  const showGestureOverlay = hasWaitedLongEnough && !fingerPos;

  return (
    <section className="landing-scene" aria-label="Then and There landing page">
      <img
        className="landing-map"
        src="/painted-landing-map.png"
        alt="Illustrated map for the Then and There journey"
      />

      <div className="landing-vision" aria-hidden="true">
        <Webcam
          ref={webcamRef}
          audio={false}
          className="landing-webcam"
          onUserMedia={handleCameraReady}
          playsInline
          videoConstraints={VIDEO_CONSTRAINTS}
        />
        <canvas ref={canvasRef} className="landing-canvas" />
      </div>

      <div className="landing-actions" aria-label="Choose a city">
        <HoverChoiceButton
          ariaLabel="Choose Paris"
          className="is-paris"
          fingerPos={fingerPos}
          label="Paris"
          onChoose={onChooseParis}
          onCountdownChange={setActiveCountdown}
          position={{ x: 0.28, y: 0.84 }}
        />
        <HoverChoiceButton
          ariaLabel="Choose Amsterdam"
          className="is-amsterdam"
          fingerPos={fingerPos}
          label="Amsterdam"
          onChoose={onChooseAmsterdam}
          onCountdownChange={setActiveCountdown}
          position={{ x: 0.5, y: 0.84 }}
        />
        <HoverChoiceButton
          ariaLabel="Choose Copenhagen"
          className="is-copenhagen"
          fingerPos={fingerPos}
          label="Copenhagen"
          onChoose={onChooseCopenhagen}
          onCountdownChange={setActiveCountdown}
          position={{ x: 0.72, y: 0.84 }}
        />
      </div>

      {fingerPos && (
        <FingerCursor fingerPos={fingerPos} countdown={activeCountdown} />
      )}

      {showGestureOverlay && (
        <div className="landing-overlay">
          <div className="landing-card">
            <p className="eyebrow">Then & There</p>
            <h1 className="landing-title">Raise your hand!</h1>
            <p className="landing-copy">
              Hold your hand in front of the camera to get started.
            </p>
            <StatusPill
              mode={isReady ? "searching" : "loading"}
              label={isReady ? "Hover a city" : "Loading hand detector"}
            />
          </div>
        </div>
      )}
    </section>
  );
}
