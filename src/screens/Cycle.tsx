import { useState } from 'react';
import { Archive, Copy, Pause, Play, Plus, RotateCcw } from 'lucide-react';
import { useApp } from '../context';
import { Button, Field, Label, Modal, SectionHead, Select, Stat, TextArea } from '../components';
import {
  adaptWorkout,
  currentCycle,
  currentProgram,
  cycleRecommendations,
  cycleWeek,
  finishDate,
  library,
  phase,
  programVersion,
  recommendedWorkouts,
} from '../engine';
import { validateProfile } from '../storage';
import { addDays, daysBetween, localDate, prettyDate, uid } from '../utils';
import type { CycleFeedback, TrainingCycle, UserProfile } from '../types';

const blankFeedback: CycleFeedback = {
  satisfaction: 3,
  improved: '',
  needsWork: '',
  disliked: '',
  discomfort: '',
  emphasis: '',
};
export function Cycle() {
  const { data, update, notify } = useApp();
  const c = currentCycle(data);
  const today = localDate();
  const sessions = data.sessions.filter((s) => s.cycleId === c.id);
  const skips = data.events.filter((e) => e.cycleId === c.id && e.type === 'skip').length;
  const [newCycle, setNewCycle] = useState(false);
  const [source, setSource] = useState<TrainingCycle | null>(null);
  const [name, setName] = useState(`Chapter ${data.cycles.length + 1}`);
  const [date, setDate] = useState(today);
  const [weeks, setWeeks] = useState(8);
  const [mode, setMode] = useState('current');
  const [baseline, setBaseline] = useState<UserProfile>({ ...data.profile });
  const [ending, setEnding] = useState(false);
  const [feedback, setFeedback] = useState<CycleFeedback>({ ...blankFeedback });
  const [extend, setExtend] = useState(false);
  const [extra, setExtra] = useState(2);
  const [archiveVisible, setArchiveVisible] = useState(false);
  const [emphasis, setEmphasis] = useState(data.goals.priorities[0]);
  function openNew(old?: TrainingCycle, restart = false) {
    if (data.draft) {
      notify('Finish or discard the unfinished workout before changing cycles.');
      return;
    }
    setSource(old || null);
    setMode('current');
    const focusText = old?.feedback?.emphasis.toLowerCase() || '';
    const suggested = data.goals.priorities
      .filter((m) => focusText.includes(m.toLowerCase()))
      .sort((a, b) => focusText.indexOf(a.toLowerCase()) - focusText.indexOf(b.toLowerCase()))[0];
    setEmphasis(suggested || data.goals.priorities[0]);
    setName(
      restart
        ? `${c.name} · restarted`
        : old
          ? `${old.name} · next`
          : `Chapter ${data.cycles.length + 1}`,
    );
    setWeeks(old?.weeks || 8);
    setDate(today);
    setBaseline({ ...data.profile });
    setNewCycle(true);
  }
  function pauseResume() {
    if (data.draft) {
      notify('Finish or discard your current workout before pausing the cycle.');
      return;
    }
    update((d) => {
      const cycle = d.cycles.find((x) => x.id === c.id)!;
      if (cycle.status === 'paused') {
        cycle.pausedDays += Math.max(0, daysBetween(cycle.pausedAt!, today));
        cycle.pausedAt = null;
        cycle.status = 'active';
      } else {
        cycle.status = 'paused';
        cycle.pausedAt = today;
      }
    });
    notify(
      c.status === 'paused'
        ? 'Cycle resumed. Paused days extend the finish date.'
        : 'Cycle paused. Your sequence and results are preserved.',
    );
  }
  function end() {
    update((d) => {
      const cycle = d.cycles.find((x) => x.id === c.id)!;
      if (cycle.pausedAt) cycle.pausedDays += Math.max(0, daysBetween(cycle.pausedAt, today));
      cycle.pausedAt = null;
      cycle.status = 'ended';
      cycle.endedAt = today;
      cycle.feedback = { ...feedback };
      cycle.endBaseline = structuredClone(d.profile);
      d.settings.nextDate = null;
    });
    setEnding(false);
    notify('Cycle ended. Your results and feedback are saved.');
  }
  function create() {
    if (!name.trim() || !date || !Number.isInteger(weeks) || weeks < 1 || weeks > 52) {
      notify('Enter a name, valid date, and duration from 1–52 weeks.');
      return;
    }
    try {
      validateProfile(mode === 'current' || mode === 'duplicate' ? data.profile : baseline);
    } catch {
      notify('Check starting strength and body-weight ranges before creating the cycle.');
      return;
    }
    if (
      c.status !== 'ended' &&
      !window.confirm(
        'End the current cycle and start this new chapter? All previous results will be kept.',
      )
    )
      return;
    update((d) => {
      const previous = d.cycles.find((x) => x.id === c.id)!;
      if (previous.status !== 'ended') {
        previous.status = 'ended';
        previous.endedAt = today;
        previous.endBaseline = structuredClone(d.profile);
        if (previous.pausedAt)
          previous.pausedDays += Math.max(0, daysBetween(previous.pausedAt, today));
        previous.pausedAt = null;
      }
      if (mode === 'assessment' || mode === 'manual') {
        d.profile = { ...baseline };
        const weighin = d.weights.find((w) => w.date === date);
        if (weighin) weighin.value = baseline.weight;
        else d.weights.push({ id: uid(), date, value: baseline.weight });
        d.performance.push({
          id: uid(),
          date,
          pullups: baseline.pullups,
          assisted: baseline.assisted,
          dips: baseline.dips,
          pushups: baseline.pushups,
          band: d.equipment.bands.find((b) => b.id === d.equipment.selectedBand)?.label || '',
        });
      }
      d.goals.priorities = [emphasis, ...d.goals.priorities.filter((m) => m !== emphasis)];
      // A duplicate can preserve an old program. Otherwise regenerate against current settings.
      const oldProgram =
        source && mode === 'duplicate' ? d.programs.find((p) => p.id === source.programId) : null;
      const workouts = oldProgram ? structuredClone(oldProgram.workouts) : recommendedWorkouts(d);
      if (workouts.some((w) => !w.exercises.length))
        throw new Error('Equipment exclusions leave an empty workout.');
      const program = programVersion(
        d,
        workouts,
        source ? `New cycle based on ${source.name}` : 'New cycle from current settings',
      );
      d.programs.push(program);
      d.currentProgramId = program.id;
      const cycle: TrainingCycle = {
        id: uid(),
        name: name.trim(),
        startDate: date,
        weeks,
        status: 'active',
        pausedAt: null,
        pausedDays: 0,
        endedAt: null,
        archived: false,
        baseline: structuredClone(d.profile),
        resetLoads: mode === 'manual' || mode === 'assessment',
        programId: program.id,
        nextIndex: 0,
        feedback: null,
        sourceId: source?.id,
      };
      d.cycles.push(cycle);
      d.currentCycleId = cycle.id;
      d.settings.nextDate = date;
    });
    setNewCycle(false);
    notify('New cycle started. Previous results stay in your notebook.');
  }
  const endWeights = data.weights
    .filter((w) => w.date >= c.startDate && w.date <= (c.endedAt || today))
    .sort((a, b) => a.date.localeCompare(b.date));
  const endPerformance = data.performance
    .filter((p) => p.date >= c.startDate && p.date <= (c.endedAt || today))
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  return (
    <>
      <section className="card cycle-card">
        <div className="section-head">
          <Label>CURRENT CYCLE / {c.status.toUpperCase()}</Label>
          <span className="status-dot" />
        </div>
        <h2>{c.name}</h2>
        <p>
          {prettyDate(c.startDate)} — {prettyDate(finishDate(c))}
        </p>
        <div className="stats-grid four">
          <Stat label="Cycle week" value={Math.min(cycleWeek(c), c.weeks)} unit={`/ ${c.weeks}`} />
          <Stat label="Workout number" value={c.nextIndex + 1} />
          <Stat
            label="Completed"
            value={sessions.length}
            unit={`/ ${c.weeks * data.preferences.frequency}`}
          />
          <Stat label="Skipped" value={skips} />
        </div>
        <div className="thin-progress">
          <i
            style={{
              width: `${Math.min(100, (sessions.length / (c.weeks * data.preferences.frequency)) * 100)}%`,
            }}
          />
        </div>
        <p>{phase(c).description}</p>
        <div className="button-row">
          {c.status !== 'ended' && (
            <>
              <Button variant="secondary" onClick={pauseResume}>
                {c.status === 'paused' ? <Play size={15} /> : <Pause size={15} />}
                {c.status === 'paused' ? 'Resume cycle' : 'Pause cycle'}
              </Button>
              <Button variant="secondary" onClick={() => setExtend(true)}>
                <Plus size={15} />
                Extend
              </Button>
              <Button
                variant="quiet"
                onClick={() => {
                  if (data.draft) {
                    notify('Finish or discard your workout first.');
                    return;
                  }
                  setEnding(true);
                }}
              >
                End cycle{cycleWeek(c) < c.weeks ? ' early' : ''}
              </Button>
            </>
          )}
          <Button onClick={() => openNew(c)}>
            <Plus size={15} />
            {c.status === 'ended' ? 'Start next cycle' : 'Start new cycle'}
          </Button>
        </div>
        <button className="text-link" onClick={() => openNew(c, true)}>
          <RotateCcw size={14} />
          Restart as a new cycle
        </button>
      </section>
      <div className="two-col">
        <section className="card">
          <Label>PROGRESSION SUMMARY</Label>
          <h3>{c.status === 'ended' ? 'A chapter to build on.' : 'A foundation in progress.'}</h3>
          <div className="summary-row">
            <strong>Body weight</strong>
            <span>
              {c.baseline.weight} →{' '}
              {c.endBaseline?.weight ?? endWeights.at(-1)?.value ?? c.baseline.weight} kg
            </span>
          </div>
          <div className="summary-row">
            <strong>Strict pull-ups</strong>
            <span>
              {c.baseline.pullups} →{' '}
              {c.endBaseline?.pullups ?? endPerformance?.pullups ?? c.baseline.pullups}
            </span>
          </div>
          <div className="summary-row">
            <strong>Dips</strong>
            <span>
              {c.baseline.dips} → {c.endBaseline?.dips ?? endPerformance?.dips ?? c.baseline.dips}
            </span>
          </div>
          {['db-row', 'press', 'floor-press'].map((id) => {
            const logs = sessions
              .flatMap((s) => s.exercises)
              .filter((e) => e.exercise.id === id && e.sets.length);
            return logs.length ? (
              <div className="summary-row" key={id}>
                <strong>{logs[0].exercise.name}</strong>
                <span>
                  {logs[0].sets[0].weight} kg × {logs[0].sets[0].reps} →{' '}
                  {logs.at(-1)!.sets[0].weight} kg × {logs.at(-1)!.sets[0].reps}
                </span>
              </div>
            ) : null;
          })}
          <p className="small muted">
            Rep benchmarks use your recorded assessments, not inferred maxes. Comparison values are
            logged working sets.
          </p>
        </section>
        <section className="card">
          <Label>THE NEXT CHAPTER</Label>
          <h3>Recommendations, with your say.</h3>
          <ul className="plain-list">
            {cycleRecommendations(data, c).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>
      </div>
      <SectionHead title="Your week-by-week plan" />
      <section className="card week-roadmap">
        {Array.from({ length: c.weeks }, (_, i) => {
          const week = i + 1;
          const reduced = week === c.weeks || week % 4 === 0;
          return (
            <details key={week}>
              <summary>
                <span>Week {week}</span>
                <strong>
                  {week === c.weeks
                    ? 'Evaluate & transition'
                    : reduced
                      ? 'Recovery emphasis'
                      : 'Progressive training'}
                </strong>
                <small>{reduced ? 'Fewer sets · RIR 3+' : 'Clean reps → resistance'}</small>
              </summary>
              <p>
                {reduced
                  ? 'Reduce each movement by one set (minimum one). Keep about 3 reps in reserve. Optional comfortable rep benchmarks; no max lifts.'
                  : 'Build clean reps within the range. Add resistance only after every set reaches its ceiling with enough RIR. At your load limit, use controlled lowering, pauses, more ROM, or a harder variation.'}
              </p>
              {currentProgram(data).workouts.map((w) => {
                const weekWorkout = adaptWorkout(w, data, data.preferences.maxMinutes, reduced);
                return (
                  <div className="week-session" key={w.id}>
                    <strong>
                      Workout {w.id} · {w.name}
                    </strong>
                    {weekWorkout.exercises.map((p, j) => (
                      <div key={j}>
                        <span>{library(data).find((e) => e.id === p.exerciseId)?.name}</span>
                        <small>
                          {p.sets} × {p.min}–{p.max} · {p.rest}s · RIR {p.rir}
                        </small>
                      </div>
                    ))}
                  </div>
                );
              })}
              <p>
                A → B → C continues at your pace. {data.preferences.frequency} sessions / week is a
                target; missed days shift the sequence. Daily low-fatigue mobility stays separate.
              </p>
            </details>
          );
        })}
      </section>
      <SectionHead
        title="Your cycle history"
        aside={
          <button className="text-link" onClick={() => setArchiveVisible(!archiveVisible)}>
            {archiveVisible ? 'Hide archived' : 'Show archived'}
          </button>
        }
      />
      <div className="cycle-history">
        {[...data.cycles]
          .reverse()
          .filter((old) => !old.archived || archiveVisible)
          .map((old) => (
            <section className="card" key={old.id}>
              <div>
                <Label>
                  {old.status.toUpperCase()}
                  {old.archived ? ' / ARCHIVED' : ''}
                </Label>
                <h3>{old.name}</h3>
                <p>
                  {prettyDate(old.startDate)} · {old.weeks} weeks ·{' '}
                  {data.sessions.filter((s) => s.cycleId === old.id).length} completed
                </p>
                {old.feedback && (
                  <small>
                    Feedback: {old.feedback.satisfaction}/5 · {old.feedback.improved || 'No notes'}
                  </small>
                )}
              </div>
              <div className="button-row">
                <Button
                  variant="secondary"
                  onClick={() => {
                    openNew(old);
                    setMode('duplicate');
                  }}
                >
                  <Copy size={14} />
                  Duplicate
                </Button>
                {old.id !== c.id && (
                  <Button
                    variant="quiet"
                    onClick={() =>
                      update((d) => {
                        d.cycles.find((x) => x.id === old.id)!.archived = !old.archived;
                      })
                    }
                  >
                    <Archive size={14} />
                    {old.archived ? 'Unarchive' : 'Archive'}
                  </Button>
                )}
              </div>
            </section>
          ))}
      </div>
      {newCycle && (
        <Modal title="Start a new chapter" onClose={() => setNewCycle(false)}>
          <div className="form-grid">
            <Field label="Cycle name" value={name} onChange={setName} />
            <Field label="Start date" type="date" value={date} onChange={setDate} />
            <Select
              label="Cycle length"
              value={String(weeks)}
              onChange={(v) => setWeeks(Number(v))}
            >
              {[...new Set([4, 6, 8, 10, 12, weeks])]
                .sort((a, b) => a - b)
                .map((n) => (
                  <option key={n} value={n}>
                    {n} weeks
                  </option>
                ))}
            </Select>
            <Select label="Initialization" value={mode} onChange={setMode}>
              <option value="current">Use current performance · skip testing</option>
              <option value="assessment">Short baseline assessment</option>
              <option value="manual">Enter starting strength manually</option>
              {source && <option value="duplicate">Duplicate source program</option>}
            </Select>
          </div>
          <Select
            label="Next cycle’s main emphasis"
            value={emphasis}
            onChange={(v) => setEmphasis(v as typeof emphasis)}
          >
            {data.goals.priorities.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
          {mode === 'assessment' && (
            <div className="note">
              Warm up. Record comfortable clean-rep benchmarks on separate movements with full rest;
              stop before technique fails. Testing is optional and never requires a true one-rep
              maximum. You can switch to current performance to skip.
            </div>
          )}
          {(mode === 'assessment' || mode === 'manual') && (
            <div className="form-grid">
              {(
                [
                  'weight',
                  'pullups',
                  'assisted',
                  'dips',
                  'pushups',
                  'dumbbellWeight',
                  'rowWeight',
                  'pressWeight',
                ] as const
              ).map((k) => (
                <Field
                  key={k}
                  label={
                    {
                      weight: 'Body weight · kg',
                      pullups: 'Strict pull-up max',
                      assisted: 'Assisted pull-ups',
                      dips: 'Dip max',
                      pushups: 'Push-up max',
                      dumbbellWeight: 'Common dumbbell · kg',
                      rowWeight: 'Barbell row · kg',
                      pressWeight: 'DB overhead press · kg',
                    }[k]
                  }
                  type="number"
                  min={k === 'weight' ? 30 : 0}
                  value={baseline[k]}
                  onChange={(v) => setBaseline({ ...baseline, [k]: Number(v) })}
                />
              ))}
            </div>
          )}
          {source && (
            <div className="note">
              <strong>Based on {source.name}</strong>
              <ul className="plain-list">
                {cycleRecommendations(data, source)
                  .slice(0, 4)
                  .map((s) => (
                    <li key={s}>{s}</li>
                  ))}
              </ul>
              <p>
                Change exercise exclusions, preferences, schedule, and priorities in Settings before
                starting to apply those choices. Duplicating preserves the source program.
              </p>
            </div>
          )}
          <Button
            onClick={() => {
              if (
                recommendedWorkouts({
                  ...data,
                  profile: mode === 'current' || mode === 'duplicate' ? data.profile : baseline,
                }).some((w) => !w.exercises.length)
              ) {
                notify('Adjust exclusions or equipment before creating a cycle.');
                return;
              }
              if (
                baseline.weight < 30 ||
                baseline.weight > 300 ||
                Object.values(baseline).some((v) => typeof v === 'number' && !Number.isFinite(v))
              ) {
                notify('Check your baseline values.');
                return;
              }
              create();
            }}
          >
            Create cycle <Plus size={15} />
          </Button>
          <p className="small muted">
            Existing sessions, measurements, and program versions are preserved. Expected finish:{' '}
            {date ? prettyDate(addDays(date, weeks * 7 - 1)) : 'Choose date'}.
          </p>
        </Modal>
      )}
      {ending && (
        <Modal title="Close this cycle" onClose={() => setEnding(false)}>
          <p>Save a little feedback to guide the next program. Ending early is fine.</p>
          <Select
            label="Satisfaction"
            value={String(feedback.satisfaction)}
            onChange={(v) => setFeedback({ ...feedback, satisfaction: Number(v) })}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} / 5
              </option>
            ))}
          </Select>
          {(['improved', 'needsWork', 'disliked', 'discomfort', 'emphasis'] as const).map((k) => (
            <TextArea
              key={k}
              label={
                {
                  improved: 'Which areas improved most?',
                  needsWork: 'Which areas need more work?',
                  disliked: 'Exercises you disliked',
                  discomfort: 'Any painful or uncomfortable movements?',
                  emphasis: 'What should the next cycle emphasize?',
                }[k]
              }
              value={feedback[k]}
              onChange={(v) => setFeedback({ ...feedback, [k]: v })}
            />
          ))}
          <Button onClick={end}>End cycle & save feedback</Button>
        </Modal>
      )}
      {extend && (
        <Modal title="Give this cycle more time" onClose={() => setExtend(false)}>
          <Field
            label="Additional weeks"
            type="number"
            min={1}
            max={52 - c.weeks}
            step={1}
            value={extra}
            onChange={(v) => setExtra(Number(v))}
          />
          <Button
            onClick={() => {
              if (Number.isInteger(extra) && extra >= 1 && extra + c.weeks <= 52) {
                update((d) => {
                  d.cycles.find((x) => x.id === c.id)!.weeks += extra;
                });
                setExtend(false);
                notify('Cycle extended.');
              } else notify('Choose an extension within 52 total weeks.');
            }}
          >
            Extend cycle
          </Button>
        </Modal>
      )}
    </>
  );
}
