.PHONY: validate json schema semantics links test fmt help viewer viewer-build viewer-test

PYTHON ?= python3
AJV ?= npx --yes ajv-cli@5

help:
	@echo "make validate     — JSON syntax, schema, semantics, tests, links"
	@echo "make json         — JSON syntax only"
	@echo "make schema       — JSON Schema validation (ajv)"
	@echo "make semantics    — cross-world and reference checks"
	@echo "make test         — validator regression tests"
	@echo "make links        — relative Markdown links"
	@echo "make fmt          — reformat JSON files with python"
	@echo "make viewer       — start the web viewer dev server"
	@echo "make viewer-build — type-check and build the web viewer"
	@echo "make viewer-test  — unit tests for the web viewer"

validate: json schema semantics test links

json:
	@for model in examples/*/model.json; do \
		$(PYTHON) -m json.tool "$$model" > /dev/null || exit 1; \
	done
	@for layout in examples/*/layout.json; do \
		$(PYTHON) -m json.tool "$$layout" > /dev/null || exit 1; \
	done
	@$(PYTHON) -m json.tool schema/umlg.schema.json > /dev/null
	@$(PYTHON) -m json.tool schema/layout.schema.json > /dev/null
	@echo "OK: JSON syntax"

schema:
	@$(AJV) validate --spec=draft2020 -s schema/umlg.schema.json -d "examples/**/model.json"
	@$(AJV) validate --spec=draft2020 -s schema/layout.schema.json -d "examples/**/layout.json"

semantics:
	@for model in examples/*/model.json; do \
		layout="$${model%/model.json}/layout.json"; \
		if [ -f "$$layout" ]; then \
			$(PYTHON) tools/validate.py "$$model" "$$layout" || exit 1; \
		else \
			$(PYTHON) tools/validate.py "$$model" || exit 1; \
		fi; \
	done

test:
	@$(PYTHON) tools/test_validate.py

links:
	@$(PYTHON) tools/check_links.py

viewer:
	cd viewer && npm run dev

viewer-build:
	cd viewer && npm run build

viewer-test:
	cd viewer && npm test

fmt:
	@$(PYTHON) - <<'PY'
	import json, pathlib
	roots = [pathlib.Path("examples"), pathlib.Path("schema")]
	for root in roots:
	    for path in sorted(root.rglob("*.json")):
	        data = json.loads(path.read_text(encoding="utf-8"))
	        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
	        print(f"formatted {path}")
	PY
