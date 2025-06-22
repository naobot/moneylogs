import { commentCache } from "@/hooks/useGetLogPostComments"

type CacheEventListener = () => void

class CommentCacheEventEmitter {
  private listeners = new Map<string, Set<CacheEventListener>>()

  // Subscribe to cache invalidation events for a specific post
  subscribe(postId: string, listener: CacheEventListener): () => void {
    if (!this.listeners.has(postId)) {
      this.listeners.set(postId, new Set())
    }

    this.listeners.get(postId)!.add(listener)

    // Return unsubscribe function
    return () => {
      const postListeners = this.listeners.get(postId)
      if (postListeners) {
        postListeners.delete(listener)
        if (postListeners.size === 0) {
          this.listeners.delete(postId)
        }
      }
    }
  }

  // Emit cache invalidation event for a specific post
  emit(postId: string) {
    const postListeners = this.listeners.get(postId)
    if (postListeners) {
      console.log(`📢 emitting cache invalidation event for post ${postId} to ${postListeners.size} listeners`)
      postListeners.forEach(listener => listener())
    }
  }

  // Debug: see what's being listened to
  getActiveSubscriptions() {
    return Array.from(this.listeners.keys())
  }
}

// Create singleton instance
export const commentCacheEvents = new CommentCacheEventEmitter()

// Enhanced invalidation function that both clears cache AND emits events
export const invalidateCommentCacheWithEvent = (logPostId: string) => {
  console.log(`🗑️ invalidating comment cache for post ${logPostId} with event emission`)

  commentCache.delete(logPostId)

  // Emit event to notify active listeners
  commentCacheEvents.emit(logPostId)
}

// Keep the old function for backwards compatibility if needed
export const invalidateCommentCache = invalidateCommentCacheWithEvent