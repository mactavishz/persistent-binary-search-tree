.PHONY: test

test: venv
	$(VENV)/pytest tests

include Makefile.venv
