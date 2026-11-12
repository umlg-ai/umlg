# GitHub Copilot instructions

UMLG is a 3D architecture language with two worlds: **M (intent)** and **R (realization)**.

Before suggesting code or docs, follow [`AGENTS.md`](../AGENTS.md) and [`docs/ai-handbook.md`](../docs/ai-handbook.md).

Hard rules:

- One presence at a time; never render the other world.
- Semantics live in `model.json`; presentation lives in `layout.json`.
- `abstractClass` cannot be the source of `materializes`.
- Every R `object` has exactly one materializing class.
- Do not add core entities without an RFC and 3–5 course topics.
- Do not copy LearnOpenGL text or images.
- Run `make validate` after changes.

When editing JSON, update the spec first, then the schema, then the example, then the validator.
