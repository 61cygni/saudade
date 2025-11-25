// Effect Zones Module
// Manages spatial zones that trigger visual effects when the user enters/exits

import * as THREE from "three";

/**
 * Effect Zone Manager
 * Handles zone detection and effect lifecycle
 */
export class EffectZoneManager {
  constructor(scene = null) {
    this.zones = [];
    this.activeZones = new Set(); // Zone IDs the user is currently inside
    this.callbacks = {
      onEnter: [],
      onExit: []
    };
    this.scene = scene;
    this.visualizationGroup = null;
    this.visualizationVisible = false;
    this.wireframeBoxes = new Map(); // Map of zoneId -> wireframe mesh
  }

  /**
   * Load zones from configuration
   * @param {object} config - The effects configuration object
   */
  loadConfig(config) {
    if (!config || !config.zones) {
      console.warn('EffectZoneManager: No zones found in config');
      return;
    }

    this.zones = config.zones.map(zoneConfig => ({
      id: zoneConfig.id,
      type: zoneConfig.type || 'box',
      bounds: {
        min: new THREE.Vector3(...zoneConfig.bounds.min),
        max: new THREE.Vector3(...zoneConfig.bounds.max)
      },
      effects: zoneConfig.effects || {}
    }));

    console.log(`EffectZoneManager: Loaded ${this.zones.length} zones`);
    
    // Create visualization if scene is available
    if (this.scene) {
      this.createVisualization();
    }
  }

  /**
   * Create wireframe boxes for zone visualization
   */
  createVisualization() {
    if (!this.scene) {
      console.warn('EffectZoneManager: Cannot create visualization without scene');
      return;
    }

    // Create a group to hold all wireframe boxes
    this.visualizationGroup = new THREE.Group();
    this.visualizationGroup.name = 'EffectZoneVisualization';
    this.scene.add(this.visualizationGroup);

    // Create wireframe box for each zone
    for (const zone of this.zones) {
      if (zone.type === 'box') {
        const size = new THREE.Vector3().subVectors(zone.bounds.max, zone.bounds.min);
        const center = new THREE.Vector3().addVectors(zone.bounds.min, zone.bounds.max).multiplyScalar(0.5);
        
        // Add subdivisions for denser wireframe (4 segments per axis)
        const geometry = new THREE.BoxGeometry(size.x, size.y, size.z, 4, 4, 4);
        const material = new THREE.MeshBasicMaterial({
          color: 0x00ff00, // Green wireframe
          wireframe: true,
          transparent: true,
          opacity: 0.6
        });
        
        const wireframe = new THREE.Mesh(geometry, material);
        wireframe.position.copy(center);
        wireframe.userData.zoneId = zone.id;
        
        // Store reference
        this.wireframeBoxes.set(zone.id, wireframe);
        this.visualizationGroup.add(wireframe);
      } else if (zone.type === 'sphere') {
        // For sphere zones, create a wireframe sphere
        const center = zone.bounds.min;
        const radius = zone.bounds.max.x;
        
        const geometry = new THREE.SphereGeometry(radius, 16, 16);
        const material = new THREE.MeshBasicMaterial({
          color: 0x00ff00,
          wireframe: true,
          transparent: true,
          opacity: 0.6
        });
        
        const wireframe = new THREE.Mesh(geometry, material);
        wireframe.position.copy(center);
        wireframe.userData.zoneId = zone.id;
        
        this.wireframeBoxes.set(zone.id, wireframe);
        this.visualizationGroup.add(wireframe);
      }
    }

    // Start hidden
    this.visualizationGroup.visible = false;
    this.visualizationVisible = false;
  }

  /**
   * Toggle visibility of zone wireframes
   */
  toggleVisualization() {
    if (!this.visualizationGroup) {
      console.warn('EffectZoneManager: Visualization not created');
      return;
    }

    this.visualizationVisible = !this.visualizationVisible;
    this.visualizationGroup.visible = this.visualizationVisible;
    
    // Update colors based on active state
    this.updateVisualizationColors();

    console.log(`Zone visualization: ${this.visualizationVisible ? 'ON' : 'OFF'}`);
  }

  /**
   * Update wireframe colors based on active zones
   */
  updateVisualizationColors() {
    for (const [zoneId, wireframe] of this.wireframeBoxes) {
      const isActive = this.activeZones.has(zoneId);
      wireframe.material.color.setHex(isActive ? 0xff0000 : 0x00ff00); // Red if active, green if inactive
    }
  }

  /**
   * Register a callback for zone enter events
   * @param {function} callback - Function(zone) called when entering a zone
   */
  onEnter(callback) {
    this.callbacks.onEnter.push(callback);
  }

  /**
   * Register a callback for zone exit events
   * @param {function} callback - Function(zone) called when exiting a zone
   */
  onExit(callback) {
    this.callbacks.onExit.push(callback);
  }

  /**
   * Check if a point is inside a zone
   * @param {THREE.Vector3} point - The point to check
   * @param {object} zone - The zone to check against
   * @returns {boolean}
   */
  isInsideZone(point, zone) {
    if (zone.type === 'box') {
      return (
        point.x >= zone.bounds.min.x && point.x <= zone.bounds.max.x &&
        point.y >= zone.bounds.min.y && point.y <= zone.bounds.max.y &&
        point.z >= zone.bounds.min.z && point.z <= zone.bounds.max.z
      );
    } else if (zone.type === 'sphere') {
      // For sphere zones, bounds.min is center, bounds.max.x is radius
      const center = zone.bounds.min;
      const radius = zone.bounds.max.x;
      return point.distanceTo(center) <= radius;
    }
    return false;
  }

  /**
   * Update zone states based on camera position
   * Call this every frame in the animation loop
   * @param {THREE.Vector3} cameraWorldPos - Current camera world position
   */
  update(cameraWorldPos) {
    for (const zone of this.zones) {
      const wasInside = this.activeZones.has(zone.id);
      const isInside = this.isInsideZone(cameraWorldPos, zone);

      if (isInside && !wasInside) {
        // Entered zone
        this.activeZones.add(zone.id);
        this.callbacks.onEnter.forEach(cb => cb(zone));
      } else if (!isInside && wasInside) {
        // Exited zone
        this.activeZones.delete(zone.id);
        this.callbacks.onExit.forEach(cb => cb(zone));
      }
    }
    
    // Update visualization colors if visible
    if (this.visualizationVisible) {
      this.updateVisualizationColors();
    }
  }

  /**
   * Get all currently active zones
   * @returns {Array} Array of active zone objects
   */
  getActiveZones() {
    return this.zones.filter(z => this.activeZones.has(z.id));
  }

  /**
   * Check if any active zone has a specific effect enabled
   * @param {string} effectName - Name of the effect (e.g., 'flickering', 'floatingLights')
   * @returns {object|null} The effect config from the first matching zone, or null
   */
  getActiveEffect(effectName) {
    for (const zone of this.getActiveZones()) {
      if (zone.effects[effectName]?.enabled) {
        return { zone, config: zone.effects[effectName] };
      }
    }
    return null;
  }

  /**
   * Check if flickering should be active and get combined intensity
   * @returns {object} { active: boolean, intensity: number, config: object }
   */
  getFlickerState() {
    const activeZones = this.getActiveZones();
    let maxIntensity = 0;
    let config = null;

    for (const zone of activeZones) {
      if (zone.effects.flickering?.enabled) {
        // Use flickerAmount as intensity, take the highest from overlapping zones
        const intensity = zone.effects.flickering.flickerAmount || 0.4;
        if (intensity > maxIntensity) {
          maxIntensity = intensity;
          config = zone.effects.flickering;
        }
      }
    }

    return {
      active: maxIntensity > 0,
      intensity: maxIntensity,
      config: config
    };
  }

  /**
   * Get all floating light configs from active zones
   * @returns {Array} Array of { zone, config } objects
   */
  getFloatingLightZones() {
    const result = [];
    for (const zone of this.getActiveZones()) {
      if (zone.effects.floatingLights?.enabled) {
        result.push({ zone, config: zone.effects.floatingLights });
      }
    }
    return result;
  }
}

/**
 * Load effects configuration from JSON file
 * @param {function} getAssetUrl - Function to resolve asset URLs
 * @returns {Promise<object>} The loaded configuration
 */
export async function loadEffectsConfig(getAssetUrl) {
  const configUrl = getAssetUrl('assets/effects-config.json');
  try {
    const response = await fetch(configUrl);
    if (!response.ok) {
      throw new Error(`Failed to load effects config: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading effects config:', error);
    return { zones: [] };
  }
}

