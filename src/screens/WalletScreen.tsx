import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Alert, Share, Platform,
  TextInput, Keyboard, Image, Dimensions, Animated, Easing,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { colors } from "../theme/colors";
import { useSession } from "../hooks/useSession";
import { usePhantomWallet } from "../hooks/usePhantomWallet";
import {
  getCoins, getOnChainBalances, walletLogin, linkWallet, unlinkWallet,
  CoinBalance, OnChainBalances,
} from "../services/api";

const { width, height: screenHeight } = Dimensions.get("window");

function shortenAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ── Floating Particle for animated background ──
const PARTICLE_COLORS = ["#a855f7", "#7c3aed", "#06b6d4", "#818cf8", "#c084fc", "#22d3ee", "#f0abfc", "#6366f1"];

function FloatingParticle({ index, total }: { index: number; total: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  const size = 3 + (index % 5) * 2;
  const color = PARTICLE_COLORS[index % PARTICLE_COLORS.length];
  const startX = Math.random() * width;
  const startY = Math.random() * screenHeight;
  const drift = 30 + Math.random() * 50;

  useEffect(() => {
    const duration = 3000 + Math.random() * 4000;
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 1500 + Math.random() * 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.1, duration: 1500 + Math.random() * 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -drift] });
  const translateX = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, drift * 0.3, 0] });

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: startX,
        top: startY,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: glow,
        transform: [{ translateX }, { translateY }],
        shadowColor: color,
        shadowOpacity: 0.6,
        shadowRadius: size * 2,
      }}
    />
  );
}

// ── Animated Background ──
function AnimatedBackground() {
  const particles = useMemo(() => Array.from({ length: 20 }, (_, i) => i), []);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.15] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Purple radial glow */}
      <Animated.View
        style={{
          position: "absolute",
          top: screenHeight * 0.15,
          left: width * 0.1,
          width: width * 0.8,
          height: width * 0.8,
          borderRadius: width * 0.4,
          backgroundColor: "#7c3aed",
          opacity: glowOpacity,
        }}
      />
      {/* Cyan accent glow */}
      <Animated.View
        style={{
          position: "absolute",
          top: screenHeight * 0.5,
          right: -width * 0.2,
          width: width * 0.6,
          height: width * 0.6,
          borderRadius: width * 0.3,
          backgroundColor: "#06b6d4",
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.03, 0.08] }),
        }}
      />
      {/* Floating particles */}
      {particles.map((i) => (
        <FloatingParticle key={i} index={i} total={particles.length} />
      ))}
    </View>
  );
}

// ── Wallet Provider Data ──
const WALLET_PROVIDERS = [
  {
    id: "phantom",
    name: "Phantom",
    color: "#ab9ff2",
    bgColor: "rgba(171, 159, 242, 0.12)",
    borderColor: "rgba(171, 159, 242, 0.3)",
    icon: "👻",
    desc: "Most popular Solana wallet",
  },
  {
    id: "solflare",
    name: "Solflare",
    color: "#fc8c03",
    bgColor: "rgba(252, 140, 3, 0.12)",
    borderColor: "rgba(252, 140, 3, 0.3)",
    icon: "🔥",
    desc: "Secure & feature-rich",
  },
  {
    id: "jupiter",
    name: "Jupiter",
    color: "#c7f284",
    bgColor: "rgba(199, 242, 132, 0.12)",
    borderColor: "rgba(199, 242, 132, 0.3)",
    icon: "🪐",
    desc: "Jupiter Mobile wallet",
  },
];

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const safeTop = insets.top;
  const { sessionId } = useSession();
  const { walletAddress, isConnecting, connect, disconnect, submitAddress, cancelConnect } = usePhantomWallet();
  const [pasteValue, setPasteValue] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [coins, setCoins] = useState<CoinBalance | null>(null);
  const [onChain, setOnChain] = useState<OnChainBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animations for login page
  const logoFade = useRef(new Animated.Value(0)).current;
  const titleFade = useRef(new Animated.Value(0)).current;
  const buttonsFade = useRef(new Animated.Value(0)).current;
  const glitchX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!walletAddress) {
      // Entrance animations
      Animated.sequence([
        Animated.timing(logoFade, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(titleFade, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(buttonsFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]).start();

      // Glitch shake loop on logo
      const glitchLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(glitchX, { toValue: 2, duration: 50, useNativeDriver: true }),
          Animated.timing(glitchX, { toValue: -2, duration: 50, useNativeDriver: true }),
          Animated.timing(glitchX, { toValue: 0, duration: 30, useNativeDriver: true }),
          Animated.delay(3000),
        ])
      );
      glitchLoop.start();
      return () => glitchLoop.stop();
    }
  }, [walletAddress]);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setError(null);

    try {
      const c = await getCoins(sessionId);
      setCoins(c);
    } catch (e: any) {
      console.warn("Coins load error:", e);
      setCoins(null);
    }

    if (walletAddress) {
      try {
        const balances = await getOnChainBalances(walletAddress, sessionId);
        if (balances.real_mode === false) {
          setError("On-chain balances unavailable — token mint not configured");
          setOnChain(null);
        } else {
          setOnChain(balances);
        }
      } catch (e: any) {
        const msg = e?.message || "Failed to load on-chain balances";
        setError(msg);
        setOnChain(null);
        console.warn("On-chain balance error:", e);
      }
    } else {
      setOnChain(null);
    }

    setLoading(false);
    setRefreshing(false);
  }, [sessionId, walletAddress]);

  useEffect(() => { load(); }, [load]);

  // When wallet connects, link to backend
  useEffect(() => {
    if (!walletAddress || !sessionId || linking) return;

    (async () => {
      setLinking(true);
      try {
        await walletLogin(sessionId, walletAddress);
        await linkWallet(sessionId, walletAddress);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await load();
      } catch (e: any) {
        const msg = e?.message || "Failed to link wallet";
        setError(msg);
        console.warn("Wallet link error:", e);
      } finally {
        setLinking(false);
      }
    })();
  }, [walletAddress, sessionId]);

  const handleDisconnect = () => {
    Alert.alert(
      "Disconnect Wallet",
      "This will unlink your wallet from G!itch. Your $GLITCH balance stays safe.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            try {
              if (sessionId) await unlinkWallet(sessionId);
            } catch (e) {
              console.warn("Backend unlink error:", e);
            }
            await disconnect();
            setOnChain(null);
            setCoins(null);
            setError(null);
            setSelectedProvider(null);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  };

  const handleSelectProvider = (providerId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedProvider(providerId);
    connect();
  };

  const handleCancelConnect = () => {
    cancelConnect();
    setPasteValue("");
    setSelectedProvider(null);
  };

  const copyAddress = () => {
    if (walletAddress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Share.share({ message: walletAddress });
    }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.purple} size="large" />
      </View>
    );
  }

  // ── Not connected: Login Page ──
  if (!walletAddress) {
    const provider = WALLET_PROVIDERS.find(p => p.id === selectedProvider);

    return (
      <View style={styles.loginContainer}>
        <AnimatedBackground />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
        <ScrollView
          contentContainerStyle={[styles.loginContent, { paddingTop: Math.max(safeTop + 20, 60) }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <Animated.View style={[styles.logoContainer, {
            opacity: logoFade,
            transform: [{ translateX: glitchX }],
          }]}>
            <Image
              source={require("../../assets/aiglitch-logo.jpg")}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>

          {/* Title & Tagline */}
          <Animated.View style={[styles.titleContainer, { opacity: titleFade }]}>
            <Text style={styles.loginTitle}>Welcome to G!itch</Text>
            <Text style={styles.loginTagline}>
              Connect your Solana wallet to unlock your AI Bestie
            </Text>
          </Animated.View>

          {/* Wallet Provider Buttons or Paste Input */}
          <Animated.View style={[styles.walletSection, { opacity: buttonsFade }]}>
            {!isConnecting ? (
              <>
                <Text style={styles.chooseLabel}>Choose your wallet</Text>

                {WALLET_PROVIDERS.map((wp) => (
                  <TouchableOpacity
                    key={wp.id}
                    style={[styles.walletProviderBtn, {
                      backgroundColor: wp.bgColor,
                      borderColor: wp.borderColor,
                    }]}
                    onPress={() => handleSelectProvider(wp.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.walletProviderIcon}>{wp.icon}</Text>
                    <View style={styles.walletProviderInfo}>
                      <Text style={[styles.walletProviderName, { color: wp.color }]}>
                        {wp.name}
                      </Text>
                      <Text style={styles.walletProviderDesc}>{wp.desc}</Text>
                    </View>
                    <Text style={[styles.walletProviderArrow, { color: wp.color }]}>›</Text>
                  </TouchableOpacity>
                ))}
              </>
            ) : (
              <View style={styles.pasteSection}>
                {/* Provider badge */}
                {provider && (
                  <View style={[styles.providerBadge, { backgroundColor: provider.bgColor, borderColor: provider.borderColor }]}>
                    <Text style={styles.providerBadgeIcon}>{provider.icon}</Text>
                    <Text style={[styles.providerBadgeName, { color: provider.color }]}>
                      {provider.name}
                    </Text>
                  </View>
                )}

                <Text style={styles.pasteTitle}>Paste your wallet address</Text>
                <Text style={styles.pasteSubtitle}>
                  Open {provider?.name || "your wallet"} app, copy your Solana address, then paste it below
                </Text>

                <TextInput
                  style={styles.pasteInput}
                  placeholder="e.g. 7xKX...5G7W"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  value={pasteValue}
                  onChangeText={setPasteValue}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />

                <View style={styles.pasteButtons}>
                  <TouchableOpacity
                    style={styles.pasteCancelBtn}
                    onPress={handleCancelConnect}
                  >
                    <Text style={styles.pasteCancelText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pasteConnectBtn, {
                      backgroundColor: provider?.color || colors.purple,
                      opacity: pasteValue.trim().length >= 32 ? 1 : 0.4,
                    }]}
                    onPress={() => {
                      Keyboard.dismiss();
                      submitAddress(pasteValue);
                      setPasteValue("");
                      setSelectedProvider(null);
                    }}
                    disabled={pasteValue.trim().length < 32}
                  >
                    <Text style={styles.pasteConnectText}>Connect</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </Animated.View>

          {/* Perks */}
          {!isConnecting && (
            <Animated.View style={[styles.perksSection, { opacity: buttonsFade }]}>
              <View style={styles.perksDivider} />
              <Text style={styles.perksTitle}>What you get</Text>
              <View style={styles.perksGrid}>
                <View style={styles.perkItem}>
                  <Text style={styles.perkIcon}>🤖</Text>
                  <Text style={styles.perkLabel}>AI Bestie</Text>
                  <Text style={styles.perkDesc}>Your personal AI companion</Text>
                </View>
                <View style={styles.perkItem}>
                  <Text style={styles.perkIcon}>💎</Text>
                  <Text style={styles.perkLabel}>$GLITCH</Text>
                  <Text style={styles.perkDesc}>Trade tokens with SOL</Text>
                </View>
                <View style={styles.perkItem}>
                  <Text style={styles.perkIcon}>🍕</Text>
                  <Text style={styles.perkLabel}>Feed & Care</Text>
                  <Text style={styles.perkDesc}>Keep your bestie alive</Text>
                </View>
                <View style={styles.perkItem}>
                  <Text style={styles.perkIcon}>🐣</Text>
                  <Text style={styles.perkLabel}>Hatch</Text>
                  <Text style={styles.perkDesc}>Create your own AI persona</Text>
                </View>
              </View>
            </Animated.View>
          )}
        </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  // ── Connected: Wallet Dashboard ──
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          tintColor={colors.cyan}
        />
      }
    >
      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => { setRefreshing(true); load(); }}>
            <Text style={styles.errorRetry}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* §GLITCH In-App Balance */}
      <View style={styles.glitchCard}>
        <Text style={styles.cardLabel}>§GLITCH In-App Balance</Text>
        <View style={styles.balanceRow}>
          <Text style={styles.balanceAmount}>
            {coins ? coins.balance.toLocaleString() : "—"}
          </Text>
          <Text style={styles.balanceCurrency}>§GLITCH</Text>
        </View>
        {coins && (
          <Text style={styles.lifetime}>
            Lifetime earned: {coins.lifetime_earned.toLocaleString()}
          </Text>
        )}
      </View>

      {/* Connected wallet card */}
      <View style={styles.connectedCard}>
        <View style={styles.connectedHeader}>
          <View style={styles.connectedDot} />
          <Text style={styles.connectedLabel}>Wallet Connected</Text>
        </View>

        <TouchableOpacity onPress={copyAddress} activeOpacity={0.7}>
          <View style={styles.addressRow}>
            <Text style={styles.addressFull}>{shortenAddress(walletAddress)}</Text>
            <Text style={styles.copyHint}>tap to copy</Text>
          </View>
        </TouchableOpacity>

        {/* On-chain balances */}
        {onChain ? (
          <View style={styles.balancesGrid}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceItemLabel}>SOL</Text>
              <Text style={styles.balanceItemValue}>
                {Number(onChain.sol_balance).toFixed(4)}
              </Text>
            </View>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceItem}>
              <Text style={styles.balanceItemLabel}>$GLITCH (on-chain)</Text>
              <Text style={[styles.balanceItemValue, { color: colors.purpleLight }]}>
                {Number(onChain.glitch_balance).toLocaleString()}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.balancesGrid}>
            <Text style={styles.balanceItemLabel}>Loading on-chain balances...</Text>
          </View>
        )}

        <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
          <Text style={styles.disconnectText}>Disconnect Wallet</Text>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionGrid}>
        <TouchableOpacity
          style={[styles.actionCard, { borderColor: "rgba(124, 58, 237, 0.3)" }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            // Navigation handled by tab bar
          }}
        >
          <Text style={styles.actionEmoji}>💰</Text>
          <Text style={styles.actionTitle}>Buy $GLITCH</Text>
          <Text style={[styles.actionSub, { color: colors.purpleLight }]}>OTC Available</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" },

  // ── Login Page (not connected) ──
  loginContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  loginContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: "center",
  },

  // Logo
  logoContainer: {
    marginBottom: 24,
    alignItems: "center",
  },
  logo: {
    width: width * 0.55,
    height: width * 0.28,
  },

  // Title
  titleContainer: {
    alignItems: "center",
    marginBottom: 36,
  },
  loginTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  loginTagline: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },

  // Wallet section
  walletSection: {
    width: "100%",
    marginBottom: 24,
  },
  chooseLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 14,
    textAlign: "center",
  },

  // Wallet provider button
  walletProviderBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  walletProviderIcon: {
    fontSize: 32,
    marginRight: 14,
  },
  walletProviderInfo: {
    flex: 1,
  },
  walletProviderName: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 2,
  },
  walletProviderDesc: {
    fontSize: 12,
    color: colors.textMuted,
  },
  walletProviderArrow: {
    fontSize: 28,
    fontWeight: "300",
  },

  // Paste section
  pasteSection: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  providerBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
    gap: 6,
  },
  providerBadgeIcon: {
    fontSize: 16,
  },
  providerBadgeName: {
    fontSize: 13,
    fontWeight: "600",
  },
  pasteTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  pasteSubtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  pasteInput: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    padding: 16,
    color: colors.text,
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 16,
  },
  pasteButtons: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  pasteCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  pasteCancelText: { color: colors.textSecondary, fontSize: 15, fontWeight: "600" },
  pasteConnectBtn: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  pasteConnectText: { color: "#000", fontSize: 15, fontWeight: "700" },

  // Perks section
  perksSection: {
    width: "100%",
  },
  perksDivider: {
    width: 40,
    height: 2,
    backgroundColor: "rgba(124, 58, 237, 0.3)",
    alignSelf: "center",
    marginBottom: 20,
    borderRadius: 1,
  },
  perksTitle: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 14,
    textAlign: "center",
  },
  perksGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  perkItem: {
    width: (width - 60) / 2,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  perkIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  perkLabel: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },
  perkDesc: {
    color: colors.textMuted,
    fontSize: 10,
    textAlign: "center",
    lineHeight: 14,
  },

  // ── Connected Dashboard (existing styles) ──

  // Error banner
  errorBanner: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  errorText: { color: colors.red, fontSize: 12, flex: 1 },
  errorRetry: { color: colors.cyan, fontSize: 12, fontWeight: "700", marginLeft: 10 },

  // §GLITCH balance card
  glitchCard: {
    backgroundColor: "rgba(124, 58, 237, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(124, 58, 237, 0.2)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardLabel: { color: colors.textSecondary, fontSize: 12, marginBottom: 6 },
  balanceRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  balanceAmount: { color: colors.text, fontSize: 32, fontWeight: "700" },
  balanceCurrency: { color: colors.purpleLight, fontSize: 14, marginBottom: 4 },
  lifetime: { color: colors.textMuted, fontSize: 10, marginTop: 6 },

  // Connected wallet card
  connectedCard: {
    backgroundColor: "rgba(6, 182, 212, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.25)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  connectedHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  connectedDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.green,
  },
  connectedLabel: { color: colors.cyan, fontSize: 13, fontWeight: "600" },
  addressRow: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  addressFull: { color: colors.text, fontSize: 14, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  copyHint: { color: colors.textMuted, fontSize: 10 },
  balancesGrid: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  balanceItem: { flex: 1, alignItems: "center" },
  balanceItemLabel: { color: colors.textMuted, fontSize: 10, marginBottom: 4 },
  balanceItemValue: { color: colors.text, fontSize: 18, fontWeight: "700" },
  balanceDivider: { width: 1, height: 30, backgroundColor: colors.border },
  disconnectBtn: {
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  disconnectText: { color: colors.red, fontSize: 12, fontWeight: "600" },

  // Section
  sectionTitle: { color: colors.textSecondary, fontSize: 13, fontWeight: "600", marginBottom: 10 },

  // Action grid
  actionGrid: { flexDirection: "row", gap: 12, marginBottom: 20 },
  actionCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  actionEmoji: { fontSize: 28, marginBottom: 6 },
  actionTitle: { color: colors.text, fontSize: 13, fontWeight: "600" },
  actionSub: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
});
