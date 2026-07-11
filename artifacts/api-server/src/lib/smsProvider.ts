/**
 * SMS provider adapter — mirrors the payment provider pattern.
 * Mock logs to console + sms_logs; Moolre when credentials are configured.
 */

import { db, smsLogsTable } from "@workspace/db";
import { logger } from "./logger";

export type SmsTemplate =
  | "otp"
  | "order_created"
  | "order_accepted"
  | "order_rejected"
  | "payment_escrow"
  | "order_shipped"
  | "auto_release_reminder"
  | "payout_completed"
  | "payout_failed"
  | "dispute_opened"
  | "dispute_resolved"
  | "order_expired";

export type SendSmsInput = {
  to: string;
  body: string;
  template: SmsTemplate;
  orderId?: number;
};

export interface SmsProvider {
  send(input: SendSmsInput): Promise<{ ok: boolean; error?: string }>;
}

async function logSmsAttempt(
  input: SendSmsInput,
  ok: boolean,
  error?: string,
): Promise<void> {
  try {
    await db.insert(smsLogsTable).values({
      phone: input.to,
      template: input.template,
      body: input.body,
      orderId: input.orderId,
      status: ok ? "sent" : "failed",
      errorMessage: error,
    });
  } catch (err) {
    logger.error({ err, template: input.template }, "Failed to write SMS log");
  }
}

export class MockSmsProvider implements SmsProvider {
  async send(input: SendSmsInput): Promise<{ ok: boolean; error?: string }> {
    logger.info(
      { to: input.to, template: input.template, orderId: input.orderId },
      `[SMS mock] ${input.body}`,
    );
    await logSmsAttempt(input, true);
    return { ok: true };
  }
}

type MoolreSmsConfig = {
  baseUrl: string;
  apiKey?: string;
  apiPubKey?: string;
  sandboxUser?: string;
  vasKey?: string;
};

export class MoolreSmsProvider implements SmsProvider {
  constructor(private readonly config: MoolreSmsConfig) {}

  private headers(): Record<string, string> {
    const base: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.config.sandboxUser) {
      return { ...base, "X-API-USER": this.config.sandboxUser };
    }

    const headers: Record<string, string> = {
      ...base,
      "X-API-KEY": this.config.apiKey ?? "",
      "X-API-PUBKEY": this.config.apiPubKey ?? "",
    };

    if (this.config.vasKey) {
      headers["X-API-VASKEY"] = this.config.vasKey;
    }

    return headers;
  }

  async send(input: SendSmsInput): Promise<{ ok: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.config.baseUrl}/sms/send`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          to: input.to,
          message: input.body,
        }),
      });

      if (!response.ok) {
        const error = `Moolre SMS HTTP ${response.status}`;
        await logSmsAttempt(input, false, error);
        return { ok: false, error };
      }

      await logSmsAttempt(input, true);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "SMS send failed";
      await logSmsAttempt(input, false, message);
      return { ok: false, error: message };
    }
  }
}

function createSmsProvider(): SmsProvider {
  const baseUrl = process.env.MOOLRE_BASE_URL ?? "https://api.moolre.com";
  const vasKey = process.env.MOOLRE_VAS_KEY;

  const sandboxUser = process.env.MOOLRE_SANDBOX_USER;
  if (sandboxUser) {
    return new MoolreSmsProvider({ baseUrl, sandboxUser, vasKey });
  }

  const apiKey = process.env.MOOLRE_API_KEY;
  const apiPubKey = process.env.MOOLRE_API_PUBKEY ?? process.env.MOOLRE_API_SECRET;

  if (apiKey && apiPubKey) {
    return new MoolreSmsProvider({
      apiKey,
      apiPubKey,
      baseUrl,
      vasKey,
    });
  }

  return new MockSmsProvider();
}

export const smsProvider: SmsProvider = createSmsProvider();

export function sendSmsFireAndForget(input: SendSmsInput): void {
  smsProvider.send(input).catch((err) => {
    logger.error({ err, template: input.template }, "SMS send failed");
  });
}
