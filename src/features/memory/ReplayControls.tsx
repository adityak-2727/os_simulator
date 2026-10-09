import type { ReplayAction, ReplayState } from '../../app/replay';
import { Button, Icon } from '../../components/Primitives';
export function ReplayControls({
  replay,
  frameCount,
  valid,
  run,
  act,
}: {
  replay: ReplayState;
  frameCount: number;
  valid: boolean;
  run: () => void;
  act: (action: ReplayAction) => void;
}) {
  const last = Math.max(0, frameCount - 1),
    final = frameCount > 1 && replay.cursor === last;
  return (
    <div className="playback-toolbar memory-playback">
      <div className="flex flex-wrap items-center gap-2">
        <Button primary disabled={!valid} onClick={run}>
          <Icon name={replay.playing ? 'pause' : 'play'} />
          {replay.playing ? 'Pause' : final ? 'Replay' : 'Run'}
        </Button>
        <Button
          disabled={!frameCount || replay.cursor === 0}
          aria-label="Previous event"
          onClick={() => act({ type: 'previous' })}
        >
          <Icon name="previous" />
          Prev
        </Button>
        <Button
          disabled={!frameCount || final}
          aria-label="Next event"
          onClick={() => act({ type: 'next' })}
        >
          <Icon name="next" />
          Next
        </Button>
        <Button disabled={!frameCount} onClick={() => act({ type: 'reset' })}>
          <Icon name="reset" />
          Reset
        </Button>
      </div>
      <label className="speed-control">
        Speed
        <select
          aria-label="Speed"
          value={replay.speed}
          onChange={(e) => {
            const speed = Number(e.target.value);
            if (speed === 0.5 || speed === 1 || speed === 2 || speed === 4)
              act({ type: 'speed', speed });
          }}
        >
          {[0.5, 1, 2, 4].map((s) => (
            <option value={s} key={s}>
              {s}×
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
export function FrameCursor({
  replay,
  frameCount,
  act,
}: {
  replay: ReplayState;
  frameCount: number;
  act: (action: ReplayAction) => void;
}) {
  return (
    <div className="cursor-control">
      <label htmlFor="memory-frame">
        Replay frame{' '}
        <span className="mono">
          {replay.cursor} / {frameCount - 1}
        </span>
      </label>
      <input
        id="memory-frame"
        type="range"
        min={0}
        max={frameCount - 1}
        step={1}
        value={replay.cursor}
        aria-valuetext={`Step ${replay.cursor}`}
        onChange={(e) => act({ type: 'seek', cursor: Number(e.target.value) })}
      />
    </div>
  );
}
