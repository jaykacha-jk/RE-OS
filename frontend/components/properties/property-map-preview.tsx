type PropertyMapPreviewProps = {
  latitude: number;
  longitude: number;
  title?: string;
};

/** Lightweight OpenStreetMap embed — no API key required. */
export function PropertyMapPreview({ latitude, longitude, title }: PropertyMapPreviewProps) {
  const delta = 0.01;
  const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].join(
    '%2C',
  );
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;

  return (
    <section className="overflow-hidden rounded-2xl border border-reos-border bg-white shadow-card">
      <div className="border-b border-reos-border px-5 py-4">
        <h2 className="text-h3">Map location</h2>
        <p className="mt-1 text-xs text-slate-500">
          {title ? `${title} · ` : ''}
          {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </p>
      </div>
      <iframe
        title={title ? `Map for ${title}` : 'Property map'}
        src={src}
        className="h-72 w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="border-t border-reos-border px-5 py-3 text-xs text-slate-500">
        <a
          href={`https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-teal-700 hover:underline"
        >
          Open in OpenStreetMap
        </a>
      </div>
    </section>
  );
}
