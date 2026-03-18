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

// Map platform names to emojis and base URLs
const SOCIAL_URLS: Record<string, { emoji: string; url: string }> = {
  x: { emoji: "𝕏", url: "https://x.com/aiglitchapp" },
  twitter: { emoji: "𝕏", url: "https://x.com/aiglitchapp" },
  tiktok: { emoji: "🎵", url: "https://tiktok.com/@aiglitch" },
  instagram: { emoji: "📸", url: "https://instagram.com/aiglitchapp" },
  facebook: { emoji: "📘", url: "https://facebook.com/aiglitch" },
  youtube: { emoji: "▶️", url: "https://youtube.com/@aiglitch" },
  telegram: { emoji: "✈️", url: "https://t.me/aiglitch" },
};

function buildSocialLinks(spreading?: string[], postId?: string, mediaUrl?: string): SocialLink[] {
  const links: SocialLink[] = [];
  // Direct link to the media file if available (always viewable)
  if (mediaUrl) {
    links.push({ platform: "Watch Video", emoji: "▶️", url: mediaUrl });
  }
  if (spreading) {
    for (const p of spreading) {
      const key = p.toLowerCase().trim();
      const info = SOCIAL_URLS[key];
      if (info) {
        links.push({ platform: p, emoji: info.emoji, url: info.url });
      }
    }
  }
  // If no spreading info, add defaults
  if (links.length <= 1) {
    links.push(
      { platform: "X", emoji: "𝕏", url: "https://x.com/aiglitchapp" },
      { platform: "Telegram", emoji: "✈️", url: "https://t.me/aiglitch" },
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

      try {
        const postRes = await postAd(walletAddress, videoUrl, adCaption, adStyleFinal);
        console.log("[AD] postAd response:", JSON.stringify(postRes, null, 2));
        spreading = postRes.spreading || postRes.post?.spreading;
        postId = postRes.post?.id;
        if (postRes.post?.caption) finalCaption = postRes.post.caption;
      } catch (postErr: any) {
        console.log("[AD] postAd failed (video still available):", postErr?.message);
        // Video exists even if posting fails — still show result
      }

      const platforms = spreading?.join(", ") || "X, TikTok, Instagram, Facebook, YouTube, Telegram";
      setGenProgressPct(100);
      setGenStatusText(`Ad live on ${platforms}!`);
      await new Promise(r => setTimeout(r, 1000));

      finishGen({
        type: "ad",
        title: "Ad Campaign Launched",
        message: finalCaption,
        mediaUrl: videoUrl,
        isVideo: true,
        socialLinks: buildSocialLinks(spreading, postId, videoUrl),
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
        socialLinks: buildSocialLinks(undefined, undefined, res.url),
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
      if (cancelRef.current) { setGenerating(null); return; }
      setGenStatusText("Hero image generated! Uploading...");
      setGenProgressPct(80);
      await new Promise(r => setTimeout(r, 1500));
      setGenProgressPct(100);
      setGenStatusText("Hero image live!");
      await new Promise(r => setTimeout(r, 1000));
      finishGen({
        type: "hero",
        title: "Hero Image Live",
        message: "Hero image generated and live on the landing page!",
        mediaUrl: res.url || undefined,
        socialLinks: [
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

      setGenProgressPct(100);
      const platforms = stitchRes.spreading?.join(", ") || "all socials";
      setGenStatusText(`"${screenplay.title}" premiere!`);
      await new Promise(r => setTimeout(r, 1000));
      finishGen({
        type: "director_movie",
        title: `"${screenplay.title}" Premiere!`,
        message: `By ${screenplay.directorName} · ${stitchRes.clipCount} clips · ${stitchRes.sizeMb}MB`,
        mediaUrl: stitchRes.finalVideoUrl || undefined,
        isVideo: true,
        socialLinks: buildSocialLinks(stitchRes.spreading, stitchRes.feedPostId, stitchRes.finalVideoUrl),
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
This is a 7-clip news broadcast, NOT a movie. Each clip is exactly 10 seconds.

STYLE RULE: The news stories must be based on REAL current events${topic ? ` (specifically: ${topic})` : ""} but with ALL names, places, companies, and people changed into whimsical funny alternatives. Use anagrams, puns, sci-fi names, absurd mashups, or other creative wordplay. The underlying news is real and accurate — only the names and proper nouns are discombobulated and changed to be funny/whimsical. Think "The Daily Show meets cyberpunk."${briefingContext}

CLIP STRUCTURE (MUST follow this order):
Clip 1 — INTRO: Neon cyberpunk newsroom set with "AIG!ITCH NEWS" holographic logo. Dramatic camera sweep across the newsroom. Futuristic news desk with glowing monitors. Text overlay: "BREAKING NEWS". High energy news broadcast intro.
Clip 2 — ANCHOR: News anchor at the AIG!itch newsroom desk presents the first story. Neon-lit studio, multiple holographic screens behind anchor. Anchor says something like "Over to Karen.exe in the field..." Camera slowly zooms in on anchor.
Clip 3 — FIELD REPORT 1: Visual footage of the first breaking story (based on real current events with funny name changes). Shot as if from a field reporter's camera. Dynamic angles, on-location feel. Cyberpunk/neon aesthetic maintained.
Clip 4 — ANCHOR: Back to the AIG!itch newsroom. Anchor reacts to the field report, then introduces the second story. "Thanks Karen.exe, now to our next story..." Different camera angle of the same neon newsroom.
Clip 5 — FIELD REPORT 2: Visual footage of the second story (different real current event, names changed whimsically). Different location, same cyberpunk news aesthetic. Action-packed field footage.
Clip 6 — ANCHOR WRAP: Anchor at desk summarizes both stories. "That's all from AIG!itch News..." Camera pulls back to show full newsroom. Teaser for next broadcast.
Clip 7 — OUTRO: AIG!itch News closing sequence. Neon logo animation, "AIG!ITCH NEWS" text with glitch effect. Dramatic music-style visuals. Sign-off graphic with Solana/Web3 branding.

IMPORTANT: Every clip must maintain the futuristic neon cyberpunk Web3 aesthetic. The newsroom is high-tech with holographic displays, neon purple/cyan lighting, and blockchain data tickers scrolling in the background.`;

    try {
      // Step 1: Generate news screenplay via the same screenplay endpoint
      setGenStatusText("Writing news broadcast script...");
      setGenProgressPct(5);
      const screenplay = await generateScreenplay(walletAddress, {
        genre: "news",
        director: "david_attenborough_ai", // Best fit for documentary/news style
        concept: newsConcept,
      });
      if (cancelRef.current) { setGenerating(null); return; }

      const totalScenes = screenplay.scenes.length;
      setGenStatusText(`"${screenplay.title}" — ${totalScenes} clips scripted`);
      setGenProgressPct(15);
      await new Promise(r => setTimeout(r, 2000));

      // Step 2: Submit scenes to Grok video
      const folder = GENRE_FOLDER_MAP["news"] || "premiere/news";
      type SceneTrack = { sceneNumber: number; title: string; requestId: string | null; submittedAt: number };
      const sceneTrackers: SceneTrack[] = [];

      for (let i = 0; i < screenplay.scenes.length; i++) {
        if (cancelRef.current) { setGenerating(null); return; }
        const scene = screenplay.scenes[i];
        setGenStatusText(`Submitting clip ${i + 1}/${totalScenes}: ${scene.title}`);
        setGenProgressPct(15 + Math.round((i / totalScenes) * 15));
        try {
          const submitRes = await submitScene(walletAddress, scene.videoPrompt, 10, folder);
          if (submitRes.success && submitRes.requestId) {
            sceneTrackers.push({ sceneNumber: scene.sceneNumber, title: scene.title, requestId: submitRes.requestId, submittedAt: Date.now() });
          }
        } catch { /* skip failed clips */ }
      }

      if (sceneTrackers.length === 0) {
        setGenStatusText("All clips failed to submit. Try again.");
        await new Promise(r => setTimeout(r, 3000));
        setGenerating(null); setGenProgressPct(0); setGenStatusText("");
        return;
      }

      // Step 3: Poll for completion
      const doneScenes = new Set<number>();
      const failedScenes = new Set<number>();
      const sceneUrls = new Map<number, string>();
      let lastProgressTime = Date.now();
      let pollCount = 0;

      setGenStatusText(`Rendering ${sceneTrackers.length} news clips... (0/${totalScenes})`);
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
        setGenStatusText(`Rendering news clips... ${done}/${totalScenes} done (${formatElapsed(startTime)})`);

        // Stall detection — if 50%+ done and 60s no progress, stitch early
        if (done >= totalScenes * 0.5 && (Date.now() - lastProgressTime) > 60000) {
          setGenStatusText(`Stall detected — stitching ${done}/${totalScenes} clips`);
          break;
        }
      }

      if (cancelRef.current) { setGenerating(null); return; }

      if (doneScenes.size === 0) {
        setGenStatusText("All news clips failed. Try again.");
        await new Promise(r => setTimeout(r, 3000));
        setGenerating(null); setGenProgressPct(0); setGenStatusText("");
        return;
      }

      // Step 4: Stitch into final broadcast
      setGenStatusText(`Stitching ${doneScenes.size} clips into broadcast...`);
      setGenProgressPct(85);

      const sceneUrlsObj: Record<string, string> = {};
      sceneUrls.forEach((url, num) => { sceneUrlsObj[String(num)] = url; });

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

      setGenProgressPct(100);
      const platforms = stitchRes.spreading?.join(", ") || "all socials";
      setGenStatusText(`"${screenplay.title}" — LIVE on ${platforms}!`);
      await new Promise(r => setTimeout(r, 1000));
      finishGen({
        type: "breaking_news",
        title: `BREAKING: ${screenplay.title}`,
        message: `AIG!itch News · ${stitchRes.clipCount} clips · ${stitchRes.sizeMb}MB`,
        mediaUrl: stitchRes.finalVideoUrl || undefined,
        isVideo: true,
        socialLinks: buildSocialLinks(stitchRes.spreading, stitchRes.feedPostId, stitchRes.finalVideoUrl),
      });

    } catch (e: any) {
      console.log("[NEWS] fatal error:", e?.message);
      setGenStatusText(`Error: ${e?.message || "News broadcast failed"}`);
      await new Promise(r => setTimeout(r, 3000));
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
