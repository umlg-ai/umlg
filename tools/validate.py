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
    for element in elements:
        element_id = element.get("id")
        if not element_id:
            report.error("element without id")
            continue
        if element_id in by_id:
            report.error(f"duplicate element id: {element_id}")
        by_id[element_id] = element

    for relation in relations:
        relation_id = relation.get("id")
        if not relation_id:
            report.error("relation without id")
        elif relation_id in by_id:
            report.error(f"duplicate id across elements/relations: {relation_id}")
        else:
            by_id[relation_id] = relation

    for link in links:
        link_id = link.get("id")
        if not link_id:
            report.error("link without id")
        elif link_id in by_id:
            report.error(f"duplicate id across elements/links: {link_id}")
        else:
            by_id[link_id] = link

    # World / kind consistency.
    for element in elements:
        element_id = element.get("id", "<unknown>")
        world = element.get("world")
        kind = element.get("kind")
        if world == "M" and kind not in MENTAL_KINDS:
            report.error(f"{element_id}: kind '{kind}' is not allowed in M-world")
        if world == "R" and kind not in REAL_KINDS:
            report.error(f"{element_id}: kind '{kind}' is not allowed in R-world")

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
    for link in links:
        link_id = link.get("id", "<unknown>")
        kind = link.get("kind")
        source = link.get("from")
        target = link.get("to")

        if kind not in LINK_KINDS:
            report.error(f"{link_id}: unknown link kind '{kind}'")
        if source not in by_id:
            report.error(f"{link_id}: unknown 'from' -> {source}")
            continue
        if target not in by_id:
            report.error(f"{link_id}: unknown 'to' -> {target}")
            continue

        source_element = by_id[source]
        target_element = by_id[target]

        if kind == "materializes":
            if source_element.get("kind") == "abstractClass":
                report.error(
                    f"{link_id}: abstract class '{source}' cannot be materialized directly"
                )
            if source_element.get("world") != "M" or target_element.get("world") != "R":
                report.error(f"{link_id}: materializes must go M -> R")
            materializations.setdefault(target, []).append(source)
        elif kind in {"implements"}:
            if source_element.get("world") != "M" or target_element.get("world") != "M":
                report.error(f"{link_id}: {kind} must stay inside M-world")
        elif kind in {"deploys", "observes", "drift"}:
            if source_element.get("world") != "M" or target_element.get("world") != "R":
                report.warn(
                    f"{link_id}: expected M -> R for '{kind}', got "
                    f"{source_element.get('world')} -> {target_element.get('world')}"
                )

    # Every R object has exactly one materializing class.
    for element in elements:
        if element.get("kind") != "object":
            continue
        element_id = element.get("id", "<unknown>")
        sources = materializations.get(element_id, [])
        if not sources:
            report.warn(f"{element_id}: object has no 'materializes' link (drift?)")
        elif len(sources) > 1:
            report.error(f"{element_id}: object has multiple materializing classes: {sources}")

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
