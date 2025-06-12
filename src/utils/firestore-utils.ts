import {
  collection,
  doc,
  query,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  QueryConstraint
} from 'firebase/firestore'
import { db, analytics } from '@/config/firebase-config'
import { logEvent } from 'firebase/analytics'

const environment = import.meta.env.VITE_FIREBASE_ENV || 'unknown'

// Helper to log Firebase operations
const logFirebaseOperation = (operation: string, collectionName: string, additionalData?: any) => {
  if (analytics) {
    logEvent(analytics, 'firebase_operation', {
      operation_type: operation,
      collection: collectionName,
      environment: environment,
      timestamp: Date.now(),
      ...additionalData
    })
  }

  // Also log to console in development for debugging
  if (environment === 'development') {
    console.log(`[${environment.toUpperCase()}] Firebase ${operation}:`, {
      collection: collectionName,
      ...additionalData
    })
  }
}

// Wrapped Firestore operations
export const getDocumentWithLogging = async (collectionName: string, docId: string) => {
  logFirebaseOperation('read_document', collectionName, { doc_id: docId })
  return getDoc(doc(db, collectionName, docId))
}

export const getCollectionWithLogging = async (collectionName: string, ...queryConstraints: QueryConstraint[]) => {
  logFirebaseOperation('read_collection', collectionName, {
    constraints_count: queryConstraints.length
  })
  const q = query(collection(db, collectionName), ...queryConstraints)
  return getDocs(q)
}

export const addDocumentWithLogging = async (collectionName: string, data: any) => {
  logFirebaseOperation('write_document', collectionName)
  return addDoc(collection(db, collectionName), data)
}

export const updateDocumentWithLogging = async (collectionName: string, docId: string, data: any) => {
  logFirebaseOperation('update_document', collectionName, { doc_id: docId })
  return updateDoc(doc(db, collectionName, docId), data)
}

export const deleteDocumentWithLogging = async (collectionName: string, docId: string) => {
  logFirebaseOperation('delete_document', collectionName, { doc_id: docId })
  return deleteDoc(doc(db, collectionName, docId))
}

export const subscribeToCollectionWithLogging = (
  collectionName: string,
  callback: (snapshot: any) => void,
  ...queryConstraints: QueryConstraint[]
) => {
  logFirebaseOperation('subscribe_collection', collectionName, {
    constraints_count: queryConstraints.length
  })

  const q = query(collection(db, collectionName), ...queryConstraints)
  return onSnapshot(q, callback)
}