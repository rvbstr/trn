import { describe, expect, it } from 'vitest';
import { initialData, exercises } from './data';
import {
  adaptWorkout,
  compatible,
  currentCycle,
  currentProgram,
  cycleWeek,
  finishDate,
  isRecovery,
  nextTrainingDate,
  nextWorkout,
  phase,
  progression,
  recommendedNutrition,
  recommendedRoutine,
  recommendedWorkouts,
} from './engine';
import { validateData } from './storage';
import { addDays, localDate, uid } from './utils';
import type { AppData, ExerciseSet, WorkoutSession } from './types';

function logRow(data: AppData, reps: number[], rir: number | null = 2, weight = 18) {
  const date = localDate();
  const e = exercises.find((e) => e.id === 'db-row')!;
  const sets: ExerciseSet[] = reps.map((reps) => ({
    id: uid(),
    reps,
    weight,
    rir,
    assistance: '',
    completedAt: new Date().toISOString(),
  }));
  const session: WorkoutSession = {
    id: uid(),
    date,
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    duration: 2400,
    cycleId: data.currentCycleId,
    programId: data.currentProgramId,
    workoutId: 'A',
    name: 'Test',
    exercises: [
      {
        exercise: e,
        prescription: { exerciseId: e.id, sets: 3, min: 8, max: 12, rest: 90, rir: 2, notes: '' },
        sets,
      },
    ],
    notes: '',
    readiness: { energy: 3, sleep: 3, soreness: 2 },
  };
  data.sessions.push(session);
  return session.exercises[0].prescription;
}
describe('productive, conservative progression', () => {
  it('honors manually reset cycle loads while preserving older performance for reference', () => {
    const d = initialData();
    const p = logRow(d, [12, 12, 12], 2, 20);
    const old = currentCycle(d);
    const next = { ...structuredClone(old), id: uid(), resetLoads: true };
    d.cycles.push(next);
    d.currentCycleId = next.id;
    d.profile.dumbbellWeight = 10;
    const rec = progression(d, p);
    expect(rec.weight).toBe(10);
    expect(rec.reps).toEqual([8, 8, 8]);
    expect(rec.previous?.sets[0].weight).toBe(20);
  });
  it('uses the requested 12/11/10 → 12/12/11 double progression', () => {
    const d = initialData();
    const p = logRow(d, [12, 11, 10]);
    const rec = progression(d, p);
    expect(rec.weight).toBe(18);
    expect(rec.reps).toEqual([12, 12, 11]);
  });
  it('only suggests more load when all sets reach the ceiling with adequate RIR', () => {
    const d = initialData();
    const p = logRow(d, [12, 12, 12]);
    expect(progression(d, p).weight).toBe(19);
    expect(progression(d, p).reps).toEqual([8, 8, 8]);
  });
  it('does not infer readiness to add load from missing RIR', () => {
    const d = initialData();
    const p = logRow(d, [12, 12, 12], null);
    expect(progression(d, p).weight).toBe(18);
  });
  it('holds reps and weight steady after an unexpectedly hard set', () => {
    const d = initialData();
    const p = logRow(d, [10, 9, 8], 0);
    expect(progression(d, p).reps).toEqual([10, 9, 8]);
  });
  it('offers tempo progression at the available-load limit', () => {
    const d = initialData();
    const p = logRow(d, [12, 12, 12], 2, 20);
    expect(progression(d, p).weight).toBe(20);
    expect(progression(d, p).message).toContain('3-second');
  });
  it('does not compare reps from different assistance bands', () => {
    const d = initialData();
    const p = logRow(d, [12, 12, 12]);
    const logged = d.sessions[0].exercises[0];
    logged.exercise = exercises.find((e) => e.id === 'assisted-pullup')!;
    logged.prescription = { ...p, exerciseId: 'assisted-pullup' };
    logged.sets.forEach((s) => {
      s.assistance = 'Heavy';
      s.weight = 0;
    });
    expect(progression(d, logged.prescription).previous).toBeUndefined();
  });
});
describe('cycles, scheduling and safety', () => {
  it('has all three complete sessions and an eight-week initial cycle', () => {
    const d = initialData();
    expect(currentCycle(d).weeks).toBe(8);
    expect(currentProgram(d).workouts.map((w) => w.id)).toEqual(['A', 'B', 'C']);
    expect(
      currentProgram(d).workouts.every((w) => w.exercises.length >= 5 && w.exercises.length <= 7),
    ).toBe(true);
  });
  it('reduces volume in week four and evaluates in week eight', () => {
    const d = initialData();
    const c = currentCycle(d);
    c.startDate = addDays(localDate(), -21);
    expect(phase(c).reduced).toBe(true);
    expect(nextWorkout(d).exercises[0].sets).toBe(2);
    c.startDate = addDays(localDate(), -49);
    expect(phase(c).label).toBe('Evaluate & transition');
  });
  it('freezes the week while paused and extends finish for paused days', () => {
    const d = initialData();
    const c = currentCycle(d);
    c.startDate = '2026-01-01';
    c.status = 'paused';
    c.pausedAt = '2026-01-10';
    expect(cycleWeek(c, '2026-02-10')).toBe(2);
    expect(finishDate(c, '2026-02-10')).toBe('2026-03-28');
    c.status = 'active';
    c.pausedDays = 31;
    c.pausedAt = null;
    expect(cycleWeek(c, '2026-02-10')).toBe(2);
  });
  it('postpones without changing the sequential workout index', () => {
    const d = initialData();
    d.settings.nextDate = addDays(localDate(), 1);
    expect(isRecovery(d)).toBe(true);
    expect(nextWorkout(d).id).toBe('A');
    currentCycle(d).nextIndex = 1;
    expect(nextWorkout(d).id).toBe('B');
  });
  it('respects start dates, paused cycles and completed durations', () => {
    const d = initialData();
    currentCycle(d).startDate = addDays(localDate(), 1);
    expect(isRecovery(d)).toBe(true);
    currentCycle(d).startDate = addDays(localDate(), -60);
    expect(isRecovery(d)).toBe(true);
  });
  it('shortens the session while retaining primary movements and warm-up budget', () => {
    const d = initialData();
    const short = adaptWorkout(currentProgram(d).workouts[0], d, 20, false);
    expect(short.exercises.length).toBe(3);
    expect(short.exercises.some((p) => p.exerciseId === 'assisted-pullup')).toBe(true);
    expect(short.exercises.every((p) => p.sets <= 2)).toBe(true);
  });
  it('generates a usable bodyweight-only plan without prohibited equipment', () => {
    const d = initialData();
    d.equipment.available = ['mat'];
    const w = recommendedWorkouts(d);
    expect(w.every((w) => w.exercises.length >= 3)).toBe(true);
    expect(
      w
        .flatMap((w) => w.exercises)
        .every((p) =>
          compatible(
            exercises.find((e) => e.id === p.exerciseId)!,
            d,
          ),
        ),
    ).toBe(true);
  });
  it('excludes avoided exercises and uses compatible favorites', () => {
    const d = initialData();
    d.preferences.avoid = ['dips'];
    d.preferences.preferred = ['bb-row'];
    const w = recommendedWorkouts(d);
    expect(w.flatMap((w) => w.exercises).some((p) => p.exerciseId === 'dips')).toBe(false);
    expect(w[0].exercises.some((p) => p.exerciseId === 'bb-row')).toBe(true);
  });
  it('uses updated low strength values rather than prescribing impossible dip and assisted ranges', () => {
    const d = initialData();
    d.profile.dips = 4;
    d.profile.assisted = 6;
    const w = recommendedWorkouts(d);
    const all = w.flatMap((w) => w.exercises);
    expect(all.some((p) => p.exerciseId === 'dips')).toBe(false);
    const assisted = all.find((p) => p.exerciseId === 'assisted-pullup')!;
    expect(assisted.max).toBe(4);
    expect(assisted.min).toBe(3);
  });
  it('keeps preferred weekdays flexible and supplies posterior-tilt routines', () => {
    const d = initialData();
    d.preferences.days = ['Mon'];
    expect(new Date(`${nextTrainingDate(d, '2026-10-13')}T12:00:00`).getDay()).toBe(1);
    expect(['pelvic', 'upper', 'control']).toContain(recommendedRoutine(d).id);
  });
  it('calculates editable nutrition inside the protein range', () => {
    const d = initialData();
    const n = recommendedNutrition(d);
    expect(n.protein).toBe(152);
    expect(n.calories).toBeGreaterThan(2500);
    expect(n.calories).toBeLessThan(3100);
  });
});
describe('backups protect history and validate structure', () => {
  it('round-trips all data including sessions and program snapshots', () => {
    const d = initialData();
    logRow(d, [12, 11, 10]);
    const original = structuredClone(d.sessions[0]);
    d.profile.weight = 80;
    d.programs[0].workouts[0].exercises[0].sets = 1;
    const restored = validateData(JSON.parse(JSON.stringify(d)));
    expect(restored.sessions[0]).toEqual(original);
    expect(restored.profile.weight).toBe(80);
  });
  it('rejects incomplete and dangling-reference imports', () => {
    expect(() => validateData({ schemaVersion: 1 })).toThrow();
    const d = initialData();
    d.currentCycleId = 'missing';
    expect(() => validateData(d)).toThrow('missing');
  });
  it('rejects unknown program exercises and malformed rep ranges', () => {
    const d = initialData();
    d.programs[0].workouts[0].exercises[0].exerciseId = 'missing';
    expect(() => validateData(d)).toThrow('missing exercise');
    d.programs[0].workouts[0].exercises[0].exerciseId = 'pullup';
    d.programs[0].workouts[0].exercises[0].min = 99;
    expect(() => validateData(d)).toThrow();
  });
});
