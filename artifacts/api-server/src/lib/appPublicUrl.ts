/**
 * Public web app base URL for SMS deep links (no trailing slash).
 * Set APP_PUBLIC_URL in production (e.g. https://app.tradeshield.com).
 */
export function getAppPublicUrl(): string {
  const raw = process.env["APP_PUBLIC_URL"]?.trim();
  if (raw) {
    return raw.replace(/\/+$/, "");
  }
  // Local Vite default when unset
  return "http://localhost:22898";
}

export function orderDeepLink(orderId: number): string {
  return `${getAppPublicUrl()}/orders/${orderId}`;
}

export function orderViewLinkSuffix(orderId: number): string {
  return ` View order: ${orderDeepLink(orderId)}`;
}
