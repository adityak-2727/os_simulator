import { useEffect, useState } from 'react';
import { useLab } from './LabContext';
import { PreviewLab } from '../features/foundation/PreviewLab';
import { Button, Icon } from '../components/Primitives';

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
  const current = routes.find((item) => item.id === route);
  useEffect(() => {
    const navigate = () => {
      setRoute(getRoute());
      setMenuOpen(false);
      dispatch({ type: 'replay', action: { type: 'pause' } });
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, [dispatch]);
  useEffect(() => {
    document.title = `${current?.label ?? 'Page unavailable'} · OS Lab Simulator`;
  }, [current]);
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
              {item.id !== 'cpu' && item.id !== 'help' && (
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
          <span className="phase-tag">PHASE 01</span>
          <p>Foundation & replay</p>
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
              <strong>{current?.label ?? 'Page unavailable'}</strong>
            </span>
          </div>
          <span className="topbar-note">Browser-based · no server</span>
        </header>
        <main id="main-content" tabIndex={-1}>
          {route === 'cpu' ? (
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
          Phase 1 provides the application shell and deterministic replay
          preview. Algorithm implementations and experiment storage will be
          added in their specified phases.
        </p>
        <a className="button primary" href="#/cpu">
          Open replay preview
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
          <p>Choose a lab. Current build: Phase 1 foundation.</p>
        </div>
      </div>
      <section className="panel overview">
        <h2>Start with the replay preview</h2>
        <p>
          Inspect the scripted two-process trace, select an event, and compare
          its queue, running slot, and timeline.
        </p>
        <a href="#/cpu" className="button primary">
          Open replay preview
        </a>
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
                    ? 'Fixture only · algorithm in Phase 2'
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
        <h2>Using the Phase 1 preview</h2>
        <ol>
          <li>Use the example, or edit a duration from 1 to 20 time units.</li>
          <li>
            Run creates the scripted trace and starts playback. Pause holds the
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
          The fixture is scripted P1 then P2. It does not implement FCFS, SJF,
          Priority, or Round Robin. Saving, JSON transfer, and comparisons
          belong to later phases. The app does not inspect your operating system
          or execute submitted code.
        </p>
      </article>
    </>
  );
}
