import { useEffect, useState } from "react"
import { collection, limit, orderBy, query } from "firebase/firestore"
import { Comment } from "@/types/user"
import { commentCacheEvents } from '@/utils/commentCacheEvents'
// @ts-ignore
import { db } from '@/config/firebase-config'
import { useFirebaseCollection } from "./useFirebase"

// Simple in-memory cache for comments
export const commentCache = new Map<string, {
  data: Comment[],
  timestamp: number,
  isLoading: boolean,
  isSuccess: boolean,
  isError: boolean,
  error?: any
}>()

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000

// Function to invalidate cache for a specific post
export const invalidateCommentCache = (logPostId: string) => {
  console.log(`🗑️ invalidating comment cache for post ${logPostId}`)
  commentCache.delete(logPostId)
  // Emit event to notify any active listeners
  commentCacheEvents.emit(logPostId)
}

// Function to clear all comment cache (useful for cleanup)
export const clearCommentCache = () => {
  console.log('🗑️ clearing all comment cache')
  commentCache.clear()
}

export const useGetComments = ({ logPostId }: { logPostId: string | null }) => {
  const [cacheState, setCacheState] = useState({
    data: [] as Comment[],
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: undefined as any
  })

  // Force refresh state - increment this to force a re-fetch
  const [forceRefresh, setForceRefresh] = useState(0)

  // Subscribe to cache invalidation events
  useEffect(() => {
    if (!logPostId) return

    console.log(`🎧 subscribing to cache invalidation events for post ${logPostId}`)

    const unsubscribe = commentCacheEvents.subscribe(logPostId, () => {
      console.log(`📨 received cache invalidation event for post ${logPostId}, forcing refresh`)
      setForceRefresh(prev => prev + 1)
    })

    return () => {
      console.log(`🔌 unsubscribing from cache invalidation events for post ${logPostId}`)
      unsubscribe()
    }
  }, [logPostId])

  // Check if we should use cache
  const shouldUseCache = (logPostId: string) => {
    const cached = commentCache.get(logPostId)
    if (!cached) return false

    const isExpired = Date.now() - cached.timestamp > CACHE_DURATION
    if (isExpired) {
      commentCache.delete(logPostId)
      return false
    }

    return true
  }

  // Firebase query using your existing useFirebaseCollection hook
  const firebaseQuery = useFirebaseCollection<Comment>({
    queryBuilder: () => {
      if (!logPostId || (shouldUseCache(logPostId) && forceRefresh === 0)) return null

      console.log('⬇️ executing read on log_posts comments collection for', logPostId, 'forceRefresh:', forceRefresh)
      return query(
        collection(db, 'log_posts', logPostId, 'comments'),
        orderBy('createdAt', 'asc'),
        limit(60),
      )
    },
    dataTransformer: (docs) => docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Comment[],
    dependencies: [logPostId, forceRefresh], // forceRefresh will trigger re-fetch
    enabled: !!logPostId && !shouldUseCache(logPostId)
  })

  useEffect(() => {
    if (!logPostId) {
      setCacheState({
        data: [],
        isLoading: false,
        isSuccess: false,
        isError: false,
        error: undefined
      })
      return
    }

    // Check cache first
    if (shouldUseCache(logPostId)) {
      const cached = commentCache.get(logPostId)!
      console.log(`💾 using cached comments for post ${logPostId}`)
      setCacheState(cached)
      return
    }

    // If no valid cache, use Firebase data
    setCacheState({
      data: firebaseQuery.data || [],
      isLoading: firebaseQuery.isLoading,
      isSuccess: firebaseQuery.isSuccess,
      isError: firebaseQuery.isError,
      error: firebaseQuery.error
    })

    // Cache the results when Firebase query succeeds
    if (firebaseQuery.isSuccess && firebaseQuery.data) {
      console.log(`💾 caching comments for post ${logPostId}`)
      commentCache.set(logPostId, {
        data: firebaseQuery.data,
        timestamp: Date.now(),
        isLoading: false,
        isSuccess: true,
        isError: false
      })
    }
  }, [logPostId, firebaseQuery.data, firebaseQuery.isLoading, firebaseQuery.isSuccess, firebaseQuery.isError, firebaseQuery.error, forceRefresh])

  // Return both the state and a manual refresh function
  return {
    ...cacheState,
    refreshComments: () => {
      console.log(`🔄 manually refreshing comments for post ${logPostId}`)
      invalidateCommentCache(logPostId)
      setForceRefresh(prev => prev + 1)
    }
  }
}