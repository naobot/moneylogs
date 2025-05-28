// @ts-ignore
import { useState } from 'react'
import LoginHandler from '../../features/auth/components/LoginHandler'
import RegistrationHandler from '../../features/auth/components/RegistrationHandler'
import Button from '../../components/Button'

export const Auth = () => {
  const [currentView, setCurrentView] = useState('login')

  return (
    <div className='LoginPage Window'>
      <div className='Menu'>
        <Button
          onClick={() => setCurrentView('register')}
          isSelected={currentView === 'register'}
          buttonStyle='primary-border'
          text="I'm a new user"
        />
        <Button
          onClick={() => setCurrentView('login')}
          isSelected={currentView === 'login'}
          buttonStyle='primary-border'
          text="I have an account"
        />
      </div>
      {currentView === 'login' && <LoginHandler />}
      {currentView === 'register' && <RegistrationHandler />}
    </div>
  )
}