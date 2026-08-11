export type MarketingEventName =
  | "marketing.hero_start_clicked"
  | "marketing.hero_plans_clicked"
  | "marketing.plan_selected"
  | "marketing.enterprise_contact_clicked"
  | "marketing.lead_submitted"
  | "marketing.commerce_module_opened"
  | "marketing.login_clicked"
  | "marketing.signup_clicked"
  | "marketing.contact_opened"
  | "marketing.contact_submitted";

export type MarketingEventPayload = Record<string, string | number | boolean | null | undefined> | undefined;

export interface MarketingAnalyticsProvider {
  track(event: MarketingEventName, payload?: MarketingEventPayload): void;
}

class NoOpMarketingAnalytics implements MarketingAnalyticsProvider {
  track(_event: MarketingEventName, _payload?: MarketingEventPayload): void {
    // no-op: não instala tracker externo sem autorização.
  }
}

let provider: MarketingAnalyticsProvider | null = null;

export function getMarketingAnalytics(): MarketingAnalyticsProvider {
  if (!provider) provider = new NoOpMarketingAnalytics();
  return provider;
}

export function setMarketingAnalyticsProvider(next: MarketingAnalyticsProvider): void {
  provider = next;
}

export function trackMarketingEvent(
  event: MarketingEventName,
  payload?: MarketingEventPayload,
): void {
  try {
    getMarketingAnalytics().track(event, payload);
  } catch {
    // nunca propagar erro de analytics para UX
  }
}
