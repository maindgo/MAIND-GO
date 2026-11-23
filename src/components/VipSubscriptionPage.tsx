import {
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  Download,
  ExternalLink,
  FileText,
  Lock,
  ShieldAlert,
  Smartphone,
  Sparkles,
  XCircle,
} from 'lucide-react';
import {FormEvent, useEffect, useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {
  AppPage,
  LocationWeatherBundle,
  PlanId,
  PurchaseInvoice,
  UnitSystem,
} from '../types/weather';
import {
  OFFICIAL_UPI_ID,
  PLAN_PRICING,
  buildUpiPaymentUri,
  computeDiscountedPlanPricing,
  exportDailyTelemetryCsv,
  exportHourlyTelemetryCsv,
} from '../utils/telemetryExport';
import {formatTempValue, tempUnitLabel} from '../utils/weatherFormat';
import {InvoiceModal} from './InvoiceModal';

interface VipSubscriptionPageProps {
  currentBundle: LocationWeatherBundle | null;
  units: UnitSystem;
  onNavigate: (page: AppPage) => void;
}

const PLAN_DETAILS: Array<{
  id: PlanId;
  features: string[];
}> = [
  {
    id: 'PRO_MONTHLY',
    features: [
      'Unlimited Saved Weather Locations',
      '24-Hour & 10-Day CSV Telemetry Export',
      'Live Dew-Point Spread, Stability & Storm Risk',
      '2x & 3x High-Speed Radar & Satellite Playback',
      'Official AI Purchase Invoice & 86% Refund Guarantee',
    ],
  },
  {
    id: 'VIP_ANNUAL',
    features: [
      'Everything in PRO Forecaster',
      'VIP Status, Priority Alert Summary & Fog Risk Index',
      'Full Atmospheric Comfort Delta & Convection Readouts',
      'Official AI Purchase Invoice from Admin Dashboard',
      'Cancel Anytime with 86% Instant Refund (14% Admin Charge)',
    ],
  },
];

export function VipSubscriptionPage({
  currentBundle,
  units,
  onNavigate,
}: VipSubscriptionPageProps) {
  const {
    firebaseUser,
    userAccount,
    isConfirmedPremium,
    isConfirmedVip,
    hasPendingPayment,
    myPaymentRequests,
    myRefundRequests,
    myInvoices,
    submitPaymentRequest,
    cancelVipAndRequestRefund,
  } = useAuth();

  const [selectedPlan, setSelectedPlan] = useState<PlanId>('VIP_ANNUAL');
  const [payerName, setPayerName] = useState(userAccount?.displayName || '');
  const [transactionRef, setTransactionRef] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{type: 'ok' | 'err'; text: string} | null>(null);

  // Cancel VIP & 86% Refund form state
  const [refundUpiId, setRefundUpiId] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [cancellingVip, setCancellingVip] = useState(false);
  const [refundFeedback, setRefundFeedback] = useState<{type: 'ok' | 'err'; text: string} | null>(null);

  // Invoice Modal state
  const [activeInvoice, setActiveInvoice] = useState<PurchaseInvoice | null>(null);

  useEffect(() => {
    if (userAccount?.displayName && !payerName) {
      setPayerName(userAccount.displayName);
    }
  }, [userAccount?.displayName, payerName]);

  const effectiveDiscount = 0;
  const activePlanInfo = PLAN_PRICING[selectedPlan];
  const discountedActive = computeDiscountedPlanPricing(selectedPlan, effectiveDiscount);
  const upiUri = buildUpiPaymentUri(selectedPlan, effectiveDiscount, firebaseUser?.email);

  const handleCopyUpi = async () => {
    try {
      await navigator.clipboard.writeText(OFFICIAL_UPI_ID);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    } catch {
      // Clipboard fallback ignored if blocked
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitMessage(null);
    setSubmitting(true);
    try {
      await submitPaymentRequest({
        planId: selectedPlan,
        discountPercent: effectiveDiscount,
        paymentMethod: 'UPI',
        transactionRef,
        payerName: payerName || userAccount?.displayName || 'MAIND GO Member',
        note,
      });
      setTransactionRef('');
      setNote('');
      setSubmitMessage({
        type: 'ok',
        text: `UPI payment of ${discountedActive.finalInrFormatted} submitted to the confirmation queue. Your account remains on the Free tier until our admin verifies the transfer to tntmilan06@slc.`,
      });
    } catch (err) {
      setSubmitMessage({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to submit UPI payment reference.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelVipSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setRefundFeedback(null);
    setCancellingVip(true);
    try {
      await cancelVipAndRequestRefund({
        refundUpiId,
        reason: refundReason,
      });
      setRefundUpiId('');
      setRefundReason('');
      setRefundFeedback({
        type: 'ok',
        text: 'VIP subscription cancelled and access revoked. Your 86% refund request (14% Administration Charge deducted) has been queued for payout by Admin.',
      });
    } catch (err) {
      setRefundFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to process VIP cancellation.',
      });
    } finally {
      setCancellingVip(false);
    }
  };

  const pendingRequest = myPaymentRequests.find((r) => r.status === 'PENDING_CONFIRMATION');
  const latestConfirmedPayment = myPaymentRequests.find((r) => r.status === 'CONFIRMED');
  const fallbackTierPlan: PlanId = userAccount?.tier === 'VIP' ? 'VIP_ANNUAL' : 'PRO_MONTHLY';
  const refundableBaseInr = Number(
    latestConfirmedPayment?.paidAmountInr || PLAN_PRICING[latestConfirmedPayment?.planId || fallbackTierPlan].inrAmount
  );
  const adminChargeInr = Number((refundableBaseInr * 0.14).toFixed(2));
  const netRefundInr = Math.max(1, Number((refundableBaseInr * 0.86).toFixed(2)));

  const dewPointSpreadC = currentBundle
    ? currentBundle.current.temperatureC - currentBundle.current.dewPointC
    : 0;
  const comfortDeltaC = currentBundle
    ? currentBundle.current.feelsLikeC - currentBundle.current.temperatureC
    : 0;

  return (
    <div className="flex-1 overflow-y-auto maingo-scroll bg-[#07090E] p-4 sm:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header & Current Confirmation Gate Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-amber-400">
              <Crown className="w-3.5 h-3.5" />
              <span>VIP &amp; Subscriptions</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mt-1 text-balance">
              MAIND GO Premium Plans
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Pay ₹5–₹10 directly via UPI to <span className="font-mono text-cyan-300">{OFFICIAL_UPI_ID}</span>, and receive an official AI purchase invoice after admin confirmation.
            </p>
          </div>

          <div className="px-3.5 py-2 rounded-lg bg-[#111827] border border-slate-800 text-xs font-mono flex items-center gap-2 shrink-0">
            {isConfirmedVip ? (
              <>
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="text-amber-300 font-semibold">VIP CONFIRMED</span>
              </>
            ) : isConfirmedPremium ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300 font-semibold">PRO CONFIRMED</span>
              </>
            ) : hasPendingPayment ? (
              <>
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-amber-200 font-semibold">QUEUED · LOCKED</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-slate-400" />
                <span className="text-slate-300">FREE TIER</span>
              </>
            )}
          </div>
        </div>

        {/* Active Confirmation Queue Banner when payment is pending */}
        {pendingRequest && (
          <div className="p-4 sm:p-5 rounded-xl bg-amber-950/25 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>UPI Payment Queued for Confirmation</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Your <span className="font-mono font-semibold text-white">{PLAN_PRICING[pendingRequest.planId].name}</span> transfer of{' '}
                <span className="font-mono text-emerald-300">
                  ₹{(pendingRequest.paidAmountInr ?? PLAN_PRICING[pendingRequest.planId].inrAmount).toLocaleString('en-IN')}
                </span>{' '}
                to <span className="font-mono text-cyan-300">{OFFICIAL_UPI_ID}</span> (UTR/Ref:{' '}
                <span className="font-mono text-amber-200">{pendingRequest.transactionRef}</span>) is awaiting admin verification.
                Premium tools remain <span className="text-amber-300 font-semibold">locked</span> until confirmed.
              </p>
            </div>
            <span className="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-xs font-mono text-amber-300 shrink-0">
              PENDING_CONFIRMATION
            </span>
          </div>
        )}

        {/* Plan Comparison Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Free Plan */}
          <div className="bg-[#0B0E17] border border-slate-800/90 rounded-xl p-5 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="text-xs font-mono uppercase tracking-wider text-slate-400">Starter</div>
              <div>
                <h2 className="font-display text-xl font-bold text-white">Free Explorer</h2>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-mono tabular-nums text-3xl font-bold text-white">₹0</span>
                  <span className="text-xs text-slate-400">forever</span>
                </div>
              </div>
              <ul className="space-y-2 text-xs text-slate-300 pt-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Live Radar, Wind &amp; Air Quality Map</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>24-Hour Interactive Temperature Chart</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>10-Day Forecast &amp; Solar Cycle Widget</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Up to 3 Saved Locations</span>
                </li>
              </ul>
            </div>
            <div className="pt-3 border-t border-slate-800/80 text-xs font-mono text-slate-400">
              {!isConfirmedPremium ? 'Active Default Plan' : 'Included in your plan'}
            </div>
          </div>

          {PLAN_DETAILS.map(({id, features}) => {
            const plan = PLAN_PRICING[id];
            const pricing = computeDiscountedPlanPricing(id, effectiveDiscount);
            const isSelected = selectedPlan === id;
            const isActivePlan =
              isConfirmedPremium &&
              ((id === 'VIP_ANNUAL' && userAccount?.tier === 'VIP') ||
                (id === 'PRO_MONTHLY' && userAccount?.tier === 'PRO'));
            return (
              <div
                key={id}
                className={`bg-[#0B0E17] border rounded-xl p-5 flex flex-col justify-between gap-4 transition-colors ${
                  isSelected
                    ? 'border-cyan-500/80'
                    : 'border-slate-800/90 hover:border-slate-700'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="uppercase tracking-wider text-amber-400">
                      {plan.tierLabel} Tier
                    </span>
                    {id === 'VIP_ANNUAL' ? (
                      <span className="text-amber-300">Best Value</span>
                    ) : null}
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-bold text-white">{plan.name}</h2>
                    <div className="mt-2 flex flex-wrap items-baseline gap-2">
                      <span className="font-mono tabular-nums text-3xl font-bold text-white">
                        {pricing.finalInrFormatted}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        ({pricing.finalUsdFormatted}) · {plan.periodLabel}
                      </span>
                    </div>
                  </div>
                  <ul className="space-y-2 text-xs text-slate-300 pt-2">
                    {features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedPlan(id)}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                    isActivePlan
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                      : isSelected
                        ? 'bg-cyan-500 text-slate-950'
                        : 'bg-[#111827] border border-slate-700 text-slate-200 hover:border-cyan-500/50'
                  }`}
                >
                  {isActivePlan ? 'Confirmed & Active' : isSelected ? 'Selected for UPI Pay' : `Select ${plan.tierLabel}`}
                </button>
              </div>
            );
          })}
        </div>

        {/* Two-Column Direct UPI Checkout OR Cancel VIP + Live VIP Vault */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Direct UPI App Redirect OR Confirmed Plan Cancel & 86% Refund */}
          <div className="bg-[#0B0E17] border border-slate-800/90 rounded-xl p-5 sm:p-6 space-y-4">
            {isConfirmedPremium ? (
              <>
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h2 className="font-display text-lg font-semibold text-white">
                      Active {userAccount?.tier} Membership
                    </h2>
                    <p className="text-xs text-slate-400">
                      All premium radar speeds, exports, and telemetry are unlocked.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-950/25 border border-emerald-500/40 text-xs text-emerald-200 space-y-1">
                  <p className="font-semibold">
                    Your {userAccount?.tier} plan is confirmed and active.
                  </p>
                  <p className="text-slate-300">
                    Need to cancel? Cancel anytime for an <span className="font-semibold text-white">86% refund</span> of the exact UPI amount you paid (14% Administration Charge applies).
                  </p>
                </div>

                {/* Cancel VIP & 86% Refund Panel */}
                <form onSubmit={handleCancelVipSubmit} className="p-4 rounded-xl bg-[#111827] border border-rose-500/30 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-rose-300">
                      <Ban className="w-4 h-4" />
                      <span>Cancel VIP &amp; Request 86% Refund</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">14% Admin Charge</span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#07090E] border border-slate-800 space-y-1.5 text-xs font-mono tabular-nums">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Amount Paid to MAIND GO</span>
                      <span>₹{refundableBaseInr.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-rose-300">
                      <span>Administration Charge (14%)</span>
                      <span>−₹{adminChargeInr.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-emerald-300 font-bold pt-1.5 border-t border-slate-800">
                      <span>Your Net Refund (86%)</span>
                      <span>₹{netRefundInr.toFixed(2)}</span>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="refund-upi-id" className="block text-xs text-slate-400 mb-1">
                      Your UPI ID to Receive 86% Refund
                    </label>
                    <input
                      id="refund-upi-id"
                      type="text"
                      required
                      minLength={3}
                      maxLength={100}
                      value={refundUpiId}
                      onChange={(e) => setRefundUpiId(e.target.value)}
                      placeholder="e.g. yourname@okicici or 9876543210@ybl"
                      className="w-full px-3 py-2 rounded-lg bg-[#07090E] border border-slate-700 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-400"
                    />
                  </div>

                  <div>
                    <label htmlFor="refund-reason" className="block text-xs text-slate-400 mb-1">
                      Cancellation Reason (optional)
                    </label>
                    <input
                      id="refund-reason"
                      type="text"
                      maxLength={240}
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      placeholder="Optional note for admin"
                      className="w-full px-3 py-2 rounded-lg bg-[#07090E] border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-400"
                    />
                  </div>

                  {refundFeedback && (
                    <div
                      className={`p-3 rounded-lg text-xs border ${
                        refundFeedback.type === 'ok'
                          ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                          : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                      }`}
                    >
                      {refundFeedback.text}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={cancellingVip}
                    className="w-full py-2.5 px-4 rounded-lg bg-rose-500/20 border border-rose-500/50 text-rose-200 text-xs font-semibold hover:bg-rose-500/30 disabled:opacity-50 transition-colors"
                  >
                    {cancellingVip
                      ? 'Cancelling VIP & Queueing 86% Refund...'
                      : `Cancel VIP Now & Refund ₹${netRefundInr.toFixed(2)} (86%)`}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-5 h-5 text-cyan-400" />
                  <div>
                    <h2 className="font-display text-lg font-semibold text-white">Direct UPI Payment</h2>
                    <p className="text-xs text-slate-400">No third-party payment gateway — pay straight via your UPI app.</p>
                  </div>
                </div>

                {!firebaseUser ? (
                  <div className="p-4 rounded-xl bg-[#111827] border border-slate-800 space-y-3">
                    <p className="text-xs text-slate-300">
                      Please sign up or log in first so your UPI confirmation and AI invoice are linked to your account.
                    </p>
                    <button
                      type="button"
                      onClick={() => onNavigate('account')}
                      className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 text-xs font-semibold hover:bg-cyan-400 transition-colors"
                    >
                      Go to Sign Up / Login
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Step 1: Pay via UPI App */}
                    <div className="p-4 rounded-xl bg-[#111827] border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">Step 1 · Pay via UPI App</span>
                        <span className="font-mono font-bold text-cyan-300 tabular-nums">
                          {discountedActive.finalInrFormatted} ({discountedActive.finalUsdFormatted})
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#07090E] border border-slate-800">
                        <div className="min-w-0">
                          <div className="text-[11px] text-slate-400">Official UPI ID</div>
                          <div className="font-mono text-sm font-semibold text-white truncate">{OFFICIAL_UPI_ID}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleCopyUpi()}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 shrink-0 transition-colors"
                        >
                          {copiedUpi ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-300">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>

                      <a
                        href={upiUri}
                        className="w-full py-2.5 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                      >
                        <span>Open UPI App &amp; Pay {discountedActive.finalInrFormatted}</span>
                        <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
                      </a>

                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        Redirects directly to Google Pay, PhonePe, Paytm, or BHIM to pay{' '}
                        <span className="font-mono text-slate-200">{OFFICIAL_UPI_ID}</span>. On desktop, copy the UPI ID above and send{' '}
                        <span className="font-mono text-slate-200">{discountedActive.finalInrFormatted}</span> from your phone UPI app.
                      </p>
                    </div>

                    {/* Step 2: Submit UTR / Transaction ID */}
                    <form onSubmit={handleSubmit} className="space-y-3">
                      <div className="text-xs font-medium text-slate-200">
                        Step 2 · Submit UPI Reference After Paying
                      </div>

                      <div>
                        <label htmlFor="upi-payer-name" className="block text-xs text-slate-400 mb-1">
                          Payer Name (as shown in UPI)
                        </label>
                        <input
                          id="upi-payer-name"
                          type="text"
                          required
                          minLength={2}
                          maxLength={80}
                          disabled={Boolean(pendingRequest)}
                          value={payerName}
                          onChange={(e) => setPayerName(e.target.value)}
                          placeholder="Full name on UPI account"
                          className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div>
                        <label htmlFor="upi-utr-ref" className="block text-xs text-slate-400 mb-1">
                          UPI Transaction ID / 12-Digit UTR
                        </label>
                        <input
                          id="upi-utr-ref"
                          type="text"
                          required
                          minLength={4}
                          maxLength={80}
                          disabled={Boolean(pendingRequest)}
                          value={transactionRef}
                          onChange={(e) => setTransactionRef(e.target.value)}
                          placeholder="e.g. 432819045612"
                          className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-slate-700 text-xs font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div>
                        <label htmlFor="upi-note" className="block text-xs text-slate-400 mb-1">
                          Note (optional)
                        </label>
                        <input
                          id="upi-note"
                          type="text"
                          maxLength={240}
                          disabled={Boolean(pendingRequest)}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="UPI app used (GPay, PhonePe, Paytm) or timing"
                          className="w-full px-3 py-2 rounded-lg bg-[#111827] border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                        />
                      </div>

                      {submitMessage && (
                        <div
                          className={`p-3 rounded-lg text-xs border ${
                            submitMessage.type === 'ok'
                              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                              : 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                          }`}
                        >
                          {submitMessage.text}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={submitting || Boolean(pendingRequest)}
                        className="w-full py-2.5 px-4 rounded-lg bg-cyan-500 text-slate-950 text-xs sm:text-sm font-semibold hover:bg-cyan-400 disabled:opacity-50 transition-colors"
                      >
                        {pendingRequest
                          ? 'Payment Queued — Awaiting Admin Confirmation'
                          : submitting
                            ? 'Submitting to Queue...'
                            : `I Have Paid ${discountedActive.finalInrFormatted} — Submit for Confirmation`}
                      </button>
                    </form>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right: VIP Atmospheric Vault + Invoices + Payment & Refund History */}
          <div className="space-y-6">
            {/* VIP Features Vault (Strictly Locked Before Admin Confirmation) */}
            <div className="bg-[#0B0E17] border border-slate-800/90 rounded-xl p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {isConfirmedPremium ? (
                    <Crown className="w-5 h-5 text-amber-400" />
                  ) : (
                    <Lock className="w-5 h-5 text-amber-400" />
                  )}
                  <h2 className="font-display text-lg font-semibold text-white">VIP Atmospheric Vault</h2>
                </div>
                <span
                  className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                    isConfirmedPremium
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  {isConfirmedPremium ? 'UNLOCKED' : 'LOCKED'}
                </span>
              </div>

              {isConfirmedPremium ? (
                <div className="space-y-3">
                  {currentBundle ? (
                    <div className="p-3.5 rounded-xl bg-[#111827] border border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Active Station</span>
                        <span className="font-semibold text-white">{currentBundle.current.locationName}</span>
                      </div>
                      <div className="flex items-center justify-between font-mono tabular-nums">
                        <span className="text-slate-400">Dew-Point Spread (T − Td)</span>
                        <span className="text-cyan-300">
                          {(units === 'IMPERIAL' ? (dewPointSpreadC * 9) / 5 : dewPointSpreadC).toFixed(1)}{' '}
                          {tempUnitLabel(units)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-mono tabular-nums">
                        <span className="text-slate-400">Storm Convection Risk</span>
                        <span className="text-amber-300">
                          {currentBundle.current.thunderstormProb}% · {Math.round(currentBundle.current.pressureHpa)} hPa
                        </span>
                      </div>
                      <div className="flex items-center justify-between font-mono tabular-nums">
                        <span className="text-slate-400">Feels-Like Delta</span>
                        <span className="text-slate-200">
                          {comfortDeltaC >= 0 ? '+' : ''}
                          {(units === 'IMPERIAL' ? (comfortDeltaC * 9) / 5 : comfortDeltaC).toFixed(1)}{' '}
                          {tempUnitLabel(units)} ({formatTempValue(currentBundle.current.feelsLikeC, units)}
                          {tempUnitLabel(units)})
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={!currentBundle}
                      onClick={() => currentBundle && exportHourlyTelemetryCsv(currentBundle, units)}
                      className="py-2.5 px-3 rounded-lg bg-amber-400 text-slate-950 text-xs font-semibold hover:bg-amber-300 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export 24h CSV</span>
                    </button>
                    <button
                      type="button"
                      disabled={!currentBundle}
                      onClick={() => currentBundle && exportDailyTelemetryCsv(currentBundle, units)}
                      className="py-2.5 px-3 rounded-lg bg-cyan-500 text-slate-950 text-xs font-semibold hover:bg-cyan-400 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export 10-Day CSV</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigate('map')}
                    className="w-full py-2 px-3 rounded-lg bg-[#111827] border border-slate-700 hover:border-cyan-500/50 text-xs font-medium text-cyan-300 transition-colors"
                  >
                    Open Live Map (2x / 3x Radar Speed &amp; Telemetry Unlocked) →
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[#111827] border border-slate-800 space-y-2 text-xs text-slate-400">
                  <div className="flex items-center gap-2 text-amber-300 font-medium">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>
                      {hasPendingPayment
                        ? 'Waiting for Admin Payment Confirmation'
                        : 'Premium Features Locked'}
                    </span>
                  </div>
                  <p className="leading-relaxed">
                    {hasPendingPayment
                      ? 'Your UPI reference is in the verification queue. Unlimited saved locations, 24h & 10-day CSV exports, 2x/3x radar speeds, and dew-point/storm telemetry stay locked until your payment is confirmed.'
                      : `Select your plan, pay ${discountedActive.finalInrFormatted} (${activePlanInfo.name}) to ${OFFICIAL_UPI_ID}, and submit your UPI reference on the left.`}
                  </p>
                </div>
              )}
            </div>

            {/* Official AI-Generated Purchase Invoices */}
            {firebaseUser && myInvoices.length > 0 && (
              <div className="bg-[#0B0E17] border border-cyan-500/35 rounded-xl p-5 sm:p-6 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-mono uppercase tracking-wider text-cyan-300">
                      Official AI Purchase Invoices
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">{myInvoices.length} Issued</span>
                </div>
                <div className="space-y-2.5">
                  {myInvoices.map((inv) => (
                    <div
                      key={inv.invoiceId}
                      className="p-3.5 rounded-xl bg-[#111827] border border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="font-mono font-semibold text-white truncate">
                          {inv.invoiceNumber} · ₹{inv.paidAmountInr.toFixed(2)}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {inv.planName}
                          {inv.discountPercent > 0 ? ` (${inv.discountPercent}% OFF)` : ''} · Issued {inv.issueDate}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveInvoice(inv)}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-semibold text-xs hover:bg-cyan-400 shrink-0 transition-colors"
                      >
                        View AI Invoice
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Refund Requests History */}
            {firebaseUser && myRefundRequests.length > 0 && (
              <div className="bg-[#0B0E17] border border-rose-500/30 rounded-xl p-5 sm:p-6 space-y-3">
                <h3 className="text-xs font-mono uppercase tracking-wider text-rose-300">
                  VIP Cancellation &amp; 86% Refund Queue
                </h3>
                <div className="space-y-2.5">
                  {myRefundRequests.map((ref) => (
                    <div
                      key={ref.refundId}
                      className="p-3.5 rounded-xl bg-[#111827] border border-slate-800 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-white">
                          Refund ₹{ref.refundAmountInr.toFixed(2)} (86% of ₹{ref.paidAmountInr.toFixed(2)})
                        </span>
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
                      <div className="font-mono text-[11px] text-slate-400">
                        To UPI: {ref.refundUpiId} · 14% Admin Fee Deducted
                      </div>
                      {ref.refundTxRef && (
                        <div className="font-mono text-[11px] text-emerald-300">
                          Refund UTR: {ref.refundTxRef}
                        </div>
                      )}
                      {ref.adminNote && (
                        <div className="text-[11px] text-slate-300 pt-1 border-t border-slate-800">
                          Note: {ref.adminNote}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* User's Payment Request History */}
            {firebaseUser && myPaymentRequests.length > 0 && (
              <div className="bg-[#0B0E17] border border-slate-800/90 rounded-xl p-5 sm:p-6 space-y-3">
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                  Your Payment Queue History
                </h3>
                <div className="space-y-2.5">
                  {myPaymentRequests.map((req) => (
                    <div
                      key={req.requestId}
                      className="p-3.5 rounded-xl bg-[#111827] border border-slate-800 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-white">
                          {PLAN_PRICING[req.planId]?.name || req.planId} (₹
                          {(req.paidAmountInr ?? PLAN_PRICING[req.planId]?.inrAmount ?? 0).toLocaleString('en-IN')}
                          {req.discountPercent ? ` · ${req.discountPercent}% OFF` : ''})
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 font-mono text-[11px] ${
                            req.status === 'CONFIRMED'
                              ? 'text-emerald-300'
                              : req.status === 'REJECTED'
                                ? 'text-rose-300'
                                : 'text-amber-300'
                          }`}
                        >
                          {req.status === 'CONFIRMED' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : req.status === 'REJECTED' ? (
                            <XCircle className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          <span>{req.status}</span>
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-400">
                        UTR/Ref: {req.transactionRef} · UPI ({OFFICIAL_UPI_ID})
                      </div>
                      {req.adminNote && (
                        <div className="text-[11px] text-slate-300 pt-1 border-t border-slate-800">
                          Note: {req.adminNote}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeInvoice && (
        <InvoiceModal invoice={activeInvoice} onClose={() => setActiveInvoice(null)} />
      )}
    </div>
  );
}
