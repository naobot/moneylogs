import { useEffect, useState } from "react"
import { signOut } from "firebase/auth"
import { Link, useNavigate } from "react-router-dom"
// @ts-ignore
import { auth } from '../../../config/firebase-config'

import { useCurrentUser } from "../../../utils/auth"
import { useGetCurrentGroups } from "../../../hooks/useGetCurrentGroups"

import Button from "../../../components/Button"

const MainNav = () => {
  const navigate = useNavigate()
  const currentUserData = useCurrentUser()
  const isLoggedIn = !!currentUserData?.user
  const [signOutPending, setSignOutPending] = useState(false)

  const { currentGroups, isSuccess, isLoading, isError } = useGetCurrentGroups()

  const handleSignOut = () => {
    setSignOutPending(true)
    signOut(auth)
      .then(() => {
        console.log('sign out successful')
        localStorage.removeItem('auth')
        setSignOutPending(false)
        navigate('/login')
      })
      .catch((error) => {
        const errorCode = error.code
        const errorMessage = error.message
        setSignOutPending(false)
        console.log(`${errorCode}: ${errorMessage}`)
      })
  }

  return (
    <nav className='MainNav'>
      <div className='MainNav__item Menu'>
        {isLoggedIn &&
        <>
          <Button to='/me' title='My Preferences' icon='home' />
          <Button
            title="New Log Group"
            to={'/create'}
            icon="document"
          />
          {isLoading && <div>...</div>}
          {isSuccess && <div className="MainNav__list">
            {currentGroups.map((group) => (
              <Button
                key={group.id}
                to={`/g/${group.id}`}
                title={group.title}
                text={group.title}
                buttonStyle="primary-border-lite"
              />
            ))}
          </div>}
        </>}
      </div>
      <div className='MainNav__item MainNav__header'>
        {/*<Link to={'/'}>moneylogs</Link>*/}
      </div>
      <div className="MainNev__item Menu">
        <Button
          title="Sign out"
          onClick={() => handleSignOut()}
          loading={signOutPending}
          icon="exit"
        />
      </div>
    </nav>
  )
}

export default MainNav