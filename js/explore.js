/**
 * Recommendation-Ranked Social Feed Studio
 * Explore & Social Discovery Controller
 */

import { initAuth, getCurrentUser, requireAuth } from "./auth.js";
import { getAllPosts } from "./posts.js";
import { isFollowingUser, toggleFollowUser, getSocialContext } from "./interactions.js";
import { calculateEngagementScore } from "./algorithm.js";
import { 
  getLocalCollection, 
  sampleUsers, 
  formatRelativeTime, 
  formatCount, 
  escapeHtml, 
  showToast 
} from "./utils.js";
import { updateNavbarNotificationBadge } from "./notifications.js";

let allCreators = [];

/**
 * Initialize Explore Page
 */
export async function initExplorePage() {
  if (!requireAuth()) return;
  await initAuth();
  updateNavbarNotificationBadge();

  const user = getCurrentUser();
  const currentUserId = user ? user.uid : null;

  // Load creators
  const localUsers = getLocalCollection("users");
  allCreators = localUsers.length > 0 ? localUsers : sampleUsers;

  const allPosts = await getAllPosts();

  renderCreatorsGrid(currentUserId, allCreators);
  renderTrendingFeed(allPosts);
  setupCreatorSearch(currentUserId);
}

/**
 * Render Creator Discovery Cards
 */
async function renderCreatorsGrid(currentUserId, creatorsList) {
  const container = document.getElementById("creators-discovery-grid");
  if (!container) return;

  const follows = getLocalCollection("follows");
  const posts = getLocalCollection("posts");

  container.innerHTML = "";

  for (const creator of creatorsList) {
    if (creator.uid === currentUserId) continue; // Don't show self in discovery

    const isFollowing = currentUserId ? await isFollowingUser(creator.uid) : false;
    const creatorFollowers = follows.filter(f => f.followingId === creator.uid).length;
    const creatorPostsCount = posts.filter(p => p.authorId === creator.uid).length;

    const card = document.createElement("div");
    card.className = "creator-card";
    card.innerHTML = `
      <div class="creator-card-header">
        <a href="profile.html?uid=${creator.uid}">
          <img src="${creator.profileImage}" alt="${escapeHtml(creator.name)}" class="avatar-lg">
        </a>
        <button class="btn-follow-toggle ${isFollowing ? 'following' : ''}" data-uid="${creator.uid}" data-name="${escapeHtml(creator.name)}">
          ${isFollowing ? 'Following' : '+ Follow'}
        </button>
      </div>
      <div class="creator-card-body">
        <a href="profile.html?uid=${creator.uid}" class="creator-name-link">
          <strong>${escapeHtml(creator.name)}</strong>
        </a>
        <span class="creator-handle">@${escapeHtml(creator.username)}</span>
        <p class="creator-bio">${escapeHtml(creator.bio || 'Community creator.')}</p>
      </div>
      <div class="creator-card-footer">
        <div class="creator-stat">
          <span class="stat-num">${creatorFollowers}</span>
          <span class="stat-lbl">Followers</span>
        </div>
        <div class="creator-stat">
          <span class="stat-num">${creatorPostsCount}</span>
          <span class="stat-lbl">Posts</span>
        </div>
      </div>
    `;

    // Follow toggle listener
    const followBtn = card.querySelector(".btn-follow-toggle");
    followBtn.addEventListener("click", async () => {
      try {
        const isNowFollowing = await toggleFollowUser(creator.uid, creator.name);
        followBtn.classList.toggle("following", isNowFollowing);
        followBtn.textContent = isNowFollowing ? 'Following' : '+ Follow';
      } catch (e) {
        showToast(e.message, "error");
      }
    });

    container.appendChild(card);
  }
}

/**
 * Render Trending Posts Section
 */
function renderTrendingFeed(posts) {
  const container = document.getElementById("explore-trending-list");
  if (!container) return;

  const sorted = [...posts].sort((a, b) => calculateEngagementScore(b) - calculateEngagementScore(a));

  container.innerHTML = sorted.slice(0, 6).map((post, idx) => `
    <div class="explore-post-card">
      <div class="explore-rank-tag">🔥 Trending #${idx + 1}</div>
      <div class="explore-author-row">
        <img src="${post.author.profileImage}" alt="${escapeHtml(post.author.name)}" class="avatar-sm">
        <div>
          <strong>${escapeHtml(post.author.name)}</strong>
          <span>• ${formatRelativeTime(post.createdAt)}</span>
        </div>
      </div>
      <p class="explore-content-preview">${escapeHtml(post.content.substring(0, 120))}...</p>
      ${post.imageUrl ? `<img src="${post.imageUrl}" class="explore-thumbnail" alt="Post thumbnail">` : ''}
      <div class="explore-actions-row">
        <span>❤️ ${post.likesCount || 0}</span>
        <span>💬 ${post.commentsCount || 0}</span>
        <span>🔄 ${post.sharesCount || 0}</span>
        <a href="feed.html#post-${post.postId}" class="btn btn-xs btn-outline">View in Feed</a>
      </div>
    </div>
  `).join("");
}

/**
 * Creator Search live filtering
 */
function setupCreatorSearch(currentUserId) {
  const input = document.getElementById("creator-search-input");
  if (!input) return;

  input.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase().trim();
    const filtered = allCreators.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.username.toLowerCase().includes(q) ||
      (c.bio && c.bio.toLowerCase().includes(q))
    );
    renderCreatorsGrid(currentUserId, filtered);
  });
}
