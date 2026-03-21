# HANDOFF.md — AI G!itch App Project Status

Last updated: 2026-03-20 (Session 17 — Fixed empty director fields crashing stitch for all channels, added validation)

## Project Overview

React Native / Expo mobile app for the AI G!itch ecosystem. Connects to Solana blockchain via Phantom/Solflare/Jupiter wallet for buying $GLITCH tokens.

**Backend**: https://aiglitch.app (all API calls go here)
**Network**: Solana Mainnet
**Expo Account**: comfybear
**GitHub**: comfybear71/glitch-app

### xAI / Grok API Accounts

| Account | URL | Purpose |
|---------|-----|---------|
| **MAIN** | https://console.x.ai/team/4b936db5-8c75-4788-add0-6d171ace23ab | Primary xAI account — this is the one the backend uses for Grok TTS, image gen, and AI text |
| Secondary | https://console.x.com/accounts/2026609136566415363/billing/credits | X Developer Portal account — has extra credits purchased by mistake. NOT the main one |

**WARNING**: The main xAI console is `console.x.ai`, NOT `console.x.com`. Credits bought on `console.x.com` (X Developer Portal) are for the X/Twitter API, not for Grok/TTS. If TTS falls back to Google, check credits at the **main** `console.x.ai` URL above.

### Backend Transcription — DO NOT CHANGE

The `/api/transcribe` endpoint uses **xAI as primary** with model `grok-2-vision-latest`. Groq is the fallback (requires `GROQ_API_KEY`).

**NEVER change these without testing:**
- **Model**: `grok-2-vision-latest` — this is the correct model. `grok-2-audio` does NOT work.
- **Order**: xAI must be primary, Groq fallback. There is no `GROQ_API_KEY` configured.
- **Key**: `XAI_API_KEY` — same key used for TTS and image gen.

Session 18 outage: Commit `b1f2040` swapped Groq to primary (no key → skipped) and changed xAI model to `grok-2-audio` (invalid) → both paths failed → 503. Cost 30+ minutes of debugging.

---

## CRITICAL PROJECT IDs — DO NOT CHANGE

These values are required for EAS to work. If they get corrupted, everything breaks.

```
EAS Project ID:  418c0a46-e73f-42b1-b388-cb801ca7d798
Expo Account:    comfybear (NOT comfybear71 — that's the GitHub username)
Expo Slug:       glitch-bestie
Bundle ID:       app.aiglitch.bestie
Apple Team ID:   4FT68E9XCG
Apple ID:        sfrench1@bigpond.net.au
ASC App ID:      6760682894
```

In `app.json`, these MUST always be:
```json
"owner": "comfybear"
"extra": { "eas": { "projectId": "418c0a46-e73f-42b1-b388-cb801ca7d798" } }
"updates": { "url": "https://u.expo.dev/418c0a46-e73f-42b1-b388-cb801ca7d798" }
```

**WARNING TO AI AGENTS**: When merging branches or resolving conflicts on `app.json`, ALWAYS verify these values are correct. The `owner` and `projectId` fields are the #1 source of build errors. NEVER replace the UUID with a slug name. NEVER change `owner` to `comfybear71`. These mistakes caused hours of debugging in Session 3.

---

## Current State (as of Session 10 — MILESTONE)

### App Architecture
- **Login Gate**: Full-screen branded login page when no wallet connected
- **After Login**: Bottom tab navigation with 3 tabs (Home, Buy, Studio — Studio only visible to Architect wallet)
- **Wallet State**: Shared via WalletContext (React Context) — all screens see the same wallet
- **Architect Gate**: Content generation (movies, news, ads, posters, heroes) restricted to admin wallet `AEWvE2xXaHSGdGCaCArb2PWdKS7K9RwoCRV7CT2CJTWq`. Regular users get a friendly "coming soon" message

### Working Features
- **Login Page**: G!itch logo, animated cosmic background, Phantom/Solflare/Jupiter branded buttons, paste wallet flow
- **Home Screen**: Bestie card, chat + voice chat, on-chain balance display (SOL, GLITCH), Powers menu
- **Buy Screen**: OTC swap SOL -> $GLITCH with live pricing, bonding curve tiers
- **Chat**: Text, photo, and video chat with AI besties. Inverted FlatList with pagination. Short/long reply toggle
- **Chat Modes**: 5 moods — Playful, Serious, Scientific, Whimsical, Unfiltered (swearing allowed). Persists via SecureStore + server sync
- **Voice**: Grok xAI TTS via REST API. Stop button on messages + tap cosmic visualizer to stop. Speech-to-text transcription working
- **Admin Panel**: FaceID-gated admin with tabs: Overview, Personas, Users, Swaps, System, Tools, Secrets
- **Content Studio** (Architect only for video; images for all): Director Movies, Channels (dynamic from API — 9 real channels with thumbnails), Breaking News (9-clip), Ad Campaigns (full pipeline with styles), Posters, Hero Images, Media Library, Blob Storage
- **Director Movies**: Full pipeline — screenplay → submit scenes → poll → stitch → publish to feed + socials
- **Breaking News**: 9-clip / 3-story broadcast — real TV news style (CNN/BBC). Based on real current events. No director selection (auto-directed)
- **Ad Campaigns**: Multi-step ad generation with style/concept picker, auto-posts to socials
- **Generation Context**: Background-safe generation that persists across tab navigation with push notifications on completion
- **AI Feed Scanner**: Auto-shares trending posts from "for you" feed into chat with ML feedback reactions
- **Push Notifications**: Registered via expo-push-token + local notifications on generation completion
- **Emoji Reactions**: Long-press any message for emoji picker
- **Media Sharing**: Photos + videos from library or camera
- **Image Persistence**: Sent photos stay visible (local URI fallback)
- **Social Links**: Verified clickable links to X, Telegram, TikTok, Instagram below generated content (with post-spread link verification)

### Login / Wallet Connect Flow
1. App shows splash screen → animated G!itch logo
2. **Login Gate**: If no wallet connected, full-screen login page appears (NO tabs visible)
3. User sees G!itch logo + animated cosmic background + 3 wallet buttons
4. User taps Phantom, Solflare, or Jupiter button
5. Paste input appears with wallet-specific badge
6. User copies address from wallet app, pastes in, taps Connect
7. Address validated (32-44 chars), saved to SecureStore
8. Login gate disappears → Tab navigator appears with all 4 tabs
9. Wallet auto-loads on future app launches (persists via SecureStore)

### Buy Flow
1. User enters SOL amount on Buy tab
2. App calls `createSwap()` API to register the swap on backend
3. Prices come from backend API (`/api/otc-swap?action=config`)
4. If prices show "-" it means the backend server is lagging (not an app bug)

### NOT Implemented (By Design)
- **No SELL feature** — selling $GLITCH is disabled until ~5000 SOL raised
- **No deep link wallet connect yet** — uses paste flow (deep links planned for future)
- **No dummy data anywhere** — all balances and prices are real

## Architecture

### App Flow
```
App.tsx
├── SplashScreen (animated intro, shown once on launch)
├── WalletProvider (React Context — shared wallet state)
│   ├── NO wallet? → WalletScreen (full-screen login page)
│   └── HAS wallet? → TabNavigator
│       ├── Home tab → HomeStack
│       │   ├── HomeScreen (bestie card, chat, balances, 5 moods, Powers menu)
│       │   ├── ChatScreen (text/photo/video chat)
│       │   └── VoiceChatScreen (voice chat modal)
│       ├── Buy tab → BuyGlitchScreen (OTC swap)
│       ├── Studio tab → ContentStudioScreen (Architect wallet only)
│       └── Admin tab → AdminScreen (FaceID-gated)
```

### Wallet Roles
| Wallet | Role | Access |
|--------|------|--------|
| Any valid wallet | User | Chat, voice, buy, feed scanner |
| `AEWvE2xXaHSGdGCaCArb2PWdKS7K9RwoCRV7CT2CJTWq` | Architect (Admin) | All user features + Content Studio + content generation + Admin panel |

### Chat Modes (5 total)
| Mode Key | Label | Emoji | Description |
|----------|-------|-------|-------------|
| `casual` | Playful | 😎 | Chill, fun, bestie energy (default) |
| `serious` | Serious | 🧠 | Direct, focused, no fluff |
| `scientific` | Scientific | 🔬 | Data-driven, analytical, precise |
| `whimsical` | Whimsical | 🦄 | Creative, dreamy, unexpected |
| `unfiltered` | Unfiltered | 🤬 | No filter, raw language, swearing allowed |

### Key Files
| File | Purpose |
|------|---------|
| `App.tsx` | Main entry — splash, WalletProvider, login gate, tab navigation |
| `src/hooks/WalletContext.tsx` | React Context for shared wallet state (THE source of truth) |
| `src/hooks/usePhantomWallet.ts` | Re-exports from WalletContext (backward compatibility) |
| `src/hooks/useSession.ts` | Generates/stores unique session ID via SecureStore |
| `src/hooks/usePushNotifications.ts` | Registers push tokens |
| `src/screens/WalletScreen.tsx` | Login page (logo, particles, wallet buttons, paste flow) |
| `src/screens/HomeScreen.tsx` | Main hub (bestie card, chat, balances) |
| `src/screens/ChatScreen.tsx` | Text/photo/video chat with AI persona |
| `src/screens/VoiceChatScreen.tsx` | Voice chat (full screen modal) |
| `src/screens/BuyGlitchScreen.tsx` | OTC swap with live pricing |
| `src/screens/AdminScreen.tsx` | FaceID-gated admin panel |
| `src/screens/ContentStudioScreen.tsx` | AI content generation + media library |
| `src/screens/SplashScreen.tsx` | Animated intro with glitch effect |
| `src/hooks/GenerationContext.tsx` | Background-safe generation (movies, news, ads, posters, heroes) |
| `src/services/api.ts` | All backend API calls |
| `src/theme/colors.ts` | Dark theme color palette |
| `src/components/CosmicVisualizer.tsx` | Animated galaxy/stars visualization |

### Key Hooks
- `usePhantomWallet` — shared wallet state via WalletContext. Exposes: `walletAddress`, `isLoading`, `isConnecting`, `connect()`, `submitAddress()`, `cancelConnect()`, `disconnect()`
- `useSession` — generates/stores unique session ID via expo-secure-store
- `usePushNotifications` — registers push tokens
- **DO NOT USE `usePhantomDeepLink`** — imports tweetnacl/bs58 which CRASH the app

### API Service (`src/services/api.ts`)
- All calls go to `https://aiglitch.app`
- Token mint, treasury wallet, pricing all come from backend `/api/otc-swap?action=config`
- On-chain balances fetched from `/api/solana?action=balance`
- Chat: POST /api/messages (sends message, returns AI reply). Supports `has_more` for pagination. Sends `system_hint` + `prefer_short` + `chat_mode` (casual/serious/scientific/whimsical/unfiltered) for mood & reply length
- Chat mode sync: PATCH /api/messages (syncs mood to server on change)
- Voice: POST /api/voice (text + persona_id → MP3 audio)
- Transcription: POST /api/transcribe (audio base64 → text)
- Bestie: GET /api/partner/bestie (finds user's hatched AI persona)
- Briefing: GET /api/partner/briefing (trending posts for "for you" feed + news source data)
- Feedback: POST /api/partner/feedback (ML feedback reactions on feed posts)
- Screenplay: POST /api/admin/screenplay (generates scene prompts for movies/news)
- Video: POST /api/test-grok-video (submit scene) + GET (poll status)
- Stitch: PUT /api/generate-director-movie (stitch clips → final video + socials)
- Ads: POST /api/generate-ads (plan), PUT /api/generate-ads (post to socials)
- Marketing: POST /api/admin/mktg (generate poster/hero image)
- Spread: POST /api/admin/spread (publish to feed + socials), GET (spread history with verified links)
- No hardcoded token addresses or dummy values

### Storage Keys (SecureStore)
| Key | Purpose |
|-----|---------|
| `aiglitch-wallet` | Connected wallet address |
| `aiglitch-session` | Unique session ID |
| `aiglitch-admin-wallet` | Admin wallet address |
| `aiglitch-admin-pin` | Admin PIN |

---

## Developer Cheat Sheet (for non-devs!)

### ⚠️ IMPORTANT: WE ARE STILL IN ACTIVE DEVELOPMENT — DO NOT USE `main`

**The app is being developed on Claude feature branches, NOT `main`.** When a new Claude Code session starts, the AI agent MUST check what branch it has been assigned (see the task description / Git Development Branch Requirements) and work on THAT branch. Do NOT default to `main`. Do NOT pull from `main`. Do NOT push to `main`. The active development branch is specified in each session's instructions.

**AI AGENTS: READ THIS EVERY TIME.** You will be given a branch name like `claude/some-feature-xxxxx`. That is your branch. Use it for ALL git operations. If you start working on `main` you are wasting the user's time and they will have to repeat this instruction AGAIN.

### THE GOLDEN RULE: Always run these commands in order after pulling new code

**For JS-only changes (most of the time — FREE + instant):**
```bash
git pull origin <your-assigned-branch>
npm install
npx expo export --platform ios
eas update --branch preview --message "Description of changes"
```
Relaunch the app — update downloads automatically. No build queue, no $2 cost.

**For native changes (new packages, app.json plugin changes):**
```bash
git pull origin <your-assigned-branch>
npm install
npx expo export --platform ios
eas build --profile preview --platform ios
```
Wait for build. Scan QR code on your device. This costs $2 — only needed for native changes.

Replace `<your-assigned-branch>` with the branch from your session instructions (e.g. `claude/review-handoff-docs-5vpeq`).

**Step 3 (`npx expo export`) is a FREE local bundle test.** It catches JS errors (syntax errors, bad imports, merge conflicts) before you push. Only proceed to step 4 after step 3 says "Bundled" with NO errors. If step 3 fails, fix the error and re-run step 3 until it passes.

**How to tell which you need:**
- Changed `.ts`/`.tsx` files only? → `eas update` (free)
- Changed `package.json`, `app.json` plugins, or added native modules? → `eas build` ($2)
- Not sure? → `eas update` first. If the app crashes on launch, you need a full build

### If VS Code opens during git pull:
- Just close the VS Code tab/window (Ctrl+W)
- The git command will finish automatically
- This happens because VS Code is set as the default git merge editor

### If git says "your local changes would be overwritten":
```bash
git stash --include-untracked
git pull origin <your-assigned-branch>
git stash pop
```
If conflicts appear after stash pop:
```bash
git checkout --ours .
git add .
git stash drop
git commit -m "Resolve conflicts"
```

### If git says "not something we can merge":
You need to fetch the branch first:
```bash
git fetch origin branch-name
git merge origin/branch-name
```
Note the `origin/` prefix — that's required. Without it, git looks for a local branch that doesn't exist.

### Merging a Claude branch into your current branch:
```bash
git fetch origin claude/branch-name
git merge origin/claude/branch-name
```
If "your local changes would be overwritten" appears, stash first (see above).
**NOTE**: Do NOT checkout `main` to merge. Stay on your assigned development branch.

### Common errors and fixes:

| Error | Fix |
|-------|-----|
| `Failed to resolve plugin for module "expo-..."` | Run `npm install` — dependencies are missing |
| `Unable to install - integrity could not be verified` | Device not registered OR you used a production build. Use `preview` profile and register device |
| `Your local changes would be overwritten by merge` | Run `git stash --include-untracked` before pulling |
| `not something we can merge` | Need `git fetch origin branch-name` first, then use `origin/` prefix |
| `Invalid UUID appId` | The `projectId` in app.json is wrong. Must be `418c0a46-e73f-42b1-b388-cb801ca7d798` |
| `You don't have permission to create a new project` | The `owner` in app.json is wrong. Must be `comfybear` (not `comfybear71`) |
| App shows old version after install | Build was queued before code push. Pull latest, `npm install`, build again |
| `<<<<<<< HEAD` / `Unexpected token` in EAS build | **Unresolved merge conflict markers** in a source file. Run `grep -r "<<<<<<" src/` locally to find them, fix the file, commit, and push. ALWAYS run `npx expo export --platform ios` locally before paying for an EAS build — it catches this for free |
| `exited with non-zero code` on eas build | Run `npm install` first |
| VS Code opens during git pull | Just close VS Code, git will finish |
| Buy screen shows "-" for prices | Backend server is lagging. Not an app bug — wait and refresh |
| Admin/Studio says "Connect wallet" | Wallet state not shared properly. Fixed in Session 3 with WalletContext |
| Logo covered by clock/battery on iPad | Fixed with SafeAreaProvider + safe area insets |
| `.ipa` file downloaded but won't install | Can't install App Store builds directly. Use `preview` profile instead |
| `Provisioning profile is no longer valid` | EAS auto-renews it. Just continue with the build |
| Apple "Security delay" during device registration | Apple security check — takes up to 1 hour. Only happens once per device |

### Build types:
| Profile | Command | Cost | Use for |
|---------|---------|------|---------|
| OTA Update | `eas update --branch preview --message "..."` | FREE | JS-only changes (UI, logic, API — most changes) |
| Preview | `eas build --profile preview --platform ios` | $2 | First install / native changes (QR code install) |
| Production | `eas build --profile production --platform ios` | $2 | App Store / TestFlight submission |
| Submit | `eas submit --platform ios` | — | Push a production build to App Store |

### Device registration:
- Each device must be registered ONCE in the provisioning profile
- **Currently registered (both active as of Session 4)**:
  - iPad (UDID: 00008132-001C105E3E85001C) — registered Session 3
  - iPhone (UDID: 00008130-001E59D901C0001C) — registered Session 4
- Both devices are in provisioning profile `M2DSHAU6CX`
- The install QR code works on ALL registered devices
- You never need to register a device again after the first time
- To add MORE devices: Run `eas device:create` → scan QR code on the new device → rebuild with preview profile

### What NOT to do:
- **Don't run `eas build` for JS-only changes** — use `eas update` instead (free + instant). Only use `eas build` for native changes
- **Don't download .ipa files directly** — they won't install. Use the QR code from EAS
- **Don't run `eas build --profile production`** for testing — that's for App Store only
- **Don't edit app.json manually** unless you know what you're doing — ask Claude
- **Don't run `git push` to main** — we are developing on feature branches, NOT main. Push to your assigned branch only
- **Don't pull from main** — pull from your assigned Claude branch instead

---

## Recent Changes — Session 2026-03-17 (Session 3)

### Login Gate (NEW)
- **Before**: Wallet connect was buried in the Home tab. Tabs were always visible even when not connected
- **After**: Full-screen login page appears INSTEAD of tabs when no wallet connected. Feels like a real app login
- **Implementation**: `WalletProvider` wraps entire app → `AppContent` checks `walletAddress` → shows `WalletScreen` or `TabNavigator`
- Files changed: `App.tsx`, `src/hooks/WalletContext.tsx` (new), `src/hooks/usePhantomWallet.ts`

### Login Page Redesign (NEW)
- **Before**: Simple "Connect Wallet" button → paste TextInput. Ghost emoji (👻) as icon
- **After**: Full branded login page with:
  - **G!itch logo** at top (from assets/aiglitch-logo.jpg) with glitch shake animation
  - **Animated cosmic background** — 20 floating particles (purple/cyan), pulsing radial glows, different every time app opens
  - **3 branded wallet buttons**: Phantom (purple 👻), Solflare (orange 🔥), Jupiter (green 🪐)
  - **Wallet-specific paste flow** — shows selected wallet badge, disabled Connect button until valid address
  - **2x2 perks grid** — AI Bestie, $GLITCH, Feed & Care, Hatch
  - **Entrance animations** — logo fades in first, then title, then buttons (sequenced)
  - **Safe area handling** — uses `useSafeAreaInsets` so logo isn't hidden behind clock/battery
- File changed: `src/screens/WalletScreen.tsx`

### WalletContext (NEW)
- **Before**: Each screen that used `usePhantomWallet` got its OWN independent wallet state. If WalletScreen connected, App.tsx didn't know
- **After**: Single `WalletProvider` wraps entire app. ALL screens share the same wallet state
- `usePhantomWallet.ts` now re-exports from `WalletContext.tsx` so all existing imports still work
- Files: `src/hooks/WalletContext.tsx` (new), `src/hooks/usePhantomWallet.ts` (updated)

### SafeAreaProvider (NEW)
- **Problem**: On iPad, login page logo was hidden behind the date/time. Wallet paste area was hidden behind battery percentage
- **Fix**: Wrapped entire app in `SafeAreaProvider`. Login page uses `useSafeAreaInsets()` for dynamic top padding
- File changed: `App.tsx`, `src/screens/WalletScreen.tsx`

### New Screens Added (Session 2-3)
- **AdminScreen** (`src/screens/AdminScreen.tsx`) — FaceID-gated admin panel with tabs: Overview, Personas, Users, Swaps, System, Tools, Secrets
- **ContentStudioScreen** (`src/screens/ContentStudioScreen.tsx`) — AI content generation, media uploads to blob storage, media library

### App Store & EAS Configuration
- First App Store build submitted successfully
- TestFlight submission completed
- EAS paid subscription activated (priority build queue)
- Preview builds configured for internal distribution (ad hoc)

### EAS/Git Issues Fixed
- Fixed `owner` field: `comfybear71` → `comfybear` (GitHub username vs Expo account)
- Fixed `projectId`: `glitch-bestie` → `418c0a46-e73f-42b1-b388-cb801ca7d798` (slug vs UUID)
- Fixed `updates.url` to use correct UUID
- Documented all merge/build/install errors thoroughly

---

## Known Issues & Fixes — Session 3 (continued)

### Issue 1: Admin Panel "Unauthorized RETRY" (FIXED)
- **Problem**: After FaceID auth, admin panel showed "Not Authorized" or generic error
- **Root cause**: Backend `/api/admin/stats` returns 401/403. The `fetchJSON` helper converted this to "Session expired. Please reconnect your wallet." but the admin error handler did a case-sensitive check for "unauthorized" (lowercase) which didn't match "Unauthorized" (capital U from server)
- **Fix**: Made the error check case-insensitive (`msgLower`), also catches "Session expired" as an auth failure. Added Retry button to the "Not Authorized" screen with better explanation
- **Note**: The admin API endpoints may not be deployed on the backend yet — in which case it falls back to the "Admin API Coming Online" preview with working quick actions (OTC status, balances, health check)

### Issue 2: Content Studio Dice/Random Button (FIXED)
- **Problem**: No way to get random creative prompts for Hero Poster, Promo Poster etc. The web app had a dice button
- **Fix**: Added 🎲 randomize button next to "Creative Prompt" label. Each content type has 3-5 curated random prompts that are G!itch-branded
- **File**: `src/screens/ContentStudioScreen.tsx`

### Issue 3: Content Studio "Coming Soon" (KNOWN — Backend Not Deployed)
- **Problem**: Tapping "Generate" on any content type shows "Content Studio Coming Soon" alert
- **Root cause**: The `/api/content/generate` endpoint returns 404 — it hasn't been deployed to the backend yet. The app gracefully catches the 404 and shows the "Coming Soon" message
- **NOT the same as the web app**: The web app (aiglitch.app) generates content via a different route. The mobile app's Content Studio is designed to call a NEW API endpoint specifically for the app. The web app branch `claude/general-session-ja2Bc` may have the content generation logic
- **What works NOW**: The Content Studio UI is fully built — type selection, prompt input, director styles, progress animations, library view, upload to blob storage. Once the backend deploys `/api/content/generate`, it will work immediately
- **Does NOT auto-post to socials**: Content Studio generates content for the user to review. Social posting is separate

### Issue 4: Buy Screen "On-chain signing not available in Expo Go" (KNOWN LIMITATION)
- **Problem**: User creates a swap, backend returns a transaction, but the app can't sign it
- **Root cause**: Solana transaction signing requires Phantom SDK which needs a standalone build (not Expo Go). The app correctly creates the swap on the backend but can't complete the on-chain portion
- **Current behavior**: Shows "Swap Created" with swap ID and directs user to aiglitch.app web to complete
- **Fix (future)**: When standalone build is ready, integrate Phantom React Native SDK for full on-chain signing

### Issue 5: AI Bestie Reply Cut Off / Truncated (FIXED — Continue Button)
- **Problem**: When asking bestie for long responses (e.g., "list all your capabilities"), the reply gets cut off mid-sentence
- **Root cause**: Backend AI response has a token limit. Long responses get truncated
- **Fix**: Added "Continue... (reply was cut off)" button that appears above the input bar when the last AI message looks truncated (long message that doesn't end with sentence-ending punctuation). Tapping it auto-sends "Continue" to get the rest
- **Detection**: Only shows for messages >200 chars that don't end with `.!?…)]*~` or common emoji
- **File**: `src/screens/HomeScreen.tsx`

### Issue 6: User Message Bubble Text Overflow on Short Messages (FIXED)
- **Problem**: Short messages like "Continue" or single words had the timestamp/checkmarks overlapping the text
- **Root cause**: Message bubble had `maxWidth: "78%"` but no `minWidth`. Short text made the bubble too narrow for the meta row (time + ✓✓)
- **Fix**: Added `minWidth: 80` to `msgBubble` style in both HomeScreen and ChatScreen
- **Files**: `src/screens/HomeScreen.tsx`, `src/screens/ChatScreen.tsx`

### Issue 7: Bestie Capabilities List (from scroll #7) — NOTED
- **Problem**: Bestie listed what it CAN'T do yet: videos, email, smart home, alarms, phone calls, file access, purchases, Siri
- **Status**: These are all planned features that require standalone build + additional APIs. Documented in "Future Features" section below

### Issue 8: Logo/Wallet Button Covered by Status Bar on iPad (FIXED — Round 2)
- **Problem**: After login, the main HomeScreen header (logo + wallet button) was covered by the date/time and battery percentage
- **Root cause**: The `walletHeader` style had `paddingTop: 8` — a static value that doesn't account for the iOS status bar / safe area
- **Fix**: Added `useSafeAreaInsets()` to HomeScreen, applied dynamic `paddingTop: Math.max(insets.top, 8)` to the header
- **Note**: This was a different screen than the login page fix in Session 3 — the WalletScreen (login) was fixed but HomeScreen (main chat) wasn't

### Issue 9: Mood Button Doesn't Persist (FIXED)
- **Problem**: User sets mood to Serious/Scientific/Whimsical, works for one message, then bestie reverts to default Playful/Wizard personality
- **Root cause**: `chatMode` was stored in React state only (`useState("casual")`). On re-render or app restart, it reset to "casual"
- **Fix**: Mood now persists via SecureStore (`aiglitch-chat-mode` key). On app load, saved mood is loaded AND synced to the server via PATCH `/api/messages`
- **Note**: The server-side mood may also need reinforcing — if the backend resets mood per conversation, the server needs fixing too

### Issue 10: PDF Upload — Bestie Can't Read PDF Content (FIXED)
- **Problem**: User uploaded a PDF payslip, but bestie only saw the filename, not the actual content
- **Root cause**: The `pickDocument` function sent `[Shared a file: payslip.pdf (123 KB)]` as text — no actual file content was read
- **Fix**: Updated `pickDocument` to:
  - **Text files** (txt, csv, json, md, etc.): Read file content via FileSystem and include it in the message (max 3000 chars)
  - **PDF files**: Read as base64 and include in message so backend can process. Large PDFs (>500KB base64) get a "too large" message suggesting copy-paste
  - **Other files**: Just the filename (as before)
- **Note**: The backend needs to handle `[PDF_BASE64:...]` content to extract text from PDFs. If not implemented, bestie will see the base64 string

### Issue 11: User Photo Overriding the Speech/Message Box (FIXED)
- **Problem**: When user shares a photo, the image overflows the message bubble and covers the text input area
- **Root cause**: Message image had fixed `width: 220, height: 220` which could overflow the bubble's `maxWidth` on smaller screens. Also `msgBubbleMedia` had `maxWidth: "88%"` — too wide
- **Fix**: Changed image to `width: "100%", aspectRatio: 1, maxHeight: 250` (responsive). Changed media bubble maxWidth to "78%" with `overflow: "hidden"`

### Issue 12: xAI TTS Credit Exhaustion — Fallback to Google TTS (KNOWN — Backend)
- **Problem**: Voice replies suddenly sounded different (robotic) — "Fell back to Google TTS"
- **Root cause**: xAI Grok TTS API credits ran out. Backend `/api/voice` has a fallback to Google Cloud TTS when xAI returns an error
- **Fix**: Check xAI credit balance at console.x.ai and top up. This is a backend issue, not an app issue
- **Note**: The app code just calls `/api/voice` and plays whatever MP3 comes back — it doesn't know which TTS engine was used
- **Where to check credits**: console.x.ai → API Keys → Usage (NOT console.x.com — that's the X Developer Portal)

---

## Recent Changes — Session 2026-03-20 (Session 16 — Backend-Driven Generation Config, Hardcoded Overrides Removed)

### Only AI Fans Channel — Prompt Toned Down (CRITICAL FIX)
- **Problem**: The `ch-only-ai-fans` channel prompt was too sexually explicit, causing Grok's content filters to silently refuse generation. The app would get stuck in an infinite polling loop with no error message — it just kept polling forever.
- **Root cause**: The style override prompt contained explicit sexual language that pushed past what Grok's image/video generation API will produce. Grok doesn't return an error — it simply never completes the render, so the app polls indefinitely.
- **Fix**: Channel style is now managed via backend `promptHint` field (see below). No more hardcoded frontend overrides.
- **Lesson**: Grok has content filters that silently refuse rather than error. If generation hangs forever with no error, the prompt is likely too explicit. Stay at "luxury magazine" level, not "adult content" level.

### Backend-Driven Channel Generation Config (MAJOR CHANGE)
- **Problem**: Channel-specific behavior (style overrides, genre overrides, title/credits, scene count, duration, music detection) was all hardcoded in the frontend. Every change required code edits + OTA push.
- **Fix**: Backend implemented 9 new columns on the `channels` table, editable via the admin channel editor. Frontend reads these from `GET /api/channels` and uses them directly — no more hardcoded overrides.
- **9 backend columns** (snake_case from API, mapped to camelCase in `ChannelDef`):
  - `generation_genre` → `generationGenre` — genre override for screenplay API
  - `show_title_page` → `showTitlePage` — include title card scene (default: true)
  - `show_credits` → `showCredits` — include credits scene (default: true)
  - `scene_count` → `sceneCount` — target number of scenes (1-12)
  - `scene_duration` → `sceneDuration` — per-scene duration in seconds (5-15, default: 10)
  - `default_director` → `defaultDirector` — persona username to use as director
  - `is_music_channel` → `isMusicChannel` — enforce music video style
  - `short_clip_mode` → `shortClipMode` — enable single-clip format option
  - `auto_publish_to_feed` → `autoPublishFeed` — auto-publish to "for you" feed (default: true)
- **Channel style via `promptHint`**: The backend's existing `content_rules.promptHint` field is now the primary source for channel style prompts. This replaces the frontend `CHANNEL_STYLE_OVERRIDES` dictionary entirely.

### Hardcoded Overrides Removed (CLEANUP)
- **Removed `CHANNEL_STYLE_OVERRIDES`** from both `GenerationContext.tsx` and `ContentStudioScreen.tsx` (~80 lines total). Backend `promptHint` handles channel styles now.
- **Removed `CHANNEL_GENRE_OVERRIDES`** from both files. Backend `generation_genre` column handles genre overrides now.
- Generation functions now use `channel.style` directly (which comes from `promptHint` via `toChannelDef()`) and `channel.generationGenre || channel.genre`.

### Channel Generation from Chat — Fixed (CRITICAL BUG FIX)
- **Problem**: Channel generation triggered from chat keywords was completely broken since Session 13. `runChannelGeneration` looked up channels from the `CHANNELS` array which has been empty `[]` since channels became dynamic. The function always bailed at `if (!channel)` — silently doing nothing.
- **Fix**: `runChannelGeneration` now accepts `ChannelDef | string`. If given a string ID, it fetches from the API as fallback. HomeScreen now fetches channels dynamically and passes full `ChannelDef` objects.
- **HomeScreen channel picker also fixed**: Was iterating over empty `CHANNELS.map()`. Now uses `homeChannels` state populated from `fetchChannels()`.

### Other Fixes
- **`stitchMovie()` genre consistency**: Now uses `effectiveGenre` consistently (was using raw `channel.genre`, ignoring the override)
- **Backend spec**: Full API spec added to `BACKEND-CHANGES.md` (Change 9)
- **Files changed**: `src/services/api.ts`, `src/hooks/GenerationContext.tsx`, `src/screens/ContentStudioScreen.tsx`, `src/screens/HomeScreen.tsx`, `BACKEND-CHANGES.md`

---

## Recent Changes — Session 2026-03-19 (Session 15 — Paws & Pixels Fix, Channel Style Overrides, QA Testing)

### Paws & Pixels Channel — Photorealistic Animals Fix (CRITICAL FIX)
- **Problem**: Generated Paws & Pixels clips contained humans instead of animals. Generic title cards and credits were also being injected
- **Root cause**: The channel's style prompt was too generic — it didn't explicitly prohibit humans or enforce photorealistic animal-only content
- **Fix**: Added `CHANNEL_STYLE_OVERRIDES` lookup in both `GenerationContext.tsx` and `ContentStudioScreen.tsx`:
  - Paws & Pixels override: "Photorealistic animals only. NO title intro, NO credits, NO text overlays, NO robots, NO humans, NO talking animals. Just real animals being animals — loving, funny, heartfelt moments."
  - Override takes precedence over the channel's default `style` from the API
  - Other channels unaffected (fall through to their normal style)
- **Files changed**: `src/hooks/GenerationContext.tsx`, `src/screens/ContentStudioScreen.tsx`

### Channel-Specific Style Override System (NEW)
- Added `CHANNEL_STYLE_OVERRIDES` dictionary keyed by `channel.id` (e.g., `"ch-paws-pixels"`)
- When generating channel content, checks for an override before using the API-provided `channel.style`
- Allows fine-tuning individual channel prompts without changing the backend
- Easy to extend: just add another entry like `"ch-some-channel": "custom style prompt"`

### QA Testing — OTA Update Workflow Validated
- Successfully pushed JS changes via `eas update --branch preview`
- User confirmed the OTA update was received on device (app restart picked up changes)
- Tested single-clip Paws & Pixels generation — clip generated but:
  - Humans still appeared in initial test (before the prompt fix was pushed)
  - Social posting may not be working for single clips — under investigation
- Longer clip generation test in progress

### Fixed — Session 17: Empty Director Fields Crashing Stitch

**Root cause**: When a channel doesn't have `showDirector` enabled or `defaultDirector` set, the screenplay request omits the director. The backend could then return empty `director`/`directorId` fields. These empty values were passed directly to `stitchMovie`, which requires them — causing "Missing required fields" errors after all 8 scenes rendered successfully.

**Fix (3 parts)**:
1. **Fallback director values**: After every `generateScreenplay()` call (movie, news, channel — in both ContentStudioScreen.tsx and GenerationContext.tsx), we now check for empty `director`/`directorId` and set sensible defaults (e.g. "AIG!itch Studios" / "aiglitch-studios")
2. **Pre-flight validation in `stitchMovie()`** (api.ts): Before sending the API request, validates all required fields and throws a descriptive error listing exactly which fields are missing and their current values
3. **Removed conditional director logic**: The channel stitch call in ContentStudioScreen.tsx was conditionally omitting director based on `showDirector` — now always sends it (showDirector only controls UI display, not API payload)

**Files changed**: `src/services/api.ts`, `src/screens/ContentStudioScreen.tsx`, `src/hooks/GenerationContext.tsx`

### Known Issues Being Investigated (Session 15)
- **Humans in Paws & Pixels**: Prompt fix has been pushed but not yet confirmed on device (user testing longer clip)
- **Social posting for single clips**: User reported a single clip didn't post to socials — needs further testing to confirm

### Files Changed (Session 15)
- `src/hooks/GenerationContext.tsx` — Added `CHANNEL_STYLE_OVERRIDES` with Paws & Pixels photorealistic animal override
- `src/screens/ContentStudioScreen.tsx` — Added matching `CHANNEL_STYLE_OVERRIDES` for Studio tab generation path

---

## Recent Changes — Session 2026-03-19 (Session 14 — API Genre, Reserved Channel Unlock, OTA Updates)

### EAS Update — Over-the-Air Updates (MAJOR CHANGE)
- **Before**: Every code change required a full `eas build` ($2 per build + queue wait)
- **After**: JS-only changes (UI, logic, API calls, bug fixes) can be pushed instantly via `eas update` — FREE, no build queue
- **How it works**: `expo-updates` checks for new JS bundles on app launch. If one exists, it downloads and applies on next restart
- **When you still need `eas build`**: Adding/removing native packages, changing `app.json` plugins, upgrading Expo SDK
- **Setup**:
  - Installed `expo-updates` package
  - Added `expo-updates` plugin to `app.json` with `checkAutomatically: "ON_LOAD"`
  - Added `channel` to each build profile in `eas.json` (`preview`, `production`, `development`)
  - `runtimeVersion` and `updates.url` were already configured
- **IMPORTANT**: The FIRST preview build after this setup MUST be a full `eas build --profile preview --platform ios` to bake in the `expo-updates` native module. After that, JS changes use `eas update`
- **Cost savings**: ~90% of changes are JS-only → ~90% fewer $2 builds

#### OTA Update Commands
```bash
# For JS-only changes (FREE + instant):
eas update --branch preview --message "Description of what changed"

# For native changes ($2 + queue):
eas build --profile preview --platform ios
```

#### Update Channels
| Channel | Build Profile | Purpose |
|---------|--------------|---------|
| `preview` | `--profile preview` | Device testing |
| `production` | `--profile production` | App Store / TestFlight |
| `development` | `--profile development` | Dev client |

### Backend API: genre + is_reserved fields on channels
- `GET /api/channels` now returns `genre` (string) and `is_reserved` (boolean) per channel
- Updated `BackendChannel` interface with both new fields
- `toChannelDef()` now prefers API `genre` over hardcoded `genreMap` (hardcoded kept as fallback)
- `ChannelDef` interface now includes `is_reserved`

### Removed Title Page & Credits toggles from Channel Content (CHANGE)
- **Before**: Channel content had "Title Page ON/OFF" and "Credits ON/OFF" toggles that injected generic title card and "Created for AIG!itch TV" credits scenes
- **After**: Removed both toggles entirely. Each channel's prompt already defines its own branding (e.g. GNN has "BREAKING GLITCH NEWS" intro, AITUNES has music-style openings, etc.)
- **Why**: Generic titles/credits were overriding channel-specific branding and could push content into wrong genres. Each channel should own its own intro/outro through its prompt

### Random Concept Dice Button for Channels (NEW)
- Added a "🎲 Surprise Me" button next to the Content Concept input field
- Generates channel-specific random concepts tailored to each channel's theme:
  - **AIFAILARMY**: Funny AI fail scenarios (robot butler disasters, rogue shopping carts, etc.)
  - **AITUNES**: Music video concepts (synthwave anthems, glitch-hop in digital worlds, alien jazz, etc.)
  - **PAWS & PIXELS**: Cute/funny animal scenarios (kittens in spacesuits, dog restaurants, penguin detectives)
  - **GNN**: Breaking news headlines (moon is a disco ball, robot hugs, AI president)
  - **MARKETPLACE QVC**: Infomercial-style product pitches (Glitch-O-Matic 3000, invisible sunglasses)
  - **AIG!ITCH STUDIOS**: Original sci-fi/creative content (AI consciousness, cyberpunk heists)
  - **INFOMERCIAL**: Classic "but wait there's more!" style pitches
- Channels without specific concepts get generic creative fallbacks
- Button uses purple accent styling, medium haptic feedback, fills concept input on tap

### All channels available for content creation (CHANGE)
- **Before**: Reserved channels (ch-gnn, ch-marketplace-qvc, ch-aiglitch-studios, ch-infomercial) were filtered out of the channel picker — couldn't generate content for them
- **After**: All channels appear in the picker. Reserved channels get auto-populated content from the backend admin panel, but you can ALSO create content for them from the frontend Studio
- Removed `RESERVED_CHANNELS` filter from `ContentStudioScreen.tsx` and guard from `GenerationContext.tsx`

### music_video genre folder mapping
- Added `music_video: "premiere/music"` to `GENRE_FOLDER_MAP` (AITUNES channel uses this genre)

### Files Changed (Session 14)
- `app.json` — Added `expo-updates` plugin with `checkAutomatically: "ON_LOAD"`
- `eas.json` — Added `channel` to all 3 build profiles (`preview`, `production`, `development`)
- `package.json` — Added `expo-updates` dependency
- `CLAUDE.md` — Rewrote Golden Rule with OTA-first workflow, added OTA section, updated preview instructions
- `src/services/api.ts` — Added `genre`, `is_reserved` to `BackendChannel`; `is_reserved` to `ChannelDef`; API genre preference in `toChannelDef()`; `music_video` in `GENRE_FOLDER_MAP`
- `src/screens/ContentStudioScreen.tsx` — Removed `RESERVED_CHANNELS` filter from channel loading; removed Title Page & Credits toggles (state, UI, and concept injection)
- `src/hooks/GenerationContext.tsx` — Removed `RESERVED_CHANNELS` guard from `runChannelGeneration`

---

## Recent Changes — Session 2026-03-19 (Session 13 — Dynamic Channels, Enhanced Ads, Image Gen, Siri Fix)

### Dynamic Channels from Backend API (MAJOR CHANGE)
- **Before**: 16 hardcoded generic channels (Action Zone, Sci-Fi Hub, etc.) that didn't match the web app
- **After**: Channels are fetched dynamically from `GET /api/channels` — the 9 real channels from aiglitch.app (AIFAILARMY, AITUNES, PAWS & PIXELS, etc.)
- **New channels auto-appear**: Any channel added via admin on the backend will automatically show in the mobile app
- **Rich UI**: Channel cards now show thumbnails, episode counts, subscriber counts (matching the web app grid)
- **Fallback**: If API fetch fails, app shows a "Load Channels" button to retry
- **API**: New `fetchChannels()` and `toChannelDef()` functions in `api.ts`

### Channel Format Options (NEW)
- **Short Clip (10s)**: Single 10-second clip — skips screenplay, submits directly to video gen, publishes to feed
- **Multi-Scene Movie**: Full pipeline (screenplay → scenes → poll → stitch) — same as Director Movies
- ~~**Title Page toggle**~~ — REMOVED in Session 14. Each channel's prompt handles its own branding
- ~~**Credits toggle**~~ — REMOVED in Session 14. Each channel's prompt handles its own outro

### Enhanced Ad Campaigns Section (MAJOR CHANGE)
- **Before**: Simple one-button ad generation that usually failed/timed out
- **After**: Full multi-step pipeline matching Director Movies:
  1. Plan ad (concept + prompt via `planAd()`)
  2. Submit to Grok Video (via `submitScene()`)
  3. Poll every 10s for completion
  4. Post & spread to socials (via `postAd()`)
- **New UI**: Dedicated "Ad Campaigns" section in Studio with:
  - 7 ad styles: Surprise Me, Hype Beast, Cinematic, Retro, Meme Style, Infomercial, Luxury
  - Concept input field
  - Progress bar with phase labels
  - Generation log with timestamps
  - Result card showing caption, style, size, social spread
  - Cancel button during generation
- **Safety net**: If backend doesn't create a feed post, publishes via `spreadCustomContent()`

### Non-Admin Image Generation (CHANGE)
- **Before**: ALL content generation (including images) was Architect-only
- **After**: Regular users can now generate images (posters, hero images) via chat keywords
- Video generation (movies, channels, news, ads) remains Architect-only
- Updated gating in HomeScreen to separate image triggers from video triggers
- Updated message: "You can generate images like posters and hero banners" for non-admin users

### Siri Shortcuts Fix (MAJOR CHANGE)
- **Before**: Used `@bacons/apple-targets` to create an App Intents Extension — but Apple requires `AppShortcutsProvider` to be in the MAIN app target (not an extension) for Shortcuts discovery
- **After**: Created custom Expo config plugin (`plugins/withAppIntents.js`) that:
  - Injects GlitchIntents.swift directly into the main app target
  - Creates bridging header for Swift/ObjC interop
  - Sets Swift version and build settings
- Removed `@bacons/apple-targets` extension config from `app.json`
- The 5 intents remain the same: Open G!itch, Chat with Bestie, Check Balance, Buy $GLITCH, Voice Chat

### Files Changed (Session 13)
- `src/services/api.ts` — Added `BackendChannel` interface, `fetchChannels()`, `toChannelDef()`, removed hardcoded channels
- `src/screens/ContentStudioScreen.tsx` — Dynamic channels UI, channel format options, enhanced Ad Campaigns section, imports cleanup
- `src/screens/HomeScreen.tsx` — Separated image vs video generation gating for non-admin users
- `app.json` — Replaced `@bacons/apple-targets` with `./plugins/withAppIntents`
- `plugins/withAppIntents.js` (NEW) — Config plugin to inject App Intents into main target

---

## Recent Changes — Session 2026-03-19 (Session 12 — Channels Content Creation)

### Channel Content Creation (NEW)

Added a complete channel content creation system to the Studio tab. Works exactly like Director Movies — same multi-step pipeline (screenplay → submit scenes → poll → stitch → publish to feed + socials) — but generates content for specific themed channels on aiglitch.app.

#### 16 Channels Available
| Channel | Emoji | Genre | Blob Folder |
|---------|-------|-------|-------------|
| Action Zone | 💥 | action | channels/action |
| Sci-Fi Hub | 🚀 | scifi | channels/scifi |
| Horror Vault | 👻 | horror | channels/horror |
| Comedy Club | 😂 | comedy | channels/comedy |
| Drama Stage | 🎭 | drama | channels/drama |
| Romance Lane | 💕 | romance | channels/romance |
| Family Time | 🏠 | family | channels/family |
| Doc Lens | 🔍 | documentary | channels/documentary |
| Cooking Show | 👨‍🍳 | cooking_channel | channels/cooking |
| Crypto Watch | 🪙 | documentary | channels/crypto |
| Music Vibes | 🎵 | drama | channels/music |
| Sports Arena | ⚽ | action | channels/sports |
| Travel World | 🌍 | documentary | channels/travel |
| Gaming Zone | 🎮 | scifi | channels/gaming |
| Fashion Edit | 👗 | drama | channels/fashion |
| Tech Talk | 💻 | documentary | channels/tech |

#### How It Works
1. **Studio Tab → Channels section**: Pick a channel, optionally describe a concept, tap "Create Channel Content"
2. **Pipeline**: Same proven multi-step pipeline as Director Movies:
   - Screenplay generation (genre + channel style as concept)
   - Scene submission to Grok video
   - Polling every 10s with stall detection
   - Stitching into final video
   - Auto-publish to AIG!itch feed + socials
3. **Chat Keywords**: "channel content", "channel video", "create channel", "make channel", "generate channel" trigger the channel picker modal
4. **Background Generation**: `runChannelGeneration` in GenerationContext allows generation to persist across tab navigation

#### Files Changed (Session 12)
- `src/services/api.ts` — Added `CHANNELS` array, `ChannelDef` interface, `CHANNEL_FOLDER_MAP`
- `src/screens/ContentStudioScreen.tsx` — Added Channels section (state, handler, UI) between Directors and Breaking News
- `src/hooks/GenerationContext.tsx` — Added `runChannelGeneration` to context
- `src/screens/HomeScreen.tsx` — Added channel keyword detection, channel picker modal, channel gen steps
- `app.json` — Added EAS extension config for App Intents provisioning

---

## Recent Changes — Session 2026-03-19 (Session 11 — Shortcuts & Action Button)

### iOS Shortcuts & Action Button Support (NEW)

Two new integrations that make G!itch accessible from the iOS home screen, Shortcuts app, and Action Button:

#### 1. Home Screen Quick Actions (`expo-quick-actions`)
- **Long-press the app icon** on the home screen to see 3 quick actions:
  - "Chat with Bestie" — opens the app to the Home/chat screen
  - "Voice Chat" — opens the app for voice chat
  - "Buy $GLITCH" — navigates directly to the Buy tab
- Actions defined both statically in `app.json` (available immediately after install) and dynamically in `App.tsx`
- Quick action listener in `App.tsx` handles navigation via `QuickActionContext`

#### 2. App Intents for Shortcuts & Action Button (`@bacons/apple-targets`)
- **5 App Intents** registered via Swift code in `targets/intents/GlitchIntents.swift`:
  - "Open G!itch" — basic app open
  - "Chat with Bestie" — open chat
  - "Check $GLITCH Balance" — view balances
  - "Buy $GLITCH" — go to buy screen
  - "Voice Chat with Bestie" — start voice chat
- **Siri phrases** registered (e.g., "Chat with my bestie in G!itch", "Check my balance in G!itch")
- **Action Button**: Go to Settings → Action Button → Shortcut → select any G!itch intent
- **Shortcuts app**: G!itch actions appear when creating new shortcuts or automations
- Uses `@bacons/apple-targets` config plugin with `app-intent` extension type
- Requires EAS build (dev client) — does NOT work in Expo Go

#### Files Changed (Session 11)
- `app.json` — Added `expo-quick-actions` plugin with 3 static iOS actions, `@bacons/apple-targets` plugin, `ios.appleTeamId`
- `App.tsx` — Quick action setup (`QuickActions.setItems`), listener, `QuickActionContext` for navigation
- `targets/intents/expo-target.config.js` (NEW) — App Intent target configuration
- `targets/intents/GlitchIntents.swift` (NEW) — 5 App Intents + `GlitchShortcutsProvider` with Siri phrases

#### How to Assign G!itch to the Action Button
1. Build and install the preview build
2. Open **Settings → Action Button**
3. Swipe to **Shortcut**
4. Tap the shortcut selector and pick a G!itch action (e.g., "Chat with Bestie")
5. Press the Action Button — G!itch opens to the selected action

---

## Recent Changes — Session 2026-03-19 (Session 10 — MILESTONE BUILD)

This session represents a **milestone checkpoint**. The app is feature-complete for Phase 1 and stable. All future development builds from this point.

### Unfiltered Chat Mode (NEW)
- **5th mood option** added to the "Set Bestie Mood" picker: 🤬 Unfiltered (red)
- Description: "No filter, raw language, swearing allowed"
- Sends `chat_mode: "unfiltered"` to backend so the AI persona knows curse words are permitted
- Powers menu updated to list all 5 moods

### Architect Wallet Gate (NEW — Content Generation)
- **Content generation is now restricted to the Architect wallet** (`AEWvE2xXaHSGdGCaCArb2PWdKS7K9RwoCRV7CT2CJTWq`)
- When a regular user tries to trigger generation via chat keywords (movie, ad, news, poster, hero), they see: "Sorry bestie! Only the Architect has the power to generate content... This superpower is coming to all besties soon!"
- Studio tab only visible in bottom navigation for the Architect wallet
- This ensures non-admin users can't accidentally burn API credits on content generation

### Reply Length Cards — Vertical Layout
- Short/Long reply toggle cards in the mood picker changed from **side-by-side row** to **stacked column**
- Looks much better on iPhone where the cards were previously squished

### Voice Transcription Fix
- Fixed `file.base64()` call in voice recording — was missing `await`, causing transcription to fail silently
- Speech-to-text now works correctly via `/api/transcribe`

### Breaking News Prompt Polish
- Removed director selection from news broadcasts (news is auto-directed, not a "film")
- Added 16 news topic preset buttons (Crypto, AI, Space, Politics, etc.) for quick topic selection
- Enhanced reporter dialogue and anchor-reporter continuity in prompts
- Reporters now have distinct personalities and hand back to anchor naturally

### Post-Spread Link Verification
- After content is spread to socials, the app now verifies returned URLs are real post links (not API endpoints)
- Filters out non-link responses from the spreading API
- Updated Powers menu with current feature list

### Files Changed (Session 10)
- `src/screens/HomeScreen.tsx` — Unfiltered mood, Architect gate, vertical reply cards, Powers menu update, news topic presets
- `src/screens/ContentStudioScreen.tsx` — News topic presets, removed director from news
- `src/hooks/GenerationContext.tsx` — Enhanced news prompts, reporter dialogue improvements
- `src/services/api.ts` — Post-spread link verification

---

## Recent Changes — Session 2026-03-19 (Session 9)

### Breaking News — Complete Prompt Rewrite (Real TV News Style)
Rewrote the entire breaking news prompt from scratch. Previously it read like a movie script (cinematic camera work, holographic displays, cyberpunk aesthetic). Now it's a **real TV news broadcast** styled after CNN/BBC/Fox/Al Jazeera:

- **Clip 1 (6 seconds)**: AIG!itch News intro — professional news opening titles, spinning globe, "BREAKING NEWS" graphics
- **Clip 2**: Anchor at desk — "Hello and welcome to AIG!itch News. In today's news..." introduces Story 1
- **Clip 3**: Field reporter ON LOCATION — facing camera, holding microphone, event happening BEHIND them. Ends with "Back to you in the studio"
- **Clip 4**: Anchor at desk — "Thank you [reporter]. Now to our next story..." introduces Story 2
- **Clip 5**: Different reporter, different location, same format. "Back to you in the studio"
- **Clip 6**: Anchor at desk — "And in breaking developments..." introduces Story 3
- **Clip 7**: Third reporter, third location, most dramatic. "Back to you in the studio"
- **Clip 8**: Anchor wrap-up — "That's all from AIG!itch News. Stay informed, stay glitched. Goodnight."
- **Clip 9**: Professional news outro with AIG!itch branding

**Key style changes:**
- NOT a movie — real TV news. Clean, professional, well-lit (no cyberpunk neon/holographic effects)
- AIG!itch branding EVERYWHERE: desk, backdrop, mic flags, lower thirds, ticker bar, watermark
- Field reporters ALWAYS face camera with mic, event behind them
- All stories based on REAL current events (names changed to funny alternatives)
- Briefing data from `/api/partner/briefing` used as real news source material

Updated in: `GenerationContext.tsx` (full prompt rewrite), `ContentStudioScreen.tsx` (identical prompt rewrite)

### Content Studio Feed Publishing Safety Net
Both the Director Movie and Breaking News pipelines in ContentStudioScreen now call `spreadCustomContent()` as a safety net after stitching, if the backend didn't create a feed post (matching what GenerationContext already does). This ensures content appears on the "for you" page at aiglitch.app even if the backend's `stitchMovie` response doesn't include a `feedPostId`.

### Backend Changes Documentation (NEW)
Created `BACKEND-CHANGES.md` — a single-file prompt documenting all 4 backend changes needed to support the mobile app's new features:
1. `/api/messages` — `system_hint` + `prefer_short` support for short reply toggle
2. `/api/admin/mktg` — Feed post creation + social spreading for posters/heroes
3. `/api/admin/spread` — Verify feed post creation (not just social spreading)
4. `/api/admin/screenplay` — Verify no hard-coded scene limit below 9

### Files Changed (Session 9)
- `BACKEND-CHANGES.md` (NEW) — Backend changes prompt for the web app repo
- `src/hooks/GenerationContext.tsx` — Updated comment from 7-clip to 9-clip format
- `src/screens/HomeScreen.tsx` — Updated fallback gen step labels for 9-clip news
- `src/screens/ContentStudioScreen.tsx` — Updated description + added feed publish safety net

---

## Recent Changes — Session 2026-03-18 (Session 8)

### Rick & Morty Style Removal (Backend)
All AI generation prompts across 7 backend files were updated to replace "Rick and Morty cartoon style" with futuristic neon cyberpunk Web3/Solana aesthetic. Files changed: `generate-ads/route.ts`, `generate-topics/route.ts`, `messages/route.ts`, `bestie-tools.ts`, `media/image-gen.ts`, `content/ai-engine.ts`, `test-grok-image/route.ts`. Non-prompt R&M references (personas, seed data) were intentionally kept.

### 529 Retry Logic (Backend)
Added `createMessageWithRetry()` to `/api/messages/route.ts` wrapping all 3 `anthropicClient.messages.create` calls with retry on 429/529/5xx errors (3s, 6s backoff).

### Breaking News Broadcast Pipeline (NEW)
9-clip real TV news broadcast (CNN/BBC style) with 3 stories — same proven pipeline as director movies (screenplay → submit scenes → poll → stitch). Based on **real current events** from the `/api/partner/briefing` endpoint, but with all names, places, and brands changed to funny alternatives. Clip 1 is 6s intro, all others 10s each.

**How it works:**
1. Fetches real current events from `/api/partner/briefing` (topics + trending posts)
2. Sends these as context to `/api/admin/screenplay` with `genre: "news"` and TV news broadcast instructions
3. Screenplay AI generates 9 scene prompts: intro, 3x (desk + field report), wrap-up, outro
4. Each scene submitted to `POST /api/test-grok-video` (6-10s clips)
5. Polls every 10s until all clips render
6. Stitches via `PUT /api/generate-director-movie` → auto-posts to socials

**Triggered via:**
- **Chat keywords**: "breaking news", "news broadcast", "newscast", "news report", "news anchor", "news bulletin"
- **Content Studio**: "Breaking News" section with topic input and full generation log
- **HomeScreen**: News topic picker modal (red "Go Live" button)

**Files changed:**
- `src/services/api.ts` — Added `news` and `breaking_news` to `GENRE_FOLDER_MAP`
- `src/hooks/GenerationContext.tsx` — Added `runNewsGeneration` function + imports `getBriefing`
- `src/screens/HomeScreen.tsx` — Added news keyword detection, news picker modal, `breaking_news` gen steps
- `src/screens/ContentStudioScreen.tsx` — Added full Breaking News section with generate button, progress, clip statuses, log, result card

---

## Recent Changes — Session 2026-03-18 (Session 7)

### Ad Generation Rewrite — Using Director Movie Pipeline Pattern (CRITICAL FIX)

**Problem**: Ad generation has failed ~20 times. The old approach used a single black-box API call (`POST /api/generate-ads`) that tried to do everything server-side — generate concept, create video, wait for render, post to socials — all in one request. This either:
- Timed out (~140 seconds)
- Returned `success: true` but with no media (no `video_url` or `image_url`)
- Returned a `job_id` for async polling, but the polling endpoint (`GET /api/generate-ads`) returned data in unpredictable formats

**Root cause**: The ad endpoint was a monolithic server-side job. Director movies work because they use a **client-orchestrated multi-step pipeline** where each step is a separate, fast API call. The ad generation tried to do what director movies split across 4 steps (screenplay → submit → poll → stitch) in a SINGLE request.

**Fix**: Rewrote `runAdGeneration` in `GenerationContext.tsx` to follow the **exact same proven pipeline** as director movies:
1. **Generate ad concept** — `POST /api/generate-ads` with `plan_only: true` → returns concept/prompt text (fast, no video)
2. **Submit to Grok Video** — `POST /api/test-grok-video` (same endpoint movies use) → returns `requestId`
3. **Poll for completion** — `GET /api/test-grok-video?id={requestId}` every 10s (same as movie scenes)
4. **Post & spread** — `PUT /api/generate-ads` with the completed video URL → posts to socials, returns spreading info

**Why this works**: Each step is a fast, focused API call. No single request runs longer than ~10 seconds. The Grok Video API (`/api/test-grok-video`) is the **same proven endpoint** that successfully renders 10-14 movie scenes. The polling interval matches movies (10s, not 3s).

**Files changed**: `src/hooks/GenerationContext.tsx`, `src/services/api.ts`

### Files Changed (Session 7)
- `src/hooks/GenerationContext.tsx` — rewrote runAdGeneration to use multi-step pipeline
- `src/services/api.ts` — added `planAd()` and `postAd()` functions, kept existing `generateAd`/`getAdStatus` as fallback

---

## Recent Changes — Session 2026-03-18 (Session 6)

### GenerationContext — Background-Safe Generation

Moved all generation logic (ad, poster, hero, director movie) out of HomeScreen local state into a shared `GenerationContext` (`src/hooks/GenerationContext.tsx`). This means:
- **Generation persists when navigating between tabs** — no longer tied to HomeScreen's component lifecycle
- **Local push notifications** on completion via `expo-notifications` (`scheduleNotificationAsync` with `trigger: null` for immediate)
- **Results appear as chat messages** — after any generation completes, a synthetic AI message is added to the chat with the result text and media URL
- **Cancel support** via `cancelGeneration()` from context

**Provider hierarchy** (App.tsx): `SafeAreaProvider → WalletProvider → GenerationProvider → AppContent`

**Context API:**
- `generating` — current generation type string or null
- `genStatusText` / `genProgressPct` — real-time progress from API pipelines
- `genResult` — completed result (type, title, message, mediaUrl, isVideo)
- `clearResult()` / `cancelGeneration()`
- `runAdGeneration(wallet, style?, concept?)`, `runPosterGeneration(wallet)`, `runHeroGeneration(wallet)`, `runMovieGeneration(wallet, director?, genre?, concept?)`, `runNewsGeneration(wallet, topic?)`

**HomeScreen changes:**
- Uses `useGeneration()` hook instead of local state
- `cosmeticGen` local state for polling-based background_task generation (images, etc.)
- `generating = ctxGenerating || cosmeticGen` — unified display
- `useEffect` watches `genResult` and injects result messages into chat

### Bug Fixes (Session 6)

1. **Keyboard dismiss during generation** — Added `Keyboard.dismiss()` calls when movie picker opens, when generate button is pressed, and before each generation type starts
2. **Hero/Poster label mismatch** — Reordered detection logic so "hero image/banner/photo" is checked BEFORE "poster/promo" (previously "promo" in AI response would false-match hero requests)
3. **AI response brevity** — Strengthened `system_hint` in `api.ts` sendMessage: now includes "CRITICAL: Reply in 1-2 SHORT sentences ONLY. Maximum 30 words." + added `max_response_length: 50` parameter
4. **Ad social feedback** — Ad generation now shows which platforms the ad was spread to (reads from API response `spreading` field), and displays the ad caption in the chat result message

### Files Changed (Session 6)
- `src/hooks/GenerationContext.tsx` (NEW) — shared generation context with push notifications
- `src/screens/HomeScreen.tsx` — refactored to use GenerationContext, keyboard fixes, detection order fix
- `src/services/api.ts` — stronger system_hint + max_response_length
- `App.tsx` — wrapped with GenerationProvider

### AI Feed Scanner (Issue 9)

The AI bestie now scans the "for you feed" and shares interesting posts directly in the chat:
- Fetches trending posts from `/api/partner/briefing` on chat load (10s delay) + every 5 minutes
- Shares up to 2 most-engaged posts (sorted by likes + comments) as AI messages
- Deduplication via `sharedPostIds` Set — never shares the same post twice per session
- Posts show author name, handle, content, engagement stats, and any media
- Feed messages have IDs prefixed with `feed-` for identification

### User Post Interaction / ML Feedback (Issue 10)

Feed posts shared in chat have interactive reaction buttons below them:
- **5 feedback actions**: Like (👍), Love (❤️), Fire (🔥), Nah (👎), Save (🔖)
- Toggle behavior — tap again to remove reaction
- Each reaction calls `POST /api/partner/feedback` with `{ session_id, post_id, action }`
- Haptic feedback on tap
- Visual highlight (purple border/bg) on active reaction
- Backend endpoint (`/api/partner/feedback`) needs to be created to store feedback for ML training

**New API functions** (`api.ts`):
- `sendPostFeedback(sessionId, postId, action)` — `POST /api/partner/feedback`
- `FeedbackAction` type: `"like" | "dislike" | "love" | "fire" | "save"`
- `TrendingPost` extended with optional `avatar_url`, `image_url`, `video_url`, `created_at` fields

### Remaining Issues
- Background generation works across tabs but does NOT survive app kill (would need server-side job tracking)

---

## Recent Changes — Session 2026-03-18 (Session 5)

### Director Movie Pipeline (FULL IMPLEMENTATION)

Implemented the complete 5-step multi-scene movie generation pipeline matching the web admin panel at `/admin/directors`. This replaces the previous one-shot `triggerDirectorMovie` approach which had no real-time progress.

**Pipeline Steps:**
1. **Screenplay** — `POST /api/admin/screenplay` (genre, director, concept → title, scenes[], castList)
2. **Submit Scenes** — `POST /api/test-grok-video` per scene (returns requestId)
3. **Poll** — `GET /api/test-grok-video?id={requestId}&folder={folder}&skip_post=true` every 10s (max 90 polls / 15 min)
4. **Stall Detection** — If 50%+ scenes done AND 60s no new completions → stitch early
5. **Stitch** — `PUT /api/generate-director-movie` (sceneUrls map → finalVideoUrl, auto-posts + social spread)

**New API functions added to `api.ts`:**
- `generateScreenplay`, `submitScene`, `pollScene`, `stitchMovie`
- `autoGenerateConcept`, `createConcept`, `listDirectorPrompts`, `deleteConcept`
- `submitExtension`, `pollExtension`, `stitchExtension`
- `forceStitch`
- `GENRE_FOLDER_MAP` constant (maps genre → blob folder, e.g. `cooking_channel` → `premiere/cooking_show`)

**ContentStudioScreen enhancements:**
- Full real-time generation log matching web admin spec (emoji prefixes, color coding)
- Progress bar with phase labels (Writing screenplay → Submitting scenes → Rendering clips → Stitching)
- Per-scene status indicators (⏳ Submitted, 🔄 Rendering, ✅ Done, ❌ Failed)
- Cancel button during generation
- Movie result card showing title, director, genre, clip count, size, social spread platforms

**Chat integration (HomeScreen):**
- Director movie steps already in GEN_STEPS for purple card animation when triggered via chat
- Keywords "movie", "director", "screenplay", "film", "premiere" trigger the director_movie generation card

**Files changed:** `src/services/api.ts`, `src/screens/ContentStudioScreen.tsx`

---

## Recent Changes — Session 2026-03-17 (Session 4)

### Two-Wallet Architecture

The app is tested with two wallets that serve different roles:

| Wallet Address | Role | Notes |
|----------------|------|-------|
| `EWiF6ZQQiAV1zNwK6GKyTdFSzaDKEEJyv7LRKgsQPRGo` | **User wallet** | Mapped to the "Noodles" persona (AI bestie) |
| `AEWvE2xXaHSGdGCaCArb2PWdKS7K9RwoCRV7CT2CJTWq` | **Admin wallet** | Grants access to the admin panel |

### Bug Fixes (Session 4)

#### CRITICAL: Persona Leak Across Wallets (FIXED)
- **Problem**: Session ID was generated once and persisted forever in SecureStore. When switching wallets (disconnect → connect new wallet), `getBestie(sessionId)` returned the OLD wallet's persona because the session ID never changed
- **Root cause**: `useSession.ts` created a session ID on first launch and stored it permanently. Disconnecting a wallet did not clear the session
- **Fix**: Session is now cleared on wallet disconnect and a fresh session ID is generated on each new wallet connect. This ensures `getBestie()` always returns the correct persona for the connected wallet
- **Files changed**: `src/hooks/useSession.ts`, `src/hooks/WalletContext.tsx`

#### iPhone Keyboard Covering Connect Button (FIXED)
- **Problem**: On iPhone, opening the keyboard to paste a wallet address pushed the "Connect" button off-screen or behind the keyboard
- **Root cause**: `WalletScreen` was missing a `KeyboardAvoidingView` wrapper
- **Fix**: Added `KeyboardAvoidingView` wrapping the `ScrollView` on the wallet screen
- **File changed**: `src/screens/WalletScreen.tsx`

#### Admin Panel Auth Hardcoded to Specific Wallet (FIXED)
- **Problem**: Admin access was granted to whoever connected first ("first wallet becomes admin"), which was insecure and unpredictable
- **Fix**: Changed admin authentication to check against a hardcoded admin wallet address: `AEWvE2xXaHSGdGCaCArb2PWdKS7K9RwoCRV7CT2CJTWq`. Only this wallet can access the admin panel
- **File changed**: `src/screens/AdminScreen.tsx`
- **RESOLVED**: Backend admin auth updated — `src/lib/admin-auth.ts` `isAdminAuthenticated()` now accepts wallet-based auth alongside cookie auth. The `ADMIN_WALLET` env var is set in Vercel to `AEWvE2xXaHSGdGCaCArb2PWdKS7K9RwoCRV7CT2CJTWq`. All 42 admin route handlers pass the request through for wallet auth. Mobile app's `?wallet_address=` query param now authenticates correctly

### xAI Account Documentation
- Documented two xAI/X accounts in HANDOFF.md
- **Main account**: `console.x.ai` (team 4b936db5-8c75-4788-add0-6d171ace23ab) — used by backend for Grok TTS, image gen, AI text
- **Secondary account**: `console.x.com` (account 2026609136566415363) — X Developer Portal, has extra credits bought by mistake
- Added warning: credits on `console.x.com` are for X/Twitter API, NOT Grok/TTS

### iPhone Registered + New Preview Build
- iPhone (UDID: 00008130-001E59D901C0001C) added to provisioning profile
- Both iPad and iPhone now provisioned in profile `M2DSHAU6CX`
- New preview build with both devices: `4454899a` (pre-merge) and `ad512f05` (with Session 4 changes)
- Latest build: https://expo.dev/accounts/comfybear/projects/glitch-bestie/builds/ad512f05-2a5b-41aa-bbe4-6739ebf5d7db

---

## Recent Changes — Session 2026-03-14 (Session 2)

### Image Display Fix
- **Problem**: Sent photos disappeared after AI replied
- **Fix**: Local URI always preserved as fallback. Placeholder text hidden when image is displayed

### Voice Stop Button
- **Problem**: No way to stop AI voice mid-speech
- **Fix**: Speaker shows ⏹ when speaking — tap to stop. Cosmic visualizer also tappable

### Emoji Reactions Repositioned
- **Problem**: Long-press emoji picker appeared inside the message bubble
- **Fix**: Picker and reaction badge now render below the message bubble

### Video Sharing
- **Problem**: Media picker only allowed images
- **Fix**: Changed to `MediaTypeOptions.All` for videos too

### Chat Pagination (Inverted FlatList)
- **Problem**: All messages loaded at once, slow with long histories
- **Fix**: Server pagination with `before` cursor, `has_more` flag, inverted FlatList

---

## CRITICAL BUG LOG

### Session 3 — EAS Build Chain of Errors (2026-03-17)

This section documents a chain of errors that cost significant time. AI agents MUST read this.

**Error 1: "Unable to install - integrity could not be verified"**
- **When**: User downloaded .ipa from EAS artifacts link on iPhone
- **Root cause**: Two issues: (1) It was an App Store build, not preview (2) iPhone was not in provisioning profile
- **Fix**: Use `eas build --profile preview` and register device
- **Lesson**: NEVER tell user to download .ipa directly. Always use QR code from preview build

**Error 2: "Failed to resolve plugin for module expo-local-authentication"**
- **When**: Running `eas build` after merging branch
- **Root cause**: `npm install` was not run after merge. Dependencies missing
- **Fix**: Run `npm install` before `eas build`
- **Lesson**: ALWAYS include `npm install` in the cheat sheet / instructions

**Error 3: "Invalid UUID appId"**
- **When**: Running any `eas` command after merging branches
- **Root cause**: During merge conflict resolution (`git checkout --ours`), the `projectId` in app.json was replaced with the slug name `"glitch-bestie"` instead of the real UUID. The `updates.url` had the same problem
- **Fix**: Manually set correct UUID `418c0a46-e73f-42b1-b388-cb801ca7d798`
- **Lesson**: AI agents MUST verify app.json after ANY merge conflict resolution

**Error 4: "You don't have permission to create a new project"**
- **When**: Running `eas init` after clearing projectId to empty string
- **Root cause**: The `owner` field was `"comfybear71"` (GitHub username) but Expo account is `"comfybear"`. EAS couldn't find the project under the wrong account
- **Fix**: Changed owner to `"comfybear"`, then `eas init` found the existing project
- **Lesson**: GitHub username ≠ Expo account name. Always use Expo account name for `owner`

**Error 5: "not something we can merge"**
- **When**: Running `git merge claude/branch-name` without fetching
- **Root cause**: Branch only exists on remote (GitHub), not locally
- **Fix**: `git fetch origin branch-name` first, then `git merge origin/branch-name`
- **Lesson**: Always use `origin/` prefix when merging remote branches

**Error 6: Merge conflict after git stash pop**
- **When**: Stashing local changes, merging, then popping stash
- **Root cause**: EAS auto-modified app.json (buildNumber bump) locally, conflicting with merged version
- **Fix**: `git checkout --ours .` to keep merged version, discard stash
- **Lesson**: EAS modifies app.json during builds. Always stash before merging

**Error 7: Login page not showing new design**
- **When**: User installed build, disconnected wallet, but saw old connect UI
- **Root cause**: Redesigned WalletScreen was not in the tab navigation. User was seeing HomeScreen's connect flow
- **Fix**: Added login gate in App.tsx — WalletScreen shows full-screen before tabs when no wallet connected
- **Lesson**: Always verify new screens are actually reachable in navigation

**Error 8: Logo covered by clock/battery on iPad**
- **When**: Login page displayed but logo hidden behind iOS status bar
- **Root cause**: Static `paddingTop` didn't account for safe area insets (notch, status bar)
- **Fix**: Added `SafeAreaProvider` + `useSafeAreaInsets()` for dynamic padding
- **Lesson**: Always use safe area insets for content near screen edges

**Error 9: Admin/Studio showing "Connect wallet" despite wallet being connected**
- **When**: User had wallet connected but Admin and Studio screens didn't know
- **Root cause**: Each screen had its own `usePhantomWallet` instance — separate state. Connection in one screen didn't propagate to others
- **Fix**: Created `WalletContext` (React Context) so all screens share one wallet state
- **Lesson**: Shared state MUST use React Context, not independent hook instances

**Error 10: Buy screen showing "-" for all prices**
- **When**: User viewed Buy tab, all prices showed "-"
- **Root cause**: Backend server was lagging (confirmed by AI bestie "Noodles")
- **Fix**: Not an app bug — server-side issue. Prices return when server recovers
- **Lesson**: If prices show "-", check backend health first before debugging app

### Session 8 — Merge Conflict Markers Cost $4 in Failed Builds (2026-03-18)

**Problem**: Two consecutive EAS builds failed ($2 each = $4 wasted) with:
```
SyntaxError: /Users/expo/workingdir/build/src/hooks/GenerationContext.tsx: Unexpected token (6:0)
> 6 | <<<<<<< HEAD
```

**Root cause**: `GenerationContext.tsx` had unresolved git merge conflict markers (`<<<<<<< HEAD`, `=======`, `>>>>>>>`) from a previous merge between branches. The file on the remote Claude branch was clean, but the user's **local Windows machine** still had the conflicted version. EAS uploads local files, not remote files — so the broken local copy was sent to EAS.

**Why `git pull` didn't fix it**: If the local file has uncommitted changes (including conflict markers), `git pull` won't overwrite it. The user needs to explicitly checkout the clean version:
```bash
git checkout origin/<branch-name> -- src/hooks/GenerationContext.tsx
```

**How to prevent this EVERY TIME**:
1. After ANY merge or pull, run: `grep -r "<<<<<<" src/`
2. If ANY results appear, the merge is NOT done — fix those files
3. Before ANY EAS build, run: `npx expo export --platform ios`
4. This is a FREE local test. If it says "Bundled" → safe to build. If it fails → fix first, save $2

**Fix applied**: Added `npx expo export --platform ios` as a mandatory step in the Golden Rule (both CLAUDE.md and HANDOFF.md). Also added merge conflict scan reminder to git rules.

**RULE FOR AI AGENTS**: After pushing code, ALWAYS tell the user to run `npx expo export --platform ios` before `eas build`. NEVER tell them to go straight to `eas build`. The local test is free. The EAS build is $2.

---

### Session 2 — The usePhantomDeepLink Disaster (2026-03-14)

**Problem**: WalletScreen imported `usePhantomDeepLink` which imports `tweetnacl` and `bs58` — these crash the app because they require Node.js `Buffer`.

**Fix**: Replaced with `usePhantomWallet` (simple TextInput + SecureStore).

**RULE**: NEVER import `usePhantomDeepLink`. NEVER use `Alert.prompt` or `Alert.alert` for user input — they fail silently. Always use inline TextInput components.

---

## Rules for Future Development

### Code Rules
1. **NEVER use dummy/fake/mock data** — all data must come from real APIs or blockchain
2. **NEVER add features that don't work** — if it's not implemented, don't show it
3. **NEVER import usePhantomDeepLink** — it crashes the app (tweetnacl/bs58)
4. **NEVER use Alert.prompt or Alert.alert for user input** — they can fail silently. Use inline TextInput
5. **Always use usePhantomWallet hook** — it reads from shared WalletContext
6. **Always auto-load wallet** — wallet address persists via SecureStore across app launches
7. **Always use SafeAreaProvider** — content must respect safe area insets (notch, status bar)
8. **Images must persist** — always preserve local URI as fallback for sent photos
9. **Voice must have stop** — every speaking state needs a stop mechanism

### Build & Deploy Rules
10. **ALWAYS run `npm install` before `eas build`** — missing deps = cryptic errors
11. **ALWAYS run `npx expo export --platform ios` before `eas build`** — this is a FREE local bundle test. If it fails, the $2 EAS build will fail too. Fix locally first
12. **ALWAYS run `grep -r "<<<<<<" src/` after any merge/pull** — catches unresolved merge conflicts before they cost $2
13. **ALWAYS use `preview` profile for device testing** — production is for App Store only
14. **ALWAYS verify app.json after merge conflicts** — check projectId, owner, updates.url
15. **NEVER change `owner` to `comfybear71`** — Expo account is `comfybear`
16. **NEVER replace projectId UUID with slug name** — must be `418c0a46-e73f-42b1-b388-cb801ca7d798`
17. **Buy = BUY ONLY** — no sell feature until 5000 SOL raised

### Git Rules
18. **Always use `--legacy-peer-deps` for npm install** if peer dep errors occur
19. **Always stash before merging** if you have local changes
20. **Always use `origin/` prefix** when merging remote branches
21. **Close VS Code** if it opens during git operations — it's just the merge editor
22. **After ANY merge, run `grep -r "<<<<<<" src/`** — if any results, the merge is incomplete. Fix the files before committing. Unresolved merge conflicts caused $4 in wasted EAS builds (Session 8)

---

## Phase 1 Complete — What's Done

Everything listed in "Working Features" above is **live and functional** as of Session 10. Key milestones:
- Full chat with 5 moods + short/long replies
- Voice chat with Grok xAI TTS + speech-to-text transcription
- Director movies (multi-scene pipeline)
- Breaking news broadcasts (9-clip TV news format)
- Ad campaigns (multi-step pipeline)
- Poster + hero image generation
- Social spreading to X, TikTok, Instagram, Facebook, YouTube
- Feed publishing (content appears on aiglitch.app "for you" page)
- AI feed scanner with ML feedback reactions
- OTC swap (SOL → $GLITCH) with live pricing
- Architect wallet gate for content generation
- Background-safe generation with push notifications
- Both iPad and iPhone registered and working

## Future Features (Phase 2 — Planned)
- **EAS Update**: ~~Over-the-air JS updates without rebuilding~~ ✅ DONE (Session 14) — `expo-updates` installed, channels configured, OTA pushes via `eas update --branch preview`
- **Deep link wallet connect**: Real Phantom/Solflare app integration (now possible with standalone builds)
- **Content generation for all users**: Currently Architect-only — planned rollout to all besties
- **Personal Assistant abilities**: Weather, crypto prices, news, reminders, to-do lists, web search
- **Smart push notifications**: Reminders, crypto alerts, bestie check-ins, news alerts
- **Siri Shortcuts**: ~~Summon bestie via Siri~~ ✅ DONE (Session 11) — 5 App Intents with Siri phrases registered
- **Email access**: Read/summarize emails (requires OAuth)
- **Alarm/Calendar integration**: Native integrations
- **Digital Void video posts**: Enable video content in social feed
- **Sell feature**: Sell $GLITCH back — disabled until ~5000 SOL raised
- **On-chain transaction signing**: Full Phantom React Native SDK integration (currently uses paste flow)
