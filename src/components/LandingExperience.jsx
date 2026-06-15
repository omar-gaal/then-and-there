import { useEffect, useState } from "react";
import Webcam from "react-webcam";
import { useHandTracking } from "../hooks/useHandTracking";
import { VIDEO_CONSTRAINTS } from "../handTracking";
import { StatusPill } from "./StatusPill";

const GESTURE_TIMEOUT_MS = 10_000;

export function LandingExperience({ onChooseAmsterdam, onChooseParis }) {
  const {
    canvasRef,
    handleCameraError,
    handleCameraReady,
    isLoading,
    startCamera,
    stopCamera,
    tracking,
    webcamRef,
  } = useHandTracking();
  const [hasWaitedLongEnough, setHasWaitedLongEnough] = useState(false);

  useEffect(() => {
    startCamera();

    return () => {
      stopCamera();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setHasWaitedLongEnough(true);
    }, GESTURE_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  const isHandDetected = tracking.mode === "tracking";
  const showGestureOverlay = hasWaitedLongEnough && !isHandDetected;

  return (
    <section className="landing-scene" aria-label="Then and There landing page">
      <img
        className="landing-map"
        src="/map-svgrepo-com.svg"
        alt="Illustrated map for the Then and There journey"
      />

      <div className="landing-vision" aria-hidden="true">
        <Webcam
          ref={webcamRef}
          audio={false}
          className="landing-webcam"
          onUserMedia={handleCameraReady}
          onUserMediaError={handleCameraError}
          playsInline
          videoConstraints={VIDEO_CONSTRAINTS}
        />
        <canvas ref={canvasRef} className="landing-canvas" />
      </div>

      <div className="landing-actions" aria-label="Choose a city">
        <button
          type="button"
          className="landing-button is-paris"
          onClick={onChooseParis}
        >
          Paris
        </button>
        <button
          type="button"
          className="landing-button is-amsterdam"
          onClick={onChooseAmsterdam}
        >
          Amsterdam
        </button>
      </div>

      {showGestureOverlay && (
        <div className="landing-overlay">
          <div className="landing-card">
            <p className="eyebrow">Then & There</p>
            <h1 className="landing-title">Find the gesture to begin</h1>
            <p className="landing-copy">
              Hold up a hand in front of the camera. This prompt only appears
              after 10 seconds without a detected gesture.
            </p>
            <StatusPill
              mode={tracking.mode}
              label={isLoading ? "Loading model" : tracking.label}
            />
          </div>
        </div>
      )}
    </section>
  );
}
