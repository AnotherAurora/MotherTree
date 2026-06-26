type RadarAxis = {
  label: string;
  value: number;
};

type RadarChartPlaceholderProps = {
  axes: readonly RadarAxis[];
};

export function RadarChartPlaceholder({ axes }: RadarChartPlaceholderProps) {
  const size = 200;
  const center = size / 2;
  const maxRadius = center - 28;
  const count = axes.length;
  const angleStep = (2 * Math.PI) / count;

  function roundCoord(n: number) {
    return Math.round(n * 1000) / 1000;
  }

  function pointAt(index: number, radius: number) {
    const angle = index * angleStep - Math.PI / 2;
    return {
      x: roundCoord(center + radius * Math.cos(angle)),
      y: roundCoord(center + radius * Math.sin(angle)),
    };
  }

  const gridLevels = [0.25, 0.5, 0.75, 1];

  const dataPoints = axes.map((axis, index) => {
    const radius = (axis.value / 100) * maxRadius;
    return pointAt(index, radius);
  });

  const polygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="flex items-center justify-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-full w-full max-h-[200px] max-w-[200px]"
        aria-label="Radar chart placeholder"
      >
        {gridLevels.map((level) => {
          const points = Array.from({ length: count }, (_, i) => {
            const p = pointAt(i, maxRadius * level);
            return `${p.x},${p.y}`;
          }).join(" ");
          return (
            <polygon
              key={level}
              points={points}
              fill="none"
              stroke="#e4e4e7"
              strokeWidth="1"
            />
          );
        })}

        {axes.map((axis, index) => {
          const outer = pointAt(index, maxRadius);
          const label = pointAt(index, maxRadius + 18);
          return (
            <g key={axis.label}>
              <line
                x1={center}
                y1={center}
                x2={outer.x}
                y2={outer.y}
                stroke="#e4e4e7"
                strokeWidth="1"
              />
              <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-zinc-500 text-[8px]"
              >
                {axis.label}
              </text>
            </g>
          );
        })}

        <polygon
          points={polygonPoints}
          fill="rgba(24, 24, 27, 0.15)"
          stroke="#18181b"
          strokeWidth="1.5"
        />

        {dataPoints.map((p, index) => (
          <circle
            key={axes[index].label}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="#18181b"
          />
        ))}
      </svg>
    </div>
  );
}
