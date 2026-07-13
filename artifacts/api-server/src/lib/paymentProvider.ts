/**
 * Payment provider adapter.
 *
 * All Moolre API calls (or any real payment integration) must go through
 * this interface. Route/webhook code should depend only on
 * `PaymentProvider`, never on a concrete implementation.
 */

import { MoolrePaymentProvider } from "./moolrePaymentProvider";
import { resolveMoolreCredentials } from "./moolreConfig";
import type { MomoProvider } from "./moolreClient";

export type ProviderTransactionStatus = "pending" | "succeeded" | "failed";

export interface ChargeRequest {
  orderId: number;
  amount: string;
  payerPhone: string;
  /** Explicit MoMo network — preferred over inferring from phone prefix. */
  momoProvider?: MomoProvider;
  /** Platform-generated reference — stored in DB before the API call. */
  reference: string;
  /** Moolre TP14 phone-verification OTP, when required. */
  otpCode?: string;
}

export interface ChargeResult {
  reference: string;
  status: ProviderTransactionStatus;
  providerTransactionId?: string;
  /**
   * OTP was accepted but Moolre did not start a MoMo/USSD collection.
   * Caller should start a fresh collection without OTP.
   */
  needsFollowUpCollection?: boolean;
}

export interface DisburseRequest {
  orderId: number;
  amount: string;
  payoutMomoNumber: string;
  /** Platform-generated reference — stored in DB before the API call. */
  reference: string;
}

export interface DisburseResult {
  reference: string;
  status: ProviderTransactionStatus;
  providerTransactionId?: string;
}

export interface RefundRequest {
  orderId: number;
  amount: string;
  reference: string;
  /** Buyer MoMo number — required for Moolre (refund = transfer). */
  recipientPhone?: string;
}

export interface RefundResult {
  reference: string;
  status: ProviderTransactionStatus;
  providerTransactionId?: string;
}

export interface PaymentProvider {
  charge(request: ChargeRequest): Promise<ChargeResult>;
  disburse(request: DisburseRequest): Promise<DisburseResult>;
  refund(request: RefundRequest): Promise<RefundResult>;
  /** Polling fallback for stuck collection transactions. */
  getCollectionStatus(reference: string): Promise<ProviderTransactionStatus>;
  /** Polling fallback for stuck disbursement transactions. */
  getDisbursementStatus(reference: string): Promise<ProviderTransactionStatus>;
}

const MOCK_SETTLE_MS = Number(process.env.MOCK_PAYMENT_SETTLE_MS ?? "4000");

type TrackedTxn = { createdAt: number; kind: "collection" | "disbursement" };

/**
 * Mock provider — always returns pending synchronously. Simulates async
 * settlement after MOCK_SETTLE_MS for polling fallback testing.
 */
export class MockPaymentProvider implements PaymentProvider {
  private readonly tracked = new Map<string, TrackedTxn>();

  private track(reference: string, kind: TrackedTxn["kind"]): void {
    this.tracked.set(reference, { createdAt: Date.now(), kind });
  }

  private simulatedStatus(reference: string): ProviderTransactionStatus {
    const entry = this.tracked.get(reference);
    if (!entry) return "failed";
    if (Date.now() - entry.createdAt >= MOCK_SETTLE_MS) return "succeeded";
    return "pending";
  }

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    this.track(request.reference, "collection");
    return {
      reference: request.reference,
      status: "pending",
      providerTransactionId: `mock-col-${request.orderId}`,
    };
  }

  async disburse(request: DisburseRequest): Promise<DisburseResult> {
    this.track(request.reference, "disbursement");
    return {
      reference: request.reference,
      status: "pending",
      providerTransactionId: `mock-dis-${request.orderId}`,
    };
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    this.track(request.reference, "collection");
    return {
      reference: request.reference,
      status: "pending",
      providerTransactionId: `mock-ref-${request.orderId}`,
    };
  }

  async getCollectionStatus(reference: string): Promise<ProviderTransactionStatus> {
    return this.simulatedStatus(reference);
  }

  async getDisbursementStatus(reference: string): Promise<ProviderTransactionStatus> {
    return this.simulatedStatus(reference);
  }
}

function createPaymentProvider(): PaymentProvider {
  const creds = resolveMoolreCredentials();
  if (creds) {
    return new MoolrePaymentProvider(creds);
  }
  return new MockPaymentProvider();
}

export const paymentProvider: PaymentProvider = createPaymentProvider();
