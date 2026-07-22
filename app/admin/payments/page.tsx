import { db } from "@/db";
import { payments, items, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { formatINR } from "@/lib/format";
import { PaymentActions } from "./PaymentActions";
import { CreditCard, Banknote } from 'lucide-react';

export default async function AdminPaymentsPage() {
  const session = await auth();
  if (!session?.user?.role || !['superadmin','manager','finance'].includes(session.user.role)) redirect('/');

  const allPayments = await db.select({ payment: payments, item: items, user: users })
    .from(payments)
    .leftJoin(items, eq(payments.itemId, items.id))
    .leftJoin(users, eq(payments.userId, users.id))
    .orderBy(desc(payments.createdAt));

  const total = allPayments.reduce((s, p) => s + p.payment.amount, 0);
  const completed = allPayments.filter(p => p.payment.status === 'completed').reduce((s, p) => s + p.payment.amount, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><CreditCard className="w-5 h-5 text-blue-600" /></div>
        <div><h1 className="text-2xl font-bold text-slate-900">Payments & EMD</h1><p className="text-slate-500 text-sm">{allPayments.length} transactions • {formatINR(total)} total • {formatINR(completed)} completed</p></div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4"><p className="text-sm text-slate-500">Total Volume</p><p className="text-xl font-bold text-slate-900">{formatINR(total)}</p></div>
        <div className="bg-white border border-slate-200 rounded-xl p-4"><p className="text-sm text-slate-500">Completed</p><p className="text-xl font-bold text-emerald-600">{formatINR(completed)}</p></div>
        <div className="bg-white border border-slate-200 rounded-xl p-4"><p className="text-sm text-slate-500">Pending / Failed</p><p className="text-xl font-bold text-amber-600">{allPayments.filter(p=>p.payment.status!=='completed').length}</p></div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b"><th className="px-4 py-3 text-left font-medium text-slate-500">Txn</th><th className="px-4 py-3 text-left font-medium text-slate-500">Auction / User</th><th className="px-4 py-3 text-left font-medium text-slate-500">Type</th><th className="px-4 py-3 text-right font-medium text-slate-500">Amount</th><th className="px-4 py-3 text-left font-medium text-slate-500">Method</th><th className="px-4 py-3 text-left font-medium text-slate-500">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead>
            <tbody>
              {allPayments.map(({ payment, item, user }) => (
                <tr key={payment.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-4 py-3"><p className="font-mono text-xs text-slate-700">{payment.transactionId || `PAY-${payment.id}`}</p><p className="text-[11px] text-slate-400">{new Date(payment.createdAt).toLocaleString()}</p></td>
                  <td className="px-4 py-3"><p className="font-medium text-slate-900">{item?.title || `Item #${payment.itemId}`}</p><p className="text-xs text-slate-500">{user?.name} • {user?.email}</p></td>
                  <td className="px-4 py-3"><span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 capitalize">{payment.type.replace('_',' ')}</span></td>
                  <td className="px-4 py-3 text-right font-semibold">{formatINR(payment.amount)}</td>
                  <td className="px-4 py-3 text-slate-500 capitalize">{payment.method || '—'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${payment.status==='completed'?'bg-emerald-50 text-emerald-700':payment.status==='pending'?'bg-amber-50 text-amber-700':'bg-rose-50 text-rose-700'}`}>{payment.status}</span></td>
                  <td className="px-4 py-3 text-right"><PaymentActions id={payment.id} current={payment.status || 'pending'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
