import { useEffect, useState } from "react"
import { getAuth, PasswordValidationStatus, validatePassword } from "firebase/auth";

const useValidatePassword = (password: string) => {
  const [isValid, setIsValid] = useState(false)
  const [status, setStatus] = useState<PasswordValidationStatus | { isValid: boolean }>()

  const handleValidate = async (password: string) => {
    if (import.meta.env.VITE_FIREBASE_ENV == 'development') {
      setStatus({ isValid: true })
    } else {
      const validateStatus = await validatePassword(getAuth(), password)
      setStatus(validateStatus)
    }
  }

  useEffect(() => {
    handleValidate(password)
  }, [password])

  useEffect(() => {
    if (status) {
      setIsValid(status?.isValid)
    }
  }, [status])

  return {
    isValid,
    status
  }
}

export default useValidatePassword