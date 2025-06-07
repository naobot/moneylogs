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
}

const ControlledInput = ({ value, onChange, label, isError, errorMessage, type = 'text' }: ControlledInputProps) => {

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
      <label>
        {label}
      </label>
      <input
        type={type}
        value={value ?? ''}
        onChange={onChange}
      />
      <div className='ControlledInput__alert'>
        {isError && <Icon type='warning' />}
      </div>
    </div>
  )
}

export default ControlledInput