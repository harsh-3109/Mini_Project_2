/**
 * Recommendation-Ranked Social Feed Studio
 * Settings, Theme Manager & Firebase Credential Controller
 */

import { defaultFirebaseConfig, isFirebaseConfigured, initFirebase } from "./firebase-config.js";
import { getCurrentUser, requireAuth, logoutUser } from "./auth.js";
import { showToast, saveLocalCollection, getLocalCollection } from "./utils.js";
import { seedSampleData } from "./posts.js";
import { testCloudFunctionConnectivity } from "./instagram-sync.js";

const THEME_KEY = "rr_theme_mode";

// Initialize Theme
export function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || "light";
  applyTheme(savedTheme);

  const toggle = document.getElementById("theme-toggle-switch");
  if (toggle) {
    toggle.checked = (savedTheme === "dark");
    toggle.addEventListener("change", (e) => {
      const mode = e.target.checked ? "dark" : "light";
      applyTheme(mode);
    });
  }
}

export function applyTheme(mode) {
  if (mode === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem(THEME_KEY, "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem(THEME_KEY, "light");
  }
}

/**
 * Initialize Settings Page
 */
export async function initSettingsPage() {
  const user = getCurrentUser();

  // 1. Meta Instagram & Cloud Functions Settings
  const metaAppIdInput = document.getElementById("meta-app-id-input");
  const functionsBaseUrlInput = document.getElementById("functions-base-url-input");
  const redirectUriDisplay = document.getElementById("meta-oauth-redirect-display");
  const metaStatusBadge = document.getElementById("meta-gateway-status");
  const btnCopyRedirect = document.getElementById("btn-copy-redirect-uri");
  const btnTestFunctions = document.getElementById("btn-test-cloud-functions");
  const metaForm = document.getElementById("meta-config-form");

  const currentMetaAppId = localStorage.getItem("rr_meta_app_id") || (window.META_CONFIG && window.META_CONFIG.APP_ID) || "";
  const currentFunctionsUrl = localStorage.getItem("rr_functions_base_url") || (window.META_CONFIG && window.META_CONFIG.CLOUD_FUNCTIONS_BASE_URL) || "";

  if (metaAppIdInput) metaAppIdInput.value = currentMetaAppId;
  if (functionsBaseUrlInput) {
    functionsBaseUrlInput.value = currentFunctionsUrl;
    
    const updateRedirectDisplay = () => {
      const base = functionsBaseUrlInput.value.trim().replace(/\/$/, "");
      if (redirectUriDisplay) {
        redirectUriDisplay.value = base ? `${base}/instagramOAuthCallback` : "https://us-central1-YOUR-PROJECT.cloudfunctions.net/instagramOAuthCallback";
      }
    };
    updateRedirectDisplay();
    functionsBaseUrlInput.addEventListener("input", updateRedirectDisplay);
  }

  if (btnCopyRedirect && redirectUriDisplay) {
    btnCopyRedirect.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(redirectUriDisplay.value);
        showToast("OAuth Redirect URI copied to clipboard!", "success");
      } catch (err) {
        redirectUriDisplay.select();
        document.execCommand("copy");
        showToast("Copied to clipboard!", "success");
      }
    });
  }

  // Gateway status check
  const checkGatewayStatus = async () => {
    if (!metaStatusBadge) return;
    try {
      const res = await testCloudFunctionConnectivity();
      if (res.connected) {
        metaStatusBadge.className = "badge badge-success";
        metaStatusBadge.textContent = "● Gateway Live & Connected";
      } else {
        metaStatusBadge.className = "badge badge-warning";
        metaStatusBadge.textContent = "● Functions Gateway Offline";
      }
    } catch (e) {
      metaStatusBadge.className = "badge badge-warning";
      metaStatusBadge.textContent = "● Needs Configuration";
    }
  };
  checkGatewayStatus();

  if (btnTestFunctions) {
    btnTestFunctions.addEventListener("click", async () => {
      btnTestFunctions.disabled = true;
      btnTestFunctions.textContent = "Testing...";
      try {
        const res = await testCloudFunctionConnectivity();
        if (res.connected) {
          showToast(`Gateway Connected! Version: ${res.data?.version || "active"}`, "success");
          if (metaStatusBadge) {
            metaStatusBadge.className = "badge badge-success";
            metaStatusBadge.textContent = "● Gateway Live & Connected";
          }
        } else {
          showToast(`Gateway unreachable: ${res.error}. Verify deployed Cloud Function URL.`, "error");
        }
      } catch (e) {
        showToast("Gateway test failed: " + e.message, "error");
      } finally {
        btnTestFunctions.disabled = false;
        btnTestFunctions.textContent = "Test Gateway Connectivity";
      }
    });
  }

  if (metaForm) {
    metaForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const appId = metaAppIdInput ? metaAppIdInput.value.trim() : "";
      const funcsUrl = functionsBaseUrlInput ? functionsBaseUrlInput.value.trim() : "";
      localStorage.setItem("rr_meta_app_id", appId);
      localStorage.setItem("rr_functions_base_url", funcsUrl);
      if (window.META_CONFIG) {
        window.META_CONFIG.APP_ID = appId;
        window.META_CONFIG.CLOUD_FUNCTIONS_BASE_URL = funcsUrl;
      }
      showToast("Meta API Gateway settings saved successfully!", "success");
      checkGatewayStatus();
    });
  }

  // 2. Populate Firebase Settings form
  const apiKeyInput = document.getElementById("fb-api-key");
  const authDomainInput = document.getElementById("fb-auth-domain");
  const projectIdInput = document.getElementById("fb-project-id");
  const storageBucketInput = document.getElementById("fb-storage-bucket");
  const senderIdInput = document.getElementById("fb-sender-id");
  const appIdInput = document.getElementById("fb-app-id");
  const statusBadge = document.getElementById("fb-connection-status");

  // Load existing configuration
  let currentConfig = defaultFirebaseConfig;
  try {
    const saved = localStorage.getItem("rr_firebase_config");
    if (saved) currentConfig = JSON.parse(saved);
  } catch (e) {}

  if (apiKeyInput) apiKeyInput.value = currentConfig.apiKey || "";
  if (authDomainInput) authDomainInput.value = currentConfig.authDomain || "";
  if (projectIdInput) projectIdInput.value = currentConfig.projectId || "";
  if (storageBucketInput) storageBucketInput.value = currentConfig.storageBucket || "";
  if (senderIdInput) senderIdInput.value = currentConfig.messagingSenderId || "";
  if (appIdInput) appIdInput.value = currentConfig.appId || "";

  if (statusBadge) {
    if (isFirebaseConfigured) {
      statusBadge.className = "badge badge-success";
      statusBadge.textContent = "● Live Firebase Connected";
    } else {
      statusBadge.className = "badge badge-warning";
      statusBadge.textContent = "● Educational Local Mode Active";
    }
  }

  // Save Firebase Config Form
  const fbForm = document.getElementById("firebase-config-form");
  if (fbForm) {
    fbForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const newConfig = {
        apiKey: apiKeyInput.value.trim(),
        authDomain: authDomainInput.value.trim(),
        projectId: projectIdInput.value.trim(),
        storageBucket: storageBucketInput.value.trim(),
        messagingSenderId: senderIdInput.value.trim(),
        appId: appIdInput.value.trim()
      };

      localStorage.setItem("rr_firebase_config", JSON.stringify(newConfig));
      showToast("Firebase credentials saved! Reloading application...", "success");
      setTimeout(() => window.location.reload(), 1200);
    });
  }

  // Reset Firebase Config
  const resetFbBtn = document.getElementById("btn-reset-firebase");
  if (resetFbBtn) {
    resetFbBtn.addEventListener("click", () => {
      if (confirm("Reset Firebase credentials to default placeholders?")) {
        localStorage.removeItem("rr_firebase_config");
        showToast("Reset to default placeholders. Reloading...", "info");
        setTimeout(() => window.location.reload(), 1000);
      }
    });
  }

  // Seed sample data button
  const seedBtn = document.getElementById("btn-seed-data");
  if (seedBtn) {
    seedBtn.addEventListener("click", async () => {
      seedBtn.disabled = true;
      seedBtn.innerHTML = `<span class="spinner-sm"></span> Seeding dataset...`;
      try {
        await seedSampleData(true); // force re-seed
        showToast("Sample dataset loaded successfully!", "success");
      } catch (e) {
        showToast("Error seeding data: " + e.message, "error");
      } finally {
        seedBtn.disabled = false;
        seedBtn.textContent = "Re-seed Sample Data";
      }
    });
  }

  // Clear demo data
  const clearDataBtn = document.getElementById("btn-clear-demo-data");
  if (clearDataBtn) {
    clearDataBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to clear local posts, comments, and interactions?")) {
        saveLocalCollection("posts", []);
        saveLocalCollection("comments", []);
        saveLocalCollection("likes", []);
        saveLocalCollection("savedPosts", []);
        saveLocalCollection("follows", []);
        saveLocalCollection("notifications", []);
        saveLocalCollection("userInteractions", []);
        showToast("Local data reset. You can click 'Re-seed Sample Data' anytime.", "info");
        setTimeout(() => window.location.reload(), 1000);
      }
    });
  }

  // Theme switch setup
  initTheme();
}
