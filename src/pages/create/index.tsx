import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useCurrentUser } from "@/contexts";

import { useLogGroupQuery } from "@/hooks/useLogGroupQuery";
import { useMutation } from "@/hooks/useFirebase";

import { useLedgerQuery } from "@/hooks/useLedgerQuery";
import { Currency } from "@/types/user";
import { CURRENCIES, isCurrency, LAST_CURRENCY_KEY } from "@/utils/currency";
import { MAX_LEDGER_TITLE_LENGTH } from "@/utils/ledger";

import ControlledInput from "@/components/ControlledInput";
import Button from "@/components/Button";
import Tabs from "@/components/Tabs";

type LogMode = "social" | "financial";

const initialCurrency = (): Currency => {
  try {
    const last = localStorage.getItem(LAST_CURRENCY_KEY);
    return isCurrency(last) ? last : "JPY";
  } catch {
    return "JPY";
  }
};

export const CreateNewLog = () => {
  const navigate = useNavigate();
  const today = dayjs().format("YYYY-MM-DD");
  const oneMonth = dayjs().add(1, "month").format("YYYY-MM-DD");

  const [mode, setMode] = useState<LogMode>("social");
  const [defaultCurrency, setDefaultCurrency] = useState<Currency>(initialCurrency);
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
  const { createLedger } = useLedgerQuery();

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
      !!logGroupTitle.trim() &&
      !!user?.userId &&
      numParticipants <= 30 &&
      numParticipants > 0 &&
      logGroupTitle.length <= MAX_LEDGER_TITLE_LENGTH &&
      (mode === "financial" || !dateErrorMessage)
    );
  }, [logGroupTitle, user?.userId, numParticipants, dateErrorMessage, mode]);

  const handleCreateLedger = async () => {
    if (!user?.userId) return;
    try {
      const ledgerId = await createLedger.mutate({
        title: logGroupTitle,
        max_participants: numParticipants,
        defaultCurrency,
        member: { uid: user.userId, userDocId: user.id },
      });
      void navigate(`/l/${ledgerId}`);
    } catch (err) {
      console.error("Failed to create financial log:", err);
    }
  };

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
    <>
      <Tabs
        ariaLabel="Log type"
        activeId={mode}
        onChange={(id) => setMode(id as LogMode)}
        tabs={[
          { id: "social", label: "Social" },
          { id: "financial", label: "Financial" },
        ]}
      />
      <div className="Window CreateNewLog">
        <p className="CreateNewLog__hint">
          {mode === "social"
            ? "A time-boxed log group: everyone posts about their spending, and insights unlock when it ends."
            : "An ongoing spending tracker with categories and always-on stats. Keep it to yourself, or share it."}
        </p>
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
        {mode === "financial" && (
          <div className="ControlledInput">
            <div className="ControlledInput__input">
              <label htmlFor="ledger-default-currency">Default currency</label>
              <select
                id="ledger-default-currency"
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value as Currency)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
        {mode === "social" && (
          <>
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
          </>
        )}

        {mode === "social" && isError && (
          <div className="error-message">Failed to create log group. Please try again.</div>
        )}
        {mode === "financial" && createLedger.isError && (
          <div className="error-message">Failed to create financial log. Please try again.</div>
        )}

        <div className="Menu">
          {mode === "social" ? (
            <Button
              text="Start a new log group"
              size="lg"
              buttonStyle="primary-border"
              disabled={!isSubmittable}
              loading={createPending}
              onClick={handleCreateNewGroup}
            />
          ) : (
            <Button
              text="Start a financial log"
              size="lg"
              buttonStyle="primary-border"
              disabled={!isSubmittable || createLedger.isLoading}
              loading={createLedger.isLoading}
              onClick={handleCreateLedger}
            />
          )}
        </div>
      </div>
    </>
  );
};
