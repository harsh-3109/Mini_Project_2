/**
 * Recommendation-Ranked Social Feed Studio
 * Core Recommendation Algorithm Engine
 * 
 * Implements transparent multi-signal recommendation scoring using real metrics:
 * - Recency Score (time-decay exponential curve using actual media timestamps)
 * - Engagement Score (log-normalized multi-metric weighting using real likes and comments)
 * - Affinity Score (social proximity and interaction history within our platform)
 * - Dynamic Weight Normalization (ensures sum = 100%)
 * - Natural Language Dynamic Explainability Generator
 * 
 * IMPORTANT: This is our own educational recommendation algorithm,
 * NOT Instagram's proprietary or secret internal ranking model.
 */

// Default Presets
export const ALGORITHM_PRESETS = {
  balanced: {
    id: "balanced",
    name: "Balanced Discovery (Default)",
    description: "Harmonious blend balancing fresh content, viral discussions, and personal network updates.",
    recencyWeight: 35,
    engagementWeight: 35,
    affinityWeight: 30
  },
  chronological: {
    id: "chronological",
    name: "Chronological Timeline",
    description: "Prioritizes freshness above all else. Mirrors classic reverse-chronological feeds.",
    recencyWeight: 80,
    engagementWeight: 10,
    affinityWeight: 10
  },
  popularity: {
    id: "popularity",
    name: "Viral & Popularity Focused",
    description: "Maximizes trending topics, high like/comment counts, and network-wide discussions.",
    recencyWeight: 15,
    engagementWeight: 75,
    affinityWeight: 10
  },
  personalized: {
    id: "personalized",
    name: "Close Connections (Personalized)",
    description: "Focuses on creators and colleagues you follow and frequently converse with.",
    recencyWeight: 20,
    engagementWeight: 20,
    affinityWeight: 60
  }
};

/**
 * Calculate Recency Score (0 to 100)
 * Uses an exponential time-decay function: S_recency = 100 * exp(-lambda * deltaHours)
 * Half-life is approx 17.3 hours with lambda = 0.04.
 */
export function calculateRecencyScore(postTimestamp) {
  if (!postTimestamp) return 10;
  
  let postDate;
  if (postTimestamp.toDate && typeof postTimestamp.toDate === "function") {
    postDate = postTimestamp.toDate();
  } else if (postTimestamp.seconds) {
    postDate = new Date(postTimestamp.seconds * 1000);
  } else {
    postDate = new Date(postTimestamp);
  }

  if (isNaN(postDate.getTime())) return 10;

  const now = new Date();
  const elapsedHours = Math.max(0, (now.getTime() - postDate.getTime()) / (1000 * 60 * 60));

  // Time decay coefficient: lambda = 0.04
  const lambda = 0.04;
  const score = 100 * Math.exp(-lambda * elapsedHours);

  // Clamp strictly between 0 and 100
  return Math.min(100, Math.max(0, Math.round(score * 10) / 10));
}

/**
 * Calculate Engagement Score (0 to 100)
 * Supports both Instagram media (likeCount, commentsCount) and community posts (likesCount, commentsCount).
 * Raw engagement = (likes * 1.0) + (comments * 2.5) + (shares * 4.0)
 * Uses logarithmic scaling to prevent viral posts from permanently dominating:
 * S_eng = min(100, (ln(1 + raw) / ln(1 + benchmark)) * 100)
 */
export function calculateEngagementScore(post, benchmarkRaw = 600) {
  const likes = Number(post.likeCount !== undefined ? post.likeCount : (post.likesCount || 0));
  const comments = Number(post.commentsCount !== undefined ? post.commentsCount : (post.comments_count || 0));
  const shares = Number(post.sharesCount || 0);

  // Action weights: comments take more effort than likes; shares signify strong advocacy
  const rawScore = (likes * 1.0) + (comments * 2.5) + (shares * 4.0);

  if (rawScore <= 0) return 0;

  // Logarithmic compression
  const logRaw = Math.log(1 + rawScore);
  const logBenchmark = Math.log(1 + benchmarkRaw);

  const normalized = Math.min(100, (logRaw / logBenchmark) * 100);
  return Math.min(100, Math.max(0, Math.round(normalized * 10) / 10));
}

/**
 * Calculate Affinity Score (0 to 100)
 * Analyzes relationship within our platform between current user and post creator:
 * - Own post or own imported Instagram media: 95 pts
 * - Following creator: +45 pts
 * - Mutual follow: +15 pts
 * - Prior interactions within our app: +15 pts per interaction category
 * - Baseline stranger discovery: 10 pts
 * NOTE: This is based on in-app interactions; we do not pretend to access Instagram's private relationship graph.
 */
export function calculateAffinityScore(postAuthorId, currentUserId, socialContext = {}) {
  if (!currentUserId) return 20;
  if (postAuthorId === currentUserId) return 95;

  const {
    followingIds = [],
    mutualFollowIds = [],
    authorInteractionCounts = {}
  } = socialContext;

  let affinity = 10; // Baseline discovery

  // Follow relationship in our platform
  if (followingIds.includes(postAuthorId)) {
    affinity += 45;
  }

  // Mutual follow
  if (mutualFollowIds.includes(postAuthorId)) {
    affinity += 15;
  }

  // Prior interactions with this specific creator
  const interactions = authorInteractionCounts[postAuthorId];
  if (interactions) {
    if (interactions.likes > 0) affinity += 15;
    if (interactions.comments > 0) affinity += 10;
    if (interactions.shares > 0) affinity += 5;
  }

  return Math.min(100, Math.max(0, affinity));
}

/**
 * Normalize three weights so they always sum to exactly 100%
 */
export function normalizeWeights(recency, engagement, affinity) {
  let r = Math.max(0, Number(recency) || 0);
  let e = Math.max(0, Number(engagement) || 0);
  let a = Math.max(0, Number(affinity) || 0);

  const sum = r + e + a;
  if (sum === 0) {
    return { recencyWeight: 35, engagementWeight: 35, affinityWeight: 30 };
  }

  let normR = Math.round((r / sum) * 100);
  let normE = Math.round((e / sum) * 100);
  let normA = 100 - (normR + normE);

  if (normA < 0) {
    normA = 0;
    normE = 100 - normR;
  }

  return {
    recencyWeight: normR,
    engagementWeight: normE,
    affinityWeight: normA
  };
}

/**
 * Rank an entire collection of posts (Instagram media + Community posts)
 */
export function rankPosts(posts, weights, currentUserId, socialContext = {}) {
  if (!Array.isArray(posts) || posts.length === 0) return [];

  // Find max raw engagement across current pool for dynamic benchmarking
  const maxRaw = posts.reduce((max, p) => {
    const likes = Number(p.likeCount !== undefined ? p.likeCount : (p.likesCount || 0));
    const comments = Number(p.commentsCount !== undefined ? p.commentsCount : 0);
    const shares = Number(p.sharesCount || 0);
    const raw = (likes * 1.0) + (comments * 2.5) + (shares * 4.0);
    return Math.max(max, raw);
  }, 100);

  const benchmark = Math.max(200, maxRaw);

  const scoredPosts = posts.map(post => {
    const normWeights = normalizeWeights(
      weights.recencyWeight,
      weights.engagementWeight,
      weights.affinityWeight
    );

    const postDate = post.timestamp || post.createdAt;
    const authorId = post.authorId || post.ownerUserId;

    const recencyScore = calculateRecencyScore(postDate);
    const engagementScore = calculateEngagementScore(post, benchmark);
    const affinityScore = calculateAffinityScore(authorId, currentUserId, socialContext);

    const recencyContrib = Math.round((recencyScore * (normWeights.recencyWeight / 100)) * 10) / 10;
    const engagementContrib = Math.round((engagementScore * (normWeights.engagementWeight / 100)) * 10) / 10;
    const affinityContrib = Math.round((affinityScore * (normWeights.affinityWeight / 100)) * 10) / 10;

    const finalScore = Math.round((recencyContrib + engagementContrib + affinityContrib) * 10) / 10;

    return {
      ...post,
      ranking: {
        score: finalScore,
        recencyScore,
        engagementScore,
        affinityScore,
        recencyContrib,
        engagementContrib,
        affinityContrib,
        weights: normWeights
      }
    };
  });

  // Sort descending by final score. Tie-break with publication timestamp
  scoredPosts.sort((a, b) => {
    if (b.ranking.score !== a.ranking.score) {
      return b.ranking.score - a.ranking.score;
    }
    const dateB = new Date(b.timestamp || b.createdAt || 0);
    const dateA = new Date(a.timestamp || a.createdAt || 0);
    return dateB - dateA;
  });

  // Assign 1-indexed rank position
  return scoredPosts.map((post, index) => {
    post.ranking.position = index + 1;
    post.ranking.explanation = generateRankingExplanation(post, post.ranking.position);
    return post;
  });
}

/**
 * Generate transparent natural language explanation of ranking
 */
export function generateRankingExplanation(post, rankPosition) {
  const { recencyScore, engagementScore, affinityScore, recencyContrib, engagementContrib, affinityContrib, weights } = post.ranking;
  
  const likes = post.likeCount !== undefined ? post.likeCount : (post.likesCount || 0);
  const comments = post.commentsCount || 0;
  const isInstagram = Boolean(post.permalink && post.mediaType);

  const maxContrib = Math.max(recencyContrib, engagementContrib, affinityContrib);
  let dominantReason = "";

  if (maxContrib === recencyContrib && weights.recencyWeight >= 25) {
    dominantReason = `strong publication freshness (${recencyScore}/100 recency score contributing ${recencyContrib} pts)`;
  } else if (maxContrib === engagementContrib && weights.engagementWeight >= 25) {
    dominantReason = `high real engagement (${likes} likes, ${comments} comments contributing ${engagementContrib} pts)`;
  } else if (maxContrib === affinityContrib && weights.affinityWeight >= 25) {
    dominantReason = `close creator affinity (${affinityScore}/100 connection score contributing ${affinityContrib} pts)`;
  } else {
    dominantReason = `balanced combination across recency (${recencyContrib}), engagement (${engagementContrib}), and affinity (${affinityContrib})`;
  }

  const sourcePrefix = isInstagram ? "Official Instagram Post" : "Community Post";
  return `[${sourcePrefix}] Ranked #${rankPosition} primarily due to ${dominantReason}. Total educational score: ${post.ranking.score}/100.`;
}

/**
 * Compare two ranking configurations side-by-side
 */
export function compareRankingConfigurations(posts, configA, configB, currentUserId, socialContext = {}) {
  const rankedA = rankPosts(posts, configA, currentUserId, socialContext);
  const rankedB = rankPosts(posts, configB, currentUserId, socialContext);

  const posA = new Map();
  rankedA.forEach(p => posA.set(p.postId || p.mediaId, p.ranking.position));

  const comparisonResults = rankedB.map(p => {
    const key = p.postId || p.mediaId;
    const origPos = posA.get(key) || p.ranking.position;
    const newPos = p.ranking.position;
    const delta = origPos - newPos;

    return {
      post: p,
      positionA: origPos,
      positionB: newPos,
      delta: delta,
      scoreA: rankedA.find(item => (item.postId || item.mediaId) === key)?.ranking.score || 0,
      scoreB: p.ranking.score
    };
  });

  return {
    rankedA,
    rankedB,
    comparisonResults
  };
}
