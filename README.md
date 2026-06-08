# Then & There

An interactive, gesture-controlled cultural installation built with React, MediaPipe and HTML Canvas.

## Getting started

```bash
npm install
npm run dev
```

## Useful commands

```bash
npm run dev
npm run build
npm run lint
npm run test
```

## Source structure

- `src/features/tracking` — reusable MediaPipe hand and pose tracking
- `src/games/paris` — pastry catching game
- `src/games/amsterdam` — tulip jumping game
- `src/games/copenhagen` — bicycle game
- `src/pages` — installation screens and navigation
- `src/components` — shared interface components

Start with `/tracking-test` to validate camera and landmark tracking before connecting tracking data to the city games.
