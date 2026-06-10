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
- Create React App
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

Run tests:

```bash
npm test -- --watchAll=false
```

Build for production:

```bash
npm run build
```

## Deployment

This project deploys to GitHub Pages through GitHub Actions.

The workflow is defined in:

```text
.github/workflows/deploy.yml
```

The production path is configured with:

```json
"homepage": "https://fandandaodaodan.github.io/lottie-preview"
```

After pushing to `master`, GitHub Actions builds the app and deploys the `build` output to GitHub Pages.
