'use client';
import { adminUpdatePaymentStatus } from '@/app/actions';
import { useTransition, useState } from 'react';
import { Loader2 } from 'lucide-react';

export function PaymentActions({ id, current }: { id: number; current: string }) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(current);
  const options = ['pending','completed','failed','refunded'];

  return (
    <select value={status} onChange={e => { const v=e.target.value; setStatus(v); startTransition(async ()=>{ await adminUpdatePaymentStatus(id, v); }); }} disabled={isPending}
      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white">
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}
