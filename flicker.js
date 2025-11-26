// Flicker Module
// Handles flickering light effect for splat meshes using DynoBlock
// Modifies RGBA values to simulate flickering lights

/**
 * Create a flicker modifier for a splat mesh
 * @param {object} dyno - The dyno library object
 * @param {object} animateT - The animated time value (dynoFloat)
 * @param {object} options - Configuration options
 * @returns {object} Object containing the modifier and control functions
 */
export function createFlickerModifier(dyno, animateT, options = {}) {
  const {
    flickerSpeed = 0.1,        // Speed of flickering
    flickerAmount = 0.4,        // Amount of flickering (0-1, how much brightness varies)
    enableOnOff = true,         // Enable complete on/off flickering
    onOffThreshold = 0.7,       // Threshold for on/off effect
    offWindowWidth = 0.15,      // Width of off window (smaller = shorter dark periods)
    colorShift = null,          // Optional color shift (vec3, e.g., [1.2, 1.0, 0.8] for warm)
    initialIntensity = 1.0      // Initial intensity multiplier (0 = no effect, 1 = full effect)
  } = options;
  
  const flickerSpeedVal = dyno.dynoFloat(flickerSpeed);
  const flickerAmountVal = dyno.dynoFloat(flickerAmount);
  const onOffThresholdVal = dyno.dynoFloat(onOffThreshold);
  const offWindowWidthVal = dyno.dynoFloat(offWindowWidth);
  // Dynamic intensity multiplier - can be changed at runtime for zone-based effects
  const intensityVal = dyno.dynoFloat(initialIntensity);
  
  const modifier = dyno.dynoBlock(
    { gsplat: dyno.Gsplat },
    { gsplat: dyno.Gsplat },
    ({ gsplat }) => {
      // Create an inline GLSL block that modifies RGBA for flickering
      const d = new dyno.Dyno({
        inTypes: { 
          gsplat: dyno.Gsplat, 
          t: "float", 
          flickerSpeed: "float",
          flickerAmount: "float",
          onOffThreshold: "float",
          offWindowWidth: "float",
          intensity: "float"
        },
        outTypes: { gsplat: dyno.Gsplat },
        globals: () => [
          dyno.unindent(`
            // Simple noise function for randomness
            float randomNoise(float x) {
              return fract(sin(x * 12.9898) * 43758.5453);
            }
            
            // Multi-octave noise for more complex randomness
            float noise(float t) {
              float n1 = randomNoise(t);
              float n2 = randomNoise(t * 2.7);
              float n3 = randomNoise(t * 7.3);
              return (n1 * 0.5 + n2 * 0.3 + n3 * 0.2);
            }
            
            float flickerBrightness(float t, float speed, float amount, float threshold, float offWindow, float intensity) {
              // If intensity is 0, return 1.0 (no flickering effect)
              if (intensity <= 0.0) return 1.0;
              
              // Base flickering with multiple sine waves at different frequencies
              float flicker1 = sin(t * speed);
              float flicker2 = sin(t * speed * 2.3);
              float flicker3 = sin(t * speed * 5.7);
              float flicker4 = sin(t * speed * 11.1);
              
              // Combine sine waves with different weights
              float flickerValue = (flicker1 * 0.4 + flicker2 * 0.3 + flicker3 * 0.2 + flicker4 * 0.1);
              
              // Add noise-based randomness for more chaotic flickering
              float noiseValue = noise(t * speed * 3.0);
              float noiseVariation = (noiseValue - 0.5) * 0.6;
              
              // Combine deterministic and random components
              float combinedFlicker = flickerValue + noiseVariation;
              
              // Scale the effect by intensity
              float scaledAmount = amount * intensity;
              float intensityMultiplier = 1.0 - scaledAmount + (combinedFlicker * scaledAmount);
              
              // Horror mode: More aggressive flickering behavior
              float scaledThreshold = threshold * intensity;
              
              // Sudden voltage drops - light struggles to stay on
              float voltageDrop = noise(t * speed * 4.0);
              if (voltageDrop < 0.25) {
                intensityMultiplier *= 0.3 + voltageDrop * 2.0; // Dim significantly
              }
              
              // Complete blackouts - longer dark periods
              float blackout = noise(t * speed * 8.0);
              if (blackout < scaledThreshold && blackout > scaledThreshold - offWindow * intensity) {
                intensityMultiplier = 0.0;
              }
              
              // Secondary blackout chance - creates stuttering effect
              float stutter = noise(t * speed * 15.0);
              if (stutter < scaledThreshold * 0.5) {
                intensityMultiplier *= step(0.5, noise(t * speed * 25.0)); // Rapid on/off
              }
              
              // Bright flash before dying - classic horror trope
              float preDeathFlash = noise(t * speed * 6.0);
              if (preDeathFlash > 0.88 && preDeathFlash < 0.92) {
                intensityMultiplier = min(1.3, intensityMultiplier * 1.8); // Bright surge
              }
              
              // Buzzing/humming pattern - fluorescent tube effect
              float buzz = sin(t * speed * 60.0) * 0.5 + 0.5;
              float buzzNoise = noise(t * speed * 12.0);
              if (buzzNoise < 0.2) {
                intensityMultiplier *= 0.85 + buzz * 0.15; // Subtle rapid flicker
              }
              
              // Random deep dips - light almost goes out
              float deepDip = noise(t * speed * 7.0);
              if (deepDip < 0.12) {
                intensityMultiplier *= 0.1 + deepDip; // Nearly black
              }
              
              return max(0.0, intensityMultiplier);
            }
          `)
        ],
        statements: ({ inputs, outputs }) => {
          let colorMod = "";
          if (colorShift) {
            colorMod = `
              ${outputs.gsplat}.rgba.rgb *= vec3(${colorShift[0]}, ${colorShift[1]}, ${colorShift[2]});
            `;
          }
          
          return dyno.unindentLines(`
            ${outputs.gsplat} = ${inputs.gsplat};
            float brightness = flickerBrightness(
              ${inputs.t}, 
              ${inputs.flickerSpeed}, 
              ${inputs.flickerAmount},
              ${inputs.onOffThreshold},
              ${inputs.offWindowWidth},
              ${inputs.intensity}
            );
            ${outputs.gsplat}.rgba.rgb *= brightness;
            ${colorMod}
          `);
        },
      });
      
      // Apply the GLSL block with appropriate inputs
      gsplat = d.apply({ 
        gsplat, 
        t: animateT, 
        flickerSpeed: flickerSpeedVal,
        flickerAmount: flickerAmountVal,
        onOffThreshold: onOffThresholdVal,
        offWindowWidth: offWindowWidthVal,
        intensity: intensityVal
      }).gsplat;
      
      return { gsplat };
    },
  );

  // Return both the modifier and control interface
  return {
    modifier,
    // Control functions for dynamic updates
    controls: {
      /** Set the intensity multiplier (0 = no effect, 1 = full effect) */
      setIntensity: (value) => { intensityVal.value = value; },
      /** Get current intensity */
      getIntensity: () => intensityVal.value,
      /** Set flicker speed */
      setSpeed: (value) => { flickerSpeedVal.value = value; },
      /** Set flicker amount */
      setAmount: (value) => { flickerAmountVal.value = value; },
      /** Set on/off threshold */
      setOnOffThreshold: (value) => { onOffThresholdVal.value = value; },
      /** Set off window width */
      setOffWindowWidth: (value) => { offWindowWidthVal.value = value; },
      /** Update all parameters from a config object */
      updateFromConfig: (config) => {
        if (config.flickerSpeed !== undefined) flickerSpeedVal.value = config.flickerSpeed;
        if (config.flickerAmount !== undefined) flickerAmountVal.value = config.flickerAmount;
        if (config.onOffThreshold !== undefined) onOffThresholdVal.value = config.onOffThreshold;
        if (config.offWindowWidth !== undefined) offWindowWidthVal.value = config.offWindowWidth;
      }
    }
  };
}

/**
 * Create a combined warp and flicker modifier
 * Combines both effects into a single modifier for better performance
 * @param {object} dyno - The dyno library object
 * @param {object} animateT - The animated time value (dynoFloat)
 * @param {object} flickerOptions - Options for flicker modifier
 * @returns {object} Combined objectModifier with both warp and flicker
 */
export function createWarpAndFlickerModifier(dyno, animateT, flickerOptions = {}) {
  const {
    flickerSpeed = 0.1,
    flickerAmount = 0.4,
    enableOnOff = true,
    onOffThreshold = 0.7,
    offWindowWidth = 0.15,
    colorShift = null
  } = flickerOptions;
  
  const applyWarp = dyno.dynoBool(true);
  const flickerSpeedVal = dyno.dynoFloat(flickerSpeed);
  const flickerAmountVal = dyno.dynoFloat(flickerAmount);
  const onOffThresholdVal = dyno.dynoFloat(onOffThreshold);
  
  return dyno.dynoBlock(
    { gsplat: dyno.Gsplat },
    { gsplat: dyno.Gsplat },
    ({ gsplat }) => {
      const d = new dyno.Dyno({
        inTypes: { 
          gsplat: dyno.Gsplat, 
          t: "float", 
          applyWarp: "bool",
          flickerSpeed: "float",
          flickerAmount: "float",
          onOffThreshold: "float",
          offWindowWidth: "float"
        },
        outTypes: { gsplat: dyno.Gsplat },
        globals: () => [
          dyno.unindent(`
            vec3 warp(vec3 pos, float t) {
              float spatialFrequency = 5.0;
              float amplitude = 0.02;
              return vec3(pos.x + amplitude * sin(t + spatialFrequency * pos.x), 
              pos.y, 
              pos.z + amplitude * sin(t + spatialFrequency * pos.z));
            }
            vec3 pulse(vec3 scales, vec3 pos, float t) {
              float maxScale = 1.1 * max(scales.x, max(scales.y, scales.z));
              float period = 1.0;
              float baseScale = 1.0;
              float amplitude = 0.4;
              float spatialFrequency = 2.0;
              float x = min(maxScale, scales.x * (baseScale + amplitude * sin(t * period + spatialFrequency * pos.x)));
              float y = min(maxScale, scales.y * (baseScale + amplitude * sin(t * period + spatialFrequency * pos.y)));
              float z = min(maxScale, scales.z * (baseScale + amplitude * sin(t * period + spatialFrequency * pos.z)));
              return vec3(x, y, z);
            }
            // Simple noise function for randomness
            float randomNoise(float x) {
              return fract(sin(x * 12.9898) * 43758.5453);
            }
            
            // Multi-octave noise for more complex randomness
            float noise(float t) {
              float n1 = randomNoise(t);
              float n2 = randomNoise(t * 2.7);
              float n3 = randomNoise(t * 7.3);
              return (n1 * 0.5 + n2 * 0.3 + n3 * 0.2);
            }
            
            float flickerBrightness(float t, float speed, float amount, float threshold, float offWindow) {
              // Base flickering with multiple sine waves at different frequencies
              float flicker1 = sin(t * speed);
              float flicker2 = sin(t * speed * 2.3);
              float flicker3 = sin(t * speed * 5.7);
              float flicker4 = sin(t * speed * 11.1);
              
              // Combine sine waves with different weights
              float flickerValue = (flicker1 * 0.4 + flicker2 * 0.3 + flicker3 * 0.2 + flicker4 * 0.1);
              
              // Add noise-based randomness for more chaotic flickering
              float noiseValue = noise(t * speed * 3.0);
              float noiseVariation = (noiseValue - 0.5) * 0.6; // Scale noise to -0.3 to 0.3
              
              // Combine deterministic and random components
              float combinedFlicker = flickerValue + noiseVariation;
              float intensityMultiplier = 1.0 - amount + (combinedFlicker * amount);
              
              // Random on/off moments using noise instead of sine wave
              float randomOff = noise(t * speed * 8.0);
              float randomFlash = noise(t * speed * 13.0);
              
              // Occasional complete off - more random timing
              if (randomOff < threshold && randomOff > threshold - offWindow) {
                intensityMultiplier = 0.0;
              }
              
              // Random bright flashes
              if (randomFlash > 0.85) {
                intensityMultiplier = min(1.0, intensityMultiplier * (1.2 + randomFlash * 0.3));
              }
              
              // Add occasional random dips
              float randomDip = noise(t * speed * 6.0);
              if (randomDip < 0.15) {
                intensityMultiplier *= (0.3 + randomDip * 2.0);
              }
              
              return max(0.0, intensityMultiplier);
            }
          `)
        ],
        statements: ({ inputs, outputs }) => {
          let colorMod = "";
          if (colorShift) {
            colorMod = `
              ${outputs.gsplat}.rgba.rgb *= vec3(${colorShift[0]}, ${colorShift[1]}, ${colorShift[2]});
            `;
          }
          
          return dyno.unindentLines(`
            ${outputs.gsplat} = ${inputs.gsplat};
            // Apply flicker effect (modify RGBA)
            float brightness = flickerBrightness(
              ${inputs.t}, 
              ${inputs.flickerSpeed}, 
              ${inputs.flickerAmount},
              ${inputs.onOffThreshold},
              ${inputs.offWindowWidth}
            );
            ${outputs.gsplat}.rgba.rgb *= brightness;
            ${colorMod}
            // Apply warp effect (modify position and scales)
            if(${inputs.applyWarp}) {
              ${outputs.gsplat}.center = warp(${outputs.gsplat}.center, ${inputs.t});
              ${outputs.gsplat}.scales = pulse(${outputs.gsplat}.scales, ${outputs.gsplat}.center, ${inputs.t});
            }
          `);
        },
      });
      
      gsplat = d.apply({ 
        gsplat, 
        t: animateT, 
        applyWarp: applyWarp,
        flickerSpeed: flickerSpeedVal,
        flickerAmount: flickerAmountVal,
        onOffThreshold: onOffThresholdVal,
        offWindowWidth: offWindowWidthVal
      }).gsplat;
      
      return { gsplat };
    },
  );
}
