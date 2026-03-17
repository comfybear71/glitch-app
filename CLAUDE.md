# CLAUDE.md — Read This EVERY Session Before Doing ANYTHING

## FIRST THING: Read HANDOFF.md

Before writing any code, read `HANDOFF.md` in this repo. It contains the full project history, known bugs, architecture, and critical rules. DO NOT SKIP THIS.

---

## THE GOLDEN RULE — Build & Preview on Devices

After ANY code changes, these 3 commands must run IN ORDER before previewing on iPad/iPhone:

```bash
git pull origin <your-assigned-branch>
npm install
eas build --profile preview --platform ios
```

**Never skip `npm install`.** Missing dependencies cause cryptic build failures.
**Never skip `git pull`.** The user's local machine needs the latest code.
**Never forget to tell the user about ALL THREE steps.**

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

## Git Rules

- **Work on your assigned branch** — check the task description for the branch name. NEVER push to `main`.
- **Always stash before merging** if there are local changes.
- **Always use `origin/` prefix** when merging remote branches.
- Run `npm install` after every pull/merge.

---

## Code Rules

- NEVER use dummy/fake/mock data — all data comes from real APIs
- NEVER import `usePhantomDeepLink` — it crashes the app (tweetnacl/bs58)
- NEVER use `Alert.prompt` for user input — use inline TextInput
- Always use `usePhantomWallet` hook (shared WalletContext)
- Always use SafeAreaProvider for content near screen edges

---

## Build Profiles

| Profile | Command | Use for |
|---------|---------|---------|
| Preview | `eas build --profile preview --platform ios` | Testing on devices (QR code install) |
| Production | `eas build --profile production --platform ios` | App Store / TestFlight only |

**NEVER use production profile for testing.**

---

## Registered Devices (both active)

- iPad: 00008132-001C105E3E85001C
- iPhone: 00008130-001E59D901C0001C
- Both in provisioning profile M2DSHAU6CX
- No need to register again — they're already done

---

## When the User Asks "How Do We Preview?"

The answer is ALWAYS:

1. `git pull origin <branch>`
2. `npm install`
3. `eas build --profile preview --platform ios`
4. Scan QR code on device

Do NOT guess. Do NOT suggest Expo Go. Do NOT forget any steps.
