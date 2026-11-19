import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useCurrentUser } from "@/contexts";
import { track } from "@/utils/analytics";
import { reportError } from "@/utils/reportError";

import { MAX_POKES_PER_WRITE } from "./nudges";
import { sendNudge } from "./nudgeStore";

/** Pokes tapped within this long of each other go out as one write. */
export const POKE_DEBOUNCE_MS = 700;

/**
 * Poke or cheer a friend. Poking can be mashed: taps are gathered and sent together as
 * one write a moment after the last one (or straight away if the page is left), so a
 * flurry costs a single document write. `sent` counts this visit's pokes, for feedback.
 */
export const useSendNudge = (toUserDocId: string, toUid: string | null) => {
  const { user } = useCurrentUser();
  const from = user?.id;
  const fromUid = user?.userId;
  const [sent, setSent] = useState(0);
  const pending = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const who = useMemo(
    () => (from && fromUid && toUid ? { from, fromUid, to: toUserDocId, toUid } : null),
    [from, fromUid, toUserDocId, toUid],
  );
  // Read inside flush, so a flush from a stale closure (unmount, pagehide) still knows who.
  const parties = useRef(who);
  useLayoutEffect(() => {
    parties.current = who;
  }, [who]);

  const send = useCallback((pokes: number, cheer?: string) => {
    const to = parties.current;
    if (!to) return Promise.resolve();
    track("send_nudge", { kind: cheer ? "cheer" : "poke" });
    return sendNudge(to, { pokes, cheer }).catch((err: unknown) =>
      reportError(err, { feature: "friends", action: "send_nudge", level: "warning" }),
    );
  }, []);

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const pokes = pending.current;
    pending.current = 0;
    if (pokes > 0) void send(pokes);
  }, [send]);

  const poke = useCallback(() => {
    if (!parties.current) return;
    pending.current += 1;
    setSent((n) => n + 1);
    if (pending.current >= MAX_POKES_PER_WRITE) return flush();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, POKE_DEBOUNCE_MS);
  }, [flush]);

  /** Send a cheer now, with any pokes still waiting to go. */
  const cheer = useCallback(
    (key: string) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      const pokes = pending.current;
      pending.current = 0;
      return send(pokes, key);
    },
    [send],
  );

  useEffect(() => {
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);

  return { poke, cheer, sent, canSend: !!who };
};
