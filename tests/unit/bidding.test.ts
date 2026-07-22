import { describe, it, expect } from 'vitest';
import { minimumBid, isBidValid, resolveProxyPrice, shouldExtend } from '@/lib/bidding';

describe('minimumBid', () => {
  it('uses starting bid when there are no bids yet', () => {
    expect(minimumBid({ bidCount: 0, startingBid: 100000, currentBid: 100000, bidIncrement: 10000 })).toBe(100000);
  });
  it('adds the increment once bidding has started', () => {
    expect(minimumBid({ bidCount: 3, startingBid: 100000, currentBid: 150000, bidIncrement: 10000 })).toBe(160000);
  });
});

describe('isBidValid', () => {
  it('accepts a bid at or above the minimum', () => {
    expect(isBidValid(160000, 160000)).toBe(true);
    expect(isBidValid(170000, 160000)).toBe(true);
  });
  it('rejects bids below minimum, non-integers, and non-positive', () => {
    expect(isBidValid(150000, 160000)).toBe(false);
    expect(isBidValid(160000.5, 160000)).toBe(false);
    expect(isBidValid(0, 0)).toBe(false);
  });
});

describe('resolveProxyPrice', () => {
  it('rises to second-highest + increment, capped by the max', () => {
    // Proxy max 500000, human bid 200000, increment 10000 → 210000.
    expect(resolveProxyPrice({ topMax: 500000, secondHighest: 200000, bidIncrement: 10000 })).toBe(210000);
  });
  it('caps at the proxy max when the contender is close', () => {
    expect(resolveProxyPrice({ topMax: 205000, secondHighest: 200000, bidIncrement: 10000 })).toBe(205000);
  });
});

describe('shouldExtend', () => {
  const now = 1_000_000_000_000;
  it('extends when a bid lands inside the window', () => {
    expect(shouldExtend({ endTimeMs: now + 60_000, nowMs: now, antiSnipeSeconds: 120 })).toBe(true);
  });
  it('does not extend when outside the window', () => {
    expect(shouldExtend({ endTimeMs: now + 300_000, nowMs: now, antiSnipeSeconds: 120 })).toBe(false);
  });
  it('never extends when anti-snipe is disabled', () => {
    expect(shouldExtend({ endTimeMs: now + 1_000, nowMs: now, antiSnipeSeconds: 0 })).toBe(false);
  });
});
