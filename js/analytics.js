/**
 * Recommendation-Ranked Social Feed Studio
 * Analytics Dashboard with Native Canvas & SVG Chart Visualizations
 * 
 * Strictly uses native Canvas 2D API and SVG primitives without external libraries.
 * Computes from actual imported Instagram media and platform community posts.
 */

import { initAuth, getCurrentUser, requireAuth } from "./auth.js";
import { getAllPosts } from "./posts.js";
import { getImportedInstagramMedia } from "./instagram.js";
import { rankPosts, ALGORITHM_PRESETS } from "./algorithm.js";
import { getActiveWeights } from "./feed.js";
import { getSocialContext } from "./interactions.js";
import { escapeHtml, formatCount } from "./utils.js";
import { updateNavbarNotificationBadge } from "./notifications.js";

/**
 * Initialize Analytics Page
 */
export async function initAnalyticsPage() {
  if (!requireAuth()) return;
  await initAuth();
  updateNavbarNotificationBadge();

  const user = getCurrentUser();
  const currentUserId = user ? user.uid : null;
  const weights = getActiveWeights();

  // 1. Fetch real community posts and real imported Instagram media
  const communityPosts = await getAllPosts();
  const instagramMedia = currentUserId ? await getImportedInstagramMedia(currentUserId) : [];

  // Render Instagram-specific analytics
  renderInstagramKPIs(instagramMedia);
  drawMediaTypeDistributionSVG(instagramMedia);

  // Combine for overall recommendation ranking analytics
  const combinedPosts = [
    ...instagramMedia.map(item => ({
      ...item,
      postId: item.id || `ig_${item.mediaId}`,
      isInstagram: true,
      authorId: item.ownerUserId,
      content: item.caption || "",
      createdAt: item.timestamp,
      author: { name: "Instagram Account" }
    })),
    ...communityPosts
  ];

  const socialContext = await getSocialContext(currentUserId);
  const rankedPosts = rankPosts(combinedPosts, weights, currentUserId, socialContext);

  renderAnalyticsMetricCards(rankedPosts);
  drawTopPostsCanvasChart(rankedPosts.slice(0, 7));
  drawSignalContributionDoughnutSVG(weights, rankedPosts);
  drawScoreDistributionCanvasChart(rankedPosts);
}

/**
 * Render Real Instagram KPIs
 */
function renderInstagramKPIs(instagramMedia) {
  const elPosts = document.getElementById("kpi-ig-total-posts");
  const elLikes = document.getElementById("kpi-ig-total-likes");
  const elComments = document.getElementById("kpi-ig-total-comments");
  const elAvg = document.getElementById("kpi-ig-avg-engagement");

  if (!instagramMedia || instagramMedia.length === 0) {
    if (elPosts) elPosts.textContent = "0";
    if (elLikes) elLikes.textContent = "0";
    if (elComments) elComments.textContent = "0";
    if (elAvg) elAvg.textContent = "0.0";
    return;
  }

  const totalPosts = instagramMedia.length;
  const totalLikes = instagramMedia.reduce((acc, m) => acc + (m.likeCount || 0), 0);
  const totalComments = instagramMedia.reduce((acc, m) => acc + (m.commentsCount || 0), 0);
  const avgEngagement = totalPosts > 0 ? ((totalLikes + totalComments) / totalPosts).toFixed(1) : "0.0";

  if (elPosts) elPosts.textContent = totalPosts;
  if (elLikes) elLikes.textContent = formatCount(totalLikes);
  if (elComments) elComments.textContent = formatCount(totalComments);
  if (elAvg) elAvg.textContent = avgEngagement;
}

/**
 * Draw Media Type Distribution (Images, Videos, Carousels) using SVG
 */
function drawMediaTypeDistributionSVG(instagramMedia) {
  const container = document.getElementById("chart-media-type-container");
  if (!container) return;

  if (!instagramMedia || instagramMedia.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); font-size: 0.88rem;">
        No Instagram media connected yet.
        <br><a href="instagram.html" style="font-weight:700; color:var(--primary); margin-top:0.5rem; display:inline-block;">Connect Instagram</a>
      </div>
    `;
    return;
  }

  let images = 0;
  let videos = 0;
  let carousels = 0;

  instagramMedia.forEach(m => {
    const t = (m.mediaType || "").toUpperCase();
    if (t === "VIDEO") videos++;
    else if (t === "CAROUSEL_ALBUM") carousels++;
    else images++;
  });

  const total = images + videos + carousels || 1;
  const pctImages = Math.round((images / total) * 100);
  const pctVideos = Math.round((videos / total) * 100);
  const pctCarousels = 100 - (pctImages + pctVideos);

  const size = 180;
  const radius = 60;
  const strokeWidth = 26;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  const lenImg = (pctImages / 100) * circumference;
  const lenVid = (pctVideos / 100) * circumference;
  const lenCar = (pctCarousels / 100) * circumference;

  container.innerHTML = `
    <div class="doughnut-wrapper">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#3b82f6" stroke-width="${strokeWidth}"
          stroke-dasharray="${lenImg} ${circumference - lenImg}"
          stroke-dashoffset="0"
          transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt" />

        <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#ec4899" stroke-width="${strokeWidth}"
          stroke-dasharray="${lenVid} ${circumference - lenVid}"
          stroke-dashoffset="-${lenImg}"
          transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt" />

        <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#8b5cf6" stroke-width="${strokeWidth}"
          stroke-dasharray="${lenCar} ${circumference - lenCar}"
          stroke-dashoffset="-${lenImg + lenVid}"
          transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt" />

        <text x="${cx}" y="${cy + 5}" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-weight="800" font-size="16" fill="var(--text-main)">${total}</text>
      </svg>

      <div class="doughnut-legend">
        <div class="legend-item">
          <span class="legend-color-box" style="background: #3b82f6;"></span>
          <span>Images: ${images} (${pctImages}%)</span>
        </div>
        <div class="legend-item">
          <span class="legend-color-box" style="background: #ec4899;"></span>
          <span>Videos: ${videos} (${pctVideos}%)</span>
        </div>
        <div class="legend-item">
          <span class="legend-color-box" style="background: #8b5cf6;"></span>
          <span>Carousels: ${carousels} (${pctCarousels}%)</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render Recommendation KPI Cards
 */
function renderAnalyticsMetricCards(rankedPosts) {
  if (!rankedPosts || rankedPosts.length === 0) return;

  const topPost = rankedPosts[0];
  const avgScore = (rankedPosts.reduce((acc, p) => acc + p.ranking.score, 0) / rankedPosts.length).toFixed(1);
  const avgRecency = (rankedPosts.reduce((acc, p) => acc + p.ranking.recencyScore, 0) / rankedPosts.length).toFixed(1);
  const avgEngagement = (rankedPosts.reduce((acc, p) => acc + p.ranking.engagementScore, 0) / rankedPosts.length).toFixed(1);

  const elTopScore = document.getElementById("kpi-top-score");
  const elAvgScore = document.getElementById("kpi-avg-score");
  const elAvgRecency = document.getElementById("kpi-avg-recency");
  const elAvgEngagement = document.getElementById("kpi-avg-engagement");

  if (elTopScore) elTopScore.textContent = `${topPost.ranking.score}/100`;
  if (elAvgScore) elAvgScore.textContent = `${avgScore}/100`;
  if (elAvgRecency) elAvgRecency.textContent = `${avgRecency}/100`;
  if (elAvgEngagement) elAvgEngagement.textContent = `${avgEngagement}/100`;
}

/**
 * Draw Top Ranked Posts Bar Chart using HTML Canvas
 */
function drawTopPostsCanvasChart(topPosts) {
  const canvas = document.getElementById("chart-top-posts");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  if (topPosts.length === 0) {
    ctx.fillStyle = "#64748b";
    ctx.font = "14px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No data available", width / 2, height / 2);
    return;
  }

  const paddingLeft = 140;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 20;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const barGap = 12;
  const barHeight = (chartHeight - (barGap * (topPosts.length - 1))) / topPosts.length;

  topPosts.forEach((post, i) => {
    const y = paddingTop + (i * (barHeight + barGap));
    const score = post.ranking.score;
    const barWidth = (score / 100) * chartWidth;

    const rawName = post.isInstagram ? "📸 Instagram" : (post.author?.name || "Community");
    const authorName = rawName.length > 15 ? rawName.substring(0, 14) + "…" : rawName;

    ctx.fillStyle = "#334155";
    ctx.font = "600 12px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(`#${i + 1} ${authorName}`, paddingLeft - 10, y + (barHeight / 2) + 4);

    ctx.fillStyle = "#f1f5f9";
    ctx.beginPath();
    ctx.roundRect(paddingLeft, y, chartWidth, barHeight, 4);
    ctx.fill();

    const gradient = ctx.createLinearGradient(paddingLeft, y, paddingLeft + barWidth, y);
    if (post.isInstagram) {
      gradient.addColorStop(0, "#e1306c");
      gradient.addColorStop(1, "#f77737");
    } else {
      gradient.addColorStop(0, "#4f46e5");
      gradient.addColorStop(1, "#818cf8");
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(paddingLeft, y, Math.max(8, barWidth), barHeight, 4);
    ctx.fill();

    ctx.fillStyle = "#1e293b";
    ctx.font = "700 11px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${score}`, paddingLeft + barWidth + 8, y + (barHeight / 2) + 4);
  });
}

/**
 * Draw Signal Contribution Doughnut Chart using SVG
 */
function drawSignalContributionDoughnutSVG(weights, rankedPosts) {
  const container = document.getElementById("chart-doughnut-container");
  if (!container) return;

  const totalR = rankedPosts.reduce((acc, p) => acc + p.ranking.recencyContrib, 0);
  const totalE = rankedPosts.reduce((acc, p) => acc + p.ranking.engagementContrib, 0);
  const totalA = rankedPosts.reduce((acc, p) => acc + p.ranking.affinityContrib, 0);
  const total = totalR + totalE + totalA || 1;

  const pctR = Math.round((totalR / total) * 100);
  const pctE = Math.round((totalE / total) * 100);
  const pctA = 100 - (pctR + pctE);

  const size = 180;
  const radius = 60;
  const strokeWidth = 26;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;

  const lengthR = (pctR / 100) * circumference;
  const lengthE = (pctE / 100) * circumference;
  const lengthA = (pctA / 100) * circumference;

  container.innerHTML = `
    <div class="doughnut-wrapper">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#3b82f6" stroke-width="${strokeWidth}"
          stroke-dasharray="${lengthR} ${circumference - lengthR}"
          stroke-dashoffset="0"
          transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt" />

        <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#10b981" stroke-width="${strokeWidth}"
          stroke-dasharray="${lengthE} ${circumference - lengthE}"
          stroke-dashoffset="-${lengthR}"
          transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt" />

        <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#8b5cf6" stroke-width="${strokeWidth}"
          stroke-dasharray="${lengthA} ${circumference - lengthA}"
          stroke-dashoffset="-${lengthR + lengthE}"
          transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt" />

        <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-weight="800" font-size="16" fill="var(--text-main)">100%</text>
        <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-weight="600" font-size="9" fill="var(--text-muted)">Norm</text>
      </svg>

      <div class="doughnut-legend">
        <div class="legend-item">
          <span class="legend-color-box" style="background: #3b82f6;"></span>
          <span>Recency: ${pctR}%</span>
        </div>
        <div class="legend-item">
          <span class="legend-color-box" style="background: #10b981;"></span>
          <span>Engagement: ${pctE}%</span>
        </div>
        <div class="legend-item">
          <span class="legend-color-box" style="background: #8b5cf6;"></span>
          <span>Affinity: ${pctA}%</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Draw Score Distribution Histogram using HTML Canvas
 */
function drawScoreDistributionCanvasChart(rankedPosts) {
  const canvas = document.getElementById("chart-score-dist");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  const buckets = [0, 0, 0, 0, 0];
  const bucketLabels = ["0-20", "21-40", "41-60", "61-80", "81-100"];

  rankedPosts.forEach(p => {
    const s = p.ranking.score;
    if (s <= 20) buckets[0]++;
    else if (s <= 40) buckets[1]++;
    else if (s <= 60) buckets[2]++;
    else if (s <= 80) buckets[3]++;
    else buckets[4]++;
  });

  const maxCount = Math.max(...buckets, 1);
  const padX = 35;
  const padBottom = 35;
  const padTop = 25;
  const plotWidth = width - (padX * 2);
  const plotHeight = height - padBottom - padTop;
  const barWidth = plotWidth / buckets.length - 16;

  buckets.forEach((count, i) => {
    const barHeight = (count / maxCount) * (plotHeight - 20);
    const x = padX + (i * (plotWidth / buckets.length)) + 8;
    const y = height - padBottom - barHeight;

    const gradient = ctx.createLinearGradient(x, y, x, height - padBottom);
    gradient.addColorStop(0, "#06b6d4");
    gradient.addColorStop(1, "#3b82f6");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
    ctx.fill();

    ctx.fillStyle = "#475569";
    ctx.font = "600 11px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${count}`, x + (barWidth / 2), y - 6);

    ctx.fillStyle = "#64748b";
    ctx.font = "500 11px 'Plus Jakarta Sans', sans-serif";
    ctx.fillText(bucketLabels[i], x + (barWidth / 2), height - 10);
  });
}
