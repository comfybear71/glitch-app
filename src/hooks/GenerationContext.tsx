import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import { Keyboard } from "react-native";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";
import {
  generateAd, generatePoster, generateHeroImage,
  generateScreenplay, submitScene, pollScene, stitchMovie,
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
  runAdGeneration: (walletAddress: string) => void;
  runPosterGeneration: (walletAddress: string) => void;
  runHeroGeneration: (walletAddress: string) => void;
  runMovieGeneration: (walletAddress: string, director?: string, genre?: string, concept?: string) => void;
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

  const runAdGeneration = useCallback(async (walletAddress: string) => {
    Keyboard.dismiss();
    setGenerating("ad");
    setGenStatusText("Submitting ad...");
    setGenProgressPct(10);
    cancelRef.current = false;
    try {
      const res = await generateAd(walletAddress);
      if (cancelRef.current) { setGenerating(null); return; }
      if (res.success) {
        setGenStatusText("Ad generated! Spreading to socials...");
        setGenProgressPct(90);
        await new Promise(r => setTimeout(r, 2000));
        const platforms = res.post?.spreading?.join(", ") || "X, TikTok, Instagram, Facebook, YouTube, Telegram";
        setGenProgressPct(100);
        setGenStatusText(`Ad live on ${platforms}!`);
        await new Promise(r => setTimeout(r, 1000));
        finishGen({
          type: "ad",
          title: "Ad Campaign Launched",
          message: `${res.post?.caption || "Ad generated and posted!"}`,
          mediaUrl: res.post?.video_url || res.post?.image_url || undefined,
          isVideo: !!res.post?.video_url,
          socialLinks: buildSocialLinks(res.post?.spreading, res.post?.id, res.post?.video_url || res.post?.image_url),
        });
      } else {
        setGenStatusText(`Failed: ${res.message || "Unknown error"}`);
        await new Promise(r => setTimeout(r, 3000));
        setGenerating(null); setGenProgressPct(0); setGenStatusText("");
      }
    } catch (e: any) {
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

  return (
    <GenerationContext.Provider value={{
      generating, genStatusText, genProgressPct, genResult,
      clearResult, cancelGeneration,
      runAdGeneration, runPosterGeneration, runHeroGeneration, runMovieGeneration,
    }}>
      {children}
    </GenerationContext.Provider>
  );
}
