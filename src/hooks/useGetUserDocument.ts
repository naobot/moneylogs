import { doc, onSnapshot } from "firebase/firestore"
import { useEffect, useState } from "react"
// @ts-ignore
import { db } from '@/config/firebase-config'
import { getUserDocRef } from "./useFirebase"

interface UserDocument {
  id: string
  displayName?: string
  viewTracking?: {
    [logGroupId: string]: {
      [userId: string]: {
        lastViewedAt: any // Firebase Timestamp
      }
    }
  }
  lastUpdated?: {
    [logGroupId: string]: any // Firebase Timestamp
  }
  // Add other user document fields as needed
}

interface UseGetUserDocumentResult {
  data: UserDocument | null
  isLoading: boolean
  error: string | null
}

export const useGetUserDocument = (userId: string | undefined): UseGetUserDocumentResult => {
  const [data, setData] = useState<UserDocument | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) {
      setData(null)
      setIsLoading(false)
      return
    }

    const fetchUserDocument = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Get the actual document reference using your existing helper
        const { userDocRef } = await getUserDocRef(userId)

        // Set up real-time listener
        const unsubscribe = onSnapshot(
          userDocRef,
          (docSnapshot) => {
            if (docSnapshot.exists()) {
              setData({
                id: docSnapshot.id,
                ...docSnapshot.data()
              } as UserDocument)
            } else {
              setData(null)
              setError('User document not found')
            }
            setIsLoading(false)
          },
          (err) => {
            console.error('Error fetching user document:', err)
            setError(err.message)
            setIsLoading(false)
          }
        )

        // Return cleanup function
        return unsubscribe
      } catch (err) {
        console.error('Error setting up user document listener:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        setIsLoading(false)
      }
    }

    const unsubscribePromise = fetchUserDocument()

    // Cleanup function
    return () => {
      unsubscribePromise.then(unsubscribe => {
        if (unsubscribe) unsubscribe()
      })
    }
  }, [userId])

  return { data, isLoading, error }
}