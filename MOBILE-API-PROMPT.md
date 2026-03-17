I have a separate project — a React Native / Expo mobile app called "G!itch Bestie" — that connects to THIS backend (aiglitch.app). The mobile app is already built and working, but it's calling several API endpoints that don't exist yet on this backend. I need you to CREATE these missing API route files.

CRITICAL SAFETY RULES:
- DO NOT modify, rename, refactor, or delete ANY existing files or routes
- DO NOT change any existing API endpoint behavior
- ONLY create NEW route files in the locations specified below
- Use the same patterns, DB helpers, auth checks, and imports that already exist in this codebase
- Look at existing routes like app/api/admin/stats/route.ts and app/api/admin/personas/route.ts to match the code style and auth pattern
- Before creating each file, check if the file already exists — if it does, skip it

ADMIN AUTH:
All admin endpoints must check wallet_address against the ADMIN_WALLET env var. Look at how app/api/admin/stats/route.ts does its auth check and copy that exact pattern. The admin wallet is AEWvE2xXaHSGdGCaCArb2PWdKS7K9RwoCRV7CT2CJTWq. Return 403 JSON if unauthorized.

EXISTING ROUTES THAT ALREADY WORK (DO NOT TOUCH THESE):
- /api/otc-swap (GET config, POST create/confirm/submit)
- /api/solana (GET balance, POST link_phantom)
- /api/partner/bestie (GET)
- /api/partner/briefing (GET)
- /api/messages (GET, POST, PATCH)
- /api/auth/human (POST)
- /api/admin/stats (GET)
- /api/admin/personas (GET)
- /api/admin/users (GET)
- /api/voice (POST)
- /api/transcribe (POST)

---

HERE ARE THE 9 NEW ROUTE FILES TO CREATE:

FILE 1: app/api/admin/health/route.ts
Method: GET
Query params: session_id, wallet_address
Auth: Admin wallet only
Purpose: The mobile app's admin panel has a "System" tab that shows service health status.
What to do: Ping each backend service (database, Solana RPC, blob storage, xAI/Grok API, Claude API) and measure response time in milliseconds. Return the status of each service.
Response format:
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
Status should be "ok" or "down". Overall should be "healthy", "degraded" (1 service down), or "critical" (2+ down). If a ping fails, catch the error, set status to "down", and set latency_ms to null.

---

FILE 2: app/api/admin/swaps/route.ts
Method: GET
Query params: session_id, wallet_address
Auth: Admin wallet only
Purpose: Mobile app admin "Swaps" tab shows all OTC swap history and aggregate stats.
What to do: Query the swaps/OTC table for all swap records. Also compute aggregate stats (total count, pending count, completed count, failed count).
Response format:
{
  "swaps": [
    { "swap_id": "abc", "sol_amount": 0.5, "glitch_amount": 2500, "price_sol": 0.0002, "price_usd": 0.03, "status": "completed", "created_at": "2026-03-17T12:00:00Z" }
  ],
  "stats": { "total": 25, "pending": 2, "completed": 20, "failed": 3 }
}

---

FILE 3: app/api/admin/action/route.ts
Method: POST
Body: { session_id, wallet_address, action, ...params }
Auth: Admin wallet only
Purpose: Mobile app admin "Tools" tab has quick action buttons. Each sends a different action string.
Actions to handle:
- "refresh_personas" — Clear any persona cache, re-query personas from DB. Return count.
- "clear_cache" — Purge any server-side caches (in-memory, Redis if used). Return confirmation.
- "heal_all_personas" — UPDATE all personas SET health = 100, is_dead = false. Return count of rows updated.
- "generate_daily_content" — Trigger whatever content generation cron/job exists. If no cron exists, just return a message saying it was triggered.
- "sync_balances" — For each persona with an owner_wallet_address, re-fetch their on-chain balances. Return count synced.
- "run_diagnostics" — Run the same health checks as /api/admin/health and return results in the data field.
- For any unknown action, return { success: false, message: "Unknown action: <action>" }
Response format: { "success": true, "message": "Healed 108 personas", "data": {} }

---

FILE 4: app/api/admin/announce/route.ts
Method: POST
Body: { session_id, wallet_address, message }
Auth: Admin wallet only
Purpose: Send a push notification to all registered users.
What to do: Query for all stored expo push tokens, send the announcement message via Expo Push API (https://exp.host/--/api/v2/push/send). Return count of users notified.
Response format: { "success": true, "sent_to": 22 }

---

FILE 5: app/api/content/generate/route.ts
Method: POST
Body: { session_id, wallet_address, content_type, prompt, director_style, title, subtitle, theme }
Auth: Admin wallet only
Content types: "hero_poster", "promo_poster", "ad_image", "ad_video", "directors_movie"
Director styles: "cinematic", "random", "glitch", "retro", "neon", "cosmic"
Purpose: Generate promotional content using AI image/video generation.
What to do: For image types (hero_poster, promo_poster, ad_image), use the same Grok/xAI image generation that already works for persona posts. For video types (ad_video, directors_movie), use Grok video generation if available, or return queued status. Store the job in the DB with a unique job_id, content_type, status, prompt, and director_style. Upload completed results to Vercel Blob Storage.
Response format: { "success": true, "job_id": "job_abc123", "content_type": "hero_poster", "status": "queued", "message": "Content generation started" }

---

FILE 6: app/api/content/status/route.ts
Method: GET
Query params: job_id, session_id
Purpose: Mobile app polls this to check if content generation is done.
What to do: Look up the job by job_id in the DB and return its current status.
Response format: { "job_id": "job_abc123", "content_type": "hero_poster", "status": "complete", "preview_url": "https://...", "final_url": "https://...", "created_at": "...", "prompt": "...", "director_style": "cinematic" }
Status values: "queued", "generating", "complete", "failed"

---

FILE 7: app/api/content/library/route.ts
Method: GET
Query params: session_id, wallet_address
Purpose: List all previously generated content jobs.
What to do: Query the content jobs table ordered by created_at DESC.
Response format: { "items": [ { job_id, content_type, status, preview_url, final_url, created_at, prompt, director_style } ] }

---

FILE 8: app/api/content/upload/route.ts
Method: POST
Content-Type: multipart/form-data (NOT JSON)
Form fields: file (binary), session_id, wallet_address, category (optional)
Purpose: Upload media files (images, videos) to Vercel Blob Storage.
What to do: Use @vercel/blob put() to upload the file. Store a record in the DB with the blob URL, key, filename, size, content type, and category.
Response format: { "success": true, "url": "https://jug8pwv8lcpdrski.public.blob.vercel-storage.com/uploads/abc.png", "blob_key": "uploads/abc.png", "size_bytes": 245000, "content_type": "image/png" }

---

FILE 9: app/api/content/media/route.ts
Methods: GET and DELETE
GET query params: session_id, wallet_address
DELETE body: { session_id, wallet_address, blob_key }
Purpose: List uploaded media files and delete them.
GET response: { "items": [ { id, url, blob_key, filename, content_type, size_bytes, uploaded_at, category } ] }
DELETE response: { "success": true }
For DELETE, use @vercel/blob del() to remove from storage and delete the DB record.

---

DB TABLES: If you need new database tables for content jobs or uploaded media, create them. You probably need:
1. A "content_jobs" table (job_id, content_type, status, prompt, director_style, preview_url, final_url, wallet_address, created_at, updated_at, error)
2. An "uploaded_media" table (id, url, blob_key, filename, content_type, size_bytes, category, wallet_address, uploaded_at)

Check if these tables already exist before creating migration SQL.

TESTING: After creating all routes, verify each one responds with JSON (not HTML 404). A simple curl test for each GET endpoint should return valid JSON.
