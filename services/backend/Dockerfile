FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl && \
    rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install dependencies
COPY pyproject.toml .
RUN uv pip install --system --no-cache \
    "fastapi>=0.115.0" \
    "uvicorn[standard]>=0.30.0" \
    "sqlalchemy[asyncio]>=2.0.0" \
    "asyncpg>=0.30.0" \
    "alembic>=1.14.0" \
    "pydantic>=2.10.0" \
    "pydantic-settings>=2.6.0" \
    "python-jose[cryptography]>=3.3.0" \
    "bcrypt>=4.2.0" \
    "redis>=5.2.0" \
    "httpx>=0.28.0" \
    "celery[redis]>=5.4.0" \
    "python-multipart>=0.0.18" \
    "Pillow>=11.0.0"

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
