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
const JUMP_COOLDOWN_MS = 550;
// Threshold as % of shoulder-to-hip distance so it works at any camera distance
const JUMP_RATIO = 0.18;
const LANDING_RATIO = 0.07;
const FALLBACK_JUMP_PX = 14; // used if shoulders not visible during calibration

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
  const bodyScaleReadingsRef = useRef([]);
  const bodyScaleRef = useRef(null); // shoulder-to-hip px distance, set after calibration
  const baselineRef = useRef(null);
  const smoothedHipRef = useRef(null);
  const jumpLatchedRef = useRef(false);
  const lastJumpRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);

  const [isRunning, setIsRunning] = useState(false);
  const [jumpCount, setJumpCount] = useState(0);
  const [tracking, setTracking] = useState(READY_POSE);

  function resetCalibration() {
    calibrationRef.current = [];
    bodyScaleReadingsRef.current = [];
    bodyScaleRef.current = null;
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

    if (!video || !canvas || !landmarker) return;

    resizeCanvasToVideo(canvas, video);

    if (
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
      video.videoWidth > 0 &&
      video.currentTime !== lastVideoTimeRef.current
    ) {
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
          label: "Step into view , full body visible",
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
        label: "Show both hips to camera",
        mode: "searching",
      }));
      return;
    }

    const previousHip = smoothedHipRef.current ?? reading.y;
    const hipY = previousHip + (reading.y - previousHip) * 0.5;
    smoothedHipRef.current = hipY;

    // Calibration phase
    if (baselineRef.current === null) {
      const runningAvg =
        calibrationRef.current.length > 0
          ? calibrationRef.current.reduce((s, v) => s + v, 0) / calibrationRef.current.length
          : hipY;

      if (Math.abs(hipY - runningAvg) > 30) {
        calibrationRef.current = [];
        setTracking({
          ...READY_POSE,
          confidence: reading.confidence,
          hipCount: reading.hipCount,
          hipY,
          label: "Stand still to calibrate",
          mode: "calibrating",
        });
        return;
      }

      calibrationRef.current.push(hipY);

      // Track shoulder-to-hip distance to set an adaptive jump threshold
      if (reading.shoulderY !== null) {
        const scale = hipY - reading.shoulderY; // positive: hips are below shoulders
        if (scale > 10) bodyScaleReadingsRef.current.push(scale);
      }

      const progress = calibrationRef.current.length / CALIBRATION_FRAMES;

      if (calibrationRef.current.length >= CALIBRATION_FRAMES) {
        baselineRef.current =
          calibrationRef.current.reduce((s, v) => s + v, 0) / calibrationRef.current.length;
        if (bodyScaleReadingsRef.current.length > 0) {
          bodyScaleRef.current =
            bodyScaleReadingsRef.current.reduce((s, v) => s + v, 0) / bodyScaleReadingsRef.current.length;
          console.log('[PoseDebug] Body scale calibrated', { bodyScalePx: bodyScaleRef.current, jumpThresholdPx: bodyScaleRef.current * JUMP_RATIO });
        }
      }

      setTracking({
        ...READY_POSE,
        baselineY: baselineRef.current,
        calibrationProgress: Math.min(progress, 1),
        confidence: reading.confidence,
        hipCount: reading.hipCount,
        hipY,
        isCalibrated: baselineRef.current !== null,
        label: baselineRef.current === null ? "Stand still to calibrate" : "Ready to jump",
        mode: baselineRef.current === null ? "calibrating" : "tracking",
      });
      return;
    }

    // Jump detection phase , thresholds adapt to how far user stands from camera
    const jumpThreshold = bodyScaleRef.current
      ? Math.max(10, bodyScaleRef.current * JUMP_RATIO)
      : FALLBACK_JUMP_PX;
    const landingThreshold = bodyScaleRef.current
      ? Math.max(5, bodyScaleRef.current * LANDING_RATIO)
      : FALLBACK_JUMP_PX * 0.5;

    let jumpHeight = Math.max(0, baselineRef.current - hipY);

    if (!jumpLatchedRef.current && jumpHeight < landingThreshold) {
      baselineRef.current += (hipY - baselineRef.current) * 0.015;
      jumpHeight = Math.max(0, baselineRef.current - hipY);
    }

    const now = performance.now();

    if (
      !jumpLatchedRef.current &&
      jumpHeight >= jumpThreshold &&
      now - lastJumpRef.current >= JUMP_COOLDOWN_MS
    ) {
      jumpLatchedRef.current = true;
      lastJumpRef.current = now;
      console.log('[PoseDebug] JUMP', { jumpHeight, jumpThreshold, bodyScale: bodyScaleRef.current });
      setJumpCount((count) => count + 1);
    } else if (jumpLatchedRef.current && jumpHeight <= landingThreshold) {
      jumpLatchedRef.current = false;
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
      jumpThreshold,
      label: jumpLatchedRef.current ? "Jump detected!" : "Ready to jump",
      mode: "tracking",
    });
  }

  async function startCamera() {
    if (isRunning || tracking.mode === "loading") return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setTracking({ ...READY_POSE, label: "Camera unavailable", mode: "error" });
      return;
    }

    setTracking({ ...READY_POSE, label: "Loading pose model…", mode: "loading" });

    try {
      if (!poseLandmarkerRef.current) {
        poseLandmarkerRef.current = await createPoseLandmarker();
      }
      resetCalibration();
      setIsRunning(true);
      setTracking({ ...READY_POSE, label: "Step into view", mode: "searching" });
    } catch (error) {
      console.error(error);
      setTracking({ ...READY_POSE, label: "Pose tracking failed", mode: "error" });
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
