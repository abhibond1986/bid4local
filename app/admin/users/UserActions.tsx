'use client';
import { updateUserRole, verifyUser, adminDeleteUser } from '@/app/actions';
import { useTransition, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';

export function UserRoleActions({ userId, currentRole, roles }: { userId: string; currentRole: string; roles: string[] }) {
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState(currentRole);
  return (
    <select value={role} onChange={e => { const v=e.target.value; setRole(v); startTransition(async()=>{ await updateUserRole(userId, v); }); }} disabled={isPending}
      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-indigo-500 outline-none">
      {roles.map(r => <option key={r} value={r}>{r}</option>)}
    </select>
  );
}

export function VerifyUserActions({ userId, currentStatus }: { userId: string; currentStatus: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-1">
      <button onClick={()=> startTransition(async()=>{ await verifyUser(userId, 'verified'); })} disabled={isPending || currentStatus==='verified'} className={`text-xs px-2 py-1 rounded ${currentStatus==='verified'?'bg-emerald-50 text-emerald-700':'bg-emerald-600 text-white hover:bg-emerald-700'}`}>Verify</button>
      <button onClick={()=> startTransition(async()=>{ await verifyUser(userId, 'rejected'); })} disabled={isPending} className="text-xs bg-rose-50 text-rose-700 px-2 py-1 rounded hover:bg-rose-100">Reject</button>
    </div>
  );
}

export function DeleteUserButton({ userId }: { userId: string }) {
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  if (!confirm) return <button onClick={()=>setConfirm(true)} className="text-xs text-rose-600 hover:text-rose-700 p-1"><Trash2 className="w-3.5 h-3.5"/></button>;
  return <div className="flex items-center gap-1"><button disabled={isPending} onClick={()=> startTransition(async()=>{ await adminDeleteUser(userId); })} className="text-xs bg-rose-600 text-white px-2 py-1 rounded">Delete</button><button onClick={()=>setConfirm(false)} className="text-xs text-slate-500">Cancel</button></div>;
}
