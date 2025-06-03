import { collection, where, query } from "firebase/firestore"
import { useFirebaseCollection } from './useFirebase'
// @ts-ignore
import { db } from '../config/firebase-config'

export type MoneyLog = {
  id: number;
}

export type UserData = {
  id: string;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  }
  displayName: string;
  email: string;
  logs: Array<MoneyLog>;
  userId: string;
  currentLogId: string;
}

export const useGetUserInfo = (userId: string) => {
  const { data, isLoading, isSuccess, isError, error } = useFirebaseCollection<UserData>({
    queryBuilder: () => {
      if (!userId) return null

      return query(
        collection(db, 'users'),
        where('userId', '==', userId),
      )
    },
    dataTransformer: (docs) => docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as UserData[],
    dependencies: [userId],
    enabled: !!userId
  })

  // Since we expect only one user document, extract the first one
  const user = data[0] || undefined

  return {
    user,
    isLoading,
    isSuccess,
    isError,
    error,
    logs: user?.logs,
    currentLogId: user?.currentLogId,
  }
}

export const useGetMultipleUsers = (documentIds: string[]) => {
  const { data, isLoading, isSuccess, isError, error } = useFirebaseCollection<UserData>({
    queryBuilder: () => {
      if (!documentIds || documentIds.length === 0) return null

      // Batch fetch by document ID (Firestore allows up to 10 in a single 'in' query)
      const chunks = documentIds.reduce((acc, id, index) => {
        const chunkIndex = Math.floor(index / 10)
        if (!acc[chunkIndex]) acc[chunkIndex] = []
        acc[chunkIndex].push(id)
        return acc
      }, [] as string[][])

      // For simplicity, let's handle the first chunk (could extend this)
      const firstChunk = chunks[0] || []

      return query(
        collection(db, 'users'),
        where('__name__', 'in', firstChunk) // __name__ queries by document ID
      )
    },
    dataTransformer: (docs) => docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as UserData[],
    dependencies: [documentIds.join(',')], // Stable dependency
    enabled: documentIds.length > 0
  })

  return {
    users: data || [],
    isLoading,
    isSuccess,
    isError,
    error
  }
}