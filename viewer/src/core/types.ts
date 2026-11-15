export type WorldId = "M" | "R";

export type ElementKind =
  | "class"
  | "abstractClass"
  | "interface"
  | "component"
  | "concept"
  | "object"
  | "resource"
  | "process"
  | "stage"
  | "command"
  | "actor";

export type MentalRelationKind =
  | "association"
  | "inheritance"
  | "realization"
  | "composition"
  | "aggregation"
  | "dependency";

export type RealRelationKind = "flow" | "call" | "signal" | "binding";

export type RelationKind = MentalRelationKind | RealRelationKind;

export type LinkKind =
  | "materializes"
  | "implements"
  | "deploys"
  | "observes"
  | "drift";

export interface Member {
  id: string;
  kind: "attribute" | "method" | "property" | "event" | "constructor" | "constant";
  name: string;
  visibility?: "public" | "protected" | "private" | "package";
  type?: string;
  signature?: string;
  returns?: string;
  params?: Array<{ name: string; type: string; optional?: boolean; default?: string }>;
  isAbstract?: boolean;
  isStatic?: boolean;
  isReadonly?: boolean;
  description?: string;
}

export interface Provenance {
  materializedFrom: string;
  at?: string;
  source?: string;
}

export interface Element {
  id: string;
  world: WorldId;
  kind: ElementKind;
  name: string;
  description?: string;
  tags?: string[];
  members?: Member[];
  invariants?: string[];
  state?: string;
  provenance?: Provenance;
}

export interface Relation {
  id: string;
  world: WorldId;
  kind: RelationKind;
  from: string;
  to: string;
  label?: string;
  fromMultiplicity?: string;
  toMultiplicity?: string;
  description?: string;
}

export interface Link {
  id: string;
  kind: LinkKind;
  from: string;
  to: string;
  label?: string;
  description?: string;
}

export interface UmlgWorld {
  id: WorldId;
  name: string;
  kind: "mental" | "real" | "symbolic" | "physical";
  description?: string;
}

export interface UmlgModel {
  umlgVersion: string;
  id: string;
  name: string;
  description?: string;
  viewpoints?: string[];
  worlds: UmlgWorld[];
  elements: Element[];
  relations?: Relation[];
  links?: Link[];
}

export type Vec3 = [number, number, number];

export interface LayoutNode {
  ref: string;
  position: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  collapsed?: boolean;
  pinned?: boolean;
  label?: string;
}

export interface WorldLayout {
  ambient?: "mental" | "real" | "symbolic" | "physical";
  nodes: LayoutNode[];
}

export interface CameraLayout {
  position: Vec3;
  target: Vec3;
  up?: Vec3;
  fov?: number;
  orthographic?: boolean;
}

export interface UmlgLayout {
  layoutVersion: string;
  modelId: string;
  worlds: Partial<Record<WorldId, WorldLayout>>;
  camera?: Partial<Record<WorldId, CameraLayout>>;
  notes?: string;
}

export interface LoadedModel {
  model: UmlgModel;
  layout: UmlgLayout;
  modelUrl: string;
  layoutUrl: string;
}
