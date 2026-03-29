# CLAUDE.md — Read This EVERY Session Before Doing ANYTHING

## FIRST THING: Read HANDOFF.md

Before writing any code, read `HANDOFF.md` in this repo. It contains the full project history, known bugs, architecture, and critical rules. DO NOT SKIP THIS.

---

## THE GOLDEN RULE — Build & Preview on Devices

After ANY code changes, these commands must run IN ORDER before previewing on iPad/iPhone:

**For JS-only changes (UI, logic, API calls, bug fixes):**
```bash
git pull origin <your-assigned-branch>
npm install
npx expo export --platform ios
EAS_SKIP_AUTO_FINGERPRINT=1 eas update --branch preview --message "Description of changes"
```
This is FREE and INSTANT — no $2 build cost, no queue wait. The app picks up the update on next launch.

**For native changes (new expo packages, app.json plugin changes, SDK upgrades):**
```bash
git pull origin <your-assigned-branch>
npm install
npx expo export --platform ios
eas build --profile preview --platform ios
```
This costs $2 per build. Only needed when native code changes.

**How to tell which you need:**
- Changed `.ts`/`.tsx` files only? → `eas update` (free)
- Changed `package.json`, `app.json` plugins, or added native modules? → `eas build` ($2)
- Not sure? → `eas update` first. If the app crashes on launch, you need a full build

**Never skip `npm install`.** Missing dependencies cause cryptic build failures.
**Never skip `git pull`.** The user's local machine needs the latest code.
**Never skip `npx expo export`.** This tests the JS bundle LOCALLY for free. If it fails here, it WILL fail on EAS. Only proceed after seeing "Bundled" with no errors.

---

## CRITICAL PROJECT IDs — DO NOT CHANGE

After ANY merge or pull, verify these values in `app.json`:

```
owner:      "comfybear"          (NOT comfybear71)
projectId:  "418c0a46-e73f-42b1-b388-cb801ca7d798"  (NOT the slug name)
updates.url: "https://u.expo.dev/418c0a46-e73f-42b1-b388-cb801ca7d798"
```

If any of these are wrong, the build WILL fail and it WILL take hours to debug.

---

## OTA Updates (EAS Update) — Session 14+

EAS Update pushes JS-only changes over-the-air. No rebuild, no $2, no queue.

**For AI agents — after pushing JS-only changes, tell the user:**
1. `git pull origin <branch>`
2. `npm install`
3. `npx expo export --platform ios` ← FREE local test
4. `EAS_SKIP_AUTO_FINGERPRINT=1 eas update --branch preview --message "what changed"` ← FREE + instant
5. Relaunch the app — update downloads automatically

**IMPORTANT**: The FIRST preview build after this setup MUST be a full `eas build --profile preview --platform ios` to bake in `expo-updates`. After that, all JS changes can use `eas update`.

**Update channels:**
| Channel | Build Profile | Purpose |
|---------|--------------|---------|
| `preview` | `eas build --profile preview` | Device testing (QR install) |
| `production` | `eas build --profile production` | App Store / TestFlight |
| `development` | `eas build --profile development` | Dev client |

---

## Git Rules

- **Work on your assigned branch** — check the task description for the branch name. NEVER push to `main`.
- **Always stash before merging** if there are local changes.
- **Always use `origin/` prefix** when merging remote branches.
- Run `npm install` after every pull/merge.
- **After ANY merge or pull, scan for conflict markers** — run `grep -r "<<<<<<" src/` on your local machine. If ANY results appear, the merge was not fully resolved. Fix them before building. Unresolved conflict markers cost $4 in failed EAS builds (Session 8).
- **NEVER run `eas build` without testing locally first** — run `npx expo export --platform ios` and confirm it says "Bundled" with zero errors.

---

## Code Rules

- NEVER use dummy/fake/mock data — all data comes from real APIs
- NEVER import `usePhantomDeepLink` — it crashes the app (tweetnacl/bs58)
- NEVER use `Alert.prompt` for user input — use inline TextInput
- Always use `usePhantomWallet` hook (shared WalletContext)
- Always use SafeAreaProvider for content near screen edges
- Content generation (movies, news, ads, posters, heroes) is **Architect wallet only** — gated to `AEWvE2xXaHSGdGCaCArb2PWdKS7K9RwoCRV7CT2CJTWq`
- Chat has 5 moods: Playful, Serious, Scientific, Whimsical, Unfiltered (sends `chat_mode` to backend)
- Studio tab is only visible for the Architect wallet
- All video generation uses the same pipeline: screenplay → submit scenes → poll → stitch → publish
- All ads are **30 seconds** (3 x 10s clips). Grok Video API max is 15s per clip — NEVER send `duration > 15`
- Two-tier ad system: **Tier 1** = platform promo ads (auto cron every 4h via `/api/generate-ads`), **Tier 2** = branded campaigns (paid placements injected server-side via `/api/admin/ad-campaigns`). The mobile app does NOT inject campaign prompts — the backend handles it automatically
- Ad posts in the feed have `post_type: "product_shill"` — show a "Promoted" badge for these
- Interactive ad generation uses 3-step flow: preview (`plan_only: true`) → submit → poll (`phase` field). NEVER skip polling — video gen takes 60-90s
- Do NOT call Grok video API directly for ads — always go through `/api/generate-ads`
- Do NOT hardcode product distribution ratios — they're in backend `constants.ts`
- Use `useGeneration()` hook for ALL content generation — it persists across tab navigation
- Autopilot mode lives in `GenerationContext.tsx` — do NOT duplicate its logic in screens
- Channel styles come from backend `content_rules.promptHint` — do NOT hardcode style overrides in frontend
- Channel generation config (genre, scene count, duration, director, music mode) comes from backend columns — do NOT hardcode overrides
- ALL content distribution MUST include Instagram — use `ALL_SOCIAL_PLATFORMS` constant from `api.ts` (`["x", "tiktok", "instagram", "facebook", "youtube"]`) for all `target_platforms` / `platforms` params. NEVER hardcode platform arrays — always spread the constant
- Instagram requires server-side proxy (`/api/image-proxy`, `/api/video-proxy`) — blob.vercel-storage.com URLs don't work with Instagram Graph API. The backend handles this automatically when `"instagram"` is in the platforms list

---

## Key Architecture

```
Provider hierarchy (App.tsx):
  SafeAreaProvider → QuickActionContext → WalletProvider → GenerationProvider → App

Content generation flow:
  GenerationContext.tsx (engine) ← ContentStudioScreen.tsx (UI) / HomeScreen.tsx (chat triggers)

Content pipeline (all video types):
  1. POST /api/admin/screenplay → scenes[]
  2. POST /api/test-grok-video (per scene) → requestId
  3. GET  /api/test-grok-video (poll 10s) → done/failed
  4. PUT  /api/generate-director-movie → finalVideoUrl + social spread

Autopilot (GenerationContext.tsx):
  startAutopilot() → picks random content type → runs generation → waits 30s → repeats
  Weighted: 35% channels, 20% movies, 15% news, 15% ads, 8% posters, 7% heroes
```

**Key files**: `src/hooks/GenerationContext.tsx` (1,618 lines — all generation logic + autopilot), `src/screens/ContentStudioScreen.tsx` (2,966 lines — all Studio UI), `src/services/api.ts` (1,333 lines — all 65+ API functions)

---

## Build Profiles

| Profile | Command | Cost | Use for |
|---------|---------|------|---------|
| Preview | `eas build --profile preview --platform ios` | $2 | First install / native changes |
| Production | `eas build --profile production --platform ios` | $2 | App Store / TestFlight only |
| OTA Update | `EAS_SKIP_AUTO_FINGERPRINT=1 eas update --branch preview --message "..."` | FREE | JS-only changes (most changes) |

**NEVER use production profile for testing.**
**Prefer `eas update` over `eas build` for JS-only changes.**
**Always prefix `eas update` with `EAS_SKIP_AUTO_FINGERPRINT=1`** to avoid fingerprint errors.

---

## Registered Devices (both active)

- iPad: 00008132-001C105E3E85001C
- iPhone: 00008130-001E59D901C0001C
- Both in provisioning profile M2DSHAU6CX
- No need to register again — they're already done

---

## When the User Asks "How Do We Preview?"

**If the app is already installed (most of the time):**
1. `git pull origin <branch>`
2. `npm install`
3. `npx expo export --platform ios` ← **FREE local test. Must say "Bundled" with no errors**
4. `EAS_SKIP_AUTO_FINGERPRINT=1 eas update --branch preview --message "what changed"` ← **FREE + instant**
5. Relaunch the app — update downloads automatically

**If the app needs a fresh install (native changes or first time):**
1. `git pull origin <branch>`
2. `npm install`
3. `npx expo export --platform ios` ← **FREE local test. Must say "Bundled" with no errors**
4. `eas build --profile preview --platform ios` ← **$2 per build. Only when native changes**
5. Scan QR code on device

Do NOT guess. Do NOT suggest Expo Go. Do NOT forget any steps.
