import { Button, Status } from '../../components/Primitives';
import type { ReplayAction } from '../../app/replay';
import { ReplayControls, FrameCursor } from '../memory/ReplayControls';
import { MemoryEmpty, MemoryInspector } from '../memory/MemoryShared';
import { useSync } from './SyncContext';
import { parseSync } from './edit';
import { instructionText } from './presets';
import { SyncEditor } from './SyncEditor';
import { SyncView } from './SyncView';
export function SyncLab() {
  const { state, dispatch } = useSync(),
    { result, replay } = state,
    parsed = parseSync(state.draft),
    frame = result?.frames[replay.cursor],
    s = frame?.snapshot,
    event = frame?.event;
  const act = (action: ReplayAction) => dispatch({ type: 'replay', action });
  const status = !parsed.ok
    ? 'Invalid'
    : state.error
      ? 'Invalid choice'
      : replay.playing
        ? 'Running'
        : s?.status === 'completed'
          ? 'Completed'
          : s?.status === 'model-error'
            ? 'Model error'
            : s?.status === 'stalled'
              ? 'Stalled'
              : result && replay.cursor === result.events.length
                ? 'Awaiting choice'
                : replay.cursor
                  ? 'Paused'
                  : 'Ready';
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LABORATORY / SYNCHRONIZATION</div>
          <h1>Synchronization & interleavings</h1>
          <p>
            Choose atomic instructions and inspect shared data, ownership, and
            FIFO handoffs.
          </p>
        </div>
        <Status label={status} />
      </div>
      {state.error && (
        <div className="cpu-error" role="alert">
          {state.error.message}
        </div>
      )}
      <div className="workbench sync-workbench">
        <SyncEditor />
        <section
          className="panel canvas-panel"
          aria-label="Synchronization replay workspace"
        >
          <ReplayControls
            replay={replay}
            frameCount={result?.frames.length ?? 0}
            valid={parsed.ok}
            run={() =>
              dispatch(
                replay.playing
                  ? { type: 'replay', action: { type: 'pause' } }
                  : { type: 'run' },
              )
            }
            act={act}
          />
          <div className="canvas-body">
            {state.mode === 'manual' && (
              <div className="sync-choice-box">
                <h2>Choose the next process</h2>
                <p className="subtle small">
                  A runnable process executes one instruction. Matching the next
                  recorded choice steps through it; choosing differently after
                  rewind requires an explicit branch.
                </p>
                <div className="flex flex-wrap gap-2">
                  {state.draft.processes.map((p) => {
                    const current = s?.processes.find((x) => x.id === p.id);
                    return (
                      <Button
                        key={p.id}
                        disabled={
                          !parsed.ok ||
                          current?.state === 'blocked' ||
                          current?.state === 'completed' ||
                          s?.status === 'model-error'
                        }
                        title={
                          current?.waiting
                            ? `Blocked on ${current.waiting.kind} ${current.waiting.id}`
                            : current?.state === 'completed'
                              ? 'Program completed'
                              : 'Execute one model instruction'
                        }
                        onClick={() =>
                          dispatch({ type: 'choice', processId: p.id })
                        }
                      >
                        Step {p.id}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}
            {state.pendingBranch && (
              <div className="sync-branch" role="status">
                <h3>Branch from step {state.pendingBranch.cursor}</h3>
                <p>
                  Selecting {state.pendingBranch.processId} discards{' '}
                  {state.pendingBranch.discarded} future choices. The earlier
                  history stays intact.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    primary
                    onClick={() => dispatch({ type: 'confirm-branch' })}
                  >
                    Branch and step {state.pendingBranch.processId}
                  </Button>
                  <Button onClick={() => dispatch({ type: 'cancel-branch' })}>
                    Cancel branch
                  </Button>
                </div>
              </div>
            )}
            {state.notice && (
              <p className="sync-notice" role="status">
                {state.notice}
              </p>
            )}
            {result && s ? (
              <>
                <SyncView result={result} snapshot={s} />
                <FrameCursor
                  replay={replay}
                  frameCount={result.frames.length}
                  act={act}
                />
                <p className="subtle small">
                  Recorded choices: {result.scenario.schedule.length}. Reached
                  step {s.step}.{' '}
                  {s.status === 'awaiting-choice' &&
                  replay.cursor === result.events.length
                    ? state.mode === 'manual'
                      ? 'Schedule exhausted. Choose a runnable process to continue; this is not completion.'
                      : 'Schedule exhausted. Select Manual choices to continue; this is not completion.'
                    : ''}
                </p>
              </>
            ) : (
              <MemoryEmpty
                valid={parsed.ok}
                changed={state.changed}
                empty={
                  !state.draft.processes.length ||
                  state.draft.processes.some((p) => !p.code.trim())
                }
              />
            )}
          </div>
        </section>
        <MemoryInspector
          title={
            event
              ? `${event.processId}: ${event.instruction && event.kind !== 'selection-rejected' ? instructionText(event.instruction) : 'choice rejected'}`
              : result
                ? 'Initial frame'
                : 'No active result'
          }
          reason={
            event?.reason ??
            (result
              ? 'Every selected process executes one atomic model instruction. Shared reads, local updates, and shared writes are separate transitions. Run follows the supplied schedule; manual choices can extend or explicitly branch it.'
              : 'Inputs changed. Run again to update results.')
          }
          events={
            result?.events.map((e) => ({
              title: `${e.processId} · ${e.kind === 'selection-rejected' ? 'rejected choice' : (e.instruction?.op ?? e.kind)}`,
              step: e.seq + 1,
            })) ?? []
          }
          cursor={replay.cursor}
          select={(cursor) => act({ type: 'seek', cursor })}
        >
          {event && (
            <dl className="detail-list">
              <div>
                <dt>Selected PC</dt>
                <dd className="mono">
                  {event.pcBefore} → {event.pcAfter}
                </dd>
              </div>
              <div>
                <dt>Shared x</dt>
                <dd className="mono">
                  {event.counterBefore} → {event.counterAfter}
                </dd>
              </div>
              <div>
                <dt>Handoff recipients</dt>
                <dd>{event.woken.join(', ') || 'None'}</dd>
              </div>
              {event.readCounter !== null && (
                <div>
                  <dt>Source read x</dt>
                  <dd className="mono">
                    {event.readCounter}
                    {event.interveningWrite
                      ? ' · stale'
                      : ' · no intervening write'}
                  </dd>
                </div>
              )}
            </dl>
          )}
          <div className="rule-box">
            <h3>What to observe</h3>
            <p>
              {state.draft.preset === 'counter-race'
                ? 'Two processes can read the same x before either writes. Follow both local registers to see why the last write loses an update.'
                : state.draft.preset === 'counter-mutex'
                  ? 'A blocked lock leaves PC unchanged. Owner unlock hands the mutex to the first waiter and completes its pending lock once.'
                  : 'Wait reserves a permit before the buffer changes. Signal hands a permit directly to the first waiter. Follow reservations until the complementary signal.'}
            </p>
          </div>
          <details className="sync-exercise">
            <summary>Guided exercise</summary>
            <p className="small">
              {state.draft.preset === 'counter-race'
                ? 'Rewind to step 1, choose P1 again, and confirm the branch. Finish P1 before P2 reads. Compare the shared counter with the original alternating schedule.'
                : state.draft.preset === 'counter-mutex'
                  ? 'Inspect step 2, then the owner’s unlock. Confirm that the waiting process moves from PC 0 to PC 1 without executing lock a second time.'
                  : 'Start an empty manual schedule. Select Consumer first, then let Producer signal full. Inspect the direct permit handoff before Consumer dequeues A.'}
            </p>
          </details>
          <div className="rule-box">
            <h3>Model boundaries</h3>
            <p>
              Deterministic instruction interleaving, not an actual JavaScript
              data race or CPU scheduler. PCs and steps are not time. Locks have
              owners; counting semaphores do not. Stalled is distinct from
              proven deadlock.
            </p>
          </div>
        </MemoryInspector>
      </div>
      <footer className="page-footer">
        <span>Browser simulation · deterministic instruction engine</span>
        <span>Engine v0.5.0</span>
      </footer>
    </>
  );
}
