/**
 * Recommendation-Ranked Social Feed Studio
 * Algorithm Studio & Side-by-Side Model Comparison Engine
 * 
 * Supports both Real Imported Instagram Media and Community Posts.
 */

import { initAuth, getCurrentUser, requireAuth } from "./auth.js";
import { getAllPosts } from "./posts.js";
import { getImportedInstagramMedia } from "./instagram.js";
import { 
  ALGORITHM_PRESETS, 
  rankPosts, 
  compareRankingConfigurations, 
  normalizeWeights 
} from "./algorithm.js";
import { getSocialContext } from "./interactions.js";
import { getActiveWeights, setActiveWeights } from "./feed.js";
import { 
  showToast, 
  formatRelativeTime, 
  escapeHtml, 
  formatCount, 
  generateId, 
  getLocalCollection, 
  saveLocalCollection 
} from "./utils.js";
import { initFirebase } from "./firebase-config.js";

// Studio State
let currentWeights = { recencyWeight: 35, engagementWeight: 35, affinityWeight: 30 };
let allCombinedPosts = [];
let socialContext = {};

// Comparison State
let configA = { ...ALGORITHM_PRESETS.chronological };
let configB = { ...ALGORITHM_PRESETS.popularity };

/**
 * Initialize Algorithm Studio Page
 */
export async function initAlgorithmStudioPage() {
  if (!requireAuth()) return;
  await initAuth();
  const user = getCurrentUser();
  const currentUserId = user ? user.uid : null;

  // 1. Fetch community posts
  const communityPosts = await getAllPosts();

  // 2. Fetch real imported Instagram media
  let igMedia = [];
  if (currentUserId) {
    const rawIg = await getImportedInstagramMedia(currentUserId);
    igMedia = rawIg.map(item => ({
      ...item,
      postId: item.id || `ig_${item.mediaId}`,
      isInstagram: true,
      authorId: item.ownerUserId,
      content: item.caption || "",
      createdAt: item.timestamp,
      author: { name: "📸 Instagram Media" }
    }));
  }

  allCombinedPosts = [...igMedia, ...communityPosts];
  socialContext = await getSocialContext(currentUserId);
  currentWeights = getActiveWeights();

  setupStudioSliders();
  setupPresetButtons();
  setupCustomPresetsManager();
  setupComparisonSection();

  updateStudioDisplay();
}

/**
 * Setup interactive weight sliders with dynamic auto-balancing
 */
function setupStudioSliders() {
  const rSlider = document.getElementById("slider-recency");
  const eSlider = document.getElementById("slider-engagement");
  const aSlider = document.getElementById("slider-affinity");

  if (!rSlider || !eSlider || !aSlider) return;

  rSlider.value = currentWeights.recencyWeight;
  eSlider.value = currentWeights.engagementWeight;
  aSlider.value = currentWeights.affinityWeight;

  const handleSliderChange = (changedSignal) => {
    let r = parseInt(rSlider.value) || 0;
    let e = parseInt(eSlider.value) || 0;
    let a = parseInt(aSlider.value) || 0;

    if (changedSignal === "recency") {
      const remaining = 100 - r;
      const otherSum = e + a;
      if (otherSum > 0) {
        e = Math.round((e / otherSum) * remaining);
        a = remaining - e;
      } else {
        e = Math.floor(remaining / 2);
        a = remaining - e;
      }
    } else if (changedSignal === "engagement") {
      const remaining = 100 - e;
      const otherSum = r + a;
      if (otherSum > 0) {
        r = Math.round((r / otherSum) * remaining);
        a = remaining - r;
      } else {
        r = Math.floor(remaining / 2);
        a = remaining - r;
      }
    } else if (changedSignal === "affinity") {
      const remaining = 100 - a;
      const otherSum = r + e;
      if (otherSum > 0) {
        r = Math.round((r / otherSum) * remaining);
        e = remaining - r;
      } else {
        r = Math.floor(remaining / 2);
        e = remaining - r;
      }
    }

    currentWeights = normalizeWeights(r, e, a);

    rSlider.value = currentWeights.recencyWeight;
    eSlider.value = currentWeights.engagementWeight;
    aSlider.value = currentWeights.affinityWeight;

    updateStudioDisplay();
  };

  rSlider.addEventListener("input", () => handleSliderChange("recency"));
  eSlider.addEventListener("input", () => handleSliderChange("engagement"));
  aSlider.addEventListener("input", () => handleSliderChange("affinity"));

  const applyBtn = document.getElementById("btn-apply-algorithm");
  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      setActiveWeights(currentWeights);
      showToast("Algorithm weights applied to your active feed!", "success");
    });
  }

  const resetBtn = document.getElementById("btn-reset-algorithm");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      currentWeights = { ...ALGORITHM_PRESETS.balanced };
      rSlider.value = currentWeights.recencyWeight;
      eSlider.value = currentWeights.engagementWeight;
      aSlider.value = currentWeights.affinityWeight;
      updateStudioDisplay();
      showToast("Reset to Balanced Discovery default.", "info");
    });
  }
}

/**
 * Setup Preset Selection
 */
function setupPresetButtons() {
  const container = document.getElementById("preset-buttons-container");
  if (!container) return;

  const presets = Object.values(ALGORITHM_PRESETS);
  container.innerHTML = presets.map(p => `
    <button class="btn-preset-card" data-preset-id="${p.id}">
      <div class="preset-card-top">
        <strong>${escapeHtml(p.name)}</strong>
        <span class="preset-tag">${p.recencyWeight}/${p.engagementWeight}/${p.affinityWeight}</span>
      </div>
      <p class="preset-card-desc">${escapeHtml(p.description)}</p>
    </button>
  `).join("");

  container.querySelectorAll(".btn-preset-card").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-preset-id");
      const preset = ALGORITHM_PRESETS[id];
      if (preset) {
        currentWeights = {
          recencyWeight: preset.recencyWeight,
          engagementWeight: preset.engagementWeight,
          affinityWeight: preset.affinityWeight
        };

        const rSlider = document.getElementById("slider-recency");
        const eSlider = document.getElementById("slider-engagement");
        const aSlider = document.getElementById("slider-affinity");
        if (rSlider) rSlider.value = currentWeights.recencyWeight;
        if (eSlider) eSlider.value = currentWeights.engagementWeight;
        if (aSlider) aSlider.value = currentWeights.affinityWeight;

        updateStudioDisplay();
        showToast(`Loaded ${preset.name} preset!`, "info");
      }
    });
  });
}

/**
 * Update studio visual readouts and live feed preview
 */
function updateStudioDisplay() {
  const user = getCurrentUser();
  const currentUserId = user ? user.uid : null;

  const rVal = document.getElementById("val-recency");
  const eVal = document.getElementById("val-engagement");
  const aVal = document.getElementById("val-affinity");
  const sumVal = document.getElementById("val-total-sum");

  if (rVal) rVal.textContent = `${currentWeights.recencyWeight}%`;
  if (eVal) eVal.textContent = `${currentWeights.engagementWeight}%`;
  if (aVal) aVal.textContent = `${currentWeights.affinityWeight}%`;
  if (sumVal) {
    const total = currentWeights.recencyWeight + currentWeights.engagementWeight + currentWeights.affinityWeight;
    sumVal.textContent = `${total}%`;
    sumVal.className = total === 100 ? "val-sum-valid" : "val-sum-invalid";
  }

  const formulaBar = document.getElementById("formula-visual-bar");
  if (formulaBar) {
    formulaBar.innerHTML = `
      <div class="seg-recency" style="width: ${currentWeights.recencyWeight}%" title="Recency: ${currentWeights.recencyWeight}%">Recency ${currentWeights.recencyWeight}%</div>
      <div class="seg-engagement" style="width: ${currentWeights.engagementWeight}%" title="Engagement: ${currentWeights.engagementWeight}%">Engagement ${currentWeights.engagementWeight}%</div>
      <div class="seg-affinity" style="width: ${currentWeights.affinityWeight}%" title="Affinity: ${currentWeights.affinityWeight}%">Affinity ${currentWeights.affinityWeight}%</div>
    `;
  }

  const ranked = rankPosts(allCombinedPosts, currentWeights, currentUserId, socialContext);
  renderLiveStudioPreview(ranked);
}

/**
 * Render Live Ranking Preview in Studio
 */
function renderLiveStudioPreview(rankedPosts) {
  const container = document.getElementById("studio-live-preview-list");
  if (!container) return;

  if (rankedPosts.length === 0) {
    container.innerHTML = `<p class="empty-state-text">No posts available for ranking preview.</p>`;
    return;
  }

  container.innerHTML = rankedPosts.slice(0, 8).map(post => {
    const { score, recencyScore, engagementScore, affinityScore, recencyContrib, engagementContrib, affinityContrib, weights } = post.ranking;

    const authorDisplay = post.isInstagram ? "📸 Instagram" : (post.author?.name || "Community");
    const textPreview = post.caption || post.content || "(No caption)";

    return `
      <div class="studio-preview-card">
        <div class="preview-rank-col">
          <span class="preview-pos">#${post.ranking.position}</span>
          <span class="preview-score">${score}</span>
        </div>
        <div class="preview-content-col">
          <div class="preview-author-row">
            <strong>${escapeHtml(authorDisplay)}</strong>
            <span class="preview-time">${formatRelativeTime(post.timestamp || post.createdAt)}</span>
          </div>
          <p class="preview-text">${escapeHtml(textPreview.substring(0, 110))}${textPreview.length > 110 ? '...' : ''}</p>
          
          <div class="preview-contributions-bar">
            <div class="p-bar r-bar" style="width: ${(recencyContrib / Math.max(1, weights.recencyWeight)) * 100}%" title="Recency: ${recencyContrib}/${weights.recencyWeight}">
              R: ${recencyContrib}
            </div>
            <div class="p-bar e-bar" style="width: ${(engagementContrib / Math.max(1, weights.engagementWeight)) * 100}%" title="Engagement: ${engagementContrib}/${weights.engagementWeight}">
              E: ${engagementContrib}
            </div>
            <div class="p-bar a-bar" style="width: ${(affinityContrib / Math.max(1, weights.affinityWeight)) * 100}%" title="Affinity: ${affinityContrib}/${weights.affinityWeight}">
              A: ${affinityContrib}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

/**
 * Setup Custom Preset Saving & Loading
 */
function setupCustomPresetsManager() {
  const saveForm = document.getElementById("save-preset-form");
  const presetNameInput = document.getElementById("custom-preset-name");
  const customListContainer = document.getElementById("custom-presets-list");

  const loadSavedPresets = async () => {
    if (!customListContainer) return;
    const user = getCurrentUser();
    let savedList = [];

    const { isLive, db, firebaseModules } = await initFirebase();
    if (isLive && db && firebaseModules && user) {
      try {
        const { collection, getDocs, query, where } = firebaseModules.firestoreModule;
        const q = query(collection(db, "algorithmSettings"), where("userId", "==", user.uid));
        const snap = await getDocs(q);
        snap.forEach(d => savedList.push({ id: d.id, ...d.data() }));
      } catch (e) {
        savedList = getLocalCollection("algorithmSettings");
      }
    } else {
      savedList = getLocalCollection("algorithmSettings");
    }

    if (savedList.length === 0) {
      customListContainer.innerHTML = `<p class="empty-subtext">No custom presets saved yet.</p>`;
      return;
    }

    customListContainer.innerHTML = savedList.map(preset => `
      <div class="custom-preset-item" data-id="${preset.id}">
        <div class="custom-preset-info">
          <strong>${escapeHtml(preset.configurationName || 'Custom Preset')}</strong>
          <span>R: ${preset.recencyWeight}% | E: ${preset.engagementWeight}% | A: ${preset.affinityWeight}%</span>
        </div>
        <div class="custom-preset-actions">
          <button class="btn btn-xs btn-outline btn-load-custom" data-id="${preset.id}">Load</button>
          <button class="btn btn-xs btn-danger btn-delete-custom" data-id="${preset.id}">✕</button>
        </div>
      </div>
    `).join("");

    customListContainer.querySelectorAll(".btn-load-custom").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const found = savedList.find(p => p.id === id);
        if (found) {
          currentWeights = normalizeWeights(found.recencyWeight, found.engagementWeight, found.affinityWeight);
          const rSlider = document.getElementById("slider-recency");
          const eSlider = document.getElementById("slider-engagement");
          const aSlider = document.getElementById("slider-affinity");
          if (rSlider) rSlider.value = currentWeights.recencyWeight;
          if (eSlider) eSlider.value = currentWeights.engagementWeight;
          if (aSlider) aSlider.value = currentWeights.affinityWeight;
          updateStudioDisplay();
          showToast(`Loaded custom preset: ${found.configurationName}`, "info");
        }
      });
    });

    customListContainer.querySelectorAll(".btn-delete-custom").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const { isLive, db, firebaseModules } = await initFirebase();
        if (isLive && db && firebaseModules) {
          try {
            const { doc, deleteDoc } = firebaseModules.firestoreModule;
            await deleteDoc(doc(db, "algorithmSettings", id));
          } catch (e) {
            console.warn("Could not delete preset from Firestore:", e);
          }
        }
        let list = getLocalCollection("algorithmSettings");
        list = list.filter(p => p.id !== id);
        saveLocalCollection("algorithmSettings", list);
        showToast("Custom preset removed.", "info");
        await loadSavedPresets();
      });
    });
  };

  if (saveForm && presetNameInput) {
    saveForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = presetNameInput.value.trim();
      if (!name) return;

      const user = getCurrentUser();
      const newPreset = {
        id: generateId("preset"),
        userId: user ? user.uid : "local_user",
        configurationName: name,
        recencyWeight: currentWeights.recencyWeight,
        engagementWeight: currentWeights.engagementWeight,
        affinityWeight: currentWeights.affinityWeight,
        updatedAt: new Date().toISOString()
      };

      const { isLive, db, firebaseModules } = await initFirebase();
      if (isLive && db && firebaseModules && user) {
        try {
          const { doc, setDoc } = firebaseModules.firestoreModule;
          await setDoc(doc(db, "algorithmSettings", newPreset.id), newPreset);
        } catch (e) {
          console.warn("Could not save preset to live Firestore:", e);
        }
      }

      const list = getLocalCollection("algorithmSettings");
      list.push(newPreset);
      saveLocalCollection("algorithmSettings", list);

      presetNameInput.value = "";
      showToast(`Saved preset "${name}"!`, "success");
      await loadSavedPresets();
    });
  }

  loadSavedPresets();
}

/**
 * Side-by-Side Algorithm Comparison (Module 11)
 */
function setupComparisonSection() {
  const compSelectA = document.getElementById("comp-select-a");
  const compSelectB = document.getElementById("comp-select-b");

  if (!compSelectA || !compSelectB) return;

  const updateComparison = () => {
    const valA = compSelectA.value;
    const valB = compSelectB.value;

    configA = ALGORITHM_PRESETS[valA] || ALGORITHM_PRESETS.chronological;
    configB = ALGORITHM_PRESETS[valB] || ALGORITHM_PRESETS.popularity;

    renderComparisonResults();
  };

  compSelectA.addEventListener("change", updateComparison);
  compSelectB.addEventListener("change", updateComparison);

  updateComparison();
}

function renderComparisonResults() {
  const containerA = document.getElementById("comp-feed-a");
  const containerB = document.getElementById("comp-feed-b");
  const diffSummary = document.getElementById("comp-diff-summary");

  if (!containerA || !containerB) return;

  const user = getCurrentUser();
  const currentUserId = user ? user.uid : null;

  const { rankedA, rankedB, comparisonResults } = compareRankingConfigurations(
    allCombinedPosts,
    configA,
    configB,
    currentUserId,
    socialContext
  );

  containerA.innerHTML = rankedA.slice(0, 6).map(p => {
    const textPreview = p.caption || p.content || "(No caption)";
    const authorName = p.isInstagram ? "📸 Instagram" : (p.author?.name || "Community");
    return `
      <div class="comp-post-card">
        <div class="comp-badge">#${p.ranking.position} (${p.ranking.score} pts)</div>
        <div class="comp-author">${escapeHtml(authorName)} • ${formatRelativeTime(p.timestamp || p.createdAt)}</div>
        <p class="comp-text">${escapeHtml(textPreview.substring(0, 80))}...</p>
      </div>
    `;
  }).join("");

  containerB.innerHTML = comparisonResults.slice(0, 6).map(res => {
    const p = res.post;
    const delta = res.delta;
    let deltaBadge = "";

    if (delta > 0) {
      deltaBadge = `<span class="delta-up">▲ +${delta} spots</span>`;
    } else if (delta < 0) {
      deltaBadge = `<span class="delta-down">▼ ${delta} spots</span>`;
    } else {
      deltaBadge = `<span class="delta-equal">= No change</span>`;
    }

    const textPreview = p.caption || p.content || "(No caption)";
    const authorName = p.isInstagram ? "📸 Instagram" : (p.author?.name || "Community");

    return `
      <div class="comp-post-card ${delta > 0 ? 'shifted-up' : delta < 0 ? 'shifted-down' : ''}">
        <div class="comp-badge-row">
          <div class="comp-badge">#${res.positionB} (${res.scoreB} pts)</div>
          ${deltaBadge}
        </div>
        <div class="comp-author">${escapeHtml(authorName)} • ${formatRelativeTime(p.timestamp || p.createdAt)}</div>
        <p class="comp-text">${escapeHtml(textPreview.substring(0, 80))}...</p>
      </div>
    `;
  }).join("");

  if (diffSummary) {
    const majorShifts = comparisonResults.filter(r => Math.abs(r.delta) >= 2);
    diffSummary.innerHTML = `
      <div class="diff-summary-card">
        <h4>⚡ Why Content Visibility Shifted</h4>
        <p>Switching from <strong>${configA.name}</strong> to <strong>${configB.name}</strong> caused <strong>${majorShifts.length} items</strong> to shift rank by 2 or more positions.</p>
        <ul>
          <li><strong>Recency shift (${configA.recencyWeight}% ➔ ${configB.recencyWeight}%):</strong> ${configA.recencyWeight > configB.recencyWeight ? 'Older viral posts gained visibility while freshly published posts lost top positions.' : 'Fresh posts gained significant priority over older high-engagement content.'}</li>
          <li><strong>Engagement shift (${configA.engagementWeight}% ➔ ${configB.engagementWeight}%):</strong> ${configB.engagementWeight > configA.engagementWeight ? 'Viral posts with high like and comment counts dominate the top spots.' : 'Viral posts lost their unfair advantage in favor of chronological order.'}</li>
        </ul>
      </div>
    `;
  }
}
