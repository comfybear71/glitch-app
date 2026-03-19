# HANDOFF.md — AI G!itch App Project Status

Last updated: 2026-03-19 (Session 9 — 9-clip news format, Content Studio feed publishing, backend changes doc)

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

## Current State (as of Session 9)

### App Architecture
- **Login Gate**: Full-screen branded login page when no wallet connected
- **After Login**: Bottom tab navigation with 4 tabs (Home, Buy, Studio, Admin)
- **Wallet State**: Shared via WalletContext (React Context) — all screens see the same wallet

### Working Features
- **Login Page**: G!itch logo, animated cosmic background, Phantom/Solflare/Jupiter branded buttons, paste wallet flow
- **Home Screen**: Bestie card, chat + voice chat, on-chain balance display (SOL, GLITCH), Powers menu
- **Buy Screen**: OTC swap SOL -> $GLITCH with live pricing, bonding curve tiers
- **Chat**: Text, photo, and video chat with AI besties. Inverted FlatList with pagination. Short/long reply toggle
- **Voice**: Grok xAI TTS via REST API. Stop button on messages + tap cosmic visualizer to stop
- **Admin Panel**: FaceID-gated admin with tabs: Overview, Personas, Users, Swaps, System, Tools, Secrets
- **Content Studio**: Director Movies, Breaking News (9-clip), Ad Campaigns, Posters, Hero Images, Media Library, Blob Storage
- **Director Movies**: Full pipeline — screenplay → submit scenes → poll → stitch → publish to feed + socials
- **Breaking News**: 9-clip / 3-story broadcast — same pipeline as movies, based on real current events with whimsical name changes
- **Ad Campaigns**: Multi-step ad generation with style/concept picker, auto-posts to socials
- **Generation Context**: Background-safe generation that persists across tab navigation with push notifications on completion
- **AI Feed Scanner**: Auto-shares trending posts from "for you" feed into chat with ML feedback reactions
- **Push Notifications**: Registered via expo-push-token + local notifications on generation completion
- **Emoji Reactions**: Long-press any message for emoji picker
- **Media Sharing**: Photos + videos from library or camera
- **Image Persistence**: Sent photos stay visible (local URI fallback)
- **Social Links**: Clickable links to X, Telegram, TikTok, Instagram below generated content

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
│       │   ├── HomeScreen (bestie card, chat, balances)
│       │   ├── ChatScreen (text/photo/video chat)
│       │   └── VoiceChatScreen (voice chat modal)
│       ├── Buy tab → BuyGlitchScreen (OTC swap)
│       ├── Studio tab → ContentStudioScreen (AI content)
│       └── Admin tab → AdminScreen (FaceID-gated)
```

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
- Chat: POST /api/messages (sends message, returns AI reply). Supports `has_more` for pagination. Sends `system_hint` + `prefer_short` for short reply mode
- Voice: POST /api/voice (text + persona_id → MP3 audio)
- Bestie: GET /api/partner/bestie (finds user's hatched AI persona)
- Briefing: GET /api/partner/briefing (trending posts for "for you" feed + news source data)
- Screenplay: POST /api/admin/screenplay (generates scene prompts for movies/news)
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

### THE GOLDEN RULE: Always run these 4 commands in order after pulling new code
```bash
git pull origin <your-assigned-branch>
npm install
npx expo export --platform ios
eas build --profile preview --platform ios
```
Replace `<your-assigned-branch>` with the branch from your session instructions (e.g. `claude/review-handoff-docs-5vpeq`).

**Step 3 (`npx expo export`) is a FREE local bundle test.** It catches JS errors (syntax errors, bad imports, merge conflicts) before you pay $2 for an EAS build. Only proceed to step 4 after step 3 says "Bundled" with NO errors. If step 3 fails, fix the error and re-run step 3 until it passes.

Wait for build. Scan QR code on your device. Done.

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
| Profile | Command | Use for |
|---------|---------|---------|
| Preview | `eas build --profile preview --platform ios` | Testing on your devices (QR code install) |
| Production | `eas build --profile production --platform ios` | App Store / TestFlight submission |
| Submit | `eas submit --platform ios` | Push a production build to App Store |

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
- `runAdGeneration(wallet)`, `runPosterGeneration(wallet)`, `runHeroGeneration(wallet)`, `runMovieGeneration(wallet, director?, genre?, concept?)`, `runNewsGeneration(wallet, topic?)`

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

## Future Features (Planned)
- **EAS Update**: Over-the-air JS updates without rebuilding (eliminates build queue waits)
- **Deep link wallet connect**: Real Phantom/Solflare app integration (now possible with standalone builds)
- ~~**Register iPhone**~~: DONE (Session 4) — iPhone UDID 00008130-001E59D901C0001C now in provisioning profile
- **Personal Assistant abilities**: Weather, crypto prices, news, reminders, to-do lists, web search
- **Push notifications**: Reminders, crypto alerts, bestie check-ins, news alerts
- **Siri Shortcuts**: Summon bestie via Siri
- **Email access**: Read/summarize emails (requires OAuth)
- **Alarm/Calendar integration**: Native integrations
- **Digital Void video posts**: Enable video content in social feed
