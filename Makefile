.PHONY: test

app1: venv
	$(VENV)/python app/planar.py 1

app2: venv
	$(VENV)/python app/planar.py 2

test: venv
	$(VENV)/pytest tests -v

benchmark_1: venv
	$(VENV)/python benchmarks/normal.py

benchmark_2: venv
	$(VENV)/python benchmarks/partial_persistence.py

benchmark_3: venv
	$(VENV)/python benchmarks/memory.py

include Makefile.venv
