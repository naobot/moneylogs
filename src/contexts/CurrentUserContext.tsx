import React, { createContext, useContext, useEffect, useState } from 'react'
import { useGetUserInfo, UserData } from '@/hooks/useGetUserInfo'
import { AuthUser } from '@/types/user'

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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Get current user ID from localStorage
  useEffect(() => {
    const getCurrentUserId = (): string | null => {
      const authData = localStorage.getItem('auth')
      if (authData) {
        const user = JSON.parse(authData) as AuthUser
        return user.userId
      }
      return null
    }

    const userId = getCurrentUserId()
    setCurrentUserId(userId)

    // Optional: Listen for localStorage changes
    const handleStorageChange = () => {
      const newUserId = getCurrentUserId()
      setCurrentUserId(newUserId)
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // Single instance of useGetUserInfo for the entire app
  const userInfo = useGetUserInfo(currentUserId || '')

  return (
    <CurrentUserContext.Provider value={userInfo}>
      {children}
    </CurrentUserContext.Provider>
  )
}

// Hook to use the current user context
export const useCurrentUser = (): CurrentUserContextType => {
  const context = useContext(CurrentUserContext)
  if (context === undefined) {
    throw new Error('useCurrentUser must be used within a CurrentUserProvider')
  }
  return context
}