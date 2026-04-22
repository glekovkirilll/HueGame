# Deploy to Debian 12 VPS

Target VPS: 1 vCPU, 2GB RAM, 20GB storage.

This project currently runs in Docker using the workspace dev runtime. On a small VPS, add swap before building the image.

## 1. SSH into the server

```sh
ssh root@YOUR_VPS_IP
```

## 2. Add 2GB swap

Skip this if the server already has swap.

```sh
swapon --show
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
cp /etc/fstab /etc/fstab.bak
printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
```

## 3. Install Docker Engine and Compose plugin

```sh
apt update
apt install -y ca-certificates curl git
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

cat >/etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: bookworm
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
docker --version
docker compose version
```

## 4. Clone the project

```sh
cd /opt
git clone https://github.com/glekovkirilll/HueGame.git huegame
cd /opt/huegame
```

For updates later:

```sh
cd /opt/huegame
git pull
```

## 5. Point the subdomain to the VPS

In REG.RU DNS zone for `flipflop.site`, add:

```text
Subdomain/Name: hue
Type: A
Value/IP: YOUR_VPS_IP
```

Typical REG.RU path: `Domains` -> `flipflop.site` -> `DNS zone management` -> add an `A` record.

If your VPS has IPv6 and you want to use it, also add an `AAAA` record for `hue`.

Wait until DNS resolves:

```sh
getent hosts hue.flipflop.site
```

It should print your VPS IP.

## 6. Create VPS env file

```sh
cp infra/docker/.env.vps.example infra/docker/.env.vps
nano infra/docker/.env.vps
```

Set:

```env
POSTGRES_PASSWORD=your-long-random-password
APP_DOMAIN=hue.flipflop.site
ACME_EMAIL=admin@flipflop.site
NEXT_PUBLIC_BACKEND_URL=https://hue.flipflop.site:8443
HTTPS_PORT=8443
```

The backend start script URL-encodes `POSTGRES_PASSWORD` before creating `DATABASE_URL`, so strong passwords with symbols are supported.

## 7. Open ports

If you use `ufw`:

```sh
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 8443/tcp
ufw enable
```

If the VPS provider has a cloud firewall, also open TCP `80` and `8443` there.

Ports `80` and `8443` must be free on the server. If another web server is already installed on port `80`, stop it before starting the stack:

```sh
systemctl stop nginx apache2 2>/dev/null || true
```

## 8. Build and start

```sh
docker compose --env-file infra/docker/.env.vps -f infra/docker/docker-compose.vps.yml up -d --build
```

If the VPS only has old `docker-compose` v1, use:

```sh
docker-compose -p huegame --env-file infra/docker/.env.vps -f infra/docker/docker-compose.vps.yml up -d --build
```

Open:

```text
https://hue.flipflop.site:8443
```

Caddy will request and renew the HTTPS certificate automatically. DNS for `hue.flipflop.site` must point to this VPS and port `80` must be reachable before certificate issuance can succeed.

## Useful commands

```sh
docker compose --env-file infra/docker/.env.vps -f infra/docker/docker-compose.vps.yml ps
docker compose --env-file infra/docker/.env.vps -f infra/docker/docker-compose.vps.yml logs -f --tail=100
docker compose --env-file infra/docker/.env.vps -f infra/docker/docker-compose.vps.yml logs -f proxy
docker compose --env-file infra/docker/.env.vps -f infra/docker/docker-compose.vps.yml restart
docker compose --env-file infra/docker/.env.vps -f infra/docker/docker-compose.vps.yml down
```

For old `docker-compose` v1, replace `docker compose` with `docker-compose -p huegame`.

Rebuild after updates:

```sh
git pull
docker compose --env-file infra/docker/.env.vps -f infra/docker/docker-compose.vps.yml up -d --build
```
