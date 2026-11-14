# Initial AI Review Panel — 2026-11-13

- Scope: UMLG v0.1 draft, `hello-triangle`, spec, schema, validator, course, video plan.
- Mode: 8 independent agents, no shared context, read-only.
- Protocol: [`protocol.md`](protocol.md).
- Status: synthesis complete; P0/P1 fixes applied in the same change set.

## 1. Verdicts

| Role | Verdict | Headline |
|---|---|---|
| Ontologist | **reject** | two P0: `materializes` target ambiguity, provenance vs link dual truth |
| Visual grammar | **reject** | R non-objects have no visual; abstract collides with class and states |
| Domain (OpenGL) | accept with changes | shaders are real GL objects; attribute 0 invariant overclaimed |
| Learning | accept with changes | self-check never tests class vs object; Q1/Q4/Q6 contradict model |
| Skeptic | **defer** | no implementation, no user evidence, 3D value unproven |
| Metaphor scout | keep workshop (81/100) | city 72, 3d-printing 67; no challenger passes replacement threshold |
| Accessibility | accept with changes | `Tab` hijack, no non-3D path, reduced motion loses meaning |
| AI contributor | **reject** | clean checkout red; typical tasks not executable as written |

## 2. Synthesized P0

### P0-1. `materializes` target is undefined

`spec/01-worlds.md` §5 and `spec/05-serialization.md` §6 say **class → object**.
The example materializes 8 non-objects (resources, stages, command).
`tools/validate.py` enforces “exactly one” only for `kind: object`.

**Decision:** `materializes` means **M concrete class → R materializable entity**.
Allowed targets: `object`, `resource`, `process`, `stage`, `command`. `actor` is an execution context and is not materialized.
Exactly one source is required for every materializable R entity; absence is an error unless a `drift` link covers it.

### P0-2. Two sources of truth for object↔class

`provenance.materializedFrom` and `materializes` links can disagree; the validator checks only links.

**Decision:** the link is authoritative. `provenance.materializedFrom` is derived metadata. The validator must reject a mismatch.

### P0-3. Clean checkout red

`docs/review/README.md` linked to this file before it existed, so `make validate` failed.

**Decision:** fixed by this report; review scaffolding is committed atomically with the link from now on.

### P0-4. Visual grammar cannot render R non-objects

`spec/03-visual-grammar.md` defines a visual only for `object` (“working workshop”). Resources, stages, commands and actors are the majority of R.

**Decision:** add mandatory R visuals: resource = tank/rack, stage = line segment, command = work order, actor = operator/console. They are not workshops.

### P0-5. `implements` direction reverses between documents

`spec/03` says class → interface; `spec/01` and `spec/05` say interface → class.

**Decision:** `implements` is M-internal, **class → interface**, mirroring `realization`.

## 3. Synthesized P1

| # | Finding | Decision |
|---|---|---|
| 1 | `observes` direction inverted in validator (spec: R→M) | fix validator, add fixture |
| 2 | `drift` only warns; no drift link/list | error unless explicit `drift` link |
| 3 | `Tab` hijacks keyboard/screen reader | default `P`, `Tab` untouched |
| 4 | Video shot 11 shows R triangle in M | remove the echo; show HUD only |
| 5 | `abstract` visually collides with `class` and five states | add mandatory geometry cue + state table |
| 6 | LOD/aggregation erases relation kind and drift | aggregate by relation kind; drift never aggregates away |
| 7 | `viewpoint` cannot be serialized though spec requires enum | add optional `viewpoints[]` to model |
| 8 | self-check Q1/Q4/Q6 contradict model | rewrite; add class/object question |
| 9 | course NPC roles contradict spec | align to Brigadier/Operator/Courier/Inspector |
| 10 | `m.state` has no serialized invariants | add `invariants[]` to concept |
| 11 | validator only checks `hello-triangle` | iterate `examples/*/` |
| 12 | `spec/05` example uses `notes`, schema forbids | use `description` |
| 13 | abstract shaders are real GL objects, but text says otherwise | state modeling simplification explicitly |
| 14 | 5 vs 7 self-check questions | unify to 7 |
| 15 | S-world reserved “in schema” but schema allows only M/R | clarify: conceptual reserve, not v0.1 schema |

## 4. Metaphor decision

Scorecard result:

| Metaphor | Score | Strongest | Fatal weakness |
|---|---:|---|---|
| **workshop** | **81** | methods, runtime, NPC | class reads as place |
| city | 72 | scale, LOD, districts | no method |
| 3d-printing | 67 | class = model, object = print | no runtime history |
| laboratory | 65 | runtime, invariants | no hierarchy |
| theater | 46 | sequence | role↔actor is M:N |
| recipe | 42 | universality | no 3D, no state |

**Decision:** keep workshop as visual grammar. Use **3D-printing as an explanatory analogy** for materialization in prose and course, not as a second visual language. No hybrid until the viewer exists.

## 5. What the panel confirmed

- Non-goals and “one presence” are clear.
- JSON Schema + semantic validator is a real foundation.
- `abstractClass` as ghost is the strongest original idea.
- Review protocol, decision records and AI entry docs reduce onboarding cost.
- The workshop metaphor survives the challenger round on method/runtime, not on aesthetics.

## 6. Open questions

1. Do `VertexShader`/`FragmentShader` get R twins in v0.2, or does `ShaderProgram` stand in for them?
2. Is `m.stage.*` a conceptual class or an alias of `m.vertexShader`/`m.fragmentShader`?
3. Should `drift` be a link kind only, or also a serialized list?
4. What is the falsification threshold for the 3D value: +20% time, −1 error, or both?
5. When does `S`-world become a major-version change?

## 7. Follow-up issues

Created from P1/P2 findings:

- viewer V0;
- drift example;
- record demo video;
- Hello Window topic;
- materialization matrix RFC;
- non-3D inspector and keyboard navigation;
- reduced-motion semantic replacements.

## 8. Review hygiene

- Reports are immutable once merged; corrections go to a new dated report.
- A review that finds nothing must list the three checks most likely to break next.
- The panel is adversarial by design; `reject` is a valid and useful outcome.

## 9. Fix status — 2026-11-14

P0-1…P0-5 and P1-1…P1-15 are applied in the same change set:

- `spec/01`, `spec/03`, `spec/04`, `spec/05`;
- `schema/umlg.schema.json`;
- `examples/hello-triangle/{model.json,self-check.md,README.md}`;
- `tools/validate.py` and `tools/test_validate.py`;
- `Makefile` and CI;
- `course/hello-triangle.md`, `docs/video/hello-triangle-demo.md`, `docs/ai-handbook.md`.

P2 items remain as follow-up issues in §7.
