import React, { createContext, useContext, useEffect, useState } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'
import { auth } from '@/config/firebase-config'
import { useGetUserInfo, UserData } from '@/hooks/useGetUserInfo'

interface CurrentUserContextType {
  user: UserData | undefined
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  error: any
  logs: any
  currentLogId: string | undefined
}

const CurrentUserContext = createContext<CurrentUserContextType | undefined>(undefined)

export const CurrentUserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Use Firebase auth as the source of truth
  const [firebaseUser, firebaseLoading] = useAuthState(auth)

  // Get user info based on Firebase auth state
  const userInfo = useGetUserInfo(firebaseUser?.uid || '')

  // Combine Firebase loading state with user info loading
  const combinedContextValue = {
    ...userInfo,
    isLoading: firebaseLoading || userInfo.isLoading,
    // If Firebase auth is loading or user is null, treat as no user
    user: firebaseUser ? userInfo.user : undefined,
  }

  return (
    <CurrentUserContext.Provider value={combinedContextValue}>
      {children}
    </CurrentUserContext.Provider>
  )
}

export const useCurrentUser = (): CurrentUserContextType => {
  const context = useContext(CurrentUserContext)
  if (context === undefined) {
    throw new Error('useCurrentUser must be used within a CurrentUserProvider')
  }
  return context
}