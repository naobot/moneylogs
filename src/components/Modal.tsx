import React, { useEffect, MouseEvent, ReactNode } from 'react'
import Button from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  children: ReactNode;
  showCloseButton?: boolean;
  showOkButton?: boolean;
  onOk?: () => void;
  okButtonText?: string;
  showCancelButton?: boolean;
  onCancel?: () => void;
  cancelButtonText?: string;
  title?: string;
  className?: string;
  disabled?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  showCloseButton = false,
  showOkButton = false,
  onOk,
  okButtonText = 'OK',
  showCancelButton = false,
  onCancel,
  cancelButtonText = 'Cancel',
  title,
  className = '',
  disabled = false,
}) => {
  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && onClose) {
      onClose()
    }
  }

  // escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset'
    };
  }, [isOpen, onClose])

  const handleOkClick = () => {
    if (onOk) {
      onOk()
    }
    // Optionally close modal after OK action
    if (onClose) {
      onClose()
    }
  }

  const handleCancelClick = () => {
    if (onCancel) {
      onCancel()
    }
    // Optionally close modal after Cancel action
    if (onClose) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="Modal__backdrop" onClick={handleBackdropClick}>
      <div className={`Modal__content ${className}`} onClick={(e) => e.stopPropagation()}>
        {/* Header with optional title and close button */}
        {(title || showCloseButton) && (
          <div className="Modal__header">
            <h2 className="Modal__title">{title}</h2>
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
        )}

        {/* Main content */}
        <div className="Modal__body">
          {children}
        </div>

        {/* Footer with optional action buttons */}
        {(showOkButton || showCancelButton) && (
          <div className="Modal__footer">
            {showCancelButton && (
              <Button
                className="Modal__button--cancel"
                onClick={handleCancelClick}
                text={cancelButtonText}
                buttonStyle='primary-border'
                disabled={disabled}
              />
            )}
            {showOkButton && (
              <Button
                className="Modal__button--confirm"
                onClick={handleOkClick}
                text={okButtonText}
                buttonStyle='primary-border'
                disabled={disabled}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Modal