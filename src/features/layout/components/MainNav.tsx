import { useEffect, useMemo, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
// @ts-ignore
import { auth } from '@/config/firebase-config'
import { signOut } from "firebase/auth"

import { useCurrentUser } from "@/utils/auth"
import { useGetCurrentGroups } from "@/hooks/useGetCurrentGroups"

import Button from "@/components/Button"

const MainNav = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const isHome = location.pathname === '/'
  const currentGroupId = location.pathname.match(/\/g\/([^\/]+)/)?.[1]
  const { currentGroups, isSuccess, isLoading, isError } = useGetCurrentGroups()
  const highlightedGroupId = useMemo(() => {
    if (currentGroupId) {
      return currentGroupId
    } else if (isHome && currentGroups) {
      return currentGroups[0]?.id
    }
    return null
  }, [currentGroupId, currentGroups, isHome])
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
        {isLoggedIn &&
        <>
          <Button to='/' title='Home' icon='home' />
          {/*<Button to='/me' title='My Preferences' icon='user' />*/}
          {isLoading && <div>...</div>}
          {isSuccess && <div className="MainNav__list">
            {currentGroups.map((group) => (
              <Button
                key={group.id}
                to={`/g/${group.id}`}
                title={group.title}
                text={group.title}
                buttonStyle="primary-border-lite"
                isSelected={highlightedGroupId == group?.id}
              />
            ))}
          </div>}
          <Button
            title="New Log Group"
            to={'/create'}
            text="+"
            buttonStyle="primary-border-lite"
          />
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