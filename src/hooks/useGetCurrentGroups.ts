import { collection, where, query, Timestamp, doc, getDocs } from "firebase/firestore"
import { AuthUser, Group } from "../types/user"
import { useFirebaseCollection } from "./useFirebase"
import { useEffect, useState } from "react"
// @ts-ignore
import { db } from '../config/firebase-config'

export type GroupsResponse = {
  currentGroups: Array<Group>
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  error?: any
}

export const useGetCurrentGroups = (): GroupsResponse => {
  const [userDocId, setUserDocId] = useState<string | null>(null)
  const [userIdFetchError, setUserIdFetchError] = useState<any>(null)

  // Get current user from localStorage within the hook
  const getCurrentUserId = (): string | null => {
    const authData = localStorage.getItem('auth')
    if (authData) {
      const user = JSON.parse(authData) as AuthUser
      return user.userId
    }
    return null
  }

  const currentUserId = getCurrentUserId()

  // Fetch the user's document ID from their userId
  useEffect(() => {
    const fetchUserDocId = async () => {
      if (!currentUserId) {
        setUserDocId(null)
        return
      }

      try {
        const usersQuery = query(
          collection(db, 'users'),
          where('userId', '==', currentUserId)
        )
        const snapshot = await getDocs(usersQuery)

        if (!snapshot.empty) {
          setUserDocId(snapshot.docs[0].id)
          setUserIdFetchError(null)
        } else {
          setUserDocId(null)
          setUserIdFetchError(new Error('User document not found'))
        }
      } catch (error) {
        setUserDocId(null)
        setUserIdFetchError(error)
      }
    }

    fetchUserDocId()
  }, [currentUserId])

  const { data, isLoading, isSuccess, isError, error } = useFirebaseCollection<Group>({
    queryBuilder: () => {
      if (!userDocId) return null

      return query(
        collection(db, 'log_groups'),
        where('start', '<=', Timestamp.now()),
        where('end', '>=', Timestamp.now()),
        where('members', 'array-contains', doc(db, 'users', userDocId))
      )
    },
    dataTransformer: (docs) => docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Group[],
    dependencies: [userDocId],
    enabled: !!userDocId
  })

  // Combine loading states and errors
  const combinedIsLoading = isLoading || (!userDocId && !userIdFetchError && !!currentUserId)
  const combinedIsError = isError || !!userIdFetchError
  const combinedError = error || userIdFetchError

  return {
    currentGroups: data || [],
    isLoading: combinedIsLoading,
    isSuccess: isSuccess && !!userDocId,
    isError: combinedIsError,
    error: combinedError
  }
}