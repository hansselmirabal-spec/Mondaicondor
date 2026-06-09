#!/bin/bash
# TaskFlow AI — server setup script
# Sets up DEV and QAS environments from scratch on a fresh server.
#
# Usage (on the server):
#   bash setup.sh
#
# Or pipe directly:
#   curl -H "Authorization: token TOKEN" -s \
#     https://raw.githubusercontent.com/hansselmirabal-spec/Mondaicondor/main/setup.sh | bash

set -e

REPO_URL="https://github.com/hansselmirabal-spec/Mondaicondor.git"
INSTALL_DIR="/opt/taskflow"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

info()    { echo -e "${CYAN}==>${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn()    { echo -e "${YELLOW}!${NC} $1"; }
error()   { echo -e "${RED}ERROR:${NC} $1"; exit 1; }

echo ""
echo -e "${CYAN}TaskFlow AI — Setup DEV + QAS${NC}"
echo "================================================"
echo ""

# ── Prerequisites ────────────────────────────────────────────────────────────

command -v docker >/dev/null 2>&1  || error "Docker no está instalado."
command -v git    >/dev/null 2>&1  || error "Git no está instalado."
success "Docker y Git disponibles."

# ── GitHub token ─────────────────────────────────────────────────────────────

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo ""
  warn "El repo es privado. Necesitás un Personal Access Token de GitHub."
  warn "Crealo en: GitHub → Settings → Developer settings → Tokens (classic) → scope: repo"
  echo ""
  read -rsp "GitHub Personal Access Token: " GITHUB_TOKEN
  echo ""
fi

[[ -z "$GITHUB_TOKEN" ]] && error "Token vacío — abortando."

# ── Clone or update ───────────────────────────────────────────────────────────

if [[ -d "$INSTALL_DIR/.git" ]]; then
  info "Repositorio ya existe en $INSTALL_DIR — haciendo pull..."
  git -C "$INSTALL_DIR" pull origin main
else
  info "Clonando repositorio en $INSTALL_DIR..."
  git clone "https://${GITHUB_TOKEN}@${REPO_URL#https://}" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
success "Código listo en $INSTALL_DIR"

# ── Generate secrets ──────────────────────────────────────────────────────────

gen_secret() { openssl rand -hex 32; }

# ── DEV .env ──────────────────────────────────────────────────────────────────

if [[ -f .env.dev ]]; then
  warn ".env.dev ya existe — se omite (borralo manualmente si querés regenerarlo)."
else
  echo ""
  info "Configurando ambiente DEV (puerto 5301)"
  read -rsp "  DB password para DEV: " DEV_DB_PASS; echo ""
  [[ -z "$DEV_DB_PASS" ]] && error "DB password vacía."

  DEV_JWT=$(gen_secret)
  DEV_REFRESH=$(gen_secret)

  cat > .env.dev <<EOF
DB_PASSWORD=${DEV_DB_PASS}
JWT_SECRET=${DEV_JWT}
JWT_REFRESH_SECRET=${DEV_REFRESH}
APP_URL=http://$(hostname -I | awk '{print $1}'):5301
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
EOF
  success ".env.dev creado (JWT secrets generados automáticamente)."
fi

# ── QAS .env ──────────────────────────────────────────────────────────────────

if [[ -f .env.qas ]]; then
  warn ".env.qas ya existe — se omite."
else
  echo ""
  info "Configurando ambiente QAS (puerto 5302)"
  read -rsp "  DB password para QAS: " QAS_DB_PASS; echo ""
  [[ -z "$QAS_DB_PASS" ]] && error "DB password vacía."

  QAS_JWT=$(gen_secret)
  QAS_REFRESH=$(gen_secret)

  cat > .env.qas <<EOF
DB_PASSWORD=${QAS_DB_PASS}
JWT_SECRET=${QAS_JWT}
JWT_REFRESH_SECRET=${QAS_REFRESH}
APP_URL=http://$(hostname -I | awk '{print $1}'):5302
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
EOF
  success ".env.qas creado (JWT secrets generados automáticamente)."
fi

# ── Deploy ────────────────────────────────────────────────────────────────────

echo ""
info "Lanzando DEV y QAS..."
chmod +x deploy-dev.sh deploy-qas.sh
./deploy-dev.sh

# ── Summary ───────────────────────────────────────────────────────────────────

SERVER_IP=$(hostname -I | awk '{print $1}')
echo ""
echo "================================================"
echo -e "${GREEN}Setup completado.${NC}"
echo ""
echo -e "  Producción  →  http://${SERVER_IP}:5300"
echo -e "  DEV         →  http://${SERVER_IP}:5301"
echo -e "  QAS         →  http://${SERVER_IP}:5302"
echo ""
echo "Para deployar cambios futuros:"
echo "  cd $INSTALL_DIR && git pull && ./deploy-dev.sh"
echo "================================================"
