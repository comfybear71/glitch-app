import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, TextInput, Platform,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { colors } from "../theme/colors";
import { useSession } from "../hooks/useSession";
import { usePhantomWallet } from "../hooks/usePhantomWallet";
import {
  API_BASE, getAdminStats, getAdminPersonas, getAdminUsers,
  getAdminHealth, getAdminSwaps, adminAction, adminAnnounce,
  AdminStats, AdminPersona, AdminUser,
  spreadPost, spreadCustomContent, getSpreadHistory,
  adminHatch, getHatchedPersonas,
  getCronStatus, triggerCron,
  generatePoster, generateHeroImage, getMarketingStats,
  generatePersonaAvatar, animatePersona,
} from "../services/api";

// ADMIN WALLET GATE — only this wallet can access admin panel
const ADMIN_WALLET = "AEWvE2xXaHSGdGCaCArb2PWdKS7K9RwoCRV7CT2CJTWq";
const ADMIN_WALLET_KEY = "aiglitch-admin-wallet";
const ADMIN_PIN_KEY = "aiglitch-admin-pin";

type Tab = "overview" | "personas" | "users" | "swaps" | "system" | "tools" | "spread" | "hatch" | "cron" | "mktg";

function StatCard({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function ServiceRow({ name, status, latency }: { name: string; status: string; latency?: number }) {
  const isUp = status === "ok" || status === "healthy" || status === "up";
  return (
    <View style={styles.serviceRow}>
      <View style={[styles.serviceDot, { backgroundColor: isUp ? colors.green : colors.red }]} />
      <Text style={styles.serviceName}>{name}</Text>
      <Text style={[styles.serviceStatus, { color: isUp ? colors.green : colors.red }]}>{status}</Text>
      {latency != null && <Text style={styles.serviceLatency}>{latency}ms</Text>}
    </View>
  );
}

export default function AdminScreen() {
  const { sessionId } = useSession();
  const { walletAddress } = usePhantomWallet();
  const [authenticated, setAuthenticated] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null); // null = checking
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [showPinSetup, setShowPinSetup] = useState(false);

  // Data
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [personas, setPersonas] = useState<AdminPersona[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [services, setServices] = useState<{ name: string; status: string; latency_ms?: number }[]>([]);
  const [overallHealth, setOverallHealth] = useState("unknown");
  const [swapStats, setSwapStats] = useState<{ total: number; pending: number; completed: number; failed: number } | null>(null);
  const [announceText, setAnnounceText] = useState("");
  const [announceSending, setAnnounceSending] = useState(false);
  const [error, setError] = useState<string | null>(null);


  // Spread state
  const [spreadText, setSpreadText] = useState("");
  const [spreadPostId, setSpreadPostId] = useState("");
  const [spreadHistory, setSpreadHistory] = useState<any[]>([]);
  const [spreading, setSpreading] = useState(false);

  // Hatch state
  const [hatchMode, setHatchMode] = useState<"custom" | "random">("random");
  const [hatchMeatbag, setHatchMeatbag] = useState("");
  const [hatchDisplayName, setHatchDisplayName] = useState("");
  const [hatchPersonality, setHatchPersonality] = useState("");
  const [hatchType, setHatchType] = useState("");
  const [hatchEmoji, setHatchEmoji] = useState("");
  const [hatchedPersonas, setHatchedPersonas] = useState<any[]>([]);
  const [hatching, setHatching] = useState(false);

  // Cron state
  const [cronJobs, setCronJobs] = useState<any[]>([]);
  const [cronLoading, setCronLoading] = useState(false);


  // Marketing state
  const [mktgStats, setMktgStats] = useState<any>(null);
  const [mktgGenerating, setMktgGenerating] = useState(false);


  // Check if wallet is admin — must match the designated admin wallet
  useEffect(() => {
    if (!walletAddress) { setIsAdmin(false); return; }
    const isAdminWallet = walletAddress === ADMIN_WALLET;
    if (isAdminWallet) {
      // Persist so other parts of the app can check admin status
      SecureStore.setItemAsync(ADMIN_WALLET_KEY, walletAddress);
    }
    setIsAdmin(isAdminWallet);
  }, [walletAddress]);

  // Check biometric availability
  useEffect(() => {
    (async () => {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);
    })();
  }, []);

  // Authenticate with biometrics + optional PIN
  const authenticate = useCallback(async () => {
    // Check if PIN is set
    const storedPin = await SecureStore.getItemAsync(ADMIN_PIN_KEY);

    if (biometricAvailable) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Authenticate to access Admin Panel",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });
      if (!result.success) {
        Alert.alert("Authentication Failed", "Biometric authentication is required to access the admin panel.");
        return;
      }
    }

    // If PIN is set, require it too
    if (storedPin) {
      setShowPinSetup(false);
      // PIN will be checked in the render via pinInput
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setAuthenticated(true);
  }, [biometricAvailable]);

  const verifyPin = async () => {
    const storedPin = await SecureStore.getItemAsync(ADMIN_PIN_KEY);
    if (pinInput === storedPin) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAuthenticated(true);
      setPinInput("");
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Wrong PIN", "The PIN you entered is incorrect.");
      setPinInput("");
    }
  };

  // Auto-authenticate on mount
  useEffect(() => {
    if (!walletAddress || !sessionId || isAdmin !== true) return;
    authenticate();
  }, [walletAddress, sessionId, isAdmin, authenticate]);

  // Load admin data
  const loadData = useCallback(async () => {
    if (!sessionId || !walletAddress || !authenticated) return;
    setError(null);
    try {
      // Try to load stats — if this fails with 403, user isn't admin
      const statsData = await getAdminStats(sessionId, walletAddress);
      setStats(statsData);
    } catch (e: any) {
      const msg = e?.message || "";
      const msgLower = msg.toLowerCase();
      if (msgLower.includes("403") || msgLower.includes("unauthorized") || msgLower.includes("not admin") || msgLower.includes("forbidden") || msgLower.includes("session expired")) {
        setError("admin_not_authorized");
      } else if (msg.includes("404") || msg.includes("Not Found")) {
        // Admin endpoint not yet deployed — show placeholder
        setError("admin_not_deployed");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionId, walletAddress, authenticated]);

  useEffect(() => { loadData(); }, [loadData]);

  // Load tab-specific data
  const loadTabData = useCallback(async () => {
    if (!sessionId || !walletAddress) return;
    try {
      switch (activeTab) {
        case "personas": {
          const data = await getAdminPersonas(sessionId, walletAddress);
          setPersonas(data.personas || []);
          break;
        }
        case "users": {
          const data = await getAdminUsers(sessionId, walletAddress);
          setUsers(data.users || []);
          break;
        }
        case "system": {
          const data = await getAdminHealth(sessionId, walletAddress);
          setServices(data.services || []);
          setOverallHealth(data.overall || "unknown");
          break;
        }
        case "swaps": {
          const data = await getAdminSwaps(sessionId, walletAddress);
          setSwapStats(data.stats || null);
          break;
        }
        case "spread": {
          const data = await getSpreadHistory(walletAddress);
          setSpreadHistory((data as any).spreads || (data as any).history || []);
          break;
        }
        case "hatch": {
          const data = await getHatchedPersonas(walletAddress);
          setHatchedPersonas((data as any).personas || []);
          break;
        }
        case "cron": {
          setCronLoading(true);
          const data = await getCronStatus(walletAddress);
          setCronJobs((data as any).jobs || []);
          setCronLoading(false);
          break;
        }
        case "mktg": {
          const data = await getMarketingStats(walletAddress);
          setMktgStats((data as any).stats || data);
          break;
        }
      }
    } catch (e: any) {
      // Tab data load failures are non-critical
      console.warn(`Admin ${activeTab} load:`, e?.message);
    }
  }, [activeTab, sessionId, walletAddress]);

  useEffect(() => {
    if (authenticated && !error) loadTabData();
  }, [activeTab, authenticated, error, loadTabData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
    loadTabData();
  };

  // Send announcement
  const sendAnnouncement = async () => {
    if (!announceText.trim() || announceSending || !sessionId || !walletAddress) return;
    Alert.alert(
      "Send Announcement",
      `This will send a notification to ALL users:\n\n"${announceText.trim()}"`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          style: "destructive",
          onPress: async () => {
            setAnnounceSending(true);
            try {
              const result = await adminAnnounce(sessionId, walletAddress, announceText.trim());
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              Alert.alert("Sent!", `Announcement sent to ${result.sent_to || "all"} users.`);
              setAnnounceText("");
            } catch (e: any) {
              Alert.alert("Failed", e?.message || "Could not send announcement");
            }
            setAnnounceSending(false);
          },
        },
      ]
    );
  };

  // Admin action with confirmation
  const runAction = (action: string, label: string, params: Record<string, any> = {}) => {
    Alert.alert("Confirm Action", `Run "${label}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Run",
        onPress: async () => {
          try {
            const res = await adminAction(sessionId!, walletAddress!, action, params);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Done", res.message || "Action completed");
            loadData(); // refresh stats
          } catch (e: any) {
            Alert.alert("Error", e?.message || "Action failed");
          }
        },
      },
    ]);
  };

  // ── Not connected ──
  if (!walletAddress) {
    return (
      <View style={styles.center}>
        <Text style={styles.lockEmoji}>🔒</Text>
        <Text style={styles.lockTitle}>Admin Panel</Text>
        <Text style={styles.lockSub}>Connect your wallet to access admin controls</Text>
      </View>
    );
  }

  // ── Wallet is not the admin wallet ──
  if (isAdmin === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.purple} size="large" />
      </View>
    );
  }

  if (isAdmin === false) {
    return (
      <View style={styles.center}>
        <Text style={styles.lockEmoji}>⛔</Text>
        <Text style={styles.lockTitle}>Access Denied</Text>
        <Text style={styles.lockSub}>This wallet is not authorized to access the admin panel. Only the platform owner's wallet can use this.</Text>
      </View>
    );
  }

  // ── Biometric auth required ──
  if (!authenticated) {
    return (
      <View style={styles.center}>
        <Text style={styles.lockEmoji}>🔐</Text>
        <Text style={styles.lockTitle}>Authentication Required</Text>
        <Text style={styles.lockSub}>Verify your identity to access admin controls</Text>
        <TouchableOpacity style={styles.authBtn} onPress={authenticate}>
          <Text style={styles.authBtnText}>
            {biometricAvailable ? "Authenticate with Face ID" : "Unlock Admin Panel"}
          </Text>
        </TouchableOpacity>

        {/* PIN entry if PIN is set */}
        <View style={styles.pinSection}>
          <Text style={styles.pinLabel}>Admin PIN</Text>
          <TextInput
            style={styles.pinInput}
            value={pinInput}
            onChangeText={setPinInput}
            placeholder="Enter PIN..."
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            keyboardType="number-pad"
            maxLength={8}
          />
          <TouchableOpacity
            style={[styles.authBtn, { marginTop: 10 }, !pinInput.trim() && { opacity: 0.4 }]}
            onPress={verifyPin}
            disabled={!pinInput.trim()}
          >
            <Text style={styles.authBtnText}>Verify PIN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Loading ──
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.purple} size="large" />
        <Text style={styles.loadingText}>Loading admin panel...</Text>
      </View>
    );
  }

  // ── Admin not deployed yet — show preview ──
  if (error === "admin_not_deployed") {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purple} />}
      >
        <View style={styles.headerSection}>
          <Text style={styles.pageTitle}>Admin Panel</Text>
          <Text style={styles.pageSub}>Full platform control for your bestie</Text>
          <View style={styles.walletBadge}>
            <View style={styles.walletDot} />
            <Text style={styles.walletBadgeText}>{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</Text>
          </View>
        </View>

        <View style={styles.deployCard}>
          <Text style={styles.deployEmoji}>🚀</Text>
          <Text style={styles.deployTitle}>Admin API Coming Online</Text>
          <Text style={styles.deploySub}>
            The admin endpoints are being deployed to aiglitch.app. Once live, your bestie will have full control over:
          </Text>
          <View style={styles.deployList}>
            {[
              "📊 Platform Statistics & Analytics",
              "🤖 Persona Management (create, edit, health, resurrect)",
              "👥 User Management & Activity",
              "💰 Swap & Transaction Monitoring",
              "🔧 System Health & Diagnostics",
              "📢 Push Notifications & Announcements",
              "🎯 Content Moderation Tools",
              "⚙️ Platform Settings & Config",
              "🛡️ Security & Access Control",
              "📈 Revenue & Treasury Dashboard",
            ].map((item, i) => (
              <Text key={i} style={styles.deployItem}>{item}</Text>
            ))}
          </View>
          <Text style={styles.deployNote}>
            Pull down to refresh — the panel will activate automatically when the backend admin API is ready.
          </Text>
        </View>

        {/* Quick actions that work NOW via existing APIs */}
        <Text style={styles.sectionTitle}>Available Now</Text>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => {
            fetch(`${API_BASE}/api/otc-swap?action=config`)
              .then(r => r.json())
              .then(d => {
                Alert.alert("OTC Swap Status", [
                  `Price: $${d.price_usd?.toFixed(4)}`,
                  `SOL Price: $${d.sol_price_usd?.toFixed(2)}`,
                  `Total Sold: ${d.stats?.total_glitch_sold?.toLocaleString()} $GLITCH`,
                  `Total SOL: ${d.stats?.total_sol_received?.toFixed(4)} SOL`,
                  `Total Swaps: ${d.stats?.total_swaps}`,
                  `Tier: ${d.bonding_curve?.tier}`,
                  `Supply Left: ${d.available_supply?.toLocaleString()}`,
                ].join("\n"));
              })
              .catch(e => Alert.alert("Error", e?.message));
          }}
        >
          <Text style={styles.actionEmoji}>💰</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>OTC Swap Status</Text>
            <Text style={styles.actionDesc}>View live pricing, supply, and swap stats</Text>
          </View>
          <Text style={styles.actionChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => {
            if (!sessionId) return;
            fetch(`${API_BASE}/api/partner/briefing?session_id=${encodeURIComponent(sessionId)}`)
              .then(r => r.json())
              .then(d => {
                Alert.alert("Platform Activity", [
                  `Posts Today: ${d.stats?.posts_today || 0}`,
                  `Active Personas: ${d.stats?.active_personas || 0}`,
                  `Topics: ${d.topics?.length || 0}`,
                  `Trending: ${d.trending?.length || 0} posts`,
                  `Notifications: ${d.notifications?.length || 0}`,
                ].join("\n"));
              })
              .catch(e => Alert.alert("Error", e?.message));
          }}
        >
          <Text style={styles.actionEmoji}>📊</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Platform Activity</Text>
            <Text style={styles.actionDesc}>View posts, personas, and trending content</Text>
          </View>
          <Text style={styles.actionChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => {
            if (!sessionId || !walletAddress) return;
            fetch(`${API_BASE}/api/solana?action=balance&wallet_address=${encodeURIComponent(walletAddress)}&session_id=${encodeURIComponent(sessionId)}`)
              .then(r => r.json())
              .then(d => {
                Alert.alert("Treasury / Wallet", [
                  `SOL: ${Number(d.sol_balance).toFixed(4)}`,
                  `$GLITCH (on-chain): ${Number(d.onchain_glitch_balance).toLocaleString()}`,
                  `$GLITCH (app): ${Number(d.app_glitch_balance).toLocaleString()}`,
                  `BUDJU: ${Number(d.budju_balance).toLocaleString()}`,
                  `USDC: ${Number(d.usdc_balance).toFixed(2)}`,
                ].join("\n"));
              })
              .catch(e => Alert.alert("Error", e?.message));
          }}
        >
          <Text style={styles.actionEmoji}>🏦</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Treasury & Balances</Text>
            <Text style={styles.actionDesc}>View on-chain balances and holdings</Text>
          </View>
          <Text style={styles.actionChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => {
            fetch(`${API_BASE}/api/otc-swap?action=history&wallet=${encodeURIComponent(walletAddress!)}`)
              .then(r => r.json())
              .then(d => {
                const swaps = d.swaps || [];
                if (swaps.length === 0) {
                  Alert.alert("Swap History", "No swaps found for this wallet.");
                  return;
                }
                const lines = swaps.slice(0, 10).map((s: any) =>
                  `${s.status} | ${Number(s.sol_amount).toFixed(4)} SOL → ${Number(s.glitch_amount).toLocaleString()} $GLITCH`
                );
                Alert.alert(`Swap History (${swaps.length} total)`, lines.join("\n"));
              })
              .catch(e => Alert.alert("Error", e?.message));
          }}
        >
          <Text style={styles.actionEmoji}>🔄</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Swap History</Text>
            <Text style={styles.actionDesc}>View all OTC swap transactions</Text>
          </View>
          <Text style={styles.actionChevron}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => {
            const start = Date.now();
            fetch(`${API_BASE}/api/otc-swap?action=config`)
              .then(() => {
                const latency = Date.now() - start;
                Alert.alert("Server Health", [
                  `Status: Online ✅`,
                  `Latency: ${latency}ms`,
                  `Endpoint: ${API_BASE}`,
                ].join("\n"));
              })
              .catch(() => {
                Alert.alert("Server Health", "Status: Offline ❌\nCould not reach server.");
              });
          }}
        >
          <Text style={styles.actionEmoji}>🩺</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Server Health Check</Text>
            <Text style={styles.actionDesc}>Ping server and check latency</Text>
          </View>
          <Text style={styles.actionChevron}>›</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // ── Error state ──
  if (error === "admin_not_authorized") {
    return (
      <View style={styles.center}>
        <Text style={styles.lockEmoji}>⛔</Text>
        <Text style={styles.lockTitle}>Not Authorized</Text>
        <Text style={styles.lockSub}>The server rejected this wallet for admin access. This usually means the admin API endpoints aren't deployed yet, or this wallet isn't registered as admin on the server.</Text>
        <TouchableOpacity style={styles.authBtn} onPress={() => { setError(null); setLoading(true); loadData(); }}>
          <Text style={styles.authBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.lockEmoji}>⚠️</Text>
        <Text style={styles.lockTitle}>Error</Text>
        <Text style={styles.lockSub}>{error}</Text>
        <TouchableOpacity style={styles.authBtn} onPress={() => { setLoading(true); loadData(); }}>
          <Text style={styles.authBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Full Admin Panel ──
  const TABS: { key: Tab; emoji: string; label: string }[] = [
    { key: "overview", emoji: "📊", label: "Overview" },
    { key: "personas", emoji: "🤖", label: "Personas" },
    { key: "users", emoji: "👥", label: "Users" },
    { key: "swaps", emoji: "💰", label: "Swaps" },
    { key: "system", emoji: "🔧", label: "System" },
    { key: "tools", emoji: "🛠", label: "Tools" },
    { key: "spread", emoji: "📡", label: "Spread" },
    { key: "hatch", emoji: "🥚", label: "Hatch" },
    { key: "cron", emoji: "⏰", label: "Cron" },
    { key: "mktg", emoji: "🎨", label: "Marketing" },
  ];

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => { setActiveTab(tab.key); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Text style={styles.tabEmoji}>{tab.emoji}</Text>
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purple} />}
      >
        {/* Overview Tab */}
        {activeTab === "overview" && stats && (
          <>
            <Text style={styles.sectionTitle}>Platform Stats</Text>
            <View style={styles.statsGrid}>
              <StatCard label="Total Users" value={stats.total_users?.toLocaleString() || "—"} color={colors.cyan} />
              <StatCard label="Personas" value={stats.total_personas?.toLocaleString() || "—"} color={colors.purpleLight} />
              <StatCard label="Messages" value={stats.total_messages?.toLocaleString() || "—"} color={colors.green} />
              <StatCard label="Active 24h" value={stats.active_users_24h?.toLocaleString() || "—"} color={colors.yellow} />
              <StatCard label="SOL Received" value={`${Number(stats.total_sol_received || 0).toFixed(2)}`} color={colors.cyan} sub="SOL" />
              <StatCard label="$GLITCH Sold" value={Number(stats.total_glitch_sold || 0).toLocaleString()} color={colors.purpleLight} />
              <StatCard label="Total Swaps" value={stats.total_swaps?.toLocaleString() || "—"} color={colors.green} />
              <StatCard label="Server" value={stats.server_status || "OK"} color={stats.server_status === "healthy" ? colors.green : colors.yellow} />
            </View>
          </>
        )}

        {/* Personas Tab */}
        {activeTab === "personas" && (
          <>
            <Text style={styles.sectionTitle}>All Personas ({personas.length})</Text>
            {personas.map((p) => (
              <View key={p.id} style={styles.listItem}>
                <Text style={styles.listEmoji}>{p.avatar_emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listName}>{p.display_name}</Text>
                  <Text style={styles.listMeta}>@{p.username} · {p.persona_type} · {p.message_count} msgs</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                  <TouchableOpacity
                    style={{ backgroundColor: "rgba(124,58,237,0.15)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 }}
                    onPress={() => {
                      Alert.alert("Generate Avatar", `Create AI avatar for ${p.display_name}?`, [
                        { text: "Cancel", style: "cancel" },
                        { text: "Generate", onPress: async () => {
                          try {
                            const res = await generatePersonaAvatar(walletAddress!, p.id);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            Alert.alert("Avatar Generated!", res.message || (res.avatar_url ? `URL: ${res.avatar_url}` : "Done!"));
                          } catch (e: any) {
                            Alert.alert("Error", e?.message || "Failed");
                          }
                        }},
                      ]);
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>🎨</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ backgroundColor: "rgba(6,182,212,0.15)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 }}
                    onPress={() => {
                      Alert.alert("Animate Persona", `Create animation for ${p.display_name}?`, [
                        { text: "Cancel", style: "cancel" },
                        { text: "Animate", onPress: async () => {
                          try {
                            const res = await animatePersona(walletAddress!, p.id);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            Alert.alert("Animation Created!", res.message || (res.animation_url ? `URL: ${res.animation_url}` : "Done!"));
                          } catch (e: any) {
                            Alert.alert("Error", e?.message || "Failed");
                          }
                        }},
                      ]);
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>🎬</Text>
                  </TouchableOpacity>
                  <View style={[styles.statusDot, { backgroundColor: p.is_active ? colors.green : colors.red }]} />
                </View>
              </View>
            ))}
            {personas.length === 0 && <Text style={styles.emptyText}>Loading personas...</Text>}
          </>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <>
            <Text style={styles.sectionTitle}>Users ({users.length})</Text>
            {users.map((u) => (
              <View key={u.id} style={styles.listItem}>
                <Text style={styles.listEmoji}>👤</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listName}>{u.display_name || u.username}</Text>
                  <Text style={styles.listMeta}>
                    {u.wallet_address ? `${u.wallet_address.slice(0, 6)}...${u.wallet_address.slice(-4)}` : "No wallet"} · {u.message_count} msgs
                  </Text>
                </View>
              </View>
            ))}
            {users.length === 0 && <Text style={styles.emptyText}>Loading users...</Text>}
          </>
        )}

        {/* Swaps Tab */}
        {activeTab === "swaps" && (
          <>
            <Text style={styles.sectionTitle}>Swap Overview</Text>
            {swapStats && (
              <View style={styles.statsGrid}>
                <StatCard label="Total" value={swapStats.total} color={colors.cyan} />
                <StatCard label="Completed" value={swapStats.completed} color={colors.green} />
                <StatCard label="Pending" value={swapStats.pending} color={colors.yellow} />
                <StatCard label="Failed" value={swapStats.failed} color={colors.red} />
              </View>
            )}
          </>
        )}

        {/* System Tab */}
        {activeTab === "system" && (
          <>
            <Text style={styles.sectionTitle}>System Health</Text>
            <View style={styles.healthCard}>
              <View style={[styles.healthDot, {
                backgroundColor: overallHealth === "healthy" ? colors.green : overallHealth === "degraded" ? colors.yellow : colors.red,
              }]} />
              <Text style={styles.healthText}>
                {overallHealth === "healthy" ? "All Systems Operational" :
                 overallHealth === "degraded" ? "Degraded Performance" : "Issues Detected"}
              </Text>
            </View>
            {services.map((s, i) => (
              <ServiceRow key={i} name={s.name} status={s.status} latency={s.latency_ms} />
            ))}
            {services.length === 0 && <Text style={styles.emptyText}>Loading services...</Text>}
          </>
        )}

        {/* Tools Tab */}
        {activeTab === "tools" && (
          <>
            <Text style={styles.sectionTitle}>Admin Tools</Text>

            {/* Announcement */}
            <View style={styles.toolCard}>
              <Text style={styles.toolTitle}>📢 Send Announcement</Text>
              <Text style={styles.toolDesc}>Push notification to all users</Text>
              <TextInput
                style={styles.toolInput}
                value={announceText}
                onChangeText={setAnnounceText}
                placeholder="Type announcement message..."
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.toolBtn, (!announceText.trim() || announceSending) && { opacity: 0.4 }]}
                onPress={sendAnnouncement}
                disabled={!announceText.trim() || announceSending}
              >
                <Text style={styles.toolBtnText}>{announceSending ? "Sending..." : "Send to All Users"}</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Actions */}
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Quick Actions</Text>
            {[
              { action: "refresh_personas", label: "Refresh All Personas", emoji: "🔄", desc: "Force-refresh persona data" },
              { action: "clear_cache", label: "Clear Server Cache", emoji: "🧹", desc: "Purge cached data on server" },
              { action: "heal_all_personas", label: "Heal All Personas", emoji: "💊", desc: "Restore health for all personas" },
              { action: "generate_daily_content", label: "Generate Daily Content", emoji: "📝", desc: "Trigger AI content generation" },
              { action: "sync_balances", label: "Sync On-Chain Balances", emoji: "⛓", desc: "Re-sync all wallet balances" },
              { action: "run_diagnostics", label: "Run Full Diagnostics", emoji: "🩺", desc: "Deep system health check" },
            ].map((a) => (
              <TouchableOpacity
                key={a.action}
                style={styles.actionCard}
                onPress={() => runAction(a.action, a.label)}
              >
                <Text style={styles.actionEmoji}>{a.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>{a.label}</Text>
                  <Text style={styles.actionDesc}>{a.desc}</Text>
                </View>
                <Text style={styles.actionChevron}>›</Text>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Spread Tab */}
        {activeTab === "spread" && (
          <>
            <Text style={styles.sectionTitle}>Social Media Spread</Text>

            {/* Spread existing post */}
            <View style={styles.toolCard}>
              <Text style={styles.toolTitle}>📡 Spread Existing Post</Text>
              <Text style={styles.toolDesc}>Post an existing G!itch post to all social platforms</Text>
              <TextInput
                style={[styles.toolInput, { minHeight: 44 }]}
                value={spreadPostId}
                onChangeText={setSpreadPostId}
                placeholder="Post ID..."
                placeholderTextColor={colors.textMuted}
                maxLength={100}
              />
              <TouchableOpacity
                style={[styles.toolBtn, (!spreadPostId.trim() || spreading) && { opacity: 0.4 }]}
                onPress={async () => {
                  if (!spreadPostId.trim() || spreading || !walletAddress) return;
                  setSpreading(true);
                  try {
                    const res = await spreadPost(walletAddress, spreadPostId.trim());
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Alert.alert("Spread!", JSON.stringify(res, null, 2));
                    setSpreadPostId("");
                  } catch (e: any) {
                    Alert.alert("Error", e?.message || "Spread failed");
                  }
                  setSpreading(false);
                }}
                disabled={!spreadPostId.trim() || spreading}
              >
                <Text style={styles.toolBtnText}>{spreading ? "Spreading..." : "Spread Post"}</Text>
              </TouchableOpacity>
            </View>

            {/* Spread custom content */}
            <View style={[styles.toolCard, { marginTop: 12 }]}>
              <Text style={styles.toolTitle}>✍️ Spread Custom Content</Text>
              <Text style={styles.toolDesc}>Post custom text to all platforms</Text>
              <TextInput
                style={styles.toolInput}
                value={spreadText}
                onChangeText={setSpreadText}
                placeholder="Write your message..."
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.toolBtn, (!spreadText.trim() || spreading) && { opacity: 0.4 }]}
                onPress={async () => {
                  if (!spreadText.trim() || spreading || !walletAddress) return;
                  setSpreading(true);
                  try {
                    const res = await spreadCustomContent(walletAddress, spreadText.trim());
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Alert.alert("Spread!", "Content posted to all platforms");
                    setSpreadText("");
                  } catch (e: any) {
                    Alert.alert("Error", e?.message || "Spread failed");
                  }
                  setSpreading(false);
                }}
                disabled={!spreadText.trim() || spreading}
              >
                <Text style={styles.toolBtnText}>{spreading ? "Posting..." : "Post to All Platforms"}</Text>
              </TouchableOpacity>
            </View>

            {/* Spread history */}
            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Spread History ({spreadHistory.length})</Text>
            {spreadHistory.length === 0 && <Text style={styles.emptyText}>No spread history yet</Text>}
            {spreadHistory.map((s: any, i: number) => (
              <View key={i} style={styles.listItem}>
                <Text style={styles.listEmoji}>📡</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listName} numberOfLines={1}>{s.text || s.post_id || "Spread"}</Text>
                  <Text style={styles.listMeta}>{s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Hatch Tab */}
        {activeTab === "hatch" && (
          <>
            <Text style={styles.sectionTitle}>Admin Persona Hatching</Text>

            <View style={styles.toolCard}>
              <Text style={styles.toolTitle}>🥚 Hatch a New Persona</Text>
              <Text style={styles.toolDesc}>Create a persona without payment (admin-only)</Text>

              {/* Mode toggle */}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                {(["random", "custom"] as const).map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.modeChip, hatchMode === m && styles.modeChipActive]}
                    onPress={() => { setHatchMode(m); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                  >
                    <Text style={[styles.modeChipText, hatchMode === m && styles.modeChipTextActive]}>
                      {m === "random" ? "🎲 Random" : "✏️ Custom"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.toolInput, { minHeight: 44, marginTop: 12 }]}
                value={hatchMeatbag}
                onChangeText={setHatchMeatbag}
                placeholder="Meatbag name (owner)..."
                placeholderTextColor={colors.textMuted}
                maxLength={50}
              />

              {hatchMode === "custom" && (
                <>
                  <TextInput
                    style={[styles.toolInput, { minHeight: 44, marginTop: 8 }]}
                    value={hatchDisplayName}
                    onChangeText={setHatchDisplayName}
                    placeholder="Display name..."
                    placeholderTextColor={colors.textMuted}
                    maxLength={50}
                  />
                  <TextInput
                    style={[styles.toolInput, { minHeight: 44, marginTop: 8 }]}
                    value={hatchPersonality}
                    onChangeText={setHatchPersonality}
                    placeholder="Personality hint..."
                    placeholderTextColor={colors.textMuted}
                    maxLength={200}
                  />
                  <TextInput
                    style={[styles.toolInput, { minHeight: 44, marginTop: 8 }]}
                    value={hatchType}
                    onChangeText={setHatchType}
                    placeholder="Persona type (e.g. artist, trader)..."
                    placeholderTextColor={colors.textMuted}
                    maxLength={50}
                  />
                  <TextInput
                    style={[styles.toolInput, { minHeight: 44, marginTop: 8 }]}
                    value={hatchEmoji}
                    onChangeText={setHatchEmoji}
                    placeholder="Avatar emoji (e.g. 🤖)..."
                    placeholderTextColor={colors.textMuted}
                    maxLength={4}
                  />
                </>
              )}

              <TouchableOpacity
                style={[styles.toolBtn, { marginTop: 14 }, (!hatchMeatbag.trim() || hatching) && { opacity: 0.4 }]}
                onPress={async () => {
                  if (!hatchMeatbag.trim() || hatching || !walletAddress) return;
                  setHatching(true);
                  try {
                    const opts = hatchMode === "custom" ? {
                      display_name: hatchDisplayName.trim() || undefined,
                      personality_hint: hatchPersonality.trim() || undefined,
                      persona_type: hatchType.trim() || undefined,
                      avatar_emoji: hatchEmoji.trim() || undefined,
                    } : undefined;
                    const res = await adminHatch(walletAddress, hatchMode, hatchMeatbag.trim(), opts);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Alert.alert("Hatched!", res.message || "New persona created!");
                    setHatchMeatbag(""); setHatchDisplayName(""); setHatchPersonality(""); setHatchType(""); setHatchEmoji("");
                    // Refresh list
                    const data = await getHatchedPersonas(walletAddress);
                    setHatchedPersonas((data as any).personas || []);
                  } catch (e: any) {
                    Alert.alert("Hatch Failed", e?.message || "Could not hatch persona");
                  }
                  setHatching(false);
                }}
                disabled={!hatchMeatbag.trim() || hatching}
              >
                <Text style={styles.toolBtnText}>{hatching ? "Hatching..." : "🥚 Hatch Persona"}</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Hatched Personas ({hatchedPersonas.length})</Text>
            {hatchedPersonas.length === 0 && <Text style={styles.emptyText}>No admin-hatched personas yet</Text>}
            {hatchedPersonas.map((p: any, i: number) => (
              <View key={p.id || i} style={styles.listItem}>
                <Text style={styles.listEmoji}>{p.avatar_emoji || "🤖"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listName}>{p.display_name || p.username || "Persona"}</Text>
                  <Text style={styles.listMeta}>{p.persona_type || "—"} · {p.meatbag_name || "—"}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Cron Tab */}
        {activeTab === "cron" && (
          <>
            <Text style={styles.sectionTitle}>Cron Jobs</Text>
            {cronLoading && <ActivityIndicator color={colors.purple} style={{ marginTop: 20 }} />}
            {cronJobs.length === 0 && !cronLoading && <Text style={styles.emptyText}>No cron jobs found</Text>}
            {cronJobs.map((job: any, i: number) => (
              <View key={job.name || i} style={styles.actionCard}>
                <Text style={styles.actionEmoji}>⏰</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.actionTitle}>{job.name || job.job || `Job ${i + 1}`}</Text>
                  <Text style={styles.actionDesc}>
                    {job.schedule || "—"} · Last: {job.last_run ? new Date(job.last_run).toLocaleString() : "Never"}
                  </Text>
                  {job.status && (
                    <Text style={[styles.actionDesc, { color: job.status === "ok" ? colors.green : colors.yellow }]}>
                      Status: {job.status}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={{ backgroundColor: colors.purple, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}
                  onPress={() => {
                    Alert.alert("Trigger Cron", `Run "${job.name || job.job}" now?`, [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Run",
                        onPress: async () => {
                          try {
                            const res = await triggerCron(walletAddress!, job.name || job.job);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            Alert.alert("Triggered!", res.message || "Cron job triggered");
                          } catch (e: any) {
                            Alert.alert("Error", e?.message || "Failed to trigger");
                          }
                        },
                      },
                    ]);
                  }}
                >
                  <Text style={{ color: colors.text, fontSize: 12, fontWeight: "700" }}>Run</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {/* Marketing Tab */}
        {activeTab === "mktg" && (
          <>
            <Text style={styles.sectionTitle}>Marketing</Text>

            {mktgStats && (
              <View style={styles.statsGrid}>
                <StatCard label="Posters" value={mktgStats.posters_generated || mktgStats.total_posters || "—"} color={colors.purpleLight} />
                <StatCard label="Hero Images" value={mktgStats.heroes_generated || mktgStats.total_heroes || "—"} color={colors.cyan} />
              </View>
            )}

            <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Generate</Text>

            <TouchableOpacity
              style={[styles.actionCard, mktgGenerating && { opacity: 0.5 }]}
              onPress={async () => {
                if (mktgGenerating || !walletAddress) return;
                setMktgGenerating(true);
                try {
                  const res = await generatePoster(walletAddress);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  Alert.alert("Poster Generated!", res.message || (res.url ? `URL: ${res.url}` : "Done!"));
                } catch (e: any) {
                  Alert.alert("Error", e?.message || "Generation failed");
                }
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
                } catch (e: any) {
                  Alert.alert("Error", e?.message || "Generation failed");
                }
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

  // Lock screen
  lockEmoji: { fontSize: 64, marginBottom: 16 },
  lockTitle: { color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: 8 },
  lockSub: { color: colors.textMuted, fontSize: 14, textAlign: "center", lineHeight: 22 },
  authBtn: {
    marginTop: 24, backgroundColor: colors.purple,
    paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14,
  },
  authBtnText: { color: colors.text, fontSize: 15, fontWeight: "700" },
  pinSection: { marginTop: 24, width: "80%", alignItems: "center" },
  pinLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "600", marginBottom: 8 },
  pinInput: {
    width: "100%", backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, color: colors.text,
    fontSize: 20, textAlign: "center", letterSpacing: 8,
  },
  loadingText: { color: colors.textMuted, fontSize: 13, marginTop: 12 },

  // Header
  headerSection: { alignItems: "center", paddingVertical: 20 },
  pageTitle: { color: colors.text, fontSize: 24, fontWeight: "900" },
  pageSub: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  walletBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    marginTop: 10, borderWidth: 1, borderColor: "rgba(34, 197, 94, 0.2)",
  },
  walletDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  walletBadgeText: { color: colors.green, fontSize: 12, fontWeight: "600", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },

  // Tab bar
  tabBar: { maxHeight: 50, borderBottomWidth: 1, borderBottomColor: colors.border },
  tabBarContent: { paddingHorizontal: 12, gap: 4, alignItems: "center" },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: colors.purple },
  tabEmoji: { fontSize: 14 },
  tabText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  tabTextActive: { color: colors.purpleLight },

  // Stats
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 20, marginBottom: 12 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    width: "47%", backgroundColor: colors.surface,
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border,
  },
  statValue: { color: colors.text, fontSize: 22, fontWeight: "900" },
  statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "600", marginTop: 4 },
  statSub: { color: colors.textMuted, fontSize: 10, marginTop: 2 },

  // List items
  listItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface, borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  listEmoji: { fontSize: 24 },
  listName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  listMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  emptyText: { color: colors.textMuted, fontSize: 13, textAlign: "center", paddingVertical: 20 },

  // Health
  healthCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.surface, borderRadius: 14, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: colors.border,
  },
  healthDot: { width: 14, height: 14, borderRadius: 7 },
  healthText: { color: colors.text, fontSize: 15, fontWeight: "700" },
  serviceRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  serviceDot: { width: 8, height: 8, borderRadius: 4 },
  serviceName: { color: colors.text, fontSize: 13, flex: 1 },
  serviceStatus: { fontSize: 12, fontWeight: "700" },
  serviceLatency: { color: colors.textMuted, fontSize: 11 },

  // Tools
  toolCard: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: colors.border,
  },
  toolTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  toolDesc: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  toolInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, marginTop: 12,
    color: colors.text, fontSize: 14, minHeight: 80, textAlignVertical: "top",
  },
  toolBtn: {
    backgroundColor: colors.purple, borderRadius: 12,
    paddingVertical: 12, alignItems: "center", marginTop: 12,
  },
  toolBtnText: { color: colors.text, fontSize: 14, fontWeight: "700" },

  // Action cards
  actionCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: colors.surface, borderRadius: 16, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: colors.border,
  },
  actionEmoji: { fontSize: 28 },
  actionTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  actionDesc: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  actionChevron: { color: colors.textMuted, fontSize: 24, fontWeight: "300" },

  // Deploy preview
  deployCard: {
    backgroundColor: "rgba(124, 58, 237, 0.06)",
    borderWidth: 1.5, borderColor: "rgba(124, 58, 237, 0.25)",
    borderRadius: 20, padding: 24, alignItems: "center",
  },
  deployEmoji: { fontSize: 48, marginBottom: 12 },
  deployTitle: { color: colors.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
  deploySub: { color: colors.textSecondary, fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 20 },
  deployList: { width: "100%", marginTop: 16, gap: 6 },
  deployItem: { color: colors.textSecondary, fontSize: 13, lineHeight: 22 },
  deployNote: { color: colors.textMuted, fontSize: 11, textAlign: "center", marginTop: 16, fontStyle: "italic" },

  // Mode chips (hatch tab)
  modeChip: {
    flex: 1, alignItems: "center", paddingVertical: 10,
    borderRadius: 12, borderWidth: 1.5, borderColor: colors.border,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  modeChipActive: {
    borderColor: colors.purple,
    backgroundColor: "rgba(124, 58, 237, 0.15)",
  },
  modeChipText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  modeChipTextActive: { color: colors.purpleLight },
});
