export const PUBLIC_EVENT_TYPES = [
  'property_view',
  'property_click',
  'inquiry_conversion',
  'chat_conversion',
  'page_view',
] as const;

export type PublicEventType = (typeof PUBLIC_EVENT_TYPES)[number];

/** Read-side aggregation cache TTL (Redis-shaped). */
export const PUBLIC_ANALYTICS_CACHE_TTL_MS = 60 * 1000;

/** Hard cap on returned "top" lists. */
export const TOP_LIST_LIMIT = 10;
