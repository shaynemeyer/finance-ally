# Stage 1: Build frontend static export
# Using Node instead of Bun to avoid seccomp issues with Podman
FROM node:22-slim AS frontend-build
WORKDIR /build/frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ .
RUN npx next build

# Stage 2: Runtime (Python 3.12)
FROM python:3.12-slim
WORKDIR /app/backend

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Install Python dependencies (production only)
ENV UV_PROJECT_ENVIRONMENT=/app/backend/.venv
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev

# Copy backend source
COPY backend/ .

# Copy frontend static export into backend/static/
COPY --from=frontend-build /build/frontend/out ./static

# Create db directory (overridden by volume mount at runtime)
RUN mkdir -p /app/db

EXPOSE 8000
CMD ["/app/backend/.venv/bin/uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
