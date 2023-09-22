.PHONY: test

app1: venv
	$(VENV)/python app/planar.py 1

app2: venv
	$(VENV)/python app/planar.py 2

test: venv
	$(VENV)/pytest tests -v

benchmark_1: venv
	PYTHONMALLOC=malloc $(VENV)/python benchmarks/normal.py

benchmark_2: venv
	PYTHONMALLOC=malloc $(VENV)/python benchmarks/partial_persistence.py

benchmark_3: venv
	PYTHONMALLOC=malloc $(VENV)/python benchmarks/memory.py

clean:
	rm -rf benchmarks/results/*.{bin,json}

include Makefile.venv
