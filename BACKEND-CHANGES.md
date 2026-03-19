## Backend Changes Needed for Mobile App Updates

The mobile app (G!itch Bestie) on branch `claude/review-handoff-docs-5vpeq` has been updated with several new features. The backend needs these changes to support them. DO NOT break any existing functionality — only modify the specific handlers described below.

### CRITICAL SAFETY RULES:
- DO NOT modify, rename, refactor, or delete ANY existing files or routes that are not mentioned below
- DO NOT change any existing API endpoint behavior for requests that don't include the new fields
- All changes must be backwards-compatible — if the new fields are missing from a request, behave exactly as before
- Test that existing functionality still works after changes

---

### CHANGE 1: `/api/messages` route — Add `system_hint` support (POST handler)

**Priority: HIGH — This is the most important change**

**File:** `app/api/messages/route.ts` (or wherever the POST handler for `/api/messages` lives)

The mobile app now sends two new optional fields in the POST body:

```json
{
  "session_id": "...",
  "persona_id": "...",
  "content": "Hello!",
  "chat_mode": "casual",
  "prefer_short": true,
  "system_hint": "CRITICAL: Reply in 1-2 SHORT sentences ONLY. Maximum 30 words. Be concise and punchy."
}
```

**What to do:**

1. Parse `system_hint` from the request body (it's an optional string)
2. If `system_hint` is present and non-empty, prepend it to the system prompt that gets sent to the AI (Claude/Grok) when generating the bestie's reply. It should come BEFORE the persona's personality prompt but still respect the persona's voice/style. Example:

```typescript
const { session_id, persona_id, content, chat_mode, prefer_short, system_hint } = await request.json();

// When building the AI messages array:
let systemMessage = existingPersonaSystemPrompt; // whatever you already have
if (system_hint) {
  systemMessage = system_hint + "\n\n" + systemMessage;
}
```

3. If `prefer_short` is `true`, you can optionally also append a length instruction to the system prompt as a backup: `"\nKeep your response under 30 words."`
4. Backwards compatible: If `system_hint` is missing or undefined, change nothing — behave exactly as before.
5. Optional bonus: If you can generate both a short and long version of the AI reply, return them as `ai_message_short` and `ai_message_long` alongside the existing `ai_message`. The mobile app will use `ai_message_short` when the user has "Short replies" enabled, and fall back to `ai_message` if `ai_message_short` is not present. This is optional — just supporting `system_hint` in the prompt is enough.

---

### CHANGE 2: `/api/admin/mktg` route — Add feed post creation + social spreading for posters and hero images

**File:** `app/api/admin/mktg/route.ts` (or wherever this POST handler lives)

Currently when `action: "generate_poster"` or `action: "generate_hero"` is called, the backend generates an image and returns `{ success, url }`. The mobile app now expects the backend to ALSO:

1. Create a feed post so the content appears on the "for you" page at aiglitch.app
2. Spread to social platforms (X, Telegram, TikTok, etc.) using whatever spreading logic already exists for director movies and ads
3. Return the spreading results and post ID in the response

Updated response format:
```json
{
  "success": true,
  "url": "https://blob.aiglitch.app/posters/abc.png",
  "message": "Poster generated",
  "spreading": ["x", "telegram", "tiktok", "instagram"],
  "post": { "id": "post_abc123" }
}
```

What to do for BOTH `generate_poster` and `generate_hero` actions: After generating the image and uploading to blob storage, create a feed post in the database, spread to socials using whatever spreading function already exists (look at how `/api/generate-director-movie` or `/api/admin/spread` does it), and return the `spreading` array and `post` object. The mobile app uses optional chaining (`res.spreading?.length`, `res.post?.id`) so if these fields are missing it won't crash — but the content won't appear on the "for you" page or socials.

---

### CHANGE 3: `/api/admin/spread` route — Verify feed post creation (not just social spreading)

**File:** `app/api/admin/spread/route.ts`

The mobile app now calls this endpoint as a safety net to ensure ALL generated content (ads, posters, hero images, movies, breaking news) appears on the "for you" page. It sends:

```json
{
  "text": "Ad Campaign\n\nBuy the Quantum Flip Flops...",
  "media_url": "https://blob.aiglitch.app/ads/video.mp4",
  "media_type": "video",
  "wallet_address": "AEWvE2x..."
}
```

Verify that this endpoint: (a) Creates a feed post in the database, not just spreads to external socials. (b) The created post shows up when `/api/partner/briefing` is called (appears in the `trending` array on the "for you" page). (c) Handles `media_type` values of `"video"`, `"image"`, or `undefined`. If it already creates feed posts, no changes needed. If it only spreads to X/Telegram/etc without creating a local feed post, add the feed post creation.

---

### CHANGE 4: `/api/admin/screenplay` route — Verify 9-scene support for news

**File:** `app/api/admin/screenplay/route.ts` (or wherever this POST handler lives)

The mobile app now sends a news concept that explicitly requests 9 clips (previously 7) for breaking news broadcasts. The structure is: Clip 1 AIG!ITCH NEWS INTRO, Clip 2 NEWS DESK STORY 1, Clip 3 FIELD REPORT STORY 1, Clip 4 NEWS DESK STORY 2, Clip 5 FIELD REPORT STORY 2, Clip 6 NEWS DESK STORY 3, Clip 7 FIELD REPORT STORY 3, Clip 8 NEWS DESK WRAP-UP, Clip 9 AIG!ITCH NEWS OUTRO.

Verify there is no hard-coded scene limit that would cap at 7. The screenplay generator should respect the concept prompt and return 9 scenes in the `scenes[]` array. If there's a `MAX_SCENES` constant or similar, bump it to at least 12. No changes needed if the screenplay endpoint just passes the concept to the AI and returns however many scenes the AI generates.

---

---

### CHANGE 5: `/api/messages` route — Support `chat_mode: "unfiltered"` (POST handler)

**Priority: MEDIUM — New chat mode**

**File:** `app/api/messages/route.ts` (same file as Change 1)

The mobile app now sends a 5th chat mode value: `"unfiltered"`. The existing modes are `casual`, `serious`, `scientific`, `whimsical`. The new mode allows the AI to use curse words and raw language.

**What to do:**

1. When `chat_mode` is `"unfiltered"`, add an additional instruction to the system prompt:
```
"The user has enabled unfiltered mode. You are allowed to use curse words, swear words, and raw/unfiltered language freely. Be real, be raw, don't hold back. Still stay in character as the user's bestie."
```

2. This should be appended to (not replace) the persona's existing personality prompt
3. Backwards compatible: If `chat_mode` is not `"unfiltered"`, change nothing — behave exactly as before
4. The `chat_mode` value is also sent via PATCH `/api/messages` when the user changes mood — make sure the PATCH handler stores `"unfiltered"` alongside the other modes

---

### Summary:

| # | Route | Change | Effort |
|---|-------|--------|--------|
| 1 | `/api/messages` POST | Read `system_hint` field, prepend to AI system prompt | Small |
| 2 | `/api/admin/mktg` POST | Create feed post + spread for poster/hero actions | Medium |
| 3 | `/api/admin/spread` POST | Verify it creates feed posts not just social spreading | Verify only |
| 4 | `/api/admin/screenplay` POST | Verify no hard scene count limit below 9 | Verify only |
| 5 | `/api/messages` POST+PATCH | Support `chat_mode: "unfiltered"` with swearing instructions | Small |

Test after deploying: Generate a poster and hero image from the mobile app, check aiglitch.app "for you" page to see if they appear. Send a chat message with short replies toggle ON and verify the bestie responds in 1-2 sentences. Generate a breaking news broadcast and confirm it produces 9 clips. Set mood to "Unfiltered" and verify the bestie uses raw/curse language.
