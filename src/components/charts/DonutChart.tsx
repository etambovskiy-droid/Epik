interface DonutSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
}

export function DonutChart({
  segments,
  size = 140,
  strokeWidth = 18,
  centerLabel,
  centerValue
}: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="rgba(255, 255, 255, 0.05)"
            strokeWidth={strokeWidth}
          />
          {segments.map((seg) => {
            const ratio = total > 0 ? seg.value / total : 0;
            const strokeDasharray = `${ratio * circumference} ${circumference}`;
            const strokeDashoffset = -currentOffset;
            currentOffset += ratio * circumference;

            return (
              <circle
                key={seg.id}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-500 ease-out"
              />
            );
          })}
        </svg>

        {(centerValue || centerLabel) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            {centerValue && (
              <span className="text-base font-bold font-mono text-slate-100 leading-tight">
                {centerValue}
              </span>
            )}
            {centerLabel && (
              <span className="text-[10px] text-slate-400 font-medium">
                {centerLabel}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1.5 flex-1 min-w-0">
        {segments.map((seg) => {
          const pct = total > 0 ? ((seg.value / total) * 100).toFixed(1) : '0';
          return (
            <div key={seg.id} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0 truncate">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                <span className="text-slate-300 truncate">{seg.label}</span>
              </div>
              <span className="font-mono text-slate-400 shrink-0 ml-2">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
