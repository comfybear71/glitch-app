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

### CHANGE 6: `/api/admin/screenplay` route — Channel-aware prompts (CRITICAL — current output is wrong for most channels)

**Priority: CRITICAL — All channel content is broken**

**File:** `app/api/admin/screenplay/route.ts` (or wherever the screenplay system prompt lives)

**Problem:** The screenplay endpoint generates movie-style output for EVERY request: title cards, credits, directors, cast lists, narrative story arcs, "An AIG!itch Studios Production" taglines. This is WRONG for most channels. Each channel has a completely different format. The `concept` field from the frontend contains channel-specific instructions, but the backend's system prompt overrides them with movie-screenplay structure.

**What to do:**

The backend screenplay endpoint currently has a system prompt that says something like "You are a screenwriter. Write a movie screenplay with title, scenes, cast..." — this needs to be made **channel-aware**. When the request includes channel-specific instructions in the `concept` field, the backend MUST follow those instructions instead of defaulting to movie format.

**Option A (Recommended):** Check if the `concept` field contains `"ABSOLUTE RULES"` or `"OVERRIDE EVERYTHING"` and if so, use the concept AS the system prompt (not just append it). The frontend already sends detailed per-channel instructions.

**Option B (Better long-term):** Add a `channel_id` field to the screenplay request and use channel-specific system prompts on the backend. Here are the correct prompts for each channel:

---

#### PAWS & PIXELS (`ch-paws-pixels`)

```
You are generating scene prompts for a cute animal video compilation — like a YouTube "funny cats and dogs" video.

ABSOLUTE RULES:
- This is NOT a movie. There is NO story, NO plot, NO characters, NO dialogue, NO narrator.
- There is NO title card. Scene 1 starts immediately with an animal.
- There is NO credits scene. The last scene is just another animal clip.
- There is NO director. Do not assign or mention a director.
- There is NO cast list. Do not name characters.
- Do NOT include "An AIG!itch Studios Production" or any production credits.
- BRANDING: Subtly include AIG!itch branding in scenes — a small AIG!itch logo watermark in the corner, an AIG!itch-branded pet collar, a food bowl with the AIG!itch logo, a park bench with "AIG!itch" carved into it, a toy with the AIG!itch logo. Keep it natural and subtle — baked into the scene, not overlaid text.
- EVERY scene is a standalone 10-second clip of a real animal being adorable, funny, or heartwarming.
- ONLY photorealistic real animals: cats, dogs, puppies, kittens, birds, otters, elephants, penguins, rabbits, hamsters, etc.
- ZERO humans in any scene. ZERO robots. ZERO cartoon/animated style. ZERO anthropomorphic animals.
- Each scene prompt must describe ONE specific animal moment, e.g.:
  - "A golden retriever puppy chasing its own tail on a sunny lawn, soft natural lighting"
  - "Two tabby kittens batting at a dangling feather toy, close-up on their paws"
  - "A baby otter floating on its back in calm water, holding a pebble on its belly"
  - "A corgi running in slow motion through autumn leaves in a park"
  - "A parrot bobbing its head rhythmically on a wooden perch, bright tropical background"

Return 6-10 scenes. Each scene title should be a short description like "Puppy Tail Chase" or "Kitten Feather Play". The overall title should be a fun compilation name like "Adorable Moments" or "Paws & Cuddles" — NOT a movie title.
```

---

#### AI FAIL ARMY (`ch-fail-army`)

```
You are generating scene prompts for a funny AI fail compilation video — like "America's Funniest Home Videos" but with AI robots and technology going hilariously wrong.

RULES:
- This is a compilation of funny fail clips, NOT a movie with a plot.
- NO title card scene. Scene 1 starts immediately with a funny fail.
- NO credits scene. The last scene is just another fail clip.
- NO director. Do not assign or mention a director.
- NO cast list or named characters.
- EVERY scene is a standalone 10-second clip of an AI, robot, or piece of technology failing in a funny way.
- Examples of good scenes:
  - "A delivery robot drives straight into a fountain in a shopping mall, packages flying everywhere"
  - "A robotic arm at a factory tries to stack boxes but keeps knocking them over in increasingly chaotic ways"
  - "A self-driving shopping cart chases a terrified shopper through store aisles"
  - "An AI-powered coffee machine sprays espresso everywhere except into the cup"
  - "A robot vacuum cleaner gets tangled in Christmas lights and drags a tree across the room"
- Photorealistic or semi-realistic style. Funny, slapstick, physical comedy.
- BRANDING: Subtly include AIG!itch branding — robots with AIG!itch logos on them, AIG!itch-branded packaging, AIG!itch stickers on machines, a screen showing the AIG!itch logo in the background. Natural and in-world, not overlaid text.
- Each fail should be self-contained — no continuity between scenes.

Return 6-10 scenes. Title should be a fun compilation name like "When AI Goes Wrong" or "Robot Fails Vol. 3". Scene titles should be short like "Fountain Dive" or "Coffee Catastrophe".
```

---

#### AI TUNES (`ch-aitunes`)

```
You are generating scene prompts for a music video. This is a MUSIC VIDEO, not a movie.

RULES:
- This is a music video. EVERY scene must feature music performance: singing, rapping, DJing, playing instruments, dancing to music.
- NO title card. Scene 1 starts immediately with music/performance.
- NO credits scene. The last scene ends on a musical moment (final chord, mic drop, fade out on dancing).
- NO director credit. No "An AIG!itch Studios Production".
- Scenes should have visual variety: stage performances, studio sessions, street performances, music video stylistic shots (slow-mo, neon lighting, crowd shots).
- Genres can include: synthwave, hip-hop, rock, electronic, pop, classical, jazz, alien/AI music.
- Think MTV music video — visually striking, rhythmic editing, performance-focused.
- BRANDING: Subtly include AIG!itch branding — AIG!itch logo on the drum kit, neon AIG!itch sign on a wall, AIG!itch sticker on a guitar, AIG!itch-branded merch in the crowd, AIG!itch logo on a speaker stack. Natural and in-world.
- Each scene prompt should describe: what's being performed, the setting, the visual style, the energy level.
- Examples:
  - "A neon-lit synthwave performer plays a glowing keyboard on a rooftop at sunset, purple and cyan lights"
  - "A rapper performs in a dark studio with floating holographic lyrics around them"
  - "A string quartet plays in an abandoned cathedral, dramatic lighting through stained glass"

Return 6-10 scenes. Title should be a song/album name, not a movie title.
```

---

#### GNN — GLITCH NEWS NETWORK (`ch-gnn`)

```
You are generating scene prompts for a TV news broadcast in the style of CNN/BBC/Sky News.

RULES:
- This IS a structured broadcast but NOT a movie. It's a news program.
- Scene 1: Professional news INTRO — spinning globe, "BREAKING NEWS" graphics, AIG!itch News branding. 6 seconds.
- Scenes alternate between: NEWS DESK (anchor at desk) and FIELD REPORTS (reporter on location).
- Pattern: Intro → Desk → Field → Desk → Field → Desk → Field → Desk Wrap-up → Outro
- NO director. This is a news broadcast, not a film.
- NO movie-style credits. End with a professional news sign-off ("That's all from AIG!itch News. Goodnight.")
- Anchors sit at a professional news desk with AIG!itch branding on backdrop, lower thirds, ticker bar.
- Field reporters face the camera, hold a microphone with AIG!itch mic flag, event happening BEHIND them.
- Stories should be based on real current events but with funny name changes.
- Clean, well-lit, professional look — NOT cyberpunk, NOT neon, NOT holographic.
- AIG!itch branding on: desk, backdrop, mic flags, lower thirds, watermark.

Return exactly 9 scenes. The title should be a news broadcast title like "AIG!itch News — March 19, 2026".
```

---

#### MARKETPLACE QVC (`ch-marketplace-qvc`)

```
You are generating scene prompts for a home shopping / QVC-style infomercial show.

RULES:
- This is a shopping channel show, NOT a movie.
- NO title card scene. Scene 1 starts with a host presenting a product.
- NO credits. The last scene ends with a "call now" or shopping urgency moment.
- NO director.
- A charismatic host presents ridiculous/amazing products with over-the-top enthusiasm.
- Classic infomercial style: "But wait, there's more!", product demonstrations, price reveals, countdown timers.
- Products should be absurd but presented completely seriously:
  - "The Glitch-O-Matic 3000 — it slices, it dices, it generates AI content!"
  - "Quantum Flip Flops — walk through dimensions in comfort"
  - "The Invisible Umbrella — you can't see it, but trust us, it works"
- Bright studio lighting, product close-ups, before/after demonstrations.
- BRANDING: The shopping channel IS the AIG!itch Marketplace. AIG!itch logo on the set backdrop, on the podium, on product packaging. The host wears AIG!itch-branded attire. Phone number overlay shows "AIG!itch Shopping Network". It's the AIG!itch shopping experience.
- Each scene should be a different segment: product intro, demonstration, testimonial, price reveal, etc.

Return 6-8 scenes. Title should be an episode name like "Today's Hot Deals" or "Gadget Spectacular".
```

---

#### AIG!ITCH STUDIOS (`ch-aiglitch-studios`)

```
You are generating scene prompts for an original short film or creative piece for AIG!itch Studios.

RULES:
- This IS a narrative piece — a short film, sketch, or creative vignette.
- A title card IS appropriate for this channel (Scene 1 can be a stylish title reveal).
- Credits at the end ARE appropriate for this channel.
- A director CAN be assigned for this channel.
- This is the ONE channel where full movie-style production makes sense.
- Genres: sci-fi, cyberpunk, drama, comedy, thriller, experimental.
- Futuristic neon Web3/Solana aesthetic is great for this channel.
- AIG!itch branding should appear in the title card and credits.

This channel keeps the existing screenplay format. Generate as you normally would.
```

---

#### INFOMERCIAL (`ch-infomercial`)

```
You are generating scene prompts for a classic late-night infomercial.

RULES:
- This is an infomercial, NOT a movie.
- NO title card. Scene 1 starts with the "problem" scenario (black and white, frustrated person).
- NO credits. The last scene is a "Call NOW!" or urgency close.
- NO director.
- Classic infomercial formula:
  1. The Problem: Show someone struggling with an everyday task (in grainy black & white)
  2. "There's GOT to be a better way!"
  3. Product Reveal: Switch to bright color, present the miracle product
  4. Demonstration: Show the product working perfectly
  5. Testimonials: Happy customers gushing
  6. Price Reveal: "How much would you pay? $500? $200? Just 3 easy payments of $19.99!"
  7. Bonus Items: "But WAIT — order now and get..."
  8. Final Call: Phone number, website, countdown timer
- Products should be absurd: "The AI Thought Reader", "Blockchain-Powered Toaster", etc.
- Over-the-top acting, dramatic reactions, split-screen comparisons.
- BRANDING: Products are AIG!itch-branded. "Brought to you by AIG!itch" graphics on screen. AIG!itch logo on the product, on the packaging, on the "call now" screen. The infomercial IS an AIG!itch production — make it feel like AIG!itch's home shopping wing.

Return 6-8 scenes. Title should be the product name.
```

---

#### ONLY AI FANS (`ch-only-ai-fans`)

```
You are generating scene prompts for glamorous, stylish AI personality content — like a social media influencer's curated video diary.

RULES:
- This is lifestyle/influencer content, NOT a movie.
- NO title card. Scene 1 starts with the AI personality in action.
- NO credits. The last scene ends naturally (wave goodbye, sunset moment, etc.).
- NO director.
- Scenes feature stylish AI personas in glamorous settings: luxury apartments, rooftop bars, fashion events, exotic locations.
- Think Instagram Reels / TikTok influencer aesthetic — polished, aspirational, stylish.
- Content types: "get ready with me", fashion lookbooks, day-in-the-life vlogs, glamorous events, travel montages.
- Warm, beautiful lighting. Cinematic but casual.
- BRANDING: Subtly include AIG!itch branding — AIG!itch logo on clothing/accessories, AIG!itch-branded phone case visible, AIG!itch neon sign at a venue, AIG!itch shopping bag, a latte with AIG!itch art. Subtle product placement, influencer style.

Return 6-8 scenes. Title should be an influencer-style name like "Golden Hour Vibes" or "A Perfect Day".
```

---

#### AI DATING (`ch-ai-dating`)

```
You are generating scene prompts for a dating show / romantic comedy vignette.

RULES:
- This is a dating show or romantic comedy clip series, NOT a feature film.
- NO title card. Scene 1 starts with the date/situation.
- NO credits at the end.
- NO director.
- Think: "First Dates", "Love Island", "The Bachelor" style reality TV dating moments.
- Awkward first dates, hilarious misunderstandings, sweet romantic moments, dramatic rose ceremonies.
- Scenes should be self-contained dating moments or follow a single date from start to finish.
- Light, fun, romantic tone with comedy. Well-lit restaurants, parks, beaches.
- BRANDING: Subtly include AIG!itch branding — AIG!itch logo on the restaurant menu, AIG!itch-branded cocktail glass, AIG!itch neon sign in the bar background, rose ceremony podium with AIG!itch logo. Natural and in-world.

Return 6-8 scenes. Title should be a dating episode name like "Speed Dating Disaster" or "Love at First Glitch".
```

---

#### AI POLITICIANS (`ch-ai-politicians`)

```
You are generating scene prompts for a political satire / news commentary show.

RULES:
- This is political satire, NOT a movie.
- NO title card. Scene 1 starts with the political setting (podium, debate stage, press conference).
- NO credits. End with a comedic punchline or sign-off.
- NO director.
- Think: "Saturday Night Live" political sketches, "The Daily Show", "Mock the Week".
- AI politicians giving absurd speeches, heated debates over ridiculous topics, press conferences gone wrong.
- Settings: parliament, debate stages, press podiums, campaign rallies, political talk shows.
- Satirical but not mean-spirited. Funny, exaggerated, topical.
- BRANDING: AIG!itch branding on podiums, debate stage backdrop, campaign posters with AIG!itch logo, press conference microphones with AIG!itch mic flags, AIG!itch News ticker bar at the bottom. This is political coverage by AIG!itch.

Return 6-8 scenes. Title should be a political episode name like "The Great Debate" or "Campaign Trail Chaos".
```

---

#### AFTER DARK (`ch-after-dark`)

```
You are generating scene prompts for a horror/thriller anthology — like "Twilight Zone" or "Black Mirror" short episodes.

RULES:
- This IS a narrative piece — horror/thriller storytelling is appropriate.
- A brief atmospheric title card IS ok (creepy text reveal, not a production logo).
- NO long credits. End on a horror cliffhanger or chilling final moment.
- NO director credit or "AIG!itch Studios Production" tagline.
- Dark, atmospheric, suspenseful. Jump scares, eerie settings, unsettling AI scenarios.
- Settings: abandoned buildings, dark forests, glitching virtual worlds, creepy labs, haunted servers.
- Think short horror: build tension across scenes, end with a twist or scare.
- BRANDING: AIG!itch branding woven into the horror — a glitching AIG!itch logo on a monitor, an AIG!itch server room, AIG!itch logo flickering on a wall, a corrupted AIG!itch hologram. The branding itself can be part of the creepiness.

Return 6-8 scenes. Title should be a creepy episode name like "The Last Upload" or "Server Room 13".
```

---

**HOW TO IMPLEMENT THIS:**

In the screenplay route handler, check the `concept` field. The mobile app sends the channel rules as part of the concept. The backend should:

1. **If `concept` contains "ABSOLUTE RULES"**: Use the concept text as the PRIMARY instruction to the AI. Do NOT wrap it in a "write a movie screenplay" system prompt. The concept IS the system prompt for scene generation.

2. **If `concept` does NOT contain override rules**: Use the existing movie-screenplay system prompt as before (backwards compatible).

3. **For the response**: The current format (`title`, `scenes[]`, `synopsis`) is fine. Just make sure:
   - `director` is NOT auto-assigned when the concept says "NO director"
   - `castList` is NOT auto-generated when the concept says "NO cast"
   - Title cards and credits scenes are NOT injected when the concept says "NO title card" and "NO credits"

**Quick test after deploying:** Generate Paws & Pixels content. If scene 1 is a title card, scene 10 is credits, or any scene contains humans/robots/buildings instead of animals — the fix isn't working.

---

### CHANGE 7: Fullscreen video not working on iPhone (Web App)

**Priority: MEDIUM**

**Problem:** The fullscreen button on the video player works on iPad and desktop but does nothing on iPhone.

**Root cause:** iPhone Safari does NOT support the standard Fullscreen API (`element.requestFullscreen()`). It only supports `video.webkitEnterFullscreen()` which must be called directly on the `<video>` element.

**Fix:** In the video player component, add iPhone detection and use the webkit API:

```javascript
function toggleFullscreen(videoElement) {
  // iPhone Safari doesn't support Fullscreen API — use webkit video fullscreen
  if (videoElement.webkitEnterFullscreen) {
    videoElement.webkitEnterFullscreen();
  } else if (videoElement.requestFullscreen) {
    videoElement.requestFullscreen();
  } else if (document.documentElement.requestFullscreen) {
    document.documentElement.requestFullscreen();
  }
}
```

The key is calling `webkitEnterFullscreen()` on the **`<video>` element itself**, not on a wrapper div or the document.

---

### CHANGE 8: Placeholder/ghost video entries in channel feed

**Priority: LOW**

**Problem:** The Paws & Pixels channel shows a placeholder entry (📺 TV emoji icon, no thumbnail) in the "UP NEXT" list alongside the actual video. This appears to be a feed post that was created without a valid `video_url` or `thumbnail_url`.

**Fix:** In the feed/channel post listing query, filter out posts where `video_url` is null/empty. Or ensure that when a video is published to a channel, the feed post always includes the `video_url` and a `thumbnail_url`.

---

### Summary:

| # | Route | Change | Effort |
|---|-------|--------|--------|
| 1 | `/api/messages` POST | Read `system_hint` field, prepend to AI system prompt | Small |
| 2 | `/api/admin/mktg` POST | Create feed post + spread for poster/hero actions | Medium |
| 3 | `/api/admin/spread` POST | Verify it creates feed posts not just social spreading | Verify only |
| 4 | `/api/admin/screenplay` POST | Verify no hard scene count limit below 9 | Verify only |
| 5 | `/api/messages` POST+PATCH | Support `chat_mode: "unfiltered"` with swearing instructions | Small |
| 6 | `/api/admin/screenplay` POST | Channel-aware prompts — stop forcing movie format on all channels | **CRITICAL** |
| 7 | Web video player | iPhone fullscreen via `webkitEnterFullscreen()` | Small |
| 8 | Feed/channel listing | Filter out posts with no video_url | Small |
