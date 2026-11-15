import { ModelGraph } from "./core/model";
import { loadModelFromUrl, ModelLoadError } from "./core/load";
import type { WorldId } from "./core/types";
import { SceneManager } from "./scene/SceneManager";
import { TransitionController } from "./transition/TransitionController";
import { ViewerUI, type ReadingMode } from "./ui/ViewerUI";

function otherWorld(world: WorldId): WorldId {
  return world === "M" ? "R" : "M";
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return true;
  if (tag === "INPUT") {
    const type = (target as HTMLInputElement).type;
    return !["checkbox", "radio", "range", "button", "submit", "reset", "file", "color"].includes(
      type,
    );
  }
  return false;
}

async function main(): Promise<void> {
  const container = document.querySelector<HTMLElement>("#scene-container");
  const labelLayer = document.querySelector<HTMLElement>("#label-layer");
  if (!container || !labelLayer) {
    throw new Error("Не найдены контейнеры сцены");
  }

  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = reducedMotionQuery.matches;
  let mode: ReadingMode = "story";
  let graph: ModelGraph | undefined;

  const scene = new SceneManager(container, labelLayer);

  const applyMode = (): void => {
    scene.setArchitectureMode(mode === "architecture");
    document.body.dataset.mode = mode;
  };

  const phaseTarget = (): { targetWorld: WorldId; targetId?: string } => {
    const targetWorld = otherWorld(scene.world);
    const selected = scene.selected;
    const twin = selected ? graph?.twin(selected) : undefined;
    if (twin && twin.element.world === targetWorld) {
      return { targetWorld, targetId: twin.element.id };
    }
    return { targetWorld };
  };

  const ui = new ViewerUI({
    onPhasePress: () => transition.press(phaseTarget()),
    onPhaseRelease: () => transition.release(),
    onPhaseSingle: () => transition.start(phaseTarget()),
    onSelect: (id) => {
      if (id) scene.select(id, false);
    },
    onDensityChange: (value) => scene.setDensity(value),
    onModeChange: (value) => {
      mode = value;
      applyMode();
    },
    onReducedMotion: (value) => {
      reducedMotion = value;
      transition.setReducedMotion(value);
      document.body.dataset.reducedMotion = value ? "true" : "false";
    },
    onResetCamera: () => scene.resetCamera(),
    onTwin: (id) => {
      const target = graph?.element(id);
      if (!target) return;
      if (target.world === scene.world) {
        scene.select(id, true);
        return;
      }
      transition.start({ targetId: id, targetWorld: target.world });
    },
    onClearSelection: () => scene.clearSelection(),
  });

  const transition = new TransitionController({
    getWorld: () => scene.world,
    onState: (info) => ui.setTransition(info),
    onVeil: (active, label) => ui.setVeil(active, label),
    onProgress: (value) => ui.setProgress(value),
    onSwap: (targetWorld, targetId) => {
      scene.showWorld(targetWorld, targetId ?? null);
      if (targetId) {
        // The swap happens under the opaque phase veil, so centering the twin
        // reads as an arrival rather than a camera fly-through.
        scene.focusOn(targetId);
      }
      ui.setWorld(targetWorld);
      applyMode();
    },
  });

  transition.setReducedMotion(reducedMotion);
  ui.setReducedMotion(reducedMotion);
  ui.setDensityValue(0.7);
  ui.setMode(mode);
  document.body.dataset.mode = mode;
  document.body.dataset.reducedMotion = reducedMotion ? "true" : "false";

  scene.onSelect = (id) => ui.setSelected(id);
  scene.onWorldChange = (world) => ui.setWorld(world);

  const onReducedMotionChange = (event: MediaQueryListEvent): void => {
    reducedMotion = event.matches;
    ui.setReducedMotion(reducedMotion);
    transition.setReducedMotion(reducedMotion);
    document.body.dataset.reducedMotion = reducedMotion ? "true" : "false";
  };
  reducedMotionQuery.addEventListener("change", onReducedMotionChange);

  window.addEventListener("keydown", (event) => {
    if (event.code !== "KeyP" || event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    if (isTypingTarget(event.target)) return;
    event.preventDefault();
    transition.press(phaseTarget());
  });
  window.addEventListener("keyup", (event) => {
    if (event.code !== "KeyP") return;
    if (isTypingTarget(event.target)) return;
    transition.release();
  });
  window.addEventListener("blur", () => transition.release());

  try {
    ui.setLoading(true, "Загружаю модель и проверяю инварианты…");
    const loaded = await loadModelFromUrl();
    graph = new ModelGraph(loaded.model);
    scene.setData(loaded.model, loaded.layout);
    ui.setModel(graph, "M");
    ui.setLoading(false);
    ui.setWorld("M");
    scene.setDensity(ui.densityValue);
    applyMode();
    ui.toast(
      `${loaded.model.name} · ${loaded.model.elements.length} элементов · ${graph.links.length} межмировых связей`,
    );
  } catch (error) {
    const issues =
      error instanceof ModelLoadError && error.issues.length > 0
        ? error.issues
        : [error instanceof Error ? error.message : String(error)];
    ui.showError("Модель не загрузилась", issues);
    console.error(error);
    return;
  }

  const frame = (now: number): void => {
    transition.update(now);
    scene.update(now);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

void main();
