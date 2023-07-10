.PHONY: test

app1: venv
	$(VENV)/python app/planar.py 1

app2: venv
	$(VENV)/python app/planar.py 2

test: venv
	$(VENV)/pytest tests

include Makefile.venv
