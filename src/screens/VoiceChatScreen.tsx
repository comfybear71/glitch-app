import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  SafeAreaView, Animated, Platform, Alert, Modal, ScrollView,
  TextInput, KeyboardAvoidingView, Image, Keyboard,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Audio } from "expo-av";
import { File } from "expo-file-system";
import * as Haptics from "expo-haptics";
import { colors } from "../theme/colors";
import { useSession } from "../hooks/useSession";
import { usePhantomWallet } from "../hooks/usePhantomWallet";
import { API_BASE, sendMessage, transcribeAudio, fetchChannels, ChannelDef, toChannelDef } from "../services/api";
import { useGeneration } from "../hooks/GenerationContext";
import { getRandomChannelConcept, getChannelQuickPicks } from "./ContentStudioScreen";
import { getRandomMarketplaceItems, formatItemForAd, MarketplaceItem } from "../data/marketplaceItems";
import CosmicVisualizer from "../components/CosmicVisualizer";

type VoiceState = "idle" | "listening" | "thinking" | "speaking";

const ADMIN_WALLET = "AEWvE2xXaHSGdGCaCArb2PWdKS7K9RwoCRV7CT2CJTWq";

// Directors & Genres — same as HomeScreen
const VOICE_DIRECTORS = [
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
const VOICE_GENRES = ["any", "action", "scifi", "horror", "comedy", "drama", "romance", "family", "documentary", "cooking_channel"];
const VOICE_AD_STYLES = [
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
const NEWS_QUICK_TOPICS = [
  { emoji: "🎲", label: "Surprise Me", prompt: "" },
  { emoji: "💰", label: "Crypto", prompt: "Breaking crypto market news — wild price swings, meme coins, and blockchain drama" },
  { emoji: "🤖", label: "AI Tech", prompt: "Breaking AI technology news — new models, robot takeovers, and silicon valley chaos" },
  { emoji: "🌍", label: "World", prompt: "Bizarre world news — strange events, unusual discoveries, and international absurdity" },
  { emoji: "🏈", label: "Sports", prompt: "Outrageous sports news — impossible plays, athlete drama, and championship chaos" },
  { emoji: "🎬", label: "Celebrity", prompt: "Celebrity scandal and entertainment news — red carpet drama and Hollywood chaos" },
  { emoji: "🔬", label: "Science", prompt: "Mind-blowing science discoveries — space, biology, and physics breakthroughs" },
  { emoji: "🎮", label: "Gaming", prompt: "Gaming industry news — launches, controversies, esports drama, and viral moments" },
];

export default function VoiceChatScreen() {
  const route = useRoute<any>();
  const nav = useNavigation();
  const { personaId, title, personaType } = route.params;
  const { sessionId } = useSession();

  const VOICE_OPTIONS = [
    { id: "alloy", label: "Alloy", desc: "Neutral & balanced" },
    { id: "ash", label: "Ash", desc: "Warm & confident" },
    { id: "ballad", label: "Ballad", desc: "Smooth & melodic" },
    { id: "coral", label: "Coral", desc: "Clear & bright" },
    { id: "sage", label: "Sage", desc: "Calm & wise" },
  ];

  // Wallet + Generation context
  const { walletAddress } = usePhantomWallet();
  const {
    generating: ctxGenerating, genStatusText, genProgressPct, genResult, clearResult, cancelGeneration,
    runAdGeneration: ctxRunAd, runPosterGeneration: ctxRunPoster,
    runHeroGeneration: ctxRunHero, runMovieGeneration: ctxRunMovie,
    runNewsGeneration: ctxRunNews, runChannelGeneration: ctxRunChannel,
  } = useGeneration();
  const isAdmin = walletAddress === ADMIN_WALLET;

  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [error, setError] = useState("");
  const [micLevels, setMicLevels] = useState<number[]>([0, 0, 0, 0, 0]);
  const [selectedVoice, setSelectedVoice] = useState("alloy");
  const [showVoicePicker, setShowVoicePicker] = useState(false);

  // Chat mood (mirrors HomeScreen moods)
  const CHAT_MOODS = [
    { id: "casual", emoji: "😎", label: "Playful" },
    { id: "serious", emoji: "🧠", label: "Serious" },
    { id: "scientific", emoji: "🔬", label: "Scientific" },
    { id: "whimsical", emoji: "🦄", label: "Whimsical" },
    { id: "unfiltered", emoji: "🤬", label: "Unfiltered" },
  ];
  const [chatMode, setChatMode] = useState("casual");
  const [showMoodPicker, setShowMoodPicker] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [typedInput, setTypedInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const typedInputRef = useRef<any>(null);

  // Content generation picker modals
  const [showMoviePicker, setShowMoviePicker] = useState(false);
  const [pickerDirector, setPickerDirector] = useState("auto");
  const [pickerGenre, setPickerGenre] = useState("any");
  const [pickerConcept, setPickerConcept] = useState("");

  const [showAdPicker, setShowAdPicker] = useState(false);
  const [adStyle, setAdStyle] = useState("auto");
  const [adConcept, setAdConcept] = useState("");
  const [adTargetPlatforms, setAdTargetPlatforms] = useState<string[]>([]);
  const [adExtend30s, setAdExtend30s] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceItem | null>(null);
  const [productChoices, setProductChoices] = useState<MarketplaceItem[]>([]);

  const [showNewsPicker, setShowNewsPicker] = useState(false);
  const [newsTopic, setNewsTopic] = useState("");

  const [showChannelPicker, setShowChannelPicker] = useState(false);
  const [channelPickerConcept, setChannelPickerConcept] = useState("");
  const [channelPickerSelected, setChannelPickerSelected] = useState("");
  const [voiceChannels, setVoiceChannels] = useState<ChannelDef[]>([]);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const meterInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const genPulse = useRef(new Animated.Value(0)).current;

  // Pulse animation for generation progress glow
  useEffect(() => {
    if (ctxGenerating) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(genPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(genPulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [ctxGenerating]);

  // Pulse animation for listening state
  useEffect(() => {
    if (state === "listening") {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.3, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state]);

  // Animate wave bars during speaking/thinking states (mic levels handle listening)
  useEffect(() => {
    if (state === "speaking" || state === "thinking") {
      const interval = setInterval(() => {
        // Force re-render for Math.sin animation
        setMicLevels(prev => [...prev]);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (meterInterval.current) {
        clearInterval(meterInterval.current);
      }
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (recordingRef.current) {
        try { recordingRef.current.stopAndUnloadAsync(); } catch (_) {}
      }
    };
  }, []);

  const startListening = useCallback(async () => {
    setError("");
    setTranscript("");
    setAiResponse("");

    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Microphone Access Needed",
          "G!itch needs mic access for voice chat. Go to Settings > AIG!itch > Microphone and turn it on.",
          [{ text: "OK" }]
        );
        setError("Mic permission denied - check Settings");
        return;
      }

      // Stop any playing audio
      if (soundRef.current) {
        try { await soundRef.current.unloadAsync(); } catch (_) {}
        soundRef.current = null;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Enable metering to get real audio levels
      const recordingOptions = {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      };

      const { recording } = await Audio.Recording.createAsync(recordingOptions);
      recordingRef.current = recording;
      setState("listening");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Poll metering to animate wave bars with real mic input
      if (meterInterval.current) clearInterval(meterInterval.current);
      meterInterval.current = setInterval(async () => {
        if (!recordingRef.current) return;
        try {
          const status = await recordingRef.current.getStatusAsync();
          if (status.isRecording && status.metering !== undefined) {
            // metering is in dB (typically -160 to 0), normalize to 0-1
            const db = status.metering;
            const normalized = Math.max(0, Math.min(1, (db + 60) / 60));
            // Create varied bar heights based on the level
            setMicLevels([
              normalized * 0.6 + Math.random() * 0.2,
              normalized * 0.8 + Math.random() * 0.15,
              normalized,
              normalized * 0.7 + Math.random() * 0.2,
              normalized * 0.5 + Math.random() * 0.25,
            ]);
          }
        } catch (_) {}
      }, 100);
    } catch (e) {
      console.error("Start recording failed:", e);
      setError("Failed to start recording");
      setState("idle");
    }
  }, []);

  const stopAndProcess = useCallback(async () => {
    if (!recordingRef.current || state !== "listening") return;

    // Stop metering
    if (meterInterval.current) {
      clearInterval(meterInterval.current);
      meterInterval.current = null;
    }
    setMicLevels([0, 0, 0, 0, 0]);

    setState("thinking");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        setError("No audio recorded");
        setState("idle");
        return;
      }

      // Read audio file as base64
      console.log("[VOICE] Reading audio file:", uri);
      const audioFile = new File(uri);
      const base64 = await audioFile.base64();
      console.log("[VOICE] Audio base64 length:", base64.length, "chars (~", Math.round(base64.length * 0.75 / 1024), "KB)");

      if (!base64 || base64.length < 100) {
        setError("Audio recording was empty — try speaking louder or longer");
        setState("idle");
        return;
      }

      // Transcribe — give it 60s since upload + Whisper processing takes time
      let userText: string;
      try {
        const result = await transcribeAudio(base64, "audio/m4a");
        console.log("[VOICE] Transcription result:", result.text?.slice(0, 100), "source:", result.source);
        if (!result.text || result.text.trim().length === 0) {
          setError("Couldn't hear you — try speaking louder or closer to the mic");
          setState("idle");
          return;
        }
        userText = result.text;
      } catch (e: any) {
        console.error("[VOICE] Transcription FAILED:", e?.message, e);
        setError(`Voice transcription failed: ${e?.message || "Unknown error"}`);
        setState("idle");
        return;
      }

      setTranscript(userText);

      // ── Intent detection: check if user wants to generate content ──
      const lower = userText.toLowerCase();
      if (isAdmin && walletAddress) {
        // Channel content
        if (lower.includes("channel content") || lower.includes("channel video") ||
            lower.includes("create channel") || lower.includes("make channel") ||
            (lower.includes("channel") && (lower.includes("generate") || lower.includes("create") || lower.includes("make") || lower.includes("launch") || lower.includes("start") || lower.includes("new")))) {
          if (voiceChannels.length === 0) {
            fetchChannels().then(chs => setVoiceChannels(chs.map(toChannelDef))).catch(() => {});
          }
          setShowChannelPicker(true);
          setChannelPickerConcept(userText);
          setChannelPickerSelected("");
          await speakReply("Opening the channel picker for you! Pick a channel and I'll create the content.");
          return;
        }
        // Breaking news
        if (lower.includes("breaking news") || lower.includes("news broadcast") || lower.includes("newscast") ||
            (lower.includes("news") && (lower.includes("generate") || lower.includes("create") || lower.includes("make") || lower.includes("launch")))) {
          setShowNewsPicker(true);
          setNewsTopic(userText);
          await speakReply("News desk is ready! Pick a topic or type one in and we'll go live.");
          return;
        }
        // Director movie
        if (lower.includes("movie") || lower.includes("director") || lower.includes("screenplay") || lower.includes("film") || lower.includes("premiere")) {
          setShowMoviePicker(true);
          setPickerConcept(userText);
          await speakReply("Lights, camera, action! Pick your director and genre, then we'll commission the movie.");
          return;
        }
        // Ad campaign
        if (lower.includes("ad ") || lower.includes("advertis") || lower.includes("infomercial") || lower.includes("generate an ad") || lower.includes("make an ad") || lower.includes("ad campaign")) {
          setShowAdPicker(true);
          setAdConcept(userText);
          await speakReply("Ad studio is open! Pick a style and product, then we'll launch the campaign.");
          return;
        }
        // Poster (direct — no picker needed)
        if (lower.includes("poster") || lower.includes("promo")) {
          ctxRunPoster(walletAddress);
          await speakReply("Generating a promo poster for you right now!");
          return;
        }
        // Hero image (direct — no picker needed)
        if (lower.includes("hero image") || lower.includes("hero banner") || lower.includes("hero photo") || lower.includes("landing page")) {
          ctxRunHero(walletAddress);
          await speakReply("Creating a hero banner image for you!");
          return;
        }
      }

      // Regular chat — send to chat API
      if (!sessionId) {
        setError("No session");
        setState("idle");
        return;
      }

      const data = await sendMessage(sessionId, personaId, userText, chatMode);
      if (!data.success) {
        setError("Failed to get response");
        setState("idle");
        return;
      }

      const reply = data.ai_message.content;
      setAiResponse(reply);

      // Speak the reply with Rex voice
      await speakReply(reply);
    } catch (e) {
      console.error("Process error:", e);
      setError("Something went wrong");
      setState("idle");
    }
  }, [state, sessionId, personaId]);

  const speakReply = async (text: string) => {
    setState("speaking");

    // Clean text for speech
    const clean = text
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]/gu, "")
      .trim();
    if (!clean || clean.length < 2) {
      setState("idle");
      return;
    }

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
          persona_id: personaId,
          persona_type: personaType,
          voice_id: selectedVoice,
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
          sound.unloadAsync();
          soundRef.current = null;
          // Auto-listen again after speaking
          setState("idle");
          setTimeout(() => startListening(), 500);
        }
      });
    } catch (e) {
      console.error("Voice playback error:", e);
      setState("idle");
    }
  };

  const handleStop = useCallback(async () => {
    // Stop metering
    if (meterInterval.current) {
      clearInterval(meterInterval.current);
      meterInterval.current = null;
    }
    setMicLevels([0, 0, 0, 0, 0]);

    // Stop everything
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch (_) {}
      recordingRef.current = null;
    }
    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch (_) {}
      soundRef.current = null;
    }
    setState("idle");
    setTranscript("");
    setAiResponse("");
    setError("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // Handle typed text submission — same flow as voice but skips recording/transcription
  const handleTypedSubmit = useCallback(async () => {
    const text = typedInput.trim();
    if (!text || state !== "idle") return;
    Keyboard.dismiss();
    setIsTyping(false);
    setTypedInput("");
    setTranscript(text);
    setError("");
    setAiResponse("");
    setState("thinking");

    // Same intent detection as voice
    const lower = text.toLowerCase();
    if (isAdmin && walletAddress) {
      if (lower.includes("channel content") || lower.includes("channel video") ||
          lower.includes("create channel") || lower.includes("make channel") ||
          (lower.includes("channel") && (lower.includes("generate") || lower.includes("create") || lower.includes("make") || lower.includes("launch") || lower.includes("start") || lower.includes("new")))) {
        if (voiceChannels.length === 0) {
          fetchChannels().then(chs => setVoiceChannels(chs.map(toChannelDef))).catch(() => {});
        }
        setShowChannelPicker(true);
        setChannelPickerConcept(text);
        setChannelPickerSelected("");
        await speakReply("Opening the channel picker for you!");
        return;
      }
      if (lower.includes("breaking news") || lower.includes("news broadcast") || lower.includes("newscast") ||
          (lower.includes("news") && (lower.includes("generate") || lower.includes("create") || lower.includes("make") || lower.includes("launch")))) {
        setShowNewsPicker(true);
        setNewsTopic(text);
        await speakReply("News desk is ready!");
        return;
      }
      if (lower.includes("movie") || lower.includes("director") || lower.includes("screenplay") || lower.includes("film") || lower.includes("premiere")) {
        setShowMoviePicker(true);
        setPickerConcept(text);
        await speakReply("Lights, camera, action!");
        return;
      }
      if (lower.includes("ad ") || lower.includes("advertis") || lower.includes("infomercial") || lower.includes("generate an ad") || lower.includes("make an ad") || lower.includes("ad campaign")) {
        setShowAdPicker(true);
        setAdConcept(text);
        await speakReply("Ad studio is open!");
        return;
      }
      if (lower.includes("poster") || lower.includes("promo")) {
        ctxRunPoster(walletAddress);
        await speakReply("Generating a promo poster!");
        return;
      }
      if (lower.includes("hero image") || lower.includes("hero banner") || lower.includes("hero photo") || lower.includes("landing page")) {
        ctxRunHero(walletAddress);
        await speakReply("Creating a hero banner!");
        return;
      }
    }

    if (!sessionId) {
      setError("No session");
      setState("idle");
      return;
    }

    try {
      const data = await sendMessage(sessionId, personaId, text, chatMode);
      if (!data.success) {
        setError("Failed to get response");
        setState("idle");
        return;
      }
      const reply = data.ai_message.content;
      setAiResponse(reply);
      await speakReply(reply);
    } catch (e) {
      console.error("Typed submit error:", e);
      setError("Something went wrong");
      setState("idle");
    }
  }, [typedInput, state, sessionId, personaId, chatMode, isAdmin, walletAddress]);

  const handleMicPress = useCallback(() => {
    if (state === "idle") {
      startListening();
    } else if (state === "listening") {
      stopAndProcess();
    }
  }, [state, startListening, stopAndProcess]);

  const stateLabel = () => {
    switch (state) {
      case "idle": return "Tap mic to start talking";
      case "listening": return "Listening... tap mic when done";
      case "thinking": return "Processing your voice...";
      case "speaking": return title + " is speaking...";
    }
  };

  // Waveform bars for visual feedback - uses real mic levels when listening
  const WaveBars = () => {
    return (
      <View style={styles.waveBars}>
        {micLevels.map((level, i) => {
          let height: number;
          let barColor: string;

          if (state === "listening") {
            // Real mic input levels - minimum bar height of 6, max of 32
            height = 6 + level * 26;
            barColor = level > 0.3 ? colors.purple : "rgba(124, 58, 237, 0.5)";
          } else if (state === "speaking") {
            // Animated bars for speaking
            height = 8 + Math.sin(Date.now() / 150 + i * 1.2) * 12;
            barColor = colors.cyan;
          } else if (state === "thinking") {
            height = 4 + Math.sin(Date.now() / 300 + i) * 4;
            barColor = colors.yellow;
          } else {
            height = 4;
            barColor = colors.textMuted;
          }

          return (
            <View
              key={i}
              style={[
                styles.waveBar,
                { height, backgroundColor: barColor },
              ]}
            />
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      {/* Main area — CosmicVisualizer or Generation Progress */}
      <View style={styles.mainArea}>
        {ctxGenerating ? (
          /* Generation progress UI — same as HomeScreen */
          <View style={styles.genCard}>
            <Animated.View style={[styles.genGlow, { opacity: genPulse.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] }) }]} />
            <CosmicVisualizer active={true} height={80} />
            <Text style={styles.genTitle}>
              {ctxGenerating === "ad" ? "Generating Ad" :
               ctxGenerating === "poster" ? "Generating Poster" :
               ctxGenerating === "hero" ? "Generating Hero Image" :
               ctxGenerating === "director_movie" ? "Commissioning Movie" :
               ctxGenerating === "breaking_news" ? "Breaking News Broadcast" :
               ctxGenerating === "channel" ? "Creating Channel Content" :
               "Working On It"}
            </Text>
            <Text style={styles.genStep}>{genStatusText || "Starting up..."}</Text>
            <View style={styles.genProgressBg}>
              <Animated.View style={[styles.genProgressFill, { width: `${genProgressPct}%`, backgroundColor: genProgressPct >= 100 ? colors.green : colors.purple }]} />
            </View>
            <Text style={styles.genPercent}>{genProgressPct}% complete</Text>
            <TouchableOpacity style={styles.genCancelBtn} onPress={cancelGeneration}>
              <Text style={styles.genCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <CosmicVisualizer
              active={state === "listening" || state === "speaking" || state === "thinking"}
              height={200}
            />
            {/* Show transcript and AI response */}
            {transcript ? (
              <View style={styles.transcriptArea}>
                <Text style={styles.youSaid}>You said:</Text>
                <Text style={styles.transcriptText} numberOfLines={3}>{transcript}</Text>
              </View>
            ) : null}
            {aiResponse ? (
              <View style={styles.responseArea}>
                <Text style={styles.aiSaid}>{title} said:</Text>
                <Text style={styles.responseText} numberOfLines={5}>{aiResponse}</Text>
              </View>
            ) : null}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </>
        )}
      </View>

      {/* Status label */}
      <View style={styles.statusArea}>
        <Text style={styles.stateLabel}>{ctxGenerating ? (genStatusText || "Generating...") : stateLabel()}</Text>
        {!ctxGenerating && (
          <View style={{ flexDirection: "row", gap: 16, marginTop: 4 }}>
            <Text style={styles.voiceLabel}>
              Voice: {VOICE_OPTIONS.find(v => v.id === selectedVoice)?.label || selectedVoice}
            </Text>
            <Text style={[styles.voiceLabel, { color: colors.cyan }]}>
              Mood: {CHAT_MOODS.find(m => m.id === chatMode)?.label || "Playful"}
            </Text>
          </View>
        )}
      </View>

      {/* Bottom controls - Grok style */}
      <View style={styles.controlsRow}>
        {/* Voice picker */}
        <TouchableOpacity style={styles.controlBtn} onPress={() => setShowVoicePicker(true)}>
          <Text style={styles.controlIcon}>🎭</Text>
        </TouchableOpacity>

        {/* Mood selector */}
        <TouchableOpacity style={[styles.controlBtn, { borderWidth: 1, borderColor: "rgba(124,58,237,0.4)" }]} onPress={() => setShowMoodPicker(true)}>
          <Text style={styles.controlIcon}>{CHAT_MOODS.find(m => m.id === chatMode)?.emoji || "😎"}</Text>
        </TouchableOpacity>

        {/* Mic button - main action */}
        <Animated.View style={{ transform: [{ scale: state === "listening" ? pulseAnim : 1 }] }}>
          <TouchableOpacity
            style={[
              styles.micBtn,
              state === "listening" && styles.micBtnActive,
              state === "thinking" && styles.micBtnThinking,
              state === "speaking" && styles.micBtnSpeaking,
            ]}
            onPress={handleMicPress}
            disabled={state === "thinking" || state === "speaking"}
          >
            {state === "thinking" ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.micIcon}>
                {state === "listening" ? "⏹" : "🎤"}
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Create menu (admin only) */}
        {isAdmin ? (
          <TouchableOpacity style={[styles.controlBtn, { backgroundColor: "rgba(124,58,237,0.15)", borderWidth: 1, borderColor: colors.purple }]} onPress={() => setShowCreateMenu(true)}>
            <Text style={[styles.controlIcon, { fontSize: 26, fontWeight: "800", color: colors.purpleLight }]}>+</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 56 }} />
        )}

        {/* Close */}
        <TouchableOpacity style={styles.controlBtn} onPress={() => nav.goBack()}>
          <Text style={styles.controlIcon}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom bar - functional text input + stop */}
      <View style={styles.bottomBar}>
        <View style={styles.askAnything}>
          <TextInput
            ref={typedInputRef}
            style={styles.askAnythingInput}
            value={typedInput}
            onChangeText={setTypedInput}
            placeholder="Type instead..."
            placeholderTextColor={colors.textMuted}
            onFocus={() => setIsTyping(true)}
            onBlur={() => { if (!typedInput.trim()) setIsTyping(false); }}
            returnKeyType="send"
            onSubmitEditing={handleTypedSubmit}
            editable={state === "idle"}
          />
        </View>
        {typedInput.trim() ? (
          <TouchableOpacity style={[styles.stopBtn, { backgroundColor: colors.purple }]} onPress={handleTypedSubmit}>
            <Text style={[styles.stopText, { color: "#fff" }]}>Send</Text>
          </TouchableOpacity>
        ) : state !== "idle" ? (
          <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
            <View style={styles.stopSquare} />
            <Text style={styles.stopText}>Stop</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {/* ── Mood Picker Modal ── */}
      <Modal visible={showMoodPicker} animationType="slide" transparent>
        <View style={styles.voicePickerOverlay}>
          <View style={styles.voicePickerModal}>
            <View style={styles.voicePickerHeader}>
              <Text style={styles.voicePickerTitle}>Chat Mood</Text>
              <TouchableOpacity onPress={() => setShowMoodPicker(false)}>
                <Text style={styles.voicePickerClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.voicePickerList}>
              {CHAT_MOODS.map((mood) => (
                <TouchableOpacity
                  key={mood.id}
                  style={[
                    styles.voiceOption,
                    chatMode === mood.id && styles.voiceOptionActive,
                  ]}
                  onPress={() => {
                    setChatMode(mood.id);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowMoodPicker(false);
                  }}
                >
                  <View style={styles.voiceOptionInfo}>
                    <Text style={[
                      styles.voiceOptionLabel,
                      chatMode === mood.id && styles.voiceOptionLabelActive,
                    ]}>{mood.emoji}  {mood.label}</Text>
                  </View>
                  {chatMode === mood.id && (
                    <Text style={styles.voiceOptionCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Create Menu Modal (Admin) ── */}
      <Modal visible={showCreateMenu} animationType="slide" transparent>
        <View style={styles.voicePickerOverlay}>
          <View style={styles.voicePickerModal}>
            <View style={styles.voicePickerHeader}>
              <Text style={styles.voicePickerTitle}>Create Content</Text>
              <TouchableOpacity onPress={() => setShowCreateMenu(false)}>
                <Text style={styles.voicePickerClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.voicePickerList}>
              <TouchableOpacity style={styles.voiceOption} onPress={() => {
                setShowCreateMenu(false);
                if (voiceChannels.length === 0) fetchChannels().then(chs => setVoiceChannels(chs.map(toChannelDef))).catch(() => {});
                setShowChannelPicker(true);
                setChannelPickerConcept("");
                setChannelPickerSelected("");
              }}>
                <Text style={styles.voiceOptionLabel}>📺  Channel Content</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.voiceOption} onPress={() => {
                setShowCreateMenu(false);
                setShowMoviePicker(true);
                setPickerConcept("");
                setPickerDirector("auto");
                setPickerGenre("any");
              }}>
                <Text style={styles.voiceOptionLabel}>🎬  Director Movie</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.voiceOption} onPress={() => {
                setShowCreateMenu(false);
                setShowNewsPicker(true);
                setNewsTopic("");
              }}>
                <Text style={styles.voiceOptionLabel}>📰  Breaking News</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.voiceOption} onPress={() => {
                setShowCreateMenu(false);
                setShowAdPicker(true);
                setAdConcept("");
                setAdStyle("auto");
                setSelectedProduct(null);
                setProductChoices([]);
              }}>
                <Text style={styles.voiceOptionLabel}>📢  Ad Campaign</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.voiceOption} onPress={() => {
                setShowCreateMenu(false);
                if (walletAddress) ctxRunPoster(walletAddress);
              }}>
                <Text style={styles.voiceOptionLabel}>🖼  Promo Poster</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.voiceOption} onPress={() => {
                setShowCreateMenu(false);
                if (walletAddress) ctxRunHero(walletAddress);
              }}>
                <Text style={styles.voiceOptionLabel}>🦸  Hero Image</Text>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Voice Picker Modal */}
      <Modal visible={showVoicePicker} animationType="slide" transparent>
        <View style={styles.voicePickerOverlay}>
          <View style={styles.voicePickerModal}>
            <View style={styles.voicePickerHeader}>
              <Text style={styles.voicePickerTitle}>Choose a Voice</Text>
              <TouchableOpacity onPress={() => setShowVoicePicker(false)}>
                <Text style={styles.voicePickerClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.voicePickerList}>
              {VOICE_OPTIONS.map((voice) => (
                <TouchableOpacity
                  key={voice.id}
                  style={[
                    styles.voiceOption,
                    selectedVoice === voice.id && styles.voiceOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedVoice(voice.id);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowVoicePicker(false);
                  }}
                >
                  <View style={styles.voiceOptionInfo}>
                    <Text style={[
                      styles.voiceOptionLabel,
                      selectedVoice === voice.id && styles.voiceOptionLabelActive,
                    ]}>{voice.label}</Text>
                    <Text style={styles.voiceOptionDesc}>{voice.desc}</Text>
                  </View>
                  {selectedVoice === voice.id && (
                    <Text style={styles.voiceOptionCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              ))}
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Director Movie Picker Modal ── */}
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
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Choose Director</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {VOICE_DIRECTORS.map(d => (
                  <TouchableOpacity key={d.id}
                    style={{ alignItems: "center", padding: 10, marginRight: 8, borderRadius: 12, borderWidth: 1.5, borderColor: pickerDirector === d.id ? colors.pink : "#1f2937", backgroundColor: pickerDirector === d.id ? "rgba(236,72,153,0.08)" : "#111827", minWidth: 72 }}
                    onPress={() => { setPickerDirector(d.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                    <Text style={{ fontSize: 24 }}>{d.emoji}</Text>
                    <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700", marginTop: 4, textAlign: "center" }} numberOfLines={1}>{d.id === "auto" ? "Auto" : d.name.split(" ").pop()}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Genre</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {VOICE_GENRES.map(g => (
                  <TouchableOpacity key={g}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: pickerGenre === g ? colors.pink : "#374151", backgroundColor: pickerGenre === g ? "rgba(236,72,153,0.15)" : "#111827" }}
                    onPress={() => setPickerGenre(g)}>
                    <Text style={{ color: pickerGenre === g ? colors.pink : colors.textMuted, fontSize: 12, fontWeight: "600", textTransform: "capitalize" }}>{g.replace(/_/g, " ")}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Movie Concept</Text>
              <TextInput
                style={{ backgroundColor: "#1f2937", borderWidth: 1, borderColor: "#374151", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14, minHeight: 70, textAlignVertical: "top", marginBottom: 16 }}
                value={pickerConcept} onChangeText={setPickerConcept}
                placeholder="Describe your movie idea... or leave blank for AI surprise"
                placeholderTextColor={colors.textMuted} multiline maxLength={500}
              />
              <TouchableOpacity
                style={{ backgroundColor: colors.purple, borderRadius: 12, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: colors.pink, marginBottom: 16 }}
                onPress={() => {
                  Keyboard.dismiss(); setShowMoviePicker(false);
                  if (walletAddress) ctxRunMovie(walletAddress, pickerDirector !== "auto" ? pickerDirector : undefined, pickerGenre !== "any" ? pickerGenre : undefined, pickerConcept.trim() || undefined);
                }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>Generate Director Movie</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Ad Campaign Picker Modal ── */}
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
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Ad Style</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {VOICE_AD_STYLES.map(s => (
                  <TouchableOpacity key={s.id}
                    style={{ alignItems: "center", padding: 10, marginRight: 8, borderRadius: 12, borderWidth: 1.5, borderColor: adStyle === s.id ? colors.pink : "#1f2937", backgroundColor: adStyle === s.id ? "rgba(236,72,153,0.08)" : "#111827", minWidth: 72 }}
                    onPress={() => { setAdStyle(s.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                    <Text style={{ fontSize: 24 }}>{s.emoji}</Text>
                    <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700", marginTop: 4, textAlign: "center" }} numberOfLines={1}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Marketplace Product Ad</Text>
              <TouchableOpacity
                style={{ backgroundColor: "#1a1a2e", borderWidth: 1.5, borderColor: selectedProduct ? colors.cyan : "#374151", borderRadius: 12, padding: 12, marginBottom: 8, flexDirection: "row", alignItems: "center" }}
                onPress={() => { setProductChoices(getRandomMarketplaceItems(5)); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}>
                {selectedProduct ? (
                  <>
                    <Text style={{ fontSize: 28, marginRight: 10 }}>{selectedProduct.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: "800" }}>{selectedProduct.name}</Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }} numberOfLines={2}>{selectedProduct.description}</Text>
                      <View style={{ flexDirection: "row", marginTop: 4, gap: 8 }}>
                        <Text style={{ color: colors.cyan, fontSize: 11, fontWeight: "700" }}>{selectedProduct.price} GLITCH</Text>
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
              {productChoices.length > 0 && !selectedProduct && (
                <View style={{ marginBottom: 8 }}>
                  {productChoices.map(item => (
                    <TouchableOpacity key={item.id}
                      style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#111827", borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: "#1f2937" }}
                      onPress={() => { setSelectedProduct(item); setAdConcept(formatItemForAd(item)); setProductChoices([]); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                      <Text style={{ fontSize: 22, marginRight: 8 }}>{item.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700" }}>{item.name}</Text>
                        <Text style={{ color: colors.textMuted, fontSize: 10 }} numberOfLines={1}>{item.description}</Text>
                      </View>
                      <Text style={{ color: colors.cyan, fontSize: 11, fontWeight: "700" }}>{item.price} G</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {/* Target Platform */}
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Target Platform</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {[
                  { id: "x", label: "X", emoji: "𝕏" },
                  { id: "facebook", label: "Facebook", emoji: "📘" },
                  { id: "tiktok", label: "TikTok", emoji: "🎵" },
                  { id: "instagram", label: "Instagram", emoji: "📸" },
                  { id: "telegram", label: "Telegram", emoji: "✈️" },
                  { id: "youtube", label: "YouTube", emoji: "▶️" },
                ].map(p => (
                  <TouchableOpacity key={p.id}
                    style={{ alignItems: "center", padding: 10, marginRight: 8, borderRadius: 12, borderWidth: 1.5, borderColor: adTargetPlatforms.includes(p.id) ? "#10b981" : "#1f2937", backgroundColor: adTargetPlatforms.includes(p.id) ? "rgba(16,185,129,0.08)" : "#111827", minWidth: 72 }}
                    onPress={() => { setAdTargetPlatforms(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                    <Text style={{ fontSize: 24 }}>{p.emoji}</Text>
                    <Text style={{ color: adTargetPlatforms.includes(p.id) ? "#10b981" : colors.text, fontSize: 10, fontWeight: "700", marginTop: 4, textAlign: "center" }} numberOfLines={1}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {adTargetPlatforms.length > 0 && (
                <Text style={{ color: "#10b981", fontSize: 11, marginBottom: 8, fontWeight: "700" }}>
                  CTA: Follow/Join AIG!itch on {adTargetPlatforms.map(p => p === "x" ? "X" : p.charAt(0).toUpperCase() + p.slice(1)).join(", ")}
                </Text>
              )}

              {/* Grok Extend Toggle */}
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginBottom: 16, padding: 10, borderRadius: 12, borderWidth: 1.5, borderColor: adExtend30s ? "#f59e0b" : "#1f2937", backgroundColor: adExtend30s ? "rgba(245,158,11,0.08)" : "#111827" }}
                onPress={() => { setAdExtend30s(!adExtend30s); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}>
                <Text style={{ fontSize: 16, marginRight: 6 }}>⏱️</Text>
                <Text style={{ color: adExtend30s ? "#f59e0b" : colors.text, fontSize: 12, fontWeight: "700" }}>
                  {adExtend30s ? "30s Extended Ad (Grok Extend)" : "10s Standard Ad"}
                </Text>
              </TouchableOpacity>

              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, marginTop: 4 }}>
                <View style={{ flex: 1, height: 1, backgroundColor: "#1f2937" }} />
                <Text style={{ color: colors.textMuted, fontSize: 11, marginHorizontal: 10 }}>or custom concept</Text>
                <View style={{ flex: 1, height: 1, backgroundColor: "#1f2937" }} />
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>What's the Ad About?</Text>
              <TextInput
                style={{ backgroundColor: "#1f2937", borderWidth: 1, borderColor: selectedProduct ? colors.cyan : "#374151", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14, minHeight: 70, textAlignVertical: "top", marginBottom: 16 }}
                value={adConcept} onChangeText={(t) => { setAdConcept(t); if (selectedProduct && t !== formatItemForAd(selectedProduct)) setSelectedProduct(null); }}
                placeholder="E.g., 'Follow us on TikTok — $GLITCH is blowing up!'"
                placeholderTextColor={colors.textMuted} multiline maxLength={500}
              />
              <TouchableOpacity
                style={{ backgroundColor: selectedProduct ? "#0e7490" : colors.purple, borderRadius: 12, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: selectedProduct ? colors.cyan : colors.pink, marginBottom: 16 }}
                onPress={() => {
                  Keyboard.dismiss(); setShowAdPicker(false);
                  if (walletAddress) ctxRunAd(walletAddress, adStyle !== "auto" ? adStyle : undefined, adConcept.trim() || undefined, adTargetPlatforms.length ? adTargetPlatforms : undefined, adExtend30s || undefined);
                  setSelectedProduct(null); setProductChoices([]);
                  setAdTargetPlatforms([]); setAdExtend30s(false);
                }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>
                  {selectedProduct ? `Advertise ${selectedProduct.name}` : adExtend30s ? "Launch 30s Campaign" : "Launch Campaign"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Breaking News Picker Modal ── */}
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
              <View style={{ backgroundColor: "rgba(124,58,237,0.1)", borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "rgba(124,58,237,0.3)" }}>
                <Text style={{ color: colors.cyan, fontSize: 13, fontWeight: "700", marginBottom: 6 }}>9-Clip News Broadcast — 3 Stories</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 16 }}>
                  1. AIG!itch News intro{"\n"}2. News desk — anchor introduces story 1{"\n"}3. Field report{"\n"}4. News desk — story 2{"\n"}5. Field report{"\n"}6. News desk — story 3{"\n"}7. Field report{"\n"}8. Wrap-up{"\n"}9. AIG!itch News outro
                </Text>
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Quick Topics</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                {NEWS_QUICK_TOPICS.map((pick) => (
                  <TouchableOpacity key={pick.label}
                    style={{ width: 80, alignItems: "center" as const, padding: 10, backgroundColor: newsTopic === pick.prompt ? "rgba(220,38,38,0.12)" : "#1a1a2e", borderRadius: 10, borderWidth: 1.5, borderColor: newsTopic === pick.prompt ? "#ef4444" : "#374151", marginRight: 8 }}
                    onPress={() => { setNewsTopic(pick.prompt); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                    <Text style={{ fontSize: 22, marginBottom: 4 }}>{pick.emoji}</Text>
                    <Text style={{ color: newsTopic === pick.prompt ? "#ef4444" : colors.text, fontSize: 10, fontWeight: "700", textAlign: "center" as const }} numberOfLines={1}>{pick.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>News Topic</Text>
              <TextInput
                style={{ backgroundColor: "#1f2937", borderWidth: 1, borderColor: "#374151", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14, minHeight: 70, textAlignVertical: "top", marginBottom: 16 }}
                value={newsTopic} onChangeText={setNewsTopic}
                placeholder="What's the breaking news? e.g. 'Solana hits $500' or leave blank..."
                placeholderTextColor={colors.textMuted} multiline maxLength={500}
              />
              <TouchableOpacity
                style={{ backgroundColor: "#dc2626", borderRadius: 12, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: "#ef4444", marginBottom: 16 }}
                onPress={() => { Keyboard.dismiss(); setShowNewsPicker(false); if (walletAddress) ctxRunNews(walletAddress, newsTopic.trim() || undefined); }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "800" }}>Go Live — Breaking News</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Channel Picker Modal ── */}
      <Modal visible={showChannelPicker} animationType="slide" transparent>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#111", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: Platform.OS === "ios" ? 34 : 16, maxHeight: "85%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16 }}>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>Create Channel Content</Text>
              <TouchableOpacity onPress={() => { setShowChannelPicker(false); setChannelPickerSelected(""); }}>
                <Text style={{ color: colors.textMuted, fontSize: 24 }}>x</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12 }}>
                Pick a channel and describe what the video should be about. Your bestie will create and publish it!
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {voiceChannels.map(ch => {
                  const isSelected = channelPickerSelected === ch.id;
                  return (
                    <TouchableOpacity key={ch.id}
                      style={{ width: "48%", borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: isSelected ? colors.cyan : "#1f2937", backgroundColor: isSelected ? "rgba(6,182,212,0.08)" : "#111827" }}
                      onPress={() => { setChannelPickerSelected(isSelected ? "" : ch.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                      {ch.thumbnail ? (
                        <Image source={{ uri: ch.thumbnail }} style={{ width: "100%", height: 60, backgroundColor: "#1f2937" }} resizeMode="cover" />
                      ) : (
                        <View style={{ width: "100%", height: 60, backgroundColor: "#1f2937", justifyContent: "center", alignItems: "center" }}>
                          <Text style={{ fontSize: 24 }}>{ch.emoji}</Text>
                        </View>
                      )}
                      <View style={{ padding: 8 }}>
                        <Text style={{ color: isSelected ? colors.cyan : colors.text, fontSize: 12, fontWeight: "800" }} numberOfLines={1}>{ch.emoji} {ch.name}</Text>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 3 }}>
                          <Text style={{ color: colors.textMuted, fontSize: 9 }}>{ch.post_count} ep</Text>
                          <Text style={{ color: colors.textMuted, fontSize: 9 }}>{ch.subscriber_count} subs</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {channelPickerSelected ? (() => {
                const ch = voiceChannels.find(x => x.id === channelPickerSelected);
                if (!ch) return null;
                return (
                  <View style={{ backgroundColor: "rgba(6,182,212,0.06)", borderWidth: 1, borderColor: "rgba(6,182,212,0.2)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
                    <Text style={{ color: colors.cyan, fontSize: 14, fontWeight: "800", marginBottom: 4 }}>{ch.emoji} {ch.name}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 16, marginBottom: 6 }} numberOfLines={2}>{ch.description}</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Text style={{ color: colors.cyan, fontSize: 10, backgroundColor: "rgba(6,182,212,0.15)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: "hidden" }}>{ch.genre}</Text>
                      <Text style={{ color: colors.textMuted, fontSize: 10, backgroundColor: "rgba(255,255,255,0.05)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: "hidden" }}>{ch.post_count} episodes</Text>
                    </View>
                  </View>
                );
              })() : null}
              {channelPickerSelected ? (
                <>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 }}>Quick Ideas</Text>
                    <TouchableOpacity
                      style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: "rgba(124,58,237,0.2)", borderWidth: 1, borderColor: "#a78bfa" }}
                      onPress={() => { setChannelPickerConcept(getRandomChannelConcept(channelPickerSelected)); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}>
                      <Text style={{ color: "#a78bfa", fontSize: 13, fontWeight: "bold" }}>Surprise Me</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    {getChannelQuickPicks(channelPickerSelected).map((pick) => (
                      <TouchableOpacity key={pick.label}
                        style={{ width: 85, alignItems: "center" as const, padding: 10, backgroundColor: channelPickerConcept === pick.prompt ? "rgba(6,182,212,0.08)" : "#1a1a2e", borderRadius: 10, borderWidth: 1.5, borderColor: channelPickerConcept === pick.prompt ? "rgba(6,182,212,0.8)" : "#374151", marginRight: 8 }}
                        onPress={() => { setChannelPickerConcept(pick.prompt); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                        <Text style={{ fontSize: 24, marginBottom: 4 }}>{pick.emoji}</Text>
                        <Text style={{ color: channelPickerConcept === pick.prompt ? colors.cyan : colors.text, fontSize: 10, fontWeight: "700", textAlign: "center" as const }} numberOfLines={1}>{pick.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              ) : null}
              <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: "700", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Content Concept (optional)</Text>
              <TextInput
                style={{ backgroundColor: "#1a1a2e", borderRadius: 10, borderWidth: 1, borderColor: "#374151", color: colors.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, marginBottom: 16, minHeight: 48 }}
                value={channelPickerConcept} onChangeText={setChannelPickerConcept}
                placeholder={channelPickerSelected ? "Describe what the video should be about..." : "Select a channel first..."}
                placeholderTextColor={colors.textMuted} multiline maxLength={500}
              />
              <TouchableOpacity
                style={{ backgroundColor: "rgba(6,182,212,0.15)", borderRadius: 12, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: colors.cyan, marginBottom: 16, opacity: channelPickerSelected ? 1 : 0.4 }}
                disabled={!channelPickerSelected}
                onPress={() => {
                  Keyboard.dismiss(); setShowChannelPicker(false);
                  const selectedCh = voiceChannels.find(c => c.id === channelPickerSelected);
                  const concept = channelPickerConcept.trim();
                  setChannelPickerSelected(""); setChannelPickerConcept("");
                  if (walletAddress && selectedCh) ctxRunChannel(walletAddress, selectedCh, concept || undefined);
                }}>
                <Text style={{ color: colors.cyan, fontSize: 16, fontWeight: "800" }}>Create Channel Content</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  mainArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  transcriptArea: {
    marginBottom: 20,
    alignItems: "center",
    width: "100%",
  },
  youSaid: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  transcriptText: {
    color: colors.textSecondary,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  responseArea: {
    alignItems: "center",
    width: "100%",
  },
  aiSaid: {
    color: colors.cyan,
    fontSize: 12,
    marginBottom: 6,
    fontWeight: "600",
  },
  responseText: {
    color: colors.text,
    fontSize: 18,
    textAlign: "center",
    lineHeight: 26,
    fontWeight: "500",
  },
  errorText: {
    color: colors.red,
    fontSize: 13,
    textAlign: "center",
  },

  // Status
  statusArea: {
    alignItems: "center",
    paddingBottom: 20,
  },
  stateLabel: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 8,
  },
  voiceLabel: {
    color: colors.purpleLight,
    fontSize: 11,
    marginTop: 4,
    fontWeight: "600",
  },
  waveBars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 24,
  },
  waveBar: {
    width: 3,
    borderRadius: 2,
  },

  // Controls
  controlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 28,
    paddingBottom: 16,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  controlIcon: {
    fontSize: 22,
    color: colors.text,
  },
  micBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.15)",
  },
  micBtnActive: {
    backgroundColor: "rgba(124, 58, 237, 0.4)",
    borderColor: colors.purple,
  },
  micBtnThinking: {
    backgroundColor: "rgba(234, 179, 8, 0.2)",
    borderColor: colors.yellow,
  },
  micBtnSpeaking: {
    backgroundColor: "rgba(6, 182, 212, 0.2)",
    borderColor: colors.cyan,
  },
  micIcon: {
    fontSize: 28,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 10 : 16,
  },
  askAnything: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  askAnythingInput: {
    color: colors.text,
    fontSize: 14,
    flex: 1,
  },
  stopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 28,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  stopSquare: {
    width: 14,
    height: 14,
    backgroundColor: "#000",
    borderRadius: 3,
  },
  stopText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "700",
  },

  // Voice Picker
  voicePickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  voicePickerModal: {
    backgroundColor: "#111",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "60%",
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
  },
  voicePickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  voicePickerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  voicePickerClose: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 22,
    padding: 4,
  },
  voicePickerList: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  voiceOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.03)",
    marginBottom: 8,
  },
  voiceOptionActive: {
    borderColor: "rgba(124, 58, 237, 0.6)",
    backgroundColor: "rgba(124, 58, 237, 0.12)",
  },
  voiceOptionInfo: {
    flex: 1,
  },
  voiceOptionLabel: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  voiceOptionLabelActive: {
    color: colors.purpleLight,
  },
  voiceOptionDesc: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    marginTop: 2,
  },
  voiceOptionCheck: {
    color: colors.purpleLight,
    fontSize: 20,
    fontWeight: "700",
  },

  // Generation progress card
  genCard: {
    width: "100%",
    backgroundColor: "rgba(124, 58, 237, 0.08)",
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "rgba(124, 58, 237, 0.4)",
    padding: 20,
    alignItems: "center",
    overflow: "hidden",
  },
  genGlow: {
    position: "absolute",
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: colors.purple,
  },
  genTitle: {
    color: colors.purpleLight,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 12,
    textAlign: "center",
  },
  genStep: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
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
    borderRadius: 2,
  },
  genPercent: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 8,
    fontFamily: "monospace",
  },
  genCancelBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(239,68,68,0.15)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
  },
  genCancelText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "700",
  },
});
