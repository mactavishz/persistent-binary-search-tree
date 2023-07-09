.PHONY: test

app: venv
	$(VENV)/python app/planar.py

test: venv
	$(VENV)/pytest tests

include Makefile.venv
