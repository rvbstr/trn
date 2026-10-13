import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Dumbbell,
  Settings2,
  Sprout,
  X,
} from 'lucide-react';
import { AppContext } from './context';
import { readData, saveData } from './storage';
import { currentCycle, cycleWeek } from './engine';
import type { AppData } from './types';
import { Today } from './screens/Today';
import { Plan } from './screens/Plan';
import { Progress } from './screens/Progress';
import { Nutrition } from './screens/Nutrition';
import { Exercises } from './screens/Exercises';
import { Settings } from './screens/Settings';
import { Workout } from './screens/Workout';

const navigation = [
  { name: 'Today', icon: Activity },
  { name: 'Plan', icon: CalendarDays },
  { name: 'Progress', icon: Dumbbell },
  { name: 'Nutrition', icon: Sprout },
  { name: 'Exercises', icon: BookOpen },
  { name: 'Settings', icon: Settings2 },
];
export default function App() {
  const [loaded] = useState(readData);
  const [data, setData] = useState<AppData>(loaded.data);
  const [storageError, setStorageError] = useState<string | null>(loaded.error);
  const [canPersist, setCanPersist] = useState(!loaded.error);
  const [message, setMessage] = useState('');
  const [help, setHelp] = useState(false);
  const [dataEpoch, setDataEpoch] = useState(0);
  const update = useCallback(
    (fn: (data: AppData) => void) =>
      setData((old) => {
        const copy = structuredClone(old);
        fn(copy);
        return copy;
      }),
    [],
  );
  const replace = useCallback((next: AppData) => {
    setCanPersist(true);
    setStorageError(null);
    setData(next);
    setDataEpoch((n) => n + 1);
  }, []);
  const notify = useCallback((m: string) => setMessage(m), []);
  const go = useCallback(
    (tab: string) => {
      update((d) => {
        d.settings.tab = tab;
      });
      window.scrollTo({ top: 0, behavior: 'instant' });
    },
    [update],
  );
  useEffect(() => {
    if (!canPersist) return;
    try {
      saveData(data);
      setStorageError(null);
    } catch {
      setStorageError(
        'Storage is unavailable or full. Changes remain in this tab only. Export your data now.',
      );
    }
  }, [data, canPersist]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(''), 5000);
    return () => clearTimeout(t);
  }, [message]);
  const cycle = currentCycle(data);
  const tab = data.settings.tab;
  const [workoutOpen, setWorkoutOpen] = useState(!!data.draft);
  useEffect(() => {
    if (data.draft) setWorkoutOpen(true);
  }, [data.draft?.id]);
  return (
    <AppContext.Provider
      value={{
        data,
        update,
        replace,
        notify,
        go,
        resumeWorkout: () => setWorkoutOpen(true),
        storageError,
      }}
    >
      <div className="app-shell">
        <aside className="sidebar">
          <button className="brand" onClick={() => go('Today')} aria-label="TRN home">
            trn<span className="brand-dot">.</span>
          </button>
          <span className="brand-sub">THE TRAINING NOTEBOOK</span>
          <nav aria-label="Main navigation">
            {navigation.map(({ name, icon: Icon }) => (
              <button
                key={name}
                className={tab === name ? 'nav-item active' : 'nav-item'}
                onClick={() => go(name)}
              >
                <Icon size={19} strokeWidth={1.5} />
                <span>{name}</span>
                {tab === name && <ChevronRight size={14} />}
              </button>
            ))}
          </nav>
          <div className="sidebar-cycle">
            <span className="eyebrow">YOUR CURRENT CHAPTER</span>
            <strong>{cycle.name}</strong>
            <span>
              Week {Math.min(cycleWeek(cycle), cycle.weeks)} of {cycle.weeks}
            </span>
            <div className="thin-progress">
              <i style={{ width: `${Math.min(100, (cycleWeek(cycle) / cycle.weeks) * 100)}%` }} />
            </div>
            <button onClick={() => go('Plan')}>
              Manage cycle <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="sidebar-help" onClick={() => setHelp(!help)}>
            <CircleHelp size={17} /> A note on your training
          </button>
          <span className="sidebar-foot">Your data stays on this device.</span>
        </aside>
        <main className="main">
          <div className="topbar">
            <span>Your personal practice</span>
            <span className="profile-chip">
              {data.profile.weight} <small>kg</small>
              <span className="chip-divider" />
              {data.preferences.frequency} <small>sessions / week</small>
            </span>
          </div>
          {storageError && (
            <div className="warning" role="alert">
              {storageError}
              <button onClick={() => go('Settings')}>Open Data settings</button>
            </div>
          )}
          {help && (
            <div className="note">
              <button
                className="icon-button"
                aria-label="Close training note"
                onClick={() => setHelp(false)}
              >
                <X size={16} />
              </button>
              <strong>A practice, not a deadline.</strong>
              <p>
                Follow A → B → C at your pace. Leave clean reps in reserve. RIR 2 means about two
                more clean reps were possible. Abdominal definition also depends on nutrition and
                body-fat level. Posture reflects movement, strength, mobility, and habits; no single
                exercise fixes it.
              </p>
              <p>
                General fitness guidance, not medical treatment. Stop for sharp or joint pain. Stop
                pelvic or back work for radiating pain, numbness, tingling, or persistent back pain
                and seek appropriate professional assessment.
              </p>
            </div>
          )}
          <div className="content" key={dataEpoch}>
            {tab === 'Today' ? (
              <Today />
            ) : tab === 'Plan' ? (
              <Plan />
            ) : tab === 'Progress' ? (
              <Progress />
            ) : tab === 'Nutrition' ? (
              <Nutrition />
            ) : tab === 'Exercises' ? (
              <Exercises />
            ) : (
              <Settings />
            )}
          </div>
          <footer className="page-footer">
            <span>TRN / A personal training notebook</span>
            <span>
              {storageError ? 'Export to keep your changes' : 'Saved on this device'}{' '}
              <Check size={12} />
            </span>
          </footer>
        </main>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navigation.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={tab === name ? 'active' : ''}
              onClick={() => go(name)}
              aria-label={name}
            >
              <Icon size={20} strokeWidth={1.6} />
              <span>{name}</span>
            </button>
          ))}
        </nav>
      </div>
      {data.draft && !workoutOpen && (
        <button className="resume-pill" onClick={() => setWorkoutOpen(true)}>
          Resume workout <ChevronRight size={16} />
        </button>
      )}
      {data.draft && workoutOpen && <Workout onMinimize={() => setWorkoutOpen(false)} />}
      {message && (
        <div className="toast" role="status">
          <Check size={17} />
          {message}
          <button aria-label="Dismiss notification" onClick={() => setMessage('')}>
            <X size={15} />
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
