import { useState } from 'react';
import { ArrowRight, ArrowUpRight, Check, Clock3, Leaf, Play, RefreshCw } from 'lucide-react';
import { useApp } from '../context';
import {
  Button,
  Field,
  Label,
  LinkButton,
  Modal,
  PageTitle,
  SectionHead,
  Select,
  Stat,
} from '../components';
import {
  compatible,
  currentCycle,
  cycleWeek,
  estimateMinutes,
  isRecovery,
  library,
  nextWorkout,
  phase,
  progression,
  readinessAdvice,
  recommendedRoutine,
} from '../engine';
import { exercises, routines } from '../data';
import { addDays, localDate, prettyDate, uid } from '../utils';
import type { Readiness, WorkoutDraft } from '../types';

export function Today() {
  const { data, update, notify, go, resumeWorkout } = useApp();
  const today = localDate();
  const c = currentCycle(data);
  const workout = nextWorkout(data);
  const recovery = isRecovery(data);
  const week = cycleWeek(c);
  const routine = recommendedRoutine(data);
  const done = data.mobility.some((m) => m.date === today);
  const complete = data.sessions.filter((s) => s.cycleId === c.id).length;
  const [showStart, setShowStart] = useState(false);
  const [showRoutine, setShowRoutine] = useState(false);
  const [move, setMove] = useState(false);
  const [moveDate, setMoveDate] = useState(addDays(today, 1));
  const [minutes, setMinutes] = useState(data.preferences.maxMinutes);
  const [ready, setReady] = useState<Readiness>({ energy: 3, sleep: 3, soreness: 2 });
  const advice = readinessAdvice(ready);
  const [warm, setWarm] = useState(false);
  const [summary, setSummary] = useState(false);
  const preview = nextWorkout(data, minutes, ready);
  function start() {
    if (data.draft) {
      setShowStart(false);
      resumeWorkout();
      return;
    }
    const all = library(data);
    const template = nextWorkout(data, minutes, ready);
    if (!template.exercises.length) {
      notify('Add an exercise in the program editor first.');
      return;
    }
    if (
      template.exercises.some(
        (p) =>
          !compatible(
            all.find((e) => e.id === p.exerciseId)!,
            data,
          ),
      )
    ) {
      notify(
        'Some programmed movements use removed equipment or exclusions. Regenerate your plan in Settings → Program, or edit it before starting.',
      );
      return;
    }
    const logged = template.exercises.map((p) => ({
      exercise: structuredClone(all.find((e) => e.id === p.exerciseId)!),
      prescription: { ...p },
      sets: [],
    }));
    // Technique sets have their own identity, separate from assisted hypertrophy work.
    const skill = all.find((e) => e.id === 'pullup')!;
    if (
      data.goals.strength &&
      minutes >= 30 &&
      (template.id === 'A' || template.id === 'C') &&
      data.profile.pullups >= 2 &&
      compatible(skill, data) &&
      !template.exercises.some((p) => p.exerciseId === 'pullup')
    )
      logged.unshift({
        exercise: structuredClone(skill),
        prescription: {
          exerciseId: 'pullup',
          sets: 2,
          min: 1,
          max: data.profile.pullups >= 5 ? 2 : 1,
          rest: 90,
          rir: 1,
          notes:
            'Low-fatigue technique practice. Stop before failure; never treat these as max sets.',
        },
        sets: [],
      });
    const draft: WorkoutDraft = {
      id: uid(),
      startedAt: new Date().toISOString(),
      date: today,
      cycleId: c.id,
      programId: data.currentProgramId,
      workoutId: template.id,
      name: template.name,
      exercises: logged,
      exerciseIndex: 0,
      restEnd: null,
      pausedRest: null,
      readiness: ready,
      minutes,
      notes: '',
    };
    update((d) => {
      d.draft = draft;
      d.settings.nextDate = null;
    });
    setShowStart(false);
  }
  function schedule(type: 'rest' | 'skip' | 'move', date = today) {
    update((d) => {
      d.events.push({
        id: uid(),
        date: today,
        type,
        cycleId: c.id,
        workoutId: workout.id,
        note: type === 'move' ? `Moved to ${date}` : '',
      });
      d.settings.nextDate = type === 'move' ? date : addDays(today, 1);
      if (type === 'skip') d.cycles.find((x) => x.id === c.id)!.nextIndex++;
    });
    notify(
      type === 'skip'
        ? 'Session skipped. Next in the rotation is ready tomorrow.'
        : type === 'rest'
          ? 'Recovery today. Your next workout stays in place.'
          : `Workout moved to ${prettyDate(date)}.`,
    );
    setMove(false);
  }
  const last = data.sessions.at(-1);
  return (
    <>
      <PageTitle
        eyebrow={prettyDate(today, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).toUpperCase()}
        title="Today."
        description="Your next session, daily practice, and recovery."
        action={
          <span className="chapter-tag">
            CYCLE {data.cycles.indexOf(c) + 1}
            <span />
            WEEK {Math.min(week, c.weeks)} / {c.weeks}
          </span>
        }
      />
      <div className="today-grid">
        <div>
          <section className={`hero-card ${recovery ? 'recovery' : ''}`}>
            <div className="hero-top">
              <Label>
                {recovery
                  ? 'RECOVERY & DAILY PRACTICE'
                  : `YOUR NEXT SESSION / WORKOUT ${workout.id}`}
              </Label>
              <span className="hero-index">
                {recovery ? <Leaf size={32} strokeWidth={1} /> : workout.id}
              </span>
            </div>
            <h2>
              {recovery
                ? 'Room to recover.'
                : workout.name.split(' + ').map((s, i) => (
                    <span key={s}>
                      {i > 0 && <em> + </em>}
                      {s}
                      {i === 0 && <br />}
                    </span>
                  ))}
            </h2>
            <p>
              {recovery
                ? c.status === 'paused'
                  ? 'Your cycle is paused. Keep movement gentle and resume when you’re ready.'
                  : c.status === 'ended'
                    ? 'This chapter is complete. Review it and build your next cycle.'
                    : week > c.weeks
                      ? 'Your cycle’s planned duration is complete. Evaluate and begin the next chapter.'
                      : `Your next strength session is workout ${workout.id}. ${data.settings.nextDate && data.settings.nextDate > today ? `Planned for ${prettyDate(data.settings.nextDate)}.` : 'Take the space you need between sessions.'}`
                : workout.focus}
            </p>
            <div className="hero-meta">
              <span>
                <Clock3 size={16} />
                {recovery ? '5–10' : estimateMinutes(workout)} min
              </span>
              <span>{recovery ? 'Low fatigue' : `${workout.exercises.length} exercises`}</span>
              <span>{phase(c).label}</span>
            </div>
            <Button
              onClick={() =>
                data.draft ? resumeWorkout() : recovery ? setShowRoutine(true) : setShowStart(true)
              }
            >
              <Play size={16} fill="currentColor" />
              {data.draft
                ? 'Resume your session'
                : recovery
                  ? 'Start daily routine'
                  : 'Start workout'}
              <ArrowRight size={18} />
            </Button>
            {recovery && c.status === 'active' && today >= c.startDate && week <= c.weeks && (
              <button className="hero-secondary" onClick={() => setShowStart(true)}>
                Feeling recovered? Train today <ArrowUpRight size={14} />
              </button>
            )}
            {c.status === 'ended' || week > c.weeks ? (
              <button className="hero-secondary" onClick={() => go('Plan')}>
                Review cycle & start next <ArrowRight size={14} />
              </button>
            ) : null}
          </section>
          {c.status === 'active' && today >= c.startDate && week <= c.weeks && (
            <div className="schedule-actions">
              <button onClick={() => schedule('move', addDays(today, 1))}>Do tomorrow</button>
              <button onClick={() => schedule('rest')}>Recovery day</button>
              <button onClick={() => setMove(true)}>Move workout</button>
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      'Skip this session and advance to the next workout? Your history stays intact.',
                    )
                  )
                    schedule('skip');
                }}
              >
                Skip
              </button>
            </div>
          )}
          <SectionHead
            title={recovery ? 'Up next in your rotation' : 'The session'}
            aside={<LinkButton onClick={() => go('Plan')}>View plan</LinkButton>}
          />
          <div className="exercise-list">
            {workout.exercises.map((p, i) => {
              const e = library(data).find((e) => e.id === p.exerciseId)!;
              const rec = progression(data, p);
              return (
                <div className="exercise-row" key={`${p.exerciseId}-${i}`}>
                  <span className="exercise-number">{String(i + 1).padStart(2, '0')}</span>
                  <div className="exercise-row-main">
                    <h3>
                      {e.name}
                      {rec.band && <span className="band-label">{rec.band} band</span>}
                    </h3>
                    <p>
                      {rec.previous
                        ? `Previous: ${rec.previous.sets.map((s) => s.reps).join(' / ')}${rec.previous.sets[0]?.weight ? ' · ' + rec.previous.sets[0].weight + ' kg' : ''}`
                        : 'First session · establish a clean baseline'}
                    </p>
                    <span className="exercise-target">
                      Today: {rec.weight > 0 ? `${rec.weight} kg · ` : ''}
                      {rec.reps.join(' / ')}
                      {e.unit === 'seconds' ? ' sec' : ' reps'} · RIR {p.rir}
                    </span>
                    <details>
                      <summary>Technique & progression</summary>
                      <p>{e.cue}</p>
                      <p>{rec.message}</p>
                      {p.group && (
                        <p>
                          Accessory pairing {p.group}: alternate with the matching movement if
                          comfortable. Rest remains editable.
                        </p>
                      )}
                    </details>
                  </div>
                  <div className="exercise-dose">
                    <strong>
                      {p.sets} <span>×</span> {p.min}–{p.max}
                    </strong>
                    <small>{p.rest}s rest</small>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="practice-note">
            <span className="eyebrow">BEFORE THE FIRST WORKING SET</span>
            <p>
              5–8 minutes of gentle movement, then 1–2 easy ramp-up sets for loaded lifts. On A and
              C, practice{' '}
              <strong>2 × {data.profile.pullups >= 5 ? '2' : '1'} strict pull-ups</strong> if clean
              reps stay in reserve, with 90–120s rest; otherwise use easy assisted reps. Warm-up
              practice is not a max test.
            </p>
          </div>
        </div>
        <aside className="today-aside">
          <section className="card mobility-card">
            <div className="card-kicker">
              <Leaf size={19} />
              <Label>DAILY PRACTICE</Label>
              {done && <Check size={18} />}
            </div>
            <h2>{routine.name}</h2>
            <p>{routine.description}</p>
            <div className="mini-meta">
              <span>{routine.minutes} min</span>
              <span>Gentle · low fatigue</span>
            </div>
            <Button variant="secondary" onClick={() => setShowRoutine(true)}>
              {done ? 'View completed routine' : 'Open daily routine'}
              <ArrowRight size={16} />
            </Button>
            <small>{data.preferences.mobilityDays} days / week · tracked separately</small>
          </section>
          <section className="card cycle-glance">
            <Label>THE LONG VIEW</Label>
            <h3>{c.name}</h3>
            <div className="stat-pair">
              <Stat label="Completed" value={complete} unit="sessions" />
              <Stat label="This cycle" value={Math.min(week, c.weeks)} unit={`/ ${c.weeks} wk`} />
            </div>
            <div className="thin-progress">
              <i
                style={{
                  width: `${Math.min(100, (complete / (c.weeks * data.preferences.frequency)) * 100)}%`,
                }}
              />
            </div>
            <p>{phase(c).description}</p>
            <LinkButton onClick={() => go('Plan')}>Cycle details</LinkButton>
          </section>
          <section className="card nutrition-glance">
            <Label>FUEL THE WORK</Label>
            <div className="nutrition-number">
              {data.nutrition.protein}
              <span>g protein</span>
            </div>
            <p>
              Aim for {Math.round(data.profile.weight * 1.6)}–
              {Math.round(data.profile.weight * 2.2)} g per day. Build meals around a protein
              source.
            </p>
            <LinkButton onClick={() => go('Nutrition')}>Your meal plan</LinkButton>
          </section>
          {last && (
            <section className="card">
              <Label>LAST SESSION</Label>
              <h3>Workout {last.workoutId}</h3>
              <p>
                {prettyDate(last.date)} · {Math.round(last.duration / 60)} min
              </p>
              <LinkButton
                onClick={() => {
                  setSummary(true);
                }}
              >
                Session summary
              </LinkButton>
            </section>
          )}
        </aside>
      </div>
      {showStart && (
        <Modal title={`Workout ${preview.id} · Make it fit`} onClose={() => setShowStart(false)}>
          <p className="muted">Your plan adapts to your time and readiness. The warm-up stays.</p>
          <Label>HOW MUCH TIME DO YOU HAVE?</Label>
          <div className="segmented time-options">
            {[20, 30, 45, 60].map((t) => (
              <button
                className={minutes === t ? 'active' : ''}
                key={t}
                onClick={() => setMinutes(t)}
              >
                {t === 60 ? '60+' : t}
                <small>min</small>
              </button>
            ))}
          </div>
          <div className="form-grid">
            {(['energy', 'sleep', 'soreness'] as const).map((k) => (
              <Select
                key={k}
                label={
                  k === 'soreness'
                    ? 'Soreness (5 = high)'
                    : `${k[0].toUpperCase() + k.slice(1)} (5 = high)`
                }
                value={String(ready[k])}
                onChange={(v) => setReady({ ...ready, [k]: Number(v) })}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </Select>
            ))}
          </div>
          <div className="note">
            <strong>{advice.label}</strong>
            <p>{advice.description}</p>
            <p>
              {preview.exercises.length} exercises · approximately {estimateMinutes(preview)}{' '}
              minutes including warm-up.
            </p>
          </div>
          {data.preferences.injuries && (
            <div className="warning">
              Your movement note: {data.preferences.injuries}. Check each movement and substitute if
              it is painful.
            </div>
          )}
          <label className="check-line">
            <input type="checkbox" checked={warm} onChange={(e) => setWarm(e.target.checked)} />
            I’ve completed gentle mobility and easy ramp-up sets.
          </label>
          <p className="small muted">
            RIR 2 ≈ two more clean reps possible. Stop for sharp or joint pain. Dumbbell weights are
            per dumbbell; unilateral reps are per side.
          </p>
          <Button onClick={start} disabled={!warm || c.status !== 'active'}>
            {data.draft ? 'Resume unfinished workout' : 'Begin session'}
            <ArrowRight size={16} />
          </Button>
          {c.status !== 'active' && <p>Resume or start a cycle in Plan first.</p>}
        </Modal>
      )}
      {showRoutine && (
        <Modal title={routine.name} onClose={() => setShowRoutine(false)}>
          <div className="routine-select">
            <Select
              label="Choose a routine"
              value={routine.id}
              onChange={(v) =>
                update((d) => {
                  d.settings.routineId = v;
                })
              }
            >
              {routines.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {r.minutes} min
                </option>
              ))}
            </Select>
          </div>
          <p>{routine.description}</p>
          <div className="routine-items">
            {routine.items
              .filter((item) => {
                const e = exercises.find((e) => e.id === item.exerciseId)!;
                return (
                  e.equipment.every((eq) => data.equipment.available.includes(eq)) &&
                  !data.preferences.avoid.includes(e.id)
                );
              })
              .map((item, i) => {
                const e = exercises.find((e) => e.id === item.exerciseId)!;
                return (
                  <details key={e.id}>
                    <summary>
                      <span>
                        {String(i + 1).padStart(2, '0')}
                        <strong>{e.name}</strong>
                      </span>
                      <small>{item.dose}</small>
                    </summary>
                    <p>{e.cue}</p>
                    <ol>
                      {e.instructions.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ol>
                  </details>
                );
              })}
          </div>
          <div className="note small">
            Pelvic position varies. Explore anterior, posterior, and neutral rather than holding one
            rigid posture. Stop for sharp or radiating pain, numbness, tingling, or persistent back
            pain and seek appropriate assessment.
          </div>
          <Button
            onClick={() => {
              if (!done)
                update((d) => {
                  d.mobility.push({ date: today, routineId: routine.id });
                });
              notify('Daily practice recorded.');
              setShowRoutine(false);
            }}
          >
            <Check size={16} />
            {done ? 'Completed today' : 'Complete daily routine'}
          </Button>
          <button
            className="text-link"
            onClick={() =>
              update((d) => {
                d.settings.routineId = null;
              })
            }
          >
            <RefreshCw size={14} />
            Use automatic rotation
          </button>
        </Modal>
      )}
      {move && (
        <Modal title="Move your next session" onClose={() => setMove(false)}>
          <p>Your workout stays in the sequence. Choose a date that fits.</p>
          <Field label="Training date" type="date" value={moveDate} onChange={setMoveDate} />
          <Button
            onClick={() => {
              if (moveDate >= today) schedule('move', moveDate);
              else notify('Choose today or a future date.');
            }}
          >
            Move workout
          </Button>
        </Modal>
      )}
      {summary && last && (
        <Modal title="Last session" onClose={() => setSummary(false)}>
          <h3>{last.name}</h3>
          <p>
            {prettyDate(last.date)} · {Math.round(last.duration / 60)} min ·{' '}
            {data.programs.find((p) => p.id === last.programId)?.label}
          </p>
          {last.exercises.map((e, i) => (
            <div className="summary-row" key={i}>
              <strong>{e.exercise.name}</strong>
              <span>
                {e.skipped
                  ? 'Skipped'
                  : e.sets
                      .map(
                        (s) =>
                          `${s.weight ? s.weight + ' kg × ' : ''}${s.reps}${s.assistance ? ' · ' + s.assistance : ''}`,
                      )
                      .join(' / ')}
              </span>
            </div>
          ))}
        </Modal>
      )}
    </>
  );
}
