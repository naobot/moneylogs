import { useEffect, useState, useCallback, useRef } from "react"
import { collection, query, orderBy, getDocs } from "firebase/firestore"
// @ts-ignore
import { db } from '@/config/firebase-config'

// Simple event emitter for browser
class SimpleEventEmitter {
  private events: { [key: string]: Function[] } = {}

  on(event: string, callback: Function) {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(callback)
  }

  off(event: string, callback: Function) {
    if (!this.events[event]) return
    this.events[event] = this.events[event].filter(cb => cb !== callback)
  }

  emit(event: string, ...args: any[]) {
    if (!this.events[event]) return
    this.events[event].forEach(callback => callback(...args))
  }
}

// Global event emitter for cache invalidation
const cacheInvalidationEmitter = new SimpleEventEmitter()

// Global comment cache with timestamp tracking
const commentCache = new Map<string, { data: any[], timestamp: number }>()

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000

// Function to invalidate cache for a specific post
export const invalidateCommentCache = (postId: string) => {
  console.log(`🗑️ invalidating comment cache for post ${postId}`)
  commentCache.delete(postId)
  // Emit event to notify all listeners
  cacheInvalidationEmitter.emit(`invalidate-${postId}`)
}

// Function to check if cache is still valid
const isCacheValid = (postId: string): boolean => {
  const cached = commentCache.get(postId)
  if (!cached) return false

  const now = Date.now()
  const isExpired = now - cached.timestamp > CACHE_DURATION

  if (isExpired) {
    console.log(`⏰ cache expired for post ${postId}`)
    commentCache.delete(postId)
    return false
  }

  return true
}

type UseGetCommentsParams = {
  logPostId?: string | null
  forceFresh?: boolean
}

export const useGetComments = ({ logPostId, forceFresh = false }: UseGetCommentsParams) => {
  const [state, setState] = useState({
    data: [] as any[],
    isLoading: false,
    isSuccess: false,
    error: null as any,
  })

  // Use ref to track the current postId to handle cleanup properly
  const currentPostIdRef = useRef<string | null>(null)

  // Track if we should skip cache for this specific instance
  const skipCacheRef = useRef(false)

  // Fetch comments from Firestore
  const fetchComments = useCallback(async (postId: string, bypassCache: boolean = false) => {
    try {
      // Check cache first (unless bypassing)
      if (!bypassCache && !skipCacheRef.current && isCacheValid(postId)) {
        const cached = commentCache.get(postId)
        if (cached) {
          console.log(`💾 using cached comments for post ${postId}`)
          setState({
            data: cached.data,
            isLoading: false,
            isSuccess: true,
            error: null,
          })
          return cached.data
        }
      }

      console.log(`⬇️ fetching fresh comments for post ${postId} (bypassCache: ${bypassCache})`)
      setState(prev => ({ ...prev, isLoading: true }))

      const commentsRef = collection(db, "log_posts", postId, "comments")
      const q = query(commentsRef, orderBy("createdAt", "asc"))
      const querySnapshot = await getDocs(q)

      const comments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      // Cache the results
      console.log(`💾 caching fresh comments for post ${postId} (${comments.length} comments)`)
      commentCache.set(postId, { data: comments, timestamp: Date.now() })

      // Only update state if this is still the current post
      if (currentPostIdRef.current === postId) {
        setState({
          data: comments,
          isLoading: false,
          isSuccess: true,
          error: null,
        })
      }

      return comments
    } catch (error) {
      console.error(`❌ error fetching comments for post ${postId}:`, error)
      if (currentPostIdRef.current === postId) {
        setState({
          data: [],
          isLoading: false,
          isSuccess: false,
          error,
        })
      }
      throw error
    }
  }, [])

  // Manual refresh function
  const refreshComments = useCallback(async (postId?: string) => {
    const targetPostId = postId || currentPostIdRef.current
    if (!targetPostId) return

    console.log(`🔄 manually refreshing comments for post ${targetPostId}`)
    invalidateCommentCache(targetPostId)
    skipCacheRef.current = true
    await fetchComments(targetPostId, true)
    skipCacheRef.current = false
  }, [fetchComments])

  // Main effect to handle comment loading and cache invalidation
  useEffect(() => {
    if (!logPostId) {
      setState({
        data: [],
        isLoading: false,
        isSuccess: false,
        error: null,
      })
      currentPostIdRef.current = null
      return
    }

    // Update current post ref
    currentPostIdRef.current = logPostId

    // If forceFresh is true, invalidate cache immediately
    if (forceFresh) {
      console.log(`🚨 forceFresh enabled for post ${logPostId}, invalidating cache`)
      invalidateCommentCache(logPostId)
      skipCacheRef.current = true
    }

    // Initial fetch
    fetchComments(logPostId, forceFresh).finally(() => {
      skipCacheRef.current = false
    })

    // Listen for cache invalidation events
    const handleInvalidation = () => {
      console.log(`📢 received cache invalidation event for post ${logPostId}`)
      if (currentPostIdRef.current === logPostId) {
        fetchComments(logPostId, true)
      }
    }

    console.log(`🎧 subscribing to cache invalidation events for post ${logPostId}`)
    cacheInvalidationEmitter.on(`invalidate-${logPostId}`, handleInvalidation)

    // Cleanup
    return () => {
      console.log(`🔌 unsubscribing from cache invalidation events for post ${logPostId}`)
      cacheInvalidationEmitter.off(`invalidate-${logPostId}`, handleInvalidation)
      currentPostIdRef.current = null
    }
  }, [logPostId, forceFresh, fetchComments])

  return {
    ...state,
    refreshComments,
  }
}