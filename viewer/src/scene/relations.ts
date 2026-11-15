import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { Relation } from "../core/types";
import { RELATION_COLORS } from "./palette";

export interface RelationVisualOptions {
  from: THREE.Vector3;
  to: THREE.Vector3;
  world: "M" | "R";
  density: number;
}

function edgeMaterial(
  color: number,
  dashed: boolean,
  opacity: number,
): THREE.LineBasicMaterial | THREE.LineDashedMaterial {
  if (dashed) {
    return new THREE.LineDashedMaterial({
      color,
      dashSize: 0.32,
      gapSize: 0.18,
      transparent: true,
      opacity,
    });
  }
  return new THREE.LineBasicMaterial({ color, transparent: true, opacity });
}

export class RelationVisual {
  readonly relation: Relation;
  readonly group: THREE.Group;
  readonly labelElement: HTMLDivElement;
  private readonly from: THREE.Vector3;
  private readonly to: THREE.Vector3;
  private readonly material: THREE.LineBasicMaterial | THREE.LineDashedMaterial;
  private readonly pulse?: THREE.Mesh;
  private readonly pulseSpeed: number;
  private readonly pulsePhase: number;

  constructor(relation: Relation, options: RelationVisualOptions) {
    this.relation = relation;
    this.from = options.from.clone();
    this.to = options.to.clone();
    this.group = new THREE.Group();

    const direction = this.to.clone().sub(this.from);
    const length = direction.length();
    const unit = length > 0.001 ? direction.clone().normalize() : new THREE.Vector3(0, 1, 0);
    const start = this.from.clone().add(unit.clone().multiplyScalar(Math.min(1.1, length * 0.22)));
    const end = this.to.clone().sub(unit.clone().multiplyScalar(Math.min(1.1, length * 0.22)));
    const color = RELATION_COLORS[relation.kind] ?? 0x8fa2c4;
    const dashed =
      relation.kind === "dependency" ||
      relation.kind === "flow" ||
      relation.kind === "call" ||
      relation.kind === "binding";
    const opacity = 0.24 + options.density * 0.52;

    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    this.material = edgeMaterial(color, dashed, opacity);
    const line = new THREE.Line(geometry, this.material);
    if (dashed) {
      line.computeLineDistances();
    }
    line.renderOrder = 1;
    this.group.add(line);

    if (
      relation.kind === "inheritance" ||
      relation.kind === "realization" ||
      relation.kind === "dependency" ||
      relation.kind === "flow" ||
      relation.kind === "call" ||
      relation.kind === "signal"
    ) {
      const arrow = new THREE.Mesh(
        new THREE.ConeGeometry(0.13, 0.36, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
      );
      arrow.position.copy(end);
      arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), unit);
      this.group.add(arrow);
    }

    if (relation.kind === "composition" || relation.kind === "aggregation") {
      const diamond = new THREE.Mesh(
        new THREE.OctahedronGeometry(relation.kind === "composition" ? 0.19 : 0.17),
        new THREE.MeshBasicMaterial({
          color,
          wireframe: relation.kind === "aggregation",
          transparent: true,
          opacity: 0.95,
        }),
      );
      diamond.position.copy(start);
      this.group.add(diamond);
    }

    this.labelElement = document.createElement("div");
    this.labelElement.className = "relation-label";
    const multiplicity =
      relation.fromMultiplicity || relation.toMultiplicity
        ? ` ${relation.fromMultiplicity ?? "1"}→${relation.toMultiplicity ?? "1"}`
        : "";
    this.labelElement.textContent = `${relation.label ?? relation.kind}${multiplicity}`;
    const label = new CSS2DObject(this.labelElement);
    label.center.set(0.5, 0.5);
    label.position.copy(start.clone().add(end).multiplyScalar(0.5));
    this.group.add(label);

    if (options.world === "R" && ["flow", "call", "signal"].includes(relation.kind)) {
      this.pulseSpeed = relation.kind === "flow" ? 0.16 : 0.22;
      this.pulsePhase = Math.random();
      this.pulse = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 8, 8),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
      );
      this.group.add(this.pulse);
    } else {
      this.pulseSpeed = 0;
      this.pulsePhase = 0;
    }
  }

  connect(id: string): boolean {
    return this.relation.from === id || this.relation.to === id;
  }

  setHighlighted(highlighted: boolean): void {
    this.labelElement.classList.toggle("visible", highlighted);
  }

  setAlwaysVisible(visible: boolean): void {
    this.setHighlighted(visible);
  }

  setDensity(density: number): void {
    this.material.opacity = 0.1 + Math.max(0, Math.min(1, density)) * 0.65;
  }

  animate(now: number): void {
    if (!this.pulse) return;
    const t = (now * 0.001 * this.pulseSpeed + this.pulsePhase) % 1;
    this.pulse.position.copy(this.from.clone().lerp(this.to, t));
  }

  dispose(): void {
    this.labelElement.remove();
    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
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
