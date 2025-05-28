import { useGetUserInfo } from "../hooks/useGetUserInfo"
import { AuthUser } from "../types/user"

export const useCurrentUser = () => {
  const getCurrentUserId = (): string | null => {
    const authData = localStorage.getItem('auth')
    if (authData) {
      const user = JSON.parse(authData) as AuthUser
      return user.userId
    }
    return null
  }

  const currentUserId = getCurrentUserId()

  const userInfo = useGetUserInfo(currentUserId || '')

  return currentUserId ? userInfo : null
}