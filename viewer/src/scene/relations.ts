import * as THREE from "three";
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js";
import type { Relation } from "../core/types";
import { RELATION_COLORS } from "./palette";
import type { ThemeManager } from "../themes/registry";
import type { CoreLinkKind, ThemeContext } from "../themes/types";
import { resolveLinkKind } from "../themes/resolve";

export interface RelationVisualOptions {
  from: THREE.Vector3;
  to: THREE.Vector3;
  world: "M" | "R";
  density: number;
  themeManager?: ThemeManager;
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

const WHITE = new THREE.Color(0xffffff);

export class RelationVisual {
  readonly relation: Relation;
  readonly group: THREE.Group;
  readonly labelElement: HTMLDivElement;
  private readonly from: THREE.Vector3;
  private readonly to: THREE.Vector3;
  private readonly material: THREE.LineBasicMaterial | THREE.LineDashedMaterial;
  private readonly baseLineColor: THREE.Color;
  private readonly extraStyles: Array<{
    material: THREE.Material & { opacity: number; color?: THREE.Color };
    opacity: number;
    color?: THREE.Color;
  }> = [];
  private readonly pulse?: THREE.Mesh;
  private readonly pulseSpeed: number;
  private readonly pulsePhase: number;
  private density: number;
  private highlighted = false;
  private labelVisible = false;
  private readonly themeManager?: ThemeManager;
  private readonly themeLink?: THREE.Group;
  private readonly linkKind?: CoreLinkKind;
  private readonly themeCtx?: ThemeContext;

  constructor(relation: Relation, options: RelationVisualOptions) {
    this.relation = relation;
    this.from = options.from.clone();
    this.to = options.to.clone();
    this.group = new THREE.Group();
    this.density = options.density;

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
    this.baseLineColor = new THREE.Color(color);

    if (options.themeManager) {
      this.themeManager = options.themeManager;
      this.linkKind = resolveLinkKind(relation.kind);
      this.themeCtx = { world: options.world, phaseProgress: 0 };
      const mid = new THREE.Vector3().lerpVectors(start, end, 0.5);
      mid.y += Math.min(1.2, length * 0.12);
      const points = [start, mid, end];
      this.themeLink = options.themeManager.createLink(this.linkKind, points, this.themeCtx);
      this.group.add(this.themeLink);
    } else {
      const line = new THREE.Line(geometry, this.material);
      if (dashed) {
        line.computeLineDistances();
      }
      line.renderOrder = 1;
      this.group.add(line);
    }

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

    this.captureExtraStyles();
    this.setDensity(options.density);
  }

  private captureExtraStyles(): void {
    const seen = new Set<THREE.Material>();
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line)) return;
      const source = object.material;
      const materials = Array.isArray(source) ? source : [source];
      for (const material of materials) {
        if (!material || material === this.material || seen.has(material)) continue;
        seen.add(material);
        const typed = material as THREE.Material & { opacity: number; color?: THREE.Color };
        this.extraStyles.push({
          material: typed,
          opacity: typed.opacity,
          color: typed.color?.clone(),
        });
      }
    });
  }

  connect(id: string): boolean {
    return this.relation.from === id || this.relation.to === id;
  }

  setHighlighted(highlighted: boolean): void {
    this.highlighted = highlighted;
    this.applyLabelVisibility();
    this.applyStyle();
  }

  setAlwaysVisible(visible: boolean): void {
    this.labelVisible = visible;
    this.applyLabelVisibility();
  }

  setDensity(density: number): void {
    this.density = Math.max(0, Math.min(1, density));
    this.applyStyle();
  }

  private applyLabelVisibility(): void {
    this.labelElement.classList.toggle("visible", this.labelVisible || this.highlighted);
  }

  private applyStyle(): void {
    const boost = this.highlighted ? 1.4 : 1;
    this.material.opacity = Math.min(1, (0.1 + this.density * 0.65) * boost);
    this.material.color.copy(this.baseLineColor).lerp(WHITE, this.highlighted ? 0.18 : 0);

    for (const entry of this.extraStyles) {
      entry.material.opacity = Math.min(1, entry.opacity * (this.highlighted ? 1.2 : 1));
      if (entry.color && entry.material.color) {
        entry.material.color.copy(entry.color).lerp(WHITE, this.highlighted ? 0.12 : 0);
      }
    }
  }

  animate(now: number, elapsed?: number): void {
    const sec = elapsed ?? now * 0.001;
    if (this.themeManager && this.themeLink && this.linkKind && this.themeCtx) {
      this.themeManager.updateLink(this.themeLink, this.linkKind, this.themeCtx, sec);
    }
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
