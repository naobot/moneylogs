import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithEmailAndPassword, updateProfile } from "firebase/auth"
// @ts-ignore
import { auth } from '../../../config/firebase-config'
import useValidatePassword from "../hooks/useValidatePassword"
import { useRegisterNewUser } from "../../../hooks/useRegisterNewUser"
import { AuthUser } from "../../../types/user"
import ControlledInput from "../../../components/ControlledInput"
import Button from "../../../components/Button"

const RegistrationHandler = () => {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [registrationPending, setRegistrationPending] = useState(false)
  const { isValid } = useValidatePassword(password)
  const { addNewUser } = useRegisterNewUser()

  const handleRegister = async () => {
    setRegistrationPending(true)

    try {
      // Create Firebase auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Add user to Firestore using the mutation
      await addNewUser.mutate({
        userId: user.uid,
        displayName: displayName,
        email: email,
      })

      // Complete the registration process
      await sendEmailVerification(auth.currentUser)
      await updateProfile(auth.currentUser, { displayName: displayName })
      const loggedInUser = await signInWithEmailAndPassword(auth, email, password)

      const authInfo: AuthUser = {
        userId: user.uid,
        nickname: user.displayName,
        email: user.email,
        isAuth: true,
      }

      // localStorage.setItem('auth', JSON.stringify(authInfo))
      setRegistrationPending(false)

      if (loggedInUser.user) {
        window.location.href = "/me"
      }

    } catch (error: any) {
      const errorCode = error.code
      const errorMessage = error.message
      setRegistrationPending(false)
      console.log(`${errorCode}: ${errorMessage}`)
    }
  }

  return (
    <>
      <div className="InfoBox Registration">
        <ControlledInput
          value={displayName}
          onChange={(e: any) => setDisplayName(e?.target?.value)}
          label='Name'
        />
        <ControlledInput
          value={email}
          onChange={(e: any) => setEmail(e?.target?.value)}
          label='Email'
        />
        <ControlledInput
          type='password'
          value={password}
          onChange={(e: any) => setPassword(e?.target?.value)}
          label='Password'
          isError={!!password && !isValid}
          errorMessage={'password problem'}
        />
        <Button
          onClick={() => handleRegister()}
          text='Register'
          disabled={!email || !password || !isValid}
          loading={registrationPending}
          buttonStyle="primary-border"
        />
      </div>
    </>
  )
}

export default RegistrationHandler