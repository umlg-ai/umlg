#!/usr/bin/env python3
"""Focused regression tests for the UMLG semantic validator."""

from __future__ import annotations

import unittest

from validate import Report, validate_model


def element(element_id: str, world: str, kind: str) -> dict:
    return {"id": element_id, "world": world, "kind": kind, "name": element_id}


def model(elements: list[dict], links: list[dict] | None = None) -> dict:
    data: dict = {"id": "test", "elements": elements}
    if links is not None:
        data["links"] = links
    return data


def errors(data: dict) -> list[str]:
    report = Report()
    validate_model(data, report)
    return report.errors


class ValidatorTests(unittest.TestCase):
    def test_valid_materialization(self) -> None:
        data = model(
            [
                element("m.c", "M", "class"),
                {
                    **element("r.o", "R", "object"),
                    "provenance": {"materializedFrom": "m.c"},
                },
            ],
            [{"id": "l", "kind": "materializes", "from": "m.c", "to": "r.o"}],
        )
        self.assertEqual(errors(data), [])

    def test_missing_materializes_is_error(self) -> None:
        data = model([element("m.c", "M", "class"), element("r.o", "R", "object")])
        self.assertTrue(any("no 'materializes' link" in e for e in errors(data)))

    def test_drift_covers_missing_materializes(self) -> None:
        data = model(
            [element("m.c", "M", "class"), element("r.o", "R", "object")],
            [{"id": "d", "kind": "drift", "from": "m.c", "to": "r.o"}],
        )
        self.assertEqual(errors(data), [])

    def test_provenance_must_match_materializes(self) -> None:
        data = model(
            [
                element("m.c", "M", "class"),
                element("m.other", "M", "class"),
                {
                    **element("r.o", "R", "object"),
                    "provenance": {"materializedFrom": "m.other"},
                },
            ],
            [{"id": "l", "kind": "materializes", "from": "m.c", "to": "r.o"}],
        )
        self.assertTrue(
            any("provenance.materializedFrom" in e for e in errors(data))
        )

    def test_abstract_class_cannot_materialize(self) -> None:
        data = model(
            [element("m.a", "M", "abstractClass"), element("r.o", "R", "object")],
            [{"id": "l", "kind": "materializes", "from": "m.a", "to": "r.o"}],
        )
        self.assertTrue(
            any("source must be a concrete class" in e for e in errors(data))
        )

    def test_actor_cannot_be_materialized(self) -> None:
        data = model(
            [element("m.c", "M", "class"), element("r.a", "R", "actor")],
            [{"id": "l", "kind": "materializes", "from": "m.c", "to": "r.a"}],
        )
        self.assertTrue(
            any("target must be one of" in e for e in errors(data))
        )

    def test_multiple_materializing_classes_is_error(self) -> None:
        data = model(
            [
                element("m.c1", "M", "class"),
                element("m.c2", "M", "class"),
                element("r.o", "R", "object"),
            ],
            [
                {"id": "l1", "kind": "materializes", "from": "m.c1", "to": "r.o"},
                {"id": "l2", "kind": "materializes", "from": "m.c2", "to": "r.o"},
            ],
        )
        self.assertTrue(
            any("multiple materializing classes" in e for e in errors(data))
        )

    def test_observes_must_go_r_to_m(self) -> None:
        data = model(
            [element("m.c", "M", "class"), element("r.o", "R", "object")],
            [{"id": "l", "kind": "observes", "from": "m.c", "to": "r.o"}],
        )
        self.assertTrue(
            any("observes must go R -> M" in e for e in errors(data))
        )

    def test_implements_must_be_class_to_interface(self) -> None:
        data = model(
            [element("m.i", "M", "interface"), element("m.c", "M", "class")],
            [{"id": "l", "kind": "implements", "from": "m.i", "to": "m.c"}],
        )
        self.assertTrue(
            any("implements source must be a class" in e for e in errors(data))
        )
        self.assertTrue(
            any("implements target must be an interface" in e for e in errors(data))
        )

    def test_duplicate_member_id_is_error(self) -> None:
        data = model(
            [
                {
                    **element("m.c", "M", "class"),
                    "members": [
                        {"id": "m.c.x", "kind": "attribute", "name": "x"},
                        {"id": "m.c.x", "kind": "attribute", "name": "y"},
                    ],
                }
            ]
        )
        self.assertTrue(any("duplicate id" in e for e in errors(data)))


if __name__ == "__main__":
    unittest.main()
