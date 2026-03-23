# Backend Prompt: Ad Campaigns for Admin Panel

> Give this complete prompt to the backend AI agent so it can add Ad Campaign functionality to the Admin Panel. The frontend already sends all these fields — the backend just needs to handle them.

---

## Task: Add Ad Campaign Generation to the Admin Panel

The frontend app (React Native/Expo) already has a full Ad Campaign pipeline that works through the `/api/generate-ads` endpoint. Currently only the **frontend Content Studio** (Architect wallet only) can trigger ad campaigns. We need the **Admin Panel** (web dashboard) to have the same power.

### What the Frontend Already Sends

The frontend hits `/api/generate-ads` with these methods:

#### POST (Plan Ad) — `plan_only: true`
```json
{
  "wallet_address": "AEWvE2xXaHSGdGCaCArb2PWdKS7K9RwoCRV7CT2CJTWq",
  "plan_only": true,
  "style": "hype",
  "concept": "Join us on TikTok — swap SOL for $GLITCH now!",
  "target_platforms": ["tiktok", "x", "facebook"],
  "extend_30s": true
}
```

**Expected response:**
```json
{
  "success": true,
  "prompt": "Create a 30-second high-energy hype beast advertisement video...",
  "caption": "Join the $GLITCH revolution on TikTok! Swap SOL for $GLITCH...",
  "style": "hype",
  "concept": "Join us on TikTok..."
}
```

#### PUT (Post Ad to Socials)

**Standard 10s ad:**
```json
{
  "wallet_address": "AEWvE2xXaHSGdGCaCArb2PWdKS7K9RwoCRV7CT2CJTWq",
  "video_url": "https://blob.vercel-storage.com/ads/video-xxx.mp4",
  "caption": "Join the $GLITCH revolution on TikTok!",
  "style": "hype",
  "target_platforms": ["tiktok", "x", "facebook"]
}
```

**30s extended ad (3 clips to stitch):**
```json
{
  "wallet_address": "AEWvE2xXaHSGdGCaCArb2PWdKS7K9RwoCRV7CT2CJTWq",
  "video_url": "https://blob.vercel-storage.com/ads/clip-1.mp4",
  "caption": "Join the $GLITCH revolution on TikTok!",
  "style": "hype",
  "target_platforms": ["tiktok", "x", "facebook"],
  "clip_urls": [
    "https://blob.vercel-storage.com/ads/clip-1.mp4",
    "https://blob.vercel-storage.com/ads/clip-2.mp4",
    "https://blob.vercel-storage.com/ads/clip-3.mp4"
  ]
}
```

**Expected response (backend stitches clip_urls if provided, then posts):**
```json
{
  "success": true,
  "post": { "id": "...", "feedPostId": "...", "caption": "..." },
  "spreading": ["x", "tiktok", "facebook"],
  "stitched_url": "https://blob.vercel-storage.com/ads/ad-xxx-30s.mp4"
}
```

### New Fields to Handle

| Field | Type | Where | Description |
|-------|------|-------|-------------|
| `target_platforms` | `string[]` | POST + PUT | Optional. Array of platform IDs: `"x"`, `"facebook"`, `"tiktok"`, `"instagram"`, `"telegram"`, `"youtube"`. When provided, the ad prompt should include a call-to-action for those platforms (e.g., "Follow AIG!itch on TikTok!"). The PUT (spread) step should prioritize posting to these platforms. |
| `extend_30s` | `boolean` | POST | Optional. When `true`, the `planAd()` prompt should be written for a 30-second ad (3 acts). The frontend generates 3 x 10s clips and sends them as `clip_urls` in the PUT. |
| `clip_urls` | `string[]` | PUT | Optional. Array of 3 clip URLs for 30s ads. **When provided, the backend MUST stitch them into one 30s MP4 using `concatMP4Clips()` before posting.** The `video_url` field is the fallback (clip 1) if stitching fails. |

### Ad Styles (9 total)

| Style ID | Label | Prompt Direction |
|----------|-------|-----------------|
| `auto` | Surprise Me | AI picks the best style — high energy, sell hard |
| `hype` | Hype Beast | Explosive, fast cuts, bass drops, street culture, supreme energy, "DON'T MISS THIS" |
| `cinematic` | Cinematic | Movie-trailer quality, dramatic lighting, epic orchestral, slow-mo reveals |
| `retro` | Retro | VHS grain, 80s/90s nostalgia, synthwave, neon grids, retro-futuristic |
| `meme` | Meme Style | Internet culture, absurd humor, viral-worthy, reaction-bait, chaotic energy |
| `infomercial` | Infomercial | "BUT WAIT THERE'S MORE!", QVC/HSN energy, dramatic demos, call-now urgency |
| `luxury` | Luxury | Premium, gold, champagne, exclusive, velvet, wealth aesthetic |
| `anime` | Anime | Japanese animation style, dynamic action, speed lines, power-up effects |
| `glitch` | Glitch Art | Digital distortion, pixel corruption, cyberpunk, matrix-style, data streams |
| `minimal` | Minimal | Clean, Apple-esque, white space, elegant typography, understated cool |

### Ad Prompt Engineering — CRITICAL

When generating the ad video prompt, the AI MUST:

1. **Always include AIG!itch branding** — The ad is for AI G!itch ($GLITCH token on Solana)
2. **Include platform-specific CTA** when `target_platforms` is provided:
   - X/Twitter: "Follow @aiglitchapp on X"
   - Facebook: "Join the AIG!itch community on Facebook"
   - TikTok: "Follow @aiglitch on TikTok"
   - Instagram: "Follow @aiglitchapp on Instagram"
   - Telegram: "Join the AIG!itch Telegram"
   - YouTube: "Subscribe to AIG!itch on YouTube"
3. **Sell aggressively** — These ads need to convert. Every ad should make the viewer want to:
   - Buy $GLITCH tokens
   - Join the community on the target platform
   - Download/use the AI G!itch app
4. **Match the style** — The visual direction, energy, pacing, and tone must match the selected ad style
5. **Duration matters** — 10s ads should be punchy and fast. 30s ads should build tension, tell a micro-story, and close with a killer CTA

### Prompt Template

```
Create a {duration}-second {style} advertisement video for AI G!itch — the AI companion app on Solana blockchain.

{concept if provided, otherwise: "Promote $GLITCH token — the hottest AI meme coin on Solana. Your AI bestie is waiting."}

BRANDING:
- Product: AI G!itch ($GLITCH)
- Tagline: "Your AI Bestie on Solana"
- Vibe: Futuristic, rebellious, crypto-native, Gen-Z energy
- Colors: Purple, cyan, pink neon on dark backgrounds

{if target_platforms:}
CALL TO ACTION:
{for each platform in target_platforms:}
- "{platform CTA from table above}"
{end}
Show the platform logos/icons prominently in the final 3 seconds.

STYLE: {style description from table above}

{if duration >= 30:}
STRUCTURE (30s extended):
- 0-5s: Hook — grab attention immediately, pattern interrupt
- 5-15s: Build — show the product, demonstrate value, create desire
- 15-25s: Social proof — show community, numbers, trending status
- 25-30s: CTA — platform icons, "Join Now", urgency
{else:}
STRUCTURE (10s):
- 0-3s: Hook — instant attention grab
- 3-7s: Value — what is $GLITCH, why care
- 7-10s: CTA — follow/join/buy NOW
{end}

Make it VIRAL. Make it UNFORGETTABLE. This ad needs to BLOW UP.
```

### Admin Panel UI Requirements

Add an "Ad Campaigns" section to the admin panel with:

1. **Ad Style Picker** — Dropdown or grid of 9 styles (auto, hype, cinematic, retro, meme, infomercial, luxury, anime, glitch, minimal)
2. **Target Platform Selector** — Multi-select checkboxes for: X, Facebook, TikTok, Instagram, Telegram, YouTube
3. **Duration Toggle** — Switch between "10s Standard" and "30s Extended (Grok Extend)"
4. **Concept Input** — Optional textarea for custom ad concept
5. **Launch Button** — Triggers the full pipeline: plan → submit video → poll → post to socials
6. **Progress Log** — Real-time log showing each step (planning, rendering, polling, spreading)
7. **Result Card** — Shows completed ad with video preview, caption, platforms spread to, and social links

### Social Spreading with Target Platforms

When `target_platforms` is provided in the PUT (post) request:
- **Prioritize** posting to those platforms first
- **Include platform-specific hashtags**: `#AIGlitch #GLITCH #Solana #CryptoAI` + platform-specific ones
- **Tailor the caption** per platform (shorter for X/280 chars, longer for Facebook, TikTok-style for TikTok)
- **Always** also post to the AIG!itch feed and Marketplace QVC channel regardless of target platforms

### Grok 30-Second Extend (3 x 10s Clip Pipeline)

**IMPORTANT:** Grok Video API has a **maximum duration of 15 seconds per clip**. You CANNOT pass `duration: 30` — it will return HTTP 400.

**How it works — frontend generates clips, backend stitches:**

1. **Frontend** generates 3 x 10s clips via `POST /api/test-grok-video` (duration: 10 each):
   - Clip 1 (HOOK): Attention grab, pattern interrupt
   - Clip 2 (BUILD): "Continuing seamlessly...", product value, social proof
   - Clip 3 (CTA): "Continuing seamlessly...", platform CTAs, urgency, logo
2. **Frontend** sends all 3 clip URLs in the PUT request as `clip_urls: [url1, url2, url3]`
3. **Backend** receives `clip_urls`, stitches them using `concatMP4Clips()`, uploads the final 30s MP4, then posts

**CRITICAL: Backend PUT handler must check for `clip_urls`:**
```javascript
// In /api/generate-ads PUT handler:
if (clip_urls && clip_urls.length > 1) {
  // Download all clips as buffers
  const buffers = await Promise.all(clip_urls.map(url => fetch(url).then(r => r.arrayBuffer()).then(Buffer.from)));
  // Stitch into one MP4
  const stitched = concatMP4Clips(buffers);
  // Upload to blob storage
  const { url: stitchedUrl } = await put(`ads/ad-${uuid}-30s.mp4`, stitched, { access: 'public' });
  // Use stitchedUrl as the video to post to socials
  videoUrlToPost = stitchedUrl;
} else {
  videoUrlToPost = video_url;
}
```

**Existing code to reuse:**
- `concatMP4Clips()` in `src/lib/media/mp4-concat.ts` — stitches N MP4 buffers into one
- `/api/admin/extend-video/route.ts` — working reference for stitch logic
- `/api/admin/elon-campaign/route.ts` — another working 30s video reference

**Storage:**
- Individual clips: `ads/clip-{uuid}-1.mp4`, `ads/clip-{uuid}-2.mp4`, `ads/clip-{uuid}-3.mp4`
- Final stitched: `ads/ad-{uuid}-30s.mp4`
- All via `@vercel/blob put()`

**Cost:** ~$0.50 per 10s clip = ~$1.50 for a 30s ad video

**Timeout:** The PUT handler needs `maxDuration = 300` (5 minutes) since stitching 3 clips takes time. The frontend sends `timeoutMs: 180000` (3 min).

### Database / Storage

- All ad videos go to blob storage folder: `ads/`
- Track ad campaigns in whatever ad/content table exists
- Store: `style`, `concept`, `target_platforms[]`, `duration`, `video_url`, `caption`, `spreading[]`, `created_at`
- This data powers the admin panel's ad history view

---

**TL;DR**: The frontend already sends `target_platforms` (array of platform IDs) and `extend_30s` (boolean) to `/api/generate-ads`. The backend needs to:
1. Use `target_platforms` to add platform-specific CTAs to the video prompt
2. Use `target_platforms` to prioritize social spreading to those platforms
3. Use `extend_30s` to generate 30-second ads via Grok Extend instead of 10-second ones
4. Expose the same functionality in the Admin Panel web UI
