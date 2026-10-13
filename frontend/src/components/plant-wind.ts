import * as T from 'three';

/**
 * Wind on the 3D plant — a VIP garden's plant is alive.
 *
 * A free-standing plant bends rather than rocks: each vertex moves by the
 * square of its height above the soil, so the base stays put and the tip
 * travels furthest, the way a stem bends in a breeze. A faster, smaller
 * flutter on top makes the leaves tremble.
 *
 * A plant on a support (the bean's cane, the tomato's stake) is tied to it,
 * and a cane in the soil does not sway. So the cane and the stem stand still
 * and only what reaches out from the stem moves, by its distance from it:
 * leaves and pods flap, their stalks stay joined to the stem.
 *
 * It runs in the vertex shader because the leaves are merged into a few
 * meshes (plant-model.ts batches them) and cannot be moved one by one.
 *
 * "breeze" is a VIP plant on a still day; "fan" is with the IoT fan switched
 * on. A regular account's plant stands still ("off").
 */
export type Wind = 'off' | 'breeze' | 'fan';

export const WIND: Record<Wind, { bend: number; flutter: number; speed: number }> = {
  off: { bend: 0, flutter: 0, speed: 0.6 },
  breeze: { bend: 0.03, flutter: 0.004, speed: 1.3 },
  fan: { bend: 0.085, flutter: 0.014, speed: 2.8 },
};

export type WindUniforms = {
  uWindTime: { value: number };
  uWindBend: { value: number };
  uWindFlutter: { value: number };
};

export function windUniforms(): WindUniforms {
  return { uWindTime: { value: 0 }, uWindBend: { value: 0 }, uWindFlutter: { value: 0 } };
}

// Positions are the plant's own: the soil surface is y=0 and the stem rises
// along the y axis (plant-model.ts).
const FREE = `#include <begin_vertex>
  {
    vec3 windP = transformed;
    float windH = max(windP.y, 0.0);
    float windSway = sin(uWindTime + windP.y * 1.7) * 0.8 + sin(uWindTime * 0.53 + 1.3) * 0.4;
    transformed.x += windSway * uWindBend * windH * windH;
    transformed.z += cos(uWindTime * 0.8 + windP.y * 1.3) * uWindBend * 0.5 * windH * windH;
    transformed.x += sin(uWindTime * 5.3 + windP.x * 23.0 + windP.z * 19.0) * uWindFlutter * windH;
    transformed.y += cos(uWindTime * 4.7 + windP.z * 21.0) * uWindFlutter * 0.6 * windH;
  }`;

const TIED = `#include <begin_vertex>
  {
    vec3 windP = transformed;
    float windReach = max(length(windP.xz) - 0.06, 0.0) * smoothstep(0.0, 0.12, windP.y);
    float windSway = sin(uWindTime + windP.y * 1.7) * 0.8 + sin(uWindTime * 0.53 + 1.3) * 0.4;
    transformed.x += windSway * uWindBend * 1.3 * windReach;
    transformed.z += cos(uWindTime * 0.8 + windP.y * 1.3) * uWindBend * 0.6 * windReach;
    transformed.y += sin(uWindTime * 1.1 + windP.x * 3.0) * uWindBend * 0.5 * windReach;
    transformed.x += sin(uWindTime * 5.3 + windP.x * 23.0 + windP.z * 19.0) * uWindFlutter * 3.0 * windReach;
    transformed.y += cos(uWindTime * 4.7 + windP.z * 21.0) * uWindFlutter * 2.0 * windReach;
  }`;

/**
 * Lets the plant (not the pot, soil or devices) move in the wind. The plant
 * group says whether it is tied to a support (`userData.tied`); a material
 * marked `userData.still` — the cane, the twine — never moves.
 */
export function applyWind(plant: T.Object3D | undefined, uniforms: WindUniforms) {
  if (!plant) return;
  const tied = plant.userData.tied === true;
  plant.traverse((obj) => {
    if (!(obj instanceof T.Mesh)) return;
    const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const material of materials as T.Material[]) {
      if (material.userData.wind || material.userData.still) continue;
      material.userData.wind = true;
      material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader =
          'uniform float uWindTime;\nuniform float uWindBend;\nuniform float uWindFlutter;\n' +
          shader.vertexShader.replace('#include <begin_vertex>', tied ? TIED : FREE);
      };
      material.customProgramCacheKey = () => (tied ? 'sprouty-wind-tied' : 'sprouty-wind');
      material.needsUpdate = true;
    }
  });
}
