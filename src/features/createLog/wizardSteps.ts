import dayjs from "@/utils/configuredDayjs";
import { Currency } from "@/types/user";
import { MAX_CATEGORY_NAME_LENGTH, MAX_LEDGER_TITLE_LENGTH } from "@/utils/ledger";

export type LogMode = "social" | "financial";

export type WizardStep =
  | "type"
  | "basics"
  | "parent"
  | "schedule"
  | "currency"
  | "friends"
  | "review";

export type WizardState = {
  mode: LogMode | null;
  title: string;
  maxParticipants: number;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  defaultCurrency: Currency;
  /** Friends (user doc ids) to invite once the log exists. */
  inviteFriendIds: string[];
  /** Financial: the log this one is a sublog of, or null for one that stands alone. */
  parentId: string | null;
  /** Its line in the parent; blank means the title. */
  sublogName: string;
};

export const MAX_TITLE_LENGTH = MAX_LEDGER_TITLE_LENGTH;
export const MAX_PARTICIPANTS = 30;
const MAX_SOCIAL_DAYS = 31;

export const STEP_LABELS: Record<WizardStep, string> = {
  type: "Type",
  basics: "Basics",
  parent: "Part of",
  schedule: "Dates",
  currency: "Currency",
  friends: "Friends",
  review: "Review",
};

/**
 * The ordered steps for a mode. Before a mode is picked, only the first step exists.
 * `withFriends` adds the optional invite step, for logs with room for more than you.
 */
export const stepsFor = (mode: LogMode | null, withFriends = false): WizardStep[] => {
  const friends: WizardStep[] = withFriends ? ["friends"] : [];
  if (mode === "social") return ["type", "basics", "schedule", ...friends, "review"];
  if (mode === "financial") return ["type", "basics", "parent", "currency", ...friends, "review"];
  return ["type"];
};

/** A log for just you has nobody to invite. */
export const hasRoomForFriends = (s: Pick<WizardState, "maxParticipants">): boolean =>
  s.maxParticipants > 1;

/** The steps for the wizard as it stands. */
export const stepsForState = (s: WizardState): WizardStep[] =>
  stepsFor(s.mode, hasRoomForFriends(s));

/**
 * The friends to invite on creation: never more than the log has spots for besides
 * you (the cap may have been lowered after picking), and nobody when it's just you.
 */
export const friendsToInvite = (s: WizardState): string[] =>
  hasRoomForFriends(s) ? s.inviteFriendIds.slice(0, s.maxParticipants - 1) : [];

export const titleError = (title: string): string | undefined => {
  if (title.length > MAX_TITLE_LENGTH)
    return `Title must be ${MAX_TITLE_LENGTH} characters or fewer`;
  return undefined;
};

/** The sublog's line in its parent: a category name, so the same length limit. */
export const sublogNameError = (name: string): string | undefined =>
  name.trim().length > MAX_CATEGORY_NAME_LENGTH
    ? `Must be ${MAX_CATEGORY_NAME_LENGTH} characters or fewer`
    : undefined;

/**
 * What a link into the wizard fills in: `?parent=<ledgerId>` (from a log's "start a
 * sublog") starts a financial log already picked as that log's sublog.
 */
export const presetFromParams = (params: URLSearchParams): Partial<WizardState> => {
  const parentId = params.get("parent");
  return parentId ? { mode: "financial", parentId } : {};
};

/** What the new log counts as in its parent. */
export const sublogLineName = (s: Pick<WizardState, "sublogName" | "title">): string =>
  (s.sublogName.trim() || s.title.trim()).slice(0, MAX_CATEGORY_NAME_LENGTH);

export const participantsError = (n: number): string | undefined =>
  !Number.isInteger(n) || n < 1 || n > MAX_PARTICIPANTS
    ? `Choose between 1 and ${MAX_PARTICIPANTS}`
    : undefined;

// Same rules as the original single-page social form.
export const scheduleError = (startDate: string, endDate: string): string | undefined => {
  if (!startDate || !endDate) return "Pick a start and end date";
  if (dayjs(endDate).isBefore(dayjs(startDate))) return "End date can't be before the start date";
  if (dayjs(endDate).subtract(MAX_SOCIAL_DAYS, "day").isAfter(dayjs(startDate))) {
    return "Date must be within a month from start date";
  }
  return undefined;
};

/** Whether the given step's inputs are complete and valid. */
export const isStepValid = (step: WizardStep, s: WizardState): boolean => {
  switch (step) {
    case "type":
      return s.mode !== null;
    case "basics":
      return !!s.title.trim() && !titleError(s.title) && !participantsError(s.maxParticipants);
    case "schedule":
      return !!s.startTime && !!s.endTime && !scheduleError(s.startDate, s.endDate);
    case "parent":
      return s.parentId === null || !sublogNameError(s.sublogName);
    case "currency":
      return !!s.defaultCurrency;
    case "friends":
      return true; // optional
    case "review":
      return stepsForState(s)
        .filter((x) => x !== "review")
        .every((x) => isStepValid(x, s));
  }
};

/**
 * Clamp a requested step index (e.g. from the URL) to the furthest step the user can
 * actually reach, so deep links or a refresh never land past an incomplete step.
 */
export const reachableStepIndex = (requested: number, s: WizardState): number => {
  const steps = stepsForState(s);
  const target = Math.max(
    0,
    Math.min(Number.isFinite(requested) ? requested : 0, steps.length - 1),
  );
  for (let i = 0; i < target; i++) {
    if (!isStepValid(steps[i], s)) return i;
  }
  return target;
};
