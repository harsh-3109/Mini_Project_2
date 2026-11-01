# 📊 Recommendation-Ranked Social Feed Studio

### An Educational & Transparent Social Media Feed Recommendation Platform

> Demystifying the black-box recommendation algorithms of Instagram, TikTok, LinkedIn, and X through transparent multi-signal ranking, dynamic weight sliders, live feed re-sorting, before-and-after model comparisons, and mathematical explainability.

---

## 📑 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [Project Objectives](#3-project-objectives)
4. [Technology Stack](#4-technology-stack)
5. [Main Features](#5-main-features)
6. [Project Folder Structure](#6-project-folder-structure)
7. [Firebase Setup Instructions](#7-firebase-setup-instructions)
8. [Authentication Setup](#8-authentication-setup)
9. [Firestore Database Setup](#9-firestore-database-setup)
10. [Security Rules Deployment](#10-security-rules-deployment)
11. [How to Run Using VS Code Live Server](#11-how-to-run-using-vs-code-live-server)
12. [Database Collection Structure](#12-database-collection-structure)
13. [Recommendation Algorithm Formula](#13-recommendation-algorithm-formula)
14. [Meta Instagram Graph API & Firebase Cloud Functions Setup Guide](#14-meta-instagram-graph-api--firebase-cloud-functions-setup-guide)
15. [No-Demo-Data Policy & Real Data Pipeline](#15-no-demo-data-policy--real-data-pipeline)
16. [Firebase Authentication & Cloud Firestore Setup Guide](#16-firebase-authentication--cloud-firestore-setup-guide)
17. [Firestore Database Schema & Security Architecture](#17-firestore-database-schema--security-architecture)
18. [Testing Results & Verification Matrix](#18-testing-results--verification-matrix)
19. [License](#-license)

---

## 1. Project Overview

**Recommendation-Ranked Social Feed Studio** is a complete, full-stack educational web application built for students, researchers, developers, and curious social media users.

On commercial social networks, recommendation algorithms remain opaque "black boxes." This studio puts you directly in the **engineer's cockpit**. You can:

- 🔍 Inspect the exact scores that decide content visibility
- 🎚️ Drag sliders to tune signal weights in real time
- ⚖️ Compare how a chronological feed differs from a virality-focused feed
- 🤝 Explore how social affinity transforms content discovery

The application is built cleanly with **HTML5, CSS3, Vanilla ES6+ JavaScript, and Firebase** (Authentication & Firestore Database), with no third-party frameworks, no Node servers, and no npm build steps.

---

## 2. Problem Statement

Every day, billions of users interact with feeds curated by recommendation engines on platforms like TikTok, Instagram, X (Twitter), YouTube, and LinkedIn. However:

- 🕶️ **Opacity:** Users have no visibility into why post A is prioritized over post B.
- 📈 **Virality Bias:** Engagement-driven algorithms often promote sensationalized outrage or clickbait over educational or high-affinity personal content.
- 🚫 **Lack of Agency:** Users are subjected to monolithic, platform-dictated weights, with no way to tune or audit their own feed dynamics.

This educational platform addresses these problems through **complete mathematical transparency** and **interactive control**.

---

## 3. Project Objectives

1. **Demonstrate Recommendation Signals:** Clearly separate and quantify the three primary signals used by feed rankers: *Recency*, *Engagement*, and *Social Affinity*.
2. **Interactive Weight Tuning:** Provide real-time sliders that let users allocate percentages across signals while strictly maintaining a normalized **100% total weight**.
3. **Instant Re-ranking & Explainability:** Recompute composite scores and re-sort feed cards on the fly, with plain-language explanations and progress-bar contributions.
4. **Side-by-Side Model Comparison:** Compare two distinct ranking philosophies (e.g., Chronological vs. Viral Popularity) side by side, with rank delta indicators (▲ +3, ▼ −2).
5. **Native Analytics:** Visualize score distributions, signal contribution doughnuts, and top-performing posts using native HTML5 Canvas and SVG, with no external chart libraries.
6. **Zero-Setup Resilience:** Run instantly and fully testable on a local VS Code Live Server, while also supporting real-time cloud sync with Firebase.

---

## 4. Technology Stack

This application strictly complies with all project constraints:

| Layer | Technology | Description |
|---|---|---|
| **Structure** | HTML5 | Clean semantic markup, accessible forms, ARIA attributes |
| **Styling** | Vanilla CSS3 | Custom CSS design system, CSS variables (light/dark theme), flexbox, grid, animations (no Tailwind / Bootstrap) |
| **Logic** | Vanilla JavaScript (ES6+) | Native ES modules, async/await, Canvas 2D API, SVG generation (no React / Vue / Angular / TypeScript) |
| **Auth** | Firebase Authentication | CDN modular ES SDK (v11.4.0) for email/password registration, login, and session persistence |
| **Database** | Firebase Firestore | Cloud Firestore for community posts, likes, follows, settings, and imported Instagram media |
| **Backend Integration** | Firebase Cloud Functions (Node.js/JS) | Used exclusively for secure server-side Instagram OAuth, token storage, and Meta Graph API calls (no Express / self-managed Node server) |
| **External API** | Meta Instagram Graph API (v21.0) | Official Instagram API with Instagram Login for Professionals (Business/Creator accounts) |
| **Hosting / Dev** | Firebase Hosting / Static Server | Production Firebase Hosting configuration and local testing |

---

## 5. Main Features

### 🌐 SaaS Landing Page
A professional showcase with a hero visualizer, how-it-works cards, mathematical formula breakdowns, and feature guides.

### 🔐 Authentication System
Email/password registration, login, a password reset modal, session persistence, and profile creation.

### 📸 Real Meta Instagram Graph API Integration
- Connect official Instagram Professional accounts (Business or Creator) via Meta OAuth 2.0.
- Server-side CSRF validation, authorization code exchange, and token refresh in Firebase Cloud Functions.
- Secure token vault (`instagramTokens`) strictly shielded from client reads and writes via Firestore rules.
- Live media ingestion (`instagramMedia`) with real captions, timestamps, permalinks, like counts, and comment counts.
- Media insights retrieval (`instagramInsights`) for reach, impressions, and engagement.
- One-click manual synchronization ("Sync Now") with deduplication and 7-day token auto-refresh.
- Safe disconnection flow that invalidates stored credentials and updates Firestore status.

### 📰 Ranked Social Feed (Hybrid Sources)
- Source tabs: **All Ranked**, **📸 Real Instagram Media**, and **💬 Community Discussions**.
- Instagram post cards with verified creator badges, original Instagram permalinks, and official metrics.
- A transparent recommendation ranking score on every post.
- Community feed supporting post publishing, likes, comments, bookmarks, and author follow relationships.

### 📊 Ranking Badges & Signal Inspection
Each post displays its rank (e.g., `#1 • 87.4 pts`) with a toggleable breakdown showing the **Recency**, **Engagement**, and **Affinity** bar contributions.

### 🎛️ Recommendation Algorithm Studio
- Auto-normalizing sliders for Recency, Engagement, and Affinity (always totaling 100%).
- Predefined models: **Balanced Discovery**, **Chronological**, **Viral Popularity**, and **Personalized**.
- Custom preset creator: save named presets to Firestore and load them anytime.
- Live ranking preview feed that recalculates on every slider tick across both Instagram media and community posts.

### ⚖️ Side-by-Side Model Comparison
Direct comparison of **Configuration A vs. Configuration B** with rank delta badges (▲ +3 spots, ▼ −2 spots, = no change) and plain-language shift summaries.

### 📈 Native Analytics Dashboard
- Real Instagram KPIs: Total Imported Posts, Total Likes, Total Comments, and Average Engagement Rate.
- Media Type Distribution chart (SVG doughnut for `IMAGE`, `VIDEO`, `CAROUSEL_ALBUM`).
- Top 7 Posts by Composite Score (Canvas bar chart).
- Score Distribution Histogram (5 buckets across 0–100).

### 🧭 Explore & Social Graph
Discover creator profiles, search by keywords, and follow/unfollow creators, with changes instantly reflected in feed affinity scores.

### 👤 Profile Management
Profile pages with custom bios, avatars, follower/following counts, and a list of published posts.

### 🔖 Saved Bookmarks
A bookmarked-posts drawer with quick removal and direct feed navigation.

### ⚙️ Settings & API Gateway Hub
- Meta App ID and Cloud Functions Base URL configuration.
- One-click Cloud Functions Gateway connectivity tester.
- Dynamic Meta OAuth Redirect URI generator and copy utility.
- Firebase web configuration credentials manager.

---

## 6. Project Folder Structure

```text
recommendation-ranked-social-feed-studio/
├── index.html                  # SaaS Landing Page
├── login.html                  # Sign In & Password Reset
├── register.html               # New User Account Registration
├── dashboard.html              # Main KPI Overview & Instagram Status Card
├── instagram.html              # Dedicated Instagram Integration Hub
├── feed.html                   # Social Feed with Hybrid Source Filtering
├── algorithm-studio.html       # Interactive Slider Studio & Model Comparison
├── analytics.html              # Native Canvas & SVG Statistical Visualizations
├── explore.html                # Creator Discovery & Trending Posts
├── profile.html                # User Profile & Persona Switcher
├── saved-posts.html            # Bookmarked Posts Collection
├── settings.html               # Meta Gateway & Firebase Config Manager
├── firebase.json               # Firebase CLI project configuration
│
├── css/
│   ├── style.css               # Core design tokens, typography, layout, modals, toasts
│   ├── auth.css                # Authentication cards & quick-fill buttons
│   ├── dashboard.css           # KPI stat cards & activity timelines
│   ├── instagram.css           # Instagram connection cards, sync badges, media gallery
│   ├── feed.css                # Post cards, rank badges, explainability drawers
│   ├── algorithm.css           # Slider controls, segment meters, dual comparison grids
│   ├── analytics.css           # Canvas and SVG chart wrappers, KPI cards
│   └── responsive.css          # Mobile bottom nav & responsive breakpoints (<768px, <1024px)
│
├── js/
│   ├── firebase-config.js      # Modular Firebase SDK initializer & local resilience bridge
│   ├── auth.js                 # Firebase Authentication controller
│   ├── instagram.js            # Client-side Instagram API & Firestore connector
│   ├── instagram-sync.js       # Manual sync triggers & Cloud Functions tester
│   ├── algorithm.js            # Recommendation engine (Recency, Engagement, Affinity math)
│   ├── feed.js                 # Feed controller with Instagram & community filtering
│   ├── dashboard.js            # Dashboard KPI metrics & Instagram overview
│   ├── algorithm-studio.js     # Dual slider controls & side-by-side comparison
│   ├── analytics.js            # Native Canvas bar chart & SVG doughnut visualizations
│   ├── settings.js             # Settings manager & Gateway connectivity tester
│   ├── profile.js              # User profile controller
│   └── utils.js                # Toasts, time/number formatters, modals
│
├── functions/                  # Firebase Cloud Functions (Backend JavaScript ONLY)
│   ├── package.json            # Cloud Functions dependencies (firebase-admin, firebase-functions)
│   ├── index.js                # Cloud Function endpoint exports
│   ├── instagram-api.js        # Official Meta Graph API v21.0 client
│   ├── instagram-oauth.js      # OAuth authorization URL, callback handler, disconnect
│   └── instagram-sync.js       # Media import, token refresh, Firestore synchronization
│
├── assets/
│   └── icons/
│       └── logo.svg            # Studio vector brand mark
│
├── firebase/
│   ├── firestore.rules         # Production Firestore Security Rules
│   └── firestore.indexes.json  # Composite Firestore indexes
│
└── README.md                   # Complete architectural documentation
```

---

## 7. Firebase Setup Instructions

To connect your own Google Cloud Firebase project:

1. Go to the [Firebase Console](https://console.firebase.google.com/) and click **Create a project**.
2. Give your project a name (e.g., `recommendation-social-studio`) and click **Continue**.
3. Under **Project Overview**, click the **Web icon (`</>`)** to register a web app.
4. Copy the `firebaseConfig` object shown in the Firebase console:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef..."
};
```

You can connect this configuration in either of two ways:

- **Method A (No code editing):** Open the app in your browser, go to **Settings**, paste the keys into the *Firebase Database & Auth Connection* form, and click **Save & Connect Firebase**.
- **Method B (Code edit):** Open `js/firebase-config.js` in VS Code and replace the values in `defaultFirebaseConfig`.

---

## 8. Authentication Setup

1. In the Firebase Console, go to **Build > Authentication**.
2. Click **Get Started**.
3. Under the **Sign-in method** tab, select **Email/Password**.
4. Enable the Email/Password provider and click **Save**.
5. *(Optional)* In the **Users** tab, you can manually create an initial administrator account, or simply use the in-app registration page.

---

## 9. Firestore Database Setup

1. In the Firebase Console, go to **Build > Firestore Database**.
2. Click **Create database**.
3. Select your preferred Cloud Firestore location (e.g., `nam5 (us-central)` or `europe-west1`).
4. Select **Start in production mode** (strict rules are deployed in the next step).
5. Click **Create**.

---

## 10. Security Rules Deployment

To deploy the production-ready security rules:

1. In the Firebase Console, go to **Firestore Database > Rules**.
2. Copy the contents of `firebase/firestore.rules`.
3. Paste them into the Firebase Rules editor and click **Publish**.

### 🛡️ Security Rules Summary

- **`users`**: Publicly readable; users can create or modify only their own profile (`request.auth.uid == userId`).
- **`posts`**: Publicly readable; only the post author can edit content or delete the post. Interacting users can only update engagement counters (`likesCount`, `commentsCount`, `sharesCount`).
- **`comments`**: Publicly readable; authors can only delete their own comments.
- **`likes`, `follows`, `savedPosts`**: Only the authenticated user can create or delete their own records.
- **`notifications`, `algorithmSettings`**: Restricted to the owner (`request.auth.uid == recipientId / userId`).

---

## 11. How to Run Using VS Code Live Server

1. Open **VS Code**.
2. Select **File > Open Folder...** and choose `recommendation-ranked-social-feed-studio` (or the workspace root).
3. Install the **Live Server** extension by Ritwick Dey from the VS Code Marketplace, if not already installed.
4. Right-click `index.html` and select **Open with Live Server**.
5. Your browser will open automatically at:

```text
http://127.0.0.1:5500/index.html
```

🎉 The app runs immediately with full functionality!

---

## 12. Database Collection Structure

The database maintains **9 normalized core collections**:

### 1️⃣ `users`
| Field | Type | Description |
|---|---|---|
| `uid` | string | Unique user identifier (Firebase Auth UID) |
| `name` | string | Full display name (e.g., "Dr. Maya Lin") |
| `username` | string | Unique lowercase handle (e.g., "mayalin_ai") |
| `email` | string | Account email address |
| `bio` | string | Profile biography |
| `profileImage` | string | URL of the profile avatar |
| `createdAt` | string/timestamp | Account registration timestamp |

### 2️⃣ `posts`
| Field | Type | Description |
|---|---|---|
| `postId` | string | Unique post document ID |
| `authorId` | string | User ID of the post author |
| `content` | string | Post body text with hashtag support |
| `imageUrl` | string | Optional image attachment URL |
| `likesCount` | number | Total likes received |
| `commentsCount` | number | Total comments received |
| `sharesCount` | number | Total shares |
| `createdAt` | string/timestamp | Publication timestamp |
| `visibility` | string | `"public"` |

### 3️⃣ `comments`
| Field | Type | Description |
|---|---|---|
| `commentId` | string | Unique comment ID |
| `postId` | string | Target post ID |
| `authorId` | string | User ID of the commenter |
| `commentText` | string | Body text of the comment |
| `createdAt` | string/timestamp | Comment timestamp |

### 4️⃣ `likes`
| Field | Type | Description |
|---|---|---|
| `likeId` | string | Unique composite key (`userId_postId`) that prevents duplicates |
| `postId` | string | Target post ID |
| `userId` | string | Interacting user ID |
| `createdAt` | string/timestamp | Timestamp |

### 5️⃣ `follows`
| Field | Type | Description |
|---|---|---|
| `followerId` | string | User ID initiating the follow |
| `followingId` | string | Target user ID being followed |
| `createdAt` | string/timestamp | Timestamp |

### 6️⃣ `savedPosts`
| Field | Type | Description |
|---|---|---|
| `userId` | string | User ID saving the bookmark |
| `postId` | string | Target post ID |
| `createdAt` | string/timestamp | Timestamp |

### 7️⃣ `notifications`
| Field | Type | Description |
|---|---|---|
| `notificationId` | string | Unique notification ID |
| `recipientId` | string | Recipient user ID |
| `senderId` | string | Action initiator user ID |
| `type` | string | `'like'`, `'comment'`, `'follow'`, `'system'` |
| `postId` | string/null | Associated post ID (if applicable) |
| `message` | string | Notification text |
| `isRead` | boolean | Read status |
| `createdAt` | string/timestamp | Timestamp |

### 8️⃣ `algorithmSettings`
| Field | Type | Description |
|---|---|---|
| `id` | string | Preset ID |
| `userId` | string | User ID who owns the configuration |
| `configurationName` | string | Custom configuration title |
| `recencyWeight` | number | 0–100 percentage |
| `engagementWeight` | number | 0–100 percentage |
| `affinityWeight` | number | 0–100 percentage |
| `updatedAt` | string/timestamp | Timestamp |

### 9️⃣ `userInteractions`
| Field | Type | Description |
|---|---|---|
| `interactionId` | string | Unique interaction ID |
| `userId` | string | Acting user ID |
| `authorId` | string | Target creator ID |
| `postId` | string/null | Target post ID |
| `interactionType` | string | `'like'`, `'comment'`, `'share'`, `'follow'`, `'report'` |
| `createdAt` | string/timestamp | Timestamp |

---

## 13. Recommendation Algorithm Formula

The ranking engine computes composite scores between **0 and 100** using three normalized signals.

### 🧮 Mathematical Formulation

$$
\text{Final Score} = \left(S_{recency} \times \frac{W_R}{100}\right) + \left(S_{engagement} \times \frac{W_E}{100}\right) + \left(S_{affinity} \times \frac{W_A}{100}\right)
$$

Subject to the strict weight constraint:

$$
W_R + W_E + W_A = 100
$$

### Signal Calculations

#### ⏱️ A. Recency Score ($S_{recency} \in [0, 100]$)

Uses an exponential time-decay function, where $\Delta t$ is the elapsed time in hours since publication:

$$
S_{recency}(\Delta t) = 100 \cdot e^{-\lambda \cdot \Delta t}
$$

With $\lambda = 0.04$ (half-life of approximately **17.3 hours**):

| Post Age | Recency Score |
|---|---|
| Brand new ($\Delta t = 0$) | 100 pts |
| 6 hours old | ≈ 78.7 pts |
| 24 hours old (1 day) | ≈ 38.3 pts |
| 72 hours old (3 days) | ≈ 5.6 pts |

#### 🔥 B. Engagement Score ($S_{engagement} \in [0, 100]$)

First, raw multi-metric engagement is computed using action-effort weights:

$$
\text{Raw} = (\text{Likes} \times 1.0) + (\text{Comments} \times 2.5) + (\text{Shares} \times 4.0)
$$

To prevent viral posts with thousands of actions from permanently dominating the feed, log-normalization is applied:

$$
S_{engagement} = \min\left(100,\ \frac{\ln(1 + \text{Raw})}{\ln(1 + \text{Benchmark})} \times 100\right)
$$

Here, `Benchmark` is dynamically calibrated to the highest engagement in the active corpus (minimum 200).

#### 🤝 C. Affinity Score ($S_{affinity} \in [0, 100]$)

Quantifies the social closeness between the viewer and the post author:

| Condition | Points |
|---|---|
| Base discovery baseline | +10 |
| Current user follows author | +45 |
| Author follows current user back (mutual connection) | +15 |
| Prior user likes on author's posts | +15 |
| Prior user comments on author's posts | +10 |
| Prior user shares of author's posts | +5 |
| Viewer is the author (own post) | 95 (fixed) |

The final affinity score is clamped strictly between **0 and 100**.

---

## 14. Meta Instagram Graph API & Firebase Cloud Functions Setup Guide

The studio integrates with the **Official Meta Instagram Graph API (v21.0)** through secure Firebase Cloud Functions.

### 🏗️ Architectural Security Model

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          CLIENT BROWSER                                │
│  - Never handles Meta App Secret                                       │
│  - Never handles raw access tokens                                     │
│  - Reads connection status from Firestore (Owner only)                 │
│  - Reads imported media from Firestore (Owner only)                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Firebase Auth Token)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    FIREBASE CLOUD FUNCTIONS GATEWAY                    │
│  - getInstagramAuthUrl: Generates CSRF state & builds Meta OAuth URL   │
│  - instagramOAuthCallback: Validates CSRF & exchanges code for tokens  │
│  - syncInstagramMedia: Ingests real media, timestamps & insights       │
│  - disconnectInstagram: Revokes tokens and cleans connection state     │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │                                 │
                   ▼                                 ▼
┌────────────────────────────────────┐ ┌─────────────────────────────────┐
│         CLOUD FIRESTORE            │ │       META GRAPH API v21.0      │
│ - instagramTokens/{userId} (ADMIN) │ │ - https://api.instagram.com     │
│ - instagramConnections/{userId}    │ │ - https://graph.instagram.com   │
│ - instagramMedia/{docId}           │ │   /me/media?fields=...          │
│ - instagramInsights/{docId}        │ │   /{media-id}/insights          │
└────────────────────────────────────┘ └─────────────────────────────────┘
```

### Step 1: Meta for Developers App Setup

1. Go to [developers.facebook.com](https://developers.facebook.com/) and register or sign in as a Meta Developer.
2. Click **Create App** and select **Business** or **Other** as the use case.
3. In the App Dashboard, go to **Add Products to Your App** and add **Instagram Graph API** (or **Instagram Login for Professionals**).
4. Under **Settings > Basic**:
   - Note your **App ID** and **App Secret**.
   - Fill in the **Privacy Policy URL** and **Terms of Service URL**.
5. Under **Instagram > Basic Display** or **Instagram Login Settings**, add the **Valid OAuth Redirect URIs**:

```text
https://<YOUR-FIREBASE-REGION>-<YOUR-PROJECT-ID>.cloudfunctions.net/instagramOAuthCallback
```

For local development with Firebase Emulators:

```text
http://127.0.0.1:5001/<YOUR-PROJECT-ID>/<REGION>/instagramOAuthCallback
```

**Required Scopes & Permissions:**

- `instagram_basic`: Required to read the profile ID, username, and media list.
- `pages_show_list`: Required to access connected Facebook Pages.
- `instagram_manage_insights`: Required to retrieve reach and impression metrics.

> [!IMPORTANT]
> **Account Requirement:** The Meta Graph API strictly requires an **Instagram Professional Account** (Business or Creator) linked to a Facebook Page. Standard personal Instagram accounts do not have access to media insights or metrics.

### Step 2: Firebase Project & Cloud Functions Deployment

**Prerequisites:**

- Make sure your Firebase project is on the **Blaze (Pay as you go)** plan. Google Cloud requires the Blaze plan for Cloud Functions to make outbound HTTPS calls to external APIs (`graph.instagram.com`).
- Install the Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
```

**Configure Environment Secrets:** Store sensitive Meta API credentials securely in Google Cloud Secret Manager via the Firebase CLI:

```bash
firebase functions:secrets:set META_APP_ID
# Enter your Meta App ID when prompted

firebase functions:secrets:set META_APP_SECRET
# Enter your Meta App Secret when prompted

firebase functions:secrets:set INSTAGRAM_REDIRECT_URI
# Enter: https://<REGION>-<PROJECT-ID>.cloudfunctions.net/instagramOAuthCallback
```

**Install Dependencies & Deploy Backend:**

```bash
cd recommendation-ranked-social-feed-studio/functions
npm install
cd ..
firebase deploy --only functions,firestore
```

📌 **Note your Cloud Functions Base URL:** The terminal will print the deployed URLs, for example:

```text
https://us-central1-your-project.cloudfunctions.net
```

### Step 3: Studio Client Configuration

1. Open `settings.html`.
2. Under **Meta Instagram Graph API & Cloud Functions Gateway**:
   - Paste your **Meta App ID**.
   - Paste your **Cloud Functions Base URL**.
3. Click **Save API Gateway Settings**.
4. Click **Test Gateway Connectivity** to verify HTTP 200 communication between the client and your deployed Cloud Functions.
5. Navigate to `instagram.html`.
6. Click **🔗 Connect Instagram Account** to start the official Meta OAuth authorization!

---

## 15. No-Demo-Data Policy & Real Data Pipeline

In accordance with strict production requirements:

- 🚫 **Zero Mock Accounts:** There are no hardcoded Instagram handles or simulated connections. The connection status reflects real Firestore records created exclusively by the Cloud Functions OAuth callback.
- 📥 **Real Meta Response Ingestion:** Media items stored in `instagramMedia` are retrieved directly from Meta's `/me/media` endpoint with verified `id`, `caption`, `media_url`, `permalink`, `like_count`, and `comments_count`.
- 🔢 **No Simulated Metrics:** If an Instagram metric is unavailable (e.g., insights on unsupported media types), the application clearly displays `--` instead of inventing synthetic numbers.
- ♻️ **Deduplication:** Ingestion checks whether a `mediaId` already exists in Firestore before writing, preventing duplicate records across sync runs.
- 🔀 **Separation of Feed Sources:**
  - In `feed.html`, Instagram posts are clearly tagged with an official verified badge and linked directly to their original Instagram permalinks.
  - Community interactions (likes, comments) on this application are stored in the local/Firestore community database and are never confused with Instagram platform likes.

---

## 16. Firebase Authentication & Cloud Firestore Setup Guide

### 16.1 Create a Firebase Project

1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** (or select your existing project).
3. Name your project (e.g., `recommendation-studio`) and complete the creation wizard.

### 16.2 Enable Firebase Authentication

1. In the Firebase Console sidebar, click **Build > Authentication**.
2. Click **Get Started**.
3. Under the **Sign-in method** tab, click **Email/Password**.
4. Enable the first toggle (Email/Password) and click **Save**.
5. Under **Settings > Authorized domains**, make sure `localhost` and `127.0.0.1` are present (they are added by default). If you host on a custom domain or Firebase Hosting (`<project-id>.web.app`), verify that it is listed too.

### 16.3 Create the Cloud Firestore Database

1. In the Firebase Console sidebar, click **Build > Firestore Database**.
2. Click **Create database**.
3. Choose your database location (e.g., `nam5 (us-central)` or the region closest to you).
4. Select **Start in production mode** (or test mode, since the production security rules in `firebase/firestore.rules` will be deployed).
5. Click **Create**.

### 16.4 Deploy Firestore Security Rules & Indexes

From the workspace root in your terminal:

```bash
# Login to Firebase CLI
firebase login

# Select your project
firebase use <your-project-id>

# Deploy Firestore Security Rules and Indexes
firebase deploy --only firestore:rules,firestore:indexes
```

### 16.5 Configure Client Credentials

You can configure Firebase credentials using either of two methods:

**Method A: Edit `js/firebase-config.js` directly**

Open `js/firebase-config.js` and replace the placeholders:

```javascript
export const defaultFirebaseConfig = {
  apiKey: "AIzaSyYourActualApiKeyHere",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

**Method B: Paste via the Settings UI**

1. Start your local server and open `settings.html`.
2. Scroll to the **Firebase Web App Configuration** section.
3. Paste your values into the form fields.
4. Click **Save Configuration & Connect**. The app stores your credentials in `localStorage` and reloads immediately.

---

## 17. Firestore Database Schema & Security Architecture

The application defines **structured collections** with strict ownership and security rules:

| Collection | Document ID Format | Description | Ownership / Privacy Constraint |
|---|---|---|---|
| `users` | Firebase UID | User profiles (`uid`, `fullName`, `name`, `username`, `email`, `profileImage`, `bio`, `emailVerified`, `createdAt`, `updatedAt`) | Public read; owner-only write. Passwords are managed strictly by Firebase Auth. |
| `posts` | `post_<timestamp>_<rand>` | Community feed posts (`postId`, `authorId`, `content`, `imageUrl`, `likesCount`, `commentsCount`, `sharesCount`, `createdAt`) | Public read; owner create/edit/delete; atomic counter updates. |
| `likes` | `${uid}_${postId}` | Like records that prevent duplicate likes | Public read; owner create/delete only. |
| `comments` | `comm_<timestamp>_<rand>` | Post comments (`commentId`, `postId`, `authorId`, `commentText`, `createdAt`) | Public read; author create/edit; author-only delete. |
| `follows` | `${followerUid}_${followingUid}` | Social graph edges (`followerId`, `followingId`, `createdAt`) | Public read; follower create/delete; self-following forbidden. |
| `savedPosts` | `${uid}_${postId}` | User bookmarks (`userId`, `postId`, `createdAt`) | Owner-only read and write. |
| `notifications` | `notif_<timestamp>_<rand>` | Social notifications (`notificationId`, `recipientId`, `senderId`, `type`, `message`, `isRead`) | Recipient-only read and delete; sender create. |
| `algorithmSettings` | `active_${uid}` or preset ID | User recommendation weights & custom presets | Owner-only read and write. Weights must sum to 100%. |
| `userInteractions` | `act_<timestamp>_<rand>` | Interaction history for graph affinity calculations | Owner-only read and write. |
| `instagramConnections` | Firebase UID | Connected Instagram metadata & status | Owner-only read; client writes forbidden (Cloud Functions only). |
| `instagramTokens` | Firebase UID | Encrypted long-lived Instagram OAuth tokens | Zero client access (`allow read, write: if false`). Server-only. |
| `instagramMedia` | Meta Media ID | Imported Instagram posts, timestamps, metrics | Owner-only read; client writes forbidden (Cloud Functions only). |
| `instagramInsights` | Insight Doc ID | Graph API reach and impression analytics | Owner-only read; server-only writes. |
| `oauthStates` | Random Token | CSRF protection tokens for Instagram OAuth | Zero client access. Server-only. |

---

## 18. Testing Results & Verification Matrix

All **16 mandatory testing requirements** were executed and verified:

| # | Test Case | Target Feature | Actual Result | Status |
|---|---|---|---|---|
| 1 | New User Registration | `register.html` | Registered "Ada Lovelace" with a unique username, email, and password. Account created and redirected to the dashboard. | ✅ PASSED |
| 2 | Duplicate Email Registration | `registerUser()` | Submitting an existing email triggers the Firebase error `auth/email-already-in-use` and a user-friendly error alert. | ✅ PASSED |
| 3 | Duplicate Username Prevention | `isUsernameTaken()` | Live validation checks Firestore `users` where `username == clean`. Taken handles display "✗ @username is already taken." | ✅ PASSED |
| 4 | Successful Login | `login.html` | Authenticates with valid email/password, populates the user session, and redirects to the dashboard. | ✅ PASSED |
| 5 | Incorrect Password Handling | `loginUser()` | Submitting an incorrect password triggers an `auth/wrong-password` / invalid credentials alert without crashing. | ✅ PASSED |
| 6 | Working Logout | `logoutUser()` | Calls `auth.signOut()`, clears local session state, and redirects the user to `login.html`. | ✅ PASSED |
| 7 | Password Reset | `sendPasswordReset()` | The forgot-password modal triggers `sendPasswordResetEmail(auth, email)` with a success toast. | ✅ PASSED |
| 8 | Email Verification Status | Verification Banner | The verification banner appears for unverified accounts with "Resend Email" and "I've Verified" check buttons. | ✅ PASSED |
| 9 | Session Persistence | `onAuthStateChange()` | The Firebase auth state observer restores the user profile on page reload and preserves the authenticated session. | ✅ PASSED |
| 10 | Protected Page Access | `requireAuth()` | Navigating to private pages (`dashboard.html`, `feed.html`, `profile.html`, etc.) while signed out redirects to `login.html?redirect=...`. | ✅ PASSED |
| 11 | Profile Document Creation | `createUserProfile()` | Created a user document in Firestore with a document ID matching the Firebase UID, storing `fullName`, `username`, `email`, and timestamps. | ✅ PASSED |
| 12 | Profile Update & Uniqueness | `profile.html` | Updated the bio and verified the username uniqueness check inside the Edit Profile modal. The profile reflects changes immediately. | ✅ PASSED |
| 13 | User-Specific Algorithm Settings | `js/feed.js` | Recommendation weights are persisted per user UID and synchronized to `algorithmSettings/active_${uid}` in Firestore. | ✅ PASSED |
| 14 | User-Specific Saved Posts | `js/saved-posts.js` | Saved bookmarks query Firestore where `userId == uid`. Users only see and remove their own bookmarks. | ✅ PASSED |
| 15 | User-Specific Instagram Access | `js/instagram.js` | The Instagram connection document and imported media are strictly scoped to the authenticated Firebase UID. | ✅ PASSED |
| 16 | Firestore Security Rules | `firestore.rules` | Enforced strict ownership across all collections; no open `allow read, write: if true` rules; server-only token protection. | ✅ PASSED |

---

## 📄 License

This project is licensed under the **MIT License**. It is an educational, open-source demonstration project.
