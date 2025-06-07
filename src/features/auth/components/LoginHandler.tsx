import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { signInWithEmailAndPassword } from "firebase/auth"
// @ts-ignore
import { auth } from '@/config/firebase-config'

import { AuthUser } from "@/types/user"

import ControlledInput from "@/components/ControlledInput"
import Button from "@/components/Button"

const LoginHandler = () => {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginPending, setLoginPending] = useState(false)

  const handleLogin = () => {
    setLoginPending(true)
    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        // Signed in
        const user = userCredential.user
        const authInfo: AuthUser = {
          userId: user.uid,
          nickname: user.displayName,
          email: user.email,
          isAuth: true,
        }
        localStorage.setItem('auth', JSON.stringify(authInfo))
        setLoginPending(false)
        navigate('/')
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        setLoginPending(false)
        console.log(`${errorCode}: ${errorMessage}`)
      })
  }

  return (
    <>
      <div className="InfoBox Login">
        <ControlledInput value={email} onChange={(e: any) => setEmail(e?.target?.value)} label='Email' />
        <ControlledInput type='password' value={password} onChange={(e: any) => setPassword(e?.target?.value)} label='Password' />
        <Button
          onClick={() => handleLogin()}
          text='Login'
          loading={loginPending}
          disabled={!email || !password}
          buttonStyle="primary-border"
        />
      </div>
    </>
  )
}

export default LoginHandler