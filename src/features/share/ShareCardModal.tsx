import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

import dayjs from "@/utils/configuredDayjs";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import RowButton from "@/components/RowButton";
import { useCurrentUser } from "@/contexts";
import { useGetLedgerEntries } from "@/hooks/useGetLedgerEntries";
import { useNoSpendDays } from "@/hooks/useNoSpendDays";
import { useToastContext } from "@/hooks/useToastContext";
import { canShareImages, downloadBlob, shareImage } from "@/platform";
import { Ledger, LedgerEntry } from "@/types/ledger";
import { Currency } from "@/types/user";
import { ShareCardResult, track } from "@/utils/analytics";
import { initialAvatarGrid, normaliseAvatar } from "@/utils/avatar";
import { hourInTz } from "@/utils/ledger";
import { formatAmount } from "@/utils/ledgerEntries";
import { currenciesByUse } from "@/utils/ledgerStats";
import { reportError } from "@/utils/reportError";
import { restingFace } from "@/features/ledger/buddy/buddyMood";
import { useBuddyMood } from "@/features/ledger/buddy/useBuddyMood";
import { monthName } from "@/features/ledger/buddy/monthReview";
import { ART } from "@/features/ledger/buddy/knickknacks/art";
import { useKnickKnackFinds } from "@/features/ledger/buddy/knickknacks/useUnseenFinds";

import { CardFormat, CardSpec, MAX_CARD_PHOTOS, renderCard } from "./renderCard";
import { SharePhoto, useSharePhotos } from "./sharePhotos";
import {
  breakdownSlices,
  pickShareKnickKnack,
  ShareDayWord,
  shareDayOf,
  shareLines,
  shareMonths,
} from "./shareLines";

import "./ShareCardModal.scss";

export type ShareCardKind = "daily" | "breakdown";

type ShareCardModalProps = {
  ledger: Pick<Ledger, "id" | "categories" | "monthlyBudget" | "defaultCurrency" | "memberUids">;
  today: string;
  onClose: () => void;
} & ({ card: "daily" } | { card: "breakdown"; month: string });

/**
 * Make an image card to post elsewhere (stories, timelines): today's brags or a month's
 * spending by category. Never an amount, only the sharer's own entries in this log. Render
 * it only while open, so each opening rolls a fresh knick-knack.
 */
export const ShareCardModal = (props: ShareCardModalProps) =>
  props.card === "daily" ? <DailyShare {...props} /> : <BreakdownShare {...props} />;

/** The currency I use most here, else the log's default. */
const myCurrency = (mine: ReadonlyArray<LedgerEntry>, fallback: Currency): Currency =>
  currenciesByUse(mine)[0] ?? fallback;

/** The sharer's ID (avatar, name, place) and a random kept knick-knack, with a re-roll. */
const useKeepsakes = (ledger: ShareCardModalProps["ledger"]) => {
  // The buddy as the log shows it right now (mood, sleep and all).
  const buddy = useBuddyMood(ledger);
  const { user } = useCurrentUser();
  const { data: finds, isLoading } = useKnickKnackFinds(user?.id);
  const [roll, setRoll] = useState(() => Math.random());
  const item = pickShareKnickKnack(finds, () => roll);
  const keptItems = new Set(finds.filter((f) => f.seenAt).map((f) => f.item)).size;
  return {
    isLoading: isLoading || !buddy.isSuccess,
    face: restingFace(buddy.state),
    avatar: normaliseAvatar(user?.avatar) ?? initialAvatarGrid(user?.displayName),
    name: user?.displayName ?? "",
    location: user?.displayLocation?.trim() || null,
    knickKnack: item ? { grid: ART[item] } : null,
    // A different item, if there is one to change to.
    reroll:
      keptItems > 1
        ? () => {
            let next = Math.random();
            while (pickShareKnickKnack(finds, () => next) === item) next = Math.random();
            setRoll(next);
          }
        : null,
  };
};

const DailyShare = ({
  ledger,
  today: calendarToday,
  onClose,
}: Omit<ShareCardModalProps, "card"> & { card: "daily" }) => {
  const { user } = useCurrentUser();
  // After midnight, until the buddy wakes, the card is still about the evening before;
  // in those hours either day can be picked.
  const [early] = useState(() => shareDayOf(calendarToday, hourInTz(user?.timezone)));
  const [dayWord, setDayWord] = useState<ShareDayWord>(early.word);
  const today = dayWord === "yesterday" ? early.day : calendarToday;
  // A fixed three months (hooks can't loop): this one and the two before.
  const [m0, m1, m2] = shareMonths(today);
  const q0 = useGetLedgerEntries({ ledgerId: ledger.id, month: m0 });
  const q1 = useGetLedgerEntries({ ledgerId: ledger.id, month: m1 });
  const q2 = useGetLedgerEntries({ ledgerId: ledger.id, month: m2 });
  const noSpend = useNoSpendDays();
  const keepsakes = useKeepsakes(ledger);
  const [showPie, setShowPie] = useState(true);
  const [showNames, setShowNames] = useState(true);
  // Off unless asked for: by default a card never shows an amount.
  const [showAmounts, setShowAmounts] = useState(false);
  const photos = useSharePhotos();

  const myUid = user?.userId ?? "";
  const entries = useMemo(
    () => [...q0.entries, ...q1.entries, ...q2.entries],
    [q0.entries, q1.entries, q2.entries],
  );
  const mine = useMemo(() => entries.filter((e) => e.authorUid === myUid), [entries, myUid]);
  const currency = myCurrency(mine, ledger.defaultCurrency);
  const categories = ledger.categories ?? [];
  const lines = shareLines({
    entries,
    myUid,
    today,
    currency,
    categories,
    totals: ledger.monthlyBudget,
    noSpendDays: noSpend.days,
    isSoleMember: (ledger.memberUids?.length ?? 0) <= 1,
    dayWord,
  });
  const todaySlices = breakdownSlices({
    entries,
    myUid,
    period: { day: today },
    currency,
    categories,
  });
  const pieShown = showPie && todaySlices.length > 0;
  const amountsShown = pieShown && showAmounts;
  const isLoading =
    q0.isLoading || q1.isLoading || q2.isLoading || !noSpend.isSuccess || keepsakes.isLoading;
  const isError = q0.isError || q1.isError || q2.isError || noSpend.isError;

  const spec: CardSpec | null = lines.length
    ? {
        heading: dayWord,
        date: dayjs(today).format("ddd D MMM").toLowerCase(),
        face: keepsakes.face,
        lines: lines.map((l) => l.text),
        pieTitle: "where my money went",
        slices: !pieShown
          ? []
          : todaySlices.map(({ id, name, share, amount }) => ({
              id,
              name,
              share,
              ...(amountsShown && { amountLabel: formatAmount(amount, currency) }),
            })),
        total: amountsShown
          ? formatAmount(
              todaySlices.reduce((sum, sl) => sum + sl.amount, 0),
              currency,
            )
          : null,
        showNames,
        photos: photos.photos.map(({ id, width, height }) => ({ id, width, height })),
        avatar: keepsakes.avatar,
        name: keepsakes.name,
        location: keepsakes.location,
        knickKnack: keepsakes.knickKnack,
      }
    : null;

  return (
    <ShareCardFrame
      card="daily"
      title={`share ${dayWord}`}
      filename={`moneylogs-${today}.png`}
      spec={spec}
      isLoading={isLoading}
      isError={isError}
      photos={photos.photos}
      amounts={amountsShown}
      empty={
        dayWord === "yesterday"
          ? "Nothing to share from yesterday."
          : "Nothing to share yet. Log today's spending, or confirm a no-spend day, and your buddy will find something to cheer about."
      }
      onClose={onClose}
      picker={
        early.word === "yesterday" && (
          <div className="ShareCardModal__formats" role="group" aria-label="Which day">
            {(["yesterday", "today"] as const).map((word) => (
              <Button
                key={word}
                text={word}
                size="sm"
                variant="toggle"
                isSelected={word === dayWord}
                onClick={() => setDayWord(word)}
              />
            ))}
          </div>
        )
      }
      options={
        <>
          {todaySlices.length > 0 && (
            <label className="ShareCardModal__option">
              <input
                type="checkbox"
                checked={showPie}
                onChange={(e) => setShowPie(e.target.checked)}
              />
              <span>Show {dayWord}'s spending pie (no fixed costs)</span>
            </label>
          )}
          {pieShown && <NamesOption checked={showNames} onChange={setShowNames} />}
          {pieShown && (
            <label className="ShareCardModal__option">
              <input
                type="checkbox"
                checked={showAmounts}
                onChange={(e) => setShowAmounts(e.target.checked)}
              />
              <span>Show amounts</span>
            </label>
          )}
          <PhotoPicker {...photos} />
          {keepsakes.reroll && (
            <RowButton onClick={keepsakes.reroll}>another knick-knack</RowButton>
          )}
        </>
      }
    />
  );
};

const BreakdownShare = ({
  ledger,
  today,
  month,
  onClose,
}: Omit<ShareCardModalProps, "card"> & { card: "breakdown"; month: string }) => {
  const { user } = useCurrentUser();
  const { entries, isLoading, isError } = useGetLedgerEntries({ ledgerId: ledger.id, month });
  const keepsakes = useKeepsakes(ledger);
  const [showNames, setShowNames] = useState(true);

  const myUid = user?.userId ?? "";
  const mine = useMemo(() => entries.filter((e) => e.authorUid === myUid), [entries, myUid]);
  const currency = myCurrency(mine, ledger.defaultCurrency);
  const slices = breakdownSlices({
    entries,
    myUid,
    period: { month },
    currency,
    categories: ledger.categories ?? [],
  });
  const name = monthName(month);

  const spec: CardSpec | null = slices.length
    ? {
        heading: name,
        date: dayjs(`${month}-01`).format("MMM YYYY").toLowerCase(),
        face: keepsakes.face,
        lines: [],
        pieTitle: month === today.slice(0, 7) ? "where my money's going" : "where my money went",
        slices,
        showNames,
        avatar: keepsakes.avatar,
        name: keepsakes.name,
        location: keepsakes.location,
        knickKnack: keepsakes.knickKnack,
      }
    : null;

  return (
    <ShareCardFrame
      card="breakdown"
      title={`share ${name}`}
      filename={`moneylogs-${month}.png`}
      spec={spec}
      isLoading={isLoading || keepsakes.isLoading}
      isError={isError}
      empty={`Nothing of yours spent in ${name} yet.`}
      onClose={onClose}
      options={
        <>
          <NamesOption checked={showNames} onChange={setShowNames} />
          {keepsakes.reroll && (
            <RowButton onClick={keepsakes.reroll}>another knick-knack</RowButton>
          )}
        </>
      }
    />
  );
};

const NamesOption = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <label className="ShareCardModal__option">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span>Show category names</span>
  </label>
);

/**
 * Up to three photos from the device for the card: thumbnails to remove, and a button
 * that opens the photo picker until the card is full.
 */
const PhotoPicker = ({
  photos,
  loading,
  isFull,
  add,
  remove,
}: ReturnType<typeof useSharePhotos>) => {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="ShareCardModal__photos">
      {photos.map((photo, i) => (
        <span key={photo.id} className="ShareCardModal__thumb">
          <img src={photo.thumb} alt={`photo ${i + 1}`} />
          <RowButton glyph aria-label={`remove photo ${i + 1}`} onClick={() => remove(photo.id)}>
            ×
          </RowButton>
        </span>
      ))}
      {!isFull && (
        <RowButton disabled={loading} onClick={() => input.current?.click()}>
          {loading
            ? "…"
            : photos.length
              ? "add another photo"
              : `add photos (up to ${MAX_CARD_PHOTOS})`}
        </RowButton>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          // Cleared, so picking the same photo again still counts as a change.
          e.target.value = "";
          void add(files);
        }}
      />
    </div>
  );
};

const NO_PHOTOS: ReadonlyArray<SharePhoto> = [];

const FORMATS: { id: CardFormat; label: string }[] = [
  { id: "story", label: "story" },
  { id: "square", label: "square" },
];

/**
 * The modal around a card: a live preview, story/square, the card's own options, and
 * SHARE (or SAVE IMAGE where the device has no share sheet for files).
 */
const ShareCardFrame = ({
  card,
  title,
  filename,
  spec,
  isLoading,
  isError,
  empty,
  picker,
  options,
  photos = NO_PHOTOS,
  amounts = false,
  onClose,
}: {
  card: ShareCardKind;
  title: string;
  filename: string;
  spec: CardSpec | null;
  isLoading: boolean;
  isError: boolean;
  empty: string;
  /** Above everything, whatever the state: what the card is about (e.g. which day). */
  picker?: ReactNode;
  options: ReactNode;
  /** Photos drawn into the card (spec.photos describes the same ones, in order). */
  photos?: ReadonlyArray<SharePhoto>;
  /** The card shows amounts (the sharer turned them on). */
  amounts?: boolean;
  onClose: () => void;
}) => {
  const { showToast } = useToastContext();
  const [format, setFormat] = useState<CardFormat>("story");
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [renderFailed, setRenderFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const canShareFiles = useMemo(() => canShareImages(), []);

  // Re-render only when what's on the card changes, not on every snapshot.
  const specKey = spec && !isLoading ? JSON.stringify(spec) : null;
  // The pixels for spec.photos (which names the same photos by id, so the key follows them).
  const sources = useMemo(() => photos.map((p) => p.source), [photos]);
  useEffect(() => {
    if (!specKey) return;
    let cancelled = false;
    let url: string | null = null;
    renderCard(JSON.parse(specKey) as CardSpec, format, undefined, sources)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setImage({ blob, url });
        setRenderFailed(false);
      })
      .catch((err) => {
        if (cancelled) return;
        reportError(err, { feature: "share_card", action: "render_card" });
        setRenderFailed(true);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [specKey, format, sources]);

  const share = async () => {
    if (!image || pending) return;
    setPending(true);
    try {
      const shared = canShareFiles
        ? await shareImage({ blob: image.blob, filename, title: "moneylogs" })
        : "unavailable";
      // No share sheet for files here (or it failed to open): save the image instead.
      if (shared === "unavailable") downloadBlob(image.blob, filename);
      const result: ShareCardResult = shared === "unavailable" ? "downloaded" : shared;
      track("share_card", { card, format, result, photos: photos.length, amounts });
      if (result === "shared") onClose();
    } catch (err) {
      reportError(err, { feature: "share_card", action: "share_card" });
      showToast("Couldn't share the card. Please try again.");
    } finally {
      setPending(false);
    }
  };

  const ready = !!spec && !isLoading && !isError;
  const shown = ready && image;

  return (
    <Modal
      isOpen
      onClose={pending ? undefined : onClose}
      disabled={pending}
      className="ShareCardModal"
    >
      <Modal.Header title={title} striped />
      <Modal.Body className="ShareCardModal__body">
        {picker}
        {isError ? (
          <p className="error-message">Couldn't load your entries. Please try again.</p>
        ) : isLoading ? (
          <p>…</p>
        ) : !spec ? (
          <p>{empty}</p>
        ) : (
          <>
            <div className="ShareCardModal__formats" role="group" aria-label="Image shape">
              {FORMATS.map((f) => (
                <Button
                  key={f.id}
                  text={f.label}
                  size="sm"
                  variant="toggle"
                  isSelected={f.id === format}
                  onClick={() => setFormat(f.id)}
                />
              ))}
            </div>
            <div className={`ShareCardModal__preview ShareCardModal__preview--${format}`}>
              {renderFailed ? (
                <p className="error-message">Couldn't draw the card.</p>
              ) : shown ? (
                <img src={image.url} alt={`Share card: ${spec.lines.join(" ")}`} />
              ) : (
                <p>…</p>
              )}
            </div>
            <div className="ShareCardModal__options">{options}</div>
            <p className="ShareCardModal__note">
              {amounts
                ? "Only your own entries, with the amounts you chose to show."
                : "Only your own entries, and never an amount."}
              {photos.length > 0 &&
                " Photos are only drawn into the image, never uploaded to moneylogs."}
            </p>
          </>
        )}
      </Modal.Body>
      <Modal.Actions>
        <Modal.CancelButton />
        {ready && (
          <Button
            text={canShareFiles ? "share" : "save image"}
            variant="primary"
            disabled={!image || renderFailed}
            loading={pending}
            onClick={() => void share()}
          />
        )}
      </Modal.Actions>
    </Modal>
  );
};

export default ShareCardModal;
