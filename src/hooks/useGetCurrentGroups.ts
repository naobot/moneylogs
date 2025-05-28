import { collection, where, query, Timestamp, doc } from "firebase/firestore"
import { AuthUser, Group } from "../types/user"
import { useFirebaseCollection } from "./useFirebase"
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

  const { data, isLoading, isSuccess, isError, error } = useFirebaseCollection<Group>({
    queryBuilder: () => {
      if (!currentUserId) return null

      return query(
        collection(db, 'log_groups'),
        where('start', '<=', Timestamp.now()),
        where('end', '>=', Timestamp.now()),
        where('members', 'array-contains', doc(db, 'users', currentUserId))
      )
    },
    dataTransformer: (docs) => docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Group[],
    dependencies: [currentUserId],
    enabled: !!currentUserId
  })

  return {
    currentGroups: data,
    isLoading,
    isSuccess,
    isError,
    error
  }
}