import dayjs from "dayjs"
import { useMemo, useState } from "react"
import { useLogGroupQuery } from "../../hooks/useLogGroupQuery"
// import { useGetUserInfo } from "../../hooks/useGetUserInfo"

import ControlledInput from "../../components/ControlledInput"
import Button from "../../components/Button"
import { AuthUser } from "../../types/user"
import { useNavigate } from "react-router-dom"

export const CreateNewLog = () => {
  const { navigate } = useNavigate()
  const today = dayjs().format('YYYY-MM-DD')
  const oneMonth = dayjs().add(1, 'month').format('YYYY-MM-DD')

  const [logGroupTitle, setLogGroupTitle] = useState('')
  const [numParticipants, setNumParticipants] = useState(10)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(oneMonth)
  const [createPending, setCreatePending] = useState(false)

  const currentUserId = (JSON.parse(localStorage.getItem('auth') ?? '') as AuthUser).userId

  // const { user } = useGetUserInfo()
  const { addNewLogGroup } = useLogGroupQuery()

  const isSubmittable = useMemo(() => {
    return !!logGroupTitle && numParticipants > 0 && !dayjs(endDate).isBefore(dayjs(startDate))
  }, [startDate, endDate])

  const handleCreateNewGroup = () => {
    setCreatePending(true)
    console.log('hello user ' + currentUserId)
    addNewLogGroup({
      title: logGroupTitle,
      max_participants: numParticipants,
      start: startDate,
      end: endDate,
      currentUserId: currentUserId,
    })
      .then(() => {
        setCreatePending(false)
        console.log('successfully created new log group')
        navigate('/')
      })
  }

  return (
    <div className="Window CreateNewLog">
      <ControlledInput
        onChange={(e: any) => setLogGroupTitle(e?.target?.value)}
        label="Title"
        value={logGroupTitle}
      />
      <ControlledInput
        onChange={(e: any) => setNumParticipants(e?.target?.value)}
        label="Max no. of participants"
        value={numParticipants}
        type="number"
      />
      <ControlledInput
        onChange={(e: any) => setStartDate(e?.target?.value)}
        label="Start date"
        value={startDate}
        type="date"
      />
      <ControlledInput
        onChange={(e: any) => setEndDate(e?.target?.value)}
        label="End date"
        value={endDate}
        type="date"
        isError={dayjs(endDate).isBefore(dayjs(startDate))}
      />
      <div className="Menu">
        <Button
          text="Start a new log group"
          size="lg"
          buttonStyle="primary-border"
          disabled={!isSubmittable}
          loading={createPending}
          onClick={() => handleCreateNewGroup()}
        />
      </div>
    </div>
  )
}