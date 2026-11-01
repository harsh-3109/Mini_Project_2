/**
 * Recommendation-Ranked Social Feed Studio
 * Client-Side Instagram Integration Module
 * 
 * Interacts with Firebase Cloud Functions for secure server-side Instagram OAuth
 * and listens to Firestore for real-time connection status updates.
 */

import { initFirebase } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";
import { showToast } from "./utils.js";

// Cloud Functions Base URL (Can be customized in Settings or points to default project region)
export function getFunctionsBaseUrl() {
  const customUrl = localStorage.getItem("rr_functions_base_url");
  if (customUrl) return customUrl.replace(/\/$/, "");

  // Default Firebase Cloud Functions URL pattern
  try {
    const savedConfig = localStorage.getItem("rr_firebase_config");
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      if (parsed.projectId && !parsed.projectId.includes("YOUR_")) {
        return `https://us-central1-${parsed.projectId}.cloudfunctions.net`;
      }
    }
  } catch (e) {}

  return "https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net";
}

/**
 * Get current user's Firebase ID token for authenticating with Cloud Functions
 */
async function getIdToken() {
  const { isLive, auth } = await initFirebase();
  if (!isLive || !auth || !auth.currentUser) {
    throw new Error("You must be logged in with Firebase Authentication to access Instagram features.");
  }
  return await auth.currentUser.getIdToken();
}

/**
 * Fetch Instagram Connection Status from Firestore
 */
export async function getInstagramConnection(userId) {
  if (!userId) return null;

  const { isLive, db, firebaseModules } = await initFirebase();

  if (isLive && db && firebaseModules) {
    try {
      const { doc, getDoc } = firebaseModules.firestoreModule;
      const docSnap = await getDoc(doc(db, "instagramConnections", userId));
      if (docSnap.exists()) {
        return docSnap.data();
      }
    } catch (err) {
      console.warn("Could not fetch Instagram connection from live Firestore:", err);
    }
  }

  // Check local fallback
  try {
    const raw = localStorage.getItem(`rr_ig_conn_${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Start Instagram OAuth Connection Flow
 */
export async function startInstagramOAuthFlow() {
  const user = getCurrentUser();
  if (!user) {
    showToast("Please sign in to connect your Instagram account.", "warning");
    window.location.href = "login.html";
    return;
  }

  const baseUrl = getFunctionsBaseUrl();
  if (baseUrl.includes("YOUR_PROJECT_ID")) {
    throw new Error("Firebase Cloud Functions URL is not configured. Please configure your Firebase Project ID in Settings.");
  }

  showToast("Requesting secure Instagram authorization session...", "info");

  try {
    const token = await getIdToken();
    const response = await fetch(`${baseUrl}/getInstagramAuthUrl`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    const data = await response.json();
    if (!response.ok || !data.authUrl) {
      throw new Error(data.error || "Failed to generate Instagram authorization URL.");
    }

    // Redirect user to official Meta Instagram Login page
    window.location.href = data.authUrl;

  } catch (err) {
    console.error("Error starting Instagram OAuth:", err);
    throw err;
  }
}

/**
 * Disconnect Instagram Integration
 */
export async function disconnectInstagramAccount() {
  const user = getCurrentUser();
  if (!user) throw new Error("Authentication required.");

  const baseUrl = getFunctionsBaseUrl();

  try {
    if (!baseUrl.includes("YOUR_PROJECT_ID")) {
      const token = await getIdToken();
      const response = await fetch(`${baseUrl}/disconnectInstagram`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to disconnect Instagram via Cloud Functions.");
      }
    }

    // Update Firestore connection status on client
    const { isLive, db, firebaseModules } = await initFirebase();
    if (isLive && db && firebaseModules) {
      const { doc, updateDoc } = firebaseModules.firestoreModule;
      await updateDoc(doc(db, "instagramConnections", user.uid), {
        connectionStatus: "disconnected",
        disconnectedAt: new Date().toISOString()
      });
    }

    localStorage.removeItem(`rr_ig_conn_${user.uid}`);
    showToast("Instagram account disconnected successfully.", "info");
    return true;

  } catch (err) {
    console.error("Error disconnecting Instagram:", err);
    throw err;
  }
}

/**
 * Fetch imported Instagram Media records from Firestore
 */
export async function getImportedInstagramMedia(userId) {
  if (!userId) return [];

  const { isLive, db, firebaseModules } = await initFirebase();
  const mediaList = [];

  if (isLive && db && firebaseModules) {
    try {
      const { collection, getDocs, query, where, orderBy } = firebaseModules.firestoreModule;
      const q = query(
        collection(db, "instagramMedia"),
        where("ownerUserId", "==", userId),
        orderBy("timestamp", "desc")
      );
      const snapshot = await getDocs(q);
      snapshot.forEach(docSnap => {
        mediaList.push({ id: docSnap.id, ...docSnap.data() });
      });
      return mediaList;
    } catch (err) {
      console.warn("Could not query instagramMedia with compound sort; attempting fallback:", err);
      // Fallback query without orderBy in case composite index is still building
      try {
        const { collection, getDocs, query, where } = firebaseModules.firestoreModule;
        const fallbackQ = query(collection(db, "instagramMedia"), where("ownerUserId", "==", userId));
        const snap = await getDocs(fallbackQ);
        snap.forEach(d => mediaList.push({ id: d.id, ...d.data() }));
        mediaList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        return mediaList;
      } catch (e) {
        console.error("Fallback query failed:", e);
      }
    }
  }

  // If local store has imported media
  try {
    const raw = localStorage.getItem(`rr_ig_media_${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Fetch Instagram Media Insights from Firestore
 */
export async function getInstagramMediaInsights(userId) {
  if (!userId) return [];

  const { isLive, db, firebaseModules } = await initFirebase();
  const insights = [];

  if (isLive && db && firebaseModules) {
    try {
      const { collection, getDocs, query, where } = firebaseModules.firestoreModule;
      const q = query(collection(db, "instagramInsights"), where("ownerUserId", "==", userId));
      const snapshot = await getDocs(q);
      snapshot.forEach(d => insights.push(d.data()));
    } catch (err) {
      console.warn("Could not fetch insights:", err);
    }
  }

  return insights;
}
