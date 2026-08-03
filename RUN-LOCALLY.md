# Running MNT Embark locally

Two ways to run it. Pick **A** if you want to reproduce what Coolify does
(recommended while the deployment is failing). Pick **B** for day-to-day
development with hot reload.

---

## A. Docker — identical to the Coolify build

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) running.

### 1. Create a `.env` file

In the project root, create a file named exactly `.env`:

```
POSTGRES_PASSWORD=localdevpassword
SESSION_SECRET=paste-a-long-random-string-here
ADMIN_PASSWORD=choose-an-admin-password
```

`SESSION_SECRET` can be any long random string. To generate one:

```powershell
# PowerShell
-join ((48..57) + (97..102) | Get-Random -Count 64 | % {[char]$_})
```

This file is gitignored — it will never be committed.

### 2. Build and start

```powershell
cd C:\Users\lapify\Downloads\Elite-Traveler\Elite-Traveler
docker compose up --build
```

The first build takes several minutes (it downloads dependencies and native
binaries). Leave this window open — it streams the logs.

**If the build fails, the error is in this output.** Copy the last ~30 lines.

### 3. Create the database schema

The app starts before the tables exist, so create them once. In a **second**
terminal:

```powershell
cd C:\Users\lapify\Downloads\Elite-Traveler\Elite-Traveler
$env:DATABASE_URL="postgres://mnt:localdevpassword@localhost:5432/mnt_embark"
pnpm install
pnpm --filter @workspace/db run push
```

(Use the same password you put in `.env`.)

### 4. Open it

<http://localhost:8080> — the site.
<http://localhost:8080/admin/login> — admin panel, using `ADMIN_PASSWORD`.

### Useful commands

```powershell
docker compose logs -f app     # follow app logs
docker compose restart app     # restart just the app
docker compose down            # stop everything (keeps data)
docker compose down -v         # stop and DELETE the database + uploads
docker compose up --build      # rebuild after code changes
```

---

## B. Native — hot reload for development

Requires Node 24+, pnpm 10, and a PostgreSQL database. The quickest way to get
Postgres is to start just that container:

```powershell
docker compose up -d db
```

### 1. Install and configure

```powershell
cd C:\Users\lapify\Downloads\Elite-Traveler\Elite-Traveler
pnpm install
Copy-Item .env.example .env
```

Edit `.env` and set:

```
DATABASE_URL=postgres://mnt:localdevpassword@localhost:5432/mnt_embark
SESSION_SECRET=any-long-random-string
ADMIN_PASSWORD=choose-an-admin-password
```

### 2. Create the schema

```powershell
pnpm --filter @workspace/db run push
```

### 3. Run both halves

Two terminals:

```powershell
# Terminal 1 — API on :8080
pnpm --filter @workspace/api-server run dev
```

```powershell
# Terminal 2 — frontend on :5173, proxies /api to :8080
pnpm --filter @workspace/mnt-embark-web run dev
```

Open <http://localhost:5173>. Edits to frontend files reload instantly.

---

## Troubleshooting

**`docker compose` says SESSION_SECRET is not set**
The `.env` file is missing, misnamed (`.env.txt` is a common Windows mistake),
or not in the project root. Check with `Get-ChildItem -Force .env`.

**App container starts then immediately exits**
Almost always a missing environment variable. `DATABASE_URL`, `SESSION_SECRET`
and `ADMIN_PASSWORD` are all required — the server deliberately refuses to start
without them. Run `docker compose logs app` to see which one.

**`relation "tours" does not exist`**
The schema was never pushed. Do step 3 above.

**Port 8080 or 5432 already in use**
Something else is using it. Either stop that program, or change the left-hand
number in the `ports:` entry in `docker-compose.yml` (e.g. `'8081:8080'`).

**Search returns fewer relevant results than expected**
Semantic ranking is disabled by default (it needs ~400 MB of ML dependencies
that are excluded from the image). Search falls back to keyword matching. See
the README if you want to turn it on.

**Uploaded images disappear after `docker compose down -v`**
Expected — `-v` deletes the volumes. Use plain `docker compose down` to keep them.
