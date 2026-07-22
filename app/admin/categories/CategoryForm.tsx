'use client';

import { createCategory } from '@/app/actions';
import { useTransition, useState } from 'react';
import { Loader2 } from 'lucide-react';

export function CategoryForm() {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [icon, setIcon] = useState('');
  const [description, setDescription] = useState('');

  const handleNameChange = (val: string) => {
    setName(val);
    setSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await createCategory(name, slug, icon, description);
      setName(''); setSlug(''); setIcon(''); setDescription('');
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
      <div className="flex-1 min-w-[150px]"><label className="block text-xs text-slate-500 mb-1">Name</label><input value={name} onChange={e => handleNameChange(e.target.value)} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
      <div className="flex-1 min-w-[150px]"><label className="block text-xs text-slate-500 mb-1">Slug</label><input value={slug} onChange={e => setSlug(e.target.value)} required className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
      <div className="w-24"><label className="block text-xs text-slate-500 mb-1">Icon Emoji</label><input value={icon} onChange={e => setIcon(e.target.value)} placeholder="📦" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
      <div className="flex-1 min-w-[200px]"><label className="block text-xs text-slate-500 mb-1">Description</label><input value={description} onChange={e => setDescription(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" /></div>
      <button type="submit" disabled={isPending} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1">
        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add'}
      </button>
    </form>
  );
}
