import { useEffect, useState } from "react"
import { onSnapshot, Query, QueryDocumentSnapshot, runTransaction, Transaction } from "firebase/firestore"
import { FirebaseError } from "firebase/app"
// @ts-ignore
import { db } from '../config/firebase-config'

export type FirebaseQuery<T> = {
  data: T[]
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  error: FirebaseError | null
}

type MutationState = {
  isLoading: boolean
  isError: boolean
  error: any | null
}

export const useFirebaseCollection = <T>({
  queryBuilder,
  dataTransformer,
  dependencies = [],
  enabled = true
}: {
  queryBuilder: () => Query | null
  dataTransformer: (docs: QueryDocumentSnapshot[]) => T[]
  dependencies?: any[]
  enabled?: boolean
}) => {
  const [state, setState] = useState<FirebaseQuery<T>>({
    data: [] as T[],
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: null
  })

  useEffect(() => {
    if (!enabled) return

    const query = queryBuilder()
    if (!query) return

    setState(prev => ({ ...prev, isLoading: true }))

    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        const data = snapshot.empty
          ? []
          : dataTransformer(snapshot.docs)

        setState({
          data,
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: null
        })
      },
      (error) => {
        setState({
          data: [],
          isLoading: false,
          isSuccess: false,
          isError: true,
          error
        })
      }
    )

    return unsubscribe
  }, dependencies)

  return state
}

export const useFirebaseTransaction = () => {
  const executeTransaction = async <T>(
    operation: (transaction: Transaction) => Promise<T>,
    errorMessage: string
  ): Promise<T> => {
    try {
      return await runTransaction(db, operation)
    } catch (error) {
      console.error(`${errorMessage}:`, error)
      throw error
    }
  }

  return { executeTransaction }
}

export const useMutation = <TArgs, TResult>(
  mutationFn: (args: TArgs) => Promise<TResult>
) => {
  const [state, setState] = useState<MutationState>({
    isLoading: false,
    isError: false,
    error: null
  })

  const mutate = async (args: TArgs): Promise<TResult> => {
    setState({ isLoading: true, isError: false, error: null })
    try {
      const result = await mutationFn(args)
      setState({ isLoading: false, isError: false, error: null })
      return result
    } catch (error) {
      setState({ isLoading: false, isError: true, error })
      throw error
    }
  }

  return { mutate, ...state }
}