import { useState } from "react"

import ControlledInput from "@/components/ControlledInput"
import useValidatePassword from "../hooks/useValidatePassword"

const PasswordValidator = () => {
  const [password, setPassword] = useState('')
  const { isValid } = useValidatePassword(password)

  return (
    <ControlledInput
      type='password'
      value={password}
      onChange={(e: any) => setPassword(e?.target?.value)}
      label='Password'
      isError={!!password && !isValid}
      errorMessage={'password problem'}
    />
  )
}

export default PasswordValidator