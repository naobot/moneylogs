import cx from "classnames";
import { ChangeEventHandler } from "react";
import Icon from "./Icon";

type ControlledInputProps = {
  value?: string | number;
  onChange: ChangeEventHandler<HTMLInputElement>;
  label: string;
  isError?: boolean;
  errorMessage?: string;
  type?: "text" | "password" | "number" | "date" | "time";
  max?: number;
  min?: number;
  placeholder?: string;
};

const ControlledInput = ({
  value,
  onChange,
  label,
  isError,
  errorMessage,
  type = "text",
  max,
  min,
  placeholder,
}: ControlledInputProps) => {
  // useEffect(() => {
  //   if (isError) {
  //     console.log(errorMessage)
  //   }
  // }, [isError])

  return (
    <div
      className={cx("ControlledInput", {
        "ControlledInput--warning": isError,
      })}
    >
      <div className="ControlledInput__input">
        <label>{label}</label>
        <input
          type={type}
          value={value ?? ""}
          onChange={onChange}
          max={max}
          min={min}
          placeholder={placeholder}
        />
      </div>
      <div className="ControlledInput__alert">
        {isError && <Icon type="warning" />}
        {isError && errorMessage && <>{errorMessage}</>}
      </div>
    </div>
  );
};

export default ControlledInput;
