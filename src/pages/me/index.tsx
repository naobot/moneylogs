// import { useState } from "react"
// import ControlledInput from "../../components/ControlledInput"
// import Button from "../../components/Button"
import { useGetUserInfo } from "../../hooks/useGetUserInfo"

export const UserSettings = () => {
  const { user } = useGetUserInfo()
  // const [newName, setNewName] = useState('')

  return (
    <div className="Window">
      <div className="Window__heading">
        hi {user?.displayName}
      </div>
      {/*<div>
        <ControlledInput value={user?.displayName ?? newName} onChange={(e: any) => setNewName(e?.target?.value)} label='Name' />
      </div>
      <div>
        <Button text="Submit" onClick={() => {}} />
      </div>*/}
    </div>
  )
}