import { useState } from 'react';
import { Plus, Ruler, Scale } from 'lucide-react';
import { useApp } from '../context';
import {
  Button,
  Chart,
  Empty,
  Field,
  Label,
  Modal,
  PageTitle,
  SectionHead,
  Select,
  Stat,
} from '../components';
import { currentCycle, movingAverage } from '../engine';
import { addDays, daysBetween, localDate, num, prettyDate, uid } from '../utils';
import type { MeasurementEntry } from '../types';

const ranges = [
  { label: '4 weeks', days: 28 },
  { label: '8 weeks', days: 56 },
  { label: '3 months', days: 90 },
  { label: '6 months', days: 180 },
  { label: 'All time', days: 99999 },
];
export function Progress() {
  const { data, update, notify } = useApp();
  const today = localDate();
  const [range, setRange] = useState(56);
  const [record, setRecord] = useState('');
  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState(data.profile.weight);
  const [perf, setPerf] = useState({
    pullups: data.profile.pullups,
    assisted: data.profile.assisted,
    dips: data.profile.dips,
    pushups: data.profile.pushups,
    band: data.equipment.bands.find((b) => b.id === data.equipment.selectedBand)?.label || '',
  });
  const [measurement, setMeasurement] = useState({
    waist: 0,
    chest: 0,
    shoulders: 0,
    arm: 0,
    thigh: 0,
  });
  const since = addDays(today, -range);
  const inRange = (e: { date: string }) => e.date >= since && e.date <= today;
  const c = currentCycle(data);
  const completed = data.sessions.filter((s) => s.cycleId === c.id).length;
  const lastWeights = [...data.weights].sort((a, b) => a.date.localeCompare(b.date));
  const average = movingAverage(data.weights);
  const weeksElapsed = Math.max(1, Math.ceil(daysBetween(c.startDate, today) / 7));
  const consistency = Math.min(
    100,
    Math.round((completed / (Math.min(weeksElapsed, c.weeks) * data.preferences.frequency)) * 100),
  );
  const volume = data.sessions.filter(inRange).reduce<Record<string, number>>((acc, s) => {
    const monday = addDays(s.date, -((new Date(`${s.date}T12:00:00`).getDay() + 6) % 7));
    acc[monday] =
      (acc[monday] || 0) +
      s.exercises.reduce((v, e) => v + e.sets.reduce((n, set) => n + set.weight * set.reps, 0), 0);
    return acc;
  }, {});
  const lift = (id: string) =>
    data.sessions.filter(inRange).flatMap((s) => {
      const e = s.exercises.find((e) => e.exercise.id === id && e.sets.length);
      return e
        ? [
            {
              date: s.date,
              value: Math.max(...e.sets.map((s) => s.weight)),
              reps: Math.max(...e.sets.map((s) => s.reps)),
            },
          ]
        : [];
    });
  const pr: { label: string; value: string }[] = [
    {
      label: 'Strict pull-ups',
      value: `${Math.max(...data.performance.map((p) => p.pullups), data.profile.pullups)} reps`,
    },
    {
      label: 'Dips',
      value: `${Math.max(...data.performance.map((p) => p.dips), data.profile.dips)} reps`,
    },
    {
      label: 'Push-ups',
      value: `${Math.max(...data.performance.map((p) => p.pushups), data.profile.pushups)} reps`,
    },
  ];
  for (const id of ['db-row', 'bb-row', 'press', 'floor-press']) {
    const logs = data.sessions.flatMap((s) => s.exercises).filter((e) => e.exercise.id === id);
    const sets = logs.flatMap((e) => e.sets).sort((a, b) => b.weight - a.weight || b.reps - a.reps);
    if (sets.length)
      pr.push({ label: logs[0].exercise.name, value: `${sets[0].weight} kg × ${sets[0].reps}` });
  }
  function save() {
    if (!date) {
      notify('Choose a date.');
      return;
    }
    if (record === 'weight') {
      if (weight < 30 || weight > 300) {
        notify('Enter a body weight from 30–300 kg.');
        return;
      }
      update((d) => {
        const existing = d.weights.find((w) => w.date === date);
        if (existing) existing.value = weight;
        else d.weights.push({ id: uid(), date, value: weight });
        if (date >= localDate()) d.profile.weight = weight;
      });
    }
    if (record === 'performance') {
      if (
        Object.entries(perf).some(
          ([k, v]) => k !== 'band' && (typeof v !== 'number' || v < 0 || v > 300),
        )
      ) {
        notify('Enter valid rep counts from 0–300.');
        return;
      }
      update((d) => {
        d.performance.push({ id: uid(), date, ...perf });
        if (date >= localDate())
          Object.assign(d.profile, {
            pullups: perf.pullups,
            assisted: perf.assisted,
            dips: perf.dips,
            pushups: perf.pushups,
          });
      });
    }
    if (record === 'measurements') {
      if (
        Object.values(measurement).some((v) => v < 0 || v > 300) ||
        Object.values(measurement).every((v) => v === 0)
      ) {
        notify('Enter at least one measurement in cm (0–300).');
        return;
      }
      update((d) => {
        d.measurements.push({ id: uid(), date, ...measurement });
      });
    }
    setRecord('');
    notify('Entry recorded.');
  }
  const newest = [...data.measurements].sort((a, b) => b.date.localeCompare(a.date))[0];
  return (
    <>
      <PageTitle
        eyebrow="THE LONG VIEW"
        title="Progress, in perspective."
        description="Look for a trend. One day is only one data point."
        action={
          <Button onClick={() => setRecord('weight')}>
            <Plus size={16} />
            Record progress
          </Button>
        }
      />
      <div className="stats-grid four card">
        <Stat
          label="Body weight"
          value={lastWeights.at(-1)?.value || data.profile.weight}
          unit="kg"
          detail={`Goal ${data.goals.targetWeight} kg`}
        />
        <Stat
          label="Strict pull-ups"
          value={data.profile.pullups}
          unit="reps"
          detail="Latest recorded benchmark"
        />
        <Stat label="Completed" value={completed} unit="sessions" detail="Current cycle" />
        <Stat label="Consistency" value={consistency} unit="%" detail="Sessions / planned pace" />
      </div>
      <div className="range-select">
        {ranges.map((r) => (
          <button
            key={r.days}
            onClick={() => setRange(r.days)}
            className={range === r.days ? 'active' : ''}
          >
            {r.label}
          </button>
        ))}
      </div>
      <div className="chart-grid">
        <section className="card">
          <div className="section-head">
            <h3>Body weight</h3>
            <Scale size={17} />
          </div>
          <Chart
            points={lastWeights.filter(inRange)}
            secondary={average.filter(inRange)}
            label="Body weight"
            unit="kg"
          />
        </section>
        {(['pullups', 'assisted', 'dips', 'pushups'] as const).map((k) => (
          <section className="card" key={k}>
            <h3>
              {
                {
                  pullups: 'Strict pull-ups',
                  assisted: 'Assisted pull-ups',
                  dips: 'Dips',
                  pushups: 'Push-ups',
                }[k]
              }
            </h3>
            <Chart
              points={data.performance
                .filter(inRange)
                .filter((p) => k !== 'assisted' || p.band === perf.band)
                .map((p) => ({ date: p.date, value: p[k] }))}
              label={k}
              unit="reps"
            />
            {k === 'assisted' && (
              <Select
                label="Compare the same assistance"
                value={perf.band}
                onChange={(v) => setPerf({ ...perf, band: v })}
              >
                {[
                  ...new Set([
                    ...data.performance.map((p) => p.band),
                    ...data.equipment.bands.map((b) => b.label),
                  ]),
                ].map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </Select>
            )}
          </section>
        ))}
        {[
          ['db-row', 'Dumbbell row'],
          ['bb-row', 'Barbell row'],
          ['press', 'Overhead press'],
          ['floor-press', 'Chest pressing'],
        ].map(([id, label]) => (
          <section className="card" key={id}>
            <h3>{label}</h3>
            <Chart points={lift(id)} label="Highest working weight per session" unit="kg" />
          </section>
        ))}
        <section className="card">
          <h3>Weekly external-load volume</h3>
          <Chart
            points={Object.entries(volume).map(([date, value]) => ({ date, value }))}
            label="Logged weight × reps"
            unit="kg·reps"
          />
          <p className="small muted">
            Estimate using entered weights. Bodyweight work is not converted to kilograms;
            unilateral and paired-dumbbell totals are not doubled.
          </p>
        </section>
      </div>
      <div className="two-col">
        <section className="card">
          <SectionHead
            title="Personal records"
            aside={
              <button className="text-link" onClick={() => setRecord('performance')}>
                Record assessment <Plus size={14} />
              </button>
            }
          />
          <p className="small muted">
            Rep records include your initial baseline. Lift records use logged sets, ranked by
            weight then reps.
          </p>
          {pr.map((p) => (
            <div className="summary-row" key={p.label}>
              <strong>{p.label}</strong>
              <span>{p.value}</span>
            </div>
          ))}
        </section>
        <section className="card">
          <SectionHead
            title="Measurements"
            aside={
              <button className="text-link" onClick={() => setRecord('measurements')}>
                Add <Ruler size={14} />
              </button>
            }
          />
          {newest ? (
            <>
              <small>{prettyDate(newest.date)} · cm</small>
              {Object.entries({
                waist: 'Waist',
                chest: 'Chest',
                shoulders: 'Shoulders',
                arm: 'Upper arm',
                thigh: 'Thigh',
              }).map(([k, label]) => (
                <div className="summary-row" key={k}>
                  <strong>{label}</strong>
                  <span>{newest[k as keyof Omit<MeasurementEntry, 'id' | 'date'>] || '—'} cm</span>
                </div>
              ))}
            </>
          ) : (
            <Empty title="More than the scale">
              Record waist, chest, shoulders, upper arm, and thigh measurements.
            </Empty>
          )}
          {data.measurements.length > 1 && (
            <details>
              <summary>Previous measurements</summary>
              {[...data.measurements]
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(1)
                .map((m) => (
                  <p key={m.id}>
                    {prettyDate(m.date)}: waist {m.waist || '—'}, chest {m.chest || '—'}, shoulders{' '}
                    {m.shoulders || '—'}, arm {m.arm || '—'}, thigh {m.thigh || '—'} cm
                  </p>
                ))}
            </details>
          )}
        </section>
      </div>
      {record && (
        <Modal title="Record your progress" onClose={() => setRecord('')}>
          <div className="page-tabs">
            {['weight', 'performance', 'measurements'].map((t) => (
              <button key={t} className={record === t ? 'active' : ''} onClick={() => setRecord(t)}>
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <Field label="Date" type="date" value={date} onChange={setDate} />
          {record === 'weight' ? (
            <>
              <Field
                label="Body weight · kg"
                type="number"
                min={30}
                max={300}
                step={0.1}
                value={weight}
                onChange={(v) => setWeight(Number(v))}
              />
              <p className="small muted">
                One entry per date; saving on the same date corrects it. We use a 7-day moving
                average to smooth normal fluctuations.
              </p>
            </>
          ) : record === 'performance' ? (
            <>
              <p>
                Optional comfortable benchmarks. No one-rep-max testing is needed. Stop before
                unsafe technique or repeated failure.
              </p>
              <div className="form-grid">
                {(['pullups', 'assisted', 'dips', 'pushups'] as const).map((k) => (
                  <Field
                    key={k}
                    label={
                      {
                        pullups: 'Strict pull-ups',
                        assisted: 'Assisted pull-ups',
                        dips: 'Dips',
                        pushups: 'Push-ups',
                      }[k]
                    }
                    type="number"
                    min={0}
                    max={300}
                    value={perf[k]}
                    onChange={(v) => setPerf({ ...perf, [k]: Number(v) })}
                  />
                ))}
              </div>
              <Select
                label="Assistance band"
                value={perf.band}
                onChange={(v) => setPerf({ ...perf, band: v })}
              >
                {data.equipment.bands.map((b) => (
                  <option key={b.id}>{b.label}</option>
                ))}
              </Select>
            </>
          ) : (
            <div className="form-grid">
              {(['waist', 'chest', 'shoulders', 'arm', 'thigh'] as const).map((k) => (
                <Field
                  key={k}
                  label={`${k === 'arm' ? 'Upper arm' : k[0].toUpperCase() + k.slice(1)} · cm`}
                  type="number"
                  min={0}
                  max={300}
                  step={0.1}
                  value={measurement[k] || ''}
                  onChange={(v) => setMeasurement({ ...measurement, [k]: Number(v) })}
                />
              ))}
            </div>
          )}
          <Button onClick={save}>Save entry</Button>
        </Modal>
      )}
    </>
  );
}
