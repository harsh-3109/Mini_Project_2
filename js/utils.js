/**
 * Recommendation-Ranked Social Feed Studio
 * Core Utilities, Toast Notifications, Formatters, & Seed Data Generator
 */

// Toast notification manager
export function showToast(message, type = "info", duration = 3500) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = `toast toast-${type} animate-slide-in`;
  
  const iconMap = {
    success: `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`,
    error: `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>`,
    warning: `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`,
    info: `<svg class="toast-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`
  };

  toast.innerHTML = `
    ${iconMap[type] || iconMap.info}
    <div class="toast-message">${escapeHtml(message)}</div>
    <button class="toast-close" aria-label="Close">&times;</button>
  `;

  container.appendChild(toast);

  toast.querySelector(".toast-close").addEventListener("click", () => {
    toast.remove();
  });

  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add("fade-out");
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
}

// Format relative timestamp
export function formatRelativeTime(timestamp) {
  if (!timestamp) return "Just now";
  
  let date;
  if (timestamp.toDate && typeof timestamp.toDate === "function") {
    date = timestamp.toDate();
  } else if (timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp);
  }

  if (isNaN(date.getTime())) return "Recently";

  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 60) return "Just now";
  const minutes = Math.floor(diffInSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Format numbers (e.g., 1200 -> 1.2K)
export function formatCount(num) {
  if (num === undefined || num === null) return "0";
  const n = Number(num);
  if (isNaN(n)) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

// Escape HTML characters
export function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Generate unique ID
export function generateId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Modal open/close helpers
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }
}

// Local mock data store initialized if running in educational offline mode
export const LOCAL_STORAGE_KEY_PREFIX = "rr_social_";

export function getLocalCollection(collectionName) {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${collectionName}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error(`Error reading ${collectionName} from localStorage:`, e);
    return [];
  }
}

export function saveLocalCollection(collectionName, items) {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${collectionName}`, JSON.stringify(items));
  } catch (e) {
    console.error(`Error saving ${collectionName} to localStorage:`, e);
  }
}

// Seed sample users (At least 5 diverse realistic users)
export const sampleUsers = [
  {
    uid: "user_maya_lin",
    name: "Dr. Maya Lin",
    username: "mayalin_ai",
    email: "maya.lin@technet.org",
    bio: "Senior AI Researcher & Computational Sociologist. Investigating recommender transparency and algorithmic feedback loops.",
    profileImage: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80",
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString()
  },
  {
    uid: "user_alex_chen",
    name: "Alex Chen",
    username: "alexchen_dev",
    email: "alex.chen@fullstack.io",
    bio: "Staff Frontend Architect @ CloudScale. Passionate about Web Performance, Clean Architecture, and Open Web Standards.",
    profileImage: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString()
  },
  {
    uid: "user_elena_rostova",
    name: "Elena Rostova",
    username: "elena_ux",
    email: "elena@designcraft.studio",
    bio: "Design Director & Human-Computer Interaction specialist. Crafting ethical interfaces for complex algorithmic systems.",
    profileImage: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString()
  },
  {
    uid: "user_marcus_vance",
    name: "Marcus Vance",
    username: "marcus_data",
    email: "marcus@datalens.co",
    bio: "Data Engineer & Distributed Systems enthusiast. Building real-time streaming pipelines for social discovery graphs.",
    profileImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString()
  },
  {
    uid: "user_sarah_patel",
    name: "Sarah Patel",
    username: "sarah_product",
    email: "sarah.patel@growthventures.vc",
    bio: "VP of Product. Obsessed with content distribution dynamics, audience engagement mechanics, and ethical viral loops.",
    profileImage: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&auto=format&fit=crop&q=80",
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString()
  }
];

// Seed 20 realistic posts with diverse timestamps, engagement levels, and authors
export const samplePosts = [
  {
    postId: "post_sample_01",
    authorId: "user_maya_lin",
    content: "Why do recommendation algorithms favor engagement over truth? Our latest study on 10,000 algorithmic feeds shows that high-affinity outrage content receives a 4.2x engagement boost over nuanced educational breakdowns. We need transparent weight models! #AlgorithmEthics #MachineLearning",
    imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80",
    likesCount: 142,
    commentsCount: 38,
    sharesCount: 52,
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45m ago (High recency, high viral)
    visibility: "public"
  },
  {
    postId: "post_sample_02",
    authorId: "user_alex_chen",
    content: "Just deployed a zero-dependency vanilla JS canvas graph visualizer. It renders 10,000 animated nodes at steady 60 FPS without React or Webpack overhead. Clean browser primitives are severely underestimated in 2026! 🚀💻 #VanillaJS #WebDev #Performance",
    imageUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80",
    likesCount: 89,
    commentsCount: 19,
    sharesCount: 14,
    createdAt: new Date(Date.now() - 2.5 * 3600 * 1000).toISOString(), // 2.5 hours ago
    visibility: "public"
  },
  {
    postId: "post_sample_03",
    authorId: "user_elena_rostova",
    content: "Design Rule: Never hide the ranking rationale. If you present a curated feed, give users an interactive 'Why am I seeing this?' slider. Transparency transforms suspicion into user agency. ✨🎨 #UIUX #DesignSystems #Transparency",
    imageUrl: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=800&auto=format&fit=crop&q=80",
    likesCount: 215,
    commentsCount: 42,
    sharesCount: 68,
    createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(), // 5 hours ago (Viral)
    visibility: "public"
  },
  {
    postId: "post_sample_04",
    authorId: "user_marcus_vance",
    content: "Handling 500,000 real-time events/sec on our recommendation engine pipeline: Log-normalization is critical for engagement signals! Without $ln(1 + likes)$, a single post with 50K likes drowns out all new discoveries for days. 📊 #BigData #DistributedSystems",
    imageUrl: "",
    likesCount: 64,
    commentsCount: 12,
    sharesCount: 8,
    createdAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(), // 8 hours ago
    visibility: "public"
  },
  {
    postId: "post_sample_05",
    authorId: "user_sarah_patel",
    content: "The evolution of the social feed:\n1. 2008: Reverse Chronological (Pure Recency)\n2. 2016: Virality Dominance (Pure Engagement)\n3. 2026: User-Tuned Multi-Signal Control (Recency + Affinity + Utility).\n\nWhat weight configuration would you choose for your personal feed? 💡",
    imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80",
    likesCount: 310,
    commentsCount: 75,
    sharesCount: 94,
    createdAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(), // 14 hours ago (Mega Viral)
    visibility: "public"
  },
  {
    postId: "post_sample_06",
    authorId: "user_maya_lin",
    content: "Fresh pre-print: 'Measuring Recency Half-Life across Microblogging vs Long-form Media.' In microblogging, the value of a post drops by 50% in under 3.5 hours. In contrast, technical essays exhibit an 18-day half-life. Recommendation engines must adapt dynamically! 📑 #Research #DataScience",
    imageUrl: "",
    likesCount: 95,
    commentsCount: 18,
    sharesCount: 27,
    createdAt: new Date(Date.now() - 20 * 3600 * 1000).toISOString(), // 20 hours ago
    visibility: "public"
  },
  {
    postId: "post_sample_07",
    authorId: "user_alex_chen",
    content: "Tip: CSS grid subgrid and modern flexbox gap have eliminated 90% of layout hackery. Clean semantic HTML with lightweight CSS is now more powerful than bloated 500KB CSS frameworks ever were. 📐 Web craftsmanship is back.",
    imageUrl: "",
    likesCount: 48,
    commentsCount: 7,
    sharesCount: 5,
    createdAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(), // 1 day ago
    visibility: "public"
  },
  {
    postId: "post_sample_08",
    authorId: "user_elena_rostova",
    content: "Working on dark mode contrast ratios. Fun fact: pure #000000 on OLED screens can cause significant eye strain due to harsh chromatic aberration. A rich slate charcoal like #0f172a or #121826 is vastly more comfortable for prolonged reading. 🌙👁️",
    imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80",
    likesCount: 178,
    commentsCount: 31,
    sharesCount: 41,
    createdAt: new Date(Date.now() - 32 * 3600 * 1000).toISOString(), // 1.3 days ago
    visibility: "public"
  },
  {
    postId: "post_sample_09",
    authorId: "user_marcus_vance",
    content: "Benchmark results: Firestore multi-tenant security rules with query constraints vs unindexed joins. Always enforce request.auth.uid validation at the root rule! Security and query optimization go hand-in-hand. 🛡️⚡",
    imageUrl: "",
    likesCount: 37,
    commentsCount: 5,
    sharesCount: 3,
    createdAt: new Date(Date.now() - 40 * 3600 * 1000).toISOString(), // 1.6 days ago
    visibility: "public"
  },
  {
    postId: "post_sample_10",
    authorId: "user_sarah_patel",
    content: "What metrics truly indicate community health? It's not pageviews or raw impressions. It's the ratio of two-way conversations and recurring high-affinity interactions. Prioritize depth over mindless scroll depth! 🤝📈",
    imageUrl: "",
    likesCount: 124,
    commentsCount: 29,
    sharesCount: 18,
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(), // 2 days ago
    visibility: "public"
  },
  {
    postId: "post_sample_11",
    authorId: "user_maya_lin",
    content: "Interactive experiment: When we set Affinity weight to 70% and Recency to 15%, user satisfaction regarding conversational quality increased by 38%, while perceived feed fatigue dropped significantly. 🎯🧪",
    imageUrl: "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=800&auto=format&fit=crop&q=80",
    likesCount: 156,
    commentsCount: 22,
    sharesCount: 39,
    createdAt: new Date(Date.now() - 55 * 3600 * 1000).toISOString(), // 2.3 days ago
    visibility: "public"
  },
  {
    postId: "post_sample_12",
    authorId: "user_alex_chen",
    content: "Quick poll for frontend engineers: How do you handle real-time feed updates? WebSockets, Server-Sent Events (SSE), or Firestore onSnapshot listeners? Each has compelling trade-offs between simplicity and cost! 🔄⚡",
    imageUrl: "",
    likesCount: 73,
    commentsCount: 45,
    sharesCount: 11,
    createdAt: new Date(Date.now() - 65 * 3600 * 1000).toISOString(), // 2.7 days ago
    visibility: "public"
  },
  {
    postId: "post_sample_13",
    authorId: "user_elena_rostova",
    content: "Visualizing mathematical formulas in UI: Instead of intimidating users with raw calculus, use color-coded component bars! Breaking down Recency (Blue), Engagement (Emerald), and Affinity (Purple) creates immediate intuitive comprehension. 🎨✨",
    imageUrl: "https://images.unsplash.com/photo-1542744094-3a31f272c490?w=800&auto=format&fit=crop&q=80",
    likesCount: 230,
    commentsCount: 34,
    sharesCount: 62,
    createdAt: new Date(Date.now() - 75 * 3600 * 1000).toISOString(), // 3.1 days ago
    visibility: "public"
  },
  {
    postId: "post_sample_14",
    authorId: "user_marcus_vance",
    content: "Building an affinity matrix from scratch: We track (1) Direct follows (+40pts), (2) Mutual connections (+15pts), and (3) Reciprocal interaction frequencies (+15pts each). It simulates real human connection depth accurately. 🧠🔗",
    imageUrl: "",
    likesCount: 88,
    commentsCount: 16,
    sharesCount: 12,
    createdAt: new Date(Date.now() - 85 * 3600 * 1000).toISOString(), // 3.5 days ago
    visibility: "public"
  },
  {
    postId: "post_sample_15",
    authorId: "user_sarah_patel",
    content: "The biggest vulnerability of pure engagement-ranking algorithms: Clickbait and polarized sensationalism always maximize raw clicks, but destroy brand loyalty over time. Sustainable platforms rank for constructive utility. 🧭",
    imageUrl: "",
    likesCount: 195,
    commentsCount: 41,
    sharesCount: 50,
    createdAt: new Date(Date.now() - 95 * 3600 * 1000).toISOString(), // 4 days ago
    visibility: "public"
  },
  {
    postId: "post_sample_16",
    authorId: "user_maya_lin",
    content: "Just published our open dataset of synthetic recommendation traces. It includes 100k simulated post ranking decisions with normalized signal contributions. Great for pedagogical sandboxes and classroom demos! 📚📊",
    imageUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=800&auto=format&fit=crop&q=80",
    likesCount: 167,
    commentsCount: 27,
    sharesCount: 44,
    createdAt: new Date(Date.now() - 105 * 3600 * 1000).toISOString(), // 4.3 days ago
    visibility: "public"
  },
  {
    postId: "post_sample_17",
    authorId: "user_alex_chen",
    content: "Clean code philosophy: A junior developer looks for a library. A senior developer writes 40 lines of clean vanilla code and avoids a 15MB dependency tree. Simplicity is the ultimate sophistication. ☕💻",
    imageUrl: "",
    likesCount: 280,
    commentsCount: 63,
    sharesCount: 78,
    createdAt: new Date(Date.now() - 115 * 3600 * 1000).toISOString(), // 4.8 days ago
    visibility: "public"
  },
  {
    postId: "post_sample_18",
    authorId: "user_elena_rostova",
    content: "Accessible design isn't an afterthought. High contrast typography, proper ARIA labels for dynamic feeds, keyboard navigability, and focus rings make the digital world welcoming for everyone. Let's build with empathy. 💛♿",
    imageUrl: "",
    likesCount: 110,
    commentsCount: 14,
    sharesCount: 21,
    createdAt: new Date(Date.now() - 120 * 3600 * 1000).toISOString(), // 5 days ago
    visibility: "public"
  },
  {
    postId: "post_sample_19",
    authorId: "user_marcus_vance",
    content: "Time-decay functions: Exponential vs Linear vs Sigmoid. Linear decay punishes slightly older evergreen content too brutally. Sigmoid or half-life decay gives thoughtful articles a fair chance to find their audience. ⏳📐",
    imageUrl: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800&auto=format&fit=crop&q=80",
    likesCount: 79,
    commentsCount: 11,
    sharesCount: 15,
    createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15m ago (Brand new post!)
    visibility: "public"
  },
  {
    postId: "post_sample_20",
    authorId: "user_sarah_patel",
    content: "Welcome to Recommendation-Ranked Social Feed Studio! You are in the driver's seat. Play with the sliders in the Algorithm Studio, compare chronological feeds against engagement-ranked feeds, and discover how content surfaces! 🚀✨",
    imageUrl: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80",
    likesCount: 340,
    commentsCount: 88,
    sharesCount: 112,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5m ago (Brand new + highly viral)
    visibility: "public"
  }
];

// Sample comments for realism
export const sampleComments = [
  {
    commentId: "comm_01",
    postId: "post_sample_01",
    authorId: "user_alex_chen",
    commentText: "Completely agree with this study! When platforms optimize purely for ad impressions, outrage is the easiest metric lever to pull.",
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
  },
  {
    commentId: "comm_02",
    postId: "post_sample_01",
    authorId: "user_sarah_patel",
    commentText: "Fascinating data Maya. What was the sample size across different geographic regions?",
    createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString()
  },
  {
    commentId: "comm_03",
    postId: "post_sample_02",
    authorId: "user_marcus_vance",
    commentText: "Native canvas rendering is so buttery smooth. No reconciliation overhead!",
    createdAt: new Date(Date.now() - 1.5 * 3600 * 1000).toISOString()
  },
  {
    commentId: "comm_04",
    postId: "post_sample_03",
    authorId: "user_maya_lin",
    commentText: "Transparency in ranking UI builds long-term user trust. Essential UX pattern.",
    createdAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString()
  },
  {
    commentId: "comm_05",
    postId: "post_sample_05",
    authorId: "user_elena_rostova",
    commentText: "I'd definitely set Affinity high for close collaborators and Recency moderate. Give me human connection over virality any day!",
    createdAt: new Date(Date.now() - 10 * 3600 * 1000).toISOString()
  }
];
