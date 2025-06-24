import { useEffect, useMemo, useState } from "react"
import { collection, query, where, onSnapshot, getDoc, doc, DocumentSnapshot } from "firebase/firestore"
// @ts-ignore
import { db } from '@/config/firebase-config'

// type UseGetGroupUsersParams = {
//   userIds: string[] // Array of user document IDs
// }

interface CacheableUserData {
  id: string
  userId: string
  displayName: string
  email: string
  groups: string[]
  timezone?: string
  pinnedPosts?: {
    [logGroupId: string]: {
      [pinnedPost: string]: string
    }
  }
}

interface RealtimeUserData {
  viewTracking: Record<string, any>
  commentSubscriptions: Record<string, any>
  lastSeen?: Date
}

export interface FullUserData extends CacheableUserData, RealtimeUserData {}

const CACHE_DURATION = 15 * 60 * 1000 // 15 minutes
const getCacheKey = (groupId: string) => `groupUsers_${groupId}`

const getCachedUsers = (groupId: string): CacheableUserData[] | null => {
  try {
    const cached = localStorage.getItem(getCacheKey(groupId))
    if (!cached) return null

    const { data, timestamp } = JSON.parse(cached)
    const isExpired = Date.now() - timestamp > CACHE_DURATION

    if (isExpired) {
      localStorage.removeItem(getCacheKey(groupId))
      return null
    }

    console.log(`📱 Using cached user profiles for group ${groupId}`, data)
    return data
  } catch {
    return null
  }
}

const setCachedUsers = (groupId: string, users: CacheableUserData[]) => {
  try {
    const cacheData = {
      data: users,
      timestamp: Date.now()
    };
    localStorage.setItem(getCacheKey(groupId), JSON.stringify(cacheData))
    console.log(`💾 Cached user profiles for group ${groupId}`)
  } catch (error) {
    console.warn('Failed to cache users:', error)
  }
}

export const useGetGroupUsers = (groupId: string) => {
  const [users, setUsers] = useState<FullUserData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create user ID to doc ref mapping (for your view tracking)
  const userIdToDocRefMap = useMemo(() => {
    const map = new Map<string, string>()
    users.forEach(user => {
      map.set(user.userId || user.id, user.id) // Adjust based on your user object structure
    })
    return map
  }, [users])

  useEffect(() => {
    // console.log(`getGroupUsers for ${groupId}`)

    if (!groupId) return

    // Try to get cached user profiles first
    const cachedUsers = getCachedUsers(groupId)

    // console.log(`Found cached users for ${groupId}`, cachedUsers)

    if (cachedUsers) {
      // Use cached data immediately for instant display
      // (Real-time listener will update with fresh data)
      setUsers(cachedUsers as FullUserData[])
      setIsLoading(false)
    }

    // Set up real-time listener (always runs, even with cache)
    console.log('🔄 setting up real-time listeners for users')

    const setupUserListeners = async () => {
      try {
        // Get group members list first
        const groupDoc = await getDoc(doc(db, 'log_groups', groupId))
        const memberRefs = groupDoc.data()?.members || []

        // Chunk members into groups of 10 (Firestore 'in' query limit)
        const chunks = chunkArray(memberRefs, 10)
        const unsubscribeFns: (() => void)[] = []

        let allUsers: FullUserData[] = []
        let chunksReceived = 0

        chunks.forEach((chunk, chunkIndex) => {
          const chunkQuery = query(
            collection(db, 'users'),
            where('__name__', 'in', chunk)
          );

          const unsubscribe = onSnapshot(chunkQuery, (snapshot) => {
            const chunkUsers: FullUserData[] = []

            snapshot.forEach((doc: DocumentSnapshot) => {
              const userData = doc.data()
              if (userData) {
                chunkUsers.push({
                  id: doc.id,
                  ...userData
                } as FullUserData)
              }
            })

            console.log(`📡 received ${chunkUsers.length} users from query ${chunkIndex + 1}`)

            // Update the specific chunk in allUsers array
            const startIndex = chunkIndex * 10
            allUsers.splice(startIndex, 10, ...chunkUsers)

            chunksReceived++

            // Update state with current users
            setUsers([...allUsers])
            setIsLoading(false)

            // Cache only stable user profile data (not real-time fields)
            if (chunksReceived === chunks.length) {
              const cacheableData: CacheableUserData[] = chunkUsers.map(user => ({
                id: user.id,
                userId: user.userId,
                displayName: user.displayName,
                email: user.email,
                timezone: user.timezone,
                groups: user.groups,
                // Only include stable fields, exclude viewTracking, etc.
              }));

              // Update cache with fresh stable data
              setCachedUsers(groupId, cacheableData)
            }
          })

          unsubscribeFns.push(unsubscribe)
        })

        // Return cleanup function which will be cleanUpFn
        return () => {
          console.log('🔌 cleaning up real-time listeners on users collection')
          unsubscribeFns.forEach(fn => fn())
        }

      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch users')
        setIsLoading(false)
      }
    }

    let cleanup: (() => void) | undefined

    setupUserListeners().then((cleanUpFn) => {
      cleanup = cleanUpFn
    })

    return () => {
      if (cleanup) {
        cleanup()
      }
    }

  }, [groupId])

  return {
    users,
    userIdToDocRefMap,
    isLoading,
    error
  }
}

const chunkArray = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
};