/**
 * Payment provider adapter.
 *
 * All Moolre API calls (or any real payment integration) must go through
 * this interface. Route/webhook code should depend only on
 * `PaymentProvider`, never on a concrete implementation — swapping the
 * mock for the real Moolre sandbox integration later means writing one new
 * class and changing the export at the bottom of this file, not touching
 * any call site.
 */

export interface ChargeRequest {
  orderId: number;
  amount: string;
  payerPhone: string;
}

export interface ChargeResult {
  reference: string;
  status: "pending" | "succeeded" | "failed";
}

export interface DisburseRequest {
  orderId: number;
  amount: string;
  payoutMomoNumber: string;
}

export interface DisburseResult {
  reference: string;
  status: "pending" | "succeeded" | "failed";
}

export interface PaymentProvider {
  /** Initiates a collection (buyer -> escrow). Moolre Collections in production. */
  charge(request: ChargeRequest): Promise<ChargeResult>;
  /** Initiates a disbursement (escrow -> supplier). Moolre Bulk Disbursement in production. */
  disburse(request: DisburseRequest): Promise<DisburseResult>;
}

/**
 * Mock provider for the MVP. Always reports "pending" synchronously — the
 * actual success/failure is delivered asynchronously via the mock webhook
 * handler (`POST /api/webhooks/payments`), mirroring how the real Moolre
 * webhook flow will behave.
 */
export class MockPaymentProvider implements PaymentProvider {
  async charge(request: ChargeRequest): Promise<ChargeResult> {
    return {
      reference: `MOCK-COL-${request.orderId}-${Date.now()}`,
      status: "pending",
    };
  }

  async disburse(request: DisburseRequest): Promise<DisburseResult> {
    return {
      reference: `MOCK-DIS-${request.orderId}-${Date.now()}`,
      status: "pending",
    };
  }
}

// Single swap point for the real integration later:
// export const paymentProvider: PaymentProvider = new MoolrePaymentProvider();
export const paymentProvider: PaymentProvider = new MockPaymentProvider();
