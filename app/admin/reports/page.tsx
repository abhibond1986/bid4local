import { db } from "@/db";
import { items, bids, payments, users } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { BarChart3, DollarSign, Users, Package, TrendingUp, Gavel } from 'lucide-react';
import { formatINR } from "@/lib/format";

export default async function AdminReportsPage() {
  const session = await auth();
  if (!session?.user?.role || !['superadmin', 'manager'].includes(session.user.role)) redirect('/');

  const [auctionStats, paymentStats, topItems, biddingStats] = await Promise.all([
    db.select({ status: items.status, count: sql<number>`count(*)`, totalValue: sql<number>`coalesce(sum("currentBid"),0)` }).from(items).groupBy(items.status),
    db.select({ type: payments.type, count: sql<number>`count(*)`, total: sql<number>`coalesce(sum(amount),0)` }).from(payments).groupBy(payments.type),
    db.select().from(items).orderBy(desc(items.currentBid)).limit(5),
    db.select({ totalBids: sql<number>`count(*)`, totalAmount: sql<number>`coalesce(sum(amount),0)`, avgAmount: sql<number>`coalesce(avg(amount),0)` }).from(bids),
  ]);

  const totalAuctionValue = auctionStats.reduce((s, a) => s + Number(a.totalValue), 0);
  const totalPayments = paymentStats.reduce((s, p) => s + Number(p.total), 0);
  const totalBids = Number(biddingStats[0]?.totalBids || 0);
  const avgBid = Math.round(Number(biddingStats[0]?.avgAmount || 0));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center"><BarChart3 className="w-5 h-5 text-purple-600" /></div>
        <div><h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1><p className="text-slate-500 text-sm">Platform performance insights</p></div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Auction Value', value: formatINR(totalAuctionValue), icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Total Payments', value: formatINR(totalPayments), icon: DollarSign, color: 'text-blue-600 bg-blue-50' },
          { label: 'Total Bids', value: totalBids.toLocaleString(), icon: Gavel, color: 'text-purple-600 bg-purple-50' },
          { label: 'Average Bid', value: formatINR(avgBid), icon: TrendingUp, color: 'text-amber-600 bg-amber-50' },
        ].map(m => { const Icon = m.icon; return (
          <div key={m.label} className="bg-white border border-slate-200 rounded-xl p-5">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${m.color} mb-3`}><Icon className="w-5 h-5" /></div>
            <p className="text-2xl font-bold text-slate-900">{m.value}</p>
            <p className="text-sm text-slate-500">{m.label}</p>
          </div>
        ); })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Auction Status Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Auctions by Status</h3>
          <div className="space-y-3">
            {auctionStats.map(stat => {
              const total = auctionStats.reduce((s, a) => s + Number(a.count), 0);
              const pct = total > 0 ? Math.round((Number(stat.count) / total) * 100) : 0;
              const statusColors: Record<string, string> = { active: 'bg-emerald-500', scheduled: 'bg-blue-500', ended: 'bg-slate-400', draft: 'bg-amber-500', cancelled: 'bg-rose-500' };
              return (
                <div key={stat.status} className="flex items-center gap-3">
                  <span className="text-sm text-slate-700 w-24 capitalize">{stat.status}</span>
                  <div className="flex-1 h-6 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${statusColors[stat.status] || 'bg-slate-300'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-medium text-slate-900 w-16 text-right">{Number(stat.count)} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Selling Items */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Top Auctions by Value</h3>
          <div className="space-y-3">
            {topItems.map((item, i) => (
              <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>#{i + 1}</span>
                <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-900 truncate">{item.title}</p><p className="text-xs text-slate-400">{item.bidCount} bids</p></div>
                <span className="text-sm font-semibold text-slate-900">{formatINR(item.currentBid)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Payments by Type</h3>
          <div className="space-y-3">
            {paymentStats.map(stat => (
              <div key={stat.type} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div><p className="text-sm font-medium text-slate-900 capitalize">{stat.type.replace('_', ' ')}</p><p className="text-xs text-slate-400">{Number(stat.count)} transactions</p></div>
                <span className="text-sm font-semibold text-slate-900">{formatINR(Number(stat.total))}</span>
              </div>
            ))}
            {paymentStats.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No payment data yet</p>}
          </div>
        </div>

        {/* Bidding Insights */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Bidding Insights</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-indigo-50 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-indigo-600">{totalBids}</p><p className="text-sm text-slate-600">Total Bids</p></div>
            <div className="bg-emerald-50 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-emerald-600">{formatINR(avgBid)}</p><p className="text-sm text-slate-600">Avg Bid</p></div>
            <div className="bg-amber-50 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-amber-600">{auctionStats.find(s => s.status === 'active') ? Number(auctionStats.find(s => s.status === 'active')!.count) : 0}</p><p className="text-sm text-slate-600">Active Auctions</p></div>
            <div className="bg-rose-50 rounded-xl p-4 text-center"><p className="text-2xl font-bold text-rose-600">{auctionStats.find(s => s.status === 'ended') ? Number(auctionStats.find(s => s.status === 'ended')!.count) : 0}</p><p className="text-sm text-slate-600">Ended Auctions</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}
