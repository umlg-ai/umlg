import type { Element, ElementKind, Link, Relation, UmlgModel, WorldId } from "./types";

export interface Twin {
  element: Element;
  link: Link;
}

export class ModelGraph {
  readonly model: UmlgModel;
  readonly elements: Map<string, Element>;
  readonly relations: Relation[];
  readonly links: Link[];

  constructor(model: UmlgModel) {
    this.model = model;
    this.elements = new Map((model.elements ?? []).map((element) => [element.id, element]));
    this.relations = model.relations ?? [];
    this.links = model.links ?? [];
  }

  element(id: string | null | undefined): Element | undefined {
    return id ? this.elements.get(id) : undefined;
  }

  name(id: string): string {
    return this.elements.get(id)?.name ?? id;
  }

  worldName(world: WorldId): string {
    return this.model.worlds.find((entry) => entry.id === world)?.name ?? world;
  }

  relationsFor(id: string): Relation[] {
    return this.relations.filter((relation) => relation.from === id || relation.to === id);
  }

  linksFor(id: string): Link[] {
    return this.links.filter((link) => link.from === id || link.to === id);
  }

  twin(id: string): Twin | undefined {
    const priority = ["materializes", "implements", "deploys"];
    for (const kind of priority) {
      for (const link of this.links) {
        if (link.kind !== kind) continue;
        if (link.from === id) {
          const element = this.elements.get(link.to);
          if (element) return { element, link };
        }
        if (link.to === id) {
          const element = this.elements.get(link.from);
          if (element) return { element, link };
        }
      }
    }
    return undefined;
  }

  twinWorld(id: string): WorldId | undefined {
    return this.twin(id)?.element.world;
  }

  /** Kinds of the R entities created directly by an M element. */
  materializedKinds(id: string): ElementKind[] {
    return this.links
      .filter((link) => link.kind === "materializes" && link.from === id)
      .map((link) => this.elements.get(link.to)?.kind)
      .filter((kind): kind is ElementKind => kind !== undefined);
  }

  /**
   * Forms previewed inside an M class or component. A class previews the
   * silhouettes of its materialized twins; a component previews deployed
   * processes or the twins of its composed parts. Presentation code only
   * consumes this list, so layout cannot change what the blueprint promises.
   */
  previewKinds(id: string): ElementKind[] {
    const element = this.element(id);
    if (!element || element.world !== "M") return [];
    if (element.kind !== "class" && element.kind !== "component") return [];

    const materialized = this.materializedKinds(id);
    if (materialized.length > 0) return materialized;
    if (element.kind !== "component") return [];

    const deployed = this.links
      .filter((link) => link.kind === "deploys" && link.from === id)
      .map((link) => this.elements.get(link.to)?.kind)
      .filter((kind): kind is ElementKind => kind !== undefined);
    if (deployed.length > 0) return deployed;

    const parts = this.relations
      .filter(
        (relation) =>
          relation.world === "M" &&
          relation.from === id &&
          (relation.kind === "composition" || relation.kind === "aggregation"),
      )
      .map((relation) => relation.to);

    return this.links
      .filter((link) => link.kind === "materializes" && parts.includes(link.from))
      .map((link) => this.elements.get(link.to)?.kind)
      .filter((kind): kind is ElementKind => kind !== undefined);
  }
}
