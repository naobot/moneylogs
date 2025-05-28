import { useEffect, useState } from "react"
import { getAuth, PasswordValidationStatus, validatePassword } from "firebase/auth";

const useValidatePassword = (password: string) => {
  const [isValid, setIsValid] = useState(false)
  const [status, setStatus] = useState<PasswordValidationStatus>()

  const handleValidate = async (password: string) => {
    const validateStatus = await validatePassword(getAuth(), password)
    setStatus(validateStatus)
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