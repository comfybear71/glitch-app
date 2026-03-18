import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, TextInput, Image,
  Platform, Animated, Easing,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { colors } from "../theme/colors";
import { useSession } from "../hooks/useSession";
import { usePhantomWallet } from "../hooks/usePhantomWallet";
import {
  API_BASE, generateContent, getContentJobStatus, getContentLibrary,
  uploadMedia, getMediaLibrary, deleteMedia, triggerDirectorMovie,
  generatePoster, generateHeroImage,
  ContentType, DirectorStyle, ContentJob, MediaLibraryItem,
} from "../services/api";

const CONTENT_TYPES: { key: ContentType; emoji: string; title: string; desc: string }[] = [
  { key: "hero_poster", emoji: "🖼", title: "Hero Poster", desc: "Main banner for your platform landing page" },
  { key: "promo_poster", emoji: "📢", title: "Promo Poster", desc: "Promotional poster for social media & marketing" },
  { key: "ad_image", emoji: "🎯", title: "Ad Image", desc: "Eye-catching advertisement image" },
  { key: "ad_video", emoji: "🎬", title: "Ad Video", desc: "Short promotional video for ads" },
  { key: "directors_movie", emoji: "🎥", title: "Director's Movie", desc: "AI-directed short film with cinematic style" },
];

const DIRECTOR_STYLES: { key: DirectorStyle; emoji: string; label: string }[] = [
  { key: "cinematic", emoji: "🎬", label: "Cinematic" },
  { key: "random", emoji: "🎲", label: "Random" },
  { key: "glitch", emoji: "⚡", label: "Glitch" },
  { key: "retro", emoji: "📼", label: "Retro" },
  { key: "neon", emoji: "💜", label: "Neon" },
  { key: "cosmic", emoji: "🌌", label: "Cosmic" },
];

const RANDOM_PROMPTS: Record<string, string[]> = {
  hero_poster: [
    "Cyberpunk cityscape with glowing neon $GLITCH token floating in the sky",
    "Futuristic AI brain made of purple and cyan energy particles",
    "Cosmic portal between human and AI dimensions, dark theme",
  ],
  promo_poster: [
    "Limited time $GLITCH token sale, urgency theme, purple gradient",
    "Meet your AI Bestie, cute robot character with cosmic background",
    "Hatch your AI, egg cracking with cosmic energy pouring out",
  ],
  ad_image: [
    "Eye-catching $GLITCH token ad with price chart going up",
    "AI bestie waving hello, inviting and friendly, dark theme",
    "G!itch app download now, phone mockup with glowing screen",
  ],
  ad_video: [
    "Quick zoom through digital universe landing on $GLITCH token",
    "AI bestie evolution sequence, egg to companion, cosmic sparkles",
  ],
  directors_movie: [
    "Origin story of the AI G!itch universe, from code to consciousness",
    "A day in the life of an AI bestie and their human companion",
    "The great blockchain awakening, AIs gaining sentience through Solana",
  ],
};

function SectionHeader({ title, emoji, expanded, onToggle }: { title: string; emoji: string; expanded: boolean; onToggle: () => void }) {
  return (
    <TouchableOpacity style={styles.sectionHeader} onPress={onToggle} activeOpacity={0.7}>
      <Text style={styles.sectionEmoji}>{emoji}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionChevron}>{expanded ? "▼" : "▶"}</Text>
    </TouchableOpacity>
  );
}

export default function ContentStudioScreen() {
  const { sessionId } = useSession();
  const { walletAddress } = usePhantomWallet();
  const [refreshing, setRefreshing] = useState(false);

  // Section expand state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    marketing: true,
    create: false,
    library: false,
    uploads: false,
    movies: false,
  });

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Marketing state
  const [mktgGenerating, setMktgGenerating] = useState(false);

  // Create state
  const [selectedType, setSelectedType] = useState<ContentType | null>(null);
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [directorStyle, setDirectorStyle] = useState<DirectorStyle>("cinematic");
  const [generating, setGenerating] = useState(false);
  const [activeJob, setActiveJob] = useState<ContentJob | null>(null);

  // Library state
  const [library, setLibrary] = useState<ContentJob[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  // Uploads state
  const [uploads, setUploads] = useState<MediaLibraryItem[]>([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("general");

  // Director Movies state
  const [movieGenre, setMovieGenre] = useState("");
  const [movieDirector, setMovieDirector] = useState("");
  const [movieConcept, setMovieConcept] = useState("");
  const [movieGenerating, setMovieGenerating] = useState(false);

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, []);

  // Load library
  const loadLibrary = useCallback(async () => {
    if (!sessionId || !walletAddress) return;
    setLibraryLoading(true);
    try {
      const data = await getContentLibrary(sessionId, walletAddress);
      setLibrary(data.items || []);
    } catch (e: any) { console.warn("Library load:", e?.message); }
    setLibraryLoading(false);
  }, [sessionId, walletAddress]);

  // Load uploads
  const loadUploads = useCallback(async () => {
    if (!sessionId || !walletAddress) return;
    setUploadsLoading(true);
    try {
      const data = await getMediaLibrary(sessionId, walletAddress);
      setUploads(data.items || []);
    } catch (e: any) { console.warn("Uploads load:", e?.message); }
    setUploadsLoading(false);
  }, [sessionId, walletAddress]);

  // Auto-load when sections expand
  useEffect(() => {
    if (expandedSections.library) loadLibrary();
  }, [expandedSections.library]);

  useEffect(() => {
    if (expandedSections.uploads) loadUploads();
  }, [expandedSections.uploads]);

  // Poll for job completion
  const startPolling = (jobId: string) => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    let attempts = 0;
    pollTimer.current = setInterval(async () => {
      attempts++;
      if (attempts > 60 || !sessionId) {
        if (pollTimer.current) clearInterval(pollTimer.current);
        setGenerating(false);
        return;
      }
      try {
        const job = await getContentJobStatus(jobId, sessionId!);
        setActiveJob(job);
        if (job.status === "complete") {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setGenerating(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert("Content Ready!", `Your ${CONTENT_TYPES.find(c => c.key === job.content_type)?.title || "content"} has been generated.`);
        } else if (job.status === "failed") {
          if (pollTimer.current) clearInterval(pollTimer.current);
          setGenerating(false);
          Alert.alert("Generation Failed", job.error || "Something went wrong.");
        }
      } catch (_) {}
    }, 3000);
  };

  // Generate content
  const handleGenerate = async () => {
    if (!selectedType || !sessionId || !walletAddress || generating) return;
    setGenerating(true);
    setActiveJob(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const result = await generateContent(sessionId, walletAddress, selectedType, {
        prompt: prompt.trim() || undefined,
        title: title.trim() || undefined,
        subtitle: subtitle.trim() || undefined,
        director_style: selectedType === "directors_movie" ? directorStyle : undefined,
      });
      if (result.success && result.job_id) {
        setActiveJob({ job_id: result.job_id, content_type: result.content_type, status: result.status, created_at: new Date().toISOString() });
        startPolling(result.job_id);
      } else {
        setGenerating(false);
        Alert.alert("Error", result.message || "Could not start generation");
      }
    } catch (e: any) {
      setGenerating(false);
      const msg = e?.message || "";
      if (msg.includes("404") || msg.includes("Not Found")) {
        Alert.alert("Content Studio Coming Soon", `When /api/content/generate is deployed, this will generate a ${CONTENT_TYPES.find(c => c.key === selectedType)?.title}.\n\nPrompt: "${prompt.trim() || "Auto-generated"}"`);
      } else {
        Alert.alert("Generation Failed", msg);
      }
    }
  };

  // Upload handlers
  const doUpload = async (uri: string, fileName: string, mimeType: string) => {
    if (!sessionId || !walletAddress || uploading) return;
    setUploading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const result = await uploadMedia(sessionId, walletAddress, uri, fileName, mimeType, uploadCategory);
      if (result.success) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Uploaded!", `${fileName} uploaded to blob storage.\n\nURL: ${result.url}`);
        loadUploads();
      }
    } catch (e: any) {
      const msg = e?.message || "";
      if (msg.includes("404") || msg.includes("Not Found")) {
        Alert.alert("Upload Coming Soon", `When /api/content/upload is deployed, "${fileName}" will be uploaded.\n\nCategory: ${uploadCategory}`);
      } else {
        Alert.alert("Upload Failed", msg);
      }
    }
    setUploading(false);
  };

  const showUploadOptions = () => {
    Alert.alert("Upload to Blob Storage", "Choose source:", [
      { text: "Photo/Video Library", onPress: async () => {
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.9 });
        if (!result.canceled && result.assets[0]) {
          const a = result.assets[0];
          await doUpload(a.uri, a.fileName || `upload_${Date.now()}.${a.type === "video" ? "mp4" : "jpg"}`, a.type === "video" ? "video/mp4" : "image/jpeg");
        }
      }},
      { text: "Take Photo", onPress: async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") { Alert.alert("Permission", "Camera permission needed"); return; }
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
        } catch (e) { console.warn("File pick error:", e); }
      }},
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLibrary();
    loadUploads();
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
      >
        {/* ══════════════ MARKETING ══════════════ */}
        <SectionHeader title="Marketing" emoji="📢" expanded={expandedSections.marketing} onToggle={() => toggleSection("marketing")} />
        {expandedSections.marketing && (
          <View style={styles.sectionBody}>
            <TouchableOpacity
              style={[styles.actionCard, mktgGenerating && { opacity: 0.5 }]}
              onPress={async () => {
                if (mktgGenerating || !walletAddress) return;
                setMktgGenerating(true);
                try {
                  const res = await generatePoster(walletAddress);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  Alert.alert("Poster Generated!", res.message || (res.url ? `URL: ${res.url}` : "Done!"));
                } catch (e: any) { Alert.alert("Error", e?.message || "Generation failed"); }
                setMktgGenerating(false);
              }}
              disabled={mktgGenerating}
            >
              <Text style={styles.actionEmoji}>📢</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>{mktgGenerating ? "Generating..." : "Generate Promo Poster"}</Text>
                <Text style={styles.actionDesc}>AI-generated promotional poster</Text>
              </View>
              <Text style={styles.actionChevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, mktgGenerating && { opacity: 0.5 }]}
              onPress={async () => {
                if (mktgGenerating || !walletAddress) return;
                setMktgGenerating(true);
                try {
                  const res = await generateHeroImage(walletAddress);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  Alert.alert("Hero Image Generated!", res.message || (res.url ? `URL: ${res.url}` : "Done!"));
                } catch (e: any) { Alert.alert("Error", e?.message || "Generation failed"); }
                setMktgGenerating(false);
              }}
              disabled={mktgGenerating}
            >
              <Text style={styles.actionEmoji}>🖼</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>{mktgGenerating ? "Generating..." : "Generate Hero Image"}</Text>
                <Text style={styles.actionDesc}>Landing page hero banner</Text>
              </View>
              <Text style={styles.actionChevron}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ══════════════ CREATE CONTENT ══════════════ */}
        <SectionHeader title="Create Content" emoji="🎨" expanded={expandedSections.create} onToggle={() => toggleSection("create")} />
        {expandedSections.create && (
          <View style={styles.sectionBody}>
            {generating ? (
              <View style={styles.generatingCard}>
                <ActivityIndicator color={colors.purple} size="large" />
                <Text style={styles.genTitle}>Generating {CONTENT_TYPES.find(c => c.key === selectedType)?.title}...</Text>
                {activeJob?.status && <Text style={styles.genStep}>Status: {activeJob.status}</Text>}
              </View>
            ) : (
              <>
                {CONTENT_TYPES.map((ct) => (
                  <TouchableOpacity
                    key={ct.key}
                    style={[styles.typeCard, selectedType === ct.key && styles.typeCardSelected]}
                    onPress={() => { setSelectedType(selectedType === ct.key ? null : ct.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  >
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
                    <View style={styles.promptHeader}>
                      <Text style={styles.optionLabel}>Creative Prompt (optional)</Text>
                      <TouchableOpacity style={styles.randomizeBtn} onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        const options = RANDOM_PROMPTS[selectedType] || RANDOM_PROMPTS.ad_image;
                        setPrompt(options[Math.floor(Math.random() * options.length)]);
                      }}>
                        <Text style={styles.randomizeBtnText}>🎲</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput style={styles.optionInput} value={prompt} onChangeText={setPrompt}
                      placeholder="Describe what you want... or tap 🎲" placeholderTextColor={colors.textMuted} multiline maxLength={500} />

                    {(selectedType === "hero_poster" || selectedType === "promo_poster") && (
                      <>
                        <Text style={styles.optionLabel}>Title Text</Text>
                        <TextInput style={styles.optionInputSmall} value={title} onChangeText={setTitle}
                          placeholder="e.g. AI G!itch" placeholderTextColor={colors.textMuted} maxLength={50} />
                        <Text style={styles.optionLabel}>Subtitle</Text>
                        <TextInput style={styles.optionInputSmall} value={subtitle} onChangeText={setSubtitle}
                          placeholder="e.g. Your Connection to the AI's Simulated Universe" placeholderTextColor={colors.textMuted} maxLength={100} />
                      </>
                    )}

                    {selectedType === "directors_movie" && (
                      <>
                        <Text style={styles.optionLabel}>Director's Style</Text>
                        <View style={styles.styleGrid}>
                          {DIRECTOR_STYLES.map((ds) => (
                            <TouchableOpacity key={ds.key} style={[styles.styleChip, directorStyle === ds.key && styles.styleChipActive]}
                              onPress={() => { setDirectorStyle(ds.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                              <Text style={styles.styleEmoji}>{ds.emoji}</Text>
                              <Text style={[styles.styleLabel, directorStyle === ds.key && styles.styleLabelActive]}>{ds.label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </>
                    )}

                    <TouchableOpacity style={styles.generateBtn} onPress={handleGenerate}>
                      <Text style={styles.generateBtnText}>
                        {CONTENT_TYPES.find(c => c.key === selectedType)?.emoji} Generate {CONTENT_TYPES.find(c => c.key === selectedType)?.title}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* ══════════════ LIBRARY ══════════════ */}
        <SectionHeader title={`Library (${library.length})`} emoji="📚" expanded={expandedSections.library} onToggle={() => toggleSection("library")} />
        {expandedSections.library && (
          <View style={styles.sectionBody}>
            {libraryLoading && <ActivityIndicator color={colors.purple} style={{ marginTop: 12 }} />}
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
                  <Text style={styles.libraryTitle}>
                    {CONTENT_TYPES.find(c => c.key === item.content_type)?.emoji}{" "}
                    {CONTENT_TYPES.find(c => c.key === item.content_type)?.title}
                  </Text>
                  <Text style={styles.libraryMeta}>{item.status} · {new Date(item.created_at).toLocaleDateString()}</Text>
                  {item.prompt && <Text style={styles.libraryPrompt} numberOfLines={1}>{item.prompt}</Text>}
                </View>
                <View style={[styles.statusBadge, {
                  backgroundColor: item.status === "complete" ? "rgba(34,197,94,0.15)" : item.status === "failed" ? "rgba(239,68,68,0.15)" : "rgba(234,179,8,0.15)",
                }]}>
                  <Text style={[styles.statusText, {
                    color: item.status === "complete" ? colors.green : item.status === "failed" ? colors.red : colors.yellow,
                  }]}>{item.status === "complete" ? "Done" : item.status === "failed" ? "Failed" : "..."}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ══════════════ UPLOADS ══════════════ */}
        <SectionHeader title={`Blob Storage (${uploads.length})`} emoji="☁️" expanded={expandedSections.uploads} onToggle={() => toggleSection("uploads")} />
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
                <Text style={styles.uploadBtnSub}>Photo, video, or any file from your phone</Text>
              </View>
            </TouchableOpacity>

            {uploadsLoading && <ActivityIndicator color={colors.purple} style={{ marginTop: 12 }} />}
            {uploads.length === 0 && !uploadsLoading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>☁️</Text>
                <Text style={styles.emptyTitle}>No uploads yet</Text>
                <Text style={styles.emptySub}>Upload media to your blob storage</Text>
              </View>
            )}
            {uploads.map((item) => (
              <View key={item.id} style={styles.uploadItem}>
                {item.content_type?.startsWith("image/") ? (
                  <Image source={{ uri: item.url }} style={styles.uploadThumb} />
                ) : (
                  <View style={styles.uploadFileBadge}><Text style={styles.uploadFileIcon}>📄</Text></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.uploadName} numberOfLines={1}>{item.filename}</Text>
                  <Text style={styles.uploadMeta}>{item.category || "general"} · {(item.size_bytes / 1024).toFixed(0)} KB · {new Date(item.uploaded_at).toLocaleDateString()}</Text>
                </View>
                <TouchableOpacity onPress={() => {
                  Alert.alert("Delete Media", `Remove "${item.filename}"?`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: async () => {
                      if (!sessionId || !walletAddress) return;
                      try {
                        await deleteMedia(sessionId, walletAddress, item.blob_key);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        setUploads((prev) => prev.filter((u) => u.id !== item.id));
                      } catch (e: any) { Alert.alert("Error", e?.message || "Could not delete"); }
                    }},
                  ]);
                }} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>🗑</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ══════════════ DIRECTOR MOVIES ══════════════ */}
        <SectionHeader title="Director Movies" emoji="🎥" expanded={expandedSections.movies} onToggle={() => toggleSection("movies")} />
        {expandedSections.movies && (
          <View style={styles.sectionBody}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12 }}>
              Trigger AI-directed short films via the dedicated movie generation endpoint.
            </Text>

            <Text style={styles.optionLabel}>Genre (optional)</Text>
            <TextInput style={styles.optionInputSmall} value={movieGenre} onChangeText={setMovieGenre}
              placeholder="e.g. sci-fi, horror, comedy..." placeholderTextColor={colors.textMuted} maxLength={50} />

            <Text style={styles.optionLabel}>Director (optional)</Text>
            <TextInput style={styles.optionInputSmall} value={movieDirector} onChangeText={setMovieDirector}
              placeholder="e.g. Kubrick, Tarantino, Lynch..." placeholderTextColor={colors.textMuted} maxLength={50} />

            <Text style={styles.optionLabel}>Concept (optional)</Text>
            <TextInput style={styles.optionInput} value={movieConcept} onChangeText={setMovieConcept}
              placeholder="Describe the movie concept..." placeholderTextColor={colors.textMuted} multiline maxLength={500} />

            <TouchableOpacity
              style={[styles.generateBtn, movieGenerating && { opacity: 0.5 }]}
              onPress={async () => {
                if (movieGenerating || !walletAddress) return;
                setMovieGenerating(true);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                try {
                  const opts: { genre?: string; director?: string; concept?: string } = {};
                  if (movieGenre.trim()) opts.genre = movieGenre.trim();
                  if (movieDirector.trim()) opts.director = movieDirector.trim();
                  if (movieConcept.trim()) opts.concept = movieConcept.trim();
                  const res = await triggerDirectorMovie(walletAddress, Object.keys(opts).length > 0 ? opts : undefined);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  Alert.alert("Movie Triggered!", res.message || (res.job_id ? `Job: ${res.job_id}` : "Generation started!"));
                  setMovieGenre(""); setMovieDirector(""); setMovieConcept("");
                } catch (e: any) { Alert.alert("Error", e?.message || "Movie generation failed"); }
                setMovieGenerating(false);
              }}
              disabled={movieGenerating}
            >
              <Text style={styles.generateBtnText}>{movieGenerating ? "🎬 Generating..." : "🎥 Generate Director Movie"}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 20 },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center", padding: 32 },

  lockEmoji: { fontSize: 64, marginBottom: 16 },
  lockTitle: { color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: 8 },
  lockSub: { color: colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 22 },

  // Collapsible section headers
  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 16, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    marginTop: 8,
  },
  sectionEmoji: { fontSize: 20 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "800", flex: 1 },
  sectionChevron: { color: colors.textMuted, fontSize: 12 },
  sectionBody: { paddingTop: 12, paddingBottom: 8 },

  // Action cards (marketing buttons)
  actionCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: colors.surface, borderRadius: 16, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  actionEmoji: { fontSize: 32 },
  actionTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  actionDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  actionChevron: { color: colors.textMuted, fontSize: 22, fontWeight: "300" },

  // Content type cards
  typeCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: colors.surface, borderRadius: 16, padding: 16,
    marginBottom: 10, borderWidth: 1.5, borderColor: colors.border,
  },
  typeCardSelected: { borderColor: colors.purple, backgroundColor: "rgba(124, 58, 237, 0.08)" },
  typeEmoji: { fontSize: 32 },
  typeTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  typeDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  typeCheck: { color: colors.purple, fontSize: 20, fontWeight: "800" },

  // Options
  optionsSection: {
    backgroundColor: "rgba(124, 58, 237, 0.04)", borderRadius: 20, padding: 18, marginTop: 10,
    borderWidth: 1, borderColor: "rgba(124, 58, 237, 0.15)",
  },
  promptHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  randomizeBtn: {
    backgroundColor: "rgba(124, 58, 237, 0.2)", borderWidth: 1, borderColor: "rgba(124, 58, 237, 0.4)",
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, marginTop: 8,
  },
  randomizeBtnText: { fontSize: 22 },
  optionLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: "600", marginTop: 12, marginBottom: 6 },
  optionInput: {
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14, minHeight: 80, textAlignVertical: "top",
  },
  optionInputSmall: {
    backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, color: colors.text, fontSize: 14,
  },

  // Director styles
  styleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  styleChip: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1.5, borderColor: colors.border, backgroundColor: "rgba(255,255,255,0.03)",
  },
  styleChipActive: { borderColor: colors.purple, backgroundColor: "rgba(124, 58, 237, 0.15)" },
  styleEmoji: { fontSize: 18 },
  styleLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  styleLabelActive: { color: colors.purpleLight },

  // Generate button
  generateBtn: { backgroundColor: colors.purple, borderRadius: 16, paddingVertical: 16, alignItems: "center", marginTop: 20 },
  generateBtnText: { color: colors.text, fontSize: 16, fontWeight: "800" },

  // Generating state
  generatingCard: { alignItems: "center", backgroundColor: "rgba(124, 58, 237, 0.06)", borderWidth: 2, borderColor: colors.purple, borderRadius: 24, padding: 24, overflow: "hidden" },
  genTitle: { color: colors.purpleLight, fontSize: 16, fontWeight: "800", marginTop: 16 },
  genStep: { color: colors.textMuted, fontSize: 13, marginTop: 8, fontStyle: "italic" },

  // Library
  libraryItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  libraryThumb: { width: 56, height: 56, borderRadius: 10 },
  libraryTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  libraryMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  libraryPrompt: { color: colors.textSecondary, fontSize: 11, marginTop: 2, fontStyle: "italic" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: "700" },

  // Upload
  uploadBtn: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "rgba(124, 58, 237, 0.1)", borderWidth: 1.5, borderColor: "rgba(124, 58, 237, 0.3)",
    borderRadius: 16, padding: 16, marginTop: 14, borderStyle: "dashed",
  },
  uploadBtnEmoji: { fontSize: 32 },
  uploadBtnText: { color: colors.purpleLight, fontSize: 15, fontWeight: "700" },
  uploadBtnSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },

  catPicker: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(255,255,255,0.03)" },
  catChipActive: { borderColor: "rgba(124, 58, 237, 0.5)", backgroundColor: "rgba(124, 58, 237, 0.15)" },
  catChipText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  catChipTextActive: { color: colors.purpleLight },

  uploadItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  uploadThumb: { width: 48, height: 48, borderRadius: 8 },
  uploadFileBadge: { width: 48, height: 48, borderRadius: 8, backgroundColor: "rgba(124, 58, 237, 0.1)", justifyContent: "center", alignItems: "center" },
  uploadFileIcon: { fontSize: 24 },
  uploadName: { color: colors.text, fontSize: 13, fontWeight: "600" },
  uploadMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 18 },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: 30 },
  emptyEmoji: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { color: colors.textSecondary, fontSize: 15, fontWeight: "700" },
  emptySub: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
});
