'use client';
import { useState, useTransition } from 'react';
import { adminCreateNotification } from '@/app/actions';
import { Loader2, Send } from 'lucide-react';

interface UserOpt { id: string; name: string | null; email: string | null; role: string | null; }

export function BroadcastForm({ users }: { users: UserOpt[] }) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ userId: users[0]?.id || '', title: '', message: '', type: 'system' });

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); setMsg('');
    const fd = new FormData(); Object.entries(form).forEach(([k,v])=> fd.set(k,v));
    startTransition(async ()=>{ try { await adminCreateNotification(fd); setMsg('Notification sent!'); setForm(f=>({ ...f, title:'', message:'' })); } catch(err:any){ setMsg(err.message); } });
  };

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
      {msg && <div className="px-4 py-3 rounded-xl text-sm bg-emerald-50 text-emerald-700 border border-emerald-200">{msg}</div>}
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-xs font-medium text-slate-600 mb-1">Recipient</label><select value={form.userId} onChange={e=>setForm({...form, userId:e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500">{users.map(u=> <option key={u.id} value={u.id}>{u.name} — {u.email} ({u.role})</option>)}</select></div>
        <div><label className="block text-xs font-medium text-slate-600 mb-1">Type</label><select value={form.type} onChange={e=>setForm({...form, type:e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500"><option value="system">System</option><option value="bid">Bid</option><option value="payment">Payment</option><option value="auction_end">Auction End</option></select></div>
      </div>
      <div><label className="block text-xs font-medium text-slate-600 mb-1">Title</label><input value={form.title} onChange={e=>setForm({...form, title:e.target.value})} required className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Payment confirmed" /></div>
      <div><label className="block text-xs font-medium text-slate-600 mb-1">Message</label><textarea value={form.message} onChange={e=>setForm({...form, message:e.target.value})} required rows={4} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="Your payment of ₹... was confirmed. Next steps..." /></div>
      <button type="submit" disabled={isPending} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">{isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>} Send Notification</button>
    </form>
  );
}
