import { useEffect, useState } from "react";
import Webcam from "react-webcam";
import { AmsterdamExperience } from "./components/AmsterdamExperience";
import { CopenhagenExperience } from "./components/CopenhagenExperience";
import { LandingExperience } from "./components/LandingExperience";
import { ParisExperience } from "./components/ParisExperience";
import { useHandHover } from "./hooks/useHandHover";
import { VIDEO_CONSTRAINTS } from "./handTracking";
import "./App.css";

function App() {
  const [screen, setScreen] = useState("landing");

  if (screen === "paris") {
    return (
      <>
        <div className="city-bg paris-bg" />
        <main className="app-shell">
          <ParisExperience onBackToMap={() => setScreen("landing")} />
        </main>
      </>
    );
  }

  if (screen === "amsterdam") {
    return (
      <>
        <div className="city-bg amsterdam-bg" />
        <main className="app-shell">
          <AmsterdamExperience onBackToMap={() => setScreen("landing")} />
        </main>
      </>
    );
  }

  if (screen === "copenhagen") {
    return <CopenhagenScreen onBackToCities={() => setScreen("landing")} />;
  }

  return (
    <main className="app-shell landing-shell">
      <LandingExperience
        onChooseAmsterdam={() => setScreen("amsterdam")}
        onChooseCopenhagen={() => setScreen("copenhagen")}
        onChooseParis={() => setScreen("paris")}
      />
    </main>
  );
}

function CopenhagenScreen({ onBackToCities }) {
  const {
    canvasRef: sharedHandCanvasRef,
    handleCameraReady: handleSharedHandCameraReady,
    indexTip: sharedIndexTip,
    resume: resumeSharedHandTracking,
    stop: stopSharedHandTracking,
    webcamRef: sharedHandWebcamRef,
  } = useHandHover();

  useEffect(() => {
    resumeSharedHandTracking();

    return () => {
      stopSharedHandTracking();
    };
  }, [resumeSharedHandTracking, stopSharedHandTracking]);

  return (
    <>
      <div className="shared-hand-tracking-source" aria-hidden="true">
        <Webcam
          ref={sharedHandWebcamRef}
          audio={false}
          className="shared-hand-webcam"
          onUserMedia={handleSharedHandCameraReady}
          playsInline
          videoConstraints={VIDEO_CONSTRAINTS}
        />
        <canvas ref={sharedHandCanvasRef} className="shared-hand-canvas" />
      </div>
      <main className="app-shell">
        <CopenhagenExperience
          indexTip={sharedIndexTip}
          onBackToCities={onBackToCities}
        />
      </main>
    </>
  );
}

export default App;
