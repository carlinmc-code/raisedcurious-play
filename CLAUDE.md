# RaisedCurious Play (play.raisedcurious.com)

Kids' physics arcade: hub (index.html) + one folder per game + shared/kit.js|kit.css.
Plain HTML/JS/CSS, no framework, no build. Push to main -> Cloudflare Pages auto-deploys
(project: raisedcurious-play). Never add analytics, ads, logins, or external data calls.

## Audience & design rules (non-negotiable)
- Primary playtester is a 4-year-old. Zero reading required, no fail states, no scores.
- Every piece/tool must behave PREDICTABLY so pieces chain into contraptions.
- Tools are STICKY: select once, use repeatedly. Never add one-per-pick friction.
- Every interaction reacts within ~100ms with motion + a soft synth sound (Sound in kit.js).
- Reward moments are visual physics (fountains, confetti, launches), never text.

## Engineering lessons already paid for (do not relearn)
1. matter.js forces MUST be mass-scaled: gravity is a mass-scaled force, so fans/magnets
   need Body.applyForce with m.mass factors (see marbles fan/magnet).
2. Bounces: never rely on restitution for static pads; matter skips low-speed contacts
   ("resting"). Use zone-based scripted launches with per-marble cooldowns (see trampoline).
3. Apertures/gaps must be sized to the passing body: >= 1.5x diameter (funnel is 1.75x).
4. drawEmoji SIGNATURE IN THIS REPO:
     drawEmoji(ctx, emoji, x, y, size, angle, alpha, flip)
   The 7th argument is OPACITY. Passing a flip flag there sets globalAlpha to a
   boolean, false becomes 0, and the thing draws perfectly invisibly with no
   error. Six live call sites did exactly that (invisible bees, an invisible
   bear, invisible sparkles in three games) until 2026-08-23. `flip` is 8th.
   (wiggle-world2 uses a DIFFERENT signature without ctx - never copy calls between repos.)
5. iOS ignores user-scalable=no: zoom guards live in shared/kit.js (gesturestart etc).
   Never remove them. UI controls get touch-action: manipulation.
6. Trays overflow-x scroll; test layouts at 390px width (iPhone) and 1024px (iPad).

## Offline (the whole site works with no network)
- sw.js + offline-manifest.js + manifest.webmanifest make this an installable
  app that can be saved in full (~500 KB) from the button on the hub.
- REGENERATE THE MANIFEST when files are added, removed, or a ?v= changes:
    node scripts/precache.js
  It fails quietly if you forget - the site still works online, and only the
  plane-mode download is stale. That is exactly why it is in the checks below.
- Pages are network-first, assets cache-first, so an online visitor always gets
  today's HTML and can never be stuck on a cached site.
- matter.js is served from shared/matter.min.js, NOT a CDN. Six games will not
  start without it and a game that needs the internet to open defeats the point.
- NEVER request a NEW path on play.raisedcurious.com before its deploy has
  landed. Cloudflare answers unknown paths with the site's 200-fallback HTML
  and caches THAT against the path for four hours, and does not reconsider when
  the real file arrives. It cost matter.js on the live site: six games were
  served HTML where they expected a library. Check new files on the deployment's
  own *.pages.dev URL, which has no zone cache.
- Because of the above, scripts/precache.js stamps the site version onto sw.js,
  offline-manifest.js, matter.min.js and the icons, so every deploy lands on a
  URL the edge has never seen. That also removes the 4h lag on worker updates.

## Required checks before any push
- node --check every inline <script> (extract it) and shared/kit.js.
- Audit drawEmoji: first arg must be ctx AND the 7th must be numeric opacity,
  never a boolean or a comparison. A wrong 7th argument is silent and invisible.
- New game: add a hub tile in index.html (gradient style matching neighbors) same commit.
- Serve locally (python3 -m http.server) and load the changed game once before pushing.
- node scripts/precache.js    (regenerates the offline manifest)
- node scripts/checkversions.js  (every page must ask for the SAME ?v= of a
  shared file; they drifted once and only some games got the new build)
- Every game gets a wordless first-run finger guide: kit games call Kit.guide([...])
  right after Kit.init, toy games pass `coach:` to boot(). Steps are fractions of
  the play area, so they hold at any screen size. A new game without one is a bug.

## Deploy
Commit to main with a short imperative message. Cloudflare deploys in ~1 min.

CACHE-BUSTERS ARE REQUIRED FOR SHARED SCRIPTS. Cloudflare Pages honours the
Cache-Control in _headers for HTML only; every JS/CSS response is served with
its own `public, max-age=14400` regardless of what _headers says (checked
against /assets/toy.js, /marblerun/game.js and /shared/kit.js). So an HTML
page revalidates but the script it pulls in can be four hours stale.

That matters because assets/toy.js is one shared runtime behind ten games: a
returning visitor can get today's game.js against a four-hour-old shell. When
you change assets/toy.js or assets/toy.css, bump the ?v= on the import in
EVERY game that uses it, in the same commit:
  grep -l "assets/toy.js" */game.js | wc -l   # must equal the number you bumped
shared/kit.js is versioned the same way. A per-game game.js is cached for
the same four hours, so when you change one, version its <script src> too
or the device that already played it keeps the old build.
assets/common.js, behind the 11 standalone science games, is still
unversioned - version it the first time you change it.
