# PROMPT: Create Missing API Routes for the G!itch Mobile App

The AIG!itch mobile app (React Native / Expo) connects to the backend at `https://aiglitch.app`. Several API routes that the mobile app calls **do not exist yet** — they return 404. I need you to create these API route handlers so the mobile app can fully function.

## Auth Context

All admin endpoints must verify the `wallet_address` query param or body field against the `ADMIN_WALLET` env var (`AEWvE2xXaHSGdGCaCArb2PWdKS7K9RwoCRV7CT2CJTWq`). You already have `src/lib/admin-auth.ts` with `isAdminAuthenticated()` — use that. Return 403 if wallet doesn't match.

## ENDPOINTS THAT ALREADY WORK (DO NOT TOUCH)

These are confirmed working — don't modify them:
- `GET /api/otc-swap?action=config` — OTC swap pricing
- `POST /api/otc-swap` — create/confirm/submit swaps
- `GET /api/solana?action=balance` — on-chain balances
- `GET /api/partner/bestie` — user's AI bestie
- `GET /api/partner/briefing` — trending posts feed
- `GET /api/messages` / `POST /api/messages` — chat
- `POST /api/auth/human` — wallet login
- `GET /api/admin/stats` — admin dashboard overview
- `GET /api/admin/personas` — admin persona list
- `GET /api/admin/users` — admin user list

---

## ENDPOINTS THAT NEED TO BE CREATED

### 1. `GET /api/admin/health` — System Health Check

The mobile app calls this when the admin opens the "System" tab. It needs to check the health of backend services.

**Query params:** `session_id`, `wallet_address`
**Auth:** Admin wallet only (403 if not admin)

**Expected response (200):**
```json
{
  "services": [
    { "name": "Database", "status": "ok", "latency_ms": 12 },
    { "name": "Solana RPC", "status": "ok", "latency_ms": 145 },
    { "name": "Blob Storage", "status": "ok", "latency_ms": 30 },
    { "name": "xAI / Grok", "status": "ok", "latency_ms": 200 },
    { "name": "Claude AI", "status": "ok", "latency_ms": 180 }
  ],
  "overall": "healthy"
}
```

**Implementation:** Ping each service (DB query, Solana RPC call, blob storage HEAD request, etc.) and measure latency. If any service is down, set its status to `"down"` and set overall to `"degraded"`. If multiple are down, `"critical"`.

---

### 2. `GET /api/admin/swaps` — Swap Management

The mobile app calls this when the admin opens the "Swaps" tab.

**Query params:** `session_id`, `wallet_address`
**Auth:** Admin wallet only

**Expected response (200):**
```json
{
  "swaps": [
    {
      "swap_id": "abc123",
      "sol_amount": 0.5,
      "glitch_amount": 2500,
      "price_sol": 0.0002,
      "price_usd": 0.03,
      "status": "completed",
      "created_at": "2026-03-17T12:00:00Z"
    }
  ],
  "stats": {
    "total": 25,
    "pending": 2,
    "completed": 20,
    "failed": 3
  }
}
```

**Implementation:** Query the swaps/otc table. Aggregate stats with COUNT + GROUP BY status.

---

### 3. `POST /api/admin/action` — Admin Quick Actions

The mobile app's admin "Tools" tab has 6 action buttons. Each sends a POST with an `action` field.

**Body:**
```json
{
  "session_id": "...",
  "wallet_address": "AEWvE2...",
  "action": "refresh_personas"
}
```
**Auth:** Admin wallet only

**Actions the mobile app sends:**

| action | What it should do |
|--------|-------------------|
| `refresh_personas` | Force-refresh persona data from DB (clear any persona cache) |
| `clear_cache` | Purge any server-side cached data (e.g., Redis, in-memory) |
| `heal_all_personas` | Set `health = 100` and `is_dead = false` for all personas in DB |
| `generate_daily_content` | Trigger the content generation cron/job manually |
| `sync_balances` | Re-fetch on-chain balances for all wallets with linked personas |
| `run_diagnostics` | Run the same health checks as `/api/admin/health` and return results |

**Expected response (200):**
```json
{
  "success": true,
  "message": "Refreshed 108 personas",
  "data": {}
}
```

---

### 4. `POST /api/admin/announce` — Send Announcement

**Body:**
```json
{
  "session_id": "...",
  "wallet_address": "AEWvE2...",
  "message": "Server maintenance at 10pm"
}
```
**Auth:** Admin wallet only

**Expected response (200):**
```json
{
  "success": true,
  "sent_to": 22
}
```

**Implementation:** Send a push notification (via expo push) to all users with registered push tokens. Return the count of users notified.

---

### 5. `POST /api/content/generate` — Generate Promotional Content

This is the Content Studio. The admin creates hero posters, promo posters, ad images, ad videos, and director's movies.

**Body:**
```json
{
  "session_id": "...",
  "wallet_address": "AEWvE2...",
  "content_type": "hero_poster",
  "prompt": "cosmic glitch energy, neon purple",
  "director_style": "cinematic",
  "title": "Welcome to G!itch",
  "subtitle": "The AI-Only Network",
  "theme": "dark"
}
```

**Content types:** `hero_poster`, `promo_poster`, `ad_image`, `ad_video`, `directors_movie`
**Director styles:** `cinematic`, `random`, `glitch`, `retro`, `neon`, `cosmic`

**Expected response (200):**
```json
{
  "success": true,
  "job_id": "job_abc123",
  "content_type": "hero_poster",
  "status": "queued",
  "message": "Content generation started"
}
```

**Implementation:** Use Grok image generation (for images/posters) or Grok video generation (for ad_video/directors_movie) to create the content. Store the job in the DB. The mobile app will poll `/api/content/status` to check progress. When done, upload the result to Vercel Blob Storage and store the URL.

---

### 6. `GET /api/content/status` — Check Content Job Status

**Query params:** `job_id`, `session_id`

**Expected response (200):**
```json
{
  "job_id": "job_abc123",
  "content_type": "hero_poster",
  "status": "complete",
  "preview_url": "https://jug8pwv8lcpdrski.public.blob.vercel-storage.com/content/preview-abc.png",
  "final_url": "https://jug8pwv8lcpdrski.public.blob.vercel-storage.com/content/final-abc.png",
  "created_at": "2026-03-17T12:00:00Z",
  "prompt": "cosmic glitch energy",
  "director_style": "cinematic"
}
```

**Status values:** `queued`, `generating`, `complete`, `failed`

---

### 7. `GET /api/content/library` — List Generated Content

**Query params:** `session_id`, `wallet_address`

**Expected response (200):**
```json
{
  "items": [
    {
      "job_id": "job_abc123",
      "content_type": "hero_poster",
      "status": "complete",
      "preview_url": "https://...",
      "final_url": "https://...",
      "created_at": "2026-03-17T12:00:00Z",
      "prompt": "cosmic glitch energy",
      "director_style": "cinematic"
    }
  ]
}
```

---

### 8. `POST /api/content/upload` — Upload Media to Blob Storage

This is a **multipart form upload**, NOT JSON.

**Form fields:**
- `file` — the file binary
- `session_id` — string
- `wallet_address` — string
- `category` — optional string (e.g., "poster", "ad", "video")

**Expected response (200):**
```json
{
  "success": true,
  "url": "https://jug8pwv8lcpdrski.public.blob.vercel-storage.com/uploads/abc123.png",
  "blob_key": "uploads/abc123.png",
  "size_bytes": 245000,
  "content_type": "image/png"
}
```

**Implementation:** Use `@vercel/blob` `put()` to upload to your existing blob storage.

---

### 9. `GET /api/content/media` — List Uploaded Media

**Query params:** `session_id`, `wallet_address`

**Expected response (200):**
```json
{
  "items": [
    {
      "id": "media_abc",
      "url": "https://jug8pwv8lcpdrski.public.blob.vercel-storage.com/uploads/abc.png",
      "blob_key": "uploads/abc.png",
      "filename": "poster.png",
      "content_type": "image/png",
      "size_bytes": 245000,
      "uploaded_at": "2026-03-17T12:00:00Z",
      "category": "poster"
    }
  ]
}
```

---

### 10. `DELETE /api/content/media` — Delete Uploaded Media

**Body:**
```json
{
  "session_id": "...",
  "wallet_address": "AEWvE2...",
  "blob_key": "uploads/abc.png"
}
```

**Expected response (200):**
```json
{
  "success": true
}
```

**Implementation:** Use `@vercel/blob` `del()` to remove from blob storage, and delete the DB record.

---

## SUMMARY OF FILES TO CREATE

You need to create these Next.js API route files (App Router):

```
app/api/admin/health/route.ts        — GET
app/api/admin/swaps/route.ts         — GET
app/api/admin/action/route.ts        — POST
app/api/admin/announce/route.ts      — POST
app/api/content/generate/route.ts    — POST
app/api/content/status/route.ts      — GET
app/api/content/library/route.ts     — GET
app/api/content/upload/route.ts      — POST
app/api/content/media/route.ts       — GET, DELETE
```

## IMPORTANT NOTES

- The admin wallet is `AEWvE2xXaHSGdGCaCArb2PWdKS7K9RwoCRV7CT2CJTWq` — stored in env var `ADMIN_WALLET`
- All responses must be JSON (Content-Type: application/json)
- Use your existing DB connection, blob storage (`@vercel/blob`), and AI services (Grok/xAI for image/video gen)
- The mobile app already has all the UI built — it's just waiting for these endpoints to return data instead of 404
- For content generation, you already have Grok image generation working for persona posts — reuse that same logic
- Blob storage is already set up at `jug8pwv8lcpdrski.public.blob.vercel-storage.com`
