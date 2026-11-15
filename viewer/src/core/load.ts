import Ajv2020, { type ErrorObject } from "ajv/dist/2020";
import type { AnySchema } from "ajv";
import type { LoadedModel, UmlgLayout, UmlgModel } from "./types";
import { buildIndex, validateLayout, validateModel, type Issue } from "./validate";

const ajv = new Ajv2020({ allErrors: true, strict: false });

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

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map((error) => {
    const path = error.instancePath || "/";
    return `${path} ${error.message ?? "invalid"}`;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

  if (!isRecord(modelRaw) || !isRecord(layoutRaw)) {
    throw new ModelLoadError("model.json и layout.json должны быть JSON-объектами");
  }

  const schemaIssues: string[] = [];
  const validateModelSchema = ajv.compile(modelSchema as AnySchema);
  const validateLayoutSchema = ajv.compile(layoutSchema as AnySchema);

  if (!validateModelSchema(modelRaw)) {
    schemaIssues.push(...formatAjvErrors(validateModelSchema.errors));
  }
  if (!validateLayoutSchema(layoutRaw)) {
    schemaIssues.push(...formatAjvErrors(validateLayoutSchema.errors));
  }

  const model = modelRaw as unknown as UmlgModel;
  const layout = layoutRaw as unknown as UmlgLayout;
  const semanticIssues: Issue[] = [...validateModel(model)];
  semanticIssues.push(...validateLayout(model, layout, buildIndex(model)));

  const errors = [
    ...schemaIssues.map((message) => `schema: ${message}`),
    ...semanticIssues
      .filter((issue) => issue.level === "error")
      .map((issue) => issue.message),
  ];
  const warnings = semanticIssues
    .filter((issue) => issue.level === "warning")
    .map((issue) => issue.message);

  for (const warning of warnings) {
    console.warn(`[UMLG] ${warning}`);
  }

  if (errors.length > 0) {
    throw new ModelLoadError(`Модель не прошла валидацию (${errors.length})`, errors);
  }

  return { model, layout, modelUrl, layoutUrl };
}
