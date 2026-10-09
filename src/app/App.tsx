import { useEffect, useState } from 'react';
import { useLab } from './LabContext';
import { PreviewLab } from '../features/foundation/PreviewLab';
import { Button, Icon } from '../components/Primitives';
import { CpuLab } from '../features/cpu/CpuLab';
import { useCpu } from '../features/cpu/CpuContext';
import { useMemory } from '../features/memory/MemoryContext';
import { AllocationLab } from '../features/memory/AllocationLab';
import { PagingLab } from '../features/memory/PagingLab';

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
  const current = routes.find((item) => item.id === route);
  useEffect(() => {
    const navigate = () => {
      setRoute(getRoute());
      setMenuOpen(false);
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
  }, [dispatch, cpuDispatch, memoryDispatch]);
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
              {!['cpu', 'allocation', 'paging', 'help'].includes(item.id) && (
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
          <p>CPU & memory laboratories</p>
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
          {route === 'cpu' ? (
            <CpuLab />
          ) : route === 'allocation' ? (
            <AllocationLab />
          ) : route === 'paging' ? (
            <PagingLab />
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
          CPU scheduling, memory allocation, and page replacement are available
          with replay. Other algorithms and experiment storage will be added in
          their specified phases.
        </p>
        <a className="button primary" href="#/cpu">
          Open CPU scheduling
        </a>
      </section>
    </>
  );
}

function Dashboard() {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LABORATORY / AVAILABILITY</div>
          <h1>Dashboard</h1>
          <p>Choose a lab and inspect its computed execution trace.</p>
        </div>
      </div>
      <section className="panel overview">
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
                      : `Unavailable · Phase ${item.phase}`}
                </span>
              </a>
            ))}
        </div>
        <p className="subtle small">
          Integrated-run summaries and saved experiments arrive in Phase 7.
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
          non-preemptive; smaller priority numbers win. Saving and JSON transfer
          belong to later phases. The app does not inspect your operating system
          or execute submitted code.
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
        <h2>Replay infrastructure example</h2>
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
