import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import { buildIndex, validateLayout, validateModel } from "./validate";
import type { CompiledSchemas, DraftSchemas, UmlgLayout, UmlgModel, WorldId } from "./types";

export type { CompiledSchemas } from "./types";

export type ParsedDraft =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

export interface DraftReport {
  errors: string[];
  warnings: string[];
  model?: UmlgModel;
  layout?: UmlgLayout;
}

export function parseDraft(text: string, label: string): ParsedDraft {
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `${label}: Некорректный JSON: ${detail}` };
  }
}

export function compileSchemas(schemas: DraftSchemas): CompiledSchemas {
  // A fresh instance per call: compiling both $id-tagged schemas twice on one
  // Ajv instance would raise a duplicate-schema error.
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  return {
    model: ajv.compile(schemas.model),
    layout: ajv.compile(schemas.layout),
  };
}

export function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((error) => {
    const path = error.instancePath || "/";
    return `${path} ${error.message ?? "invalid"}`;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The single validation pipeline used both for the initial load and for editor
 * drafts: AJV draft 2020-12 first, then the same semantic checks as the loader.
 */
export function validateDraftValues(
  modelRaw: unknown,
  layoutRaw: unknown,
  schemas: CompiledSchemas,
): DraftReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(modelRaw) || !isRecord(layoutRaw)) {
    return {
      errors: ["model.json и layout.json должны быть JSON-объектами"],
      warnings,
    };
  }

  if (!schemas.model(modelRaw)) {
    errors.push(...formatAjvErrors(schemas.model.errors).map((message) => `schema: ${message}`));
  }
  if (!schemas.layout(layoutRaw)) {
    errors.push(...formatAjvErrors(schemas.layout.errors).map((message) => `schema: ${message}`));
  }

  const model = modelRaw as unknown as UmlgModel;
  const layout = layoutRaw as unknown as UmlgLayout;
  try {
    for (const issue of [
      ...validateModel(model),
      ...validateLayout(model, layout, buildIndex(model)),
    ]) {
      if (issue.level === "error") errors.push(issue.message);
      else warnings.push(issue.message);
    }
  } catch (error) {
    errors.push(`semantic: ${error instanceof Error ? error.message : String(error)}`);
  }

  return { errors, warnings, model, layout };
}

/** Parses both text areas and reports JSON syntax errors before any other check. */
export function validateDraftTexts(
  modelText: string,
  layoutText: string,
  schemas: CompiledSchemas,
): DraftReport {
  const parsedModel = parseDraft(modelText, "model.json");
  const parsedLayout = parseDraft(layoutText, "layout.json");
  if (!parsedModel.ok || !parsedLayout.ok) {
    return {
      errors: [
        ...(parsedModel.ok ? [] : [parsedModel.error]),
        ...(parsedLayout.ok ? [] : [parsedLayout.error]),
      ],
      warnings: [],
    };
  }
  return validateDraftValues(parsedModel.value, parsedLayout.value, schemas);
}

/** "Применить" is enabled only for a draft with zero errors and both documents. */
export function canApplyDraft(report: DraftReport): boolean {
  return report.errors.length === 0 && Boolean(report.model && report.layout);
}

/** Apply keeps the current world when the new model still declares it. */
export function applyWorld(currentWorld: WorldId, model: UmlgModel): WorldId {
  const worlds = model.worlds;
  if (Array.isArray(worlds) && worlds.some((world) => world.id === currentWorld)) {
    return currentWorld;
  }
  return "M";
}

export function draftFilename(modelId: string, kind: "model" | "layout"): string {
  const slug = modelId.replace(/[^a-zA-Z0-9._-]+/g, "-") || "model";
  return `${slug}-${kind}.json`;
}
