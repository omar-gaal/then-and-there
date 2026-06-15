import { useEffect, useRef, useState } from "react";
import { ControlPanel } from "./components/ControlPanel";
import { StatusPill } from "./components/StatusPill";
import { TrackingStage } from "./components/TrackingStage";
import { movePuckToPoint } from "./gestures";
import { useCatchGame } from "./hooks/useCatchGame";
import { useHandTracking } from "./hooks/useHandTracking";
import globeLoader from "./assets/globe-svgrepo-com.svg";
import "./App.css";

function App() {
  const stageRef = useRef(null);
  const [isSplashVisible, setIsSplashVisible] = useState(true);
  const {
    canvasRef,
    handleCameraError,
    handleCameraReady,
    isLoading,
    isRunning,
    puckRef,
    startCamera,
    stopCamera,
    tracking,
    webcamRef,
  } = useHandTracking();
  const { game, startRound } = useCatchGame({ isRunning, puckRef, stageRef });

  useEffect(() => {
    const splashTimer = window.setTimeout(() => {
      setIsSplashVisible(false);
    }, 2200);

    return () => window.clearTimeout(splashTimer);
  }, []);

  function handlePointerAim(point) {
    movePuckToPoint({ ...point, scale: 1.02 }, puckRef.current);
  }

  if (isSplashVisible) {
    return (
      <main className="splash-screen" aria-label="Welcome screen">
        <div className="splash-card" role="status" aria-live="polite">
          <p className="splash-eyebrow">Then &amp; There</p>
          <h1>Then & There </h1>
          <p className="splash-copy">Gamifying Europe</p>
          <img
            className="splash-loader"
            src={globeLoader}
            alt=""
            aria-hidden="true"
          />
        </div>
import { useState } from "react";
import { AmsterdamExperience } from "./components/AmsterdamExperience";
import { LandingExperience } from "./components/LandingExperience";
import { ParisExperience } from "./components/ParisExperience";
import "./App.css";

function App() {
  const [screen, setScreen] = useState("landing");

  if (screen === "paris") {
    return (
      <main className="app-shell">
        <ParisExperience />
      </main>
    );
  }

  if (screen === "amsterdam") {
    return (
      <main className="app-shell">
        <AmsterdamExperience />
      </main>
    );
  }

  return (
    <main className="app-shell landing-shell">
      <LandingExperience
        onChooseAmsterdam={() => setScreen("amsterdam")}
        onChooseParis={() => setScreen("paris")}
      />
    </main>
  );
}

export default App;
