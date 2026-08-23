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
4. drawEmoji SIGNATURE IN THIS REPO: drawEmoji(ctx, emoji, x, y, size, angle, alpha).
   (wiggle-world2 uses a DIFFERENT signature without ctx - never copy calls between repos.)
5. iOS ignores user-scalable=no: zoom guards live in shared/kit.js (gesturestart etc).
   Never remove them. UI controls get touch-action: manipulation.
6. Trays overflow-x scroll; test layouts at 390px width (iPhone) and 1024px (iPad).

## Required checks before any push
- node --check every inline <script> (extract it) and shared/kit.js.
- Audit: grep 'drawEmoji(' - first arg must be ctx in every call in this repo.
- New game: add a hub tile in index.html (gradient style matching neighbors) same commit.
- Serve locally (python3 -m http.server) and load the changed game once before pushing.

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
shared/kit.js has the same exposure and is currently unversioned.
