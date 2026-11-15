import type { Element, Link, Relation, UmlgModel, WorldId } from "./types";

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
}
