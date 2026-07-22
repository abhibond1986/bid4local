import { db } from "@/db";
import { items, users, bids, payments, categories, auditLogs } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { auth } from "@/auth";
import Link from "next/link";
import {
  Users, Gavel, TrendingUp, BarChart3, Clock, AlertTriangle,
  Tag, ScrollText, ShieldCheck, Eye, ArrowRight,
  UserCog, Gavel as GavelIcon, Banknote, Activity, ListChecks, Radio,
} from 'lucide-react';
import { formatINR } from "@/lib/format";
import { AdminDemoEntry } from "./AdminDemoEntry";

type Module = {
  icon: any; href: string; title: string; blurb: string; points: string[]; tone: string; featured?: boolean;
};

const MODULES: Module[] = [
  {
    icon: UserCog, href: '/admin/users', title: 'Users & roles', tone: '#0f2a55', featured: true,
    blurb: 'The whole directory in one ledger — every bidder, seller, manager and finance seat, with the keys to promote, verify or retire any of them.',
    points: ['Assign 7 roles (super-admin, manager, seller, bidder, finance, inspector, delivery)', 'Approve or reject KYC, edit bios, banking & GST/PAN', 'Suspend or permanently delete an account'],
  },
  {
    icon: GavelIcon, href: '/admin/auctions', title: 'Auctions', tone: '#2fa24a',
    blurb: 'Drive any lot through its lifecycle and curate the homepage.',
    points: ['Force status: draft, scheduled, active, ended, cancelled', 'Feature lots on the dashboard', 'Edit pricing or remove a listing'],
  },
  {
    icon: Tag, href: '/admin/categories', title: 'Categories', tone: '#1f6e3a',
    blurb: 'Shape the catalogue taxonomy with emoji marks and copy.',
    points: ['Create, rename, delete categories', 'Live item counts per category'],
  },
  {
    icon: Banknote, href: '/admin/payments', title: 'Payments & EMD', tone: '#0f2a55',
    blurb: 'Reconcile every rupee that moves through the house.',
    points: ['Mark EMD / full payments received', 'Record failures and issue refunds', 'UPI, card, net-banking methods'],
  },
  {
    icon: BarChart3, href: '/admin/reports', title: 'Reports', tone: '#2fa24a',
    blurb: 'Read the room at a glance, all figures in INR.',
    points: ['Auctions by status', 'Top-value lots & average bid', 'Payment breakdown'],
  },
  {
    icon: ScrollText, href: '/admin/logs', title: 'Audit trail', tone: '#0f2a55',
    blurb: 'Nothing happens off the record.',
    points: ['Every create, bid and status change', 'Actor + entity + timestamp'],
  },
  {
    icon: Radio, href: '/admin/broadcast', title: 'Broadcast', tone: '#1f6e3a',
    blurb: 'Send an in-app notice to any single user.',
    points: ['Bid, payment or system notices', 'Links straight into the relevant page'],
  },
];

export default async function AdminPage() {
  const session = await auth();
  const isAdmin = !!session?.user?.role && ['superadmin', 'manager'].includes(session.user.role);

  const [userCount, activeCount, bidCount, revenue, catCount] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(users),
    db.select({ count: sql<number>`count(*)` }).from(items).where(eq(items.status, 'active')),
    db.select({ count: sql<number>`count(*)` }).from(bids),
    db.select({ total: sql<number>`coalesce(sum(amount),0)` }).from(payments).where(eq(payments.status, 'completed')),
    db.select({ count: sql<number>`count(*)` }).from(categories),
  ]);

  const ledger = [
    { label: 'Registered users', value: String(userCount[0]?.count ?? 0) },
    { label: 'Live auctions', value: String(activeCount[0]?.count ?? 0) },
    { label: 'Bids placed', value: String(bidCount[0]?.count ?? 0) },
    { label: 'Revenue settled', value: formatINR(Number(revenue[0]?.total ?? 0)) },
    { label: 'Categories', value: String(catCount[0]?.count ?? 0) },
  ];

  // ── Admins get the live control centre ─────────────────────────────────
  if (isAdmin) {
    const [recentItems, pendingUsers, recentLogs] = await Promise.all([
      db.select().from(items).orderBy(desc(items.createdAt)).limit(5),
      db.select().from(users).where(eq(users.verified, 'pending')).limit(5),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(6),
    ]);

    const stats = [
      { label: 'Total users', value: userCount[0]?.count ?? 0, icon: Users, color: 'text-blue-700 bg-blue-50', href: '/admin/users', sub: 'Roles, KYC, banking' },
      { label: 'Active auctions', value: activeCount[0]?.count ?? 0, icon: Gavel, color: 'text-emerald-700 bg-emerald-50', href: '/admin/auctions', sub: 'Status, feature, delete' },
      { label: 'Bids placed', value: bidCount[0]?.count ?? 0, icon: TrendingUp, color: 'text-violet-700 bg-violet-50', href: '/admin/logs', sub: 'Real-time bidding' },
      { label: 'Revenue', value: formatINR(Number(revenue[0]?.total ?? 0)), icon: Banknote, color: 'text-amber-700 bg-amber-50', href: '/admin/payments', sub: 'EMD & settlements' },
      { label: 'Categories', value: catCount[0]?.count ?? 0, icon: Tag, color: 'text-indigo-700 bg-indigo-50', href: '/admin/categories', sub: 'Catalogue taxonomy' },
      { label: 'Pending KYC', value: pendingUsers.length, icon: AlertTriangle, color: 'text-rose-700 bg-rose-50', href: '/admin/users', sub: 'Approve or reject' },
    ];

    return (
      <div className="space-y-7 animate-fade-in">
        <header className="flex flex-wrap items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0f2a55] text-white shadow-[0_12px_26px_-14px_rgba(15,42,85,.8)]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#2fa24a]">Signed in as {session.user.role}</p>
            <h1 className="font-display text-3xl font-semibold text-[#0f2a55] sm:text-[2.3rem]">The control centre</h1>
          </div>
          <div className="ml-auto flex gap-2">
            <Link href="/admin/users" className="rounded-xl border border-[#0f2a55]/15 px-3.5 py-2 text-sm font-semibold text-[#0f2a55] transition hover:bg-[#0f2a55]/5">Users</Link>
            <Link href="/admin/auctions" className="rounded-xl bg-[#0f2a55] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#16386e]">Auctions</Link>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <Link key={s.label} href={s.href} className="group rounded-2xl border border-[#0f2a55]/10 bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#2fa24a]/40 hover:shadow-[0_20px_40px_-26px_rgba(15,42,85,.5)]">
                <div className="flex items-start justify-between">
                  <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.color} transition group-hover:scale-105`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0f2a55]/40 group-hover:text-[#2fa24a]">Open</span>
                </div>
                <p className="mt-3 font-display text-2xl font-semibold text-[#0f2a55]">{s.value}</p>
                <p className="text-sm font-semibold text-[#0f2a55]">{s.label}</p>
                <p className="mt-0.5 text-[11px] text-[#0f2a55]/50">{s.sub}</p>
              </Link>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-[#0f2a55]/10 bg-white p-5 lg:col-span-2">
            <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-[#0f2a55]">
              <Activity className="h-4 w-4 text-[#2fa24a]" /> Every function, one click away
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {MODULES.map((m) => {
                const Icon = m.icon;
                return (
                  <Link key={m.href} href={m.href} className="group flex gap-3 rounded-xl border border-[#0f2a55]/10 p-4 transition hover:border-[#2fa24a]/40 hover:bg-[#2fa24a]/[0.04]">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${m.tone}14`, color: m.tone }}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[#0f2a55] group-hover:text-[#1f6e3a]">{m.title}</span>
                      <span className="block text-xs leading-snug text-[#0f2a55]/55">{m.blurb}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-[#0f2a55]/10 bg-white p-5">
              <h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-[#0f2a55]">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> Awaiting verification
              </h3>
              {pendingUsers.length === 0 ? (
                <p className="py-3 text-center text-sm text-[#0f2a55]/50">All clear — nobody in the queue.</p>
              ) : (
                <div className="space-y-2.5">
                  {pendingUsers.map((u) => (
                    <div key={u.id} className="flex items-center justify-between rounded-xl border border-amber-200/60 bg-amber-50/60 p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#0f2a55]">{u.name}</p>
                        <p className="truncate text-xs text-[#0f2a55]/55">{u.email}</p>
                      </div>
                      <Link href="/admin/users" className="rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700">Review</Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-[#0f2a55]/10 bg-white p-5">
              <h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-[#0f2a55]">
                <Clock className="h-4 w-4 text-[#0f2a55]/60" /> Latest on the floor
              </h3>
              <div className="space-y-2.5">
                {recentItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-xl border border-[#0f2a55]/8 bg-[#f4f1ea]/60 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#0f2a55]">{item.title}</p>
                      <p className="text-xs text-[#0f2a55]/55">{formatINR(item.currentBid)} · {item.bidCount} bids</p>
                    </div>
                    <span className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.status === 'active' ? 'bg-emerald-50 text-emerald-700' : item.status === 'ended' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'}`}>{item.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#0f2a55]/10 bg-white p-5">
              <h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-[#0f2a55]">
                <ScrollText className="h-4 w-4 text-[#0f2a55]/60" /> Live audit
              </h3>
              <div className="space-y-2">
                {recentLogs.map((l) => (
                  <div key={l.id} className="rounded-lg bg-[#f4f1ea]/70 p-2 text-xs text-[#0f2a55]/70">
                    <span className="font-semibold text-[#0f2a55]">{l.action}</span> {l.entity} #{l.entityId} — {l.details}
                  </div>
                ))}
              </div>
              <Link href="/admin/logs" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#2fa24a] hover:text-[#1f6e3a]">View the full trail <ArrowRight className="h-3 w-3" /></Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Everyone else gets the public capability map ───────────────────────
  return (
    <div className="space-y-9 animate-fade-in">
      {/* Hero */}
      <header className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-[#2fa24a]">Administration</p>
          <h1 className="mt-2 font-display text-4xl font-semibold leading-[1.02] text-[#0f2a55] sm:text-[3.4rem]">
            One desk to run<br />the <span className="italic text-[#2fa24a]">whole floor.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[#0f2a55]/70">
            Every lever of the marketplace lives behind a single super-admin role — users, auctions,
            categories, money, reports, the audit trail and the loudspeaker. Browse the full map below,
            then step behind the counter with one click; no password to type.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <AdminDemoEntry />
            <Link href="/login" className="inline-flex items-center gap-2 rounded-xl border border-[#0f2a55]/15 px-5 py-3 text-sm font-semibold text-[#0f2a55] transition hover:bg-[#0f2a55]/5">
              Or sign in with your own account
            </Link>
          </div>
          <p className="mt-3 text-xs text-[#0f2a55]/45">The demo button uses the seeded super-admin (admin@bidlocal.com). Your session swaps in instantly.</p>
        </div>

        <div className="flex justify-center lg:justify-end">
          <div className="rounded-[28px] border border-[#0f2a55]/10 bg-white p-6 shadow-[0_30px_70px_-44px_rgba(15,42,85,.5)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Bid 4 Local" className="logo-img h-20 w-auto object-contain" />
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#0f2a55]/10 pt-4 text-center">
              {[['7', 'roles'], ['8', 'modules'], ['100%', 'in-app']].map(([v, l]) => (
                <div key={l}>
                  <p className="font-display text-xl font-semibold text-[#0f2a55]">{v}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[#0f2a55]/50">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Live ledger */}
      <section className="overflow-hidden rounded-[24px] border border-[#0f2a55]/10 bg-[#0f2a55] text-white"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.07) 1px, transparent 1.4px)', backgroundSize: '22px 22px' }}>
        <div className="flex items-center gap-2 border-b border-white/10 px-6 py-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[#7dd49a]">
          <ListChecks className="h-4 w-4" /> The house, right now
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-white/10 sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
          {ledger.map((row) => (
            <div key={row.label} className="px-6 py-5">
              <p className="font-display text-2xl font-semibold tabular-nums text-white sm:text-[1.7rem]">{row.value}</p>
              <p className="mt-1 text-[11px] uppercase tracking-wider text-white/55">{row.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Capability map — asymmetric grid, first tile larger */}
      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-2xl font-semibold text-[#0f2a55]">What the admin can control</h2>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#0f2a55]/45">{MODULES.length} modules</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => {
            const Icon = m.icon;
            return (
              <article
                key={m.href}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border border-[#0f2a55]/10 bg-white p-6 transition hover:-translate-y-1 hover:border-[#2fa24a]/40 hover:shadow-[0_28px_60px_-34px_rgba(15,42,85,.55)] ${m.featured ? 'sm:col-span-2' : ''}`}
              >
                <span className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100" style={{ background: m.tone }} />
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition group-hover:scale-105" style={{ backgroundColor: `${m.tone}14`, color: m.tone }}>
                    <Icon className="h-6 w-6" />
                  </span>
                  <div>
                    <h3 className={`font-display font-semibold text-[#0f2a55] ${m.featured ? 'text-2xl' : 'text-xl'}`}>{m.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-[#0f2a55]/65">{m.blurb}</p>
                  </div>
                </div>
                <ul className="mt-4 space-y-1.5">
                  {m.points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-[13px] text-[#0f2a55]/75">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: m.tone }} />
                      {p}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      {/* CTA panel */}
      <section
        className="relative overflow-hidden rounded-[28px] p-8 text-white sm:p-10"
        style={{ backgroundColor: '#0f2a55', backgroundImage: 'radial-gradient(rgba(255,255,255,.08) 1px, transparent 1.4px)', backgroundSize: '22px 22px' }}
      >
        <span className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#2fa24a]/25 blur-3xl" />
        <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: 'linear-gradient(90deg, transparent, #2fa24a 50%, transparent)' }} />
        <div className="relative flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div className="max-w-xl">
            <h2 className="font-display text-3xl font-semibold leading-tight">Step behind the counter.</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-white/70">
              One click signs you in as the seeded super-admin and drops you straight into the live
              control centre — promote users, flip auction statuses, reconcile payments and read the
              audit trail with real data.
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <AdminDemoEntry />
            <Link href="/items" className="inline-flex items-center justify-center gap-2 text-sm font-medium text-white/70 hover:text-white">
              <Eye className="h-4 w-4" /> or keep browsing as a guest
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
