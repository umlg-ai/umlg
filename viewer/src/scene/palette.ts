import type { ElementKind, RelationKind } from "../core/types";

export const KIND_LABELS: Record<ElementKind, string> = {
  class: "class",
  abstractClass: "abstract",
  interface: "interface",
  component: "component",
  concept: "concept",
  object: "object",
  resource: "resource",
  process: "process",
  stage: "stage",
  command: "command",
  actor: "actor",
};

export const WORLD_THEME = {
  M: {
    background: 0x050814,
    fog: 0x050814,
    grid: 0x1b2a48,
    gridAccent: 0x2f4c7a,
    light: 0x8cc8ff,
    warm: 0x5f7cff,
  },
  R: {
    background: 0x120c08,
    fog: 0x120c08,
    grid: 0x4a2d1a,
    gridAccent: 0x74452a,
    light: 0xffc18a,
    warm: 0xff7a3d,
  },
} as const;

export const ELEMENT_COLORS: Record<ElementKind, number> = {
  class: 0x74c7ff,
  abstractClass: 0xa99bff,
  interface: 0x63e6d5,
  component: 0x6ea8ff,
  concept: 0xc7a6ff,
  object: 0xffb168,
  resource: 0xff8f55,
  process: 0xffd166,
  stage: 0xffd166,
  command: 0xffe0a3,
  actor: 0xff6b9a,
};

export const RELATION_COLORS: Record<RelationKind, number> = {
  inheritance: 0x8fb8ff,
  realization: 0x8fb8ff,
  composition: 0x9f7bff,
  aggregation: 0xb49cff,
  association: 0x6f83a8,
  dependency: 0x8796b5,
  flow: 0xff9f5a,
  call: 0xffd166,
  signal: 0xff7eb6,
  binding: 0x7ee2a8,
};

export function kindLabel(kind: ElementKind): string {
  return KIND_LABELS[kind] ?? kind;
}

export function hex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}
