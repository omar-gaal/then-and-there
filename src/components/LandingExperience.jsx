import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import { useHandHover } from "../hooks/useHandHover";
import { VIDEO_CONSTRAINTS } from "../handTracking";
import { StatusPill } from "./StatusPill";

const GESTURE_TIMEOUT_MS = 10_000;
const HOLD_TO_SELECT_SECONDS = 3;

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
        src="/map-svgrepo-com.svg"
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
          className="is-paris"
          fingerPos={fingerPos}
          label="Paris"
          onChoose={onChooseParis}
          position={{ x: 0.28, y: 0.84 }}
        />
        <HoverChoiceButton
          className="is-copenhagen"
          fingerPos={fingerPos}
          label="Copenhagen"
          onChoose={onChooseCopenhagen}
          position={{ x: 0.5, y: 0.84 }}
        />
        <HoverChoiceButton
          className="is-amsterdam"
          fingerPos={fingerPos}
          label="Amsterdam"
          onChoose={onChooseAmsterdam}
          position={{ x: 0.72, y: 0.84 }}
        />
      </div>

      {fingerPos && (
        <div
          className="landing-cursor"
          style={{
            "--cx": `${fingerPos.x * 100}%`,
            "--cy": `${fingerPos.y * 100}%`,
          }}
          aria-hidden="true"
        />
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

function HoverChoiceButton({
  className,
  fingerPos,
  label,
  onChoose,
  position,
}) {
  const [countdown, setCountdown] = useState(null);
  const hoverStartRef = useRef(null);
  const firedRef = useRef(false);
  const isHovered =
    Boolean(fingerPos) &&
    Math.hypot(fingerPos.x - position.x, fingerPos.y - position.y) <= 0.13;

  useEffect(() => {
    if (!isHovered) {
      hoverStartRef.current = null;
      firedRef.current = false;
      return undefined;
    }

    if (hoverStartRef.current === null) {
      hoverStartRef.current = Date.now();
    }

    function updateCountdown() {
      const elapsed = (Date.now() - hoverStartRef.current) / 1000;
      const remaining = Math.ceil(
        Math.max(0, HOLD_TO_SELECT_SECONDS - elapsed),
      );

      setCountdown(remaining);

      if (remaining === 0 && !firedRef.current) {
        firedRef.current = true;
        onChoose();
      }
    }

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 100);

    return () => {
      window.clearInterval(interval);
    };
  }, [isHovered, onChoose]);

  return (
    <button
      type="button"
      className={`landing-button ${className}`}
      onClick={onChoose}
      data-countdown={countdown !== null ? countdown : undefined}
      aria-label={`Choose ${label}`}
    >
      <span className="landing-button-label">{label}</span>
      <span className="landing-button-hint">
        {isHovered && countdown !== null ? countdown || "✓" : `Hold 3s`}
      </span>
    </button>
  );
}
