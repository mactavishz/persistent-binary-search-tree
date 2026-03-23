import type { JSX } from "react";

interface ControlsProps {
  readonly demo: "planar_1.obj" | "planar_2.obj" | "planar_3.obj";
  readonly canStart: boolean;
  readonly canClear: boolean;
  readonly onDemoChange: (demo: "planar_1.obj" | "planar_2.obj" | "planar_3.obj") => void;
  readonly onStart: () => void;
  readonly onClearPoints: () => void;
}

export function Controls({
  demo,
  canStart,
  canClear,
  onDemoChange,
  onStart,
  onClearPoints
}: ControlsProps): JSX.Element {
  return (
    <section className="controls-panel">
      <label>
        Presets
        <select
          value={demo}
          onChange={(event) => onDemoChange(event.target.value as "planar_1.obj" | "planar_2.obj" | "planar_3.obj")}
        >
          <option value="planar_1.obj">planar_1.obj</option>
          <option value="planar_2.obj">planar_2.obj</option>
          <option value="planar_3.obj">planar_3.obj</option>
        </select>
      </label>

      <button type="button" onClick={onStart} disabled={!canStart}>
        Start
      </button>

      <button type="button" onClick={onClearPoints} disabled={!canClear}>
        Clear Points
      </button>
    </section>
  );
}
