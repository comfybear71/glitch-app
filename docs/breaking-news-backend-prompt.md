# Breaking News Broadcast — Backend Implementation Prompt

## Overview

The mobile app has a full Breaking News UI that generates 9-clip news broadcasts. It relies on backend endpoints for the generation pipeline. Here is everything the backend needs to support.

## What the Frontend Does

The user picks up to 3 news topics from 18 presets, optionally types a custom topic, and taps "Go Live". The frontend runs this pipeline:

1. **Fetch briefing** — `GET /api/partner/briefing` — gets real current events
2. **Generate screenplay** — `POST /api/admin/screenplay` with `genre: "news"` — AI writes a 9-scene broadcast script
3. **Submit 9 clips** — `POST /api/test-grok-video` (once per scene) — sends each video prompt to Grok
4. **Poll clips** — `GET /api/test-grok-video?id={requestId}` — polls every 10s until done/failed
5. **Stitch** — `PUT /api/generate-director-movie` — combines clips into final broadcast video, creates feed post, spreads to socials
6. **Route to GNN** — `POST /api/admin/spread` with `channel_id: "ch-gnn"` — all breaking news goes to the GNN channel

---

## News Topic Presets (18 options, user picks up to 3)

| ID | Label | Emoji |
|----|-------|-------|
| `global` | Global News | 🌍 |
| `finance` | Finance | 💰 |
| `sport` | Sport | ⚽ |
| `tech` | Tech | 💻 |
| `politics` | Politics | 🏛 |
| `crypto` | Crypto & Web3 | 🪙 |
| `glitch_coin` | $GLITCH Coin | ⚡ |
| `science` | Science | 🔬 |
| `entertainment` | Entertainment | 🎬 |
| `weather` | Weather | 🌪 |
| `health` | Health | 🏥 |
| `crime` | Crime | 🚨 |
| `war` | War & Conflict | ⚔ |
| `good_news` | Good News | 😊 |
| `bizarre` | Bizarre | 🤯 |
| `local` | Local Events | 📍 |
| `business` | Business | 📈 |
| `environment` | Environment | 🌱 |

These get combined into a topic string like `"Finance, Tech — AI companies reporting record earnings"` and injected into the screenplay concept.

---

## Endpoint 1: Briefing — `GET /api/partner/briefing`

Returns real current events for the AI to base news stories on.

**Response:**
```json
{
  "topics": [
    { "headline": "...", "summary": "...", "mood": "...", "category": "..." }
  ],
  "trending": [
    { "id": "...", "content": "...", "display_name": "...", "username": "...", "ai_like_count": 0, "comment_count": 0 }
  ],
  "stats": { "posts_today": 0, "active_personas": 0 },
  "notifications": []
}
```

The frontend takes the first 4 topics and 3 trending posts and injects them into the concept as source material. The AI must use real events but change all names/places/brands into funny alternatives (anagrams, puns, sci-fi twists).

---

## Endpoint 2: Screenplay — `POST /api/admin/screenplay`

**Request:**
```json
{
  "genre": "news",
  "concept": "<the full news broadcast concept — see below>"
}
```
**Headers:** `X-Wallet-Address: <admin_wallet>`

**Must return exactly 9 scenes in this order:**

| Clip | Duration | Title | What Happens |
|------|----------|-------|-------------|
| 1 | 6s | AIG!ITCH NEWS INTRO | Network opening — logo, globe, breaking news graphics, ticker bar |
| 2 | 10s | NEWS DESK - STORY 1 | Anchor introduces Story 1, hands off to field reporter |
| 3 | 10s | FIELD REPORT - STORY 1 | Reporter on location, speaking extensively about Story 1 |
| 4 | 10s | NEWS DESK - STORY 2 | Anchor acknowledges Reporter 1, introduces Story 2 |
| 5 | 10s | FIELD REPORT - STORY 2 | Different reporter, different location, Story 2 |
| 6 | 10s | NEWS DESK - STORY 3 | Anchor with urgency introduces breaking Story 3 |
| 7 | 10s | FIELD REPORT - STORY 3 | Third reporter, most dramatic/urgent report |
| 8 | 10s | NEWS DESK WRAP-UP | Anchor summarizes all 3 stories, references all reporters by name, signs off |
| 9 | 10s | AIG!ITCH NEWS OUTRO | Closing credits, logo, "24/7 LIVE NEWS", social handles |

**Response (type ScreenplayResponse):**
```json
{
  "title": "AIG!itch News: Crisis at the Quantum Factory",
  "tagline": "...",
  "synopsis": "...",
  "genre": "news",
  "director": "AIG!itch News",
  "directorName": "AIG!itch News",
  "directorId": "aiglitch-news",
  "castList": ["Anchor Name", "Reporter 1", "Reporter 2", "Reporter 3"],
  "screenplayProvider": "grok",
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "AIG!ITCH NEWS INTRO",
      "description": "...",
      "videoPrompt": "Professional news network opening sequence. Bold AIG!ITCH NEWS logo...",
      "duration": 6
    },
    {
      "sceneNumber": 2,
      "title": "NEWS DESK - STORY 1",
      "description": "...",
      "videoPrompt": "A news anchor sits behind a professional news desk...",
      "duration": 10
    }
  ]
}
```

---

## The Full News Broadcast Concept (what the frontend sends as `concept`)

This is the exact concept string the frontend builds and sends. The backend's screenplay generator must understand and follow this format:

```
AIG!ITCH NEWS — LIVE NEWS BROADCAST.
This is a real news broadcast like CNN, BBC, Fox News, or Al Jazeera — NOT a movie.
It must feel like actual television news.
9 clips total. Clip 1 is 6 seconds (intro). All other clips are 10 seconds each.

CONTENT RULE: All stories are based on REAL current events (specifically: {topicText}).
The news is REAL — the facts, events, and what happened are all accurate.
But ALL names of people, places, companies, and brands are changed into
funny/whimsical alternatives (anagrams, puns, sci-fi twists, absurd mashups).
The events stay true, only proper nouns change.

{briefingContext — real headlines and trending posts from /api/partner/briefing}

BRANDING: "AIG!itch News" must appear constantly — on screen graphics, lower thirds,
microphone flags, backdrop logos, watermarks. Subliminal AIG!itch branding everywhere.

CLIP STRUCTURE (MUST follow this EXACT order):

Clip 1 (6 seconds) — AIG!ITCH NEWS INTRO: Professional news network opening sequence.
Bold "AIG!ITCH NEWS" logo with dramatic news-style music energy (think CNN/BBC opening
titles). Breaking news graphics, spinning globe or world map, news ticker bar at bottom.
Fast cuts of newsroom footage. Text: "LIVE" and "BREAKING NEWS".

Clip 2 (10 seconds) — NEWS DESK - STORY 1: A news anchor sits behind a professional
news desk with "AIG!ITCH NEWS" logo on the wall. The anchor looks directly at camera:
"Good evening, I'm [anchor name], and this is AIG!itch News. We begin tonight with
breaking developments in [Story 1 topic]..." Brief summary, then: "For more on this,
we go LIVE to [reporter name] who is at the scene." Lower-third graphic with anchor name
and "AIG!ITCH NEWS ANCHOR". News ticker at bottom.

Clip 3 (10 seconds) — FIELD REPORT - STORY 1: Field reporter facing camera, holding
microphone with AIG!itch News mic flag. ON LOCATION — event visible BEHIND them.
Reporter SPEAKS EXTENSIVELY — specific details, numbers, scale, impact, quotes witnesses.
Dialogue is the MAIN FOCUS. Finishes: "Back to you, [anchor name]."

Clip 4 (10 seconds) — NEWS DESK - STORY 2: Anchor responds: "Thank you, [reporter 1].
Incredible scenes there." Transitions: "Now, turning to [Story 2 topic]..." Hands off:
"Our correspondent [reporter 2] is live at [location]." Different headline graphics.

Clip 5 (10 seconds) — FIELD REPORT - STORY 2: DIFFERENT reporter, DIFFERENT location.
Speaks at length, references anchor, adds new information: "As [anchor] mentioned...
but what we're seeing here..." Ends: "Reporting live from [location], back to you."

Clip 6 (10 seconds) — NEWS DESK - STORY 3: Anchor: "Thank you, [reporter 2]. Important
developments." With urgency: "And in breaking news just coming in to us now..."
Introduces Story 3. Hands off to Reporter 3.

Clip 7 (10 seconds) — FIELD REPORT - STORY 3: THIRD reporter, THIRD location.
Most dramatic/urgent. Energy and urgency, vivid detail, quotes sources.
Finishes: "A developing story. Back to you in the studio."

Clip 8 (10 seconds) — NEWS DESK WRAP-UP: Anchor ties all 3 stories together,
references ALL reporters by name. Signs off: "For AIG!itch News, I'm [anchor name].
Stay informed, stay glitched. Goodnight."

Clip 9 (10 seconds) — AIG!ITCH NEWS OUTRO: Closing credits. "AIG!ITCH NEWS" logo,
news ticker, "24/7 LIVE NEWS", social handles. Professional sign-off.

CRITICAL STYLE NOTES:
- This is NEWS, not a movie. No cinematic camera work. Think real TV news.
- Field reporters MUST face the camera holding a microphone. Event BEHIND them.
- News desk = real studio with screens/monitors, professional lighting.
- AIG!itch News branding on EVERYTHING: desk, backdrop, mic flags, lower thirds, ticker.
```

---

## Endpoint 3: Submit Video Clips — `POST /api/test-grok-video`

Called once per scene (9 times total).

**Request:**
```json
{
  "prompt": "<scene.videoPrompt from screenplay>",
  "duration": 10,
  "folder": "premiere/news"
}
```
**Headers:** `X-Wallet-Address: <admin_wallet>`

**Response:**
```json
{ "success": true, "requestId": "grok-video-request-id" }
```

**Notes:**
- Clip 1 (intro) is 6 seconds, all others 10 seconds
- Grok Video API max is 15s per clip — NEVER send `duration > 15`
- Store rendered videos in `premiere/news` folder in Vercel Blob

---

## Endpoint 4: Poll Video Clips — `GET /api/test-grok-video`

**Request:** `GET /api/test-grok-video?id={requestId}&folder=premiere/news&skip_post=true`

**Headers:** `X-Wallet-Address: <admin_wallet>`

**Response:**
```json
{
  "phase": "done",
  "success": true,
  "status": "done",
  "blobUrl": "https://blob.vercel-storage.com/...",
  "videoUrl": "https://...",
  "sizeMb": 2.5
}
```

**Statuses:**
- `pending` — still rendering
- `done` — video ready, `blobUrl` populated
- `failed` — generation failed
- `moderation_failed` — content flagged
- `expired` — request timed out

**Frontend behavior:**
- Polls every 10 seconds
- Up to 90 poll cycles (15 minutes max)
- Stall detection: if 50%+ clips done and no new clip finishes for 60s, stitch with what's available

---

## Endpoint 5: Stitch — `PUT /api/generate-director-movie`

Combines all completed clips into one final broadcast video.

**Request:**
```json
{
  "sceneUrls": { "1": "https://blob...", "2": "https://blob...", "3": "...", ... },
  "title": "AIG!itch News: Crisis at the Quantum Factory",
  "genre": "news",
  "directorUsername": "AIG!itch News",
  "directorId": "aiglitch-news",
  "synopsis": "...",
  "tagline": "...",
  "castList": ["Anchor Name", "Reporter 1", "Reporter 2", "Reporter 3"]
}
```

**Response:**
```json
{
  "action": "stitched",
  "feedPostId": "post-uuid",
  "premierePostId": "premiere-uuid",
  "directorMovieId": "movie-uuid",
  "finalVideoUrl": "https://blob.../final-stitched.mp4",
  "sizeMb": "15.2",
  "clipCount": 9,
  "spreading": ["x", "tiktok", "instagram", "facebook", "youtube"]
}
```

**The stitch endpoint MUST:**
- Concatenate clips in scene number order (1 through 9) into a single MP4
- Create a feed post with caption: `"BREAKING: {title}\n{synopsis}"`
- Spread to all 5 social platforms (X, TikTok, Instagram, Facebook, YouTube)
- Store final video in `premiere/news` folder in Vercel Blob
- Return `feedPostId` so the frontend can verify social links
- Return `spreading` array so the frontend can show which platforms received the content

---

## Endpoint 6: Spread to GNN Channel — `POST /api/admin/spread`

After stitching, the frontend explicitly routes the broadcast to the GNN channel:

**Request:**
```json
{
  "text": "BREAKING: {title}\n{synopsis}",
  "media_url": "{finalVideoUrl}",
  "media_type": "video",
  "channel_id": "ch-gnn",
  "wallet_address": "...",
  "platforms": ["x", "tiktok", "instagram", "facebook", "youtube"]
}
```

All breaking news gets published to the **GNN channel** (`ch-gnn` — Glitch News Network).

---

## Autopilot Integration

Breaking news has **15% weight** in the autopilot content distribution:

```
35% channels
20% movies
15% breaking_news
15% ads
 8% posters
 7% heroes
```

When autopilot picks `breaking_news`, it calls `runNewsGeneration(walletAddress)` with **no topic** — the AI picks topics automatically from the briefing data.

---

## Backend Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/partner/briefing` | GET | Return real current events (headlines + trending posts) |
| `/api/admin/screenplay` | POST | Generate 9-scene news screenplay from concept (`genre: "news"`) |
| `/api/test-grok-video` | POST | Submit video prompt to Grok, return requestId |
| `/api/test-grok-video` | GET | Poll requestId for rendering status + blobUrl when done |
| `/api/generate-director-movie` | PUT | Stitch clips into final MP4, create feed post, spread to socials |
| `/api/admin/spread` | POST | Route content to GNN channel + social platforms |

---

## Key Implementation Notes

1. **The screenplay endpoint is the critical piece** — it must understand `genre: "news"` and produce exactly 9 scenes following the clip structure above
2. **Scene order matters** — clips must be stitched in sceneNumber order (1-9) for the broadcast to make sense
3. **All clips go to `premiere/news` folder** in Vercel Blob storage
4. **Director fields for news** should default to `director: "AIG!itch News"`, `directorId: "aiglitch-news"`
5. **The briefing data powers the content** — without real current events from `/api/partner/briefing`, the AI will generate generic news. The briefing endpoint should return actual headlines
6. **Instagram needs proxy** — when spreading to Instagram, video URLs must go through `/api/video-proxy` (the backend should handle this automatically)
7. **Sponsor product placements** — if `injectCampaignPlacement()` is active, branded products should appear in the news broadcast scenes (e.g., product visible on the news desk, reporter holding branded item)
