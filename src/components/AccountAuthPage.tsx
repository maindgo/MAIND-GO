import {
  Ban,
  Bookmark,
  CheckCircle2,
  Clock,
  Crown,
  Eye,
  FileText,
  LogIn,
  LogOut,
  Power,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Wrench,
  XCircle,
} from 'lucide-react';
import {FormEvent, useEffect, useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {AppPage, PaymentRequest, PurchaseInvoice, RefundRequest, UnitSystem} from '../types/weather';
import {PLAN_PRICING} from '../utils/telemetryExport';
import {InvoiceModal} from './InvoiceModal';

interface AccountAuthPageProps {
  units: UnitSystem;
  onUnitsChange: (u: UnitSystem) => void;
  onNavigate: (page: AppPage) => void;
  onPreviewMaintenance?: () => void;
}

export function AccountAuthPage({units, onUnitsChange, onNavigate, onPreviewMaintenance}: AccountAuthPageProps) {
  const {
    firebaseUser,
    authReady,
    isAdmin,
    userAccount,
    isConfirmedPremium,
    isConfirmedVip,
    hasPendingPayment,
    savedLocations,
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
    adminConfirmPayment,
    adminRejectPayment,
    adminProcessRefund,
    adminGenerateAndSendInvoice,
    maintenanceConfig,
    toggleMaintenanceMode,
  } = useAuth();

  const [authTab, setAuthTab] = useState<'signup' | 'login'>('signup');
  const [signupName, setSignupName] = useState('');
  const [signupUnits, setSignupUnits] = useState<UnitSystem>(units);

  const [editName, setEditName] = useState(userAccount?.displayName || '');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [adminBusyId, setAdminBusyId] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);

  const [refundTxRefs, setRefundTxRefs] = useState<Record<string, string>>({});
  const [refundAdminNotes, setRefundAdminNotes] = useState<Record<string, string>>({});
  const [invoiceBusyId, setInvoiceBusyId] = useState<string | null>(null);
  const [activeInvoice, setActiveInvoice] = useState<PurchaseInvoice | null>(null);
  const [maintMessageDraft, setMaintMessageDraft] = useState(maintenanceConfig.message || '');
  const [maintBusy, setMaintBusy] = useState(false);
  const [maintFeedback, setMaintFeedback] = useState<string | null>(null);

  useEffect(() => {
    setMaintMessageDraft(maintenanceConfig.message || '');
  }, [maintenanceConfig.message]);

  useEffect(() => {
    if (userAccount?.displayName) {
      setEditName(userAccount.displayName);
    }
  }, [userAccount?.displayName]);

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    try {
      await updatePreferences({
        displayName: editName || userAccount?.displayName || 'Explorer',
        preferredUnits: units,
      });
      setProfileMsg('Profile preferences saved.');
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : 'Unable to save preferences.');
    }
  };

  const formatUiError = (err: unknown, fallback: string): string => {
    if (!(err instanceof Error)) return fallback;
    try {
      const parsed = JSON.parse(err.message) as {error?: string; path?: string};
      if (parsed?.error) {
        return parsed.path ? `${parsed.error} (${parsed.path})` : parsed.error;
      }
    } catch {
      // Plain error message
    }
    return err.message || fallback;
  };

  const handleConfirm = async (req: PaymentRequest) => {
    setAdminError(null);
    setAdminBusyId(req.requestId);
    try {
      await adminConfirmPayment(req, adminNotes[req.requestId]);
    } catch (err) {
      setAdminError(formatUiError(err, 'Failed to confirm payment.'));
    } finally {
      setAdminBusyId(null);
    }
  };

  const handleReject = async (req: PaymentRequest) => {
    setAdminError(null);
    setAdminBusyId(req.requestId);
    try {
      await adminRejectPayment(req, adminNotes[req.requestId]);
    } catch (err) {
      setAdminError(formatUiError(err, 'Failed to reject payment.'));
    } finally {
      setAdminBusyId(null);
    }
  };

  const handleGenerateAndSendInvoice = async (req: PaymentRequest) => {
    setAdminError(null);
    setInvoiceBusyId(req.requestId);
    try {
      const generated = await adminGenerateAndSendInvoice(req);
      setActiveInvoice(generated);
    } catch (err) {
      setAdminError(formatUiError(err, 'Failed to generate AI invoice.'));
    } finally {
      setInvoiceBusyId(null);
    }
  };

  const handleProcessRefund = async (req: RefundRequest, nextStatus: 'REFUNDED' | 'REJECTED') => {
    setAdminError(null);
    setAdminBusyId(req.refundId);
    try {
      await adminProcessRefund(
        req,
        nextStatus,
        refundTxRefs[req.refundId] || '',
        refundAdminNotes[req.refundId]
      );
    } catch (err) {
      setAdminError(formatUiError(err, 'Failed to process refund request.'));
    } finally {
      setAdminBusyId(null);
    }
  };

  if (!authReady) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#07090E] text-sm text-slate-400">
        Connecting authentication...
      </div>
    );
  }

  // Signed-Out Sign Up / Login Page
  if (!firebaseUser) {
    return (
      <div className="flex-1 overflow-y-auto maingo-scroll bg-[#07090E] p-4 sm:p-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-[#0B0E17] border border-slate-800/90 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="text-center space-y-1.5">
            <h1 className="font-display text-2xl font-bold text-white">MAIND GO Account</h1>
            <p className="text-xs text-slate-400">
              Browse maps and forecasts freely in Guest Mode, or sign in to save favourite locations, sync preferences, and manage VIP plans.
            </p>
          </div>

          <div className="grid grid-cols-2 p-1 bg-[#111827] border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setAuthTab('signup');
                clearAuthError();
              }}
              className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                authTab === 'signup' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Sign Up</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthTab('login');
                clearAuthError();
              }}
              className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                authTab === 'login' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Log In</span>
            </button>
          </div>

          {authTab === 'signup' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Display Name (optional)</label>
                <input
                  type="text"
                  maxLength={80}
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="How should MAIND GO greet you?"
                  className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Preferred Temperature Unit</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSignupUnits('METRIC')}
                    className={`py-2 rounded-lg border text-xs font-mono transition-colors ${
                      signupUnits === 'METRIC'
                        ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                        : 'bg-[#111827] border-slate-800 text-slate-400'
                    }`}
                  >
                    °C Metric
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignupUnits('IMPERIAL')}
                    className={`py-2 rounded-lg border text-xs font-mono transition-colors ${
                      signupUnits === 'IMPERIAL'
                        ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                        : 'bg-[#111827] border-slate-800 text-slate-400'
                    }`}
                  >
                    °F Imperial
                  </button>
                </div>
              </div>
            </div>
          )}

          {authError && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-200">
              {authError}
            </div>
          )}

          <button
            type="button"
            disabled={authBusy}
            onClick={() =>
              void signInWithGoogle(
                authTab === 'signup'
                  ? {displayName: signupName || undefined, preferredUnits: signupUnits}
                  : undefined
              )
            }
            className="w-full py-2.5 px-4 rounded-lg bg-white text-slate-950 font-semibold text-sm hover:bg-slate-100 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
          >
            <span>
              {authBusy
                ? 'Connecting...'
                : authTab === 'signup'
                  ? 'Create Account with Google'
                  : 'Sign In with Google'}
            </span>
          </button>

          <p className="text-[11px] text-center text-slate-500">
            New accounts start on Free Explorer. VIP &amp; PRO upgrades activate after payment confirmation.
          </p>
        </div>
      </div>
    );
  }

  const pendingQueue = allPaymentRequests.filter((r) => r.status === 'PENDING_CONFIRMATION');
  const reviewedQueue = allPaymentRequests.filter((r) => r.status !== 'PENDING_CONFIRMATION');
  const pendingRefundQueue = allRefundRequests.filter((r) => r.status === 'PENDING_REFUND');
  const processedRefundQueue = allRefundRequests.filter((r) => r.status !== 'PENDING_REFUND');

  return (
    <div className="flex-1 overflow-y-auto maingo-scroll bg-[#07090E] p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Account Overview Header */}
        <div className="bg-[#0B0E17] border border-slate-800/90 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {firebaseUser.photoURL ? (
              <img
                src={firebaseUser.photoURL}
                alt=""
                referrerPolicy="no-referrer"
                className="w-12 h-12 rounded-full border border-slate-700 object-cover shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center font-display font-bold text-lg text-cyan-300 shrink-0">
                {(userAccount?.displayName || 'M').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-xl font-bold text-white truncate">
                  {userAccount?.displayName || firebaseUser.displayName || 'MAIND GO User'}
                </h1>
                {isConfirmedVip ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 text-[11px] font-mono text-amber-300">
                    <Crown className="w-3 h-3" />
                    <span>VIP</span>
                  </span>
                ) : isConfirmedPremium ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/35 text-[11px] font-mono text-emerald-300">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>PRO</span>
                  </span>
                ) : hasPendingPayment ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/35 text-[11px] font-mono text-amber-200">
                    <Clock className="w-3 h-3" />
                    <span>QUEUED</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono text-slate-300">
                    FREE
                  </span>
                )}
                {isAdmin && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-500/35 text-[11px] font-mono text-cyan-300">
                    <ShieldCheck className="w-3 h-3" />
                    <span>ADMIN</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 truncate mt-0.5">{firebaseUser.email}</p>
            </div>
          </div>

          <button
            type="button"
            disabled={authBusy}
            onClick={() => void signOutUser()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#111827] border border-slate-700 hover:border-slate-500 text-xs font-medium text-slate-200 shrink-0 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Profile Preferences & Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <form
            onSubmit={handleSaveProfile}
            className="bg-[#0B0E17] border border-slate-800/90 rounded-2xl p-5 sm:p-6 space-y-4"
          >
            <h2 className="font-display text-lg font-semibold text-white">Profile Preferences</h2>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Display Name</label>
              <input
                type="text"
                maxLength={80}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Default Weather Units</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onUnitsChange('METRIC')}
                  className={`py-2 rounded-lg border text-xs font-mono transition-colors ${
                    units === 'METRIC'
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                      : 'bg-[#111827] border-slate-800 text-slate-400'
                  }`}
                >
                  °C Metric
                </button>
                <button
                  type="button"
                  onClick={() => onUnitsChange('IMPERIAL')}
                  className={`py-2 rounded-lg border text-xs font-mono transition-colors ${
                    units === 'IMPERIAL'
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                      : 'bg-[#111827] border-slate-800 text-slate-400'
                  }`}
                >
                  °F Imperial
                </button>
              </div>
            </div>

            {profileMsg && <p className="text-xs text-cyan-300">{profileMsg}</p>}

            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 text-xs font-semibold hover:bg-cyan-400 transition-colors"
            >
              Save Preferences
            </button>
          </form>

          <div className="bg-[#0B0E17] border border-slate-800/90 rounded-2xl p-5 sm:p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-white">Membership &amp; Shortcuts</h2>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => onNavigate('saved')}
                className="w-full p-3.5 rounded-xl bg-[#111827] border border-slate-800 hover:border-slate-700 flex items-center justify-between text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Bookmark className="w-4 h-4 text-cyan-400" />
                  <div>
                    <div className="text-sm font-medium text-white">Saved Locations</div>
                    <div className="text-xs text-slate-400">
                      {savedLocations.length} saved {!isConfirmedPremium ? '(Free max 3)' : '(Unlimited VIP)'}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-cyan-300">Manage →</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('vip')}
                className="w-full p-3.5 rounded-xl bg-[#111827] border border-slate-800 hover:border-slate-700 flex items-center justify-between text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Crown className="w-4 h-4 text-amber-400" />
                  <div>
                    <div className="text-sm font-medium text-white">VIP &amp; Cancel</div>
                    <div className="text-xs text-slate-400">
                      {isConfirmedPremium
                        ? `${userAccount?.tier} Confirmed & Active · Cancel for 86% Refund`
                        : hasPendingPayment
                          ? 'Payment queued — awaiting confirmation'
                          : 'PRO at ₹5 · VIP at ₹10 via UPI'}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-amber-300">Open →</span>
              </button>
            </div>
          </div>
        </div>

        {/* User's Official AI Purchase Invoices & Refunds */}
        {(myInvoices.length > 0 || myRefundRequests.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {myInvoices.length > 0 && (
              <div className="bg-[#0B0E17] border border-cyan-500/35 rounded-2xl p-5 sm:p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <h2 className="font-display text-base font-semibold text-white">Your Official Invoices</h2>
                </div>
                <div className="space-y-2.5">
                  {myInvoices.map((inv) => (
                    <div
                      key={inv.invoiceId}
                      className="p-3 rounded-xl bg-[#111827] border border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-mono font-semibold text-white truncate">
                          {inv.invoiceNumber} · ₹{inv.paidAmountInr.toFixed(2)}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {inv.planName}
                          {inv.discountPercent > 0 ? ` (${inv.discountPercent}% OFF)` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveInvoice(inv)}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 shrink-0"
                      >
                        View Invoice
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {myRefundRequests.length > 0 && (
              <div className="bg-[#0B0E17] border border-rose-500/30 rounded-2xl p-5 sm:p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Ban className="w-4 h-4 text-rose-400" />
                  <h2 className="font-display text-base font-semibold text-white">Your 86% Refund Requests</h2>
                </div>
                <div className="space-y-2.5">
                  {myRefundRequests.map((ref) => (
                    <div
                      key={ref.refundId}
                      className="p-3 rounded-xl bg-[#111827] border border-slate-800 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-white">₹{ref.refundAmountInr.toFixed(2)} (86%)</span>
                        <span
                          className={`font-mono text-[11px] ${
                            ref.status === 'REFUNDED'
                              ? 'text-emerald-300'
                              : ref.status === 'REJECTED'
                                ? 'text-rose-300'
                                : 'text-amber-300'
                          }`}
                        >
                          {ref.status}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-400">UPI: {ref.refundUpiId}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Admin Maintenance Control & Dashboards */}
        {isAdmin && (
          <div className="space-y-6">
            {/* Admin Maintenance Mode Control Card */}
            <div
              className={`rounded-2xl p-5 sm:p-6 space-y-4 border transition-colors ${
                maintenanceConfig.enabled
                  ? 'bg-amber-950/20 border-amber-500/50'
                  : 'bg-[#0B0E17] border-slate-800/90'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                      maintenanceConfig.enabled
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                        : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                    }`}
                  >
                    <Wrench className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg font-semibold text-white">
                        Admin Maintenance Mode Control
                      </h2>
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[11px] font-semibold ${
                          maintenanceConfig.enabled
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
                        }`}
                      >
                        {maintenanceConfig.enabled ? 'MAINTENANCE ON (HTTP 503)' : 'PUBLIC LIVE'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 max-w-2xl">
                      When enabled, all public visitors see the full-screen Maintenance Page and receive HTTP 503 on public routes. Only verified administrators can access the platform and disable maintenance.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {onPreviewMaintenance && (
                    <button
                      type="button"
                      onClick={onPreviewMaintenance}
                      className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-xl bg-[#111827] border border-slate-700 hover:border-slate-500 text-xs font-medium text-slate-200 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
                      <span>Preview Page</span>
                    </button>
                  )}

                  <button
                    type="button"
                    role="switch"
                    aria-checked={maintenanceConfig.enabled}
                    disabled={maintBusy}
                    onClick={async () => {
                      setMaintBusy(true);
                      setMaintFeedback(null);
                      try {
                        const nextEnabled = !maintenanceConfig.enabled;
                        await toggleMaintenanceMode(nextEnabled, maintMessageDraft);
                        setMaintFeedback(
                          nextEnabled
                            ? 'Maintenance Mode enabled. Public visitors now see the Maintenance Page (HTTP 503).'
                            : 'Maintenance Mode disabled. Public access to MAIND GO is restored.'
                        );
                      } catch (err) {
                        setMaintFeedback(
                          formatUiError(err, 'Unable to update maintenance mode state.')
                        );
                      } finally {
                        setMaintBusy(false);
                      }
                    }}
                    className={`inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl text-xs font-semibold transition-colors disabled:opacity-60 ${
                      maintenanceConfig.enabled
                        ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                        : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>
                      {maintBusy
                        ? 'Updating...'
                        : maintenanceConfig.enabled
                          ? 'Turn Maintenance OFF'
                          : 'Turn Maintenance ON'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  maxLength={240}
                  value={maintMessageDraft}
                  onChange={(e) => setMaintMessageDraft(e.target.value)}
                  placeholder="Optional admin status note shown under description (max 240 chars)"
                  className="flex-1 px-3 py-2 rounded-lg bg-[#111827] border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  disabled={maintBusy}
                  onClick={async () => {
                    setMaintBusy(true);
                    setMaintFeedback(null);
                    try {
                      await toggleMaintenanceMode(maintenanceConfig.enabled, maintMessageDraft);
                      setMaintFeedback('Maintenance status note updated.');
                    } catch (err) {
                      setMaintFeedback(formatUiError(err, 'Unable to update status note.'));
                    } finally {
                      setMaintBusy(false);
                    }
                  }}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 disabled:opacity-60 shrink-0 transition-colors"
                >
                  Save Note
                </button>
              </div>

              {maintFeedback && (
                <p className="text-xs font-medium text-cyan-300">{maintFeedback}</p>
              )}
            </div>

            <div className="bg-[#0B0E17] border border-cyan-500/35 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-cyan-400" />
                  <div>
                    <h2 className="font-display text-lg font-semibold text-white">
                      Admin Payment Confirmation &amp; AI Invoice Desk
                    </h2>
                    <p className="text-xs text-slate-400">
                      Confirm incoming UPI transfers and generate &amp; send real AI purchase invoices directly to users.
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/35 text-xs font-mono text-amber-300">
                  {pendingQueue.length} Pending
                </span>
              </div>

              {adminError && (
                <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-200">
                  {adminError}
                </div>
              )}

              {pendingQueue.length === 0 ? (
                <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 text-xs text-slate-400 text-center">
                  No payments currently waiting in the confirmation queue.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingQueue.map((req) => {
                    const paidInr = req.paidAmountInr ?? PLAN_PRICING[req.planId]?.inrAmount ?? 0;
                    const discountPct = req.discountPercent ?? 0;
                    return (
                      <div
                        key={req.requestId}
                        className="p-4 rounded-xl bg-[#111827] border border-amber-500/35 space-y-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="text-sm font-semibold text-white">
                              {req.userDisplayName}{' '}
                              <span className="text-xs font-normal text-slate-400">({req.userEmail})</span>
                            </div>
                            <div className="text-xs font-mono text-cyan-300">
                              {req.planId} · ₹{paidInr.toLocaleString('en-IN')} (${req.amountUsd.toFixed(2)})
                              {discountPct > 0 ? ` · ${discountPct}% OFF` : ''} · Ref: {req.transactionRef}
                            </div>
                            <div className="text-xs text-slate-300">
                              Payer: {req.payerName}
                              {req.note ? ` · "${req.note}"` : ''}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[11px] font-mono">
                            PENDING_CONFIRMATION
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            maxLength={240}
                            placeholder="Optional confirmation / rejection note"
                            value={adminNotes[req.requestId] || ''}
                            onChange={(e) =>
                              setAdminNotes((prev) => ({...prev, [req.requestId]: e.target.value}))
                            }
                            className="flex-1 px-3 py-1.5 rounded-lg bg-[#0B0E17] border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                          />
                          <button
                            type="button"
                            disabled={adminBusyId === req.requestId}
                            onClick={() => void handleConfirm(req)}
                            className="px-3.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-semibold hover:bg-emerald-400 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Confirm &amp; Activate</span>
                          </button>
                          <button
                            type="button"
                            disabled={adminBusyId === req.requestId}
                            onClick={() => void handleReject(req)}
                            className="px-3.5 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-semibold hover:bg-rose-500/30 disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {reviewedQueue.length > 0 && (
                <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500">
                    Confirmed &amp; Reviewed Requests — Send AI Invoice
                  </h3>
                  {adminError && (
                    <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-200">
                      {adminError}
                    </div>
                  )}
                  <div className="space-y-2">
                    {reviewedQueue.slice(0, 10).map((req) => {
                      const existingInv = allInvoices.find(
                        (inv) => inv.paymentRequestId === req.requestId
                      );
                      const paidInr = req.paidAmountInr ?? PLAN_PRICING[req.planId]?.inrAmount ?? 0;
                      return (
                        <div
                          key={req.requestId}
                          className="px-3.5 py-2.5 rounded-lg bg-[#111827]/70 border border-slate-800/70 flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="text-slate-200">
                              {req.userEmail} · <span className="font-mono">{req.transactionRef}</span> ({req.planId})
                            </div>
                            <div className="font-mono text-[11px] text-slate-400">
                              ₹{paidInr.toLocaleString('en-IN')}
                              {req.discountPercent ? ` (${req.discountPercent}% OFF)` : ''} ·{' '}
                              <span
                                className={
                                  req.status === 'CONFIRMED' ? 'text-emerald-300' : 'text-rose-300'
                                }
                              >
                                {req.status}
                              </span>
                            </div>
                          </div>

                          {req.status === 'CONFIRMED' && (
                            <div className="flex items-center gap-2">
                              {existingInv ? (
                                <button
                                  type="button"
                                  onClick={() => setActiveInvoice(existingInv)}
                                  className="px-3 py-1.5 rounded-md bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/25 inline-flex items-center gap-1.5"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>View Sent AI Invoice</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={invoiceBusyId === req.requestId}
                                  onClick={() => void handleGenerateAndSendInvoice(req)}
                                  className="px-3 py-1.5 rounded-md bg-amber-400 text-slate-950 text-xs font-semibold hover:bg-amber-300 disabled:opacity-50 inline-flex items-center gap-1.5"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>
                                    {invoiceBusyId === req.requestId
                                      ? 'Generating AI Invoice...'
                                      : 'Generate & Send AI Invoice'}
                                  </span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Admin VIP Cancellation & 86% Refund Queue */}
            <div className="bg-[#0B0E17] border border-rose-500/35 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Ban className="w-5 h-5 text-rose-400" />
                  <div>
                    <h2 className="font-display text-lg font-semibold text-white">
                      Admin VIP Cancellation &amp; 86% Refund Queue
                    </h2>
                    <p className="text-xs text-slate-400">
                      Issue 86% UPI refunds (14% Administration Charge retained by MAIND GO) and log refund UTR references.
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/35 text-xs font-mono text-rose-300">
                  {pendingRefundQueue.length} Pending Refunds
                </span>
              </div>

              {pendingRefundQueue.length === 0 ? (
                <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 text-xs text-slate-400 text-center">
                  No VIP cancellation refund requests awaiting payout.
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRefundQueue.map((ref) => (
                    <div
                      key={ref.refundId}
                      className="p-4 rounded-xl bg-[#111827] border border-rose-500/35 space-y-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-white">
                            {ref.userDisplayName}{' '}
                            <span className="text-xs font-normal text-slate-400">({ref.userEmail})</span>
                          </div>
                          <div className="text-xs font-mono text-emerald-300">
                            Pay 86% Refund: ₹{ref.refundAmountInr.toFixed(2)} · Paid: ₹{ref.paidAmountInr.toFixed(2)} · 14% Admin Charge
                          </div>
                          <div className="text-xs font-mono text-cyan-300">
                            Destination UPI: {ref.refundUpiId}
                          </div>
                          {ref.reason && (
                            <div className="text-xs text-slate-300">Reason: &quot;{ref.reason}&quot;</div>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 text-[11px] font-mono">
                          PENDING_REFUND
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          maxLength={80}
                          placeholder="Refund UPI UTR / Transaction Ref"
                          value={refundTxRefs[ref.refundId] || ''}
                          onChange={(e) =>
                            setRefundTxRefs((prev) => ({...prev, [ref.refundId]: e.target.value}))
                          }
                          className="px-3 py-1.5 rounded-lg bg-[#0B0E17] border border-slate-700 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                        />
                        <input
                          type="text"
                          maxLength={240}
                          placeholder="Optional refund admin note"
                          value={refundAdminNotes[ref.refundId] || ''}
                          onChange={(e) =>
                            setRefundAdminNotes((prev) => ({...prev, [ref.refundId]: e.target.value}))
                          }
                          className="px-3 py-1.5 rounded-lg bg-[#0B0E17] border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={adminBusyId === ref.refundId}
                          onClick={() => void handleProcessRefund(ref, 'REFUNDED')}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 text-xs font-semibold hover:bg-emerald-400 disabled:opacity-50 inline-flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Mark 86% Refunded (₹{ref.refundAmountInr.toFixed(2)})</span>
                        </button>
                        <button
                          type="button"
                          disabled={adminBusyId === ref.refundId}
                          onClick={() => void handleProcessRefund(ref, 'REJECTED')}
                          className="px-3.5 py-1.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-semibold hover:bg-rose-500/30 disabled:opacity-50 inline-flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {processedRefundQueue.length > 0 && (
                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500">
                    Processed Refunds
                  </h3>
                  <div className="space-y-2">
                    {processedRefundQueue.slice(0, 6).map((ref) => (
                      <div
                        key={ref.refundId}
                        className="px-3.5 py-2 rounded-lg bg-[#111827]/70 border border-slate-800/70 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <span className="text-slate-300">
                          {ref.userEmail} · ₹{ref.refundAmountInr.toFixed(2)} (86%) → {ref.refundUpiId}
                          {ref.refundTxRef ? ` · UTR: ${ref.refundTxRef}` : ''}
                        </span>
                        <span
                          className={`font-mono text-[11px] ${
                            ref.status === 'REFUNDED' ? 'text-emerald-300' : 'text-rose-300'
                          }`}
                        >
                          {ref.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {activeInvoice && (
        <InvoiceModal invoice={activeInvoice} onClose={() => setActiveInvoice(null)} />
      )}
    </div>
  );
}
