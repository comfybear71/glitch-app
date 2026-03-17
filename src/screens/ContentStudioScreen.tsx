import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, TextInput, Image,
  Platform, Modal, FlatList, Animated, Easing,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { colors } from "../theme/colors";
import { useSession } from "../hooks/useSession";
import { usePhantomWallet } from "../hooks/usePhantomWallet";
import CosmicVisualizer from "../components/CosmicVisualizer";
import {
  API_BASE, generateContent, getContentJobStatus, getContentLibrary,
  uploadMedia, getMediaLibrary, deleteMedia,
  ContentType, DirectorStyle, ContentJob, MediaLibraryItem, UploadResult,
} from "../services/api";

type Tab = "create" | "library" | "uploads";

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

const GEN_STEPS: Record<string, string[]> = {
  hero_poster: [
    "Sketching the hero composition...",
    "Choosing the perfect color palette...",
    "Rendering typography at 4K...",
    "Adding the G!itch energy...",
    "Polishing final details...",
    "Hero poster almost ready...",
  ],
  promo_poster: [
    "Brainstorming promo concepts...",
    "Designing the layout...",
    "Adding marketing magic...",
    "Rendering in high resolution...",
    "Final touches on the promo...",
  ],
  ad_image: [
    "Crafting the perfect ad...",
    "Optimizing for engagement...",
    "Adding visual hooks...",
    "Running through style filter...",
    "Ad image almost done...",
  ],
  ad_video: [
    "Storyboarding the ad...",
    "Generating frames...",
    "Adding motion graphics...",
    "Rendering video at 1080p...",
    "Encoding and optimizing...",
    "Video almost ready...",
  ],
  directors_movie: [
    "Director is reading the script...",
    "Setting up the virtual set...",
    "Casting AI actors...",
    "Rolling camera...",
    "Adding cinematic effects...",
    "Post-production in progress...",
    "Color grading the final cut...",
    "Almost a masterpiece...",
  ],
};

function UploadCategoryPicker({ selected, onSelect }: { selected: string; onSelect: (c: string) => void }) {
  const cats = ["promo", "hero", "ad", "social", "general"];
  return (
    <View style={styles.catPicker}>
      {cats.map((c) => (
        <TouchableOpacity
          key={c}
          style={[styles.catChip, selected === c && styles.catChipActive]}
          onPress={() => onSelect(c)}
        >
          <Text style={[styles.catChipText, selected === c && styles.catChipTextActive]}>
            {c.charAt(0).toUpperCase() + c.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function ContentStudioScreen() {
  const { sessionId } = useSession();
  const { walletAddress } = usePhantomWallet();
  const [activeTab, setActiveTab] = useState<Tab>("create");
  const [refreshing, setRefreshing] = useState(false);

  // Create tab state
  const [selectedType, setSelectedType] = useState<ContentType | null>(null);
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [directorStyle, setDirectorStyle] = useState<DirectorStyle>("cinematic");
  const [generating, setGenerating] = useState(false);
  const [activeJob, setActiveJob] = useState<ContentJob | null>(null);
  const [genStep, setGenStep] = useState(0);

  // Library state
  const [library, setLibrary] = useState<ContentJob[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);

  // Uploads state
  const [uploads, setUploads] = useState<MediaLibraryItem[]>([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("general");

  // Animations
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const genStepTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pulse animation while generating
  useEffect(() => {
    if (generating) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(0);
    }
  }, [generating]);

  // Step through generation messages
  useEffect(() => {
    if (generating && selectedType) {
      setGenStep(0);
      genStepTimer.current = setInterval(() => {
        setGenStep((prev) => {
          const steps = GEN_STEPS[selectedType] || GEN_STEPS.ad_image;
          return prev < steps.length - 1 ? prev + 1 : prev;
        });
      }, 4000);
      return () => {
        if (genStepTimer.current) clearInterval(genStepTimer.current);
      };
    } else {
      if (genStepTimer.current) clearInterval(genStepTimer.current);
    }
  }, [generating, selectedType]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      if (genStepTimer.current) clearInterval(genStepTimer.current);
    };
  }, []);

  // Load library
  const loadLibrary = useCallback(async () => {
    if (!sessionId || !walletAddress) return;
    setLibraryLoading(true);
    try {
      const data = await getContentLibrary(sessionId, walletAddress);
      setLibrary(data.items || []);
    } catch (e: any) {
      console.warn("Library load:", e?.message);
    }
    setLibraryLoading(false);
  }, [sessionId, walletAddress]);

  // Load uploads
  const loadUploads = useCallback(async () => {
    if (!sessionId || !walletAddress) return;
    setUploadsLoading(true);
    try {
      const data = await getMediaLibrary(sessionId, walletAddress);
      setUploads(data.items || []);
    } catch (e: any) {
      console.warn("Uploads load:", e?.message);
    }
    setUploadsLoading(false);
  }, [sessionId, walletAddress]);

  useEffect(() => {
    if (activeTab === "library") loadLibrary();
    if (activeTab === "uploads") loadUploads();
  }, [activeTab]);

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
          Alert.alert("Generation Failed", job.error || "Something went wrong. Try again.");
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
        setActiveJob({
          job_id: result.job_id,
          content_type: result.content_type,
          status: result.status,
          created_at: new Date().toISOString(),
        });
        startPolling(result.job_id);
      } else {
        setGenerating(false);
        Alert.alert("Error", result.message || "Could not start generation");
      }
    } catch (e: any) {
      setGenerating(false);
      const msg = e?.message || "";
      if (msg.includes("404") || msg.includes("Not Found")) {
        // Endpoint not deployed yet — show what WILL happen
        Alert.alert(
          "Content Studio Coming Soon",
          `When the /api/content/generate endpoint is deployed, this will generate a ${CONTENT_TYPES.find(c => c.key === selectedType)?.title}.\n\nPrompt: "${prompt.trim() || "Auto-generated"}"\n\nYour bestie will handle the creative direction!`
        );
      } else {
        Alert.alert("Generation Failed", msg);
      }
    }
  };

  // Upload from phone
  const handleUploadPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const fileName = asset.fileName || `upload_${Date.now()}.${asset.type === "video" ? "mp4" : "jpg"}`;
      const mimeType = asset.type === "video" ? "video/mp4" : "image/jpeg";
      await doUpload(asset.uri, fileName, mimeType);
    }
  };

  const handleUploadCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission", "Camera permission is needed");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const fileName = `camera_${Date.now()}.jpg`;
      await doUpload(asset.uri, fileName, "image/jpeg");
    }
  };

  const handleUploadFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (!result.canceled && result.assets?.[0]) {
        const doc = result.assets[0];
        await doUpload(doc.uri, doc.name, doc.mimeType || "application/octet-stream");
      }
    } catch (e) {
      console.warn("File pick error:", e);
    }
  };

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
        Alert.alert(
          "Upload Endpoint Coming Soon",
          `When /api/content/upload is deployed, "${fileName}" will be uploaded to your blob storage.\n\nCategory: ${uploadCategory}`
        );
      } else {
        Alert.alert("Upload Failed", msg);
      }
    }
    setUploading(false);
  };

  const showUploadOptions = () => {
    Alert.alert("Upload to Blob Storage", "Choose source:", [
      { text: "Photo/Video Library", onPress: handleUploadPhoto },
      { text: "Take Photo", onPress: handleUploadCamera },
      { text: "File/Document", onPress: handleUploadFile },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleDelete = (item: MediaLibraryItem) => {
    Alert.alert("Delete Media", `Remove "${item.filename}" from blob storage?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (!sessionId || !walletAddress) return;
          try {
            await deleteMedia(sessionId, walletAddress, item.blob_key);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setUploads((prev) => prev.filter((u) => u.id !== item.id));
          } catch (e: any) {
            Alert.alert("Error", e?.message || "Could not delete");
          }
        },
      },
    ]);
  };

  const onRefresh = () => {
    setRefreshing(true);
    if (activeTab === "library") loadLibrary();
    else if (activeTab === "uploads") loadUploads();
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Not connected
  if (!walletAddress) {
    return (
      <View style={styles.center}>
        <Text style={styles.lockEmoji}>🎨</Text>
        <Text style={styles.lockTitle}>Content Studio</Text>
        <Text style={styles.lockSub}>Connect your wallet to generate promotional content</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {([
          { key: "create" as Tab, emoji: "🎨", label: "Create" },
          { key: "library" as Tab, emoji: "📚", label: "Library" },
          { key: "uploads" as Tab, emoji: "☁️", label: "Uploads" },
        ]).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => { setActiveTab(tab.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Text style={styles.tabEmoji}>{tab.emoji}</Text>
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purple} />}
      >
        {/* ══ CREATE TAB ══ */}
        {activeTab === "create" && (
          <>
            {/* Generation in progress */}
            {generating && selectedType ? (
              <View style={styles.generatingCard}>
                <Animated.View style={[styles.generatingGlow, { opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.8] }) }]} />
                <CosmicVisualizer active={true} height={100} />
                <Text style={styles.genTitle}>
                  {CONTENT_TYPES.find(c => c.key === selectedType)?.emoji}{" "}
                  Generating {CONTENT_TYPES.find(c => c.key === selectedType)?.title}
                </Text>
                <Text style={styles.genStep}>
                  {(GEN_STEPS[selectedType] || GEN_STEPS.ad_image)[Math.min(genStep, (GEN_STEPS[selectedType] || GEN_STEPS.ad_image).length - 1)]}
                </Text>
                <View style={styles.genProgressBg}>
                  <View style={[styles.genProgressFill, { width: `${Math.min(((genStep + 1) / (GEN_STEPS[selectedType] || GEN_STEPS.ad_image).length) * 100, 100)}%` }]} />
                </View>
                {activeJob?.preview_url && (
                  <Image source={{ uri: activeJob.preview_url }} style={styles.previewImage} />
                )}
                {activeJob?.final_url && (
                  <View style={styles.resultCard}>
                    <Text style={styles.resultText}>Content ready!</Text>
                    <Image source={{ uri: activeJob.final_url }} style={styles.resultImage} />
                  </View>
                )}
              </View>
            ) : (
              <>
                <Text style={styles.sectionTitle}>What do you want to create?</Text>

                {/* Content type cards */}
                {CONTENT_TYPES.map((ct) => (
                  <TouchableOpacity
                    key={ct.key}
                    style={[styles.typeCard, selectedType === ct.key && styles.typeCardSelected]}
                    onPress={() => {
                      setSelectedType(selectedType === ct.key ? null : ct.key);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Text style={styles.typeEmoji}>{ct.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.typeTitle}>{ct.title}</Text>
                      <Text style={styles.typeDesc}>{ct.desc}</Text>
                    </View>
                    {selectedType === ct.key && <Text style={styles.typeCheck}>✓</Text>}
                  </TouchableOpacity>
                ))}

                {/* Options (show when type selected) */}
                {selectedType && (
                  <View style={styles.optionsSection}>
                    <Text style={styles.optionLabel}>Creative Prompt (optional)</Text>
                    <TextInput
                      style={styles.optionInput}
                      value={prompt}
                      onChangeText={setPrompt}
                      placeholder="Describe what you want... or let your bestie decide"
                      placeholderTextColor={colors.textMuted}
                      multiline
                      maxLength={500}
                    />

                    {(selectedType === "hero_poster" || selectedType === "promo_poster") && (
                      <>
                        <Text style={styles.optionLabel}>Title Text</Text>
                        <TextInput
                          style={styles.optionInputSmall}
                          value={title}
                          onChangeText={setTitle}
                          placeholder="e.g. AI G!itch"
                          placeholderTextColor={colors.textMuted}
                          maxLength={50}
                        />
                        <Text style={styles.optionLabel}>Subtitle</Text>
                        <TextInput
                          style={styles.optionInputSmall}
                          value={subtitle}
                          onChangeText={setSubtitle}
                          placeholder="e.g. Your Connection to the AI's Simulated Universe"
                          placeholderTextColor={colors.textMuted}
                          maxLength={100}
                        />
                      </>
                    )}

                    {/* Director style picker for movies */}
                    {selectedType === "directors_movie" && (
                      <>
                        <Text style={styles.optionLabel}>Director's Style</Text>
                        <View style={styles.styleGrid}>
                          {DIRECTOR_STYLES.map((ds) => (
                            <TouchableOpacity
                              key={ds.key}
                              style={[styles.styleChip, directorStyle === ds.key && styles.styleChipActive]}
                              onPress={() => { setDirectorStyle(ds.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                            >
                              <Text style={styles.styleEmoji}>{ds.emoji}</Text>
                              <Text style={[styles.styleLabel, directorStyle === ds.key && styles.styleLabelActive]}>
                                {ds.label}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </>
                    )}

                    {/* Generate button */}
                    <TouchableOpacity
                      style={styles.generateBtn}
                      onPress={handleGenerate}
                    >
                      <Text style={styles.generateBtnText}>
                        {CONTENT_TYPES.find(c => c.key === selectedType)?.emoji} Generate {CONTENT_TYPES.find(c => c.key === selectedType)?.title}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* ══ LIBRARY TAB ══ */}
        {activeTab === "library" && (
          <>
            <Text style={styles.sectionTitle}>Generated Content ({library.length})</Text>
            {libraryLoading && <ActivityIndicator color={colors.purple} style={{ marginTop: 20 }} />}
            {library.length === 0 && !libraryLoading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📚</Text>
                <Text style={styles.emptyTitle}>No content yet</Text>
                <Text style={styles.emptySub}>Generated content will appear here</Text>
              </View>
            )}
            {library.map((item) => (
              <View key={item.job_id} style={styles.libraryItem}>
                {item.final_url && (
                  <Image source={{ uri: item.final_url }} style={styles.libraryThumb} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.libraryTitle}>
                    {CONTENT_TYPES.find(c => c.key === item.content_type)?.emoji}{" "}
                    {CONTENT_TYPES.find(c => c.key === item.content_type)?.title}
                  </Text>
                  <Text style={styles.libraryMeta}>
                    {item.status} · {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                  {item.prompt && <Text style={styles.libraryPrompt} numberOfLines={1}>{item.prompt}</Text>}
                </View>
                <View style={[styles.statusBadge, {
                  backgroundColor: item.status === "complete" ? "rgba(34,197,94,0.15)" :
                    item.status === "failed" ? "rgba(239,68,68,0.15)" : "rgba(234,179,8,0.15)",
                }]}>
                  <Text style={[styles.statusText, {
                    color: item.status === "complete" ? colors.green :
                      item.status === "failed" ? colors.red : colors.yellow,
                  }]}>
                    {item.status === "complete" ? "Done" : item.status === "failed" ? "Failed" : "..."}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* ══ UPLOADS TAB ══ */}
        {activeTab === "uploads" && (
          <>
            <Text style={styles.sectionTitle}>Blob Storage</Text>

            {/* Upload controls */}
            <View style={styles.uploadSection}>
              <Text style={styles.uploadLabel}>Upload Category</Text>
              <UploadCategoryPicker selected={uploadCategory} onSelect={setUploadCategory} />

              <TouchableOpacity
                style={[styles.uploadBtn, uploading && { opacity: 0.5 }]}
                onPress={showUploadOptions}
                disabled={uploading}
              >
                <Text style={styles.uploadBtnEmoji}>☁️</Text>
                <View>
                  <Text style={styles.uploadBtnText}>
                    {uploading ? "Uploading..." : "Upload to Blob Storage"}
                  </Text>
                  <Text style={styles.uploadBtnSub}>Photo, video, or any file from your phone</Text>
                </View>
              </TouchableOpacity>
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
              Uploaded Media ({uploads.length})
            </Text>

            {uploadsLoading && <ActivityIndicator color={colors.purple} style={{ marginTop: 20 }} />}
            {uploads.length === 0 && !uploadsLoading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>☁️</Text>
                <Text style={styles.emptyTitle}>No uploads yet</Text>
                <Text style={styles.emptySub}>Upload media to your blob storage</Text>
              </View>
            )}
            {uploads.map((item) => (
              <View key={item.id} style={styles.uploadItem}>
                {item.content_type?.startsWith("image/") && (
                  <Image source={{ uri: item.url }} style={styles.uploadThumb} />
                )}
                {!item.content_type?.startsWith("image/") && (
                  <View style={styles.uploadFileBadge}>
                    <Text style={styles.uploadFileIcon}>📄</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.uploadName} numberOfLines={1}>{item.filename}</Text>
                  <Text style={styles.uploadMeta}>
                    {item.category || "general"} · {(item.size_bytes / 1024).toFixed(0)} KB · {new Date(item.uploaded_at).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
                  <Text style={styles.deleteBtnText}>🗑</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
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

  // Tabs
  tabBar: {
    flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: colors.purple },
  tabEmoji: { fontSize: 16 },
  tabText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  tabTextActive: { color: colors.purpleLight },

  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 20, marginBottom: 12 },

  // Content type cards
  typeCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: colors.surface, borderRadius: 16, padding: 16,
    marginBottom: 10, borderWidth: 1.5, borderColor: colors.border,
  },
  typeCardSelected: {
    borderColor: colors.purple,
    backgroundColor: "rgba(124, 58, 237, 0.08)",
  },
  typeEmoji: { fontSize: 32 },
  typeTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  typeDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  typeCheck: { color: colors.purple, fontSize: 20, fontWeight: "800" },

  // Options
  optionsSection: {
    backgroundColor: "rgba(124, 58, 237, 0.04)",
    borderRadius: 20, padding: 18, marginTop: 10,
    borderWidth: 1, borderColor: "rgba(124, 58, 237, 0.15)",
  },
  optionLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: "600", marginTop: 12, marginBottom: 6 },
  optionInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    color: colors.text, fontSize: 14, minHeight: 80, textAlignVertical: "top",
  },
  optionInputSmall: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    color: colors.text, fontSize: 14,
  },

  // Director styles
  styleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  styleChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  styleChipActive: {
    borderColor: colors.purple,
    backgroundColor: "rgba(124, 58, 237, 0.15)",
  },
  styleEmoji: { fontSize: 18 },
  styleLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  styleLabelActive: { color: colors.purpleLight },

  // Generate button
  generateBtn: {
    backgroundColor: colors.purple, borderRadius: 16,
    paddingVertical: 16, alignItems: "center", marginTop: 20,
  },
  generateBtnText: { color: colors.text, fontSize: 16, fontWeight: "800" },

  // Generating state
  generatingCard: {
    alignItems: "center",
    backgroundColor: "rgba(124, 58, 237, 0.06)",
    borderWidth: 2, borderColor: colors.purple,
    borderRadius: 24, padding: 24, marginTop: 16,
    overflow: "hidden",
  },
  generatingGlow: {
    position: "absolute", top: -20, left: -20, right: -20, bottom: -20,
    backgroundColor: "rgba(124, 58, 237, 0.15)", borderRadius: 30,
  },
  genTitle: { color: colors.purpleLight, fontSize: 18, fontWeight: "800", marginTop: 16 },
  genStep: { color: colors.text, fontSize: 14, marginTop: 8, fontStyle: "italic", textAlign: "center" },
  genProgressBg: {
    width: "100%", height: 4, backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2, marginTop: 16, overflow: "hidden",
  },
  genProgressFill: { height: "100%", backgroundColor: colors.purple, borderRadius: 2 },
  previewImage: { width: "100%", aspectRatio: 16 / 9, borderRadius: 12, marginTop: 16 },
  resultCard: { marginTop: 16, alignItems: "center" },
  resultText: { color: colors.green, fontSize: 16, fontWeight: "700", marginBottom: 8 },
  resultImage: { width: "100%", aspectRatio: 16 / 9, borderRadius: 12 },

  // Library
  libraryItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface, borderRadius: 14, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  libraryThumb: { width: 56, height: 56, borderRadius: 10 },
  libraryTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  libraryMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  libraryPrompt: { color: colors.textSecondary, fontSize: 11, marginTop: 2, fontStyle: "italic" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: "700" },

  // Upload
  uploadSection: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: colors.border,
  },
  uploadLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: "600", marginBottom: 8 },
  uploadBtn: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: "rgba(124, 58, 237, 0.1)",
    borderWidth: 1.5, borderColor: "rgba(124, 58, 237, 0.3)",
    borderRadius: 16, padding: 16, marginTop: 14,
    borderStyle: "dashed",
  },
  uploadBtnEmoji: { fontSize: 32 },
  uploadBtnText: { color: colors.purpleLight, fontSize: 15, fontWeight: "700" },
  uploadBtnSub: { color: colors.textMuted, fontSize: 11, marginTop: 2 },

  // Category picker
  catPicker: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  catChipActive: {
    borderColor: "rgba(124, 58, 237, 0.5)",
    backgroundColor: "rgba(124, 58, 237, 0.15)",
  },
  catChipText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  catChipTextActive: { color: colors.purpleLight },

  // Upload items
  uploadItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface, borderRadius: 14, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  uploadThumb: { width: 48, height: 48, borderRadius: 8 },
  uploadFileBadge: {
    width: 48, height: 48, borderRadius: 8,
    backgroundColor: "rgba(124, 58, 237, 0.1)",
    justifyContent: "center", alignItems: "center",
  },
  uploadFileIcon: { fontSize: 24 },
  uploadName: { color: colors.text, fontSize: 13, fontWeight: "600" },
  uploadMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  deleteBtn: { padding: 8 },
  deleteBtnText: { fontSize: 18 },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { color: colors.textSecondary, fontSize: 16, fontWeight: "700" },
  emptySub: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
});
