import cx from 'classnames'
import { ChangeEventHandler } from "react"
import Icon from './Icon'

type ControlledInputProps = {
  value?: string | number
  onChange: ChangeEventHandler<HTMLElement>
  label: string
  isError?: boolean
  errorMessage?: string
  type?: 'text' | 'password' | 'number' | 'date'
  max?: number
  min?: number
}

const ControlledInput = ({ value, onChange, label, isError, errorMessage, type = 'text', max, min }: ControlledInputProps) => {

  // useEffect(() => {
  //   if (isError) {
  //     console.log(errorMessage)
  //   }
  // }, [isError])

  return (
    <div
      className={cx("ControlledInput", {
        "ControlledInput--warning": isError
      })}
    >
      <div className="ControlledInput__input">
        <label>
          {label}
        </label>
        <input
          type={type}
          value={value ?? ''}
          onChange={onChange}
          max={max}
          min={min}
        />
      </div>
      <div className='ControlledInput__alert'>
        {isError && <Icon type='warning' />}
        {isError && errorMessage && <>{errorMessage}</>}
      </div>
    </div>
  )
}

export default ControlledInput