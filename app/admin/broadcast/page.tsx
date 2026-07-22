import { db } from "@/db";
import { users } from "@/db/schema";
import { desc } from "drizzle-orm";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { BroadcastForm } from "./BroadcastForm";
import { Megaphone } from 'lucide-react';

export default async function BroadcastPage() {
  const session = await auth();
  if (!session?.user?.role || session.user.role !== 'superadmin') redirect('/');

  const allUsers = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).orderBy(desc(users.createdAt)).limit(200);

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center"><Megaphone className="w-5 h-5 text-violet-600" /></div>
        <div><h1 className="text-2xl font-bold text-slate-900">Broadcast Notification</h1><p className="text-slate-500 text-sm">Send system notification to any user (in-app + future push/email)</p></div>
      </div>
      <BroadcastForm users={allUsers} />
    </div>
  );
}
