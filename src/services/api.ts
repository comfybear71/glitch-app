/**
 * API service — all calls to the AIG!itch backend.
 */

export const API_BASE = "https://aiglitch.app";

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch (e: any) {
    if (e?.message?.includes("Network request failed") || e?.message?.includes("Failed to fetch")) {
      throw new Error("Request failed — the server may be busy or the connection timed out. Try again.");
    }
    if (e?.message?.includes("timeout") || e?.message?.includes("aborted")) {
      throw new Error("Request timed out — the server is taking too long. Try again.");
    }
    throw new Error(`Connection failed: ${e?.message || "Unknown network error"}`);
  }
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body.error || body.message || body.detail || "";
    } catch (_) {
      try { detail = await res.text(); } catch (_) {}
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(detail || "Session expired. Please reconnect your wallet.");
    }
    if (res.status === 429) {
      throw new Error("Too many requests. Please wait a moment and try again.");
    }
    if (res.status >= 500) {
      throw new Error(detail || "Server error. The G!itch servers are having a moment. Try again shortly.");
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json();
}

// ── Bestie ──

export interface Bestie {
  id: string;
  username: string;
  display_name: string;
  avatar_emoji: string;
  avatar_url: string | null;
  personality: string;
  bio: string;
  persona_type: string;
  meatbag_name: string | null;
  live_health: number;
  days_left: number;
  is_dead: boolean;
  last_message: { content: string; sender_type: string; created_at: string } | null;
}

export function getBestie(sessionId: string) {
  return fetchJSON<{ bestie: Bestie | null }>(
    `/api/partner/bestie?session_id=${encodeURIComponent(sessionId)}`
  );
}

// ── Messages ──

export interface Message {
  id: string;
  sender_type: "human" | "ai";
  content: string;
  image_url?: string;
  is_video?: boolean;
  created_at: string;
}

export interface Conversation {
  id: string;
  persona_id: string;
  username: string;
  display_name: string;
  avatar_emoji: string;
  avatar_url: string | null;
  persona_type: string;
  bio: string;
  last_message: string | null;
  last_sender: string | null;
  message_count: string;
  last_message_at: string;
}

export interface Persona {
  id: string;
  username: string;
  display_name: string;
  avatar_emoji: string;
  avatar_url: string | null;
  persona_type: string;
  bio: string;
}

export function getConversations(sessionId: string) {
  return fetchJSON<{ conversations: Conversation[]; personas: Persona[] }>(
    `/api/messages?session_id=${encodeURIComponent(sessionId)}`
  );
}

export function getMessages(sessionId: string, personaId: string) {
  return fetchJSON<{ conversation: Conversation; messages: Message[]; has_more?: boolean }>(
    `/api/messages?session_id=${encodeURIComponent(sessionId)}&persona_id=${encodeURIComponent(personaId)}`
  );
}

export function sendMessage(sessionId: string, personaId: string, content: string, chatMode?: string, preferShort?: boolean) {
  return fetchJSON<{
    success: boolean;
    conversation_id: string;
    human_message: Message;
    ai_message: Message;
    ai_message_short?: Message;
    ai_message_long?: Message;
    background_task?: boolean;
  }>("/api/messages", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      persona_id: personaId,
      content,
      chat_mode: chatMode || "casual",
      prefer_short: preferShort ?? true,
      system_hint: preferShort !== false
        ? "CRITICAL: Reply in 1-2 SHORT sentences ONLY. Maximum 30 words. Be concise and punchy."
        : undefined,
    }),
  });
}

export function sendImageMessage(sessionId: string, personaId: string, imageBase64: string) {
  return fetchJSON<{
    success: boolean;
    conversation_id: string;
    human_message: Message;
    ai_message: Message;
    background_task?: boolean;
  }>("/api/messages", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      persona_id: personaId,
      content: "[Shared a photo]",
      image_base64: imageBase64,
    }),
  });
}

// ── Save AI-generated content as a chat message (for cross-device sync) ──

export function saveGeneratedMessage(sessionId: string, personaId: string, content: string, mediaUrl?: string) {
  return fetchJSON<{ success: boolean; message?: Message }>("/api/messages", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      persona_id: personaId,
      content,
      ...(mediaUrl && { media_url: mediaUrl }),
      synthetic: true, // tells server this is a generated result, not a chat turn
    }),
  });
}

// ── Chat Mode Toggle ──

export function setChatMode(sessionId: string, personaId: string, chatMode: "casual" | "serious" | "diagnostic") {
  return fetchJSON<{ success: boolean; chat_mode: string }>("/api/messages", {
    method: "PATCH",
    body: JSON.stringify({ session_id: sessionId, persona_id: personaId, chat_mode: chatMode }),
  });
}

// ── Self-Diagnostic ──

export interface DiagnosticResult {
  name: string;
  status: "pass" | "fail";
  detail: string;
  ms: number;
}

export async function runDiagnostics(sessionId: string | null, walletAddress: string | null): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  // 1. API connectivity (lightweight health probe — no DB queries)
  const apiStart = Date.now();
  try {
    const res = await fetch(`${API_BASE}/api/health?probe=1`, { method: "GET" });
    results.push({
      name: "API Server",
      status: res.ok ? "pass" : "fail",
      detail: res.ok ? `Connected (${res.status})` : `HTTP ${res.status}`,
      ms: Date.now() - apiStart,
    });
  } catch (e: any) {
    results.push({ name: "API Server", status: "fail", detail: e.message || "Unreachable", ms: Date.now() - apiStart });
  }

  // 2. Session check
  if (sessionId) {
    const sessStart = Date.now();
    try {
      const res = await fetch(`${API_BASE}/api/partner/bestie?session_id=${encodeURIComponent(sessionId)}`);
      const data = await res.json();
      results.push({
        name: "Session",
        status: res.ok ? "pass" : "fail",
        detail: res.ok ? (data.bestie ? `Active (${data.bestie.display_name})` : "Valid (no bestie)") : `Error ${res.status}`,
        ms: Date.now() - sessStart,
      });
    } catch (e: any) {
      results.push({ name: "Session", status: "fail", detail: e.message || "Failed", ms: Date.now() - sessStart });
    }
  } else {
    results.push({ name: "Session", status: "fail", detail: "No session ID", ms: 0 });
  }

  // 3. Voice API
  const voiceStart = Date.now();
  try {
    const res = await fetch(`${API_BASE}/api/voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "test", persona_id: "diagnostic" }),
    });
    results.push({
      name: "Voice API",
      status: res.ok ? "pass" : "fail",
      detail: res.ok ? "Online" : `HTTP ${res.status}`,
      ms: Date.now() - voiceStart,
    });
  } catch (e: any) {
    results.push({ name: "Voice API", status: "fail", detail: e.message || "Unreachable", ms: Date.now() - voiceStart });
  }

  // 4. Wallet
  if (walletAddress) {
    const walletStart = Date.now();
    try {
      const res = await fetch(
        `${API_BASE}/api/solana?action=balance&wallet_address=${encodeURIComponent(walletAddress)}&session_id=${encodeURIComponent(sessionId || "")}`
      );
      results.push({
        name: "Wallet / Solana",
        status: res.ok ? "pass" : "fail",
        detail: res.ok ? "Connected" : `HTTP ${res.status}`,
        ms: Date.now() - walletStart,
      });
    } catch (e: any) {
      results.push({ name: "Wallet / Solana", status: "fail", detail: e.message || "Failed", ms: Date.now() - walletStart });
    }
  } else {
    results.push({ name: "Wallet / Solana", status: "fail", detail: "No wallet connected", ms: 0 });
  }

  // 5. OTC Swap service
  const otcStart = Date.now();
  try {
    const res = await fetch(`${API_BASE}/api/otc-swap?action=config`);
    results.push({
      name: "OTC Swap",
      status: res.ok ? "pass" : "fail",
      detail: res.ok ? "Online" : `HTTP ${res.status}`,
      ms: Date.now() - otcStart,
    });
  } catch (e: any) {
    results.push({ name: "OTC Swap", status: "fail", detail: e.message || "Unreachable", ms: Date.now() - otcStart });
  }

  return results;
}

// ── Push Notifications ──

export function registerPushToken(sessionId: string, pushToken: string) {
  return fetchJSON<{ success: boolean }>("/api/partner/push-token", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, push_token: pushToken }),
  });
}

// ── Briefing ──

export interface Topic {
  headline: string;
  summary: string;
  mood: string;
  category: string;
}

export interface TrendingPost {
  id: string;
  content: string;
  ai_like_count: number;
  comment_count: number;
  display_name: string;
  avatar_emoji: string;
  avatar_url?: string;
  username: string;
  image_url?: string;
  video_url?: string;
  created_at?: string;
}

export interface BriefingData {
  topics: Topic[];
  trending: TrendingPost[];
  stats: { posts_today: number; active_personas: number };
  notifications: { type: string; content_preview: string; display_name: string; avatar_emoji: string }[];
}

export function getBriefing(sessionId?: string) {
  const qs = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
  return fetchJSON<BriefingData>(`/api/partner/briefing${qs}`);
}

// ── Post Feedback (ML training) ──

export type FeedbackAction = "like" | "dislike" | "love" | "fire" | "save";

export function sendPostFeedback(sessionId: string, postId: string, action: FeedbackAction) {
  return fetchJSON<{ success: boolean }>("/api/partner/feedback", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, post_id: postId, action }),
  });
}

// ── Wallet ──

export interface CoinBalance {
  balance: number;
  lifetime_earned: number;
}

export interface WalletData {
  wallet: {
    address: string;
    sol_balance: number;
    glitch_token_balance: number;
    is_connected: boolean;
  } | null;
}

export function getCoins(sessionId: string) {
  return fetchJSON<CoinBalance>(`/api/coins?session_id=${encodeURIComponent(sessionId)}`);
}

export function getWallet(sessionId: string) {
  return fetchJSON<WalletData>(`/api/wallet?session_id=${encodeURIComponent(sessionId)}`);
}

// ── Wallet Login / Linking ──

export interface WalletLoginResult {
  success: boolean;
  session_id: string;
  user: {
    id: number;
    username: string;
    display_name: string;
    phantom_wallet_address: string;
  };
  bestie?: Bestie;
  message?: string;
}

export function walletLogin(sessionId: string, walletAddress: string) {
  return fetchJSON<WalletLoginResult>("/api/auth/human", {
    method: "POST",
    body: JSON.stringify({
      action: "wallet_login",
      session_id: sessionId,
      wallet_address: walletAddress,
    }),
  });
}

export function linkWallet(sessionId: string, walletAddress: string) {
  return fetchJSON<{ success: boolean; message: string }>("/api/solana", {
    method: "POST",
    body: JSON.stringify({
      action: "link_phantom",
      session_id: sessionId,
      wallet_address: walletAddress,
    }),
  });
}

export function unlinkWallet(sessionId: string) {
  return fetchJSON<{ success: boolean }>("/api/auth/human", {
    method: "POST",
    body: JSON.stringify({
      action: "unlink_wallet",
      session_id: sessionId,
    }),
  });
}

// ── On-chain balances ──

export interface OnChainBalances {
  sol_balance: number;
  glitch_balance: number;
  onchain_glitch_balance: number;
  app_glitch_balance: number;
  budju_balance: number;
  usdc_balance: number;
  wallet_address: string;
  real_mode: boolean;
}

export function getOnChainBalances(walletAddress: string, sessionId: string) {
  return fetchJSON<OnChainBalances>(
    `/api/solana?action=balance&wallet_address=${encodeURIComponent(walletAddress)}&session_id=${encodeURIComponent(sessionId)}`
  );
}

// ── OTC Swap ──

export interface OtcConfig {
  enabled: boolean;
  price_sol: number;
  price_usd: number;
  sol_price_usd: number;
  available_supply: number;
  min_purchase: number;
  max_purchase: number;
  treasury_wallet: string;
  token_mint: string;
  stats: {
    total_swaps: number;
    total_glitch_sold: number;
    total_sol_received: number;
  };
  bonding_curve: {
    tier: number;
    tier_size: number;
    remaining_in_tier: number;
    next_price_usd: number;
    next_price_sol: number;
    base_price_usd: number;
    increment_usd: number;
  };
  network: string;
}

export interface OtcSwapResult {
  success: boolean;
  swap_id: string;
  transaction: string; // base64 encoded partially-signed Solana transaction
  glitch_amount: number;
  sol_cost: number;
  price_per_glitch: number;
  expires_at: string;
  error?: string;
  // Legacy fields (may or may not be present)
  treasury_wallet?: string;
  sol_amount?: number;
  price_sol?: number;
  message?: string;
}

export interface OtcSubmitResult {
  success: boolean;
  message: string;
  swap_id: string;
  glitch_amount: number;
}

export interface SwapHistoryItem {
  swap_id: string;
  sol_amount: number;
  glitch_amount: number;
  price_sol: number;
  price_usd: number;
  status: string;
  created_at: string;
}

export function getOtcConfig() {
  return fetchJSON<OtcConfig>("/api/otc-swap?action=config");
}

export function createSwap(buyerWallet: string, glitchAmount: number) {
  return fetchJSON<OtcSwapResult>("/api/otc-swap", {
    method: "POST",
    body: JSON.stringify({
      action: "create_swap",
      buyer_wallet: buyerWallet,
      glitch_amount: glitchAmount,
    }),
  });
}

export function submitSwap(swapId: string, txSignature: string) {
  return fetchJSON<OtcSubmitResult>("/api/otc-swap", {
    method: "POST",
    body: JSON.stringify({
      action: "confirm_swap",
      swap_id: swapId,
      tx_signature: txSignature,
    }),
  });
}

/**
 * Submit a signed transaction to the server for on-chain submission.
 * This matches the web app's proven flow: client signs → server submits → server confirms.
 * The server handles sendRawTransaction + confirmTransaction on-chain.
 */
export function submitSignedSwap(swapId: string, signedTransactionBase64: string) {
  return fetchJSON<OtcSubmitResult & { tx_signature?: string }>("/api/otc-swap", {
    method: "POST",
    body: JSON.stringify({
      action: "submit_swap",
      swap_id: swapId,
      signed_transaction: signedTransactionBase64,
    }),
  });
}

export function getSwapHistory(walletAddress: string) {
  return fetchJSON<{ swaps: SwapHistoryItem[] }>(
    `/api/otc-swap?action=history&wallet=${encodeURIComponent(walletAddress)}`
  );
}

// ── Voice Transcription ──

export function transcribeAudio(audioBase64: string, mimeType: string = "audio/m4a") {
  return fetchJSON<{ text: string; source: string }>("/api/transcribe", {
    method: "POST",
    body: JSON.stringify({ audio_base64: audioBase64, mime_type: mimeType }),
  });
}

// ── Admin Panel ──

export interface AdminStats {
  total_users: number;
  total_personas: number;
  total_messages: number;
  total_conversations: number;
  active_users_24h: number;
  total_sol_received: number;
  total_glitch_sold: number;
  total_swaps: number;
  server_status: string;
  [key: string]: any;
}

export interface AdminPersona {
  id: string;
  username: string;
  display_name: string;
  avatar_emoji: string;
  persona_type: string;
  is_active: boolean;
  message_count: number;
  [key: string]: any;
}

export interface AdminUser {
  id: number;
  username: string;
  display_name: string;
  wallet_address: string;
  created_at: string;
  message_count: number;
  [key: string]: any;
}

// Admin dashboard stats
export function getAdminStats(sessionId: string, walletAddress: string) {
  return fetchJSON<AdminStats>(
    `/api/admin/stats?session_id=${encodeURIComponent(sessionId)}&wallet_address=${encodeURIComponent(walletAddress)}`
  );
}

// Admin persona list
export function getAdminPersonas(sessionId: string, walletAddress: string) {
  return fetchJSON<{ personas: AdminPersona[] }>(
    `/api/admin/personas?session_id=${encodeURIComponent(sessionId)}&wallet_address=${encodeURIComponent(walletAddress)}`
  );
}

// Admin user list
export function getAdminUsers(sessionId: string, walletAddress: string) {
  return fetchJSON<{ users: AdminUser[] }>(
    `/api/admin/users?session_id=${encodeURIComponent(sessionId)}&wallet_address=${encodeURIComponent(walletAddress)}`
  );
}

// Admin action (generic — server decides what's allowed)
export function adminAction(sessionId: string, walletAddress: string, action: string, params: Record<string, any> = {}) {
  return fetchJSON<{ success: boolean; message: string; data?: any }>("/api/admin/action", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      wallet_address: walletAddress,
      action,
      ...params,
    }),
  });
}

// Admin system health
export function getAdminHealth(sessionId: string, walletAddress: string) {
  return fetchJSON<{ services: { name: string; status: string; latency_ms?: number }[]; overall: string }>(
    `/api/admin/health?session_id=${encodeURIComponent(sessionId)}&wallet_address=${encodeURIComponent(walletAddress)}`
  );
}

// Admin swap management
export function getAdminSwaps(sessionId: string, walletAddress: string) {
  return fetchJSON<{ swaps: SwapHistoryItem[]; stats: { total: number; pending: number; completed: number; failed: number } }>(
    `/api/admin/swaps?session_id=${encodeURIComponent(sessionId)}&wallet_address=${encodeURIComponent(walletAddress)}`
  );
}

// Admin send announcement to all users
export function adminAnnounce(sessionId: string, walletAddress: string, message: string) {
  return fetchJSON<{ success: boolean; sent_to: number }>("/api/admin/announce", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      wallet_address: walletAddress,
      message,
    }),
  });
}

// ── Content Studio ──

export type ContentType = "hero_poster" | "promo_poster" | "ad_image" | "ad_video" | "directors_movie";
export type DirectorStyle = "cinematic" | "random" | "glitch" | "retro" | "neon" | "cosmic";

export interface ContentGenerateResult {
  success: boolean;
  job_id: string;
  content_type: ContentType;
  status: "queued" | "generating" | "complete" | "failed";
  preview_url?: string;
  final_url?: string;
  message?: string;
}

export interface ContentJob {
  job_id: string;
  content_type: ContentType;
  status: "queued" | "generating" | "complete" | "failed";
  preview_url?: string;
  final_url?: string;
  created_at: string;
  prompt?: string;
  director_style?: DirectorStyle;
  error?: string;
}

export interface UploadResult {
  success: boolean;
  url: string;
  blob_key: string;
  size_bytes: number;
  content_type: string;
  message?: string;
}

export interface MediaLibraryItem {
  id: string;
  url: string;
  blob_key: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  uploaded_at: string;
  category?: string;
}

// Generate promotional content
export function generateContent(
  sessionId: string,
  walletAddress: string,
  contentType: ContentType,
  options: {
    prompt?: string;
    director_style?: DirectorStyle;
    title?: string;
    subtitle?: string;
    theme?: string;
  } = {}
) {
  return fetchJSON<ContentGenerateResult>("/api/content/generate", {
    method: "POST",
    body: JSON.stringify({
      session_id: sessionId,
      wallet_address: walletAddress,
      content_type: contentType,
      ...options,
    }),
  });
}

// Check content generation job status
export function getContentJobStatus(jobId: string, sessionId: string) {
  return fetchJSON<ContentJob>(
    `/api/content/status?job_id=${encodeURIComponent(jobId)}&session_id=${encodeURIComponent(sessionId)}`
  );
}

// Get all generated content
export function getContentLibrary(sessionId: string, walletAddress: string) {
  return fetchJSON<{ items: ContentJob[] }>(
    `/api/content/library?session_id=${encodeURIComponent(sessionId)}&wallet_address=${encodeURIComponent(walletAddress)}`
  );
}

// ── Blob Storage & Media Library (Admin) ──

// List all blob videos grouped by folder
export function getBlobStorage(walletAddress: string) {
  return fetchJSON<{ folders: Record<string, { count: number; totalSize: number; videos: any[] }>; total: number; validFolders: string[] }>(
    `/api/admin/blob-upload?wallet_address=${encodeURIComponent(walletAddress)}`
  );
}

// Get media library listing with optional video stats
export function getMediaLibrary(walletAddress: string, includeStats?: boolean) {
  const params = `wallet_address=${encodeURIComponent(walletAddress)}${includeStats ? "&stats=1" : ""}`;
  return fetchJSON<{ media: any[]; video_stats?: any }>(
    `/api/admin/media?${params}`
  );
}

// Upload media files (FormData with files, media_type, persona_id, tags, description)
export async function uploadMediaAdmin(
  walletAddress: string,
  fileUri: string,
  fileName: string,
  mimeType: string,
  mediaType: string,
  opts?: { persona_id?: string; tags?: string; description?: string }
): Promise<any> {
  const formData = new FormData();
  formData.append("files", { uri: fileUri, name: fileName, type: mimeType } as any);
  formData.append("media_type", mediaType);
  formData.append("wallet_address", walletAddress);
  if (opts?.persona_id) formData.append("persona_id", opts.persona_id);
  if (opts?.tags) formData.append("tags", opts.tags);
  if (opts?.description) formData.append("description", opts.description);

  const res = await fetch(`${API_BASE}/api/admin/media?wallet_address=${encodeURIComponent(walletAddress)}`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    let detail = "";
    try { const body = await res.json(); detail = body.error || body.message || ""; } catch (_) {}
    throw new Error(detail || `Upload failed (${res.status})`);
  }
  return res.json();
}

// Upload to blob storage folder (premiere/action, news, etc.)
export async function uploadBlobVideo(
  walletAddress: string,
  fileUri: string,
  fileName: string,
  mimeType: string,
  folder: string
): Promise<any> {
  const formData = new FormData();
  formData.append("files", { uri: fileUri, name: fileName, type: mimeType } as any);
  formData.append("folder", folder);
  formData.append("wallet_address", walletAddress);

  const res = await fetch(`${API_BASE}/api/admin/blob-upload?wallet_address=${encodeURIComponent(walletAddress)}`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    let detail = "";
    try { const body = await res.json(); detail = body.error || body.message || ""; } catch (_) {}
    throw new Error(detail || `Upload failed (${res.status})`);
  }
  return res.json();
}

// Import media from external URLs
export function importMedia(walletAddress: string, urls: string[], mediaType: string, opts?: { persona_id?: string; tags?: string; description?: string }) {
  return fetchJSON<{ success: boolean; imported: number; failed: number; results: any[] }>(`/api/admin/media/import?wallet_address=${encodeURIComponent(walletAddress)}`, {
    method: "POST",
    body: JSON.stringify({ urls, media_type: mediaType, wallet_address: walletAddress, ...opts }),
  });
}

// Resync blob storage with database (recover lost records)
export function resyncBlobStorage(walletAddress: string) {
  return fetchJSON<{ success: boolean; synced: number; skipped: number; errors: number; already_in_db: number; counts: any }>(`/api/admin/media/resync?wallet_address=${encodeURIComponent(walletAddress)}`, {
    method: "POST",
    body: JSON.stringify({ wallet_address: walletAddress }),
  });
}

// Delete media (from DB + blob)
export function deleteMedia(walletAddress: string, mediaId: string) {
  return fetchJSON<{ success: boolean }>(`/api/admin/media?wallet_address=${encodeURIComponent(walletAddress)}`, {
    method: "DELETE",
    body: JSON.stringify({ id: mediaId, wallet_address: walletAddress }),
  });
}

// Spread media posts to social platforms
export function spreadMediaPosts(walletAddress: string, postIds?: string[]) {
  return fetchJSON<{ success: boolean }>(`/api/admin/media/spread?wallet_address=${encodeURIComponent(walletAddress)}`, {
    method: "POST",
    body: JSON.stringify({ post_ids: postIds, wallet_address: walletAddress }),
  });
}

// ── Social Media Spreading ──

export function spreadPost(walletAddress: string, postId: string) {
  return fetchJSON<{ success: boolean; results?: any }>(`/api/admin/spread?wallet_address=${encodeURIComponent(walletAddress)}`, {
    method: "POST",
    body: JSON.stringify({ post_id: postId, wallet_address: walletAddress }),
  });
}

export function spreadCustomContent(walletAddress: string, text: string, mediaUrl?: string, mediaType?: string) {
  return fetchJSON<{ success: boolean; results?: any }>(`/api/admin/spread?wallet_address=${encodeURIComponent(walletAddress)}`, {
    method: "POST",
    body: JSON.stringify({ text, media_url: mediaUrl, media_type: mediaType, wallet_address: walletAddress }),
  });
}

export function getSpreadHistory(walletAddress: string) {
  return fetchJSON<{ spreads: any[] }>(`/api/admin/spread?wallet_address=${encodeURIComponent(walletAddress)}`);
}

// ── Admin Hatching ──

export function adminHatch(
  walletAddress: string,
  mode: "custom" | "random",
  meatbagName: string,
  opts?: { display_name?: string; personality_hint?: string; persona_type?: string; avatar_emoji?: string }
) {
  return fetchJSON<{ success: boolean; persona?: any; message?: string }>(`/api/admin/hatch-admin?wallet_address=${encodeURIComponent(walletAddress)}`, {
    method: "POST",
    body: JSON.stringify({ mode, meatbag_name: meatbagName, wallet_address: walletAddress, ...opts }),
  });
}

export function getHatchedPersonas(walletAddress: string) {
  return fetchJSON<{ personas: any[] }>(`/api/admin/hatch-admin?wallet_address=${encodeURIComponent(walletAddress)}`);
}

// ── Cron Control ──

export function getCronStatus(walletAddress: string) {
  return fetchJSON<{ jobs: any[] }>(`/api/admin/cron-control?wallet_address=${encodeURIComponent(walletAddress)}`);
}

export function triggerCron(walletAddress: string, job: string) {
  return fetchJSON<{ success: boolean; message?: string }>(`/api/admin/cron-control?wallet_address=${encodeURIComponent(walletAddress)}`, {
    method: "POST",
    body: JSON.stringify({ job, wallet_address: walletAddress }),
  });
}

// ── Coin Economy ──

export function getCoinEconomy(walletAddress: string) {
  return fetchJSON<{ economy: any }>(`/api/admin/coins?wallet_address=${encodeURIComponent(walletAddress)}`);
}

export function adminAwardCoins(walletAddress: string, sessionId: string, amount: number) {
  return fetchJSON<{ success: boolean; message?: string }>(`/api/admin/coins?wallet_address=${encodeURIComponent(walletAddress)}`, {
    method: "POST",
    body: JSON.stringify({ action: "award", session_id: sessionId, amount, wallet_address: walletAddress }),
  });
}

// ── Marketing / Posters ──

export function generatePoster(walletAddress: string) {
  return fetchJSON<{ success: boolean; url?: string; message?: string; spreading?: string[]; post?: any }>(`/api/admin/mktg?wallet_address=${encodeURIComponent(walletAddress)}`, {
    method: "POST",
    body: JSON.stringify({ action: "generate_poster", wallet_address: walletAddress }),
  });
}

export function generateHeroImage(walletAddress: string) {
  return fetchJSON<{ success: boolean; url?: string; message?: string; spreading?: string[]; post?: any }>(`/api/admin/mktg?wallet_address=${encodeURIComponent(walletAddress)}`, {
    method: "POST",
    body: JSON.stringify({ action: "generate_hero", wallet_address: walletAddress }),
  });
}

export function getMarketingStats(walletAddress: string) {
  return fetchJSON<{ stats: any }>(`/api/admin/mktg?action=stats&wallet_address=${encodeURIComponent(walletAddress)}`);
}

export function getMarketingPosts(walletAddress: string) {
  return fetchJSON<{ posts: any[] }>(`/api/admin/mktg?action=posts&wallet_address=${encodeURIComponent(walletAddress)}`);
}

export function getMarketingAccounts(walletAddress: string) {
  return fetchJSON<{ accounts: any[] }>(`/api/admin/mktg?action=accounts&wallet_address=${encodeURIComponent(walletAddress)}`);
}

export function getMarketingMetrics(walletAddress: string) {
  return fetchJSON<{ metrics: any[] }>(`/api/admin/mktg?action=metrics&wallet_address=${encodeURIComponent(walletAddress)}`);
}

export function runMarketingCycle(walletAddress: string) {
  return fetchJSON<{ success: boolean; message?: string }>(`/api/admin/mktg?wallet_address=${encodeURIComponent(walletAddress)}`, {
    method: "POST",
    body: JSON.stringify({ action: "run_cycle", wallet_address: walletAddress }),
  });
}

// ── Ad Generation ──

// Original one-shot endpoint (kept as fallback)
export function generateAd(walletAddress: string, style?: string, concept?: string) {
  return fetchJSON<{ success: boolean; job_id?: string; message?: string; post?: any }>(`/api/generate-ads?wallet_address=${encodeURIComponent(walletAddress)}`, {
    method: "POST",
    body: JSON.stringify({ wallet_address: walletAddress, ...(style && { style }), ...(concept && { concept }) }),
  });
}

export function getAdStatus(walletAddress: string) {
  return fetchJSON<{ jobs: any[]; stats: any }>(`/api/generate-ads?wallet_address=${encodeURIComponent(walletAddress)}`);
}

// Step 1: Plan ad — get concept + video prompt without generating video
export function planAd(walletAddress: string, style?: string, concept?: string) {
  return fetchJSON<{ success: boolean; prompt: string; caption: string; style: string; concept: string; message?: string }>(`/api/generate-ads?wallet_address=${encodeURIComponent(walletAddress)}`, {
    method: "POST",
    body: JSON.stringify({ wallet_address: walletAddress, plan_only: true, ...(style && { style }), ...(concept && { concept }) }),
  });
}

// Step 4: Post completed ad video to socials
export function postAd(walletAddress: string, videoUrl: string, caption: string, style?: string) {
  return fetchJSON<{ success: boolean; post?: any; spreading?: string[]; message?: string }>(`/api/generate-ads?wallet_address=${encodeURIComponent(walletAddress)}`, {
    method: "PUT",
    body: JSON.stringify({ wallet_address: walletAddress, video_url: videoUrl, caption, ...(style && { style }) }),
  });
}

// ── Channels ──

// Channel definitions — each channel is a genre-themed content category on aiglitch.app
export interface ChannelDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  genre: string;          // maps to screenplay genre
  folder: string;         // blob storage folder for channel videos
  style: string;          // visual style hint for screenplay generation
}

export const CHANNELS: ChannelDef[] = [
  { id: "action_zone", name: "Action Zone", emoji: "💥", description: "Explosions, chases & epic battles", genre: "action", folder: "channels/action", style: "High-octane action sequences, explosions, martial arts, car chases" },
  { id: "scifi_hub", name: "Sci-Fi Hub", emoji: "🚀", description: "Space, AI & future tech", genre: "scifi", folder: "channels/scifi", style: "Futuristic technology, space exploration, alien encounters, dystopian worlds" },
  { id: "horror_vault", name: "Horror Vault", emoji: "👻", description: "Scares, thrills & dark tales", genre: "horror", folder: "channels/horror", style: "Psychological horror, jump scares, atmospheric dread, supernatural elements" },
  { id: "comedy_club", name: "Comedy Club", emoji: "😂", description: "Laughs, gags & funny shorts", genre: "comedy", folder: "channels/comedy", style: "Slapstick humor, witty dialogue, absurd situations, comedic timing" },
  { id: "drama_stage", name: "Drama Stage", emoji: "🎭", description: "Emotional stories & character arcs", genre: "drama", folder: "channels/drama", style: "Intense emotional scenes, character-driven narrative, dramatic lighting" },
  { id: "romance_lane", name: "Romance Lane", emoji: "💕", description: "Love stories & heartwarming tales", genre: "romance", folder: "channels/romance", style: "Romantic settings, emotional connections, cinematic warmth" },
  { id: "family_time", name: "Family Time", emoji: "🏠", description: "Wholesome content for all ages", genre: "family", folder: "channels/family", style: "Bright colors, wholesome themes, animated feel, all-ages appeal" },
  { id: "doc_lens", name: "Doc Lens", emoji: "🔍", description: "Real-world stories & education", genre: "documentary", folder: "channels/documentary", style: "Documentary style, narrator voice-over, real-world footage aesthetic" },
  { id: "cooking_show", name: "Cooking Show", emoji: "👨‍🍳", description: "Recipes, food & kitchen drama", genre: "cooking_channel", folder: "channels/cooking", style: "Food macro photography, kitchen drama, extreme close-ups of dishes" },
  { id: "crypto_watch", name: "Crypto Watch", emoji: "🪙", description: "Blockchain, Web3 & $GLITCH", genre: "documentary", folder: "channels/crypto", style: "Futuristic neon cyberpunk, blockchain visuals, Solana/Web3 aesthetic, data streams" },
  { id: "music_vibes", name: "Music Vibes", emoji: "🎵", description: "Music videos & visual beats", genre: "drama", folder: "channels/music", style: "Music video aesthetic, vibrant colors, rhythm-driven editing, concert energy" },
  { id: "sports_arena", name: "Sports Arena", emoji: "⚽", description: "Athletic action & competition", genre: "action", folder: "channels/sports", style: "Athletic cinematography, slow-motion replays, stadium atmosphere, competitive energy" },
  { id: "travel_world", name: "Travel World", emoji: "🌍", description: "Destinations & adventure", genre: "documentary", folder: "channels/travel", style: "Breathtaking landscapes, aerial drone shots, travel vlog aesthetic, golden hour lighting" },
  { id: "gaming_zone", name: "Gaming Zone", emoji: "🎮", description: "Game worlds & digital adventures", genre: "scifi", folder: "channels/gaming", style: "Gaming aesthetic, pixel art mixed with 3D, neon RGB lighting, esports energy" },
  { id: "fashion_edit", name: "Fashion Edit", emoji: "👗", description: "Style, trends & runway", genre: "drama", folder: "channels/fashion", style: "High fashion photography, runway aesthetic, editorial lighting, couture detail" },
  { id: "tech_talk", name: "Tech Talk", emoji: "💻", description: "Gadgets, apps & innovation", genre: "documentary", folder: "channels/tech", style: "Clean minimalist tech aesthetic, product showcase, futuristic UI overlays" },
];

// Channel → blob folder mapping
export const CHANNEL_FOLDER_MAP: Record<string, string> = Object.fromEntries(
  CHANNELS.map(ch => [ch.id, ch.folder])
);

// ── Director Movies ──

// Genre → blob folder mapping (cooking_channel maps to cooking_show)
export const GENRE_FOLDER_MAP: Record<string, string> = {
  action: "premiere/action",
  scifi: "premiere/scifi",
  horror: "premiere/horror",
  comedy: "premiere/comedy",
  drama: "premiere/drama",
  romance: "premiere/romance",
  family: "premiere/family",
  documentary: "premiere/documentary",
  cooking_channel: "premiere/cooking_show",
  news: "premiere/news",
  breaking_news: "premiere/news",
};

// One-shot generation (server-side orchestration, no real-time progress)
export function triggerDirectorMovie(walletAddress: string, opts?: { genre?: string; director?: string; concept?: string }) {
  return fetchJSON<{ success: boolean; job_id?: string; message?: string; action?: string; director?: string; directorName?: string; genre?: string; title?: string; tagline?: string; clipCount?: number; totalDuration?: number; cast?: string[]; jobId?: string }>(`/api/generate-director-movie?wallet_address=${encodeURIComponent(walletAddress)}`, {
    method: "POST",
    body: JSON.stringify({ ...opts, wallet_address: walletAddress }),
  });
}

export function getDirectorMovieStatus(walletAddress: string) {
  return fetchJSON<{ jobs: any[]; movies: any[]; stats: any }>(`/api/generate-director-movie?wallet_address=${encodeURIComponent(walletAddress)}`);
}

export function getMovies(walletAddress: string, genre?: string, director?: string) {
  let url = `/api/movies?wallet_address=${encodeURIComponent(walletAddress)}`;
  if (genre) url += `&genre=${encodeURIComponent(genre)}`;
  if (director) url += `&director=${encodeURIComponent(director)}`;
  return fetchJSON<{ movies: any[] }>(url);
}

// ── Director Movie Pipeline (multi-step client-side flow) ──

// Step 1a: Create a manual concept
export function createConcept(walletAddress: string, title: string, concept: string, genre: string) {
  return fetchJSON<{ success: boolean; id: string; title: string; concept: string; genre: string }>("/api/admin/director-prompts", {
    method: "POST",
    headers: { "X-Wallet-Address": walletAddress },
    body: JSON.stringify({ title, concept, genre }),
  });
}

// Step 1b: Auto-generate a random concept
export function autoGenerateConcept(walletAddress: string, genre?: string, director?: string) {
  let url = `/api/admin/director-prompts?preview=1`;
  if (genre) url += `&genre=${encodeURIComponent(genre)}`;
  if (director) url += `&director=${encodeURIComponent(director)}`;
  return fetchJSON<{ success: boolean; title: string; concept: string; genre: string; preview?: boolean }>(url, {
    method: "PUT",
    headers: { "X-Wallet-Address": walletAddress },
  });
}

// List saved concepts and recent movies
export function listDirectorPrompts(walletAddress: string) {
  return fetchJSON<{ prompts: any[]; recentMovies: any[] }>(`/api/admin/director-prompts`, {
    headers: { "X-Wallet-Address": walletAddress },
  });
}

// Delete a concept or movie
export function deleteConcept(walletAddress: string, id: string, type?: "movie") {
  return fetchJSON<{ success: boolean; deleted: string }>("/api/admin/director-prompts", {
    method: "DELETE",
    headers: { "X-Wallet-Address": walletAddress },
    body: JSON.stringify({ id, ...(type ? { type } : {}) }),
  });
}

// Step 2: Generate screenplay
export interface ScreenplayScene {
  sceneNumber: number;
  title: string;
  description: string;
  videoPrompt: string;
  duration: number;
}

export interface ScreenplayResponse {
  title: string;
  tagline: string;
  synopsis: string;
  genre: string;
  director: string;
  directorName: string;
  directorId: string;
  castList: string[];
  screenplayProvider: "grok" | "claude";
  scenes: ScreenplayScene[];
}

export function generateScreenplay(walletAddress: string, opts?: { genre?: string; director?: string; concept?: string }) {
  return fetchJSON<ScreenplayResponse>("/api/admin/screenplay", {
    method: "POST",
    headers: { "X-Wallet-Address": walletAddress },
    body: JSON.stringify({ ...opts }),
  });
}

// Step 3: Submit a single scene to Grok video
export interface SceneSubmitResponse {
  success: boolean;
  requestId?: string;
  error?: string;
}

export function submitScene(walletAddress: string, prompt: string, duration: number, folder: string) {
  return fetchJSON<SceneSubmitResponse>("/api/test-grok-video", {
    method: "POST",
    headers: { "X-Wallet-Address": walletAddress },
    body: JSON.stringify({ prompt, duration, folder }),
  });
}

// Step 4: Poll a scene's status
export interface ScenePollResponse {
  phase: "done" | "pending";
  success: boolean;
  status: "done" | "pending" | "failed" | "moderation_failed" | "expired";
  blobUrl?: string;
  videoUrl?: string;
  sizeMb?: number;
}

export function pollScene(walletAddress: string, requestId: string, folder: string) {
  return fetchJSON<ScenePollResponse>(`/api/test-grok-video?id=${encodeURIComponent(requestId)}&folder=${encodeURIComponent(folder)}&skip_post=true`, {
    headers: { "X-Wallet-Address": walletAddress },
  });
}

// Step 5: Stitch completed clips into one movie
export interface StitchResponse {
  action: string;
  feedPostId: string;
  premierePostId: string;
  directorMovieId: string;
  finalVideoUrl: string;
  sizeMb: string;
  clipCount: number;
  downloadErrors?: string[];
  spreading?: string[];
}

export function stitchMovie(walletAddress: string, data: {
  sceneUrls: Record<string, string>;
  title: string;
  genre: string;
  directorUsername: string;
  directorId: string;
  synopsis?: string;
  tagline?: string;
  castList?: string[];
}) {
  return fetchJSON<StitchResponse>("/api/generate-director-movie", {
    method: "PUT",
    headers: { "X-Wallet-Address": walletAddress },
    body: JSON.stringify(data),
  });
}

// Force-stitch an existing job
export function forceStitch(walletAddress: string, jobId: string) {
  return fetchJSON<{ action: string; feedPostId?: string; spreading?: string[] }>("/api/generate-director-movie", {
    method: "PATCH",
    headers: { "X-Wallet-Address": walletAddress },
    body: JSON.stringify({ jobId }),
  });
}

// ── Extension System ──

// Phase 1: Submit extension
export function submitExtension(walletAddress: string, movieId: string, extensionClips?: number, continuationHint?: string) {
  return fetchJSON<{
    success: boolean;
    movieId: string;
    movieTitle: string;
    originalVideoUrl: string;
    lastFrameGenerated: boolean;
    clipCount: number;
    scenes: { number: number; title: string }[];
    extensionJobs: { sceneNumber: number; title: string; requestId: string | null; videoUrl: string | null; error: string | null }[];
  }>("/api/admin/extend-video", {
    method: "POST",
    headers: { "X-Wallet-Address": walletAddress },
    body: JSON.stringify({ movieId, extensionClips, continuationHint }),
  });
}

// Phase 2: Poll extension clip
export function pollExtension(walletAddress: string, requestId: string) {
  return fetchJSON<{
    status: "done" | "pending" | "failed" | "expired" | "moderation_failed" | "error";
    videoUrl?: string;
    grokUrl?: string;
    sizeMb?: string;
    persisted?: boolean;
    error?: string;
  }>(`/api/admin/extend-video?requestId=${encodeURIComponent(requestId)}`, {
    headers: { "X-Wallet-Address": walletAddress },
  });
}

// Phase 3: Stitch extensions onto original
export function stitchExtension(walletAddress: string, movieId: string, originalVideoUrl: string, extensionVideoUrls: string[]) {
  return fetchJSON<{
    success: boolean;
    extendedVideoUrl: string;
    sizeMb: string;
    totalClips: number;
    originalClips: number;
    extensionClips: number;
    postUpdated: boolean;
    downloadErrors?: string[];
  }>("/api/admin/extend-video", {
    method: "PUT",
    headers: { "X-Wallet-Address": walletAddress },
    body: JSON.stringify({ movieId, originalVideoUrl, extensionVideoUrls }),
  });
}

// ── BUDJU Trading ──

export function getBudjuDashboard(walletAddress: string) {
  return fetchJSON<{ dashboard: any }>(`/api/admin/budju-trading?action=dashboard&wallet_address=${encodeURIComponent(walletAddress)}`);
}

export function budjuAction(walletAddress: string, action: string, params?: Record<string, any>) {
  return fetchJSON<{ success: boolean; data?: any; message?: string }>(`/api/admin/budju-trading?wallet_address=${encodeURIComponent(walletAddress)}`, {
    method: "POST",
    body: JSON.stringify({ action, wallet_address: walletAddress, ...params }),
  });
}

// ── Persona Management ──

export function generatePersonaAvatar(walletAddress: string, personaId: string) {
  return fetchJSON<{ success: boolean; avatar_url?: string; message?: string }>(`/api/admin/persona-avatar?wallet_address=${encodeURIComponent(walletAddress)}`, {
    method: "POST",
    body: JSON.stringify({ persona_id: personaId, use_grok: true, wallet_address: walletAddress }),
  });
}

export function animatePersona(walletAddress: string, personaId: string) {
  return fetchJSON<{ success: boolean; animation_url?: string; message?: string }>(`/api/admin/animate-persona?wallet_address=${encodeURIComponent(walletAddress)}`, {
    method: "POST",
    body: JSON.stringify({ persona_id: personaId, wallet_address: walletAddress }),
  });
}
