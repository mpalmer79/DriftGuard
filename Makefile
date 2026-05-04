.PHONY: install test lint type fmt ci run-backend run-frontend docker-up clean cov soak fuzz

PY := python -m
BACKEND := backend
FRONTEND := frontend

install:
	cd $(BACKEND) && pip install -r requirements.txt -r requirements-dev.txt
	cd $(FRONTEND) && npm install --no-audit --no-fund

test:
	cd $(BACKEND) && pytest -q

cov:
	cd $(BACKEND) && pytest --cov=app --cov-report=term-missing --cov-fail-under=85

lint:
	cd $(BACKEND) && ruff check app
	cd $(FRONTEND) && npm run lint

type:
	cd $(BACKEND) && mypy app
	cd $(FRONTEND) && npm run typecheck

fmt:
	cd $(BACKEND) && ruff format app
	cd $(FRONTEND) && npm run format

ci: lint type test
	cd $(FRONTEND) && npm run build

soak:
	cd $(BACKEND) && pytest -q -m slow

fuzz:
	cd $(BACKEND) && pytest -q tests/fuzz --timeout=60

run-backend:
	cd $(BACKEND) && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

run-frontend:
	cd $(FRONTEND) && npm run dev

docker-up:
	docker compose up --build

clean:
	rm -rf $(BACKEND)/.pytest_cache $(BACKEND)/htmlcov $(BACKEND)/.coverage
	find $(BACKEND) -type d -name __pycache__ -prune -exec rm -rf {} +
	rm -rf $(FRONTEND)/.next $(FRONTEND)/node_modules/.cache
