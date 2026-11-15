import { ModelGraph } from "../core/model";
import type { Element, Link, Member, Relation, WorldId } from "../core/types";
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
    density: document.querySelector<HTMLInputElement>("#density")!,
    reducedMotion: document.querySelector<HTMLInputElement>("#reduced-motion")!,
    resetCamera: document.querySelector<HTMLButtonElement>("#reset-camera")!,
    toast: document.querySelector<HTMLElement>("#toast")!,
    loading: document.querySelector<HTMLElement>("#loading")!,
    loadingText: document.querySelector<HTMLElement>("#loading-text")!,
    errorScreen: document.querySelector<HTMLElement>("#error-screen")!,
    errorText: document.querySelector<HTMLElement>("#error-text")!,
    phaseVeil: document.querySelector<HTMLElement>("#phase-veil")!,
    phaseVeilLabel: document.querySelector<HTMLElement>("#phase-veil-label")!,
  };

  private graph?: ModelGraph;
  private world: WorldId = "M";
  private selectedId: string | null = null;
  private toastTimer = 0;

  constructor(options: ViewerUIOptions) {
    this.options = options;
    this.bind();
  }

  setModel(graph: ModelGraph, world: WorldId): void {
    this.graph = graph;
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

    this.elements.density.addEventListener("input", () => {
      this.options.onDensityChange(Number(this.elements.density.value));
    });
    this.elements.reducedMotion.addEventListener("change", () => {
      this.options.onReducedMotion(this.elements.reducedMotion.checked);
    });
    this.elements.resetCamera.addEventListener("click", () => this.options.onResetCamera());
    this.elements.clearSelection.addEventListener("click", () => this.options.onClearSelection());
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
      row.append(
        element("span", "row-world", item.world),
        element("span", "row-name", item.name),
        element("span", "row-kind", item.kind),
      );
      row.addEventListener("click", () => this.options.onSelect(item.id));
      this.elements.elementList.append(row);
    }
  }

  private renderInspector(): void {
    this.elements.inspector.replaceChildren();
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
