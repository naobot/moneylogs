import React, { useEffect, MouseEvent, ReactNode, createContext, useContext } from 'react'
import { createPortal } from 'react-dom'
import Button from './Button';

// Context for sharing modal state between compound components
interface ModalContextValue {
  onClose?: () => void;
  disabled?: boolean;
}

const ModalContext = createContext<ModalContextValue>({})

// Helper function to ensure modal root exists
const getModalRoot = (): HTMLElement => {
  let modalRoot = document.getElementById('modal-root')

  if (!modalRoot) {
    modalRoot = document.createElement('div')
    modalRoot.id = 'modal-root'
    document.body.appendChild(modalRoot)
  }

  return modalRoot
}

// Main Modal component (container)
interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  className = '',
  disabled = false,
}) => {
  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && onClose) {
      onClose()
    }
  }

  // escape key and body scroll management
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose()
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset'
    };
  }, [isOpen, onClose])

  if (!isOpen) return null

  const modalContent = (
    <ModalContext.Provider value={{ onClose, disabled }}>
      <div className="Modal__backdrop" onClick={handleBackdropClick}>
        <div className={`Modal__content ${className}`} onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </ModalContext.Provider>
  )

  return createPortal(modalContent, getModalRoot())
}

// Header compound component
interface ModalHeaderProps {
  children?: ReactNode;
  title?: string;
  showCloseButton?: boolean;
  className?: string;
}

const ModalHeader: React.FC<ModalHeaderProps> = ({
  children,
  title,
  showCloseButton = false,
  className = '',
}) => {
  const { onClose, disabled } = useContext(ModalContext)

  return (
    <div className={`Modal__header ${className}`}>
      {title && <h2 className="Modal__title">{title}</h2>}
      {children}
      {showCloseButton && onClose && (
        <button
          className="Modal__button--close"
          onClick={onClose}
          aria-label="Close modal"
          disabled={disabled}
        >
          ×
        </button>
      )}
    </div>
  )
}

// Body compound component
interface ModalBodyProps {
  children: ReactNode;
  className?: string;
}

const ModalBody: React.FC<ModalBodyProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`Modal__body ${className}`}>
      {children}
    </div>
  )
}

// Actions compound component
interface ModalActionsProps {
  children?: ReactNode;
  className?: string;
}

const ModalActions: React.FC<ModalActionsProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`Modal__footer ${className}`}>
      {children}
    </div>
  )
}

// Confirm Button compound component
interface ModalConfirmButtonProps {
  onClick?: () => void;
  text?: string;
  className?: string;
  closeOnClick?: boolean;
}

const ModalConfirmButton: React.FC<ModalConfirmButtonProps> = ({
  onClick,
  text = 'OK',
  className = '',
  closeOnClick = true,
}) => {
  const { onClose, disabled } = useContext(ModalContext)

  const handleClick = () => {
    if (onClick) {
      onClick()
    }
    if (closeOnClick && onClose) {
      onClose()
    }
  }

  return (
    <Button
      className={`Modal__button--confirm ${className}`}
      onClick={handleClick}
      text={text}
      buttonStyle='primary-border'
      disabled={disabled}
    />
  )
}

// Cancel Button compound component
interface ModalCancelButtonProps {
  onClick?: () => void;
  text?: string;
  className?: string;
  closeOnClick?: boolean;
}

const ModalCancelButton: React.FC<ModalCancelButtonProps> = ({
  onClick,
  text = 'Cancel',
  className = '',
  closeOnClick = true,
}) => {
  const { onClose, disabled } = useContext(ModalContext)

  const handleClick = () => {
    if (onClick) {
      onClick()
    }
    if (closeOnClick && onClose) {
      onClose()
    }
  }

  return (
    <Button
      className={`Modal__button--cancel ${className}`}
      onClick={handleClick}
      text={text}
      buttonStyle='primary-border-lite'
      disabled={disabled}
    />
  )
}

// Create the compound component interface
interface ModalComponent extends React.FC<ModalProps> {
  Header: React.FC<ModalHeaderProps>
  Body: React.FC<ModalBodyProps>
  Actions: React.FC<ModalActionsProps>
  ConfirmButton: React.FC<ModalConfirmButtonProps>
  CancelButton: React.FC<ModalCancelButtonProps>
}

// Cast Modal to the compound component type
const CompoundModal = Modal as ModalComponent

// Attach compound components to main Modal
CompoundModal.Header = ModalHeader
CompoundModal.Body = ModalBody
CompoundModal.Actions = ModalActions
CompoundModal.ConfirmButton = ModalConfirmButton
CompoundModal.CancelButton = ModalCancelButton

export default CompoundModal

// Type exports for convenience
export type { ModalProps, ModalHeaderProps, ModalBodyProps, ModalActionsProps }