import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useCurrentUser } from "@/contexts";

import { useLogGroupQuery } from "@/hooks/useLogGroupQuery";
import { useMutation } from "@/hooks/useFirebase";

import ControlledInput from "@/components/ControlledInput";
import Button from "@/components/Button";

export const CreateNewLog = () => {
  const navigate = useNavigate();
  const today = dayjs().format("YYYY-MM-DD");
  const oneMonth = dayjs().add(1, "month").format("YYYY-MM-DD");

  const [logGroupTitle, setLogGroupTitle] = useState("");
  const [numParticipants, setNumParticipants] = useState(10);
  const [startDate, setStartDate] = useState(today);
  const [startTime, setStartTime] = useState("00:00");
  const [endDate, setEndDate] = useState(oneMonth);
  const [endTime, setEndTime] = useState("23:59");
  const dateErrorMessage = useMemo(() => {
    if (dayjs(endDate).isBefore(dayjs(startDate))) {
      return "Invalid date";
    } else if (dayjs(endDate).subtract(31, "day").isAfter(dayjs(startDate))) {
      return "Date must be within a month from start date";
    }
    return;
  }, [endDate, startDate]);

  const { user } = useCurrentUser();
  const { addNewLogGroup } = useLogGroupQuery();

  const {
    mutate: createGroup,
    isLoading: createPending,
    isError,
  } = useMutation(
    async (groupData: {
      title: string;
      max_participants: number;
      startWallClock: string;
      endWallClock: string;
      currentUserId: string;
    }) => {
      return await addNewLogGroup.mutate(groupData);
    },
  );

  const isSubmittable = useMemo(() => {
    return (
      !!logGroupTitle &&
      !!user?.userId &&
      numParticipants <= 30 &&
      numParticipants > 0 &&
      logGroupTitle.length <= 20 &&
      !dateErrorMessage
    );
  }, [logGroupTitle, user?.userId, numParticipants, dateErrorMessage]);

  const handleCreateNewGroup = async () => {
    if (!user?.userId) return;

    try {
      await createGroup({
        title: logGroupTitle,
        max_participants: numParticipants,
        startWallClock: `${startDate}T${startTime}`,
        endWallClock: `${endDate}T${endTime}`,
        currentUserId: user.userId,
      });

      console.log("Successfully created new log group");
      navigate("/");
    } catch (err) {
      console.error("Failed to create log group:", err);
      // Error state is handled by useMutation
    }
  };

  return (
    <div className="Window CreateNewLog">
      <ControlledInput
        onChange={(e) => setLogGroupTitle(e.target.value)}
        label="Title"
        value={logGroupTitle}
        isError={logGroupTitle.length > 20}
        errorMessage="Title must be under 20 characters"
      />
      <ControlledInput
        onChange={(e) => setNumParticipants(Number(e.target.value))}
        label="Max no. of participants"
        value={numParticipants}
        type="number"
        max={30}
        min={1}
        isError={numParticipants > 30 || numParticipants < 1}
        errorMessage="Invalid number"
      />
      <ControlledInput
        onChange={(e) => setStartDate(e.target.value)}
        label="Start date"
        value={startDate}
        type="date"
      />
      <ControlledInput
        onChange={(e) => setStartTime(e.target.value)}
        label="Start time (your local time)"
        value={startTime}
        type="time"
      />
      <ControlledInput
        onChange={(e) => setEndDate(e.target.value)}
        label="End date"
        value={endDate}
        type="date"
        isError={!!dateErrorMessage}
        errorMessage={dateErrorMessage}
      />
      <ControlledInput
        onChange={(e) => setEndTime(e.target.value)}
        label="End time (your local time)"
        value={endTime}
        type="time"
      />

      {isError && (
        <div className="error-message">Failed to create log group. Please try again.</div>
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
  );
};
