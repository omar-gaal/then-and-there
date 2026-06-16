# THEN & THERE

**THEN & THERE** is an interactive cultural installation for museum and exhibition spaces. Visitors travel through Paris, Amsterdam, and Copenhagen by using their hands and bodies as the controller.

The project combines gesture-based play with cultural learning. After completing each city challenge, the visitor receives a cultural fact about that city.

## Current Prototype

The current version integrates the webcam hand-tracking starter with a playable Copenhagen bicycle-building prototype. It already provides:

- Browser webcam access
- Real-time MediaPipe hand landmark detection
- Index-finger position tracking
- Pinch, open-hand, and pointing-up gesture detection
- A bike-parts magnet that follows the visitor's hand
- Bicycle parts scattered across the Copenhagen street scene
- Hand-controlled collection when the visitor reaches a part
- A timed search round with score, streaks, and replay
- A second assembly phase where collected parts are installed in the correct order
- A control panel showing live tracking data

This playable prototype is the technical foundation for the Copenhagen experience and future gesture-controlled interactions.

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

Build a bicycle by first finding scattered parts around a Copenhagen street, then assembling them in order.

- Tracking: MediaPipe hand tracking
- Game logic: Reach scattered bike parts with the tracked hand, then click/tap the collected parts in the assembly order
- Parts: frame, back wheel, front wheel, handlebar, bell
- Visuals: Copenhagen canal buildings, street, and cycle lane

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
    TrackingStage.jsx             Webcam, landmark canvas, street scene, and assembly table
    ControlPanel.jsx              Live gesture and confidence information
    StatusPill.jsx                Current tracking status
  hooks/
    useBikeGame.js                Copenhagen bike search and assembly game logic
    useHandTracking.js            Camera and frame-tracking loop
  gestures.js                     Gesture rules and hand-controlled magnet movement
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

The most useful output for the Copenhagen game is `gesture.indexTip`, which contains normalized `x` and `y` coordinates. These coordinates are used for collision detection with bike parts scattered around the street.

## Development Priorities

1. Keep the integrated hand-tracking and bicycle-building prototype working reliably.
2. Replace CSS placeholder parts with final Copenhagen artwork and tune difficulty.
3. Add reusable score, timer, and completion logic.
4. Add pose tracking for Amsterdam and optional Copenhagen pedalling interactions.
5. Build the complete screen flow and connect all city experiences.
6. Add final visuals, animations, cultural facts, and polish.

## Team Responsibilities

- **Paris developer:** Pastry-catching game, collisions, and scoring
- **Amsterdam and Copenhagen developer:** Tulip-jumping and bicycle-building games
- **Camera and tracking lead:** Reusable hand and pose tracking
- **Design lead:** Visual identity, city assets, screens, and animations
- **Integration, UX, and documentation lead:** Navigation, full experience flow, repository, and documentation

## Working With Git

Create a separate branch for each feature and avoid committing directly to `main`.

Example:

```bash
git switch -c feature/copenhagen-bike-game
git add .
git commit -m "Build Copenhagen bike game prototype"
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
