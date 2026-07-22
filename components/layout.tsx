'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, Package, PlusCircle, Gavel, Heart, Bell,
  Menu, X, LogOut, LogIn, Search, TrendingUp, BarChart3, Tag, Users,
  CreditCard, ScrollText, Megaphone, User, ShieldCheck,
} from 'lucide-react';
import { BrandLockup, BrandMark } from '@/components/brand-logo';

interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string;
  image?: string | null;
}

interface AppShellProps {
  children: React.ReactNode;
  user: SessionUser | null;
  unreadCount: number;
}

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, roles: null },
  { label: 'Browse Auctions', href: '/items', icon: Search, roles: null },
  { label: 'Create Auction', href: '/items/new', icon: PlusCircle, roles: ['seller', 'superadmin', 'manager'] },
  { label: 'My Auctions', href: '/my-auctions', icon: Package, roles: ['seller', 'superadmin'] },
  { label: 'My Bids', href: '/my-bids', icon: Gavel, roles: ['bidder', 'seller', 'superadmin'] },
  { label: 'Watchlist', href: '/watchlist', icon: Heart, roles: ['bidder', 'seller', 'superadmin'] },
  { label: 'Profile', href: '/profile', icon: User, roles: null },
  { label: 'Notifications', href: '/notifications', icon: Bell, roles: null },
  { label: 'Admin capabilities', href: '/admin', icon: ShieldCheck, roles: '__nonadmin__' as const },
];

const adminItems = [
  { label: 'Control Centre', href: '/admin', icon: ShieldCheck },
  { label: 'Users & Roles', href: '/admin/users', icon: Users },
  { label: 'Auctions', href: '/admin/auctions', icon: TrendingUp },
  { label: 'Categories', href: '/admin/categories', icon: Tag },
  { label: 'Payments & EMD', href: '/admin/payments', icon: CreditCard },
  { label: 'Reports', href: '/admin/reports', icon: BarChart3 },
  { label: 'Audit Logs', href: '/admin/logs', icon: ScrollText },
  { label: 'Broadcast', href: '/admin/broadcast', icon: Megaphone },
];

export function AppShell({ children, user, unreadCount }: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAuthPage = pathname === '/login' || pathname === '/signup' || pathname === '/register';

  if (isAuthPage) return <>{children}</>;

  const isAdmin = user?.role === 'superadmin' || user?.role === 'manager';
  const filteredNav = navItems.filter((item) => {
    const roles = item.roles as string[] | null | '__nonadmin__';
    if (roles === '__nonadmin__') return !isAdmin;
    return !roles || !user || roles.includes(user.role || '');
  });

  const NavRow = ({ item, tone }: { item: (typeof navItems)[number] | (typeof adminItems)[number]; tone: 'main' | 'admin' }) => {
    const Icon = item.icon;
    const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
    const accent = tone === 'admin' ? '#0f2a55' : '#2fa24a';
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setMobileOpen(false)}
        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
          active
            ? 'bg-[#0f2a55]/[0.07] text-[#0f2a55]'
            : 'text-[#0f2a55]/65 hover:bg-[#0f2a55]/[0.05] hover:text-[#0f2a55]'
        }`}
      >
        {active && (
          <span
            className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full"
            style={{ background: accent }}
          />
        )}
        <Icon
          className="h-[18px] w-[18px] transition-colors"
          style={{ color: active ? accent : undefined }}
        />
        <span className="flex-1">{item.label}</span>
        {'label' in item && item.label === 'Notifications' && unreadCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e11d48] px-1.5 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="flex min-h-screen bg-transparent">
      {/* Desktop sidebar — editorial paper */}
      <aside className="paper-card fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-[#0f2a55]/10 lg:flex">
        <div className="flex items-center justify-between border-b border-[#0f2a55]/10 px-6 py-5">
          <Link href="/" aria-label="Bid 4 Local home">
            <BrandLockup size="md" />
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#0f2a55]/45">Marketplace</p>
          {filteredNav.map((item) => (
            <NavRow key={item.href} item={item} tone="main" />
          ))}

          {isAdmin && (
            <>
              <p className="mb-2 mt-6 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#0f2a55]/45">
                Admin · full control
              </p>
              {adminItems.map((item) => (
                <NavRow key={item.href} item={item} tone="admin" />
              ))}
            </>
          )}
        </nav>

        <div className="border-t border-[#0f2a55]/10 p-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0f2a55] text-sm font-bold text-white ring-2 ring-[#2fa24a]/30">
                  {user.name?.[0]?.toUpperCase() || 'U'}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--paper-card)] bg-[#2fa24a]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#0f2a55]">{user.name}</p>
                <p className="truncate text-[11px] uppercase tracking-wide text-[#0f2a55]/50">{user.role}</p>
              </div>
              <form action="/api/auth/signout" method="POST">
                <button
                  type="submit"
                  title="Sign out"
                  className="rounded-lg p-2 text-[#0f2a55]/50 transition-colors hover:bg-[#0f2a55]/5 hover:text-[#0f2a55]"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-2">
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 rounded-xl bg-[#0f2a55] px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#16386e]"
              >
                <LogIn className="h-4 w-4" /> Sign in
              </Link>
              <Link
                href="/signup"
                className="flex items-center justify-center gap-2 rounded-xl border border-[#0f2a55]/15 px-3 py-2 text-sm font-medium text-[#0f2a55] transition-colors hover:bg-[#0f2a55]/5"
              >
                Create account
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile header */}
      <div className="paper-card fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-[#0f2a55]/10 px-4 py-2.5 lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark size="sm" />
          <span className="font-display text-lg font-semibold text-[#0f2a55]">
            Bid <span className="text-[#2fa24a]">4</span> Local
          </span>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg p-2 text-[#0f2a55] hover:bg-[#0f2a55]/5"
          aria-label="Toggle navigation"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-[#0f2a55]/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="paper-card h-full w-72 space-y-1 overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 border-b border-[#0f2a55]/10 pb-3">
              <BrandLockup size="sm" />
            </div>
            {filteredNav.map((item) => (
              <NavRow key={item.href} item={item} tone="main" />
            ))}
            {isAdmin && (
              <>
                <p className="mb-2 mt-4 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#0f2a55]/45">Admin</p>
                {adminItems.map((item) => (
                  <NavRow key={item.href} item={item} tone="admin" />
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Main */}
      <main className="min-h-screen flex-1 pt-14 lg:ml-72 lg:pt-0">
        <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
