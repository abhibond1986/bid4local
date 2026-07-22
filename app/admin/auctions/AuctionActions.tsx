'use client';
import { toggleItemFeatured, adminUpdateAuctionStatus, adminDeleteAuction } from '@/app/actions';
import { useTransition, useState } from 'react';
import { Star, Loader2, Trash2 } from 'lucide-react';

export function FeatureToggle({ itemId, isFeatured }: { itemId: number; isFeatured: boolean }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button onClick={()=> startTransition(async()=>{ await toggleItemFeatured(itemId); })} disabled={isPending}
      className={`p-1.5 rounded-lg transition-colors ${isFeatured ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className={`w-3.5 h-3.5 ${isFeatured ? 'fill-current' : ''}`} />}
    </button>
  );
}

export function StatusToggle({ itemId, current }: { itemId: number; current: string }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(current);
  const opts = ['draft','scheduled','active','ended','cancelled'];
  return (
    <select value={status} onChange={e=>{ const v=e.target.value; setStatus(v); startTransition(async()=>{ await adminUpdateAuctionStatus(itemId, v); }); }} disabled={isPending}
      className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white">
      {opts.map(o=> <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export function DeleteAuctionButton({ itemId }: { itemId: number }) {
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  if (!confirm) return <button onClick={()=>setConfirm(true)} className="text-rose-600 hover:text-rose-700 p-1"><Trash2 className="w-3.5 h-3.5"/></button>;
  return <div className="flex items-center gap-1"><button disabled={isPending} onClick={()=> startTransition(async()=>{ await adminDeleteAuction(itemId); })} className="text-xs bg-rose-600 text-white px-2 py-1 rounded">Delete</button><button onClick={()=>setConfirm(false)} className="text-xs text-slate-500">Cancel</button></div>;
}
