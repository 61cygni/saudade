// Audio Module
// Handles all spatial audio functionality

import * as THREE from "three";

// Helper function to get localDev dynamically (since window.localDev might not be set at module load time)
function getLocalDev() {
  return window.localDev || false;
}

// Setup spatial audio
export const audioListener = new THREE.AudioListener();
const audioLoader = new THREE.AudioLoader();
export const spatialAudioSources = [];
let _audioEnabled = false;
let _audioInitialized = false;

// Export getters for audio state
export function getAudioEnabled() { return _audioEnabled; }
export function getAudioInitialized() { return _audioInitialized; }

// Get audio toggle button
const audioToggleButton = document.getElementById("audio-toggle");

/**
 * Get asset URL helper (imported from main.js or use global)
 */
function getAssetUrl(path) {
  if (window.getAssetUrl) {
    return window.getAssetUrl(path);
  }
  // Fallback if not available globally
  if (getLocalDev()) {
    return `/${path}`;
  }
  if (path.endsWith('.spz')) {
    const filename = path.split('/').pop();
    return `https://public-spz.t3.storage.dev/${filename}`;
  }
  return `/${path}`;
}

/**
 * Add a spatial audio source to the scene
 * @param {string} audioUrl - URL to the audio file
 * @param {THREE.Vector3} position - Position of the audio source in 3D space
 * @param {object} options - Configuration options
 * @param {number} options.refDistance - Reference distance for falloff (default: 5)
 * @param {number} options.rolloffFactor - How quickly the sound fades (default: 1)
 * @param {number} options.maxDistance - Maximum distance the sound can be heard (default: 50)
 * @param {boolean} options.loop - Whether the audio should loop (default: true)
 * @param {number} options.volume - Volume of the audio (default: 1)
 * @param {number} options.triggerRadius - Proximity radius to trigger non-looping audio (optional)
 * @returns {Promise<THREE.PositionalAudio>} The created positional audio object
 */
export async function addSpatialAudioSource(audioUrl, position, options = {}) {
  const {
    refDistance = 5,
    rolloffFactor = 1,
    maxDistance = 50,
    loop = true,
    volume = 1,
    triggerRadius = null
  } = options;

  return new Promise((resolve, reject) => {
    const positionalAudio = new THREE.PositionalAudio(audioListener);
    
    audioLoader.load(
      audioUrl,
      (buffer) => {
        positionalAudio.setBuffer(buffer);
        positionalAudio.setRefDistance(refDistance);
        positionalAudio.setRolloffFactor(rolloffFactor);
        positionalAudio.setMaxDistance(maxDistance);
        positionalAudio.setLoop(loop);
        positionalAudio.setVolume(volume);
        
        // Create a visual marker for the audio source (optional, for debugging)
        const audioMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 16, 16),
          new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true})
        );
        audioMesh.position.copy(position);
        audioMesh.add(positionalAudio);
        // Show audio mesh spheres in local development mode
        audioMesh.visible = getLocalDev();
        
        spatialAudioSources.push({
          audio: positionalAudio,
          mesh: audioMesh,
          url: audioUrl,
          loop: loop,
          triggerRadius: triggerRadius,
          triggered: false, // Track if non-looping audio has been triggered
          position: position.clone()
        });
        
        resolve(positionalAudio);
      },
      (progress) => {
        console.log(`Loading audio: ${(progress.loaded / progress.total * 100).toFixed(0)}%`);
      },
      (error) => {
        console.error('Error loading audio:', error);
        reject(error);
      }
    );
  });
}

export async function addMultipleSpatialAudioSources(audioList) {
  const promises = audioList.map(({ audio_url, audio_position, falloff = {}, triggerRadius = null }) => {
    const position = new THREE.Vector3(...audio_position);
    return addSpatialAudioSource(audio_url, position, { ...falloff, triggerRadius });
  });
  
  return Promise.all(promises);
}

export function syncAudioToggle() {
  if (!audioToggleButton) return;
  audioToggleButton.innerHTML = _audioEnabled ? '<i data-lucide="volume-2"></i>' : '<i data-lucide="volume-off"></i>';
  audioToggleButton.setAttribute("aria-label", _audioEnabled ? "Pause audio" : "Play audio");
  // Re-initialize icons after dynamically setting innerHTML
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

export async function toggleAudio() {
  if (!_audioEnabled) {
    try {
      // Play only looping spatial audio sources
      for (const source of spatialAudioSources) {
        if (source.loop && !source.audio.isPlaying) {
          console.log("Playing looping audio:", source.url);
          source.audio.play();
        }
      }
      _audioEnabled = true;
    } catch (error) {
      console.error("Failed to start spatial audio:", error);
      return;
    }
  } else {
    // Pause all spatial audio sources
    for (const source of spatialAudioSources) {
      if (source.audio.isPlaying) {
        source.audio.pause();
      }
    }
    _audioEnabled = false;
  }
  syncAudioToggle();
}

// Check proximity for triggered audio sources
export function checkProximityTriggers(listenerPosition) {
  if (!_audioEnabled) return;
  
  for (const source of spatialAudioSources) {
    // Only check non-looping audio with triggerRadius defined
    if (!source.loop && source.triggerRadius && !source.triggered) {
      const distance = listenerPosition.distanceTo(source.position);
      
      // Trigger audio if within radius
      if (distance <= source.triggerRadius) {
        source.audio.play();
        source.triggered = true;
        console.log(`Triggered audio: ${source.url}`);
      }
    }
  }
}

// Initialize audio system
export async function initializeAudio(scene, getAssetUrlFn) {
  // Use provided getAssetUrl function or fallback
  const assetUrlFn = getAssetUrlFn || getAssetUrl;
  
  // Initialize spatial audio sources by loading config from JSON
  let audioSources = [];
  try {
    const audioConfigUrl = assetUrlFn("assets/audio-config.json");
    const response = await fetch(audioConfigUrl);
    const audioConfig = await response.json();
    
    // Map the audio URLs using getAssetUrl
    audioSources = audioConfig.map(source => ({
      ...source,
      audio_url: assetUrlFn(source.audio_url)
    }));
    
    console.log(`Loaded ${audioSources.length} audio source configurations`);
  } catch (error) {
    console.error("Failed to load audio configuration:", error);
  }

  // Load and add all spatial audio sources
  if (audioSources.length > 0) {
    try {
      await addMultipleSpatialAudioSources(audioSources);
      // Add audio meshes to scene
      spatialAudioSources.forEach(source => {
        scene.add(source.mesh);
      });
      console.log(`Successfully loaded ${spatialAudioSources.length} spatial audio source(s)`);
      _audioInitialized = true;
    } catch (error) {
      console.error("Failed to load spatial audio sources:", error);
    }
  }
}

// Setup audio toggle button event listener
if (audioToggleButton) {
  audioToggleButton.addEventListener("click", () => {
    toggleAudio();
  });
  syncAudioToggle();
}

