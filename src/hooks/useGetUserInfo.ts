import { useEffect, useState, useRef, useMemo } from "react"
import { collection, onSnapshot, query, where } from "firebase/firestore"
import { onAuthStateChanged } from "firebase/auth"
import { auth, db } from '../config/firebase-config'
import { AuthUser } from "../types/user"

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

export const useGetUserInfo = (userId?: string) => { // no userId => checks for log in and gets current user info
  // State for managing auth and user data
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | undefined>(undefined)
  const [user, setUser] = useState<UserData>()

  // Use refs to store unsubscribe functions
  const authUnsubscribeRef = useRef<() => void | undefined>()
  const firestoreUnsubscribeRef = useRef<() => void | undefined>()

  useEffect(() => {
    // Set up the auth state listener
    authUnsubscribeRef.current = onAuthStateChanged(auth, (currentUser) => {
      setIsLoggedIn(!!currentUser)
    })

    // Clean up auth listener on unmount
    return () => {
      if (authUnsubscribeRef.current) {
        authUnsubscribeRef.current()
      }
    };
  }, []) // Empty dependency array = only run once on mount

  useEffect(() => {
    // Clear previous listener if it exists
    if (firestoreUnsubscribeRef.current) {
      firestoreUnsubscribeRef.current()
      firestoreUnsubscribeRef.current = undefined
    }

    // Only proceed if userId is provided OR is logged in
    if (!userId && isLoggedIn !== true) {
      return
    }
    if (isLoggedIn) {
      // Get user ID from localStorage
      const authData = localStorage.getItem('auth')
      if (!authData) {
        return
      }
      else {
        userId = (JSON.parse(authData) as AuthUser)['userId']
      }
    }

    try {
      const usersCollectionRef = collection(db, 'users');
      const queryUsers = query(
        usersCollectionRef,
        where('userId', '==', userId)
      )

      // Set up Firestore listener
      firestoreUnsubscribeRef.current = onSnapshot(queryUsers, (snapshot) => {
        if (!snapshot.empty) {
          const foundUser = {id: snapshot.docs[0]?.id, ...snapshot.docs[0].data()} as UserData;
          setUser(foundUser);
        } else {
          // Handle case where user document doesn't exist
          setUser(undefined);
        }
      }, (error) => {
        console.error("Firestore snapshot error:", error);
      })
    } catch (err) {
      console.error("Error setting up user info listener:", err);
    }

    // Clean up Firestore listener on effect cleanup
    return () => {
      if (firestoreUnsubscribeRef.current) {
        firestoreUnsubscribeRef.current();
        firestoreUnsubscribeRef.current = undefined;
      }
    }
  }, [isLoggedIn]) // Only re-run when login state changes

  return {
    isLoggedIn,
    user,
    logs: user?.logs,
    currentLogId: user?.currentLogId,
  }
}