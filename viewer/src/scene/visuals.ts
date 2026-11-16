import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { Element, ElementKind } from "../core/types";
import { ELEMENT_COLORS, kindLabel } from "./palette";

export interface ElementVisualOptions {
  position: THREE.Vector3;
  density: number;
  onSelect: (id: string) => void;
  /**
   * Runtime forms previewed inside an M class or component. The viewer derives
   * them from `materializes` / `deploys` / composition links, never from layout.
   */
  previewKinds?: ElementKind[];
}

const WHITE = new THREE.Color(0xffffff);

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
      })
    : new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: options.opacity ?? 0.9,
      });
  const lines = new THREE.LineSegments(geometry, material);
  if (options.dashed) {
    lines.computeLineDistances();
  }
  group.add(lines);
  return lines;
}

/**
 * Silhouettes are the primary type cue in the viewer: a class is a drafted
 * workshop with a gabled roof, an object is a working workshop with a sawtooth
 * roof and a chimney, a resource is a silo, a stage is a conveyor, and so on.
 * Colour stays a secondary accent; the outline must read on its own.
 */
function houseGeometry(
  width: number,
  wallHeight: number,
  roofHeight: number,
  depth: number,
): THREE.ExtrudeGeometry {
  const halfWidth = width / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth, 0);
  shape.lineTo(halfWidth, 0);
  shape.lineTo(halfWidth, wallHeight);
  shape.lineTo(0, wallHeight + roofHeight);
  shape.lineTo(-halfWidth, wallHeight);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 1,
  });
  geometry.translate(0, -(wallHeight + roofHeight) / 2, -depth / 2);
  return geometry;
}

function openHouseEdges(
  width: number,
  wallHeight: number,
  roofHeight: number,
  depth: number,
): THREE.BufferGeometry {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const bottom = -(wallHeight + roofHeight) / 2;
  const eaves = bottom + wallHeight;
  const ridge = eaves + roofHeight;
  const point = (x: number, y: number, z: number): THREE.Vector3 =>
    new THREE.Vector3(x, y, z);
  const segments: Array<[THREE.Vector3, THREE.Vector3]> = [
    [point(-halfWidth, bottom, -halfDepth), point(halfWidth, bottom, -halfDepth)],
    [point(halfWidth, bottom, -halfDepth), point(halfWidth, bottom, halfDepth)],
    [point(halfWidth, bottom, halfDepth), point(-halfWidth, bottom, halfDepth)],
    [point(-halfWidth, eaves, -halfDepth), point(halfWidth, eaves, -halfDepth)],
    [point(halfWidth, eaves, -halfDepth), point(halfWidth, eaves, halfDepth)],
    [point(halfWidth, eaves, halfDepth), point(-halfWidth, eaves, halfDepth)],
    [point(-halfWidth, eaves, halfDepth), point(-halfWidth, eaves, -halfDepth)],
    [point(0, ridge, -halfDepth), point(0, ridge, halfDepth)],
    [point(-halfWidth, eaves, -halfDepth), point(0, ridge, -halfDepth)],
    [point(halfWidth, eaves, -halfDepth), point(0, ridge, -halfDepth)],
    [point(-halfWidth, eaves, halfDepth), point(0, ridge, halfDepth)],
    [point(halfWidth, eaves, halfDepth), point(0, ridge, halfDepth)],
    [point(-halfWidth, bottom, -halfDepth), point(-halfWidth, eaves, -halfDepth)],
    [point(halfWidth, bottom, -halfDepth), point(halfWidth, eaves, -halfDepth)],
    [point(halfWidth, bottom, halfDepth), point(halfWidth, eaves, halfDepth)],
    // The front-left vertical edge is missing on purpose: the ghost contour is open.
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

function sawtoothGeometry(width: number, height: number, depth: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(width, 0);
  shape.lineTo(width, height);
  shape.closePath();
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
  const body = new THREE.BoxGeometry(1.6, 0.9, 1.3);
  kit.addMesh(body, kit.surface, -0.15);
  const bodyEdges = kit.addEdges(new THREE.EdgesGeometry(body), kit.bodyEdge, {
    opacity: kit.edgeOpacity,
  });
  bodyEdges.position.y = -0.15;

  const toothWidth = 1.6 / 3;
  for (let index = 0; index < 3; index += 1) {
    const toothGeometry = sawtoothGeometry(toothWidth, 0.32, 1.2);
    const tooth = kit.addMesh(toothGeometry, kit.surface, 0.3);
    tooth.position.set(-0.8 + index * toothWidth, 0.3, 0);
    const toothEdges = kit.addEdges(new THREE.EdgesGeometry(toothGeometry), kit.edge, {
      opacity: kit.edgeOpacity * 0.8,
    });
    toothEdges.position.copy(tooth.position);
  }

  const chimney = kit.addMesh(
    new THREE.CylinderGeometry(0.075, 0.09, 0.5, 10),
    kit.dark,
    0.55,
  );
  chimney.position.set(0.5, 0.55, -0.35);
}

function buildResourceForm(kit: FormKit): void {
  const body = kit.addMesh(
    new THREE.CylinderGeometry(0.52, 0.52, 0.9, 22, 1),
    kit.surface,
    -0.05,
  );
  body.position.set(0, -0.05, 0);
  const bodyEdges = kit.addEdges(new THREE.EdgesGeometry(body.geometry, 30), kit.bodyEdge, {
    opacity: kit.edgeOpacity,
  });
  bodyEdges.position.y = -0.05;

  const dome = kit.addMesh(new THREE.SphereGeometry(0.52, 20, 10), kit.surface, 0.4);
  dome.scale.y = 0.55;
  dome.position.set(0, 0.4, 0);

  for (const y of [-0.4, 0.05]) {
    const band = kit.addMesh(
      new THREE.TorusGeometry(0.53, 0.035, 8, 32),
      kit.accent,
    );
    band.rotation.x = Math.PI / 2;
    band.position.set(0, y, 0);
  }

  const pipe = kit.addMesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8), kit.detail, -0.15);
  pipe.rotation.z = Math.PI / 2;
  pipe.position.set(0.6, -0.15, 0);
}

function buildProcessForm(kit: FormKit): void {
  const body = kit.addMesh(
    new THREE.CylinderGeometry(0.42, 0.5, 1.0, 8),
    kit.surface,
    -0.05,
  );
  body.position.set(0, -0.05, 0);
  const bodyEdges = kit.addEdges(new THREE.EdgesGeometry(body.geometry, 30), kit.bodyEdge, {
    opacity: kit.edgeOpacity,
  });
  bodyEdges.position.y = -0.05;

  const cap = kit.addMesh(new THREE.ConeGeometry(0.42, 0.3, 8), kit.surface, 0.62);
  cap.position.set(0, 0.62, 0);

  const band = kit.addMesh(new THREE.TorusGeometry(0.46, 0.035, 8, 32), kit.accent);
  band.rotation.x = Math.PI / 2;
  band.position.set(0, 0.18, 0);
}

function buildStageForm(kit: FormKit): void {
  const base = new THREE.BoxGeometry(2.0, 0.16, 0.85);
  kit.addMesh(base, kit.surface, -0.24);
  const baseEdges = kit.addEdges(new THREE.EdgesGeometry(base), kit.bodyEdge, {
    opacity: kit.edgeOpacity,
  });
  baseEdges.position.y = -0.24;

  for (const z of [-0.44, 0.44]) {
    const rail = kit.addMesh(new THREE.BoxGeometry(2.0, 0.1, 0.06), kit.detail, -0.08);
    rail.position.set(0, -0.08, z);
  }
  for (const x of [-0.6, 0, 0.6]) {
    const roller = kit.addMesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.78, 10),
      kit.detail,
      -0.06,
    );
    roller.rotation.x = Math.PI / 2;
    roller.position.set(x, -0.06, 0);
  }

  const chevron = new THREE.ConeGeometry(0.11, 0.3, 3);
  for (const x of [-0.6, 0, 0.6]) {
    const mesh = kit.addMesh(chevron.clone(), kit.accent, 0.16);
    mesh.rotation.z = -Math.PI / 2;
    mesh.position.set(x, 0.16, 0);
  }
}

function buildCommandForm(kit: FormKit): void {
  const plate = kit.addMesh(new THREE.BoxGeometry(0.9, 0.06, 0.62), kit.surface, 0.04);
  plate.position.set(0, 0.04, 0);
  const plateEdges = kit.addEdges(new THREE.EdgesGeometry(plate.geometry), kit.edge, {
    opacity: kit.edgeOpacity + 0.25,
  });
  plateEdges.position.y = 0.04;

  const paper = kit.addMesh(new THREE.BoxGeometry(0.76, 0.02, 0.5), kit.detail, 0.09);
  paper.position.set(0, 0.09, 0);
  const clip = kit.addMesh(new THREE.BoxGeometry(0.2, 0.09, 0.12), kit.detail, 0.11);
  clip.position.set(0, 0.11, -0.26);
}

function buildActorForm(kit: FormKit): void {
  const base = kit.addMesh(
    new THREE.CylinderGeometry(0.72, 0.92, 0.26, 20),
    kit.surface,
    -0.45,
  );
  base.position.set(0, -0.45, 0);

  const column = kit.addMesh(new THREE.BoxGeometry(0.3, 0.5, 0.28), kit.detail, -0.13);
  column.position.set(0, -0.13, 0);

  const screen = kit.addMesh(new THREE.BoxGeometry(0.9, 0.55, 0.07), kit.dark, 0.36);
  screen.rotation.x = -0.2;
  screen.position.set(0, 0.36, 0);
}

function buildFallbackForm(kit: FormKit): void {
  const geometry = new THREE.BoxGeometry(0.8, 0.6, 0.8);
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
  const footprint = new THREE.BoxGeometry(0.9, 0.02, 0.62);
  const base = addEdges(group, new THREE.EdgesGeometry(footprint), color, {
    dashed: true,
    opacity: 0.35,
  });
  base.position.y = 0.01;

  const frame = new THREE.BoxGeometry(0.62, 0.3, 0.44);
  const box = addEdges(group, new THREE.EdgesGeometry(frame), color, {
    dashed: true,
    opacity: 0.55,
  });
  box.position.y = 0.16;
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

  constructor(element: Element, options: ElementVisualOptions) {
    this.element = element;
    this.density = options.density;
    this.basePosition = options.position.clone();
    this.group = new THREE.Group();
    this.group.position.copy(options.position);
    this.group.userData.elementId = element.id;

    const color = ELEMENT_COLORS[element.kind] ?? 0xaaaaaa;
    const mental = element.world === "M";
    const additive = (opacity: number, emissiveIntensity: number) =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity,
        transparent: true,
        opacity,
        roughness: 0.5,
        metalness: 0.05,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
    const solid = (metalness: number, roughness: number) =>
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: mental ? 0.18 : 0.08,
        metalness,
        roughness,
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
      const detail = solid(options.metalness + 0.05, options.roughness + 0.03);
      const accent =
        options.accent === undefined
          ? detail
          : new THREE.MeshBasicMaterial({
              color: options.accent,
              transparent: true,
              opacity: 0.9,
            });
      const dark =
        options.dark === undefined
          ? detail
          : new THREE.MeshStandardMaterial({
              color: options.dark.color,
              emissive: color,
              emissiveIntensity: options.dark.emissiveIntensity,
              metalness: 0.4,
              roughness: 0.5,
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
    if (element.kind === "class" || element.kind === "component") {
      const previewMaterials: FormMaterials = {
        surface: ghost(0.24),
        detail: ghost(0.34),
        accent: ghost(0.72),
        dark: ghost(0.42),
      };
      const previewRoot = new THREE.Group();
      previewRoot.position.y = element.kind === "component" ? -0.57 : -0.71;
      if (previewKinds.length > 0) {
        const gap = 0.08;
        const totalWidth = element.kind === "component" ? 2.3 : 1.25;
        const maxHeight = element.kind === "component" ? 0.82 : 0.66;
        const maxDepth = element.kind === "component" ? 2.2 : 0.95;
        const slotWidth =
          (totalWidth - gap * (previewKinds.length - 1)) / previewKinds.length;
        previewKinds.forEach((kind, index) => {
          const slot = new THREE.Group();
          const kit = createFormKit(
            slot,
            previewMaterials,
            { edge: color, bodyEdge: color, edgeOpacity: 0.72 },
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

    switch (element.kind) {
      case "class": {
        const geometry = houseGeometry(1.8, 0.95, 0.5, 1.4);
        addMesh(geometry, additive(0.1, 0.5));
        addEdges(this.group, new THREE.EdgesGeometry(geometry), color, { opacity: 0.95 });
        labelHeight = 1.0;
        break;
      }
      case "abstractClass": {
        const geometry = houseGeometry(1.8, 0.95, 0.5, 1.4);
        addMesh(geometry, additive(0.07, 0.7));
        addEdges(this.group, openHouseEdges(1.8, 0.95, 0.5, 1.4), color, {
          dashed: true,
          opacity: 0.95,
        });
        labelHeight = 1.0;
        break;
      }
      case "interface": {
        const geometry = hexRingGeometry(0.74, 0.44, 0.16);
        addMesh(geometry, mental ? additive(0.55, 0.85) : solid(0.5, 0.35));
        addEdges(this.group, new THREE.EdgesGeometry(geometry), color, { opacity: 0.6 });
        for (const x of [-0.86, 0.86]) {
          const port = addMesh(
            new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8),
            mental ? additive(0.7, 0.9) : solid(0.6, 0.3),
          );
          port.rotation.z = Math.PI / 2;
          port.position.set(x, 0, 0);
        }
        labelHeight = 0.9;
        break;
      }
      case "component": {
        const base = new THREE.BoxGeometry(3.0, 0.1, 3.0);
        addMesh(base, additive(0.1, 0.45), -0.62);
        const baseEdges = addEdges(this.group, new THREE.EdgesGeometry(base), color, {
          opacity: 0.55,
        });
        baseEdges.position.y = -0.62;
        const postGeometry = new THREE.BoxGeometry(0.09, 0.95, 0.09);
        for (const x of [-1.4, 1.4]) {
          for (const z of [-1.4, 1.4]) {
            const post = addMesh(postGeometry, additive(0.35, 0.7), -0.14);
            post.position.set(x, -0.14, z);
          }
        }
        const rails = addEdges(
          this.group,
          new THREE.EdgesGeometry(new THREE.BoxGeometry(2.8, 0.02, 2.8)),
          color,
          { dashed: true, opacity: 0.55 },
        );
        rails.position.y = 0.34;
        labelHeight = 0.62;
        break;
      }
      case "concept": {
        const geometry = new THREE.OctahedronGeometry(0.82, 0);
        addMesh(geometry, additive(0.2, 0.9));
        addEdges(this.group, new THREE.EdgesGeometry(geometry), color, { opacity: 0.95 });
        const inner = addMesh(
          new THREE.IcosahedronGeometry(0.28, 0),
          new THREE.MeshBasicMaterial({
            color,
            wireframe: true,
            transparent: true,
            opacity: 0.7,
          }),
        );
        inner.position.set(0, 0, 0);
        labelHeight = 1.0;
        break;
      }
      case "object": {
        buildObjectForm(
          realKit({
            metalness: 0.35,
            roughness: 0.42,
            edge: color,
            dark: { color: 0x3a2418, emissiveIntensity: 0.15 },
          }),
        );
        labelHeight = 1.0;
        break;
      }
      case "resource": {
        buildResourceForm(
          realKit({
            metalness: 0.45,
            roughness: 0.38,
            edge: color,
            bodyEdge: 0x5a351d,
            accent: 0xffd0a2,
          }),
        );
        labelHeight = 0.92;
        break;
      }
      case "process": {
        buildProcessForm(
          realKit({
            metalness: 0.3,
            roughness: 0.45,
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
            metalness: 0.25,
            roughness: 0.35,
            edge: color,
            bodyEdge: 0x5a351d,
            accent: 0xffe0a3,
          }),
        );
        labelHeight = 0.7;
        break;
      }
      case "command": {
        buildCommandForm(
          realKit({
            metalness: 0.2,
            roughness: 0.3,
            edge: 0xfff0c8,
            bodyEdge: 0xfff0c8,
            accent: 0xfff0c8,
          }),
        );
        labelHeight = 0.7;
        break;
      }
      case "actor": {
        buildActorForm(
          realKit({
            metalness: 0.4,
            roughness: 0.5,
            edge: color,
            dark: { color: 0x16121b, emissiveIntensity: 0.35 },
          }),
        );
        labelHeight = 0.86;
        break;
      }
      default: {
        const geometry = new THREE.BoxGeometry(1.1, 1.1, 1.1);
        addMesh(geometry, mental ? additive(0.2, 0.5) : solid(0.3, 0.5));
        addEdges(this.group, new THREE.EdgesGeometry(geometry), color);
        labelHeight = 0.9;
      }
    }

    const discMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.25, 36), discMaterial);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.78;
    disc.renderOrder = -1;
    this.group.add(disc);

    this.selectionMaterial = new THREE.MeshBasicMaterial({
      color: 0xa99bff,
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
    this.selectionRing.position.y = -0.76;
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
    this.selectionMaterial.opacity = selected ? 0.85 : 0;
    this.labelElement.classList.toggle("selected", selected);
    this.group.scale.setScalar(selected ? 1.06 : 1);
    this.applySelectionStyle();
    this.applyLabelVisibility();
    this.setDensity(this.density);
  }

  private applySelectionStyle(): void {
    for (const entry of this.materialStyles) {
      entry.material.opacity = this.selected
        ? Math.min(1, entry.opacity + 0.22)
        : entry.opacity;
      if (entry.color && entry.material.color) {
        entry.material.color.copy(entry.color);
        if (this.selected) {
          entry.material.color.lerp(WHITE, 0.12);
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
