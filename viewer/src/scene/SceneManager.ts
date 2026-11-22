import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { ModelGraph } from "../core/model";
import type {
  Element,
  LayoutNode,
  UmlgLayout,
  UmlgModel,
  WorldId,
} from "../core/types";
import { ThemeManager } from "../themes/registry";
import { ThemeEnvironmentRenderer } from "../themes/environment-renderer";
import { RelationVisual } from "./relations";
import { ElementVisual } from "./visuals";

interface PointerPosition {
  x: number;
  y: number;
}

export class SceneManager {
  private readonly container: HTMLElement;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly envRenderer: ThemeEnvironmentRenderer;
  private readonly labelRenderer: CSS2DRenderer;
  private readonly controls: OrbitControls;
  private readonly selectionLight: THREE.PointLight;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private pointerDown: PointerPosition = { x: 0, y: 0 };

  readonly themeManager: ThemeManager;
  private graph?: ModelGraph;
  private layout?: UmlgLayout;
  private worldGroup?: THREE.Group;
  private visuals = new Map<string, ElementVisual>();
  private relationVisuals: RelationVisual[] = [];
  private currentWorld: WorldId = "M";
  private selectedId: string | null = null;
  private density = 0.7;
  private architectureMode = false;
  private cameraInitialized = false;

  onSelect?: (id: string) => void;
  onWorldChange?: (world: WorldId) => void;

  constructor(container: HTMLElement, labelLayer: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
    this.camera.position.set(0, 10, 20);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.setClearColor(0x050814, 1);
    container.appendChild(this.renderer.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.style.position = "absolute";
    this.labelRenderer.domElement.style.top = "0";
    this.labelRenderer.domElement.style.left = "0";
    this.labelRenderer.domElement.style.pointerEvents = "none";
    labelLayer.appendChild(this.labelRenderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 140;
    this.controls.target.set(0, 2, -24);

    this.selectionLight = new THREE.PointLight(0x00e676, 0, 5, 2);
    this.selectionLight.position.set(0, 1.0, 0);
    this.scene.add(this.selectionLight);

    this.themeManager = new ThemeManager("tactile-minimal-v1");

    this.envRenderer = new ThemeEnvironmentRenderer(this.renderer, this.scene, this.camera);
    this.envRenderer.applyEnvironment(
      this.themeManager.getEnvironment(this.currentWorld),
      this.currentWorld,
    );

    this.bindPointerEvents();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
  }

  get world(): WorldId {
    return this.currentWorld;
  }

  get selected(): string | null {
    return this.selectedId;
  }

  setData(model: UmlgModel, layout: UmlgLayout): void {
    this.graph = new ModelGraph(model);
    this.layout = layout;
    if (!this.cameraInitialized) {
      this.resetCamera("M");
      this.cameraInitialized = true;
    }
    this.showWorld("M");
  }

  showWorld(world: WorldId, selectId?: string | null): void {
    if (!this.graph || !this.layout) return;

    this.disposeWorldGroup();
    const group = new THREE.Group();
    group.name = `world-${world}`;

    const layoutNodes = new Map<string, LayoutNode>();
    for (const node of this.layout.worlds[world]?.nodes ?? []) {
      layoutNodes.set(node.ref, node);
    }

    const elements = this.graph.model.elements.filter((element) => element.world === world);
    const positions = new Map<string, THREE.Vector3>();
    const unpositioned: Element[] = [];

    for (const element of elements) {
      const node = layoutNodes.get(element.id);
      if (node) {
        positions.set(element.id, new THREE.Vector3(...node.position));
      } else {
        unpositioned.push(element);
      }
    }

    unpositioned.forEach((element, index) => {
      positions.set(element.id, this.fallbackPosition(index, unpositioned.length));
    });

    for (const element of elements) {
      const position = positions.get(element.id);
      if (!position) continue;
      const visual = new ElementVisual(element, {
        position,
        density: this.density,
        onSelect: (id) => this.select(id, false),
        previewKinds: this.graph.previewKinds(element.id),
        themeManager: this.themeManager,
      });
      group.add(visual.group);
      visual.setLabelVisible(this.architectureMode);
      this.visuals.set(element.id, visual);
    }

    for (const relation of this.graph.relations) {
      if (relation.world !== world) continue;
      const from = positions.get(relation.from);
      const to = positions.get(relation.to);
      if (!from || !to) continue;
      const visual = new RelationVisual(relation, {
        from,
        to,
        world,
        density: this.density,
        themeManager: this.themeManager,
      });
      group.add(visual.group);
      this.relationVisuals.push(visual);
      visual.setAlwaysVisible(this.architectureMode);
    }

    this.worldGroup = group;
    this.scene.add(group);
    this.currentWorld = world;
    this.envRenderer.applyEnvironment(this.themeManager.getEnvironment(world), world);

    this.selectedId = null;
    if (selectId && this.visuals.has(selectId)) {
      this.select(selectId, false);
    } else {
      this.clearSelection();
    }

    this.onWorldChange?.(world);
  }

  select(id: string, focus = false): void {
    const visual = this.visuals.get(id);
    if (!visual) return;

    if (this.selectedId && this.selectedId !== id) {
      this.visuals.get(this.selectedId)?.setSelected(false);
    }
    this.selectedId = id;
    visual.setSelected(true);
    this.selectionLight.position.copy(visual.basePosition).add(new THREE.Vector3(0, 1.0, 0));
    this.selectionLight.color.set(this.currentWorld === "M" ? 0x00ff88 : 0x00e676);
    this.selectionLight.intensity = this.currentWorld === "M" ? 3.0 : 3.8;
    for (const relation of this.relationVisuals) {
      relation.setHighlighted(relation.connect(id));
    }
    if (focus) {
      this.focusOn(id);
    }
    this.onSelect?.(id);
  }

  clearSelection(): void {
    if (this.selectedId) {
      this.visuals.get(this.selectedId)?.setSelected(false);
    }
    this.selectedId = null;
    this.selectionLight.intensity = 0;
    for (const relation of this.relationVisuals) {
      relation.setHighlighted(false);
    }
    this.onSelect?.("");
  }

  setDensity(density: number): void {
    this.density = Math.max(0, Math.min(1, density));
    for (const visual of this.visuals.values()) {
      visual.setDensity(this.density);
    }
    for (const relation of this.relationVisuals) {
      relation.setDensity(this.density);
    }
  }

  setArchitectureMode(value: boolean): void {
    this.architectureMode = value;
    for (const visual of this.visuals.values()) {
      visual.setLabelVisible(value);
    }
    for (const relation of this.relationVisuals) {
      relation.setAlwaysVisible(value);
    }
  }

  focusOn(id: string): void {
    const visual = this.visuals.get(id);
    if (!visual) return;
    const target = visual.basePosition.clone();
    const offset = this.camera.position.clone().sub(this.controls.target);
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(offset);
    this.controls.update();
  }

  resetCamera(world: WorldId = this.currentWorld): void {
    const camera = this.layout?.camera?.[world];
    if (camera) {
      this.camera.position.fromArray(camera.position);
      this.camera.up.fromArray(camera.up ?? [0, 1, 0]);
      this.camera.fov = camera.fov ?? 55;
      this.controls.target.fromArray(camera.target);
    } else {
      this.fitCamera(world);
    }
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  private fitCamera(world: WorldId): void {
    const nodes = this.layout?.worlds[world]?.nodes ?? [];
    if (nodes.length === 0) {
      this.camera.position.set(0, 10, 20);
      this.camera.up.set(0, 1, 0);
      this.camera.fov = 55;
      this.controls.target.set(0, 2, -24);
      return;
    }
    const box = new THREE.Box3();
    for (const node of nodes) {
      box.expandByPoint(new THREE.Vector3(...node.position));
    }
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.length() / 2, 6);
    const fov = 55;
    const distance = (radius / Math.sin(THREE.MathUtils.degToRad(fov) / 2)) * 1.15;
    const direction = new THREE.Vector3(1, 1, 1).normalize();
    this.camera.position.copy(center).add(direction.multiplyScalar(distance));
    this.camera.up.set(0, 1, 0);
    this.camera.fov = fov;
    this.controls.target.copy(center);
  }

  update(now: number): void {
    this.controls.update();
    const elapsed = now * 0.001;
    for (const visual of this.visuals.values()) {
      visual.update(now, elapsed);
    }
    for (const relation of this.relationVisuals) {
      relation.animate(now, elapsed);
    }
    this.envRenderer.render();
    this.labelRenderer.render(this.scene, this.camera);
  }

  private bindPointerEvents(): void {
    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", (event) => {
      this.pointerDown = { x: event.clientX, y: event.clientY };
    });
    canvas.addEventListener("pointerup", (event) => {
      const distance = Math.hypot(
        event.clientX - this.pointerDown.x,
        event.clientY - this.pointerDown.y,
      );
      if (distance > 6) return;
      const hit = this.pick(event);
      if (hit) {
        this.select(hit, false);
      }
    });
    canvas.addEventListener("pointermove", (event) => {
      const hit = this.pick(event);
      canvas.style.cursor = hit ? "pointer" : "grab";
    });
    canvas.addEventListener("pointerleave", () => {
      canvas.style.cursor = "grab";
    });
  }

  private pick(event: PointerEvent): string | null {
    if (!this.worldGroup) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([this.worldGroup], true);
    for (const hit of hits) {
      let object: THREE.Object3D | null = hit.object;
      while (object) {
        if (typeof object.userData.elementId === "string") {
          return object.userData.elementId;
        }
        object = object.parent;
      }
    }
    return null;
  }

  private fallbackPosition(index: number, total: number): THREE.Vector3 {
    const columns = Math.max(1, Math.ceil(Math.sqrt(total)));
    const row = Math.floor(index / columns);
    const column = index % columns;
    const x = (column - (columns - 1) / 2) * 5;
    const z = -row * 6;
    return new THREE.Vector3(x, 0, z);
  }

  setTheme(themeId: string): void {
    if (this.themeManager.setTheme(themeId)) {
      this.envRenderer.applyEnvironment(
        this.themeManager.getEnvironment(this.currentWorld),
        this.currentWorld,
      );
      this.showWorld(this.currentWorld, this.selectedId);
    }
  }

  setProfileEnabled(profileId: string, enabled: boolean): void {
    this.themeManager.setProfileEnabled(profileId, enabled);
    this.showWorld(this.currentWorld, this.selectedId);
  }

  get activeThemeId(): string {
    return this.themeManager.getActiveTheme().id;
  }

  isProfileEnabled(profileId: string): boolean {
    return this.themeManager.isProfileEnabled(profileId);
  }

  private disposeWorldGroup(): void {
    for (const visual of this.visuals.values()) {
      visual.dispose();
    }
    for (const relation of this.relationVisuals) {
      relation.dispose();
    }
    this.visuals.clear();
    this.relationVisuals = [];
    this.worldGroup?.removeFromParent();
    this.worldGroup = undefined;
  }

  private resize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.envRenderer.onResize(width, height);
    this.labelRenderer.setSize(width, height);
  }
}
