// Floating Lights Module
// Creates floating blue points of light that drift through the scene

import * as THREE from "three";
import { SplatEdit, SplatEditSdf, SplatEditSdfType } from "@sparkjsdev/spark";

/**
 * Floating Lights Manager
 * Handles creation, destruction, and updates of floating light particles
 */
export class FloatingLightsManager {
  constructor(parentObject, splatEdit) {
    this.parentObject = parentObject;
    this.splatEdit = splatEdit;
    this.activeZones = new Map(); // Map of zoneId -> { particles, sdfs, bounds, config }
    
    // Shared geometry for efficiency
    this.sphereGeometry = new THREE.SphereGeometry(0.01, 16, 16);
  }

  /**
   * Spawn floating lights for a specific zone
   * @param {string} zoneId - Unique identifier for the zone
   * @param {object} bounds - Bounding box { min: Vector3, max: Vector3 }
   * @param {object} config - Configuration from effects-config.json
   */
  spawnForZone(zoneId, bounds, config = {}) {
    // Don't spawn if already active for this zone
    if (this.activeZones.has(zoneId)) {
      return this.activeZones.get(zoneId);
    }

    const {
      count = 5,
      color = 0x99ccff,
      radius = 0.2,
      speed = 0.1,
      opacity = 0.1
    } = config;

    // Parse color if it's a string
    const colorValue = typeof color === 'string' ? parseInt(color, 16) : color;

    const particles = [];
    const sdfs = [];

    // Create material for this zone's lights
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: colorValue,
      transparent: true,
      opacity: 0.8
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
        color: new THREE.Color(colorValue),
        opacity: opacity,
      });
      sdf.position.copy(startPos);
      this.splatEdit.add(sdf);

      // Create Three.js sphere mesh
      const clonedMaterial = sphereMaterial.clone();
      const sphereMesh = new THREE.Mesh(this.sphereGeometry, clonedMaterial);
      sphereMesh.position.copy(startPos);
      this.parentObject.add(sphereMesh);

      // Random velocity for floating motion
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * speed,
        (Math.random() - 0.5) * speed * 0.5,
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
        timeOffset: Math.random() * 1000
      });

      sdfs.push(sdf);
    }

    const zoneData = { 
      particles, 
      sdfs, 
      bounds: {
        min: bounds.min.clone(),
        max: bounds.max.clone()
      },
      config,
      colorValue
    };
    this.activeZones.set(zoneId, zoneData);

    console.log(`FloatingLights: Spawned ${count} lights for zone "${zoneId}"`);
    return zoneData;
  }

  /**
   * Remove floating lights for a specific zone
   * @param {string} zoneId - Zone identifier
   */
  removeForZone(zoneId) {
    const zoneData = this.activeZones.get(zoneId);
    if (!zoneData) return;

    // Remove all SDFs and meshes
    for (const particle of zoneData.particles) {
      if (particle.sdf) {
        this.splatEdit.remove(particle.sdf);
      }
      if (particle.sphere) {
        this.parentObject.remove(particle.sphere);
        particle.sphere.geometry?.dispose();
        particle.sphere.material?.dispose();
      }
    }

    this.activeZones.delete(zoneId);
    console.log(`FloatingLights: Removed lights for zone "${zoneId}"`);
  }

  /**
   * Remove all floating lights from all zones
   */
  removeAll() {
    for (const zoneId of this.activeZones.keys()) {
      this.removeForZone(zoneId);
    }
  }

  /**
   * Update all active floating lights
   * @param {number} time - Current time in milliseconds
   */
  update(time) {
    for (const [zoneId, zoneData] of this.activeZones) {
      this.updateParticles(zoneData.particles, zoneData.bounds, time, zoneData.colorValue);
    }
  }

  /**
   * Update particles for a specific zone
   */
  updateParticles(particles, bounds, time, colorValue) {
    // Extract RGB components from color (normalized 0-1)
    const r = ((colorValue >> 16) & 255) / 255;
    const g = ((colorValue >> 8) & 255) / 255;
    const b = (colorValue & 255) / 255;

    particles.forEach((particle) => {
      const t = (time + particle.timeOffset) * 0.001;

      // Base floating motion
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
        const pulse = 0.3 + 0.2 * Math.sin(t * 2 + particle.phase);
        particle.sdf.opacity = Math.max(0.05, pulse);
      }

      if (particle.sphere) {
        particle.sphere.position.copy(position);
        const spherePulse = 0.4 + 0.3 * Math.sin(t * 2 + particle.phase);
        particle.sphere.material.opacity = spherePulse;
      }

      // Add subtle color variation
      const colorShift = 0.8 + 0.2 * Math.sin(t * 1.5 + particle.phase);
      particle.sdf.color.setRGB(
        colorShift * r,
        colorShift * g,
        colorShift * b
      );

      // Update sphere color too
      const sphereColor = new THREE.Color(
        colorShift * r,
        colorShift * g,
        colorShift * b
      );
      if (particle.sphere && particle.sphere.material) {
        particle.sphere.material.color.copy(sphereColor);
      }
    });
  }

  /**
   * Check if a zone has active floating lights
   * @param {string} zoneId - Zone identifier
   * @returns {boolean}
   */
  hasZone(zoneId) {
    return this.activeZones.has(zoneId);
  }

  /**
   * Get active zone IDs
   * @returns {Array<string>}
   */
  getActiveZoneIds() {
    return Array.from(this.activeZones.keys());
  }
}


// Legacy functions for backwards compatibility
// These can be removed once main.js is fully migrated to the manager

/**
 * Initialize floating lights (legacy function)
 * @deprecated Use FloatingLightsManager instead
 */
export function initializeFloatingLights(parentObject, splatEdit, count = 5, options = {}) {
  const {
    color = 0x99ccff,
    radius = 0.2,
    sphereRadius = 0.01,
    speed = 0.1,
    bounds = {
      min: new THREE.Vector3(-10, -2, -10),
      max: new THREE.Vector3(10, 5, 10)
    }
  } = options;

  const particles = [];
  const sdfs = [];
  
  const sphereGeometry = new THREE.SphereGeometry(sphereRadius, 16, 16);
  const sphereMaterial = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.8
  });

  for (let i = 0; i < count; i++) {
    const startPos = new THREE.Vector3(
      bounds.min.x + Math.random() * (bounds.max.x - bounds.min.x),
      bounds.min.y + Math.random() * (bounds.max.y - bounds.min.y),
      bounds.min.z + Math.random() * (bounds.max.z - bounds.min.z)
    );

    const sdf = new SplatEditSdf({
      type: SplatEditSdfType.SPHERE,
      radius: radius,
      color: new THREE.Color(color),
      opacity: 0.1,
    });
    sdf.position.copy(startPos);
    splatEdit.add(sdf);
    
    const clonedMaterial = sphereMaterial.clone();
    const sphereMesh = new THREE.Mesh(sphereGeometry, clonedMaterial);
    sphereMesh.position.copy(startPos);
    parentObject.add(sphereMesh);

    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * speed,
      (Math.random() - 0.5) * speed * 0.5,
      (Math.random() - 0.5) * speed
    );

    const phase = Math.random() * Math.PI * 2;

    particles.push({
      sdf,
      sphere: sphereMesh,
      velocity,
      phase,
      basePosition: startPos.clone(),
      timeOffset: Math.random() * 1000
    });

    sdfs.push(sdf);
  }

  return { particles, sdfs };
}

/**
 * Update floating lights animation (legacy function)
 * @deprecated Use FloatingLightsManager.update() instead
 */
export function updateFloatingLights(particles, bounds, time, splatEdit = null) {
  particles.forEach((particle, index) => {
    const t = (time + particle.timeOffset) * 0.001;
    
    const floatX = Math.sin(t * 0.5 + particle.phase) * 2;
    const floatY = Math.sin(t * 0.3 + particle.phase * 1.3) * 1.5;
    const floatZ = Math.cos(t * 0.4 + particle.phase * 0.7) * 2;

    particle.basePosition.add(particle.velocity.clone().multiplyScalar(0.01));

    if (particle.basePosition.x < bounds.min.x) particle.basePosition.x = bounds.max.x;
    if (particle.basePosition.x > bounds.max.x) particle.basePosition.x = bounds.min.x;
    if (particle.basePosition.y < bounds.min.y) particle.basePosition.y = bounds.max.y;
    if (particle.basePosition.y > bounds.max.y) particle.basePosition.y = bounds.min.y;
    if (particle.basePosition.z < bounds.min.z) particle.basePosition.z = bounds.max.z;
    if (particle.basePosition.z > bounds.max.z) particle.basePosition.z = bounds.min.z;

    const position = particle.basePosition.clone();
    position.x += floatX;
    position.y += floatY;
    position.z += floatZ;

    if (particle.sdf) {
      particle.sdf.position.copy(position);
      const pulse = 0.3 + 0.2 * Math.sin(t * 2 + particle.phase);
      particle.sdf.opacity = Math.max(0.05, pulse);
    }
    
    if (particle.sphere) {
      particle.sphere.position.copy(position);
      const spherePulse = 0.4 + 0.3 * Math.sin(t * 2 + particle.phase);
      particle.sphere.material.opacity = spherePulse;
    }

    const colorShift = 0.8 + 0.2 * Math.sin(t * 1.5 + particle.phase);
    particle.sdf.color.setRGB(
      colorShift * 0.6,
      colorShift * 0.8,
      colorShift * 1.0
    );
    
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
