import {User, onAuthStateChanged, signInWithPopup, signOut} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {
  ADMIN_EMAIL,
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
} from '../lib/firebase';
import {
  InvoiceLineItem,
  PaymentMethod,
  PaymentRequest,
  PlanId,
  PurchaseInvoice,
  RefundRequest,
  SavedLocation,
  UnitSystem,
  UserAccount,
} from '../types/weather';
import {PLAN_PRICING, computeDiscountedPlanPricing} from '../utils/telemetryExport';

interface AuthContextValue {
  firebaseUser: User | null;
  authReady: boolean;
  isAdmin: boolean;
  userAccount: UserAccount | null;
  isConfirmedPremium: boolean;
  isConfirmedVip: boolean;
  hasPendingPayment: boolean;
  savedLocations: SavedLocation[];
  myPaymentRequests: PaymentRequest[];
  allPaymentRequests: PaymentRequest[];
  myRefundRequests: RefundRequest[];
  allRefundRequests: RefundRequest[];
  myInvoices: PurchaseInvoice[];
  allInvoices: PurchaseInvoice[];
  authBusy: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: (signupPrefs?: {displayName?: string; preferredUnits?: UnitSystem}) => Promise<void>;
  signOutUser: () => Promise<void>;
  updatePreferences: (prefs: {displayName?: string; preferredUnits?: UnitSystem}) => Promise<void>;
  saveLocation: (loc: {
    name: string;
    subtitle: string;
    lat: number;
    lng: number;
    isHome?: boolean;
  }) => Promise<void>;
  setHomeLocation: (locationId: string) => Promise<void>;
  removeSavedLocation: (locationId: string) => Promise<void>;
  submitPaymentRequest: (input: {
    planId: PlanId;
    discountPercent: number;
    paymentMethod: PaymentMethod;
    transactionRef: string;
    payerName: string;
    note: string;
  }) => Promise<void>;
  cancelVipAndRequestRefund: (input: {refundUpiId: string; reason: string}) => Promise<void>;
  adminConfirmPayment: (req: PaymentRequest, adminNote?: string) => Promise<void>;
  adminRejectPayment: (req: PaymentRequest, adminNote?: string) => Promise<void>;
  adminProcessRefund: (
    req: RefundRequest,
    nextStatus: 'REFUNDED' | 'REJECTED',
    refundTxRef: string,
    adminNote?: string
  ) => Promise<void>;
  adminGenerateAndSendInvoice: (req: PaymentRequest) => Promise<PurchaseInvoice>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function makeSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function getTimestampMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'object' && ts !== null && 'toMillis' in ts && typeof (ts as {toMillis: () => number}).toMillis === 'function') {
    return (ts as {toMillis: () => number}).toMillis();
  }
  return 0;
}

export function AuthProvider({children}: {children: ReactNode}) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userAccount, setUserAccount] = useState<UserAccount | null>(null);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [myPaymentRequests, setMyPaymentRequests] = useState<PaymentRequest[]>([]);
  const [allPaymentRequests, setAllPaymentRequests] = useState<PaymentRequest[]>([]);
  const [myRefundRequests, setMyRefundRequests] = useState<RefundRequest[]>([]);
  const [allRefundRequests, setAllRefundRequests] = useState<RefundRequest[]>([]);
  const [myInvoices, setMyInvoices] = useState<PurchaseInvoice[]>([]);
  const [allInvoices, setAllInvoices] = useState<PurchaseInvoice[]>([]);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const isAdmin = Boolean(
    firebaseUser?.emailVerified && firebaseUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );

  const ensureUserDocs = useCallback(
    async (user: User, signupPrefs?: {displayName?: string; preferredUnits?: UnitSystem}) => {
      const userRef = doc(db, 'users', user.uid);
      const privateRef = doc(db, 'users', user.uid, 'private', 'info');
      let snap;
      try {
        snap = await getDoc(userRef);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      }

      const rawName = (signupPrefs?.displayName || user.displayName || user.email?.split('@')[0] || 'Explorer').trim();
      const safeName = rawName.slice(0, 80) || 'Explorer';
      const safeEmail = (user.email || '').slice(0, 160);
      const safePhoto = (user.photoURL || '').slice(0, 500);
      const safeUnits: UnitSystem = signupPrefs?.preferredUnits === 'IMPERIAL' ? 'IMPERIAL' : 'METRIC';

      if (!snap.exists()) {
        try {
          await setDoc(userRef, {
            uid: user.uid,
            displayName: safeName,
            preferredUnits: safeUnits,
            tier: 'FREE',
            vipConfirmed: false,
            pendingPlan: 'NONE',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await setDoc(privateRef, {
            uid: user.uid,
            email: safeEmail,
            photoUrl: safePhoto,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }
      } else {
        try {
          const privSnap = await getDoc(privateRef);
          if (!privSnap.exists()) {
            const batch = writeBatch(db);
            batch.set(privateRef, {
              uid: user.uid,
              email: safeEmail,
              photoUrl: safePhoto,
              updatedAt: serverTimestamp(),
            });
            await batch.commit();
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/private/info`);
        }
      }
    },
    []
  );

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          await ensureUserDocs(user);
        } catch {
          // Handled inside ensureUserDocs
        }
      } else {
        setUserAccount(null);
        setSavedLocations([]);
        setMyPaymentRequests([]);
        setAllPaymentRequests([]);
        setMyRefundRequests([]);
        setAllRefundRequests([]);
        setMyInvoices([]);
        setAllInvoices([]);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [ensureUserDocs]);

  // Real-time listeners only when auth is ready and user is authenticated
  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const uid = firebaseUser.uid;

    const unsubUser = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (snap.exists()) {
          setUserAccount(snap.data() as UserAccount);
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `users/${uid}`);
      }
    );

    const savedQuery = query(collection(db, 'users', uid, 'savedLocations'), where('userId', '==', uid));
    const unsubSaved = onSnapshot(
      savedQuery,
      (snap) => {
        const items = snap.docs
          .map((d) => d.data() as SavedLocation)
          .sort((a, b) => {
            if (a.isHome !== b.isHome) return a.isHome ? -1 : 1;
            return getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
          });
        setSavedLocations(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `users/${uid}/savedLocations`);
      }
    );

    const myPayQuery = query(collection(db, 'paymentRequests'), where('userId', '==', uid));
    const unsubMyPay = onSnapshot(
      myPayQuery,
      (snap) => {
        const items = snap.docs
          .map((d) => d.data() as PaymentRequest)
          .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
        setMyPaymentRequests(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'paymentRequests');
      }
    );

    const myRefundQuery = query(collection(db, 'refundRequests'), where('userId', '==', uid));
    const unsubMyRefund = onSnapshot(
      myRefundQuery,
      (snap) => {
        const items = snap.docs
          .map((d) => d.data() as RefundRequest)
          .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
        setMyRefundRequests(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'refundRequests');
      }
    );

    const myInvoicesQuery = query(collection(db, 'invoices'), where('userId', '==', uid));
    const unsubMyInvoices = onSnapshot(
      myInvoicesQuery,
      (snap) => {
        const items = snap.docs
          .map((d) => d.data() as PurchaseInvoice)
          .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
        setMyInvoices(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'invoices');
      }
    );

    let unsubAllPay: (() => void) | undefined;
    let unsubAllRefund: (() => void) | undefined;
    let unsubAllInvoices: (() => void) | undefined;

    if (isAdmin) {
      unsubAllPay = onSnapshot(
        collection(db, 'paymentRequests'),
        (snap) => {
          const items = snap.docs
            .map((d) => d.data() as PaymentRequest)
            .sort((a, b) => {
              if (a.status === 'PENDING_CONFIRMATION' && b.status !== 'PENDING_CONFIRMATION') return -1;
              if (a.status !== 'PENDING_CONFIRMATION' && b.status === 'PENDING_CONFIRMATION') return 1;
              return getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
            });
          setAllPaymentRequests(items);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'paymentRequests');
        }
      );

      unsubAllRefund = onSnapshot(
        collection(db, 'refundRequests'),
        (snap) => {
          const items = snap.docs
            .map((d) => d.data() as RefundRequest)
            .sort((a, b) => {
              if (a.status === 'PENDING_REFUND' && b.status !== 'PENDING_REFUND') return -1;
              if (a.status !== 'PENDING_REFUND' && b.status === 'PENDING_REFUND') return 1;
              return getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
            });
          setAllRefundRequests(items);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'refundRequests');
        }
      );

      unsubAllInvoices = onSnapshot(
        collection(db, 'invoices'),
        (snap) => {
          const items = snap.docs
            .map((d) => d.data() as PurchaseInvoice)
            .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
          setAllInvoices(items);
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'invoices');
        }
      );
    } else {
      setAllPaymentRequests([]);
      setAllRefundRequests([]);
      setAllInvoices([]);
    }

    return () => {
      unsubUser();
      unsubSaved();
      unsubMyPay();
      unsubMyRefund();
      unsubMyInvoices();
      unsubAllPay?.();
      unsubAllRefund?.();
      unsubAllInvoices?.();
    };
  }, [authReady, firebaseUser, isAdmin]);

  const signInWithGoogle = useCallback(
    async (signupPrefs?: {displayName?: string; preferredUnits?: UnitSystem}) => {
      setAuthBusy(true);
      setAuthError(null);
      try {
        const cred = await signInWithPopup(auth, googleProvider);
        await ensureUserDocs(cred.user, signupPrefs);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to complete sign-in.';
        if (!msg.includes('popup-closed-by-user')) {
          setAuthError(msg);
        }
      } finally {
        setAuthBusy(false);
      }
    },
    [ensureUserDocs]
  );

  const signOutUser = useCallback(async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signOut(auth);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign-out failed.');
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const updatePreferences = useCallback(
    async (prefs: {displayName?: string; preferredUnits?: UnitSystem}) => {
      if (!firebaseUser) return;
      const uid = firebaseUser.uid;
      const payload: Record<string, unknown> = {updatedAt: serverTimestamp()};
      if (typeof prefs.displayName === 'string') {
        const trimmed = prefs.displayName.trim().slice(0, 80);
        if (trimmed.length < 1) throw new Error('Display name cannot be empty.');
        payload.displayName = trimmed;
      }
      if (prefs.preferredUnits === 'METRIC' || prefs.preferredUnits === 'IMPERIAL') {
        payload.preferredUnits = prefs.preferredUnits;
      }
      try {
        await updateDoc(doc(db, 'users', uid), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
      }
    },
    [firebaseUser]
  );

  const isConfirmedPremium = Boolean(
    userAccount?.vipConfirmed === true && (userAccount.tier === 'PRO' || userAccount.tier === 'VIP')
  );
  const isConfirmedVip = Boolean(userAccount?.vipConfirmed === true && userAccount.tier === 'VIP');
  const hasPendingPayment = useMemo(
    () =>
      myPaymentRequests.some((r) => r.status === 'PENDING_CONFIRMATION') ||
      (userAccount?.pendingPlan !== undefined && userAccount.pendingPlan !== 'NONE'),
    [myPaymentRequests, userAccount?.pendingPlan]
  );

  const saveLocation = useCallback(
    async (loc: {name: string; subtitle: string; lat: number; lng: number; isHome?: boolean}) => {
      if (!firebaseUser) {
        throw new Error('Please sign in to save locations.');
      }
      if (!isConfirmedPremium && savedLocations.length >= 3) {
        throw new Error(
          'Free accounts can save up to 3 locations. Upgrade and confirm VIP to save unlimited locations.'
        );
      }

      const duplicate = savedLocations.find(
        (item) => Math.abs(item.lat - loc.lat) < 0.02 && Math.abs(item.lng - loc.lng) < 0.02
      );
      if (duplicate) {
        throw new Error(`"${duplicate.name}" is already in your saved locations.`);
      }

      const uid = firebaseUser.uid;
      const locId = makeSafeId('loc');
      const safeName = (loc.name.trim() || 'Saved Point').slice(0, 100);
      const safeSub = (loc.subtitle.trim() || 'Weather Coordinate').slice(0, 160);
      const safeLat = Math.max(-90, Math.min(90, Number(loc.lat.toFixed(5))));
      const safeLng = Math.max(-180, Math.min(180, Number(loc.lng.toFixed(5))));
      const makeHome = Boolean(loc.isHome) || savedLocations.length === 0;

      const batch = writeBatch(db);
      if (makeHome) {
        savedLocations
          .filter((item) => item.isHome)
          .forEach((prevHome) => {
            batch.update(doc(db, 'users', uid, 'savedLocations', prevHome.id), {isHome: false});
          });
      }

      batch.set(doc(db, 'users', uid, 'savedLocations', locId), {
        id: locId,
        userId: uid,
        name: safeName,
        subtitle: safeSub,
        lat: safeLat,
        lng: safeLng,
        isHome: makeHome,
        createdAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${uid}/savedLocations/${locId}`);
      }
    },
    [firebaseUser, isConfirmedPremium, savedLocations]
  );

  const setHomeLocation = useCallback(
    async (locationId: string) => {
      if (!firebaseUser) return;
      const uid = firebaseUser.uid;
      const batch = writeBatch(db);
      savedLocations.forEach((loc) => {
        if (loc.id === locationId && !loc.isHome) {
          batch.update(doc(db, 'users', uid, 'savedLocations', loc.id), {isHome: true});
        } else if (loc.id !== locationId && loc.isHome) {
          batch.update(doc(db, 'users', uid, 'savedLocations', loc.id), {isHome: false});
        }
      });
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${uid}/savedLocations/${locationId}`);
      }
    },
    [firebaseUser, savedLocations]
  );

  const removeSavedLocation = useCallback(
    async (locationId: string) => {
      if (!firebaseUser) return;
      const uid = firebaseUser.uid;
      try {
        await deleteDoc(doc(db, 'users', uid, 'savedLocations', locationId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${uid}/savedLocations/${locationId}`);
      }
    },
    [firebaseUser]
  );

  const submitPaymentRequest = useCallback(
    async (input: {
      planId: PlanId;
      discountPercent: number;
      paymentMethod: PaymentMethod;
      transactionRef: string;
      payerName: string;
      note: string;
    }) => {
      if (!firebaseUser || !userAccount) {
        throw new Error('Please sign in first before submitting a payment.');
      }
      if (myPaymentRequests.some((r) => r.status === 'PENDING_CONFIRMATION')) {
        throw new Error('You already have a payment queued for confirmation. Please wait for verification.');
      }

      const txRef = input.transactionRef.trim().slice(0, 80);
      const payer = input.payerName.trim().slice(0, 80);
      const note = input.note.trim().slice(0, 240);
      if (txRef.length < 4) {
        throw new Error('Please enter a valid UPI UTR / transaction reference (minimum 4 characters).');
      }
      if (payer.length < 2) {
        throw new Error('Please enter the payer name (minimum 2 characters).');
      }

      const requestId = makeSafeId('pay');
      const pricing = computeDiscountedPlanPricing(input.planId, input.discountPercent);

      const batch = writeBatch(db);
      batch.set(doc(db, 'paymentRequests', requestId), {
        requestId,
        userId: firebaseUser.uid,
        userDisplayName: userAccount.displayName.slice(0, 80),
        userEmail: (firebaseUser.email || '').slice(0, 160),
        planId: input.planId,
        originalAmountInr: pricing.baseInr,
        discountPercent: pricing.discountPercent,
        paidAmountInr: pricing.finalInr,
        amountUsd: pricing.finalUsd,
        paymentMethod: input.paymentMethod,
        transactionRef: txRef,
        payerName: payer,
        note,
        status: 'PENDING_CONFIRMATION',
        adminNote: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Mark pendingPlan ONLY — never grant tier/vipConfirmed on submission
      batch.update(doc(db, 'users', firebaseUser.uid), {
        pendingPlan: input.planId,
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `paymentRequests/${requestId}`);
      }
    },
    [firebaseUser, myPaymentRequests, userAccount]
  );

  const cancelVipAndRequestRefund = useCallback(
    async (input: {refundUpiId: string; reason: string}) => {
      if (!firebaseUser || !userAccount || !isConfirmedPremium) {
        throw new Error('Active confirmed VIP/PRO plan is required to cancel and request a refund.');
      }
      const safeUpi = input.refundUpiId.trim().slice(0, 100);
      const safeReason = input.reason.trim().slice(0, 240);
      if (safeUpi.length < 3 || !safeUpi.includes('@')) {
        throw new Error('Please enter a valid UPI ID (e.g. yourname@okaxis) to receive the 86% refund.');
      }

      const latestConfirmed = myPaymentRequests.find((r) => r.status === 'CONFIRMED');
      const fallbackPlan: PlanId = userAccount.tier === 'VIP' ? 'VIP_ANNUAL' : 'PRO_MONTHLY';
      const planId = latestConfirmed?.planId || fallbackPlan;
      const paidInr = Number(latestConfirmed?.paidAmountInr || PLAN_PRICING[planId].inrAmount);
      const paidUsd = Number(latestConfirmed?.amountUsd || PLAN_PRICING[planId].usdAmount);
      const refundInr = Math.max(1, Number((paidInr * 0.86).toFixed(2)));
      const refundUsd = Math.max(0.01, Number((paidUsd * 0.86).toFixed(2)));
      const paymentRequestId = latestConfirmed?.requestId || makeSafeId('manual');

      const refundId = makeSafeId('ref');
      const batch = writeBatch(db);
      batch.set(doc(db, 'refundRequests', refundId), {
        refundId,
        userId: firebaseUser.uid,
        userDisplayName: userAccount.displayName.slice(0, 80),
        userEmail: (firebaseUser.email || '').slice(0, 160),
        paymentRequestId,
        planId,
        paidAmountInr: paidInr,
        paidAmountUsd: paidUsd,
        adminChargePct: 14,
        refundPct: 86,
        refundAmountInr: refundInr,
        refundAmountUsd: refundUsd,
        refundUpiId: safeUpi,
        reason: safeReason || 'User cancelled VIP subscription',
        status: 'PENDING_REFUND',
        adminNote: '',
        refundTxRef: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Immediately revoke VIP/PRO back to FREE
      batch.update(doc(db, 'users', firebaseUser.uid), {
        tier: 'FREE',
        vipConfirmed: false,
        pendingPlan: 'NONE',
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `refundRequests/${refundId}`);
      }
    },
    [firebaseUser, isConfirmedPremium, myPaymentRequests, userAccount]
  );

  const adminConfirmPayment = useCallback(
    async (req: PaymentRequest, adminNote?: string) => {
      if (!isAdmin) {
        throw new Error('Admin verification required.');
      }
      const nextTier = req.planId === 'VIP_ANNUAL' ? 'VIP' : 'PRO';
      const safeNote = (adminNote?.trim() || 'UPI payment verified and premium plan activated.').slice(0, 240);

      const batch = writeBatch(db);
      batch.update(doc(db, 'paymentRequests', req.requestId), {
        status: 'CONFIRMED',
        adminNote: safeNote,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'users', req.userId), {
        tier: nextTier,
        vipConfirmed: true,
        pendingPlan: 'NONE',
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `paymentRequests/${req.requestId}`);
      }
    },
    [isAdmin]
  );

  const adminRejectPayment = useCallback(
    async (req: PaymentRequest, adminNote?: string) => {
      if (!isAdmin) {
        throw new Error('Admin verification required.');
      }
      const safeNote = (adminNote?.trim() || 'UPI UTR reference could not be verified.').slice(0, 240);

      const batch = writeBatch(db);
      batch.update(doc(db, 'paymentRequests', req.requestId), {
        status: 'REJECTED',
        adminNote: safeNote,
        updatedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'users', req.userId), {
        tier: 'FREE',
        vipConfirmed: false,
        pendingPlan: 'NONE',
        updatedAt: serverTimestamp(),
      });

      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `paymentRequests/${req.requestId}`);
      }
    },
    [isAdmin]
  );

  const adminProcessRefund = useCallback(
    async (
      req: RefundRequest,
      nextStatus: 'REFUNDED' | 'REJECTED',
      refundTxRef: string,
      adminNote?: string
    ) => {
      if (!isAdmin) {
        throw new Error('Admin verification required.');
      }
      const safeTx = refundTxRef.trim().slice(0, 80);
      const safeNote = (
        adminNote?.trim() ||
        (nextStatus === 'REFUNDED'
          ? '86% refund transferred via UPI after 14% administration charge.'
          : 'Refund request could not be processed.')
      ).slice(0, 240);

      try {
        await updateDoc(doc(db, 'refundRequests', req.refundId), {
          status: nextStatus,
          refundTxRef: safeTx,
          adminNote: safeNote,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `refundRequests/${req.refundId}`);
      }
    },
    [isAdmin]
  );

  const adminGenerateAndSendInvoice = useCallback(
    async (req: PaymentRequest): Promise<PurchaseInvoice> => {
      if (!isAdmin || !firebaseUser) {
        throw new Error('Admin verification required to generate and send invoices.');
      }

      const idToken = await firebaseUser.getIdToken();
      const basePlan = PLAN_PRICING[req.planId];
      const originalAmountInr = req.originalAmountInr || basePlan.inrAmount;
      const discountPercent = req.discountPercent ?? 0;
      const paidAmountInr = req.paidAmountInr || originalAmountInr;

      const response = await fetch('/api/generate-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          paymentRequestId: req.requestId,
          userDisplayName: req.userDisplayName,
          userEmail: req.userEmail,
          planId: req.planId,
          planName: basePlan.name,
          originalAmountInr,
          discountPercent,
          paidAmountInr,
          amountUsd: req.amountUsd,
          transactionRef: req.transactionRef,
        }),
      });

      const rawBody = await response.text();
      let payload: {
        error?: string;
        invoiceNumber?: string;
        issueDate?: string;
        billingPeriod?: string;
        summaryHeadline?: string;
        lineItems?: InvoiceLineItem[];
        termsAndConditions?: string;
        aiVerificationNote?: string;
        sentByAdminEmail?: string;
      } = {};
      try {
        payload = JSON.parse(rawBody) as typeof payload;
      } catch {
        throw new Error(
          `Invoice server returned an unexpected response (HTTP ${response.status}). Please refresh and retry.`
        );
      }

      if (!response.ok) {
        throw new Error(payload.error || `AI invoice generation failed (HTTP ${response.status}).`);
      }

      const safeMinStr = (val: unknown, fallback: string, min: number, max: number) => {
        const s = String(val || '').trim().slice(0, max);
        return s.length >= min ? s : fallback.slice(0, max);
      };

      const safeLineItems: InvoiceLineItem[] = (
        Array.isArray(payload.lineItems) && payload.lineItems.length > 0
          ? payload.lineItems
          : [{description: basePlan.name, amount: `₹${paidAmountInr.toFixed(2)}`}]
      )
        .slice(0, 8)
        .map((item) => ({
          description: safeMinStr(item?.description, basePlan.name, 1, 160),
          amount: safeMinStr(item?.amount, `₹${paidAmountInr.toFixed(2)}`, 1, 40),
        }));

      const invoiceId = makeSafeId('inv');
      const invoiceDoc: PurchaseInvoice = {
        invoiceId,
        invoiceNumber: safeMinStr(
          payload.invoiceNumber,
          `MGO-2026-${Date.now().toString().slice(-6)}`,
          4,
          40
        ),
        paymentRequestId: req.requestId,
        userId: req.userId,
        userDisplayName: safeMinStr(req.userDisplayName, 'MAIND GO Member', 1, 80),
        userEmail: String(req.userEmail || '').trim().slice(0, 160),
        planId: req.planId,
        planName: safeMinStr(basePlan.name, 'MAIND GO Plan', 2, 80),
        originalAmountInr,
        discountPercent,
        paidAmountInr,
        amountUsd: Math.max(0.01, Number(req.amountUsd) || basePlan.usdAmount),
        transactionRef: safeMinStr(req.transactionRef, 'UPI_VERIFIED', 4, 80),
        issueDate: safeMinStr(payload.issueDate, new Date().toISOString().slice(0, 10), 4, 60),
        billingPeriod: safeMinStr(payload.billingPeriod, basePlan.periodLabel, 4, 80),
        summaryHeadline: safeMinStr(
          payload.summaryHeadline,
          `Official Invoice — ${basePlan.name}`,
          4,
          180
        ),
        lineItems: safeLineItems,
        termsAndConditions: safeMinStr(
          payload.termsAndConditions,
          'VIP cancellation refunds 86% of the paid UPI amount after deducting a 14% administration charge.',
          4,
          600
        ),
        aiVerificationNote: safeMinStr(
          payload.aiVerificationNote,
          `Verified payment UTR ${req.transactionRef}`,
          4,
          400
        ),
        sentByAdminEmail: String(
          payload.sentByAdminEmail || firebaseUser.email || ADMIN_EMAIL
        )
          .trim()
          .slice(0, 160),
        generatedByAi: true,
        createdAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'invoices', invoiceId), invoiceDoc);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `invoices/${invoiceId}`);
      }

      return invoiceDoc;
    },
    [firebaseUser, isAdmin]
  );

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const value: AuthContextValue = {
    firebaseUser,
    authReady,
    isAdmin,
    userAccount,
    isConfirmedPremium,
    isConfirmedVip,
    hasPendingPayment,
    savedLocations,
    myPaymentRequests,
    allPaymentRequests,
    myRefundRequests,
    allRefundRequests,
    myInvoices,
    allInvoices,
    authBusy,
    authError,
    clearAuthError,
    signInWithGoogle,
    signOutUser,
    updatePreferences,
    saveLocation,
    setHomeLocation,
    removeSavedLocation,
    submitPaymentRequest,
    cancelVipAndRequestRefund,
    adminConfirmPayment,
    adminRejectPayment,
    adminProcessRefund,
    adminGenerateAndSendInvoice,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
