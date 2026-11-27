import React, { useEffect, useRef, MouseEvent, ReactNode, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import Button from "./Button";

// Context for sharing modal state between compound components
interface ModalContextValue {
  onClose?: () => void;
  disabled?: boolean;
  /** How deep this modal is nested inside others (0 for one rendered on the page). */
  depth?: number;
}

const ModalContext = createContext<ModalContextValue>({});

// Helper function to ensure modal root exists
const getModalRoot = (): HTMLElement => {
  let modalRoot = document.getElementById("modal-root");

  if (!modalRoot) {
    modalRoot = document.createElement("div");
    modalRoot.id = "modal-root";
    document.body.appendChild(modalRoot);
  }

  return modalRoot;
};

/**
 * Open modals. The top one is the most deeply nested (a modal rendered inside another's
 * content is above it, even when both open in the same render, where React runs the
 * inner one's effects first), then the most recently opened.
 */
type OpenModal = { depth: number; seq: number };
const openModals: OpenModal[] = [];
let openSeq = 0;
const topModal = () =>
  openModals.reduce<OpenModal | undefined>(
    (top, m) =>
      !top || m.depth > top.depth || (m.depth === top.depth && m.seq > top.seq) ? m : top,
    undefined,
  );

// Main Modal component (container)
interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  children: ReactNode;
  className?: string;
  /**
   * Something is in flight (a save, a delete): the modal can't be dismissed (backdrop,
   * Escape, its close × and Confirm / Cancel buttons) until it settles.
   */
  disabled?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  className = "",
  disabled = false,
}) => {
  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && onClose && !disabled) {
      onClose();
    }
  };

  // Escape and body scroll. Modals can stack (an explainer opened from inside a tool
  // modal): only the topmost one answers Escape, and the page stays locked until the
  // last one closes. The stack order is set when each opens, not as they re-render.
  const depth = (useContext(ModalContext).depth ?? -1) + 1;
  const onCloseRef = useRef(onClose);
  const disabledRef = useRef(disabled);
  useEffect(() => {
    onCloseRef.current = onClose;
    disabledRef.current = disabled;
  });
  useEffect(() => {
    if (!isOpen) return;
    const entry: OpenModal = { depth, seq: ++openSeq };
    openModals.push(entry);
    document.body.style.overflow = "hidden";
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && topModal() === entry && !disabledRef.current) {
        onCloseRef.current?.();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      const at = openModals.indexOf(entry);
      if (at !== -1) openModals.splice(at, 1);
      if (openModals.length === 0) document.body.style.overflow = "unset";
    };
  }, [isOpen, depth]);

  if (!isOpen) return null;

  const modalContent = (
    <ModalContext.Provider value={{ onClose, disabled, depth }}>
      <div
        className="Modal__backdrop"
        onClick={handleBackdropClick}
        // A nested modal draws above the one it was opened from.
        style={depth > 0 ? { zIndex: 50 + depth } : undefined}
      >
        <div className={`Modal__content ${className}`} onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </ModalContext.Provider>
  );

  return createPortal(modalContent, getModalRoot());
};

// Header compound component
interface ModalHeaderProps {
  children?: ReactNode;
  /** Shown instead of children when given. Wrap user content in `.keep-case`. */
  title?: ReactNode;
  showCloseButton?: boolean;
  className?: string;
}

const ModalHeader: React.FC<ModalHeaderProps> = ({
  children,
  title,
  showCloseButton = false,
  className = "",
}) => {
  const { onClose, disabled } = useContext(ModalContext);

  // The black bar (2026-11 audit): an overlay's header always says "you're working in
  // this now". The striped bar is a page's own header (TitleBar), never a modal's.
  return (
    <div className={`Modal__header ${className}`}>
      <h2 className="Modal__title">{title ?? children}</h2>
      {showCloseButton && onClose && (
        <button
          type="button"
          className="Modal__button--close"
          onClick={onClose}
          aria-label="Close modal"
          disabled={disabled}
        >
          ×
        </button>
      )}
    </div>
  );
};

// Body compound component
interface ModalBodyProps {
  children: ReactNode;
  className?: string;
}

const ModalBody: React.FC<ModalBodyProps> = ({ children, className = "" }) => {
  return <div className={`Modal__body ${className}`}>{children}</div>;
};

// Actions compound component
interface ModalActionsProps {
  children?: ReactNode;
  className?: string;
}

const ModalActions: React.FC<ModalActionsProps> = ({ children, className = "" }) => {
  return <div className={`Modal__footer ${className}`}>{children}</div>;
};

// Confirm Button compound component
interface ModalConfirmButtonProps {
  onClick?: () => void;
  text?: string;
  className?: string;
  closeOnClick?: boolean;
}

const ModalConfirmButton: React.FC<ModalConfirmButtonProps> = ({
  onClick,
  text = "OK",
  className = "",
  closeOnClick = true,
}) => {
  const { onClose, disabled } = useContext(ModalContext);

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
    if (closeOnClick && onClose) {
      onClose();
    }
  };

  return (
    <Button
      className={`Modal__button--confirm ${className}`}
      onClick={handleClick}
      text={text}
      variant="primary"
      disabled={disabled}
    />
  );
};

// Cancel Button compound component
interface ModalCancelButtonProps {
  onClick?: () => void;
  text?: string;
  className?: string;
  closeOnClick?: boolean;
}

const ModalCancelButton: React.FC<ModalCancelButtonProps> = ({
  onClick,
  text = "Cancel",
  className = "",
  closeOnClick = true,
}) => {
  const { onClose, disabled } = useContext(ModalContext);

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
    if (closeOnClick && onClose) {
      onClose();
    }
  };

  return (
    <Button
      className={`Modal__button--cancel ${className}`}
      onClick={handleClick}
      text={text}
      variant="secondary"
      disabled={disabled}
    />
  );
};

// Create the compound component interface
interface ModalComponent extends React.FC<ModalProps> {
  Header: React.FC<ModalHeaderProps>;
  Body: React.FC<ModalBodyProps>;
  Actions: React.FC<ModalActionsProps>;
  ConfirmButton: React.FC<ModalConfirmButtonProps>;
  CancelButton: React.FC<ModalCancelButtonProps>;
}

// Cast Modal to the compound component type
const CompoundModal = Modal as ModalComponent;

// Attach compound components to main Modal
CompoundModal.Header = ModalHeader;
CompoundModal.Body = ModalBody;
CompoundModal.Actions = ModalActions;
CompoundModal.ConfirmButton = ModalConfirmButton;
CompoundModal.CancelButton = ModalCancelButton;

export default CompoundModal;

// Type exports for convenience
export type { ModalProps, ModalHeaderProps, ModalBodyProps, ModalActionsProps };
