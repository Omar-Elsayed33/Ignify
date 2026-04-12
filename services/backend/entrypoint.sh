#!/bin/bash
set -e

echo "==> Running Alembic migrations..."
alembic upgrade head 2>/dev/null || echo "==> No alembic versions found, using auto-create tables via app startup"

echo "==> Running seed data..."
python -c "
import asyncio
from app.db.database import async_session
from app.db.seed import run_seed

async def main():
    async with async_session() as db:
        await run_seed(db)
    print('==> Seed complete')

asyncio.run(main())
" 2>/dev/null || echo "==> Seed skipped (tables may not exist yet, app startup will handle it)"

echo "==> Starting application..."
exec "$@"
