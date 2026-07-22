'use client';

import { deleteCategory } from '@/app/actions';
import { useTransition, useState } from 'react';
import { Trash2, Loader2 } from 'lucide-react';

export function DeleteCategoryButton({ id, name }: { id: number; name: string }) {
  const [isPending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);

  if (!confirm) return <button onClick={() => setConfirm(true)} className="text-xs text-rose-600 hover:text-rose-700 flex items-center gap-1"><Trash2 className="w-3 h-3" />Delete</button>;

  return (
    <div className="flex items-center gap-1">
      <button onClick={() => startTransition(async () => { await deleteCategory(id); setConfirm(false); })} disabled={isPending}
        className="text-xs bg-rose-50 text-rose-700 px-2 py-1 rounded hover:bg-rose-100 disabled:opacity-50 flex items-center gap-1">
        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
      </button>
      <button onClick={() => setConfirm(false)} className="text-xs text-slate-500 px-2 py-1">Cancel</button>
    </div>
  );
}
