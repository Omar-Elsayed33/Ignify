FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl libpango-1.0-0 libpangoft2-1.0-0 libcairo2 libgdk-pixbuf-2.0-0 libffi-dev shared-mime-info fonts-dejavu fonts-noto-core && \
    rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app

# Install dependencies from pyproject.toml (single source of truth)
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
    "Pillow>=11.0.0" \
    "langgraph>=0.2.60" \
    "langgraph-checkpoint-postgres>=2.0.0" \
    "langchain-openai>=0.2.14" \
    "langchain-core>=0.3.28" \
    "psycopg[binary,pool]>=3.2.0" \
    "tenacity>=9.0.0" \
    "minio>=7.2.0" \
    "sentry-sdk[fastapi]>=2.0.0" \
    "email-validator>=2.2.0" \
    "weasyprint>=62.0" \
    "pgvector>=0.3.0" \
    "beautifulsoup4>=4.12.0" \
    "lxml>=5.0.0"

COPY . .

RUN chmod +x entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
