/**
 * Recommendation-Ranked Social Feed Studio
 * Social Interactions Module: Likes, Follows, Saves, Shares & Graph Tracking
 */

import { initFirebase } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";
import { 
  showToast, 
  generateId, 
  getLocalCollection, 
  saveLocalCollection 
} from "./utils.js";
import { createNotification } from "./notifications.js";

/**
 * Record an interaction in userInteractions for affinity calculations
 */
export async function recordInteraction({ userId, authorId, postId, interactionType }) {
  if (!userId || !authorId || userId === authorId) return;

  const interaction = {
    interactionId: generateId("act"),
    userId,
    authorId,
    postId: postId || null,
    interactionType, // 'like', 'comment', 'share', 'follow', 'view'
    createdAt: new Date().toISOString()
  };

  const { isLive, db, firebaseModules } = await initFirebase();

  if (isLive && db && firebaseModules) {
    try {
      const { doc, setDoc } = firebaseModules.firestoreModule;
      await setDoc(doc(db, "userInteractions", interaction.interactionId), interaction);
    } catch (e) {
      console.warn("Could not save interaction to live db:", e);
    }
  } else {
    const list = getLocalCollection("userInteractions");
    list.push(interaction);
    saveLocalCollection("userInteractions", list);
  }
}

/**
 * Check if current user has liked a post
 */
export async function hasUserLiked(postId) {
  const user = getCurrentUser();
  if (!user) return false;

  const { isLive, db, firebaseModules } = await initFirebase();
  if (isLive && db && firebaseModules) {
    try {
      const { collection, getDocs, query, where } = firebaseModules.firestoreModule;
      const q = query(
        collection(db, "likes"),
        where("postId", "==", postId),
        where("userId", "==", user.uid)
      );
      const snapshot = await getDocs(q);
      return !snapshot.empty;
    } catch (e) {
      // Fallback
    }
  }

  const likes = getLocalCollection("likes");
  return likes.some(l => l.postId === postId && l.userId === user.uid);
}

/**
 * Toggle Like / Unlike on a post
 */
export async function toggleLikePost(postId, postAuthorId) {
  const user = getCurrentUser();
  if (!user) throw new Error("Please log in to like posts.");

  const { isLive, db, firebaseModules } = await initFirebase();
  let alreadyLiked = false;
  let existingLikeDocId = null;

  if (isLive && db && firebaseModules) {
    try {
      const { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, increment, query, where } = firebaseModules.firestoreModule;
      
      const q = query(
        collection(db, "likes"),
        where("postId", "==", postId),
        where("userId", "==", user.uid)
      );
      const snapshot = await getDocs(q);
      alreadyLiked = !snapshot.empty;

      if (alreadyLiked) {
        existingLikeDocId = snapshot.docs[0].id;
        await deleteDoc(doc(db, "likes", existingLikeDocId));
        await updateDoc(doc(db, "posts", postId), { likesCount: increment(-1) });
      } else {
        const likeId = `${user.uid}_${postId}`;
        await setDoc(doc(db, "likes", likeId), {
          likeId,
          postId,
          userId: user.uid,
          createdAt: new Date().toISOString()
        });
        await updateDoc(doc(db, "posts", postId), { likesCount: increment(1) });

        // Record interaction & notify
        await recordInteraction({
          userId: user.uid,
          authorId: postAuthorId,
          postId,
          interactionType: "like"
        });

        if (postAuthorId && postAuthorId !== user.uid) {
          await createNotification({
            recipientId: postAuthorId,
            senderId: user.uid,
            type: "like",
            postId,
            message: `${user.name} liked your post.`
          });
        }
      }
    } catch (e) {
      console.warn("Live like toggle error, using local fallback:", e);
      alreadyLiked = toggleLocalLike(user.uid, postId, postAuthorId);
    }
  } else {
    alreadyLiked = toggleLocalLike(user.uid, postId, postAuthorId);
  }

  return !alreadyLiked; // Returns new liked state
}

function toggleLocalLike(userId, postId, postAuthorId) {
  const likes = getLocalCollection("likes");
  const idx = likes.findIndex(l => l.postId === postId && l.userId === userId);
  const posts = getLocalCollection("posts");
  const pIdx = posts.findIndex(p => p.postId === postId);

  if (idx !== -1) {
    // Unlike
    likes.splice(idx, 1);
    saveLocalCollection("likes", likes);
    if (pIdx !== -1 && posts[pIdx].likesCount > 0) {
      posts[pIdx].likesCount -= 1;
      saveLocalCollection("posts", posts);
    }
    return true; // was liked, now unliked
  } else {
    // Like
    likes.push({
      likeId: `like_${userId}_${postId}`,
      postId,
      userId,
      createdAt: new Date().toISOString()
    });
    saveLocalCollection("likes", likes);
    if (pIdx !== -1) {
      posts[pIdx].likesCount = (posts[pIdx].likesCount || 0) + 1;
      saveLocalCollection("posts", posts);
    }

    recordInteraction({ userId, authorId: postAuthorId, postId, interactionType: "like" });
    const user = getCurrentUser();
    if (postAuthorId && postAuthorId !== userId) {
      createNotification({
        recipientId: postAuthorId,
        senderId: userId,
        type: "like",
        postId,
        message: `${user?.name || 'Someone'} liked your post.`
      });
    }
    return false; // was not liked, now liked
  }
}

/**
 * Check if a post is saved by current user
 */
export async function isPostSaved(postId) {
  const user = getCurrentUser();
  if (!user) return false;

  const { isLive, db, firebaseModules } = await initFirebase();
  if (isLive && db && firebaseModules) {
    try {
      const { doc, getDoc } = firebaseModules.firestoreModule;
      const snap = await getDoc(doc(db, "savedPosts", `${user.uid}_${postId}`));
      return snap.exists();
    } catch (e) {
      // Fallback
    }
  }

  const saves = getLocalCollection("savedPosts");
  return saves.some(s => s.postId === postId && s.userId === user.uid);
}

/**
 * Toggle Save / Bookmark post
 */
export async function toggleSavePost(postId) {
  const user = getCurrentUser();
  if (!user) throw new Error("Please log in to save posts.");

  const { isLive, db, firebaseModules } = await initFirebase();
  const saveDocId = `${user.uid}_${postId}`;
  let currentlySaved = false;

  if (isLive && db && firebaseModules) {
    try {
      const { doc, getDoc, setDoc, deleteDoc } = firebaseModules.firestoreModule;
      const ref = doc(db, "savedPosts", saveDocId);
      const snap = await getDoc(ref);
      currentlySaved = snap.exists();

      if (currentlySaved) {
        await deleteDoc(ref);
        showToast("Post removed from saved bookmarks.", "info");
      } else {
        await setDoc(ref, {
          userId: user.uid,
          postId,
          createdAt: new Date().toISOString()
        });
        showToast("Post saved to your bookmarks!", "success");
      }
    } catch (e) {
      currentlySaved = toggleLocalSave(user.uid, postId);
    }
  } else {
    currentlySaved = toggleLocalSave(user.uid, postId);
  }

  return !currentlySaved;
}

function toggleLocalSave(userId, postId) {
  const saves = getLocalCollection("savedPosts");
  const idx = saves.findIndex(s => s.postId === postId && s.userId === userId);

  if (idx !== -1) {
    saves.splice(idx, 1);
    saveLocalCollection("savedPosts", saves);
    showToast("Post removed from saved bookmarks.", "info");
    return true;
  } else {
    saves.push({ userId, postId, createdAt: new Date().toISOString() });
    saveLocalCollection("savedPosts", saves);
    showToast("Post saved to your bookmarks!", "success");
    return false;
  }
}

/**
 * Check if current user is following target user
 */
export async function isFollowingUser(targetUserId) {
  const user = getCurrentUser();
  if (!user || user.uid === targetUserId) return false;

  const follows = getLocalCollection("follows");
  return follows.some(f => f.followerId === user.uid && f.followingId === targetUserId);
}

/**
 * Toggle Follow / Unfollow user
 */
export async function toggleFollowUser(targetUserId, targetUserName = "Creator") {
  const user = getCurrentUser();
  if (!user) throw new Error("Please log in to follow creators.");
  if (user.uid === targetUserId) throw new Error("You cannot follow yourself.");

  const { isLive, db, firebaseModules } = await initFirebase();
  const followDocId = `${user.uid}_${targetUserId}`;
  let currentlyFollowing = false;

  if (isLive && db && firebaseModules) {
    try {
      const { doc, getDoc, setDoc, deleteDoc } = firebaseModules.firestoreModule;
      const ref = doc(db, "follows", followDocId);
      const snap = await getDoc(ref);
      currentlyFollowing = snap.exists();

      if (currentlyFollowing) {
        await deleteDoc(ref);
        showToast(`Unfollowed @${targetUserName}.`, "info");
      } else {
        await setDoc(ref, {
          followerId: user.uid,
          followingId: targetUserId,
          createdAt: new Date().toISOString()
        });

        await recordInteraction({
          userId: user.uid,
          authorId: targetUserId,
          interactionType: "follow"
        });

        await createNotification({
          recipientId: targetUserId,
          senderId: user.uid,
          type: "follow",
          message: `${user.name} started following you.`
        });

        showToast(`Now following @${targetUserName}! Feed affinity updated.`, "success");
      }
    } catch (e) {
      currentlyFollowing = toggleLocalFollow(user.uid, targetUserId, targetUserName);
    }
  } else {
    currentlyFollowing = toggleLocalFollow(user.uid, targetUserId, targetUserName);
  }

  return !currentlyFollowing;
}

function toggleLocalFollow(userId, targetUserId, targetUserName) {
  const follows = getLocalCollection("follows");
  const idx = follows.findIndex(f => f.followerId === userId && f.followingId === targetUserId);

  if (idx !== -1) {
    follows.splice(idx, 1);
    saveLocalCollection("follows", follows);
    showToast(`Unfollowed @${targetUserName}.`, "info");
    return true;
  } else {
    follows.push({
      followerId: userId,
      followingId: targetUserId,
      createdAt: new Date().toISOString()
    });
    saveLocalCollection("follows", follows);

    recordInteraction({ userId, authorId: targetUserId, interactionType: "follow" });
    const user = getCurrentUser();
    createNotification({
      recipientId: targetUserId,
      senderId: userId,
      type: "follow",
      message: `${user?.name || 'Someone'} started following you.`
    });

    showToast(`Now following @${targetUserName}! Feed affinity updated.`, "success");
    return false;
  }
}

/**
 * Increment Share count
 */
export async function sharePost(postId, postAuthorId, postContent) {
  const user = getCurrentUser();

  // Copy URL or post summary to clipboard
  try {
    const shareUrl = `${window.location.origin}/feed.html#post-${postId}`;
    await navigator.clipboard.writeText(`${postContent}\n\nRead more on Recommendation Studio: ${shareUrl}`);
    showToast("Post text and link copied to clipboard!", "success");
  } catch (e) {
    showToast("Link ready to share!", "info");
  }

  // Increment shares
  const { isLive, db, firebaseModules } = await initFirebase();
  if (isLive && db && firebaseModules) {
    try {
      const { doc, updateDoc, increment } = firebaseModules.firestoreModule;
      await updateDoc(doc(db, "posts", postId), { sharesCount: increment(1) });
    } catch (e) {
      //
    }
  } else {
    const posts = getLocalCollection("posts");
    const idx = posts.findIndex(p => p.postId === postId);
    if (idx !== -1) {
      posts[idx].sharesCount = (posts[idx].sharesCount || 0) + 1;
      saveLocalCollection("posts", posts);
    }
  }

  if (user) {
    await recordInteraction({
      userId: user.uid,
      authorId: postAuthorId,
      postId,
      interactionType: "share"
    });
  }
}

/**
 * Build rich social graph context for the recommendation engine
 */
export async function getSocialContext(currentUserId) {
  if (!currentUserId) {
    return { followingIds: [], mutualFollowIds: [], authorInteractionCounts: {} };
  }

  const follows = getLocalCollection("follows");
  const interactions = getLocalCollection("userInteractions");

  // People the current user follows
  const followingIds = follows
    .filter(f => f.followerId === currentUserId)
    .map(f => f.followingId);

  // People who follow the current user
  const followerIds = follows
    .filter(f => f.followingId === currentUserId)
    .map(f => f.followerId);

  // Mutual follows
  const mutualFollowIds = followingIds.filter(id => followerIds.includes(id));

  // Count interaction frequencies per author
  const authorInteractionCounts = {};
  interactions
    .filter(act => act.userId === currentUserId && act.authorId)
    .forEach(act => {
      if (!authorInteractionCounts[act.authorId]) {
        authorInteractionCounts[act.authorId] = { likes: 0, comments: 0, shares: 0 };
      }
      if (act.interactionType === "like") authorInteractionCounts[act.authorId].likes += 1;
      if (act.interactionType === "comment") authorInteractionCounts[act.authorId].comments += 1;
      if (act.interactionType === "share") authorInteractionCounts[act.authorId].shares += 1;
    });

  return {
    followingIds,
    mutualFollowIds,
    authorInteractionCounts
  };
}
