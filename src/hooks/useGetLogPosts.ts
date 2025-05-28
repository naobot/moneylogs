import { useEffect, useState, useCallback } from "react"
import { collection, where, orderBy, query, onSnapshot, doc } from "firebase/firestore"
import { LogPost } from "../types/user"
import { db } from '../config/firebase-config'
import { useGetUserInfo } from "./useGetUserInfo"

export type LogPostsResponse = {
  logs: Array<LogPost>
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  error?: any
}

export const useGetLogPosts = ({ groupId, userId }) => {
  const { user } = useGetUserInfo(userId)

  const [state, setState] = useState<LogPostsResponse>({
    logs: [],
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: null
  })

  const getLogs = useCallback(async () => {
    if (user) {
      // console.log('userDocId: ' + user?.id)
      // console.log('groupDocId: ' + groupId)
      // Set loading state
      setState(prev => ({ ...prev, isLoading: true }))

      const logPostsCollectionRef = collection(db, 'log_posts')

      try {
        const queryLogPosts = query(
          logPostsCollectionRef,
          where('author', '==', doc(db, 'users', user.id)),
          where('group', '==', doc(db, 'log_groups', groupId)),
          orderBy('postDate', 'desc')
        )

        // Create the snapshot listener
        const unsubscribe = onSnapshot(queryLogPosts, (snapshot) => {
          if (!snapshot.empty) {
            const logPosts = snapshot.docs
              .map((logPostDoc) => ({
                id: logPostDoc.id,
                ...logPostDoc.data()
              }))

            setState({
              logs: (logPosts as unknown[]) as LogPost[],
              isLoading: false,
              isSuccess: true,
              isError: false,
              error: null
            })
          } else {
            console.log("No documents matched the query")
            setState(prev => ({
              ...prev,
              logs: [],
              isLoading: false,
              isSuccess: true
            }));
          }
        }, (error) => {
          console.error("Firebase snapshot error:", error)
          setState({
            logs: [],
            isLoading: false,
            isSuccess: false,
            isError: true,
            error
          });
        });

        // Return unsubscribe function for useEffect cleanup
        return unsubscribe
      } catch (err) {
        console.error("Error setting up query:", err)
        setState({
          logs: [],
          isLoading: false,
          isSuccess: false,
          isError: true,
          error: err
        })

        // Return a no-op function in case of setup error
        return () => {}
      }
    }
    else {
      return () => {}
    }
  }, [user])

  useEffect(() => {
    let unsubscribeFunction = () => {}

    // Call the function and store the returned unsubscribe function
    getLogs().then(unsubscribe => {
      unsubscribeFunction = unsubscribe
    })

    // This is crucial for cleanup - this function will be called when the component unmounts
    return () => {
      // Call the unsubscribe function to remove listeners
      unsubscribeFunction()
    };
  }, [getLogs])

  // Return the values from state with the same interface as before
  return {
    logs: state.logs,
    isSuccess: state.isSuccess,
    isLoading: state.isLoading,
    isError: state.isError,
  }
}
