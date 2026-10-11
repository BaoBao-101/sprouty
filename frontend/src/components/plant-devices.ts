import * as T from 'three';
import type { DeviceType } from '@/types/plant';

/**
 * The kit's parts, built into the pot of the 3D plant.
 *
 * The IoT board below the plant used to be a world of its own: wiring a
 * sensor there changed nothing on the plant. Now whatever is wired on the
 * board stands in the pot too — probes in the soil, a lamp over the leaves —
 * and what is switched on does something you can see: the lamp lights the
 * plant, the pump drips, the fan turns.
 *
 * Soil surface is y=0 and the pot rim sits at a radius of about 0.65, as in
 * plant-model.ts. Angles are around the pot; the camera looks from about 55°.
 */

export interface Gadget {
  type: DeviceType;
  /** Actuators: switched on. Sensors are always live once wired. */
  on: boolean;
}

export interface Gadgets {
  group: T.Group;
  /** True when something moves, so the viewer keeps drawing frames. */
  animated: boolean;
  update: (t: number) => void;
  dispose: () => void;
}

const deg = (d: number) => (d * Math.PI) / 180;
const around = (angle: number, r: number, y: number) => new T.Vector3(Math.cos(deg(angle)) * r, y, Math.sin(deg(angle)) * r);
/** Turns a part so its front (+z) faces out of the pot, towards the viewer side. */
const faceOut = (angle: number) => Math.PI / 2 - deg(angle);
/** …or into the pot, at the plant. */
const faceIn = (angle: number) => -Math.PI / 2 - deg(angle);

export function buildGadgets(list: Gadget[], plantTop: number): Gadgets | null {
  if (!list.length) return null;
  const group = new T.Group();
  group.name = 'gadgets';
  const updates: Array<(t: number) => void> = [];

  const plastic = new T.MeshStandardMaterial({ color: '#F1F1EC', roughness: 0.55 });
  const dark = new T.MeshStandardMaterial({ color: '#3A4046', roughness: 0.5 });
  const metal = new T.MeshStandardMaterial({ color: '#B9C0C6', roughness: 0.35, metalness: 0.6 });
  const board = new T.MeshStandardMaterial({ color: '#2F7D4A', roughness: 0.6 });
  const led = (on: boolean, color = '#4ADE80') =>
    new T.MeshStandardMaterial({ color, emissive: on ? color : '#000000', emissiveIntensity: on ? 1.6 : 0, roughness: 0.4 });

  const add = (parent: T.Object3D, geometry: T.BufferGeometry, material: T.Material, x = 0, y = 0, z = 0) => {
    const m = new T.Mesh(geometry, material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const part = (angle: number, r: number, y: number, rotY: number) => {
    const g = new T.Group();
    g.position.copy(around(angle, r, y));
    g.rotation.y = rotY;
    group.add(g);
    return g;
  };

  for (const { type, on } of list) {
    if (type === 'moisture_sensor') {
      // A fork probe half in the soil, its little green board above it.
      const g = part(18, 0.42, 0, faceOut(18));
      add(g, new T.BoxGeometry(0.018, 0.17, 0.006), metal, -0.03, -0.02, 0);
      add(g, new T.BoxGeometry(0.018, 0.17, 0.006), metal, 0.03, -0.02, 0);
      add(g, new T.BoxGeometry(0.11, 0.12, 0.012), board, 0, 0.11, 0);
      add(g, new T.BoxGeometry(0.05, 0.03, 0.025), plastic, 0, 0.18, 0);
      add(g, new T.SphereGeometry(0.009, 10, 8), led(true), 0.035, 0.14, 0.008);
    } else if (type === 'thermo_sensor') {
      // A white vented box on a stake.
      const g = part(98, 0.44, 0, faceOut(98));
      add(g, new T.CylinderGeometry(0.008, 0.008, 0.24, 8), plastic, 0, 0.06, 0);
      add(g, new T.BoxGeometry(0.085, 0.1, 0.045), plastic, 0, 0.21, 0);
      for (const y of [0.19, 0.21, 0.23]) add(g, new T.BoxGeometry(0.06, 0.006, 0.002), dark, 0, y, 0.024);
    } else if (type === 'light_sensor') {
      // A small dome looking up at the sky.
      const g = part(160, 0.44, 0, faceOut(160));
      add(g, new T.CylinderGeometry(0.008, 0.008, 0.3, 8), plastic, 0, 0.09, 0);
      add(g, new T.CylinderGeometry(0.04, 0.04, 0.022, 20), plastic, 0, 0.25, 0);
      const dome = new T.MeshStandardMaterial({ color: '#FFFBEA', emissive: '#FFF3C4', emissiveIntensity: 0.25, roughness: 0.2 });
      add(g, new T.SphereGeometry(0.032, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), dome, 0, 0.26, 0);
    } else if (type === 'nutrient_sensor') {
      // A metal rod with a blue cap.
      const g = part(-38, 0.4, 0, faceOut(-38));
      add(g, new T.CylinderGeometry(0.01, 0.01, 0.2, 10), metal, 0, 0.02, 0);
      add(g, new T.CylinderGeometry(0.024, 0.024, 0.07, 14), new T.MeshStandardMaterial({ color: '#3B82C4', roughness: 0.4 }), 0, 0.15, 0);
      add(g, new T.SphereGeometry(0.008, 10, 8), led(true, '#60A5FA'), 0, 0.19, 0);
    } else if (type === 'camera') {
      // Clipped to the far rim, raised, looking at the plant; red light while it watches.
      const a = 232;
      const g = part(a, 0.64, 0.04, faceIn(a));
      add(g, new T.BoxGeometry(0.07, 0.06, 0.09), dark, 0, 0, 0);
      add(g, new T.CylinderGeometry(0.009, 0.009, 0.46, 8), dark, 0, 0.25, 0);
      add(g, new T.BoxGeometry(0.11, 0.075, 0.08), plastic, 0, 0.5, 0);
      const lens = add(g, new T.CylinderGeometry(0.026, 0.026, 0.035, 18), dark, 0, 0.5, 0.055);
      lens.rotation.x = Math.PI / 2;
      add(g, new T.SphereGeometry(0.009, 10, 8), led(true, '#EF4444'), 0.04, 0.525, 0.041);
    } else if (type === 'grow_light') {
      // A clamp lamp on the rim, its shade beside the plant and tilted in at
      // it, so it stays in the picture however tall the plant grows. Switched
      // on, it throws warm light on the leaves.
      const a = -30;
      const lampY = Math.min(1.15, Math.max(0.7, plantTop * 0.8));
      const base = around(a, 0.66, 0);
      const head = around(a, 0.34, lampY);
      const aim = new T.Vector3(0, Math.min(0.5, plantTop * 0.5), 0);
      const pole = add(group, new T.CylinderGeometry(0.014, 0.014, lampY + 0.2, 10), dark);
      pole.position.set(base.x, (lampY + 0.2) / 2 - 0.05, base.z);
      const top = new T.Vector3(base.x, lampY + 0.13, base.z);
      const arm = add(group, new T.CylinderGeometry(0.011, 0.011, top.distanceTo(head), 8), dark);
      arm.position.copy(top).add(head).multiplyScalar(0.5);
      arm.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), head.clone().sub(top).normalize());
      // The shade's open side (-y) points at the plant.
      const lamp = new T.Group();
      lamp.position.copy(head);
      lamp.quaternion.setFromUnitVectors(new T.Vector3(0, -1, 0), aim.clone().sub(head).normalize());
      group.add(lamp);
      add(lamp, new T.CylinderGeometry(0.06, 0.12, 0.08, 24, 1, true), new T.MeshStandardMaterial({ color: '#3A4046', roughness: 0.5, side: T.DoubleSide }));
      const glow = new T.MeshStandardMaterial({
        color: on ? '#FFE3A3' : '#9AA0A6',
        emissive: on ? '#FFC867' : '#000000',
        emissiveIntensity: on ? 1.8 : 0,
        roughness: 0.3,
        side: T.DoubleSide,
      });
      add(lamp, new T.CircleGeometry(0.1, 24), glow, 0, -0.03, 0).rotation.x = Math.PI / 2;
      // The bulb pokes out of the shade, so it reads as lit from any side.
      add(lamp, new T.SphereGeometry(0.045, 18, 12), glow, 0, -0.045, 0);
      if (on) {
        const light = new T.PointLight('#FFC56B', 4, 3, 1.5);
        light.position.set(0, -0.12, 0);
        lamp.add(light);
        // A faint cone, just enough to see where the light falls.
        const reach = head.distanceTo(aim) + 0.15;
        const beam = add(
          lamp,
          new T.ConeGeometry(0.42, reach, 32, 1, true),
          new T.MeshBasicMaterial({ color: '#FFD98A', transparent: true, opacity: 0.08, depthWrite: false, side: T.DoubleSide }),
          0, -reach / 2, 0,
        );
        beam.renderOrder = 1;
      }
    } else if (type === 'water_pump') {
      // A hose up the side of the pot and over the rim, ending in a dripper.
      const a = 76;
      const path = new T.CatmullRomCurve3([
        around(a, 0.66, -0.55), around(a, 0.7, 0.06), around(a, 0.6, 0.15), around(a, 0.42, 0.1), around(a, 0.36, 0.05),
      ]);
      const hose = new T.MeshStandardMaterial({
        color: on ? '#4FB3E8' : '#9FB7C4', transparent: true, opacity: 0.9, roughness: 0.25,
      });
      add(group, new T.TubeGeometry(path, 32, 0.013, 8, false), hose);
      const tip = around(a, 0.36, 0.05);
      add(group, new T.CylinderGeometry(0.02, 0.012, 0.035, 12), dark, tip.x, tip.y, tip.z);
      if (on) {
        const water = new T.MeshStandardMaterial({ color: '#38BDF8', transparent: true, opacity: 0.85, roughness: 0.1 });
        const drops = [0, 1, 2].map(() => add(group, new T.SphereGeometry(0.011, 10, 8), water, tip.x, tip.y, tip.z));
        updates.push((t) => {
          drops.forEach((d, i) => {
            const k = (t * 0.9 + i / 3) % 1;
            d.position.y = tip.y - 0.03 - k * 0.06;
            d.scale.setScalar(1 - k * 0.6);
            (d.material as T.MeshStandardMaterial).opacity = 0.85 * (1 - k);
          });
        });
      }
    } else if (type === 'fan') {
      // A clip-on fan on the rim blowing across the plant; the blades turn when on.
      const a = 128;
      const g = part(a, 0.66, 0.06, faceIn(a));
      add(g, new T.BoxGeometry(0.06, 0.08, 0.06), dark, 0, 0, 0);
      add(g, new T.CylinderGeometry(0.008, 0.008, 0.14, 8), dark, 0, 0.1, 0);
      const fan = new T.Group();
      fan.position.set(0, 0.24, 0.02);
      g.add(fan);
      add(fan, new T.TorusGeometry(0.1, 0.008, 8, 32), dark);
      add(fan, new T.CylinderGeometry(0.022, 0.022, 0.03, 14), plastic).rotation.x = Math.PI / 2;
      const blades = new T.Group();
      fan.add(blades);
      for (let i = 0; i < 4; i++) {
        const b = add(blades, new T.BoxGeometry(0.035, 0.085, 0.004), plastic, 0, 0.045, 0);
        const pivot = new T.Group();
        pivot.rotation.z = (i * Math.PI) / 2;
        pivot.add(b);
        blades.add(pivot);
      }
      if (on) updates.push((t) => (blades.rotation.z = -t * 9));
    }
  }

  return {
    group,
    animated: updates.length > 0,
    update: (t) => updates.forEach((u) => u(t)),
    dispose: () => {
      group.traverse((obj) => {
        if (obj instanceof T.Mesh) {
          obj.geometry.dispose();
          (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => m.dispose());
        }
      });
    },
  };
}
