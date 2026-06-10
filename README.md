# THEN & THERE

**THEN & THERE** is an interactive cultural installation for museum and exhibition spaces. Visitors travel through Paris, Amsterdam, and Copenhagen by using their hands and bodies as the controller.

The project combines gesture-based play with cultural learning. After completing each city challenge, the visitor receives a cultural fact about that city.

something

## Current Prototype

The current version integrates the webcam hand-tracking starter with a playable Paris pastry-catching prototype. It already provides:

- Browser webcam access
- Real-time MediaPipe hand landmark detection
- Index-finger position tracking
- Pinch, open-hand, and pointing-up gesture detection
- A pastry basket that follows the visitor's hand
- Falling pastry targets with collision detection
- A timed round with score, streaks, misses, and replay
- A control panel showing live tracking data

This playable prototype is the technical foundation for the Paris experience and future gesture-controlled interactions.

## Planned Experience

The visitor journey is:

1. Choose a city.
2. View a short atmospheric introduction.
3. Complete a gesture-controlled city challenge.
4. Receive a score and cultural fact.
5. Unlock the next city.
6. Complete all three cities and view the full journey.

### Paris

Catch falling pastries by moving your hands.

- Tracking: MediaPipe hand tracking
- Game logic: Hand position and collision detection
- Visuals: Parisian street or rooftop

### Amsterdam

Jump over rows of tulips using full-body movement.

- Tracking: MediaPipe pose tracking
- Game logic: Detect vertical body movement and trigger jumps
- Visuals: Dutch canal and tulip fields

### Copenhagen

Build a bicycle with hand gestures or ride it by alternating knee movements.

- Tracking: Hand or pose tracking
- Game logic: Drag-and-drop bike parts or detect pedalling
- Visuals: Copenhagen city streets

## Tech Stack

- **React** for components, screens, and application state
- **Vite** for the development server and production builds
- **MediaPipe Tasks Vision** for real-time hand tracking
- **react-webcam** for browser camera access
- **HTML Canvas** for landmarks and game visuals
- **CSS** for the current interface and responsive layout

Planned additions include pose tracking, routing, screen transitions, and city-specific game modules.

## Getting Started

You need Node.js and a browser with webcam support.

Install the dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local address printed in the terminal, usually:

```text
http://localhost:5173/
```

Click **Start camera**, allow camera permission, and hold one hand in front of the webcam.

Webcam access works on `localhost`. Do not open `index.html` directly.

## Available Commands

```bash
npm run dev       # Start the development server
npm run build     # Create a production build
npm run preview   # Preview the production build
npm run lint      # Check the code with ESLint
```

## Project Structure

```text
src/
  App.jsx                         Main prototype screen
  components/
    TrackingStage.jsx             Webcam, landmark canvas, and controlled basket
    ControlPanel.jsx              Live gesture and confidence information
    StatusPill.jsx                Current tracking status
  hooks/
    useHandTracking.js            Camera and frame-tracking loop
  gestures.js                     Gesture rules and basket movement
  handTracking.js                 MediaPipe setup and drawing helpers
  App.css                         Component styles
  index.css                       Global styles
  main.jsx                        React entry point
public/
  hand-landmarks.svg              Hand landmark reference
  screenshots/                    Tracking examples
```

## How Hand Tracking Works

1. `react-webcam` provides a live video frame.
2. MediaPipe detects 21 landmarks on the visitor's hand.
3. `useHandTracking` processes new webcam frames.
4. `getHandGesture` converts landmarks into useful gesture values.
5. React and Canvas display the result.

The most useful output for the Paris game is `gesture.indexTip`, which contains normalized `x` and `y` coordinates. These coordinates can be used for collision detection with falling pastries.

## Development Priorities

1. Keep the integrated hand-tracking and pastry-catching prototype working reliably.
2. Replace placeholder pastries with final Paris artwork and tune difficulty.
3. Add reusable score, timer, and completion logic.
4. Add pose tracking for Amsterdam and Copenhagen.
5. Build the complete screen flow and connect all city experiences.
6. Add final visuals, animations, cultural facts, and polish.

## Team Responsibilities

- **Paris developer:** Pastry-catching game, collisions, and scoring
- **Amsterdam and Copenhagen developer:** Tulip-jumping and bicycle games
- **Camera and tracking lead:** Reusable hand and pose tracking
- **Design lead:** Visual identity, city assets, screens, and animations
- **Integration, UX, and documentation lead:** Navigation, full experience flow, repository, and documentation

## Working With Git

Create a separate branch for each feature and avoid committing directly to `main`.

Example:

```bash
git switch -c feature/paris-game
git add .
git commit -m "Build Paris pastry catching prototype"
```

Keep commits small and clearly named so the team can review and combine work more easily.

## Troubleshooting

### Camera does not start

- Allow camera access in the browser.
- Confirm no other application is using the camera.
- Use the localhost URL from `npm run dev`.
- Try Chrome or another modern browser.

### Hand is not detected

- Keep the full hand visible.
- Use good lighting and a simple background.
- Move slightly farther away from the webcam.

### MediaPipe model does not load

The current prototype downloads MediaPipe files and the hand model from external URLs. Confirm that the computer has an internet connection, then refresh the page.
hello world

hi.
