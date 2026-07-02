import { cpToBarFraction, bandForCp } from '../lib/evaluation';

interface Props {
  /** Centipawns, white POV. */
  cp: number;
  height?: number;
}

/** Vertical evaluation bar (white advantage grows the light fill). */
export function EvalBar({ cp, height = 120 }: Props) {
  const whiteFrac = cpToBarFraction(cp);
  const band = bandForCp(cp);
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-3 rounded overflow-hidden bg-black flex flex-col-reverse border border-gray-700"
        style={{ height }}
        title={`${band.label} (${(cp / 100).toFixed(1)})`}
      >
        <div className="w-full bg-gray-100" style={{ height: `${whiteFrac * 100}%` }} />
      </div>
    </div>
  );
}
