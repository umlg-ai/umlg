import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { Element } from "../core/types";
import { ELEMENT_COLORS, kindLabel } from "./palette";

export interface ElementVisualOptions {
  position: THREE.Vector3;
  density: number;
  onSelect: (id: string) => void;
}

function openBoxEdges(width: number, height: number, depth: number): THREE.BufferGeometry {
  const x = width / 2;
  const y = height / 2;
  const z = depth / 2;
  const corners = [
    new THREE.Vector3(-x, -y, -z),
    new THREE.Vector3(x, -y, -z),
    new THREE.Vector3(x, -y, z),
    new THREE.Vector3(-x, -y, z),
    new THREE.Vector3(-x, y, -z),
    new THREE.Vector3(x, y, -z),
    new THREE.Vector3(x, y, z),
    new THREE.Vector3(-x, y, z),
  ];
  const edges: Array<[number, number]> = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4],
    // 0-4 is intentionally missing: the contour is open.
    [1, 5],
    [2, 6],
    [3, 7],
  ];
  const points: THREE.Vector3[] = [];
  for (const [a, b] of edges) {
    points.push(corners[a], corners[b]);
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

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

export class ElementVisual {
  readonly element: Element;
  readonly group: THREE.Group;
  readonly meshes: THREE.Mesh[] = [];
  readonly labelElement: HTMLDivElement;
  readonly basePosition: THREE.Vector3;
  private readonly label: CSS2DObject;
  private readonly selectionRing: THREE.Mesh;
  private readonly selectionMaterial: THREE.MeshBasicMaterial;
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

    let labelHeight = 1.8;

    switch (element.kind) {
      case "class": {
        const geometry = new THREE.BoxGeometry(2.4, 1.6, 2.4);
        addMesh(geometry, additive(0.16, 0.55));
        addEdges(this.group, new THREE.EdgesGeometry(geometry), color, { opacity: 0.9 });
        labelHeight = 1.8;
        break;
      }
      case "abstractClass": {
        const geometry = new THREE.BoxGeometry(2.4, 1.6, 2.4);
        addMesh(geometry, additive(0.09, 0.75));
        addEdges(this.group, openBoxEdges(2.4, 1.6, 2.4), color, {
          dashed: true,
          opacity: 0.95,
        });
        labelHeight = 1.8;
        break;
      }
      case "interface": {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1.05, 0.17, 12, 42),
          mental ? additive(0.5, 0.8) : solid(0.5, 0.35),
        );
        addMesh(ring.geometry, ring.material);
        addEdges(this.group, new THREE.EdgesGeometry(ring.geometry), color, { opacity: 0.5 });
        for (const x of [-0.75, 0.75]) {
          const port = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.12, 0.42, 8),
            mental ? additive(0.7, 0.9) : solid(0.6, 0.3),
          );
          port.rotation.z = Math.PI / 2;
          port.position.set(x, 0, 0);
          port.userData.elementId = element.id;
          this.group.add(port);
          this.meshes.push(port);
        }
        labelHeight = 1.65;
        break;
      }
      case "component": {
        const geometry = new THREE.BoxGeometry(4.2, 2.4, 4.2);
        addMesh(geometry, additive(0.07, 0.5));
        addEdges(this.group, new THREE.EdgesGeometry(geometry), color, {
          dashed: true,
          opacity: 0.65,
        });
        labelHeight = 2.15;
        break;
      }
      case "concept": {
        const geometry = new THREE.OctahedronGeometry(1.15, 0);
        addMesh(geometry, additive(0.2, 0.9));
        addEdges(this.group, new THREE.EdgesGeometry(geometry), color, { opacity: 0.95 });
        const inner = new THREE.Mesh(
          new THREE.IcosahedronGeometry(0.38, 0),
          new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.7 }),
        );
        inner.userData.elementId = element.id;
        this.group.add(inner);
        this.meshes.push(inner);
        labelHeight = 1.7;
        break;
      }
      case "object": {
        const geometry = new THREE.BoxGeometry(2.2, 1.6, 2.2);
        addMesh(geometry, solid(0.35, 0.42));
        addEdges(this.group, new THREE.EdgesGeometry(geometry), 0x2a1a12, { opacity: 0.45 });
        labelHeight = 1.8;
        break;
      }
      case "resource": {
        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(1.0, 1.0, 1.8, 22, 1),
          solid(0.45, 0.38),
        );
        addMesh(body.geometry, body.material);
        for (const y of [-0.58, 0.58]) {
          const band = new THREE.Mesh(
            new THREE.TorusGeometry(1.0, 0.045, 8, 32),
            new THREE.MeshBasicMaterial({ color: 0xffd0a2, transparent: true, opacity: 0.8 }),
          );
          band.rotation.x = Math.PI / 2;
          band.position.y = y;
          band.userData.elementId = element.id;
          this.group.add(band);
          this.meshes.push(band);
        }
        labelHeight = 1.9;
        break;
      }
      case "process": {
        const geometry = new THREE.CylinderGeometry(0.9, 1.1, 1.5, 8);
        addMesh(geometry, solid(0.3, 0.45));
        addEdges(this.group, new THREE.EdgesGeometry(geometry), 0x2a1a12, { opacity: 0.5 });
        labelHeight = 1.7;
        break;
      }
      case "stage": {
        const geometry = new THREE.BoxGeometry(2.8, 0.44, 1.3);
        addMesh(geometry, solid(0.25, 0.35), 0.1);
        addEdges(this.group, new THREE.EdgesGeometry(geometry), 0x5a351d, { opacity: 0.6 });
        const chevron = new THREE.ConeGeometry(0.13, 0.36, 3);
        const chevronMaterial = new THREE.MeshBasicMaterial({
          color: 0xffe0a3,
          transparent: true,
          opacity: 0.9,
        });
        for (const x of [-0.75, 0, 0.75]) {
          const mesh = new THREE.Mesh(chevron.clone(), chevronMaterial);
          mesh.rotation.z = -Math.PI / 2;
          mesh.position.set(x, 0.42, 0);
          mesh.userData.elementId = element.id;
          this.group.add(mesh);
          this.meshes.push(mesh);
        }
        labelHeight = 1.2;
        break;
      }
      case "command": {
        const geometry = new THREE.BoxGeometry(1.4, 0.2, 1.0);
        addMesh(geometry, solid(0.2, 0.3), 0.3);
        addEdges(this.group, new THREE.EdgesGeometry(geometry), 0xfff0c8, { opacity: 0.9 });
        labelHeight = 1.25;
        break;
      }
      case "actor": {
        const base = new THREE.Mesh(
          new THREE.CylinderGeometry(1.15, 1.35, 0.42, 20),
          solid(0.4, 0.5),
        );
        addMesh(base.geometry, base.material, 0.1);
        const screen = new THREE.Mesh(
          new THREE.BoxGeometry(1.25, 0.82, 0.12),
          new THREE.MeshStandardMaterial({
            color: 0x16121b,
            emissive: color,
            emissiveIntensity: 0.35,
            metalness: 0.4,
            roughness: 0.3,
          }),
        );
        screen.position.set(0, 0.86, 0);
        screen.rotation.x = -0.18;
        screen.userData.elementId = element.id;
        this.group.add(screen);
        this.meshes.push(screen);
        labelHeight = 1.7;
        break;
      }
      default: {
        const geometry = new THREE.BoxGeometry(1.4, 1.4, 1.4);
        addMesh(geometry, mental ? additive(0.2, 0.5) : solid(0.3, 0.5));
        addEdges(this.group, new THREE.EdgesGeometry(geometry), color);
      }
    }

    const discMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.45, 36), discMaterial);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = -0.9;
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
      new THREE.RingGeometry(1.35, 1.55, 48),
      this.selectionMaterial,
    );
    this.selectionRing.rotation.x = -Math.PI / 2;
    this.selectionRing.position.y = -0.88;
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
      this.label.position.set(0, -0.85, 0);
    } else {
      this.label.center.set(0.5, 1);
      this.label.position.set(0, labelHeight, 0);
    }
    this.group.add(this.label);

    this.setDensity(options.density);
  }

  setSelected(selected: boolean): void {
    this.selected = selected;
    this.selectionMaterial.opacity = selected ? 0.85 : 0;
    this.labelElement.classList.toggle("selected", selected);
    this.group.scale.setScalar(selected ? 1.06 : 1);
    this.applyLabelVisibility();
    this.setDensity(this.density);
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
