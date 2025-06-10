import { useEffect, useState } from "react"
import dayjs from "dayjs"
import { collection, query, where, orderBy, onSnapshot, doc, Unsubscribe } from "firebase/firestore"
// @ts-ignore
import { db } from '@/config/firebase-config'

type UseGetLogPostsParams = {
  groupId?: string
  userId?: string // keeping for compatibility, not used in the query
}

export const useGetLogPosts = ({ groupId, userId }: UseGetLogPostsParams) => {
  const [state, setState] = useState({
    posts: [] as any[],
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: undefined as any,
  })

  useEffect(() => {
    if (!groupId || typeof groupId !== 'string') {
      setState({
        posts: [],
        isLoading: false,
        isSuccess: false,
        isError: false,
        error: undefined
      })
      return
    }

    setState(prev => ({ ...prev, isLoading: true }))

    // Create the document reference inside the effect
    const groupDocRef = doc(db, "log_groups", groupId)

    const recentCutoff = dayjs().subtract(2, 'weeks').toDate()

    const postsQuery = query(
      collection(db, "log_posts"),
      where("group", "==", groupDocRef),
      where("postDate", ">=", recentCutoff),
      orderBy("postDate", "desc")
    )

    // Create the real-time query
    // const postsQuery = query(
    //   collection(db, "log_posts"),
    //   where("group", "==", groupDocRef),
    //   orderBy("postDate", "desc") // or whatever ordering you prefer
    // )

    console.log('🔄 setting up real-time listener on log_posts collection')

    // Set up the real-time listener
    const unsubscribe: Unsubscribe = onSnapshot(
      postsQuery,
      (querySnapshot) => {
        console.log(`📡 received ${querySnapshot.size} log posts from real-time listener`)

        const posts = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))

        setState({
          posts,
          isLoading: false,
          isSuccess: true,
          isError: false,
          error: undefined
        })
      },
      (error) => {
        console.error('❌ real-time listener error:', error)
        setState({
          posts: [],
          isLoading: false,
          isSuccess: false,
          isError: true,
          error
        })
      }
    )

    // Cleanup function - this is crucial!
    return () => {
      console.log('🔌 cleaning up real-time listener on log_posts collection')
      unsubscribe()
    }
  }, [groupId])

  return {
    ...state
  }
}