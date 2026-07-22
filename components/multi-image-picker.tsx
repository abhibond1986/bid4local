'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, X, Images, AlertCircle } from 'lucide-react';

export function MultiImagePicker({ existingImages = [] }: { existingImages?: string[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState('');

  useEffect(() => () => previews.forEach(url => URL.revokeObjectURL(url)), [previews]);

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    const files = Array.from(event.target.files || []);
    if (files.length + existingImages.length > 8) {
      setError('You can upload up to 8 product photos.');
      event.target.value = '';
      return;
    }
    const invalid = files.find(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024);
    if (invalid) {
      setError('Use JPG, PNG, or WebP images up to 2 MB each.');
      event.target.value = '';
      return;
    }
    previews.forEach(url => URL.revokeObjectURL(url));
    setPreviews(files.map(file => URL.createObjectURL(file)));
  };

  const clear = () => {
    previews.forEach(url => URL.revokeObjectURL(url));
    setPreviews([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <input ref={inputRef} type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple onChange={onChange} className="sr-only" />
      <button type="button" onClick={() => inputRef.current?.click()}
        className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 px-5 py-8 text-slate-600 transition-all hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-700">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white shadow-sm"><ImagePlus className="h-5 w-5" /></span>
        <span className="text-left">
          <span className="block text-sm font-semibold">Add product photos</span>
          <span className="block text-xs text-slate-400">Up to 8 JPG, PNG, or WebP files · 2 MB each</span>
        </span>
      </button>

      {(existingImages.length > 0 || previews.length > 0) && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Images className="h-3.5 w-3.5" /> {existingImages.length + previews.length} photo(s)</p>
            {previews.length > 0 && <button type="button" onClick={clear} className="flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700"><X className="h-3 w-3" /> Clear new</button>}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {existingImages.map((src, index) => (
              <div key={`existing-${index}`} className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Current product photo ${index + 1}`} className="h-full w-full object-cover" />
                <span className="absolute bottom-1 left-1 rounded bg-slate-900/65 px-1.5 py-0.5 text-[9px] font-medium text-white">Saved</span>
              </div>
            ))}
            {previews.map((src, index) => (
              <div key={src} className="relative aspect-square overflow-hidden rounded-xl border border-indigo-200 bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`New product photo ${index + 1}`} className="h-full w-full object-cover" />
                {index === 0 && existingImages.length === 0 && <span className="absolute bottom-1 left-1 rounded bg-indigo-600 px-1.5 py-0.5 text-[9px] font-medium text-white">Cover</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      {error && <p className="flex items-center gap-1.5 text-xs text-rose-600"><AlertCircle className="h-3.5 w-3.5" />{error}</p>}
    </div>
  );
}
