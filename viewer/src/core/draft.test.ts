import { describe, expect, it } from "vitest";
import layoutSchema from "../../../schema/layout.schema.json";
import modelSchema from "../../../schema/umlg.schema.json";
import {
  applyWorld,
  canApplyDraft,
  compileSchemas,
  draftFilename,
  validateDraftTexts,
} from "./draft";
import type { DraftSchemas, UmlgLayout, UmlgModel } from "./types";

const schemas: DraftSchemas = {
  model: modelSchema,
  layout: layoutSchema,
};
const compiled = compileSchemas(schemas);

function validModel(): UmlgModel {
  return {
    umlgVersion: "0.1",
    id: "test",
    name: "Test",
    worlds: [
      { id: "M", name: "M", kind: "mental" },
      { id: "R", name: "R", kind: "real" },
    ],
    elements: [
      { id: "m.app", world: "M", kind: "class", name: "App" },
      {
        id: "r.app",
        world: "R",
        kind: "object",
        name: "App#1",
        provenance: { materializedFrom: "m.app" },
      },
    ],
    links: [{ id: "link.app", kind: "materializes", from: "m.app", to: "r.app" }],
  };
}

function validLayout(): UmlgLayout {
  return {
    layoutVersion: "0.1",
    modelId: "test",
    worlds: {
      M: { nodes: [{ ref: "m.app", position: [0, 0, 0] }] },
      R: { nodes: [{ ref: "r.app", position: [0, 0, 0] }] },
    },
  };
}

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

describe("validateDraftTexts", () => {
  it("accepts a valid draft", () => {
    const report = validateDraftTexts(pretty(validModel()), pretty(validLayout()), compiled);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.model?.id).toBe("test");
    expect(report.layout?.modelId).toBe("test");
  });

  it("reports malformed JSON before any semantic check", () => {
    const report = validateDraftTexts("{", pretty(validLayout()), compiled);
    expect(report.errors.some((message) => message.includes("Некорректный JSON"))).toBe(true);
    expect(report.errors.some((message) => message.includes("model.json"))).toBe(true);
    expect(report.model).toBeUndefined();
    expect(canApplyDraft(report)).toBe(false);

    const layoutReport = validateDraftTexts(pretty(validModel()), "{", compiled);
    expect(layoutReport.errors.some((message) => message.includes("Некорректный JSON"))).toBe(true);
    expect(layoutReport.errors.some((message) => message.includes("layout.json"))).toBe(true);

    const bothReport = validateDraftTexts("{", "{", compiled);
    expect(bothReport.errors).toHaveLength(2);
  });

  it("reports non-object JSON values", () => {
    const report = validateDraftTexts("123", pretty(validLayout()), compiled);
    expect(
      report.errors.some((message) =>
        message.includes("model.json и layout.json должны быть JSON-объектами"),
      ),
    ).toBe(true);
    expect(canApplyDraft(report)).toBe(false);
  });

  it("reports schema-invalid drafts", () => {
    const broken = { ...validModel(), unexpected: true };
    const report = validateDraftTexts(pretty(broken), pretty(validLayout()), compiled);
    expect(report.errors.some((message) => message.startsWith("schema:"))).toBe(true);
    expect(canApplyDraft(report)).toBe(false);
  });

  it("reports a materializable R entity without materializes", () => {
    const model = validModel();
    model.links = [];
    const report = validateDraftTexts(pretty(model), pretty(validLayout()), compiled);
    expect(report.errors.some((message) => message.includes("has no 'materializes'"))).toBe(true);
    expect(canApplyDraft(report)).toBe(false);
  });

  it("keeps warnings non-blocking", () => {
    const model = validModel();
    model.links = [
      { id: "link.drift", kind: "drift", from: "m.app", to: "r.app" },
    ];
    const r = model.elements.find((item) => item.id === "r.app")!;
    delete r.provenance;
    const report = validateDraftTexts(pretty(model), pretty(validLayout()), compiled);
    expect(report.errors).toEqual([]);
    expect(report.warnings.some((message) => message.includes("covered by drift"))).toBe(true);
    expect(canApplyDraft(report)).toBe(true);
  });

  it("reports an unknown layout ref", () => {
    const layout = validLayout();
    layout.worlds.R = { nodes: [{ ref: "r.ghost", position: [0, 0, 0] }] };
    const report = validateDraftTexts(pretty(validModel()), pretty(layout), compiled);
    expect(report.errors.some((message) => message.includes("unknown ref 'r.ghost'"))).toBe(true);
    expect(canApplyDraft(report)).toBe(false);
  });
});

describe("apply decision", () => {
  it("applies only reports without errors", () => {
    const valid = validateDraftTexts(pretty(validModel()), pretty(validLayout()), compiled);
    expect(canApplyDraft(valid)).toBe(true);

    const invalid = validateDraftTexts("[]", pretty(validLayout()), compiled);
    expect(canApplyDraft(invalid)).toBe(false);
  });

  it("keeps the current world only when the new model still has it", () => {
    expect(applyWorld("R", validModel())).toBe("R");
    const withoutR = validModel();
    withoutR.worlds = [{ id: "M", name: "M", kind: "mental" }];
    expect(applyWorld("R", withoutR)).toBe("M");
  });

  it("names downloads after the model id", () => {
    expect(draftFilename("hello-triangle", "model")).toBe("hello-triangle-model.json");
    expect(draftFilename("hello-triangle", "layout")).toBe("hello-triangle-layout.json");
  });
});
