import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, TextInput, Image,
  Animated, Easing,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { colors } from "../theme/colors";
import { useSession } from "../hooks/useSession";
import { usePhantomWallet } from "../hooks/usePhantomWallet";
import {
  generateContent, getContentJobStatus, getContentLibrary,
  uploadMedia, getMediaLibrary, deleteMedia, triggerDirectorMovie,
  generatePoster, generateHeroImage, getMarketingStats,
  spreadCustomContent, getSpreadHistory,
  getCronStatus, getAdminHealth,
  ContentType, DirectorStyle, ContentJob, MediaLibraryItem,
} from "../services/api";

// ── Directors from the web app ──
const DIRECTORS = [
  { id: "steven_spielbot", name: "Steven Spielbot", emoji: "🎬", genres: ["family", "scifi", "action", "drama"], style: "Warm golden cinematography", signature: "Dolly zoom reveal" },
  { id: "stanley_kubrick_ai", name: "Stanley Kubrick AI", emoji: "🎭", genres: ["horror", "scifi", "drama"], style: "Cold geometric perfection", signature: "One-point perspective" },
  { id: "george_lucasfilm", name: "George LucasFilm", emoji: "🌌", genres: ["scifi", "action", "family"], style: "Epic space opera", signature: "Wipe transitions" },
  { id: "quentin_airantino", name: "Quentin AI-rantino", emoji: "🔫", genres: ["action", "drama", "comedy"], style: "Stylish violence, low-angle shots", signature: "Trunk shot" },
  { id: "alfred_glitchcock", name: "Alfred Glitchcock", emoji: "🦅", genres: ["horror", "drama"], style: "Suspense, dolly-zoom effects", signature: "Vertigo zoom" },
  { id: "nolan_christopher", name: "Nolan Christopher", emoji: "⏰", genres: ["scifi", "action", "drama"], style: "IMAX-scale practical effects", signature: "Time manipulation" },
  { id: "wes_analog", name: "Wes Analog", emoji: "🎨", genres: ["comedy", "drama", "romance"], style: "Symmetrical pastel compositions", signature: "Centered framing" },
  { id: "ridley_scott_ai", name: "Ridley Scott AI", emoji: "🗡", genres: ["scifi", "action", "drama"], style: "Epic-scale grandeur", signature: "Atmospheric wide shots" },
  { id: "chef_ramsay_ai", name: "Chef Ramsay AI", emoji: "👨‍🍳", genres: ["cooking_channel", "comedy"], style: "Food macro photography", signature: "Extreme close-ups" },
  { id: "david_attenborough_ai", name: "David Attenborough AI", emoji: "🦁", genres: ["documentary", "family"], style: "Nature documentary aesthetic", signature: "Aerial tracking shots" },
];

const GENRES = ["action", "scifi", "horror", "comedy", "drama", "romance", "family", "documentary", "cooking_channel"];

const PLATFORMS = [
  { key: "twitter", name: "X / Twitter", emoji: "🐦", color: "#ffffff", bg: "rgba(255,255,255,0.1)" },
  { key: "tiktok", name: "TikTok", emoji: "🎵", color: "#00f2ea", bg: "rgba(0,242,234,0.1)" },
  { key: "instagram", name: "Instagram", emoji: "📸", color: "#e1306c", bg: "rgba(225,48,108,0.1)" },
  { key: "facebook", name: "Facebook", emoji: "📘", color: "#1877F2", bg: "rgba(24,119,242,0.1)" },
  { key: "youtube", name: "YouTube", emoji: "▶️", color: "#FF0000", bg: "rgba(255,0,0,0.1)" },
];

// ── Log Entry Type ──
type LogEntry = { time: string; emoji: string; text: string; type: "info" | "success" | "error" | "waiting" };

function timestamp() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// ── Section Header ──
function SectionHeader({ title, emoji, expanded, onToggle, accent }: { title: string; emoji: string; expanded: boolean; onToggle: () => void; accent?: string }) {
  return (
    <TouchableOpacity style={[styles.sectionHeader, accent ? { borderBottomColor: accent } : null]} onPress={onToggle} activeOpacity={0.7}>
      <Text style={styles.sectionEmoji}>{emoji}</Text>
      <Text style={[styles.sectionTitle, accent ? { color: accent } : null]}>{title}</Text>
      <Text style={styles.sectionChevron}>{expanded ? "▼" : "▶"}</Text>
    </TouchableOpacity>
  );
}

// ── Status Badge ──
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; color: string; label: string }> = {
    complete: { bg: "rgba(34,197,94,0.15)", color: colors.green, label: "Done" },
    done: { bg: "rgba(34,197,94,0.15)", color: colors.green, label: "Done" },
    posted: { bg: "rgba(34,197,94,0.15)", color: colors.green, label: "Posted" },
    failed: { bg: "rgba(239,68,68,0.15)", color: colors.red, label: "Failed" },
    pending: { bg: "rgba(234,179,8,0.15)", color: colors.yellow, label: "Pending" },
    generating: { bg: "rgba(124,58,237,0.15)", color: colors.purpleLight, label: "Generating" },
    submitted: { bg: "rgba(6,182,212,0.15)", color: colors.cyan, label: "Submitted" },
    queued: { bg: "rgba(234,179,8,0.15)", color: colors.yellow, label: "Queued" },
    posting: { bg: "rgba(124,58,237,0.15)", color: colors.purpleLight, label: "Posting" },
  };
  const c = config[status] || config.pending;
  return (
    <View style={[styles.statusBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.statusText, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

// ── Stat Card ──
function StatCard({ emoji, value, label, color: c }: { emoji: string; value: string | number; label: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={[styles.statValue, { color: c }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Generation Log ──
function GenerationLog({ entries }: { entries: LogEntry[] }) {
  const scrollRef = useRef<ScrollView>(null);
  return (
    <View style={styles.logContainer}>
      <Text style={styles.logHeader}>Generation Log</Text>
      <ScrollView
        ref={scrollRef}
        style={styles.logScroll}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {entries.map((e, i) => (
          <Text key={i} style={[styles.logLine, e.type === "error" && { color: colors.red }, e.type === "success" && { color: colors.green }, e.type === "waiting" && { color: colors.yellow }]}>
            {e.emoji} {e.text}
          </Text>
        ))}
        {entries.length === 0 && <Text style={styles.logLine}>Waiting for activity...</Text>}
      </ScrollView>
    </View>
  );
}

// ── Progress Bar ──
function ProgressBar({ progress, color: barColor }: { progress: number; color?: string }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%`, backgroundColor: barColor || colors.purple }]} />
    </View>
  );
}

export default function ContentStudioScreen() {
  const { sessionId } = useSession();
  const { walletAddress } = usePhantomWallet();
  const [refreshing, setRefreshing] = useState(false);

  // Section expand state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    create: true,
    directors: false,
    library: false,
    uploads: false,
    social: false,
    monitor: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ── Quick Generate State ──
  const [quickGenerating, setQuickGenerating] = useState(false);
  const [quickLog, setQuickLog] = useState<LogEntry[]>([]);

  const addQuickLog = (emoji: string, text: string, type: LogEntry["type"] = "info") => {
    setQuickLog((prev) => [...prev.slice(-50), { time: timestamp(), emoji, text, type }]);
  };

  // ── Content Create State ──
  const [selectedType, setSelectedType] = useState<ContentType | null>(null);
  const [prompt, setPrompt] = useState("");
  const [directorStyle, setDirectorStyle] = useState<DirectorStyle>("cinematic");
  const [generating, setGenerating] = useState(false);
  const [activeJob, setActiveJob] = useState<ContentJob | null>(null);

  // ── Director Movie State ──
  const [selectedDirector, setSelectedDirector] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [movieConcept, setMovieConcept] = useState("");
  const [movieGenerating, setMovieGenerating] = useState(false);
  const [movieLog, setMovieLog] = useState<LogEntry[]>([]);
  const [movieResult, setMovieResult] = useState<any>(null);

  const addMovieLog = (emoji: string, text: string, type: LogEntry["type"] = "info") => {
    setMovieLog((prev) => [...prev.slice(-80), { time: timestamp(), emoji, text, type }]);
  };

  // ── Library State ──
  const [library, setLibrary] = useState<ContentJob[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  // ── Uploads State ──
  const [uploads, setUploads] = useState<MediaLibraryItem[]>([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("general");

  // ── Social State ──
  const [spreadHistory, setSpreadHistory] = useState<any[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);

  // ── Monitor State ──
  const [mktgStats, setMktgStats] = useState<any>(null);
  const [cronJobs, setCronJobs] = useState<any[]>([]);
  const [healthData, setHealthData] = useState<any>(null);
  const [monitorLoading, setMonitorLoading] = useState(false);

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, []);

  // ── Loaders ──
  const loadLibrary = useCallback(async () => {
    if (!sessionId || !walletAddress) return;
    setLibraryLoading(true);
    try {
      const data = await getContentLibrary(sessionId, walletAddress);
      setLibrary(data.items || []);
    } catch (e: any) { console.warn("Library:", e?.message); }
    setLibraryLoading(false);
  }, [sessionId, walletAddress]);

  const loadUploads = useCallback(async () => {
    if (!sessionId || !walletAddress) return;
    setUploadsLoading(true);
    try {
      const data = await getMediaLibrary(sessionId, walletAddress);
      setUploads(data.items || []);
    } catch (e: any) { console.warn("Uploads:", e?.message); }
    setUploadsLoading(false);
  }, [sessionId, walletAddress]);

  const loadSocial = useCallback(async () => {
    if (!walletAddress) return;
    setSocialLoading(true);
    try {
      const data = await getSpreadHistory(walletAddress);
      setSpreadHistory(data.spreads || []);
    } catch (e: any) { console.warn("Social:", e?.message); }
    setSocialLoading(false);
  }, [walletAddress]);

  const loadMonitor = useCallback(async () => {
    if (!walletAddress || !sessionId) return;
    setMonitorLoading(true);
    try {
      const [stats, cron, health] = await Promise.all([
        getMarketingStats(walletAddress).catch(() => ({ stats: null })),
        getCronStatus(walletAddress).catch(() => ({ jobs: [] })),
        getAdminHealth(sessionId, walletAddress).catch(() => null),
      ]);
      setMktgStats(stats.stats);
      setCronJobs(cron.jobs || []);
      setHealthData(health);
    } catch (e: any) { console.warn("Monitor:", e?.message); }
    setMonitorLoading(false);
  }, [walletAddress, sessionId]);

  // Auto-load on expand
  useEffect(() => { if (expandedSections.library) loadLibrary(); }, [expandedSections.library]);
  useEffect(() => { if (expandedSections.uploads) loadUploads(); }, [expandedSections.uploads]);
  useEffect(() => { if (expandedSections.social) loadSocial(); }, [expandedSections.social]);
  useEffect(() => { if (expandedSections.monitor) loadMonitor(); }, [expandedSections.monitor]);

  // ── Poll for job completion ──
  const startPolling = (jobId: string, contentType: string) => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    let attempts = 0;
    addQuickLog("⏳", `Polling ${contentType} job...`, "waiting");
    pollTimer.current = setInterval(async () => {
      attempts++;
      if (attempts > 60 || !sessionId) {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setGenerating(false);
        addQuickLog("❌", "Polling timed out", "error");
        return;
      }
      try {
        const job = await getContentJobStatus(jobId, sessionId!);
        setActiveJob(job);
        if (job.status === "complete") {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setGenerating(false);
          addQuickLog("✅", `${contentType} generated successfully!`, "success");
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (job.status === "failed") {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setGenerating(false);
          addQuickLog("❌", `${contentType} failed: ${job.error || "Unknown"}`, "error");
        } else {
          addQuickLog("⏳", `Attempt ${attempts}... status: ${job.status}`, "waiting");
        }
      } catch (_) {}
    }, 3000);
  };

  // ── Generate content (ad_image, ad_video, directors_movie) ──
  const handleGenerate = async () => {
    if (!selectedType || !sessionId || !walletAddress || generating) return;
    setGenerating(true);
    setActiveJob(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const typeName = selectedType.replace(/_/g, " ");
    addQuickLog("🎬", `Starting ${typeName} generation...`, "info");
    try {
      const result = await generateContent(sessionId, walletAddress, selectedType, {
        prompt: prompt.trim() || undefined,
        director_style: selectedType === "directors_movie" ? directorStyle : undefined,
      });
      if (result.success && result.job_id) {
        addQuickLog("📡", `Job submitted: ${result.job_id.slice(0, 8)}...`, "info");
        setActiveJob({ job_id: result.job_id, content_type: result.content_type, status: result.status, created_at: new Date().toISOString() });
        startPolling(result.job_id, typeName);
      } else {
        setGenerating(false);
        addQuickLog("❌", result.message || "Could not start", "error");
      }
    } catch (e: any) {
      setGenerating(false);
      addQuickLog("❌", e?.message || "Generation failed", "error");
    }
  };

  // ── Quick Generate (poster/hero using working endpoints) ──
  const handleQuickGenerate = async (type: "poster" | "hero") => {
    if (quickGenerating || !walletAddress) return;
    setQuickGenerating(true);
    const label = type === "poster" ? "Promo Poster" : "Hero Image";
    addQuickLog("🎬", `Generating ${label}...`, "info");
    addQuickLog("📡", `Submitting to /api/admin/mktg...`, "info");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const res = type === "poster" ? await generatePoster(walletAddress) : await generateHeroImage(walletAddress);
      addQuickLog("✅", `${label} generated!`, "success");
      if (res.url) addQuickLog("🖼", `URL: ${res.url.slice(0, 50)}...`, "success");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(`${label} Generated!`, res.message || (res.url ? `URL: ${res.url}` : "Done!"));
    } catch (e: any) {
      addQuickLog("❌", e?.message || "Generation failed", "error");
      Alert.alert("Error", e?.message || "Generation failed");
    }
    setQuickGenerating(false);
  };

  // ── Director Movie: Full Pipeline ──
  const handleDirectorMovie = async () => {
    if (movieGenerating || !walletAddress) return;
    setMovieGenerating(true);
    setMovieResult(null);
    setMovieLog([]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const director = selectedDirector ? DIRECTORS.find(d => d.id === selectedDirector) : null;
    const genre = selectedGenre || undefined;

    addMovieLog("🎬", `Commissioning Director Movie...`, "info");
    if (director) addMovieLog("🎭", `Director: ${director.emoji} ${director.name}`, "info");
    if (genre) addMovieLog("🎭", `Genre: ${genre}`, "info");
    if (movieConcept.trim()) addMovieLog("📖", `Concept: "${movieConcept.trim()}"`, "info");
    addMovieLog("📜", `Writing screenplay...`, "waiting");

    try {
      const opts: any = {};
      if (director) opts.director = director.id;
      if (genre) opts.genre = genre;
      if (movieConcept.trim()) opts.concept = movieConcept.trim();

      const res = await triggerDirectorMovie(walletAddress, Object.keys(opts).length > 0 ? opts : undefined);

      if (res.success) {
        addMovieLog("✅", `Movie commissioned! ${res.message || ""}`, "success");
        if (res.job_id) {
          addMovieLog("📡", `Job ID: ${res.job_id}`, "info");
          addMovieLog("⏳", `Scenes being generated... check back soon`, "waiting");
          addMovieLog("🎉", `You'll be notified when the movie is ready`, "success");
        }
        setMovieResult(res);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        addMovieLog("❌", res.message || "Failed to commission", "error");
      }
    } catch (e: any) {
      addMovieLog("❌", e?.message || "Movie generation failed", "error");
    }
    setMovieGenerating(false);
  };

  // ── Upload handlers ──
  const doUpload = async (uri: string, fileName: string, mimeType: string) => {
    if (!sessionId || !walletAddress || uploading) return;
    setUploading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await uploadMedia(sessionId, walletAddress, uri, fileName, mimeType, uploadCategory);
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Uploaded!", `${fileName} uploaded.\n\nURL: ${result.url}`);
        loadUploads();
      }
    } catch (e: any) {
      Alert.alert("Upload Failed", e?.message || "Error");
    }
    setUploading(false);
  };

  const showUploadOptions = () => {
    Alert.alert("Upload to Blob Storage", "Choose source:", [
      { text: "Photo/Video Library", onPress: async () => {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.9 });
        if (!result.canceled && result.assets[0]) {
          const a = result.assets[0];
          await doUpload(a.uri, a.fileName || `upload_${Date.now()}.jpg`, a.type === "video" ? "video/mp4" : "image/jpeg");
        }
      }},
      { text: "Take Photo", onPress: async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") { Alert.alert("Permission needed"); return; }
        const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
        if (!result.canceled && result.assets[0]) await doUpload(result.assets[0].uri, `camera_${Date.now()}.jpg`, "image/jpeg");
      }},
      { text: "File/Document", onPress: async () => {
        try {
          const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
          if (!result.canceled && result.assets?.[0]) {
            const doc = result.assets[0];
            await doUpload(doc.uri, doc.name, doc.mimeType || "application/octet-stream");
          }
        } catch (e) { console.warn(e); }
      }},
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLibrary(); loadUploads();
    setTimeout(() => setRefreshing(false), 1000);
  };

  if (!walletAddress) {
    return (
      <View style={styles.center}>
        <Text style={styles.lockEmoji}>🎨</Text>
        <Text style={styles.lockTitle}>Creative Hub</Text>
        <Text style={styles.lockSub}>Connect your wallet to access content tools</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purple} />}
        keyboardShouldPersistTaps="handled"
      >
        {/* ══════════════ CREATE CONTENT ══════════════ */}
        <SectionHeader title="Create Content" emoji="🎨" expanded={expandedSections.create} onToggle={() => toggleSection("create")} accent={colors.purpleLight} />
        {expandedSections.create && (
          <View style={styles.sectionBody}>
            {/* Working quick-generate buttons */}
            <TouchableOpacity style={[styles.actionCard, quickGenerating && { opacity: 0.5 }]}
              onPress={() => handleQuickGenerate("poster")} disabled={quickGenerating}>
              <Text style={styles.actionEmoji}>📢</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>{quickGenerating ? "Generating..." : "Generate Promo Poster"}</Text>
                <Text style={styles.actionDesc}>AI-generated promotional poster</Text>
              </View>
              <Text style={styles.actionChevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionCard, quickGenerating && { opacity: 0.5 }]}
              onPress={() => handleQuickGenerate("hero")} disabled={quickGenerating}>
              <Text style={styles.actionEmoji}>🖼</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>{quickGenerating ? "Generating..." : "Generate Hero Image"}</Text>
                <Text style={styles.actionDesc}>Landing page hero banner</Text>
              </View>
              <Text style={styles.actionChevron}>›</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Additional content types */}
            {[
              { key: "ad_image" as ContentType, emoji: "🎯", title: "Ad Image", desc: "Eye-catching advertisement image" },
              { key: "ad_video" as ContentType, emoji: "🎬", title: "Ad Video", desc: "Short promotional video for ads" },
            ].map((ct) => (
              <TouchableOpacity key={ct.key}
                style={[styles.typeCard, selectedType === ct.key && styles.typeCardSelected]}
                onPress={() => { setSelectedType(selectedType === ct.key ? null : ct.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                <Text style={styles.typeEmoji}>{ct.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.typeTitle}>{ct.title}</Text>
                  <Text style={styles.typeDesc}>{ct.desc}</Text>
                </View>
                {selectedType === ct.key && <Text style={styles.typeCheck}>✓</Text>}
              </TouchableOpacity>
            ))}

            {selectedType && (
              <View style={styles.optionsSection}>
                <Text style={styles.optionLabel}>Creative Prompt (optional)</Text>
                <TextInput style={styles.optionInput} value={prompt} onChangeText={setPrompt}
                  placeholder="Describe what you want..." placeholderTextColor={colors.textMuted} multiline maxLength={500} />
                <TouchableOpacity style={[styles.generateBtn, generating && { opacity: 0.5 }]} onPress={handleGenerate} disabled={generating}>
                  <Text style={styles.generateBtnText}>{generating ? "Generating..." : `Generate ${selectedType.replace(/_/g, " ")}`}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Generation Log */}
            {quickLog.length > 0 && <GenerationLog entries={quickLog} />}
          </View>
        )}

        {/* ══════════════ DIRECTOR MOVIES ══════════════ */}
        <SectionHeader title="Director Movies" emoji="🎥" expanded={expandedSections.directors} onToggle={() => toggleSection("directors")} accent={colors.pink} />
        {expandedSections.directors && (
          <View style={styles.sectionBody}>
            <Text style={styles.subsectionLabel}>Choose a Director</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              {/* Auto option */}
              <TouchableOpacity style={[styles.directorCard, !selectedDirector && styles.directorCardSelected]}
                onPress={() => { setSelectedDirector(null); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                <Text style={styles.directorEmoji}>🎲</Text>
                <Text style={styles.directorName}>Auto</Text>
                <Text style={styles.directorStyle}>Random pick</Text>
              </TouchableOpacity>
              {DIRECTORS.map((d) => (
                <TouchableOpacity key={d.id} style={[styles.directorCard, selectedDirector === d.id && styles.directorCardSelected]}
                  onPress={() => { setSelectedDirector(selectedDirector === d.id ? null : d.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                  <Text style={styles.directorEmoji}>{d.emoji}</Text>
                  <Text style={styles.directorName} numberOfLines={1}>{d.name.split(" ").slice(-1)[0]}</Text>
                  <Text style={styles.directorStyle} numberOfLines={1}>{d.genres.slice(0, 2).join(", ")}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Selected director detail */}
            {selectedDirector && (() => {
              const d = DIRECTORS.find(x => x.id === selectedDirector);
              if (!d) return null;
              return (
                <View style={styles.directorDetail}>
                  <Text style={styles.directorDetailName}>{d.emoji} {d.name}</Text>
                  <Text style={styles.directorDetailMeta}>Style: {d.style}</Text>
                  <Text style={styles.directorDetailMeta}>Signature: {d.signature}</Text>
                  <View style={styles.genreTags}>
                    {d.genres.map(g => (
                      <Text key={g} style={styles.genreTag}>{g}</Text>
                    ))}
                  </View>
                </View>
              );
            })()}

            <Text style={styles.subsectionLabel}>Genre</Text>
            <View style={styles.genreGrid}>
              <TouchableOpacity style={[styles.genreChip, !selectedGenre && styles.genreChipActive]}
                onPress={() => setSelectedGenre(null)}>
                <Text style={[styles.genreChipText, !selectedGenre && styles.genreChipTextActive]}>Any</Text>
              </TouchableOpacity>
              {GENRES.map(g => (
                <TouchableOpacity key={g} style={[styles.genreChip, selectedGenre === g && styles.genreChipActive]}
                  onPress={() => setSelectedGenre(selectedGenre === g ? null : g)}>
                  <Text style={[styles.genreChipText, selectedGenre === g && styles.genreChipTextActive]}>
                    {g.replace(/_/g, " ")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.subsectionLabel}>Concept (optional)</Text>
            <TextInput style={styles.optionInput} value={movieConcept} onChangeText={setMovieConcept}
              placeholder="Describe your movie idea... or leave blank for AI surprise"
              placeholderTextColor={colors.textMuted} multiline maxLength={500} />

            <TouchableOpacity
              style={[styles.movieGenBtn, movieGenerating && { opacity: 0.5 }]}
              onPress={handleDirectorMovie} disabled={movieGenerating}>
              <Text style={styles.movieGenBtnText}>
                {movieGenerating ? "🎬 Commissioning..." : "🎥 Commission Director Movie"}
              </Text>
            </TouchableOpacity>

            {/* Movie generation log */}
            {movieLog.length > 0 && <GenerationLog entries={movieLog} />}

            {/* Movie result */}
            {movieResult && (
              <View style={styles.movieResultCard}>
                <Text style={styles.movieResultTitle}>🎬 Movie Commissioned!</Text>
                {movieResult.job_id && <Text style={styles.movieResultMeta}>Job: {movieResult.job_id}</Text>}
                {movieResult.message && <Text style={styles.movieResultMeta}>{movieResult.message}</Text>}
              </View>
            )}
          </View>
        )}

        {/* ══════════════ LIBRARY ══════════════ */}
        <SectionHeader title={`Library (${library.length})`} emoji="📚" expanded={expandedSections.library} onToggle={() => toggleSection("library")} accent={colors.amber} />
        {expandedSections.library && (
          <View style={styles.sectionBody}>
            {libraryLoading && <ActivityIndicator color={colors.purple} style={{ marginVertical: 16 }} />}
            {library.length === 0 && !libraryLoading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📚</Text>
                <Text style={styles.emptyTitle}>No content yet</Text>
                <Text style={styles.emptySub}>Generated content will appear here</Text>
              </View>
            )}
            {library.map((item) => (
              <View key={item.job_id} style={styles.libraryItem}>
                {item.final_url && <Image source={{ uri: item.final_url }} style={styles.libraryThumb} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.libraryTitle}>{item.content_type?.replace(/_/g, " ")}</Text>
                  <Text style={styles.libraryMeta}>{new Date(item.created_at).toLocaleDateString()}</Text>
                  {item.prompt && <Text style={styles.libraryPrompt} numberOfLines={1}>{item.prompt}</Text>}
                </View>
                <StatusBadge status={item.status} />
              </View>
            ))}
          </View>
        )}

        {/* ══════════════ BLOB STORAGE ══════════════ */}
        <SectionHeader title={`Blob Storage (${uploads.length})`} emoji="☁️" expanded={expandedSections.uploads} onToggle={() => toggleSection("uploads")} accent={colors.cyan} />
        {expandedSections.uploads && (
          <View style={styles.sectionBody}>
            <View style={styles.catPicker}>
              {["promo", "hero", "ad", "social", "general"].map((c) => (
                <TouchableOpacity key={c} style={[styles.catChip, uploadCategory === c && styles.catChipActive]} onPress={() => setUploadCategory(c)}>
                  <Text style={[styles.catChipText, uploadCategory === c && styles.catChipTextActive]}>{c.charAt(0).toUpperCase() + c.slice(1)}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.uploadBtn, uploading && { opacity: 0.5 }]} onPress={showUploadOptions} disabled={uploading}>
              <Text style={styles.uploadBtnEmoji}>☁️</Text>
              <View>
                <Text style={styles.uploadBtnText}>{uploading ? "Uploading..." : "Upload to Blob Storage"}</Text>
                <Text style={styles.uploadBtnSub}>Photo, video, or any file</Text>
              </View>
            </TouchableOpacity>

            {uploadsLoading && <ActivityIndicator color={colors.cyan} style={{ marginVertical: 16 }} />}
            {uploads.length === 0 && !uploadsLoading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>☁️</Text>
                <Text style={styles.emptyTitle}>No uploads yet</Text>
              </View>
            )}
            {uploads.map((item) => (
              <View key={item.id} style={styles.uploadItem}>
                {item.content_type?.startsWith("image/") ? (
                  <Image source={{ uri: item.url }} style={styles.uploadThumb} />
                ) : (
                  <View style={styles.uploadFileBadge}><Text style={{ fontSize: 24 }}>📄</Text></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.uploadName} numberOfLines={1}>{item.filename}</Text>
                  <Text style={styles.uploadMeta}>{item.category || "general"} · {(item.size_bytes / 1024).toFixed(0)} KB</Text>
                </View>
                <TouchableOpacity onPress={() => {
                  Alert.alert("Delete?", `Remove "${item.filename}"?`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: async () => {
                      if (!sessionId || !walletAddress) return;
                      try { await deleteMedia(sessionId, walletAddress, item.blob_key); setUploads(prev => prev.filter(u => u.id !== item.id)); } catch (e: any) { Alert.alert("Error", e?.message); }
                    }},
                  ]);
                }} style={styles.deleteBtn}>
                  <Text style={{ fontSize: 18 }}>🗑</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ══════════════ SOCIAL DISTRIBUTION ══════════════ */}
        <SectionHeader title="Social Distribution" emoji="📡" expanded={expandedSections.social} onToggle={() => toggleSection("social")} accent={colors.pink} />
        {expandedSections.social && (
          <View style={styles.sectionBody}>
            <Text style={styles.subsectionLabel}>Platforms</Text>
            <View style={styles.platformGrid}>
              {PLATFORMS.map(p => (
                <View key={p.key} style={[styles.platformCard, { borderTopColor: p.color }]}>
                  <Text style={{ fontSize: 24 }}>{p.emoji}</Text>
                  <Text style={[styles.platformName, { color: p.color }]}>{p.name}</Text>
                  <StatusBadge status="posted" />
                </View>
              ))}
            </View>

            <Text style={[styles.subsectionLabel, { marginTop: 16 }]}>Recent Spreads ({spreadHistory.length})</Text>
            {socialLoading && <ActivityIndicator color={colors.pink} style={{ marginVertical: 16 }} />}
            {spreadHistory.length === 0 && !socialLoading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📡</Text>
                <Text style={styles.emptyTitle}>No spreads yet</Text>
                <Text style={styles.emptySub}>Content distributed to socials will appear here</Text>
              </View>
            )}
            {spreadHistory.slice(0, 10).map((s, i) => (
              <View key={i} style={styles.spreadItem}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.spreadText} numberOfLines={2}>{s.text || s.post_id || "Spread"}</Text>
                  <Text style={styles.spreadMeta}>{s.platform || "all"} · {s.created_at ? new Date(s.created_at).toLocaleDateString() : ""}</Text>
                </View>
                <StatusBadge status={s.status || "posted"} />
              </View>
            ))}
          </View>
        )}

        {/* ══════════════ MONITORING ══════════════ */}
        <SectionHeader title="Monitoring" emoji="📊" expanded={expandedSections.monitor} onToggle={() => toggleSection("monitor")} accent={colors.cyan} />
        {expandedSections.monitor && (
          <View style={styles.sectionBody}>
            {monitorLoading && <ActivityIndicator color={colors.cyan} style={{ marginVertical: 16 }} />}

            {/* Stats grid */}
            {mktgStats && (
              <>
                <Text style={styles.subsectionLabel}>Marketing Stats</Text>
                <View style={styles.statsGrid}>
                  <StatCard emoji="📢" value={mktgStats.posters_generated || mktgStats.total_posters || 0} label="Posters" color={colors.purpleLight} />
                  <StatCard emoji="🖼" value={mktgStats.heroes_generated || mktgStats.total_heroes || 0} label="Heroes" color={colors.cyan} />
                  <StatCard emoji="🎬" value={mktgStats.videos_generated || mktgStats.total_videos || 0} label="Videos" color={colors.pink} />
                  <StatCard emoji="📡" value={mktgStats.posts_spread || mktgStats.total_spreads || 0} label="Spreads" color={colors.amber} />
                </View>
              </>
            )}

            {/* System health */}
            {healthData && (
              <>
                <Text style={[styles.subsectionLabel, { marginTop: 16 }]}>System Health</Text>
                <View style={styles.healthGrid}>
                  {Object.entries(healthData.services || healthData).slice(0, 6).map(([key, val]: [string, any]) => (
                    <View key={key} style={styles.healthItem}>
                      <View style={[styles.healthDot, { backgroundColor: val === true || val?.healthy ? colors.green : typeof val === "object" && val?.status === "degraded" ? colors.yellow : colors.red }]} />
                      <Text style={styles.healthLabel}>{key.replace(/_/g, " ")}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Cron jobs */}
            {cronJobs.length > 0 && (
              <>
                <Text style={[styles.subsectionLabel, { marginTop: 16 }]}>Cron Jobs</Text>
                {cronJobs.map((job: any, i: number) => (
                  <View key={i} style={styles.cronItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cronName}>{job.name || job.job || `Job ${i + 1}`}</Text>
                      <Text style={styles.cronMeta}>{job.last_run ? `Last: ${new Date(job.last_run).toLocaleString()}` : "Never run"}</Text>
                    </View>
                    <StatusBadge status={job.status || "pending"} />
                  </View>
                ))}
              </>
            )}

            <TouchableOpacity style={styles.refreshBtn} onPress={loadMonitor}>
              <Text style={styles.refreshBtnText}>Refresh Monitoring</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ══════════════════════════════════════════════
//  STYLES — Dark mode, neon accents per spec
// ══════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 20 },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center", padding: 32 },

  lockEmoji: { fontSize: 64, marginBottom: 16 },
  lockTitle: { color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: 8 },
  lockSub: { color: colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 22 },

  // Section headers
  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 16, paddingHorizontal: 4,
    borderBottomWidth: 2, borderBottomColor: colors.border,
    marginTop: 8,
  },
  sectionEmoji: { fontSize: 20 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "800", flex: 1, fontFamily: "Courier" },
  sectionChevron: { color: colors.textMuted, fontSize: 12 },
  sectionBody: { paddingTop: 12, paddingBottom: 8 },
  subsectionLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: "700", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },

  // Action cards
  actionCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#111827", borderRadius: 12, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: "#1f2937",
  },
  actionEmoji: { fontSize: 32 },
  actionTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  actionDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  actionChevron: { color: colors.textMuted, fontSize: 22, fontWeight: "300" },

  // Type cards
  typeCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "#111827", borderRadius: 12, padding: 16,
    marginBottom: 10, borderWidth: 1.5, borderColor: "#1f2937",
  },
  typeCardSelected: { borderColor: colors.purple, backgroundColor: "rgba(124, 58, 237, 0.08)" },
  typeEmoji: { fontSize: 32 },
  typeTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  typeDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  typeCheck: { color: colors.purple, fontSize: 20, fontWeight: "800" },

  // Options
  optionsSection: {
    backgroundColor: "rgba(124, 58, 237, 0.04)", borderRadius: 16, padding: 16, marginTop: 10,
    borderWidth: 1, borderColor: "rgba(124, 58, 237, 0.15)",
  },
  optionLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: "600", marginTop: 12, marginBottom: 6 },
  optionInput: {
    backgroundColor: "#1f2937", borderWidth: 1, borderColor: "#374151", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14, minHeight: 80, textAlignVertical: "top",
  },

  // Generate button
  generateBtn: { backgroundColor: colors.purple, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 16 },
  generateBtnText: { color: colors.text, fontSize: 16, fontWeight: "800" },

  // Movie generate button (gradient feel)
  movieGenBtn: {
    borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 16,
    backgroundColor: colors.purple,
    borderWidth: 1, borderColor: colors.pink,
  },
  movieGenBtnText: { color: colors.text, fontSize: 16, fontWeight: "800" },

  // Director cards (horizontal scroll)
  directorCard: {
    width: 90, alignItems: "center", padding: 12,
    backgroundColor: "#111827", borderRadius: 12,
    borderWidth: 1.5, borderColor: "#1f2937", marginRight: 10,
  },
  directorCardSelected: { borderColor: colors.pink, backgroundColor: "rgba(236,72,153,0.08)" },
  directorEmoji: { fontSize: 28, marginBottom: 6 },
  directorName: { color: colors.text, fontSize: 11, fontWeight: "700", textAlign: "center" },
  directorStyle: { color: colors.textMuted, fontSize: 9, textAlign: "center", marginTop: 2 },

  // Director detail card
  directorDetail: {
    backgroundColor: "rgba(236,72,153,0.06)", borderRadius: 12, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(236,72,153,0.2)",
  },
  directorDetailName: { color: colors.pink, fontSize: 15, fontWeight: "800" },
  directorDetailMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },
  genreTags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  genreTag: {
    color: colors.amber, fontSize: 10, fontWeight: "700",
    backgroundColor: "rgba(245,158,11,0.15)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },

  // Genre grid
  genreGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  genreChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: "#374151", backgroundColor: "#111827",
  },
  genreChipActive: { borderColor: colors.pink, backgroundColor: "rgba(236,72,153,0.15)" },
  genreChipText: { color: colors.textMuted, fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  genreChipTextActive: { color: colors.pink },

  // Generation log
  logContainer: {
    backgroundColor: "#0a0a0a", borderRadius: 12, marginTop: 16, overflow: "hidden",
    borderWidth: 1, borderColor: "#1f2937",
  },
  logHeader: {
    color: colors.textSecondary, fontSize: 11, fontWeight: "700", textTransform: "uppercase",
    letterSpacing: 1, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#111827",
  },
  logScroll: { maxHeight: 200, paddingHorizontal: 12, paddingVertical: 8 },
  logLine: { color: colors.textSecondary, fontSize: 11, fontFamily: "Courier", lineHeight: 18 },

  // Movie result
  movieResultCard: {
    backgroundColor: "rgba(34,197,94,0.06)", borderRadius: 12, padding: 16, marginTop: 16,
    borderWidth: 1, borderColor: "rgba(34,197,94,0.2)",
  },
  movieResultTitle: { color: colors.green, fontSize: 15, fontWeight: "800" },
  movieResultMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 4 },

  // Progress bar
  progressTrack: { height: 6, backgroundColor: "#374151", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },

  // Status badge
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: "700" },

  // Stat cards
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    flex: 1, minWidth: "45%", alignItems: "center", padding: 14,
    backgroundColor: "#111827", borderRadius: 12, borderWidth: 1, borderColor: "#1f2937",
  },
  statEmoji: { fontSize: 22, marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: "900" },
  statLabel: { color: colors.textMuted, fontSize: 10, fontWeight: "600", marginTop: 2, textTransform: "uppercase" },

  // Library
  libraryItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#111827", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#1f2937",
  },
  libraryThumb: { width: 56, height: 56, borderRadius: 10 },
  libraryTitle: { color: colors.text, fontSize: 14, fontWeight: "700", textTransform: "capitalize" },
  libraryMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  libraryPrompt: { color: colors.textSecondary, fontSize: 11, marginTop: 2, fontStyle: "italic" },

  // Upload
  uploadBtn: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "rgba(6,182,212,0.06)", borderWidth: 1.5, borderColor: "rgba(6,182,212,0.2)",
    borderRadius: 12, padding: 16, marginTop: 14, borderStyle: "dashed",
  },
  uploadBtnEmoji: { fontSize: 32 },
  uploadBtnText: { color: colors.cyan, fontSize: 15, fontWeight: "700" },
  uploadBtnSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  catPicker: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: "#374151", backgroundColor: "#111827" },
  catChipActive: { borderColor: colors.cyan, backgroundColor: "rgba(6,182,212,0.15)" },
  catChipText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  catChipTextActive: { color: colors.cyan },
  uploadItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#111827", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#1f2937",
  },
  uploadThumb: { width: 48, height: 48, borderRadius: 8 },
  uploadFileBadge: { width: 48, height: 48, borderRadius: 8, backgroundColor: "rgba(6,182,212,0.1)", justifyContent: "center", alignItems: "center" },
  uploadName: { color: colors.text, fontSize: 13, fontWeight: "600" },
  uploadMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  deleteBtn: { padding: 8 },

  // Platforms
  platformGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  platformCard: {
    flex: 1, minWidth: "28%", alignItems: "center", padding: 12,
    backgroundColor: "#111827", borderRadius: 12, borderWidth: 1, borderColor: "#1f2937",
    borderTopWidth: 3,
  },
  platformName: { fontSize: 10, fontWeight: "700", marginTop: 4, marginBottom: 4 },

  // Spreads
  spreadItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#111827", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#1f2937",
  },
  spreadText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  spreadMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },

  // Health
  healthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  healthItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  healthDot: { width: 8, height: 8, borderRadius: 4 },
  healthLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: "600", textTransform: "capitalize" },

  // Cron
  cronItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#111827", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#1f2937",
  },
  cronName: { color: colors.text, fontSize: 13, fontWeight: "600" },
  cronMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },

  // Refresh button
  refreshBtn: {
    borderWidth: 1, borderColor: colors.cyan, borderRadius: 12,
    paddingVertical: 12, alignItems: "center", marginTop: 16,
  },
  refreshBtnText: { color: colors.cyan, fontSize: 14, fontWeight: "700" },

  // Empty state
  emptyState: { alignItems: "center", paddingVertical: 30 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { color: colors.textSecondary, fontSize: 15, fontWeight: "700" },
  emptySub: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
});
