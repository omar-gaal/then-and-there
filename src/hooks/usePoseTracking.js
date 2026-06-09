import { useEffect, useRef, useState } from "react";
import {
  POSE_VIDEO_CONSTRAINTS,
  clearCanvas,
  createPoseLandmarker,
  drawPose,
  getHipReading,
  resizeCanvasToVideo,
} from "../poseTracking";

const CALIBRATION_FRAMES = 30;
const JUMP_THRESHOLD_PX = 25;
const LANDING_THRESHOLD_PX = 12;
const JUMP_COOLDOWN_MS = 550;

const READY_POSE = {
  baselineY: null,
  calibrationProgress: 0,
  confidence: 0,
  hipCount: 0,
  hipY: null,
  isCalibrated: false,
  isJumping: false,
  jumpHeight: 0,
  label: "Ready to calibrate",
  mode: "idle",
};

export function usePoseTracking() {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const poseLandmarkerRef = useRef(null);
  const animationRef = useRef(0);
  const calibrationRef = useRef([]);
  const baselineRef = useRef(null);
  const smoothedHipRef = useRef(null);
  const jumpLatchedRef = useRef(false);
  const lastJumpRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const lastTrackingDebugRef = useRef(0);

  const [isRunning, setIsRunning] = useState(false);
  const [jumpCount, setJumpCount] = useState(0);
  const [tracking, setTracking] = useState(READY_POSE);

  function resetCalibration() {
    calibrationRef.current = [];
    baselineRef.current = null;
    smoothedHipRef.current = null;
    jumpLatchedRef.current = false;
    lastJumpRef.current = 0;
    setJumpCount(0);
  }

  function stopCamera() {
    cancelAnimationFrame(animationRef.current);
    clearCanvas(canvasRef.current);
    resetCalibration();
    lastVideoTimeRef.current = -1;
    setIsRunning(false);
    setTracking(READY_POSE);
  }

  function runFrameLoop() {
    const video = webcamRef.current?.video;
    const canvas = canvasRef.current;
    const landmarker = poseLandmarkerRef.current;

    if (!video || !canvas || !landmarker) {
      return;
    }

    resizeCanvasToVideo(canvas, video);

    if (hasNewVideoFrame(video, lastVideoTimeRef.current)) {
      lastVideoTimeRef.current = video.currentTime;
      const results = landmarker.detectForVideo(video, performance.now());
      const landmarks = results.landmarks?.[0];

      if (landmarks) {
        drawPose(canvas, landmarks);
        processHipReading(getHipReading(landmarks, video.videoHeight || 720));
      } else {
        clearCanvas(canvas);
        setTracking((current) => ({
          ...current,
          confidence: 0,
          label: "Step into view",
          mode: "searching",
        }));
      }
    }

    animationRef.current = requestAnimationFrame(runFrameLoop);
  }

  function processHipReading(reading) {
    if (!reading) {
      setTracking((current) => ({
        ...current,
        confidence: 0,
        label: "Keep hips visible",
        mode: "searching",
      }));
      return;
    }

    const previousHip = smoothedHipRef.current ?? reading.y;
    const hipY = previousHip + (reading.y - previousHip) * 0.3;
    smoothedHipRef.current = hipY;

    if (baselineRef.current === null) {
      calibrationRef.current.push(hipY);
      const progress = calibrationRef.current.length / CALIBRATION_FRAMES;

      if (calibrationRef.current.length >= CALIBRATION_FRAMES) {
        baselineRef.current = average(calibrationRef.current);
        console.log("[PoseDebug] Calibration complete", { baselineY: baselineRef.current, hipCount: reading.hipCount });
      }

      setTracking({
        ...READY_POSE,
        baselineY: baselineRef.current,
        calibrationProgress: Math.min(progress, 1),
        confidence: reading.confidence,
        hipCount: reading.hipCount,
        hipY,
        isCalibrated: baselineRef.current !== null,
        label:
          baselineRef.current === null
            ? "Stand still to calibrate"
            : "Ready to jump",
        mode: baselineRef.current === null ? "calibrating" : "tracking",
      });
      return;
    }

    let jumpHeight = Math.max(0, baselineRef.current - hipY);

    if (!jumpLatchedRef.current && jumpHeight < LANDING_THRESHOLD_PX) {
      baselineRef.current += (hipY - baselineRef.current) * 0.025;
      jumpHeight = Math.max(0, baselineRef.current - hipY);
    }
    const now = performance.now();

    if (now - lastTrackingDebugRef.current >= 1000) {
      lastTrackingDebugRef.current = now;
      console.log("[PoseDebug] Jump calculation", { baselineY: baselineRef.current, hipCount: reading.hipCount, hipY, jumpHeight, jumpLatched: jumpLatchedRef.current, landingThreshold: LANDING_THRESHOLD_PX, jumpThreshold: JUMP_THRESHOLD_PX });
    }

    if (
      !jumpLatchedRef.current &&
      jumpHeight >= JUMP_THRESHOLD_PX &&
      now - lastJumpRef.current >= JUMP_COOLDOWN_MS
    ) {
      jumpLatchedRef.current = true;
      lastJumpRef.current = now;
      console.log("[PoseDebug] JUMP TRIGGERED", { hipY, jumpHeight, threshold: JUMP_THRESHOLD_PX });
      setJumpCount((count) => count + 1);
    } else if (jumpLatchedRef.current && jumpHeight <= LANDING_THRESHOLD_PX) {
      jumpLatchedRef.current = false;
      console.log("[PoseDebug] Landing detected", { hipY, jumpHeight });
    }

    setTracking({
      baselineY: baselineRef.current,
      calibrationProgress: 1,
      confidence: reading.confidence,
      hipCount: reading.hipCount,
      hipY,
      isCalibrated: true,
      isJumping: jumpLatchedRef.current,
      jumpHeight,
      label: jumpLatchedRef.current ? "Jump detected" : "Ready to jump",
      mode: "tracking",
    });
  }

  async function startCamera() {
    if (isRunning || tracking.mode === "loading") {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setTracking({
        ...READY_POSE,
        label: "Camera unavailable",
        mode: "error",
      });
      return;
    }

    setTracking({
      ...READY_POSE,
      label: "Loading pose model",
      mode: "loading",
    });

    try {
      if (!poseLandmarkerRef.current) {
        poseLandmarkerRef.current = await createPoseLandmarker();
      }
      resetCalibration();
      setIsRunning(true);
      setTracking({
        ...READY_POSE,
        label: "Step into view",
        mode: "searching",
      });
    } catch (error) {
      console.error(error);
      stopCamera();
      setTracking({
        ...READY_POSE,
        label: "Pose tracking failed",
        mode: "error",
      });
    }
  }

  function handleCameraReady() {
    cancelAnimationFrame(animationRef.current);
    runFrameLoop();
  }

  function handleCameraError(error) {
    console.error(error);
    stopCamera();
    setTracking({ ...READY_POSE, label: "Camera blocked", mode: "error" });
  }

  useEffect(
    () => () => {
      cancelAnimationFrame(animationRef.current);
      poseLandmarkerRef.current?.close();
    },
    [],
  );

  return {
    canvasRef,
    handleCameraError,
    handleCameraReady,
    isLoading: tracking.mode === "loading",
    isRunning,
    jumpCount,
    startCamera,
    stopCamera,
    tracking,
    videoConstraints: POSE_VIDEO_CONSTRAINTS,
    webcamRef,
  };
}

function hasNewVideoFrame(video, lastVideoTime) {
  return (
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    video.videoWidth > 0 &&
    video.currentTime !== lastVideoTime
  );
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
