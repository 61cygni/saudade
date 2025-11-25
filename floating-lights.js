// Floating Lights Module
// Creates floating blue points of light that drift through the scene

import * as THREE from "three";
import { SplatEdit, SplatEditSdf, SplatEditSdfType } from "@sparkjsdev/spark";

/**
 * Initialize floating lights
 * @param {THREE.Object3D} parentObject - The parent object to add spheres to (should be same coordinate system as splatEdit)
 * @param {object} splatEdit - The SplatEdit instance for SDF effects
 * @param {number} count - Number of floating lights to create
 * @param {object} options - Configuration options
 * @returns {object} Object containing particles and sdfs arrays
 */
export function initializeFloatingLights(parentObject, splatEdit, count = 5, options = {}) {
  const {
    color = 0x99ccff,           // Light blue color (more blue)
    radius = 0.2,               // SDF sphere radius (reduced for less intensity)
    sphereRadius = 0.01,         // Three.js sphere radius
    speed = 0.1,                // Animation speed
    bounds = {                  // Bounding box for movement
      min: new THREE.Vector3(-10, -2, -10),
      max: new THREE.Vector3(10, 5, 10)
    }
  } = options;

  const particles = [];
  const sdfs = [];
  
  // Create shared geometry and material for spheres (more efficient)
  const sphereGeometry = new THREE.SphereGeometry(sphereRadius, 16, 16);
  const sphereMaterial = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.8,
    emissive: color,
    emissiveIntensity: 0.5
  });

  for (let i = 0; i < count; i++) {
    // Random starting position within bounds
    const startPos = new THREE.Vector3(
      bounds.min.x + Math.random() * (bounds.max.x - bounds.min.x),
      bounds.min.y + Math.random() * (bounds.max.y - bounds.min.y),
      bounds.min.z + Math.random() * (bounds.max.z - bounds.min.z)
    );

    // Create SDF for visual effect
    const sdf = new SplatEditSdf({
      type: SplatEditSdfType.SPHERE,
      radius: radius,
      color: new THREE.Color(color),
      opacity: 0.1, // Make more visible
    });
    sdf.position.copy(startPos);
    splatEdit.add(sdf);
    
    // Create Three.js sphere mesh with cloned material
    // Add to same parent as splatEdit so coordinates match
    const clonedMaterial = sphereMaterial.clone();
    const sphereMesh = new THREE.Mesh(sphereGeometry, clonedMaterial);
    sphereMesh.position.copy(startPos);
    parentObject.add(sphereMesh);

    // Random velocity for floating motion
    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * speed,
      (Math.random() - 0.5) * speed * 0.5, // Slower vertical movement
      (Math.random() - 0.5) * speed
    );

    // Random phase offset for sine wave animation
    const phase = Math.random() * Math.PI * 2;

    particles.push({
      sdf,
      sphere: sphereMesh,
      velocity,
      phase,
      basePosition: startPos.clone(),
      timeOffset: Math.random() * 1000 // Random start time
    });

    sdfs.push(sdf);
  }

  return { particles, sdfs };
}

/**
 * Update floating lights animation
 * @param {Array} particles - Array of particle objects
 * @param {object} bounds - Bounding box for movement
 * @param {number} time - Current time in milliseconds
 * @param {object} splatEdit - The SplatEdit instance (optional, for re-adding SDFs if needed)
 */
export function updateFloatingLights(particles, bounds, time, splatEdit = null) {
  particles.forEach((particle, index) => {
    const t = (time + particle.timeOffset) * 0.001; // Convert to seconds
    
    // Base floating motion (sine waves for smooth movement)
    const floatX = Math.sin(t * 0.5 + particle.phase) * 2;
    const floatY = Math.sin(t * 0.3 + particle.phase * 1.3) * 1.5;
    const floatZ = Math.cos(t * 0.4 + particle.phase * 0.7) * 2;

    // Add velocity-based drift
    particle.basePosition.add(particle.velocity.clone().multiplyScalar(0.01));

    // Wrap around if out of bounds
    if (particle.basePosition.x < bounds.min.x) particle.basePosition.x = bounds.max.x;
    if (particle.basePosition.x > bounds.max.x) particle.basePosition.x = bounds.min.x;
    if (particle.basePosition.y < bounds.min.y) particle.basePosition.y = bounds.max.y;
    if (particle.basePosition.y > bounds.max.y) particle.basePosition.y = bounds.min.y;
    if (particle.basePosition.z < bounds.min.z) particle.basePosition.z = bounds.max.z;
    if (particle.basePosition.z > bounds.max.z) particle.basePosition.z = bounds.min.z;

    // Calculate final position
    const position = particle.basePosition.clone();
    position.x += floatX;
    position.y += floatY;
    position.z += floatZ;

    // Update SDF position and properties
    if (particle.sdf) {
      particle.sdf.position.copy(position);
      
      // Add subtle pulsing effect to opacity (reduced intensity)
      const pulse = 0.3 + 0.2 * Math.sin(t * 2 + particle.phase);
      particle.sdf.opacity = Math.max(0.05, pulse); // Reduced intensity
    }
    
    if (particle.sphere) {
      particle.sphere.position.copy(position);
      
      // Pulse the sphere opacity too
      const spherePulse = 0.4 + 0.3 * Math.sin(t * 2 + particle.phase);
      particle.sphere.material.opacity = spherePulse;
    }

    // Add subtle color variation
    const colorShift = 0.8 + 0.2 * Math.sin(t * 1.5 + particle.phase);
    particle.sdf.color.setRGB(
      colorShift * 0.6,    // R component of light blue (more blue)
      colorShift * 0.8,    // G component of light blue
      colorShift * 1.0     // B component of light blue
    );
    
    // Update sphere color too
    const sphereColor = new THREE.Color(
      colorShift * 0.6,
      colorShift * 0.8,
      colorShift * 1.0
    );
    if (particle.sphere && particle.sphere.material) {
      particle.sphere.material.color.copy(sphereColor);
      if (particle.sphere.material.emissive) {
        particle.sphere.material.emissive.copy(sphereColor);
      }
    }
  });
}

