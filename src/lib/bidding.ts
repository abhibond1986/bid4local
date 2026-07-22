/**
 * Pure bidding helpers. These mirror the authoritative logic in the
 * `place_bid` Postgres RPC and are used for client-side display and validation
 * ONLY. The database RPC remains the source of truth — never trust these
 * values as final.
 */

/** Minimum acceptable next bid (in paise). */
export function minimumBid(params: {
  bidCount: number;
  startingBid: number;
  currentBid: number;
  bidIncrement: number;
}): number {
  const { bidCount, startingBid, currentBid, bidIncrement } = params;
  return bidCount === 0 ? startingBid : currentBid + bidIncrement;
}

/** Whether a proposed bid is valid client-side (pre-flight only). */
export function isBidValid(amount: number, min: number): boolean {
  return Number.isInteger(amount) && amount > 0 && amount >= min;
}

/**
 * Resolve where the price should land given the top proxy max and the
 * second-highest contender — eBay-style: second + increment, capped at max.
 */
export function resolveProxyPrice(params: {
  topMax: number;
  secondHighest: number;
  bidIncrement: number;
}): number {
  const { topMax, secondHighest, bidIncrement } = params;
  return Math.min(topMax, secondHighest + bidIncrement);
}

/** Whether a bid landing at `now` should extend the auction (anti-sniping). */
export function shouldExtend(params: {
  endTimeMs: number;
  nowMs: number;
  antiSnipeSeconds: number;
}): boolean {
  const { endTimeMs, nowMs, antiSnipeSeconds } = params;
  if (antiSnipeSeconds <= 0) return false;
  return endTimeMs - nowMs <= antiSnipeSeconds * 1000;
}
