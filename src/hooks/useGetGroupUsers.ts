import { useEffect, useState } from "react"
import { collection, query, where, onSnapshot, Unsubscribe, documentId, or } from "firebase/firestore"
// @ts-ignore
import { db } from '@/config/firebase-config'

type UseGetGroupUsersParams = {
  userIds: string[] // Array of user document IDs
}

export const useGetGroupUsers = ({ userIds }: UseGetGroupUsersParams) => {
  const [state, setState] = useState({
    users: [] as any[],
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: undefined as any,
  })

  useEffect(() => {
    if (!userIds || userIds.length === 0) {
      setState({
        users: [],
        isLoading: false,
        isSuccess: true,
        isError: false,
        error: undefined
      })
      return
    }

    setState(prev => ({ ...prev, isLoading: true }))

    // For groups up to 30 users, just make 3 simple queries (10 users each)
    const chunk1 = userIds.slice(0, 10)
    const chunk2 = userIds.slice(10, 20)
    const chunk3 = userIds.slice(20, 30)

    const unsubscribeFunctions: Unsubscribe[] = []
    // Use an object to track users by chunk index - persists across listener fires
    const usersByChunk: { [key: number]: any[] } = {}
    const activeChunks = [chunk1, chunk2, chunk3].filter(chunk => chunk.length > 0)
    const totalQueries = activeChunks.length

    console.log(`🔄 setting up ${totalQueries} real-time listeners for ${userIds.length} users`)

    const handleQueryResult = (chunkUsers: any[], chunkIndex: number) => {
      console.log(`📡 received ${chunkUsers.length} users from query ${chunkIndex + 1}`)

      // Update this chunk's users
      usersByChunk[chunkIndex] = chunkUsers

      // Check if we have all chunks
      const completedChunks = Object.keys(usersByChunk).length
      if (completedChunks === totalQueries) {
        // Combine all chunks
        const allUsers = Object.values(usersByChunk).flat()

        // console.log('All queries completed! Updating state with', allUsers.length, 'users')
        setState({
          users: allUsers,
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: undefined
        })
      }
    }

    // Set up queries for each non-empty chunk
    [chunk1, chunk2, chunk3].forEach((chunk, index) => {
      if (chunk.length === 0) return

      const usersQuery = query(
        collection(db, "users"),
        where(documentId(), "in", chunk)
      )

      const unsubscribe: Unsubscribe = onSnapshot(
        usersQuery,
        (querySnapshot) => {
          const chunkUsers = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))

          handleQueryResult(chunkUsers, index)
        },
        (error) => {
          console.error(`❌ real-time listener error for query ${index + 1}:`, error)
          setState({
            users: [],
            isLoading: false,
            isSuccess: false,
            isError: true,
            error
          })
        }
      )

      unsubscribeFunctions.push(unsubscribe)
    })

    // Cleanup function
    return () => {
      console.log('🔌 cleaning up real-time listeners on users collection')
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe())
    }
  }, [userIds.join(',')]) // Simple array comparison

  return {
    ...state
  }
}