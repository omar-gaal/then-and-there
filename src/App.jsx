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
        <AmsterdamExperience onChooseAnotherGame={() => setScreen("landing")} />
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
