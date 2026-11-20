import * as THREE from 'three';
import { CoreEntityKind, CoreLinkKind, ThemeContext, ThemeDefinition, ThemeEnvironment, WorldMode } from './types';

export function getMinimalEnvironment(world: WorldMode): ThemeEnvironment {
  const isM = world === 'M';
  return {
    backgroundColor: isM ? 0x050814 : 0x120c08,
    fogColor: isM ? 0x050814 : 0x120c08,
    fogDensity: 0.012,
    gridPrimaryColor: isM ? 0x1b2a48 : 0x4a2d1a,
    gridSecondaryColor: isM ? 0x2f4c7a : 0x74452a,
    bloomStrength: isM ? 0.25 : 0.15,
    bloomRadius: 0.2,
    bloomThreshold: 0.9,
  };
}

function createMinimalMaterial(ctx: ThemeContext, colorHex?: number): THREE.MeshStandardMaterial {
  const isM = ctx.world === 'M';
  const defaultColor = isM ? 0x8cc8ff : 0xffb168;
  const color = colorHex ?? defaultColor;
  const selectionColor = isM ? 0x00ff88 : 0x00e676;
  return new THREE.MeshStandardMaterial({
    color,
    emissive: ctx.selected ? selectionColor : isM ? 0x1a334d : 0x000000,
    emissiveIntensity: ctx.selected ? (isM ? 0.75 : 0.6) : isM ? 0.3 : 0,
    roughness: isM ? 0.2 : 0.55,
    metalness: isM ? 0.1 : 0.4,
    transparent: isM,
    opacity: isM ? 0.4 : 1.0,
  });
}

function addMinimalEdges(mesh: THREE.Mesh, colorHex: number): void {
  const edges = new THREE.EdgesGeometry(mesh.geometry);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity: 0.85 })
  );
  mesh.add(line);
}

export function createMinimalEntity(kind: CoreEntityKind, ctx: ThemeContext): THREE.Group {
  const group = new THREE.Group();
  const isM = ctx.world === 'M';
  const edgeColor = isM ? 0x8cc8ff : 0xffa726;
  const baseMat = createMinimalMaterial(ctx);
  const accentMat = createMinimalMaterial(ctx, isM ? 0x00e5ff : 0xff7043);

  switch (kind) {
    case 'Class': {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.0, 1.2), baseMat);
      addMinimalEdges(box, edgeColor);
      group.add(box);
      break;
    }

    case 'AbstractClass': {
      const geo = new THREE.BoxGeometry(1.6, 1.0, 1.2);
      const edges = new THREE.EdgesGeometry(geo);
      const wire = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: isM ? 0x8cc8ff : 0xffb74d })
      );
      const inner = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), accentMat);
      inner.name = 'rotor';
      group.add(wire, inner);
      break;
    }

    case 'Interface': {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.1, 12, 24), baseMat);
      addMinimalEdges(ring, edgeColor);
      group.add(ring);
      break;
    }

    case 'Struct': {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1.0), baseMat);
      addMinimalEdges(box, edgeColor);
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.84, 1.04), accentMat);
      group.add(box, rib);
      break;
    }

    case 'Enum': {
      const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.45, 16), baseMat);
      addMinimalEdges(cylinder, edgeColor);
      cylinder.name = 'rotor';
      group.add(cylinder);
      break;
    }

    case 'Store': {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.5, 0.9), baseMat);
      addMinimalEdges(rack, edgeColor);
      for (let i = -0.4; i <= 0.4; i += 0.4) {
        const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.94), accentMat);
        shelf.position.y = i;
        group.add(shelf);
      }
      group.add(rack);
      break;
    }

    case 'Channel': {
      const channel = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 0.6), baseMat);
      addMinimalEdges(channel, edgeColor);
      group.add(channel);
      break;
    }

    case 'Process':
    default: {
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 16), baseMat);
      cyl.rotation.z = Math.PI / 2;
      addMinimalEdges(cyl, edgeColor);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), accentMat);
      core.name = 'rotor';
      group.add(cyl, core);
      break;
    }
  }

  return group;
}

export function updateMinimalEntity(
  group: THREE.Group,
  _kind: CoreEntityKind,
  ctx: ThemeContext,
  elapsed: number
): void {
  const rotor = group.getObjectByName('rotor');
  if (!rotor) return;

  if (ctx.world === 'M') {
    rotor.rotation.y = elapsed * 0.5;
  } else {
    rotor.rotation.y = elapsed * 1.5;
  }
}

export function createMinimalLink(
  kind: CoreLinkKind,
  points: THREE.Vector3[],
  ctx: ThemeContext
): THREE.Group {
  const group = new THREE.Group();
  const isM = ctx.world === 'M';
  const curve = new THREE.CatmullRomCurve3(points);

  const radius = kind === 'Inheritance' || kind === 'Composition' ? 0.05 : 0.035;
  const tubeGeo = new THREE.TubeGeometry(curve, 24, radius, 8, false);
  const tubeMat = new THREE.MeshStandardMaterial({
    color: isM ? 0x8fb8ff : kind === 'Inheritance' ? 0x90a4ae : 0xff7a3d,
    transparent: isM,
    opacity: isM ? 0.4 : 0.85,
    roughness: 0.5,
  });

  const tube = new THREE.Mesh(tubeGeo, tubeMat);
  group.add(tube);

  if (kind === 'DataFlow' || kind === 'ControlFlow') {
    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({ color: isM ? 0x00e5ff : 0xff7043 })
    );
    pulse.name = 'dataPulse';
    pulse.userData.curve = curve;
    group.add(pulse);
  }

  return group;
}

export function updateMinimalLink(
  group: THREE.Group,
  kind: CoreLinkKind,
  ctx: ThemeContext,
  elapsed: number
): void {
  const pulse = group.getObjectByName('dataPulse') as THREE.Mesh | undefined;
  if (!pulse || !pulse.userData.curve) return;

  const isFlow = kind === 'DataFlow' || kind === 'ControlFlow';
  pulse.visible = ctx.world === 'R' && isFlow;
  if (pulse.visible) {
    const t = (elapsed * 0.4) % 1;
    const pos = (pulse.userData.curve as THREE.CatmullRomCurve3).getPointAt(t);
    pulse.position.copy(pos);
  }
}

export const minimalV0Theme: ThemeDefinition = {
  id: 'minimal-v0',
  label: 'Minimal (v0)',
  description: 'Резервная минималистичная тема: простые геометрические силуэты и линии.',
  getEnvironment: getMinimalEnvironment,
  createEntityObject: createMinimalEntity,
  updateEntityObject: updateMinimalEntity,
  createLinkObject: createMinimalLink,
  updateLinkObject: updateMinimalLink,
};
