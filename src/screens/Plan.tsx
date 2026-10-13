import { useState } from 'react';
import { ArrowDown, ArrowUp, ArrowRight, Edit3, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useApp } from '../context';
import {
  Button,
  Field,
  Label,
  Modal,
  PageTitle,
  SectionHead,
  Select,
  TextArea,
} from '../components';
import {
  alternatives,
  compatible,
  currentProgram,
  estimateMinutes,
  library,
  programVersion,
  recommendedWorkouts,
} from '../engine';
import type { ExercisePrescription, WorkoutTemplate } from '../types';
import { Cycle } from './Cycle';
import { Calendar } from './Calendar';

export function Plan() {
  const { data, update, notify } = useApp();
  const [tab, setTab] = useState('Program');
  const program = currentProgram(data);
  const [editing, setEditing] = useState<WorkoutTemplate | null>(null);
  const [add, setAdd] = useState(false);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const all = library(data);
  function save() {
    if (!editing) return;
    if (!editing.exercises.length) {
      notify('Keep at least one exercise in a workout.');
      return;
    }
    if (
      editing.exercises.some(
        (p) =>
          p.sets < 1 ||
          p.sets > 10 ||
          p.max < p.min ||
          p.min < 1 ||
          p.max > 300 ||
          p.rest < 0 ||
          p.rest > 600 ||
          p.rir < 0 ||
          p.rir > 10,
      )
    ) {
      notify('Check sets (1–10), rep ranges (1–300), rest (0–600), and RIR (0–10).');
      return;
    }
    update((d) => {
      const workouts = structuredClone(program.workouts).map((w) =>
        w.id === editing.id ? editing : w,
      );
      const version = programVersion(d, workouts, `Edited workout ${editing.id}`);
      d.programs.push(version);
      d.currentProgramId = version.id;
      d.cycles.find((c) => c.id === d.currentCycleId)!.programId = version.id;
    });
    setEditing(null);
    notify('Program version saved. Past sessions keep their original program.');
  }
  function reset() {
    if (
      !window.confirm(
        'Replace your custom program with a recommendation based on current settings? Previous versions and workouts are preserved.',
      )
    )
      return;
    const workouts = recommendedWorkouts(data);
    if (workouts.some((w) => !w.exercises.length)) {
      notify('Your exclusions leave a workout empty. Adjust equipment or avoided exercises first.');
      return;
    }
    update((d) => {
      const version = programVersion(
        d,
        workouts,
        'Regenerated from current profile, equipment and priorities',
      );
      d.programs.push(version);
      d.currentProgramId = version.id;
      d.cycles.find((c) => c.id === d.currentCycleId)!.programId = version.id;
    });
    notify('Updated program generated from your current settings.');
  }
  function patch(index: number, change: Partial<ExercisePrescription>) {
    setEditing((w) =>
      w
        ? { ...w, exercises: w.exercises.map((p, i) => (i === index ? { ...p, ...change } : p)) }
        : null,
    );
  }
  function reorder(i: number, delta: number) {
    if (!editing) return;
    const list = [...editing.exercises];
    [list[i], list[i + delta]] = [list[i + delta], list[i]];
    setEditing({ ...editing, exercises: list });
  }
  function choose(id: string) {
    const e = all.find((e) => e.id === id)!;
    const p = {
      exerciseId: id,
      sets: 2,
      min: e.reps[0],
      max: e.reps[1],
      rest: e.rest,
      rir: e.rir,
      notes: '',
    };
    setEditing((w) =>
      w
        ? {
            ...w,
            exercises:
              replaceIndex !== null
                ? w.exercises.map((old, i) => (i === replaceIndex ? { ...p, sets: old.sets } : old))
                : [...w.exercises, p],
          }
        : null,
    );
    setAdd(false);
    setReplaceIndex(null);
  }
  const choices =
    replaceIndex !== null && editing
      ? alternatives(
          all.find((e) => e.id === editing.exercises[replaceIndex].exerciseId)!,
          data,
        )
      : all.filter(
          (e) =>
            compatible(e, data) &&
            ['Compound', 'Isolation', 'Core', 'Posture'].includes(e.category),
        );
  return (
    <>
      <PageTitle
        eyebrow="THE STRUCTURE"
        title="A plan with room to live."
        description="Follow the sequence. The calendar can wait."
      />
      <div className="page-tabs">
        {['Program', 'Cycle', 'Calendar & history'].map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Cycle' ? (
        <Cycle />
      ) : tab === 'Calendar & history' ? (
        <Calendar />
      ) : (
        <>
          <div className="section-head">
            <div>
              <Label>{program.label.toUpperCase()}</Label>
              <p className="muted">
                A → B → C · {data.preferences.frequency} sessions / week · up to{' '}
                {data.preferences.maxMinutes} minutes
              </p>
            </div>
            <Button variant="secondary" onClick={reset}>
              <RotateCcw size={15} />
              Reset to recommended
            </Button>
          </div>
          <div className="workout-templates">
            {program.workouts.map((w) => (
              <section className="card template-card" key={w.id}>
                <div className="template-head">
                  <span className="workout-letter">{w.id}</span>
                  <div>
                    <Label>WORKOUT {w.id}</Label>
                    <h2>{w.name}</h2>
                    <p>{w.focus}</p>
                  </div>
                  <button
                    className="icon-button"
                    aria-label={`Edit workout ${w.id}`}
                    onClick={() => setEditing(structuredClone(w))}
                  >
                    <Edit3 size={18} />
                  </button>
                </div>
                <div className="template-meta">
                  <span>{estimateMinutes(w)} min incl. warm-up</span>
                  <span>{w.exercises.reduce((n, e) => n + e.sets, 0)} working sets</span>
                </div>
                {w.exercises.map((p, i) => {
                  const e = all.find((e) => e.id === p.exerciseId);
                  return (
                    <div className="template-exercise" key={i}>
                      <span>{String(i + 1).padStart(2, '0')}</span>
                      <div>
                        <strong>{e?.name || 'Unknown exercise'}</strong>
                        <small>
                          {p.rest}s rest · RIR {p.rir}
                          {p.group ? ` · Pair ${p.group}` : ''}
                          {!e || !compatible(e, data) ? ' · Review equipment / exclusions' : ''}
                        </small>
                      </div>
                      <b>
                        {p.sets} × {p.min}–{p.max}
                      </b>
                    </div>
                  );
                })}
                <Button variant="quiet" onClick={() => setEditing(structuredClone(w))}>
                  Edit session <ArrowRight size={16} />
                </Button>
              </section>
            ))}
          </div>
          <section className="note">
            <strong>Eight weeks, with breathing room.</strong>
            <p>
              Weeks 1–3 build gradually. Week 4 reduces volume by about one-third. Weeks 5–7 build
              again. Week 8 lowers fatigue and evaluates progress. Other cycle lengths use every
              fourth week for recovery and the final week for evaluation. Progress through reps,
              load, less assistance, pauses, range, and controlled lowering.
            </p>
            <p>
              Pairs are optional accessory supersets. Finish both sides on unilateral movements.
              Keep 5–8 minutes for warm-up plus easy loaded ramp-up sets. Program changes apply to
              future sessions; an ongoing session keeps its snapshot.
            </p>
          </section>
          <SectionHead title="Program versions" />
          <div className="version-list">
            {[...data.programs].reverse().map((p) => (
              <div key={p.id}>
                <strong>{p.label}</strong>
                <span>{p.reason}</span>
                <small>{new Date(p.createdAt).toLocaleDateString('en-GB')}</small>
              </div>
            ))}
          </div>
        </>
      )}
      {editing && (
        <Modal title={`Edit workout ${editing.id}`} wide onClose={() => setEditing(null)}>
          <Field
            label="Workout name"
            value={editing.name}
            onChange={(v) => setEditing({ ...editing, name: v })}
          />
          <Field
            label="Focus"
            value={editing.focus}
            onChange={(v) => setEditing({ ...editing, focus: v })}
          />
          <div className="editor-exercises">
            {editing.exercises.map((p, i) => (
              <section className="editor-exercise" key={i}>
                <div className="section-head">
                  <h3>{all.find((e) => e.id === p.exerciseId)?.name}</h3>
                  <div className="icon-group">
                    <button
                      disabled={i === 0}
                      className="icon-button"
                      aria-label={`Move exercise ${i + 1} up`}
                      onClick={() => reorder(i, -1)}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      disabled={i === editing.exercises.length - 1}
                      className="icon-button"
                      aria-label={`Move exercise ${i + 1} down`}
                      onClick={() => reorder(i, 1)}
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Remove exercise ${i + 1}`}
                      onClick={() =>
                        setEditing({
                          ...editing,
                          exercises: editing.exercises.filter((_, j) => i !== j),
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="form-grid compact">
                  {(['sets', 'min', 'max', 'rest', 'rir'] as const).map((k) => (
                    <Field
                      key={k}
                      label={
                        {
                          sets: 'Sets',
                          min: 'Min reps',
                          max: 'Max reps',
                          rest: 'Rest · sec',
                          rir: 'RIR',
                        }[k]
                      }
                      type="number"
                      min={k === 'sets' || k === 'min' || k === 'max' ? 1 : 0}
                      value={p[k]}
                      onChange={(v) => patch(i, { [k]: Number(v) })}
                    />
                  ))}
                </div>
                <div className="form-grid">
                  <Field
                    label="Superset pair (optional)"
                    value={p.group || ''}
                    onChange={(v) => patch(i, { group: v })}
                  />
                  <TextArea
                    label="Notes"
                    value={p.notes}
                    onChange={(v) => patch(i, { notes: v })}
                  />
                </div>
                <button
                  className="text-link"
                  onClick={() => {
                    setReplaceIndex(i);
                    setAdd(true);
                  }}
                >
                  Replace exercise <ArrowRight size={14} />
                </button>
              </section>
            ))}
          </div>
          <div className="button-row">
            <Button
              variant="secondary"
              onClick={() => {
                setReplaceIndex(null);
                setAdd(true);
              }}
            >
              <Plus size={16} />
              Add exercise
            </Button>
            <Button onClick={save}>Save program version</Button>
          </div>
        </Modal>
      )}
      {add && (
        <Modal
          title={replaceIndex !== null ? 'Replace exercise' : 'Add exercise'}
          onClose={() => setAdd(false)}
        >
          <Field label="Search compatible exercises" value={search} onChange={setSearch} />
          <div className="alternative-list">
            {choices
              .filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
              .map((e) => (
                <button key={e.id} onClick={() => choose(e.id)}>
                  <strong>{e.name}</strong>
                  <small>
                    {e.muscles.join(' · ')} · {e.reps.join('–')}
                  </small>
                  <Plus size={16} />
                </button>
              ))}
          </div>
        </Modal>
      )}
    </>
  );
}
