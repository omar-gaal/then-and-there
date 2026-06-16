# Bike Hunt - Professional Game Brief

## Vision

Bike Hunt is not a small technical demo. It is a modern webcam-controlled 3D game where the player explores a colorful European city, finds hidden bicycle parts, and assembles a complete city bike. The game should feel like a real interactive experience: clear goal, expressive movement, readable feedback, lively environment, and modular architecture for future cities and bike types.

## Target Experience

The player stands in front of a webcam. Pose tracking reads the body position and hand tracking reads the reaching hand. Body movement moves a third-person avatar through the street. Reaching toward a nearby part collects it automatically. After every part has been found, the game enters a workshop phase where the player assembles the bike in the correct order.

## Screen And Camera

The game is designed for desktop in a 16:9 experience. The street view must be wide enough to show the road, both sidewalks, buildings, trees, cars, props, the player avatar, and collectible hints. The camera uses a third-person perspective positioned behind and above the player. It should follow smoothly, never snap, and keep enough city context visible so the player feels they are walking through a place rather than standing in a small test scene.

Camera target:

- distance behind player: roughly 4-6 meters
- height: roughly 2-3 meters
- smooth follow for position and look target
- slight lateral follow when the body moves left or right
- no tight crop on the avatar or street

## City Design

The city should feel clean, colorful, and alive, inspired by a modern European street. It should not be dark, empty, or post-apocalyptic. It should not look like a few cubes on a road.

Required city elements:

- long road with visible depth
- wide sidewalks on both sides
- varied buildings, shops, cafes, and window lights
- benches, lamps, signs, planters, flowers, trees, and bins
- parked and moving cars
- animated ambient motion such as swaying trees, pedestrians, birds, and subtle lighting

Future versions should support multiple connected streets and small city districts rather than one static street.

## Tracking Controls

The game uses camera input as the main control method.

Pose tracking should detect:

- head
- shoulders
- elbows
- wrists
- hands
- torso
- hips
- full body when available

Body movement mapping:

- step forward: avatar walks forward and camera follows
- step backward: avatar slows or moves backward
- step left: avatar moves left
- step right: avatar moves right

Tracking data must be filtered to avoid jitter. Raw landmark movement should never be applied directly to the 3D avatar without smoothing.

Hand tracking should detect reaching. When a virtual hand overlaps a nearby bicycle part, the part is collected automatically. The player should not need keyboard or mouse input during the main experience.

## Bicycle Parts

Parts must look like actual bicycle components, not colored boxes.

Required parts:

- frame
- front wheel
- back wheel
- saddle
- handlebar
- chain
- pedals
- crank
- brakes
- bell
- basket

Each part appears once. Parts should be hidden naturally in the street:

- behind a bench
- beside a tree
- near a planter
- beside a parked car
- near a shop window
- next to a lamp
- under or near street furniture

Faraway parts should not glow. Nearby parts should gain a subtle highlight. Very close parts should show a label and collection prompt.

## Collection Feedback

When collected, a part should:

- shrink or pop
- fly toward the inventory
- disappear from the world
- play a short sound
- mark itself as found in the inventory
- update completion percentage

## UI

Top HUD:

- score
- time
- found parts count

Left objective panel:

- current target
- simple instruction

Right inventory panel:

- part icon or checkmark
- part name
- completion percentage

The UI should support Czech first, with a path toward English localization later.

## Workshop Phase

After all parts are collected, the game transitions to a workshop. The player sees an assembly table with the bike blueprint or partially built bike. The collected parts sit nearby. The player places parts in the correct order using hand movement.

Correct placement:

- part snaps into position
- confirmation appears
- short animation plays

Incorrect placement:

- part returns to tray
- the game shows the next expected part

Completion:

- final bike appears fully assembled
- camera slowly orbits the bike
- congratulation message appears
- player can restart, choose another map, or choose another bike type

## Architecture

The project should stay modular:

- tracking logic isolated from game rules
- game state isolated from rendering
- 3D city scene isolated from UI
- bicycle part definitions stored in data structures
- future city and bike variants should be data-driven
- localization should be prepared through labels, not hard-coded text scattered everywhere

Recommended future structure:

```text
src/
  data/
    bikeParts.js
    cities.js
  tracking/
    handTracking.js
    poseTracking.js
    motionMapping.js
  hooks/
    useBikeGame.js
    useHandTracking.js
    usePlayerMotion.js
  components/
    ThreeStreetScene.jsx
    WorkshopScene.jsx
    ControlPanel.jsx
    TrackingStage.jsx
```

## Iteration Plan

1. Stabilize hand and pose tracking.
2. Improve third-person movement and camera follow.
3. Replace procedural parts with higher-quality modeled parts.
4. Add hidden placement logic tied to street props.
5. Add collection animation and sound.
6. Build a richer workshop scene.
7. Add city ambience: moving cars, pedestrians, birds, day/night lighting.
8. Add multiple streets or districts.
9. Add localization and difficulty options.
10. Add additional bikes and cities.
