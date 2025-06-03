import { useCurrentUser } from "../../utils/auth"

export const UserSettings = () => {
  const { user } = useCurrentUser()

  return (
    <div className="Window">
      <div className="Window__heading">
        <p>hi {user?.displayName}</p>
        <p>please wait for nao to send you a group link</p>
      </div>
    </div>
  )
}