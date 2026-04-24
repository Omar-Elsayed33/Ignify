#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Ignify — one-command deploy
#  Usage:
#    ./deploy.sh          # first time or full redeploy
#    ./deploy.sh update   # pull latest code + restart (no data loss)
#    ./deploy.sh stop     # stop all containers
#    ./deploy.sh logs     # tail all logs
# ─────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE_DIR="$(cd "$(dirname "$0")/infra/docker" && pwd)"
cd "$COMPOSE_DIR"

MODE="${1:-deploy}"

case "$MODE" in
  deploy)
    echo "🚀  Ignify — full deploy"

    # Copy .env if missing
    if [ ! -f .env ]; then
      if [ -f .env.example ]; then
        cp .env.example .env
        echo "⚠️  Created .env from .env.example — edit it before going live!"
      else
        echo "❌  No .env found. Create infra/docker/.env first."; exit 1
      fi
    fi

    docker compose pull --quiet 2>/dev/null || true
    docker compose up -d --build --remove-orphans

    echo ""
    echo "⏳  Waiting for backend to be ready..."
    for i in $(seq 1 30); do
      if docker compose exec -T backend curl -sf http://localhost:8000/health > /dev/null 2>&1; then
        echo "✅  Backend is up!"
        break
      fi
      sleep 3
    done

    echo ""
    echo "────────────────────────────────────────"
    echo "  Dashboard  →  http://localhost:3000"
    echo "  Website    →  http://localhost:3010"
    echo "  API docs   →  http://localhost:8000/docs"
    echo "  Admin      →  admin@ignify.com / Admin@2024"
    echo "────────────────────────────────────────"
    ;;

  update)
    echo "🔄  Ignify — update (no data loss)"
    git pull --ff-only 2>/dev/null || true
    docker compose up -d --build --remove-orphans
    echo "✅  Update complete."
    ;;

  stop)
    echo "🛑  Stopping all containers..."
    docker compose down
    ;;

  logs)
    docker compose logs -f --tail=100
    ;;

  *)
    echo "Usage: $0 [deploy|update|stop|logs]"
    exit 1
    ;;
esac
