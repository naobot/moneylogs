import { signOut } from "firebase/auth"
import { Link, useNavigate } from "react-router-dom"
// @ts-ignore
import { auth } from '../../../config/firebase-config'
import Button from "../../../components/Button"
import { useEffect, useState } from "react"
import { useCurrentUser } from "../../../utils/auth"

const MainNav = () => {
  const navigate = useNavigate()
  const currentUserData = useCurrentUser()
  const isLoggedIn = !!currentUserData?.user
  const [signOutPending, setSignOutPending] = useState(false)

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
        <Button to='/me' title='My Preferences' icon='home' />
        <Button
          title="Sign out"
          onClick={() => handleSignOut()}
          loading={signOutPending}
          icon="exit"
        />
      </div>
      <div className='MainNav__item MainNav__header'>
        <Link to={'/'}>moneylogs</Link>
      </div>
      <div className="MainNev__item Menu">
        {isLoggedIn &&
        <>
          <Button
            title="New Log Group"
            to={'/create'}
            icon="document"
          />
          {isLoggedIn && currentUserData?.user && <>
            <Link to='/me'><strong>{currentUserData?.user?.displayName}</strong></Link>
          </>}
        </>}
      </div>
    </nav>
  )
}

export default MainNav