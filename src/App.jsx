import { useState } from "react";
import { AmsterdamExperience } from "./components/AmsterdamExperience";
import { CopenhagenExperience } from "./components/CopenhagenExperience";
import { LandingExperience } from "./components/LandingExperience";
import { ParisExperience } from "./components/ParisExperience";
import "./App.css";

function App() {
  const [screen, setScreen] = useState("landing");

  if (screen === "paris") {
    return (
      <main className="app-shell">
        <ParisExperience onBackToMap={() => setScreen("landing")} />
      </main>
    );
  }

  if (screen === "amsterdam") {
    return (
      <main className="app-shell">
        <AmsterdamExperience onBackToMap={() => setScreen("landing")} />
      </main>
    );
  }

  if (screen === "copenhagen") {
    return (
      <main className="app-shell">
        <CopenhagenExperience onBackToCities={() => setScreen("landing")} />
      </main>
    );
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

export default App;
