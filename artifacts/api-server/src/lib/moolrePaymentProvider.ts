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
import { PaymentOtpRequiredError } from "./paymentErrors";
import type { MoolreCredentials } from "./moolreConfig";
import {
  extractProviderTransactionId,
  interpretMoolreTransactionResponse,
  moolreFetch,
  resolveMomoChannel,
  toMoolreLocalPhone,
} from "./moolreClient";
import { logger } from "./logger";

/**
 * Moolre Collections + Transfer adapter (official /open/transact/* API).
 * Auth: X-API-USER always; X-API-KEY on live (optional on sandbox).
 */
export class MoolrePaymentProvider implements PaymentProvider {
  constructor(private readonly creds: MoolreCredentials) {}

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const payer = toMoolreLocalPhone(request.payerPhone);
    const channel = resolveMomoChannel(request.payerPhone, "payment");
    const otpcode = request.otpCode?.trim() ?? "";

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
          otpcode,
          reference: `Order #${request.orderId} escrow payment`,
          sessionid: "",
          accountnumber: this.creds.accountNumber,
        },
      },
    );

    logger.info(
      {
        orderId: request.orderId,
        reference: request.reference,
        hadOtp: Boolean(otpcode),
        httpStatus,
        code: body.code,
        status: body.status,
        message: Array.isArray(body.message)
          ? body.message.join("; ")
          : body.message,
        dataPreview:
          typeof body.data === "string"
            ? body.data.slice(0, 80)
            : body.data && typeof body.data === "object"
              ? Object.keys(body.data as object).slice(0, 8)
              : body.data,
      },
      "Moolre collection charge response",
    );

    if (body.code === "TP14") {
      logger.warn(
        {
          orderId: request.orderId,
          reference: request.reference,
          hadOtp: Boolean(otpcode),
        },
        "Moolre requires OTP verification (TP14) before payment can proceed",
      );
      const rawMessage = body.message;
      const detail = Array.isArray(rawMessage)
        ? rawMessage.filter(Boolean).join("; ")
        : typeof rawMessage === "string"
          ? rawMessage.trim()
          : "";
      throw new PaymentOtpRequiredError(
        detail ||
          "Enter the verification code sent to your phone by SMS, then try again.",
      );
    }

    if (body.code === "TP15") {
      logger.warn(
        { orderId: request.orderId, reference: request.reference },
        "Moolre rejected OTP verification code (TP15)",
      );
      throw new Error(
        formatMoolreRejection("collection", httpStatus, body, text),
      );
    }

    if (!ok && body.code !== "TR099") {
      logger.error(
        { status: httpStatus, code: body.code, text },
        "Moolre collection charge failed",
      );
      throw new Error(formatMoolreRejection("collection", httpStatus, body, text));
    }

    const code = (body.code ?? "").toUpperCase();
    const providerTransactionId = extractProviderTransactionId(body);
    const status = interpretMoolreTransactionResponse(body);
    const ussdStarted = code === "TR099";

    // TP17 = "Phone no. Verification Successful" — OTP accepted but USSD not started.
    // Retry the SAME externalref without OTP. Minting a new reference re-triggers TP14 SMS.
    if (otpcode && !ussdStarted) {
      logger.warn(
        {
          orderId: request.orderId,
          reference: request.reference,
          code: body.code,
          message: Array.isArray(body.message)
            ? body.message.join("; ")
            : body.message,
        },
        "Moolre accepted OTP but did not start USSD; retrying same reference without OTP",
      );
      return this.charge({
        ...request,
        otpCode: undefined,
      });
    }

    return {
      reference: request.reference,
      status,
      providerTransactionId,
    };
  }

  async disburse(request: DisburseRequest): Promise<DisburseResult> {
    const receiver = toMoolreLocalPhone(request.payoutMomoNumber);
    const channel = resolveMomoChannel(request.payoutMomoNumber, "transfer");

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
      throw new Error(formatMoolreRejection("disbursement", httpStatus, body, text));
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
          // Docs: 1 = externalref, 2 = Moolre-generated id (NOT the string "externalref")
          idtype: "1",
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

    const code = (body.code ?? "").toUpperCase();
    const messageText = Array.isArray(body.message)
      ? body.message.join(" ")
      : typeof body.message === "string"
        ? body.message
        : "";

    // SS07 is returned even with status=1 when the externalref has no payment.
    if (code === "SS07" || /transaction not found/i.test(messageText)) {
      logger.warn(
        { reference, code: body.code, status: body.status, message: messageText },
        "Moolre status poll not found — treating as failed",
      );
      return "failed";
    }

    if (/idtype invalid/i.test(messageText)) {
      logger.warn(
        { reference, code: body.code, message: messageText },
        "Moolre status poll misconfigured — treating as pending",
      );
      return "pending";
    }

    const interpreted = interpretMoolreTransactionResponse(body);
    if (!ok && interpreted === "failed") {
      logger.warn(
        { reference, code: body.code, status: body.status, message: messageText },
        "Moolre status poll inconclusive — treating as pending",
      );
      return "pending";
    }

    return interpreted;
  }
}

function formatMoolreRejection(
  kind: "collection" | "disbursement",
  httpStatus: number,
  body: { code?: string; message?: string | string[] | null },
  text: string,
): string {
  const code = body.code ?? "UNKNOWN";
  const rawMessage = body.message;
  const message = Array.isArray(rawMessage)
    ? rawMessage.filter(Boolean).join("; ")
    : typeof rawMessage === "string"
      ? rawMessage.trim()
      : "";
  if (message) {
    return `Moolre ${kind} failed (${httpStatus}): ${code} — ${message}`;
  }
  return `Moolre ${kind} failed (${httpStatus}): ${code || text.slice(0, 120)}`;
}

export type { MoolreCredentials as MoolrePaymentProviderConfig };
