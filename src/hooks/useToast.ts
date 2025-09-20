import { useState, useCallback } from 'react'

interface Toast {
  id: string
  message: string
  timestamp: Date
}

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string) => {
    const id = Date.now().toString()
    const newToast: Toast = {
      id,
      message,
      timestamp: new Date()
    }

    setToasts(prev => [...prev, newToast])

    // Auto-remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id))
    }, 5000)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  return { toasts, showToast, removeToast }
}