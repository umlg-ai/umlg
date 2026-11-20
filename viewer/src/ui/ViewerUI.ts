import { canApplyDraft, draftFilename, parseDraft, type DraftReport } from "../core/draft";
import { ModelGraph } from "../core/model";
import { formatNotesCount } from "../core/notes";
import type {
  Element,
  Link,
  Member,
  Relation,
  UmlgLayout,
  UmlgModel,
  WorldId,
} from "../core/types";
import type { TransitionInfo } from "../transition/TransitionController";

export type ReadingMode = "story" | "architecture";

export interface ViewerUIOptions {
  onPhasePress: () => void;
  onPhaseRelease: () => void;
  onPhaseSingle: () => void;
  onSelect: (id: string) => void;
  onDensityChange: (value: number) => void;
  onModeChange: (mode: ReadingMode) => void;
  onReducedMotion: (value: boolean) => void;
  onResetCamera: () => void;
  onTwin: (id: string) => void;
  onClearSelection: () => void;
  getNote: (elementId: string) => string;
  /** Returns false when the browser refused to persist the note. */
  onNoteChange: (elementId: string, text: string) => boolean;
  getNoteCount: () => number;
  onExportNotes: () => void;
  onImportNotes: (file: File) => void;
  onCheckDraft: (modelText: string, layoutText: string) => DraftReport;
  onApplyDraft: (model: UmlgModel, layout: UmlgLayout) => void;
  getModelId: () => string;
  onThemeChange?: (themeId: string) => void;
  onProfileToggle?: (profileId: string, enabled: boolean) => void;
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function describeMember(member: Member): string {
  const parts: string[] = [];
  if (member.visibility) parts.push(member.visibility);
  if (member.kind === "method") {
    parts.push(member.signature ?? `${member.name}()`);
    if (member.isAbstract) parts.push("abstract");
  } else {
    if (member.type) parts.push(member.type);
    if (member.isReadonly) parts.push("readonly");
    if (member.isStatic) parts.push("static");
  }
  return parts.join(" · ");
}

export class ViewerUI {
  private readonly options: ViewerUIOptions;
  private readonly elements = {
    elementList: document.querySelector<HTMLElement>("#element-list")!,
    elementCount: document.querySelector<HTMLElement>("#element-count")!,
    listSubtitle: document.querySelector<HTMLElement>("#list-subtitle")!,
    elementFilter: document.querySelector<HTMLInputElement>("#element-filter")!,
    worldBadge: document.querySelector<HTMLElement>("#world-badge")!,
    worldName: document.querySelector<HTMLElement>("#world-name")!,
    twinIndicator: document.querySelector<HTMLElement>("#twin-indicator")!,
    phaseState: document.querySelector<HTMLElement>("#phase-state")!,
    inspector: document.querySelector<HTMLElement>("#inspector")!,
    inspectorSubtitle: document.querySelector<HTMLElement>("#inspector-subtitle")!,
    clearSelection: document.querySelector<HTMLButtonElement>("#clear-selection")!,
    phaseButton: document.querySelector<HTMLButtonElement>("#phase-button")!,
    phaseMeter: document.querySelector<HTMLElement>("#phase-meter-fill")!,
    modeToggle: document.querySelector<HTMLElement>("#mode-toggle")!,
    themeToggle: document.querySelector<HTMLElement>("#theme-toggle"),
    profileGraphicsGpu: document.querySelector<HTMLInputElement>("#profile-graphics-gpu"),
    density: document.querySelector<HTMLInputElement>("#density")!,
    reducedMotion: document.querySelector<HTMLInputElement>("#reduced-motion")!,
    resetCamera: document.querySelector<HTMLButtonElement>("#reset-camera")!,
    notesCount: document.querySelector<HTMLElement>("#notes-count")!,
    notesExport: document.querySelector<HTMLButtonElement>("#notes-export")!,
    notesImport: document.querySelector<HTMLButtonElement>("#notes-import")!,
    notesImportFile: document.querySelector<HTMLInputElement>("#notes-import-file")!,
    toast: document.querySelector<HTMLElement>("#toast")!,
    loading: document.querySelector<HTMLElement>("#loading")!,
    loadingText: document.querySelector<HTMLElement>("#loading-text")!,
    errorScreen: document.querySelector<HTMLElement>("#error-screen")!,
    errorText: document.querySelector<HTMLElement>("#error-text")!,
    phaseVeil: document.querySelector<HTMLElement>("#phase-veil")!,
    phaseVeilLabel: document.querySelector<HTMLElement>("#phase-veil-label")!,
    editorOpen: document.querySelector<HTMLButtonElement>("#editor-open")!,
    editorOverlay: document.querySelector<HTMLElement>("#editor-overlay")!,
    editorDrawer: document.querySelector<HTMLElement>("#editor-drawer")!,
    editorClose: document.querySelector<HTMLButtonElement>("#editor-close")!,
    editorTabModel: document.querySelector<HTMLButtonElement>("#editor-tab-model")!,
    editorTabLayout: document.querySelector<HTMLButtonElement>("#editor-tab-layout")!,
    editorPanelModel: document.querySelector<HTMLElement>("#editor-panel-model")!,
    editorPanelLayout: document.querySelector<HTMLElement>("#editor-panel-layout")!,
    editorModelInput: document.querySelector<HTMLTextAreaElement>("#editor-model-input")!,
    editorLayoutInput: document.querySelector<HTMLTextAreaElement>("#editor-layout-input")!,
    editorCheck: document.querySelector<HTMLButtonElement>("#editor-check")!,
    editorApply: document.querySelector<HTMLButtonElement>("#editor-apply")!,
    editorDownloadModel: document.querySelector<HTMLButtonElement>("#editor-download-model")!,
    editorDownloadLayout: document.querySelector<HTMLButtonElement>("#editor-download-layout")!,
    editorStatus: document.querySelector<HTMLElement>("#editor-status")!,
    editorIssues: document.querySelector<HTMLElement>("#editor-issues")!,
  };

  private graph?: ModelGraph;
  private world: WorldId = "M";
  private selectedId: string | null = null;
  private toastTimer = 0;
  private noteEditor?: HTMLTextAreaElement;
  private noteMeta?: HTMLElement;
  private noteMetaId: string | null = null;
  private editorVisible = false;
  private editorTrigger: HTMLElement | null = null;
  private editorTab: "model" | "layout" = "model";
  private editorValid = false;

  constructor(options: ViewerUIOptions) {
    this.options = options;
    this.bind();
  }

  get isEditorOpen(): boolean {
    return this.editorVisible;
  }

  setModel(graph: ModelGraph, world: WorldId, layout: UmlgLayout): void {
    this.graph = graph;
    this.setEditorDocuments(graph.model, layout);
    this.setWorld(world);
  }

  setWorld(world: WorldId): void {
    this.world = world;
    const name = this.graph?.worldName(world) ?? (world === "M" ? "Замысел" : "Воплощение");
    this.elements.worldBadge.dataset.world = world;
    this.elements.worldName.textContent = `${world} — ${name}`;
    this.elements.listSubtitle.textContent = `${world}-мир · ${name}`;
    this.renderList();
  }

  setSelected(id: string): void {
    this.selectedId = id || null;
    this.renderList();

    for (const row of this.elements.elementList.querySelectorAll<HTMLElement>(".element-row")) {
      row.classList.toggle("selected", row.dataset.id === this.selectedId);
    }

    this.renderInspector();
  }

  setDensityValue(value: number): void {
    this.elements.density.value = String(value);
  }

  get densityValue(): number {
    return Number(this.elements.density.value);
  }

  setMode(mode: ReadingMode): void {
    for (const button of this.elements.modeToggle.querySelectorAll<HTMLButtonElement>("button")) {
      button.classList.toggle("active", button.dataset.mode === mode);
    }
  }

  setTheme(themeId: string): void {
    if (!this.elements.themeToggle) return;
    for (const button of this.elements.themeToggle.querySelectorAll<HTMLButtonElement>("button")) {
      button.classList.toggle("active", button.dataset.theme === themeId);
    }
  }

  setProfileEnabled(profileId: string, enabled: boolean): void {
    if (profileId === "graphics-gpu" && this.elements.profileGraphicsGpu) {
      this.elements.profileGraphicsGpu.checked = enabled;
    }
  }

  setReducedMotion(value: boolean): void {
    this.elements.reducedMotion.checked = value;
  }

  setTransition(info: TransitionInfo): void {
    this.elements.phaseState.textContent = info.state;
    this.elements.phaseButton.classList.toggle("active", info.state !== "idle");
    this.elements.phaseButton.setAttribute(
      "aria-label",
      info.state === "idle" ? "Фаза: удерживай P" : `Фаза: ${info.state}`,
    );
    if (info.state === "idle" || info.state === "arming") {
      this.elements.phaseButton.querySelector<HTMLElement>(".phase-button-hint")!.textContent =
        info.state === "arming" ? "набираю…" : "удерживай P";
    } else {
      this.elements.phaseButton.querySelector<HTMLElement>(".phase-button-hint")!.textContent =
        info.state;
    }
  }

  setProgress(value: number): void {
    this.elements.phaseMeter.style.width = `${Math.round(value * 100)}%`;
  }

  setVeil(active: boolean, label: string): void {
    this.elements.phaseVeil.classList.toggle("active", active);
    this.elements.phaseVeilLabel.textContent = label;
  }

  setLoading(visible: boolean, text?: string): void {
    this.elements.loading.hidden = !visible;
    if (text) this.elements.loadingText.textContent = text;
  }

  showError(title: string, details: string[]): void {
    this.elements.loading.hidden = true;
    this.elements.errorScreen.hidden = false;
    const heading = this.elements.errorScreen.querySelector("h2");
    if (heading) heading.textContent = title;
    this.elements.errorText.textContent = details.join("\n") || title;
  }

  toast(message: string, kind: "info" | "error" = "info"): void {
    window.clearTimeout(this.toastTimer);
    this.elements.toast.hidden = false;
    this.elements.toast.dataset.kind = kind;
    this.elements.toast.textContent = message;
    this.toastTimer = window.setTimeout(() => {
      this.elements.toast.hidden = true;
    }, 3600);
  }

  private bind(): void {
    this.elements.elementFilter.addEventListener("input", () => this.renderList());

    this.elements.phaseButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      this.elements.phaseButton.setPointerCapture?.(event.pointerId);
      this.options.onPhasePress();
    });
    for (const eventName of ["pointerup", "pointerleave", "pointercancel"] as const) {
      this.elements.phaseButton.addEventListener(eventName, () => this.options.onPhaseRelease());
    }
    this.elements.phaseButton.addEventListener("click", (event) => {
      // Keyboard activation has detail === 0; pointer clicks are handled by hold.
      if (event.detail === 0) {
        this.options.onPhaseSingle();
      }
    });

    for (const button of this.elements.modeToggle.querySelectorAll<HTMLButtonElement>("button")) {
      button.addEventListener("click", () => {
        const mode = button.dataset.mode === "architecture" ? "architecture" : "story";
        this.setMode(mode);
        this.options.onModeChange(mode);
      });
    }

    if (this.elements.themeToggle) {
      for (const button of this.elements.themeToggle.querySelectorAll<HTMLButtonElement>("button")) {
        button.addEventListener("click", () => {
          const themeId = button.dataset.theme;
          if (themeId) {
            this.setTheme(themeId);
            this.options.onThemeChange?.(themeId);
          }
        });
      }
    }

    if (this.elements.profileGraphicsGpu) {
      this.elements.profileGraphicsGpu.addEventListener("change", () => {
        const enabled = this.elements.profileGraphicsGpu!.checked;
        this.options.onProfileToggle?.("graphics-gpu", enabled);
      });
    }

    this.elements.density.addEventListener("input", () => {
      this.options.onDensityChange(Number(this.elements.density.value));
    });
    this.elements.reducedMotion.addEventListener("change", () => {
      this.options.onReducedMotion(this.elements.reducedMotion.checked);
    });
    this.elements.resetCamera.addEventListener("click", () => this.options.onResetCamera());
    this.elements.clearSelection.addEventListener("click", () => this.options.onClearSelection());

    this.elements.notesExport.addEventListener("click", () => this.options.onExportNotes());
    this.elements.notesImport.addEventListener("click", () => this.elements.notesImportFile.click());
    this.elements.notesImportFile.addEventListener("change", () => {
      const file = this.elements.notesImportFile.files?.[0];
      this.elements.notesImportFile.value = "";
      if (file) this.options.onImportNotes(file);
    });

    this.bindEditor();
  }

  private bindEditor(): void {
    this.elements.editorOpen.addEventListener("click", () => this.openEditor());
    this.elements.editorClose.addEventListener("click", () => this.closeEditor());
    this.elements.editorOverlay
      .querySelector<HTMLElement>("[data-editor-close]")
      ?.addEventListener("click", () => this.closeEditor());

    this.elements.editorTabModel.addEventListener("click", () => this.selectEditorTab("model"));
    this.elements.editorTabLayout.addEventListener("click", () => this.selectEditorTab("layout"));
    for (const tab of [this.elements.editorTabModel, this.elements.editorTabLayout]) {
      tab.addEventListener("keydown", (event) => this.onEditorTabKey(event));
    }

    for (const input of [this.elements.editorModelInput, this.elements.editorLayoutInput]) {
      input.addEventListener("input", () => this.resetEditorResult());
    }
    this.elements.editorCheck.addEventListener("click", () => this.runCheck());
    this.elements.editorApply.addEventListener("click", () => this.applyDraft());
    this.elements.editorDownloadModel.addEventListener("click", () => this.downloadDraft("model"));
    this.elements.editorDownloadLayout.addEventListener("click", () => this.downloadDraft("layout"));

    document.addEventListener("keydown", (event) => {
      if (!this.editorVisible) return;
      if (event.key === "Escape") {
        event.preventDefault();
        this.closeEditor();
        return;
      }
      if (event.key === "Tab") this.trapEditorFocus(event);
    });
  }

  /** Keeps Tab inside the modal; normal Tab order within the drawer is unchanged. */
  private trapEditorFocus(event: KeyboardEvent): void {
    const focusable = [
      ...this.elements.editorDrawer.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), ' +
          'select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((node) => node.tabIndex >= 0 && node.getClientRects().length > 0);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (!this.elements.editorDrawer.contains(active)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    } else if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private setEditorDocuments(model: UmlgModel, layout: UmlgLayout): void {
    this.elements.editorModelInput.value = JSON.stringify(model, null, 2);
    this.elements.editorLayoutInput.value = JSON.stringify(layout, null, 2);
    this.resetEditorResult();
  }

  private openEditor(): void {
    if (this.editorVisible) return;
    this.editorTrigger =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.editorVisible = true;
    this.elements.editorOverlay.hidden = false;
    document.body.dataset.editorOpen = "true";
    this.selectEditorTab(this.editorTab);
    this.activeEditorInput().focus();
  }

  private closeEditor(): void {
    if (!this.editorVisible) return;
    this.editorVisible = false;
    this.elements.editorOverlay.hidden = true;
    delete document.body.dataset.editorOpen;
    if (this.editorTrigger?.isConnected) this.editorTrigger.focus();
    this.editorTrigger = null;
  }

  private activeEditorInput(): HTMLTextAreaElement {
    return this.editorTab === "model"
      ? this.elements.editorModelInput
      : this.elements.editorLayoutInput;
  }

  private selectEditorTab(tab: "model" | "layout"): void {
    this.editorTab = tab;
    const model = tab === "model";
    for (const [button, active] of [
      [this.elements.editorTabModel, model],
      [this.elements.editorTabLayout, !model],
    ] as const) {
      button.setAttribute("aria-selected", active ? "true" : "false");
      button.tabIndex = active ? 0 : -1;
    }
    this.elements.editorPanelModel.hidden = !model;
    this.elements.editorPanelLayout.hidden = model;
  }

  /** Arrow keys move between tabs; Tab keeps its normal document order. */
  private onEditorTabKey(event: KeyboardEvent): void {
    const target =
      event.key === "ArrowLeft" || event.key === "Home"
        ? "model"
        : event.key === "ArrowRight" || event.key === "End"
          ? "layout"
          : null;
    if (!target) return;
    event.preventDefault();
    this.selectEditorTab(target);
    (target === "model" ? this.elements.editorTabModel : this.elements.editorTabLayout).focus();
  }

  private resetEditorResult(): void {
    this.editorValid = false;
    this.elements.editorApply.disabled = true;
    this.elements.editorStatus.textContent = "";
    this.elements.editorStatus.removeAttribute("data-state");
    this.elements.editorIssues.replaceChildren();
  }

  private runCheck(): DraftReport {
    const report = this.options.onCheckDraft(
      this.elements.editorModelInput.value,
      this.elements.editorLayoutInput.value,
    );
    this.showCheckReport(report);
    return report;
  }

  private showCheckReport(report: DraftReport): void {
    this.editorValid = canApplyDraft(report);
    this.elements.editorApply.disabled = !this.editorValid;
    this.elements.editorIssues.replaceChildren();
    for (const warning of report.warnings) this.appendEditorIssue("warning", warning);
    for (const error of report.errors) this.appendEditorIssue("error", error);

    const { errors, warnings } = report;
    if (errors.length > 0) {
      this.elements.editorStatus.dataset.state = "error";
      this.elements.editorStatus.textContent =
        `Ошибок: ${errors.length}` + (warnings.length ? ` · предупреждений: ${warnings.length}` : "");
    } else {
      this.elements.editorStatus.dataset.state = "ok";
      this.elements.editorStatus.textContent =
        "Проверка пройдена" +
        (warnings.length ? ` · предупреждений: ${warnings.length}` : "") +
        ". Нажмите «Применить», чтобы обновить сцену.";
    }
  }

  private appendEditorIssue(level: "error" | "warning", message: string): void {
    const item = element("li", "", message);
    item.dataset.level = level;
    this.elements.editorIssues.append(item);
  }

  private applyDraft(): void {
    // Re-check on activation so a stale report can never apply edited text.
    const report = this.runCheck();
    if (!canApplyDraft(report) || !report.model || !report.layout) return;
    this.options.onApplyDraft(report.model, report.layout);
    this.toast("Модель и раскладка применены к сцене.");
    this.closeEditor();
  }

  private downloadDraft(kind: "model" | "layout"): void {
    const text =
      kind === "model" ? this.elements.editorModelInput.value : this.elements.editorLayoutInput.value;
    const parsed = parseDraft(this.elements.editorModelInput.value, "model.json");
    let modelId = this.options.getModelId();
    if (parsed.ok && parsed.value !== null && typeof parsed.value === "object") {
      const id = (parsed.value as { id?: unknown }).id;
      if (typeof id === "string" && id.trim()) modelId = id;
    }

    const filename = draftFilename(modelId, kind);
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    this.toast(`Скачано: ${filename}`);
  }

  /** Re-reads note marks after an import or a model change without rebuilding the inspector. */
  refreshNotes(reloadEditor = false): void {
    this.updateNotesCount();
    for (const row of this.elements.elementList.querySelectorAll<HTMLElement>(".element-row")) {
      const id = row.dataset.id;
      if (id) this.applyNoteMark(row, Boolean(this.options.getNote(id)));
    }
    if (this.noteEditor && this.selectedId) {
      if (reloadEditor) this.noteEditor.value = this.options.getNote(this.selectedId);
      this.updateNoteMeta(this.selectedId, true);
    }
  }

  private renderList(): void {
    if (!this.graph) return;
    const query = this.elements.elementFilter.value.trim().toLowerCase();
    const elements = this.graph.model.elements
      .filter((item) => item.world === this.world)
      .filter((item) => {
        if (!query) return true;
        return `${item.name} ${item.id} ${item.kind}`.toLowerCase().includes(query);
      })
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));

    this.elements.elementCount.textContent = String(elements.length);
    this.elements.elementList.replaceChildren();

    if (elements.length === 0) {
      this.elements.elementList.append(
        element("p", "empty-state", "Ничего не найдено. Сбрось фильтр или смени мир."),
      );
      return;
    }

    for (const item of elements) {
      const row = element("button", "element-row");
      row.type = "button";
      row.dataset.id = item.id;
      row.dataset.world = item.world;
      row.classList.toggle("selected", item.id === this.selectedId);
      const note = this.options.getNote(item.id);
      row.append(
        element("span", "row-world", item.world),
        element("span", "row-name", item.name),
        element("span", "row-kind", item.kind),
        element("span", "row-note", note ? "✎" : ""),
      );
      this.applyNoteMark(row, Boolean(note));
      row.addEventListener("click", () => this.options.onSelect(item.id));
      this.elements.elementList.append(row);
    }

    this.updateNotesCount();
  }

  private applyNoteMark(row: HTMLElement, hasNote: boolean): void {
    row.classList.toggle("has-note", hasNote);
    const badge = row.querySelector<HTMLElement>(".row-note");
    if (!badge) return;
    badge.textContent = hasNote ? "✎" : "";
    badge.title = hasNote ? "есть заметка" : "";
    if (hasNote) {
      badge.setAttribute("aria-label", "есть заметка");
    } else {
      badge.removeAttribute("aria-label");
    }
  }

  private updateNotesCount(): void {
    const count = this.options.getNoteCount();
    this.elements.notesCount.textContent = formatNotesCount(count);
    this.elements.notesCount.title = "Заметки хранятся в этом браузере и не входят в модель";
  }

  private renderInspector(): void {
    this.elements.inspector.replaceChildren();
    this.noteEditor = undefined;
    this.noteMeta = undefined;
    this.noteMetaId = null;
    const item = this.graph?.element(this.selectedId);
    if (!item || !this.graph) {
      this.elements.inspectorSubtitle.textContent = "ничего не выбрано";
      this.elements.clearSelection.hidden = true;
      this.elements.twinIndicator.hidden = true;
      this.elements.inspector.append(
        element(
          "p",
          "empty-state",
          "Выбери элемент в сцене или в списке. Точные данные — здесь, а не в NPC.",
        ),
      );
      return;
    }

    this.elements.inspectorSubtitle.textContent = `${item.world} · ${item.kind}`;
    this.elements.clearSelection.hidden = false;
    this.updateTwinIndicator(item);

    const title = element("div", "inspector-title");
    title.append(element("h3", "", item.name));
    const badge = element("span", "kind-badge", item.kind);
    badge.dataset.world = item.world;
    title.append(badge);
    this.elements.inspector.append(title);
    this.elements.inspector.append(element("p", "element-id", item.id));

    if (item.description) {
      this.elements.inspector.append(element("p", "description", item.description));
    }

    if (item.tags?.length) {
      const tags = element("div", "tag-row");
      for (const tag of item.tags) tags.append(element("span", "tag", tag));
      this.elements.inspector.append(tags);
    }

    this.appendNoteSection(item);

    const twin = this.graph.twin(item.id);
    if (twin) {
      const card = element("div", "twin-card");
      card.dataset.world = twin.element.world;
      const text = element("p");
      text.append("Двойник по связи ");
      text.append(element("strong", "", twin.link.kind));
      text.append(": ");
      text.append(element("strong", "", `${twin.element.world} · ${twin.element.name}`));
      card.append(text);
      const button = element("button", "text-button", "Перейти к двойнику");
      button.type = "button";
      button.addEventListener("click", () => this.options.onTwin(twin.element.id));
      card.append(button);
      this.elements.inspector.append(card);
    }

    if (item.members?.length) {
      const section = element("section", "section");
      section.append(element("h4", "", `Члены · ${item.members.length}`));
      const list = element("ul", "member-list");
      for (const member of item.members) {
        const row = element("li", "member");
        const head = element("div", "member-head");
        head.append(element("span", "member-name", member.name));
        head.append(element("span", "member-meta", member.kind));
        row.append(head);
        const detail = describeMember(member);
        if (detail) row.append(element("div", "member-detail", detail));
        list.append(row);
      }
      section.append(list);
      this.elements.inspector.append(section);
    }

    if (item.invariants?.length) {
      const section = element("section", "section");
      section.append(element("h4", "", "Инварианты"));
      const list = element("ul", "invariant-list");
      for (const invariant of item.invariants) list.append(element("li", "", invariant));
      section.append(list);
      this.elements.inspector.append(section);
    }

    if (item.provenance) {
      const section = element("section", "section");
      section.append(element("h4", "", "Провенанс"));
      const source = this.graph.name(item.provenance.materializedFrom);
      section.append(
        element(
          "div",
          "provenance",
          `materializedFrom: ${item.provenance.materializedFrom} (${source})\n` +
            "Производное поле: источник истины — связь materializes.",
        ),
      );
      this.elements.inspector.append(section);
    }

    const relations = this.graph.relationsFor(item.id);
    if (relations.length) {
      const section = element("section", "section");
      section.append(element("h4", "", `Связи · ${relations.length}`));
      const list = element("ul", "relation-list");
      for (const relation of relations) list.append(this.relationRow(relation));
      section.append(list);
      this.elements.inspector.append(section);
    }

    const links = this.graph.linksFor(item.id);
    if (links.length) {
      const section = element("section", "section");
      section.append(element("h4", "", `Межмировые ссылки · ${links.length}`));
      const list = element("ul", "relation-list");
      for (const link of links) list.append(this.linkRow(link));
      section.append(list);
      this.elements.inspector.append(section);
    }
  }

  private appendNoteSection(item: Element): void {
    const section = element("section", "section note-section");
    section.append(element("h4", "", "Заметка"));

    const editor = element("textarea", "note-editor");
    editor.rows = 4;
    editor.placeholder = "Что проверить, с чем сверить, что непонятно…";
    editor.value = this.options.getNote(item.id);
    editor.setAttribute("aria-label", `Заметка к элементу ${item.name}`);
    editor.addEventListener("input", () => {
      const persisted = this.options.onNoteChange(item.id, editor.value);
      const hasNote = Boolean(editor.value.trim());
      this.syncNoteMark(item.id, hasNote);
      this.updateNoteMeta(item.id, persisted);
    });
    section.append(editor);

    const meta = element("p", "note-meta");
    section.append(meta);

    this.noteEditor = editor;
    this.noteMeta = meta;
    this.noteMetaId = item.id;
    this.updateNoteMeta(item.id, true);
    this.elements.inspector.append(section);
  }

  private syncNoteMark(id: string, hasNote: boolean): void {
    for (const row of this.elements.elementList.querySelectorAll<HTMLElement>(".element-row")) {
      if (row.dataset.id !== id) continue;
      this.applyNoteMark(row, hasNote);
      break;
    }
    this.updateNotesCount();
  }

  private updateNoteMeta(id: string, persisted: boolean): void {
    if (!this.noteMeta || this.noteMetaId !== id) return;
    if (!persisted) {
      this.noteMeta.dataset.state = "error";
      this.noteMeta.textContent = `Не удалось сохранить: браузер блокирует localStorage.`;
      return;
    }
    const hasNote = Boolean(this.options.getNote(id));
    this.noteMeta.dataset.state = hasNote ? "saved" : "empty";
    this.noteMeta.textContent = hasNote
      ? "Сохранено локально · не входит в model.json."
      : "Хранится только в этом браузере, не входит в модель.";
  }

  private relationRow(relation: Relation): HTMLElement {
    const row = element("li", "relation");
    row.dataset.kind = relation.kind;
    row.append(
      element(
        "div",
        "relation-main",
        `${relation.kind}: ${this.graph?.name(relation.from)} → ${this.graph?.name(relation.to)}`,
      ),
    );
    const meta: string[] = [];
    if (relation.label) meta.push(relation.label);
    if (relation.fromMultiplicity || relation.toMultiplicity) {
      meta.push(`${relation.fromMultiplicity ?? "1"} → ${relation.toMultiplicity ?? "1"}`);
    }
    if (meta.length) row.append(element("div", "relation-meta", meta.join(" · ")));
    return row;
  }

  private linkRow(link: Link): HTMLElement {
    const row = element("li", "relation");
    row.dataset.kind = link.kind;
    row.append(
      element(
        "div",
        "relation-main",
        `${link.kind}: ${this.graph?.name(link.from)} → ${this.graph?.name(link.to)}`,
      ),
    );
    row.append(element("div", "relation-meta", "источник истины для двойника"));
    return row;
  }

  private updateTwinIndicator(item: Element): void {
    const twin = this.graph?.twin(item.id);
    if (twin) {
      this.elements.twinIndicator.hidden = false;
      this.elements.twinIndicator.textContent =
        `${item.world}: ${item.name} → ${twin.element.world}: ${twin.element.name}`;
      return;
    }
    if (item.kind === "abstractClass") {
      this.elements.twinIndicator.hidden = false;
      this.elements.twinIndicator.textContent = `${item.name}: нет материального воплощения`;
      return;
    }
    this.elements.twinIndicator.hidden = true;
    this.elements.twinIndicator.textContent = "";
  }
}
