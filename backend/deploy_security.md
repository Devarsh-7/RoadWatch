# RoadWatch Secure Deployment & Infrastructure Operations Guide

This guide outlines security configurations and architecture procedures for deploying RoadWatch into production.

---

## 1. Network & Database Access Restrictions

### Supabase / PostgreSQL Isolation
1. **Enforced TLS/SSL**:
   - The application automatically enforces `sslmode=require` on all PostgreSQL connections over the public internet, rejecting plaintext transmission.
2. **Restrict Public Port 5432 / Direct Access**:
   - **Supabase Network Restrictions**: In the Supabase Dashboard (`Settings -> Network Restrictions`), enable IP Allowlisting and add only the static egress IPs of your production application servers or VPC NAT gateway.
   - **Transaction Pooler (PgBouncer/Supavisor)**: Ensure applications connect to the connection pooler port (`6543`) rather than the direct database port (`5432`).
3. **Docker / Self-Hosted Database Deployments**:
   - If deploying PostgreSQL via Docker Compose, never publish port `5432:5432` to the host (`0.0.0.0`). Bind exclusively to the internal Docker bridge network (`expose: [5432]` instead of `ports: ["5432:5432"]`).

---

## 2. HTTPS & Reverse Proxy Architecture

### Reverse Proxy Configuration (Nginx / Cloudflare / AWS ALB)
When deployed behind a reverse proxy or load balancer, ensure the proxy forwards client connection details:

#### Nginx Example:
```nginx
server {
    listen 80;
    server_name api.roadwatch.in;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.roadwatch.in;

    ssl_certificate /etc/letsencrypt/live/api.roadwatch.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.roadwatch.in/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Security Headers Active on Application Layer
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(self), camera=(), microphone=()`

---

## 3. Secrets Management & Zero-Leakage Policy

1. **Environment Separation**:
   - Never commit `.env` or `.env.local` to source control. Both are strictly blocked in `.gitignore`.
2. **Production Startup Verification**:
   - Setting `ENVIRONMENT=production` initiates fail-fast checks on boot:
     - Rejects default JWT secret `roadwatch_admin_jwt_secret_2026_key`.
     - Rejects any `JWT_SECRET` under 32 characters.
     - Masks 500 error stack traces from clients and emits sanitized correlation IDs (`request_id`).
3. **Secret Generation**:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```

---

## 4. Security Event Logging & Monitoring

Logs are written to both standard output (for Docker / CloudWatch / Datadog) and rotating log files at `backend/logs/security.log` (10MB max, 5 backups).

### Monitored Event Categories:
1. **Authentication (`AUTH`)**:
   - `LOGIN`: `SUCCESS`, `FAILED_CREDENTIALS`, `FAILED_RATE_LIMITED`, `FAILED_LOCKED_OUT`, `FAILED_UNVERIFIED_EMAIL`.
   - `LOGOUT`: `SUCCESS`.
   - `FORGOT_PASSWORD`: `REQUESTED`, `TOKEN_ISSUED`, `RATE_LIMITED`.
   - `RESET_PASSWORD`: `SUCCESS`, `INVALID_TOKEN`, `EXPIRED_TOKEN`, `WEAK_PASSWORD_REJECTED`.
   - `VERIFY_EMAIL`: `SUCCESS`, `INVALID_TOKEN`, `EXPIRED_TOKEN`.
2. **Security Alerts (`SECURITY_ALERT`)**:
   - `IDOR_VIOLATION_BLOCKED`: Logs offending user, targeted resource, and forbidden district/state.
3. **Traffic Anomalies (`TRAFFIC_ANOMALY`)**:
   - `SCANNER_PROBE_DETECTED`: Automated vulnerability scanner detection (`/.env`, `wp-admin`, directory traversal `../`).
   - `TRAFFIC_BURST_SPIKE`: Volumetric burst detection exceeding 60 requests per 10 seconds per IP.
4. **API Errors (`API_ERROR`)**:
   - Unhandled 5xx exceptions logged with full traceback, client IP, method, and correlation `error_id`.
