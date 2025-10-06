import { useEffect, useMemo, useState } from "react"
import { getFunctions, httpsCallable, connectFunctionsEmulator } from "firebase/functions"
import { getApp } from "firebase/app"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "@/config/firebase-config"
import { useCurrentUser } from "@/contexts"
import { Group, LogPost } from "@/types/user"

import { useGetComments } from "@/hooks/useGetLogPostComments"
import { FullUserData, useGetGroupUsers } from "@/hooks/useGetGroupUsers"
import { useGroupAnalytics } from "./hooks/useGroupAnalytics"

import Loader from "@/features/layout/components/Loader"
import SpendingInsights from "./SpendingInsights"
import HotPosts from "./HotPosts"
import LogPostComments from "../LogPosts/LogPostComments"

import './styles.scss'
import CustomDropdown, { DropdownOption } from "@/components/CustomDropdown"
import Button from "@/components/Button"

interface LogsSummaryProps {
  group: Group
  logPosts: Array<LogPost>
  groupMembers: FullUserData[]
}

interface ProcessingState {
  step: string
  percentage: number
  isComplete: boolean
}

const LogsSummary = ({ group, groupMembers, logPosts }: LogsSummaryProps) => {
  const { user: loggedInUser } = useCurrentUser()

  const [processingState, setProcessingState] = useState<ProcessingState | null>(null)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [hasStartedProcessing, setHasStartedProcessing] = useState<boolean>(false)

  const groupAnalytics = useGroupAnalytics(logPosts, group, groupMembers)

  const { users: members } = useGetGroupUsers(group.id)
  const memberIdToMembers = useMemo(() => {
    const map = new Map<string, FullUserData>()
    members.forEach((m) => {
      map.set(m.id, m)
    })
    return map
  }, [members])

  const [otherLogs, setOtherLogs] = useState<LogPost[] | null>(null)

  // Firebase Functions setup
  const app = getApp()
  const functions = getFunctions(app)

  // Connect to emulator if in development
  if (window.location.hostname === 'localhost') {
    connectFunctionsEmulator(functions, 'localhost', 5001)
  }

  const processAnalytics = httpsCallable(functions, 'processGroupAnalytics')

  const myLogs = useMemo(() => {
    return logPosts.filter(logPost => logPost.author.id === loggedInUser?.id)
  }, [logPosts, loggedInUser?.id])

  const handleSelectTestOtherLogs = (userId: string) => {
    setOtherLogs(logPosts.filter(logPost => logPost.author.id === userId))
  }

  const [selectedPost, setSelectedPost] = useState<LogPost | null>(null)

  const {
    data: comments,
    isLoading: isLoadingComments,
    isSuccess: isSuccessComments,
  } = useGetComments({
    logPostId: selectedPost?.id ?? null,
    forceFresh: true,
  })

  // Check if group is archived and needs analytics processing
  const isArchivedGroup = useMemo(() => {
    const now = new Date()
    const groupEndDate = new Date(group.end.seconds * 1000)
    return groupEndDate < now
  }, [group.end])

  const hasAnalytics = Boolean(group.analytics?.isCalculated)
  const needsProcessing = isArchivedGroup && !hasAnalytics && !hasStartedProcessing

  // Effect to handle analytics processing and progress tracking
  useEffect(() => {
    if (!needsProcessing || !loggedInUser) return

    // Prevent multiple processing attempts
    setHasStartedProcessing(true)

    let unsubscribe: (() => void) | null = null

    const startProcessing = async () => {
      try {
        // Set up listener for progress updates BEFORE starting processing
        const processingDocRef = doc(db, 'processing', group.id)
        unsubscribe = onSnapshot(processingDocRef, (doc) => {
          if (doc.exists()) {
            const data = doc.data() as ProcessingState
            setProcessingState(data)

            // If processing is complete, we can stop listening
            if (data.isComplete) {
              setTimeout(() => {
                setProcessingState(null)
                unsubscribe?.()
                // Don't reset hasStartedProcessing here - let the group data update handle it
              }, 2000) // Show "Complete!" for 2 seconds
            }
          }
        })

        // Start the analytics processing
        await processAnalytics({ groupId: group.id, groupEnd: group.end })

      } catch (error) {
        console.error('Failed to start analytics processing:', error)
        setAnalyticsError(error instanceof Error ? error.message : 'Unknown error')
        setProcessingState(null)
        // setHasStartedProcessing(false) // Reset on error so user can retry
        unsubscribe?.()
      }
    }

    startProcessing()

    // Cleanup function
    return () => {
      unsubscribe?.()
    }
  }, [needsProcessing, loggedInUser, group.id, processAnalytics])

  // Reset processing state when analytics become available
  useEffect(() => {
    if (hasAnalytics && hasStartedProcessing) {
      setHasStartedProcessing(false)
      setProcessingState(null)
      setAnalyticsError(null)
    }
  }, [hasAnalytics, hasStartedProcessing])

  const handleOpenComments = (post: LogPost, hasUnreadComments: boolean) => {
    setSelectedPost(post)
  }

  // Show loading state while processing
  if (processingState) {
    return (
      <div className="LogsSummary">
        <h2>Preparing insights for {group.title}</h2>
        <div className="Window">
          <h3>📊 Processing analytics...</h3>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ marginBottom: '1rem', fontSize: '1.1em' }}>
              {processingState.step}
            </p>
            <Loader progress={processingState.percentage} />
            <p style={{ marginTop: '1rem', color: '#666', fontSize: '0.9em' }}>
              This only happens once when the group is first archived
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show error state if analytics processing failed
  if (analyticsError) {
    return (
      <div className="LogsSummary">
        <h2>Insights for {group.title}</h2>
        <div className="Window">
          <h3>⚠️ Processing Error</h3>
          <p>Failed to process analytics: {analyticsError}</p>
          <p>Falling back to real-time analysis...</p>
        </div>

        {/* Fallback to original component structure */}
        <div className="Window">
          <h3>💰 {loggedInUser?.displayName}'s spending</h3>
          <SpendingInsights logPosts={myLogs} group={group}>
            <SpendingInsights.TotalText>
              You spent a <strong>total of</strong>
            </SpendingInsights.TotalText>
            {/* Add other components as needed */}
          </SpendingInsights>
        </div>
      </div>
    )
  }

  // Normal rendering (either with cached analytics or real-time calculation)
  return (
    <>
      <div className="LogsSummary">
        <h2>Insights for {group.title}</h2>

        {/*{hasAnalytics && (
          <div className="LogsSummary__badge">
            📈 Using cached analytics from {new Date(group.analytics.processedAt.seconds * 1000).toLocaleDateString()}
          </div>
        )}*/}

        {loggedInUser?.email === 'cui.naomi@gmail.com' && (
          <div>
            <CustomDropdown
              options={group.members.map(m => ({
                value: m.id,
                label: memberIdToMembers.get(m.id)?.displayName ?? m.id,
              }))}
              onSelect={(option: DropdownOption) => {
                handleSelectTestOtherLogs(option.value)
              }}
            >
              <Button
                text="Select user"
              />
            </CustomDropdown>
          </div>
        )}

        {loggedInUser?.email === 'cui.naomi@gmail.com' && otherLogs && otherLogs?.length > 0 && (
          <div className="Window">
            <h3>💰 {memberIdToMembers.get(otherLogs?.[0].author.id)?.displayName}'s spending</h3>

            <SpendingInsights user={memberIdToMembers.get(otherLogs?.[0].author.id)} logPosts={otherLogs} group={group}>
              <SpendingInsights.TotalText>
                This user spent a <strong>total of</strong>
              </SpendingInsights.TotalText>

              <SpendingInsights.WeekText>
                This user <strong>spent the most</strong> during the <strong>week(s) of</strong>
              </SpendingInsights.WeekText>

              <SpendingInsights.DayText showPosts={true}>
                This user <strong>day you spent the most</strong> was
              </SpendingInsights.DayText>

              <SpendingInsights.AveragesText>
                Here are this user's average <strong>spending patterns</strong>:
              </SpendingInsights.AveragesText>

              <SpendingInsights.WeekendWeekdayText>
                {''}
              </SpendingInsights.WeekendWeekdayText>

              <SpendingInsights.NoSpendDaysText>
                This user had <strong>no spending</strong> on
              </SpendingInsights.NoSpendDaysText>

              <SpendingInsights.LowSpenderAlert groupAnalytics={groupAnalytics}>
                💡 <strong>Good news!</strong>
              </SpendingInsights.LowSpenderAlert>
            </SpendingInsights>
          </div>
        )}


        {loggedInUser && (
          <div className="Window">
            <h3>💰 {loggedInUser?.displayName}'s spending</h3>
            <SpendingInsights user={memberIdToMembers.get(loggedInUser.id)} logPosts={myLogs} group={group}>
              <SpendingInsights.TotalText>
                You spent a <strong>total of</strong>
              </SpendingInsights.TotalText>

              <SpendingInsights.WeekText>
                You <strong>spent the most</strong> during the <strong>week(s) of</strong>
              </SpendingInsights.WeekText>

              <SpendingInsights.DayText showPosts={true}>
                The <strong>day you spent the most</strong> was
              </SpendingInsights.DayText>

              <SpendingInsights.AveragesText>
                Here are your average <strong>spending patterns</strong>:
              </SpendingInsights.AveragesText>

              <SpendingInsights.WeekendWeekdayText>
                {''}
              </SpendingInsights.WeekendWeekdayText>

              <SpendingInsights.NoSpendDaysText>
                You logged <strong>no spending</strong> on
              </SpendingInsights.NoSpendDaysText>

              <SpendingInsights.LowSpenderAlert groupAnalytics={groupAnalytics}>
                💡 <strong>Good news!</strong>
              </SpendingInsights.LowSpenderAlert>
            </SpendingInsights>
          </div>
        )}

        <div className="Window">
          <h3>💸 group spending</h3>
          <SpendingInsights logPosts={logPosts} group={group}>
            <SpendingInsights.TotalText>
              The group spent a <strong>total of</strong>
            </SpendingInsights.TotalText>

            <SpendingInsights.WeekText>
              The group <strong>spent the most</strong> during the <strong>weeks of</strong>
            </SpendingInsights.WeekText>

            <SpendingInsights.DayText showPosts={true} showAuthors={true} showMultipleDays={true}>
              The <strong>days the group spent the most</strong> were
            </SpendingInsights.DayText>
          </SpendingInsights>
        </div>

        <HotPosts
          logPosts={logPosts}
          groupMembers={groupMembers}
          groupId={group.id}
          onOpenComments={handleOpenComments}
          selectedPostId={selectedPost?.id ?? null}
          setSelectedPost={setSelectedPost}
        />
      </div>

      <div className="LogsSummaryRight LogPostComments">
        {selectedPost && (
          <LogPostComments
            currentLogAuthorId={selectedPost.author?.id}
            postId={selectedPost.id}
            comments={comments}
            isLoadingComments={isLoadingComments}
            isSuccessComments={isSuccessComments}
            isReadOnly={true}
          />
        )}
      </div>
      {selectedPost && <div className="LogPostComments__handler handler" onClick={() => setSelectedPost(null)}></div>}
    </>
  )
}

export default LogsSummary