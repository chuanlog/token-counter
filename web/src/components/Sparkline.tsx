import { useId } from 'react';

interface SparklineProps {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}

export function Sparkline({ values, color, width = 168, height = 46 }: SparklineProps) {
  const gradientId = useId().replace(/:/g, '');
  const data = values.length >= 2 ? values : [0, ...(values.length ? values : [0])];
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const span = max - min || 1;
  const pad = 3;
  const stepX = (width - pad * 2) / (data.length - 1);
  const points = data.map((value, index) => {
    const x = pad + stepX * index;
    const y = height - pad - ((value - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${points[points.length - 1][0].toFixed(1)},${height - pad} L${pad},${height - pad} Z`;
  const last = points[points.length - 1];

  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.6" fill={color} stroke="#13161c" strokeWidth="2" />
    </svg>
  );
}
