# Saudade

An immersive 3D interactive experience with spatial audio, built with Three.js and Gaussian Splatting.

## Features

- 3D Gaussian Splatting scene rendering with LOD support
- Spatial audio system with proximity-triggered non-looping sounds
- First-person controls (WASD + mouse)
- WebXR support (tested on Quest3)
- JSON-based audio configuration for easy editing
- Configurable audio falloff, volume, and trigger radii

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Download assets

For local development, download and extract the assets:

```bash
# Download the assets zip file
curl -O https://storage.googleapis.com/forge-dev-public/hosted-experiences/memory-house/assets.zip
# Unpack into the assets/ directory
unzip assets.zip -d ./
```

Alternatively, you can manually download from:
https://storage.googleapis.com/forge-dev-public/hosted-experiences/memory-house/assets.zip

The assets directory should contain:
- `assets/audio/` - All audio files
- `assets/audio-config.json` - Audio configuration
- `assets/memory-house-lod.spz` - Gaussian splat scene file

### 3. Configure local development mode

In `index.html`, set `localDev = true` to use local assets:

```javascript
// Set to true for local development, false for production (loads from CDN)
const localDev = true;
```

## Development

Start the development server:

```bash
npm run dev
```

This will start a local server at http://localhost:3000 and automatically open your browser.

## Build

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Audio Configuration

Audio sources are configured in `assets/audio-config.json`. Each audio source supports:

```json
{
  "audio_url": "assets/audio/your-sound.mp3",
  "audio_position": [x, y, z],
  "falloff": {
    "refDistance": 5,       // Distance at which volume starts to decrease
    "rolloffFactor": 10,    // How quickly sound fades (higher = faster)
    "maxDistance": 10,      // Maximum distance sound can be heard
    "loop": true,           // Whether audio loops continuously
    "volume": 0.5           // Volume level (0.0 to 1.0)
  },
  "triggerRadius": 3        // Optional: For non-looping audio, trigger when within this radius
}
```

### Audio Types

**Looping Audio**: Starts playing immediately when audio is enabled and loops continuously.

**Non-looping Audio with Proximity Triggers**: Only plays once when the camera enters the specified `triggerRadius`. Perfect for one-time sound effects, dialogue, or location-based audio cues.

## Controls

- **WASD**: Move camera
- **Mouse**: Look around (click and drag)
- **Audio Button** (top-left): Toggle spatial audio on/off

## Local Development vs Production

The project supports two modes controlled by the `localDev` flag in `index.html`:

- **Local Development** (`localDev = true`): Assets loaded from `./assets/`
- **Production** (`localDev = false`): Assets loaded from Google Cloud Storage CDN

This allows for easy local testing and debugging without uploading assets.

## Technologies

- [Three.js](https://threejs.org/) - 3D graphics library
- [Spark](https://github.com/sparkjsdev/spark) - Gaussian Splatting renderer with LOD support
- [Vite](https://vitejs.dev/) - Development server and build tool
- [lil-gui](https://lil-gui.georgealways.com/) - Debug UI controls

