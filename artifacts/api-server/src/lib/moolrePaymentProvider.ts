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
import type { MoolreCredentials } from "./moolreConfig";
import {
  extractProviderTransactionId,
  interpretMoolreTransactionResponse,
  moolreFetch,
  resolveMomoChannel,
  toMoolreMsisdn,
} from "./moolreClient";
import { logger } from "./logger";

/**
 * Moolre Collections + Transfer adapter (official /open/transact/* API).
 * Auth: X-API-USER always; X-API-KEY on live (optional on sandbox).
 */
export class MoolrePaymentProvider implements PaymentProvider {
  constructor(private readonly creds: MoolreCredentials) {}

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const payer = toMoolreMsisdn(request.payerPhone);
    const channel = resolveMomoChannel(request.payerPhone);

    const { ok, httpStatus, body, text } = await moolreFetch(
      this.creds,
      "/open/transact/payment",
      {
        body: {
          type: 1,
          channel,
          currency: "GHS",
          payer,
          amount: String(request.amount),
          externalref: request.reference,
          otpcode: "",
          reference: `Order #${request.orderId} escrow payment`,
          sessionid: "",
          accountnumber: this.creds.accountNumber,
        },
      },
    );

    if (!ok && body.code !== "TR099" && body.code !== "TP14") {
      logger.error(
        { status: httpStatus, code: body.code, text },
        "Moolre collection charge failed",
      );
      throw new Error(
        `Moolre collection failed (${httpStatus}): ${body.code ?? text.slice(0, 120)}`,
      );
    }

    if (body.code === "TP14") {
      logger.warn(
        { orderId: request.orderId, reference: request.reference },
        "Moolre requires OTP verification (TP14) before payment can proceed",
      );
    }

    return {
      reference: request.reference,
      status: interpretMoolreTransactionResponse(body),
      providerTransactionId: extractProviderTransactionId(body),
    };
  }

  async disburse(request: DisburseRequest): Promise<DisburseResult> {
    const receiver = toMoolreMsisdn(request.payoutMomoNumber);
    const channel = resolveMomoChannel(request.payoutMomoNumber);

    const { ok, httpStatus, body, text } = await moolreFetch(
      this.creds,
      "/open/transact/transfer",
      {
        body: {
          type: 1,
          channel,
          currency: "GHS",
          amount: String(request.amount),
          receiver,
          sublistid: "",
          externalref: request.reference,
          reference: `Payout for order #${request.orderId}`,
          accountnumber: this.creds.accountNumber,
        },
      },
    );

    if (!ok) {
      logger.error(
        { status: httpStatus, code: body.code, text },
        "Moolre disbursement failed",
      );
      throw new Error(
        `Moolre disbursement failed (${httpStatus}): ${body.code ?? text.slice(0, 120)}`,
      );
    }

    return {
      reference: request.reference,
      status: interpretMoolreTransactionResponse(body),
      providerTransactionId: extractProviderTransactionId(body),
    };
  }

  /**
   * Moolre has no dedicated refund endpoint — refund via MoMo transfer
   * back to the buyer when recipientPhone is provided.
   */
  async refund(request: RefundRequest): Promise<RefundResult> {
    if (!request.recipientPhone?.trim()) {
      throw new Error(
        "Moolre refund requires recipientPhone (buyer MoMo number)",
      );
    }

    return this.disburse({
      orderId: request.orderId,
      amount: request.amount,
      payoutMomoNumber: request.recipientPhone,
      reference: request.reference,
    });
  }

  async getCollectionStatus(reference: string): Promise<ProviderTransactionStatus> {
    return this.pollStatus(reference, "public");
  }

  async getDisbursementStatus(reference: string): Promise<ProviderTransactionStatus> {
    return this.pollStatus(reference, "private");
  }

  private async pollStatus(
    reference: string,
    authMode: "private" | "public",
  ): Promise<ProviderTransactionStatus> {
    const { ok, httpStatus, body } = await moolreFetch(
      this.creds,
      "/open/transact/status",
      {
        authMode,
        body: {
          type: 1,
          idtype: "externalref",
          id: reference,
          accountnumber: this.creds.accountNumber,
        },
      },
    );

    if (httpStatus >= 500) {
      logger.warn(
        { reference, status: httpStatus, code: body.code },
        "Moolre status poll failed",
      );
      return "pending";
    }

    const interpreted = interpretMoolreTransactionResponse(body);
    if (!ok && interpreted === "failed") {
      const data = body.data;
      const hasTxStatus =
        data &&
        typeof data === "object" &&
        !Array.isArray(data) &&
        "txstatus" in (data as object);
      // Not-found / error envelopes without txstatus stay pending
      if (!hasTxStatus) {
        logger.warn(
          { reference, code: body.code, status: body.status },
          "Moolre status poll inconclusive — treating as pending",
        );
        return "pending";
      }
    }

    return interpreted;
  }
}

export type { MoolreCredentials as MoolrePaymentProviderConfig };
