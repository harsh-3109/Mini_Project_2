/**
 * Recommendation-Ranked Social Feed Studio
 * Social Feed View Controller & Real-Time Ranking Orchestrator
 * 
 * Supports both Real Imported Instagram Media and Application Community Posts
 * without mixing external and internal metrics.
 */

import { getCurrentUser, initAuth, requireAuth } from "./auth.js";
import { getAllPosts, createPost, updatePost, deletePost } from "./posts.js";
import { getCommentsForPost, addComment, deleteComment } from "./comments.js";
import { getImportedInstagramMedia, getInstagramConnection } from "./instagram.js";
import { 
  hasUserLiked, 
  toggleLikePost, 
  isPostSaved, 
  toggleSavePost, 
  sharePost, 
  isFollowingUser, 
  toggleFollowUser, 
  getSocialContext,
  recordInteraction
} from "./interactions.js";
import { rankPosts, ALGORITHM_PRESETS, normalizeWeights } from "./algorithm.js";
import { formatRelativeTime, formatCount, escapeHtml, showToast, openModal, closeModal } from "./utils.js";
import { updateNavbarNotificationBadge } from "./notifications.js";

import { initFirebase } from "./firebase-config.js";

const CURRENT_ALGORITHM_KEY = "rr_active_algorithm";
let activeWeights = { recencyWeight: 35, engagementWeight: 35, affinityWeight: 30 };
let activeFilter = "all"; // 'all', 'following', 'mine', 'media'
let activeSource = "all"; // 'all', 'instagram', 'community'
let searchQuery = "";
let hiddenPostIds = new Set();
let cachedPosts = [];

/**
 * Get active algorithm weights from storage or default (scoped to authenticated user)
 */
export function getActiveWeights() {
  const user = getCurrentUser();
  const storageKey = user ? `${CURRENT_ALGORITHM_KEY}_${user.uid}` : CURRENT_ALGORITHM_KEY;
  try {
    const saved = localStorage.getItem(storageKey) || localStorage.getItem(CURRENT_ALGORITHM_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return normalizeWeights(parsed.recencyWeight, parsed.engagementWeight, parsed.affinityWeight);
    }
  } catch (e) {}
  return activeWeights;
}

/**
 * Save active algorithm weights against authenticated user UID
 */
export async function setActiveWeights(weights) {
  const user = getCurrentUser();
  activeWeights = normalizeWeights(weights.recencyWeight, weights.engagementWeight, weights.affinityWeight);
  const storageKey = user ? `${CURRENT_ALGORITHM_KEY}_${user.uid}` : CURRENT_ALGORITHM_KEY;
  localStorage.setItem(storageKey, JSON.stringify(activeWeights));
  localStorage.setItem(CURRENT_ALGORITHM_KEY, JSON.stringify(activeWeights));

  if (user) {
    const { isLive, db, firebaseModules } = await initFirebase();
    if (isLive && db && firebaseModules) {
      try {
        const { doc, setDoc } = firebaseModules.firestoreModule;
        await setDoc(doc(db, "algorithmSettings", `active_${user.uid}`), {
          id: `active_${user.uid}`,
          userId: user.uid,
          presetName: "Active Feed Weights",
          weights: activeWeights,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.warn("Could not save active weights to Firestore:", err);
      }
    }
  }
}

/**
 * Initialize Feed Page
 */
export async function initFeedPage() {
  if (!requireAuth()) return;
  await initAuth();
  updateNavbarNotificationBadge();

  const user = getCurrentUser();
  if (user) {
    const { isLive, db, firebaseModules } = await initFirebase();
    if (isLive && db && firebaseModules) {
      try {
        const { doc, getDoc } = firebaseModules.firestoreModule;
        const snap = await getDoc(doc(db, "algorithmSettings", `active_${user.uid}`));
        if (snap.exists() && snap.data().weights) {
          activeWeights = snap.data().weights;
          localStorage.setItem(`${CURRENT_ALGORITHM_KEY}_${user.uid}`, JSON.stringify(activeWeights));
        }
      } catch (e) {}
    }
  }
  activeWeights = getActiveWeights();

  setupPostCreationForm();
  setupFilterAndSearch();
  setupSourceTabs();
  setupQuickPresetBar();
  setupPostModalHandlers();
  updateInstagramWidget();

  await loadAndRenderFeed();
}

/**
 * Update Instagram sidebar widget status
 */
async function updateInstagramWidget() {
  const user = getCurrentUser();
  if (!user) return;

  const conn = await getInstagramConnection(user.uid);
  const textEl = document.getElementById("widget-ig-status-text");
  const btnEl = document.getElementById("widget-ig-btn");

  if (conn && conn.connectionStatus === "connected") {
    if (textEl) textEl.innerHTML = `Connected to <strong>@${conn.instagramUsername}</strong> (${conn.importedMediaCount || 0} posts imported).`;
    if (btnEl) {
      btnEl.textContent = "View Instagram Hub";
      btnEl.className = "btn btn-outline btn-xs";
    }
  }
}

/**
 * Setup source tabs (All, Instagram, Community)
 */
function setupSourceTabs() {
  const tabButtons = document.querySelectorAll(".source-tab-btn");
  tabButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeSource = btn.getAttribute("data-source");

      // Hide or show community create post box based on source
      const createBox = document.getElementById("community-create-post-card");
      if (createBox) {
        createBox.style.display = (activeSource === "instagram") ? "none" : "";
      }

      await loadAndRenderFeed();
    });
  });
}

/**
 * Setup quick algorithm preset switcher on feed top bar
 */
function setupQuickPresetBar() {
  const container = document.getElementById("quick-preset-container");
  if (!container) return;

  const presets = Object.values(ALGORITHM_PRESETS);
  container.innerHTML = `
    <div class="preset-selector-bar">
      <span class="preset-label">Active Ranking Model:</span>
      <div class="preset-pill-group">
        ${presets.map(p => `
          <button class="preset-pill ${isMatchingPreset(activeWeights, p) ? 'active' : ''}" data-id="${p.id}">
            ${p.name.split(" ")[0]}
          </button>
        `).join("")}
        <a href="algorithm-studio.html" class="preset-pill-tune">⚡ Fine-tune in Studio</a>
      </div>
      <div class="active-weight-breakdown">
        <span class="weight-tag r-tag">Recency: ${activeWeights.recencyWeight}%</span>
        <span class="weight-tag e-tag">Engagement: ${activeWeights.engagementWeight}%</span>
        <span class="weight-tag a-tag">Affinity: ${activeWeights.affinityWeight}%</span>
      </div>
    </div>
  `;

  container.querySelectorAll(".preset-pill").forEach(btn => {
    btn.addEventListener("click", async () => {
      const presetId = btn.getAttribute("data-id");
      const preset = ALGORITHM_PRESETS[presetId];
      if (preset) {
        setActiveWeights(preset);
        showToast(`Switched feed to ${preset.name}!`, "info");
        setupQuickPresetBar();
        await loadAndRenderFeed();
      }
    });
  });
}

function isMatchingPreset(current, preset) {
  return current.recencyWeight === preset.recencyWeight &&
         current.engagementWeight === preset.engagementWeight &&
         current.affinityWeight === preset.affinityWeight;
}

/**
 * Load, score, and render ranked posts (Instagram + Community)
 */
export async function loadAndRenderFeed() {
  const feedList = document.getElementById("feed-posts-list");
  if (!feedList) return;

  feedList.innerHTML = `
    <div class="loading-spinner-container">
      <div class="spinner"></div>
      <p>Calculating multi-signal recommendation scores...</p>
    </div>
  `;

  try {
    const currentUser = getCurrentUser();
    const currentUserId = currentUser ? currentUser.uid : null;

    // 1. Fetch community posts
    const communityPosts = await getAllPosts();

    // 2. Fetch real imported Instagram media for this user
    let instagramMedia = [];
    if (currentUserId) {
      const rawIg = await getImportedInstagramMedia(currentUserId);
      const conn = await getInstagramConnection(currentUserId);
      
      instagramMedia = rawIg.map(item => ({
        ...item,
        postId: item.id || `ig_${item.mediaId}`,
        isInstagram: true,
        authorId: item.ownerUserId,
        content: item.caption || "",
        createdAt: item.timestamp,
        author: {
          uid: item.ownerUserId,
          name: conn ? `@${conn.instagramUsername}` : "Instagram Creator",
          username: conn ? conn.instagramUsername : "instagram",
          profileImage: conn && conn.profilePictureUrl ? conn.profilePictureUrl : "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=150&auto=format&fit=crop&q=80"
        }
      }));
    }

    const socialContext = await getSocialContext(currentUserId);

    // Filter by source
    let sourcePool = [];
    if (activeSource === "instagram") {
      sourcePool = instagramMedia;
    } else if (activeSource === "community") {
      sourcePool = communityPosts;
    } else {
      sourcePool = [...instagramMedia, ...communityPosts];
    }

    // Apply client filters
    let displayPool = sourcePool.filter(p => !hiddenPostIds.has(p.postId || p.mediaId));

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      displayPool = displayPool.filter(p => 
        (p.content && p.content.toLowerCase().includes(q)) ||
        (p.author && p.author.name && p.author.name.toLowerCase().includes(q)) ||
        (p.author && p.author.username && p.author.username.toLowerCase().includes(q))
      );
    }

    if (activeFilter === "following" && currentUserId) {
      displayPool = displayPool.filter(p => socialContext.followingIds.includes(p.authorId) || p.authorId === currentUserId);
    } else if (activeFilter === "mine" && currentUserId) {
      displayPool = displayPool.filter(p => p.authorId === currentUserId);
    } else if (activeFilter === "media") {
      displayPool = displayPool.filter(p => Boolean((p.imageUrl && p.imageUrl.trim().length > 0) || p.mediaUrl));
    }

    if (displayPool.length === 0) {
      if (activeSource === "instagram" && instagramMedia.length === 0) {
        feedList.innerHTML = `
          <div class="empty-state-card">
            <div class="empty-icon">📸</div>
            <h3>No Instagram Posts Imported</h3>
            <p>Connect your Instagram Professional account in the Instagram API hub to import your authentic posts and rank them.</p>
            <a href="instagram.html" class="btn btn-primary" style="margin-top: 1rem;">Go to Instagram Hub</a>
          </div>
        `;
      } else {
        feedList.innerHTML = `
          <div class="empty-state-card">
            <div class="empty-icon">🔍</div>
            <h3>No posts found</h3>
            <p>Try clearing your search query or switching filters to see more content.</p>
          </div>
        `;
      }
      return;
    }

    // RUN RECOMMENDATION ALGORITHM
    const rankedPosts = rankPosts(displayPool, activeWeights, currentUserId, socialContext);

    // Render cards
    feedList.innerHTML = "";
    for (const post of rankedPosts) {
      const card = post.isInstagram 
        ? await createInstagramPostCardElement(post, currentUserId)
        : await createCommunityPostCardElement(post, currentUserId);
      feedList.appendChild(card);
    }

  } catch (err) {
    console.error("Error rendering feed:", err);
    feedList.innerHTML = `<div class="error-state-card"><p>Failed to load feed posts: ${escapeHtml(err.message)}</p></div>`;
  }
}

/**
 * Render Real Imported Instagram Media Card
 * Strictly displays authentic Meta metrics without simulated actions.
 */
async function createInstagramPostCardElement(post, currentUserId) {
  const card = document.createElement("article");
  card.className = "post-card ig-post-card";
  card.id = `post-${post.postId || post.mediaId}`;

  const { score, recencyScore, engagementScore, affinityScore, recencyContrib, engagementContrib, affinityContrib, weights } = post.ranking;
  const contentWithTags = escapeHtml(post.caption || "").replace(/#(\w+)/g, '<span class="hashtag">#$1</span>');

  card.innerHTML = `
    <header class="post-header">
      <div class="post-author-block">
        <img src="${post.author.profileImage}" alt="${escapeHtml(post.author.name)}" class="avatar">
        <div class="post-author-meta">
          <div class="author-name-row">
            <span class="author-name">${escapeHtml(post.author.name)}</span>
            <span class="source-badge source-instagram">📸 Meta Instagram API</span>
          </div>
          <span class="post-time">${formatRelativeTime(post.timestamp)}</span>
        </div>
      </div>

      <div class="post-rank-badge" title="Ranked #${post.ranking.position} with total score of ${score}/100">
        <span class="rank-pos">#${post.ranking.position}</span>
        <span class="rank-score">${score} pts</span>
      </div>
    </header>

    <div class="post-body">
      <div class="post-text">${contentWithTags || '<em style="color:var(--text-light);">(No caption on Instagram)</em>'}</div>
      ${post.mediaUrl ? `
        <div class="post-media-container">
          <img src="${post.mediaUrl}" alt="Instagram Media" class="post-media" loading="lazy">
        </div>
      ` : ''}
    </div>

    <!-- Ranking Explanation Section -->
    <div class="ranking-explain-box">
      <div class="explain-header">
        <div class="explain-title">
          <span class="explain-icon">📊</span>
          <strong>Recommendation Breakdown</strong>
        </div>
        <button class="btn-toggle-explain" data-post-id="${post.postId}">Inspect Signals ▼</button>
      </div>
      <p class="explain-summary">${escapeHtml(post.ranking.explanation)}</p>
      
      <div class="signal-breakdown-details" id="signals-${post.postId}" style="display: none;">
        <div class="signal-row">
          <div class="signal-info">
            <span class="signal-name">⏳ Real Recency (${weights.recencyWeight}% weight)</span>
            <span class="signal-calc">${recencyContrib} / ${weights.recencyWeight} pts (Raw: ${recencyScore}/100)</span>
          </div>
          <div class="signal-bar-track">
            <div class="signal-bar-fill bar-recency" style="width: ${(recencyContrib / Math.max(1, weights.recencyWeight)) * 100}%"></div>
          </div>
        </div>

        <div class="signal-row">
          <div class="signal-info">
            <span class="signal-name">🔥 Real Instagram Engagement (${weights.engagementWeight}% weight)</span>
            <span class="signal-calc">${engagementContrib} / ${weights.engagementWeight} pts (Raw: ${engagementScore}/100)</span>
          </div>
          <div class="signal-bar-track">
            <div class="signal-bar-fill bar-engagement" style="width: ${(engagementContrib / Math.max(1, weights.engagementWeight)) * 100}%"></div>
          </div>
        </div>

        <div class="signal-row">
          <div class="signal-info">
            <span class="signal-name">🤝 Studio Affinity (${weights.affinityWeight}% weight)</span>
            <span class="signal-calc">${affinityContrib} / ${weights.affinityWeight} pts (Raw: ${affinityScore}/100)</span>
          </div>
          <div class="signal-bar-track">
            <div class="signal-bar-fill bar-affinity" style="width: ${(affinityContrib / Math.max(1, weights.affinityWeight)) * 100}%"></div>
          </div>
        </div>

        <div class="formula-recap">
          <code>Score = (${recencyScore} × ${weights.recencyWeight}%) + (${engagementScore} × ${weights.engagementWeight}%) + (${affinityScore} × ${weights.affinityWeight}%) = ${score}</code>
        </div>
      </div>
    </div>

    <!-- Official Instagram Metrics & Direct Link -->
    <footer class="post-footer">
      <div class="post-action-buttons">
        <span style="font-size: 0.85rem; font-weight: 700; color: #e11d48; display: inline-flex; align-items: center; gap: 0.35rem;">
          ❤️ ${formatCount(post.likeCount)} Instagram likes
        </span>
        <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); display: inline-flex; align-items: center; gap: 0.35rem;">
          💬 ${formatCount(post.commentsCount)} comments
        </span>
      </div>

      <a href="${post.permalink}" target="_blank" rel="noopener" class="btn btn-sm btn-outline" style="color: #e1306c; font-weight: 700;">
        Open on Instagram ↗
      </a>
    </footer>
  `;

  // Attach explanation toggle
  const toggleBtn = card.querySelector(".btn-toggle-explain");
  const explainDetails = card.querySelector(".signal-breakdown-details");
  if (toggleBtn && explainDetails) {
    toggleBtn.addEventListener("click", () => {
      const isHidden = explainDetails.style.display === "none";
      explainDetails.style.display = isHidden ? "block" : "none";
      toggleBtn.textContent = isHidden ? "Hide Signals ▲" : "Inspect Signals ▼";
    });
  }

  return card;
}

/**
 * Render Community Post Card
 */
async function createCommunityPostCardElement(post, currentUserId) {
  const card = document.createElement("article");
  card.className = "post-card community-post-card";
  card.id = `post-${post.postId}`;

  const isLiked = await hasUserLiked(post.postId);
  const isSaved = await isPostSaved(post.postId);
  const isFollowing = currentUserId ? await isFollowingUser(post.authorId) : false;
  const isAuthor = currentUserId && post.authorId === currentUserId;

  const { score, recencyScore, engagementScore, affinityScore, recencyContrib, engagementContrib, affinityContrib, weights } = post.ranking;
  const contentWithTags = escapeHtml(post.content).replace(/#(\w+)/g, '<span class="hashtag">#$1</span>');

  card.innerHTML = `
    <header class="post-header">
      <div class="post-author-block">
        <a href="profile.html?uid=${post.authorId}">
          <img src="${post.author.profileImage}" alt="${escapeHtml(post.author.name)}" class="avatar">
        </a>
        <div class="post-author-meta">
          <div class="author-name-row">
            <a href="profile.html?uid=${post.authorId}" class="author-name">${escapeHtml(post.author.name)}</a>
            <span class="source-badge source-community">💬 Community</span>
            ${!isAuthor && currentUserId ? `
              <button class="btn-follow-toggle ${isFollowing ? 'following' : ''}" data-author-id="${post.authorId}" data-author-name="${escapeHtml(post.author.name)}">
                ${isFollowing ? 'Following' : '+ Follow'}
              </button>
            ` : ''}
          </div>
          <span class="post-time">${formatRelativeTime(post.createdAt)}</span>
        </div>
      </div>

      <div class="post-rank-badge" title="Ranked #${post.ranking.position} with total score of ${score}/100">
        <span class="rank-pos">#${post.ranking.position}</span>
        <span class="rank-score">${score} pts</span>
      </div>
    </header>

    <div class="post-body">
      <div class="post-text">${contentWithTags}</div>
      ${post.imageUrl ? `
        <div class="post-media-container">
          <img src="${post.imageUrl}" alt="Post image" class="post-media" loading="lazy">
        </div>
      ` : ''}
    </div>

    <!-- Ranking Explanation Section -->
    <div class="ranking-explain-box">
      <div class="explain-header">
        <div class="explain-title">
          <span class="explain-icon">📊</span>
          <strong>Recommendation Breakdown</strong>
        </div>
        <button class="btn-toggle-explain" data-post-id="${post.postId}">Inspect Signals ▼</button>
      </div>
      <p class="explain-summary">${escapeHtml(post.ranking.explanation)}</p>
      
      <div class="signal-breakdown-details" id="signals-${post.postId}" style="display: none;">
        <div class="signal-row">
          <div class="signal-info">
            <span class="signal-name">⏳ Recency (${weights.recencyWeight}% weight)</span>
            <span class="signal-calc">${recencyContrib} / ${weights.recencyWeight} pts (Raw: ${recencyScore}/100)</span>
          </div>
          <div class="signal-bar-track">
            <div class="signal-bar-fill bar-recency" style="width: ${(recencyContrib / Math.max(1, weights.recencyWeight)) * 100}%"></div>
          </div>
        </div>

        <div class="signal-row">
          <div class="signal-info">
            <span class="signal-name">🔥 Community Engagement (${weights.engagementWeight}% weight)</span>
            <span class="signal-calc">${engagementContrib} / ${weights.engagementWeight} pts (Raw: ${engagementScore}/100)</span>
          </div>
          <div class="signal-bar-track">
            <div class="signal-bar-fill bar-engagement" style="width: ${(engagementContrib / Math.max(1, weights.engagementWeight)) * 100}%"></div>
          </div>
        </div>

        <div class="signal-row">
          <div class="signal-info">
            <span class="signal-name">🤝 In-App Affinity (${weights.affinityWeight}% weight)</span>
            <span class="signal-calc">${affinityContrib} / ${weights.affinityWeight} pts (Raw: ${affinityScore}/100)</span>
          </div>
          <div class="signal-bar-track">
            <div class="signal-bar-fill bar-affinity" style="width: ${(affinityContrib / Math.max(1, weights.affinityWeight)) * 100}%"></div>
          </div>
        </div>

        <div class="formula-recap">
          <code>Score = (${recencyScore} × ${weights.recencyWeight}%) + (${engagementScore} × ${weights.engagementWeight}%) + (${affinityScore} × ${weights.affinityWeight}%) = ${score}</code>
        </div>
      </div>
    </div>

    <!-- Community Action Buttons -->
    <footer class="post-footer">
      <div class="post-action-buttons">
        <button class="btn-action btn-like ${isLiked ? 'active' : ''}" data-post-id="${post.postId}" data-author-id="${post.authorId}">
          <span class="action-icon">${isLiked ? '❤️' : '🤍'}</span>
          <span class="action-count">${formatCount(post.likesCount)}</span>
        </button>

        <button class="btn-action btn-comment" data-post-id="${post.postId}">
          <span class="action-icon">💬</span>
          <span class="action-count">${formatCount(post.commentsCount)}</span>
        </button>

        <button class="btn-action btn-share" data-post-id="${post.postId}" data-author-id="${post.authorId}">
          <span class="action-icon">🔄</span>
          <span class="action-count">${formatCount(post.sharesCount)}</span>
        </button>

        <button class="btn-action btn-save ${isSaved ? 'active' : ''}" data-post-id="${post.postId}">
          <span class="action-icon">${isSaved ? '🔖' : '📑'}</span>
        </button>
      </div>

      <div class="post-options-dropdown">
        <button class="btn-icon btn-post-menu" data-post-id="${post.postId}">⋯</button>
        <div class="dropdown-menu" id="menu-${post.postId}">
          ${isAuthor ? `
            <button class="menu-item btn-edit-post" data-post-id="${post.postId}">✏️ Edit Post</button>
            <button class="menu-item menu-danger btn-delete-post" data-post-id="${post.postId}">🗑️ Delete Post</button>
          ` : `
            <button class="menu-item btn-hide-post" data-post-id="${post.postId}">👁️ Hide Post</button>
            <button class="menu-item menu-danger btn-report-post" data-post-id="${post.postId}">🚩 Report Post</button>
          `}
        </div>
      </div>
    </footer>

    <!-- Comments Section Container -->
    <div class="comments-container" id="comments-${post.postId}" style="display: none;">
      <div class="comments-list" id="comments-list-${post.postId}">
        <p class="loading-subtext">Loading comments...</p>
      </div>
      ${currentUserId ? `
        <form class="comment-input-form" data-post-id="${post.postId}" data-author-id="${post.authorId}">
          <input type="text" class="comment-input" placeholder="Write a comment..." required>
          <button type="submit" class="btn btn-sm btn-primary">Reply</button>
        </form>
      ` : `
        <p class="login-prompt-comment"><a href="login.html">Sign in</a> to leave a comment.</p>
      `}
    </div>
  `;

  attachCommunityPostListeners(card, post, currentUserId);
  return card;
}

/**
 * Attach listeners to community post card
 */
function attachCommunityPostListeners(card, post, currentUserId) {
  const toggleExplainBtn = card.querySelector(".btn-toggle-explain");
  const explainDetails = card.querySelector(".signal-breakdown-details");
  if (toggleExplainBtn && explainDetails) {
    toggleExplainBtn.addEventListener("click", () => {
      const isHidden = explainDetails.style.display === "none";
      explainDetails.style.display = isHidden ? "block" : "none";
      toggleExplainBtn.textContent = isHidden ? "Hide Signals ▲" : "Inspect Signals ▼";
    });
  }

  const likeBtn = card.querySelector(".btn-like");
  if (likeBtn) {
    likeBtn.addEventListener("click", async () => {
      try {
        const isNowLiked = await toggleLikePost(post.postId, post.authorId);
        likeBtn.classList.toggle("active", isNowLiked);
        likeBtn.querySelector(".action-icon").textContent = isNowLiked ? '❤️' : '🤍';
        const countSpan = likeBtn.querySelector(".action-count");
        let count = parseInt(countSpan.textContent) || 0;
        countSpan.textContent = formatCount(isNowLiked ? count + 1 : Math.max(0, count - 1));
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  const saveBtn = card.querySelector(".btn-save");
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      try {
        const isNowSaved = await toggleSavePost(post.postId);
        saveBtn.classList.toggle("active", isNowSaved);
        saveBtn.querySelector(".action-icon").textContent = isNowSaved ? '🔖' : '📑';
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  const shareBtn = card.querySelector(".btn-share");
  if (shareBtn) {
    shareBtn.addEventListener("click", async () => {
      await sharePost(post.postId, post.authorId, post.content);
      const countSpan = shareBtn.querySelector(".action-count");
      let count = parseInt(countSpan.textContent) || 0;
      countSpan.textContent = formatCount(count + 1);
    });
  }

  const followBtn = card.querySelector(".btn-follow-toggle");
  if (followBtn) {
    followBtn.addEventListener("click", async () => {
      try {
        const isNowFollowing = await toggleFollowUser(post.authorId, post.author.name);
        followBtn.classList.toggle("following", isNowFollowing);
        followBtn.textContent = isNowFollowing ? 'Following' : '+ Follow';
        setTimeout(async () => await loadAndRenderFeed(), 800);
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  const commentBtn = card.querySelector(".btn-comment");
  const commentsContainer = card.querySelector(".comments-container");
  if (commentBtn && commentsContainer) {
    commentBtn.addEventListener("click", async () => {
      const isHidden = commentsContainer.style.display === "none";
      commentsContainer.style.display = isHidden ? "block" : "none";
      if (isHidden) {
        await loadPostComments(post.postId);
      }
    });
  }

  const commentForm = card.querySelector(".comment-input-form");
  if (commentForm) {
    commentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = commentForm.querySelector(".comment-input");
      const text = input.value.trim();
      if (!text) return;

      try {
        await addComment(post.postId, post.authorId, text);
        input.value = "";
        const commentCountSpan = commentBtn.querySelector(".action-count");
        let count = parseInt(commentCountSpan.textContent) || 0;
        commentCountSpan.textContent = formatCount(count + 1);
        await loadPostComments(post.postId);
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }

  const menuBtn = card.querySelector(".btn-post-menu");
  const menuDropdown = card.querySelector(".dropdown-menu");
  if (menuBtn && menuDropdown) {
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      menuDropdown.classList.toggle("active");
    });
    document.addEventListener("click", () => menuDropdown.classList.remove("active"));
  }

  const editBtn = card.querySelector(".btn-edit-post");
  if (editBtn) {
    editBtn.addEventListener("click", () => openEditPostModal(post));
  }

  const deleteBtn = card.querySelector(".btn-delete-post");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      if (confirm("Are you sure you want to delete this community post?")) {
        try {
          await deletePost(post.postId);
          card.classList.add("fade-out");
          setTimeout(() => card.remove(), 300);
        } catch (err) {
          showToast(err.message, "error");
        }
      }
    });
  }

  const hideBtn = card.querySelector(".btn-hide-post");
  if (hideBtn) {
    hideBtn.addEventListener("click", () => {
      hiddenPostIds.add(post.postId);
      card.classList.add("fade-out");
      setTimeout(() => card.remove(), 300);
      showToast("Post hidden from your feed.", "info");
    });
  }

  const reportBtn = card.querySelector(".btn-report-post");
  if (reportBtn) {
    reportBtn.addEventListener("click", () => {
      const reason = prompt("Please provide a reason for reporting this post:");
      if (reason) {
        recordInteraction({
          userId: currentUserId,
          authorId: post.authorId,
          postId: post.postId,
          interactionType: "report"
        });
        showToast("Report logged. Thank you for your feedback.", "info");
      }
    });
  }
}

async function loadPostComments(postId) {
  const container = document.getElementById(`comments-list-${postId}`);
  if (!container) return;

  const comments = await getCommentsForPost(postId);
  const currentUser = getCurrentUser();

  if (comments.length === 0) {
    container.innerHTML = `<p class="no-comments-msg">No comments yet. Start the conversation!</p>`;
    return;
  }

  container.innerHTML = comments.map(comm => `
    <div class="comment-item" id="comm-${comm.commentId}">
      <img src="${comm.author.profileImage}" alt="${escapeHtml(comm.author.name)}" class="avatar-xs">
      <div class="comment-bubble">
        <div class="comment-author-meta">
          <strong>${escapeHtml(comm.author.name)}</strong>
          <span>${formatRelativeTime(comm.createdAt)}</span>
        </div>
        <p class="comment-text">${escapeHtml(comm.commentText)}</p>
      </div>
      ${currentUser && currentUser.uid === comm.authorId ? `
        <button class="btn-icon btn-delete-comment" data-comment-id="${comm.commentId}" data-post-id="${postId}" title="Delete comment">✕</button>
      ` : ''}
    </div>
  `).join("");

  container.querySelectorAll(".btn-delete-comment").forEach(btn => {
    btn.addEventListener("click", async () => {
      const commId = btn.getAttribute("data-comment-id");
      await deleteComment(commId, postId);
      const row = document.getElementById(`comm-${commId}`);
      if (row) row.remove();
    });
  });
}

function setupPostCreationForm() {
  const form = document.getElementById("create-post-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const contentInput = document.getElementById("post-content-input");
    const imageInput = document.getElementById("post-image-input");
    const submitBtn = form.querySelector("button[type='submit']");

    const content = contentInput.value.trim();
    const imageUrl = imageInput ? imageInput.value.trim() : "";

    if (!content) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner-sm"></span> Publishing...`;

    try {
      await createPost({ content, imageUrl });
      contentInput.value = "";
      if (imageInput) imageInput.value = "";
      await loadAndRenderFeed();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Publish Post";
    }
  });
}

function setupFilterAndSearch() {
  const filterButtons = document.querySelectorAll(".feed-filter-btn");
  filterButtons.forEach(btn => {
    btn.addEventListener("click", async () => {
      filterButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeFilter = btn.getAttribute("data-filter");
      await loadAndRenderFeed();
    });
  });

  const searchInput = document.getElementById("feed-search-input");
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        searchQuery = e.target.value;
        await loadAndRenderFeed();
      }, 300);
    });
  }
}

let postToEdit = null;
function openEditPostModal(post) {
  postToEdit = post;
  const modal = document.getElementById("edit-post-modal");
  const contentInput = document.getElementById("edit-post-content");
  const imageInput = document.getElementById("edit-post-image");

  if (modal && contentInput) {
    contentInput.value = post.content;
    if (imageInput) imageInput.value = post.imageUrl || "";
    openModal("edit-post-modal");
  }
}

function setupPostModalHandlers() {
  const editForm = document.getElementById("edit-post-form");
  if (editForm) {
    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!postToEdit) return;

      const content = document.getElementById("edit-post-content").value.trim();
      const imageUrl = document.getElementById("edit-post-image")?.value.trim() || "";

      try {
        await updatePost(postToEdit.postId, { content, imageUrl });
        closeModal("edit-post-modal");
        await loadAndRenderFeed();
      } catch (err) {
        showToast(err.message, "error");
      }
    });
  }
}
