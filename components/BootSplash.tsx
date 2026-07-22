'use client';

import { useEffect, useRef, useState } from 'react';

// The splash is a one-time ceremony: it plays on the very first arrival and
// never again for the rest of the browser session — not on route changes,
// not on refreshes, not on a stray remount. Three independent guards make
// that guarantee hold no matter how the host environment navigates.
let modulePlayed = false;

function sessionPlayed(): boolean {
  try {
    return typeof window !== 'undefined' && sessionStorage.getItem('b4l_booted') === '1';
  } catch {
    return false;
  }
}

function markPlayed() {
  modulePlayed = true;
  try { sessionStorage.setItem('b4l_booted', '1'); } catch { /* ignore */ }
  try { document.cookie = 'b4l_booted=1; path=/; SameSite=Lax'; } catch { /* ignore */ }
}

const STAGES: Array<[number, string]> = [
  [0, 'Warming up the auction house'],
  [22, 'Verifying local listings'],
  [48, 'Syncing live bids'],
  [74, 'Polishing the gavel'],
  [92, 'Opening the floor'],
];

export function BootSplash({ suppressed = false }: { suppressed?: boolean }) {
  // Decided once, at mount. The server already passed `suppressed` when it
  // saw the "booted" cookie, so a returning visitor renders nothing here and
  // hydration stays perfectly matched.
  const shouldPlay = !suppressed && !modulePlayed && !sessionPlayed();
  const [active, setActive] = useState(shouldPlay);
  const [pct, setPct] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (!active) return;
    markPlayed();

    let raf = 0;
    const start = performance.now();
    const duration = 1600;
    const tick = (t: number) => {
      const e = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - e, 3);
      setPct(Math.round(eased * 100));
      if (e < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        timers.current.push(window.setTimeout(() => setLeaving(true), 280));
        timers.current.push(window.setTimeout(() => setActive(false), 820));
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      timers.current.forEach((id) => clearTimeout(id));
    };
  }, [active]);

  if (!active) return null;

  const stage = [...STAGES].reverse().find(([threshold]) => pct >= threshold)?.[1] ?? STAGES[0][1];

  return (
    <div
      className={`fixed inset-0 z-[120] flex flex-col items-center justify-center px-6 transition-opacity duration-500 ${
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      style={{
        backgroundColor: 'var(--paper)',
        backgroundImage: 'radial-gradient(rgba(15,42,85,.06) 1px, transparent 1.4px)',
        backgroundSize: '22px 22px',
      }}
      aria-hidden={leaving}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(47,162,74,.14),transparent_70%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[radial-gradient(60%_100%_at_50%_100%,rgba(15,42,85,.10),transparent_70%)]" />

      <div className="splash-logo relative flex flex-col items-center">
        <img src="/logo.png" alt="Bid 4 Local" loading="eager" className="logo-img h-28 w-auto object-contain sm:h-36" />
      </div>

      <div className="relative mt-10 w-[19rem] sm:w-[24rem]">
        <div className="h-[7px] w-full overflow-hidden rounded-full bg-[#0f2a55]/10 ring-1 ring-[#0f2a55]/10">
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #0f2a55 0%, #1f6e3a 55%, #3bb75a 100%)',
              transition: 'width 140ms linear',
              boxShadow: '0 0 14px rgba(47,162,74,.45)',
            }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px]">
          <span className="splash-tag font-medium uppercase tracking-[0.18em] text-[#0f2a55]/70">{stage}</span>
          <span className="font-display text-base tabular-nums text-[#0f2a55]">
            {pct}<span className="text-[#2fa24a]">%</span>
          </span>
        </div>
      </div>

      <p className="relative mt-8 text-[10px] font-semibold uppercase tracking-[0.32em] text-[#0f2a55]/45">
        Local goods · Local people · Better together
      </p>
    </div>
  );
}
