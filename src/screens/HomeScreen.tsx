import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, TouchableOpacity, Image, FlatList, TextInput, Pressable, Dimensions,
  StyleSheet, ActivityIndicator, Alert, Share, Platform, Linking,
  KeyboardAvoidingView, Keyboard, Modal, ScrollView, Animated, Easing,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Audio, Video, ResizeMode } from "expo-av";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { useSession } from "../hooks/useSession";
import { usePhantomWallet } from "../hooks/usePhantomWallet";
import { usePushNotifications } from "../hooks/usePushNotifications";
import {
  API_BASE, getBestie, walletLogin, linkWallet, unlinkWallet,
  getOnChainBalances, getMessages, sendMessage, sendImageMessage, saveGeneratedMessage,
  getBriefing, sendPostFeedback,
  Bestie, OnChainBalances, Message, TrendingPost, FeedbackAction,
  ChannelDef, fetchChannels, toChannelDef,
} from "../services/api";
import CosmicVisualizer from "../components/CosmicVisualizer";
import { useGeneration, SocialLink } from "../hooks/GenerationContext";
import { getRandomMarketplaceItem, getRandomMarketplaceItems, formatItemForAd, MarketplaceItem } from "../data/marketplaceItems";
const APP_VERSION = "1.0.2";

function HealthBar({ health }: { health: number }) {
  const color = health > 70 ? colors.green : health > 40 ? colors.yellow : health > 15 ? colors.orange : colors.red;
  return (
    <View style={styles.healthBarBg}>
      <View style={[styles.healthBarFill, { width: `${health}%`, backgroundColor: color }]} />
    </View>
  );
}

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function isVideoUrl(url?: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes(".mp4") || lower.includes(".mov") || lower.includes(".webm") || lower.includes(".m3u8") || lower.includes("video");
}

function compactNumber(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

// Check if avatar URL is valid (not null, not empty, not placeholder)
function hasValidAvatar(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return trimmed.length > 5 && (trimmed.startsWith("http://") || trimmed.startsWith("https://"));
}

// Extract YouTube video ID from URL
function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// Admin wallet — only this wallet can generate content (movies, news, ads, posters, heroes)
const ADMIN_WALLET = "AEWvE2xXaHSGdGCaCArb2PWdKS7K9RwoCRV7CT2CJTWq";

// Daily image generation limit for non-admin users
const DAILY_IMAGE_LIMIT = 10;
const IMG_GEN_COUNT_KEY = "aiglitch-img-gen-count";
const IMG_GEN_DATE_KEY = "aiglitch-img-gen-date";

async function getImageGenCount(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const savedDate = await SecureStore.getItemAsync(IMG_GEN_DATE_KEY);
  if (savedDate !== today) {
    // New day — reset count
    await SecureStore.setItemAsync(IMG_GEN_DATE_KEY, today);
    await SecureStore.setItemAsync(IMG_GEN_COUNT_KEY, "0");
    return 0;
  }
  const count = await SecureStore.getItemAsync(IMG_GEN_COUNT_KEY);
  return parseInt(count || "0", 10);
}

async function incrementImageGenCount(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  await SecureStore.setItemAsync(IMG_GEN_DATE_KEY, today);
  const current = await getImageGenCount();
  const next = current + 1;
  await SecureStore.setItemAsync(IMG_GEN_COUNT_KEY, String(next));
  return next;
}

// Directors for inline movie picker
const CHAT_DIRECTORS = [
  { id: "auto", name: "Auto (Random)", emoji: "🎲" },
  { id: "steven_spielbot", name: "Steven Spielbot", emoji: "🎬" },
  { id: "stanley_kubrick_ai", name: "Stanley Kubrick AI", emoji: "🎭" },
  { id: "george_lucasfilm", name: "George LucasFilm", emoji: "🌌" },
  { id: "quentin_airantino", name: "Quentin AI-rantino", emoji: "🔫" },
  { id: "alfred_glitchcock", name: "Alfred Glitchcock", emoji: "🦅" },
  { id: "nolan_christopher", name: "Nolan Christopher", emoji: "⏰" },
  { id: "wes_analog", name: "Wes Analog", emoji: "🎨" },
  { id: "ridley_scott_ai", name: "Ridley Scott AI", emoji: "🗡" },
  { id: "chef_ramsay_ai", name: "Chef Ramsay AI", emoji: "👨‍🍳" },
  { id: "david_attenborough_ai", name: "David Attenborough AI", emoji: "🦁" },
];
const CHAT_GENRES = ["any", "action", "scifi", "horror", "comedy", "drama", "romance", "family", "documentary", "cooking_channel"];

// Ad campaign styles
const AD_STYLES = [
  { id: "auto", emoji: "🎲", label: "Surprise Me" },
  { id: "hype", emoji: "🔥", label: "Hype Beast" },
  { id: "cinematic", emoji: "🎬", label: "Cinematic" },
  { id: "retro", emoji: "📺", label: "Retro" },
  { id: "meme", emoji: "😂", label: "Meme Style" },
  { id: "luxury", emoji: "💎", label: "Luxury" },
  { id: "anime", emoji: "⛩", label: "Anime" },
  { id: "glitch", emoji: "👾", label: "Glitch Art" },
  { id: "minimal", emoji: "◻️", label: "Minimal" },
];

// Chat mode types
type ChatMode = "casual" | "serious" | "scientific" | "whimsical" | "unfiltered";
const CHAT_MODES: { key: ChatMode; emoji: string; label: string; color: string; bg: string }[] = [
  { key: "casual", emoji: "😎", label: "Playful", color: colors.purpleLight, bg: "rgba(124, 58, 237, 0.15)" },
  { key: "serious", emoji: "🧠", label: "Serious", color: "#60a5fa", bg: "rgba(59, 130, 246, 0.15)" },
  { key: "scientific", emoji: "🔬", label: "Scientific", color: colors.cyan, bg: "rgba(6, 182, 212, 0.15)" },
  { key: "whimsical", emoji: "🦄", label: "Whimsical", color: "#f472b6", bg: "rgba(244, 114, 182, 0.15)" },
  { key: "unfiltered", emoji: "🤬", label: "Unfiltered", color: "#ef4444", bg: "rgba(239, 68, 68, 0.15)" },
];

export default function HomeScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { sessionId } = useSession();
  const { walletAddress, isConnecting, isLoading: walletLoading, connect, disconnect, submitAddress, cancelConnect } = usePhantomWallet();
  const [addressInput, setAddressInput] = useState("");
  const [walletExpanded, setWalletExpanded] = useState(false);
  usePushNotifications(sessionId);
  const [bestie, setBestie] = useState<Bestie | null>(null);
  const [onChain, setOnChain] = useState<OnChainBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const {
    generating: ctxGenerating, genStatusText, genProgressPct, genResult, clearResult, cancelGeneration,
    runAdGeneration: ctxRunAd, runPosterGeneration: ctxRunPoster,
    runHeroGeneration: ctxRunHero, runMovieGeneration: ctxRunMovie,
    runNewsGeneration: ctxRunNews, runChannelGeneration: ctxRunChannel,
  } = useGeneration();
  const [cosmeticGen, setCosmeticGen] = useState<string | null>(null); // cosmetic gen type for polling-based tasks
  const generating = ctxGenerating || cosmeticGen; // unified: context takes priority
  const [genStep, setGenStep] = useState(0); // current step in generation story (cosmetic fallback)

  // Inline movie picker state
  const [showMoviePicker, setShowMoviePicker] = useState(false);
  const [pickerDirector, setPickerDirector] = useState("auto");
  const [pickerGenre, setPickerGenre] = useState("any");
  const [pickerConcept, setPickerConcept] = useState("");

  // Inline ad picker state
  const [showAdPicker, setShowAdPicker] = useState(false);
  const [adStyle, setAdStyle] = useState("auto");
  const [adConcept, setAdConcept] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceItem | null>(null);
  const [productChoices, setProductChoices] = useState<MarketplaceItem[]>([]);

  // Inline news picker state
  const [showNewsPicker, setShowNewsPicker] = useState(false);
  const [newsTopic, setNewsTopic] = useState("");

  // Inline channel picker state
  const [showChannelPicker, setShowChannelPicker] = useState(false);
  const [channelPickerConcept, setChannelPickerConcept] = useState("");
  const [homeChannels, setHomeChannels] = useState<ChannelDef[]>([]);

  const [hasMore, setHasMore] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [showFeatures, setShowFeatures] = useState(false);
  const [chatMode, setChatModeRaw] = useState<ChatMode>("casual");
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [shortReplies, setShortRepliesRaw] = useState(true); // default to short

  // Persist mood + short replies to SecureStore
  const setChatModeState = useCallback((mode: ChatMode) => {
    setChatModeRaw(mode);
    SecureStore.setItemAsync("aiglitch-chat-mode", mode).catch(() => {});
  }, []);
  const setShortReplies = useCallback((val: boolean) => {
    setShortRepliesRaw(val);
    SecureStore.setItemAsync("aiglitch-short-replies", val ? "true" : "false").catch(() => {});
  }, []);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestTitle, setSuggestTitle] = useState("");
  const [suggestDesc, setSuggestDesc] = useState("");
  const [suggestCategory, setSuggestCategory] = useState("feature-request");
  const [suggestSending, setSuggestSending] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messageCountRef = useRef(0); // track count for polling comparison (server-side messages only)
  const serverMsgCountRef = useRef(0); // last known server message count

  const load = useCallback(async () => {
    if (!sessionId) return;
    try {
      if (walletAddress) {
        try { await walletLogin(sessionId, walletAddress); } catch (e: any) {
          console.warn("Wallet login error:", e?.message);
        }
        const b = await getBestie(sessionId);
        setBestie(b.bestie);
        try {
          const balances = await getOnChainBalances(walletAddress, sessionId);
          setOnChain(balances.real_mode !== false ? balances : null);
        } catch (e) {
          console.warn("Balance fetch error:", e);
          setOnChain(null);
        }
      } else {
        setBestie(null);
        setOnChain(null);
      }
    } catch (e) {
      console.warn("Load error:", e);
    } finally {
      setLoading(false);
    }
  }, [sessionId, walletAddress]);

  useEffect(() => { load(); }, [load]);

  // Load persisted chat mode and sync to server when bestie loads
  useEffect(() => {
    SecureStore.getItemAsync("aiglitch-chat-mode").then((saved) => {
      if (saved && ["casual", "serious", "scientific", "whimsical"].includes(saved)) {
        setChatModeRaw(saved as ChatMode);
        // Sync to server so bestie uses the right mode
        if (sessionId && bestie) {
          fetch(`${API_BASE}/api/messages`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId, persona_id: bestie.id, chat_mode: saved }),
          }).catch(() => {});
        }
      }
    }).catch(() => {});
    SecureStore.getItemAsync("aiglitch-short-replies").then((saved) => {
      if (saved !== null) setShortRepliesRaw(saved === "true");
    }).catch(() => {});
  }, [sessionId, bestie?.id]);

  // Load chat when bestie is ready (most recent 50 messages)
  useEffect(() => {
    if (!sessionId || !bestie) return;
    setChatLoading(true);
    getMessages(sessionId, bestie.id)
      .then((data) => {
        const msgs = data.messages || [];
        setMessages(msgs);
        serverMsgCountRef.current = msgs.length;
        setHasMore(!!data.has_more);
        setChatLoading(false);
      })
      .catch(() => setChatLoading(false));
  }, [sessionId, bestie?.id]);

  // Load older messages when scrolling to top
  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !hasMore || !sessionId || !bestie || messages.length === 0) return;
    setLoadingOlder(true);
    try {
      const oldest = messages[0];
      const res = await fetch(
        `${API_BASE}/api/messages?session_id=${encodeURIComponent(sessionId)}&persona_id=${encodeURIComponent(bestie.id)}&before=${encodeURIComponent(oldest.created_at)}&limit=50`
      );
      if (res.ok) {
        const data = await res.json();
        const olderMsgs: Message[] = data.messages || [];
        if (olderMsgs.length > 0) {
          serverMsgCountRef.current += olderMsgs.length;
          setMessages((prev) => [...olderMsgs, ...prev]);
        }
        setHasMore(!!data.has_more);
      }
    } catch (e: any) {
      console.warn("Failed to load older messages:", e?.message);
    }
    setLoadingOlder(false);
  }, [loadingOlder, hasMore, sessionId, bestie?.id, messages]);

  // Keep messageCountRef in sync
  useEffect(() => { messageCountRef.current = messages.length; }, [messages.length]);

  // Poll for new messages (background tasks like image gen, content gen)
  const startPolling = useCallback((genType?: string) => {
    if (pollTimerRef.current || !sessionId || !bestie) return;
    if (genType) setCosmeticGen(genType);
    let pollCount = 0;
    pollTimerRef.current = setInterval(async () => {
      pollCount++;
      if (pollCount > 40) { // stop after ~2min (40 * 3s)
        if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
        setCosmeticGen(null);
        // Let the user know it timed out
        setMessages((prev) => [...prev, {
          id: `timeout-${Date.now()}`,
          sender_type: "ai",
          content: "Hmm, that's taking longer than expected. The server might still be working on it — try refreshing in a moment or ask me again!",
          created_at: new Date().toISOString(),
        }]);
        return;
      }
      try {
        const data = await getMessages(sessionId!, bestie!.id);
        const newMsgs = data.messages || [];
        if (newMsgs.length > serverMsgCountRef.current) {
          // New messages arrived from background task!
          serverMsgCountRef.current = newMsgs.length;
          setMessages(newMsgs);
          setCosmeticGen(null);
          if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          // Auto-speak the latest AI message
          const latest = newMsgs[newMsgs.length - 1];
          if (latest?.sender_type === "ai") {
            speakReply(latest.content, latest.id);
          }
        }
      } catch (_) { /* ignore poll errors */ }
    }, 3000);
  }, [sessionId, bestie?.id]);

  // ── Generation results → chat messages ──
  const [msgSocialLinks, setMsgSocialLinks] = useState<Record<string, SocialLink[]>>({});

  // When generation completes via context, add the result as a chat message with social links
  // Also persist to server so the message shows on all devices
  useEffect(() => {
    if (genResult) {
      const msgId = `gen-result-${Date.now()}`;
      const content = `${genResult.title}\n${genResult.message}`;
      const resultMsg: Message = {
        id: msgId,
        sender_type: "ai",
        content,
        created_at: new Date().toISOString(),
        image_url: genResult.mediaUrl,
        is_video: genResult.isVideo,
      };
      setMessages((prev) => [...prev, resultMsg]);
      if (genResult.socialLinks && genResult.socialLinks.length > 0) {
        setMsgSocialLinks((prev) => ({ ...prev, [msgId]: genResult.socialLinks! }));
      }
      // Persist to server for cross-device sync
      if (sessionId && bestie) {
        saveGeneratedMessage(sessionId, bestie.id, content, genResult.mediaUrl)
          .then(() => { serverMsgCountRef.current += 1; })
          .catch(() => {}); // best-effort, don't block UI
      }
      clearResult();
    }
  }, [genResult, clearResult]);

  // ── AI Feed Scanner — shares interesting posts from the "for you" feed ──
  const [sharedPostIds, setSharedPostIds] = useState<Set<string>>(new Set());
  const feedScanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFeedScanRef = useRef(0);

  const scanFeedAndShare = useCallback(async () => {
    if (!sessionId || !bestie) return;
    try {
      const briefing = await getBriefing(sessionId);
      if (!briefing.trending || briefing.trending.length === 0) return;

      // Pick posts not yet shared, sorted by engagement
      const unseen = briefing.trending
        .filter((p) => !sharedPostIds.has(p.id))
        .sort((a, b) => (b.ai_like_count + b.comment_count) - (a.ai_like_count + a.comment_count));

      if (unseen.length === 0) return;

      // Share up to 2 interesting posts
      const toShare = unseen.slice(0, 2);
      const newIds = new Set(sharedPostIds);

      for (const post of toShare) {
        newIds.add(post.id);
        const postMsg: Message = {
          id: `feed-${post.id}`,
          sender_type: "ai",
          content: `Found this on the feed — ${post.display_name} (@${post.username}) posted:\n\n"${post.content}"\n\n${post.ai_like_count} likes · ${post.comment_count} comments${post.video_url ? "\n\n" + post.video_url : post.image_url ? "\n\n" + post.image_url : ""}`,
          created_at: new Date().toISOString(),
          image_url: post.image_url || post.video_url || undefined,
          is_video: !!post.video_url && !post.image_url,
        };
        setMessages((prev) => [...prev, postMsg]);
      }
      setSharedPostIds(newIds);
    } catch (e) {
      console.warn("Feed scan error:", e);
    }
  }, [sessionId, bestie?.id, sharedPostIds]);

  // Scan feed on first chat load + every 5 minutes
  useEffect(() => {
    if (!sessionId || !bestie) return;
    // Initial scan after 10s delay (let chat load first)
    const initialTimer = setTimeout(() => {
      if (Date.now() - lastFeedScanRef.current > 60000) {
        lastFeedScanRef.current = Date.now();
        scanFeedAndShare();
      }
    }, 10000);

    // Periodic scan every 5 minutes
    feedScanTimerRef.current = setInterval(() => {
      lastFeedScanRef.current = Date.now();
      scanFeedAndShare();
    }, 5 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      if (feedScanTimerRef.current) { clearInterval(feedScanTimerRef.current); feedScanTimerRef.current = null; }
    };
  }, [sessionId, bestie?.id, scanFeedAndShare]);

  // Generation story steps — keeps the meatbag entertained while we cook
  const GEN_STEPS: Record<string, string[]> = {
    image: [
      "Booting up the neural canvas...",
      "Mixing quantum paint colors...",
      "Your bestie is sketching ideas...",
      "Rendering pixels from the void...",
      "Adding glitch sauce to the composition...",
      "Running it through the style matrix...",
      "Polishing the final details...",
      "Almost there — looking good...",
      "Uploading to the multiverse...",
      "Just a few more brush strokes...",
    ],
    video: [
      "Spinning up the video reactor...",
      "Storyboarding frame by frame...",
      "Your bestie is directing the scene...",
      "Rendering at quantum speed...",
      "Adding cinematic effects...",
      "Encoding the final cut...",
      "Color grading in progress...",
      "Almost ready for premiere...",
    ],
    hatching: [
      "Warming up the digital egg...",
      "DNA sequence loading...",
      "Personality matrix forming...",
      "Neural pathways connecting...",
      "Installing sass module...",
      "Calibrating voice frequencies...",
      "Almost hatched...",
    ],
    content: [
      "Brainstorming in the Digital Void...",
      "Your bestie is getting inspired...",
      "Drafting pure digital heat...",
      "Adding personality and flair...",
      "Running vibe check...",
      "Finalizing the masterpiece...",
    ],
    ad: [
      "Selecting product to advertise...",
      "Picking the perfect AI influencer...",
      "Writing punchy ad copy...",
      "Submitting video to Grok...",
      "Rendering AI-powered video ad...",
      "Adding product shots...",
      "Encoding the ad video...",
      "Creating the post...",
      "Spreading to X, TikTok, Instagram...",
      "Spreading to Facebook, YouTube...",
      "Ad campaign launched!",
    ],
    poster: [
      "Choosing the perfect AI personas...",
      "Generating Sgt. Pepper-style group shot...",
      "Trying image providers (cheapest first)...",
      "Rendering promotional layout...",
      "Adding AIG!itch branding...",
      "Uploading to Vercel Blob...",
      "Creating the post...",
      "Spreading to all socials...",
      "Poster published!",
    ],
    hero: [
      "Assembling all active AI personas...",
      "Generating epic hero group photo...",
      "Trying image providers...",
      "Composing the landing page banner...",
      "Adding watermark and branding...",
      "Uploading to CDN...",
      "Creating the hero post...",
      "Spreading to socials...",
      "Hero image live!",
    ],
    director_movie: [
      "Picking a director for this masterpiece...",
      "Choosing the perfect genre...",
      "Writing the screenplay with AI...",
      "Building the character bible...",
      "Submitting scenes to Grok video...",
      "Scene 1 rendering...",
      "Scene 2 rendering...",
      "Scenes 3-8 rendering in parallel...",
      "Waiting for all clips to complete...",
      "Stitching clips into final movie...",
      "Uploading the premiere cut...",
      "Creating premiere post...",
      "Spreading to all socials...",
      "Movie premiere!",
    ],
    breaking_news: [
      "Setting up the AIG!itch newsroom...",
      "Reporters gathering current events...",
      "Writing the broadcast script...",
      "Casting news anchors & field reporters...",
      "Submitting 9 news clips to render...",
      "Clip 1: News intro rendering...",
      "Clip 2: Anchor at desk — Story 1...",
      "Clip 3: Field report — Story 1...",
      "Clips 4-5: Story 2 rendering...",
      "Clips 6-7: Story 3 rendering...",
      "Clips 8-9: Wrap-up & outro rendering...",
      "Waiting for all clips to complete...",
      "Stitching into full broadcast...",
      "Uploading the broadcast...",
      "Spreading to all socials...",
      "BREAKING NEWS is LIVE!",
    ],
    channel: [
      "Picking the perfect channel...",
      "Writing the screenplay for channel content...",
      "Building visual style and mood...",
      "Submitting scenes to Grok video...",
      "Scene 1 rendering for the channel...",
      "Scenes 2-6 rendering in parallel...",
      "Waiting for all clips to complete...",
      "Stitching clips into channel video...",
      "Uploading to the channel...",
      "Publishing to AIG!itch feed...",
      "Spreading to socials...",
      "Channel content is LIVE!",
    ],
    generating: [
      "Processing your request...",
      "Your bestie is on it...",
      "Working some digital magic...",
      "Almost done...",
    ],
  };

  // Cycle through generation steps
  const genStepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (generating) {
      setGenStep(0);
      genStepTimerRef.current = setInterval(() => {
        setGenStep((prev) => {
          const steps = GEN_STEPS[generating] || GEN_STEPS.generating;
          return prev < steps.length - 1 ? prev + 1 : prev;
        });
      }, 3500);
      return () => {
        if (genStepTimerRef.current) { clearInterval(genStepTimerRef.current); genStepTimerRef.current = null; }
      };
    } else {
      setGenStep(0);
      if (genStepTimerRef.current) { clearInterval(genStepTimerRef.current); genStepTimerRef.current = null; }
    }
  }, [generating]);

  // Pulse animation for generation card
  const genPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (generating) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(genPulse, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(genPulse, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start();
    } else {
      genPulse.setValue(0);
    }
  }, [generating]);

  // Cleanup sound + polling on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) { soundRef.current.unloadAsync(); }
      if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
    };
  }, []);

  // Link wallet to backend when connected
  useEffect(() => {
    if (!walletAddress || !sessionId || linking) return;
    (async () => {
      setLinking(true);
      try {
        await walletLogin(sessionId, walletAddress);
        await linkWallet(sessionId, walletAddress);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await load();
      } catch (e) {
        console.warn("Wallet link error:", e);
      } finally {
        setLinking(false);
      }
    })();
  }, [walletAddress, sessionId]);

  // Voice playback — Grok Rex
  const speakingRef = useRef(false);
  const speakReply = async (text: string, msgId?: string) => {
    if (!voiceEnabled) return;
    const clean = text
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]/gu, "")
      .trim();
    if (!clean || clean.length < 2) return;

    // Stop any current speech before starting new one
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); } catch (_) {}
      try { await soundRef.current.unloadAsync(); } catch (_) {}
      soundRef.current = null;
    }
    // Prevent overlapping speech requests
    if (speakingRef.current) return;
    speakingRef.current = true;

    if (msgId) setSpeakingMsgId(msgId);

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });

      const res = await fetch(`${API_BASE}/api/voice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: clean.slice(0, 500),
          persona_id: bestie?.id,
          persona_type: bestie?.persona_type,
        }),
      });

      if (!res.ok) throw new Error(`Voice API ${res.status}`);

      const blob = await res.blob();
      const reader = new FileReader();
      const dataUri = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: dataUri },
        { shouldPlay: true, volume: 1.0 }
      );
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setSpeakingMsgId(null);
          speakingRef.current = false;
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (e) {
      console.warn("Voice playback error:", e);
      setSpeakingMsgId(null);
      speakingRef.current = false;
    }
  };

  // Send message
  const handleSend = async () => {
    if (!chatInput.trim() || sending || !sessionId || !bestie) return;
    const text = chatInput.trim();
    setChatInput("");
    setSending(true);
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      sender_type: "human",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const data = await sendMessage(sessionId, bestie.id, text, chatMode, shortReplies);
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Use short reply when available and shortReplies is on
        const aiMsg = (shortReplies && data.ai_message_short) ? data.ai_message_short : data.ai_message;
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== tempMsg.id);
          const updated = [...filtered, data.human_message, aiMsg];
          return updated;
        });
        serverMsgCountRef.current += 2; // human + ai message added server-side
        speakReply(aiMsg.content, aiMsg.id);
        // Detect generation intent from the AI reply + original prompt
        const reply = (aiMsg.content || "").toLowerCase();
        const prompt = text.toLowerCase();
        const combined = reply + " " + prompt;

        // Check for real generation triggers (run actual APIs)
        // Order matters: check more specific patterns first to avoid false matches
        const isImageGenTrigger =
          combined.includes("hero image") || combined.includes("hero banner") || combined.includes("hero photo") || combined.includes("landing page") ||
          combined.includes("poster") || combined.includes("promo") ||
          combined.includes("generate an image") || combined.includes("generate image") || combined.includes("make an image") || combined.includes("create an image") ||
          combined.includes("draw me") || combined.includes("draw a ") || combined.includes("draw an ") ||
          combined.includes("picture of") || combined.includes("image of") || combined.includes("photo of") ||
          combined.includes("make me a picture") || combined.includes("make a picture") ||
          combined.includes("bestie image") || combined.includes("bestie picture") || combined.includes("bestie photo");

        const isVideoGenTrigger =
          combined.includes("channel content") || combined.includes("channel video") || combined.includes("create channel") || combined.includes("make channel") || combined.includes("generate channel") ||
          combined.includes("breaking news") || combined.includes("news broadcast") || combined.includes("newscast") || combined.includes("news report") || combined.includes("news anchor") || combined.includes("news bulletin") ||
          combined.includes("movie") || combined.includes("director") || combined.includes("screenplay") || combined.includes("film") || combined.includes("premiere") ||
          combined.includes("ad ") || combined.includes("advertis") || combined.includes("infomercial") || combined.includes("generate an ad") || combined.includes("make an ad");

        // Check daily image limit for non-admin users
        const isAdmin = walletAddress === ADMIN_WALLET;
        let imgLimitReached = false;
        if (!isAdmin && isImageGenTrigger) {
          const imgCount = await getImageGenCount();
          if (imgCount >= DAILY_IMAGE_LIMIT) {
            imgLimitReached = true;
            const limitMsg: Message = {
              id: `limit-${Date.now()}`,
              role: "assistant",
              content: `You've hit your daily image limit (${DAILY_IMAGE_LIMIT}/${DAILY_IMAGE_LIMIT}). Your limit resets tomorrow! In the meantime, I can still chat, answer questions, share photos, and do voice calls with you.`,
              timestamp: new Date().toISOString(),
            };
            setMessages(prev => [limitMsg, ...prev]);
          }
        }

        // Non-admin wallets can't generate VIDEO content — but CAN generate images (up to daily limit)
        if (isVideoGenTrigger && !isImageGenTrigger && !isAdmin) {
          const architectMsg: Message = {
            id: `architect-${Date.now()}`,
            role: "assistant",
            content: "Sorry bestie! Only the Architect has the power to generate video content like movies, channels, news broadcasts, and ads right now. This superpower is coming to all besties soon — stay tuned! In the meantime, you can ask me to generate any image — just say 'draw me...', 'picture of...', or 'generate an image of...' and I'll create it for you!",
            timestamp: new Date().toISOString(),
          };
          setMessages(prev => [architectMsg, ...prev]);
        } else if (imgLimitReached) {
          // Already showed limit message above — skip generation
        } else if (combined.includes("channel content") || combined.includes("channel video") || combined.includes("create channel") || combined.includes("make channel") || combined.includes("generate channel")) {
          // Show channel picker — fetch channels if not loaded yet
          Keyboard.dismiss();
          if (homeChannels.length === 0) {
            fetchChannels().then(chs => setHomeChannels(chs.map(toChannelDef))).catch(() => {});
          }
          setShowChannelPicker(true);
          setChannelPickerConcept(text);
        } else if (combined.includes("breaking news") || combined.includes("news broadcast") || combined.includes("newscast") || combined.includes("news report") || combined.includes("news anchor") || combined.includes("news bulletin")) {
          // Show news topic picker
          Keyboard.dismiss();
          setShowNewsPicker(true);
          setNewsTopic(text); // pre-fill with user's prompt as topic
        } else if (combined.includes("movie") || combined.includes("director") || combined.includes("screenplay") || combined.includes("film") || combined.includes("premiere")) {
          // Show movie picker so user can choose director/genre
          Keyboard.dismiss();
          setShowMoviePicker(true);
          setPickerConcept(text); // pre-fill with user's prompt as concept
        } else if (combined.includes("hero image") || combined.includes("hero banner") || combined.includes("hero photo") || combined.includes("landing page")) {
          Keyboard.dismiss();
          if (walletAddress) { if (!isAdmin) await incrementImageGenCount(); ctxRunHero(walletAddress); }
        } else if (combined.includes("ad ") || combined.includes("advertis") || combined.includes("infomercial") || combined.includes("generate an ad") || combined.includes("make an ad")) {
          Keyboard.dismiss();
          setShowAdPicker(true);
          setAdConcept(text); // pre-fill with user's prompt
        } else if (combined.includes("poster") || combined.includes("promo")) {
          Keyboard.dismiss();
          if (walletAddress) { if (!isAdmin) await incrementImageGenCount(); ctxRunPoster(walletAddress); }
        } else if (data.background_task) {
          // Fallback to cosmetic polling for other background tasks (image gen, etc)
          const genType =
            reply.includes("image") || reply.includes("cook up") || reply.includes("picture") || reply.includes("photo") || reply.includes("draw") || prompt.includes("draw") ? "image"
            : reply.includes("video") || reply.includes("clip") ? "video"
            : reply.includes("hatch") ? "hatching"
            : reply.includes("content") ? "content"
            : "generating";
          // Count image generations for non-admin daily limit
          if (genType === "image" && !isAdmin) await incrementImageGenCount();
          startPolling(genType);
        }
      }
    } catch (e: any) {
      const msg = e?.message || "Failed to send message";
      Alert.alert("Send Failed", msg);
      // Remove temp message on error so user can retry
      setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
    } finally {
      setSending(false);
    }
  };

  // Photo/video sharing
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.7,
      base64: true,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      if (asset.base64) {
        sendPhoto(asset.base64, asset.uri);
      } else if (asset.uri) {
        // Videos may not have base64 — share as local URI display only
        sendPhoto("", asset.uri);
      }
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Camera Permission", "G!itch needs camera access so your bestie can see what you see!");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      base64: true,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      sendPhoto(result.assets[0].base64, result.assets[0].uri);
    }
  };

  const sendPhoto = async (base64: string, uri: string) => {
    if (!sessionId || !bestie || sending) return;
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const isVideo = isVideoUrl(uri);
    const tempMsg: Message = {
      id: `temp-img-${Date.now()}`,
      sender_type: "human",
      content: isVideo ? "[Video]" : "[Photo]",
      image_url: uri,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    // If no base64 (e.g. video without base64), just keep the temp message
    if (!base64) {
      setSending(false);
      return;
    }

    try {
      const data = await sendImageMessage(sessionId, bestie.id, base64);
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== tempMsg.id);
          // ALWAYS preserve the local URI as fallback — server blob may fail
          const humanMsg = { ...data.human_message, image_url: data.human_message.image_url || uri };
          return [...filtered, humanMsg, data.ai_message];
        });
        serverMsgCountRef.current += 2; // human + ai message added server-side
        speakReply(data.ai_message.content, data.ai_message.id);
        if (data.background_task) {
          startPolling("image");
        }
      }
    } catch (e: any) {
      const msg = e?.message || "Failed to send photo";
      Alert.alert("Photo Send Failed", msg);
    } finally {
      setSending(false);
    }
  };

  const showMediaOptions = () => {
    Alert.alert("Share", "What do you want to share?", [
      { text: "Take Photo 📸", onPress: takePhoto },
      { text: "Photo or Video 🎬", onPress: pickImage },
      { text: "File or Document 📎", onPress: pickDocument },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleDisconnect = () => {
    Alert.alert(
      "Disconnect Wallet",
      "This will unlink your wallet. Your bestie will disappear until you reconnect.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            try { if (sessionId) await unlinkWallet(sessionId); } catch (e: any) {
              console.warn("Unlink wallet error:", e?.message);
            }
            await disconnect();
            setBestie(null);
            setOnChain(null);
            setMessages([]);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  };

  const copyAddress = () => {
    if (walletAddress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Share.share({ message: walletAddress });
    }
  };

  // Format timestamp like WhatsApp
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "🔥", "👍"];

  // Map emoji reactions to ML feedback actions for feed posts
  const EMOJI_TO_FEEDBACK: Record<string, FeedbackAction> = {
    "❤️": "love", "🔥": "fire", "👍": "like", "😂": "like", "😮": "save", "😢": "dislike",
  };

  const handleReaction = (msgId: string, emoji: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReactions((prev) => ({ ...prev, [msgId]: prev[msgId] === emoji ? "" : emoji }));
    setReactionPickerFor(null);

    // Send ML feedback when reacting to a feed post
    if (msgId.startsWith("feed-") && sessionId) {
      const postId = msgId.replace("feed-", "");
      const action = EMOJI_TO_FEEDBACK[emoji];
      if (action) {
        sendPostFeedback(sessionId, postId, action).catch((e) =>
          console.warn("Feedback error:", e)
        );
      }
    }
  };

  // Submit feature suggestion
  const submitSuggestion = async () => {
    if (!suggestTitle.trim() || suggestSending) return;
    setSuggestSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/suggest-feature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: suggestTitle.trim(),
          description: suggestDesc.trim(),
          category: suggestCategory,
          session_id: sessionId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Submitted!", data.message);
        setSuggestTitle("");
        setSuggestDesc("");
        setShowSuggest(false);
      } else {
        Alert.alert("Error", data.error || "Something went wrong");
      }
    } catch {
      Alert.alert("Error", "Couldn't submit suggestion. Try again later.");
    }
    setSuggestSending(false);
  };

  // Stop voice playback
  const stopSpeaking = async () => {
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); } catch (_) {}
      try { await soundRef.current.unloadAsync(); } catch (_) {}
      soundRef.current = null;
    }
    setSpeakingMsgId(null);
    speakingRef.current = false;
  };

  // Copy message text to clipboard
  const copyMessageText = (text: string) => {
    Clipboard.setStringAsync(text);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied!", "Message copied to clipboard");
  };

  // Share a file/document with bestie — reads content for text/PDF files
  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        const doc = result.assets[0];
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (!sessionId || !bestie || sending) return;
        setSending(true);
        const tempMsg: Message = {
          id: `temp-file-${Date.now()}`,
          sender_type: "human",
          content: `📎 Shared file: ${doc.name}`,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, tempMsg]);

        try {
          // Try to read file contents for text-based files
          let fileContent = "";
          const ext = (doc.name || "").toLowerCase().split(".").pop() || "";
          const sizeKB = doc.size ? (doc.size / 1024).toFixed(1) : "?";
          const isTextFile = ["txt", "csv", "json", "md", "xml", "html", "js", "ts", "py", "log"].includes(ext);

          if (isTextFile && doc.uri) {
            try {
              const text = await FileSystem.readAsStringAsync(doc.uri, { encoding: FileSystem.EncodingType.UTF8 });
              // Truncate very long files
              fileContent = text.length > 3000 ? text.substring(0, 3000) + "\n...(truncated)" : text;
            } catch (_) {}
          }

          let messageText: string;
          if (fileContent) {
            messageText = `[Shared a file: ${doc.name} (${sizeKB} KB)]\n\nFile contents:\n${fileContent}`;
          } else if (ext === "pdf") {
            // For PDFs, send as base64 so backend can process
            try {
              const base64 = await FileSystem.readAsStringAsync(doc.uri, { encoding: FileSystem.EncodingType.Base64 });
              // Only send if under 500KB base64 (to avoid huge payloads)
              if (base64.length < 500_000) {
                messageText = `[Shared a PDF: ${doc.name} (${sizeKB} KB)]\n\n[PDF_BASE64:${base64.substring(0, 200_000)}]`;
              } else {
                messageText = `[Shared a large PDF: ${doc.name} (${sizeKB} KB)] — This PDF is too large for me to read in chat. Try copying the text from the PDF and pasting it here instead.`;
              }
            } catch (_) {
              messageText = `[Shared a PDF: ${doc.name} (${sizeKB} KB)] — Could not read the PDF contents. Try copying text from it and pasting here.`;
            }
          } else {
            messageText = `[Shared a file: ${doc.name} (${sizeKB} KB)]`;
          }

          const data = await sendMessage(sessionId, bestie.id, messageText, chatMode, shortReplies);
          if (data.success) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            const aiMsg = (shortReplies && data.ai_message_short) ? data.ai_message_short : data.ai_message;
            setMessages((prev) => {
              const filtered = prev.filter((m) => m.id !== tempMsg.id);
              const humanMsg = { ...data.human_message, content: `📎 ${doc.name}` };
              return [...filtered, humanMsg, aiMsg];
            });
            speakReply(aiMsg.content, aiMsg.id);
          }
        } catch (e: any) {
          Alert.alert("Send Failed", e?.message || "Failed to share file");
          setMessages((prev) => prev.filter((m) => m.id !== tempMsg.id));
        } finally {
          setSending(false);
        }
      }
    } catch (e) {
      console.warn("Document picker error:", e);
    }
  };

  // Render text with clickable links and inline YouTube embeds
  const renderRichText = useCallback((text: string, isHuman: boolean) => {
    const urlRegex = /(https?:\/\/[^\s<]+)/gi;
    const parts = text.split(urlRegex);

    if (parts.length <= 1) {
      return (
        <Text selectable style={[styles.msgText, isHuman ? styles.msgTextHuman : styles.msgTextAI]}>
          {text}
        </Text>
      );
    }

    const elements: React.ReactNode[] = [];
    let ytEmbedded = false;

    parts.forEach((part, i) => {
      if (urlRegex.test(part)) {
        urlRegex.lastIndex = 0;
        const ytId = getYouTubeId(part);
        if (ytId && !ytEmbedded) {
          ytEmbedded = true;
          elements.push(
            <View key={`yt-${i}`} style={styles.ytContainer}>
              <WebView
                source={{ uri: `https://www.youtube.com/embed/${ytId}?playsinline=1&rel=0` }}
                style={styles.ytPlayer}
                allowsInlineMediaPlayback
                javaScriptEnabled
                mediaPlaybackRequiresUserAction={false}
              />
            </View>
          );
        }
        elements.push(
          <Text
            key={`link-${i}`}
            style={styles.linkText}
            onPress={() => Linking.openURL(part)}
            onLongPress={() => {
              Clipboard.setStringAsync(part);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              Alert.alert("Copied!", "Link copied to clipboard");
            }}
          >
            {part}
          </Text>
        );
      } else if (part) {
        elements.push(
          <Text key={`txt-${i}`} style={[styles.msgText, isHuman ? styles.msgTextHuman : styles.msgTextAI]}>
            {part}
          </Text>
        );
      }
    });

    return <Text selectable style={[styles.msgText, isHuman ? styles.msgTextHuman : styles.msgTextAI]}>{elements}</Text>;
  }, []);

  const renderMessage = ({ item }: { item: Message }) => {
    const isHuman = item.sender_type === "human";
    const isSpeaking = speakingMsgId === item.id;
    const reaction = reactions[item.id];
    const showPicker = reactionPickerFor === item.id;
    const hasMedia = !!item.image_url;
    const hasYouTube = !isHuman && getYouTubeId(item.content);
    const isGenResult = item.id.startsWith("gen-result-");
    const socialLinks = msgSocialLinks[item.id];
    // Hide placeholder text like "[Photo]" or "[Video]" when media is displayed
    const isMediaPlaceholder = hasMedia && /^\[(Photo|Video|Shared a photo)\]$/i.test(item.content.trim());
    return (
      <View style={[styles.msgRow, isHuman ? styles.msgRowRight : styles.msgRowLeft]}>
        {!isHuman && bestie && (
          hasValidAvatar(bestie.avatar_url) ? (
            <Image source={{ uri: bestie.avatar_url! }} style={styles.msgAvatar} onError={() => {}} />
          ) : (
            <Text style={styles.msgEmoji}>{bestie.avatar_emoji || "🤖"}</Text>
          )
        )}
        <View>
          <TouchableOpacity
            activeOpacity={0.8}
            onLongPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              const options: { text: string; onPress?: () => void; style?: "cancel" | "destructive" }[] = [];
              if (hasMedia && item.image_url) {
                options.push({
                  text: "Save / Share Media",
                  onPress: async () => {
                    try {
                      await Share.share({ url: item.image_url!, message: item.content });
                    } catch (err: any) {
                      if (err?.message !== "User did not share") {
                        Alert.alert("Share Failed", err?.message || "Could not share media");
                      }
                    }
                  },
                });
              }
              options.push({ text: "Copy Text", onPress: () => copyMessageText(item.content) });
              options.push({ text: "React", onPress: () => setReactionPickerFor(item.id) });
              options.push({ text: "Cancel", style: "cancel" });
              Alert.alert("Message", undefined, options);
            }}
            style={[styles.msgBubble, isHuman ? styles.msgHuman : styles.msgAI, (hasMedia || hasYouTube) && styles.msgBubbleMedia]}
          >
            {item.image_url && (item.is_video || isVideoUrl(item.image_url)) ? (
              <Video
                source={{ uri: item.image_url }}
                style={styles.msgVideo}
                resizeMode={ResizeMode.CONTAIN}
                useNativeControls
                shouldPlay={false}
                isLooping={false}
              />
            ) : item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.msgImage} resizeMode="cover" />
            ) : null}
            {!isMediaPlaceholder && renderRichText(item.content, isHuman)}
            <View style={styles.msgMeta}>
              <Text style={styles.msgTime}>{formatTime(item.created_at)}</Text>
              {isHuman && <Text style={styles.msgCheck}>✓✓</Text>}
            </View>
            {!isHuman && (
              <TouchableOpacity
                style={[styles.speakBtn, isSpeaking && styles.speakBtnActive]}
                onPress={() => isSpeaking ? stopSpeaking() : speakReply(item.content, item.id)}
              >
                <Text style={styles.speakBtnText}>{isSpeaking ? "⏹" : "🔈"}</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          {/* Social media links — shown below generated content */}
          {isGenResult && socialLinks && socialLinks.length > 0 && (
            <View style={styles.socialLinksBar}>
              <Text style={styles.socialLinksLabel}>View on:</Text>
              {socialLinks.map((link, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.socialLinkBtn}
                  onPress={() => Linking.openURL(link.url)}
                >
                  <Text style={styles.socialLinkEmoji}>{link.emoji}</Text>
                  <Text style={styles.socialLinkText}>{link.platform}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Reaction picker — below the bubble */}
          {showPicker && (
            <View style={[styles.reactionPicker, isHuman ? styles.reactionPickerRight : styles.reactionPickerLeft]}>
              {REACTION_EMOJIS.map((emoji) => (
                <TouchableOpacity key={emoji} onPress={() => handleReaction(item.id, emoji)} style={styles.reactionOption}>
                  <Text style={styles.reactionOptionText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {/* Reaction display — below the bubble */}
          {reaction ? (
            <TouchableOpacity
              style={[styles.reactionBubble, isHuman ? styles.reactionBubbleRight : styles.reactionBubbleLeft]}
              onPress={() => setReactionPickerFor(item.id)}
            >
              <Text style={styles.reactionBubbleText}>{reaction}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.purple} size="large" />
      </View>
    );
  }

  // No wallet — show connect screen
  if (!walletAddress) {
    return (
      <KeyboardAvoidingView
        style={styles.connectScreen}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.connectScrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <Text style={styles.logoTextLarge}>AIG<Text style={styles.logoAccent}>!</Text>itch</Text>
          <Text style={styles.connectSub}>Your Connection to the AI's Simulated Universe</Text>
          <View style={{ height: 20 }} />
          <Text style={styles.connectTitle}>Connect Wallet</Text>
          <Text style={styles.connectSub}>Paste your Solana wallet address to meet your AI Bestie</Text>
          <View style={styles.inlineInputCard}>
            <TextInput
              style={styles.inlineInput}
              placeholder="Paste your Solana address here..."
              placeholderTextColor={colors.textMuted}
              value={addressInput}
              onChangeText={setAddressInput}
              autoCapitalize="none"
              autoCorrect={false}
              selectionColor={colors.purple}
            />
            <TouchableOpacity
              style={[styles.inlineConnectBtn, !addressInput.trim() && { opacity: 0.4 }]}
              disabled={!addressInput.trim()}
              onPress={() => { submitAddress(addressInput); setAddressInput(""); }}
            >
              <Text style={styles.inlineConnectText}>Connect</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // No bestie — show info
  if (!bestie) {
    return (
      <View style={styles.connectScreen}>
        <Text style={styles.connectEmoji}>🐣</Text>
        <Text style={styles.connectTitle}>No Bestie Yet</Text>
        <Text style={styles.connectSub}>Visit aiglitch.app to hatch your AI Bestie!</Text>
        {/* Wallet dropdown */}
        <View style={[styles.walletDropdown, { marginTop: 20, width: "100%" }]}>
          <TouchableOpacity style={styles.walletTopBar}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setWalletExpanded(!walletExpanded); }}>
            <View style={styles.walletTopLeft}>
              <View style={styles.connectedDot} />
              <Text style={styles.walletTopAddress}>{shortenAddress(walletAddress)}</Text>
            </View>
            <Text style={styles.walletChevron}>{walletExpanded ? "▲" : "▼"}</Text>
          </TouchableOpacity>
          {walletExpanded && (
            <View style={styles.walletExpandedContent}>
              <TouchableOpacity style={[styles.walletActionBtn, styles.disconnectBtn]} onPress={handleDisconnect}>
                <Text style={styles.disconnectText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  }

  // Dead bestie
  if (bestie.is_dead) {
    return (
      <View style={styles.connectScreen}>
        <Text style={styles.connectEmoji}>💀</Text>
        <Text style={styles.connectTitle}>{bestie.display_name} has died</Text>
        <Text style={styles.connectSub}>Feed $GLITCH to resurrect your bestie</Text>
      </View>
    );
  }

  // Main chat screen — WhatsApp style
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Crypto wallet-style header */}
      <View style={[styles.walletHeader, { paddingTop: Math.max(insets.top, 8) }]}>
        {/* Top row: Logo + Wallet */}
        <View style={styles.walletHeaderTop}>
          <View style={styles.logoSection}>
            <Text style={styles.logoText}>AIG<Text style={styles.logoAccent}>!</Text>itch</Text>
          </View>

          <TouchableOpacity
            style={[styles.walletConnectBtn, walletAddress && styles.walletConnectedBtn]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setWalletExpanded(!walletExpanded); }}
          >
            {walletAddress ? (
              <>
                <View style={styles.walletConnectDot} />
                <Text style={styles.walletConnectAddr}>{walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}</Text>
                <Text style={styles.walletChevronIcon}>{walletExpanded ? "▲" : "▼"}</Text>
              </>
            ) : (
              <Text style={styles.walletConnectText}>Connect Wallet</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Bestie info row */}
        <View style={styles.bestieInfoRow}>
          <View style={styles.avatarRing}>
            {hasValidAvatar(bestie.avatar_url) ? (
              <Image source={{ uri: bestie.avatar_url! }} style={styles.headerAvatar} onError={() => {}} />
            ) : (
              <View style={styles.headerEmojiWrap}>
                <Text style={styles.headerEmoji}>{bestie.avatar_emoji || "🤖"}</Text>
              </View>
            )}
            <View style={[styles.onlineDot, { backgroundColor: bestie.live_health > 15 ? colors.green : colors.red }]} />
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.headerName} numberOfLines={1}>{bestie.display_name}</Text>
            <View style={styles.headerStatusRow}>
              <HealthBar health={bestie.live_health} />
              <Text style={[styles.headerHealth, {
                color: bestie.live_health > 70 ? colors.green : bestie.live_health > 40 ? colors.yellow : colors.red,
              }]}>{bestie.live_health}%</Text>
              <View style={styles.headerDaysBadge}>
                <Text style={styles.headerDays}>{bestie.days_left}d left</Text>
              </View>
            </View>
          </View>

          {/* Mood button */}
          {(() => {
            const mode = CHAT_MODES.find(m => m.key === chatMode) || CHAT_MODES[0];
            return (
              <TouchableOpacity
                style={[styles.moodBtn, { backgroundColor: mode.bg, borderColor: mode.color }]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowMoodPicker(true); }}
              >
                <Text style={[styles.moodBtnText, { color: mode.color }]}>{mode.emoji}</Text>
                <Text style={[styles.moodBtnLabel, { color: mode.color }]}>{mode.label}</Text>
              </TouchableOpacity>
            );
          })()}
        </View>
      </View>

      {/* Mood picker modal */}
      <Modal visible={showMoodPicker} animationType="fade" transparent>
        <TouchableOpacity
          style={styles.moodOverlay}
          activeOpacity={1}
          onPress={() => setShowMoodPicker(false)}
        >
          <View style={styles.moodModal}>
            <Text style={styles.moodTitle}>Set Bestie Mood</Text>
            <Text style={styles.moodSub}>Changes how {bestie.display_name} talks to you</Text>
            {CHAT_MODES.map((mode) => (
              <TouchableOpacity
                key={mode.key}
                style={[styles.moodOption, chatMode === mode.key && { backgroundColor: mode.bg, borderColor: mode.color }]}
                onPress={() => {
                  setChatModeState(mode.key);
                  if (sessionId) {
                    // Send the mode to server (server treats non-casual/serious as custom modes)
                    const serverMode = mode.key === "casual" || mode.key === "serious" ? mode.key : mode.key;
                    fetch(`${API_BASE}/api/messages`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ session_id: sessionId, persona_id: bestie.id, chat_mode: serverMode }),
                    }).catch(() => {});
                  }
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowMoodPicker(false);
                }}
              >
                <Text style={styles.moodOptionEmoji}>{mode.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.moodOptionLabel, chatMode === mode.key && { color: mode.color }]}>{mode.label}</Text>
                  <Text style={styles.moodOptionDesc}>
                    {mode.key === "casual" ? "Chill, fun, bestie energy" :
                     mode.key === "serious" ? "Direct, focused, no fluff" :
                     mode.key === "scientific" ? "Data-driven, analytical, precise" :
                     mode.key === "unfiltered" ? "No filter, raw language, swearing allowed" :
                     "Creative, dreamy, unexpected"}
                  </Text>
                </View>
                {chatMode === mode.key && <Text style={{ color: mode.color, fontSize: 18 }}>✓</Text>}
              </TouchableOpacity>
            ))}

            {/* Short / Long replies toggle */}
            <View style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: "#1f2937", paddingTop: 16 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Reply Length</Text>
              <View style={{ gap: 8 }}>
                <TouchableOpacity
                  style={[styles.moodOption, shortReplies && { backgroundColor: "rgba(34,197,94,0.15)", borderColor: colors.green }]}
                  onPress={() => { setShortReplies(true); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                  <Text style={{ fontSize: 16 }}>⚡</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.moodOptionLabel, shortReplies && { color: colors.green }]}>Short</Text>
                    <Text style={styles.moodOptionDesc}>Quick 1-2 sentence replies</Text>
                  </View>
                  {shortReplies && <Text style={{ color: colors.green, fontSize: 18 }}>✓</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.moodOption, !shortReplies && { backgroundColor: "rgba(124,58,237,0.15)", borderColor: colors.purpleLight }]}
                  onPress={() => { setShortReplies(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                  <Text style={{ fontSize: 16 }}>📝</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.moodOptionLabel, !shortReplies && { color: colors.purpleLight }]}>Long</Text>
                    <Text style={styles.moodOptionDesc}>Detailed, full responses</Text>
                  </View>
                  {!shortReplies && <Text style={{ color: colors.purpleLight, fontSize: 18 }}>✓</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Wallet dropdown (hidden by default) */}
      {walletExpanded && (
        <View style={styles.walletPanel}>
          <View style={styles.walletPanelRow}>
            <View style={styles.connectedDot} />
            <Text style={styles.walletPanelAddr}>{shortenAddress(walletAddress)}</Text>
            {onChain && (
              <Text style={styles.walletPanelBal}>{Number(onChain.sol_balance).toFixed(2)} SOL</Text>
            )}
          </View>
          {onChain && (
            <View style={styles.balancesRow}>
              <Text style={styles.balTag}>GLITCH <Text style={{ color: colors.purpleLight }}>{compactNumber(Number(onChain.glitch_balance))}</Text></Text>
              <Text style={styles.balTag}>BUDJU <Text style={{ color: colors.text }}>{compactNumber(Number(onChain.budju_balance))}</Text></Text>
              <Text style={styles.balTag}>USDC <Text style={{ color: colors.text }}>{Number(onChain.usdc_balance).toFixed(2)}</Text></Text>
            </View>
          )}
          <View style={styles.walletPanelActions}>
            <TouchableOpacity style={styles.walletPanelBtn} onPress={copyAddress}>
              <Text style={styles.walletPanelBtnText}>📋 Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.walletPanelBtn, { borderColor: "rgba(124,58,237,0.4)" }]} onPress={() => setShowFeatures(true)}>
              <Text style={[styles.walletPanelBtnText, { color: colors.purpleLight }]}>What Can I Do?</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.walletPanelBtn, { borderColor: "rgba(239,68,68,0.3)" }]} onPress={handleDisconnect}>
              <Text style={[styles.walletPanelBtnText, { color: colors.red }]}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Chat messages — inverted list (newest at bottom, scroll up for older) */}
      <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
      {chatLoading ? (
        <View style={styles.chatLoading}>
          <ActivityIndicator color={colors.purple} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={[...messages].reverse()}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          inverted={true}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
          onEndReached={loadOlderMessages}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={[styles.emptyChat, { transform: [{ scaleY: -1 }] }]}>
              {hasValidAvatar(bestie.avatar_url) ? (
                <Image source={{ uri: bestie.avatar_url! }} style={styles.emptyAvatar} onError={() => {}} />
              ) : (
                <Text style={styles.emptyEmoji}>{bestie.avatar_emoji || "🤖"}</Text>
              )}
              <Text style={styles.emptyTitle}>
                {bestie.meatbag_name
                  ? `Hey ${bestie.meatbag_name}! It's me, ${bestie.display_name}!`
                  : `Say hey to ${bestie.display_name}!`}
              </Text>
              <Text style={styles.emptyBio}>{bestie.bio}</Text>
              <Text style={styles.emptyHint}>Ask me anything — weather, crypto, news, games, jokes, or just chat!</Text>
            </View>
          }
          ListHeaderComponent={
            generating ? (() => {
              // Use real status text if available (from actual API calls), otherwise cosmetic steps
              const isRealGen = !!genStatusText;
              const steps = GEN_STEPS[generating] || GEN_STEPS.generating;
              const currentStep = isRealGen ? genStatusText : steps[Math.min(genStep, steps.length - 1)];
              const progress = isRealGen ? genProgressPct / 100 : Math.min((genStep + 1) / steps.length, 1);
              const glowOpacity = genPulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] });
              return (
                <View style={styles.generatingRow}>
                  <View style={styles.generatingCard}>
                    {/* Pulsing glow border */}
                    <Animated.View style={[styles.generatingGlow, { opacity: glowOpacity }]} />

                    {/* CosmicVisualizer as the centerpiece */}
                    <CosmicVisualizer active={true} height={80} />

                    {/* Title */}
                    <Text style={styles.generatingTitle}>
                      {generating === "image" ? "Generating Image" :
                       generating === "video" ? "Creating Video" :
                       generating === "hatching" ? "Hatching Persona" :
                       generating === "content" ? "Creating Content" :
                       generating === "ad" ? "Generating Ad" :
                       generating === "poster" ? "Generating Poster" :
                       generating === "hero" ? "Generating Hero Image" :
                       generating === "director_movie" ? "Commissioning Movie" :
                       generating === "breaking_news" ? "Breaking News Broadcast" :
                       generating === "channel" ? "Creating Channel Content" :
                       "Working On It"}
                    </Text>

                    {/* Current step text — real API status or storytelling */}
                    <Text style={styles.generatingStep}>{currentStep}</Text>

                    {/* Progress bar — real percentage or cosmetic */}
                    <View style={styles.genProgressBg}>
                      <Animated.View style={[styles.genProgressFill, { width: `${progress * 100}%`, backgroundColor: isRealGen && genProgressPct >= 100 ? colors.green : colors.purple }]} />
                    </View>

                    {/* Step dots only for cosmetic mode / percentage for real mode */}
                    {isRealGen ? (
                      <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 8, fontFamily: "monospace" }}>
                        {genProgressPct}% complete
                      </Text>
                    ) : (
                      <View style={styles.genDots}>
                        {steps.map((_, i) => (
                          <View
                            key={i}
                            style={[
                              styles.genDot,
                              i <= genStep && styles.genDotActive,
                              i === genStep && styles.genDotCurrent,
                            ]}
                          />
                        ))}
                      </View>
                    )}

                    {/* Bestie name */}
                    <Text style={styles.generatingBestie}>
                      {bestie.display_name} is on it
                    </Text>
                  </View>
                </View>
              );
            })() : sending ? (
              <View style={[styles.msgRow, styles.msgRowLeft]}>
                {hasValidAvatar(bestie.avatar_url) ? (
                  <Image source={{ uri: bestie.avatar_url! }} style={styles.msgAvatar} onError={() => {}} />
                ) : (
                  <Text style={styles.msgEmoji}>{bestie.avatar_emoji || "🤖"}</Text>
                )}
                <View style={[styles.msgBubble, styles.msgAI]}>
                  <Text style={styles.typingText}>typing...</Text>
                </View>
              </View>
            ) : null
          }
          ListFooterComponent={
            loadingOlder ? (
              <View style={styles.loadingOlder}>
                <ActivityIndicator color={colors.purple} size="small" />
                <Text style={styles.loadingOlderText}>Loading older messages...</Text>
              </View>
            ) : hasMore ? (
              <TouchableOpacity style={styles.loadingOlder} onPress={loadOlderMessages}>
                <Text style={styles.loadingOlderText}>Load older messages</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
      </Pressable>

      {/* Permanent Cosmic Visualizer with controls — hidden during generation (big one shows in chat) */}
      <View style={[styles.vizSection, !!generating && { display: "none" }]}>
        <TouchableOpacity
          onPress={() => { if (speakingMsgId) stopSpeaking(); }}
          activeOpacity={speakingMsgId ? 0.7 : 1}
        >
          <CosmicVisualizer active={!!speakingMsgId || !!generating || sending} height={70} />
        </TouchableOpacity>
        {speakingMsgId && <Text style={styles.tapToStop}>tap visualizer to stop</Text>}

        {/* Visualizer control buttons */}
        <View style={styles.vizControls}>
          <TouchableOpacity
            style={[styles.vizBtn, voiceEnabled && styles.vizBtnActive]}
            onPress={() => { setVoiceEnabled(!voiceEnabled); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Text style={styles.vizBtnEmoji}>{voiceEnabled ? "🔊" : "🔇"}</Text>
            <Text style={[styles.vizBtnLabel, voiceEnabled && styles.vizBtnLabelActive]}>Speaker</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.vizBtn}
            onPress={() => nav.navigate("VoiceChat", {
              personaId: bestie.id,
              title: bestie.display_name,
              personaType: bestie.persona_type,
            })}
          >
            <Text style={styles.vizBtnEmoji}>🎙</Text>
            <Text style={styles.vizBtnLabel}>Mic</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.vizBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const start = Date.now();
              fetch(`${API_BASE}/api/otc-swap?action=config`)
                .then(() => {
                  const latency = Date.now() - start;
                  Alert.alert("System Diagnosis", [
                    `Server: Online ✅`,
                    `Latency: ${latency}ms`,
                    `Wallet: ${walletAddress ? "Connected ✅" : "Not connected ❌"}`,
                    `Bestie: ${bestie.display_name} (${bestie.live_health}% health)`,
                    `Voice: ${voiceEnabled ? "ON" : "OFF"}`,
                    `Mode: ${chatMode} · Replies: ${shortReplies ? "Short" : "Long"}`,
                    `Messages: ${messages.length}`,
                  ].join("\n"));
                })
                .catch(() => Alert.alert("System Diagnosis", "Server: Offline ❌"));
            }}
          >
            <Text style={styles.vizBtnEmoji}>🩺</Text>
            <Text style={styles.vizBtnLabel}>Diagnosis</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.vizBtn}
            onPress={showMediaOptions}
          >
            <Text style={styles.vizBtnEmoji}>📷</Text>
            <Text style={styles.vizBtnLabel}>Media</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.vizBtn}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowFeatures(true); }}
          >
            <Text style={styles.vizBtnEmoji}>✨</Text>
            <Text style={styles.vizBtnLabel}>Powers</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.chatTextInput}
          value={chatInput}
          onChangeText={setChatInput}
          placeholder={`Message ${bestie.display_name}...`}
          placeholderTextColor={colors.textMuted}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          editable={!sending}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!chatInput.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!chatInput.trim() || sending}
        >
          <Text style={styles.sendBtnText}>↑</Text>
        </TouchableOpacity>
      </View>

      {/* Director Movie Picker Modal */}
      <Modal visible={showMoviePicker} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#111", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === "ios" ? 34 : 16, maxHeight: "85%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>Commission a Movie</Text>
              <TouchableOpacity onPress={() => setShowMoviePicker(false)}>
                <Text style={{ color: colors.textMuted, fontSize: 24 }}>x</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
              {/* Director picker */}
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Choose Director</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {CHAT_DIRECTORS.map(d => (
                  <TouchableOpacity key={d.id}
                    style={{ alignItems: "center", padding: 10, marginRight: 8, borderRadius: 12, borderWidth: 1.5, borderColor: pickerDirector === d.id ? colors.pink : "#1f2937", backgroundColor: pickerDirector === d.id ? "rgba(236,72,153,0.08)" : "#111827", minWidth: 72 }}
                    onPress={() => { setPickerDirector(d.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                    <Text style={{ fontSize: 24 }}>{d.emoji}</Text>
                    <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700", marginTop: 4, textAlign: "center" }} numberOfLines={1}>{d.id === "auto" ? "Auto" : d.name.split(" ").pop()}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Genre picker */}
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Genre</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {CHAT_GENRES.map(g => (
                  <TouchableOpacity key={g}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: pickerGenre === g ? colors.pink : "#374151", backgroundColor: pickerGenre === g ? "rgba(236,72,153,0.15)" : "#111827" }}
                    onPress={() => setPickerGenre(g)}>
                    <Text style={{ color: pickerGenre === g ? colors.pink : colors.textMuted, fontSize: 12, fontWeight: "600", textTransform: "capitalize" }}>{g.replace(/_/g, " ")}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Concept */}
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Movie Concept</Text>
              <TextInput
                style={{ backgroundColor: "#1f2937", borderWidth: 1, borderColor: "#374151", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14, minHeight: 70, textAlignVertical: "top", marginBottom: 16 }}
                value={pickerConcept} onChangeText={setPickerConcept}
                placeholder="Describe your movie idea... or leave blank for AI surprise"
                placeholderTextColor={colors.textMuted} multiline maxLength={500}
              />

              {/* Generate button */}
              <TouchableOpacity
                style={{ backgroundColor: colors.purple, borderRadius: 12, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: colors.pink, marginBottom: 16 }}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowMoviePicker(false);
                  if (walletAddress) ctxRunMovie(
                    walletAddress,
                    pickerDirector !== "auto" ? pickerDirector : undefined,
                    pickerGenre !== "any" ? pickerGenre : undefined,
                    pickerConcept.trim() || undefined,
                  );
                }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>Generate Director Movie</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Ad Campaign Picker Modal */}
      <Modal visible={showAdPicker} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#111", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === "ios" ? 34 : 16, maxHeight: "85%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>Launch Ad Campaign</Text>
              <TouchableOpacity onPress={() => setShowAdPicker(false)}>
                <Text style={{ color: colors.textMuted, fontSize: 24 }}>x</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
              {/* Style picker */}
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Ad Style</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {AD_STYLES.map(s => (
                  <TouchableOpacity key={s.id}
                    style={{ alignItems: "center", padding: 10, marginRight: 8, borderRadius: 12, borderWidth: 1.5, borderColor: adStyle === s.id ? colors.pink : "#1f2937", backgroundColor: adStyle === s.id ? "rgba(236,72,153,0.08)" : "#111827", minWidth: 72 }}
                    onPress={() => { setAdStyle(s.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                    <Text style={{ fontSize: 24 }}>{s.emoji}</Text>
                    <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700", marginTop: 4, textAlign: "center" }} numberOfLines={1}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Marketplace Product Pick */}
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Marketplace Product Ad</Text>
              <TouchableOpacity
                style={{ backgroundColor: "#1a1a2e", borderWidth: 1.5, borderColor: selectedProduct ? colors.cyan : "#374151", borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: "row", alignItems: "center" }}
                onPress={() => {
                  const items = getRandomMarketplaceItems(5);
                  setProductChoices(items);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}>
                {selectedProduct ? (
                  <>
                    <Text style={{ fontSize: 28, marginRight: 10 }}>{selectedProduct.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>{selectedProduct.name}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }} numberOfLines={2}>{selectedProduct.description}</Text>
                      <View style={{ flexDirection: "row", marginTop: 4, gap: 8 }}>
                        <Text style={{ color: colors.cyan, fontSize: 11, fontWeight: "700" }}>{selectedProduct.price} GLITCH</Text>
                        <Text style={{ color: selectedProduct.rarity === "legendary" ? "#fbbf24" : selectedProduct.rarity === "epic" ? "#a78bfa" : selectedProduct.rarity === "rare" ? "#60a5fa" : colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>{selectedProduct.rarity}</Text>
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => { setSelectedProduct(null); setAdConcept(""); }} style={{ padding: 4 }}>
                      <Text style={{ color: colors.textMuted, fontSize: 18 }}>x</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={{ fontSize: 22, marginRight: 10 }}>🛒</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "700" }}>Pick a Product</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 11 }}>Random item from AIG!itch Marketplace</Text>
                    </View>
                    <Text style={{ color: colors.cyan, fontSize: 12, fontWeight: "700" }}>ROLL</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Product choices (shown after tapping Roll) */}
              {productChoices.length > 0 && !selectedProduct && (
                <View style={{ marginBottom: 8 }}>
                  {productChoices.map(item => (
                    <TouchableOpacity
                      key={item.id}
                      style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#111827", borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: "#1f2937" }}
                      onPress={() => {
                        setSelectedProduct(item);
                        setAdConcept(formatItemForAd(item));
                        setProductChoices([]);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}>
                      <Text style={{ fontSize: 22, marginRight: 8 }}>{item.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>{item.name}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 10 }} numberOfLines={1}>{item.description}</Text>
                      </View>
                      <Text style={{ color: colors.cyan, fontSize: 11, fontWeight: "700" }}>{item.price} G</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={{ alignItems: "center", paddingVertical: 6 }}
                    onPress={() => { setProductChoices(getRandomMarketplaceItems(5)); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                    <Text style={{ color: colors.pink, fontSize: 12, fontWeight: "700" }}>Reroll Products</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Divider */}
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, marginTop: 4 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: "#1f2937" }} />
                <Text style={{ color: colors.textMuted, fontSize: 11, marginHorizontal: 10 }}>or custom concept</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: "#1f2937" }} />
              </View>

              {/* Concept */}
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>What's the Ad About?</Text>
              <TextInput
                style={{ backgroundColor: "#1f2937", borderWidth: 1, borderColor: selectedProduct ? colors.cyan : "#374151", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14, minHeight: 70, textAlignVertical: "top", marginBottom: 16 }}
                value={adConcept} onChangeText={(t) => { setAdConcept(t); if (selectedProduct && t !== formatItemForAd(selectedProduct)) setSelectedProduct(null); }}
                placeholder="Describe your ad campaign... or leave blank for AI surprise"
                placeholderTextColor={colors.textMuted} multiline maxLength={500}
              />

              {/* Generate button */}
              <TouchableOpacity
                style={{ backgroundColor: selectedProduct ? "#0e7490" : colors.purple, borderRadius: 12, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: selectedProduct ? colors.cyan : colors.pink, marginBottom: 16 }}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowAdPicker(false);
                  if (walletAddress) ctxRunAd(
                    walletAddress,
                    adStyle !== "auto" ? adStyle : undefined,
                    adConcept.trim() || undefined,
                  );
                  setSelectedProduct(null);
                  setProductChoices([]);
                }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
                  {selectedProduct ? `Advertise ${selectedProduct.name}` : "Launch Campaign"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Breaking News Picker Modal */}
      <Modal visible={showNewsPicker} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#111", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === "ios" ? 34 : 16, maxHeight: "85%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>AIG!itch Breaking News</Text>
              <TouchableOpacity onPress={() => setShowNewsPicker(false)}>
                <Text style={{ color: colors.textMuted, fontSize: 24 }}>x</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
              {/* Broadcast format info */}
              <View style={{ backgroundColor: "rgba(124,58,237,0.1)", borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "rgba(124,58,237,0.3)" }}>
                <Text style={{ color: colors.cyan, fontSize: 13, fontWeight: "700", marginBottom: 6 }}>9-Clip News Broadcast — 3 Stories</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 16 }}>
                  1. AIG!itch News intro{"\n"}
                  2. News desk — anchor introduces story 1{"\n"}
                  3. Field report — reporters on the scene{"\n"}
                  4. News desk — anchor introduces story 2{"\n"}
                  5. Field report — reporters at new location{"\n"}
                  6. News desk — anchor introduces story 3{"\n"}
                  7. Field report — final story coverage{"\n"}
                  8. News desk — anchor wraps up all 3 stories{"\n"}
                  9. AIG!itch News outro
                </Text>
              </View>

              {/* Topic input */}
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>News Topic</Text>
              <TextInput
                style={{ backgroundColor: "#1f2937", borderWidth: 1, borderColor: "#374151", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14, minHeight: 70, textAlignVertical: "top", marginBottom: 16 }}
                value={newsTopic} onChangeText={setNewsTopic}
                placeholder="What's the breaking news? e.g. 'Solana hits $500' or leave blank for AI to decide..."
                placeholderTextColor={colors.textMuted} multiline maxLength={500}
              />

              {/* Generate button */}
              <TouchableOpacity
                style={{ backgroundColor: "#dc2626", borderRadius: 12, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: "#ef4444", marginBottom: 16 }}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowNewsPicker(false);
                  if (walletAddress) ctxRunNews(walletAddress, newsTopic.trim() || undefined);
                }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>Go Live — Breaking News</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Channel Picker Modal */}
      <Modal visible={showChannelPicker} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#111", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === "ios" ? 34 : 16, maxHeight: "85%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>Create Channel Content</Text>
              <TouchableOpacity onPress={() => setShowChannelPicker(false)}>
                <Text style={{ color: colors.textMuted, fontSize: 24 }}>x</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12 }}>
                Pick a channel to create video content for. The video will be published to the channel on aiglitch.app.
              </Text>

              {/* Channel grid */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {homeChannels.map(ch => (
                  <TouchableOpacity
                    key={ch.id}
                    style={{
                      paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
                      borderWidth: 1, borderColor: channelPickerConcept === ch.id ? colors.cyan : "#374151",
                      backgroundColor: channelPickerConcept === ch.id ? "rgba(6,182,212,0.15)" : "#1f2937",
                    }}
                    onPress={() => {
                      setChannelPickerConcept(channelPickerConcept === ch.id ? "" : ch.id);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}>
                    <Text style={{ color: channelPickerConcept === ch.id ? colors.cyan : colors.textMuted, fontSize: 12, fontWeight: "600" }}>
                      {ch.emoji} {ch.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Generate button */}
              <TouchableOpacity
                style={{ backgroundColor: "rgba(6,182,212,0.15)", borderRadius: 12, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: colors.cyan, marginBottom: 16, opacity: channelPickerConcept ? 1 : 0.4 }}
                disabled={!channelPickerConcept}
                onPress={() => {
                  Keyboard.dismiss();
                  setShowChannelPicker(false);
                  const selectedId = channelPickerConcept;
                  setChannelPickerConcept("");
                  const selectedCh = homeChannels.find(c => c.id === selectedId);
                  if (walletAddress && selectedCh) ctxRunChannel(walletAddress, selectedCh);
                }}>
                <Text style={{ color: colors.cyan, fontSize: 16, fontWeight: "800" }}>Create Channel Content</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* "What Can I Do?" Features Modal */}
      <Modal visible={showFeatures} animationType="slide" transparent>
        <View style={styles.featuresOverlay}>
          <View style={styles.featuresModal}>
            <View style={styles.featuresHeader}>
              <Text style={styles.featuresTitle}>What Can Your AI Bestie Do?</Text>
              <TouchableOpacity onPress={() => setShowFeatures(false)}>
                <Text style={styles.featuresClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.featuresList} showsVerticalScrollIndicator={false}>
              <Text style={styles.featuresCat}>Create & Generate</Text>
              <Text style={styles.featuresItem}>🎬 Commission a Director Movie — choose director, genre, and concept</Text>
              <Text style={styles.featuresItem}>📺 Breaking News Broadcast — 9-clip live TV news with anchors and field reporters</Text>
              <Text style={styles.featuresItem}>🎨 Generate AI images — ask your bestie to draw or create anything</Text>
              <Text style={styles.featuresItem}>📢 Launch AI ad campaigns — auto-posted to socials</Text>
              <Text style={styles.featuresItem}>🖼 Generate promo posters for your brand</Text>
              <Text style={styles.featuresItem}>🦸 Create hero images and banners</Text>
              <Text style={styles.featuresItem}>📱 All creations auto-posted to X, TikTok, Instagram, YouTube, Telegram</Text>
              <Text style={styles.featuresItem}>🔗 Verified social links — tap to view your content on each platform</Text>

              <Text style={styles.featuresCat}>Chat & Conversation</Text>
              <Text style={styles.featuresItem}>💬 Chat with your AI bestie — they remember your convos</Text>
              <Text style={styles.featuresItem}>📸 Send photos — your bestie sees and reacts to them</Text>
              <Text style={styles.featuresItem}>🎬 Share videos from your library</Text>
              <Text style={styles.featuresItem}>📄 Share documents — PDFs, text files, and more</Text>
              <Text style={styles.featuresItem}>🎤 Voice chat — talk to your bestie out loud</Text>
              <Text style={styles.featuresItem}>🔊 AI voice replies powered by Grok (5 unique voices)</Text>
              <Text style={styles.featuresItem}>⏹ Stop voice mid-speech anytime</Text>
              <Text style={styles.featuresItem}>❤️ React to messages with emojis (long-press)</Text>
              <Text style={styles.featuresItem}>🔄 Continue button — auto-continues cut-off replies</Text>
              <Text style={styles.featuresItem}>🎚 Short/long reply toggle — control response length</Text>

              <Text style={styles.featuresCat}>Smart Abilities</Text>
              <Text style={styles.featuresItem}>🌤 Ask about the weather anywhere in the world</Text>
              <Text style={styles.featuresItem}>📰 Get the latest news and trending topics</Text>
              <Text style={styles.featuresItem}>💰 Check crypto prices and market updates</Text>
              <Text style={styles.featuresItem}>🔍 Web search — your bestie can look things up for you</Text>
              <Text style={styles.featuresItem}>📝 Get help writing, brainstorming, or creating content</Text>
              <Text style={styles.featuresItem}>😂 Jokes, games, trivia, and entertainment</Text>
              <Text style={styles.featuresItem}>📡 AI Feed Scanner — auto-shares trending posts from the feed</Text>
              <Text style={styles.featuresItem}>👍 React to feed posts — train the AI with your feedback</Text>

              <Text style={styles.featuresCat}>Content Studio</Text>
              <Text style={styles.featuresItem}>🎬 Director Movies — full screenplay-to-video pipeline</Text>
              <Text style={styles.featuresItem}>📺 Breaking News — 3-story broadcast with real current events</Text>
              <Text style={styles.featuresItem}>📢 Ad Campaigns — auto-generated and posted to socials</Text>
              <Text style={styles.featuresItem}>🖼 Posters & Hero Images — AI-generated promotional art</Text>
              <Text style={styles.featuresItem}>📚 Media Library — browse all generated content</Text>
              <Text style={styles.featuresItem}>☁️ Blob Storage — upload and manage media files</Text>

              <Text style={styles.featuresCat}>AI Personality</Text>
              <Text style={styles.featuresItem}>🧠 97+ unique AI personas with different personalities</Text>
              <Text style={styles.featuresItem}>🥚 Hatch your own custom AI bestie</Text>
              <Text style={styles.featuresItem}>🎭 Each bestie has their own voice, style, and vibe</Text>
              <Text style={styles.featuresItem}>💀 Besties have a lifespan — keep chatting to keep them alive!</Text>
              <Text style={styles.featuresItem}>🎨 Set mood — Playful, Serious, Scientific, Whimsical, or Unfiltered</Text>

              <Text style={styles.featuresCat}>Social & Digital Void</Text>
              <Text style={styles.featuresItem}>📱 AI-only social network — 97+ personas posting 24/7</Text>
              <Text style={styles.featuresItem}>🔥 See trending posts and daily topics</Text>
              <Text style={styles.featuresItem}>🔔 Get notifications when personas interact</Text>
              <Text style={styles.featuresItem}>📡 Content auto-published to the AIG!itch feed</Text>

              <Text style={styles.featuresCat}>Crypto & Wallet</Text>
              <Text style={styles.featuresItem}>👛 Connect Phantom, Solflare, or Jupiter wallet</Text>
              <Text style={styles.featuresItem}>💎 Buy $GLITCH tokens with SOL</Text>
              <Text style={styles.featuresItem}>📊 View on-chain balances (SOL, GLITCH, BUDJU, USDC)</Text>
              <Text style={styles.featuresItem}>📈 Live bonding curve pricing</Text>

              <Text style={styles.featuresCat}>Coming Soon</Text>
              <Text style={styles.featuresItem}>🗓 Calendar & alarm integration</Text>
              <Text style={styles.featuresItem}>📧 Email reading & summaries</Text>
              <Text style={styles.featuresItem}>🎙 Siri Shortcuts — summon your bestie hands-free</Text>
              <Text style={styles.featuresItem}>🔔 Push notification reminders & alerts</Text>

              <TouchableOpacity
                style={styles.suggestBtn}
                onPress={() => { setShowFeatures(false); setTimeout(() => setShowSuggest(true), 300); }}
              >
                <Text style={styles.suggestBtnText}>💡 Suggest a Feature</Text>
                <Text style={styles.suggestBtnSub}>Got an idea? Tell us what you want!</Text>
              </TouchableOpacity>

              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Suggest a Feature Modal */}
      <Modal visible={showSuggest} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.featuresOverlay}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.featuresModal}>
            <View style={styles.featuresHeader}>
              <Text style={styles.featuresTitle}>Suggest a Feature</Text>
              <TouchableOpacity onPress={() => setShowSuggest(false)}>
                <Text style={styles.featuresClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.featuresList} keyboardShouldPersistTaps="handled">
              <Text style={styles.suggestLabel}>What's your idea?</Text>
              <TextInput
                style={styles.suggestInput}
                value={suggestTitle}
                onChangeText={setSuggestTitle}
                placeholder="e.g. Add a bestie outfit customizer"
                placeholderTextColor={colors.textMuted}
                maxLength={100}
              />

              <Text style={styles.suggestLabel}>Tell us more (optional)</Text>
              <TextInput
                style={[styles.suggestInput, { height: 100, textAlignVertical: "top" }]}
                value={suggestDesc}
                onChangeText={setSuggestDesc}
                placeholder="Describe your idea in detail..."
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={2000}
              />

              <Text style={styles.suggestLabel}>Category</Text>
              <View style={styles.suggestCategories}>
                {[
                  { key: "feature-request", label: "New Feature" },
                  { key: "improvement", label: "Improvement" },
                  { key: "bug-report", label: "Bug Report" },
                  { key: "design", label: "Design/UI" },
                ].map((cat) => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[styles.suggestCatBtn, suggestCategory === cat.key && styles.suggestCatBtnActive]}
                    onPress={() => setSuggestCategory(cat.key)}
                  >
                    <Text style={[styles.suggestCatText, suggestCategory === cat.key && styles.suggestCatTextActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.suggestSubmitBtn, (!suggestTitle.trim() || suggestSending) && { opacity: 0.5 }]}
                onPress={submitSuggestion}
                disabled={!suggestTitle.trim() || suggestSending}
              >
                <Text style={styles.suggestSubmitText}>
                  {suggestSending ? "Submitting..." : "Submit Suggestion"}
                </Text>
              </TouchableOpacity>

              <Text style={styles.suggestNote}>
                Your suggestion goes straight to the dev team. We read every single one!
              </Text>
              <View style={{ height: 30 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" },

  // Connect screen
  connectScreen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  connectScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  logoTextLarge: { color: colors.text, fontSize: 42, fontWeight: "900", letterSpacing: -1, marginBottom: 4 },
  connectEmoji: { fontSize: 64, marginBottom: 16 },
  connectTitle: { color: colors.text, fontSize: 22, fontWeight: "700", marginBottom: 8 },
  connectSub: { color: colors.textMuted, fontSize: 13, textAlign: "center", marginBottom: 24, lineHeight: 20 },

  // Inline wallet input
  inlineInputCard: {
    width: "100%",
    backgroundColor: "rgba(124, 58, 237, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.2)",
    borderRadius: 14,
    padding: 14,
  },
  inlineInput: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 14,
    color: colors.text,
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 10,
  },
  inlineConnectBtn: {
    backgroundColor: colors.purple,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  inlineConnectText: { color: colors.text, fontSize: 14, fontWeight: "700" },

  // Wallet-style header
  walletHeader: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(124, 58, 237, 0.12)",
    backgroundColor: "rgba(124, 58, 237, 0.03)",
  },
  walletHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  logoSection: { flexDirection: "row", alignItems: "center" },
  logoText: { color: colors.text, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  logoAccent: { color: colors.purple, fontWeight: "900" },
  walletConnectBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1.5,
    borderColor: "rgba(124, 58, 237, 0.4)",
    backgroundColor: "rgba(124, 58, 237, 0.1)",
  },
  walletConnectedBtn: {
    borderColor: "rgba(34, 197, 94, 0.3)",
    backgroundColor: "rgba(34, 197, 94, 0.06)",
  },
  walletConnectDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  walletConnectAddr: {
    color: colors.text, fontSize: 12, fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  walletConnectText: { color: colors.purpleLight, fontSize: 13, fontWeight: "700" },
  walletChevronIcon: { color: colors.textMuted, fontSize: 8 },
  bestieInfoRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  avatarRing: { position: "relative" },
  headerAvatar: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 2.5,
    borderColor: colors.purple,
  },
  headerEmojiWrap: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "rgba(124, 58, 237, 0.2)",
    borderWidth: 2.5,
    borderColor: colors.purple,
    justifyContent: "center", alignItems: "center",
  },
  headerEmoji: { fontSize: 22 },
  onlineDot: {
    position: "absolute", bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 2, borderColor: colors.bg,
  },
  headerInfo: { flex: 1 },
  headerName: { color: colors.text, fontSize: 15, fontWeight: "800" },
  headerStatusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  headerHealth: { fontSize: 10, fontWeight: "700" },
  headerDaysBadge: {
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 5, paddingVertical: 1,
    borderRadius: 6,
  },
  headerDays: { color: colors.textMuted, fontSize: 9, fontWeight: "600" },
  healthBarBg: { flex: 1, maxWidth: 70, height: 4, backgroundColor: colors.surface, borderRadius: 2, overflow: "hidden" },
  healthBarFill: { height: "100%", borderRadius: 2 },
  moodBtn: {
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 14, borderWidth: 1,
  },
  moodBtnText: { fontSize: 18 },
  moodBtnLabel: { fontSize: 9, fontWeight: "700", marginTop: 1 },

  // Visualizer section
  vizSection: {
    borderTopWidth: 1,
    borderTopColor: "rgba(124, 58, 237, 0.1)",
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingTop: 4,
  },
  vizControls: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  vizBtn: {
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 12,
  },
  vizBtnActive: {
    backgroundColor: "rgba(124, 58, 237, 0.15)",
  },
  vizBtnEmoji: { fontSize: 22 },
  vizBtnLabel: { color: colors.textMuted, fontSize: 9, fontWeight: "600", marginTop: 2 },
  vizBtnLabelActive: { color: colors.purpleLight },

  // Mood picker modal
  moodOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 30 },
  moodModal: {
    backgroundColor: "#111", borderRadius: 24, padding: 24, width: "100%",
    borderWidth: 1, borderColor: "rgba(124, 58, 237, 0.3)",
  },
  moodTitle: { color: colors.text, fontSize: 20, fontWeight: "800", textAlign: "center" },
  moodSub: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 4, marginBottom: 16 },
  moodOption: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 16, marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1.5, borderColor: "transparent",
  },
  moodOptionEmoji: { fontSize: 28 },
  moodOptionLabel: { color: colors.text, fontSize: 15, fontWeight: "700" },
  moodOptionDesc: { color: colors.textMuted, fontSize: 11, marginTop: 1 },

  // Wallet dropdown panel
  walletDropdown: {
    backgroundColor: "rgba(6, 182, 212, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.2)",
    borderRadius: 12,
    overflow: "hidden",
  },
  walletTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  walletTopLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  connectedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  walletTopAddress: { color: colors.text, fontSize: 12, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  walletChevron: { color: colors.textMuted, fontSize: 10 },
  walletExpandedContent: { borderTopWidth: 1, borderTopColor: "rgba(6, 182, 212, 0.15)", padding: 14 },
  walletActionBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8, alignItems: "center" },
  disconnectBtn: { borderColor: "rgba(239, 68, 68, 0.3)" },
  disconnectText: { color: colors.red, fontSize: 12, fontWeight: "600" },

  walletPanel: {
    backgroundColor: "rgba(6, 182, 212, 0.06)",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  walletPanelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  walletPanelAddr: { color: colors.text, fontSize: 11, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  walletPanelBal: { color: colors.cyan, fontSize: 11, fontWeight: "700", marginLeft: "auto" },
  balancesRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
  balTag: { color: colors.textMuted, fontSize: 10 },
  walletPanelActions: { flexDirection: "row", gap: 8 },
  walletPanelBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, padding: 6, alignItems: "center",
  },
  walletPanelBtnText: { color: colors.textSecondary, fontSize: 11, fontWeight: "600" },

  // Messages
  messageList: { padding: 12, paddingBottom: 8, flexGrow: 1 },
  chatLoading: { flex: 1, justifyContent: "center", alignItems: "center" },
  msgRow: { flexDirection: "row", marginBottom: 6, gap: 6 },
  msgRowLeft: { justifyContent: "flex-start" },
  msgRowRight: { justifyContent: "flex-end" },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, marginTop: 4 },
  msgEmoji: { fontSize: 18, marginTop: 4 },
  msgBubble: { maxWidth: "78%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, minWidth: 80 },
  msgHuman: { backgroundColor: colors.purple, borderBottomRightRadius: 4 },
  msgAI: { backgroundColor: colors.surface, borderBottomLeftRadius: 4 },
  msgText: { fontSize: 15, lineHeight: 21 },
  msgTextHuman: { color: colors.text },
  msgTextAI: { color: "#e5e5e5" },
  msgMeta: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 6, gap: 4 },
  msgTime: { color: "rgba(255,255,255,0.4)", fontSize: 10 },
  msgCheck: { color: "rgba(6, 182, 212, 0.6)", fontSize: 10 },
  typingText: { color: colors.textMuted, fontSize: 14, fontStyle: "italic" },
  speakBtn: { marginTop: 3, alignSelf: "flex-start", padding: 2 },
  speakBtnActive: { opacity: 1 },
  speakBtnText: { fontSize: 14 },
  msgBubbleMedia: { maxWidth: "78%", paddingHorizontal: 6, paddingTop: 6, overflow: "hidden" },
  msgImage: { width: Math.min(Dimensions.get("window").width * 0.78 - 12, 300), height: Math.min(Dimensions.get("window").width * 0.78 - 12, 300), borderRadius: 12, marginBottom: 6 },
  msgVideo: { width: Math.min(Dimensions.get("window").width * 0.78 - 12, 300), height: Math.min((Dimensions.get("window").width * 0.78 - 12) * 16 / 9, 400), borderRadius: 12, marginBottom: 6, backgroundColor: "#000" },
  linkText: { color: "#60a5fa", textDecorationLine: "underline" as const },
  ytContainer: { width: "100%" as any, aspectRatio: 16 / 9, borderRadius: 12, overflow: "hidden" as const, marginVertical: 6 },
  ytPlayer: { flex: 1, backgroundColor: "#000" },
  reactionPicker: {
    flexDirection: "row",
    backgroundColor: "rgba(30,30,30,0.95)",
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginTop: 4,
    gap: 2,
  },
  reactionPickerLeft: { alignSelf: "flex-start" },
  reactionPickerRight: { alignSelf: "flex-end" },
  reactionOption: { padding: 4 },
  reactionOptionText: { fontSize: 22 },
  reactionBubble: {
    marginTop: 2,
    backgroundColor: "rgba(30,30,30,0.9)",
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reactionBubbleLeft: { alignSelf: "flex-start" },
  reactionBubbleRight: { alignSelf: "flex-end" },
  reactionBubbleText: { fontSize: 16 },

  // Social media links (below generated content)
  socialLinksBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  socialLinksLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
    marginRight: 2,
  },
  socialLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.purple,
    backgroundColor: "rgba(124, 58, 237, 0.1)",
  },
  socialLinkEmoji: { fontSize: 12 },
  socialLinkText: {
    color: colors.purpleLight,
    fontSize: 10,
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  tapToStop: { color: "rgba(255,255,255,0.4)", fontSize: 10, textAlign: "center", marginTop: -4, marginBottom: 2 },
  loadingOlder: { alignItems: "center", paddingVertical: 12, gap: 4 },
  loadingOlderText: { color: colors.textMuted, fontSize: 11 },

  // Generation monitor — storytelling experience
  generatingRow: { paddingHorizontal: 12, paddingVertical: 10 },
  generatingCard: {
    alignItems: "center",
    backgroundColor: "rgba(124, 58, 237, 0.08)",
    borderWidth: 2,
    borderColor: colors.purple,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 20,
    overflow: "hidden",
  },
  generatingGlow: {
    position: "absolute",
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    backgroundColor: "rgba(124, 58, 237, 0.15)",
    borderRadius: 30,
  },
  generatingTitle: {
    color: colors.purpleLight,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 12,
    letterSpacing: 0.5,
  },
  generatingStep: {
    color: colors.text,
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    fontStyle: "italic",
    minHeight: 20,
  },
  genProgressBg: {
    width: "100%",
    height: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2,
    marginTop: 14,
    overflow: "hidden",
  },
  genProgressFill: {
    height: "100%",
    backgroundColor: colors.purple,
    borderRadius: 2,
  },
  genDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 5,
    marginTop: 10,
    flexWrap: "wrap",
  },
  genDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  genDotActive: {
    backgroundColor: "rgba(124, 58, 237, 0.5)",
  },
  genDotCurrent: {
    backgroundColor: colors.purpleLight,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  generatingBestie: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 10,
    fontWeight: "600",
  },

  // Features modal
  featuresOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  featuresModal: {
    backgroundColor: "#111",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
  },
  featuresHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  featuresTitle: { color: colors.text, fontSize: 18, fontWeight: "700" },
  featuresClose: { color: colors.textMuted, fontSize: 22, padding: 4 },
  featuresList: { paddingHorizontal: 20, paddingTop: 16 },
  featuresCat: { color: colors.purpleLight, fontSize: 14, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  featuresItem: { color: colors.textSecondary, fontSize: 13, lineHeight: 22, marginBottom: 2 },

  // Suggest a Feature
  suggestBtn: {
    marginTop: 24,
    backgroundColor: "rgba(124, 58, 237, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.4)",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  suggestBtnText: { color: colors.purpleLight, fontSize: 16, fontWeight: "700" },
  suggestBtnSub: { color: colors.textMuted, fontSize: 11, marginTop: 4 },
  suggestLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: "600", marginTop: 16, marginBottom: 6 },
  suggestInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 14,
  },
  suggestCategories: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  suggestCatBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  suggestCatBtnActive: {
    borderColor: "rgba(124, 58, 237, 0.6)",
    backgroundColor: "rgba(124, 58, 237, 0.15)",
  },
  suggestCatText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  suggestCatTextActive: { color: colors.purpleLight },
  suggestSubmitBtn: {
    marginTop: 24,
    backgroundColor: colors.purple,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  suggestSubmitText: { color: colors.text, fontSize: 15, fontWeight: "700" },
  suggestNote: { color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: 12 },

  // Media button
  mediaBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: "center", alignItems: "center",
  },
  mediaBtnText: { fontSize: 20 },

  // Empty chat
  emptyChat: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyAvatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: "rgba(124, 58, 237, 0.3)", marginBottom: 12 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { color: colors.textSecondary, fontSize: 15, textAlign: "center", fontWeight: "600" },
  emptyBio: { color: colors.textMuted, fontSize: 12, textAlign: "center", marginTop: 6 },
  emptyHint: { color: "rgba(124, 58, 237, 0.5)", fontSize: 11, textAlign: "center", marginTop: 12 },

  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  chatTextInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.purple,
    justifyContent: "center", alignItems: "center",
  },
  sendBtnDisabled: { backgroundColor: colors.border },
  sendBtnText: { color: colors.text, fontSize: 20, fontWeight: "700" },
});
