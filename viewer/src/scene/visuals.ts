import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { Element, ElementKind } from "../core/types";
import { ELEMENT_COLORS, kindLabel } from "./palette";
import type { ThemeManager } from "../themes/registry";
import type { ThemeContext } from "../themes/types";
import { resolveEntityKind } from "../themes/resolve";

export interface ElementVisualOptions {
  position: THREE.Vector3;
  density: number;
  onSelect: (id: string) => void;
  /**
   * Runtime forms previewed inside an M class or component. The viewer derives
   * them from `materializes` / `deploys` / composition links, never from layout.
   */
  previewKinds?: ElementKind[];
  themeManager?: ThemeManager;
}

const SELECTION_GREEN = new THREE.Color(0x00e676);

function addEdges(
  group: THREE.Group,
  geometry: THREE.BufferGeometry,
  color: number,
  options: { dashed?: boolean; opacity?: number } = {},
): THREE.LineSegments {
  const material = options.dashed
    ? new THREE.LineDashedMaterial({
        color,
        dashSize: 0.2,
        gapSize: 0.14,
        transparent: true,
        opacity: options.opacity ?? 0.9,
        depthWrite: false,
        toneMapped: false,
      })
    : new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: options.opacity ?? 0.9,
        depthWrite: false,
        toneMapped: false,
      });
  const lines = new THREE.LineSegments(geometry, material);
  if (options.dashed) {
    lines.computeLineDistances();
  }
  group.add(lines);
  return lines;
}

/**
 * The viewer does not paint a factory. It uses one abstract 3D grammar:
 * a holographic blueprint in M, a materialized runtime module in R. Every kind
 * owns a compact silhouette that must read in monochrome, so colour stays a
 * property of the world and the kind is carried by geometry alone.
 */
function roundedBox(
  width: number,
  height: number,
  depth: number,
  radius = 0.08,
  segments = 3,
): RoundedBoxGeometry {
  return new RoundedBoxGeometry(width, height, depth, segments, radius);
}

/**
 * A box frame with one vertical edge missing. It is the обязательный признак
 * of an abstract class: the contour never closes, even when both edges and
 * glass render with the same colour.
 */
function openFrameEdges(
  width: number,
  height: number,
  depth: number,
): THREE.BufferGeometry {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const halfDepth = depth / 2;
  const point = (x: number, y: number, z: number): THREE.Vector3 =>
    new THREE.Vector3(x, y, z);
  const segments: Array<[THREE.Vector3, THREE.Vector3]> = [
    // bottom
    [point(-halfWidth, -halfHeight, -halfDepth), point(halfWidth, -halfHeight, -halfDepth)],
    [point(halfWidth, -halfHeight, -halfDepth), point(halfWidth, -halfHeight, halfDepth)],
    [point(halfWidth, -halfHeight, halfDepth), point(-halfWidth, -halfHeight, halfDepth)],
    [point(-halfWidth, -halfHeight, halfDepth), point(-halfWidth, -halfHeight, -halfDepth)],
    // top
    [point(-halfWidth, halfHeight, -halfDepth), point(halfWidth, halfHeight, -halfDepth)],
    [point(halfWidth, halfHeight, -halfDepth), point(halfWidth, halfHeight, halfDepth)],
    [point(halfWidth, halfHeight, halfDepth), point(-halfWidth, halfHeight, halfDepth)],
    [point(-halfWidth, halfHeight, halfDepth), point(-halfWidth, halfHeight, -halfDepth)],
    // verticals, except the front-left one
    [point(-halfWidth, -halfHeight, -halfDepth), point(-halfWidth, halfHeight, -halfDepth)],
    [point(halfWidth, -halfHeight, -halfDepth), point(halfWidth, halfHeight, -halfDepth)],
    [point(halfWidth, -halfHeight, halfDepth), point(halfWidth, halfHeight, halfDepth)],
  ];
  const points: THREE.Vector3[] = [];
  for (const [a, b] of segments) points.push(a, b);
  return new THREE.BufferGeometry().setFromPoints(points);
}

function polygonShape(radius: number, sides: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let index = 0; index < sides; index += 1) {
    const angle = (index / sides) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function hexRingGeometry(outer: number, inner: number, depth: number): THREE.ExtrudeGeometry {
  const shape = polygonShape(outer, 6);
  shape.holes.push(polygonShape(inner, 6));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

interface EdgeOptions {
  dashed?: boolean;
  opacity?: number;
}

interface FormKit {
  surface: THREE.Material;
  detail: THREE.Material;
  accent: THREE.Material;
  dark: THREE.Material;
  edge: number;
  bodyEdge: number;
  edgeOpacity: number;
  addMesh(geometry: THREE.BufferGeometry, material: THREE.Material, y?: number): THREE.Mesh;
  addEdges(
    geometry: THREE.BufferGeometry,
    color: number,
    options?: EdgeOptions,
  ): THREE.LineSegments;
}

interface FormMaterials {
  surface: THREE.Material;
  detail: THREE.Material;
  accent: THREE.Material;
  dark: THREE.Material;
}

function createFormKit(
  group: THREE.Group,
  materials: FormMaterials,
  colors: {
    edge: number;
    bodyEdge: number;
    edgeOpacity?: number;
    shadows?: boolean;
  },
  register?: (mesh: THREE.Mesh) => void,
  elementId?: string,
): FormKit {
  return {
    ...materials,
    edge: colors.edge,
    bodyEdge: colors.bodyEdge,
    edgeOpacity: colors.edgeOpacity ?? 0.45,
    addMesh(geometry, material, y = 0) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = y;
      if (elementId) mesh.userData.elementId = elementId;
      mesh.castShadow = colors.shadows ?? false;
      mesh.receiveShadow = colors.shadows ?? false;
      group.add(mesh);
      register?.(mesh);
      return mesh;
    },
    addEdges(geometry, color, options = {}) {
      return addEdges(group, geometry, color, options);
    },
  };
}

/**
 * Runtime forms are shared between the R world and the miniature preview
 * inside an M class. This is the contract that makes a phase transition
 * readable: the blueprint shows exactly what will exist after crystallization.
 */
function buildObjectForm(kit: FormKit): void {
  // A materialized runtime module: a tall monolith with a flush crown, a lit
  // vertical seam, a recessed service panel and a sensor lens. The tall
  // silhouette must not read as a house or a stage.
  const foot = roundedBox(0.78, 0.1, 0.64, 0.03);
  kit.addMesh(foot, kit.dark, -0.72);

  const body = roundedBox(0.95, 1.5, 0.8, 0.1);
  kit.addMesh(body, kit.surface, 0.0);
  const bodyEdges = kit.addEdges(new THREE.EdgesGeometry(body), kit.bodyEdge, {
    opacity: kit.edgeOpacity * 0.55,
  });
  bodyEdges.position.y = 0.0;

  const crown = roundedBox(0.82, 0.1, 0.7, 0.05);
  kit.addMesh(crown, kit.detail, 0.8);

  const brow = roundedBox(0.9, 0.05, 0.05, 0.02);
  const browMesh = kit.addMesh(brow, kit.detail, 0.66);
  browMesh.position.z = 0.4;

  const seam = kit.addMesh(new THREE.BoxGeometry(0.05, 1.28, 0.02), kit.accent, 0.02);
  seam.position.z = 0.405;
  seam.renderOrder = 2;

  const panel = roundedBox(0.64, 0.52, 0.04, 0.02);
  const face = kit.addMesh(panel, kit.detail, -0.34);
  face.position.z = 0.405;

  const grille = kit.addMesh(new THREE.BoxGeometry(0.5, 0.03, 0.02), kit.dark, -0.62);
  grille.position.z = 0.42;
  grille.renderOrder = 2;

  const lens = kit.addMesh(
    new THREE.CylinderGeometry(0.15, 0.15, 0.05, 20),
    kit.accent,
    0.36,
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.z = 0.43;
  lens.renderOrder = 2;

  const rim = kit.addMesh(new THREE.TorusGeometry(0.19, 0.02, 8, 24), kit.detail, 0.36);
  rim.position.z = 0.43;

  for (let index = 0; index < 4; index += 1) {
    for (const x of [-0.49, 0.49]) {
      const vent = kit.addMesh(
        new THREE.BoxGeometry(0.02, 0.05, 0.42),
        kit.dark,
        -0.42 + index * 0.16,
      );
      vent.position.set(x, -0.42 + index * 0.16, 0);
    }
  }
}

function buildResourceForm(kit: FormKit): void {
  // A data store: a low stack of uniform memory slabs on corner rails. Flat
  // and layered, so it cannot be confused with the tall object monolith.
  kit.addMesh(roundedBox(1.12, 0.08, 0.86, 0.03), kit.detail, -0.5);

  for (const x of [-0.44, 0.44]) {
    for (const z of [-0.32, 0.32]) {
      const rail = kit.addMesh(
        new THREE.CylinderGeometry(0.026, 0.026, 0.9, 8),
        kit.dark,
        -0.02,
      );
      rail.position.set(x, -0.02, z);
    }
  }

  const plates: Array<{ y: number; rotation: number }> = [
    { y: -0.34, rotation: -0.06 },
    { y: -0.04, rotation: 0.05 },
    { y: 0.26, rotation: -0.03 },
  ];
  for (const plate of plates) {
    const geometry = roundedBox(0.92, 0.14, 0.7, 0.03);
    const mesh = kit.addMesh(geometry, kit.surface, plate.y);
    mesh.rotation.y = plate.rotation;
    const edges = kit.addEdges(new THREE.EdgesGeometry(geometry), kit.edge, {
      opacity: kit.edgeOpacity * 0.7,
    });
    edges.position.y = plate.y;
    edges.rotation.y = plate.rotation;

    const strip = kit.addMesh(
      new THREE.BoxGeometry(0.4, 0.03, 0.02),
      kit.accent,
      plate.y,
    );
    strip.position.set(0.14, plate.y, 0.36);
    strip.rotation.y = plate.rotation;
    strip.renderOrder = 2;
  }

  const cover = kit.addMesh(roundedBox(0.98, 0.06, 0.76, 0.02), kit.detail, 0.43);
  cover.rotation.y = 0.03;
  const slot = kit.addMesh(new THREE.BoxGeometry(0.3, 0.02, 0.03), kit.accent, 0.47);
  slot.renderOrder = 2;
}

function buildProcessForm(kit: FormKit): void {
  // A processing core: one upright ring around a faceted kernel, held by a
  // low bracket. The ring is the silhouette; there is no boxy chassis.
  const pad = kit.addMesh(
    new THREE.TorusGeometry(0.3, 0.03, 8, 28),
    kit.dark,
    -0.5,
  );
  pad.rotation.x = Math.PI / 2;

  for (const x of [-0.24, 0.24]) {
    const arm = kit.addMesh(new THREE.BoxGeometry(0.06, 0.44, 0.1), kit.detail, -0.3);
    arm.position.x = x;
  }

  kit.addMesh(new THREE.TorusGeometry(0.56, 0.055, 10, 36), kit.surface, 0.05);
  const ringEdges = kit.addEdges(
    new THREE.EdgesGeometry(new THREE.TorusGeometry(0.56, 0.055, 10, 36)),
    kit.edge,
    { opacity: kit.edgeOpacity * 0.7 },
  );
  ringEdges.position.y = 0.05;

  const kernel = kit.addMesh(new THREE.OctahedronGeometry(0.22, 0), kit.accent, 0.05);
  kernel.renderOrder = 2;
  const orbit = kit.addMesh(new THREE.TorusGeometry(0.33, 0.015, 6, 24), kit.accent, 0.05);
  orbit.rotation.x = Math.PI / 2.4;
}

function buildStageForm(kit: FormKit): void {
  // A directed conduit: one long low beam, guide rings and an arrowhead. The
  // horizontal silhouette separates it from the vertical object module.
  for (const x of [-0.82, 0.82]) {
    const foot = kit.addMesh(roundedBox(0.18, 0.14, 0.5, 0.03), kit.dark, -0.62);
    foot.position.x = x;
  }

  const beam = roundedBox(2.24, 0.24, 0.46, 0.06);
  kit.addMesh(beam, kit.surface, -0.26);
  const beamEdges = kit.addEdges(new THREE.EdgesGeometry(beam), kit.bodyEdge, {
    opacity: kit.edgeOpacity * 0.6,
  });
  beamEdges.position.y = -0.26;

  const flow = kit.addMesh(new THREE.BoxGeometry(1.7, 0.02, 0.06), kit.accent, -0.12);
  flow.renderOrder = 2;

  for (const x of [-0.78, -0.1, 0.58]) {
    const ring = kit.addMesh(
      new THREE.TorusGeometry(0.29, 0.028, 8, 28),
      kit.accent,
      -0.26,
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.x = x;
    ring.renderOrder = 2;
  }

  const arrow = kit.addMesh(new THREE.ConeGeometry(0.18, 0.4, 4), kit.accent, -0.26);
  arrow.rotation.z = -Math.PI / 2;
  arrow.position.x = 1.3;
  arrow.renderOrder = 2;
}

function buildCommandForm(kit: FormKit): void {
  // A signal shard: a faceted carrier floating above a thin marker ring. It is
  // deliberately small and has no chassis, so it reads as a transient signal.
  const marker = kit.addMesh(
    new THREE.TorusGeometry(0.36, 0.02, 6, 32),
    kit.dark,
    -0.52,
  );
  marker.rotation.x = Math.PI / 2;

  const shardGeometry = new THREE.OctahedronGeometry(0.32, 0);
  shardGeometry.scale(0.7, 1.5, 0.7);
  kit.addMesh(shardGeometry, kit.surface, 0.08);
  const shardEdges = kit.addEdges(new THREE.EdgesGeometry(shardGeometry), kit.edge, {
    opacity: Math.min(1, kit.edgeOpacity + 0.35),
  });
  shardEdges.position.y = 0.08;

  const collar = kit.addMesh(
    new THREE.TorusGeometry(0.22, 0.028, 8, 24),
    kit.accent,
    -0.24,
  );
  collar.rotation.x = Math.PI / 2;
  collar.renderOrder = 2;

  const tip = kit.addMesh(new THREE.OctahedronGeometry(0.07, 0), kit.accent, 0.64);
  tip.renderOrder = 2;
}

function buildActorForm(kit: FormKit): void {
  // A host context: an open gyroscope of two crossed rings around a kernel.
  // No pedestal or screen, so it cannot be mistaken for a standalone device.
  const pad = kit.addMesh(
    new THREE.TorusGeometry(0.34, 0.025, 6, 28),
    kit.dark,
    -0.5,
  );
  pad.rotation.x = Math.PI / 2;

  const outer = kit.addMesh(
    new THREE.TorusGeometry(0.5, 0.032, 8, 36),
    kit.surface,
    0.05,
  );
  outer.rotation.x = Math.PI / 2.6;

  const inner = kit.addMesh(
    new THREE.TorusGeometry(0.37, 0.026, 8, 32),
    kit.accent,
    0.05,
  );
  inner.rotation.y = Math.PI / 2;
  inner.rotation.x = 0.4;
  inner.renderOrder = 2;

  const kernel = kit.addMesh(new THREE.IcosahedronGeometry(0.16, 1), kit.accent, 0.05);
  kernel.renderOrder = 2;
}

function buildFallbackForm(kit: FormKit): void {
  const geometry = roundedBox(0.8, 0.6, 0.8, 0.1);
  kit.addMesh(geometry, kit.surface, 0.3);
  const edges = kit.addEdges(new THREE.EdgesGeometry(geometry), kit.edge, {
    opacity: kit.edgeOpacity,
  });
  edges.position.y = 0.3;
}

function buildRuntimeForm(kind: ElementKind, kit: FormKit): boolean {
  switch (kind) {
    case "object":
      buildObjectForm(kit);
      return true;
    case "resource":
      buildResourceForm(kit);
      return true;
    case "process":
      buildProcessForm(kit);
      return true;
    case "stage":
      buildStageForm(kit);
      return true;
    case "command":
      buildCommandForm(kit);
      return true;
    case "actor":
      buildActorForm(kit);
      return true;
    default:
      return false;
  }
}

function fitPreviewSlot(
  slot: THREE.Group,
  width: number,
  height: number,
  depth: number,
): void {
  slot.updateMatrixWorld(true);
  const original = new THREE.Box3().setFromObject(slot);
  const size = original.getSize(new THREE.Vector3());
  if (size.x <= 0 || size.y <= 0 || size.z <= 0) return;

  const scale = Math.min(width / size.x, height / size.y, depth / size.z);
  slot.scale.setScalar(scale);
  slot.updateMatrixWorld(true);

  const fitted = new THREE.Box3().setFromObject(slot);
  const center = fitted.getCenter(new THREE.Vector3());
  slot.position.x -= center.x;
  slot.position.z -= center.z;
  slot.position.y -= fitted.min.y;
}

function addEmptyPreview(group: THREE.Group, color: number): void {
  const footprint = roundedBox(0.9, 0.04, 0.62, 0.03);
  const base = addEdges(group, new THREE.EdgesGeometry(footprint), color, {
    dashed: true,
    opacity: 0.35,
  });
  base.position.y = 0.02;

  const frame = roundedBox(0.62, 0.3, 0.44, 0.04);
  const box = addEdges(group, new THREE.EdgesGeometry(frame), color, {
    dashed: true,
    opacity: 0.55,
  });
  box.position.y = 0.19;
}

export class ElementVisual {
  readonly element: Element;
  readonly group: THREE.Group;
  readonly meshes: THREE.Mesh[] = [];
  readonly labelElement: HTMLDivElement;
  readonly basePosition: THREE.Vector3;
  private readonly label: CSS2DObject;
  private readonly selectionRing: THREE.Mesh;
  private readonly selectionMaterial: THREE.MeshBasicMaterial;
  private readonly materialStyles: Array<{
    material: THREE.Material & { opacity: number; color?: THREE.Color };
    opacity: number;
    color?: THREE.Color;
  }> = [];
  private readonly emissiveStyles: Array<{
    material: THREE.MeshStandardMaterial;
    intensity: number;
  }> = [];
  private selected = false;
  private density: number;
  private labelsVisible = true;
  private readonly baseScale = 1.45;
  private readonly themeManager?: ThemeManager;
  private readonly themeObject?: THREE.Group;
  private readonly resolvedKind?: string;
  private readonly themeCtx?: ThemeContext;
  private readonly floatPhase: number;

  constructor(element: Element, options: ElementVisualOptions) {
    this.element = element;
    this.density = options.density;
    this.basePosition = options.position.clone();
    this.floatPhase = (options.position.x * 0.73 + options.position.z * 0.51) % (Math.PI * 2);
    this.group = new THREE.Group();
    this.group.position.copy(options.position);
    this.group.userData.elementId = element.id;

    const color = ELEMENT_COLORS[element.kind] ?? 0xaaaaaa;
    const mental = element.world === "M";
    // Mental surfaces float as glass; real surfaces are dark machined metal, so
    // the warm world colour lives in the edges, accents and lights instead of
    // washing every body into the same orange clay.
    const base = new THREE.Color(color);
    const surfaceTint = mental
      ? base.clone()
      : base.clone().lerp(new THREE.Color(0x1b1d24), 0.82);
    const detailTint = mental
      ? base.clone()
      : base.clone().lerp(new THREE.Color(0x3c4250), 0.7);
    const additive = (opacity: number, emissiveIntensity: number) =>
      new THREE.MeshPhysicalMaterial({
        color,
        emissive: color,
        emissiveIntensity,
        transparent: true,
        opacity,
        roughness: 0.12,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
    const solid = (metalness: number, roughness: number, tint = surfaceTint) =>
      new THREE.MeshPhysicalMaterial({
        color: tint,
        emissive: color,
        emissiveIntensity: mental ? 0.16 : 0.03,
        metalness,
        roughness,
        clearcoat: 0.65,
        clearcoatRoughness: 0.22,
      });

    const addMesh = (
      geometry: THREE.BufferGeometry,
      material: THREE.Material,
      y = 0,
    ): THREE.Mesh => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.y = y;
      mesh.userData.elementId = element.id;
      mesh.castShadow = !mental;
      mesh.receiveShadow = !mental;
      groupAdd(this.group, mesh);
      this.meshes.push(mesh);
      return mesh;
    };

    const ghost = (opacity: number): THREE.MeshBasicMaterial =>
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

    const realKit = (options: {
      metalness: number;
      roughness: number;
      edge: number;
      bodyEdge?: number;
      accent?: number;
      dark?: { color: number; emissiveIntensity: number };
    }): FormKit => {
      const surface = solid(options.metalness, options.roughness);
      const detail = solid(
        options.metalness + 0.15,
        options.roughness + 0.02,
        detailTint,
      );
      const accent =
        options.accent === undefined
          ? detail
          : new THREE.MeshBasicMaterial({
              color: options.accent,
              transparent: true,
              opacity: 0.95,
              toneMapped: false,
            });
      const dark =
        options.dark === undefined
          ? detail
          : new THREE.MeshPhysicalMaterial({
              color: options.dark.color,
              emissive: color,
              emissiveIntensity: options.dark.emissiveIntensity,
              metalness: 0.4,
              roughness: 0.45,
              clearcoat: 0.4,
              clearcoatRoughness: 0.3,
            });
      return createFormKit(
        this.group,
        { surface, detail, accent, dark },
        {
          edge: options.edge,
          bodyEdge: options.bodyEdge ?? 0x2a1a12,
          edgeOpacity: 0.5,
          shadows: !mental,
        },
        (mesh) => this.meshes.push(mesh),
        element.id,
      );
    };

    const previewKinds = (options.previewKinds ?? []).slice(0, 5);
    const themeDrawsPreview = Boolean(
      options.themeManager?.getActiveTheme().rendersPreview,
    );
    if (!themeDrawsPreview && (element.kind === "class" || element.kind === "component")) {
      const previewMaterials: FormMaterials = {
        surface: ghost(0.04),
        detail: ghost(0.06),
        accent: ghost(0.9),
        dark: ghost(0.1),
      };
      const previewRoot = new THREE.Group();
      previewRoot.position.y = element.kind === "component" ? -0.56 : -0.62;
      if (previewKinds.length > 0) {
        const gap = 0.08;
        const totalWidth = element.kind === "component" ? 2.3 : 1.35;
        const maxHeight = element.kind === "component" ? 0.86 : 0.68;
        const maxDepth = element.kind === "component" ? 2.2 : 1.0;
        const slotWidth =
          (totalWidth - gap * (previewKinds.length - 1)) / previewKinds.length;
        previewKinds.forEach((kind, index) => {
          const slot = new THREE.Group();
          const kit = createFormKit(
            slot,
            previewMaterials,
            { edge: color, bodyEdge: color, edgeOpacity: 0.92 },
            (mesh) => this.meshes.push(mesh),
            element.id,
          );
          if (!buildRuntimeForm(kind, kit)) buildFallbackForm(kit);
          fitPreviewSlot(slot, slotWidth, maxHeight, maxDepth);
          slot.position.x =
            -totalWidth / 2 + slotWidth / 2 + index * (slotWidth + gap);
          previewRoot.add(slot);
        });
      } else if (element.kind === "class") {
        addEmptyPreview(previewRoot, color);
      }
      previewRoot.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
          object.renderOrder = 1;
        }
      });
      this.group.add(previewRoot);
    }

    let labelHeight = 0.95;

    if (options.themeManager) {
      this.themeManager = options.themeManager;
      const { kind: resolvedKind, meta } = resolveEntityKind(element);
      this.resolvedKind = resolvedKind;
      this.themeCtx = {
        world: element.world,
        phaseProgress: 0,
        selected: false,
        meta: {
          ...meta,
          entityKind: element.kind,
          materializedKind: previewKinds[0],
        },
      };
      const themeObj = options.themeManager.createEntity(resolvedKind, this.themeCtx);
      themeObj.userData.elementId = element.id;
      themeObj.traverse((child) => {
        child.userData.elementId = element.id;
        if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
          child.castShadow = !mental;
          child.receiveShadow = !mental;
          if (child instanceof THREE.Mesh) {
            this.meshes.push(child);
          }
        }
      });
      this.themeObject = themeObj;
      this.group.add(themeObj);
      labelHeight = 1.05;
    } else {
      switch (element.kind) {
      case "class": {
        // A vitrine: a glass blueprint case holding the promise of the R twin.
        const plinth = roundedBox(1.8, 0.06, 1.4, 0.03);
        addMesh(plinth, additive(0.1, 0.3), -0.66);
        const plinthEdges = addEdges(
          this.group,
          new THREE.EdgesGeometry(plinth),
          color,
          { opacity: 0.5 },
        );
        plinthEdges.position.y = -0.66;

        const caseGeometry = roundedBox(1.72, 0.9, 1.34, 0.08);
        addMesh(caseGeometry, additive(0.035, 0.5), -0.18);
        const caseEdges = addEdges(
          this.group,
          new THREE.EdgesGeometry(caseGeometry),
          color,
          { opacity: 0.55 },
        );
        caseEdges.position.y = -0.18;

        const postGeometry = roundedBox(0.055, 0.9, 0.055, 0.02);
        const postMaterial = additive(0.5, 1.0);
        for (const x of [-0.84, 0.84]) {
          for (const z of [-0.65, 0.65]) {
            const post = addMesh(postGeometry, postMaterial, -0.18);
            post.position.set(x, -0.18, z);
          }
        }

        const cap = roundedBox(1.84, 0.1, 1.46, 0.05);
        const capEdges = addEdges(
          this.group,
          new THREE.EdgesGeometry(cap),
          color,
          { opacity: 0.9 },
        );
        capEdges.position.y = 0.32;
        labelHeight = 0.46;
        break;
      }
      case "abstractClass": {
        const plinth = roundedBox(1.8, 0.06, 1.4, 0.03);
        addMesh(plinth, additive(0.08, 0.26), -0.66);
        const plinthEdges = addEdges(
          this.group,
          new THREE.EdgesGeometry(plinth),
          color,
          { dashed: true, opacity: 0.45 },
        );
        plinthEdges.position.y = -0.66;

        const frame = addEdges(
          this.group,
          openFrameEdges(1.72, 0.9, 1.34),
          color,
          { dashed: true, opacity: 0.95 },
        );
        frame.position.y = -0.18;

        const cap = roundedBox(1.84, 0.1, 1.46, 0.05);
        addMesh(cap, additive(0.1, 0.6), 0.32);
        const capEdges = addEdges(
          this.group,
          openFrameEdges(1.84, 0.1, 1.46),
          color,
          { dashed: true, opacity: 0.6 },
        );
        capEdges.position.y = 0.32;
        labelHeight = 0.46;
        break;
      }
      case "interface": {
        const geometry = hexRingGeometry(0.74, 0.44, 0.16);
        addMesh(geometry, additive(0.45, 0.85));
        addEdges(this.group, new THREE.EdgesGeometry(geometry), color, { opacity: 0.7 });
        const core = addMesh(
          new THREE.TorusGeometry(0.5, 0.028, 6, 6),
          additive(0.85, 1.2),
        );
        core.rotation.z = Math.PI / 6;
        for (const x of [-0.86, 0.86]) {
          const port = addMesh(
            new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8),
            additive(0.6, 0.9),
          );
          port.rotation.z = Math.PI / 2;
          port.position.set(x, 0, 0);
        }
        labelHeight = 0.9;
        break;
      }
      case "component": {
        // A platform: a stage that holds the miniatures of its parts.
        const base = roundedBox(3.0, 0.12, 3.0, 0.12);
        addMesh(base, additive(0.14, 0.5), -0.62);
        const baseEdges = addEdges(
          this.group,
          new THREE.EdgesGeometry(base),
          color,
          { opacity: 0.6 },
        );
        baseEdges.position.y = -0.62;

        const postGeometry = roundedBox(0.08, 0.9, 0.08, 0.02);
        for (const x of [-1.38, 1.38]) {
          for (const z of [-1.38, 1.38]) {
            const post = addMesh(postGeometry, additive(0.4, 0.8), -0.16);
            post.position.set(x, -0.16, z);
            const tip = addMesh(
              new THREE.SphereGeometry(0.055, 10, 8),
              additive(0.9, 1.2),
            );
            tip.position.set(x, 0.3, z);
          }
        }

        const rails = addEdges(
          this.group,
          new THREE.EdgesGeometry(new THREE.BoxGeometry(2.76, 0.02, 2.76)),
          color,
          { dashed: true, opacity: 0.55 },
        );
        rails.position.y = 0.34;
        labelHeight = 0.62;
        break;
      }
      case "concept": {
        const geometry = new THREE.OctahedronGeometry(0.82, 0);
        addMesh(geometry, additive(0.16, 0.85));
        addEdges(this.group, new THREE.EdgesGeometry(geometry), color, { opacity: 0.95 });
        const inner = addMesh(
          new THREE.IcosahedronGeometry(0.3, 0),
          new THREE.MeshBasicMaterial({
            color,
            wireframe: true,
            transparent: true,
            opacity: 0.85,
            toneMapped: false,
          }),
        );
        inner.rotation.set(0.4, 0.6, 0);
        const orbit = addMesh(
          new THREE.TorusGeometry(0.66, 0.018, 6, 40),
          additive(0.9, 1.2),
        );
        orbit.rotation.x = Math.PI / 2.2;
        labelHeight = 1.0;
        break;
      }
      case "object": {
        buildObjectForm(
          realKit({
            metalness: 0.72,
            roughness: 0.3,
            edge: color,
            dark: { color: 0x15161c, emissiveIntensity: 0.12 },
          }),
        );
        labelHeight = 1.06;
        break;
      }
      case "resource": {
        buildResourceForm(
          realKit({
            metalness: 0.74,
            roughness: 0.28,
            edge: color,
            bodyEdge: 0x6b4a33,
            accent: 0xffd0a2,
          }),
        );
        labelHeight = 0.72;
        break;
      }
      case "process": {
        buildProcessForm(
          realKit({
            metalness: 0.68,
            roughness: 0.32,
            edge: color,
            accent: 0xffe0a3,
          }),
        );
        labelHeight = 1.0;
        break;
      }
      case "stage": {
        buildStageForm(
          realKit({
            metalness: 0.7,
            roughness: 0.28,
            edge: color,
            bodyEdge: 0x6b4a33,
            accent: 0xffe0a3,
          }),
        );
        labelHeight = 0.7;
        break;
      }
      case "command": {
        buildCommandForm(
          realKit({
            metalness: 0.6,
            roughness: 0.26,
            edge: 0xfff0c8,
            bodyEdge: 0xfff0c8,
            accent: 0xfff0c8,
          }),
        );
        labelHeight = 0.86;
        break;
      }
      case "actor": {
        buildActorForm(
          realKit({
            metalness: 0.7,
            roughness: 0.3,
            edge: color,
            dark: { color: 0x16121b, emissiveIntensity: 0.35 },
          }),
        );
        labelHeight = 0.86;
        break;
      }
      default: {
        const geometry = roundedBox(1.1, 1.1, 1.1, 0.14);
        addMesh(geometry, mental ? additive(0.2, 0.5) : solid(0.3, 0.5));
        addEdges(this.group, new THREE.EdgesGeometry(geometry), color);
        labelHeight = 0.9;
      }
    }
  }

    const discMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const groundY =
      element.kind === "class" || element.kind === "abstractClass"
        ? -0.8
        : element.kind === "concept"
          ? -0.84
          : element.kind === "component"
            ? -0.69
            : element.kind === "interface"
              ? -0.55
              : element.kind === "object"
                ? -0.76
                : element.kind === "resource" || element.kind === "process"
                  ? -0.56
                  : element.kind === "stage"
                    ? -0.72
                    : -0.55;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.25, 36), discMaterial);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = groundY;
    disc.renderOrder = -1;
    this.group.add(disc);

    this.selectionMaterial = new THREE.MeshBasicMaterial({
      color: 0x00e676,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(1.05, 1.22, 48),
      this.selectionMaterial,
    );
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.position.y = groundY + 0.02;
    this.selectionRing.renderOrder = 2;
    this.group.add(this.selectionRing);

    this.labelElement = document.createElement("div");
    this.labelElement.className = `node-label ${element.world}`;
    this.labelElement.dataset.id = element.id;
    const kind = document.createElement("span");
    kind.className = "node-kind";
    kind.textContent = kindLabel(element.kind);
    const name = document.createElement("span");
    name.className = "node-name";
    name.textContent = element.name;
    this.labelElement.append(kind, name);
    if (element.kind === "abstractClass") {
      const badge = document.createElement("span");
      badge.className = "node-badge";
      badge.textContent = "ghost";
      this.labelElement.append(badge);
    }
    this.labelElement.addEventListener("click", (event) => {
      event.stopPropagation();
      options.onSelect(element.id);
    });

    this.label = new CSS2DObject(this.labelElement);
    if (element.kind === "stage" || element.kind === "command") {
      this.label.center.set(0.5, 0);
      this.label.position.set(0, -0.58, 0);
    } else {
      this.label.center.set(0.5, 1);
      this.label.position.set(0, labelHeight, 0);
    }
    this.group.add(this.label);

    this.captureStyles();
    this.group.scale.setScalar(this.baseScale);
    this.setDensity(options.density);
  }

  private captureStyles(): void {
    const seen = new Set<THREE.Material>();
    for (const mesh of this.meshes) {
      const source = mesh.material;
      const materials = Array.isArray(source) ? source : [source];
      for (const material of materials) {
        if (!material || seen.has(material)) continue;
        seen.add(material);
        const typed = material as THREE.Material & { opacity: number; color?: THREE.Color };
        this.materialStyles.push({
          material: typed,
          opacity: typed.opacity,
          color: typed.color?.clone(),
        });
        if (material instanceof THREE.MeshStandardMaterial) {
          this.emissiveStyles.push({
            material,
            intensity: material.emissiveIntensity,
          });
        }
      }
    }
  }

  setSelected(selected: boolean): void {
    this.selected = selected;
    if (this.themeCtx) {
      this.themeCtx.selected = selected;
    }
    this.selectionMaterial.opacity = selected ? 0.85 : 0;
    this.labelElement.classList.toggle("selected", selected);
    this.group.scale.setScalar(selected ? this.baseScale * 1.06 : this.baseScale);
    this.applySelectionStyle();
    this.applyLabelVisibility();
    this.setDensity(this.density);
  }

  update(_now: number, elapsed: number): void {
    if (this.themeManager && this.themeObject && this.resolvedKind && this.themeCtx) {
      this.themeManager.updateEntity(this.themeObject, this.resolvedKind, this.themeCtx, elapsed);
    }
    if (this.element.world === "M") {
      this.group.position.y = this.basePosition.y + Math.sin(elapsed * 1.6 + this.floatPhase) * 0.08;
    } else {
      this.group.position.y = this.basePosition.y;
    }
  }

  private applySelectionStyle(): void {
    for (const entry of this.materialStyles) {
      entry.material.opacity = this.selected
        ? Math.min(1, entry.opacity + 0.22)
        : entry.opacity;
      if (entry.color && entry.material.color) {
        entry.material.color.copy(entry.color);
        if (this.selected) {
          entry.material.color.lerp(SELECTION_GREEN, 0.28);
        }
      }
    }
    for (const entry of this.emissiveStyles) {
      entry.material.emissiveIntensity = this.selected
        ? entry.intensity + 0.5
        : entry.intensity;
    }
  }

  setLabelVisible(visible: boolean): void {
    this.labelsVisible = visible;
    this.applyLabelVisibility();
  }

  private applyLabelVisibility(): void {
    this.label.visible = this.labelsVisible || this.selected;
    this.labelElement.style.display = this.label.visible ? "" : "none";
  }

  setDensity(density: number): void {
    this.density = density;
    this.labelElement.style.opacity = this.selected
      ? "1"
      : String(0.25 + Math.max(0, Math.min(1, density)) * 0.75);
  }

  dispose(): void {
    this.labelElement.remove();
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        object.geometry.dispose();
        const material = object.material;
        if (Array.isArray(material)) {
          for (const entry of material) entry.dispose();
        } else {
          material.dispose();
        }
      }
    });
    this.group.removeFromParent();
  }
}

function groupAdd(group: THREE.Group, mesh: THREE.Mesh): void {
  group.add(mesh);
}
