'use client';

import Image from 'next/image';
import { useCallback, useState } from 'react';

import { ActionGuard } from '../shared/ActionGuard';
import { apiFetch } from '../../lib/api';
import { getSession } from '../../lib/auth';
import type { Property, PropertyImage } from '../../lib/properties';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function PropertyImageManager({
  propertyId,
  images: initialImages,
  title,
  onChange,
  embedded = false,
}: {
  propertyId: string;
  images: PropertyImage[];
  title: string;
  onChange?: (images: PropertyImage[]) => void;
  /** When true, omit outer card chrome — used inside FormPage sections. */
  embedded?: boolean;
}) {
  const [images, setImages] = useState(initialImages);
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(
    (next: PropertyImage[]) => {
      setImages(next);
      onChange?.(next);
    },
    [onChange],
  );

  async function reload() {
    const session = getSession();
    if (!session?.access_token) return;
    const res = await apiFetch<Property>(`/api/v1/properties/${propertyId}`, {
      token: session.access_token,
    });
    sync(res.data.images);
  }

  async function uploadImageFiles(files: FileList | null) {
    const session = getSession();
    if (!session?.access_token || !files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          throw new Error(`${file.name} is not an image`);
        }
        const contentBase64 = await readFileAsDataUrl(file);
        await apiFetch(`/api/v1/properties/${propertyId}/images`, {
          method: 'POST',
          token: session.access_token,
          body: JSON.stringify({
            content_base64: contentBase64,
            filename: file.name,
            content_type: file.type,
          }),
        });
      }
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function addImage() {
    const session = getSession();
    if (!session?.access_token || !imageUrl.trim()) return;
    setUploading(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/properties/${propertyId}/images`, {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({ url: imageUrl.trim() }),
      });
      setImageUrl('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add image');
    } finally {
      setUploading(false);
    }
  }

  async function setCover(imageId: string) {
    const session = getSession();
    if (!session?.access_token) return;
    setError(null);
    try {
      await apiFetch(`/api/v1/properties/${propertyId}/images/${imageId}/cover`, {
        method: 'PATCH',
        token: session.access_token,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set cover');
    }
  }

  async function deleteImage(imageId: string) {
    const session = getSession();
    if (!session?.access_token) return;
    setError(null);
    try {
      await apiFetch(`/api/v1/properties/${propertyId}/images/${imageId}`, {
        method: 'DELETE',
        token: session.access_token,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete image');
    }
  }

  const shellClass = embedded ? 'space-y-4' : 'rounded-2xl border border-reos-border bg-white p-5 shadow-card space-y-4';

  return (
    <section className={shellClass}>
      {!embedded ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-h3">Images</h2>
            <p className="mt-1 text-xs text-slate-500">
              Add listing photos before publishing publicly. Cover image appears first on your website.
            </p>
          </div>
          <span className="badge badge-slate">{images.length} images</span>
        </div>
      ) : (
        <div className="flex justify-end">
          <span className="badge badge-slate">{images.length} images</span>
        </div>
      )}

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      {images.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-reos-border bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          No images yet for {title}. Upload at least one before marking the listing as published.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative overflow-hidden rounded-2xl border border-reos-border bg-slate-100"
            >
              <div className="relative aspect-[4/3] w-full">
                <Image
                  src={img.url}
                  alt={img.alt_text ?? title}
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 200px"
                  className="object-cover"
                />
              </div>
              {img.is_cover ? (
                <span className="absolute left-2 top-2 rounded-full bg-teal-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  Cover
                </span>
              ) : null}
              <ActionGuard permission="properties.update">
                <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-slate-950/70 p-2 opacity-0 transition group-hover:opacity-100">
                  {!img.is_cover ? (
                    <button
                      type="button"
                      onClick={() => void setCover(img.id)}
                      className="text-[11px] font-semibold text-white hover:underline"
                    >
                      Set cover
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void deleteImage(img.id)}
                    className="text-[11px] font-semibold text-rose-200 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </ActionGuard>
            </div>
          ))}
        </div>
      )}

      <ActionGuard permission="properties.update">
        <div className="space-y-3">
          <label
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-reos-border bg-slate-50 px-4 py-5 text-center text-sm transition hover:border-teal-400 hover:bg-teal-50/40 ${
              uploading ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                void uploadImageFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <span className="font-semibold text-slate-700">{uploading ? 'Uploading…' : 'Click to upload images'}</span>
            <span className="mt-1 text-xs text-slate-500">PNG, JPG, WEBP or GIF. Multiple files supported.</span>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Or paste an image URL (https://…)"
              className="input min-w-0 flex-1"
            />
            <button
              type="button"
              onClick={() => void addImage()}
              disabled={!imageUrl.trim() || uploading}
              className="btn-secondary shrink-0 whitespace-nowrap disabled:opacity-50"
            >
              Add by URL
            </button>
          </div>
        </div>
      </ActionGuard>
    </section>
  );
}
