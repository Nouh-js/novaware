import { useMemo } from 'react';

export function AreaChart({
  data,
  height = 200,
  color = '#3b82f6',
  format = (v: number) => String(v),
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  format?: (v: number) => string;
}) {
  const { path, area, max, min, points } = useMemo(() => {
    if (data.length === 0) return { path: '', area: '', max: 0, min: 0, points: [] as { x: number; y: number; label: string; value: number }[] };
    const w = 100;
    const h = 100;
    const vals = data.map((d) => d.value);
    const mx = Math.max(...vals, 1);
    const mn = Math.min(...vals, 0);
    const range = mx - mn || 1;
    const step = data.length > 1 ? w / (data.length - 1) : 0;
    const pts = data.map((d, i) => ({
      x: i * step,
      y: h - ((d.value - mn) / range) * (h - 8) - 4,
      label: d.label,
      value: d.value,
    }));
    const p = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
    const a = `${p} L ${w} ${h} L 0 ${h} Z`;
    return { path: p, area: a, max: mx, min: mn, points: pts };
  }, [data]);

  return (
    <div className="relative" style={{ height }}>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 40, 60, 80].map((y) => (
          <line
            key={y}
            x1="0"
            y1={y}
            x2="100"
            y2={y}
            stroke="currentColor"
            strokeOpacity="0.06"
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={area} fill="url(#area-grad)" />
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r="1.5"
            fill={color}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between text-[10px] text-ink-400">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
      <div className="flex justify-between text-[10px] text-ink-400">
        {data.map((d, i) => (
          <span key={i} className="truncate">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BarChart({
  data,
  height = 200,
  color = '#3b82f6',
  format = (v: number) => String(v),
}: {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  format?: (v: number) => string;
}) {
  const max = useMemo(() => Math.max(...data.map((d) => d.value), 1), [data]);
  return (
    <div className="flex flex-col" style={{ height }}>
      <div className="flex flex-1 items-end gap-2">
        {data.map((d, i) => (
          <div key={i} className="group flex flex-1 flex-col items-center justify-end gap-1">
            <div className="text-[10px] font-medium text-ink-500 opacity-0 transition group-hover:opacity-100">
              {format(d.value)}
            </div>
            <div
              className="w-full rounded-t-md transition-all duration-300 hover:opacity-80"
              style={{
                height: `${(d.value / max) * 100}%`,
                background: `linear-gradient(180deg, ${color}, ${color}99)`,
                minHeight: '2px',
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {data.map((d, i) => (
          <div key={i} className="flex-1 truncate text-center text-[10px] text-ink-400">
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({
  data,
  size = 160,
  thickness = 18,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circ = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth={thickness}
          />
          {data.map((d, i) => {
            const len = (d.value / total) * circ;
            const seg = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={d.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
              />
            );
            offset += len;
            return seg;
          })}
        </g>
        <text
          x="50%"
          y="48%"
          textAnchor="middle"
          className="fill-ink-800 dark:fill-ink-100"
          style={{ font: '600 16px Inter, sans-serif' }}
        >
          {total.toLocaleString('fr-FR')}
        </text>
        <text
          x="50%"
          y="60%"
          textAnchor="middle"
          className="fill-ink-400"
          style={{ font: '500 10px Inter, sans-serif' }}
        >
          Total
        </text>
      </svg>
      <div className="flex flex-col gap-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
            <span className="text-ink-600 dark:text-ink-300">{d.label}</span>
            <span className="ml-auto font-medium">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
