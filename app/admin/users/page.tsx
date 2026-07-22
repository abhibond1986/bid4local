import { db } from "@/db";
import { users } from "@/db/schema";
import { desc } from "drizzle-orm";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserRoleActions, VerifyUserActions, DeleteUserButton } from "./UserActions";
import { Users } from 'lucide-react';

const roleStyles: Record<string, string> = { superadmin: 'bg-rose-50 text-rose-700', manager: 'bg-purple-50 text-purple-700', seller: 'bg-emerald-50 text-emerald-700', bidder: 'bg-blue-50 text-blue-700', finance: 'bg-amber-50 text-amber-700', inspector: 'bg-teal-50 text-teal-700' };
const verifyStyles: Record<string, string> = { verified: 'bg-emerald-50 text-emerald-700', pending: 'bg-amber-50 text-amber-700', rejected: 'bg-rose-50 text-rose-700' };

export default async function AdminUsersPage() {
  const session = await auth();
  if (!session?.user?.role || !['superadmin', 'manager'].includes(session.user.role)) redirect('/');

  const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
  const roles = ['bidder', 'seller', 'manager', 'superadmin', 'finance', 'inspector', 'delivery'];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><Users className="w-5 h-5 text-blue-600" /></div>
        <div><h1 className="text-2xl font-bold text-slate-900">User Management</h1><p className="text-slate-500 text-sm">{allUsers.length} users • Control roles, verification, delete & audit</p></div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 border-b"><th className="px-4 py-3 text-left font-medium text-slate-500">User</th><th className="px-4 py-3 text-left font-medium text-slate-500">Contact & Bio</th><th className="px-4 py-3 text-left font-medium text-slate-500">Role</th><th className="px-4 py-3 text-left font-medium text-slate-500">Verification</th><th className="px-4 py-3 text-right font-medium text-slate-500">Actions</th></tr></thead>
            <tbody>
              {allUsers.map(user => (
                <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-600">{user.name?.[0]?.toUpperCase() || '?'}</div><div><p className="font-medium text-slate-900">{user.name}</p><p className="text-xs text-slate-400">{user.email}</p><p className="text-[11px] text-slate-400">{new Date(user.createdAt).toLocaleDateString()}</p></div></div></td>
                  <td className="px-4 py-3"><p className="text-xs text-slate-600">{user.phone || 'No phone'}</p><p className="text-xs text-slate-500">{[user.city, user.state].filter(Boolean).join(', ') || 'No location'}</p><p className="text-[11px] text-slate-400 max-w-[180px] truncate">{user.bio || 'No bio'}</p></td>
                  <td className="px-4 py-3"><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${roleStyles[user.role || 'bidder'] || 'bg-slate-100 text-slate-700'}`}>{user.role}</span><div className="mt-2"><UserRoleActions userId={user.id} currentRole={user.role || 'bidder'} roles={roles} /></div></td>
                  <td className="px-4 py-3"><span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${verifyStyles[user.verified || 'pending']}`}>{user.verified}</span><div className="mt-2"><VerifyUserActions userId={user.id} currentStatus={user.verified || 'pending'} /></div></td>
                  <td className="px-4 py-3 text-right"><DeleteUserButton userId={user.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
