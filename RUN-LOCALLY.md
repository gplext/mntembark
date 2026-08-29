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
COMPOSE_PROFILES=with-db
```

**Do not set `DATABASE_URL` here.** Inside Docker the database is reachable at
`db:5432`, not `localhost` — compose already fills that in for you. Copying the
`localhost` line out of `.env.example` gives you an app container that cannot
find its database. That line is for path B, where you run on the host.

`COMPOSE_PROFILES=with-db` is what actually starts Postgres. The `db` service
is behind a profile so that Coolify, which uses its own database resource, does
not start a second one. Without it, `docker compose up` brings up the app alone
and it fails to connect.

`SESSION_SECRET` can be any long random string. To generate one:

```powershell
# PowerShell
-join ((48..57) + (97..102) | Get-Random -Count 64 | % {[char]$_})
```

This file is gitignored — it will never be committed.

### 2. Build and start

```powershell
cd C:\Users\lapify\Downloads\mntembark-main-replit\mntembark-main
docker compose --profile with-db up --build
```

The first build takes several minutes (it downloads dependencies and native
binaries). Leave this window open — it streams the logs.

**If the build fails, the error is in this output.** Copy the last ~30 lines.

### 3. Create the database schema

The app starts before the tables exist, so create them once. In a **second**
terminal:

```powershell
cd C:\Users\lapify\Downloads\mntembark-main-replit\mntembark-main
$env:DATABASE_URL="postgres://mnt:localdevpassword@localhost:5432/mnt_embark"
pnpm install --frozen-lockfile
pnpm --filter @workspace/db run push:unsafe
```

(Use the same password you put in `.env`. Here `localhost` is right — you are
on the host, and compose publishes the database on port 5432.)

`push:unsafe` rather than `push`: `push` is deliberately disabled because
`drizzle-kit push` drops columns to make a database match the schema, which is
ruinous against real data. Against an empty local database there is nothing to
lose, so the unsafe variant is the correct tool here — and only here.

There is no `seed` script. The server seeds starter content itself on first
start, so the site has tours, destinations, categories and journals as soon as
the tables exist.

### 4. Open it

<http://localhost:8080> — the site.
<http://localhost:8080/admin/login> — admin panel, using `ADMIN_PASSWORD`.

### Useful commands

```powershell
docker compose logs -f app     # follow app logs
docker compose restart app     # restart just the app
docker compose down            # stop everything (keeps data)
docker compose down -v         # stop and DELETE the database + uploads
docker compose --profile with-db up --build   # rebuild after code changes
```

---

## B. Native — hot reload for development

Requires Node 24+, pnpm 10, and a PostgreSQL database. The quickest way to get
Postgres is to start just that container:

```powershell
docker compose --profile with-db up -d db
```

The `--profile with-db` is required — without it compose ignores the `db`
service entirely and reports that there is nothing to do.

### 1. Install and configure

```powershell
cd C:\Users\lapify\Downloads\mntembark-main-replit\mntembark-main
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
pnpm --filter @workspace/db run push:unsafe
```

(`push` is disabled on purpose — see the note in path A.)

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

**Any database command fails or hangs**
`drizzle-kit push` hides the real error behind a spinner. Run this instead —
it reports exactly what is wrong (bad password, closed port, wrong host,
missing database) without printing your password:

```powershell
pnpm --filter @workspace/db run check
```

**`relation "tours" does not exist`**
The schema was never pushed. Do step 3 above.

**Site loads but every list is empty**
The schema exists but there is no content. Seeding runs automatically when the
server starts, so restart the app (`docker compose restart app`) now that the
tables exist, and check `docker compose logs app` for a seeding error. Failing
that, add entries through the admin panel.

**Port 8080 or 5432 already in use**
Something else is using it. Either stop that program, or change the left-hand
number in the `ports:` entry in `docker-compose.yml` (e.g. `'8081:8080'`).

**Search returns fewer relevant results than expected**
Search is keyword matching over the tour title, description, location and
itinerary. There is no semantic/vector ranking — it was removed along with the
355 MB machine-learning runtime it required.

**Uploaded images disappear after `docker compose down -v`**
Expected — `-v` deletes the volumes. Use plain `docker compose down` to keep them.
