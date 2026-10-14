import { useState, useRef } from 'react';

export interface ChartSeries {
  id: string;
  name: string;
  dataKey: string;
  color: string;
  secondaryColor?: string;
  unit?: string;
  fillOpacity?: number;
}

interface AreaTimeSeriesChartProps<T> {
  data: T[];
  series: ChartSeries[];
  timeKey: keyof T;
  height?: number;
  yMin?: number;
  yMax?: number;
  valueFormatter?: (val: number, seriesId?: string) => string;
}

export function AreaTimeSeriesChart<T extends Record<string, any>>({
  data,
  series,
  timeKey,
  height = 240,
  yMin,
  yMax,
  valueFormatter = (val: number) => val.toLocaleString()
}: AreaTimeSeriesChartProps<T>) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center text-xs text-slate-500 font-mono">
        No telemetry time-series points recorded
      </div>
    );
  }

  // Calculate bounds
  let computedMin = yMin !== undefined ? yMin : Infinity;
  let computedMax = yMax !== undefined ? yMax : -Infinity;

  if (yMin === undefined || yMax === undefined) {
    series.forEach((s) => {
      data.forEach((d) => {
        const val = Number(d[s.dataKey] ?? 0);
        if (!isNaN(val)) {
          if (yMin === undefined && val < computedMin) computedMin = val;
          if (yMax === undefined && val > computedMax) computedMax = val;
        }
      });
    });
  }

  if (computedMin === Infinity) computedMin = 0;
  if (computedMax === -Infinity) computedMax = 100;
  if (computedMax === computedMin) computedMax = computedMin + 10;

  // Add 10% breathing room to max if not explicitly set
  if (yMax === undefined) {
    const range = computedMax - computedMin;
    computedMax += range * 0.12;
    computedMin = Math.max(0, computedMin - range * 0.05);
  }

  // Coordinates helper
  const paddingLeft = 46;
  const paddingRight = 16;
  const paddingTop = 14;
  const paddingBottom = 26;
  const chartWidth = 720;
  const chartHeight = height;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const getX = (index: number) => {
    if (data.length <= 1) return paddingLeft;
    return paddingLeft + (index / (data.length - 1)) * innerWidth;
  };

  const getY = (val: number) => {
    const clamped = Math.max(computedMin, Math.min(computedMax, val));
    const ratio = (clamped - computedMin) / (computedMax - computedMin);
    return paddingTop + innerHeight - ratio * innerHeight;
  };

  // Build SVG Paths
  const paths = series.map((s) => {
    const points = data.map((d, i) => ({
      x: getX(i),
      y: getY(Number(d[s.dataKey] ?? 0))
    }));

    if (points.length === 0) return { id: s.id, linePath: '', areaPath: '', color: s.color };

    // Build smooth cubic bezier or connected lines
    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpX1 = prev.x + (curr.x - prev.x) / 2;
      const cpY1 = prev.y;
      const cpX2 = prev.x + (curr.x - prev.x) / 2;
      const cpY2 = curr.y;
      linePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${curr.x} ${curr.y}`;
    }

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const baselineY = paddingTop + innerHeight;
    const areaPath = `${linePath} L ${lastPoint.x} ${baselineY} L ${firstPoint.x} ${baselineY} Z`;

    return { id: s.id, linePath, areaPath, color: s.color, fillOpacity: s.fillOpacity ?? 0.18 };
  });

  // Calculate 4 horizontal grid guidelines
  const gridSteps = 4;
  const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const val = computedMin + (computedMax - computedMin) * (i / gridSteps);
    const y = getY(val);
    return { val, y };
  });

  // Mouse hover event handler
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svgRect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - svgRect.left;
    const scale = chartWidth / svgRect.width;
    const xInViewbox = clientX * scale;

    const relX = (xInViewbox - paddingLeft) / innerWidth;
    const index = Math.round(relX * (data.length - 1));
    if (index >= 0 && index < data.length) {
      setHoverIndex(index);
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const activePoint = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div ref={containerRef} className="relative w-full select-none">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto overflow-visible cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          {series.map((s) => (
            <linearGradient key={`grad-${s.id}`} id={`grad-${s.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={s.fillOpacity ?? 0.35} />
              <stop offset="90%" stopColor={s.color} stopOpacity="0.0" />
            </linearGradient>
          ))}
        </defs>

        {/* Horizontal grid lines */}
        {gridLines.map((gl, i) => (
          <g key={`grid-${i}`}>
            <line
              x1={paddingLeft}
              y1={gl.y}
              x2={chartWidth - paddingRight}
              y2={gl.y}
              stroke="rgba(255, 255, 255, 0.07)"
              strokeDasharray={i === 0 || i === gridSteps ? 'none' : '3 3'}
              strokeWidth="1"
            />
            <text
              x={paddingLeft - 8}
              y={gl.y + 3}
              textAnchor="end"
              className="text-[10px] fill-slate-400 font-mono"
            >
              {valueFormatter(Math.round(gl.val))}
            </text>
          </g>
        ))}

        {/* Areas */}
        {paths.map((p) => (
          <path
            key={`area-${p.id}`}
            d={p.areaPath}
            fill={`url(#grad-${p.id})`}
            className="transition-all duration-300"
          />
        ))}

        {/* Lines */}
        {paths.map((p) => (
          <path
            key={`line-${p.id}`}
            d={p.linePath}
            fill="none"
            stroke={p.color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-all duration-300"
          />
        ))}

        {/* Time X labels */}
        {data.length > 0 && (
          <>
            <text
              x={paddingLeft}
              y={chartHeight - 6}
              textAnchor="start"
              className="text-[10px] fill-slate-400 font-mono"
            >
              {String(data[0][timeKey])}
            </text>
            <text
              x={paddingLeft + innerWidth / 2}
              y={chartHeight - 6}
              textAnchor="middle"
              className="text-[10px] fill-slate-400 font-mono"
            >
              {String(data[Math.floor(data.length / 2)][timeKey])}
            </text>
            <text
              x={chartWidth - paddingRight}
              y={chartHeight - 6}
              textAnchor="end"
              className="text-[10px] fill-slate-400 font-mono"
            >
              {String(data[data.length - 1][timeKey])}
            </text>
          </>
        )}

        {/* Scrubber vertical line & indicator dots */}
        {hoverIndex !== null && activePoint && (
          <g>
            <line
              x1={getX(hoverIndex)}
              y1={paddingTop}
              x2={getX(hoverIndex)}
              y2={paddingTop + innerHeight}
              stroke="rgba(255, 255, 255, 0.4)"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
            {series.map((s) => {
              const val = Number(activePoint[s.dataKey] ?? 0);
              const cy = getY(val);
              return (
                <circle
                  key={`dot-${s.id}`}
                  cx={getX(hoverIndex)}
                  cy={cy}
                  r="4"
                  fill="#0b0f17"
                  stroke={s.color}
                  strokeWidth="2.5"
                />
              );
            })}
          </g>
        )}
      </svg>

      {/* Floating Hover Tooltip */}
      {hoverIndex !== null && activePoint && (
        <div
          className="absolute pointer-events-none top-2 z-20 px-2.5 py-1.5 rounded-lg border border-slate-700/80 bg-slate-900/95 backdrop-blur-md shadow-xl text-xs space-y-1"
          style={{
            left: `${Math.min(80, Math.max(15, (getX(hoverIndex) / chartWidth) * 100))}%`,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="font-mono text-[11px] text-slate-300 border-b border-slate-800 pb-0.5">
            {String(activePoint[timeKey])}
          </div>
          <div className="space-y-0.5 font-mono">
            {series.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 text-[11px]">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: s.color }} />
                  {s.name}
                </span>
                <span className="font-semibold text-slate-100">
                  {valueFormatter(Number(activePoint[s.dataKey] ?? 0), s.id)}
                  {s.unit ? ` ${s.unit}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
