import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const HOLD_TO_SELECT_SECONDS = 3;
const RING_CIRCUMFERENCE = 276.5;

export function FingerHoldButton({
  ariaLabel,
  children,
  className = "",
  containerRef,
  disabled = false,
  fingerPos,
  onChoose,
  onCountdownChange,
  style,
  type = "button",
  ...buttonProps
}) {
  const buttonRef = useRef(null);
  const [countdown, setCountdown] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const firedRef = useRef(false);
  const hoverStartRef = useRef(null);

  useEffect(() => {
    setIsHovered(
      !disabled &&
        Boolean(fingerPos) &&
        isFingerOverElement(fingerPos, buttonRef.current, containerRef?.current),
    );
  }, [containerRef, disabled, fingerPos]);

  useEffect(() => {
    if (!isHovered) {
      hoverStartRef.current = null;
      firedRef.current = false;
      const timeoutId = window.setTimeout(() => {
        setCountdown(null);
        onCountdownChange?.(null);
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
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
      onCountdownChange?.(remaining);

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
  }, [isHovered, onChoose, onCountdownChange]);

  return (
    <button
      {...buttonProps}
      ref={buttonRef}
      type={type}
      className={className}
      disabled={disabled}
      onClick={onChoose}
      data-countdown={countdown !== null ? countdown : undefined}
      aria-label={ariaLabel}
      style={style}
    >
      {children}
    </button>
  );
}

export function HoverChoiceButton({
  ariaLabel,
  className = "",
  disabled = false,
  fingerPos,
  hint = "Hold 3s",
  label,
  onChoose,
  onCountdownChange,
  position,
}) {
  const [countdown, setCountdown] = useState(null);
  const firedRef = useRef(false);
  const hoverStartRef = useRef(null);
  const isHovered =
    !disabled &&
    Boolean(fingerPos) &&
    Math.hypot(fingerPos.x - position.x, fingerPos.y - position.y) <= 0.13;

  useEffect(() => {
    if (!isHovered) {
      hoverStartRef.current = null;
      firedRef.current = false;
      const timeoutId = window.setTimeout(() => {
        setCountdown(null);
        onCountdownChange?.(null);
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
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
      onCountdownChange?.(remaining);

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
  }, [isHovered, onChoose, onCountdownChange]);

  return (
    <button
      type="button"
      className={`landing-button ${className}`.trim()}
      disabled={disabled}
      onClick={onChoose}
      data-countdown={countdown !== null ? countdown : undefined}
      aria-label={ariaLabel ?? label}
    >
      <span className="landing-button-label">{label}</span>
      <span className="landing-button-hint">
        {isHovered && countdown !== null ? countdown || "✓" : hint}
      </span>
    </button>
  );
}

export function FingerCursor({ fingerPos, countdown }) {
  const isHovering = countdown !== null;
  const progress = isHovering ? ((HOLD_TO_SELECT_SECONDS - countdown) / HOLD_TO_SELECT_SECONDS) * RING_CIRCUMFERENCE : 0;

  return (
    <div
      className="hand-cursor"
      data-hovering={isHovering}
      style={{ "--cx": `${fingerPos.x * 100}%`, "--cy": `${fingerPos.y * 100}%` }}
    >
      {isHovering && (
        <svg className="cursor-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="cursor-ring-track" cx="50" cy="50" r="44" />
          <circle className="cursor-ring-fill" cx="50" cy="50" r="44" style={{ "--progress": progress }} />
        </svg>
      )}
    </div>
  );
}

export function PortalFingerCursor({
  containerRef,
  countdown,
  fingerPos,
  zIndex = 10000,
}) {
  const [viewportPoint, setViewportPoint] = useState(null);

  useEffect(() => {
    if (!fingerPos) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      const containerRect = containerRef?.current?.getBoundingClientRect();
      const width = containerRect?.width ?? window.innerWidth;
      const height = containerRect?.height ?? window.innerHeight;
      const left = containerRect?.left ?? 0;
      const top = containerRect?.top ?? 0;

      setViewportPoint({
        x: left + fingerPos.x * width,
        y: top + fingerPos.y * height,
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [containerRef, fingerPos]);

  if (!fingerPos || !viewportPoint || typeof document === "undefined") {
    return null;
  }

  const isHovering = countdown !== null;
  const progress = isHovering ? ((HOLD_TO_SELECT_SECONDS - countdown) / HOLD_TO_SELECT_SECONDS) * RING_CIRCUMFERENCE : 0;

  return createPortal(
    <div
      className="hand-cursor hand-cursor--portal"
      data-hovering={isHovering}
      style={{
        left: `${viewportPoint.x}px`,
        top: `${viewportPoint.y}px`,
        zIndex,
      }}
    >
      {isHovering && (
        <svg className="cursor-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle className="cursor-ring-track" cx="50" cy="50" r="44" />
          <circle className="cursor-ring-fill" cx="50" cy="50" r="44" style={{ "--progress": progress }} />
        </svg>
      )}
    </div>,
    document.body,
  );
}

function isFingerOverElement(fingerPos, element, container) {
  if (!fingerPos || !element) {
    return false;
  }

  const elementRect = element.getBoundingClientRect();
  const containerRect = container?.getBoundingClientRect();
  const pointX = (containerRect?.left ?? 0) + fingerPos.x * (containerRect?.width ?? window.innerWidth);
  const pointY = (containerRect?.top ?? 0) + fingerPos.y * (containerRect?.height ?? window.innerHeight);

  return (
    pointX >= elementRect.left &&
    pointX <= elementRect.right &&
    pointY >= elementRect.top &&
    pointY <= elementRect.bottom
  );
}
