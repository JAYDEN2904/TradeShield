/**
 * SMS provider adapter — mirrors the payment provider pattern.
 * Mock logs to console + sms_logs; Moolre when VAS key is configured.
 */

import { db, smsLogsTable } from "@workspace/db";
import { logger } from "./logger";
import { resolveMoolreCredentials } from "./moolreConfig";
import {
  isMoolreSuccessStatus,
  moolreFetch,
  toMoolreMsisdn,
} from "./moolreClient";

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

type MoolreSmsConfig = NonNullable<ReturnType<typeof resolveMoolreCredentials>>;

export class MoolreSmsProvider implements SmsProvider {
  constructor(private readonly config: MoolreSmsConfig) {}

  async send(input: SendSmsInput): Promise<{ ok: boolean; error?: string }> {
    try {
      const recipient = toMoolreMsisdn(input.to);
      const ref = `sms-${input.template}-${Date.now()}`;

      const { httpStatus, body, text } = await moolreFetch(
        this.config,
        "/open/sms/send",
        {
          authMode: "vas",
          body: {
            type: 1,
            senderid: this.config.smsSenderId,
            messages: [
              {
                recipient,
                message: input.body,
                ref,
              },
            ],
          },
        },
      );

      if (!isMoolreSuccessStatus(body.status)) {
        const error = `Moolre SMS ${body.code ?? `HTTP ${httpStatus}`}: ${
          typeof body.message === "string"
            ? body.message
            : text.slice(0, 120)
        }`;
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
  const creds = resolveMoolreCredentials();
  // SMS always requires X-API-VASKEY per Moolre docs
  if (creds?.vasKey) {
    return new MoolreSmsProvider(creds);
  }
  return new MockSmsProvider();
}

export const smsProvider: SmsProvider = createSmsProvider();

export function sendSmsFireAndForget(input: SendSmsInput): void {
  smsProvider.send(input).catch((err) => {
    logger.error({ err, template: input.template }, "SMS send failed");
  });
}
