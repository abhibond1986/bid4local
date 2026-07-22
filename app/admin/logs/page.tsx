import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ScrollText, Shield } from 'lucide-react';

export default async function AdminLogsPage() {
  const session = await auth();
  if (!session?.user?.role || !['superadmin','manager'].includes(session.user.role)) redirect('/');

  const logs = await db.select({ log: auditLogs, user: users }).from(auditLogs).leftJoin(users, eq(auditLogs.userId, users.id)).orderBy(desc(auditLogs.createdAt)).limit(100);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center"><ScrollText className="w-5 h-5 text-white" /></div>
        <div><h1 className="text-2xl font-bold text-slate-900">Audit Logs</h1><p className="text-slate-500 text-sm">Last 100 actions — who did what, when</p></div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 border-b"><th className="px-4 py-3 text-left font-medium text-slate-500">Time</th><th className="px-4 py-3 text-left font-medium text-slate-500">User</th><th className="px-4 py-3 text-left font-medium text-slate-500">Action</th><th className="px-4 py-3 text-left font-medium text-slate-500">Entity</th><th className="px-4 py-3 text-left font-medium text-slate-500">Details</th></tr></thead>
          <tbody>
            {logs.map(({ log, user }) => (
              <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-4 py-3 text-xs text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3"><p className="font-medium text-slate-900">{user?.name || log.userId?.slice(0,8) || 'System'}</p><p className="text-[11px] text-slate-400">{user?.email || ''}</p></td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${log.action==='BID'?'bg-blue-50 text-blue-700':log.action==='CREATE'?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-700'}`}>{log.action}</span></td>
                <td className="px-4 py-3 text-slate-600">{log.entity} {log.entityId ? `#${log.entityId}` : ''}</td>
                <td className="px-4 py-3 text-slate-500 max-w-[320px] truncate">{log.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
