'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { ArrowRight, Loader2, ShieldCheck } from 'lucide-react';

export function AdminDemoEntry({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = useState(false);

  const enter = async () => {
    setLoading(true);
    await signIn('credentials', {
      email: 'admin@bidlocal.com',
      password: 'password123',
      callbackUrl: '/admin',
    });
  };

  return (
    <button
      onClick={enter}
      disabled={loading}
      className={`group inline-flex items-center justify-center gap-2 rounded-xl font-semibold text-white shadow-[0_16px_34px_-16px_rgba(47,162,74,.85)] transition disabled:opacity-60 ${
        compact
          ? 'bg-[#2fa24a] px-4 py-2 text-sm hover:bg-[#3bb75a]'
          : 'bg-[#2fa24a] px-6 py-3 text-[15px] hover:bg-[#3bb75a]'
      }`}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Opening the desk…
        </>
      ) : (
        <>
          <ShieldCheck className="h-4 w-4" />
          {compact ? 'Enter as demo admin' : 'Step behind the counter'}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </>
      )}
    </button>
  );
}
