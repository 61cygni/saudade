import * as THREE from "three";
import { dyno, NewSparkRenderer, SplatMesh, SparkControls, VRButton, XrHands, SplatLoader, isMobile, SplatEdit, SplatEditRgbaBlendMode, SplatEditSdf, SplatEditSdfType } from "@sparkjsdev/spark";
import { GUI } from "lil-gui";
import { createFlickerModifier } from './flicker.js';
import { FloatingLightsManager } from './floating-lights.js';
import { EffectZoneManager, loadEffectsConfig } from './effect-zones.js';


// Flags for various effects - now zone-based
const enableEffectZones = true;

// Starting zone - set to a zone ID to start at that zone's center, or null/undefined for default position
const startZone = null; // e.g., "entrance-room", "living-room", "hallway-1", etc.
// const startZone = "forest-area"; 

lucide.createIcons();

// Global variables that need to be accessible across functions
let scene, camera, renderer, localFrame, spark, background;
let controls, animateT, cameraWorldPos, lastCameraPos;
let cameraInfo;
let xrHands = null;
let splatEdit = null;
const handSdfs = new Map();

// Effect zone system
let effectZoneManager = null;
let floatingLightsManager = null;
let flickerControls = null;  // Controls for dynamic flicker intensity

// Flicker intensity transition state
let targetFlickerIntensity = 0;
let currentFlickerIntensity = 0;
const FLICKER_FADE_SPEED = 2.0; // Units per second

// localDev is set in index.html BEFORE this script loads (ES6 imports are hoisted)
// Set to true for local development (loads assets from ./assets/)
// Set to false for production (loads assets from Tigris CDN)
// 
// For local development:
// 1. Download assets: https://storage.googleapis.com/forge-dev-public/artistsjourney/assets.zip
// 2. Unpack the zip file into the project root (creates ./assets/ directory)
// 3. Set window.localDev = true in index.html
const localDev = window.localDev || false;

function getAssetUrl(path) {
  if (localDev) {
    return `/${path}`; // Use absolute path for Vite dev server (public/ is served at root)
  }
  // Large files (.spz) should be hosted on Tigris/CDN, not Netlify
  // Netlify's CDN is optimized for files < 10MB
  if (path.endsWith('.spz')) {
    // Extract just the filename from the path (e.g., "assets/memory-house-lod.spz" -> "memory-house-lod.spz")
    const filename = path.split('/').pop();
    return `https://public-spz.t3.storage.dev/${filename}`;
  }
  // Smaller assets can be served from Netlify
  return `/${path}`;
}

// Import audio module
import { 
  audioListener, 
  checkProximityTriggers,
  initializeAudio
} from './audio.js';

// Import progress module
import { showProgress, hideProgress, updateProgress, calculateUnknownProgress } from './progress.js';

// Make localDev and getAssetUrl available globally for modules
window.localDev = localDev;
window.getAssetUrl = getAssetUrl;

// Import debug console module
import './debug-console.js';

window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {
  if (camera && renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// Function to print bounding box centered on camera position
function printBoundingBox(size = { x: 6, y: 5, z: 6 }) {
  if (!camera) {
    console.warn('Camera not available');
    return;
  }
  
  // Get current camera world position
  const currentPos = new THREE.Vector3();
  camera.getWorldPosition(currentPos);
  
  // Calculate min and max centered on camera position
  const halfSize = {
    x: size.x / 2,
    y: size.y / 2,
    z: size.z / 2
  };
  
  const min = [
    (currentPos.x - halfSize.x).toFixed(1),
    (currentPos.y - halfSize.y).toFixed(1),
    (currentPos.z - halfSize.z).toFixed(1)
  ];
  
  const max = [
    (currentPos.x + halfSize.x).toFixed(1),
    (currentPos.y + halfSize.y).toFixed(1),
    (currentPos.z + halfSize.z).toFixed(1)
  ];
  
  console.log(`--- Bounding Box (centered on camera ${currentPos.x}, ${currentPos.y}, ${currentPos.z}) ---`);
  console.log(`"min": [${min[0]}, ${min[1]}, ${min[2]}],`);
  console.log(`"max": [${max[0]}, ${max[1]}, ${max[2]}]`);
  console.log('--- Copy the above lines to effects-config.json ---');
}

// Keyboard listener for zone visualization toggle and bounding box printer
window.addEventListener('keydown', (event) => {
  // Toggle zone visualization with 'z' key
  if (event.key === 'z' || event.key === 'Z') {
    if (effectZoneManager) {
      effectZoneManager.toggleVisualization();
    }
  }
  // Print bounding box with 'p' key
  if (event.key === 'p' || event.key === 'P') {
    printBoundingBox();
  }
}, false);


// Setup scene, camera, and renderer
scene = new THREE.Scene();
camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Expose renderer globally for debug console VR detection
window.renderer = renderer;

// Add audio listener to camera
camera.add(audioListener);

// Make a local frame of reference that we can move to control
// the camera, or as a frame of reference in WebXR mode
localFrame = new THREE.Group();
scene.add(localFrame);

// Lower the splat rendering width to sqrt(6) std devs for more performance
spark = new NewSparkRenderer({
renderer,
maxStdDev: Math.sqrt(6),
lodSplatScale: 1.0,
});
scene.add(spark);
localFrame.add(camera);

// Set starting position using localFrame (NOT camera.position)
// In WebXR, the headset controls camera.position directly, so we use localFrame
// to position the user in the scene. Camera stays at origin relative to localFrame.
// Default starting position (will be overridden if startZone is set)
localFrame.position.set(4.91, -0.12, -9.13);

// Initialize camera world position tracking (after camera is added to localFrame)
cameraWorldPos = new THREE.Vector3();
lastCameraPos = new THREE.Vector3();
// Use camera.position (local position relative to localFrame) for VR compatibility
lastCameraPos.copy(camera.position);

// Flag to prevent discontinuity detection on VR entry
let vrEntryFrameCount = 0;
const VR_ENTRY_GRACE_PERIOD = 10; // Ignore discontinuities for first 10 frames after VR entry

// Setup controls
controls = new SparkControls({ canvas: renderer.domElement });
controls.fpsMovement.xr = renderer.xr;
// controls.pointerControls.pointerRollScale = 0.0;
// controls.pointerControls.reverseRotate = isMobile();
controls.pointerControls.rotateSpeed *= .5;
controls.pointerControls.slideSpeed *= .5;
// controls.fpsMovement.moveSpeed *= 0.2;

// Store the default slide speed for XR mode (default is 0.006)
const defaultSlideSpeed = 0.006;
// Disable sliding for mouse interactions when not in XR mode
// This prevents mouse drag from moving camera through space instead of rotating
controls.pointerControls.slideSpeed = 0;

// Camera position display
cameraInfo = {
position: "0.00, 0.00, 0.00"
};
if (localDev) {
//gui.add(cameraInfo, "position").name("Camera Position").listen();
}

// Initialize animateT before async operations (used in animation loop)
animateT = dyno.dynoFloat(0);

window.showDebugConsole();

window.debugLogHigh('log', "localDev:", localDev);

// Load splat file
const splatURL = getAssetUrl("assets/memory-house-lod.spz");
window.debugLogHigh('log', "splatURL:", splatURL);

const loader = new SplatLoader();
let totalBytes = null;
showProgress();

// Convert relative URL to absolute if needed
let absoluteSplatURL = splatURL;
if (splatURL.startsWith('/')) {
  absoluteSplatURL = `${window.location.origin}${splatURL}`;
}

const packedSplats = await loader.loadAsync(splatURL, (event) => {
  const loadedBytes = event.loaded || 0;
  const loadedMB = (loadedBytes / (1024 * 1024)).toFixed(2);
  
  if (event.lengthComputable && event.total) {
    totalBytes = event.total;
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
    const percent = ((event.loaded / event.total) * 100).toFixed(1);
    updateProgress(event.loaded / event.total, loadedBytes, totalBytes);
  } else {
    updateProgress(calculateUnknownProgress(loadedBytes), loadedBytes, totalBytes);
  }
}).catch(err => {
  window.debugLogHigh('error', 'Load failed:', err.message);
  console.error('Load failed:', err);
  throw err;
});

hideProgress();

background = new SplatMesh({ packedSplats, lod: true, nonLod: true });
background.position.set(0, 0, 0);
background.scale.setScalar(0.5);
// Make background editable so it can be affected by SDFs
background.editable = true;

// Apply flicker modifier to background splat mesh (always create, intensity controlled by zones)
if (enableEffectZones) {
  const flickerResult = createFlickerModifier(dyno, animateT, {
    flickerSpeed: 0.5,
    flickerAmount: 0.4,
    enableOnOff: true,
    onOffThreshold: 0.2,
    offWindowWidth: 0.7,
    initialIntensity: 0  // Start with no flickering, zones will enable it
  });
  background.objectModifier = flickerResult.modifier;
  flickerControls = flickerResult.controls;
}

// Make sure to update the generator after updating modifiers
background.updateGenerator();
scene.add(background);

// Setup VR button after scene is loaded
const vrButton = VRButton.createButton(renderer, {
optionalFeatures: ["hand-tracking"],
});

// Create SplatEdit layer for SDF highlighting (in localFrame space - for VR hands)
splatEdit = new SplatEdit({
  rgbaBlendMode: SplatEditRgbaBlendMode.ADD_RGBA,
  sdfSmooth: 0.02,
  softEdge: 0.02,
});
localFrame.add(splatEdit);

// Create a separate SplatEdit for world-space effects (floating lights from zones)
const sceneSplatEdit = new SplatEdit({
  rgbaBlendMode: SplatEditRgbaBlendMode.ADD_RGBA,
  sdfSmooth: 0.02,
  softEdge: 0.02,
});
scene.add(sceneSplatEdit);

// Initialize effect zone system
if (enableEffectZones) {
  window.debugLogHigh('log', "initializing effect zones");
  
  // Create floating lights manager (uses sceneSplatEdit for world-space SDFs)
  floatingLightsManager = new FloatingLightsManager(scene, sceneSplatEdit);
  
  // Create and configure zone manager (pass scene for visualization)
  effectZoneManager = new EffectZoneManager(scene);
  
  // Load effects configuration
  const effectsConfig = await loadEffectsConfig(getAssetUrl);
  effectZoneManager.loadConfig(effectsConfig);
  
  // Set starting position to zone center if startZone is specified
  if (startZone) {
    const zone = effectZoneManager.zones.find(z => z.id === startZone);
    if (zone) {
      // Calculate center of the zone
      const center = new THREE.Vector3()
        .addVectors(zone.bounds.min, zone.bounds.max)
        .multiplyScalar(0.5);
      localFrame.position.copy(center);
      console.log(`Starting at zone "${startZone}" center:`, center);
    } else {
      console.warn(`Zone "${startZone}" not found, using default starting position`);
    }
  }
  
  // Set up zone enter callback
  effectZoneManager.onEnter((zone) => {
    window.debugLogHigh('info', `Entered zone: ${zone.id}`);
    console.log(`Entered zone: ${zone.id}`);
    
    // Handle floating lights for this zone
    if (zone.effects.floatingLights?.enabled) {
      floatingLightsManager.spawnForZone(zone.id, zone.bounds, zone.effects.floatingLights);
    }
    
    // Handle flickering - update target intensity
    const flickerState = effectZoneManager.getFlickerState();
    targetFlickerIntensity = flickerState.intensity;
    if (flickerState.config && flickerControls) {
      flickerControls.updateFromConfig(flickerState.config);
    }
  });
  
  // Set up zone exit callback
  effectZoneManager.onExit((zone) => {
    window.debugLogHigh('info', `Exited zone: ${zone.id}`);
    
    // Remove floating lights for this zone
    if (zone.effects.floatingLights?.enabled) {
      floatingLightsManager.removeForZone(zone.id);
    }
    
    // Update flicker intensity based on remaining active zones
    const flickerState = effectZoneManager.getFlickerState();
    targetFlickerIntensity = flickerState.intensity;
    if (flickerState.config && flickerControls) {
      flickerControls.updateFromConfig(flickerState.config);
    }
  });
}

if (vrButton) {
  // WebXR is available, so show the button
  document.body.appendChild(vrButton);

  // Initialize WebXR hands
  xrHands = new XrHands();
  const handMesh = xrHands.makeGhostMesh();
  handMesh.editable = false;
  localFrame.add(handMesh);

  // Reset camera tracking when VR session starts to prevent transport effect
  renderer.xr.addEventListener('sessionstart', () => {
    debugLogHigh('info', 'VR session started');
  
    // Transfer camera movement to localFrame before headset takes over camera.position
    // This preserves the user's position from non-VR mode
    const priorCameraPos = camera.position.clone();
  
    // Add camera position to localFrame to preserve world position
    localFrame.position.add(priorCameraPos);
  
    // Reset tracking and enable grace period to prevent discontinuity detection on entry
    vrEntryFrameCount = 0;
});
}

// Initialize spatial audio sources
await initializeAudio(scene, getAssetUrl);

// Start animation loop
renderer.setAnimationLoop(function animate(time, xrFrame) {
// When in XR mode, control localFrame. When not in XR, control camera directly
const isXRActive = renderer.xr.isPresenting;

if (isXRActive) {
  // Enable sliding for XR mode
  controls.pointerControls.slideSpeed = defaultSlideSpeed;
  
  // Increment frame count for VR entry grace period
  if (vrEntryFrameCount < VR_ENTRY_GRACE_PERIOD) {
    vrEntryFrameCount++;
  }
  
  // This is a hack to make a "local" frame work reliably across
  // Quest 3 and Vision Pro. Any big discontinuity in the camera
  // results in a reverse shift of the local frame to compensate.
  // Use camera.position directly (not world position) for VR compatibility
  // Skip discontinuity detection during grace period to prevent transport on VR entry
  if (vrEntryFrameCount >= VR_ENTRY_GRACE_PERIOD && lastCameraPos.distanceTo(camera.position) > 0.5) {
    localFrame.position.copy(camera.position).multiplyScalar(-1);
    debugLogHigh('warn', `Large camera discontinuity detected, adjusting localFrame`);
  }
  lastCameraPos.copy(camera.position);
  controls.update(localFrame);
} else {
  // Disable sliding for non-XR mode to prevent mouse drag from moving camera
  controls.pointerControls.slideSpeed = 0;
  // Control camera directly (camera is child of localFrame, so this works correctly)
  controls.update(camera);
  // Update last position for consistency
  lastCameraPos.copy(camera.position);
}

// Get the world position of the camera for other uses (audio, display, etc.)
camera.getWorldPosition(cameraWorldPos);

if (animateT) {
  animateT.value = time / 1000;
}
if (background) {
  background.updateVersion();
}

// Check proximity triggers for non-looping audio (use world position)
checkProximityTriggers(cameraWorldPos);

// Update effect zones based on camera position
if (effectZoneManager) {
  effectZoneManager.update(cameraWorldPos);
}

// Update floating lights animation for all active zones
if (floatingLightsManager) {
  floatingLightsManager.update(time);
}

// Smoothly interpolate flicker intensity
if (flickerControls) {
  const deltaTime = 1 / 60; // Approximate frame time
  if (currentFlickerIntensity < targetFlickerIntensity) {
    currentFlickerIntensity = Math.min(
      targetFlickerIntensity,
      currentFlickerIntensity + FLICKER_FADE_SPEED * deltaTime
    );
  } else if (currentFlickerIntensity > targetFlickerIntensity) {
    currentFlickerIntensity = Math.max(
      targetFlickerIntensity,
      currentFlickerIntensity - FLICKER_FADE_SPEED * deltaTime
    );
  }
  flickerControls.setIntensity(currentFlickerIntensity);
}

// Update WebXR hands if active
if (isXRActive && xrHands) {
  xrHands.update({ xr: renderer.xr, xrFrame });

  // Create interactor SDFs for each hand tip
  for (const hand of ["left", "right"]) {
    for (const [index, tip] of ["t3", "i4", "m4", "r4", "p4"].entries()) {
      // Make a sphere SDF for each hand tip with different colors
      const key = `${hand}-${tip}`;
      if (!handSdfs.has(key)) {
        const sdf = new SplatEditSdf({
          type: SplatEditSdfType.SPHERE,
          radius: 0.03,
          color: new THREE.Color(
            (index % 5 < 3) ? 1 : 0,
            (index % 5 % 2),
            ((index % 5) > 1) ? 1 : 0
          ),
          opacity: 0,
        });
        handSdfs.set(key, sdf);
      }

      const sdf = handSdfs.get(key);
      // Make each SDF wobble in different directions
      sdf.displace.set(
        0.01 * Math.sin(time * 0.007 + index * 1),
        0.01 * Math.sin(time * 0.002 + index * 2),
        0.01 * Math.sin(time * 0.009 + index * 3),
      );

      if (xrHands.hands[hand] && xrHands.hands[hand][tip]) {
        // Make the SDF follow the hand tips
        sdf.position.copy(xrHands.hands[hand][tip].position);
        splatEdit.add(sdf);
      } else {
        // Remove the SDF when the hand is not detected
        splatEdit.remove(sdf);
      }
    }
  }
}

// Update camera position display (show world position)
cameraInfo.position = `${cameraWorldPos.x.toFixed(2)}, ${cameraWorldPos.y.toFixed(2)}, ${cameraWorldPos.z.toFixed(2)}`;

renderer.render(scene, camera);
});

