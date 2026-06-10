# Lottie Preview

A local Lottie animation preview tool for checking JSON, ZIP exports, and asset folders in the browser.

Live site: https://fandandaodaodan.github.io/lottie-preview

## Features

- Preview Lottie JSON animations locally.
- Drag and drop `.json`, `.zip`, or exported folders with image assets.
- Automatically patches local image references for preview.
- Shows frame count, duration, frame time, asset count, and playback state.
- Playback controls: play, pause, replay, scrub timeline, speed, loop, and autoplay.
- Asset diagnostics for unused uploaded images, unused declared assets, and missing references.

## Tech Stack

- React
- TypeScript
- Rspack
- lottie-react
- react-dropzone
- JSZip

## Getting Started

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## Scripts

Build for production:

```bash
npm run build
```

The production output is written to `dist/`.
