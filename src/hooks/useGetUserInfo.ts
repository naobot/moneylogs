import { useMemo, useState, useEffect, useRef } from "react"
import { collection, where, query, onSnapshot } from "firebase/firestore"
import { useFirebaseCollection } from './useFirebase'
// @ts-ignore
import { db } from '@/config/firebase-config'
import { Datetime } from "@/types/user"

export type MoneyLog = {
  id: number
}

export type UserData = {
  id: string
  createdAt: {
    seconds: number
    nanoseconds: number
  }
  displayName: string
  displayLocation?: string
  email: string
  logs: Array<MoneyLog>
  userId: string
  currentLogId: string
  timezone?: string
  pinnedPosts?: {
    [logGroupId: string]: {
      [pinnedPost: string]: string
    }
  }
  commentSubscriptions?: {
    [logPostId: string]: {
      [lastViewedAt: string]: Datetime
    }
  }
  hasUnreadComments?: {
    [groupId: string]: boolean
  }
  viewTracking?: {
    [key: string]: { // group ID
      [key: string]: { // log author ID
        lastViewedAt: {
          seconds: number
          nanoseconds: number
        }
      }
    }
  }
}

// Reuse interfaces from useGetGroupUsers
interface CacheableUserData {
  id: string
  createdAt: {
    seconds: number
    nanoseconds: number
  }
  displayName: string
  displayLocation?: string
  email: string
  logs: Array<MoneyLog>
  userId: string
  currentLogId: string
  timezone?: string
  pinnedPosts?: {
    [logGroupId: string]: {
      [pinnedPost: string]: string
    }
  }
}

// Cache utilities - longer cache for current user since it's accessed constantly
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour for current user profile
const getCacheKey = (userId: string) => `currentUser_${userId}`

const getCachedUser = (userId: string): CacheableUserData | null => {
  try {
    const cached = localStorage.getItem(getCacheKey(userId))
    if (!cached) return null

    const { data, timestamp } = JSON.parse(cached)
    const isExpired = Date.now() - timestamp > CACHE_DURATION

    if (isExpired) {
      localStorage.removeItem(getCacheKey(userId))
      return null
    }

    console.log('📱 Using cached current user profile')
    return data
  } catch {
    return null
  }
}

const setCachedUser = (userId: string, user: CacheableUserData) => {
  try {
    const cacheData = {
      data: user,
      timestamp: Date.now()
    }
    localStorage.setItem(getCacheKey(userId), JSON.stringify(cacheData))
    console.log('💾 Cached current user profile')
  } catch (error) {
    console.warn('Failed to cache user:', error)
  }
}

export const useGetUserInfo = (userId: string) => {
  const [user, setUser] = useState<UserData | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<any>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!userId) {
      setUser(undefined)
      setIsLoading(false)
      return
    }

    // Try to get cached user data first
    const cachedUser = getCachedUser(userId)
    if (cachedUser) {
      // Use cached data immediately for instant display
      setUser(cachedUser as UserData)
      setIsLoading(false)
    }

    // Set up real-time listener (always runs, even with cache)
    console.log('🔄 setting up real-time listener for current user')

    const userQuery = query(
      collection(db, 'users'),
      where('userId', '==', userId)
    )

    const unsubscribe = onSnapshot(
      userQuery,
      (snapshot) => {
        if (!snapshot.empty) {
          const userDoc = snapshot.docs[0]
          const userData = {
            id: userDoc.id,
            ...userDoc.data()
          } as UserData

          console.log('📡 received current user data from real-time listener')

          // Update state with fresh data
          setUser(userData)
          setIsLoading(false)
          setError(null)

          // Cache only the stable profile fields
          const cacheableData: CacheableUserData = {
            id: userData.id,
            createdAt: userData.createdAt,
            displayName: userData.displayName,
            displayLocation: userData.displayLocation,
            email: userData.email,
            logs: userData.logs,
            userId: userData.userId,
            currentLogId: userData.currentLogId,
            timezone: userData.timezone,
            pinnedPosts: userData.pinnedPosts,
            // Exclude: commentSubscriptions, hasUnreadComments, viewTracking
          }

          // Update cache with fresh stable data
          setCachedUser(userId, cacheableData)
        } else {
          setUser(undefined)
          setIsLoading(false)
          setError(new Error('User not found'))
        }
      },
      (err) => {
        setError(err)
        setIsLoading(false)
        console.error('❌ Error in current user real-time listener:', err)
      }
    )

    unsubscribeRef.current = unsubscribe

    // Cleanup function
    return () => {
      if (unsubscribeRef.current) {
        console.log('🔌 cleaning up current user real-time listener')
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
    }
  }, [userId])

  return {
    user,
    isLoading,
    isSuccess: !!user && !error,
    isError: !!error,
    error,
    logs: user?.logs,
    currentLogId: user?.currentLogId,
  }
}

// Keep useGetMultipleUsers unchanged since it's already optimized with chunking
export const useGetMultipleUsers = (documentIds: string[]) => {
  const chunks = useMemo(() => {
    if (!documentIds || documentIds.length === 0) return []
    return documentIds.reduce((acc, id, index) => {
      const chunkIndex = Math.floor(index / 10)
      if (!acc[chunkIndex]) acc[chunkIndex] = []
      acc[chunkIndex].push(id)
      return acc
    }, [] as string[][])
  }, [documentIds.join(',')])

  // Always call a fixed number of hooks (e.g., support up to 10 chunks = 100 users max)
  const MAX_CHUNKS = 10
  const queryResults = Array.from({ length: MAX_CHUNKS }, (_, index) =>
    useFirebaseCollection<UserData>({
      queryBuilder: () => {
        const chunk = chunks[index]
        if (!chunk || chunk.length === 0) return null
        console.log('⬇️ executing read on users collection (chunking)')
        return query(
          collection(db, 'users'),
          where('__name__', 'in', chunk)
        )
      },
      dataTransformer: (docs) => docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserData[],
      dependencies: [chunks[index]?.join(',') || ''],
      enabled: Boolean(chunks[index]?.length)
    })
  )

  // Aggregate results from all chunks with proper deduplication
  const aggregatedData = useMemo(() => {
    const allUsers: UserData[] = []
    const seenIds = new Set<string>()
    queryResults.forEach((result, index) => {
      if (result.data && index < chunks.length && chunks[index]?.length > 0) {
        result.data.forEach(user => {
          if (!seenIds.has(user.id)) {
            seenIds.add(user.id)
            allUsers.push(user)
          }
        })
      }
    })
    return allUsers
  }, [
    // Use a stable dependency based on the actual data IDs
    queryResults.map(r =>
      r.data?.map(user => user.id).sort().join(',') || ''
    ).join('|'),
    chunks.length
  ])

  // Aggregate loading/error states
  const isLoading = queryResults.some(result => result.isLoading)
  const isError = queryResults.some(result => result.isError)
  const isSuccess = queryResults.every(result => result.isSuccess)
  const errors = queryResults.filter(result => result.error).map(result => result.error)

  return {
    users: aggregatedData,
    isLoading,
    isSuccess,
    isError,
    error: errors.length > 0 ? errors[0] : null,
    errors
  }
}