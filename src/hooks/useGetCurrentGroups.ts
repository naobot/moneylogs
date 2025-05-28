import { useEffect, useState, useCallback } from "react"
import { collection, where, query, onSnapshot, Timestamp, getDocs, doc } from "firebase/firestore"
import { AuthUser, Group } from "../types/user"
import { db } from '../config/firebase-config'

export type GroupsResponse = {
  currentGroups: Array<Group>
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  error?: any
}

export const useGetCurrentGroups = () => {
  const [state, setState] = useState<GroupsResponse>({
    currentGroups: [],
    isLoading: false,
    isSuccess: false,
    isError: false,
    error: null
  })

  const getActiveLogGroups = useCallback(async (currentUserId) => {
    // Set loading state
    setState(prev => ({ ...prev, isLoading: true }))

    const groupsCollectionRef = collection(db, 'log_groups')

    try {
      const queryGroupsActive = query(
        groupsCollectionRef,
        where('start', '<=', Timestamp.now()),
        where('end', '>=', Timestamp.now()),
        where('members', 'array-contains', doc(db, 'users', currentUserId)),
      )

      // Create the snapshot listener
      const unsubscribe = onSnapshot(queryGroupsActive, (snapshot) => {
        // console.log("Query returned docs:", snapshot.docs.length)

        if (!snapshot.empty) {
          const usersActiveLogGroups = snapshot.docs
            .map((groupDoc) => ({
              id: groupDoc.id,
              ...groupDoc.data()
            }))

          setState({
            currentGroups: (usersActiveLogGroups as unknown[]) as Group[],
            isLoading: false,
            isSuccess: true,
            isError: false,
            error: null
          })
        } else {
          setState(prev => ({
            ...prev,
            currentGroups: [],
            isLoading: false,
            isSuccess: true
          }));
        }
      }, (error) => {
        console.error("Firebase snapshot error:", error)
        setState({
          currentGroups: [],
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
        currentGroups: [],
        isLoading: false,
        isSuccess: false,
        isError: true,
        error: err
      });
      // Return a no-op function in case of setup error
      return () => {}
    }
  }, [])

  useEffect(() => {
    const authData = localStorage.getItem('auth')
    let unsubscribeFunction = () => {}

    if (authData) {
      const user = JSON.parse(authData) as AuthUser;
      // Call the function and store the returned unsubscribe function
      getActiveLogGroups(user.userId).then(unsubscribe => {
        unsubscribeFunction = unsubscribe
      })
    }

    // This is crucial for cleanup - this function will be called when the component unmounts
    return () => {
      // Call the unsubscribe function to remove listeners
      unsubscribeFunction()
    };
  }, [getActiveLogGroups])

  // Return the values from state with the same interface as before
  return {
    currentGroups: state.currentGroups,
    isSuccess: state.isSuccess,
    isLoading: state.isLoading,
    isError: state.isError,
  }
}