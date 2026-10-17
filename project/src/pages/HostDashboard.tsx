<div className="pt-3 border-t border-line space-y-3" onClick={(e) => e.stopPropagation()}>
  {booking.status === 'pending' ? (
    <button 
      onClick={() => updateBookingStatus(booking.id, 'cancelled')}
      className="text-sm font-medium text-red-500 hover:text-red-600 uppercase tracking-wide-sm transition-colors"
    >
      Cancel Request
    </button>
  ) : (
    <div className="flex flex-col gap-3">
      {/* Option A: Pending Verification State (Awaiting Artist Confirmation) */}
      {isPendingVerification && (
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide-sm text-amber-800 bg-amber-50 px-3 py-2 rounded border border-amber-200 w-fit">
          <Clock3 className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
          <span>Payment Reference Submitted — Awaiting Talent Confirmation</span>
        </div>
      )}

      {/* Option B: Deposit Not Paid & Not Pending */}
      {!isDepositPaid && !isPendingVerification && (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={(e) => handlePaymentRedirect(booking, 'deposit')}
              className="px-3 py-1.5 bg-ink text-paper text-xs font-semibold uppercase tracking-wide-sm rounded hover:bg-ink/80 flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Pay Deposit ({formatCurrency(booking.deposit_amount)})</span>
            </button>
          </div>

          {submittingRefId === booking.id ? (
            <div className="bg-paper p-3 border border-line space-y-2 rounded max-w-md">
              <p className="text-xs text-ink-500">
                Enter your official <strong>Yoco Transaction Reference</strong> from your payment receipt email/SMS:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. YCO-83921"
                  value={refInput}
                  onChange={(e) => setRefInput(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-line rounded flex-1 bg-white text-ink"
                />
                <button
                  onClick={() => submitPaymentReference(booking)}
                  className="px-3 py-1.5 bg-emerald-700 text-white text-xs font-semibold uppercase tracking-wide-sm rounded hover:bg-emerald-800 whitespace-nowrap"
                >
                  Verify & Submit
                </button>
                <button
                  onClick={() => setSubmittingRefId(null)}
                  className="px-2 py-1.5 text-xs text-ink-400 hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setSubmittingRefId(booking.id)}
              className="text-xs text-ink-500 underline hover:text-ink w-fit"
            >
              Already paid on Yoco? Enter receipt reference to verify
            </button>
          )}
        </div>
      )}

      {/* Option C: Deposit Paid, Remaining Balance STILL Unpaid/Unverified */}
      {isDepositPaid && !isBalancePaid && !isPendingVerification && (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={(e) => handlePaymentRedirect(booking, 'remaining')}
              className="px-3 py-1.5 bg-emerald-700 text-white text-xs font-semibold uppercase tracking-wide-sm rounded hover:bg-emerald-800 flex items-center gap-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Pay Remaining ({formatCurrency(remainingBalance > 0 ? remainingBalance : booking.total_price)})</span>
            </button>
          </div>

          {submittingRefId === booking.id ? (
            <div className="bg-paper p-3 border border-line space-y-2 rounded max-w-md">
              <p className="text-xs text-ink-500">
                Enter your official <strong>Yoco Transaction Reference</strong> for the remaining balance:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. YCO-99120"
                  value={refInput}
                  onChange={(e) => setRefInput(e.target.value)}
                  className="px-3 py-1.5 text-xs border border-line rounded flex-1 bg-white text-ink"
                />
                <button
                  onClick={() => submitPaymentReference(booking)}
                  className="px-3 py-1.5 bg-emerald-700 text-white text-xs font-semibold uppercase tracking-wide-sm rounded hover:bg-emerald-800 whitespace-nowrap"
                >
                  Verify & Submit
                </button>
                <button
                  onClick={() => setSubmittingRefId(null)}
                  className="px-2 py-1.5 text-xs text-ink-400 hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setSubmittingRefId(booking.id)}
              className="text-xs text-ink-500 underline hover:text-ink w-fit"
            >
              Already paid remaining on Yoco? Enter receipt reference to verify
            </button>
          )}
        </div>
      )}

      {/* Option D: Show "FULLY PAID" ONLY AFTER Artist has Accepted/Verified Payment */}
      {isBalancePaid && (
        <span className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-semibold uppercase tracking-wide-sm rounded inline-flex items-center gap-1.5 w-fit">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Fully Paid
        </span>
      )}
    </div>
  )}
</div>
