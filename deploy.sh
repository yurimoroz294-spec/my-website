#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Zapi — first-time deploy script for Hetzner Ubuntu 22.04
# Usage: bash deploy.sh your@email.com zapi.cz
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

EMAIL="${1:?Usage: bash deploy.sh EMAIL DOMAIN}"
DOMAIN="${2:?Usage: bash deploy.sh EMAIL DOMAIN}"
REPO="${3:-https://github.com/your-org/zapi.git}"

echo "▶ Deploy Zapi → $DOMAIN"

# ── 1. System deps ────────────────────────────────────────────────────────────
echo "[1/7] Installing Docker..."
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

# ── 2. Clone repo ─────────────────────────────────────────────────────────────
echo "[2/7] Cloning repo..."
if [ ! -d /opt/zapi ]; then
  git clone "$REPO" /opt/zapi
else
  git -C /opt/zapi pull
fi
cd /opt/zapi

# ── 3. Create .env.production ─────────────────────────────────────────────────
echo "[3/7] Configuring environment..."
if [ ! -f .env.production ]; then
  cp backend/.env.example .env.production
  JWT_SECRET=$(openssl rand -hex 32)
  sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|"           .env.production
  sed -i "s|APP_URL=.*|APP_URL=https://$DOMAIN|"             .env.production
  sed -i "s|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=https://$DOMAIN|" .env.production
  echo ""
  echo "⚠️  Edit /opt/zapi/.env.production and fill in:"
  echo "   OPENAI_API_KEY, STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET"
  echo ""
  read -rp "Press Enter after filling .env.production to continue..."
fi

# ── 4. Temp nginx (HTTP only) for certbot challenge ───────────────────────────
echo "[4/7] Starting temporary HTTP nginx for Let's Encrypt..."
cat > nginx/nginx.conf <<NGINX
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 200 'Zapi — getting SSL cert...'; add_header Content-Type text/plain; }
}
NGINX

docker compose up -d nginx certbot

# ── 5. Obtain SSL certificate ─────────────────────────────────────────────────
echo "[5/7] Obtaining SSL certificate from Let's Encrypt..."
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  --email "$EMAIL" --agree-tos --no-eff-email \
  -d "$DOMAIN" -d "www.$DOMAIN"

# ── 6. Switch to full nginx config ────────────────────────────────────────────
echo "[6/7] Enabling HTTPS nginx config..."
sed -i "s/zapi\.cz/$DOMAIN/g" nginx/nginx.conf

# Write final config
cat > nginx/nginx.conf <<NGINX
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://\$host\$request_uri; }
}

server {
    listen 443 ssl;
    http2 on;
    server_name $DOMAIN www.$DOMAIN;

    ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:SSL:10m;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options SAMEORIGIN always;

    client_max_body_size 10m;

    location = /widget.js {
        proxy_pass http://app:3000/widget.js;
        proxy_set_header Host \$host;
        add_header Access-Control-Allow-Origin * always;
        add_header Cache-Control "public, max-age=3600" always;
    }

    location = /api/billing/webhook {
        proxy_pass http://app:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
    }

    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
    }
}
NGINX

# ── 7. Start everything ───────────────────────────────────────────────────────
echo "[7/7] Starting all services..."
docker compose up -d --build

echo ""
echo "✅ Zapi is live at https://$DOMAIN"
echo ""
echo "Next steps:"
echo "  1. Set Stripe webhook URL: https://$DOMAIN/api/billing/webhook"
echo "  2. Open https://$DOMAIN/dashboard.html to register your first account"
echo "  3. Monitor logs: docker compose logs -f app"
