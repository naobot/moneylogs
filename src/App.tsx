import { PropsWithChildren, useEffect } from 'react'
import { BrowserRouter as Router, Route, Routes, NavigateProps, Navigate } from 'react-router-dom'
import { useAuthState } from 'react-firebase-hooks/auth'
// @ts-ignore
import { auth } from './config/firebase-config'
import Layout from './features/layout/Layout'
import GlobalErrorHandler from './utils/errorHandler'
import { useToast } from './hooks/useToast'

import { Auth } from './pages/auth'
import { Home } from './pages/home'
import { UserSettings } from './pages/me'
import { CreateNewLog } from './pages/create'
import { GroupPage } from './pages/group'
import { About } from './pages/about'

import { ToastContainer } from './components/ToastContainer'

import './App.scss'

export const CheckAuth = ({
  children,
  auth: requireAuth = true,
  ...props
}: PropsWithChildren<
  Partial<NavigateProps> & {
    auth?: boolean
  }
>) => {
  const [user, loading] = useAuthState(auth)

  if (loading) return <div>Loading...</div>

  if (!user && requireAuth) {
    return <Navigate to={'/login'} replace {...props} />
  }

  return <>{children}</>
}

const App = () => {
  const { toasts, showToast, removeToast } = useToast()

  useEffect(() => {
    const errorHandler = GlobalErrorHandler.getInstance()
    errorHandler.initialize(showToast)
  }, [showToast])

  return (
    <>
      <Router>
        <Layout>
          <Routes>
            <Route path='/login' element={<Auth />} />
            <Route path='/about' element={<About />} />
            <Route path='/create' element={<CreateNewLog />} />
            <Route path='/' element={<CheckAuth><Home /></CheckAuth>} />
            <Route path='/me' element={<CheckAuth><UserSettings /></CheckAuth>} />

            <Route path='/g/:groupId' element={<CheckAuth><GroupPage /></CheckAuth>} />
          </Routes>

          <ToastContainer toasts={toasts} onRemove={removeToast} />
        </Layout>
      </Router>
    </>
  )
}

export default App
