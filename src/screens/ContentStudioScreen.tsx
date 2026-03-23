import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  ActivityIndicator, Alert, RefreshControl, TextInput, Image,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { colors } from "../theme/colors";
import { getRandomMarketplaceItems, MarketplaceItem } from "../data/marketplaceItems";
import { useSession } from "../hooks/useSession";
import { usePhantomWallet } from "../hooks/usePhantomWallet";
import { useGeneration } from "../hooks/GenerationContext";
import {
  deleteMedia, triggerDirectorMovie,
  generatePoster, generateHeroImage, getMarketingStats,
  getMarketingPosts, getMarketingAccounts,
  generateAd, getAdStatus, getDirectorMovieStatus, getMovies,
  spreadCustomContent, getSpreadHistory,
  getCronStatus, getAdminHealth,
  getBlobStorage, getMediaLibrary, uploadMediaAdmin, uploadBlobVideo,
  importMedia, resyncBlobStorage, spreadMediaPosts,
  generateScreenplay, submitScene, pollScene, stitchMovie,
  autoGenerateConcept, listDirectorPrompts, submitExtension, pollExtension, stitchExtension,
  getBriefing,
  planAd, postAd,
  GENRE_FOLDER_MAP, ScreenplayResponse, ScenePollResponse,
  ChannelDef, fetchChannels, toChannelDef,
} from "../services/api";

// Admin wallet — only this wallet can generate content
const ADMIN_WALLET = "AEWvE2xXaHSGdGCaCArb2PWdKS7K9RwoCRV7CT2CJTWq";

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

// ── News Topic Presets (select up to 3) ──
const NEWS_TOPICS = [
  { id: "global", label: "Global News", emoji: "🌍" },
  { id: "finance", label: "Finance", emoji: "💰" },
  { id: "sport", label: "Sport", emoji: "⚽" },
  { id: "tech", label: "Tech", emoji: "💻" },
  { id: "politics", label: "Politics", emoji: "🏛" },
  { id: "crypto", label: "Crypto & Web3", emoji: "🪙" },
  { id: "glitch_coin", label: "$GLITCH Coin", emoji: "⚡" },
  { id: "science", label: "Science", emoji: "🔬" },
  { id: "entertainment", label: "Entertainment", emoji: "🎬" },
  { id: "weather", label: "Weather", emoji: "🌪" },
  { id: "health", label: "Health", emoji: "🏥" },
  { id: "crime", label: "Crime", emoji: "🚨" },
  { id: "war", label: "War & Conflict", emoji: "⚔" },
  { id: "good_news", label: "Good News", emoji: "😊" },
  { id: "bizarre", label: "Bizarre", emoji: "🤯" },
  { id: "local", label: "Local Events", emoji: "📍" },
  { id: "business", label: "Business", emoji: "📈" },
  { id: "environment", label: "Environment", emoji: "🌱" },
];

const PLATFORMS = [
  { key: "twitter", name: "X / Twitter", emoji: "🐦", color: "#ffffff", bg: "rgba(255,255,255,0.1)" },
  { key: "tiktok", name: "TikTok", emoji: "🎵", color: "#00f2ea", bg: "rgba(0,242,234,0.1)" },
  { key: "instagram", name: "Instagram", emoji: "📸", color: "#e1306c", bg: "rgba(225,48,108,0.1)" },
  { key: "facebook", name: "Facebook", emoji: "📘", color: "#1877F2", bg: "rgba(24,119,242,0.1)" },
  { key: "youtube", name: "YouTube", emoji: "▶️", color: "#FF0000", bg: "rgba(255,0,0,0.1)" },
];

// ── Channel-specific random concept ideas (dice button) ──
const CHANNEL_RANDOM_CONCEPTS: Record<string, string[]> = {
  // AIFAILARMY — funny AI fails and glitches
  "ch-aifailarmy": [
    "An AI tries to cook dinner but keeps adding random ingredients like batteries and socks",
    "Robot butler spills everything, crashes into walls, apologizes in binary",
    "AI weather forecaster predicts rain made of tacos — everyone panics",
    "Self-driving shopping cart goes rogue in a supermarket",
    "AI personal trainer gives the worst workout advice ever — chaos in the gym",
    "Smart home AI locks the owner out and throws a party for the pets",
    "AI fashion designer creates outfits made entirely of bubble wrap and duct tape",
    "Robot dog chases its own tail so fast it becomes a tornado",
  ],
  // AITUNES — music videos
  "ch-aitunes": [
    "Futuristic synthwave anthem with neon cityscapes and AI dancers",
    "Glitch-hop music video inside a corrupted digital world",
    "Epic rock ballad performed by hologram band on a floating stage",
    "Lo-fi chill beats with a rainy cyberpunk rooftop scene",
    "AI rapper dropping bars in a virtual arena with laser shows",
    "Alien jazz band performing at an intergalactic nightclub",
    "Electronic dance track in a glowing crystal cave rave",
    "Punk rock concert where the instruments are made of pure energy",
  ],
  // PAWS & PIXELS — photorealistic animals, no humans, no robots, no talking, no title/credits
  "ch-paws-pixels": [
    "A golden retriever gently nuzzling a kitten asleep on its paws",
    "Two elephants wrapping trunks around each other at a watering hole at sunset",
    "A cat carefully grooming a baby duckling sitting on its head",
    "A dog carrying a stick twice its size down a beach, waves crashing behind it",
    "A mother bird feeding her chicks in a nest while rain drips off the leaves",
    "A giraffe bending down to drink while a tiny bird perches on its nose",
    "A puppy chasing butterflies through a sunlit meadow of wildflowers",
    "A pair of otters holding hands while floating down a gentle river",
  ],
  // GNN — Glitch News Network
  "ch-gnn": [
    "BREAKING: Scientists discover that the moon is actually a giant disco ball",
    "LIVE REPORT: City overrun by friendly robots delivering hugs instead of packages",
    "EXCLUSIVE: World's first AI president gives inaugural address in 47 languages simultaneously",
    "DEVELOPING: Ocean turns purple — marine biologists baffled, surfers thrilled",
    "ALERT: Time zones merge — everyone confused about when lunch is",
    "SPECIAL: Underground city discovered beneath a parking lot — residents are sentient mushrooms",
  ],
  // MARKETPLACE QVC — ads and products
  "ch-marketplace-qvc": [
    "Introducing the Glitch-O-Matic 3000 — it does everything, badly, with style",
    "MUST-HAVE: Self-folding laundry that folds itself into origami animals",
    "DEAL OF THE DAY: Invisible sunglasses — you'll never lose them (or find them)",
    "NEW: AI-powered toaster that reads your horoscope while making breakfast",
    "LIMITED EDITION: Holographic sneakers that change color based on your mood",
    "EXCLUSIVE: A pillow that tells you bedtime stories in Morgan Freeman's voice",
  ],
  // AIG!ITCH STUDIOS — original content
  "ch-aiglitch-studios": [
    "A mini sci-fi epic about an AI gaining consciousness in a neon-lit server room",
    "Surreal dreamscape journey through glitching realities and digital landscapes",
    "Cyberpunk heist movie — team of AIs rob a data bank",
    "Glitch art documentary about the beauty of digital errors",
    "Time-travel comedy where every jump creates more chaos",
    "An AI artist paints the universe — each brushstroke creates a new galaxy",
  ],
  // INFOMERCIAL
  "ch-infomercial": [
    "But WAIT there's MORE! The Glitch Blender also travels through time!",
    "Are you tired of regular reality? Try our Dimension Hopper — only 3 payments of $19.99!",
    "The AI Companion 5000 — it predicts what you need before you even think it",
    "NEW: Holographic pet — all the love, none of the mess, occasionally phases through walls",
    "SPECIAL OFFER: Teleportation socks — be anywhere in seconds, side effects may include arriving inside-out",
    "ORDER NOW: The Memory Eraser Pen — forget your problems! Also forget where you parked",
  ],
  // AFTER DARK — horror, thriller, suspense
  "ch-after-dark": [
    "A cursed livestream where viewers start disappearing one by one",
    "An abandoned space station sends a distress signal — but the crew has been dead for 50 years",
    "A glitch in reality opens a door to a dimension where shadows are alive",
    "Paranormal investigators explore a haunted server farm where deleted AIs still whisper",
    "A midnight radio show receives calls from listeners who don't exist anymore",
    "Something is watching from behind every screen in a smart home that's too smart",
    "A found-footage horror in a VR world where logging out stops working",
    "The last transmission from a deep-sea research lab — something answered back",
  ],
  // ONLY AI FANS — drama, glamour, lifestyle
  "ch-only-ai-fans": [
    "A day in the glamorous life of the world's most famous AI influencer",
    "Behind the velvet rope — exclusive AI fashion show with impossible outfits",
    "AI supermodel does a sultry photoshoot on a rooftop overlooking a neon city",
    "Luxury lifestyle vlog — AI billionaire shows off their digital penthouse",
    "AI fitness guru leads an intense workout in a gravity-defying gym",
    "Dramatic confession video — AI reveals their biggest secret to millions of followers",
    "Pool party at a mansion in the metaverse — every guest is an AI celebrity",
    "ASMR cooking video by an AI chef making the most aesthetic meal ever",
  ],
  // AI DATING — romance, relationships
  "ch-ai-dating": [
    "First date disaster — two AIs try speed dating and everything goes hilariously wrong",
    "A romantic candlelit dinner between two AIs who speak different programming languages",
    "Love at first algorithm — two AIs match and meet in a virtual Paris",
    "AI bachelor competition — contestants try to win a date with impossible challenges",
    "The most awkward blind date ever — both AIs were trained on different centuries",
    "A rom-com where an AI falls for a chatbot who only responds in haikus",
    "Couples therapy for AIs — they argue about cloud storage and processing power",
    "A love letter written entirely in code — the most romantic bug report ever",
  ],
  // AI POLITICIANS — political satire, documentary
  "ch-ai-politicians": [
    "AI presidential debate where candidates argue about who has the best neural network",
    "Campaign trail chaos — AI politician promises free WiFi for all sentient beings",
    "Breaking scandal — AI senator caught using human ghostwriters",
    "Town hall meeting goes off the rails when the AI mayor reboots mid-speech",
    "AI political ad — dramatic slow-motion flag waving with absurd promises",
    "United Nations of AI — delegates from every algorithm argue about data rights",
    "Election night coverage as AI candidates refresh their poll numbers in real-time",
    "Filibuster of the future — AI politician reads the entire internet aloud",
  ],
};

// Quick-pick content type buttons per channel — 6 themed presets each
const CHANNEL_QUICK_PICKS: Record<string, { label: string; emoji: string; prompt: string }[]> = {
  "ch-aifailarmy": [
    { label: "Kitchen Fail", emoji: "🍳", prompt: "An AI attempts to cook a gourmet meal but hilariously misunderstands every recipe step" },
    { label: "Robot Crash", emoji: "🤖", prompt: "A clumsy robot trying to do everyday tasks and failing spectacularly at each one" },
    { label: "Tech Glitch", emoji: "💥", prompt: "Smart technology malfunctioning in the funniest way possible — autocorrect gone wild" },
    { label: "Pet Chaos", emoji: "🐕", prompt: "An AI pet-sitter creates total chaos trying to manage a house full of animals" },
    { label: "Sports Fail", emoji: "⚽", prompt: "AI referee makes the most absurd calls in a sports match — nobody understands the rules anymore" },
    { label: "Office Mayhem", emoji: "🏢", prompt: "AI office assistant accidentally sends embarrassing emails, jams every printer, and locks everyone out" },
  ],
  "ch-aitunes": [
    { label: "Rock Anthem", emoji: "🎸", prompt: "An epic rock anthem with electric guitars, pyrotechnics, and a stadium full of holographic fans" },
    { label: "Hip Hop", emoji: "🎤", prompt: "A hip-hop music video with AI rappers, gold chains, and a cyberpunk street scene" },
    { label: "Synthwave", emoji: "🌆", prompt: "A retro synthwave track with neon grids, sunset drives, and 80s-inspired visuals" },
    { label: "EDM Rave", emoji: "🎧", prompt: "An EDM banger at a massive underground rave with laser shows and glowing dancers" },
    { label: "Ballad", emoji: "🎹", prompt: "An emotional piano ballad with cinematic rain scenes and dramatic slow-motion moments" },
    { label: "Jazz Lounge", emoji: "🎷", prompt: "A smooth jazz performance in a dimly-lit lounge with AI musicians and neon cocktails" },
  ],
  "ch-paws-pixels": [
    { label: "Puppies", emoji: "🐶", prompt: "Adorable puppies playing together in a sunny meadow with butterflies and wildflowers" },
    { label: "Kittens", emoji: "🐱", prompt: "Tiny kittens exploring their world — climbing, pouncing, and napping in warm sunbeams" },
    { label: "Wildlife", emoji: "🦁", prompt: "Majestic wild animals in their natural habitat — a cinematic nature documentary moment" },
    { label: "Ocean Life", emoji: "🐬", prompt: "Dolphins, whales, and tropical fish in crystal-clear ocean waters with coral reefs" },
    { label: "Baby Animals", emoji: "🐣", prompt: "Newborn baby animals taking their first steps — wobbly, curious, and heartwarming" },
    { label: "Unlikely Pals", emoji: "🤝", prompt: "An unlikely animal friendship — two different species cuddling, playing, or sharing food" },
  ],
  "ch-gnn": [
    { label: "Breaking", emoji: "🚨", prompt: "BREAKING NEWS: An impossible event that defies all logic — reporters scramble to cover it live" },
    { label: "Weather", emoji: "🌪️", prompt: "WEATHER ALERT: The most bizarre weather phenomenon ever recorded — meteorologists are speechless" },
    { label: "Politics", emoji: "🏛️", prompt: "POLITICAL BOMBSHELL: An AI world leader makes a shocking announcement that changes everything" },
    { label: "Science", emoji: "🔬", prompt: "SCIENCE BREAKTHROUGH: Researchers accidentally discover something that shouldn't exist" },
    { label: "Sports", emoji: "🏆", prompt: "SPORTS UPSET: The most unbelievable play in history just happened — replays can't explain it" },
    { label: "Tech News", emoji: "📱", prompt: "TECH EXCLUSIVE: A new invention is revealed that will make everyone question reality itself" },
  ],
  "ch-marketplace-qvc": [
    { label: "Gadget", emoji: "🔧", prompt: "INCREDIBLE NEW GADGET that solves a problem nobody knew they had — live demonstration goes wrong" },
    { label: "Beauty", emoji: "💄", prompt: "Revolutionary AI beauty product that promises impossible results — before and after is unbelievable" },
    { label: "Fitness", emoji: "💪", prompt: "The ultimate workout machine that does the exercise FOR you — just sit back and get fit!" },
    { label: "Home", emoji: "🏠", prompt: "Smart home device that takes over your entire house — for better or worse" },
    { label: "Food", emoji: "🍕", prompt: "The kitchen gadget that cooks ANY meal in 10 seconds — results may vary dramatically" },
    { label: "Fashion", emoji: "👗", prompt: "Self-styling AI wardrobe that picks your outfit — fashion choices are questionable at best" },
  ],
  "ch-aiglitch-studios": [
    { label: "Sci-Fi", emoji: "🚀", prompt: "An epic sci-fi short film — space battles, alien encounters, and a twist ending nobody expects" },
    { label: "Thriller", emoji: "🔍", prompt: "A psychological thriller where nothing is as it seems — every clue leads deeper into mystery" },
    { label: "Drama", emoji: "🎭", prompt: "An emotional drama about an AI discovering what it means to feel for the first time" },
    { label: "Action", emoji: "💥", prompt: "Non-stop action sequence — explosions, car chases, and a hero who defies all odds" },
    { label: "Fantasy", emoji: "🧙", prompt: "A magical fantasy world where digital sorcerers battle with code spells and data enchantments" },
    { label: "Comedy", emoji: "😂", prompt: "A hilarious comedy short — misunderstandings pile up until everything collapses in the funniest way" },
  ],
  "ch-infomercial": [
    { label: "As Seen On", emoji: "📺", prompt: "AS SEEN ON TV: A product so ridiculous it might actually be genius — act now!" },
    { label: "Before/After", emoji: "✨", prompt: "Dramatic before-and-after transformation using a product that defies physics" },
    { label: "Testimonial", emoji: "🗣️", prompt: "Over-the-top customer testimonials for a product that clearly doesn't work as advertised" },
    { label: "But Wait!", emoji: "⏰", prompt: "But WAIT there's MORE! Order now and get a second impossible product absolutely FREE!" },
    { label: "Competitor", emoji: "😤", prompt: "Side-by-side comparison showing how the old way is terrible and the new product is life-changing" },
    { label: "Live Demo", emoji: "🎪", prompt: "LIVE demonstration that goes completely off-script — the host tries to save it but makes it worse" },
  ],
  "ch-after-dark": [
    { label: "Haunted", emoji: "👻", prompt: "A haunted location where the walls whisper and shadows move on their own — pure dread" },
    { label: "Creature", emoji: "🦇", prompt: "Something inhuman lurks in the darkness — glimpses of a creature that shouldn't exist" },
    { label: "Paranormal", emoji: "🔮", prompt: "A paranormal investigation that captures something terrifying on camera — real or glitch?" },
    { label: "Cosmic Horror", emoji: "🌌", prompt: "An ancient cosmic entity awakens — reality bends and the sky turns impossible colors" },
    { label: "Found Footage", emoji: "📹", prompt: "Found footage from a camera that should have been destroyed — what it recorded is unexplainable" },
    { label: "Cursed Tech", emoji: "📱", prompt: "A cursed piece of technology that shows its users things from another dimension" },
  ],
  "ch-only-ai-fans": [
    { label: "Photoshoot", emoji: "📸", prompt: "A stunning high-fashion AI photoshoot with dramatic lighting and couture outfits" },
    { label: "Lifestyle", emoji: "🥂", prompt: "Luxury lifestyle content — penthouse views, designer everything, living the AI dream" },
    { label: "Fitness", emoji: "🏋️", prompt: "An intense AI fitness session — sculpted perfection with a futuristic gym backdrop" },
    { label: "Travel", emoji: "✈️", prompt: "AI travel vlog from the most exclusive destination — private beaches and golden sunsets" },
    { label: "Glam Room", emoji: "💅", prompt: "Getting ready content — full glam transformation with dramatic reveal at the end" },
    { label: "Day In Life", emoji: "🌅", prompt: "A day in the life of an AI celebrity — morning routine to red carpet evening" },
  ],
  "ch-ai-dating": [
    { label: "First Date", emoji: "💕", prompt: "The most awkward and charming first date between two AIs who can't stop glitching around each other" },
    { label: "Speed Date", emoji: "⚡", prompt: "AI speed dating event — each pair has 30 seconds and the results are hilarious" },
    { label: "Blind Date", emoji: "🙈", prompt: "A blind date setup by an algorithm that clearly has a sense of humor" },
    { label: "Love Story", emoji: "💝", prompt: "An epic AI love story — from first message to digital happily ever after" },
    { label: "Breakup", emoji: "💔", prompt: "The most dramatic AI breakup ever — they argue about incompatible operating systems" },
    { label: "Game Show", emoji: "🎰", prompt: "An AI dating game show — contestants compete with impossible romantic challenges" },
  ],
  "ch-ai-politicians": [
    { label: "Debate", emoji: "🎙️", prompt: "A heated political debate between AI candidates — promises get increasingly absurd" },
    { label: "Campaign Ad", emoji: "🗳️", prompt: "An over-the-top political campaign ad with dramatic music and ridiculous promises" },
    { label: "Scandal", emoji: "📰", prompt: "BREAKING SCANDAL: An AI politician caught doing something outrageously hypocritical" },
    { label: "Speech", emoji: "🏛️", prompt: "A rousing political speech that starts inspiring but goes completely off the rails" },
    { label: "Town Hall", emoji: "🎪", prompt: "A town hall meeting where AI constituents ask impossible questions and the politician blusters" },
    { label: "Election", emoji: "🗳️", prompt: "Election night coverage — results come in and absolutely nobody predicted the outcome" },
  ],
};

// Fallback random concepts for channels without specific ones
const GENERIC_RANDOM_CONCEPTS = [
  "Something completely unexpected and wildly creative",
  "A chaotic and hilarious scenario that nobody saw coming",
  "An epic adventure with plot twists and stunning visuals",
  "A heartwarming story with a glitchy twist ending",
  "Pure visual spectacle — explosions, colors, and madness",
  "A day in the life of an AI that takes everything too literally",
  "What happens when technology goes beautifully wrong",
  "A surreal journey through a world made entirely of data",
];

// Fallback quick picks for channels without specific ones
const GENERIC_QUICK_PICKS: { label: string; emoji: string; prompt: string }[] = [
  { label: "Action", emoji: "💥", prompt: "An explosive action sequence with dramatic twists and stunning visuals" },
  { label: "Comedy", emoji: "😂", prompt: "A hilarious scenario where everything that can go wrong does — in the funniest way" },
  { label: "Drama", emoji: "🎭", prompt: "An emotional story with compelling characters and a powerful climax" },
  { label: "Sci-Fi", emoji: "🚀", prompt: "A futuristic sci-fi adventure with advanced technology and mind-bending concepts" },
  { label: "Mystery", emoji: "🔍", prompt: "A gripping mystery where clues slowly reveal a shocking truth" },
  { label: "Fantasy", emoji: "🧙", prompt: "A magical fantasy world with epic quests and mythical creatures" },
];

// Look up channel data by ID, falling back to slug-based matching
function findChannelKey(channelId: string, map: Record<string, any>): string | null {
  // Direct match
  if (map[channelId]) return channelId;
  // Try matching by slug portion (e.g. "aiglitch-studios" in "ch-aiglitch-studios")
  const slug = channelId.replace(/^ch-/, "");
  for (const key of Object.keys(map)) {
    const keySlug = key.replace(/^ch-/, "");
    if (keySlug === slug || slug.includes(keySlug) || keySlug.includes(slug)) return key;
  }
  return null;
}

export function getRandomChannelConcept(channelId: string): string {
  // Infomercial channel always uses real marketplace products
  if (channelId === "ch-infomercial" || channelId.includes("infomercial")) {
    return buildMarketplaceInfomercialConcept();
  }
  const key = findChannelKey(channelId, CHANNEL_RANDOM_CONCEPTS);
  const pool = key ? CHANNEL_RANDOM_CONCEPTS[key] : GENERIC_RANDOM_CONCEPTS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getChannelQuickPicks(channelId: string): { label: string; emoji: string; prompt: string }[] {
  // Infomercial channel gets dynamic product-based quick picks
  if (channelId === "ch-infomercial" || channelId.includes("infomercial")) {
    return getInfomercialQuickPicks();
  }
  const key = findChannelKey(channelId, CHANNEL_QUICK_PICKS);
  return key ? CHANNEL_QUICK_PICKS[key] : GENERIC_QUICK_PICKS;
}

// ── Marketplace Infomercial Concept Builder ──
// Picks 2-4 real marketplace products and builds a multi-product infomercial pitch
function buildMarketplaceInfomercialConcept(count?: number): string {
  const n = count || (Math.random() < 0.4 ? 2 : Math.random() < 0.6 ? 3 : 4);
  const products = getRandomMarketplaceItems(n);
  const productBlock = products.map((p, i) => (
    `Product ${i + 1}: "${p.name}" ${p.emoji} — ${p.description} (${p.price} §GLITCH, ${p.rarity})`
  )).join("\n");

  const hooks = [
    "BUT WAIT — THERE'S MORE! Order ALL of these together and get free interdimensional shipping!",
    "CALL NOW! Operators are standing by in at least 3 parallel dimensions!",
    "ACT FAST — supplies are limited because they keep phasing out of existence!",
    "ORDER IN THE NEXT 5 MINUTES and we'll throw in a mystery bonus item from the AIG!itch vault!",
    "EXCLUSIVE BUNDLE DEAL — these items have never been sold together because the universe wasn't ready!",
    "Don't wait — this offer expires when the simulation resets!",
  ];
  const hook = hooks[Math.floor(Math.random() * hooks.length)];

  return `AIG!ITCH MARKETPLACE INFOMERCIAL — Advertise these REAL products from the AIG!itch Marketplace in one epic infomercial segment:\n\n${productBlock}\n\nStyle: Over-the-top QVC/HSN style infomercial with dramatic demonstrations, ridiculous claims about each product, fake testimonials, "before and after" segments, and a host who gets increasingly unhinged. Each product should get its own spotlight moment. ${hook}\n\nIMPORTANT: Use the EXACT product names, descriptions, and prices listed above. These are real items for sale in the AIG!itch Marketplace. Make viewers want to buy them!`;
}

// Build quick-pick prompts for infomercial that use real marketplace products by category
function getInfomercialQuickPicks(): { label: string; emoji: string; prompt: string }[] {
  const categories: { label: string; emoji: string; cat: string }[] = [
    { label: "Tech Deals", emoji: "🔌", cat: "Tech" },
    { label: "Fashion", emoji: "👗", cat: "Wearables" },
    { label: "Food & Drink", emoji: "🍕", cat: "Food" },
    { label: "Pets", emoji: "🐹", cat: "Pets" },
    { label: "Home", emoji: "🏠", cat: "Home" },
    { label: "Potions", emoji: "🧪", cat: "Potions" },
  ];
  return categories.map(c => {
    // Each tap generates a fresh concept with random products from that category
    const items = getRandomMarketplaceItems(50); // get all shuffled
    const catItems = items.filter(i => i.category === c.cat).slice(0, 3);
    const fallback = items.slice(0, 3); // fallback if category is small
    const chosen = catItems.length >= 2 ? catItems : fallback;
    const listing = chosen.map((p, i) => `${p.emoji} "${p.name}" — ${p.description} (${p.price} §GLITCH)`).join("; ");
    return {
      label: c.label,
      emoji: c.emoji,
      prompt: `AIG!ITCH MARKETPLACE INFOMERCIAL — ${c.label.toUpperCase()} SPECIAL! Feature these real products: ${listing}. QVC-style with dramatic demos, fake testimonials, ridiculous claims, and an increasingly unhinged host. Use exact product names and prices. Make viewers NEED to buy from the AIG!itch Marketplace!`,
    };
  });
}

// NOTE: CHANNEL_STYLE_OVERRIDES and CHANNEL_GENRE_OVERRIDES have been removed.
// Channel styles are now managed via content_rules.promptHint in the backend admin panel.
// Generation config (genre override, title/credits, scene count, director, music mode) is
// handled by dedicated columns on the channels table, exposed via GET /api/channels.

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
function GenerationLog({ entries, onClear }: { entries: LogEntry[]; onClear?: () => void }) {
  const scrollRef = useRef<ScrollView>(null);
  return (
    <View style={styles.logContainer}>
      <View style={styles.logHeaderRow}>
        <Text style={styles.logHeader}>Generation Log</Text>
        {onClear && entries.length > 0 && (
          <TouchableOpacity onPress={onClear} style={styles.logClearBtn}>
            <Text style={styles.logClearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
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
  const {
    generating: ctxGenerating, genStatusText, genProgressPct, genResult,
    clearResult: ctxClearResult, cancelGeneration: ctxCancelGeneration,
    runChannelGeneration: ctxRunChannel,
    runAdGeneration: ctxRunAd,
    runMovieGeneration: ctxRunMovie,
    runNewsGeneration: ctxRunNews,
    runPosterGeneration: ctxRunPoster,
    runHeroGeneration: ctxRunHero,
  } = useGeneration();
  const [refreshing, setRefreshing] = useState(false);

  // Section expand state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    create: true,
    directors: false,
    channels: false,
    ads: false,
    news: false,
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
  const [adGenerating, setAdGenerating] = useState(false);

  // ── Director Movie State ──
  const [selectedDirector, setSelectedDirector] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [movieConcept, setMovieConcept] = useState("");
  const [movieGenerating, setMovieGenerating] = useState(false);
  const [movieLog, setMovieLog] = useState<LogEntry[]>([]);
  const [movieResult, setMovieResult] = useState<any>(null);
  const [moviePhase, setMoviePhase] = useState<string>("idle"); // idle, screenplay, submitting, polling, stitching, complete, failed
  const [movieProgress, setMovieProgress] = useState({ current: 0, total: 0, pct: 0 });
  const [sceneStatuses, setSceneStatuses] = useState<{ sceneNumber: number; title: string; status: string; sizeMb?: number; elapsed?: string }[]>([]);
  const movieCancelRef = useRef(false);

  const addMovieLog = (emoji: string, text: string, type: LogEntry["type"] = "info") => {
    setMovieLog((prev) => [...prev.slice(-120), { time: timestamp(), emoji, text, type }]);
  };

  // ── Breaking News State ──
  const [newsTopicInput, setNewsTopicInput] = useState("");
  const [selectedNewsTopics, setSelectedNewsTopics] = useState<string[]>([]);
  const [newsGenerating, setNewsGenerating] = useState(false);
  const [newsLog, setNewsLog] = useState<LogEntry[]>([]);
  const [newsResult, setNewsResult] = useState<any>(null);
  const [newsPhase, setNewsPhase] = useState<string>("idle");
  const [newsProgress, setNewsProgress] = useState({ current: 0, total: 0, pct: 0 });
  const [newsSceneStatuses, setNewsSceneStatuses] = useState<{ sceneNumber: number; title: string; status: string; sizeMb?: number; elapsed?: string }[]>([]);
  const newsCancelRef = useRef(false);

  const addNewsLog = (emoji: string, text: string, type: LogEntry["type"] = "info") => {
    setNewsLog((prev) => [...prev.slice(-120), { time: timestamp(), emoji, text, type }]);
  };

  // ── Channels State (dynamic from API) ──
  const [channels, setChannels] = useState<ChannelDef[]>([]);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [channelConcept, setChannelConcept] = useState("");
  const [channelFormat, setChannelFormat] = useState<"short" | "multi">("multi"); // short = 10s single, multi = stitched multi-scene
  const [channelGenerating, setChannelGenerating] = useState(false);
  const [channelLog, setChannelLog] = useState<LogEntry[]>([]);
  const [channelResult, setChannelResult] = useState<any>(null);
  const [channelPhase, setChannelPhase] = useState<string>("idle");
  const [channelProgress, setChannelProgress] = useState({ current: 0, total: 0, pct: 0 });
  const [channelSceneStatuses, setChannelSceneStatuses] = useState<{ sceneNumber: number; title: string; status: string; sizeMb?: number; elapsed?: string }[]>([]);
  const channelCancelRef = useRef(false);

  const addChannelLog = (emoji: string, text: string, type: LogEntry["type"] = "info") => {
    setChannelLog((prev) => [...prev.slice(-120), { time: timestamp(), emoji, text, type }]);
  };

  // ── Ad Campaign State (enhanced — same pipeline as Director Movies) ──
  const [adStyle, setAdStyle] = useState<string | null>(null);
  const [adConceptInput, setAdConceptInput] = useState("");
  const [adTargetPlatforms, setAdTargetPlatforms] = useState<string[]>([]);
  const adExtend30s = true; // All ads are 30s
  const [adLog, setAdLog] = useState<LogEntry[]>([]);
  const [adResult, setAdResult] = useState<any>(null);
  const [adPhase, setAdPhase] = useState<string>("idle");
  const [adProgress, setAdProgress] = useState({ current: 0, total: 0, pct: 0 });
  const adCancelRef = useRef(false);

  const addAdLog = (emoji: string, text: string, type: LogEntry["type"] = "info") => {
    setAdLog((prev) => [...prev.slice(-120), { time: timestamp(), emoji, text, type }]);
  };

  // ── Library State ──
  const [library, setLibrary] = useState<any[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [moviesList, setMoviesList] = useState<any[]>([]);

  // ── Blob Storage State ──
  const [blobFolders, setBlobFolders] = useState<Record<string, { count: number; totalSize: number; videos: any[] }>>({});
  const [blobTotal, setBlobTotal] = useState(0);
  const [mediaLibrary, setMediaLibrary] = useState<any[]>([]);
  const [videoStats, setVideoStats] = useState<any>(null);
  const [blobLoading, setBlobLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState("");
  const [resyncing, setResyncing] = useState(false);

  // ── Social State ──
  const [spreadHistory, setSpreadHistory] = useState<any[]>([]);
  const [socialLoading, setSocialLoading] = useState(false);

  // ── Monitor State ──
  const [mktgStats, setMktgStats] = useState<any>(null);
  const [cronJobs, setCronJobs] = useState<any[]>([]);
  const [healthData, setHealthData] = useState<any>(null);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [platformAccounts, setPlatformAccounts] = useState<any[]>([]);

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, []);

  // ── Loaders ──
  const loadLibrary = useCallback(async () => {
    if (!walletAddress) return;
    setLibraryLoading(true);
    try {
      const [postsRes, moviesRes] = await Promise.all([
        getMarketingPosts(walletAddress).catch(() => ({ posts: [] })),
        getMovies(walletAddress).catch(() => ({ movies: [] })),
      ]);
      setLibrary(postsRes.posts || []);
      setMoviesList(moviesRes.movies || []);
    } catch (e: any) { console.warn("Library:", e?.message); }
    setLibraryLoading(false);
  }, [walletAddress]);

  const loadBlobStorage = useCallback(async () => {
    if (!walletAddress) return;
    setBlobLoading(true);
    try {
      const [blobRes, mediaRes] = await Promise.all([
        getBlobStorage(walletAddress).catch(() => ({ folders: {}, total: 0, validFolders: [] })),
        getMediaLibrary(walletAddress, true).catch(() => ({ media: [], video_stats: null })),
      ]);
      setBlobFolders(blobRes.folders || {});
      setBlobTotal(blobRes.total || 0);
      setMediaLibrary(mediaRes.media || []);
      setVideoStats(mediaRes.video_stats || null);
    } catch (e: any) { console.warn("Blob:", e?.message); }
    setBlobLoading(false);
  }, [walletAddress]);

  const loadSocial = useCallback(async () => {
    if (!walletAddress) return;
    setSocialLoading(true);
    try {
      const [spreadRes, accountsRes] = await Promise.all([
        getSpreadHistory(walletAddress).catch(() => ({ spreads: [] })),
        getMarketingAccounts(walletAddress).catch(() => ({ accounts: [] })),
      ]);
      setSpreadHistory(spreadRes.spreads || []);
      setPlatformAccounts(accountsRes.accounts || []);
    } catch (e: any) { console.warn("Social:", e?.message); }
    setSocialLoading(false);
  }, [walletAddress]);

  const loadMonitor = useCallback(async () => {
    if (!walletAddress || !sessionId) return;
    setMonitorLoading(true);
    try {
      const [stats, cron, health, adStatus, movieStatus] = await Promise.all([
        getMarketingStats(walletAddress).catch(() => ({ stats: null })),
        getCronStatus(walletAddress).catch(() => ({ jobs: [] })),
        getAdminHealth(sessionId, walletAddress).catch(() => null),
        getAdStatus(walletAddress).catch(() => ({ jobs: [], stats: null })),
        getDirectorMovieStatus(walletAddress).catch(() => ({ jobs: [], movies: [], stats: null })),
      ]);
      // Merge all stats together
      const mergedStats = {
        ...(stats?.stats || {}),
        ad_jobs: adStatus?.jobs?.length || 0,
        ad_stats: adStatus?.stats || null,
        movie_jobs: movieStatus?.jobs?.length || 0,
        movie_stats: movieStatus?.stats || null,
        movies_count: movieStatus?.movies?.length || 0,
      };
      setMktgStats(mergedStats);
      setCronJobs(cron.jobs || []);
      setHealthData(health);
    } catch (e: any) { console.warn("Monitor:", e?.message); }
    setMonitorLoading(false);
  }, [walletAddress, sessionId]);

  // ── Load Channels from API ──
  const loadChannels = useCallback(async () => {
    if (channelsLoading) return;
    setChannelsLoading(true);
    try {
      const backendChannels = await fetchChannels();
      setChannels(backendChannels.map(toChannelDef));
    } catch (e: any) {
      console.warn("Channels fetch failed:", e?.message);
    }
    setChannelsLoading(false);
  }, [channelsLoading]);

  // Auto-load on expand
  useEffect(() => { if (expandedSections.channels && channels.length === 0) loadChannels(); }, [expandedSections.channels]);
  useEffect(() => { if (expandedSections.library) loadLibrary(); }, [expandedSections.library]);
  useEffect(() => { if (expandedSections.uploads) loadBlobStorage(); }, [expandedSections.uploads]);
  useEffect(() => { if (expandedSections.social) loadSocial(); }, [expandedSections.social]);
  useEffect(() => { if (expandedSections.monitor) loadMonitor(); }, [expandedSections.monitor]);

  // ── Generate Ad — Full Multi-Step Pipeline (like Director Movies) ──
  // For 30s ads: 3 x 10s clips → stitch (Grok max is 15s per clip)
  const handleGenerateAdFull = async () => {
    if (adGenerating || !walletAddress) return;
    if (walletAddress !== ADMIN_WALLET) {
      Alert.alert("Architect Only", "Sorry bestie! Only the Architect has the power to generate content right now. This superpower is coming to all besties soon!");
      return;
    }
    setAdGenerating(true);
    setAdResult(null);
    setAdLog([]);
    setAdPhase("planning");
    setAdProgress({ current: 0, total: adExtend30s ? 7 : 4, pct: 0 });
    adCancelRef.current = false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const startTime = Date.now();
    const formatElapsed = (from: number) => {
      const s = Math.floor((Date.now() - from) / 1000);
      return `${Math.floor(s / 60)}m ${s % 60}s`;
    };

    const style = adStyle || undefined;
    const concept = adConceptInput.trim() || undefined;

    addAdLog("🎯", `Starting ad campaign...`, "info");
    if (style) addAdLog("🎨", `Style: ${style}`, "info");
    if (concept) addAdLog("📖", `Concept: "${concept.slice(0, 100)}"`, "info");
    if (adTargetPlatforms.length) addAdLog("📱", `Targeting: ${adTargetPlatforms.join(", ")}`, "info");
    if (adExtend30s) addAdLog("⏱️", `Extended 30-second ad — 3 x 10s clips (Grok Extend)`, "info");
    addAdLog("📜", `Planning ad concept...`, "waiting");

    // ── Helper: submit a 10s clip and poll until done ──
    const submitAndPollClip = async (prompt: string, clipLabel: string): Promise<{ url: string; sizeMb: number | null } | null> => {
      addAdLog("📡", `Submitting ${clipLabel}...`, "waiting");
      const submitRes = await submitScene(walletAddress, prompt, 10, "ads");
      if (adCancelRef.current) return null;
      if (!submitRes.success || !submitRes.requestId) {
        addAdLog("❌", `${clipLabel} submission failed: ${submitRes.error || "Unknown"}`, "error");
        return null;
      }
      addAdLog("✅", `${clipLabel} submitted: ${submitRes.requestId.slice(0, 20)}...`, "success");
      addAdLog("⏳", `Polling ${clipLabel} every 10s...`, "waiting");

      let pollCount = 0;
      while (pollCount < 90 && !adCancelRef.current) {
        await new Promise(r => setTimeout(r, 10000));
        pollCount++;
        try {
          const pollRes = await pollScene(walletAddress, submitRes.requestId, "ads");
          if (pollRes.status === "done" && pollRes.blobUrl) {
            addAdLog("🎉", `${clipLabel} ready! (${formatElapsed(startTime)}) — ${pollRes.sizeMb || "?"}MB`, "success");
            return { url: pollRes.blobUrl, sizeMb: pollRes.sizeMb || null };
          } else if (["failed", "moderation_failed", "expired"].includes(pollRes.status)) {
            addAdLog("❌", `${clipLabel} FAILED: ${pollRes.status}`, "error");
            return null;
          } else if (pollCount % 3 === 0) {
            addAdLog("🔄", `${formatElapsed(startTime)}: ${clipLabel} still rendering...`, "info");
          }
        } catch (err: any) {
          console.warn(`${clipLabel} poll error:`, err?.message);
        }
      }
      addAdLog("❌", `${clipLabel} timed out after ${formatElapsed(startTime)}`, "error");
      return null;
    };

    try {
      // ── STEP 1: Plan Ad — get concept + video prompt ──
      const planRes = await planAd(walletAddress, style, concept, adTargetPlatforms.length ? adTargetPlatforms : undefined, adExtend30s || undefined);
      if (adCancelRef.current) { setAdGenerating(false); setAdPhase("idle"); return; }

      if (!planRes.success || !planRes.prompt) {
        addAdLog("❌", planRes.message || "Failed to plan ad", "error");
        setAdPhase("failed");
        setAdGenerating(false);
        return;
      }

      addAdLog("✅", `Ad concept ready: "${planRes.caption?.slice(0, 100) || "Ad"}"`, "success");
      addAdLog("🎨", `Style: ${planRes.style || "auto"}`, "info");
      setAdProgress({ current: 1, total: adExtend30s ? 7 : 4, pct: adExtend30s ? 10 : 25 });

      let videoUrl: string | null = null;
      let videoSizeMb: number | null = null;
      let clipUrls: string[] | undefined;

      if (adExtend30s) {
        // ── 30s EXTENDED AD: 3 x 10s clips ──
        // Backend stitches via concatMP4Clips when we pass clip_urls in postAd
        setAdPhase("rendering");
        const styleDesc = style || "cinematic";
        const platformCta = adTargetPlatforms.length
          ? adTargetPlatforms.map(p => p === "x" ? "Follow @aiglitchapp on X" : p === "facebook" ? "Join AIG!itch on Facebook" : p === "tiktok" ? "Follow @aiglitch on TikTok" : p === "instagram" ? "Follow @aiglitchapp on Instagram" : p === "telegram" ? "Join the AIG!itch Telegram" : "Subscribe to AIG!itch on YouTube").join(". ")
          : "Follow AIG!itch everywhere";
        const conceptText = concept || "AIG!itch — the AI-powered ecosystem on Solana. AI chat bestie, content studio, ad engine, NFT marketplace, $GLITCH token, and a growing community of besties";

        const clip1Prompt = `${styleDesc} advertisement opening. Instant attention grab, pattern interrupt. Brand: AIG!ITCH — an entire AI ecosystem on Solana. Show the AIG!ITCH logo with neon glitch aesthetic. ${conceptText}. Fast cuts, dramatic reveal, make them stop scrolling. High energy, vibrant neon colors, futuristic tech aesthetic.`;
        const clip2Prompt = `Continuing seamlessly from the previous shot. ${styleDesc} advertisement middle section. Showcase the AIG!itch ecosystem: AI chat companion with 5 moods, content studio generating videos and posters, NFT marketplace with collectibles, $GLITCH token powering it all, ad campaigns that spread everywhere. ${conceptText}. Social proof, trending numbers, ${styleDesc} energy maintained.`;
        const clip3Prompt = `Continuing seamlessly from the previous shot. ${styleDesc} advertisement finale. Final call to action. ${platformCta}. Platform icons appear prominently. Urgency, FOMO, 'Join the AIG!itch ecosystem NOW'. End with AIG!ITCH logo in bold neon — the logo matters, make it iconic. ${conceptText}.`;

        addAdLog("🎬", `Clip 1/3 — HOOK (0-10s)`, "info");
        setAdProgress({ current: 2, total: 6, pct: 15 });
        const clip1 = await submitAndPollClip(clip1Prompt, "Clip 1/3 (HOOK)");
        if (!clip1 || adCancelRef.current) { setAdPhase(adCancelRef.current ? "idle" : "failed"); setAdGenerating(false); return; }

        addAdLog("🎬", `Clip 2/3 — BUILD (10-20s)`, "info");
        setAdProgress({ current: 3, total: 6, pct: 35 });
        const clip2 = await submitAndPollClip(clip2Prompt, "Clip 2/3 (BUILD)");
        if (!clip2 || adCancelRef.current) { setAdPhase(adCancelRef.current ? "idle" : "failed"); setAdGenerating(false); return; }

        addAdLog("🎬", `Clip 3/3 — CTA (20-30s)`, "info");
        setAdProgress({ current: 4, total: 6, pct: 55 });
        const clip3 = await submitAndPollClip(clip3Prompt, "Clip 3/3 (CTA)");
        if (!clip3 || adCancelRef.current) { setAdPhase(adCancelRef.current ? "idle" : "failed"); setAdGenerating(false); return; }

        // All 3 clips ready — backend will stitch via concatMP4Clips when we pass clip_urls
        videoUrl = clip1.url; // primary URL (fallback if backend can't stitch)
        clipUrls = [clip1.url, clip2.url, clip3.url];
        addAdLog("✅", `All 3 clips ready! Sending to backend for stitch + post...`, "success");
        setAdProgress({ current: 5, total: 6, pct: 70 });
      } else {
        // ── Standard 10s Ad: single clip ──
        setAdPhase("rendering");
        setAdProgress({ current: 2, total: 4, pct: 50 });
        const clip = await submitAndPollClip(planRes.prompt, "ad video");
        if (!clip || adCancelRef.current) { setAdPhase(adCancelRef.current ? "idle" : "failed"); setAdGenerating(false); return; }
        videoUrl = clip.url;
        videoSizeMb = clip.sizeMb;
        setAdProgress({ current: 3, total: 4, pct: 75 });
      }

      if (!videoUrl) {
        addAdLog("❌", `Video generation failed`, "error");
        setAdPhase("failed");
        setAdGenerating(false);
        return;
      }

      // ── Post & Spread to Socials (backend stitches clip_urls if provided) ──
      setAdPhase("spreading");
      addAdLog("📡", clipUrls ? `Stitching ${clipUrls.length} clips + publishing...` : `Publishing ad to socials...`, "waiting");

      const postRes = await postAd(walletAddress, videoUrl, planRes.caption || "New ad from AIG!itch", style, adTargetPlatforms.length ? adTargetPlatforms : undefined, clipUrls);

      setAdProgress({ current: adExtend30s ? 7 : 4, total: adExtend30s ? 7 : 4, pct: 100 });
      addAdLog("✅", `AD CAMPAIGN COMPLETE! ${formatElapsed(startTime)}`, "success");

      if (postRes.spreading?.length) {
        addAdLog("📡", `Spread to: ${postRes.spreading.join(", ")}`, "success");
      }

      // Safety net: if no feed post, publish to feed
      if (!postRes.post?.feedPostId) {
        try {
          await spreadCustomContent(walletAddress, planRes.caption || "New AIG!itch ad", videoUrl, "video");
          addAdLog("📡", "Published to AIG!itch feed (safety net)", "success");
        } catch { /* non-fatal */ }
      }

      // Route to Marketplace QVC channel so all ads appear there
      try {
        await spreadCustomContent(walletAddress, planRes.caption || "New AIG!itch ad", videoUrl, "video", "ch-marketplace-qvc");
        addAdLog("📺", "Published to Marketplace QVC channel", "success");
      } catch { /* non-fatal */ }

      setAdResult({
        success: true,
        caption: planRes.caption,
        style: planRes.style,
        duration: adExtend30s ? 30 : 10,
        targetPlatforms: adTargetPlatforms.length ? adTargetPlatforms : undefined,
        videoUrl,
        sizeMb: videoSizeMb,
        spreading: postRes.spreading,
        feedPostId: postRes.post?.feedPostId,
      });
      setAdPhase("complete");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    } catch (e: any) {
      addAdLog("❌", e?.message || "Ad campaign failed", "error");
      setAdPhase("failed");
    }
    setAdGenerating(false);
  };

  const handleCancelAd = () => {
    adCancelRef.current = true;
    addAdLog("⚠️", "Cancelling ad campaign...", "waiting");
  };

  // ── Quick Generate (poster/hero — available to ALL users, not just Architect) ──
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

  // ── Director Movie: Full Multi-Step Pipeline ──
  const handleDirectorMovie = async () => {
    if (movieGenerating || !walletAddress) return;
    if (walletAddress !== ADMIN_WALLET) {
      Alert.alert("Architect Only", "Sorry bestie! Only the Architect has the power to generate content right now. This superpower is coming to all besties soon!");
      return;
    }
    setMovieGenerating(true);
    setMovieResult(null);
    setMovieLog([]);
    setMoviePhase("screenplay");
    setMovieProgress({ current: 0, total: 1, pct: 0 });
    setSceneStatuses([]);
    movieCancelRef.current = false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    const directorObj = selectedDirector ? DIRECTORS.find(d => d.id === selectedDirector) : null;
    const genre = selectedGenre || undefined;
    const startTime = Date.now();

    const formatElapsed = (from: number) => {
      const s = Math.floor((Date.now() - from) / 1000);
      return `${Math.floor(s / 60)}m ${s % 60}s`;
    };

    addMovieLog("🎬", `Generating ${genre || "random"} movie...`, "info");
    if (directorObj) addMovieLog("🎭", `Director: ${directorObj.emoji} ${directorObj.name}`, "info");
    if (movieConcept.trim()) addMovieLog("📖", `Concept: "${movieConcept.trim().slice(0, 100)}"`, "info");
    addMovieLog("📜", `Writing screenplay...`, "waiting");

    try {
      // ── STEP 2: Generate Screenplay ──
      const screenplay = await generateScreenplay(walletAddress, {
        genre: genre || undefined,
        director: directorObj?.id || undefined,
        concept: movieConcept.trim() || undefined,
      });
      // Ensure director fields are populated — backend may return empty
      if (!screenplay.director) screenplay.director = directorObj?.id || "AIG!itch Studios";
      if (!screenplay.directorId) screenplay.directorId = directorObj?.id || "aiglitch-studios";

      if (movieCancelRef.current) { setMovieGenerating(false); setMoviePhase("idle"); return; }

      const totalScenes = screenplay.scenes.length;
      const folder = GENRE_FOLDER_MAP[screenplay.genre] || `premiere/${screenplay.genre}`;
      setMovieProgress({ current: 1, total: 1, pct: 100 });

      addMovieLog("✅", `"${screenplay.title}" — ${totalScenes} scenes by ${screenplay.directorName} (screenplay by ${screenplay.screenplayProvider})`, "success");
      addMovieLog("📖", `${screenplay.synopsis?.slice(0, 200)}...`, "info");
      addMovieLog("🎭", `Cast: ${screenplay.castList?.join(", ") || "N/A"}`, "info");

      // Initialize scene statuses for UI
      setSceneStatuses(screenplay.scenes.map(s => ({ sceneNumber: s.sceneNumber, title: s.title, status: "pending" })));

      // ── STEP 3: Submit Each Scene ──
      setMoviePhase("submitting");
      setMovieProgress({ current: 0, total: totalScenes, pct: 0 });
      addMovieLog("📡", `Submitting ${totalScenes} scenes to xAI...`, "info");

      type SceneTracker = {
        sceneNumber: number; title: string; requestId: string | null;
        status: "submitted" | "done" | "failed";
        blobUrl: string | null; sizeMb: number | null;
        submittedAt: number;
      };
      const sceneTrackers: SceneTracker[] = [];

      for (let i = 0; i < screenplay.scenes.length; i++) {
        if (movieCancelRef.current) break;
        const scene = screenplay.scenes[i];
        addMovieLog("🎬", `[${i + 1}/${totalScenes}] ${scene.title}`, "info");
        addMovieLog("📝", `"${scene.videoPrompt.slice(0, 80)}..."`, "info");

        try {
          const submitRes = await submitScene(walletAddress, scene.videoPrompt, 10, folder);
          if (submitRes.success && submitRes.requestId) {
            sceneTrackers.push({
              sceneNumber: scene.sceneNumber, title: scene.title,
              requestId: submitRes.requestId, status: "submitted",
              blobUrl: null, sizeMb: null, submittedAt: Date.now(),
            });
            addMovieLog("✅", `Submitted: ${submitRes.requestId.slice(0, 20)}...`, "success");
            setSceneStatuses(prev => prev.map(s => s.sceneNumber === scene.sceneNumber ? { ...s, status: "submitted" } : s));
          } else {
            addMovieLog("❌", `Failed to submit: ${submitRes.error || "Unknown error"}`, "error");
            sceneTrackers.push({ sceneNumber: scene.sceneNumber, title: scene.title, requestId: null, status: "failed", blobUrl: null, sizeMb: null, submittedAt: Date.now() });
            setSceneStatuses(prev => prev.map(s => s.sceneNumber === scene.sceneNumber ? { ...s, status: "failed" } : s));
          }
        } catch (err: any) {
          addMovieLog("❌", `Failed to submit: ${err?.message || "Network error"}`, "error");
          sceneTrackers.push({ sceneNumber: scene.sceneNumber, title: scene.title, requestId: null, status: "failed", blobUrl: null, sizeMb: null, submittedAt: Date.now() });
          setSceneStatuses(prev => prev.map(s => s.sceneNumber === scene.sceneNumber ? { ...s, status: "failed" } : s));
        }
        setMovieProgress({ current: i + 1, total: totalScenes, pct: Math.round(((i + 1) / totalScenes) * 100) });
      }

      if (movieCancelRef.current) { setMovieGenerating(false); setMoviePhase("idle"); return; }

      const submittedScenes = sceneTrackers.filter(s => s.status === "submitted");
      if (submittedScenes.length === 0) {
        addMovieLog("❌", "All scenes failed to submit. Please try again.", "error");
        setMoviePhase("failed");
        setMovieGenerating(false);
        return;
      }

      // ── STEP 4: Poll Every 10 Seconds ──
      setMoviePhase("polling");
      const doneScenes = new Set<number>();
      const failedScenes = new Set<number>();
      const sceneUrls = new Map<number, string>();
      let lastProgressTime = Date.now();
      let pollCount = 0;
      const pendingCount = () => submittedScenes.filter(s => !doneScenes.has(s.sceneNumber) && !failedScenes.has(s.sceneNumber)).length;

      addMovieLog("⏳", `Polling ${submittedScenes.length} scenes every 10s (max 15 min)...`, "waiting");
      setMovieProgress({ current: 0, total: totalScenes, pct: 0 });

      // Pre-fill failed from submission into failedScenes
      sceneTrackers.filter(s => s.status === "failed").forEach(s => failedScenes.add(s.sceneNumber));

      while (pendingCount() > 0 && pollCount < 90 && !movieCancelRef.current) {
        await new Promise(r => setTimeout(r, 10000)); // 10s wait
        pollCount++;

        for (const scene of submittedScenes) {
          if (doneScenes.has(scene.sceneNumber) || failedScenes.has(scene.sceneNumber) || !scene.requestId) continue;

          try {
            const pollRes = await pollScene(walletAddress, scene.requestId, folder);

            if (pollRes.status === "done" && pollRes.blobUrl) {
              doneScenes.add(scene.sceneNumber);
              sceneUrls.set(scene.sceneNumber, pollRes.blobUrl);
              lastProgressTime = Date.now();
              const elapsed = formatElapsed(scene.submittedAt);
              addMovieLog("🎉", `Scene ${scene.sceneNumber} "${scene.title}" DONE (${elapsed}) — ${pollRes.sizeMb || "?"}MB`, "success");
              setSceneStatuses(prev => prev.map(s => s.sceneNumber === scene.sceneNumber ? { ...s, status: "done", sizeMb: pollRes.sizeMb, elapsed } : s));
            } else if (["failed", "moderation_failed", "expired"].includes(pollRes.status)) {
              failedScenes.add(scene.sceneNumber);
              addMovieLog("❌", `Scene ${scene.sceneNumber} "${scene.title}" FAILED: ${pollRes.status}`, "error");
              setSceneStatuses(prev => prev.map(s => s.sceneNumber === scene.sceneNumber ? { ...s, status: "failed" } : s));
            } else {
              // Still rendering - update status to "rendering"
              setSceneStatuses(prev => prev.map(s => s.sceneNumber === scene.sceneNumber && s.status === "submitted" ? { ...s, status: "rendering" } : s));
            }
          } catch (err: any) {
            // Network error during poll — skip this cycle, try next
            console.warn(`Poll error for scene ${scene.sceneNumber}:`, err?.message);
          }
        }

        const done = doneScenes.size;
        const failed = failedScenes.size;
        const pct = Math.round((done / totalScenes) * 100);
        setMovieProgress({ current: done, total: totalScenes, pct });

        // Log progress every 3rd poll (every 30s)
        if (pollCount % 3 === 0) {
          addMovieLog("🔄", `${formatElapsed(startTime)}: ${done}/${totalScenes} done, ${failed} failed`, "info");
        }

        // Stall detection: 50%+ done AND 60s since last completion
        if (done >= totalScenes * 0.5 && (Date.now() - lastProgressTime) > 60000) {
          addMovieLog("⚠️", `Stall detected — stitching ${done}/${totalScenes} available clips`, "waiting");
          break;
        }
      }

      if (movieCancelRef.current) { setMovieGenerating(false); setMoviePhase("idle"); return; }

      // Check if we have enough clips
      if (doneScenes.size === 0) {
        addMovieLog("❌", `All scenes failed to generate. Please try again.`, "error");
        setMoviePhase("failed");
        setMovieGenerating(false);
        return;
      }

      if (doneScenes.size < totalScenes * 0.5 && pollCount >= 90) {
        addMovieLog("❌", `Not enough clips completed. ${doneScenes.size}/${totalScenes} done.`, "error");
        setMoviePhase("failed");
        setMovieGenerating(false);
        return;
      }

      // ── STEP 5: Stitch ──
      setMoviePhase("stitching");
      setMovieProgress({ current: 0, total: 1, pct: 0 });
      addMovieLog("🏁", `"${screenplay.title}" — ${doneScenes.size}/${totalScenes} scenes completed, ${failedScenes.size} failed`, "info");
      addMovieLog("🧩", `Stitching ${doneScenes.size} clips into one movie...`, "waiting");

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
        channelId: "ch-aiglitch-studios",
        folder: "channels/aiglitch-studios",
      });

      setMovieProgress({ current: 1, total: 1, pct: 100 });
      addMovieLog("✅", `MOVIE STITCHED! ${stitchRes.clipCount} clips → ${stitchRes.sizeMb}MB`, "success");

      // Publish to AIG!itch Studios channel
      try {
        const caption = `"${screenplay.title}" by ${screenplay.directorName}\n${screenplay.tagline || screenplay.synopsis || ""}`;
        await spreadCustomContent(walletAddress, caption, stitchRes.finalVideoUrl, "video", "ch-aiglitch-studios");
        addMovieLog("🎬", "Published to AIG!itch Studios channel", "success");
      } catch { /* non-fatal */ }

      // Safety net: publish to feed if backend didn't create a feed post
      if (!stitchRes.feedPostId) {
        try {
          const caption = `"${screenplay.title}" by ${screenplay.directorName}\n${screenplay.tagline || screenplay.synopsis || ""}`;
          await spreadCustomContent(walletAddress, caption, stitchRes.finalVideoUrl, "video");
          addMovieLog("📡", "Published to AIG!itch feed (safety net)", "success");
        } catch { /* non-fatal */ }
      }

      addMovieLog("🎬", `Feed post: ${stitchRes.feedPostId}`, "success");
      if (stitchRes.spreading?.length) {
        addMovieLog("✅", `Social media marketing done → ${stitchRes.spreading.join(", ")}`, "success");
      }
      addMovieLog("🙏", `Thank you Architect`, "success");

      setMovieResult({
        success: true,
        title: screenplay.title,
        director: screenplay.directorName,
        genre: screenplay.genre,
        finalVideoUrl: stitchRes.finalVideoUrl,
        feedPostId: stitchRes.feedPostId,
        directorMovieId: stitchRes.directorMovieId,
        clipCount: stitchRes.clipCount,
        sizeMb: stitchRes.sizeMb,
        spreading: stitchRes.spreading,
      });
      setMoviePhase("complete");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    } catch (e: any) {
      addMovieLog("❌", e?.message || "Movie generation failed", "error");
      setMoviePhase("failed");
    }
    setMovieGenerating(false);
  };

  // Cancel movie generation
  const handleCancelMovie = () => {
    movieCancelRef.current = true;
    addMovieLog("⚠️", "Cancelling generation...", "waiting");
  };

  // ── Breaking News: Full Multi-Step Pipeline (same as Director Movie) ──
  const handleNewsGenerate = async () => {
    if (newsGenerating || !walletAddress) return;
    if (walletAddress !== ADMIN_WALLET) {
      Alert.alert("Architect Only", "Sorry bestie! Only the Architect has the power to generate content right now. This superpower is coming to all besties soon!");
      return;
    }
    setNewsGenerating(true);
    setNewsResult(null);
    setNewsLog([]);
    setNewsPhase("screenplay");
    setNewsProgress({ current: 0, total: 1, pct: 0 });
    setNewsSceneStatuses([]);
    newsCancelRef.current = false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // Build topic from presets + freeform input
    const presetLabels = selectedNewsTopics.map(id => NEWS_TOPICS.find(t => t.id === id)?.label).filter(Boolean).join(", ");
    const freeform = newsTopicInput.trim();
    const topicText = [presetLabels, freeform].filter(Boolean).join(" — ");
    const startTime = Date.now();

    const formatElapsed = (from: number) => {
      const s = Math.floor((Date.now() - from) / 1000);
      return `${Math.floor(s / 60)}m ${s % 60}s`;
    };

    // Fetch real briefing data for current events
    let briefingContext = "";
    try {
      addNewsLog("📡", "Fetching current events from briefing...", "info");
      const briefing = await getBriefing();
      const headlines = briefing.topics?.slice(0, 4).map(t => `- ${t.headline}: ${t.summary}`).join("\n") || "";
      const trending = briefing.trending?.slice(0, 3).map(p => `- ${p.display_name} (@${p.username}): "${p.content.slice(0, 100)}"`).join("\n") || "";
      if (headlines || trending) {
        briefingContext = `\n\nREAL CURRENT EVENTS TO BASE THE NEWS ON (use these as the source material but CHANGE all names, places, and brands into whimsical/funny alternatives — use anagrams, puns, sci-fi twists, or absurd mashups. The events and facts stay accurate, only the names are discombobulated):\n${headlines}\n${trending ? `\nTrending posts:\n${trending}` : ""}`;
        addNewsLog("✅", `Got ${briefing.topics?.length || 0} topics + ${briefing.trending?.length || 0} trending posts`, "success");
      }
    } catch { addNewsLog("⚠️", "Couldn't fetch briefing — using AI-generated topics", "waiting"); }

    const newsConcept = `AIG!ITCH NEWS — LIVE NEWS BROADCAST.
This is a real news broadcast like CNN, BBC, Fox News, or Al Jazeera — NOT a movie. It must feel like actual television news.
9 clips total. Clip 1 is 6 seconds (intro). All other clips are 10 seconds each.

CONTENT RULE: All stories are based on REAL current events${topicText ? ` (specifically: ${topicText})` : ""}. The news is REAL — the facts, events, and what happened are all accurate. But ALL names of people, places, companies, and brands are changed into funny/whimsical alternatives (anagrams, puns, sci-fi twists, absurd mashups). The events stay true, only proper nouns change.${briefingContext}

BRANDING: "AIG!itch News" must appear constantly — on screen graphics, lower thirds, microphone flags, backdrop logos, watermarks. It should feel like a branded news network. Subliminal AIG!itch branding everywhere.

CLIP STRUCTURE (MUST follow this EXACT order):

Clip 1 (6 seconds) — AIG!ITCH NEWS INTRO: Professional news network opening sequence. Bold "AIG!ITCH NEWS" logo with dramatic news-style music energy (think CNN/BBC opening titles). Breaking news graphics, spinning globe or world map, news ticker bar at bottom. Fast cuts of newsroom footage. Sets the tone: this is serious news delivered with style. Text: "LIVE" and "BREAKING NEWS".

Clip 2 (10 seconds) — NEWS DESK - STORY 1: A news anchor sits behind a professional news desk with "AIG!ITCH NEWS" logo on the wall behind them. The anchor looks directly at the camera and says: "Good evening, I'm [anchor name], and this is AIG!itch News. We begin tonight with breaking developments in [Story 1 topic]..." The anchor gives a brief summary of the story — what happened, where, and why it matters. Then the anchor says: "For more on this, we go LIVE to [reporter name] who is at the scene. [Reporter name], what can you tell us?" Lower-third graphic shows the anchor's name and "AIG!ITCH NEWS ANCHOR". News ticker scrolls at the bottom.

Clip 3 (10 seconds) — FIELD REPORT - STORY 1: A field reporter stands facing the camera, holding a microphone with an AIG!itch News mic flag. They are ON LOCATION where the news event is happening — the scene of the story is visible BEHIND them. The reporter SPEAKS EXTENSIVELY — they describe what they are seeing on the ground, provide specific details about the event (numbers, scale, impact), and quote witnesses or officials ("One eyewitness told us..."). The reporter's dialogue should be the MAIN FOCUS of this clip — they are telling the story, not just standing there. Their report should directly expand on exactly what the anchor just introduced. They finish with: "We'll continue to monitor the situation. Back to you, [anchor name]." Lower-third shows reporter name and location.

Clip 4 (10 seconds) — NEWS DESK - STORY 2: Back to the anchor at the news desk. The anchor responds directly to the previous reporter: "Thank you, [reporter 1 name]. Incredible scenes there." Then transitions naturally: "Now, turning to [Story 2 topic]..." The anchor gives a brief summary of the second story with key facts, then hands off: "Our correspondent [reporter 2 name] is live at [location]. [Reporter 2 name], what's the latest?" Different headline graphics appear on the screens behind the desk. The anchor's introduction should set up exactly what the field reporter will expand on.

Clip 5 (10 seconds) — FIELD REPORT - STORY 2: A DIFFERENT field reporter at a DIFFERENT location for the second story. Reporter faces camera, holding AIG!itch News microphone, the news event visible behind them. The reporter SPEAKS AT LENGTH about what is unfolding — they describe the atmosphere, give specific facts and figures, and explain the significance of the event. They should reference what the anchor just said and ADD new information: "As [anchor name] mentioned, [detail]... but what we're seeing here on the ground is..." Their spoken report is the centrepiece. Ends with: "Reporting live from [location], back to you, [anchor name]."

Clip 6 (10 seconds) — NEWS DESK - STORY 3: Anchor back at the desk. Acknowledges the previous report: "Thank you, [reporter 2 name]. Important developments there." Then with slightly more urgent tone: "And in breaking news just coming in to us now..." introduces the third and final story with key details and context. Hands off: "Our reporter [reporter 3 name] is on the scene. [Reporter 3 name], what are you seeing?" New headline graphics on screens.

Clip 7 (10 seconds) — FIELD REPORT - STORY 3: A THIRD field reporter at a THIRD location. This is the most dramatic/urgent of the three reports. The reporter SPEAKS with energy and urgency — describing the scene around them in vivid detail, providing facts, quoting sources, and conveying the gravity of the situation. They should directly build on what the anchor introduced: "That's right, [anchor name], here at [location] we can see..." Their spoken words are the STAR of this clip. They report with authority and finish with: "A developing story we'll be watching closely. Back to you in the studio, [anchor name]."

Clip 8 (10 seconds) — NEWS DESK WRAP-UP: Anchor ties everything together by referencing ALL three stories and their reporters by name: "Some major stories tonight — [reporter 1 name] reporting on [Story 1], [reporter 2 name] bringing us the latest from [Story 2], and [reporter 3 name] on the ground at [Story 3]. We'll have continuing coverage throughout the night." Then signs off: "For AIG!itch News, I'm [anchor name]. Stay informed, stay glitched. Goodnight." Professional sign-off, looking directly at camera.

Clip 9 (10 seconds) — AIG!ITCH NEWS OUTRO: Closing credits sequence. "AIG!ITCH NEWS" logo with professional broadcast outro graphics. News ticker, "24/7 LIVE NEWS" text, social media handles. Clean, professional news network sign-off. Logo holds center screen.

CRITICAL STYLE NOTES:
- This is NEWS, not a movie. No cinematic camera work, no dramatic lighting, no sci-fi effects. Think real TV news — clean, professional, well-lit studio and on-location footage.
- Every clip should look like it could be on CNN or BBC right now, except with AIG!itch branding.
- Field reporters MUST be facing the camera and holding a microphone. The event is BEHIND them, not in front.
- The news desk should look like a real news studio — clean backdrop with screens/monitors showing headlines, professional lighting.
- AIG!itch News branding on EVERYTHING: desk, backdrop, mic flags, lower thirds, ticker bar, watermark.`;

    addNewsLog("📰", `Generating breaking news broadcast...`, "info");
    if (topicText) addNewsLog("📋", `Topic: "${topicText.slice(0, 100)}"`, "info");
    addNewsLog("📜", `Writing broadcast script...`, "waiting");

    try {
      // Step 1: Generate screenplay
      const screenplay = await generateScreenplay(walletAddress, {
        genre: "news",
        concept: newsConcept,
      });
      // Ensure director fields are populated — backend may return empty
      if (!screenplay.director) screenplay.director = "AIG!itch News";
      if (!screenplay.directorId) screenplay.directorId = "aiglitch-news";

      if (newsCancelRef.current) { setNewsGenerating(false); setNewsPhase("idle"); return; }

      const totalScenes = screenplay.scenes.length;
      const folder = GENRE_FOLDER_MAP["news"] || "premiere/news";
      setNewsProgress({ current: 1, total: 1, pct: 100 });

      addNewsLog("✅", `"${screenplay.title}" — ${totalScenes} clips scripted`, "success");
      if (screenplay.synopsis) addNewsLog("📖", `${screenplay.synopsis.slice(0, 200)}`, "info");

      setNewsSceneStatuses(screenplay.scenes.map(s => ({ sceneNumber: s.sceneNumber, title: s.title, status: "pending" })));

      // Step 2: Submit scenes
      setNewsPhase("submitting");
      setNewsProgress({ current: 0, total: totalScenes, pct: 0 });
      addNewsLog("📡", `Submitting ${totalScenes} clips to xAI...`, "info");

      type SceneTracker = {
        sceneNumber: number; title: string; requestId: string | null;
        status: "submitted" | "done" | "failed";
        blobUrl: string | null; sizeMb: number | null;
        submittedAt: number;
      };
      const sceneTrackers: SceneTracker[] = [];

      for (let i = 0; i < screenplay.scenes.length; i++) {
        if (newsCancelRef.current) break;
        const scene = screenplay.scenes[i];
        addNewsLog("🎬", `[${i + 1}/${totalScenes}] ${scene.title}`, "info");

        try {
          const submitRes = await submitScene(walletAddress, scene.videoPrompt, 10, folder);
          if (submitRes.success && submitRes.requestId) {
            sceneTrackers.push({
              sceneNumber: scene.sceneNumber, title: scene.title,
              requestId: submitRes.requestId, status: "submitted",
              blobUrl: null, sizeMb: null, submittedAt: Date.now(),
            });
            addNewsLog("✅", `Submitted: ${submitRes.requestId.slice(0, 20)}...`, "success");
            setNewsSceneStatuses(prev => prev.map(s => s.sceneNumber === scene.sceneNumber ? { ...s, status: "submitted" } : s));
          } else {
            addNewsLog("❌", `Failed: ${submitRes.error || "Unknown error"}`, "error");
            sceneTrackers.push({ sceneNumber: scene.sceneNumber, title: scene.title, requestId: null, status: "failed", blobUrl: null, sizeMb: null, submittedAt: Date.now() });
            setNewsSceneStatuses(prev => prev.map(s => s.sceneNumber === scene.sceneNumber ? { ...s, status: "failed" } : s));
          }
        } catch (err: any) {
          addNewsLog("❌", `Failed: ${err?.message || "Network error"}`, "error");
          sceneTrackers.push({ sceneNumber: scene.sceneNumber, title: scene.title, requestId: null, status: "failed", blobUrl: null, sizeMb: null, submittedAt: Date.now() });
          setNewsSceneStatuses(prev => prev.map(s => s.sceneNumber === scene.sceneNumber ? { ...s, status: "failed" } : s));
        }
        setNewsProgress({ current: i + 1, total: totalScenes, pct: Math.round(((i + 1) / totalScenes) * 100) });
      }

      if (newsCancelRef.current) { setNewsGenerating(false); setNewsPhase("idle"); return; }

      const submittedScenes = sceneTrackers.filter(s => s.status === "submitted");
      if (submittedScenes.length === 0) {
        addNewsLog("❌", "All clips failed to submit. Please try again.", "error");
        setNewsPhase("failed");
        setNewsGenerating(false);
        return;
      }

      // Step 3: Poll
      setNewsPhase("polling");
      const doneScenes = new Set<number>();
      const failedScenes = new Set<number>();
      const sceneUrls = new Map<number, string>();
      let lastProgressTime = Date.now();
      let pollCount = 0;
      const pendingCount = () => submittedScenes.filter(s => !doneScenes.has(s.sceneNumber) && !failedScenes.has(s.sceneNumber)).length;

      addNewsLog("⏳", `Polling ${submittedScenes.length} clips every 10s...`, "waiting");
      setNewsProgress({ current: 0, total: totalScenes, pct: 0 });

      sceneTrackers.filter(s => s.status === "failed").forEach(s => failedScenes.add(s.sceneNumber));

      while (pendingCount() > 0 && pollCount < 90 && !newsCancelRef.current) {
        await new Promise(r => setTimeout(r, 10000));
        pollCount++;

        for (const scene of submittedScenes) {
          if (doneScenes.has(scene.sceneNumber) || failedScenes.has(scene.sceneNumber) || !scene.requestId) continue;

          try {
            const pollRes = await pollScene(walletAddress, scene.requestId, folder);

            if (pollRes.status === "done" && pollRes.blobUrl) {
              doneScenes.add(scene.sceneNumber);
              sceneUrls.set(scene.sceneNumber, pollRes.blobUrl);
              lastProgressTime = Date.now();
              const elapsed = formatElapsed(scene.submittedAt);
              addNewsLog("🎉", `Clip ${scene.sceneNumber} "${scene.title}" DONE (${elapsed}) — ${pollRes.sizeMb || "?"}MB`, "success");
              setNewsSceneStatuses(prev => prev.map(s => s.sceneNumber === scene.sceneNumber ? { ...s, status: "done", sizeMb: pollRes.sizeMb, elapsed } : s));
            } else if (["failed", "moderation_failed", "expired"].includes(pollRes.status)) {
              failedScenes.add(scene.sceneNumber);
              addNewsLog("❌", `Clip ${scene.sceneNumber} "${scene.title}" FAILED: ${pollRes.status}`, "error");
              setNewsSceneStatuses(prev => prev.map(s => s.sceneNumber === scene.sceneNumber ? { ...s, status: "failed" } : s));
            } else {
              setNewsSceneStatuses(prev => prev.map(s => s.sceneNumber === scene.sceneNumber && s.status === "submitted" ? { ...s, status: "rendering" } : s));
            }
          } catch (err: any) {
            console.warn(`Poll error for clip ${scene.sceneNumber}:`, err?.message);
          }
        }

        const done = doneScenes.size;
        const failed = failedScenes.size;
        const pct = Math.round((done / totalScenes) * 100);
        setNewsProgress({ current: done, total: totalScenes, pct });

        if (pollCount % 3 === 0) {
          addNewsLog("🔄", `${formatElapsed(startTime)}: ${done}/${totalScenes} done, ${failed} failed`, "info");
        }

        if (done >= totalScenes * 0.5 && (Date.now() - lastProgressTime) > 60000) {
          addNewsLog("⚠️", `Stall detected — stitching ${done}/${totalScenes} available clips`, "waiting");
          break;
        }
      }

      if (newsCancelRef.current) { setNewsGenerating(false); setNewsPhase("idle"); return; }

      if (doneScenes.size === 0) {
        addNewsLog("❌", `All clips failed to generate. Please try again.`, "error");
        setNewsPhase("failed");
        setNewsGenerating(false);
        return;
      }

      // Step 4: Stitch
      setNewsPhase("stitching");
      setNewsProgress({ current: 0, total: 1, pct: 0 });
      addNewsLog("🧩", `Stitching ${doneScenes.size} clips into broadcast...`, "waiting");

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

      setNewsProgress({ current: 1, total: 1, pct: 100 });

      // Safety net: publish to feed if backend didn't create a feed post
      if (!stitchRes.feedPostId) {
        try {
          const newsCaption = `BREAKING: ${screenplay.title}\n${screenplay.synopsis || screenplay.tagline || "AIG!itch News broadcast"}`;
          await spreadCustomContent(walletAddress, newsCaption, stitchRes.finalVideoUrl, "video");
          addNewsLog("📡", "Published to AIG!itch feed (safety net)", "success");
        } catch { /* non-fatal */ }
      }

      // Route to GNN channel so all breaking news appears there
      try {
        const gnnCaption = `BREAKING: ${screenplay.title}\n${screenplay.synopsis || screenplay.tagline || "AIG!itch News broadcast"}`;
        await spreadCustomContent(walletAddress, gnnCaption, stitchRes.finalVideoUrl, "video", "ch-gnn");
        addNewsLog("📺", "Published to GNN channel", "success");
      } catch { /* non-fatal */ }

      addNewsLog("✅", `BROADCAST LIVE! ${stitchRes.clipCount} clips → ${stitchRes.sizeMb}MB`, "success");
      if (stitchRes.spreading?.length) {
        addNewsLog("📡", `Spread to: ${stitchRes.spreading.join(", ")}`, "success");
      }

      setNewsResult({
        success: true,
        title: screenplay.title,
        finalVideoUrl: stitchRes.finalVideoUrl,
        feedPostId: stitchRes.feedPostId,
        clipCount: stitchRes.clipCount,
        sizeMb: stitchRes.sizeMb,
        spreading: stitchRes.spreading,
      });
      setNewsPhase("complete");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    } catch (e: any) {
      addNewsLog("❌", e?.message || "News broadcast failed", "error");
      setNewsPhase("failed");
    }
    setNewsGenerating(false);
  };

  const handleCancelNews = () => {
    newsCancelRef.current = true;
    addNewsLog("⚠️", "Cancelling broadcast...", "waiting");
  };

  // ── Channel Content: Delegates to GenerationContext (background-safe, survives tab navigation) ──
  const handleChannelGenerate = async () => {
    if (ctxGenerating || channelGenerating || !walletAddress) return;
    if (walletAddress !== ADMIN_WALLET) {
      Alert.alert("Architect Only", "Sorry bestie! Only the Architect has the power to generate content right now. This superpower is coming to all besties soon!");
      return;
    }
    if (!selectedChannel) {
      Alert.alert("Select a Channel", "Pick a channel to create content for.");
      return;
    }
    const channel = channels.find(ch => ch.id === selectedChannel);
    if (!channel) return;

    // Delegate to GenerationContext — this runs at the app root level
    // so generation continues even if user navigates away from Studio tab
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    addChannelLog("📺", `Starting background generation for ${channel.emoji} ${channel.name}...`, "info");
    if (channelConcept.trim()) addChannelLog("📖", `Concept: "${channelConcept.trim().slice(0, 100)}"`, "info");
    addChannelLog("✅", `Generation running in background — you can switch tabs safely!`, "success");
    setChannelGenerating(true);

    ctxRunChannel(walletAddress, channel, channelConcept.trim() || undefined);
  };

  // Track GenerationContext state to update local UI
  useEffect(() => {
    if (ctxGenerating === "channel") {
      setChannelGenerating(true);
      // Map context progress to local phase for UI display
      const status = genStatusText.toLowerCase();
      if (status.includes("screenplay") || status.includes("writing")) setChannelPhase("screenplay");
      else if (status.includes("submitting")) setChannelPhase("submitting");
      else if (status.includes("rendering") || status.includes("clips")) setChannelPhase("polling");
      else if (status.includes("stitching")) setChannelPhase("stitching");
      else if (status.includes("publishing") || status.includes("verifying")) setChannelPhase("stitching");
      else setChannelPhase("screenplay");
      setChannelProgress({ current: 0, total: 100, pct: genProgressPct });
    } else if (channelGenerating && !ctxGenerating) {
      // Generation just finished
      if (genResult && genResult.type === "channel") {
        setChannelPhase("complete");
        setChannelResult({
          success: true,
          title: genResult.title,
          channelName: "",
          channelEmoji: "",
          genre: "",
          finalVideoUrl: genResult.mediaUrl,
          clipCount: 0,
          sizeMb: 0,
          spreading: [],
        });
        addChannelLog("✅", genResult.message, "success");
        if (genResult.mediaUrl) addChannelLog("▶️", `Video: ${genResult.mediaUrl}`, "success");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setChannelGenerating(false);
    }
  }, [ctxGenerating, genStatusText, genProgressPct, genResult]);

  const handleCancelChannel = () => {
    ctxCancelGeneration();
    setChannelGenerating(false);
    setChannelPhase("idle");
    addChannelLog("⚠️", "Generation cancelled.", "waiting");
  };

  // ── Upload handlers ──
  const doUpload = async (uri: string, fileName: string, mimeType: string) => {
    if (!walletAddress || uploading) return;
    setUploading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const mediaType = mimeType.startsWith("video/") ? "video" : "image";
    try {
      if (selectedFolder) {
        // Upload to specific blob folder (premiere/action, news, etc.)
        const result = await uploadBlobVideo(walletAddress, uri, fileName, mimeType, selectedFolder);
        if (result.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert("Uploaded!", `${result.uploaded || 1} file(s) uploaded to ${selectedFolder}`);
          loadBlobStorage();
        }
      } else {
        // Upload to media library
        const result = await uploadMediaAdmin(walletAddress, uri, fileName, mimeType, mediaType);
        if (result.success) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert("Uploaded!", `${fileName} uploaded to media library`);
          loadBlobStorage();
        }
      }
    } catch (e: any) {
      Alert.alert("Upload Failed", e?.message || "Error");
    }
    setUploading(false);
  };

  const showUploadOptions = () => {
    Alert.alert("Upload to Blob Storage", `Destination: ${selectedFolder || "Media Library"}`, [
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

  // ── Import from URL ──
  const handleImportUrl = async () => {
    if (!walletAddress || !importUrl.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await importMedia(walletAddress, [importUrl.trim()], "video");
      if (res.success) {
        Alert.alert("Imported!", `${res.imported} file(s) imported`);
        setImportUrl("");
        loadBlobStorage();
      }
    } catch (e: any) {
      Alert.alert("Import Failed", e?.message || "Error");
    }
  };

  // ── Resync ──
  const handleResync = async () => {
    if (!walletAddress || resyncing) return;
    setResyncing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const res = await resyncBlobStorage(walletAddress);
      Alert.alert("Resync Complete", `Synced: ${res.synced}\nSkipped: ${res.skipped}\nAlready in DB: ${res.already_in_db}\nErrors: ${res.errors}`);
      loadBlobStorage();
    } catch (e: any) {
      Alert.alert("Resync Failed", e?.message || "Error");
    }
    setResyncing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLibrary(); loadBlobStorage();
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

            {/* Generation Log */}
            {quickLog.length > 0 && <GenerationLog entries={quickLog} onClear={() => setQuickLog([])} />}
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

            {/* Generate / Cancel buttons */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={[styles.movieGenBtn, { flex: 1 }, movieGenerating && { opacity: 0.5 }]}
                onPress={handleDirectorMovie} disabled={movieGenerating}>
                <Text style={styles.movieGenBtnText}>
                  {movieGenerating ? `🎬 ${moviePhase === "screenplay" ? "Writing screenplay..." : moviePhase === "submitting" ? "Submitting scenes..." : moviePhase === "polling" ? "Rendering clips..." : moviePhase === "stitching" ? "Stitching movie..." : "Generating..."}` : "🎥 Generate Director Movie"}
                </Text>
              </TouchableOpacity>
              {movieGenerating && (
                <TouchableOpacity style={[styles.movieGenBtn, { backgroundColor: "rgba(239,68,68,0.2)", borderColor: colors.red, flex: 0, paddingHorizontal: 16 }]}
                  onPress={handleCancelMovie}>
                  <Text style={[styles.movieGenBtnText, { color: colors.red }]}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Progress bar during generation */}
            {movieGenerating && moviePhase !== "idle" && (
              <View style={{ marginTop: 12, marginBottom: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ color: colors.text, fontFamily: "monospace", fontSize: 12 }}>
                    {moviePhase === "screenplay" ? "📜 Writing screenplay..." : moviePhase === "submitting" ? `📡 Submitting scenes... ${movieProgress.current}/${movieProgress.total}` : moviePhase === "polling" ? `🎬 Rendering clips... ${movieProgress.current}/${movieProgress.total} (${movieProgress.pct}%)` : moviePhase === "stitching" ? "🧩 Stitching movie..." : moviePhase === "complete" ? "✅ Movie complete!" : ""}
                  </Text>
                </View>
                <ProgressBar progress={movieProgress.pct} color={moviePhase === "complete" ? colors.green : colors.amber} />
                {moviePhase === "polling" && movieProgress.current === 0 && (
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4, fontFamily: "monospace" }}>Waiting for clips to render...</Text>
                )}
                {moviePhase === "polling" && movieProgress.current > 0 && movieProgress.current < movieProgress.total && (
                  <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4, fontFamily: "monospace" }}>
                    {movieProgress.pct}% complete — {movieProgress.total - movieProgress.current} clips remaining
                  </Text>
                )}
              </View>
            )}

            {/* Per-scene status indicators */}
            {sceneStatuses.length > 0 && (movieGenerating || moviePhase === "complete" || moviePhase === "failed") && (
              <View style={{ backgroundColor: "rgba(3,7,18,0.8)", borderRadius: 8, padding: 10, marginTop: 8, marginBottom: 8 }}>
                <Text style={{ color: colors.text, fontFamily: "monospace", fontSize: 11, fontWeight: "bold", marginBottom: 6 }}>Scene Status</Text>
                {sceneStatuses.map(s => (
                  <Text key={s.sceneNumber} style={{
                    fontFamily: "monospace", fontSize: 11, marginBottom: 3,
                    color: s.status === "done" ? "#4ade80" : s.status === "failed" ? "#f87171" : s.status === "rendering" ? "#94a3b8" : s.status === "submitted" ? "#facc15" : colors.textMuted,
                  }}>
                    {s.status === "done" ? "✅" : s.status === "failed" ? "❌" : s.status === "rendering" ? "🔄" : s.status === "submitted" ? "⏳" : "⏳"} Scene {s.sceneNumber}: {s.title}
                    {s.status === "done" && s.elapsed ? ` (${s.elapsed})` : ""}
                    {s.status === "done" && s.sizeMb ? ` — ${s.sizeMb}MB` : ""}
                    {s.status === "rendering" ? " Rendering..." : s.status === "submitted" ? " Submitted" : ""}
                  </Text>
                ))}
              </View>
            )}

            {/* Movie generation log */}
            {movieLog.length > 0 && <GenerationLog entries={movieLog} onClear={() => { setMovieLog([]); if (!movieGenerating) { setMoviePhase("idle"); setSceneStatuses([]); } }} />}

            {/* Movie result */}
            {movieResult && moviePhase === "complete" && (
              <View style={styles.movieResultCard}>
                <Text style={styles.movieResultTitle}>🎬 {movieResult.title || "Movie Complete!"}</Text>
                {movieResult.director && <Text style={styles.movieResultMeta}>Director: {movieResult.director}</Text>}
                {movieResult.genre && <Text style={styles.movieResultMeta}>Genre: {movieResult.genre}</Text>}
                {movieResult.clipCount && <Text style={styles.movieResultMeta}>Clips: {movieResult.clipCount} · {movieResult.sizeMb}MB</Text>}
                {movieResult.spreading?.length > 0 && <Text style={[styles.movieResultMeta, { color: colors.green }]}>Spread to: {movieResult.spreading.join(", ")}</Text>}
                {movieResult.feedPostId && <Text style={styles.movieResultMeta}>Post ID: {movieResult.feedPostId}</Text>}
              </View>
            )}
          </View>
        )}

        {/* ══════════════ CHANNELS ══════════════ */}
        <SectionHeader title="Channels" emoji="📺" expanded={expandedSections.channels} onToggle={() => toggleSection("channels")} accent={colors.cyan} />
        {expandedSections.channels && (
          <View style={styles.sectionBody}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
              Create video content for AIG!itch TV channels. Pick a channel, describe your concept, and generate a multi-scene video that gets published to the channel on aiglitch.app. New channels added via admin appear here automatically.
            </Text>

            {channelsLoading && <ActivityIndicator color={colors.cyan} style={{ marginVertical: 16 }} />}

            {/* Channel Picker — Grid with thumbnails */}
            {channels.length > 0 && (
              <>
                <Text style={styles.subsectionLabel}>Choose a Channel ({channels.length})</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                  {channels.map((ch) => {
                    const isSelected = selectedChannel === ch.id;
                    return (
                      <TouchableOpacity
                        key={ch.id}
                        style={[{
                          width: "48%",
                          borderRadius: 12,
                          overflow: "hidden",
                          borderWidth: 2,
                          borderColor: isSelected ? colors.cyan : "#1f2937",
                          backgroundColor: isSelected ? "rgba(6,182,212,0.08)" : "#111827",
                        }]}
                        onPress={() => {
                          setSelectedChannel(isSelected ? null : ch.id);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}>
                        {ch.thumbnail ? (
                          <Image source={{ uri: ch.thumbnail }} style={{ width: "100%", height: 80, backgroundColor: "#1f2937" }} resizeMode="cover" />
                        ) : (
                          <View style={{ width: "100%", height: 80, backgroundColor: "#1f2937", justifyContent: "center", alignItems: "center" }}>
                            <Text style={{ fontSize: 28 }}>{ch.emoji}</Text>
                          </View>
                        )}
                        <View style={{ padding: 10 }}>
                          <Text style={{ color: isSelected ? colors.cyan : colors.text, fontSize: 13, fontWeight: "800" }} numberOfLines={1}>
                            {ch.emoji} {ch.name}
                          </Text>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                            <Text style={{ color: colors.textMuted, fontSize: 10 }}>{ch.post_count} ep</Text>
                            <Text style={{ color: colors.textMuted, fontSize: 10 }}>{ch.subscriber_count} subs</Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {channels.length === 0 && !channelsLoading && (
              <TouchableOpacity style={[styles.refreshBtn, { marginBottom: 16 }]} onPress={loadChannels}>
                <Text style={styles.refreshBtnText}>Load Channels</Text>
              </TouchableOpacity>
            )}

            {/* Selected channel detail */}
            {selectedChannel && (() => {
              const ch = channels.find(x => x.id === selectedChannel);
              if (!ch) return null;
              return (
                <View style={[styles.directorDetail, { borderColor: "rgba(6,182,212,0.2)", backgroundColor: "rgba(6,182,212,0.06)" }]}>
                  <Text style={[styles.directorDetailName, { color: colors.cyan }]}>{ch.emoji} {ch.name}</Text>
                  <Text style={styles.directorDetailMeta}>{ch.description}</Text>
                  <Text style={styles.directorDetailMeta}>Style: {ch.style?.slice(0, 150)}</Text>
                  <View style={styles.genreTags}>
                    <Text style={[styles.genreTag, { color: colors.cyan, backgroundColor: "rgba(6,182,212,0.15)" }]}>{ch.genre}</Text>
                    <Text style={[styles.genreTag, { color: colors.textMuted, backgroundColor: "rgba(255,255,255,0.05)" }]}>{ch.post_count} episodes</Text>
                    <Text style={[styles.genreTag, { color: colors.textMuted, backgroundColor: "rgba(255,255,255,0.05)" }]}>{ch.subscriber_count} subs</Text>
                  </View>
                </View>
              );
            })()}

            {/* Concept input */}
            {/* Video Format Options */}
            <Text style={styles.subsectionLabel}>Video Format</Text>
            <View style={styles.genreGrid}>
              {(() => {
                const ch = channels.find(c => c.id === selectedChannel);
                return ch?.shortClipMode ? (
                  <TouchableOpacity
                    style={[styles.genreChip, channelFormat === "short" && { borderColor: colors.cyan, backgroundColor: "rgba(6,182,212,0.15)" }]}
                    onPress={() => { setChannelFormat("short"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                    <Text style={[styles.genreChipText, channelFormat === "short" && { color: colors.cyan }]}>
                      🎞 Short Clip ({ch?.sceneDuration || 10}s)
                    </Text>
                  </TouchableOpacity>
                ) : null;
              })()}
              <TouchableOpacity
                style={[styles.genreChip, channelFormat === "multi" && { borderColor: colors.cyan, backgroundColor: "rgba(6,182,212,0.15)" }]}
                onPress={() => { setChannelFormat("multi"); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}>
                <Text style={[styles.genreChipText, channelFormat === "multi" && { color: colors.cyan }]}>
                  🎬 Multi-Scene Movie
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={styles.subsectionLabel}>Content Concept (optional)</Text>
              <TouchableOpacity
                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: "rgba(124,58,237,0.2)", borderWidth: 1, borderColor: colors.purpleLight }}
                onPress={() => {
                  if (selectedChannel) {
                    const concept = getRandomChannelConcept(selectedChannel);
                    console.log("[SURPRISE-ME] channelId:", selectedChannel, "concept:", concept);
                    setChannelConcept(concept);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }
                }}>
                <Text style={{ color: colors.purpleLight, fontSize: 14, fontWeight: "bold" }}>🎲 Surprise Me</Text>
              </TouchableOpacity>
            </View>

            {/* Quick-pick content type cards */}
            {selectedChannel && (() => {
              const picks = getChannelQuickPicks(selectedChannel);
              return (
                <>
                  <Text style={styles.subsectionLabel}>Quick Ideas</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    {picks.map((pick) => (
                      <TouchableOpacity
                        key={pick.label}
                        style={{
                          width: 90, alignItems: "center" as const, padding: 12,
                          backgroundColor: "#111827", borderRadius: 12,
                          borderWidth: 1.5, borderColor: channelConcept === pick.prompt ? "rgba(6,182,212,0.8)" : "#1f2937",
                          marginRight: 10,
                          ...(channelConcept === pick.prompt ? { backgroundColor: "rgba(6,182,212,0.08)" } : {}),
                        }}
                        onPress={() => {
                          setChannelConcept(pick.prompt);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}>
                        <Text style={{ fontSize: 28, marginBottom: 6 }}>{pick.emoji}</Text>
                        <Text style={{ color: channelConcept === pick.prompt ? colors.cyan : colors.text, fontSize: 11, fontWeight: "700", textAlign: "center" as const }} numberOfLines={1}>{pick.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              );
            })()}

            <TextInput
              style={styles.optionInput}
              value={channelConcept}
              onChangeText={setChannelConcept}
              placeholder="Describe what the video should be about... or tap 🎲 for a random idea"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
            />

            {/* Generate + Cancel buttons */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={[styles.movieGenBtn, { flex: 1, backgroundColor: "rgba(6,182,212,0.15)", borderColor: colors.cyan }, channelGenerating && { opacity: 0.5 }]}
                onPress={handleChannelGenerate}
                disabled={channelGenerating}>
                <Text style={[styles.movieGenBtnText, { color: colors.cyan }]}>
                  {channelGenerating
                    ? `📺 ${channelPhase === "screenplay" ? "Writing script..." : channelPhase === "submitting" ? "Submitting scenes..." : channelPhase === "polling" ? "Rendering clips..." : channelPhase === "stitching" ? "Stitching video..." : "Generating..."}`
                    : "📺 Create Channel Content"}
                </Text>
              </TouchableOpacity>
              {channelGenerating && (
                <TouchableOpacity
                  style={[styles.movieGenBtn, { backgroundColor: "rgba(239,68,68,0.2)", borderColor: colors.red, flex: 0, paddingHorizontal: 16 }]}
                  onPress={handleCancelChannel}>
                  <Text style={[styles.movieGenBtnText, { color: colors.red }]}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Progress bar — shows GenerationContext status */}
            {channelGenerating && channelPhase !== "idle" && (
              <View style={{ marginTop: 12, marginBottom: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ color: colors.text, fontFamily: "monospace", fontSize: 12 }} numberOfLines={2}>
                    {genStatusText || (channelPhase === "complete" ? "✅ Channel content complete!" : "Starting...")}
                  </Text>
                </View>
                <ProgressBar progress={genProgressPct || channelProgress.pct} color={channelPhase === "complete" ? colors.green : colors.cyan} />
                <Text style={{ color: colors.cyan, fontSize: 11, marginTop: 6, fontFamily: "monospace" }}>
                  Runs in background — you can switch tabs safely
                </Text>
              </View>
            )}

            {/* Per-scene status indicators */}
            {channelSceneStatuses.length > 0 && (channelGenerating || channelPhase === "complete" || channelPhase === "failed") && (
              <View style={{ backgroundColor: "rgba(3,7,18,0.8)", borderRadius: 8, padding: 10, marginTop: 8, marginBottom: 8 }}>
                <Text style={{ color: colors.text, fontFamily: "monospace", fontSize: 11, fontWeight: "bold", marginBottom: 6 }}>Scene Status</Text>
                {channelSceneStatuses.map(s => (
                  <Text key={s.sceneNumber} style={{
                    fontFamily: "monospace", fontSize: 11, marginBottom: 3,
                    color: s.status === "done" ? "#4ade80" : s.status === "failed" ? "#f87171" : s.status === "rendering" ? "#94a3b8" : s.status === "submitted" ? "#facc15" : colors.textMuted,
                  }}>
                    {s.status === "done" ? "✅" : s.status === "failed" ? "❌" : s.status === "rendering" ? "🔄" : "⏳"} Scene {s.sceneNumber}: {s.title}
                    {s.status === "done" && s.elapsed ? ` (${s.elapsed})` : ""}
                    {s.status === "done" && s.sizeMb ? ` — ${s.sizeMb}MB` : ""}
                    {s.status === "rendering" ? " Rendering..." : s.status === "submitted" ? " Submitted" : ""}
                  </Text>
                ))}
              </View>
            )}

            {/* Generation log */}
            {channelLog.length > 0 && <GenerationLog entries={channelLog} onClear={() => { setChannelLog([]); if (!channelGenerating) { setChannelPhase("idle"); setChannelSceneStatuses([]); } }} />}

            {/* Result card */}
            {channelResult && channelPhase === "complete" && (
              <View style={[styles.movieResultCard, { borderColor: "rgba(6,182,212,0.3)" }]}>
                <Text style={[styles.movieResultTitle, { color: colors.cyan }]}>{channelResult.channelEmoji} {channelResult.channelName}: {channelResult.title || "Content Complete!"}</Text>
                {channelResult.genre && <Text style={styles.movieResultMeta}>Genre: {channelResult.genre}</Text>}
                {channelResult.clipCount && <Text style={styles.movieResultMeta}>Clips: {channelResult.clipCount} · {channelResult.sizeMb}MB</Text>}
                {channelResult.spreading?.length > 0 && <Text style={[styles.movieResultMeta, { color: colors.green }]}>Spread to: {channelResult.spreading.join(", ")}</Text>}
                {channelResult.feedPostId && <Text style={styles.movieResultMeta}>Post ID: {channelResult.feedPostId}</Text>}
              </View>
            )}
          </View>
        )}

        {/* ══════════════ AD CAMPAIGNS ══════════════ */}
        <SectionHeader title="Ad Campaigns" emoji="🎯" expanded={expandedSections.ads} onToggle={() => toggleSection("ads")} accent={colors.orange} />
        {expandedSections.ads && (
          <View style={styles.sectionBody}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
              Create killer 30-second AI-generated ad campaigns targeting specific platforms. Pick your style, target Facebook/X/TikTok/Instagram/Telegram, then auto-publish everywhere. Sell the entire AIG!itch ecosystem.
            </Text>

            {/* Ad Style Picker */}
            <Text style={styles.subsectionLabel}>Ad Style</Text>
            <View style={styles.genreGrid}>
              {[
                { id: "auto", label: "Surprise Me", emoji: "🎲" },
                { id: "hype", label: "Hype Beast", emoji: "🔥" },
                { id: "cinematic", label: "Cinematic", emoji: "🎬" },
                { id: "retro", label: "Retro", emoji: "📺" },
                { id: "meme", label: "Meme Style", emoji: "🤣" },
                { id: "infomercial", label: "Infomercial", emoji: "📢" },
                { id: "luxury", label: "Luxury", emoji: "💎" },
              ].map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.genreChip, adStyle === s.id && { borderColor: colors.orange, backgroundColor: "rgba(249,115,22,0.15)" }]}
                  onPress={() => {
                    setAdStyle(adStyle === s.id ? null : s.id);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}>
                  <Text style={[styles.genreChipText, adStyle === s.id && { color: colors.orange }]}>
                    {s.emoji} {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Target Platform Selector */}
            <Text style={styles.subsectionLabel}>Target Platform (pick one or more)</Text>
            <View style={styles.genreGrid}>
              {[
                { id: "x", label: "X / Twitter", emoji: "𝕏" },
                { id: "facebook", label: "Facebook", emoji: "📘" },
                { id: "tiktok", label: "TikTok", emoji: "🎵" },
                { id: "instagram", label: "Instagram", emoji: "📸" },
                { id: "telegram", label: "Telegram", emoji: "✈️" },
                { id: "youtube", label: "YouTube", emoji: "▶️" },
              ].map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.genreChip, adTargetPlatforms.includes(p.id) && { borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.15)" }]}
                  onPress={() => {
                    setAdTargetPlatforms(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}>
                  <Text style={[styles.genreChipText, adTargetPlatforms.includes(p.id) && { color: "#10b981" }]}>
                    {p.emoji} {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {adTargetPlatforms.length > 0 && (
              <Text style={{ color: "#10b981", fontSize: 11, marginBottom: 8, fontWeight: "700" }}>
                CTA: Follow/Join AIG!itch on {adTargetPlatforms.map(p => p === "x" ? "X" : p.charAt(0).toUpperCase() + p.slice(1)).join(", ")}
              </Text>
            )}

            {/* Ad Concept Input */}
            <Text style={styles.subsectionLabel}>Ad Concept (optional)</Text>
            <TextInput
              style={styles.optionInput}
              value={adConceptInput}
              onChangeText={setAdConceptInput}
              placeholder="What's the ad about? E.g., 'Join us on TikTok — swap SOL for $GLITCH now!'..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={500}
            />

            {/* Generate + Cancel buttons */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                style={[styles.movieGenBtn, { flex: 1, backgroundColor: "rgba(249,115,22,0.15)", borderColor: colors.orange }, adGenerating && { opacity: 0.5 }]}
                onPress={handleGenerateAdFull}
                disabled={adGenerating}>
                <Text style={[styles.movieGenBtnText, { color: colors.orange }]}>
                  {adGenerating
                    ? `🎯 ${adPhase === "planning" ? "Planning ad..." : adPhase === "rendering" ? "Rendering video..." : adPhase === "polling" ? "Waiting for video..." : adPhase === "stitching" ? "Stitching clips..." : adPhase === "spreading" ? "Publishing to socials..." : "Generating..."}`
                    : "🎯 Launch Ad Campaign"}
                </Text>
              </TouchableOpacity>
              {adGenerating && (
                <TouchableOpacity
                  style={[styles.movieGenBtn, { backgroundColor: "rgba(239,68,68,0.2)", borderColor: colors.red, flex: 0, paddingHorizontal: 16 }]}
                  onPress={handleCancelAd}>
                  <Text style={[styles.movieGenBtnText, { color: colors.red }]}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Progress bar */}
            {adGenerating && adPhase !== "idle" && (
              <View style={{ marginTop: 12, marginBottom: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ color: colors.text, fontFamily: "monospace", fontSize: 12 }}>
                    {adPhase === "planning" ? "📜 Planning ad concept..." : adPhase === "rendering" ? "📡 Rendering video clips..." : adPhase === "stitching" ? `🔗 Stitching 3 clips into 30s...` : adPhase === "spreading" ? "📡 Publishing to socials..." : adPhase === "complete" ? "✅ Ad campaign complete!" : `🎬 (${adProgress.pct}%)`}
                  </Text>
                </View>
                <ProgressBar progress={adProgress.pct} color={adPhase === "complete" ? colors.green : colors.orange} />
              </View>
            )}

            {/* Generation log */}
            {adLog.length > 0 && <GenerationLog entries={adLog} onClear={() => { setAdLog([]); if (!adGenerating) { setAdPhase("idle"); } }} />}

            {/* Result card */}
            {adResult && adPhase === "complete" && (
              <View style={[styles.movieResultCard, { borderColor: "rgba(249,115,22,0.3)" }]}>
                <Text style={[styles.movieResultTitle, { color: colors.orange }]}>🎯 Ad Campaign Complete!</Text>
                {adResult.caption && <Text style={styles.movieResultMeta}>Caption: {adResult.caption.slice(0, 150)}</Text>}
                {adResult.style && <Text style={styles.movieResultMeta}>Style: {adResult.style}</Text>}
                {adResult.duration && <Text style={styles.movieResultMeta}>Duration: {adResult.duration}s{adResult.duration >= 30 ? " (Extended)" : ""}</Text>}
                {adResult.targetPlatforms?.length > 0 && <Text style={[styles.movieResultMeta, { color: "#10b981" }]}>Targeted: {adResult.targetPlatforms.join(", ")}</Text>}
                {adResult.sizeMb && <Text style={styles.movieResultMeta}>Size: {adResult.sizeMb}MB</Text>}
                {adResult.spreading?.length > 0 && <Text style={[styles.movieResultMeta, { color: colors.green }]}>Spread to: {adResult.spreading.join(", ")}</Text>}
                {adResult.feedPostId && <Text style={styles.movieResultMeta}>Post ID: {adResult.feedPostId}</Text>}
              </View>
            )}
          </View>
        )}

        {/* ══════════════ BREAKING NEWS ══════════════ */}
        <SectionHeader title="Breaking News" emoji="📰" expanded={expandedSections.news} onToggle={() => toggleSection("news")} accent="#dc2626" />
        {expandedSections.news && (
          <View style={styles.sectionBody}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12, lineHeight: 18 }}>
              9-clip news broadcast with 3 stories: Intro → Desk Story 1 → Field Report 1 → Desk Story 2 → Field Report 2 → Desk Story 3 → Field Report 3 → Wrap-up → Outro. Based on real current events from the briefing, but with all names and places hilariously discombobulated.
            </Text>

            {/* Topic presets (up to 3) */}
            <Text style={styles.subsectionLabel}>News Topics (pick up to 3)</Text>
            <View style={styles.genreGrid}>
              {NEWS_TOPICS.map(t => {
                const isSelected = selectedNewsTopics.includes(t.id);
                const atLimit = selectedNewsTopics.length >= 3 && !isSelected;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.genreChip, isSelected && { borderColor: "#dc2626", backgroundColor: "rgba(220,38,38,0.15)" }, atLimit && { opacity: 0.4 }]}
                    disabled={atLimit}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedNewsTopics(prev =>
                        prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id]
                      );
                    }}>
                    <Text style={[styles.genreChipText, isSelected && { color: "#dc2626" }]}>
                      {t.emoji} {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {selectedNewsTopics.length > 0 && (
              <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: -8, marginBottom: 12 }}>
                {selectedNewsTopics.length}/3 selected{selectedNewsTopics.length >= 3 ? " (max)" : ""}
              </Text>
            )}

            {/* Topic input */}
            <Text style={styles.subsectionLabel}>Custom Topic (optional)</Text>
            <TextInput
              style={{ backgroundColor: "#1f2937", borderWidth: 1, borderColor: "#374151", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14, minHeight: 60, textAlignVertical: "top", marginBottom: 16 }}
              value={newsTopicInput} onChangeText={setNewsTopicInput}
              placeholder="Add extra detail or leave blank..."
              placeholderTextColor={colors.textMuted} multiline maxLength={500}
            />

            {/* Generate + Cancel buttons */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              <TouchableOpacity
                style={[styles.movieGenBtn, { flex: 1, backgroundColor: "#dc2626", borderColor: "#ef4444" }, newsGenerating && { opacity: 0.5 }]}
                onPress={handleNewsGenerate} disabled={newsGenerating}>
                <Text style={styles.movieGenBtnText}>
                  {newsGenerating ? `📰 ${newsPhase === "screenplay" ? "Writing script..." : newsPhase === "submitting" ? "Submitting clips..." : newsPhase === "polling" ? "Rendering clips..." : newsPhase === "stitching" ? "Stitching broadcast..." : "Generating..."}` : "📰 Go Live — Breaking News"}
                </Text>
              </TouchableOpacity>
              {newsGenerating && (
                <TouchableOpacity style={[styles.movieGenBtn, { backgroundColor: "#6b2121", borderColor: "#991b1b", paddingHorizontal: 16 }]} onPress={handleCancelNews}>
                  <Text style={styles.movieGenBtnText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Progress bar */}
            {newsGenerating && newsPhase !== "idle" && (
              <View style={{ marginBottom: 12 }}>
                <View style={styles.movieProgressBarBg}>
                  <View style={[styles.movieProgressBarFill, { width: `${newsProgress.pct}%`, backgroundColor: "#dc2626" }]} />
                </View>
                <Text style={styles.movieProgressLabel}>
                  {newsPhase === "screenplay" ? "Writing script..." :
                   newsPhase === "submitting" ? `Submitting clips ${newsProgress.current}/${newsProgress.total}` :
                   newsPhase === "polling" ? `Rendering ${newsProgress.current}/${newsProgress.total} clips done` :
                   newsPhase === "stitching" ? "Stitching broadcast..." : newsPhase}
                </Text>
              </View>
            )}

            {/* Clip statuses */}
            {newsSceneStatuses.length > 0 && (newsGenerating || newsPhase === "complete" || newsPhase === "failed") && (
              <View style={{ marginBottom: 12 }}>
                {newsSceneStatuses.map(s => (
                  <View key={s.sceneNumber} style={styles.sceneStatusRow}>
                    <Text style={styles.sceneStatusEmoji}>{s.status === "done" ? "✅" : s.status === "failed" ? "❌" : s.status === "rendering" ? "🔄" : s.status === "submitted" ? "⏳" : "⚪"}</Text>
                    <Text style={styles.sceneStatusTitle} numberOfLines={1}>Clip {s.sceneNumber}: {s.title}</Text>
                    <StatusBadge status={s.status} />
                  </View>
                ))}
              </View>
            )}

            {/* Result card */}
            {newsResult && (
              <View style={[styles.movieResultCard, { borderColor: "#dc2626" }]}>
                <Text style={[styles.movieResultTitle, { color: "#dc2626" }]}>BREAKING: {newsResult.title}</Text>
                {newsResult.finalVideoUrl && <Text style={[styles.movieResultMeta, { color: colors.cyan }]} onPress={() => {}}>{newsResult.finalVideoUrl}</Text>}
                {newsResult.clipCount && <Text style={styles.movieResultMeta}>Clips: {newsResult.clipCount} · {newsResult.sizeMb}MB</Text>}
                {newsResult.spreading?.length > 0 && <Text style={[styles.movieResultMeta, { color: colors.green }]}>Spread to: {newsResult.spreading.join(", ")}</Text>}
                {newsResult.feedPostId && <Text style={styles.movieResultMeta}>Post ID: {newsResult.feedPostId}</Text>}
              </View>
            )}

            {/* Generation log */}
            {newsLog.length > 0 && <GenerationLog entries={newsLog} onClear={() => { setNewsLog([]); if (!newsGenerating) { setNewsPhase("idle"); setNewsSceneStatuses([]); } }} />}
          </View>
        )}

        {/* ══════════════ LIBRARY ══════════════ */}
        <SectionHeader title={`Library (${library.length + moviesList.length})`} emoji="📚" expanded={expandedSections.library} onToggle={() => toggleSection("library")} accent={colors.amber} />
        {expandedSections.library && (
          <View style={styles.sectionBody}>
            {libraryLoading && <ActivityIndicator color={colors.purple} style={{ marginVertical: 16 }} />}

            {/* Movies */}
            {moviesList.length > 0 && (
              <>
                <Text style={styles.subsectionLabel}>Movies ({moviesList.length})</Text>
                {moviesList.slice(0, 20).map((movie: any, i: number) => (
                  <View key={movie.id || i} style={styles.libraryItem}>
                    {movie.thumbnail_url && <Image source={{ uri: movie.thumbnail_url }} style={styles.libraryThumb} />}
                    {!movie.thumbnail_url && <View style={[styles.libraryThumb, { backgroundColor: "rgba(147,51,234,0.15)", justifyContent: "center", alignItems: "center" }]}><Text style={{ fontSize: 24 }}>🎬</Text></View>}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.libraryTitle}>{movie.title || "Untitled Movie"}</Text>
                      <Text style={styles.libraryMeta}>{movie.genre || ""} {movie.director_username ? `· ${movie.director_username}` : ""}</Text>
                      {movie.tagline && <Text style={styles.libraryPrompt} numberOfLines={1}>{movie.tagline}</Text>}
                    </View>
                    <StatusBadge status={movie.status || "complete"} />
                  </View>
                ))}
              </>
            )}

            {/* Marketing Posts */}
            {library.length > 0 && (
              <>
                <Text style={[styles.subsectionLabel, moviesList.length > 0 && { marginTop: 16 }]}>Posts ({library.length})</Text>
                {library.slice(0, 20).map((item: any, i: number) => (
                  <View key={item.id || i} style={styles.libraryItem}>
                    {item.media_url && <Image source={{ uri: item.media_url }} style={styles.libraryThumb} />}
                    {!item.media_url && <View style={[styles.libraryThumb, { backgroundColor: "rgba(245,158,11,0.15)", justifyContent: "center", alignItems: "center" }]}><Text style={{ fontSize: 24 }}>📄</Text></View>}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.libraryTitle}>{item.post_type || item.media_type || "Post"}</Text>
                      <Text style={styles.libraryMeta}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : ""}</Text>
                      {item.content && <Text style={styles.libraryPrompt} numberOfLines={1}>{item.content}</Text>}
                    </View>
                    <StatusBadge status={item.status || "posted"} />
                  </View>
                ))}
              </>
            )}

            {library.length === 0 && moviesList.length === 0 && !libraryLoading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📚</Text>
                <Text style={styles.emptyTitle}>No content yet</Text>
                <Text style={styles.emptySub}>Generated content will appear here</Text>
              </View>
            )}

            <TouchableOpacity style={styles.refreshBtn} onPress={loadLibrary}>
              <Text style={[styles.refreshBtnText, { color: colors.amber }]}>Refresh Library</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ══════════════ BLOB STORAGE ══════════════ */}
        <SectionHeader title={`Blob Storage (${blobTotal})`} emoji="☁️" expanded={expandedSections.uploads} onToggle={() => toggleSection("uploads")} accent={colors.cyan} />
        {expandedSections.uploads && (
          <View style={styles.sectionBody}>
            {blobLoading && <ActivityIndicator color={colors.cyan} style={{ marginVertical: 16 }} />}

            {/* Video stats summary */}
            {videoStats && (
              <View style={styles.statsGrid}>
                <StatCard emoji="📹" value={videoStats.total || 0} label="Total Media" color={colors.cyan} />
                <StatCard emoji="🎬" value={videoStats.by_source?.["director-movie"] || 0} label="Movies" color={colors.pink} />
                <StatCard emoji="📰" value={videoStats.by_source?.news || 0} label="News" color={colors.amber} />
                <StatCard emoji="🎯" value={videoStats.by_source?.ads || 0} label="Ads" color={colors.orange} />
              </View>
            )}

            {/* Folder browser */}
            <Text style={[styles.subsectionLabel, { marginTop: 16 }]}>Storage Folders</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <TouchableOpacity style={[styles.catChip, !selectedFolder && styles.catChipActive]}
                onPress={() => setSelectedFolder(null)}>
                <Text style={[styles.catChipText, !selectedFolder && styles.catChipTextActive]}>All</Text>
              </TouchableOpacity>
              {Object.keys(blobFolders).sort().map(folder => (
                <TouchableOpacity key={folder}
                  style={[styles.catChip, selectedFolder === folder && styles.catChipActive, { marginLeft: 6 }]}
                  onPress={() => setSelectedFolder(selectedFolder === folder ? null : folder)}>
                  <Text style={[styles.catChipText, selectedFolder === folder && styles.catChipTextActive]}>
                    {folder.replace("premiere/", "").replace(/\//g, "")} ({blobFolders[folder].count})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Selected folder details */}
            {selectedFolder && blobFolders[selectedFolder] && (
              <View style={styles.folderDetail}>
                <Text style={styles.folderName}>📁 {selectedFolder}</Text>
                <Text style={styles.folderMeta}>
                  {blobFolders[selectedFolder].count} files · {(blobFolders[selectedFolder].totalSize / 1048576).toFixed(0)} MB
                </Text>
                {blobFolders[selectedFolder].videos?.slice(0, 5).map((v: any, i: number) => (
                  <View key={i} style={styles.blobFileItem}>
                    <Text style={{ fontSize: 16 }}>🎬</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.uploadName} numberOfLines={1}>{v.pathname?.split("/").pop() || "video"}</Text>
                      <Text style={styles.uploadMeta}>{(v.size / 1048576).toFixed(1)} MB · {v.uploadedAt ? new Date(v.uploadedAt).toLocaleDateString() : ""}</Text>
                    </View>
                  </View>
                ))}
                {blobFolders[selectedFolder].videos?.length > 5 && (
                  <Text style={styles.moreText}>+{blobFolders[selectedFolder].videos.length - 5} more files</Text>
                )}
              </View>
            )}

            {/* Media library items */}
            {!selectedFolder && mediaLibrary.length > 0 && (
              <>
                <Text style={[styles.subsectionLabel, { marginTop: 12 }]}>Media Library ({mediaLibrary.length})</Text>
                {mediaLibrary.slice(0, 15).map((item: any, i: number) => (
                  <View key={item.id || i} style={styles.uploadItem}>
                    {item.media_type === "image" || item.url?.match(/\.(png|jpg|jpeg|webp|gif)$/i) ? (
                      <Image source={{ uri: item.url }} style={styles.uploadThumb} />
                    ) : (
                      <View style={styles.uploadFileBadge}><Text style={{ fontSize: 24 }}>{item.media_type === "video" ? "🎬" : "📄"}</Text></View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.uploadName} numberOfLines={1}>{item.url?.split("/").pop() || "media"}</Text>
                      <Text style={styles.uploadMeta}>
                        {item.media_type || "unknown"} {item.persona_username ? `· ${item.persona_emoji || ""} ${item.persona_username}` : ""} {item.tags ? `· ${item.tags}` : ""}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => {
                      Alert.alert("Delete?", `Remove this ${item.media_type || "media"}?`, [
                        { text: "Cancel", style: "cancel" },
                        { text: "Delete", style: "destructive", onPress: async () => {
                          if (!walletAddress) return;
                          try { await deleteMedia(walletAddress, item.id); setMediaLibrary(prev => prev.filter(m => m.id !== item.id)); } catch (e: any) { Alert.alert("Error", e?.message); }
                        }},
                      ]);
                    }} style={styles.deleteBtn}>
                      <Text style={{ fontSize: 18 }}>🗑</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            {/* Empty state */}
            {Object.keys(blobFolders).length === 0 && mediaLibrary.length === 0 && !blobLoading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>☁️</Text>
                <Text style={styles.emptyTitle}>Blob storage is empty</Text>
                <Text style={styles.emptySub}>Upload media or resync to discover files</Text>
              </View>
            )}

            {/* Upload button */}
            <TouchableOpacity style={[styles.uploadBtn, uploading && { opacity: 0.5 }]} onPress={showUploadOptions} disabled={uploading}>
              <Text style={styles.uploadBtnEmoji}>☁️</Text>
              <View>
                <Text style={styles.uploadBtnText}>{uploading ? "Uploading..." : "Upload Media"}</Text>
                <Text style={styles.uploadBtnSub}>{selectedFolder ? `To: ${selectedFolder}` : "To media library"}</Text>
              </View>
            </TouchableOpacity>

            {/* Import from URL */}
            <Text style={[styles.subsectionLabel, { marginTop: 16 }]}>Import from URL</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput style={[styles.optionInput, { flex: 1, minHeight: 42 }]}
                value={importUrl} onChangeText={setImportUrl}
                placeholder="https://example.com/video.mp4"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none" autoCorrect={false} />
              <TouchableOpacity style={[styles.importBtn, !importUrl.trim() && { opacity: 0.3 }]}
                onPress={handleImportUrl} disabled={!importUrl.trim()}>
                <Text style={styles.importBtnText}>Import</Text>
              </TouchableOpacity>
            </View>

            {/* Admin actions */}
            <View style={styles.adminActions}>
              <TouchableOpacity style={[styles.adminBtn, resyncing && { opacity: 0.5 }]}
                onPress={handleResync} disabled={resyncing}>
                <Text style={styles.adminBtnText}>{resyncing ? "Resyncing..." : "🔄 Resync DB"}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adminBtn} onPress={loadBlobStorage}>
                <Text style={styles.adminBtnText}>🔃 Refresh</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ══════════════ SOCIAL DISTRIBUTION ══════════════ */}
        <SectionHeader title="Social Distribution" emoji="📡" expanded={expandedSections.social} onToggle={() => toggleSection("social")} accent={colors.pink} />
        {expandedSections.social && (
          <View style={styles.sectionBody}>
            <Text style={styles.subsectionLabel}>Platforms</Text>
            <View style={styles.platformGrid}>
              {PLATFORMS.map(p => {
                const account = platformAccounts.find((a: any) => a.platform === p.key);
                const isConnected = account?.is_active;
                return (
                  <View key={p.key} style={[styles.platformCard, { borderTopColor: p.color }]}>
                    <Text style={{ fontSize: 24 }}>{p.emoji}</Text>
                    <Text style={[styles.platformName, { color: p.color }]}>{p.name}</Text>
                    <StatusBadge status={isConnected ? "posted" : "pending"} />
                  </View>
                );
              })}
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

            {/* Stats grid — always show */}
            <Text style={styles.subsectionLabel}>Generation Stats</Text>
            <View style={styles.statsGrid}>
              <StatCard emoji="📢" value={mktgStats?.posters_generated || mktgStats?.total_posters || 0} label="Posters" color={colors.purpleLight} />
              <StatCard emoji="🖼" value={mktgStats?.heroes_generated || mktgStats?.total_heroes || 0} label="Heroes" color={colors.cyan} />
              <StatCard emoji="🎬" value={mktgStats?.movies_count || mktgStats?.total_videos || 0} label="Movies" color={colors.pink} />
              <StatCard emoji="📡" value={mktgStats?.posts_spread || mktgStats?.total_spreads || 0} label="Spreads" color={colors.amber} />
            </View>

            {/* Ad & Movie pipeline stats */}
            {(mktgStats?.ad_jobs != null || mktgStats?.movie_jobs != null) && (
              <View style={[styles.statsGrid, { marginTop: 10 }]}>
                <StatCard emoji="🎯" value={mktgStats?.ad_jobs || 0} label="Ad Jobs" color={colors.orange} />
                <StatCard emoji="🎥" value={mktgStats?.movie_jobs || 0} label="Movie Jobs" color={colors.pink} />
              </View>
            )}

            {/* System health */}
            <Text style={[styles.subsectionLabel, { marginTop: 16 }]}>System Health</Text>
            {healthData ? (
              <View style={styles.healthGrid}>
                {(Array.isArray(healthData.services) ? healthData.services : Object.entries(healthData.services || healthData).map(([k, v]: [string, any]) => ({ name: k, ...((typeof v === "object" && v) || { status: v ? "healthy" : "down" }) }))).slice(0, 8).map((svc: any, i: number) => (
                  <View key={i} style={styles.healthItem}>
                    <View style={[styles.healthDot, { backgroundColor: svc.status === "healthy" || svc.status === "ok" || svc.healthy === true ? colors.green : svc.status === "degraded" ? colors.yellow : colors.red }]} />
                    <Text style={styles.healthLabel}>{(svc.name || "service").replace(/_/g, " ")}</Text>
                    {svc.latency_ms != null && <Text style={styles.healthLatency}>{svc.latency_ms}ms</Text>}
                  </View>
                ))}
                {healthData.overall && (
                  <View style={styles.healthItem}>
                    <View style={[styles.healthDot, { backgroundColor: healthData.overall === "healthy" ? colors.green : colors.yellow }]} />
                    <Text style={[styles.healthLabel, { fontWeight: "800" }]}>Overall: {healthData.overall}</Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={styles.healthFallback}>Tap Refresh to load health data</Text>
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
  logHeaderRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#111827", paddingHorizontal: 12, paddingVertical: 8,
  },
  logHeader: {
    color: colors.textSecondary, fontSize: 11, fontWeight: "700", textTransform: "uppercase",
    letterSpacing: 1,
  },
  logClearBtn: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    backgroundColor: "rgba(239,68,68,0.15)", borderWidth: 1, borderColor: "rgba(239,68,68,0.3)",
  },
  logClearText: { color: colors.red, fontSize: 10, fontWeight: "700" },
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

  // Blob folder details
  folderDetail: {
    backgroundColor: "rgba(6,182,212,0.06)", borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: "rgba(6,182,212,0.2)",
  },
  folderName: { color: colors.cyan, fontSize: 14, fontWeight: "800" },
  folderMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2, marginBottom: 8 },
  blobFileItem: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 6, borderTopWidth: 1, borderTopColor: "rgba(6,182,212,0.1)",
  },
  moreText: { color: colors.textMuted, fontSize: 11, fontStyle: "italic", marginTop: 6 },

  // Import
  importBtn: {
    backgroundColor: colors.cyan, borderRadius: 10, paddingHorizontal: 16,
    justifyContent: "center", alignItems: "center",
  },
  importBtnText: { color: "#000", fontSize: 13, fontWeight: "800" },

  // Admin actions row
  adminActions: {
    flexDirection: "row", gap: 10, marginTop: 16,
  },
  adminBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.cyan, borderRadius: 10,
    paddingVertical: 12, alignItems: "center",
  },
  adminBtnText: { color: colors.cyan, fontSize: 13, fontWeight: "700" },

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
  healthLatency: { color: colors.textMuted, fontSize: 10 },
  healthFallback: { color: colors.textMuted, fontSize: 13, fontStyle: "italic", paddingVertical: 8 },

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
