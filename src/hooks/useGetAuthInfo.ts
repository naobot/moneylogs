import { useState } from "react"
import { AuthUser } from "../types/user"
// @ts-ignore
import { auth } from '../config/firebase-config'
import { onAuthStateChanged } from "firebase/auth"

export const useGetAuthInfo = () => {
  const [currentAuth, setCurrentAuth] = useState<AuthUser|null>()

  onAuthStateChanged(auth, (user) => {
    if (user) {
      setCurrentAuth({
        userId: user.uid,
        isAuth: true,
        email: user.email,
      })
    }
    else {
      setCurrentAuth(null)
    }
  })

  return {
    isLoggedIn: !!currentAuth,
    userId: currentAuth?.userId,
  }
}
