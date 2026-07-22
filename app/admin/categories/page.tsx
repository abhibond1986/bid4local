import { db } from "@/db";
import { categories, items } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { CategoryForm } from "./CategoryForm";
import { DeleteCategoryButton } from "./DeleteCategoryButton";
import { Tag, PlusCircle } from 'lucide-react';

export default async function AdminCategoriesPage() {
  const session = await auth();
  if (!session?.user?.role || !['superadmin'].includes(session.user.role)) redirect('/');

  const allCategories = await db.select({
    id: categories.id, name: categories.name, slug: categories.slug, icon: categories.icon, description: categories.description,
    itemCount: sql<number>`(select count(*) from item where "categoryId" = category.id)`,
  }).from(categories);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center"><Tag className="w-5 h-5 text-indigo-600" /></div>
          <div><h1 className="text-2xl font-bold text-slate-900">Categories</h1><p className="text-slate-500 text-sm">{allCategories.length} categories</p></div>
        </div>
      </div>

      {/* Add Category Form */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><PlusCircle className="w-4 h-4" /> Add New Category</h3>
        <CategoryForm />
      </div>

      {/* Categories List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50 border-b">
            <th className="px-4 py-3 text-left font-medium text-slate-500">Name</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500">Slug</th>
            <th className="px-4 py-3 text-left font-medium text-slate-500">Description</th>
            <th className="px-4 py-3 text-right font-medium text-slate-500">Items</th>
            <th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {allCategories.map(cat => (
              <tr key={cat.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="px-4 py-3 font-medium text-slate-900">{cat.name}</td>
                <td className="px-4 py-3 text-slate-500">{cat.slug}</td>
                <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{cat.description}</td>
                <td className="px-4 py-3 text-right text-slate-600">{cat.itemCount}</td>
                <td className="px-4 py-3"><DeleteCategoryButton id={cat.id} name={cat.name} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
