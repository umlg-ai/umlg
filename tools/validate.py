#!/usr/bin/env python3
"""UMLG v0.1 semantic validator.

Usage:
    python3 tools/validate.py examples/hello-triangle/model.json \
                                examples/hello-triangle/layout.json

Checks cross-references and the core world invariants. JSON Schema validation
is done separately (ajv in CI); this script focuses on semantics that JSON
Schema cannot express.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

MENTAL_KINDS = {"class", "abstractClass", "interface", "component", "concept"}
REAL_KINDS = {"object", "resource", "process", "stage", "command", "actor"}
MATERIALIZABLE_KINDS = {"object", "resource", "process", "stage", "command"}
INVARIANT_KINDS = {"class", "abstractClass", "concept"}
VIEWPOINTS = {
    "structure",
    "resources",
    "pipeline",
    "state",
    "sequence",
    "runtime",
    "learning",
    "deployment",
}
MENTAL_RELATIONS = {
    "association",
    "inheritance",
    "realization",
    "composition",
    "aggregation",
    "dependency",
}
REAL_RELATIONS = {"flow", "call", "signal", "binding"}
LINK_KINDS = {"materializes", "implements", "deploys", "observes", "drift"}


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def error(self, message: str) -> None:
        self.errors.append(message)

    def warn(self, message: str) -> None:
        self.warnings.append(message)

    def ok(self) -> bool:
        return not self.errors


def load(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def validate_model(model: dict, report: Report) -> dict[str, dict]:
    elements = model.get("elements", [])
    relations = model.get("relations", [])
    links = model.get("links", [])

    by_id: dict[str, dict] = {}
    seen_ids: dict[str, str] = {}

    def register(item: dict, label: str) -> bool:
        item_id = item.get("id")
        if not item_id:
            report.error(f"{label} without id")
            return False
        if item_id in seen_ids:
            report.error(
                f"duplicate id: {item_id} "
                f"({label} collides with {seen_ids[item_id]})"
            )
            return False
        seen_ids[item_id] = label
        return True

    for element in elements:
        if register(element, "element"):
            by_id[element["id"]] = element
        for member in element.get("members", []):
            register(member, f"member of {element.get('id', '<unknown>')}")

    for relation in relations:
        if register(relation, "relation"):
            by_id[relation["id"]] = relation

    for link in links:
        if register(link, "link"):
            by_id[link["id"]] = link

    # Worlds: v0.1 allows exactly M and R, each declared once.
    worlds = model.get("worlds")
    if worlds is not None:
        seen_worlds: set[str] = set()
        for world in worlds:
            world_id = world.get("id")
            if world_id in seen_worlds:
                report.error(f"duplicate world id: {world_id}")
            seen_worlds.add(world_id)
            kind = world.get("kind")
            if world_id == "M" and kind != "mental":
                report.error(f"world M must have kind 'mental', got '{kind}'")
            if world_id == "R" and kind != "real":
                report.error(f"world R must have kind 'real', got '{kind}'")
        for required in ("M", "R"):
            if required not in seen_worlds:
                report.error(f"missing required world: {required}")

    # Model-level optional fields.
    viewpoints = model.get("viewpoints")
    if viewpoints is not None:
        if not isinstance(viewpoints, list) or not viewpoints:
            report.error("viewpoints must be a non-empty array")
        else:
            seen_viewpoints: set[str] = set()
            for viewpoint in viewpoints:
                if viewpoint not in VIEWPOINTS:
                    report.error(f"unknown viewpoint: {viewpoint}")
                if viewpoint in seen_viewpoints:
                    report.error(f"duplicate viewpoint: {viewpoint}")
                seen_viewpoints.add(viewpoint)

    # World / kind consistency and element-level fields.
    for element in elements:
        element_id = element.get("id", "<unknown>")
        world = element.get("world")
        kind = element.get("kind")
        if world == "M" and kind not in MENTAL_KINDS:
            report.error(f"{element_id}: kind '{kind}' is not allowed in M-world")
        if world == "R" and kind not in REAL_KINDS:
            report.error(f"{element_id}: kind '{kind}' is not allowed in R-world")
        if world != "R" and element.get("provenance") is not None:
            report.error(f"{element_id}: provenance is only allowed on R entities")
        if kind == "actor" and element.get("provenance") is not None:
            report.error(f"{element_id}: actor is a context and cannot have provenance")

        invariants = element.get("invariants")
        if invariants is not None:
            if kind not in INVARIANT_KINDS:
                report.error(
                    f"{element_id}: invariants are only allowed on "
                    "class, abstractClass or concept"
                )
            if not isinstance(invariants, list) or not invariants:
                report.error(f"{element_id}: invariants must be a non-empty array")
            else:
                seen_invariants: set[str] = set()
                for invariant in invariants:
                    if not isinstance(invariant, str) or not invariant.strip():
                        report.error(f"{element_id}: invariant must be a non-empty string")
                        continue
                    if invariant in seen_invariants:
                        report.error(f"{element_id}: duplicate invariant: {invariant}")
                    seen_invariants.add(invariant)

    # Relation integrity.
    for relation in relations:
        relation_id = relation.get("id", "<unknown>")
        world = relation.get("world")
        kind = relation.get("kind")
        source = relation.get("from")
        target = relation.get("to")

        if source not in by_id:
            report.error(f"{relation_id}: unknown 'from' -> {source}")
        if target not in by_id:
            report.error(f"{relation_id}: unknown 'to' -> {target}")
        if source in by_id and by_id[source].get("world") != world:
            report.error(f"{relation_id}: 'from' belongs to another world")
        if target in by_id and by_id[target].get("world") != world:
            report.error(f"{relation_id}: 'to' belongs to another world")
        if world == "M" and kind not in MENTAL_RELATIONS:
            report.error(f"{relation_id}: relation kind '{kind}' is not allowed in M-world")
        if world == "R" and kind not in REAL_RELATIONS:
            report.error(f"{relation_id}: relation kind '{kind}' is not allowed in R-world")

    # Cross-world links.
    materializations: dict[str, list[str]] = {}
    drift_targets: set[str] = set()

    for link in links:
        link_id = link.get("id", "<unknown>")
        kind = link.get("kind")
        source = link.get("from")
        target = link.get("to")

        if kind not in LINK_KINDS:
            report.error(f"{link_id}: unknown link kind '{kind}'")
            continue
        if source not in by_id:
            report.error(f"{link_id}: unknown 'from' -> {source}")
            continue
        if target not in by_id:
            report.error(f"{link_id}: unknown 'to' -> {target}")
            continue

        source_element = by_id[source]
        target_element = by_id[target]
        source_world = source_element.get("world")
        target_world = target_element.get("world")
        source_kind = source_element.get("kind")
        target_kind = target_element.get("kind")

        if kind == "materializes":
            if source_world != "M" or target_world != "R":
                report.error(f"{link_id}: materializes must go M -> R")
            if source_kind != "class":
                report.error(
                    f"{link_id}: materializes source must be a concrete class, "
                    f"got '{source_kind}'"
                )
            if target_kind not in MATERIALIZABLE_KINDS:
                report.error(
                    f"{link_id}: materializes target must be one of "
                    f"{sorted(MATERIALIZABLE_KINDS)}, got '{target_kind}'"
                )
            materializations.setdefault(target, []).append(source)
        elif kind == "implements":
            if source_world != "M" or target_world != "M":
                report.error(f"{link_id}: implements must stay inside M-world")
            if source_kind != "class":
                report.error(
                    f"{link_id}: implements source must be a class, got '{source_kind}'"
                )
            if target_kind != "interface":
                report.error(
                    f"{link_id}: implements target must be an interface, "
                    f"got '{target_kind}'"
                )
        elif kind == "deploys":
            if source_world != "M" or target_world != "R":
                report.error(f"{link_id}: deploys must go M -> R")
            if source_kind != "component":
                report.error(
                    f"{link_id}: deploys source must be a component, got '{source_kind}'"
                )
            if target_kind != "process":
                report.error(
                    f"{link_id}: deploys target must be a process, got '{target_kind}'"
                )
        elif kind == "observes":
            if source_world != "R" or target_world != "M":
                report.error(f"{link_id}: observes must go R -> M")
        elif kind == "drift":
            if source_world != "M" or target_world != "R":
                report.error(f"{link_id}: drift must go M -> R")
            drift_targets.add(target)

    # Every materializable R entity has exactly one materializing class,
    # unless an explicit drift link covers it. Provenance is derived.
    for element in elements:
        if element.get("world") != "R":
            continue
        if element.get("kind") not in MATERIALIZABLE_KINDS:
            continue

        element_id = element.get("id", "<unknown>")
        sources = materializations.get(element_id, [])
        provenance = element.get("provenance")

        if not sources:
            if element_id in drift_targets:
                report.warn(f"{element_id}: no materializes link (covered by drift)")
            else:
                report.error(
                    f"{element_id}: materializable R entity has no "
                    "'materializes' link"
                )
            if provenance is not None:
                report.error(f"{element_id}: provenance requires a 'materializes' link")
            continue

        if len(sources) > 1:
            report.error(
                f"{element_id}: multiple materializing classes: {sources}"
            )
            continue

        if provenance is not None:
            materialized_from = provenance.get("materializedFrom")
            if materialized_from != sources[0]:
                report.error(
                    f"{element_id}: provenance.materializedFrom "
                    f"'{materialized_from}' does not match materializes "
                    f"source '{sources[0]}'"
                )

    return by_id


def validate_layout(layout: dict, model: dict, by_id: dict[str, dict], report: Report) -> None:
    if layout.get("modelId") != model.get("id"):
        report.error(
            f"layout.modelId '{layout.get('modelId')}' does not match model.id '{model.get('id')}'"
        )

    for world, world_layout in layout.get("worlds", {}).items():
        for node in world_layout.get("nodes", []):
            ref = node.get("ref")
            if ref not in by_id:
                report.error(f"layout {world}: unknown ref '{ref}'")
                continue
            element_world = by_id[ref].get("world")
            if element_world != world:
                report.error(
                    f"layout {world}: node '{ref}' belongs to world '{element_world}'"
                )


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__.strip(), file=sys.stderr)
        return 2

    model_path = Path(argv[1])
    layout_path = Path(argv[2]) if len(argv) > 2 else None

    report = Report()
    model = load(model_path)
    by_id = validate_model(model, report)

    if layout_path is not None:
        validate_layout(load(layout_path), model, by_id, report)

    for warning in report.warnings:
        print(f"warning: {warning}")

    if report.errors:
        for error in report.errors:
            print(f"error: {error}")
        print(f"\nFAILED: {len(report.errors)} error(s)")
        return 1

    elements = len(model.get("elements", []))
    relations = len(model.get("relations", []))
    links = len(model.get("links", []))
    print(
        f"OK: {model.get('id')} — {elements} elements, "
        f"{relations} relations, {links} links"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
