import cx from 'classnames'
import { useEffect, useMemo, useState } from "react"
import { useTimezoneSelect, allTimezones } from "react-timezone-select"

import { useCurrentUser } from '@/contexts'

import { useGetCurrentGroups } from '@/hooks/useGetCurrentGroups'
import { useMutation } from '@/hooks/useFirebase'
import { useUserQuery } from '@/hooks/useUserQuery'
import { useReadTracking } from '@/hooks/useReadTracking'

import Button from "@/components/Button"
import ControlledInput from "@/components/ControlledInput"

import "./me.scss";
import GroupArchive from '@/features/moneylog/components/GroupArchive'
import dayjs from 'dayjs'


export const UserSettings = () => {
  const { allGroups, isSuccess, isLoading, isError } = useGetCurrentGroups()

  const { trackUserAction } = useReadTracking()
  const { user } = useCurrentUser()
  const { options, parseTimezone } = useTimezoneSelect({ labelStyle: 'original', timezones: allTimezones })

  const [newDisplayName, setNewDisplayName] = useState('')
  const [newDisplayLocation, setNewDisplayLocation] = useState('')
  const [newTimezone, setNewTimezone] = useState<string>()

  const isSubmittable = useMemo(() => {
    return !!user?.userId && !!newTimezone
  }, [user?.userId, newTimezone])

  const { updateUserProfile } = useUserQuery()

  const { mutate: updateUserInfo, isLoading: createPending } = useMutation(
    async (userData: {
      userId: string
      displayName: string
      displayLocation?: string
      timezone: string
    }) => {
      await updateUserProfile.mutate(userData)

      trackUserAction('update_user_profile', {
        user_id: user?.id,
      })

      return
    }
  )

  useEffect(() => {
    if (user?.displayName) {
      setNewDisplayName(user?.displayName)
    }
    if (user?.displayLocation) {
      setNewDisplayLocation(user?.displayLocation)
    }
    if (user?.timezone) {
      setNewTimezone(user?.timezone)
    }
  }, [user])

  const handleUpdateUserInfo = async () => {
    if (!user?.userId || !newTimezone) return

    try {
      await updateUserInfo({
        userId: user?.id,
        displayName: newDisplayName,
        displayLocation: newDisplayLocation ?? undefined,
        timezone: newTimezone,
      })

      console.log('Successfully updated user info')
    } catch (err) {
      console.error('Failed to update user info:', err)
      // Error state is handled by useMutation
    }
  }

  return (
    <div className="Window UserSettings">
      <div className="Window__heading">
        {user?.displayName && <h2>hi {user?.displayName}</h2>}
      </div>

      <div className="UserSettings__form">
        <ControlledInput
          onChange={(e: any) => setNewDisplayName(e?.target?.value)}
          label="Display name"
          value={newDisplayName}
        />

        <ControlledInput
          onChange={(e: any) => setNewDisplayLocation(e?.target?.value)}
          label="Display location"
          value={newDisplayLocation}
        />

        {newDisplayName.length > 0 && (
          <p>
            Your name will display as <strong>{newDisplayName} {newDisplayLocation.length > 0 && <>({newDisplayLocation})</>}</strong>
          </p>
        )}

        <div
          className={cx("ControlledInput", {
            "ControlledInput--warning": !newTimezone
          })}
        >
          <label>
            My timezone is
          </label>
          <select
            onChange={(e) => {
              parseTimezone(e.currentTarget.value)
              setNewTimezone(e.currentTarget.value)
            }}
            value={newTimezone}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="Menu">
        <Button
          text="Set my user profile"
          size="lg"
          buttonStyle="primary-border"
          disabled={!isSubmittable}
          loading={createPending}
          onClick={handleUpdateUserInfo}
        />
      </div>

      {isSuccess && allGroups.length > 0 && ( // TODO improve this area lol
        <div>
          <h3>Upcoming groups</h3>
          <GroupArchive groups={allGroups.filter((g) => {
            return dayjs(g.start.toDate()).isAfter(dayjs())
          })} />
          <h3>Past groups</h3>
          <GroupArchive groups={allGroups.filter((g) => {
            return dayjs(g.end.toDate()).isBefore(dayjs())
          })} />
        </div>
      )}
    </div>
  )
}