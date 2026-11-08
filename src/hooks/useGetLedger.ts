import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { db } from "@/config/firebase-config";
import { Ledger } from "@/types/ledger";

type LedgerState = {
  ledger: Ledger | undefined;
  isLoading: boolean;
  isSuccess: boolean;
  // Rules deny reads to non-members, so "no access" is distinct from other errors.
  isDenied: boolean;
  isNotFound: boolean;
  isError: boolean;
  error: unknown;
};

const INITIAL: LedgerState = {
  ledger: undefined,
  isLoading: false,
  isSuccess: false,
  isDenied: false,
  isNotFound: false,
  isError: false,
  error: undefined,
};

export const useGetLedger = (ledgerId?: string, enabled = true) => {
  const [state, setState] = useState<LedgerState>(INITIAL);

  useEffect(() => {
    if (!ledgerId || !enabled) return;

    setState({ ...INITIAL, isLoading: true });

    const unsubscribe = onSnapshot(
      doc(db, "ledgers", ledgerId),
      (snap) => {
        if (snap.exists()) {
          setState({
            ...INITIAL,
            ledger: { id: ledgerId, ...snap.data() } as Ledger,
            isSuccess: true,
          });
        } else {
          setState({ ...INITIAL, isNotFound: true, isError: true });
        }
      },
      (err) => {
        const isDenied = err instanceof FirebaseError && err.code === "permission-denied";
        setState({ ...INITIAL, isDenied, isError: true, error: err });
      },
    );

    return unsubscribe;
  }, [ledgerId, enabled]);

  return state;
};
