/**
 * Recommendation-Ranked Social Feed Studio
 * Centralized Firebase Configuration & Connection Manager
 * 
 * Uses official Firebase JS SDK CDN ES Modules (v11.4.0).
 * If user hasn't configured real Firebase credentials, it notifies the user
 * and provides a local persistence bridge so the full application remains 
 * 100% testable and educational out-of-the-box in VS Code Live Server.
 */

// Default configuration with placeholders
export const defaultFirebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Check if credentials have been saved in localStorage by the Settings modal
function getActiveConfig() {
  try {
    const saved = localStorage.getItem("rr_firebase_config");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.apiKey && !parsed.apiKey.includes("YOUR_")) {
        return { config: parsed, isCustom: true };
      }
    }
  } catch (e) {
    console.warn("Could not read saved Firebase config:", e);
  }
  return { config: defaultFirebaseConfig, isCustom: false };
}

const { config: activeConfig, isCustom } = getActiveConfig();

export const isFirebaseConfigured = Boolean(
  activeConfig.apiKey &&
  !activeConfig.apiKey.includes("YOUR_API_KEY") &&
  activeConfig.projectId &&
  !activeConfig.projectId.includes("YOUR_PROJECT_ID")
);

// Firebase SDK references
let app = null;
let auth = null;
let db = null;
let firebaseModules = null;
let initPromise = null;

// Initialize Firebase SDK as a singleton
export async function initFirebase() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (isFirebaseConfigured) {
      try {
        const [
          { initializeApp, getApps },
          { 
            getAuth, 
            onAuthStateChanged, 
            signInWithEmailAndPassword, 
            createUserWithEmailAndPassword, 
            signOut, 
            sendPasswordResetEmail, 
            sendEmailVerification, 
            updateProfile,
            reload 
          },
          { 
            getFirestore, 
            collection, 
            doc, 
            setDoc, 
            getDoc, 
            getDocs, 
            updateDoc, 
            deleteDoc, 
            query, 
            where, 
            orderBy, 
            limit, 
            serverTimestamp, 
            increment,
            runTransaction 
          }
        ] = await Promise.all([
          import("https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js"),
          import("https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js"),
          import("https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js")
        ]);

        const existingApps = getApps();
        app = existingApps.length > 0 ? existingApps[0] : initializeApp(activeConfig);
        auth = getAuth(app);
        db = getFirestore(app);

        firebaseModules = {
          authModule: { 
            onAuthStateChanged, 
            signInWithEmailAndPassword, 
            createUserWithEmailAndPassword, 
            signOut, 
            sendPasswordResetEmail, 
            sendEmailVerification, 
            updateProfile,
            reload 
          },
          firestoreModule: { 
            collection, 
            doc, 
            setDoc, 
            getDoc, 
            getDocs, 
            updateDoc, 
            deleteDoc, 
            query, 
            where, 
            orderBy, 
            limit, 
            serverTimestamp, 
            increment,
            runTransaction 
          }
        };

        console.log("🔥 Firebase initialized successfully with active project:", activeConfig.projectId);
        return { isLive: true, app, auth, db, firebaseModules };
      } catch (err) {
        console.error("Failed to initialize Firebase with provided credentials:", err);
        displayConfigWarning("Firebase connection error: " + err.message);
      }
    }

    // If not configured with live credentials, log status and setup notification
    console.info("ℹ️ Firebase credentials are using placeholders. App running in Local Educational Mode.");
    return { isLive: false, app: null, auth: null, db: null, firebaseModules: null };
  })();

  return initPromise;
}

// Display top warning banner if not connected to live Firebase
export function displayConfigWarning(customMessage = null) {
  // Avoid duplicate banner
  if (document.getElementById("firebase-status-banner")) return;

  const banner = document.createElement("div");
  banner.id = "firebase-status-banner";
  banner.className = "firebase-banner";
  
  const isSetup = isFirebaseConfigured;
  banner.innerHTML = `
    <div class="firebase-banner-inner">
      <div class="banner-badge ${isSetup ? 'badge-live' : 'badge-demo'}">
        <span class="pulse-dot"></span>
        ${isSetup ? 'Firebase Live Connected' : 'Demo Mode (Local Data)'}
      </div>
      <div class="banner-text">
        ${customMessage || (isSetup 
          ? `Connected to project: <strong>${activeConfig.projectId}</strong>` 
          : `Firebase credentials not yet configured. The app is fully interactive in local storage mode! You can connect your real Firebase project in <a href="settings.html">Settings</a>.`)}
      </div>
      <div class="banner-actions">
        <a href="settings.html" class="banner-btn">Configure Firebase</a>
        <button type="button" class="banner-close" aria-label="Close" onclick="this.closest('#firebase-status-banner').remove()">✕</button>
      </div>
    </div>
  `;

  document.body.prepend(banner);
}

export { activeConfig, app, auth, db, firebaseModules };
