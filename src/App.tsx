import { PropsWithChildren } from 'react'
import { BrowserRouter as Router, Route, Routes, NavigateProps, Navigate } from 'react-router-dom'

import Layout from './features/layout/Layout'

import { Auth } from './pages/auth'
import { Home } from './pages/home'
import { UserSettings } from './pages/me'
import { CreateNewLog } from './pages/create'

import './App.scss'
import { GroupPage } from './pages/group'

const CheckAuth = ({
  children,
  auth = true,
  ...props
}: PropsWithChildren<
  Partial<NavigateProps> & {
    auth?: boolean
  }
>) => {
  const isLoggedIn = !!localStorage.getItem('auth') // TODO refactor isLoggedIn with redux

  if (auth !== isLoggedIn) {
    return <Navigate to={'/login'} replace {...props} />
  }

  return <>{children}</>
}

const App = () => {
  return (
    <>
      <Router>
        <Layout>
          <Routes>
            <Route path='/login' element={<Auth />} />
            <Route path='/create' element={<CreateNewLog />} />
            <Route path='/' element={<CheckAuth><Home /></CheckAuth>} />
            <Route path='/me' element={<CheckAuth><UserSettings /></CheckAuth>} />

            <Route path='/g/:groupId' element={<CheckAuth><GroupPage /></CheckAuth>} />
          </Routes>
        </Layout>
      </Router>
    </>
  )
}

export default App
