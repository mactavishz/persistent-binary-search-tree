.PHONY: web app1 app2 test benchmark_1 benchmark_2 benchmark_3 clean venv benchmark_venv

UV ?= uv
VENVDIR ?= .venv
VENV := $(VENVDIR)/bin
ifeq ($(OS),Windows_NT)
VENV := $(VENVDIR)/Scripts
endif

venv:
	$(UV) sync --frozen

web:
	pnpm --dir typescript install
	pnpm --dir typescript dev

benchmark_venv:
	$(UV) sync --frozen --group benchmark

app1: venv
	$(VENV)/python app/planar.py 1

app2: venv
	$(VENV)/python app/planar.py 2

test: venv
	$(VENV)/pytest tests -v

benchmark_1: benchmark_venv
	PYTHONMALLOC=malloc $(VENV)/python benchmarks/normal.py

benchmark_2: benchmark_venv
	PYTHONMALLOC=malloc $(VENV)/python benchmarks/partial_persistence.py

benchmark_3: benchmark_venv
	PYTHONMALLOC=malloc $(VENV)/python benchmarks/memory.py

clean:
	rm -rf benchmarks/results/*.{bin,json}
