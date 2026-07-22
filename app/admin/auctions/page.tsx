import { db } from "@/db";
import { items, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FeatureToggle, StatusToggle, DeleteAuctionButton } from "./AuctionActions";
import { Gavel } from 'lucide-react';
import { formatINR } from "@/lib/format";

const statusStyles: Record<string, string> = { active: 'bg-emerald-50 text-emerald-700', scheduled: 'bg-blue-50 text-blue-700', ended: 'bg-slate-50 text-slate-600', draft: 'bg-amber-50 text-amber-700', cancelled: 'bg-rose-50 text-rose-700' };

export default async function AdminAuctionsPage() {
  const session = await auth();
  if (!session?.user?.role || !['superadmin', 'manager'].includes(session.user.role)) redirect('/');

  const allItems = await db.select({ item: items, seller: users }).from(items).innerJoin(users, eq(items.sellerId, users.id)).orderBy(desc(items.createdAt));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3"><div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center"><Gavel className="w-5 h-5 text-emerald-600" /></div><div><h1 className="text-2xl font-bold text-slate-900">Auction Management</h1><p className="text-slate-500 text-sm">{allItems.length} auctions • Change status, feature, delete, moderate</p></div></div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b"><th className="px-4 py-3 text-left font-medium text-slate-500">Auction & Seller</th><th className="px-4 py-3 text-left font-medium text-slate-500">Status Control</th><th className="px-4 py-3 text-right font-medium text-slate-500">Price (₹ INR)</th><th className="px-4 py-3 text-right font-medium text-slate-500">Bids</th><th className="px-4 py-3 text-left font-medium text-slate-500">Featured</th><th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th></tr></thead>
            <tbody>
              {allItems.map(({ item, seller }) => (
                <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-4 py-3"><div className="flex gap-2"><div><p className="font-medium text-slate-900">{item.title}</p><p className="text-xs text-slate-400">#{item.id} • {item.condition} • {seller.name} • {seller.email}</p></div></div></td>
                  <td className="px-4 py-3"><div className="flex flex-col gap-1"><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium w-fit ${statusStyles[item.status] || ''}`}>{item.status}</span><StatusToggle itemId={item.id} current={item.status} /></div></td>
                  <td className="px-4 py-3 text-right"><p className="text-xs line-through text-slate-400">{formatINR(item.originalPrice)}</p><p className="font-semibold text-slate-900">{formatINR(item.currentBid)}</p></td>
                  <td className="px-4 py-3 text-right text-slate-500">{item.bidCount}</td>
                  <td className="px-4 py-3"><FeatureToggle itemId={item.id} isFeatured={!!item.featured} /></td>
                  <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-2"><Link href={`/items/${item.id}`} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">View</Link><DeleteAuctionButton itemId={item.id} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
