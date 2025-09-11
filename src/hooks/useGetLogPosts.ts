import { useEffect, useState, useRef } from "react"
import dayjs from "dayjs"
import { collection, query, where, orderBy, onSnapshot, doc, Unsubscribe } from "firebase/firestore"
// @ts-ignore
import { db } from '@/config/firebase-config'
import { LogPost } from "@/types/user"
import { invalidateCommentCache } from './useGetLogPostComments'

type UseGetLogPostsParams = {
  groupId?: string
  userId?: string // keeping for compatibility, not used in the query
}

export const useGetLogPosts = ({ groupId, userId }: UseGetLogPostsParams) => {
  const [state, setState] = useState({
    posts: [] as LogPost[],
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: undefined as any,
  })

  // Keep track of previous latestCommentAt values to detect changes
  const previousCommentTimestamps = useRef<Map<string, any>>(new Map())

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

    // const recentCutoff = dayjs().subtract(4, 'weeks').toDate()

    const postsQuery = query(
      collection(db, "log_posts"),
      where("group", "==", groupDocRef),
      // where("postDate", ">=", recentCutoff),
      orderBy("postDate", "desc")
    )

    console.log('🔄 setting up real-time listener on log_posts collection')

    // Set up the real-time listener
    const unsubscribe: Unsubscribe = onSnapshot(
      postsQuery,
      (querySnapshot) => {
        console.log(`📡 received ${querySnapshot.size} log posts from real-time listener`)

        const posts = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as LogPost[]

        // Check for comment timestamp changes and invalidate cache accordingly
        posts.forEach(post => {
          const postId = post.id
          const currentLatestCommentAt = post.latestCommentAt
          const previousLatestCommentAt = previousCommentTimestamps.current.get(postId)

          // If latestCommentAt has changed (Cloud Function updated it), invalidate the comment cache for this post
          if (previousLatestCommentAt && currentLatestCommentAt) {
            const currentTime = currentLatestCommentAt?.toMillis() || 0
            const previousTime = previousLatestCommentAt?.toMillis() || 0

            if (currentTime !== previousTime) {
              console.log(`🔄 detected latestCommentAt update for post ${postId}, invalidating cache and notifying listeners`)
              // This now both deletes the cache AND emits events to active listeners
              invalidateCommentCache(postId)
            }
          }

          // Update the tracking map
          previousCommentTimestamps.current.set(postId, currentLatestCommentAt)
        })

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
      // Clear the tracking map when the component unmounts or groupId changes
      previousCommentTimestamps.current.clear()
      unsubscribe()
    }
  }, [groupId])

  return {
    ...state
  }
}