# Low-memory deployment (4GB RAM EC2)

Both services run on one server with Nginx routing by domain.

## Memory budget (4GB total)

| Component | Target RAM |
|---|---|
| OS + Nginx | ~300MB |
| MySQL 8 | ~512MB |
| Platform (leadvix.io) | ~900MB |
| Tracking (track.leadtb.com) | ~280MB |
| Buffer | ~1GB |

PM2 limits are set in `ecosystem.config.js`:
- Platform: `max_memory_restart: 1200M`, Node heap `--max-old-space-size=768`
- Tracking: `max_memory_restart: 384M`, Node heap `--max-old-space-size=256`

## MySQL tuning (optional)

Add to `/etc/mysql/mysql.conf.d/low-memory.cnf`:

```ini
[mysqld]
innodb_buffer_pool_size = 256M
max_connections = 50
```

## Build on 4GB server

1. Enable swap: `sudo SWAP_SIZE=1G bash deploy/setup-swap.sh`
2. Build sequentially: `bash deploy/build-low-memory.sh`
3. Do **not** run both `next build` processes at the same time.

Build order: tracking first (lighter), then platform.

## Nginx virtual hosts

```bash
sudo cp deploy/nginx/platform.conf /etc/nginx/sites-available/leadvix.io
sudo cp deploy/nginx/tracking.conf /etc/nginx/sites-available/track.leadtb.com
sudo ln -sf /etc/nginx/sites-available/leadvix.io /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/track.leadtb.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## PM2

```bash
npm ci
npm run db:push
bash deploy/build-low-memory.sh
pm2 start ecosystem.config.js
pm2 save
```

## Environment

Copy `.env.example` to both apps:

```bash
cp .env.example apps/platform/.env
cp .env.example apps/tracking/.env
```

Set:
- `NEXT_PUBLIC_PLATFORM_URL=https://leadvix.io`
- `NEXT_PUBLIC_TRACKING_URL=https://track.leadtb.com`
- Same `DATABASE_URL` and `INTERNAL_SERVICE_TOKEN` in both apps

## Domains

| Domain | Service | Port |
|---|---|---|
| leadvix.io | Platform | 3000 |
| track.leadtb.com | Tracking | 3001 |

See [SERVICE-ARCHITECTURE.md](./SERVICE-ARCHITECTURE.md) for API boundaries.
