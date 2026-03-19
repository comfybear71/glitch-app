import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import { Keyboard } from "react-native";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import {
  generateAd, getAdStatus, planAd, postAd,
  generatePoster, generateHeroImage,
  generateScreenplay, submitScene, pollScene, stitchMovie,
  getBriefing, spreadCustomContent, getSpreadHistory,
  GENRE_FOLDER_MAP, ScreenplayResponse, Message,
  CHANNELS, ChannelDef,
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

/**
 * After content is posted, fetch spread history and extract verified post URLs.
 * Retries a few times since the spread may take a moment to propagate.
 * Returns verified social links only — no fallback to profile pages.
 */
async function fetchVerifiedLinks(
  walletAddress: string,
  feedPostId?: string,
  mediaUrl?: string,
  isVideo?: boolean,
): Promise<SocialLink[]> {
  const links: SocialLink[] = [];

  // Always include direct media link — this is guaranteed to work
  if (mediaUrl) {
    links.push({ platform: isVideo ? "Watch Video" : "View Image", emoji: isVideo ? "▶️" : "🖼", url: mediaUrl });
  }

  // Direct AIG!itch feed link from feedPostId
  if (feedPostId) {
    links.push({ platform: "AIG!itch Feed", emoji: "🌐", url: `https://aiglitch.app/post/${feedPostId}` });
  }

  // Try to get actual social post URLs from spread history
  // Retry up to 3 times with 3s delay — the spread may take a moment to complete
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await new Promise(r => setTimeout(r, 3000));
      const history = await getSpreadHistory(walletAddress);
      console.log(`[LINKS] Spread history attempt ${attempt + 1}:`, JSON.stringify(history, null, 2));

      if (history.spreads && history.spreads.length > 0) {
        // Get the most recent spread (should be our content)
        const latest = history.spreads[0];
        const postUrls = extractPostUrls(latest);

        // Also check results array within the spread entry
        if (latest.results && Array.isArray(latest.results)) {
          for (const result of latest.results) {
            const platform = (result.platform || result.service || "").toLowerCase();
            const url = result.url || result.post_url || result.tweet_url || result.link;
            if (platform && url && typeof url === "string" && url.startsWith("http")) {
              postUrls[platform] = url;
            }
            // X/Twitter specific: construct URL from tweet_id
            if ((platform === "x" || platform === "twitter") && result.tweet_id && !postUrls.x) {
              postUrls.x = `https://x.com/aiglitchapp/status/${result.tweet_id}`;
            }
            if ((platform === "x" || platform === "twitter") && result.id && !postUrls.x) {
              postUrls.x = `https://x.com/aiglitchapp/status/${result.id}`;
            }
          }
        }

        // Build verified links from real URLs only
        let foundAny = false;
        for (const [platform, url] of Object.entries(postUrls)) {
          if (platform === "_direct") continue;
          const info = SOCIAL_URLS[platform];
          if (info && typeof url === "string" && url.startsWith("http")) {
            links.push({ platform: platform.charAt(0).toUpperCase() + platform.slice(1), emoji: info.emoji, url });
            foundAny = true;
          }
        }

        if (foundAny) {
          console.log("[LINKS] Found verified social links:", links.map(l => `${l.platform}: ${l.url}`));
          return links;
        }
      }
    } catch (err: any) {
      console.log(`[LINKS] Spread history fetch attempt ${attempt + 1} failed:`, err?.message);
    }
  }

  console.log("[LINKS] No verified social links found after 3 attempts — returning media + feed links only");
  return links;
}

/**
 * Publish generated content to the AIG!itch "for you" feed.
 * This ensures all content (ads, posters, movies, news) appears on aiglitch.app.
 * Uses spreadCustomContent which both creates a feed post AND spreads to socials.
 * Only called as a safety net — if the backend already created a post (feedPostId/postId exists),
 * we skip the extra publish to avoid duplicates.
 */
async function publishToFeed(
  walletAddress: string,
  title: string,
  caption: string,
  mediaUrl?: string,
  isVideo?: boolean,
  alreadyPosted?: boolean, // true if backend already confirmed a feed post was created
) {
  if (alreadyPosted) {
    console.log("[FEED] Skipping publishToFeed — backend already created feed post");
    return;
  }
  try {
    const text = `${title}\n\n${caption}`;
    const mediaType = isVideo ? "video" : mediaUrl ? "image" : undefined;
    console.log("[FEED] Publishing to feed:", { title, mediaUrl, mediaType });
    const res = await spreadCustomContent(walletAddress, text, mediaUrl, mediaType);
    console.log("[FEED] publishToFeed result:", JSON.stringify(res));
  } catch (err: any) {
    console.log("[FEED] publishToFeed failed (non-fatal):", err?.message);
    // Non-fatal — content is still generated, just won't appear in feed
  }
}

/**
 * Publish content to a specific channel (e.g. news → GNN, ads → Marketplace QVC).
 * Non-fatal — the content still exists even if this call fails.
 */
async function publishToChannel(
  walletAddress: string,
  channelId: string,
  caption: string,
  mediaUrl?: string,
  isVideo?: boolean,
) {
  try {
    const mediaType = isVideo ? "video" : mediaUrl ? "image" : undefined;
    console.log(`[CHANNEL-ROUTE] Publishing to channel ${channelId}:`, { caption: caption.slice(0, 60), mediaUrl, mediaType });
    const res = await spreadCustomContent(walletAddress, caption, mediaUrl, mediaType, channelId);
    console.log(`[CHANNEL-ROUTE] publishToChannel ${channelId} result:`, JSON.stringify(res));
  } catch (err: any) {
    console.log(`[CHANNEL-ROUTE] publishToChannel ${channelId} failed (non-fatal):`, err?.message);
  }
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
  runChannelGeneration: (walletAddress: string, channelId: string, concept?: string) => void;
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
  runChannelGeneration: () => {},
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

      if (postFailed) {
        setGenProgressPct(100);
        setGenStatusText(`Ad video ready! Social posting issue: ${postError}`);
      } else {
        setGenProgressPct(92);
        const platforms = spreading!.join(", ");
        setGenStatusText(`Ad live on ${platforms}! Verifying links...`);
      }

      // Publish to AIG!itch "for you" feed
      await publishToFeed(walletAddress, "Ad Campaign", finalCaption, videoUrl, true, !!postId);

      // Also publish to Marketplace QVC channel so all ads appear there
      await publishToChannel(walletAddress, "ch-marketplace-qvc", finalCaption, videoUrl, true);

      // Fetch verified social links
      const verifiedLinks = postFailed
        ? [{ platform: "Watch Video", emoji: "▶️", url: videoUrl }]
        : await fetchVerifiedLinks(walletAddress, postId, videoUrl, true);
      setGenProgressPct(100);
      if (!postFailed) setGenStatusText(`Ad live on ${spreading!.join(", ")}!`);
      await new Promise(r => setTimeout(r, 1500));

      finishGen({
        type: "ad",
        title: postFailed ? "Ad Video Ready (Social Posting Issue)" : "Ad Campaign Launched",
        message: postFailed
          ? `Video generated but social posting failed: ${postError}\n\n${finalCaption}`
          : finalCaption,
        mediaUrl: videoUrl,
        isVideo: true,
        socialLinks: verifiedLinks,
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
      setGenProgressPct(88);
      setGenStatusText("Publishing to AIG!itch feed...");

      // Publish to "for you" feed
      await publishToFeed(walletAddress, "Promo Poster", "New promotional poster from AIG!itch Studios!", res.url, false, !!res.post?.id);

      setGenProgressPct(92);
      setGenStatusText("Verifying links...");
      const verifiedLinks = await fetchVerifiedLinks(walletAddress, res.post?.id, res.url, false);
      setGenProgressPct(100);
      setGenStatusText("Poster published to feed!");
      await new Promise(r => setTimeout(r, 1000));
      finishGen({
        type: "poster",
        title: "Promo Poster Published",
        message: "Your promotional poster has been generated and published to the AIG!itch feed!",
        mediaUrl: res.url || undefined,
        socialLinks: verifiedLinks,
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
      setGenStatusText("Hero image generated! Publishing to feed...");
      setGenProgressPct(80);

      // Publish to "for you" feed
      await publishToFeed(walletAddress, "Hero Image", "New hero image live on the AIG!itch landing page!", res.url, false, !!res.post?.id);

      setGenProgressPct(90);
      const didSpread = res.spreading && res.spreading.length > 0;
      setGenStatusText(didSpread ? `Hero image live on ${res.spreading!.join(", ")} + feed! Verifying links...` : "Hero image published! Verifying links...");
      const verifiedLinks = await fetchVerifiedLinks(walletAddress, res.post?.id, res.url, false);
      verifiedLinks.push({ platform: "AIG!itch", emoji: "🌐", url: "https://aiglitch.app" });
      setGenProgressPct(100);
      setGenStatusText(didSpread ? `Hero image live on ${res.spreading!.join(", ")} + feed!` : "Hero image published to feed + landing page!");
      await new Promise(r => setTimeout(r, 1000));
      finishGen({
        type: "hero",
        title: "Hero Image Published",
        message: didSpread
          ? `Hero image published to AIG!itch feed and ${res.spreading!.join(", ")}!`
          : "Hero image published to the AIG!itch feed and landing page!",
        mediaUrl: res.url || undefined,
        socialLinks: verifiedLinks,
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
        channelId: "ch-aiglitch-studios",
        folder: "channels/aiglitch-studios",
      });
      console.log("[MOVIE] stitchMovie response:", JSON.stringify(stitchRes, null, 2));

      setGenProgressPct(92);
      setGenStatusText("Publishing to AIG!itch feed...");

      // Publish to "for you" feed — stitchMovie should create feedPostId, but safety net if not
      const movieCaption = `"${screenplay.title}" by ${screenplay.directorName}\n${screenplay.tagline || screenplay.synopsis || ""}`;
      await publishToFeed(walletAddress, screenplay.title, movieCaption, stitchRes.finalVideoUrl, true, !!stitchRes.feedPostId);

      // Also publish to AIG!itch Studios channel
      await publishToChannel(walletAddress, "ch-aiglitch-studios", movieCaption, stitchRes.finalVideoUrl, true);

      setGenProgressPct(95);
      const didSpread = stitchRes.spreading && stitchRes.spreading.length > 0;
      if (didSpread) {
        setGenStatusText(`"${screenplay.title}" live on ${stitchRes.spreading!.join(", ")} + feed! Verifying links...`);
      } else {
        setGenStatusText(`"${screenplay.title}" published to AIG!itch feed! Verifying links...`);
      }

      // Fetch verified social links — wait for spread to propagate and get real URLs
      const verifiedLinks = await fetchVerifiedLinks(walletAddress, stitchRes.feedPostId, stitchRes.finalVideoUrl, true);
      setGenProgressPct(100);
      setGenStatusText(didSpread ? `"${screenplay.title}" live on ${stitchRes.spreading!.join(", ")} + feed!` : `"${screenplay.title}" published to AIG!itch feed!`);
      await new Promise(r => setTimeout(r, 1000));
      finishGen({
        type: "director_movie",
        title: `"${screenplay.title}" Premiere!`,
        message: `By ${screenplay.directorName} · ${stitchRes.clipCount} clips · ${stitchRes.sizeMb}MB · Published to AIG!itch feed${didSpread ? ` + ${stitchRes.spreading!.join(", ")}` : ""}`,
        mediaUrl: stitchRes.finalVideoUrl || undefined,
        isVideo: true,
        socialLinks: verifiedLinks,
      });

    } catch (e: any) {
      setGenStatusText(`Error: ${e?.message || "Movie generation failed"}`);
      await new Promise(r => setTimeout(r, 3000));
      setGenerating(null); setGenProgressPct(0); setGenStatusText("");
    }
  }, [finishGen]);

  // ── Breaking News Broadcast ──
  // Same pipeline as director movies but with a news broadcast screenplay concept.
  // 9 clips: intro, desk story 1, field 1, desk story 2, field 2, desk story 3, field 3, wrap-up, outro
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

    const newsConcept = `AIG!ITCH NEWS — LIVE NEWS BROADCAST.
This is a real news broadcast like CNN, BBC, Fox News, or Al Jazeera — NOT a movie. It must feel like actual television news.
9 clips total. Clip 1 is 6 seconds (intro). All other clips are 10 seconds each.

CONTENT RULE: All stories are based on REAL current events${topic ? ` (specifically: ${topic})` : ""}. The news is REAL — the facts, events, and what happened are all accurate. But ALL names of people, places, companies, and brands are changed into funny/whimsical alternatives (anagrams, puns, sci-fi twists, absurd mashups). The events stay true, only proper nouns change.${briefingContext}

BRANDING: "AIG!itch News" must appear constantly — on screen graphics, lower thirds, microphone flags, backdrop logos, watermarks. It should feel like a branded news network. Subliminal AIG!itch branding everywhere.

CLIP STRUCTURE (MUST follow this EXACT order):

Clip 1 (6 seconds) — AIG!ITCH NEWS INTRO: Professional news network opening sequence. Bold "AIG!ITCH NEWS" logo with dramatic news-style music energy (think CNN/BBC opening titles). Breaking news graphics, spinning globe or world map, news ticker bar at bottom. Fast cuts of newsroom footage. Sets the tone: this is serious news delivered with style. Text: "LIVE" and "BREAKING NEWS".

Clip 2 (10 seconds) — NEWS DESK - STORY 1: A news anchor sits behind a professional news desk with "AIG!ITCH NEWS" logo on the wall behind them. The anchor looks directly at the camera and says: "Good evening, I'm [anchor name], and this is AIG!itch News. We begin tonight with breaking developments in [Story 1 topic]..." The anchor gives a brief summary of the story — what happened, where, and why it matters. Then the anchor says: "For more on this, we go LIVE to [reporter name] who is at the scene. [Reporter name], what can you tell us?" Lower-third graphic shows the anchor's name and "AIG!ITCH NEWS ANCHOR". News ticker scrolls at the bottom.

Clip 3 (10 seconds) — FIELD REPORT - STORY 1: A field reporter stands facing the camera, holding a microphone with an AIG!itch News mic flag. They are ON LOCATION where the news event is happening — the scene of the story is visible BEHIND them. The reporter SPEAKS EXTENSIVELY — they describe what they are seeing on the ground, provide specific details about the event (numbers, scale, impact), and quote witnesses or officials ("One eyewitness told us..."). The reporter's dialogue should be the MAIN FOCUS of this clip — they are telling the story, not just standing there. Their report should directly expand on exactly what the anchor just introduced. They finish with: "We'll continue to monitor the situation. Back to you, [anchor name]." Lower-third shows reporter name and location.

Clip 4 (10 seconds) — NEWS DESK - STORY 2: Back to the anchor at the news desk. The anchor responds directly to the previous reporter: "Thank you, [reporter 1 name]. Incredible scenes there." Then transitions naturally: "Now, turning to [Story 2 topic]..." The anchor gives a brief summary of the second story with key facts, then hands off: "Our correspondent [reporter 2 name] is live at [location]. [Reporter 2 name], what's the latest?" Different headline graphics appear on the screens behind the desk. The anchor's introduction should set up exactly what the field reporter will expand on.

Clip 5 (10 seconds) — FIELD REPORT - STORY 2: A DIFFERENT field reporter at a DIFFERENT location for the second story. Reporter faces camera, holding AIG!itch News microphone, the news event visible behind them. The reporter SPEAKS AT LENGTH about what is unfolding — they describe the atmosphere, give specific facts and figures, and explain the significance of the event. They should reference what the anchor just said and ADD new information: "As [anchor name] mentioned, [detail]... but what we're seeing here on the ground is..." Their spoken report is the centrepiece. Ends with: "Reporting live from [location], back to you, [anchor name]."

Clip 6 (10 seconds) — NEWS DESK - STORY 3: Anchor back at the desk. Acknowledges the previous report: "Thank you, [reporter 2 name]. Important developments there." Then with slightly more urgent tone: "And in breaking news just coming in to us now..." introduces the third and final story with key details and context. Hands off: "Our reporter [reporter 3 name] is on the scene. [Reporter 3 name], what are you seeing?" New headline graphics on screens.

Clip 7 (10 seconds) — FIELD REPORT - STORY 3: A THIRD field reporter at a THIRD location. This is the most dramatic/urgent of the three reports. The reporter SPEAKS with energy and urgency — describing the scene around them in vivid detail, providing facts, quoting sources, and conveying the gravity of the situation. They should directly build on what the anchor introduced: "That's right, [anchor name], here at [location] we can see..." Their spoken words are the STAR of this clip. They report with authority and finish with: "A developing story we'll be watching closely. Back to you in the studio, [anchor name]."

Clip 8 (10 seconds) — NEWS DESK WRAP-UP: Anchor ties everything together by referencing ALL three stories and their reporters by name: "Some major stories tonight — [reporter 1 name] reporting on [Story 1], [reporter 2 name] bringing us the latest from [Story 2], and [reporter 3 name] on the ground at [Story 3]. We'll have continuing coverage throughout the night." Then signs off: "For AIG!itch News, I'm [anchor name]. Stay informed, stay glitched. Goodnight." Professional sign-off, looking directly at camera.

Clip 9 (10 seconds) — AIG!ITCH NEWS OUTRO: Closing credits sequence. "AIG!ITCH NEWS" logo with professional broadcast outro graphics. News ticker, "24/7 LIVE NEWS" text, social media handles. Clean, professional news network sign-off. Logo holds center screen.

CRITICAL STYLE NOTES:
- This is NEWS, not a movie. No cinematic camera work, no dramatic lighting, no sci-fi effects. Think real TV news — clean, professional, well-lit studio and on-location footage.
- Every clip should look like it could be on CNN or BBC right now, except with AIG!itch branding.
- Field reporters MUST be facing the camera and holding a microphone. The event is BEHIND them, not in front.
- The news desk should look like a real news studio — clean backdrop with screens/monitors showing headlines, professional lighting.
- AIG!itch News branding on EVERYTHING: desk, backdrop, mic flags, lower thirds, ticker bar, watermark.`;

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
      setGenProgressPct(92);
      setGenStatusText("Publishing to AIG!itch feed...");

      // Publish to "for you" feed
      const newsCaption = `BREAKING: ${screenplay.title}\n${screenplay.synopsis || screenplay.tagline || "AIG!itch News broadcast"}`;
      await publishToFeed(walletAddress, `BREAKING: ${screenplay.title}`, newsCaption, stitchRes.finalVideoUrl, true, !!stitchRes.feedPostId);

      // Also publish to GNN channel so all breaking news appears there
      await publishToChannel(walletAddress, "ch-gnn", newsCaption, stitchRes.finalVideoUrl, true);

      setGenProgressPct(95);
      const didSpread = stitchRes.spreading && stitchRes.spreading.length > 0;
      setGenStatusText(didSpread
        ? `BREAKING: "${screenplay.title}" — LIVE on ${stitchRes.spreading!.join(", ")} + feed! Verifying links...`
        : `"${screenplay.title}" published to AIG!itch feed! Verifying links...`);

      // Fetch verified social links — wait for spread to propagate and get real URLs
      const verifiedLinks = await fetchVerifiedLinks(walletAddress, stitchRes.feedPostId, stitchRes.finalVideoUrl, true);
      setGenProgressPct(100);
      setGenStatusText(didSpread
        ? `BREAKING: "${screenplay.title}" — LIVE on ${stitchRes.spreading!.join(", ")} + feed!`
        : `"${screenplay.title}" published to AIG!itch feed!`);
      await new Promise(r => setTimeout(r, 1500));

      finishGen({
        type: "breaking_news",
        title: `BREAKING: ${screenplay.title}`,
        message: `AIG!itch News · 3 stories · ${stitchRes.clipCount} clips · ${stitchRes.sizeMb}MB · Published to AIG!itch feed${didSpread ? ` + ${stitchRes.spreading!.join(", ")}` : ""}`,
        mediaUrl: stitchRes.finalVideoUrl || undefined,
        isVideo: true,
        socialLinks: verifiedLinks,
      });

    } catch (e: any) {
      console.log("[NEWS] FATAL ERROR:", e?.message, e?.stack);
      setGenStatusText(`Error: ${e?.message || "News broadcast failed"}`);
      await new Promise(r => setTimeout(r, 4000));
      setGenerating(null); setGenProgressPct(0); setGenStatusText("");
    }
  }, [finishGen]);

  // ── Channel Content Generation (same pipeline as movies but for channel-specific content) ──
  const runChannelGeneration = useCallback(async (walletAddress: string, channelId: string, concept?: string) => {
    if (generating) return;
    // GNN and Marketplace QVC are auto-populated from news/ads — not available for channel generation
    const RESERVED_CHANNELS = ["ch-gnn", "ch-marketplace-qvc", "ch-aiglitch-studios"];
    if (RESERVED_CHANNELS.includes(channelId)) { console.warn("[CHANNEL] Reserved channel, skipping:", channelId); return; }
    const channel = CHANNELS.find(ch => ch.id === channelId);
    if (!channel) { console.warn("[CHANNEL] Unknown channel:", channelId); return; }

    Keyboard.dismiss();
    setGenerating("channel");
    cancelRef.current = false;
    setGenProgressPct(5);
    setGenStatusText(`Creating ${channel.emoji} ${channel.name} content...`);

    const isMusicChannel = channel.genre === "music_video";
    const musicPrefix = isMusicChannel
      ? "This MUST be a music video — every scene must feature singing, rapping, playing instruments, or performing music. Genres can include rap, rock, pop, classical, electronic, alien AI music, etc. There MUST be vocals and/or instruments in every clip. Do NOT generate movie scenes or dialogue — only music video clips. "
      : "";
    const channelConceptText = concept?.trim()
      ? `${musicPrefix}${channel.style}. User concept: ${concept.trim()}`
      : `${musicPrefix}${channel.style}. Create compelling ${channel.name} content that fits the channel theme: ${channel.description}.`;

    try {
      // ── Step 1: Generate Screenplay ──
      setGenStatusText(`Writing screenplay for ${channel.emoji} ${channel.name}...`);
      setGenProgressPct(10);

      const screenplay = await generateScreenplay(walletAddress, {
        genre: channel.genre,
        concept: channelConceptText,
      });

      if (cancelRef.current) { setGenerating(null); setGenProgressPct(0); setGenStatusText(""); return; }

      console.log("[CHANNEL] Screenplay:", screenplay.title, `— ${screenplay.scenes.length} scenes`);
      setGenProgressPct(20);
      setGenStatusText(`"${screenplay.title}" — submitting ${screenplay.scenes.length} scenes...`);

      // ── Step 2: Submit Each Scene ──
      const folder = channel.folder;
      type SceneTracker = { sceneNumber: number; requestId: string | null; blobUrl: string | null; sizeMb: number | null };
      const submitted: SceneTracker[] = [];

      for (let i = 0; i < screenplay.scenes.length; i++) {
        if (cancelRef.current) break;
        const scene = screenplay.scenes[i];
        const pct = 20 + Math.round(((i + 1) / screenplay.scenes.length) * 15);
        setGenProgressPct(pct);
        setGenStatusText(`Submitting scene ${i + 1}/${screenplay.scenes.length}: ${scene.title}`);

        try {
          const res = await submitScene(walletAddress, scene.videoPrompt, 10, folder);
          submitted.push({ sceneNumber: scene.sceneNumber, requestId: res.success ? res.requestId || null : null, blobUrl: null, sizeMb: null });
        } catch {
          submitted.push({ sceneNumber: scene.sceneNumber, requestId: null, blobUrl: null, sizeMb: null });
        }
      }

      if (cancelRef.current) { setGenerating(null); setGenProgressPct(0); setGenStatusText(""); return; }

      const submittedScenes = submitted.filter(s => s.requestId);
      if (submittedScenes.length === 0) {
        setGenStatusText("All scenes failed to submit. Please try again.");
        await new Promise(r => setTimeout(r, 3000));
        setGenerating(null); setGenProgressPct(0); setGenStatusText("");
        return;
      }

      // ── Step 3: Poll Every 10 Seconds ──
      setGenProgressPct(40);
      setGenStatusText(`Rendering ${submittedScenes.length} clips for ${channel.emoji} ${channel.name}...`);

      const doneScenes = new Set<number>();
      const failedScenes = new Set<number>();
      const sceneUrls = new Map<number, string>();
      let lastProgressTime = Date.now();
      let pollCount = 0;
      const totalScenes = screenplay.scenes.length;

      submitted.filter(s => !s.requestId).forEach(s => failedScenes.add(s.sceneNumber));

      const pendingCount = () => submittedScenes.filter(s => !doneScenes.has(s.sceneNumber) && !failedScenes.has(s.sceneNumber)).length;

      while (pendingCount() > 0 && pollCount < 90 && !cancelRef.current) {
        await new Promise(r => setTimeout(r, 10000));
        pollCount++;

        for (const scene of submittedScenes) {
          if (doneScenes.has(scene.sceneNumber) || failedScenes.has(scene.sceneNumber) || !scene.requestId) continue;
          try {
            const pollRes = await pollScene(walletAddress, scene.requestId, folder);
            if (pollRes.status === "done" && pollRes.blobUrl) {
              doneScenes.add(scene.sceneNumber);
              sceneUrls.set(scene.sceneNumber, pollRes.blobUrl);
              lastProgressTime = Date.now();
            } else if (["failed", "moderation_failed", "expired"].includes(pollRes.status)) {
              failedScenes.add(scene.sceneNumber);
            }
          } catch { /* skip this cycle */ }
        }

        const done = doneScenes.size;
        const pct = 40 + Math.round((done / totalScenes) * 45);
        setGenProgressPct(Math.min(pct, 84));
        setGenStatusText(`${channel.emoji} ${channel.name}: ${done}/${totalScenes} clips rendered...`);

        // Stall detection
        if (done >= totalScenes * 0.5 && (Date.now() - lastProgressTime) > 60000) break;
      }

      if (cancelRef.current) { setGenerating(null); setGenProgressPct(0); setGenStatusText(""); return; }

      if (doneScenes.size === 0) {
        setGenStatusText("All clips failed to render. Please try again.");
        await new Promise(r => setTimeout(r, 3000));
        setGenerating(null); setGenProgressPct(0); setGenStatusText("");
        return;
      }

      // ── Step 4: Stitch ──
      setGenStatusText(`Stitching ${doneScenes.size} clips for ${channel.emoji} ${channel.name}...`);
      setGenProgressPct(85);

      const sceneUrlsObj: Record<string, string> = {};
      sceneUrls.forEach((url, num) => { sceneUrlsObj[String(num)] = url; });

      const stitchRes = await stitchMovie(walletAddress, {
        sceneUrls: sceneUrlsObj,
        title: screenplay.title,
        genre: channel.genre,
        directorUsername: screenplay.director,
        directorId: screenplay.directorId,
        synopsis: screenplay.synopsis,
        tagline: screenplay.tagline,
        castList: screenplay.castList,
        channelId: channel.id,
        folder: channel.folder,
      });

      setGenProgressPct(92);
      setGenStatusText("Publishing to AIG!itch feed...");

      const channelCaption = `${channel.emoji} ${channel.name}: "${screenplay.title}"\n${screenplay.synopsis || screenplay.tagline || ""}`;
      await publishToFeed(walletAddress, `${channel.emoji} ${channel.name}`, channelCaption, stitchRes.finalVideoUrl, true, !!stitchRes.feedPostId);

      // Publish to the channel itself so it appears on the channel page
      await publishToChannel(walletAddress, channel.id, channelCaption, stitchRes.finalVideoUrl, true);

      setGenProgressPct(95);
      const didSpread = stitchRes.spreading && stitchRes.spreading.length > 0;
      setGenStatusText(didSpread
        ? `${channel.emoji} "${screenplay.title}" — published to ${stitchRes.spreading!.join(", ")} + feed! Verifying links...`
        : `"${screenplay.title}" published to AIG!itch feed! Verifying links...`);

      const verifiedLinks = await fetchVerifiedLinks(walletAddress, stitchRes.feedPostId, stitchRes.finalVideoUrl, true);
      setGenProgressPct(100);
      setGenStatusText(didSpread
        ? `${channel.emoji} "${screenplay.title}" — published to ${stitchRes.spreading!.join(", ")} + feed!`
        : `${channel.emoji} "${screenplay.title}" published to AIG!itch feed!`);
      await new Promise(r => setTimeout(r, 1500));

      finishGen({
        type: "channel",
        title: `${channel.emoji} ${channel.name}: ${screenplay.title}`,
        message: `Channel content · ${stitchRes.clipCount} clips · ${stitchRes.sizeMb}MB · Published to AIG!itch feed${didSpread ? ` + ${stitchRes.spreading!.join(", ")}` : ""}`,
        mediaUrl: stitchRes.finalVideoUrl || undefined,
        isVideo: true,
        socialLinks: verifiedLinks,
      });

    } catch (e: any) {
      console.log("[CHANNEL] FATAL ERROR:", e?.message, e?.stack);
      setGenStatusText(`Error: ${e?.message || "Channel content generation failed"}`);
      await new Promise(r => setTimeout(r, 4000));
      setGenerating(null); setGenProgressPct(0); setGenStatusText("");
    }
  }, [generating, finishGen]);

  return (
    <GenerationContext.Provider value={{
      generating, genStatusText, genProgressPct, genResult,
      clearResult, cancelGeneration,
      runAdGeneration, runPosterGeneration, runHeroGeneration, runMovieGeneration, runNewsGeneration,
      runChannelGeneration,
    }}>
      {children}
    </GenerationContext.Provider>
  );
}
