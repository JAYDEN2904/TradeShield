/** Moolre TP14 — payer must submit the SMS verification OTP and retry. */
export class PaymentOtpRequiredError extends Error {
  constructor(
    message = "Enter the verification code sent to your phone by SMS, then try again.",
  ) {
    super(message);
    this.name = "PaymentOtpRequiredError";
  }
}

/** Provider rejected the charge/payout synchronously — order was rolled back. */
export class PaymentProviderRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentProviderRejectedError";
  }
}

export class PaymentInProgressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentInProgressError";
  }
}
