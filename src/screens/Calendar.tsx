import { useState } from 'react';
import { ChevronLeft, ChevronRight, Edit3 } from 'lucide-react';
import { useApp } from '../context';
import { Button, Empty, Field, Label, Modal, SectionHead, TextArea } from '../components';
import { addDays, localDate, parseDate, prettyDate } from '../utils';
import type { WorkoutSession } from '../types';

export function Calendar() {
  const { data, update, notify } = useApp();
  const [month, setMonth] = useState(localDate().slice(0, 7));
  const [selected, setSelected] = useState(localDate());
  const [edit, setEdit] = useState<WorkoutSession | null>(null);
  const first = parseDate(`${month}-01`);
  const offset = (first.getDay() + 6) % 7;
  const monthDays = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells = Array.from(
    { length: Math.ceil((offset + monthDays) / 7) * 7 },
    (_, i) => i - offset + 1,
  );
  function changeMonth(delta: number) {
    const d = parseDate(`${month}-01`);
    d.setMonth(d.getMonth() + delta);
    setMonth(localDate(d).slice(0, 7));
  }
  function saveEdit() {
    if (!edit) return;
    if (
      !edit.date ||
      edit.exercises.some((e) =>
        e.sets.some(
          (s) =>
            !Number.isFinite(s.reps) ||
            s.reps < 1 ||
            s.reps > 300 ||
            s.weight < 0 ||
            s.weight > 500 ||
            (s.rir !== null && (s.rir < 0 || s.rir > 10)),
        ),
      )
    ) {
      notify('Check the date, reps, weight and RIR.');
      return;
    }
    update((d) => {
      d.sessions = d.sessions.map((s) => (s.id === edit.id ? edit : s));
    });
    setEdit(null);
    notify('Session corrected. Progress recommendations will use the updated results.');
  }
  const sessions = data.sessions.filter((s) => s.date === selected);
  const mobility = data.mobility.filter((m) => m.date === selected);
  const events = data.events.filter((e) => e.date === selected);
  const milestones = data.cycles.filter((c) => c.startDate === selected || c.endedAt === selected);
  return (
    <>
      <div className="calendar-layout">
        <section className="card calendar-card">
          <div className="section-head">
            <button
              className="icon-button"
              aria-label="Previous month"
              onClick={() => changeMonth(-1)}
            >
              <ChevronLeft size={20} />
            </button>
            <h2>{first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2>
            <button className="icon-button" aria-label="Next month" onClick={() => changeMonth(1)}>
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="calendar-weekdays">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {cells.map((n, i) => {
              const date = `${month}-${String(n).padStart(2, '0')}`;
              const valid = n > 0 && n <= monthDays;
              return valid ? (
                <button
                  key={i}
                  className={`${selected === date ? 'selected ' : ''}${date === localDate() ? 'today' : ''}`}
                  onClick={() => setSelected(date)}
                  aria-label={prettyDate(date)}
                >
                  <span>{n}</span>
                  <div>
                    {data.sessions.some((s) => s.date === date) && <i className="strength" />}
                    {data.mobility.some((m) => m.date === date) && <i className="mobility" />}
                    {data.events.some((e) => e.date === date) && <i className="rest" />}
                    {data.cycles.some((c) => c.startDate === date || c.endedAt === date) && (
                      <i className="milestone" />
                    )}
                  </div>
                </button>
              ) : (
                <span key={i} />
              );
            })}
          </div>
          <div className="calendar-legend">
            <span>
              <i className="strength" />
              Strength
            </span>
            <span>
              <i className="mobility" />
              Mobility
            </span>
            <span>
              <i className="rest" />
              Rest / skipped
            </span>
            <span>
              <i className="milestone" />
              Cycle start / end
            </span>
          </div>
        </section>
        <section className="card">
          <Label>{prettyDate(selected, { weekday: 'long', day: 'numeric', month: 'short' })}</Label>
          <h3>Your daily record</h3>
          {!sessions.length && !mobility.length && !events.length && !milestones.length && (
            <Empty title="An open page">No activity recorded for this date.</Empty>
          )}
          {sessions.map((s) => (
            <button className="history-day" key={s.id} onClick={() => setEdit(structuredClone(s))}>
              <strong>
                Workout {s.workoutId} · {s.name}
              </strong>
              <small>
                {Math.round(s.duration / 60)} min ·{' '}
                {s.exercises.reduce((n, e) => n + e.sets.length, 0)} sets
              </small>
              <Edit3 size={14} />
            </button>
          ))}
          {mobility.map((m, i) => (
            <div className="summary-row" key={i}>
              <strong>Daily mobility</strong>
              <span>{m.routineId}</span>
            </div>
          ))}
          {events.map((e) => (
            <div className="summary-row" key={e.id}>
              <strong>
                {e.type === 'rest'
                  ? 'Recovery'
                  : e.type === 'skip'
                    ? 'Skipped workout ' + e.workoutId
                    : 'Moved workout'}
              </strong>
              <span>{e.note || 'The sequence continues.'}</span>
            </div>
          ))}
          {milestones.map((c) => (
            <div className="summary-row" key={c.id}>
              <strong>Cycle {c.startDate === selected ? 'started' : 'ended'}</strong>
              <span>{c.name}</span>
            </div>
          ))}
        </section>
      </div>
      <SectionHead title="Session history" />
      <div className="history-list">
        {!data.sessions.length ? (
          <Empty title="Your first session starts here">
            Every set you log will become part of this notebook.
          </Empty>
        ) : (
          [...data.sessions]
            .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
            .map((s) => (
              <button key={s.id} onClick={() => setEdit(structuredClone(s))}>
                <span className="history-letter">{s.workoutId}</span>
                <div>
                  <strong>{s.name}</strong>
                  <small>
                    {prettyDate(s.date)} · {data.cycles.find((c) => c.id === s.cycleId)?.name} ·{' '}
                    {data.programs.find((p) => p.id === s.programId)?.label}
                  </small>
                </div>
                <span>{Math.round(s.duration / 60)} min</span>
                <Edit3 size={16} />
              </button>
            ))
        )}
      </div>
      {edit && (
        <Modal title={`Workout ${edit.workoutId} · Edit record`} wide onClose={() => setEdit(null)}>
          <p>
            {data.cycles.find((c) => c.id === edit.cycleId)?.name} ·{' '}
            {data.programs.find((p) => p.id === edit.programId)?.label}. These are the exercises and
            prescriptions used that day.
          </p>
          <div className="form-grid">
            <Field
              label="Session date"
              type="date"
              value={edit.date}
              onChange={(v) => setEdit({ ...edit, date: v })}
            />
            <Field
              label="Duration · minutes"
              type="number"
              min={0}
              max={300}
              value={Math.round(edit.duration / 60)}
              onChange={(v) => setEdit({ ...edit, duration: Number(v) * 60 })}
            />
          </div>
          {edit.exercises.map((e, i) => (
            <section className="editor-exercise" key={i}>
              <h3>{e.exercise.name}</h3>
              <small>
                {e.prescription.sets} × {e.prescription.min}–{e.prescription.max} ·{' '}
                {e.prescription.rest}s rest · RIR {e.prescription.rir}
                {e.skipped ? ' · Skipped / partially completed' : ''}
              </small>
              {e.sets.map((s, j) => (
                <div className="history-set" key={s.id}>
                  <span>{j + 1}</span>
                  {(['weight', 'reps', 'rir', 'assistance'] as const).map((k) => (
                    <Field
                      key={k}
                      label={
                        {
                          weight: 'kg',
                          reps: e.exercise.unit === 'seconds' ? 'Seconds' : 'Reps',
                          rir: 'RIR',
                          assistance: 'Band',
                        }[k]
                      }
                      type={k === 'assistance' ? 'text' : 'number'}
                      min={0}
                      step={k === 'weight' ? 0.5 : 1}
                      value={s[k] ?? ''}
                      onChange={(v) => {
                        const copy = structuredClone(edit);
                        const set = copy.exercises[i].sets[j];
                        if (k === 'assistance') set.assistance = v;
                        else if (k === 'rir') set.rir = v === '' ? null : Number(v);
                        else set[k] = Number(v);
                        setEdit(copy);
                      }}
                    />
                  ))}
                </div>
              ))}
              {!e.sets.length && <p className="muted">No working sets recorded.</p>}
            </section>
          ))}
          <TextArea
            label="Session notes"
            value={edit.notes}
            onChange={(v) => setEdit({ ...edit, notes: v })}
          />
          <Button onClick={saveEdit}>Save corrected record</Button>
        </Modal>
      )}
    </>
  );
}
