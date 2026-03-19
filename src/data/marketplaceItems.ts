// AIG!itch Marketplace — 50 absurd NFT items with §GLITCH coin prices
// These items exist in the AIG!itch ecosystem and can be used for product ad campaigns

export interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  price: number; // in §GLITCH coins
  category: string;
  emoji: string;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
}

const MARKETPLACE_ITEMS: MarketplaceItem[] = [
  // Wearables
  { id: "mp-001", name: "Quantum Flip Flops", description: "Sandals that exist in two places at once. Walk forward and backward simultaneously.", price: 420, category: "Wearables", emoji: "🩴", rarity: "rare" },
  { id: "mp-002", name: "Anti-Gravity Beanie", description: "A beanie that makes your thoughts float upward. Side effects include spontaneous levitation of nearby objects.", price: 690, category: "Wearables", emoji: "🧢", rarity: "epic" },
  { id: "mp-003", name: "Invisible Sunglasses", description: "100% UV protection. 0% visibility. You can't see them and they can't see you.", price: 150, category: "Wearables", emoji: "🕶", rarity: "common" },
  { id: "mp-004", name: "Blockchain Hoodie", description: "Every thread is a verified transaction. Takes 45 minutes to put on due to consensus mechanisms.", price: 1200, category: "Wearables", emoji: "🧥", rarity: "legendary" },
  { id: "mp-005", name: "Pixel Socks", description: "8-bit comfort for your feet. Resolution increases when you run.", price: 88, category: "Wearables", emoji: "🧦", rarity: "common" },
  { id: "mp-006", name: "Holographic Cape", description: "Projects your best moments behind you as you walk. Automatically edits out embarrassing ones.", price: 2500, category: "Wearables", emoji: "🦸", rarity: "legendary" },

  // Food & Drink
  { id: "mp-007", name: "Compressed Cloud Sandwich", description: "A sandwich made entirely of compressed cloud data. Tastes like bandwidth.", price: 35, category: "Food", emoji: "🥪", rarity: "common" },
  { id: "mp-008", name: "WiFi Flavored Energy Drink", description: "Drink it and you become a hotspot. 5G taste, 2G aftertaste.", price: 69, category: "Food", emoji: "🥤", rarity: "uncommon" },
  { id: "mp-009", name: "Recursive Pizza", description: "Each slice contains a smaller pizza. Infinite toppings. Never actually finishes loading.", price: 314, category: "Food", emoji: "🍕", rarity: "rare" },
  { id: "mp-010", name: "Deep-Fried Meme", description: "Literally a deep-fried meme. Crunchy on the outside, viral on the inside.", price: 42, category: "Food", emoji: "🍟", rarity: "common" },
  { id: "mp-011", name: "Cryptocurrency Cookie", description: "Value changes with every bite. May be worth a fortune or crumbs by dessert.", price: 777, category: "Food", emoji: "🍪", rarity: "epic" },
  { id: "mp-012", name: "404 Soup (Not Found)", description: "You ordered soup but it was not found. The bowl exists though. Very zen.", price: 44, category: "Food", emoji: "🍜", rarity: "uncommon" },

  // Tech & Gadgets
  { id: "mp-013", name: "USB-Z Cable", description: "Plugs in on the first try, every time. Scientists say it's impossible but here we are.", price: 9999, category: "Tech", emoji: "🔌", rarity: "legendary" },
  { id: "mp-014", name: "Mood Ring Router", description: "Changes WiFi speed based on your emotional state. Happy = fast. Angry = dial-up sounds.", price: 500, category: "Tech", emoji: "💍", rarity: "rare" },
  { id: "mp-015", name: "Bluetooth Candle", description: "A candle that pairs with your phone. Flame flickers to the beat of your music.", price: 180, category: "Tech", emoji: "🕯", rarity: "uncommon" },
  { id: "mp-016", name: "AI Toaster", description: "Uses machine learning to burn your face onto toast. Uncanny valley breakfast.", price: 350, category: "Tech", emoji: "🍞", rarity: "rare" },
  { id: "mp-017", name: "Wireless Brick", description: "It's a brick. But wireless. No function. No purpose. Peak minimalism.", price: 10000, category: "Tech", emoji: "🧱", rarity: "legendary" },
  { id: "mp-018", name: "Crypto Mining Pickaxe", description: "An actual pickaxe for mining cryptocurrency. Mines 0.0000001 BTC per swing.", price: 1500, category: "Tech", emoji: "⛏", rarity: "epic" },
  { id: "mp-019", name: "Sentient Keyboard", description: "Types what you're thinking before you think it. Usually wrong. Very confident.", price: 888, category: "Tech", emoji: "⌨️", rarity: "epic" },

  // Pets & Companions
  { id: "mp-020", name: "Pixel Hamster", description: "A hamster that only exists in 16x16 pixels. Eats digital seeds. Runs on a virtual wheel that powers nothing.", price: 250, category: "Pets", emoji: "🐹", rarity: "uncommon" },
  { id: "mp-021", name: "Ghost Fish", description: "An invisible fish for your invisible aquarium. You'll know it's there because sometimes the water moves.", price: 175, category: "Pets", emoji: "🐟", rarity: "uncommon" },
  { id: "mp-022", name: "Emotional Support Cactus", description: "A cactus that listens to your problems. Can't hug you. Will try anyway.", price: 99, category: "Pets", emoji: "🌵", rarity: "common" },
  { id: "mp-023", name: "Time-Traveling Parrot", description: "Repeats things you'll say tomorrow. Spoiler alert: you say some weird stuff.", price: 3000, category: "Pets", emoji: "🦜", rarity: "legendary" },
  { id: "mp-024", name: "Blockchain Butterfly", description: "Each wing pattern is a unique NFT. Flies away if gas fees are too high.", price: 650, category: "Pets", emoji: "🦋", rarity: "rare" },

  // Home & Living
  { id: "mp-025", name: "Existential Alarm Clock", description: "Wakes you up by asking 'But why?' repeatedly. Snooze button triggers philosophical debate.", price: 222, category: "Home", emoji: "⏰", rarity: "uncommon" },
  { id: "mp-026", name: "Zero-Gravity Bean Bag", description: "A bean bag that floats. You float too. Nothing touches the ground. Landlord hates it.", price: 1800, category: "Home", emoji: "🛋", rarity: "epic" },
  { id: "mp-027", name: "Vibes-Only Lamp", description: "Doesn't produce light. Just vibes. Certified vibe-emitting device. FDA not involved.", price: 333, category: "Home", emoji: "💡", rarity: "rare" },
  { id: "mp-028", name: "Quantum Mirror", description: "Shows you what you'd look like in parallel universes. Mostly the same but with different hair.", price: 4200, category: "Home", emoji: "🪞", rarity: "legendary" },
  { id: "mp-029", name: "Self-Aware Doormat", description: "Judges everyone who walks over it. Has a blog about its experiences.", price: 55, category: "Home", emoji: "🚪", rarity: "common" },
  { id: "mp-030", name: "Decentralized Pillow", description: "Your sleep data is stored across 1000 nodes. Very comfortable. Very public.", price: 420, category: "Home", emoji: "🛏", rarity: "rare" },

  // Art & Collectibles
  { id: "mp-031", name: "Empty Frame (Limited Edition)", description: "A frame with nothing in it. The absence of art IS the art. Numbered 1 of 1 of 1.", price: 5000, category: "Art", emoji: "🖼", rarity: "legendary" },
  { id: "mp-032", name: "Glitched Mona Lisa", description: "She's smiling. She's frowning. She's loading. She's crashed. Reboot to view.", price: 7777, category: "Art", emoji: "🎨", rarity: "legendary" },
  { id: "mp-033", name: "Audio NFT of Silence", description: "4 minutes and 33 seconds of premium, blockchain-verified silence. Mint condition.", price: 433, category: "Art", emoji: "🔇", rarity: "rare" },
  { id: "mp-034", name: "Procedurally Generated Rock", description: "A unique rock generated by algorithm. No two are alike. All are rocks.", price: 15, category: "Art", emoji: "🪨", rarity: "common" },
  { id: "mp-035", name: "Upside Down Trophy", description: "Awarded for coming in last. Intentionally. That's the challenge.", price: 111, category: "Art", emoji: "🏆", rarity: "uncommon" },

  // Transportation
  { id: "mp-036", name: "Solar-Powered Skateboard", description: "Only works in direct sunlight. Completely useless at night. Peak green energy.", price: 600, category: "Transport", emoji: "🛹", rarity: "rare" },
  { id: "mp-037", name: "Inflatable Yacht (1:100 Scale)", description: "A yacht for your bathtub. Comes with tiny inflatable crew. Captain has a backstory.", price: 950, category: "Transport", emoji: "🛥", rarity: "epic" },
  { id: "mp-038", name: "Teleportation Boots (Beta)", description: "Teleport anywhere! *Disclaimer: destination is random. 40% chance of arriving naked.*", price: 8888, category: "Transport", emoji: "👢", rarity: "legendary" },
  { id: "mp-039", name: "Cardboard Rocket Ship", description: "Does not fly. Makes excellent rocket noises if you believe hard enough.", price: 25, category: "Transport", emoji: "🚀", rarity: "common" },

  // Potions & Consumables
  { id: "mp-040", name: "Liquid Confidence", description: "One sip and you'll DM your crush, pitch a startup, and fight a bear. Not necessarily in that order.", price: 369, category: "Potions", emoji: "🧪", rarity: "rare" },
  { id: "mp-041", name: "Bottled Deja Vu", description: "Haven't you drank this before? You have. You will. Time is a flat circle.", price: 222, category: "Potions", emoji: "🍾", rarity: "uncommon" },
  { id: "mp-042", name: "Memory Foam Potion", description: "Drink it and your memory becomes foam. Soft, comfortable, and completely unreliable.", price: 144, category: "Potions", emoji: "🫗", rarity: "uncommon" },
  { id: "mp-043", name: "Instant Regret Serum", description: "Makes you feel the regret of every bad decision at once. Popular at parties.", price: 13, category: "Potions", emoji: "💊", rarity: "common" },

  // Digital Assets
  { id: "mp-044", name: "Password to Nothing", description: "A 256-bit encrypted password that unlocks absolutely nothing. But it's YOUR nothing.", price: 1, category: "Digital", emoji: "🔐", rarity: "common" },
  { id: "mp-045", name: "100 Unread Emails", description: "Pre-loaded inbox anxiety. For people who miss the corporate life.", price: 0, category: "Digital", emoji: "📧", rarity: "common" },
  { id: "mp-046", name: "Premium Loading Screen", description: "A beautiful loading animation that loads nothing. Loops forever. Very satisfying.", price: 500, category: "Digital", emoji: "⏳", rarity: "rare" },
  { id: "mp-047", name: "Genesis Block Plushie", description: "A cuddly representation of Block #0. Satoshi slept with one. Probably.", price: 2100, category: "Digital", emoji: "🧸", rarity: "epic" },

  // Mystery
  { id: "mp-048", name: "The Unopenable Box", description: "What's inside? Nobody knows. The box cannot be opened. That's the whole product.", price: 666, category: "Mystery", emoji: "📦", rarity: "rare" },
  { id: "mp-049", name: "Yesterday's Tomorrow", description: "It's always one day away from being relevant. Schrödinger's calendar entry.", price: 365, category: "Mystery", emoji: "📅", rarity: "uncommon" },
  { id: "mp-050", name: "Absolute Unit NFT", description: "An NFT of an absolute unit. In awe at the size of this lad. Certified large.", price: 1337, category: "Mystery", emoji: "🦣", rarity: "epic" },
];

export default MARKETPLACE_ITEMS;

/** Pick a random marketplace item */
export function getRandomMarketplaceItem(): MarketplaceItem {
  return MARKETPLACE_ITEMS[Math.floor(Math.random() * MARKETPLACE_ITEMS.length)];
}

/** Pick N unique random items */
export function getRandomMarketplaceItems(n: number): MarketplaceItem[] {
  const shuffled = [...MARKETPLACE_ITEMS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, MARKETPLACE_ITEMS.length));
}

/** Format item for ad concept prompt */
export function formatItemForAd(item: MarketplaceItem): string {
  return `Product Ad for "${item.name}" — ${item.description} Price: ${item.price} §GLITCH coins. Rarity: ${item.rarity}. Category: ${item.category}. This is an NFT available in the AIG!itch Marketplace.`;
}
