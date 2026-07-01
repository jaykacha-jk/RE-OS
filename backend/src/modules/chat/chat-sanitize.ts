/**
 * Strip HTML tags and dangerous URI schemes from chat message bodies before
 * persistence. Full DOMPurify runs in the browser widget; this is the
 * server-side guard (BR-CH / SECURITY.md).
 */
export function sanitizeChatContent(content: string): string {
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .trim();
}
