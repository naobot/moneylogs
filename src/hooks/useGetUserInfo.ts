import { collection, where, query } from "firebase/firestore"
import { useFirebaseCollection } from './useFirebase'
// @ts-ignore
import { db } from '../config/firebase-config'
import { useMemo } from "react";

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

  // Aggregate results from all chunks
  const aggregatedData = useMemo(() => {
    return queryResults.reduce((allUsers, result, index) => {
      if (result.data && index < chunks.length && chunks[index]?.length > 0) {
        return [...allUsers, ...result.data]
      }
      return allUsers
    }, [] as UserData[])
  }, [queryResults.map(r => r.data).join(','), chunks.length])

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
    error: errors.length > 0 ? errors[0] : null, // Return first error for simplicity
    errors // Optionally return all errors
  }
}