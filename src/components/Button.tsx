import cx from 'classnames'
import { ForwardedRef, forwardRef } from 'react'
import { Link } from 'react-router-dom'
import Icon, { IconType } from './Icon'
// import { Link } from 'react-router-dom'

type ButtonProps = {
  text?: string
  onClick?: Function
  disabled?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  buttonStyle?: string
  loading?: boolean
  to?: string
  className?: string
  icon?: IconType
  title?: string
  isSelected?: boolean
}

const Button = forwardRef(
  (
    {
      text,
      onClick = () => {},
      disabled = false,
      size = 'md',
      buttonStyle = 'primary',
      loading = false,
      to,
      className = '',
      icon,
      title = text,
      isSelected = false,
      ...props
    }: ButtonProps,
    ref: ForwardedRef<HTMLButtonElement>
  ) => {
  const ButtonComponent = to ? Link : 'button'

  return (
    <ButtonComponent
      onClick={(e: any) => {e.preventDefault; onClick()}}
      className={cx('Button', {
        'Button--disabled': disabled || loading,
        'Button--active': isSelected,
        [`Button--size-${size}`]: size,
        [`Button--${buttonStyle}`]: buttonStyle,
        [className]: className,
      })}
      disabled={disabled || loading}
      title={title}
      to={to}
      ref={ref}
      {...props}
    >
      {icon && <Icon type={icon} />}
      {text}
    </ButtonComponent>
  )
})

export default Button
