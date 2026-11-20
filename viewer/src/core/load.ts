import type { AnySchema } from "ajv";
import type { LoadedModel } from "./types";
import { compileSchemas, validateDraftValues } from "./draft";

export class ModelLoadError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[] = []) {
    super(message);
    this.name = "ModelLoadError";
    this.issues = issues;
  }
}

function layoutUrlFor(modelUrl: string): string {
  if (modelUrl.endsWith("/model.json")) {
    return `${modelUrl.slice(0, -"model.json".length)}layout.json`;
  }
  return modelUrl.replace(/model\.json/, "layout.json");
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new ModelLoadError(`Не удалось загрузить ${url}: HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) {
    throw new ModelLoadError(
      `По адресу ${url} лежит не JSON (HTTP ${response.status}, ${contentType || "без content-type"})`,
    );
  }
  try {
    return (await response.json()) as unknown;
  } catch {
    throw new ModelLoadError(`Некорректный JSON: ${url}`);
  }
}

export async function loadModelFromUrl(): Promise<LoadedModel> {
  const base = import.meta.env.BASE_URL;
  const params = new URLSearchParams(window.location.search);
  const modelUrl = params.get("model") ?? `${base}examples/hello-triangle/model.json`;
  const layoutUrl = params.get("layout") ?? layoutUrlFor(modelUrl);

  const [modelRaw, layoutRaw, modelSchema, layoutSchema] = await Promise.all([
    fetchJson(modelUrl),
    fetchJson(layoutUrl),
    fetchJson(`${base}schema/umlg.schema.json`),
    fetchJson(`${base}schema/layout.schema.json`),
  ]);

  const schemas = compileSchemas({
    model: modelSchema as AnySchema,
    layout: layoutSchema as AnySchema,
  });
  const report = validateDraftValues(modelRaw, layoutRaw, schemas);

  for (const warning of report.warnings) {
    console.warn(`[UMLG] ${warning}`);
  }
  if (report.errors.length > 0) {
    throw new ModelLoadError(`Модель не прошла валидацию (${report.errors.length})`, report.errors);
  }

  return {
    model: report.model!,
    layout: report.layout!,
    modelUrl,
    layoutUrl,
    schemas,
  };
}
