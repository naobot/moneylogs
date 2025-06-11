import dayjs from "dayjs"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { useCurrentUser } from "@/contexts"

import { useLogGroupQuery } from "@/hooks/useLogGroupQuery"
import { useMutation } from "@/hooks/useFirebase"

import ControlledInput from "@/components/ControlledInput"
import Button from "@/components/Button"


export const CreateNewLog = () => {
  const navigate = useNavigate()
  const today = dayjs().format('YYYY-MM-DD')
  const oneMonth = dayjs().add(1, 'month').format('YYYY-MM-DD')

  const [logGroupTitle, setLogGroupTitle] = useState('')
  const [numParticipants, setNumParticipants] = useState(10)
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(oneMonth)

  const { user } = useCurrentUser()
  const { addNewLogGroup } = useLogGroupQuery()

  const { mutate: createGroup, isLoading: createPending, isError, error } = useMutation(
    async (groupData: {
      title: string
      max_participants: number
      start: string
      end: string
      currentUserId: string
    }) => {
      return await addNewLogGroup.mutate(groupData)
    }
  )

  const isSubmittable = useMemo(() => {
    return !!logGroupTitle &&
           !!user?.userId &&
           numParticipants > 0 &&
           !dayjs(endDate).isBefore(dayjs(startDate))
  }, [logGroupTitle, user?.userId, numParticipants, startDate, endDate])

  const handleCreateNewGroup = async () => {
    if (!user?.userId) return

    try {
      await createGroup({
        title: logGroupTitle,
        max_participants: numParticipants,
        start: startDate,
        end: endDate,
        currentUserId: user.userId,
      })

      console.log('Successfully created new log group')
      navigate('/')
    } catch (err) {
      console.error('Failed to create log group:', err)
      // Error state is handled by useMutation
    }
  }

  return (
    <div className="Window CreateNewLog">
      <ControlledInput
        onChange={(e: any) => setLogGroupTitle(e?.target?.value)}
        label="Title"
        value={logGroupTitle}
      />
      <ControlledInput
        onChange={(e: any) => setNumParticipants(Number(e?.target?.value))}
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

      {isError && (
        <div className="error-message">
          Failed to create log group. Please try again.
        </div>
      )}

      <div className="Menu">
        <Button
          text="Start a new log group"
          size="lg"
          buttonStyle="primary-border"
          disabled={!isSubmittable}
          loading={createPending}
          onClick={handleCreateNewGroup}
        />
      </div>
    </div>
  )
}