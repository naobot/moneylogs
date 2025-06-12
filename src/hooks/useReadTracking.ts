import { useCallback } from 'react'
import { logEvent } from 'firebase/analytics'
import { analytics } from '@/config/firebase-config'

export const useReadTracking = () => {
  const trackUserAction = useCallback((action: string, additionalData?: any) => {
    if (analytics) {
      logEvent(analytics, 'user_action', {
        action_type: action,
        environment: import.meta.env.VITE_FIREBASE_ENV || 'unknown',
        timestamp: Date.now(),
        ...additionalData
      })
    }
  }, [])

  return { trackUserAction }
}