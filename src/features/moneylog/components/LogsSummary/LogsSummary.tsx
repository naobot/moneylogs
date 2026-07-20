import { useEffect, useMemo, useState } from "react";
import cx from "classnames";
import { httpsCallable } from "firebase/functions";
import { doc, onSnapshot } from "firebase/firestore";
import { db, functions } from "@/config/firebase-config";
import { useCurrentUser } from "@/contexts";
import { Group, LogPost } from "@/types/user";

import { useGetComments } from "@/hooks/useGetLogPostComments";
import { useDisableScroll } from "@/hooks/useDisableScroll";
import { FullUserData } from "@/hooks/useGetGroupUsers";
import { useGroupAnalytics } from "./hooks/useGroupAnalytics";
import {
  Achievement,
  awardGroupAchievements,
  mergeGroupAchievements,
  useGetAchievements,
} from "@/hooks/useAchievements";

import Loader from "@/features/layout/components/Loader";
import SpendingPanel from "./SpendingPanel";
import HotPosts from "./HotPosts";
import AchievementsBanner from "./AchievementsBanner";
import LogPostComments from "@/features/moneylog/components/LogPosts/LogPostComments";

import "./styles.scss";
import CustomDropdown, { DropdownOption } from "@/components/CustomDropdown";
import Button from "@/components/Button";
import Tabs, { TabItem } from "@/components/Tabs";

interface LogsSummaryProps {
  group: Group;
  logPosts: Array<LogPost>;
  groupMembers: FullUserData[];
  // True while log posts are still being fetched (e.g. switching groups on a slow
  // connection), so spending panels show a loading state instead of an empty one.
  isLoading?: boolean;
}

interface ProcessingState {
  step: string;
  percentage: number;
  isComplete: boolean;
}

const LogsSummary = ({ group, groupMembers, logPosts, isLoading = false }: LogsSummaryProps) => {
  const { user: loggedInUser } = useCurrentUser();

  const [processingState, setProcessingState] = useState<ProcessingState | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [hasStartedProcessing, setHasStartedProcessing] = useState<boolean>(false);
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const { achievements: heldAchievements } = useGetAchievements(loggedInUser?.id);

  // The banner persists across visits, so show everything this user holds for this
  // group rather than only what was unlocked on this particular view.
  const groupAchievements = useMemo(
    () => mergeGroupAchievements(heldAchievements, newAchievements, group.id),
    [heldAchievements, newAchievements, group.id],
  );

  const groupAnalytics = useGroupAnalytics(logPosts, group, groupMembers);

  const memberIdToMembers = useMemo(() => {
    const map = new Map<string, FullUserData>();
    groupMembers.forEach((m) => {
      map.set(m.id, m);
    });
    return map;
  }, [groupMembers]);

  const [otherLogs, setOtherLogs] = useState<LogPost[] | null>(null);
  const [spendingTab, setSpendingTab] = useState<"mine" | "group" | "other">("mine");

  const isAdmin = loggedInUser?.email === "cui.naomi@gmail.com";

  const processAnalytics = useMemo(() => httpsCallable(functions, "processGroupAnalytics"), []);

  const myLogs = useMemo(() => {
    return logPosts.filter((logPost) => logPost.author.id === loggedInUser?.id);
  }, [logPosts, loggedInUser?.id]);

  const handleSelectTestOtherLogs = (userId: string) => {
    setOtherLogs(logPosts.filter((logPost) => logPost.author.id === userId));
    setSpendingTab("other");
  };

  const otherUser = otherLogs?.[0] ? memberIdToMembers.get(otherLogs[0].author.id) : undefined;

  const [selectedPost, setSelectedPost] = useState<LogPost | null>(null);
  useDisableScroll(!!selectedPost);

  const {
    data: comments,
    isLoading: isLoadingComments,
    isSuccess: isSuccessComments,
  } = useGetComments({
    logPostId: selectedPost?.id ?? null,
    forceFresh: true,
  });

  // Check if group is archived and needs analytics processing
  const isArchivedGroup = useMemo(() => {
    const now = new Date();
    const groupEndDate = new Date(group.end.seconds * 1000);
    return groupEndDate < now;
  }, [group.end]);

  const hasAnalytics = Boolean(group.analytics?.isCalculated);
  const needsProcessing = isArchivedGroup && !hasAnalytics && !hasStartedProcessing;

  // Effect to handle analytics processing and progress tracking
  useEffect(() => {
    if (!needsProcessing || !loggedInUser) return;

    // Prevent multiple processing attempts
    setHasStartedProcessing(true);

    let unsubscribe: (() => void) | null = null;

    const startProcessing = async () => {
      try {
        // Set up listener for progress updates BEFORE starting processing
        const processingDocRef = doc(db, "processing", group.id);
        unsubscribe = onSnapshot(processingDocRef, (doc) => {
          if (doc.exists()) {
            const data = doc.data() as ProcessingState;
            setProcessingState(data);

            // If processing is complete, we can stop listening
            if (data.isComplete) {
              setTimeout(() => {
                setProcessingState(null);
                unsubscribe?.();
                // Don't reset hasStartedProcessing here - let the group data update handle it
              }, 2000); // Show "Complete!" for 2 seconds
            }
          }
        });

        // Start the analytics processing
        await processAnalytics({ groupId: group.id, groupEnd: group.end });
      } catch (error) {
        console.error("Failed to start analytics processing:", error);
        setAnalyticsError(error instanceof Error ? error.message : "Unknown error");
        setProcessingState(null);
        // setHasStartedProcessing(false) // Reset on error so user can retry
        unsubscribe?.();
      }
    };

    void startProcessing();

    // Cleanup function
    return () => {
      unsubscribe?.();
    };
  }, [needsProcessing, loggedInUser, group.id, group.end, processAnalytics]);

  // Reset processing state when analytics become available
  useEffect(() => {
    if (hasAnalytics && hasStartedProcessing) {
      setHasStartedProcessing(false);
      setProcessingState(null);
      setAnalyticsError(null);
    }
  }, [hasAnalytics, hasStartedProcessing]);

  // Award achievements once when viewing a completed group's summary.
  // Uses deterministic doc IDs so repeat visits are no-ops.
  useEffect(() => {
    if (!isArchivedGroup || !loggedInUser?.id || logPosts.length === 0) return;

    let cancelled = false;
    awardGroupAchievements({
      userId: loggedInUser.id,
      groupId: group.id,
      groupTitle: group.title,
      logPosts,
    })
      .then((unlocked) => {
        if (!cancelled && unlocked.length > 0) setNewAchievements(unlocked);
      })
      .catch((err) => console.error("Failed to award achievements:", err));

    return () => {
      cancelled = true;
    };
  }, [isArchivedGroup, loggedInUser?.id, group.id, group.title, logPosts]);

  const handleOpenComments = (post: LogPost, _hasUnreadComments: boolean) => {
    setSelectedPost(post);
  };

  // Show loading state while processing
  if (processingState) {
    return (
      <div className="LogsSummary">
        <h2>Preparing insights for {group.title}</h2>
        <div className="Window">
          <h3>Processing analytics...</h3>
          <div style={{ padding: "2rem", textAlign: "center" }}>
            <p style={{ marginBottom: "1rem", fontSize: "1.1em" }}>{processingState.step}</p>
            <Loader progress={processingState.percentage} />
            <p style={{ marginTop: "1rem", color: "#666", fontSize: "0.9em" }}>
              This only happens once when the group is first archived
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if analytics processing failed
  if (analyticsError) {
    return (
      <div className="LogsSummary">
        <h2>Insights for {group.title}</h2>
        <div className="Window">
          <h3>Processing error</h3>
          <p>Failed to process analytics: {analyticsError}</p>
          <p>Falling back to real-time analysis...</p>
        </div>

        {/* Fallback to real-time spending panel */}
        {loggedInUser && (
          <div className="Window">
            <SpendingPanel
              scope="mine"
              user={memberIdToMembers.get(loggedInUser.id) ?? {}}
              logPosts={myLogs}
              group={group}
              groupAnalytics={groupAnalytics}
              isLoading={isLoading}
            />
          </div>
        )}
      </div>
    );
  }

  // Normal rendering (either with cached analytics or real-time calculation)
  return (
    <>
      <div className={cx("LogsSummary", { "disable-scroll": !!selectedPost })}>
        <AchievementsBanner
          achievements={groupAchievements}
          hasNewlyUnlocked={newAchievements.length > 0}
        />

        {isAdmin && (
          <div>
            <CustomDropdown
              options={group.members.map((m) => ({
                value: m.id,
                label: memberIdToMembers.get(m.id)?.displayName ?? m.id,
              }))}
              onSelect={(option: DropdownOption) => {
                handleSelectTestOtherLogs(option.value);
              }}
            >
              <Button text="Select user" />
            </CustomDropdown>
          </div>
        )}

        <div className="LogsSummary__spending">
          <Tabs
            ariaLabel="Spending view"
            activeId={spendingTab}
            onChange={(id) => setSpendingTab(id as "mine" | "group" | "other")}
            tabs={
              [
                { id: "mine", label: "My spending" },
                { id: "group", label: "Group spending" },
                ...(isAdmin && otherUser ? [{ id: "other", label: otherUser.displayName }] : []),
              ] as TabItem[]
            }
          />

          <div className="Window LogsSummary__spending__body">
            {spendingTab === "mine" && loggedInUser && (
              <SpendingPanel
                key="mine"
                scope="mine"
                user={memberIdToMembers.get(loggedInUser.id) ?? {}}
                logPosts={myLogs}
                group={group}
                groupAnalytics={groupAnalytics}
                isLoading={isLoading}
              />
            )}

            {spendingTab === "group" && (
              <SpendingPanel
                key="group"
                scope="group"
                user={{}}
                logPosts={logPosts}
                group={group}
                groupAnalytics={groupAnalytics}
                isLoading={isLoading}
              />
            )}

            {spendingTab === "other" && otherLogs && otherUser && (
              <SpendingPanel
                key={`other-${otherUser.id}`}
                scope="other"
                user={otherUser}
                logPosts={otherLogs}
                group={group}
                groupAnalytics={groupAnalytics}
                isLoading={isLoading}
              />
            )}
          </div>
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
      {selectedPost && (
        <div
          className="LogPostComments__handler handler"
          onClick={() => setSelectedPost(null)}
        ></div>
      )}
    </>
  );
};

export default LogsSummary;
