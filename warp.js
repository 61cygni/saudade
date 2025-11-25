// Warp Module
// Handles the warp/pulse animation effect for splat meshes using DynoBlock

/**
 * Create a warp modifier for a splat mesh
 * @param {object} dyno - The dyno library object
 * @param {object} animateT - The animated time value (dynoFloat)
 * @returns {object} The objectModifier to be assigned to a SplatMesh
 */
export function createWarpModifier(dyno, animateT) {
  const applyWarp = dyno.dynoBool(true);
  
  return dyno.dynoBlock(
    { gsplat: dyno.Gsplat },
    { gsplat: dyno.Gsplat },
    ({ gsplat }) => {
      // Create an inline GLSL block that has all the inputs we need
      const d = new dyno.Dyno({
        inTypes: { gsplat: dyno.Gsplat, t: "float", applyWarp: "bool" },
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
          `)
        ],
        statements: ({ inputs, outputs }) => dyno.unindentLines(`
          ${outputs.gsplat} = ${inputs.gsplat};
          if(${inputs.applyWarp}) {
            ${outputs.gsplat}.center = warp(${inputs.gsplat}.center, ${inputs.t});
            ${outputs.gsplat}.scales = pulse(${inputs.gsplat}.scales, ${inputs.gsplat}.center, ${inputs.t});
          }
        `),
      });
      // Apply the GLSL block with appropriate inputs and return the output
      gsplat = d.apply({ gsplat, t: animateT, applyWarp: applyWarp }).gsplat;
      return { gsplat };
    },
  );
}

