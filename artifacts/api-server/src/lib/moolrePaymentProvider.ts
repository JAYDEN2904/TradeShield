import type {
  ChargeRequest,
  ChargeResult,
  DisburseRequest,
  DisburseResult,
  PaymentProvider,
  ProviderTransactionStatus,
  RefundRequest,
  RefundResult,
} from "./paymentProvider";
import { logger } from "./logger";

type MoolrePaymentProviderConfig = {
  baseUrl: string;
  collectionsCallbackUrl: string;
  disbursementsCallbackUrl: string;
  /** Production: X-API-KEY + X-API-PUBKEY */
  apiKey?: string;
  apiPubKey?: string;
  /** Sandbox: X-API-USER only */
  sandboxUser?: string;
};

/**
 * Moolre Collections + Transfer adapter.
 * Auth: production uses X-API-KEY + X-API-PUBKEY; sandbox uses X-API-USER.
 */
export class MoolrePaymentProvider implements PaymentProvider {
  constructor(private readonly config: MoolrePaymentProviderConfig) {}

  private headers(): Record<string, string> {
    const base: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.config.sandboxUser) {
      return { ...base, "X-API-USER": this.config.sandboxUser };
    }

    return {
      ...base,
      "X-API-KEY": this.config.apiKey ?? "",
      "X-API-PUBKEY": this.config.apiPubKey ?? "",
    };
  }

  private mapStatus(raw: string | undefined): ProviderTransactionStatus {
    const value = raw?.toLowerCase();
    if (value === "successful" || value === "succeeded" || value === "success") {
      return "succeeded";
    }
    if (value === "failed" || value === "failure") {
      return "failed";
    }
    return "pending";
  }

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const body = {
      amount: Number(request.amount),
      currency: "GHS",
      channel: "mobile_money",
      customer_msisdn: request.payerPhone,
      reference: request.reference,
      callback_url: this.config.collectionsCallbackUrl,
      description: `Order #${request.orderId} escrow payment`,
    };

    const response = await fetch(`${this.config.baseUrl}/collections/charge`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error({ status: response.status, text }, "Moolre collection charge failed");
      throw new Error(`Moolre collection failed (${response.status})`);
    }

    const data = (await response.json()) as {
      status?: string;
      transaction_id?: string;
    };

    return {
      reference: request.reference,
      status: this.mapStatus(data.status),
      providerTransactionId: data.transaction_id,
    };
  }

  async disburse(request: DisburseRequest): Promise<DisburseResult> {
    const body = {
      amount: Number(request.amount),
      currency: "GHS",
      recipient_msisdn: request.payoutMomoNumber,
      reference: request.reference,
      callback_url: this.config.disbursementsCallbackUrl,
      narration: `Payout for order #${request.orderId}`,
    };

    const response = await fetch(`${this.config.baseUrl}/disbursements/payout`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error({ status: response.status, text }, "Moolre disbursement failed");
      throw new Error(`Moolre disbursement failed (${response.status})`);
    }

    const data = (await response.json()) as {
      status?: string;
      transaction_id?: string;
    };

    return {
      reference: request.reference,
      status: this.mapStatus(data.status),
      providerTransactionId: data.transaction_id,
    };
  }

  async refund(request: RefundRequest): Promise<RefundResult> {
    const body = {
      amount: Number(request.amount),
      currency: "GHS",
      reference: request.reference,
      callback_url: this.config.collectionsCallbackUrl,
      narration: `Refund for order #${request.orderId}`,
    };

    const response = await fetch(`${this.config.baseUrl}/collections/refund`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error({ status: response.status, text }, "Moolre refund failed");
      throw new Error(`Moolre refund failed (${response.status})`);
    }

    const data = (await response.json()) as {
      status?: string;
      transaction_id?: string;
    };

    return {
      reference: request.reference,
      status: this.mapStatus(data.status),
      providerTransactionId: data.transaction_id,
    };
  }

  async getCollectionStatus(reference: string): Promise<ProviderTransactionStatus> {
    const response = await fetch(
      `${this.config.baseUrl}/collections/status/${encodeURIComponent(reference)}`,
      { headers: this.headers() },
    );

    if (!response.ok) {
      logger.warn({ reference, status: response.status }, "Moolre collection status poll failed");
      return "pending";
    }

    const data = (await response.json()) as { status?: string };
    return this.mapStatus(data.status);
  }

  async getDisbursementStatus(reference: string): Promise<ProviderTransactionStatus> {
    const response = await fetch(
      `${this.config.baseUrl}/disbursements/status/${encodeURIComponent(reference)}`,
      { headers: this.headers() },
    );

    if (!response.ok) {
      logger.warn({ reference, status: response.status }, "Moolre disbursement status poll failed");
      return "pending";
    }

    const data = (await response.json()) as { status?: string };
    return this.mapStatus(data.status);
  }
}

export type { MoolrePaymentProviderConfig };
