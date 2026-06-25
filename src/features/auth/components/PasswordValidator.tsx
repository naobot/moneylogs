import { useState } from "react";

import ControlledInput from "@/components/ControlledInput";
import useValidatePassword from "@/features/auth/hooks/useValidatePassword";

const PasswordValidator = () => {
  const [password, setPassword] = useState("");
  const { isValid } = useValidatePassword(password);

  return (
    <ControlledInput
      type="password"
      value={password}
      onChange={(e) => setPassword((e.target as HTMLInputElement).value)}
      label="Password"
      isError={!!password && !isValid}
      errorMessage={"password problem"}
    />
  );
};

export default PasswordValidator;
