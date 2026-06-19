/** Sentinel values — align with seeded enterprise plan and UI `formatLimit`. */
export const UNLIMITED_COUNT_LIMIT = 2_147_483_647;

export function isUnlimitedCount(limit: number): boolean {
  return limit <= 0 || limit >= UNLIMITED_COUNT_LIMIT;
}

/** `storage_limit_bytes === 0` means unlimited (enterprise). */
export function isUnlimitedStorage(limitBytes: bigint | number): boolean {
  const value = typeof limitBytes === 'bigint' ? limitBytes : BigInt(limitBytes);
  return value <= 0n;
}
