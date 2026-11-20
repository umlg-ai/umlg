import { applyWorld, validateDraftTexts } from "./core/draft";
import { loadModelFromUrl, ModelLoadError } from "./core/load";
import { ModelGraph } from "./core/model";
import { formatNotesCount } from "./core/notes";
import type { CompiledSchemas, UmlgModel, WorldId } from "./core/types";
import { SceneManager } from "./scene/SceneManager";
import { TransitionController } from "./transition/TransitionController";
import { NotesStore } from "./ui/NotesStore";
import { ViewerUI, type ReadingMode } from "./ui/ViewerUI";

function otherWorld(world: WorldId): WorldId {
  return world === "M" ? "R" : "M";
}

function safeStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    const probe = "umlg:storage-probe";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
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
  let currentModel: UmlgModel | undefined;
  let compiledSchemas: CompiledSchemas | undefined;
  const notes = new NotesStore(safeStorage());
  let storageWarned = false;

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
    getNote: (id) => notes.get(id),
    onNoteChange: (id, text) => {
      const persisted = notes.set(id, text);
      if (!persisted && !storageWarned) {
        storageWarned = true;
        ui.toast("Заметки не сохраняются: браузер блокирует localStorage.", "error");
      }
      return persisted;
    },
    getNoteCount: () => notes.size,
    onExportNotes: () => exportNotes(),
    onImportNotes: (file) => void importNotes(file),
    onCheckDraft: (modelText, layoutText) => {
      if (!compiledSchemas) return { errors: ["Схемы ещё не загружены."], warnings: [] };
      return validateDraftTexts(modelText, layoutText, compiledSchemas);
    },
    onApplyDraft: (model, layout) => {
      const world = applyWorld(scene.world, model);
      const selected = scene.selected;
      const keepSelected = Boolean(
        selected && model.elements?.some((item) => item.id === selected && item.world === world),
      );

      // The draft is already validated; only the in-memory documents change.
      currentModel = model;
      if (notes.activeModelId !== model.id) notes.load(model.id);
      graph = new ModelGraph(model);
      ui.setModel(graph, world, layout);
      scene.setData(model, layout);
      scene.showWorld(world, keepSelected ? selected : null);
      // setData keeps the existing camera; an edited layout camera must take effect.
      scene.resetCamera();
      scene.setDensity(ui.densityValue);
      applyMode();
      ui.refreshNotes(true);
    },
    getModelId: () => currentModel?.id ?? "model",
    onThemeChange: (themeId) => scene.setTheme(themeId),
    onProfileToggle: (profileId, enabled) => scene.setProfileEnabled(profileId, enabled),
  });

  const exportNotes = (): void => {
    const payload = JSON.stringify(notes.exportDocument(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const modelSlug = (notes.activeModelId || "model").replace(/[^a-zA-Z0-9._-]+/g, "-");
    link.href = url;
    link.download = `${modelSlug}-notes.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    ui.toast(
      notes.size > 0
        ? `Экспортировано: ${formatNotesCount(notes.size)}`
        : "Заметок нет — экспортирован пустой файл",
    );
  };

  const importNotes = async (file: File): Promise<void> => {
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text()) as unknown;
    } catch {
      ui.toast("Файл заметок не похож на JSON.", "error");
      return;
    }
    const result = notes.importDocument(raw);
    if ("error" in result) {
      ui.toast(result.error, "error");
      return;
    }
    ui.refreshNotes(true);
    if (!result.persisted) {
      ui.toast("Заметки импортированы, но браузер не дал их сохранить.", "error");
      return;
    }
    ui.toast(`Импортировано: ${result.imported} · всего ${formatNotesCount(result.total)}`);
  };

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
  ui.setTheme(scene.activeThemeId);
  ui.setProfileEnabled("graphics-gpu", scene.isProfileEnabled("graphics-gpu"));
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
    if (ui.isEditorOpen || isTypingTarget(event.target)) return;
    event.preventDefault();
    transition.press(phaseTarget());
  });
  window.addEventListener("keyup", (event) => {
    if (event.code !== "KeyP") return;
    if (ui.isEditorOpen || isTypingTarget(event.target)) return;
    transition.release();
  });
  window.addEventListener("blur", () => transition.release());

  try {
    ui.setLoading(true, "Загружаю модель и проверяю инварианты…");
    const loaded = await loadModelFromUrl();
    currentModel = loaded.model;
    compiledSchemas = loaded.schemas;
    graph = new ModelGraph(loaded.model);
    notes.load(loaded.model.id);
    scene.setData(loaded.model, loaded.layout);
    ui.setModel(graph, "M", loaded.layout);
    ui.refreshNotes();
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
