.PHONY: validate json schema semantics links fmt help

PYTHON ?= python3
AJV ?= npx --yes ajv-cli@5

help:
	@echo "make validate  — JSON syntax, schema, semantics, links"
	@echo "make json      — JSON syntax only"
	@echo "make schema    — JSON Schema validation (ajv)"
	@echo "make semantics — cross-world and reference checks"
	@echo "make links     — relative Markdown links"
	@echo "make fmt       — reformat JSON files with python"

validate: json schema semantics links

json:
	@$(PYTHON) -m json.tool examples/hello-triangle/model.json > /dev/null
	@$(PYTHON) -m json.tool examples/hello-triangle/layout.json > /dev/null
	@$(PYTHON) -m json.tool schema/umlg.schema.json > /dev/null
	@$(PYTHON) -m json.tool schema/layout.schema.json > /dev/null
	@echo "OK: JSON syntax"

schema:
	@$(AJV) validate --spec=draft2020 -s schema/umlg.schema.json -d "examples/**/model.json"
	@$(AJV) validate --spec=draft2020 -s schema/layout.schema.json -d "examples/**/layout.json"

semantics:
	@$(PYTHON) tools/validate.py examples/hello-triangle/model.json examples/hello-triangle/layout.json
	@$(PYTHON) tools/validate.py examples/drift-orphan/model.json examples/drift-orphan/layout.json

links:
	@$(PYTHON) tools/check_links.py

fmt:
	@$(PYTHON) - <<'PY'
	import json, pathlib
	for path in sorted(pathlib.Path(".").rglob("*.json")):
	    if "node_modules" in path.parts:
	        continue
	    data = json.loads(path.read_text(encoding="utf-8"))
	    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
	    print(f"formatted {path}")
	PY
