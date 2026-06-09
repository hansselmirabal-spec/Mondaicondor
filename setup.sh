#!/bin/bash
# TaskFlow AI — server setup script
# Sets up PROD, DEV and QAS environments from scratch on a fresh server.
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
echo -e "${CYAN}TaskFlow AI — Setup PROD + DEV + QAS${NC}"
echo "================================================"
echo ""

# ── Prerequisites ─────────────────────────────────────────────────────────────

command -v docker >/dev/null 2>&1 || error "Docker no está instalado."
command -v git    >/dev/null 2>&1 || error "Git no está instalado."
success "Docker y Git disponibles."

# ── GitHub token ──────────────────────────────────────────────────────────────

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
chmod +x deploy-prod.sh deploy-dev.sh deploy-qas.sh
success "Código listo en $INSTALL_DIR"

# ── SMTP (shared across environments) ─────────────────────────────────────────

echo ""
info "Configuración SMTP (opcional — dejá en blanco para saltar)"
read -rp "  SMTP host (ej: smtp.gmail.com): " SMTP_HOST
if [[ -n "$SMTP_HOST" ]]; then
  read -rp "  SMTP puerto (587): " SMTP_PORT
  SMTP_PORT="${SMTP_PORT:-587}"
  read -rp "  SMTP usuario (email): " SMTP_USER
  read -rsp "  SMTP password: " SMTP_PASSWORD; echo ""
else
  SMTP_PORT=587; SMTP_USER=""; SMTP_PASSWORD=""
fi

gen_secret() { openssl rand -hex 32; }
SERVER_IP=$(hostname -I | awk '{print $1}')

write_env() {
  local file=$1 db_pass=$2 jwt=$3 refresh=$4 app_url=$5 db_name=$6
  cat > "$file" <<EOF
DB_PASSWORD=${db_pass}
JWT_SECRET=${jwt}
JWT_REFRESH_SECRET=${refresh}
APP_URL=${app_url}
PORT=3000
SMTP_HOST=${SMTP_HOST}
SMTP_PORT=${SMTP_PORT}
SMTP_USER=${SMTP_USER}
SMTP_PASSWORD=${SMTP_PASSWORD}
EOF
}

# ── PROD .env (port 5300) ─────────────────────────────────────────────────────

echo ""
if [[ -f .env.prod ]]; then
  warn ".env.prod ya existe — se omite (borralo manualmente si querés regenerarlo)."
else
  info "Configurando PROD (puerto 5300)"
  read -rsp "  DB password para PROD: " PROD_DB_PASS; echo ""
  [[ -z "$PROD_DB_PASS" ]] && error "DB password vacía."
  write_env .env.prod "$PROD_DB_PASS" "$(gen_secret)" "$(gen_secret)" \
    "http://${SERVER_IP}:5300" "taskflow_prod"
  success ".env.prod creado."
fi

# ── DEV .env (port 5301) ──────────────────────────────────────────────────────

if [[ -f .env.dev ]]; then
  warn ".env.dev ya existe — se omite."
else
  info "Configurando DEV (puerto 5301)"
  read -rsp "  DB password para DEV: " DEV_DB_PASS; echo ""
  [[ -z "$DEV_DB_PASS" ]] && error "DB password vacía."
  write_env .env.dev "$DEV_DB_PASS" "$(gen_secret)" "$(gen_secret)" \
    "http://${SERVER_IP}:5301" "taskflow_dev"
  success ".env.dev creado."
fi

# ── QAS .env (port 5302) ──────────────────────────────────────────────────────

if [[ -f .env.qas ]]; then
  warn ".env.qas ya existe — se omite."
else
  info "Configurando QAS (puerto 5302)"
  read -rsp "  DB password para QAS: " QAS_DB_PASS; echo ""
  [[ -z "$QAS_DB_PASS" ]] && error "DB password vacía."
  write_env .env.qas "$QAS_DB_PASS" "$(gen_secret)" "$(gen_secret)" \
    "http://${SERVER_IP}:5302" "taskflow_qas"
  success ".env.qas creado."
fi

# ── Stop existing containers on conflicting ports ─────────────────────────────

echo ""
info "Verificando puertos en uso..."
for port in 5300 5301 5302; do
  cid=$(docker ps --filter "publish=${port}" -q 2>/dev/null)
  if [[ -n "$cid" ]]; then
    warn "Puerto ${port} ocupado — deteniendo contenedor ${cid}..."
    docker stop "$cid" >/dev/null
  fi
done
success "Puertos libres."

# ── Deploy all three environments ─────────────────────────────────────────────

echo ""
info "Deployando PROD (5300)..."
./deploy-prod.sh

echo ""
info "Deployando DEV (5301) y promoviendo a QAS (5302)..."
./deploy-dev.sh

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "================================================"
echo -e "${GREEN}Setup completado.${NC}"
echo ""
echo -e "  PROD  →  http://${SERVER_IP}:5300"
echo -e "  DEV   →  http://${SERVER_IP}:5301"
echo -e "  QAS   →  http://${SERVER_IP}:5302"
echo ""
echo "Para deployar cambios futuros a PROD:"
echo "  cd $INSTALL_DIR && git pull && ./deploy-prod.sh"
echo ""
echo "Para deployar a DEV + QAS:"
echo "  cd $INSTALL_DIR && git pull && ./deploy-dev.sh"
echo "================================================"
