import * as THREE from 'three';
import { ThemeContext, ThemeEnvironment, WorldMode } from '../types';

export function getIndustrialEnvironment(world: WorldMode): ThemeEnvironment {
  if (world === 'M') {
    return {
      backgroundColor: 0x04121f,
      fogColor: 0x04121f,
      fogDensity: 0.018,
      gridPrimaryColor: 0x00e5ff,
      gridSecondaryColor: 0x0a2e46,
      bloomStrength: 0.75,
      bloomRadius: 0.4,
      bloomThreshold: 0.65,
    };
  }
  return {
    backgroundColor: 0x121518,
    fogColor: 0x121518,
    fogDensity: 0.012,
    gridPrimaryColor: 0x455a64,
    gridSecondaryColor: 0x1e2429,
    bloomStrength: 0.35,
    bloomRadius: 0.25,
    bloomThreshold: 0.85,
  };
}

export function createBaseMaterial(ctx: ThemeContext, _accentHex = 0xff6d00): THREE.MeshStandardMaterial {
  const isM = ctx.world === 'M';
  const selectionColor = isM ? 0x00ff88 : 0x00e676;
  return new THREE.MeshStandardMaterial({
    color: isM ? 0x00b0ff : 0x263238,
    emissive: ctx.selected ? selectionColor : isM ? 0x00838f : 0x000000,
    emissiveIntensity: ctx.selected ? (isM ? 0.75 : 0.6) : isM ? 0.45 : 0.0,
    roughness: isM ? 0.15 : 0.45,
    metalness: isM ? 0.1 : 0.75,
    transparent: isM,
    opacity: isM ? 0.32 : 1.0,
  });
}

export function createAccentMaterial(ctx: ThemeContext, colorHex = 0xff6d00): THREE.MeshStandardMaterial {
  const isM = ctx.world === 'M';
  return new THREE.MeshStandardMaterial({
    color: isM ? 0x00e5ff : colorHex,
    emissive: isM ? 0x00e5ff : colorHex,
    emissiveIntensity: isM ? 0.8 : 0.9,
    roughness: 0.3,
    metalness: 0.5,
  });
}

export function addBlueprintEdges(mesh: THREE.Mesh, visible: boolean): void {
  const edges = new THREE.EdgesGeometry(mesh.geometry, 25);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.85 })
  );
  line.name = 'blueprintEdges';
  line.visible = visible;
  mesh.add(line);
}

