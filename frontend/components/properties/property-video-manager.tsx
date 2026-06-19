'use client';

import { useCallback, useState, type ReactNode } from 'react';

import { ActionGuard } from '../shared/ActionGuard';
import { apiFetch } from '../../lib/api';
import { getSession } from '../../lib/auth';
import type { Property, PropertyVideo } from '../../lib/properties';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function PropertyVideoManager({
  propertyId,
  videos: initialVideos,
  title,
  onChange,
}: {
  propertyId: string;
  videos: PropertyVideo[];
  title: string;
  onChange?: (videos: PropertyVideo[]) => void;
}) {
  const [videos, setVideos] = useState(initialVideos);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(
    (next: PropertyVideo[]) => {
      setVideos(next);
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
    sync(res.data.videos);
  }

  async function uploadVideoFile(file: File) {
    const session = getSession();
    if (!session?.access_token) return;
    if (!file.type.startsWith('video/')) {
      throw new Error(`${file.name} is not a video`);
    }
    const contentBase64 = await readFileAsDataUrl(file);
    await apiFetch(`/api/v1/properties/${propertyId}/videos`, {
      method: 'POST',
      token: session.access_token,
      body: JSON.stringify({
        content_base64: contentBase64,
        filename: file.name,
        content_type: file.type,
        title: videoTitle.trim() || file.name,
      }),
    });
  }

  async function uploadVideoFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await uploadVideoFile(file);
      }
      setVideoTitle('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function addVideoByUrl() {
    const session = getSession();
    if (!session?.access_token || !videoUrl.trim()) return;
    setUploading(true);
    setError(null);
    try {
      await apiFetch(`/api/v1/properties/${propertyId}/videos`, {
        method: 'POST',
        token: session.access_token,
        body: JSON.stringify({
          url: videoUrl.trim(),
          title: videoTitle.trim() || undefined,
        }),
      });
      setVideoUrl('');
      setVideoTitle('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add video');
    } finally {
      setUploading(false);
    }
  }

  async function deleteVideo(videoId: string) {
    const session = getSession();
    if (!session?.access_token) return;
    setError(null);
    try {
      await apiFetch(`/api/v1/properties/${propertyId}/videos/${videoId}`, {
        method: 'DELETE',
        token: session.access_token,
      });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete video');
    }
  }

  return (
    <section className="rounded-2xl border border-reos-border bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-h3">Videos</h2>
          <p className="mt-1 text-xs text-slate-500">
            Walkthroughs and property tours for {title}. MP4, WebM, or MOV up to 50 MB.
          </p>
        </div>
        <span className="badge badge-slate">{videos.length} videos</span>
      </div>

      {error ? (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      ) : null}

      {videos.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-reos-border bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          No videos yet. Upload a walkthrough or paste a hosted video URL.
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {videos.map((video) => (
            <li key={video.id} className="rounded-2xl border border-reos-border bg-slate-50 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{video.title ?? 'Untitled video'}</p>
                  <a
                    href={video.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block truncate text-xs text-teal-700 hover:underline"
                  >
                    {video.url}
                  </a>
                </div>
                <ActionGuard permission="properties.update">
                  <button
                    type="button"
                    onClick={() => void deleteVideo(video.id)}
                    className="text-xs font-semibold text-rose-600 hover:underline"
                  >
                    Delete
                  </button>
                </ActionGuard>
              </div>
              <video
                src={video.url}
                controls
                preload="metadata"
                className="mt-3 max-h-56 w-full rounded-xl bg-black"
              />
            </li>
          ))}
        </ul>
      )}

      <ActionGuard permission="properties.update">
        <div className="mt-4 space-y-3">
          <FormFieldRow label="Video title (optional)">
            <input
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              placeholder="e.g. Living room walkthrough"
              className="input"
            />
          </FormFieldRow>
          <label
            className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-reos-border bg-slate-50 px-4 py-6 text-center text-sm transition hover:border-teal-400 hover:bg-teal-50/40 ${
              uploading ? 'pointer-events-none opacity-60' : ''
            }`}
          >
            <input
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/*"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                void uploadVideoFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <span className="font-semibold text-slate-700">{uploading ? 'Uploading…' : 'Click to upload a video'}</span>
            <span className="mt-1 text-xs text-slate-500">MP4, WebM, or MOV. One file at a time recommended.</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Or paste a hosted video URL (https://…)"
              className="input"
            />
            <button
              type="button"
              onClick={() => void addVideoByUrl()}
              disabled={!videoUrl.trim() || uploading}
              className="btn-secondary whitespace-nowrap disabled:opacity-50"
            >
              Add by URL
            </button>
          </div>
        </div>
      </ActionGuard>
    </section>
  );
}

function FormFieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
