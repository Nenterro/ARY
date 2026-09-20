# ARY Downloader

A Sonarr/Jellyseerr-style front end for ARY Plus dramas: browse the catalogue,
request episodes, and monitor a series so new episodes download automatically
into the Jellyfin library. React + Vite frontend, a Python service on the home
server doing the indexing and the downloading.

ARY took their dramas off YouTube, which is why this exists.

## Where things live, and how they ship

Two halves, two completely separate deployment paths. Confusing them is how a
fix gets written, tested, committed — and never actually goes live.

### Frontend — this repo

Everything here is frontend: `src/`, `public/`, `index.html`, the Vite and
Vercel config.

- Worked on locally, on the dev machine.
- Committed and pushed to **`main`** on GitHub.
- **Vercel builds `main` and nothing else.** Pushing to `main` is the deploy.

Work on a branch if you like, but nothing is live until it reaches `main`.

### Backend — the home server only

The Python service does not live here and is not in version control. It lives
at `~/Docker/ary-downloader/backend` on the home server, is a service in
`~/Docker/docker-compose.yml`, and is edited in place over SSH.

It needs the Jellyfin library bind-mounted to write into, so it cannot
usefully run anywhere but that machine.

**Do not add backend code to this repo.** `/backend/` is in `.gitignore` for
that reason — the same split the solar app uses, for the same reason: one
service with two copies and nothing keeping them in step is worse than none.

A backend change is not live until the container restarts. Pushing to GitHub
does nothing for it.

## Working on the backend

The SSH address, paths and commands are in **`CLAUDE.local.md`**, gitignored
because this repo is public. If it is missing — fresh clone, different machine
— ask rather than guessing.

The backend directory is **bind-mounted** into the container, so Python
changes need only a restart:

```bash
cd ~/Docker && docker compose restart ary-downloader
```

`--build` is only for `requirements.txt` changes.

`ary.db` (SQLite: the catalogue index, jobs, monitors) sits in that same
bind-mounted directory, so it survives restarts and rebuilds.

## How it works

- **Catalogue** comes from one ARY endpoint that returns the whole browsable
  home layout — 34 rails, 228 real series after promo filtering, narrowed to
  **94 dramas** by the scope rule below.
- **Promo filtering** matters: ad slots, house promos and live channels sit in
  the same rails as real series. They are dropped by the absence of a poster,
  which turned out to be the only reliable discriminator. Do not filter on the
  word `LIVE` — real shows are named things like *Tamasha LIVE*.
- **Downloads** are plain yt-dlp against an unencrypted HLS playlist. The
  streams carry no DRM despite the app shipping a FairPlay code path.
- **Progress** is computed from yt-dlp's fragment counter, not its percentage.
  An HLS playlist has no Content-Length, so yt-dlp reports a flat `0.0%` for
  the entire download. Fragments are the only honest signal.
- **Monitors** come in two modes. `future` records the highest episode number
  at the moment it is switched on and only takes what comes after, so enabling
  one does not pull a 200-episode back catalogue by surprise. `all` takes
  everything not already on disk.
- **Files** land in the Jellyfin TV library using the existing Sonarr naming
  convention, written to a staging directory on the same filesystem and moved
  with an atomic rename so Jellyfin never indexes a partial file.
- **Posters** need `<meta name="referrer" content="no-referrer">` on the
  document. ARY's image CDN is hotlink-protected: no Referer or one from
  aryplus.tv is served, anything else gets a 403. It must be the document
  policy, not a per-`<img>` attribute, because the series hero paints its
  backdrop with a CSS `background-image` and CSS has no `referrerpolicy`.

## Catalogue scope — dramas only

`DRAMAS_ONLY=1` narrows the index to scripted drama series. Everything else ARY
carries — films, telefilms, trailers, OSTs, talk and game shows, cricket,
religious programming, live channels — is dropped at sync time. Set it to `0`
to index all 228 again.

Two fields do the work, and neither is named helpfully:

- **`seriesType`** separates the formats: `show` is episodic, `singleVideo`
  covers films, telefilms, trailers and OSTs, `programs` covers talk and game
  shows, `live` is a channel feed. Only `show` survives.
- **`genreId`** is a **list of genre names**, not an id.

Within `show`, the rule **excludes** by genre (`Sports`, `Religious`,
`Podcast`, `Biographies`, …) rather than requiring a literal `Drama` tag.
That is deliberate and was measured: requiring the tag keeps 92 titles but
silently loses *Main Tera* and *Pyare Afzal*, both genuine dramas that happen
to be tagged only `Romance`. Excluding instead keeps 94 and still drops all
the cricket and religious programming. **Do not "simplify" this back to an
inclusion rule.**

Two supporting details:

- `_walk_series` keeps the **richest** record per series. The same series
  appears in several rails at different levels of detail — the slider carries
  little more than an id and a title, while category rails carry `seriesType`
  and `genreId`. Taking the first one seen would leave the filter judging a
  stub with none of the fields it needs.
- `sync_catalog` **prunes** series the scope no longer covers, because sync
  otherwise only ever upserts and an earlier wider sync would linger forever.
  Monitored series and those with download history are kept regardless, so
  narrowing the scope never discards an active monitor or orphans a job row.

Rail filters need no maintenance: they are computed from what is stored, so
`MOVIES`, `PODCASTS`, `OST` and `SPORTS` disappeared on their own (34 → 22).

## Scheduling

Two APScheduler jobs, both on **cron triggers pinned to wall-clock times**:

| Job | When | Env |
|---|---|---|
| Monitor sweep | every hour, on the hour | `MONITOR_CRON_MINUTE` |
| Catalogue refresh | daily at 04:17 | `CATALOG_CRON_HOUR`, `CATALOG_CRON_MINUTE` |
| One-shot sweep after boot | 2 minutes after start | `MONITOR_STARTUP_DELAY_SECONDS` |

They were interval triggers until the cron switch, and that was a real bug
rather than a preference: **an interval trigger counts from process start**, so
every restart pushed the next run a full period into the future and a service
restarted often enough would never sweep at all. A monitor added and then
followed by a restart sat with `lastCheck: None` indefinitely. The boot sweep
closes the remaining gap between a restart and the next hour boundary.

Because two triggers can now call it, `check_monitors` is **non-reentrant** —
overlapping sweeps would race on the same episodes and trip the `UNIQUE`
constraint on `jobs.episode_id`, so a second caller steps aside and returns 0.
The times are logged on startup; grep the container log for `schedule:`.

## This repo

```bash
npm run dev
npx vite build
```

- The repo is **public**. No secrets, tokens, internal addresses or
  server-side config in committed files.
- The frontend reads the backend over HTTP/HTTPS — see `src/utils/api.js` for
  the candidate list and `CLAUDE.local.md` for the hostname and routing.

## A note on access

The backend ships **open**: `ARY_API_TOKEN` is empty, so every endpoint accepts
unauthenticated requests from anyone who can reach the port. That is a
deliberate choice — anyone with access to the site can do everything. The token
check is already wired through every write route, so setting `ARY_API_TOKEN` in
`~/Docker/.env` and restarting is all that is needed to close it later.
