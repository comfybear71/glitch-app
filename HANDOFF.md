# HANDOFF.md — AI G!itch App Project Status

Last updated: 2026-03-17 (Session 3)

## Project Overview

React Native / Expo mobile app for the AI G!itch ecosystem. Connects to Solana blockchain via Phantom wallet for buying $GLITCH tokens.

**Backend**: https://aiglitch.app (all API calls go here)
**Network**: Solana Mainnet

## Current State

### Working Features
- **Home Screen**: Wallet connect via inline TextInput (paste address), bestie card, chat + voice chat, on-chain balance display (SOL, GLITCH)
- **Buy Screen**: OTC swap SOL -> $GLITCH with live pricing, bonding curve tiers (signing not available in Expo Go — needs standalone build)
- **Wallet Screen**: Shows GLITCH balance, on-chain balances, disconnect option
- **Chat**: Text, photo, and video chat with AI besties. Inverted FlatList with pagination (50 msgs, scroll up for older)
- **Voice**: Grok xAI TTS via REST API — Rex voice for meatbag besties. Stop button (⏹) on messages + tap cosmic visualizer to stop
- **Push Notifications**: Registered via expo-push-token
- **Emoji Reactions**: Long-press any message for emoji picker (❤️😂😮😢🔥👍). Reactions appear below message bubble
- **Media Sharing**: Photos + videos from library or camera. Videos play inline with native controls
- **Image Persistence**: Sent photos stay visible even after AI replies (local URI fallback if blob upload fails)

### Wallet Connect Flow (WORKING — Inline TextInput)
1. HomeScreen shows TextInput with "Paste your Solana address here..."
2. User copies address from Phantom app manually
3. User pastes into TextInput and taps "Connect"
4. Address saved to SecureStore, bestie loads
5. **NO deep links, NO Alert.prompt, NO Alert.alert** — all of these fail silently in Expo Go

### Buy Flow
1. User enters SOL amount on Buy tab
2. App calls `createSwap()` API to register the swap on backend
3. **In Expo Go**: Shows swap details but cannot sign on-chain (message directs to web app)
4. **In standalone build (future)**: Will use Phantom React Native SDK for full signing

### NOT Implemented (By Design)
- **No SELL feature** — selling $GLITCH is disabled until ~5000 SOL has been raised for AI development
- **No in-app transaction signing in Expo Go** — requires standalone build with Phantom SDK
- **No dummy data anywhere** — all balances and prices are real, from Solana blockchain and backend API

## Architecture

### Screens
- `SplashScreen` — animated intro
- `HomeScreen` — main hub, wallet connect TextInput, bestie card, on-chain balances, inverted chat with pagination, emoji reactions, voice stop, video sharing
- `ChatScreen` — text/photo/video chat with AI persona + voice playback with stop button
- `VoiceChatScreen` — voice chat (full screen modal)
- `BuyGlitchScreen` — OTC swap with live pricing (signing disabled in Expo Go)

### Key Hooks
- `useSession` — generates/stores unique session ID via expo-secure-store
- `usePhantomWallet` — manages wallet connection via TextInput + SecureStore. Exposes: `connect()`, `submitAddress()`, `cancelConnect()`, `disconnect()`
- `usePushNotifications` — registers push tokens
- **DO NOT USE `usePhantomDeepLink`** — imports tweetnacl/bs58 which CRASH Expo Go

### API Service (`src/services/api.ts`)
- All calls go to `https://aiglitch.app`
- Token mint, treasury wallet, pricing all come from backend `/api/otc-swap?action=config`
- On-chain balances fetched from `/api/solana?action=balance`
- Chat: POST /api/messages (sends message, returns AI reply). Supports `has_more` for pagination
- Chat pagination: GET /api/messages with `before` cursor + `limit` params for loading older messages
- Voice: POST /api/voice (text + persona_id → MP3 audio)
- Bestie: GET /api/partner/bestie (finds user's hatched AI persona)
- No hardcoded token addresses or dummy values

### Navigation
- Bottom tabs: Home, Buy, Studio, Admin
- Home tab has nested stack: HomeMain -> Chat -> VoiceChat

## Recent Changes — Session 2026-03-14 (Session 2)

### Image Display Fix
- **Problem**: Sent photos disappeared after AI replied. Also showed "[Photo]" placeholder text over the image
- **Fix**: Local URI always preserved as fallback when server blob upload fails. `[Photo]`/`[Video]`/`[Shared a photo]` text hidden when image is displayed
- Applied to both HomeScreen and ChatScreen

### Voice Stop Button
- **Problem**: No way to stop AI voice mid-speech. Tapping speaker icon just started a new speech
- **Fix**: Speaker shows ⏹ when speaking — tap to instantly stop. Cosmic visualizer is also tappable ("tap to stop" label)
- `stopSpeaking()` function unloads sound and clears speaking state

### Emoji Reactions Repositioned
- **Problem**: Long-press emoji picker appeared inside the message bubble, looked wrong
- **Fix**: Picker and reaction badge now render below the message bubble. No more `position: absolute` — uses `marginTop` flow layout

### Video Sharing
- **Problem**: Media picker only allowed images (MediaTypeOptions.Images)
- **Fix**: Changed to `MediaTypeOptions.All` so users can share videos from library. Videos without base64 display with local URI

### Chat Pagination (Inverted FlatList)
- **Problem**: All messages loaded at once, slow with long chat histories
- **Fix**:
  - Server API now supports `before` cursor and `limit` params
  - Returns `has_more` flag
  - FlatList is inverted (newest at bottom, no scrollToEnd needed)
  - Scroll to top triggers `loadOlderMessages()` via `onEndReached`
  - "Loading older messages..." spinner at top while fetching
  - Empty state uses `scaleY: -1` transform to display correctly in inverted list

## CRITICAL BUG LOG — Session 2026-03-14

### The usePhantomDeepLink Disaster
**Problem**: WalletScreen and BuyGlitchScreen imported `usePhantomDeepLink` hook which imports `tweetnacl` and `bs58` — Node.js crypto libraries that DO NOT WORK in React Native / Expo Go. This caused:
- App crashing on Expo logo (wouldn't even load)
- "Connecting..." hanging forever (Alert.alert and Alert.prompt fail silently in Expo Go)
- Multiple failed fix attempts before root cause was found

**Root cause**: `tweetnacl` and `bs58` require Node.js `Buffer` which is not available in React Native.

**Fix**: Replaced all `usePhantomDeepLink` imports with `usePhantomWallet` (the simple, working hook). Wallet connect now uses inline TextInput on the screen instead of any Alert-based flow.

**RULE**: NEVER import `usePhantomDeepLink` in any screen. NEVER use `Alert.prompt` or `Alert.alert` for wallet input — they fail silently in Expo Go. Always use inline TextInput components.

### Alert.prompt / Alert.alert Silent Failures
Both `Alert.prompt` and `Alert.alert` can fail silently in Expo Go — no popup appears, no error thrown. The only reliable way to get user input is with actual `TextInput` components rendered on the screen.

### Master Branch Missing TextInput
The master branch HomeScreen had `connect()` which set `isConnecting = true` but NO TextInput was ever rendered to accept the wallet address. It just showed "Connecting..." forever. The claude branch fixed this with an inline TextInput.

## Rules for Future Development

1. **NEVER use dummy/fake/mock data** — all data must come from real APIs or blockchain
2. **NEVER add features that don't work** — if it's not implemented, don't show it
3. **NEVER import usePhantomDeepLink** — it crashes Expo Go (tweetnacl/bs58)
4. **NEVER use Alert.prompt or Alert.alert for user input** — they fail silently in Expo Go. Use inline TextInput.
5. **Always use usePhantomWallet hook** — the simple, working wallet hook
6. **Always auto-load wallet** — wallet address persists via SecureStore across app launches
7. **Buy = BUY ONLY** — no sell feature until 5000 SOL raised
8. **Test builds before pushing** — run `npx expo export --platform ios` to verify
9. **Always use --legacy-peer-deps** for npm install
10. **Always use --tunnel --clear** for expo start
11. **Images must persist** — always preserve local URI as fallback for sent photos
12. **Voice must have stop** — every speaking state needs a stop mechanism

## Recent Changes — Session 2026-03-17 (Session 3)

### Login Page Redesign
- **Before**: Simple "Connect Wallet" button → paste TextInput. Ghost emoji (👻) as icon
- **After**: Full branded login page with:
  - **G!itch logo** at top (from assets/aiglitch-logo.jpg) with glitch shake animation
  - **Animated cosmic background** — 20 floating particles (purple/cyan), pulsing radial glows, different every time app opens
  - **3 branded wallet buttons**: Phantom (purple 👻), Solflare (orange 🔥), Jupiter (green 🪐)
  - **Wallet-specific paste flow** — shows selected wallet badge, disabled Connect button until valid address
  - **2x2 perks grid** — AI Bestie, $GLITCH, Feed & Care, Hatch
  - **Entrance animations** — logo fades in first, then title, then buttons (sequenced)
- File changed: `src/screens/WalletScreen.tsx`

### New Screens Added (Session 2-3)
- **AdminScreen** (`src/screens/AdminScreen.tsx`) — FaceID-gated admin panel with tabs: Overview, Personas, Users, Swaps, System, Tools, Secrets
- **ContentStudioScreen** (`src/screens/ContentStudioScreen.tsx`) — AI content generation, media uploads to blob storage, media library

### App Store Build & EAS Configuration
- **iOS Bundle ID**: `app.aiglitch.bestie`
- **Apple Team**: PALMERSTON SHIPPING & LOGISTIC PTY LTD (4FT68E9XCG)
- **Apple ID**: sfrench1@bigpond.net.au
- **ASC App ID**: 6760682894
- First App Store build submitted successfully
- TestFlight submission completed

---

## Developer Cheat Sheet (for non-devs!)

### After code changes are pushed, get them on your device:
```bash
git fetch origin main
git pull origin main
npm install
eas build --profile preview --platform ios
```

### If you get merge conflicts:
```bash
git stash --include-untracked
git pull origin main
git stash pop
# If conflicts appear, run:
git checkout --ours .
git add .
git commit -m "Resolve conflicts"
```

### Common errors and fixes:

| Error | Fix |
|-------|-----|
| `Failed to resolve plugin for module "expo-..."` | Run `npm install` first |
| `Unable to install - integrity could not be verified` | Your device isn't registered. Run `eas build --profile preview --platform ios` and register device when prompted |
| `Your local changes would be overwritten by merge` | Run `git stash --include-untracked` before pulling |
| `not something we can merge` | Use `origin/` prefix: `git merge origin/branch-name` (need `git fetch` first) |
| App shows old version after install | The build was queued before code was pushed. Pull latest code, then build again |
| `exited with non-zero code` on eas build | Usually missing dependencies. Run `npm install` |

### Build types:
- **Preview** (for testing on your devices): `eas build --profile preview --platform ios`
- **Production** (for App Store): `eas build --profile production --platform ios`
- **Submit to App Store**: `eas submit --platform ios`

### Device registration:
- Devices must be registered in provisioning profile to install preview builds
- Currently registered: iPad (UDID: 00008132-001C105E3E85001C)
- To add iPhone: run preview build, EAS will prompt to register new device
- After registering, a new provisioning profile is created automatically

---

## Error Log — Session 2026-03-17

### "Unable to install - integrity could not be verified"
- **When**: Trying to install .ipa downloaded from EAS artifacts link on iPhone
- **Cause**: App Store builds (.ipa) are signed for Apple review, not for direct device install. Also, iPhone was not in the provisioning profile (only iPad was registered)
- **Fix**: Use `eas build --profile preview` (not production) and register device during build

### "Failed to resolve plugin for module expo-local-authentication"
- **When**: Running `eas build` after merging new code
- **Cause**: Dependencies not installed — `node_modules` was missing or outdated after merge
- **Fix**: Run `npm install` before `eas build`

### Merge conflict after git stash pop
- **When**: Stashing local changes, merging remote branch, then popping stash
- **Cause**: Both local changes and remote branch modified same files (app.json, eas.json, screen files)
- **Fix**: `git checkout --ours <files>` to keep merged version, then `git add .` and commit

### "not something we can merge"
- **When**: Running `git merge claude/branch-name` without fetching first
- **Cause**: Branch only exists on remote (GitHub), not fetched locally
- **Fix**: `git fetch origin branch-name` first, then `git merge origin/branch-name` (with `origin/` prefix)

---

## Future Features (Planned)
- **EAS Update**: Over-the-air JS updates without rebuilding (eliminates build queue waits)
- **Deep link wallet connect**: Real Phantom/Solflare app integration (now possible with standalone builds)
- **Personal Assistant abilities**: Weather, crypto prices, news, reminders, to-do lists, web search
- **Push notifications**: Reminders, crypto alerts, bestie check-ins, news alerts
- **Siri Shortcuts**: Summon bestie via Siri (requires standalone build)
- **Email access**: Read/summarize emails (requires OAuth — standalone build)
- **Alarm/Calendar integration**: Requires standalone build
- **Digital Void video posts**: Enable video content in social feed (currently text-only)
