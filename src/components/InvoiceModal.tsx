import {CheckCircle2, Printer, Sparkles, X} from 'lucide-react';
import {PurchaseInvoice} from '../types/weather';
import {OFFICIAL_UPI_ID} from '../utils/telemetryExport';

interface InvoiceModalProps {
  invoice: PurchaseInvoice;
  onClose: () => void;
}

export function InvoiceModal({invoice, onClose}: InvoiceModalProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-modal-title"
      className="fixed inset-0 z-50 bg-[#07090E]/90 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center overflow-y-auto print:bg-white print:p-0"
    >
      <div className="max-w-2xl w-full bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 print:shadow-none print:border-0 print:rounded-none">
        {/* Modal Toolbar (hidden when printing) */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2 text-xs font-mono">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Official AI-Generated Purchase Invoice</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-500 text-slate-950 text-xs font-semibold hover:bg-cyan-400 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close invoice"
              className="p-1.5 rounded-md text-slate-300 hover:text-white hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Real Invoice Document Sheet */}
        <div className="p-6 sm:p-8 space-y-6 text-slate-800">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-200">
            <div>
              <div className="font-display text-2xl font-bold tracking-tight text-slate-950">
                MAIND GO
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Global Weather &amp; Satellite Telemetry Platform
              </p>
              <p className="text-xs text-slate-500">
                UPI Merchant ID: <span className="font-mono text-slate-700">{OFFICIAL_UPI_ID}</span> · support.maindgo@gmail.com
              </p>
            </div>

            <div className="sm:text-right space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>PAID &amp; CONFIRMED</span>
              </div>
              <h2 id="invoice-modal-title" className="font-mono text-sm font-bold text-slate-900">
                {invoice.invoiceNumber}
              </h2>
              <p className="text-xs text-slate-500 font-mono">Issued: {invoice.issueDate}</p>
            </div>
          </div>

          {/* Summary Headline */}
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-800">{invoice.summaryHeadline}</span>
            <span className="text-xs font-mono text-slate-600">{invoice.billingPeriod}</span>
          </div>

          {/* Billed To & Payment Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <p className="font-mono uppercase tracking-wider text-[11px] text-slate-400">Billed To</p>
              <p className="font-semibold text-slate-900 text-sm">{invoice.userDisplayName}</p>
              <p className="text-slate-600">{invoice.userEmail || 'Verified MAIND GO Account'}</p>
            </div>
            <div className="space-y-1 sm:text-right">
              <p className="font-mono uppercase tracking-wider text-[11px] text-slate-400">Payment Verification</p>
              <p className="font-mono text-slate-800">UTR / Ref: {invoice.transactionRef}</p>
              <p className="text-slate-600">
                Approved &amp; Sent by: <span className="font-mono">{invoice.sentByAdminEmail}</span>
              </p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-mono uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoice.lineItems.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-2.5 px-4 text-slate-800">{item.description}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                      {item.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200 font-semibold">
                <tr>
                  <td className="py-3 px-4 text-slate-900">
                    Total Net Paid via UPI
                    {invoice.discountPercent > 0 ? ` (${invoice.discountPercent}% Discount Applied)` : ''}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-base text-slate-950">
                    ₹{invoice.paidAmountInr.toFixed(2)}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      (${invoice.amountUsd.toFixed(2)})
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* AI Verification Note & Cancellation Policy */}
          <div className="space-y-3 text-xs text-slate-600 leading-relaxed pt-2 border-t border-slate-200">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <p className="font-semibold text-slate-800 mb-0.5">AI Verification &amp; Billing Statement</p>
              <p>{invoice.aiVerificationNote}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-800 mb-0.5">Terms &amp; Refund Policy</p>
              <p>{invoice.termsAndConditions}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
