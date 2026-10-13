# TRN — a personal training notebook

A complete, mobile-first training and nutrition app for one person. React, TypeScript, Vite, responsive dark-only CSS, and localStorage. No backend, account, API key, or paid service is required. Typography is bundled locally; there are no external font or image requests.

## Run locally

Use Node.js **22.12 or later** (Node 24 also works) and npm.

While the app is awaiting merge into `main`, clone the implementation branch with
`git clone --branch codex/trn-app https://github.com/rvbstr/trn.git`. The standard
commands below apply after the application has been merged into `main`.

```sh
git clone https://github.com/rvbstr/trn.git
cd trn
npm install
npm run dev
```

Open the address printed by Vite, with the `/trn/` path. The dev server binds to all interfaces; use your machine’s LAN address to test from a phone. The repository-local npm cache is ignored by Git, which also allows installation in restricted cloud workspaces.

```sh
npm run build
npm run preview
```

`npm run build` checks TypeScript and produces the static site in `dist/`. Preview serves that production build at `/trn/`. No server-side rendering or environment secrets are needed.

## Deploy to GitHub Pages

1. Push these application files and `package-lock.json` to **main** in **rvbstr/trn**.
2. In GitHub, open **Settings → Pages → Build and deployment → Source**, and select **GitHub Actions**.
3. Open **Actions → Deploy to GitHub Pages → Run workflow**, select **main**, and run it. Subsequent pushes to main deploy automatically.
4. The workflow installs with `npm ci`, runs the training/data tests, builds, uploads `dist/`, and deploys with the GitHub Pages environment. If that environment has an approval rule, approve its deployment in GitHub.
5. When the deployment succeeds, open **https://rvbstr.github.io/trn/**.

Vite’s default base is **`/trn/`**, matching this repository’s Pages path. All app assets, the manifest, and the service worker resolve inside that path. Tabs use local state instead of URL routes, so refreshing any screen does not need a Pages 404 fallback.

For a **different repository name**, change `base` in `vite.config.ts` to `'/your-repository/'`. For a **custom domain** or a user/organization root site, use `base: '/'`, or set `VITE_BASE: /` on the workflow’s build step. Configure the custom domain in Pages and add `public/CNAME` containing your domain if appropriate. Do not use `/` for a normal repository site. The manifest uses relative URLs and follows either base.

Deployment is configured in `.github/workflows/deploy.yml`. The repository owner must perform the GitHub settings change and push/run the workflow; a local build does not publish a site.

## Daily use

- **Today** answers what to do next. Workouts follow **A → B → C**, independent of weekdays. “Do tomorrow,” “Recovery day,” and “Move workout” preserve the next session; “Skip” intentionally advances to the next session and records the skip. After a completed workout, a recovery interval is suggested using your weekly frequency and optional preferred days. You can train sooner if recovered.
- **Daily practice** is logged separately, with three gentle routines. Posterior-pelvic-tilt observations enable pelvic control, active hip flexion, and gentle extensor work alongside shoulder/thoracic mobility. Choose a routine or use automatic rotation. Equipment and explicit movement exclusions filter the routine.
- **Start workout** lets you choose 20, 30, 45, or 60+ minutes, record optional readiness, and confirm mobility/ramp-up sets. Short sessions preserve the first three primary movements. Warm-up time is included; actual duration varies with pace, unilateral work, and rests. A/C include logged low-fatigue strict pull-up practice when appropriate and time allows.
- **Workout mode** records each set’s weight, reps (or seconds), optional RIR, and band assistance. Dumbbell weights are **per dumbbell**; unilateral reps are **per side**, and both sides must be completed before logging. Rest starts automatically; pause, add 15 seconds, or skip it. Set undo, exercise skipping, compatible substitution, session notes, and partial-session saving are supported. Minimize a workout to view the app, then resume it. An unfinished workout and absolute rest-timer deadline survive reloads. The total elapsed session timer includes time away from the app; correct duration in history if necessary.
- **Plan → Program** edits every session: ordering, exercise choice, sets, rep range, rest, RIR, optional superset pairing, and notes. Saving creates a program version. Workout history includes immutable exercise/prescription snapshots from the time of training, even after program changes. An ongoing workout keeps its original snapshot.
- **Plan → Cycle** starts, pauses, resumes, extends, ends early, restarts, duplicates, and archives cycles. A restart creates a new chapter and preserves the old one. Paused days freeze the current week and extend the expected finish date. Starting another cycle ends the active one after confirmation. Finish/discard an unfinished workout before changing cycles.
- **Cycle initialization** uses current performance, an optional short assessment, or manual starting strength. No true one-rep maximum is needed. New cycles can use previous feedback, current performance, your chosen emphasis, and saved equipment/preferences; duplication can preserve the source program. The week-by-week plan shows actual sets, ranges, rests, and RIR for every week.
- **Calendar & history** records workouts, mobility, recovery/moves, skips, and actual cycle starts/ends. Tap a session to correct weight, reps, RIR, assistance, date, duration, or notes.
- **Progress** tracks body weight, rep benchmarks, lift weights, external-load volume, measurements, and records, with 4-week through all-time chart ranges. Weight uses a 7-day moving average. Assisted pull-up charts compare the same band. Bodyweight is not converted into invented kilogram volume; external-load volume uses exactly the logged weight × reps and does not double dumbbell/unilateral entries.
- **Nutrition** offers a flexible daily meal structure or macro logging. Meals use ordinary foods and approximate portions. The initial male/35/187 cm/76 kg profile starts at **2,800 kcal and 152 g protein**; targets are editable. Estimates use Mifflin–St Jeor and an approximate activity factor. A three-week weight trend can suggest a 100-kcal adjustment, with adequate weigh-ins and training data. Applying a suggestion requires confirmation; targets never change automatically. Simple meal checks and macro entries are separate when switching modes.
- **Exercises** provides the complete reference and supports custom exercises, which become available in the editor.
- **Settings** edits profile/baselines, posture observations, goals/priorities, schedule, equipment, band labels/assistance, preferred/avoided movements, and pain notes. After saving changes, use **Program → Generate from saved settings** to apply them, or generate the next cycle. Recommendations filter explicit exclusions and available equipment, prioritize compatible favorites, and adapt volume to time/frequency. Free-text injury notes prompt a review; they do not diagnose conditions or automatically infer exclusions. Historical results remain intact.

## Initial program and progression

The app opens with the requested baseline and a complete **8-week Foundation cycle**. There is no fabricated completed-workout history. The initial weight and rep benchmarks are explicitly your provided baseline. Initial working weights are editable conservative starting suggestions, not tested strength records.

| Session                        | Main movements                                                  | Accessory/core work                                                        |
| ------------------------------ | --------------------------------------------------------------- | -------------------------------------------------------------------------- |
| A — Pull + chest + core        | Assisted pull-ups, one-arm DB row, DB floor press, dips         | Curls, captain’s-chair knee raises                                         |
| B — Legs + shoulders + posture | Stationary split squat, DB Romanian deadlift, standing DB press | Lateral raises, rear-delt raises, dead bugs                                |
| C — Upper-body hypertrophy     | Assisted pull-ups, dips, one-arm DB row                         | Lateral raises, hammer curls, overhead triceps extension, reverse crunches |

There are 2–3 working sets per movement, usually 35–45 minutes including warm-up, with optional accessory pairings. Strict practice starts with **two singles**, away from failure, at a current strict max of three. Assisted work supplies productive hypertrophy volume. Sessions keep legs, glutes, posterior chain, and different core functions alongside the upper-body emphasis. No machines, bench, squat rack, unsupported heavy lifts, or one-rep-max tests are prescribed.

Weeks 1–3 and 5–7 build gradually. Week 4 reduces each movement by one set (minimum one), with at least RIR 3. Week 8 also reduces fatigue and invites evaluation. Other cycle lengths use every fourth week for recovery and the final week for transition. Cycles use elapsed calendar weeks minus pauses; missed workouts do not erase progress or attach sessions permanently to dates.

The engine in `src/engine.ts` uses **double progression**: e.g. 18 kg for 12/11/10 becomes a target of 12/12/11. It suggests more load only after all prescribed sets reach the ceiling with recorded, adequate RIR and consistent weight. Missing RIR or hard sets do not trigger an automatic load increase. At the plate limit it suggests slower lowering, pauses, comfortable range, or a harder variation. Bands are compared separately; reduced assistance is a recommendation that you select explicitly. These are suggestions, never forced changes.

**RIR 2** means roughly two additional clean reps were possible. Compounds normally use 1–3 RIR, isolation 0–2, and technique work avoids repeated failure. Good technique is a user judgment; the app cannot assess movement remotely.

## Data and offline installation

All data lives in localStorage under **`trn.notebook.v1`**, scoped to the browser and site origin. There is no cloud sync. A different device/browser, private browsing, clearing site data, or moving to another domain will not automatically transfer records. Different Pages paths on the same origin share localStorage; use a different storage key for a separate independent copy.

Use **Settings → Data → Export all data** regularly. JSON includes profile, equipment, goals, preferences, all program versions/cycles, sessions/sets, the unfinished workout/timer, nutrition settings/meals/logs, weights, measurements, assessments, custom exercises, mobility, and scheduling events. **Import JSON backup** validates the format and references, previews the counts, and asks before replacing current data. Export first if merging would be needed; imports replace rather than merge. Unsupported/corrupt files are rejected. If existing storage cannot be read, the original is preserved and can be downloaded for recovery; if storage is full/unavailable, a visible warning asks you to export. Reset requires typing **RESET**.

The production site includes a manifest, icons, and a small service worker for an offline shell. On iPhone Safari, use **Share → Add to Home Screen**. Compatible desktop/Android browsers may offer an install action. Visit the production site online first and let it finish loading; subsequently loaded same-origin assets are cached. Offline navigation and logging work after caching. The worker uses network-first requests so normal online reloads receive deployed updates. Offline support is progressive enhancement; localhost development does not register the worker. Screen wake lock is used in workout mode when supported and permitted. Reload restoration, wake lock, storage lifetime, and installation depend on browser support; real iOS Safari testing is recommended alongside the supplied mobile Chromium checks.

## Verify changes

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Unit tests cover conservative progression, assistance separation, week-four/evaluation volume, pause accounting, sequential scheduling, short sessions, equipment/exclusion-aware generation, protein estimation, and full backup validation. Browser tests exercise iPhone-sized and desktop layouts, daily routine persistence, a complete logged workout, reload/rest restoration, history correction, cycle transitions, settings/program versions, meal/macro logging, backup restoration, invalid imports, and reset confirmation. The mobile profile uses Chromium emulation; it is not a claim of physical iPhone testing.

If system Chromium is already installed (as in the cloud development environment), avoid a browser download:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

Playwright starts its own Vite server on port 4173. Screenshots/traces are written under ignored `test-results/`. To run against a production preview, start `npm run preview -- --port 4173` first; the tests reuse it when not running in CI.

## Source layout

```text
src/types.ts           Separate reusable domain interfaces
src/data.ts            Exercises, daily routines, meals, initial profile/program
src/engine.ts          Scheduling, cycles, readiness, progression, nutrition
src/storage.ts         Validated JSON import/export and persistence
src/context.tsx        Shared application state API
src/App.tsx            Navigation and persistence lifecycle
src/components.tsx     Accessible reusable UI and SVG charts
src/screens/           Functional daily, workout, plan, cycle, history, progress,
                       nutrition, library, and settings screens
src/style.css          Mobile-first-responsive notebook design
public/                Manifest, icons, offline service worker
.github/workflows/     GitHub Pages deployment
e2e/                   Browser workflow tests
```

## Training scope

This is general fitness guidance, not medical treatment. Posture depends on strength, mobility, control, habits, and individual variation. No exercise permanently “fixes” posture or prescribes one universal pelvic position. The pelvic routines explore anterior tilt, posterior tilt, and a comfortable midpoint. Core flexion can intentionally rotate the pelvis during a specific exercise; it is not a recommendation to stay tucked all day. Abdominal visibility depends substantially on nutrition and body-fat level.

Stop or substitute movements for sharp or joint pain. Stop pelvic/back routines and seek appropriate professional assessment for radiating pain, numbness, tingling, or persistent low-back pain. Use stable equipment and manageable loads, keep verification and safety cues intact, and avoid repeated failure or unsupported maximal lifting.
