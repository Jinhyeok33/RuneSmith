'use client';

import { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { SkillBlueprint, MaterialElement } from '@runesmith/shared';

// ── Color Palette Map ──
const ELEMENT_COLORS: Record<string, { primary: number; secondary: number; emissive: number }> = {
  Fire:      { primary: 0xf97316, secondary: 0xfbbf24, emissive: 0xf97316 },
  Ice:       { primary: 0x38bdf8, secondary: 0xbae6fd, emissive: 0x38bdf8 },
  Lightning: { primary: 0xfacc15, secondary: 0xffffff, emissive: 0xfacc15 },
  Void:      { primary: 0x6b21a8, secondary: 0x1e1b4b, emissive: 0x3b0764 },
  Nature:    { primary: 0x22c55e, secondary: 0x86efac, emissive: 0x22c55e },
  Arcane:    { primary: 0xa855f7, secondary: 0xe9d5ff, emissive: 0xa855f7 },
  Water:     { primary: 0x0ea5e9, secondary: 0xbae6fd, emissive: 0x0ea5e9 },
  Earth:     { primary: 0x92400e, secondary: 0xd97706, emissive: 0x92400e },
  Wind:      { primary: 0xe2e8f0, secondary: 0x94a3b8, emissive: 0x94a3b8 },
  Holy:      { primary: 0xfef08a, secondary: 0xffffff, emissive: 0xfef08a },
  Shadow:    { primary: 0x171717, secondary: 0x404040, emissive: 0x171717 },
  Blood:     { primary: 0xdc2626, secondary: 0x450a0a, emissive: 0xdc2626 },
  Metal:     { primary: 0xd4d4d8, secondary: 0x71717a, emissive: 0x71717a },
  Crystal:   { primary: 0xe879f9, secondary: 0x67e8f9, emissive: 0xe879f9 },
};

function getColors(element: string) {
  return ELEMENT_COLORS[element] ?? ELEMENT_COLORS.Fire;
}

// ── Geometry Factory ──
function createCoreGeometry(shape: string): THREE.BufferGeometry {
  switch (shape) {
    case 'Spear': case 'Needle': return new THREE.ConeGeometry(0.15, 2.5, 6);
    case 'Blade': return new THREE.BoxGeometry(0.8, 0.05, 2);
    case 'Arrow': return new THREE.ConeGeometry(0.2, 1.5, 3);
    case 'Shard': return new THREE.IcosahedronGeometry(0.4, 0);
    case 'Sphere': case 'Orb': return new THREE.SphereGeometry(0.4, 16, 16);
    case 'Bubble': return new THREE.SphereGeometry(0.5, 16, 16);
    case 'Meteor': return new THREE.DodecahedronGeometry(0.6, 1);
    case 'Ring': return new THREE.TorusGeometry(1.2, 0.05, 8, 32);
    case 'Disc': return new THREE.CylinderGeometry(0.6, 0.6, 0.05, 16);
    case 'Sigil': return new THREE.PlaneGeometry(1.5, 1.5);
    case 'Wave': return new THREE.PlaneGeometry(3, 3, 16, 16);
    case 'Beam_Geo': return new THREE.CylinderGeometry(0.1, 0.1, 5, 8);
    case 'Whip': return new THREE.CylinderGeometry(0.03, 0.03, 3, 6);
    case 'Arc': return new THREE.TorusGeometry(2, 0.04, 6, 16, Math.PI);
    case 'Swarm': return new THREE.SphereGeometry(0.1, 4, 4);
    case 'Vortex': return new THREE.ConeGeometry(1, 3, 16, 1, true);
    case 'Fractal': return new THREE.IcosahedronGeometry(0.3, 2);
    default: return new THREE.SphereGeometry(0.4, 16, 16);
  }
}

// ── Spell Animation ──
interface SpellAnimation {
  objects: THREE.Object3D[];
  update: (dt: number, t: number) => boolean; // returns true when done
}

function createProjectileAnimation(
  scene: THREE.Scene,
  element: string,
  geometry: string,
  bloom: UnrealBloomPass,
): SpellAnimation {
  const colors = getColors(element);
  const objects: THREE.Object3D[] = [];

  // Core mesh
  const geo = createCoreGeometry(geometry);
  const mat = new THREE.MeshStandardMaterial({
    color: colors.primary,
    emissive: colors.emissive,
    emissiveIntensity: 3,
    transparent: true,
    opacity: 0.9,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 2, 8);
  if (geometry === 'Spear' || geometry === 'Needle' || geometry === 'Arrow') {
    mesh.rotation.x = Math.PI / 2;
  }
  scene.add(mesh);
  objects.push(mesh);

  // Point light
  const light = new THREE.PointLight(colors.primary, 5, 12);
  mesh.add(light);

  // Trail particles
  const trailGeo = new THREE.BufferGeometry();
  const maxTrail = 500;
  const trailPositions = new Float32Array(maxTrail * 3);
  let trailIdx = 0;
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
  const trailMat = new THREE.PointsMaterial({
    color: colors.secondary,
    size: 0.15,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const trail = new THREE.Points(trailGeo, trailMat);
  scene.add(trail);
  objects.push(trail);

  // Explosion particles
  const explGeo = new THREE.BufferGeometry();
  const explCount = 300;
  const explPositions = new Float32Array(explCount * 3);
  const explVelocities: THREE.Vector3[] = [];
  explGeo.setAttribute('position', new THREE.BufferAttribute(explPositions, 3));
  const explMat = new THREE.PointsMaterial({
    color: colors.primary,
    size: 0.12,
    transparent: true,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const expl = new THREE.Points(explGeo, explMat);
  expl.visible = false;
  scene.add(expl);
  objects.push(expl);

  const explLight = new THREE.PointLight(colors.primary, 0, 20);
  explLight.position.set(0, 2, -2);
  scene.add(explLight);
  objects.push(explLight);

  let time = 0;
  let phase = 0;
  let cameraShakeRef = { value: 0 };

  function update(dt: number, t: number): boolean {
    time += dt;

    if (phase === 0) {
      const p = Math.min(1, time / 1.2);
      const ep = p * p * (3 - 2 * p);
      mesh.position.z = 8 - 10 * ep;
      mesh.position.y = 2 + Math.sin(p * Math.PI) * 2;
      mesh.position.x = Math.sin(p * 4) * 0.3;

      const s = 1 + Math.sin(t * 15) * 0.15;
      mesh.scale.set(s, s, s);

      // Trail
      const idx = trailIdx % maxTrail;
      trailPositions[idx * 3] = mesh.position.x + (Math.random() - 0.5) * 0.3;
      trailPositions[idx * 3 + 1] = mesh.position.y + (Math.random() - 0.5) * 0.3;
      trailPositions[idx * 3 + 2] = mesh.position.z + (Math.random() - 0.5) * 0.3;
      trailIdx++;
      trailGeo.attributes.position.needsUpdate = true;
      trailGeo.setDrawRange(0, Math.min(trailIdx, maxTrail));

      light.intensity = 3 + Math.sin(t * 20);

      if (p >= 1) {
        phase = 1;
        time = 0;
        mesh.visible = false;
        expl.visible = true;
        const pos = new THREE.Vector3(0, 2, -2);
        for (let i = 0; i < explCount; i++) {
          const dir = new THREE.Vector3(
            Math.random() - 0.5,
            Math.random() - 0.5,
            Math.random() - 0.5,
          ).normalize();
          explVelocities.push(dir.multiplyScalar(2 + Math.random() * 6));
          explPositions[i * 3] = pos.x;
          explPositions[i * 3 + 1] = pos.y;
          explPositions[i * 3 + 2] = pos.z;
        }
        explLight.intensity = 15;
        bloom.strength = 2.5;
      }
    } else if (phase === 1) {
      const fade = Math.max(0, 1 - time / 2);
      for (let i = 0; i < explCount; i++) {
        const v = explVelocities[i];
        if (!v) continue;
        explPositions[i * 3] += v.x * dt;
        explPositions[i * 3 + 1] += v.y * dt - dt * 2;
        explPositions[i * 3 + 2] += v.z * dt;
      }
      explGeo.attributes.position.needsUpdate = true;
      explMat.opacity = fade * 0.8;
      explLight.intensity = fade * 15;
      bloom.strength = 1.2 + fade * 1.5;

      if (time > 2.5) {
        bloom.strength = 1.2;
        return true;
      }
    }
    return false;
  }

  return { objects, update };
}

function createBeamAnimation(
  scene: THREE.Scene,
  element: string,
  bloom: UnrealBloomPass,
): SpellAnimation {
  const colors = getColors(element);
  const objects: THREE.Object3D[] = [];

  const beamGeo = new THREE.CylinderGeometry(0.15, 0.3, 0.01, 8);
  const beamMat = new THREE.MeshBasicMaterial({
    color: colors.primary,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.set(0, 0, 0);
  scene.add(beam);
  objects.push(beam);

  const light = new THREE.PointLight(colors.primary, 0, 15);
  light.position.set(0, 3, 0);
  scene.add(light);
  objects.push(light);

  // Magic circle
  const ringGeo = new THREE.TorusGeometry(2, 0.03, 8, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: colors.primary,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, 0.05, 0);
  scene.add(ring);
  objects.push(ring);

  let time = 0;

  function update(dt: number, t: number): boolean {
    time += dt;
    const dur = 3.5;
    const appear = Math.min(1, time / 0.8);
    const fade = time > dur - 1 ? Math.max(0, dur - time) : 1;
    const a = appear * fade;

    ring.rotation.z = t * 0.5;
    ringMat.opacity = a * 0.7;
    const rs = Math.min(1, time / 0.5);
    ring.scale.set(rs, rs, rs);

    if (time > 0.5) {
      const bp = Math.min(1, (time - 0.5) / 0.5) * fade;
      const h = bp * 10;
      beam.geometry.dispose();
      beam.geometry = new THREE.CylinderGeometry(0.15 * bp, 0.3 * bp, h, 8);
      beam.position.y = h / 2;
      beamMat.opacity = bp * 0.6;
      light.intensity = bp * 8;
      bloom.strength = 1.2 + bp * 0.8;
    }

    if (time > dur) {
      bloom.strength = 1.2;
      return true;
    }
    return false;
  }

  return { objects, update };
}

function createLightningAnimation(
  scene: THREE.Scene,
  bloom: UnrealBloomPass,
): SpellAnimation {
  const colors = getColors('Lightning');
  const objects: THREE.Object3D[] = [];
  const boltMeshes: THREE.Mesh[] = [];

  // Charge particles
  const cpGeo = new THREE.BufferGeometry();
  const cpCount = 60;
  const cpPositions = new Float32Array(cpCount * 3);
  const cpData: { angle: number; angleY: number; dist: number; speed: number; speedY: number }[] = [];
  for (let i = 0; i < cpCount; i++) {
    cpData.push({
      angle: Math.random() * Math.PI * 2,
      angleY: Math.random() * Math.PI * 2,
      dist: 2 + Math.random() * 4,
      speed: 0.5 + Math.random(),
      speedY: 0.3 + Math.random() * 0.5,
    });
  }
  cpGeo.setAttribute('position', new THREE.BufferAttribute(cpPositions, 3));
  const cpMat = new THREE.PointsMaterial({
    color: 0xfacc15,
    size: 0.1,
    transparent: true,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const cpMesh = new THREE.Points(cpGeo, cpMat);
  scene.add(cpMesh);
  objects.push(cpMesh);

  const boltLight = new THREE.PointLight(0xfacc15, 0, 25);
  boltLight.position.set(0, 5, -2);
  scene.add(boltLight);
  objects.push(boltLight);

  function subdivide(result: THREE.Vector3[], a: THREE.Vector3, b: THREE.Vector3, depth: number) {
    if (depth <= 0) return;
    const mid = a.clone().lerp(b, 0.5);
    const offset = a.distanceTo(b) * 0.3;
    mid.x += (Math.random() - 0.5) * offset;
    mid.z += (Math.random() - 0.5) * offset * 0.5;
    subdivide(result, a, mid, depth - 1);
    result.push(mid);
    subdivide(result, mid, b, depth - 1);
  }

  function createBoltMesh(start: THREE.Vector3, end: THREE.Vector3) {
    const points = [start.clone()];
    subdivide(points, start, end, 5);
    points.push(end.clone());
    const curve = new THREE.CatmullRomCurve3(points);
    const tubeGeo = new THREE.TubeGeometry(curve, 40, 0.06, 4, false);
    const tubeMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    scene.add(tube);
    boltMeshes.push(tube);
    objects.push(tube);

    const coreGeo = new THREE.TubeGeometry(curve, 40, 0.02, 3, false);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);
    boltMeshes.push(core);
    objects.push(core);
  }

  let time = 0;
  let phase = 0;
  const target = new THREE.Vector3(0, 2, -2);

  function update(dt: number, t: number): boolean {
    time += dt;

    if (phase === 0) {
      const cp = Math.min(1, time / 1.5);
      for (let i = 0; i < cpCount; i++) {
        const d = cpData[i];
        d.angle += d.speed * dt;
        d.angleY += d.speedY * dt;
        const dist = d.dist * (1 - cp * 0.9);
        cpPositions[i * 3] = target.x + Math.cos(d.angle) * dist;
        cpPositions[i * 3 + 1] = target.y + Math.sin(d.angleY) * dist * 0.5;
        cpPositions[i * 3 + 2] = target.z + Math.sin(d.angle) * dist;
      }
      cpGeo.attributes.position.needsUpdate = true;
      cpMat.opacity = cp;

      if (cp >= 1) {
        phase = 1;
        time = 0;
        cpMesh.visible = false;
        const skyPos = new THREE.Vector3((Math.random() - 0.5) * 2, 15, -2 + (Math.random() - 0.5) * 2);
        createBoltMesh(skyPos, target);
        boltLight.intensity = 20;
        bloom.strength = 3;
      }
    } else if (phase === 1) {
      const fade = Math.max(0, 1 - time / 1.5);

      if (time < 0.6 && Math.random() > 0.5) {
        boltMeshes.forEach((m) => {
          scene.remove(m);
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        });
        boltMeshes.length = 0;
        const skyPos = new THREE.Vector3((Math.random() - 0.5) * 2, 15, -2 + (Math.random() - 0.5) * 2);
        createBoltMesh(skyPos, target);
      }

      boltMeshes.forEach((m) => {
        (m.material as THREE.MeshBasicMaterial).opacity = fade;
      });
      boltLight.intensity = fade * 20 * (0.5 + Math.random() * 0.5);
      bloom.strength = 1.2 + fade * 2;

      if (time > 2) {
        bloom.strength = 1.2;
        return true;
      }
    }
    return false;
  }

  return { objects, update };
}

function createAoEAnimation(
  scene: THREE.Scene,
  element: string,
  bloom: UnrealBloomPass,
): SpellAnimation {
  const colors = getColors(element);
  const objects: THREE.Object3D[] = [];

  // Ground circle expanding
  const ringGeo = new THREE.TorusGeometry(0.1, 0.05, 8, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: colors.primary,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, 0.1, -2);
  scene.add(ring);
  objects.push(ring);

  // Particles rising from center
  const partGeo = new THREE.BufferGeometry();
  const partCount = 200;
  const partPositions = new Float32Array(partCount * 3);
  const partVels: THREE.Vector3[] = [];
  for (let i = 0; i < partCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * 2;
    partPositions[i * 3] = Math.cos(angle) * dist;
    partPositions[i * 3 + 1] = Math.random() * 0.5;
    partPositions[i * 3 + 2] = -2 + Math.sin(angle) * dist;
    partVels.push(new THREE.Vector3(0, 1 + Math.random() * 3, 0));
  }
  partGeo.setAttribute('position', new THREE.BufferAttribute(partPositions, 3));
  const partMat = new THREE.PointsMaterial({
    color: colors.secondary,
    size: 0.1,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const parts = new THREE.Points(partGeo, partMat);
  scene.add(parts);
  objects.push(parts);

  const light = new THREE.PointLight(colors.primary, 0, 15);
  light.position.set(0, 1, -2);
  scene.add(light);
  objects.push(light);

  let time = 0;

  function update(dt: number, t: number): boolean {
    time += dt;
    const dur = 3;
    const fade = time > dur - 1 ? Math.max(0, dur - time) : 1;

    // Expand ring
    const scale = Math.min(3, time * 2);
    ring.scale.set(scale, scale, scale);
    ringMat.opacity = fade * 0.6;

    // Rise particles
    for (let i = 0; i < partCount; i++) {
      partPositions[i * 3 + 1] += partVels[i].y * dt;
    }
    partGeo.attributes.position.needsUpdate = true;
    partMat.opacity = fade * 0.7;

    light.intensity = fade * 8;
    bloom.strength = 1.2 + fade * 0.5;

    if (time > dur) {
      bloom.strength = 1.2;
      return true;
    }
    return false;
  }

  return { objects, update };
}

// ── Skill → Animation Mapping ──
function createSkillAnimation(
  scene: THREE.Scene,
  skill: SkillBlueprint,
  bloom: UnrealBloomPass,
): SpellAnimation {
  const delivery = skill.mechanics.delivery;
  const element = skill.vfx.material;
  const geometry = skill.vfx.geometry;

  if (delivery === 'Projectile' || delivery === 'Bolt') {
    return createProjectileAnimation(scene, element, geometry, bloom);
  }
  if (delivery === 'Beam') {
    return createBeamAnimation(scene, element, bloom);
  }
  if (delivery === 'Strike' && element === 'Lightning') {
    return createLightningAnimation(scene, bloom);
  }
  if (delivery.startsWith('AoE') || delivery === 'Zone') {
    return createAoEAnimation(scene, element, bloom);
  }
  // Default: projectile
  return createProjectileAnimation(scene, element, geometry, bloom);
}

// ── Main Component ──
interface PreviewCanvasProps {
  skill?: SkillBlueprint | null;
  autoPlay?: boolean;
  className?: string;
}

export default function PreviewCanvas({ skill, autoPlay = false, className }: PreviewCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    composer: EffectComposer;
    bloom: UnrealBloomPass;
    clock: THREE.Clock;
    animation: SpellAnimation | null;
    animationId: number;
    crystal: THREE.Group;
    orbs: THREE.Points;
    cameraShake: number;
  } | null>(null);

  const castSkill = useCallback((skillData: SkillBlueprint) => {
    const state = stateRef.current;
    if (!state) return;

    // Cleanup previous animation
    if (state.animation) {
      state.animation.objects.forEach((o) => {
        state.scene.remove(o);
        if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
        if ((o as THREE.Mesh).material) {
          const mat = (o as THREE.Mesh).material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else (mat as THREE.Material).dispose();
        }
      });
    }

    state.animation = createSkillAnimation(state.scene, skillData, state.bloom);
    state.cameraShake = 0;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    // Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x06030f, 0.015);

    // Camera
    const camera = new THREE.PerspectiveCamera(60, canvas.clientWidth / canvas.clientHeight, 0.1, 200);
    camera.position.set(0, 4, 12);
    camera.lookAt(0, 1, 0);

    // Post-processing
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(canvas.clientWidth, canvas.clientHeight),
      1.2, 0.5, 0.3,
    );
    composer.addPass(bloom);

    // Environment
    const groundGeo = new THREE.PlaneGeometry(60, 60);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a0618, metalness: 0.8, roughness: 0.4 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    const gridHelper = new THREE.GridHelper(40, 40, 0x1a0f30, 0x12091f);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    scene.add(new THREE.AmbientLight(0x1a0f30, 0.8));
    const dirLight = new THREE.DirectionalLight(0x6d28d9, 0.4);
    dirLight.position.set(5, 10, 5);
    scene.add(dirLight);

    // Floating orbs
    const orbGeo = new THREE.BufferGeometry();
    const orbCount = 200;
    const orbPositions = new Float32Array(orbCount * 3);
    const orbColors = new Float32Array(orbCount * 3);
    for (let i = 0; i < orbCount; i++) {
      orbPositions[i * 3] = (Math.random() - 0.5) * 40;
      orbPositions[i * 3 + 1] = Math.random() * 15;
      orbPositions[i * 3 + 2] = (Math.random() - 0.5) * 40;
      const c = new THREE.Color().setHSL(0.75 + Math.random() * 0.1, 0.7, 0.3 + Math.random() * 0.3);
      orbColors[i * 3] = c.r;
      orbColors[i * 3 + 1] = c.g;
      orbColors[i * 3 + 2] = c.b;
    }
    orbGeo.setAttribute('position', new THREE.BufferAttribute(orbPositions, 3));
    orbGeo.setAttribute('color', new THREE.BufferAttribute(orbColors, 3));
    const orbMat = new THREE.PointsMaterial({ size: 0.08, vertexColors: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
    const orbs = new THREE.Points(orbGeo, orbMat);
    scene.add(orbs);

    // Target crystal
    const crystalGroup = new THREE.Group();
    const crystalGeo = new THREE.OctahedronGeometry(0.8, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x6d28d9, emissive: 0x3b0764, emissiveIntensity: 0.5,
      metalness: 0.9, roughness: 0.1, transparent: true, opacity: 0.85,
    });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.scale.set(1, 1.5, 1);
    crystal.position.y = 2;
    crystalGroup.add(crystal);
    const innerGlow = new THREE.PointLight(0x8b5cf6, 2, 8);
    innerGlow.position.y = 2;
    crystalGroup.add(innerGlow);
    crystalGroup.position.set(0, 0, -2);
    scene.add(crystalGroup);

    const clock = new THREE.Clock();

    const state = {
      renderer, scene, camera, composer, bloom, clock,
      animation: null as SpellAnimation | null,
      animationId: 0,
      crystal: crystalGroup,
      orbs,
      cameraShake: 0,
    };
    stateRef.current = state;

    // Animation loop
    function animate() {
      state.animationId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.getElapsedTime();

      // Crystal rotation
      crystal.rotation.y = t * 0.3;

      // Orbs float
      const orbPos = orbs.geometry.attributes.position;
      for (let i = 0; i < orbCount; i++) {
        (orbPos.array as Float32Array)[i * 3 + 1] += Math.sin(t + i) * 0.002;
      }
      orbPos.needsUpdate = true;

      // Spell animation
      if (state.animation) {
        const done = state.animation.update(dt, t);
        if (done) {
          state.animation.objects.forEach((o) => {
            scene.remove(o);
            if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
            if ((o as THREE.Mesh).material) {
              const mat = (o as THREE.Mesh).material;
              if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
              else (mat as THREE.Material).dispose();
            }
          });
          state.animation = null;
        }
      }

      // Camera shake
      if (state.cameraShake > 0) {
        camera.position.x = (Math.random() - 0.5) * state.cameraShake;
        camera.position.y = 4 + (Math.random() - 0.5) * state.cameraShake;
        state.cameraShake *= 0.9;
        if (state.cameraShake < 0.01) {
          state.cameraShake = 0;
          camera.position.set(0, 4, 12);
        }
      }

      composer.render();
    }
    animate();

    // Resize
    const handleResize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    };
    const observer = new ResizeObserver(handleResize);
    observer.observe(canvas);

    // Auto play
    if (autoPlay && skill) {
      castSkill(skill);
    }

    return () => {
      cancelAnimationFrame(state.animationId);
      observer.disconnect();
      renderer.dispose();
    };
  }, []);

  // Re-cast when skill changes
  useEffect(() => {
    if (skill && stateRef.current) {
      castSkill(skill);
    }
  }, [skill, castSkill]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: '100%', height: '100%', display: 'block', background: '#06030f' }}
    />
  );
}

