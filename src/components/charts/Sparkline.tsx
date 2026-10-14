interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
}

export function Sparkline({
  data,
  width = 84,
  height = 28,
  color = '#38bdf8',
  fill = true
}: SparklineProps) {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max === min ? 1 : max - min;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * (width - 4) + 2;
    const y = height - 3 - ((val - min) / range) * (height - 6);
    return `${x},${y}`;
  });

  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `${linePath} L ${width - 2},${height} L 2,${height} Z`;

  const gradId = `spark-${color.replace('#', '')}-${Math.floor(Math.random() * 1000)}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      {fill && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
      )}
      {fill && <path d={areaPath} fill={`url(#${gradId})`} />}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
