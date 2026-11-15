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
import { WORLD_THEME } from "./palette";
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
  private readonly labelRenderer: CSS2DRenderer;
  private readonly controls: OrbitControls;
  private readonly grid: THREE.GridHelper;
  private readonly floor: THREE.Mesh;
  private readonly ambient: THREE.HemisphereLight;
  private readonly keyLight: THREE.DirectionalLight;
  private readonly rimLight: THREE.PointLight;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private pointerDown: PointerPosition = { x: 0, y: 0 };

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

    this.ambient = new THREE.HemisphereLight(0x8cc8ff, 0x111122, 1.4);
    this.scene.add(this.ambient);

    this.keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    this.keyLight.position.set(10, 24, 12);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 140;
    this.keyLight.shadow.camera.left = -45;
    this.keyLight.shadow.camera.right = 45;
    this.keyLight.shadow.camera.top = 45;
    this.keyLight.shadow.camera.bottom = -45;
    this.scene.add(this.keyLight);

    this.rimLight = new THREE.PointLight(0x5f7cff, 30, 90, 2);
    this.rimLight.position.set(-14, 10, -18);
    this.scene.add(this.rimLight);

    this.grid = new THREE.GridHelper(150, 75, 0x1b2a48, 0x2f4c7a);
    this.grid.position.y = -1;
    this.scene.add(this.grid);

    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 180),
      new THREE.MeshStandardMaterial({
        color: 0x060912,
        roughness: 1,
        metalness: 0,
        transparent: true,
        opacity: 0.55,
      }),
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -1.02;
    this.floor.receiveShadow = true;
    this.scene.add(this.floor);

    this.bindPointerEvents();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
    this.applyTheme("M");
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
      });
      group.add(visual.group);
      this.relationVisuals.push(visual);
      visual.setAlwaysVisible(this.architectureMode);
    }

    this.worldGroup = group;
    this.scene.add(group);
    this.currentWorld = world;
    this.applyTheme(world);

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
    for (const relation of this.relationVisuals) {
      relation.setHighlighted(this.architectureMode || relation.connect(id));
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
    for (const relation of this.relationVisuals) {
      relation.setHighlighted(this.architectureMode);
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
      relation.setAlwaysVisible(value || relation.connect(this.selectedId ?? ""));
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
    for (const relation of this.relationVisuals) {
      relation.animate(now);
    }
    this.renderer.render(this.scene, this.camera);
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

  private applyTheme(world: WorldId): void {
    const theme = WORLD_THEME[world];
    this.scene.background = new THREE.Color(theme.background);
    this.scene.fog = new THREE.Fog(theme.fog, 60, 210);
    this.renderer.setClearColor(theme.background, 1);

    this.ambient.color.set(theme.light);
    this.ambient.groundColor.set(world === "M" ? 0x111427 : 0x1f1008);
    this.keyLight.color.set(world === "M" ? 0xd6ebff : 0xffd9b8);
    this.rimLight.color.set(theme.warm);
    this.rimLight.intensity = world === "M" ? 26 : 20;

    const gridMaterials = Array.isArray(this.grid.material)
      ? this.grid.material
      : [this.grid.material];
    gridMaterials.forEach((material, index) => {
      if (material instanceof THREE.LineBasicMaterial) {
        material.color.set(index === 0 ? theme.grid : theme.gridAccent);
        material.transparent = true;
        material.opacity = world === "M" ? 0.4 : 0.3;
      }
    });

    const floorMaterial = this.floor.material;
    if (floorMaterial instanceof THREE.MeshStandardMaterial) {
      floorMaterial.color.set(theme.background);
      floorMaterial.opacity = world === "M" ? 0.35 : 0.72;
    }
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
    this.renderer.setSize(width, height, false);
    this.labelRenderer.setSize(width, height);
  }
}
