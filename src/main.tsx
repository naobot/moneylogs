import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import './utils/configuredDayjs'
import { CurrentUserProvider } from './contexts/CurrentUserContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CurrentUserProvider>
      <App />
    </CurrentUserProvider>
  </StrictMode>,
)
