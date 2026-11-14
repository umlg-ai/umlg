# GitHub Copilot instructions

UMLG is a 3D architecture language with two worlds: **M (intent)** and **R (realization)**.

Before suggesting code or docs, follow [`AGENTS.md`](../AGENTS.md) and [`docs/ai-handbook.md`](../docs/ai-handbook.md).

Hard rules:

- One presence at a time; never render the other world.
- Semantics live in `model.json`; presentation lives in `layout.json`.
- `abstractClass` cannot be the source of `materializes`; only a concrete M `class` can.
- Every materializable R entity (`object`, `resource`, `process`, `stage`, `command`) has exactly one materializing class or an explicit `drift`.
- `implements` goes class → interface inside M; `observes` goes R → M.
- `actor` is an execution context and is never materialized.
- Do not add core entities without an RFC and 3–5 course topics.
- Do not copy LearnOpenGL text or images.
- Run `make validate` after changes.

When editing JSON, update the spec first, then the schema, then the example, then the validator.
