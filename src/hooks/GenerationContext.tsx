import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import { Keyboard } from "react-native";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import {
  generateAd, getAdStatus, planAd, postAd,
  generatePoster, generateHeroImage,
  generateScreenplay, submitScene, pollScene, stitchMovie,
  getBriefing,
  GENRE_FOLDER_MAP, ScreenplayResponse, Message,
} from "../services/api";

export interface SocialLink {
  platform: string;
  emoji: string;
  url: string;
}

export interface GenResult {
  type: string;
  title: string;
  message: string;
  mediaUrl?: string;
  isVideo?: boolean;
  socialLinks?: SocialLink[];
}

// Map platform names to emojis and fallback profile URLs
const SOCIAL_URLS: Record<string, { emoji: string; url: string }> = {
  x: { emoji: "𝕏", url: "https://x.com/aiglitchapp" },
  twitter: { emoji: "𝕏", url: "https://x.com/aiglitchapp" },
  tiktok: { emoji: "🎵", url: "https://tiktok.com/@aiglitch" },
  instagram: { emoji: "📸", url: "https://instagram.com/aiglitchapp" },
  facebook: { emoji: "📘", url: "https://facebook.com/aiglitch" },
  youtube: { emoji: "▶️", url: "https://youtube.com/@aiglitch" },
  telegram: { emoji: "✈️", url: "https://t.me/aiglitch" },
};

// Extract real post URLs from backend response objects
function extractPostUrls(postData?: any): Record<string, string> {
  if (!postData || typeof postData !== "object") return {};
  const urls: Record<string, string> = {};

  // Common patterns the backend might return:
  // post.url, post.post_url, post.tweet_url, post.link
  if (postData.url && typeof postData.url === "string") urls._direct = postData.url;
  if (postData.post_url) urls._direct = postData.post_url;
  if (postData.tweet_url) urls.x = postData.tweet_url;
  if (postData.tweet_id) urls.x = `https://x.com/i/status/${postData.tweet_id}`;

  // Per-platform URLs: post.urls = { x: "...", tiktok: "...", ... }
  if (postData.urls && typeof postData.urls === "object") {
    Object.entries(postData.urls).forEach(([key, val]) => {
      if (typeof val === "string" && val.startsWith("http")) urls[key.toLowerCase()] = val;
    });
  }

  // Per-platform links: post.links = { x: "...", ... }
  if (postData.links && typeof postData.links === "object") {
    Object.entries(postData.links).forEach(([key, val]) => {
      if (typeof val === "string" && val.startsWith("http")) urls[key.toLowerCase()] = val;
    });
  }

  // Social post IDs: post.social_posts = [{ platform: "x", url: "..." }]
  if (Array.isArray(postData.social_posts)) {
    for (const sp of postData.social_posts) {
      if (sp.url && sp.platform) urls[sp.platform.toLowerCase()] = sp.url;
      if (sp.post_url && sp.platform) urls[sp.platform.toLowerCase()] = sp.post_url;
    }
  }

  return urls;
}

function buildSocialLinks(spreading?: string[], postId?: string, mediaUrl?: string, postData?: any): SocialLink[] {
  const links: SocialLink[] = [];
  const realUrls = extractPostUrls(postData);

  // Direct link to the media file if available (always viewable)
  if (mediaUrl) {
    links.push({ platform: "Watch Video", emoji: "▶️", url: mediaUrl });
  }

  // Direct post URL if available
  if (realUrls._direct) {
    links.push({ platform: "View Post", emoji: "🔗", url: realUrls._direct });
  }

  if (spreading) {
    for (const p of spreading) {
      const key = p.toLowerCase().trim();
      const info = SOCIAL_URLS[key];
      if (info) {
        // Use real URL if available, otherwise fall back to profile URL
        const realUrl = realUrls[key] || realUrls[p];
        links.push({ platform: p, emoji: info.emoji, url: realUrl || info.url });
      }
    }
  }
  // If no spreading info, add defaults
  if (links.length <= 1) {
    links.push(
      { platform: "X", emoji: "𝕏", url: realUrls.x || realUrls.twitter || "https://x.com/aiglitchapp" },
      { platform: "Telegram", emoji: "✈️", url: realUrls.telegram || "https://t.me/aiglitch" },
    );
  }
  return links;
}

interface GenerationContextType {
  generating: string | null;
  genStatusText: string;
  genProgressPct: number;
  genResult: GenResult | null;
  clearResult: () => void;
  cancelGeneration: () => void;
  runAdGeneration: (walletAddress: string, style?: string, concept?: string) => void;
  runPosterGeneration: (walletAddress: string) => void;
  runHeroGeneration: (walletAddress: string) => void;
  runMovieGeneration: (walletAddress: string, director?: string, genre?: string, concept?: string) => void;
  runNewsGeneration: (walletAddress: string, topic?: string) => void;
}

const GenerationContext = createContext<GenerationContextType>({
  generating: null,
  genStatusText: "",
  genProgressPct: 0,
  genResult: null,
  clearResult: () => {},
  cancelGeneration: () => {},
  runAdGeneration: () => {},
  runPosterGeneration: () => {},
  runHeroGeneration: () => {},
  runMovieGeneration: () => {},
  runNewsGeneration: () => {},
});

export function useGeneration() {
  return useContext(GenerationContext);
}

async function sendLocalNotification(title: string, body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: "default" },
      trigger: null, // immediate
    });
  } catch (e) {
    console.warn("Local notification failed:", e);
  }
}

export function GenerationProvider({ children }: { children: React.ReactNode }) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [genStatusText, setGenStatusText] = useState("");
  const [genProgressPct, setGenProgressPct] = useState(0);
  const [genResult, setGenResult] = useState<GenResult | null>(null);
  const cancelRef = useRef(false);

  const clearResult = useCallback(() => setGenResult(null), []);

  const cancelGeneration = useCallback(() => {
    cancelRef.current = true;
    setGenerating(null);
    setGenStatusText("");
    setGenProgressPct(0);
  }, []);

  const finishGen = useCallback((result: GenResult) => {
    setGenResult(result);
    setGenerating(null);
    setGenProgressPct(0);
    setGenStatusText("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    sendLocalNotification(result.title, result.message);
  }, []);

  const runAdGeneration = useCallback(async (walletAddress: string, style?: string, concept?: string) => {
    Keyboard.dismiss();
    setGenerating("ad");
    setGenProgressPct(0);
    cancelRef.current = false;
    const startTime = Date.now();
    const formatElapsed = (from: number) => {
      const s = Math.floor((Date.now() - from) / 1000);
      return `${Math.floor(s / 60)}m ${s % 60}s`;
    };

    try {
      // ── Step 1: Get ad concept + video prompt from backend ──
      // Uses plan_only=true so the server just generates the creative brief, no video
      setGenStatusText("Writing ad concept...");
      setGenProgressPct(5);
      let adPrompt: string;
      let adCaption: string;
      let adStyleFinal = style || "auto";

      try {
        const plan = await planAd(walletAddress, style, concept);
        console.log("[AD] planAd response:", JSON.stringify(plan, null, 2));
        if (cancelRef.current) { setGenerating(null); return; }
        if (plan.success && plan.prompt) {
          adPrompt = plan.prompt;
          adCaption = plan.caption || concept || "AI G!itch ad campaign";
          adStyleFinal = plan.style || adStyleFinal;
        } else {
          // Fallback: build a prompt ourselves
          adPrompt = `Create a 10-second cinematic advertisement video. ${concept || "Promote AI G!itch - the AI companion app on Solana blockchain"}. Style: ${style || "cinematic"}. High energy, vibrant colors, futuristic tech aesthetic.`;
          adCaption = concept || "AI G!itch — Your AI Bestie on Solana";
        }
      } catch (planErr: any) {
        console.log("[AD] planAd failed, using fallback prompt:", planErr?.message);
        // If plan endpoint doesn't exist yet, build prompt client-side
        adPrompt = `Create a 10-second cinematic advertisement video. ${concept || "Promote AI G!itch - the AI companion app on Solana blockchain"}. Style: ${style || "cinematic"}. High energy, vibrant colors, futuristic tech aesthetic.`;
        adCaption = concept || "AI G!itch — Your AI Bestie on Solana";
      }

      if (cancelRef.current) { setGenerating(null); return; }

      // ── Step 2: Submit video to Grok Video API ──
      // Same endpoint that successfully renders 10-14 movie scenes
      setGenStatusText("Submitting ad to video engine...");
      setGenProgressPct(15);

      const folder = "ads"; // dedicated blob folder for ads
      const submitRes = await submitScene(walletAddress, adPrompt, 10, folder);
      console.log("[AD] submitScene response:", JSON.stringify(submitRes, null, 2));
      if (cancelRef.current) { setGenerating(null); return; }

      if (!submitRes.success || !submitRes.requestId) {
        setGenStatusText(`Failed to submit: ${submitRes.error || "No request ID returned"}`);
        await new Promise(r => setTimeout(r, 3000));
        setGenerating(null); setGenProgressPct(0); setGenStatusText("");
        return;
      }

      // ── Step 3: Poll for completion ──
      // Same polling as movie scenes: 10s intervals, up to 90 polls (15 min)
      setGenStatusText("Rendering ad video...");
      setGenProgressPct(20);
      let pollCount = 0;
      const maxPolls = 90;
      let videoUrl: string | null = null;

      while (pollCount < maxPolls && !cancelRef.current) {
        await new Promise(r => setTimeout(r, 10000)); // 10s intervals, same as movies
        pollCount++;
        const pct = 20 + Math.round((pollCount / maxPolls) * 60);
        setGenProgressPct(Math.min(pct, 80));
        setGenStatusText(`Rendering ad video... (${formatElapsed(startTime)})`);

        try {
          const pollRes = await pollScene(walletAddress, submitRes.requestId, folder);
          console.log("[AD] pollScene:", JSON.stringify(pollRes, null, 2));

          if (pollRes.status === "done" && (pollRes.blobUrl || pollRes.videoUrl)) {
            videoUrl = pollRes.blobUrl || pollRes.videoUrl || null;
            break;
          } else if (["failed", "moderation_failed", "expired"].includes(pollRes.status)) {
            setGenStatusText(`Video rendering failed: ${pollRes.status}`);
            await new Promise(r => setTimeout(r, 3000));
            setGenerating(null); setGenProgressPct(0); setGenStatusText("");
            return;
          }
          // Still pending — keep polling
        } catch { /* ignore individual poll errors, keep trying */ }
      }

      if (cancelRef.current) { setGenerating(null); return; }

      if (!videoUrl) {
        setGenStatusText("Video render timed out. Try again.");
        await new Promise(r => setTimeout(r, 3000));
        setGenerating(null); setGenProgressPct(0); setGenStatusText("");
        return;
      }

      // ── Step 4: Post to socials ──
      setGenStatusText("Ad rendered! Spreading to socials...");
      setGenProgressPct(85);

      let spreading: string[] | undefined;
      let postId: string | undefined;
      let finalCaption = adCaption;
      let postData: any = undefined;

      let postFailed = false;
      let postError = "";
      try {
        const postRes = await postAd(walletAddress, videoUrl, adCaption, adStyleFinal);
        console.log("[AD] postAd response:", JSON.stringify(postRes, null, 2));
        spreading = postRes.spreading || postRes.post?.spreading;
        postId = postRes.post?.id;
        postData = postRes.post || postRes; // capture full response for URL extraction
        if (postRes.post?.caption) finalCaption = postRes.post.caption;
        // Check if backend said success but didn't actually spread
        if (!spreading || spreading.length === 0) {
          console.log("[AD] WARNING: postAd returned success but no spreading platforms");
          postFailed = true;
          postError = postRes.message || "No platforms received — backend may not have posted";
        }
      } catch (postErr: any) {
        console.log("[AD] postAd FAILED:", postErr?.message);
        postFailed = true;
        postError = postErr?.message || "Social posting failed";
      }

      setGenProgressPct(100);
      if (postFailed) {
        setGenStatusText(`Ad video ready! Social posting issue: ${postError}`);
      } else {
        const platforms = spreading!.join(", ");
        setGenStatusText(`Ad live on ${platforms}!`);
      }
      await new Promise(r => setTimeout(r, 1500));

      finishGen({
        type: "ad",
        title: postFailed ? "Ad Video Ready (Social Posting Issue)" : "Ad Campaign Launched",
        message: postFailed
          ? `Video generated but social posting failed: ${postError}\n\n${finalCaption}`
          : finalCaption,
        mediaUrl: videoUrl,
        isVideo: true,
        socialLinks: buildSocialLinks(spreading, postId, videoUrl, postData),
      });

    } catch (e: any) {
      console.log("[AD] fatal error:", e?.message);
      setGenStatusText(`Error: ${e?.message || "Ad generation failed"}`);
      await new Promise(r => setTimeout(r, 3000));
      setGenerating(null); setGenProgressPct(0); setGenStatusText("");
    }
  }, [finishGen]);

  const runPosterGeneration = useCallback(async (walletAddress: string) => {
    Keyboard.dismiss();
    setGenerating("poster");
    setGenStatusText("Generating promo poster...");
    setGenProgressPct(20);
    cancelRef.current = false;
    try {
      const res = await generatePoster(walletAddress);
      if (cancelRef.current) { setGenerating(null); return; }
      setGenStatusText("Poster generated! Uploading...");
      setGenProgressPct(80);
      await new Promise(r => setTimeout(r, 1500));
      setGenProgressPct(100);
      setGenStatusText("Poster published!");
      await new Promise(r => setTimeout(r, 1000));
      finishGen({
        type: "poster",
        title: "Promo Poster Published",
        message: "Your promotional poster has been generated and published!",
        mediaUrl: res.url || undefined,
        socialLinks: buildSocialLinks(res.spreading, res.post?.id, res.url, res.post || res),
      });
    } catch (e: any) {
      setGenStatusText(`Error: ${e?.message || "Poster generation failed"}`);
      await new Promise(r => setTimeout(r, 3000));
      setGenerating(null); setGenProgressPct(0); setGenStatusText("");
    }
  }, [finishGen]);

  const runHeroGeneration = useCallback(async (walletAddress: string) => {
    Keyboard.dismiss();
    setGenerating("hero");
    setGenStatusText("Generating hero image...");
    setGenProgressPct(20);
    cancelRef.current = false;
    try {
      const res = await generateHeroImage(walletAddress);
      console.log("[HERO] generateHeroImage response:", JSON.stringify(res, null, 2));
      if (cancelRef.current) { setGenerating(null); return; }
      setGenStatusText("Hero image generated! Spreading to socials...");
      setGenProgressPct(80);
      await new Promise(r => setTimeout(r, 1500));
      setGenProgressPct(100);
      const didSpread = res.spreading && res.spreading.length > 0;
      setGenStatusText(didSpread ? `Hero image live on ${res.spreading!.join(", ")}!` : "Hero image live on landing page!");
      await new Promise(r => setTimeout(r, 1000));
      finishGen({
        type: "hero",
        title: didSpread ? "Hero Image Published" : "Hero Image Live",
        message: didSpread
          ? `Hero image generated and published to ${res.spreading!.join(", ")}!`
          : "Hero image generated and live on the landing page!",
        mediaUrl: res.url || undefined,
        socialLinks: [
          ...buildSocialLinks(res.spreading, res.post?.id, res.url, res.post || res),
          ...(res.url ? [{ platform: "View Image", emoji: "🖼", url: res.url }] : []),
          { platform: "AIG!itch", emoji: "🌐", url: "https://aiglitch.app" },
        ],
      });
    } catch (e: any) {
      setGenStatusText(`Error: ${e?.message || "Hero generation failed"}`);
      await new Promise(r => setTimeout(r, 3000));
      setGenerating(null); setGenProgressPct(0); setGenStatusText("");
    }
  }, [finishGen]);

  const runMovieGeneration = useCallback(async (walletAddress: string, director?: string, genre?: string, concept?: string) => {
    Keyboard.dismiss();
    setGenerating("director_movie");
    setGenProgressPct(0);
    cancelRef.current = false;
    const startTime = Date.now();
    const formatElapsed = (from: number) => {
      const s = Math.floor((Date.now() - from) / 1000);
      return `${Math.floor(s / 60)}m ${s % 60}s`;
    };

    try {
      // Step 1: Screenplay
      setGenStatusText("Writing screenplay...");
      setGenProgressPct(5);
      const screenplay = await generateScreenplay(walletAddress, {
        genre: genre && genre !== "any" ? genre : undefined,
        director: director && director !== "auto" ? director : undefined,
        concept: concept || undefined,
      });
      if (cancelRef.current) { setGenerating(null); return; }

      const totalScenes = screenplay.scenes.length;
      const folder = GENRE_FOLDER_MAP[screenplay.genre] || `premiere/${screenplay.genre}`;
      setGenStatusText(`"${screenplay.title}" — ${totalScenes} scenes by ${screenplay.directorName}`);
      setGenProgressPct(15);
      await new Promise(r => setTimeout(r, 2000));

      // Step 2: Submit scenes
      type SceneTrack = { sceneNumber: number; title: string; requestId: string | null; submittedAt: number };
      const sceneTrackers: SceneTrack[] = [];

      for (let i = 0; i < screenplay.scenes.length; i++) {
        if (cancelRef.current) { setGenerating(null); return; }
        const scene = screenplay.scenes[i];
        setGenStatusText(`Submitting scene ${i + 1}/${totalScenes}: ${scene.title}`);
        setGenProgressPct(15 + Math.round((i / totalScenes) * 15));
        try {
          const submitRes = await submitScene(walletAddress, scene.videoPrompt, 10, folder);
          if (submitRes.success && submitRes.requestId) {
            sceneTrackers.push({ sceneNumber: scene.sceneNumber, title: scene.title, requestId: submitRes.requestId, submittedAt: Date.now() });
          }
        } catch { /* skip failed scenes */ }
      }

      if (sceneTrackers.length === 0) {
        setGenStatusText("All scenes failed to submit. Try again.");
        await new Promise(r => setTimeout(r, 3000));
        setGenerating(null); setGenProgressPct(0); setGenStatusText("");
        return;
      }

      // Step 3: Poll
      const doneScenes = new Set<number>();
      const failedScenes = new Set<number>();
      const sceneUrls = new Map<number, string>();
      let lastProgressTime = Date.now();
      let pollCount = 0;

      setGenStatusText(`Rendering ${sceneTrackers.length} clips... (0/${totalScenes})`);
      setGenProgressPct(30);

      while (pollCount < 90 && !cancelRef.current) {
        const pending = sceneTrackers.filter(s => !doneScenes.has(s.sceneNumber) && !failedScenes.has(s.sceneNumber));
        if (pending.length === 0) break;

        await new Promise(r => setTimeout(r, 10000));
        pollCount++;

        for (const scene of pending) {
          if (!scene.requestId) continue;
          try {
            const pollRes = await pollScene(walletAddress, scene.requestId, folder);
            if (pollRes.status === "done" && pollRes.blobUrl) {
              doneScenes.add(scene.sceneNumber);
              sceneUrls.set(scene.sceneNumber, pollRes.blobUrl);
              lastProgressTime = Date.now();
            } else if (["failed", "moderation_failed", "expired"].includes(pollRes.status)) {
              failedScenes.add(scene.sceneNumber);
            }
          } catch { /* skip poll errors */ }
        }

        const done = doneScenes.size;
        const pct = 30 + Math.round((done / totalScenes) * 50);
        setGenProgressPct(pct);
        setGenStatusText(`Rendering clips... ${done}/${totalScenes} done (${formatElapsed(startTime)})`);

        // Stall detection
        if (done >= totalScenes * 0.5 && (Date.now() - lastProgressTime) > 60000) {
          setGenStatusText(`Stall detected — stitching ${done}/${totalScenes} clips`);
          break;
        }
      }

      if (cancelRef.current) { setGenerating(null); return; }

      if (doneScenes.size === 0) {
        setGenStatusText("All clips failed. Try again.");
        await new Promise(r => setTimeout(r, 3000));
        setGenerating(null); setGenProgressPct(0); setGenStatusText("");
        return;
      }

      // Step 4: Stitch
      setGenStatusText(`Stitching ${doneScenes.size} clips into movie...`);
      setGenProgressPct(85);

      const sceneUrlsObj: Record<string, string> = {};
      sceneUrls.forEach((url, num) => { sceneUrlsObj[String(num)] = url; });

      const stitchRes = await stitchMovie(walletAddress, {
        sceneUrls: sceneUrlsObj,
        title: screenplay.title,
        genre: screenplay.genre,
        directorUsername: screenplay.director,
        directorId: screenplay.directorId,
        synopsis: screenplay.synopsis,
        tagline: screenplay.tagline,
        castList: screenplay.castList,
      });
      console.log("[MOVIE] stitchMovie response:", JSON.stringify(stitchRes, null, 2));

      setGenProgressPct(100);
      const didSpread = stitchRes.spreading && stitchRes.spreading.length > 0;
      if (didSpread) {
        setGenStatusText(`"${screenplay.title}" live on ${stitchRes.spreading!.join(", ")}!`);
      } else {
        setGenStatusText(`"${screenplay.title}" stitched! (social posting may not have completed)`);
      }
      await new Promise(r => setTimeout(r, 1000));
      finishGen({
        type: "director_movie",
        title: didSpread ? `"${screenplay.title}" Premiere!` : `"${screenplay.title}" Ready (check socials)`,
        message: `By ${screenplay.directorName} · ${stitchRes.clipCount} clips · ${stitchRes.sizeMb}MB${didSpread ? "" : "\nNote: Social posting may not have completed — check your accounts"}`,
        mediaUrl: stitchRes.finalVideoUrl || undefined,
        isVideo: true,
        socialLinks: buildSocialLinks(stitchRes.spreading, stitchRes.feedPostId, stitchRes.finalVideoUrl, stitchRes),
      });

    } catch (e: any) {
      setGenStatusText(`Error: ${e?.message || "Movie generation failed"}`);
      await new Promise(r => setTimeout(r, 3000));
      setGenerating(null); setGenProgressPct(0); setGenStatusText("");
    }
  }, [finishGen]);

  // ── Breaking News Broadcast ──
  // Same pipeline as director movies but with a news broadcast screenplay concept.
  // 7 clips: intro, anchor→field, field report, anchor→field, field report, anchor wrap-up, outro
  const runNewsGeneration = useCallback(async (walletAddress: string, topic?: string) => {
    Keyboard.dismiss();
    setGenerating("breaking_news");
    setGenProgressPct(0);
    cancelRef.current = false;
    const startTime = Date.now();
    const formatElapsed = (from: number) => {
      const s = Math.floor((Date.now() - from) / 1000);
      return `${Math.floor(s / 60)}m ${s % 60}s`;
    };

    // Fetch real briefing data for current events
    let briefingContext = "";
    try {
      const briefing = await getBriefing();
      const headlines = briefing.topics?.slice(0, 4).map(t => `- ${t.headline}: ${t.summary}`).join("\n") || "";
      const trending = briefing.trending?.slice(0, 3).map(p => `- ${p.display_name} (@${p.username}): "${p.content.slice(0, 100)}"`).join("\n") || "";
      if (headlines || trending) {
        briefingContext = `\n\nREAL CURRENT EVENTS TO BASE THE NEWS ON (use these as the source material but CHANGE all names, places, and brands into whimsical/funny alternatives — use anagrams, puns, sci-fi twists, or absurd mashups. The events and facts stay accurate, only the names are discombobulated):\n${headlines}\n${trending ? `\nTrending posts:\n${trending}` : ""}`;
      }
    } catch { /* briefing fetch failed, continue without it */ }

    const newsConcept = `BREAKING NEWS BROADCAST FORMAT — AIG!itch News Network.
This is a 9-clip news broadcast with THREE news stories. Each clip is exactly 10 seconds.

STYLE RULE: The news stories must be based on REAL current events${topic ? ` (specifically: ${topic})` : ""} but with ALL names, places, companies, and people changed into whimsical funny alternatives. Use anagrams, puns, sci-fi names, absurd mashups. The underlying news is real — only proper nouns are changed. Think "The Daily Show meets cyberpunk."${briefingContext}

CLIP STRUCTURE (MUST follow this EXACT order — 9 clips, 3 stories):
Clip 1 — AIG!ITCH NEWS INTRO: Dramatic neon cyberpunk newsroom reveal. "AIG!ITCH NEWS" holographic logo spins into frame. Camera sweeps across a futuristic newsroom with glowing monitors, blockchain data tickers, purple/cyan neon lighting. Text overlay: "BREAKING NEWS". High energy broadcast open.
Clip 2 — NEWS DESK - STORY 1 INTRO: News anchor at the AIG!itch desk introduces the first story. Neon-lit studio, holographic screens behind anchor showing headlines. Anchor gestures to screen: "We go LIVE to our reporters in the field..." Camera slowly zooms in.
Clip 3 — FIELD REPORT - STORY 1: Reporters on location covering the first breaking story. Shot from a field reporter's camera — dynamic handheld angles, on-location atmosphere. Cyberpunk reporter with holographic microphone. Action and urgency. Based on real current events with funny name changes.
Clip 4 — NEWS DESK - STORY 2 INTRO: Back to the AIG!itch newsroom. Anchor reacts to the field report, shuffles holographic papers, then introduces the second story. "Breaking developments in our next story..." Different camera angle of the neon newsroom. New headline graphics appear on screens behind anchor.
Clip 5 — FIELD REPORT - STORY 2: Different reporters at a different location covering the second story. New environment, same cyberpunk aesthetic. Field correspondent with neon press badge reporting live. Different real current event, names changed whimsically. Cinematic news footage style.
Clip 6 — NEWS DESK - STORY 3 INTRO: Anchor back at desk with an urgent expression. "And just coming in to the AIG!itch newsroom..." introduces the third and final story. More holographic graphics populate the screens. The energy builds.
Clip 7 — FIELD REPORT - STORY 3: Third location, third story. Reporters gathering information on scene. The most dramatic of the three field reports. Wide establishing shots mixed with close-up reporter shots. Based on real current events with creative name changes.
Clip 8 — NEWS DESK WRAP-UP: Anchor summarizes all three stories from the desk. Camera slowly pulls back to reveal the full newsroom with all holographic screens showing highlights from the broadcast. "That's all from AIG!itch News... stay glitched, stay informed."
Clip 9 — AIG!ITCH NEWS OUTRO: Closing sequence — "AIG!ITCH NEWS" neon logo with glitch distortion effect. Dramatic sign-off animation. Solana/Web3 branding. "Powered by the blockchain" text. The newsroom lights dim as the logo glows. Professional broadcast close.

IMPORTANT: Every clip MUST maintain the futuristic neon cyberpunk Web3 aesthetic. The newsroom is high-tech with holographic displays, neon purple/cyan lighting, and blockchain data tickers scrolling in the background. Each field report should feel like real on-the-ground journalism but in a cyberpunk world.`;

    try {
      // ── Step 1: Write broadcast script ──
      setGenStatusText("Reporters gathering information...");
      setGenProgressPct(3);
      await new Promise(r => setTimeout(r, 1000));
      setGenStatusText("Writing news broadcast script...");
      setGenProgressPct(5);

      console.log("[NEWS] Calling generateScreenplay with genre=news, director=david_attenborough_ai");
      const screenplay = await generateScreenplay(walletAddress, {
        genre: "news",
        director: "david_attenborough_ai",
        concept: newsConcept,
      });
      console.log("[NEWS] Screenplay received:", JSON.stringify({
        title: screenplay.title,
        scenes: screenplay.scenes.length,
        sceneList: screenplay.scenes.map(s => `${s.sceneNumber}: ${s.title}`),
        director: screenplay.director,
        genre: screenplay.genre,
      }, null, 2));

      if (cancelRef.current) { setGenerating(null); return; }

      const totalScenes = screenplay.scenes.length;
      if (totalScenes === 0) {
        setGenStatusText("Screenplay returned 0 scenes — try again.");
        await new Promise(r => setTimeout(r, 3000));
        setGenerating(null); setGenProgressPct(0); setGenStatusText("");
        return;
      }

      setGenStatusText(`"${screenplay.title}" — ${totalScenes} clips scripted!`);
      setGenProgressPct(12);
      await new Promise(r => setTimeout(r, 2000));

      // ── Step 2: Submit clips to Grok video engine ──
      setGenStatusText("Dispatching reporters to the field...");
      setGenProgressPct(15);
      await new Promise(r => setTimeout(r, 800));

      const folder = GENRE_FOLDER_MAP["news"] || "premiere/news";
      type SceneTrack = { sceneNumber: number; title: string; requestId: string | null; submittedAt: number };
      const sceneTrackers: SceneTrack[] = [];

      for (let i = 0; i < screenplay.scenes.length; i++) {
        if (cancelRef.current) { setGenerating(null); return; }
        const scene = screenplay.scenes[i];
        // Show descriptive status based on clip type
        const clipLabel = scene.title.toLowerCase().includes("intro") ? "Setting up newsroom..."
          : scene.title.toLowerCase().includes("anchor") || scene.title.toLowerCase().includes("desk") ? `Anchor preparing: ${scene.title}`
          : scene.title.toLowerCase().includes("field") || scene.title.toLowerCase().includes("report") ? `Reporter heading to scene: ${scene.title}`
          : scene.title.toLowerCase().includes("outro") ? "Preparing sign-off..."
          : `Submitting clip ${i + 1}/${totalScenes}: ${scene.title}`;
        setGenStatusText(clipLabel);
        setGenProgressPct(15 + Math.round((i / totalScenes) * 15));
        try {
          console.log(`[NEWS] Submitting scene ${i + 1}/${totalScenes}: "${scene.title}" (prompt: ${scene.videoPrompt.slice(0, 80)}...)`);
          const submitRes = await submitScene(walletAddress, scene.videoPrompt, 10, folder);
          console.log(`[NEWS] Scene ${i + 1} submit result:`, JSON.stringify(submitRes));
          if (submitRes.success && submitRes.requestId) {
            sceneTrackers.push({ sceneNumber: scene.sceneNumber, title: scene.title, requestId: submitRes.requestId, submittedAt: Date.now() });
          } else {
            console.log(`[NEWS] Scene ${i + 1} submit FAILED: ${submitRes.error || "no requestId"}`);
          }
        } catch (submitErr: any) {
          console.log(`[NEWS] Scene ${i + 1} submit ERROR: ${submitErr?.message}`);
        }
      }

      console.log(`[NEWS] ${sceneTrackers.length}/${totalScenes} clips submitted successfully`);

      if (sceneTrackers.length === 0) {
        setGenStatusText("All clips failed to submit. Try again.");
        console.log("[NEWS] ABORT: 0 clips submitted");
        await new Promise(r => setTimeout(r, 3000));
        setGenerating(null); setGenProgressPct(0); setGenStatusText("");
        return;
      }

      // ── Step 3: Poll for video rendering ──
      const doneScenes = new Set<number>();
      const failedScenes = new Set<number>();
      const sceneUrls = new Map<number, string>();
      let lastProgressTime = Date.now();
      let pollCount = 0;

      setGenStatusText(`Rendering ${sceneTrackers.length} news clips... reporters in the field (0/${totalScenes})`);
      setGenProgressPct(30);

      while (pollCount < 90 && !cancelRef.current) {
        const pending = sceneTrackers.filter(s => !doneScenes.has(s.sceneNumber) && !failedScenes.has(s.sceneNumber));
        if (pending.length === 0) break;

        await new Promise(r => setTimeout(r, 10000));
        pollCount++;

        for (const scene of pending) {
          if (!scene.requestId) continue;
          try {
            const pollRes = await pollScene(walletAddress, scene.requestId, folder);
            if (pollRes.status === "done" && pollRes.blobUrl) {
              doneScenes.add(scene.sceneNumber);
              sceneUrls.set(scene.sceneNumber, pollRes.blobUrl);
              lastProgressTime = Date.now();
              console.log(`[NEWS] Clip "${scene.title}" DONE: ${pollRes.blobUrl}`);
            } else if (["failed", "moderation_failed", "expired"].includes(pollRes.status)) {
              failedScenes.add(scene.sceneNumber);
              console.log(`[NEWS] Clip "${scene.title}" FAILED: ${pollRes.status}`);
            }
          } catch { /* skip poll errors, retry next cycle */ }
        }

        const done = doneScenes.size;
        const failed = failedScenes.size;
        const pct = 30 + Math.round((done / totalScenes) * 50);
        setGenProgressPct(pct);

        // Show dynamic news-themed status
        const statusMsgs = [
          `News clips rendering... ${done}/${totalScenes} ready (${formatElapsed(startTime)})`,
          `Reporters filing footage... ${done}/${totalScenes} clips in (${formatElapsed(startTime)})`,
          `Newsroom receiving feeds... ${done}/${totalScenes} done (${formatElapsed(startTime)})`,
          `Editing broadcast... ${done}/${totalScenes} clips ready (${formatElapsed(startTime)})`,
        ];
        setGenStatusText(statusMsgs[pollCount % statusMsgs.length]);

        if (failed > 0 && failed + done === sceneTrackers.length) {
          console.log(`[NEWS] All scenes resolved: ${done} done, ${failed} failed`);
          break;
        }

        // Stall detection — if 50%+ done and 60s no progress, stitch early
        if (done >= totalScenes * 0.5 && (Date.now() - lastProgressTime) > 60000) {
          console.log(`[NEWS] Stall detected — stitching ${done}/${totalScenes} clips`);
          setGenStatusText(`Stall detected — going live with ${done}/${totalScenes} clips`);
          break;
        }
      }

      if (cancelRef.current) { setGenerating(null); return; }

      if (doneScenes.size === 0) {
        setGenStatusText("All news clips failed to render. Try again.");
        console.log("[NEWS] ABORT: 0 clips rendered");
        await new Promise(r => setTimeout(r, 3000));
        setGenerating(null); setGenProgressPct(0); setGenStatusText("");
        return;
      }

      // ── Step 4: Stitch into final broadcast ──
      setGenStatusText(`Stitching ${doneScenes.size} clips into AIG!itch News broadcast...`);
      setGenProgressPct(85);

      const sceneUrlsObj: Record<string, string> = {};
      sceneUrls.forEach((url, num) => { sceneUrlsObj[String(num)] = url; });

      console.log("[NEWS] Stitching with scene URLs:", Object.keys(sceneUrlsObj));
      const stitchRes = await stitchMovie(walletAddress, {
        sceneUrls: sceneUrlsObj,
        title: screenplay.title,
        genre: "news",
        directorUsername: screenplay.director,
        directorId: screenplay.directorId,
        synopsis: screenplay.synopsis,
        tagline: screenplay.tagline,
        castList: screenplay.castList,
      });

      console.log("[NEWS] stitchMovie response:", JSON.stringify(stitchRes, null, 2));
      setGenProgressPct(95);
      setGenStatusText("Broadcasting to socials...");
      await new Promise(r => setTimeout(r, 1000));

      setGenProgressPct(100);
      const didSpread = stitchRes.spreading && stitchRes.spreading.length > 0;
      if (didSpread) {
        setGenStatusText(`BREAKING: "${screenplay.title}" — LIVE on ${stitchRes.spreading!.join(", ")}!`);
      } else {
        setGenStatusText(`"${screenplay.title}" broadcast ready! (check social posting)`);
      }
      await new Promise(r => setTimeout(r, 1500));

      finishGen({
        type: "breaking_news",
        title: didSpread ? `BREAKING: ${screenplay.title}` : `BREAKING: ${screenplay.title} (check socials)`,
        message: `AIG!itch News · 3 stories · ${stitchRes.clipCount} clips · ${stitchRes.sizeMb}MB${didSpread ? "" : "\nNote: Social posting may not have completed"}`,
        mediaUrl: stitchRes.finalVideoUrl || undefined,
        isVideo: true,
        socialLinks: buildSocialLinks(stitchRes.spreading, stitchRes.feedPostId, stitchRes.finalVideoUrl, stitchRes),
      });

    } catch (e: any) {
      console.log("[NEWS] FATAL ERROR:", e?.message, e?.stack);
      setGenStatusText(`Error: ${e?.message || "News broadcast failed"}`);
      await new Promise(r => setTimeout(r, 4000));
      setGenerating(null); setGenProgressPct(0); setGenStatusText("");
    }
  }, [finishGen]);

  return (
    <GenerationContext.Provider value={{
      generating, genStatusText, genProgressPct, genResult,
      clearResult, cancelGeneration,
      runAdGeneration, runPosterGeneration, runHeroGeneration, runMovieGeneration, runNewsGeneration,
    }}>
      {children}
    </GenerationContext.Provider>
  );
}
