import { describe, expect, it } from "vitest";
import { ModelGraph } from "./model";
import type { Element, ElementKind, UmlgModel, WorldId } from "./types";

function element(
  id: string,
  world: WorldId,
  kind: ElementKind,
  name = id,
): Element {
  return { id, world, kind, name };
}

function model(
  elements: Element[],
  links: NonNullable<UmlgModel["links"]> = [],
  relations: NonNullable<UmlgModel["relations"]> = [],
): UmlgModel {
  return {
    umlgVersion: "0.1",
    id: "test",
    name: "Test",
    worlds: [
      { id: "M", name: "M", kind: "mental" },
      { id: "R", name: "R", kind: "real" },
    ],
    elements,
    links,
    relations,
  };
}

describe("ModelGraph preview kinds", () => {
  it("previews the R forms a class materializes", () => {
    const graph = new ModelGraph(
      model(
        [element("m.app", "M", "class"), element("r.app", "R", "object")],
        [{ id: "l.app", kind: "materializes", from: "m.app", to: "r.app" }],
      ),
    );
    expect(graph.materializedKinds("m.app")).toEqual(["object"]);
    expect(graph.previewKinds("m.app")).toEqual(["object"]);
  });

  it("leaves a class without a twin empty", () => {
    const graph = new ModelGraph(model([element("m.orphan", "M", "class")]));
    expect(graph.previewKinds("m.orphan")).toEqual([]);
  });

  it("previews forms of composed parts inside a component", () => {
    const graph = new ModelGraph(
      model(
        [
          element("m.pipeline", "M", "component"),
          element("m.stage", "M", "class"),
          element("r.stage", "R", "stage"),
        ],
        [{ id: "l.stage", kind: "materializes", from: "m.stage", to: "r.stage" }],
        [
          {
            id: "rel.part",
            world: "M",
            kind: "composition",
            from: "m.pipeline",
            to: "m.stage",
          },
        ],
      ),
    );
    expect(graph.previewKinds("m.pipeline")).toEqual(["stage"]);
  });

  it("prefers deployed processes in a component", () => {
    const graph = new ModelGraph(
      model(
        [
          element("m.host", "M", "component"),
          element("r.process", "R", "process"),
        ],
        [{ id: "l.deploy", kind: "deploys", from: "m.host", to: "r.process" }],
      ),
    );
    expect(graph.previewKinds("m.host")).toEqual(["process"]);
  });

  it("does not preview anything in R or in non-container M kinds", () => {
    const graph = new ModelGraph(
      model([
        element("r.object", "R", "object"),
        element("m.ghost", "M", "abstractClass"),
        element("m.port", "M", "interface"),
      ]),
    );
    expect(graph.previewKinds("r.object")).toEqual([]);
    expect(graph.previewKinds("m.ghost")).toEqual([]);
    expect(graph.previewKinds("m.port")).toEqual([]);
  });
});
