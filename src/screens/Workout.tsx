import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../context';
import { Button, Field, Label, Modal, Select, TextArea } from '../components';
import { alternatives, library, nextTrainingDate, programVersion, progression } from '../engine';
import { localDate, secondsText, uid } from '../utils';
import type { ExerciseSet } from '../types';

export function Workout({ onMinimize }: { onMinimize: () => void }) {
  const { data, update, notify } = useApp();
  const draft = data.draft!;
  const current = draft.exercises[draft.exerciseIndex];
  const rec = progression(data, current.prescription, current.exercise);
  const index = current.sets.length;
  const [weight, setWeight] = useState(String(current.sets.at(-1)?.weight ?? rec.weight));
  const [reps, setReps] = useState(String(rec.reps[Math.min(index, rec.reps.length - 1)]));
  const [rir, setRir] = useState('');
  const [assistance, setAssistance] = useState(rec.band);
  const [clock, setClock] = useState(Date.now());
  const [sub, setSub] = useState(false);
  const [permanent, setPermanent] = useState(false);
  const [finish, setFinish] = useState(false);
  const [skip, setSkip] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    setWeight(String(current.sets.at(-1)?.weight ?? rec.weight));
    setReps(String(rec.reps[Math.min(index, rec.reps.length - 1)]));
    setRir('');
    setAssistance(current.sets.at(-1)?.assistance ?? rec.band);
    setError('');
  }, [draft.exerciseIndex, index, current.exercise.id]);
  useEffect(() => {
    const t = setInterval(() => setClock(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    let lock: { release: () => Promise<void> } | undefined;
    let disposed = false;
    const request = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') {
          const acquired = await navigator.wakeLock.request('screen');
          if (disposed) await acquired.release();
          else lock = acquired;
        }
      } catch {
        /* Optional browser feature. */
      }
    };
    void request();
    document.addEventListener('visibilitychange', request);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', request);
      void lock?.release();
    };
  }, []);
  const rest =
    draft.pausedRest !== null
      ? draft.pausedRest
      : draft.restEnd
        ? Math.max(0, Math.ceil((draft.restEnd - clock) / 1000))
        : 0;
  const resting = rest > 0;
  const exerciseDone = index >= current.prescription.sets || current.skipped;
  const allDone = draft.exercises.every((e) => e.skipped || e.sets.length >= e.prescription.sets);
  const setCount = draft.exercises.reduce((n, e) => n + e.sets.length, 0);
  const total = draft.exercises.reduce((n, e) => n + e.prescription.sets, 0);
  function completeSet() {
    const n = Number(reps),
      w = Number(weight),
      r = rir === '' ? null : Number(rir);
    if (
      !Number.isFinite(n) ||
      !Number.isInteger(n) ||
      n < 1 ||
      n > 300 ||
      !Number.isFinite(w) ||
      w < 0 ||
      w > 500 ||
      (r !== null && (!Number.isFinite(r) || r < 0 || r > 10))
    ) {
      setError('Enter 1–300 whole reps/seconds, a nonnegative weight, and optional RIR 0–10.');
      return;
    }
    const set: ExerciseSet = {
      id: uid(),
      reps: n,
      weight: w,
      rir: r,
      assistance,
      completedAt: new Date().toISOString(),
    };
    update((d) => {
      const dr = d.draft!;
      dr.exercises[dr.exerciseIndex].sets.push(set);
      dr.restEnd = Date.now() + current.prescription.rest * 1000;
      dr.pausedRest = null;
    });
  }
  function advance() {
    update((d) => {
      const dr = d.draft!;
      dr.restEnd = null;
      dr.pausedRest = null;
      const next = dr.exercises.findIndex(
        (e, i) => i > dr.exerciseIndex && !e.skipped && e.sets.length < e.prescription.sets,
      );
      if (next >= 0) dr.exerciseIndex = next;
    });
  }
  function replaceExercise(id: string) {
    const replacement = library(data).find((e) => e.id === id)!;
    update((d) => {
      const dr = d.draft!;
      const oldId = dr.exercises[dr.exerciseIndex].exercise.id;
      dr.exercises[dr.exerciseIndex] = {
        exercise: structuredClone(replacement),
        prescription: {
          ...current.prescription,
          exerciseId: id,
          min: replacement.reps[0],
          max: replacement.reps[1],
          rest: replacement.rest,
          rir: replacement.rir,
        },
        sets: [],
      };
      if (permanent) {
        const program = d.programs.find((p) => p.id === d.currentProgramId)!;
        const workouts = structuredClone(program.workouts);
        const w = workouts.find((w) => w.id === dr.workoutId);
        const p = w?.exercises.find((p) => p.exerciseId === oldId);
        if (p)
          Object.assign(p, {
            exerciseId: id,
            min: replacement.reps[0],
            max: replacement.reps[1],
            rest: replacement.rest,
            rir: replacement.rir,
          });
        const version = programVersion(d, workouts, `Substituted ${replacement.name}`);
        d.programs.push(version);
        d.currentProgramId = version.id;
        d.cycles.find((c) => c.id === d.currentCycleId)!.programId = version.id;
      }
    });
    setSub(false);
    notify('Exercise replaced.');
  }
  function finishWorkout() {
    if (!setCount) {
      notify('Log at least one set, or discard this session.');
      return;
    }
    update((d) => {
      const dr = d.draft!;
      const endedAt = new Date().toISOString();
      d.sessions.push({
        id: dr.id,
        date: dr.date,
        startedAt: dr.startedAt,
        endedAt,
        duration: Math.round((Date.parse(endedAt) - Date.parse(dr.startedAt)) / 1000),
        cycleId: dr.cycleId,
        programId: dr.programId,
        workoutId: dr.workoutId,
        name: dr.name,
        exercises: structuredClone(dr.exercises),
        notes: dr.notes,
        readiness: dr.readiness,
      });
      const c = d.cycles.find((c) => c.id === dr.cycleId)!;
      c.nextIndex++;
      d.settings.nextDate = nextTrainingDate(d, localDate());
      d.draft = null;
    });
    notify('Session saved. Your next workout is ready when you are.');
  }
  return (
    <div className="workout-overlay">
      <header className="workout-top">
        <button className="brand" onClick={onMinimize}>
          trn<span className="brand-dot">.</span>
        </button>
        <span>
          WORKOUT {draft.workoutId} / {draft.name}
        </span>
        <button className="icon-button" onClick={onMinimize} aria-label="Minimize workout">
          <ChevronDown size={24} />
        </button>
      </header>
      <div className="workout-progress">
        <i style={{ width: `${(setCount / total) * 100}%` }} />
      </div>
      <div className="workout-content">
        <div className="workout-status">
          <Label>
            EXERCISE {draft.exerciseIndex + 1} OF {draft.exercises.length}
          </Label>
          <span>
            <Clock3 size={14} />
            {secondsText(Math.max(0, Math.floor((clock - Date.parse(draft.startedAt)) / 1000)))}
          </span>
        </div>
        <h1>{current.exercise.name}</h1>
        <p className="workout-cue">{current.exercise.cue}</p>
        <div className="set-heading">
          <strong>
            {exerciseDone ? 'Exercise complete' : `Set ${index + 1}`}
            <span> / {current.prescription.sets}</span>
          </strong>
          <span>
            Target {current.prescription.min}–{current.prescription.max}{' '}
            {current.exercise.unit === 'seconds' ? 'sec' : 'reps'} · RIR {current.prescription.rir}
          </span>
        </div>
        <div className="previous-strip">
          <Label>PREVIOUS</Label>
          <span>
            {rec.previous
              ? rec.previous.sets
                  .map(
                    (s) =>
                      `${s.weight ? s.weight + ' kg × ' : ''}${s.reps}${s.assistance ? ' · ' + s.assistance : ''}`,
                  )
                  .join(' / ')
              : 'A fresh baseline. Focus on clean reps.'}
          </span>
        </div>
        {resting ? (
          <div className="rest-panel">
            <Label>REST & RESET</Label>
            <div className="timer" aria-live="off">
              {secondsText(rest)}
            </div>
            <p>
              {draft.pausedRest !== null
                ? 'Timer paused'
                : exerciseDone
                  ? 'Next: the next exercise'
                  : 'Next: another clean set'}
            </p>
            <div className="rest-buttons">
              <Button
                variant="secondary"
                onClick={() =>
                  update((d) => {
                    if (d.draft!.pausedRest !== null) d.draft!.pausedRest += 15;
                    else d.draft!.restEnd = (d.draft!.restEnd || Date.now()) + 15000;
                  })
                }
              >
                <Plus size={15} />
                15 sec
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  update((d) => {
                    if (d.draft!.pausedRest !== null) {
                      d.draft!.restEnd = Date.now() + d.draft!.pausedRest * 1000;
                      d.draft!.pausedRest = null;
                    } else {
                      d.draft!.pausedRest = rest;
                      d.draft!.restEnd = null;
                    }
                  })
                }
              >
                {draft.pausedRest !== null ? <Play size={15} /> : <Pause size={15} />}
                {draft.pausedRest !== null ? 'Resume' : 'Pause'}
              </Button>
              <Button
                variant="quiet"
                onClick={() =>
                  update((d) => {
                    d.draft!.restEnd = null;
                    d.draft!.pausedRest = null;
                  })
                }
              >
                Skip rest
              </Button>
            </div>
          </div>
        ) : exerciseDone ? (
          <div className="exercise-complete">
            <div className="complete-mark">
              <Check size={30} />
            </div>
            <h2>Exercise recorded.</h2>
            <p>{current.sets.length} sets recorded.</p>
            <Button onClick={() => (allDone ? setFinish(true) : advance())}>
              {allDone ? 'Review & finish' : 'Next exercise'}
              <ArrowRight size={18} />
            </Button>
          </div>
        ) : (
          <>
            <div className="workout-inputs">
              <Field
                label="Weight · kg"
                type="number"
                min={0}
                max={500}
                step={0.5}
                value={weight}
                onChange={setWeight}
              />
              <Field
                label={current.exercise.unit === 'seconds' ? 'Seconds' : 'Repetitions'}
                type="number"
                min={1}
                max={300}
                step={1}
                value={reps}
                onChange={setReps}
              />
              <Field
                label="RIR · optional"
                type="number"
                min={0}
                max={10}
                step={1}
                value={rir}
                onChange={setRir}
              />
            </div>
            {current.exercise.equipment.includes('bands') && (
              <Select
                label="Band / assistance"
                value={assistance}
                onChange={(v) => {
                  setAssistance(v);
                  const b = data.equipment.bands.find((b) => b.label === v);
                  if (b)
                    update((d) => {
                      d.equipment.selectedBand = b.id;
                    });
                }}
              >
                <option value="">No assistance</option>
                {data.equipment.bands.map((b) => (
                  <option key={b.id} value={b.label}>
                    {b.label} · {b.assistance}
                  </option>
                ))}
              </Select>
            )}
            <p className="small muted">
              {current.exercise.equipment.includes('dumbbells') ? 'Weight per dumbbell. ' : ''}
              {['db-row', 'split-squat', 'dead-bug', 'bird-dog'].includes(current.exercise.id)
                ? 'Reps per side; complete both sides before logging. '
                : ''}
              RIR 2 ≈ two more clean reps possible.
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <Button className="complete-set" onClick={completeSet}>
              Complete set <Check size={20} />
            </Button>
          </>
        )}
        <div className="logged-sets">
          {current.sets.map((s, i) => (
            <div key={s.id}>
              <span>SET {i + 1}</span>
              <strong>
                {s.weight > 0 ? `${s.weight} kg × ` : ''}
                {s.reps}
                {current.exercise.unit === 'seconds' ? ' sec' : ' reps'}
              </strong>
              <small>
                {s.assistance}
                {s.rir !== null ? ` · RIR ${s.rir}` : ''}
              </small>
              <button
                className="icon-button"
                aria-label={`Undo set ${i + 1}`}
                onClick={() =>
                  update((d) => {
                    d.draft!.exercises[d.draft!.exerciseIndex].sets.splice(i, 1);
                    d.draft!.restEnd = null;
                    d.draft!.pausedRest = null;
                  })
                }
              >
                <Minus size={14} />
              </button>
            </div>
          ))}
        </div>
        <details className="workout-guidance">
          <summary>Technique & next-session progression</summary>
          <ol>
            {current.exercise.instructions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <p>{rec.message}</p>
          {current.prescription.notes && <p>{current.prescription.notes}</p>}
        </details>
        <div className="workout-actions">
          <button disabled={index > 0} onClick={() => setSub(true)}>
            <RefreshCw size={14} />
            Replace exercise
          </button>
          <button onClick={() => setSkip(true)}>Skip exercise</button>
          <button onClick={() => setFinish(true)}>Finish session</button>
        </div>
        <p className="small muted">
          Stop for sharp or joint pain. Back or pelvic pain with radiation, numbness, tingling, or
          persistent symptoms warrants professional assessment.
        </p>
      </div>
      {sub && (
        <Modal title="Choose a compatible alternative" onClose={() => setSub(false)}>
          <p>
            Matched to equipment, movement pattern, and target muscles. Choose a difficulty you can
            control.
          </p>
          <label className="check-line">
            <input
              type="checkbox"
              checked={permanent}
              onChange={(e) => setPermanent(e.target.checked)}
            />
            Use this exercise from now on
          </label>
          <div className="alternative-list">
            {alternatives(current.exercise, data).map((e) => (
              <button key={e.id} onClick={() => replaceExercise(e.id)}>
                <strong>{e.name}</strong>
                <small>
                  {e.movement} · {e.reps.join('–')} reps · {e.category}
                </small>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
          {!alternatives(current.exercise, data).length && (
            <p>
              No compatible alternative with your current equipment. Skip this movement and adjust
              your program in Plan.
            </p>
          )}
        </Modal>
      )}
      {skip && (
        <Modal title="Skip this exercise?" onClose={() => setSkip(false)}>
          <p>
            Any logged sets stay in the session. No penalty; adjust the next session to what feels
            comfortable.
          </p>
          <Button
            onClick={() => {
              update((d) => {
                d.draft!.exercises[d.draft!.exerciseIndex].skipped = true;
                d.draft!.restEnd = null;
                d.draft!.pausedRest = null;
              });
              setSkip(false);
            }}
          >
            Skip exercise
          </Button>
        </Modal>
      )}
      {finish && (
        <Modal
          title={allDone ? 'Session complete.' : 'Finish this session?'}
          onClose={() => setFinish(false)}
        >
          <p>
            {setCount} working sets ·{' '}
            {Math.max(1, Math.round((clock - Date.parse(draft.startedAt)) / 60000))} minutes.{' '}
            {allDone
              ? 'Your results inform your next recommendation.'
              : 'Completed sets will be saved; unfinished work remains visible in history.'}
          </p>
          {draft.exercises.map((e, i) => (
            <div className="summary-row" key={i}>
              <strong>{e.exercise.name}</strong>
              <span>
                {e.skipped ? 'Skipped · ' : ''}
                {e.sets.length
                  ? e.sets
                      .map(
                        (s) =>
                          `${s.weight ? s.weight + ' kg × ' : ''}${s.reps}${s.rir !== null ? ' @ ' + s.rir + ' RIR' : ''}${s.assistance ? ' · ' + s.assistance : ''}`,
                      )
                      .join(' / ')
                  : 'No sets logged'}
              </span>
            </div>
          ))}
          <TextArea
            label="Session notes"
            value={draft.notes}
            onChange={(v) =>
              update((d) => {
                d.draft!.notes = v;
              })
            }
            placeholder="What felt good? What needs adjusting?"
          />
          <Button onClick={finishWorkout} disabled={!setCount}>
            Save session <Check size={16} />
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (window.confirm('Discard this unfinished session and all its logged sets?')) {
                update((d) => {
                  d.draft = null;
                });
                notify('Unfinished session discarded.');
              }
            }}
          >
            Discard session
          </Button>
        </Modal>
      )}
    </div>
  );
}
