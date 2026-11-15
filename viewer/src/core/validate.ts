import type {
  Element,
  ElementKind,
  Link,
  Relation,
  RelationKind,
  UmlgLayout,
  UmlgModel,
  WorldId,
} from "./types";

export type IssueLevel = "error" | "warning";

export interface Issue {
  level: IssueLevel;
  message: string;
}

const MENTAL_KINDS = new Set<ElementKind>([
  "class",
  "abstractClass",
  "interface",
  "component",
  "concept",
]);
const REAL_KINDS = new Set<ElementKind>([
  "object",
  "resource",
  "process",
  "stage",
  "command",
  "actor",
]);
const MATERIALIZABLE_KINDS = new Set<ElementKind>([
  "object",
  "resource",
  "process",
  "stage",
  "command",
]);
const INVARIANT_KINDS = new Set<ElementKind>([
  "class",
  "abstractClass",
  "concept",
]);
const MENTAL_RELATIONS = new Set<RelationKind>([
  "association",
  "inheritance",
  "realization",
  "composition",
  "aggregation",
  "dependency",
]);
const REAL_RELATIONS = new Set<RelationKind>(["flow", "call", "signal", "binding"]);
const LINK_KINDS = new Set(["materializes", "implements", "deploys", "observes", "drift"]);
const VIEWPOINTS = new Set([
  "structure",
  "resources",
  "pipeline",
  "state",
  "sequence",
  "runtime",
  "learning",
  "deployment",
]);

interface NodeRef {
  id: string;
  world?: WorldId;
  kind?: string;
}

export function validateModel(model: UmlgModel): Issue[] {
  const issues: Issue[] = [];
  const byId = new Map<string, NodeRef>();
  const seenIds = new Map<string, string>();
  const elements = model.elements ?? [];
  const relations = model.relations ?? [];
  const links = model.links ?? [];

  const error = (message: string) => issues.push({ level: "error", message });
  const warning = (message: string) => issues.push({ level: "warning", message });

  const register = (id: string | undefined, label: string): boolean => {
    if (!id) {
      error(`${label} without id`);
      return false;
    }
    const existing = seenIds.get(id);
    if (existing) {
      error(`duplicate id: ${id} (${label} collides with ${existing})`);
      return false;
    }
    seenIds.set(id, label);
    return true;
  };

  for (const element of elements) {
    if (register(element.id, "element")) {
      byId.set(element.id, element);
    }
    for (const member of element.members ?? []) {
      register(member.id, `member of ${element.id}`);
    }
  }
  for (const relation of relations) {
    if (register(relation.id, "relation")) {
      byId.set(relation.id, relation);
    }
  }
  for (const link of links) {
    if (register(link.id, "link")) {
      byId.set(link.id, link);
    }
  }

  if (model.viewpoints !== undefined) {
    if (!Array.isArray(model.viewpoints) || model.viewpoints.length === 0) {
      error("viewpoints must be a non-empty array");
    } else {
      const seen = new Set<string>();
      for (const viewpoint of model.viewpoints) {
        if (!VIEWPOINTS.has(viewpoint)) {
          error(`unknown viewpoint: ${viewpoint}`);
        }
        if (seen.has(viewpoint)) {
          error(`duplicate viewpoint: ${viewpoint}`);
        }
        seen.add(viewpoint);
      }
    }
  }

  for (const element of elements) {
    const id = element.id || "<unknown>";
    if (element.world === "M" && !MENTAL_KINDS.has(element.kind)) {
      error(`${id}: kind '${element.kind}' is not allowed in M-world`);
    }
    if (element.world === "R" && !REAL_KINDS.has(element.kind)) {
      error(`${id}: kind '${element.kind}' is not allowed in R-world`);
    }
    if (element.world !== "R" && element.provenance !== undefined) {
      error(`${id}: provenance is only allowed on R entities`);
    }
    if (element.kind === "actor" && element.provenance !== undefined) {
      error(`${id}: actor is a context and cannot have provenance`);
    }

    if (element.invariants !== undefined) {
      if (!INVARIANT_KINDS.has(element.kind)) {
        error(`${id}: invariants are only allowed on class, abstractClass or concept`);
      }
      if (!Array.isArray(element.invariants) || element.invariants.length === 0) {
        error(`${id}: invariants must be a non-empty array`);
      } else {
        const seen = new Set<string>();
        for (const invariant of element.invariants) {
          if (typeof invariant !== "string" || !invariant.trim()) {
            error(`${id}: invariant must be a non-empty string`);
            continue;
          }
          if (seen.has(invariant)) {
            error(`${id}: duplicate invariant: ${invariant}`);
          }
          seen.add(invariant);
        }
      }
    }
  }

  for (const relation of relations) {
    const id = relation.id || "<unknown>";
    const source = byId.get(relation.from);
    const target = byId.get(relation.to);

    if (!source) error(`${id}: unknown 'from' -> ${relation.from}`);
    if (!target) error(`${id}: unknown 'to' -> ${relation.to}`);
    if (source && source.world !== relation.world) {
      error(`${id}: 'from' belongs to another world`);
    }
    if (target && target.world !== relation.world) {
      error(`${id}: 'to' belongs to another world`);
    }
    if (relation.world === "M" && !MENTAL_RELATIONS.has(relation.kind)) {
      error(`${id}: relation kind '${relation.kind}' is not allowed in M-world`);
    }
    if (relation.world === "R" && !REAL_RELATIONS.has(relation.kind)) {
      error(`${id}: relation kind '${relation.kind}' is not allowed in R-world`);
    }
  }

  const materializations = new Map<string, string[]>();
  const driftTargets = new Set<string>();

  for (const link of links) {
    const id = link.id || "<unknown>";
    const source = byId.get(link.from);
    const target = byId.get(link.to);

    if (!LINK_KINDS.has(link.kind)) {
      error(`${id}: unknown link kind '${link.kind}'`);
      continue;
    }
    if (!source) {
      error(`${id}: unknown 'from' -> ${link.from}`);
      continue;
    }
    if (!target) {
      error(`${id}: unknown 'to' -> ${link.to}`);
      continue;
    }

    if (link.kind === "materializes") {
      if (source.world !== "M" || target.world !== "R") {
        error(`${id}: materializes must go M -> R`);
      }
      if (source.kind !== "class") {
        error(`${id}: materializes source must be a concrete class, got '${source.kind}'`);
      }
      if (!target.kind || !MATERIALIZABLE_KINDS.has(target.kind as ElementKind)) {
        error(`${id}: materializes target must be a materializable R entity, got '${target.kind}'`);
      }
      const sources = materializations.get(link.to) ?? [];
      sources.push(link.from);
      materializations.set(link.to, sources);
    } else if (link.kind === "implements") {
      if (source.world !== "M" || target.world !== "M") {
        error(`${id}: implements must stay inside M-world`);
      }
      if (source.kind !== "class") {
        error(`${id}: implements source must be a class, got '${source.kind}'`);
      }
      if (target.kind !== "interface") {
        error(`${id}: implements target must be an interface, got '${target.kind}'`);
      }
    } else if (link.kind === "deploys") {
      if (source.world !== "M" || target.world !== "R") {
        error(`${id}: deploys must go M -> R`);
      }
      if (source.kind !== "component") {
        error(`${id}: deploys source must be a component, got '${source.kind}'`);
      }
      if (target.kind !== "process") {
        error(`${id}: deploys target must be a process, got '${target.kind}'`);
      }
    } else if (link.kind === "observes") {
      if (source.world !== "R" || target.world !== "M") {
        error(`${id}: observes must go R -> M`);
      }
    } else if (link.kind === "drift") {
      if (source.world !== "M" || target.world !== "R") {
        error(`${id}: drift must go M -> R`);
      }
      driftTargets.add(link.to);
    }
  }

  for (const element of elements) {
    if (element.world !== "R" || !MATERIALIZABLE_KINDS.has(element.kind)) {
      continue;
    }
    const sources = materializations.get(element.id) ?? [];
    if (sources.length === 0) {
      if (driftTargets.has(element.id)) {
        warning(`${element.id}: no materializes link (covered by drift)`);
      } else {
        error(`${element.id}: materializable R entity has no 'materializes' link`);
      }
      if (element.provenance) {
        error(`${element.id}: provenance requires a 'materializes' link`);
      }
      continue;
    }
    if (sources.length > 1) {
      error(`${element.id}: multiple materializing classes: ${sources.join(", ")}`);
      continue;
    }
    if (element.provenance && element.provenance.materializedFrom !== sources[0]) {
      error(
        `${element.id}: provenance.materializedFrom '${element.provenance.materializedFrom}' ` +
          `does not match materializes source '${sources[0]}'`,
      );
    }
  }

  return issues;
}

export function validateLayout(
  model: UmlgModel,
  layout: UmlgLayout,
  byId: Map<string, Element | Relation | Link>,
): Issue[] {
  const issues: Issue[] = [];
  const error = (message: string) => issues.push({ level: "error", message });

  if (layout.modelId !== model.id) {
    error(`layout.modelId '${layout.modelId}' does not match model.id '${model.id}'`);
  }

  for (const [world, worldLayout] of Object.entries(layout.worlds ?? {})) {
    for (const node of worldLayout?.nodes ?? []) {
      const element = byId.get(node.ref);
      if (!element) {
        error(`layout ${world}: unknown ref '${node.ref}'`);
        continue;
      }
      const elementWorld = "world" in element ? element.world : undefined;
      if (elementWorld !== world) {
        error(`layout ${world}: node '${node.ref}' belongs to world '${elementWorld}'`);
      }
    }
  }

  return issues;
}

export function buildIndex(model: UmlgModel): Map<string, Element | Relation | Link> {
  const map = new Map<string, Element | Relation | Link>();
  for (const element of model.elements ?? []) map.set(element.id, element);
  for (const relation of model.relations ?? []) map.set(relation.id, relation);
  for (const link of model.links ?? []) map.set(link.id, link);
  return map;
}
