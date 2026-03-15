
---------- Latest Version ----------

# Complete Deployment Guide for Multiple Full-Stack Projects on a Single VPS
This guide covers setting up two separate project environments (Project A and Project B) on a single VPS. Each project consists of a **Web Frontend** (Main Domain), a **Dashboard** (Subdomain), and a **Server/API** (Subdomain), with separate PostgreSQL databases and shared or separate Redis instances.

---

## 1. Domain Configuration (Namecheap)
For each project, you need to point your domain and subdomains to your VPS IP.

### Project A (e.g., example-a.com)
1. **Main Web:** Add an `A Record` for `@` pointing to `YOUR_VPS_IP`.
2. **Dashboard:** Add an `A Record` for `dashboard` pointing to `YOUR_VPS_IP`.
3. **API/Server:** Add an `A Record` for `api` pointing to `YOUR_VPS_IP`.

### Project B (e.g., example-b.com)
1. **Main Web:** Add an `A Record` for `@` pointing to `YOUR_VPS_IP`.
2. **Dashboard:** Add an `A Record` for `dashboard` pointing to `YOUR_VPS_IP`.
3. **API/Server:** Add an `A Record` for `api` pointing to `YOUR_VPS_IP`.

---

## 2. Server Initial Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y curl git build-essential nginx python3

# Install NVM & Node.js (v22.12.0)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22.12.0
nvm alias default 22.12.0
```

---

## 3. Database & Redis Setup
### Install PostgreSQL 17
```bash
# Add PostgreSQL 17 repository
sudo apt install -y curl ca-certificates
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
sudo sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'

# Update and install Postgres 17
sudo apt update
sudo apt install postgresql-17 -y
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Create Databases and Users
We will create separate databases for Project A and Project B.
```bash
sudo -u postgres psql

# In the psql prompt:
CREATE DATABASE project_a_db;
CREATE USER project_a_user WITH PASSWORD 'your_password_a';
GRANT ALL PRIVILEGES ON DATABASE project_a_db TO project_a_user;

CREATE DATABASE project_b_db;
CREATE USER project_b_user WITH PASSWORD 'your_password_b';
GRANT ALL PRIVILEGES ON DATABASE project_b_db TO project_b_user;

\q
```

### Install Redis 7.0.15
```bash
# Add Redis official repository for latest versions
curl -fsSL https://packages.redis.io/gpg | sudo gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/redis.list
sudo apt update

# Install Redis
sudo apt install redis-server -y
# To verify version: redis-server --version

sudo systemctl start redis-server
sudo systemctl enable redis-server
```
*Note: BullMQ will use this Redis instance. If you need isolation, you can use different prefixes in your code or different Redis DB indices (0 and 1).*

---

## 4. Project Structure on VPS
Organize your folders to keep projects distinct:
```bash
sudo mkdir -p /var/www/project-a
sudo mkdir -p /var/www/project-b
sudo chown -R $USER:$USER /var/www/
```

### Deploy Project A
1. **Servers/Frontends:** Clone your repos into `/var/www/project-a/web`, `/var/www/project-a/dashboard`, and `/var/www/project-a/server`.
2. **Environment Files:**
   - **Server A `.env`:**
     ```env
     NODE_ENV=production
     PORT=5001
     CORS_ORIGINS=https://example-a.com,https://dashboard.example-a.com
     # DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DB_NAME?schema=public"
     DATABASE_URL="postgresql://project_a_user:your_password_a@localhost:5432/project_a_db?schema=public"
     COOKIE_DOMAIN=example-a.com
     
     # Redis - Use same host, but DIFFERENT DB indices for isolation
     # Redis has 16 databases (0-15). Project A uses index 0, Project B uses index 1.
     REDIS_HOST=127.0.0.1
     REDIS_PORT=6379 
     REDIS_DB=0
     ```
   - **Web A `.env.local`:** `NEXT_PUBLIC_API_URL=https://api.example-a.com/api/v1`
   - **Dashboard A `.env.local`:** `NEXT_PUBLIC_API_URL=https://api.example-a.com/api/v1`

### Deploy Project B
Repeat the steps with Project B values:
- **Server B `.env`:** PORT `5002`, `CORS_ORIGINS=https://example-b.com...`, `DATABASE_URL=...project_b_db`, `COOKIE_DOMAIN=example-b.com`.
- **Server B Redis:** Set `REDIS_DB=1` to keep it separate from Project A.
- **Web B Port:** `3001` (internal) / **Dashboard B Port:** `3002` (internal).
- **Web B `.env.local`:** `NEXT_PUBLIC_API_URL=https://api.example-b.com/api/v1`
- **Dashboard B `.env.local`:** `NEXT_PUBLIC_API_URL=https://api.example-b.com/api/v1`

---

## 5. PM2 Process Management
Register all 6 applications (2 Webs, 2 Dashboards, 2 Servers).

```bash
sudo npm install -g pm2

# Project A
cd /var/www/project-a/server && npm install && npm run build && pm2 start dist/server.js --name "a-server" --env PORT=5001
cd /var/www/project-a/web && npm install && npm run build && pm2 start npm --name "a-web" -- start -- -p 3000
cd /var/www/project-a/dashboard && npm install && npm run build && pm2 start npm --name "a-dashboard" -- start -- -p 3001

# Project B
cd /var/www/project-b/server && npm install && npm run build && pm2 start dist/server.js --name "b-server" --env PORT=5002
cd /var/www/project-b/web && npm install && npm run build && pm2 start npm --name "b-web" -- start -- -p 3002
cd /var/www/project-b/dashboard && npm install && npm run build && pm2 start npm --name "b-dashboard" -- start -- -p 3003

pm2 save
pm2 startup
```

---

## 6. Nginx Configuration
We need separate server blocks for each domain and subdomain.

```bash
sudo nano /etc/nginx/sites-available/multi-projects
```

Paste the following (Update domain names and ports):
```nginx
# --- Project A ---
server {
    listen 80;
    server_name example-a.com;
    location / { proxy_pass http://localhost:3000; include proxy_params; }
}
server {
    listen 80;
    server_name dashboard.example-a.com;
    location / { proxy_pass http://localhost:3001; include proxy_params; }
}
server {
    listen 80;
    server_name api.example-a.com;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location /api { proxy_pass http://localhost:5001; include proxy_params; }
}

# --- Project B ---
server {
    listen 80;
    server_name example-b.com;
    location / { proxy_pass http://localhost:3002; include proxy_params; }
}
server {
    listen 80;
    server_name dashboard.example-b.com;
    location / { proxy_pass http://localhost:3003; include proxy_params; }
}
server {
    listen 80;
    server_name api.example-b.com;
    location /api { proxy_pass http://localhost:5002; include proxy_params; }
}
```

Enable the config:
```bash
sudo ln -s /etc/nginx/sites-available/multi-projects /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 7. SSL Certificate (Certbot)
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d example-a.com -d dashboard.example-a.com -d api.example-a.com -d example-b.com -d dashboard.example-b.com -d api.example-b.com
```

---

## Important Clarifications: Why "localhost/127.0.0.1"?
1. **Connectivity**: Since your PostgreSQL and Redis are installed **on the same VPS** as your Node.js apps, they communicate internally via a "loopback" interface. Using `localhost` or `127.0.0.1` is faster and more secure than using the VPS public IP.
2. **Redis Security**: By default, Redis on Ubuntu listens *only* to `127.0.0.1`. This means it is invisible to the outside internet (hackers can't see it). Because it's locked down to internal access, a password is not strictly required by Redis, but you can set one in `/etc/redis/redis.conf` and add it to your `.env` for extra security.
3. **Database URL**: Just like Redis, `localhost:5432` tells your app to look for PostgreSQL on the same machine.

---

## Important Warnings & Tips
1. **Memory:** Two Next.js builds and two Node servers can consume significant RAM (at least 4GB-8GB recommended). If the build fails, add **Swap Memory**.
2. **CORS:** Ensure `CORS_ORIGINS` in your `.env` files includes the correct production domains (e.g., `https://example-a.com,https://dashboard.example-a.com`).
3. **Prisma:** Always run `npx prisma migrate deploy` in the server folder after cloning to update the production database schema.
4. **Firewall:** Ensure ports 80 and 443 are open (`sudo ufw allow 'Nginx Full'`).
5. **Logs:** Use `pm2 logs` to debug any crashes.