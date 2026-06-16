# Project Structure

This project is a cozy Copenhagen bike-part collection game. The current app combines webcam body tracking, keyboard fallback controls, a Three.js street scene, pickup feedback, a progress panel, and a paper-style map.

## Main App

### `src/App.jsx`

Main application state and layout. It connects webcam tracking, the Three.js scene, map UI, debug UI, pickup feedback, and the progress panel.

Edit this file when wiring top-level UI together or adding small app-level state. Avoid putting new scene logic here.

## Components

### `src/components/ThreeStreetScene.jsx`

Current main 3D scene controller. It creates and updates the Three.js world, avatar, street geometry, bike part meshes, movement, camera follow, pickup handling, pickup animation, and map data publishing.

This file is sensitive. Do not edit casually, especially movement, pose mapping, pickup, or heading/area transitions.

### `src/components/TownMap.jsx`

Paper map overlay. It renders the current town areas, player marker, bike part markers, collected state, legend, and map progress text.

Edit this file for map layout markup or map label/icon display.

### `src/components/CollectionPanel.jsx`

Right-side bike part progress panel. It renders collected count, remaining count, and the part checklist.

Edit this file for progress panel text or checklist presentation.

### `src/components/DebugPanel.jsx`

On-screen debug/status UI. It shows tracking, movement, keyboard, map gesture, and pickup debug values.

Edit this file for debug text only. It should not change game behavior.

## Game Data

### `src/game/bikeParts.js`

Static bike part definitions: part ids, labels, kind, area, and world positions.

Edit this file to add, remove, rename, or move bike parts in the world. Be careful: changing positions affects pickup and map expectations.

### `src/game/mapMarkers.js`

Manual paper-map marker positions for bike parts.

Edit this file when bike part markers need to move on the map. This does not move the actual 3D bike part.

### `src/game/townAreas.js`

Static town area data for Main Street and Left Street, plus labels used by the map and debug UI.

Edit this file for area labels, descriptions, or map area marker positions.

## Hooks

### `src/hooks/useHandTracking.js`

Reusable React hook for webcam/MediaPipe tracking. It starts the camera, runs hand and pose detection, draws tracking overlays, and publishes motion/debug data.

This is sensitive. Do not change MediaPipe setup, pose landmark interpretation, or body movement detection casually.

### `src/hooks/useMapGestureToggle.js`

Both-hands-raised map toggle hook. It detects the gesture, applies hold debounce and cooldown, and returns debug values for the debug panel.

Edit this file for map gesture timing or gesture thresholds.

## Scene

### `src/scene/constants.js`

Shared Three.js scene constants: street dimensions, heading values, movement speeds, pose constants, map projection constants, and simple color values.

Edit this file for tuning numbers only when you understand the system that uses them.

## Common Edits

### Map Changes

Use:

- `src/components/TownMap.jsx` for map markup, labels, icons, and legend.
- `src/game/mapMarkers.js` for bike part marker positions.
- `src/game/townAreas.js` for area labels and area marker positions.

### Bike Part Changes

Use:

- `src/game/bikeParts.js` for actual part ids, labels, areas, and world positions.
- `src/game/mapMarkers.js` for paper-map marker positions.
- `src/components/ThreeStreetScene.jsx` only if a new part needs a new mesh shape.

### Movement Tuning

Use:

- `src/scene/constants.js` for keyboard and MediaPipe speed/smoothing constants.
- `src/components/ThreeStreetScene.jsx` only for movement logic changes.

Movement logic is sensitive because it affects keyboard fallback, webcam movement, camera follow, and area switching.

### Avatar Pose Tuning

Use:

- `src/scene/constants.js` for pose scalar constants.
- `src/components/ThreeStreetScene.jsx` for pose mapping and avatar limb behavior.
- `src/hooks/useHandTracking.js` only if the source pose landmarks or motion detection need to change.

Pose mirroring is sensitive and should not be changed casually.

### Pickup Tuning

Use:

- `src/components/ThreeStreetScene.jsx` for pickup detection and pickup animation.

Pickup logic is sensitive because it updates part collection, feedback, backpack animation, map markers, and progress.

## Sensitive Areas

Avoid casual edits to:

- MediaPipe setup and detection lifecycle in `src/hooks/useHandTracking.js`.
- Pose mirroring and avatar landmark mapping in `src/components/ThreeStreetScene.jsx`.
- Movement, heading, camera follow, and area transition logic in `src/components/ThreeStreetScene.jsx`.
- Pickup detection and pickup animation in `src/components/ThreeStreetScene.jsx`.
- Progress state flow between `ThreeStreetScene`, `App.jsx`, and `CollectionPanel`.

For safe changes, prefer editing data files and UI components before touching the main scene controller.
