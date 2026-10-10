import { useEffect, useState } from 'react';
import { useLab } from './LabContext';
import { PreviewLab } from '../features/foundation/PreviewLab';
import { Button, Icon } from '../components/Primitives';
import { CpuLab } from '../features/cpu/CpuLab';
import { useCpu } from '../features/cpu/CpuContext';
import { useMemory } from '../features/memory/MemoryContext';
import { AllocationLab } from '../features/memory/AllocationLab';
import { PagingLab } from '../features/memory/PagingLab';
import { DeadlockLab } from '../features/deadlock/DeadlockLab';
import { useDeadlock } from '../features/deadlock/DeadlockContext';
import { SyncLab } from '../features/synchronization/SyncLab';
import { useSync } from '../features/synchronization/SyncContext';
import { DiskLab } from '../features/disk/DiskLab';
import { useDisk } from '../features/disk/DiskContext';
import { useSystem } from '../features/system/SystemContext';
import { SystemLab, SystemView } from '../features/system/SystemLab';
import { Experiments, ExperimentToolbar } from '../experiments/Experiments';
import { useExperiments } from '../experiments/ExperimentContext';

const routes = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', phase: 7 },
  { id: 'cpu', label: 'CPU scheduling', icon: 'cpu', phase: 2 },
  { id: 'allocation', label: 'Memory allocation', icon: 'memory', phase: 3 },
  { id: 'paging', label: 'Page replacement', icon: 'memory', phase: 3 },
  { id: 'deadlock', label: 'Deadlock', icon: 'deadlock', phase: 4 },
  {
    id: 'synchronization',
    label: 'Synchronization',
    icon: 'synchronization',
    phase: 5,
  },
  { id: 'disk', label: 'Disk scheduling', icon: 'disk', phase: 6 },
  { id: 'system', label: 'Integrated system', icon: 'system', phase: 7 },
  { id: 'experiments', label: 'Experiments', icon: 'experiments', phase: 7 },
  { id: 'help', label: 'Help', icon: 'help', phase: 1 },
] as const;

function getRoute() {
  return window.location.hash.replace(/^#\/?/, '') || 'cpu';
}

export function App() {
  const [route, setRoute] = useState(getRoute);
  const [menuOpen, setMenuOpen] = useState(false);
  const { dispatch } = useLab();
  const { dispatch: cpuDispatch } = useCpu();
  const { dispatch: memoryDispatch } = useMemory();
  const { dispatch: deadlockDispatch } = useDeadlock();
  const { dispatch: syncDispatch } = useSync();
  const { dispatch: diskDispatch } = useDisk();
  const { dispatch: systemDispatch } = useSystem();
  const current = routes.find((item) => item.id === route);
  useEffect(() => {
    const navigate = () => {
      setRoute(getRoute());
      setMenuOpen(false);
      deadlockDispatch({ type: 'pause-all' });
      syncDispatch({ type: 'replay', action: { type: 'pause' } });
      diskDispatch({ type: 'replay', action: { type: 'pause' } });
      systemDispatch({ type: 'replay', action: { type: 'pause' } });
      dispatch({ type: 'replay', action: { type: 'pause' } });
      cpuDispatch({ type: 'replay', action: { type: 'pause' } });
      memoryDispatch({
        type: 'replay',
        lab: 'allocation',
        action: { type: 'pause' },
      });
      memoryDispatch({
        type: 'replay',
        lab: 'paging',
        action: { type: 'pause' },
      });
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, [
    dispatch,
    cpuDispatch,
    memoryDispatch,
    deadlockDispatch,
    syncDispatch,
    diskDispatch,
    systemDispatch,
  ]);
  useEffect(() => {
    document.title = `${current?.label ?? (route === 'replay-preview' ? 'Replay preview' : 'Page unavailable')} · OS Lab Simulator`;
  }, [current, route]);
  return (
    <div className="app-shell">
      <a
        href="#main-content"
        className="skip-link"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to workspace
      </a>
      <aside className={`nav-rail ${menuOpen ? 'is-open' : ''}`}>
        <a className="brand" href="#/cpu">
          <span className="brand-symbol">
            <Icon name="cpu" />
          </span>
          <span>
            <strong>OS LAB</strong>
            <small>SIMULATOR</small>
          </span>
        </a>
        <div className="nav-label">LABORATORY</div>
        <nav id="lab-navigation" aria-label="Laboratory navigation">
          {routes.map((item) => (
            <a
              href={`#/${item.id}`}
              key={item.id}
              aria-current={route === item.id ? 'page' : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {![
                'cpu',
                'allocation',
                'paging',
                'deadlock',
                'synchronization',
                'disk',
                'help',
                'system',
                'experiments',
                'dashboard',
              ].includes(item.id) && (
                <span
                  className="nav-phase"
                  aria-label={`Available in phase ${item.phase}`}
                >
                  {item.phase}
                </span>
              )}
            </a>
          ))}
        </nav>
        <div className="rail-footer">
          <span className="phase-tag">LOCAL LAB</span>
          <p>CPU, memory & concurrency labs</p>
          <span className="subtle small">
            Local browser simulation
            <br />
            Your inputs stay on this device
          </span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <Button
              className="menu-toggle"
              aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
              aria-expanded={menuOpen}
              aria-controls="lab-navigation"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Icon name="menu" />
            </Button>
            <span>
              Laboratory <span className="breadcrumb-slash">/</span>{' '}
              <strong>
                {current?.label ??
                  (route === 'replay-preview'
                    ? 'Replay preview'
                    : 'Page unavailable')}
              </strong>
            </span>
          </div>
          <span className="topbar-note">Browser-based · no server</span>
        </header>
        <main id="main-content" tabIndex={-1}>
          <ExperimentToolbar key={route} route={route} />
          {route === 'cpu' ? (
            <CpuLab />
          ) : route === 'allocation' ? (
            <AllocationLab />
          ) : route === 'paging' ? (
            <PagingLab />
          ) : route === 'deadlock' ? (
            <DeadlockLab />
          ) : route === 'synchronization' ? (
            <SyncLab />
          ) : route === 'disk' ? (
            <DiskLab />
          ) : route === 'system' ? (
            <SystemLab />
          ) : route === 'experiments' ? (
            <Experiments />
          ) : route === 'replay-preview' ? (
            <PreviewLab />
          ) : route === 'help' ? (
            <Help />
          ) : route === 'dashboard' ? (
            <Dashboard />
          ) : (
            <Unavailable
              label={current?.label ?? 'Page unavailable'}
              phase={current?.phase}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function Unavailable({
  label,
  phase,
}: {
  label: string;
  phase: number | undefined;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LABORATORY</div>
          <h1>{label}</h1>
          <p>
            {phase
              ? `Scheduled for Phase ${phase}.`
              : 'This route does not exist.'}
          </p>
        </div>
        <span className="scope-label">Unavailable</span>
      </div>
      <section className="panel unavailable">
        <Icon name="experiments" />
        <h2>
          {phase
            ? 'This lab is not implemented yet'
            : 'Choose a lab from the navigation'}
        </h2>
        <p>
          CPU scheduling, memory allocation, page replacement, resource safety,
          synchronization, and disk scheduling are available with replay.
          Integrated runs and saved experiments are also available.
        </p>
        <a className="button primary" href="#/cpu">
          Open CPU scheduling
        </a>
      </section>
    </>
  );
}

function Dashboard() {
  const { state } = useSystem(),
    { items } = useExperiments();
  const frame = state.result?.frames[state.replay.cursor];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LABORATORY / AVAILABILITY</div>
          <h1>Dashboard</h1>
          <p>Launch a lab or continue the selected integrated run.</p>
        </div>
      </div>
      <section className="panel overview">
        <h2>Active integrated run</h2>
        <p>
          {state.draft.name} · frame {state.replay.cursor}
        </p>
        <a href="#/system" className="button primary">
          Continue run
        </a>
        {state.result && frame ? (
          <SystemView result={state.result} snapshot={frame.snapshot} />
        ) : (
          <p>Inputs changed. Open the integrated lab and run again.</p>
        )}
        <div className="section-divider" />
        <h2>Saved experiments</h2>
        <p>
          {items.length
            ? items
                .slice(0, 5)
                .map((e) => e.name)
                .join(' · ')
            : 'No saved experiments yet.'}
        </p>
        <a href="#/experiments" className="button">
          Manage experiments
        </a>
        <div className="section-divider" />
        <h2>Start with CPU scheduling</h2>
        <p>
          Run FCFS, non-preemptive SJF, non-preemptive Priority, or Round Robin.
          Inspect each decision and compare algorithms on the same workload.
        </p>
        <a href="#/cpu" className="button primary">
          Open CPU scheduling
        </a>
        <div className="section-divider" />
        <h2>Explore memory</h2>
        <p>
          Compare First Fit, Best Fit, and Worst Fit allocations, or inspect
          FIFO, LRU, and Optimal page replacement.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="#/allocation" className="button">
            Open memory allocation
          </a>
          <a href="#/paging" className="button">
            Open page replacement
          </a>
        </div>
        <div className="section-divider" />
        <h2>Module availability</h2>
        <div className="availability-list">
          {routes
            .filter((item) => item.id !== 'dashboard' && item.id !== 'help')
            .map((item) => (
              <a key={item.id} href={`#/${item.id}`}>
                <span>
                  <Icon name={item.icon} />
                  {item.label}
                </span>
                <span className="subtle">
                  {item.id === 'cpu'
                    ? 'Available · four algorithms'
                    : item.id === 'allocation' || item.id === 'paging'
                      ? 'Available · three algorithms'
                      : item.id === 'deadlock'
                        ? 'Available · graphs & Banker'
                        : item.id === 'synchronization'
                          ? 'Available · instruction interleavings'
                          : item.id === 'disk'
                            ? 'Available · four disk algorithms'
                            : item.id === 'system'
                              ? 'Available · CPU, memory & resources'
                              : 'Available · local saving & JSON'}
                </span>
              </a>
            ))}
        </div>
        <p className="subtle small">
          Dashboard panels use one selected integrated frame. Paging and disk
          remain standalone labs.
        </p>
      </section>
    </>
  );
}

function Help() {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LABORATORY / GUIDE</div>
          <h1>Help & model notes</h1>
          <p>
            Read the trace as a sequence of decisions, not an animation clock.
          </p>
        </div>
      </div>
      <article className="panel help-content">
        <h2>Using the CPU lab</h2>
        <ol>
          <li>
            Load an example or edit the process IDs, arrivals, bursts, and
            priorities. Select an algorithm; only Round Robin uses a quantum.
          </li>
          <li>
            Run computes the schedule and starts playback. Pause holds the
            selected frame.
          </li>
          <li>
            Previous and Next move one event. Select any trace event to inspect
            it directly.
          </li>
          <li>
            Reset returns to the initial frame. Replay reuses the completed
            trace.
          </li>
          <li>
            Changing inputs stops playback and clears the result. Run again to
            use the new values.
          </li>
        </ol>
        <h2>Simulation time and playback speed</h2>
        <p>
          Simulation time (t) belongs to the trace. Playback speed controls how
          often the cursor advances. Two events can share a simulation time and
          still produce different frames.
        </p>
        <h2>Keyboard access</h2>
        <p>
          Tab moves through navigation, inputs, playback controls, scroll
          regions, and event selections. Enter or Space activates buttons.
          Focused scroll regions can be scrolled with arrow keys. On small
          screens, Open navigation reveals the same links.
        </p>
        <h2>Glossary</h2>
        <dl className="glossary">
          <div>
            <dt>Event</dt>
            <dd>An ordered, typed transition in the computed trace.</dd>
          </div>
          <div>
            <dt>Frame</dt>
            <dd>A snapshot after an event. Frame 0 is the initial state.</dd>
          </div>
          <div>
            <dt>Ready queue</dt>
            <dd>Ordered entries that are ready to use the running slot.</dd>
          </div>
          <div>
            <dt>Time unit (t)</dt>
            <dd>
              An abstract unit of modeled work, not host CPU time or
              milliseconds.
            </dd>
          </div>
        </dl>
        <h2>Build scope</h2>
        <p>
          The CPU lab models one CPU, integer time, one positive burst per
          process, no I/O, and zero context-switch cost. SJF and Priority are
          non-preemptive; smaller priority numbers win. Experiments save
          validated source scenarios locally and support JSON transfer. The app
          does not inspect your operating system or execute submitted code.
        </p>
        <h2>CPU metrics</h2>
        <p>
          CT is completion time. TAT = CT − arrival. WT = TAT − burst. RT =
          first start − arrival. Utilization = busy time / observation time ×
          100, including initial idle time. Throughput is completed processes
          per time unit.
        </p>
        <p>
          During replay, incomplete CT/TAT/WT values remain blank. Averages use
          completed processes only. The comparison workspace is explicitly
          labeled as final results.
        </p>
        <h2>Memory and paging model</h2>
        <p>
          Allocation uses exact integer KiB sizes and half-open address ranges.
          First Fit chooses the first fitting hole; Best Fit the smallest; Worst
          Fit the largest. Ties use lower addresses. Free coalesces both
          neighboring holes. Invalid live-ID operations and failed fits are
          visible steps that preserve memory.
        </p>
        <p>
          Paging uses empty frames and ordered page references. FIFO preserves
          insertion order on hits; LRU updates recency. Optimal knows future
          references and uses the lowest frame index for ties. Ratios use only
          processed references and remain unavailable at the initial frame.
          Allocation and paging step indices are not CPU time or milliseconds.
        </p>
        <h2>Resource safety model</h2>
        <p>
          Resource graphs model one reusable instance per resource. Request
          arrows go from process to resource; allocation arrows go from resource
          to owner. A directed cycle proves deadlock in this model. Use the
          configuration tables to request, cancel, grant, and release resources
          with the keyboard.
        </p>
        <p>
          Banker derives Available and Need from Total, Allocation, and Max.
          Safety simulates completion in Work without releasing actual
          allocations. It restarts at the first input row after each selection.
          Unsafe means no safe sequence, not proven deadlock. Requests commit
          only after a safe check; otherwise the exact original state remains.
          Continue from granted state explicitly adopts the committed allocation
          as the next source workload. Resource trace steps are ordered
          decisions, not simulated time.
        </p>
        <h2>Synchronization model</h2>
        <p>
          Synchronization executes a typed model instruction per process choice.
          Reads, local updates, and writes are separate, so interleavings can
          lose updates. Mutex unlock requires ownership and hands the mutex
          directly to the first waiter. Semaphore signal grants the first
          waiting permit without incrementing the count; the blocked wait
          completes once, not twice.
        </p>
        <p>
          Manual choices extend recorded schedules. After rewind, selecting a
          different process requires an explicit branch that discards future
          choices. An exhausted schedule awaits a choice; all programs finished
          means completed. No runnable unfinished process means stalled, without
          claiming a proven wait cycle. Buffer reservations show permits in
          flight; empty + full need not equal capacity between wait and signal.
          Buffer operations require mutex m ownership. This models interleavings
          rather than running real concurrent code.
        </p>
        <h2>Disk scheduling model</h2>
        <p>
          Disk requests form a static batch with unique IDs; duplicate cylinders
          are separate services. FCFS preserves input order. SSTF selects the
          closest cylinder, breaking ties by smaller cylinder then input order.
          SCAN and C-SCAN serve requests at the initial head first and sweep in
          the chosen direction. If opposite-side requests remain, they reach the
          physical endpoint before reversing or wrapping. C-SCAN counts wrap
          distance and performs no service during the wrap. Every algorithm
          stops at its last request. An already-reached endpoint decision adds
          zero distance. Charts use steps; metrics measure cylinders, not
          latency.
        </p>
        <h2>Integrated waiting and admission</h2>
        <p>
          Ready waiting is time eligible for CPU service. Memory waiting is time
          before first-fit admission. Resource waiting is time blocked on an
          owned resource while retaining memory. Completed turnaround equals CPU
          service plus these three waiting totals. Response begins at first
          positive CPU service, after any initial zero-time operations.
        </p>
        <p>
          Strict FIFO admission can cause head-of-line waiting: a smaller
          process cannot bypass an earlier waiter. Acquire and release take zero
          time. Release hands ownership to the resource FIFO head once. A
          directed single-instance wait cycle proves deadlock; stalled means no
          progress and requires an explanation.
        </p>
        <h2>Experiments and reproducibility</h2>
        <p>
          Save a named source from any lab. JSON stores inputs and engine
          version, never a trusted computed answer. Import validates before
          opening; opening replaces the target lab inputs after review. Storage
          failure preserves current work and offers JSON export. CSV results are
          explicitly final results; spreadsheet formula markers in text are
          escaped.
        </p>
        <h2>Learning exercises</h2>
        <p>
          CPU: predict how quantum changes response before comparing.
          Allocation: free neighboring blocks and inspect coalescing. Paging:
          find a hit that changes LRU but not FIFO ordering. Resources: contrast
          unsafe with a proven wait cycle. Synchronization: replay a lost
          update, then protect the counter. Disk: distinguish endpoint travel
          from request service. Integrated: raise reference memory from 96 to
          128 KiB and explain which waiting category changes.
        </p>
        <p>
          The original scripted fixture remains available for demonstrating the
          cursor without running a scheduling algorithm.
        </p>
        <a className="button" href="#/replay-preview">
          Open replay preview
        </a>
      </article>
    </>
  );
}
