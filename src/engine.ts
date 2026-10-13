import { baseWorkouts, exercises, routines } from './data';
import type {
  AppData,
  Exercise,
  ExercisePrescription,
  LoggedExercise,
  NutritionTargets,
  ProgramVersion,
  Readiness,
  TrainingCycle,
  UserProfile,
  WorkoutTemplate,
} from './types';
import { addDays, daysBetween, localDate, uid } from './utils';

export const library = (data: AppData): Exercise[] => [...exercises, ...data.customExercises];
export const currentCycle = (data: AppData) =>
  data.cycles.find((c) => c.id === data.currentCycleId)!;
export const currentProgram = (data: AppData) =>
  data.programs.find((p) => p.id === data.currentProgramId)!;
export function cycleWeek(cycle: TrainingCycle, today = localDate()) {
  const elapsed =
    daysBetween(
      cycle.startDate,
      cycle.status === 'paused' ? cycle.pausedAt! : cycle.endedAt || today,
    ) - cycle.pausedDays;
  return Math.max(1, Math.floor(Math.max(0, elapsed) / 7) + 1);
}
export function finishDate(cycle: TrainingCycle, today = localDate()) {
  const currentPause =
    cycle.status === 'paused' && cycle.pausedAt
      ? Math.max(0, daysBetween(cycle.pausedAt, today))
      : 0;
  return addDays(cycle.startDate, cycle.weeks * 7 - 1 + cycle.pausedDays + currentPause);
}
export function phase(
  cycle: TrainingCycle,
  today = localDate(),
): { label: string; reduced: boolean; description: string } {
  const week = cycleWeek(cycle, today);
  if (week >= cycle.weeks)
    return {
      label: 'Evaluate & transition',
      reduced: true,
      description:
        'Keep 3 RIR, reduce volume, and optionally record comfortable rep benchmarks. No max lifts required.',
    };
  if (week % 4 === 0)
    return {
      label: 'Recovery emphasis',
      reduced: true,
      description:
        'About one-third fewer working sets. Keep 3 RIR and prioritize comfortable technique.',
    };
  return {
    label: 'Build gradually',
    reduced: false,
    description:
      'Earn more clean reps before adding resistance. Compounds: 1–3 RIR. Isolation: 0–2 RIR.',
  };
}
export function readinessAdvice(r: Readiness) {
  if (r.energy <= 1 || r.sleep <= 1 || r.soreness >= 5)
    return {
      level: 'recovery',
      label: 'Recovery / mobility',
      description: 'Consider easy movement today. Resume the sequence when you feel recovered.',
    };
  if (r.energy <= 2 || r.sleep <= 2 || r.soreness >= 4)
    return {
      level: 'reduced',
      label: 'Reduced volume',
      description: 'Use fewer working sets and leave an extra rep in reserve.',
    };
  return {
    level: 'normal',
    label: 'Normal workout',
    description: 'Follow your plan, adjusting if the warm-up feels unusually difficult.',
  };
}
export function compatible(e: Exercise, data: AppData) {
  return (
    e.equipment.every((id) => data.equipment.available.includes(id)) &&
    (!e.equipment.includes('bands') || data.equipment.bands.length > 0) &&
    !data.preferences.avoid.includes(e.id)
  );
}
export function alternatives(e: Exercise, data: AppData): Exercise[] {
  return library(data)
    .filter(
      (candidate) =>
        candidate.id !== e.id &&
        compatible(candidate, data) &&
        (e.substitutes.includes(candidate.id) ||
          (candidate.movement === e.movement &&
            candidate.muscles.some((m) => e.muscles.includes(m)))),
    )
    .sort((a, b) => Number(b.movement === e.movement) - Number(a.movement === e.movement));
}
export function recommendedWorkouts(data: AppData): WorkoutTemplate[] {
  const all = library(data);
  const suitable = (e: Exercise) =>
    compatible(e, data) &&
    !(e.id === 'dips' && data.profile.dips < 8) &&
    !(e.id === 'pullup' && data.profile.pullups < 3) &&
    !(e.id === 'negative-pullup' && data.profile.pullups < 2) &&
    !(e.id === 'pushup' && data.profile.pushups < 8);
  return baseWorkouts().map((workout) => {
    const used = new Set<string>();
    const prescribed = workout.exercises.flatMap((p) => {
      const original = all.find((e) => e.id === p.exerciseId)!;
      const favorites = all.filter(
        (e) =>
          data.preferences.preferred.includes(e.id) &&
          suitable(e) &&
          e.movement === original.movement,
      );
      const fallback = all.filter(
        (e) =>
          suitable(e) &&
          original.muscles.some((m) => e.muscles.includes(m)) &&
          (e.category === original.category ||
            (original.category === 'Compound' && e.category === 'Compound')),
      );
      const selected = [
        ...favorites,
        ...(suitable(original) ? [original] : []),
        ...alternatives(original, data).filter(suitable),
        ...fallback,
      ].find((e) => !used.has(e.id));
      if (!selected) return [];
      used.add(selected.id);
      const sets = data.preferences.frequency > 3 ? Math.max(2, p.sets - 1) : p.sets;
      const musclePriority = Math.min(
        ...selected.muscles.map((m) => data.goals.priorities.indexOf(m)).filter((i) => i >= 0),
      );
      let min = selected.reps[0],
        max = selected.reps[1];
      if (selected.id === 'assisted-pullup' && data.profile.assisted > 0) {
        min = Math.max(3, Math.min(8, Math.floor(data.profile.assisted * 0.6)));
        max = Math.max(min, Math.min(12, data.profile.assisted - 2));
      }
      if (selected.id === 'pullup') {
        min = 1;
        max = Math.max(1, Math.min(3, data.profile.pullups - 2));
      }
      if (selected.id === 'dips') {
        min = Math.max(4, Math.min(6, data.profile.dips - 4));
        max = Math.max(min, Math.min(12, data.profile.dips - 2));
      }
      if (selected.id === 'pushup') {
        min = Math.max(4, Math.min(8, data.profile.pushups - 4));
        max = Math.max(min, Math.min(20, data.profile.pushups - 2));
      }
      return [
        {
          ...p,
          exerciseId: selected.id,
          min,
          max,
          rest: selected.rest,
          rir:
            data.preferences.experience === 'Beginner / returning'
              ? Math.max(1, selected.rir)
              : selected.rir,
          sets,
          priority: musclePriority,
        },
      ];
    });
    // Keep primary compounds first; reorder accessory work to match priorities.
    const primary = prescribed.filter(
      (p) => all.find((e) => e.id === p.exerciseId)?.category === 'Compound',
    );
    const accessory = prescribed
      .filter((p) => all.find((e) => e.id === p.exerciseId)?.category !== 'Compound')
      .sort((a, b) => a.priority - b.priority);
    const result = {
      ...workout,
      exercises: [...primary, ...accessory].map(({ priority: _priority, ...p }) => p),
    };
    return adaptWorkout(result, data, data.preferences.maxMinutes, false);
  });
}
export function estimateMinutes(w: WorkoutTemplate) {
  const working = w.exercises.reduce(
    (sum, p) =>
      sum +
      p.sets * (p.exerciseId === 'split-squat' || p.exerciseId === 'db-row' ? 65 : 40) +
      Math.max(0, p.sets - 1) * p.rest * (p.group?.length ? 0.65 : 1) +
      35,
    0,
  );
  return Math.ceil(8 + working / 60);
}
export function adaptWorkout(
  workout: WorkoutTemplate,
  data: AppData,
  minutes: number,
  reduced: boolean,
): WorkoutTemplate {
  const all = library(data);
  let list = workout.exercises.map((p) => ({
    ...p,
    sets: reduced ? Math.max(1, p.sets - 1) : p.sets,
    rir: reduced ? Math.max(3, p.rir) : p.rir,
  }));
  while (
    estimateMinutes({ ...workout, exercises: list }) > minutes &&
    list.some((p) => p.sets > 2)
  ) {
    const index = list.map((p) => p.sets).lastIndexOf(Math.max(...list.map((p) => p.sets)));
    list = list.map((p, i) => (i === index ? { ...p, sets: p.sets - 1 } : p));
  }
  while (estimateMinutes({ ...workout, exercises: list }) > minutes && list.length > 3) {
    const priorities = list.map((p, i) => ({
      i,
      score:
        Math.min(
          ...(all.find((e) => e.id === p.exerciseId)?.muscles || ['Core']).map((m) =>
            data.goals.priorities.indexOf(m),
          ),
        ) + (all.find((e) => e.id === p.exerciseId)?.category === 'Compound' ? -10 : 0),
    }));
    // Preserve the first three primary movements; trim later accessories first.
    const remove = priorities
      .filter((p) => p.i >= 3)
      .sort((a, b) => b.score - a.score || b.i - a.i)[0].i;
    list = list.filter((_, i) => i !== remove);
  }
  if (minutes <= 20) list = list.map((p) => ({ ...p, sets: Math.min(2, p.sets) }));
  return { ...workout, exercises: list };
}
export function nextWorkout(
  data: AppData,
  minutes = data.preferences.maxMinutes,
  readiness?: Readiness,
) {
  const program = currentProgram(data);
  const cycle = currentCycle(data);
  const workout = program.workouts[cycle.nextIndex % program.workouts.length];
  return adaptWorkout(
    workout,
    data,
    minutes,
    phase(cycle).reduced || (readiness && readinessAdvice(readiness).level !== 'normal') || false,
  );
}
export function isRecovery(data: AppData, today = localDate()) {
  const c = currentCycle(data);
  if (c.status !== 'active' || today < c.startDate || cycleWeek(c, today) > c.weeks) return true;
  if (data.settings.nextDate && data.settings.nextDate > today) return true;
  return (
    data.events.some((e) => e.date === today && e.type === 'rest') ||
    data.sessions.some((s) => s.date === today)
  );
}
export function nextTrainingDate(data: AppData, date = localDate()) {
  const next = addDays(date, Math.max(1, Math.round(7 / data.preferences.frequency)));
  if (!data.preferences.days.length) return next;
  for (let i = 0; i < 7; i++) {
    const candidate = addDays(next, i);
    const day = new Date(`${candidate}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short' });
    if (data.preferences.days.includes(day)) return candidate;
  }
  return next;
}
export function latestExercise(data: AppData, exerciseId: string, assistance?: string) {
  return [...data.sessions]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .flatMap((s) => s.exercises)
    .find(
      (e) =>
        e.exercise.id === exerciseId &&
        e.sets.length > 0 &&
        (assistance === undefined || e.sets.every((s) => s.assistance === assistance)),
    );
}
export function initialLoad(e: Exercise, data: AppData) {
  if (e.id === 'db-row' || e.id === 'two-db-row')
    return Math.min(data.profile.dumbbellWeight, data.equipment.totalPlates / 2);
  if (e.id === 'bb-row' || e.id === 'bb-rdl')
    return Math.min(data.profile.rowWeight, data.equipment.totalPlates);
  if (e.id === 'press') return Math.min(data.profile.pressWeight, data.equipment.totalPlates / 2);
  if (e.id === 'lateral' || e.id === 'rear-delt')
    return Math.min(3, data.equipment.totalPlates / 2);
  if (e.id === 'curl' || e.id === 'hammer') return Math.min(6, data.equipment.totalPlates / 2);
  if (e.equipment.includes('dumbbells'))
    return Math.min(data.profile.dumbbellWeight, data.equipment.totalPlates / 2);
  return 0;
}
export interface Recommendation {
  weight: number;
  reps: number[];
  message: string;
  previous: LoggedExercise | undefined;
  band: string;
}
export function progression(
  data: AppData,
  p: ExercisePrescription,
  exercise?: Exercise,
): Recommendation {
  const e = exercise || library(data).find((e) => e.id === p.exerciseId)!;
  const band =
    e.id === 'assisted-pullup' || e.id === 'pullup-hold'
      ? data.equipment.bands.find((b) => b.id === data.equipment.selectedBand)?.label || ''
      : '';
  const previous = latestExercise(data, e.id, band || undefined);
  const cycle = currentCycle(data);
  const basis = cycle.resetLoads
    ? latestExercise(
        { ...data, sessions: data.sessions.filter((s) => s.cycleId === cycle.id) },
        e.id,
        band || undefined,
      )
    : previous;
  const load = basis?.sets[0]?.weight ?? initialLoad(e, data);
  const full = basis && basis.sets.length >= p.sets && !basis.skipped;
  const top =
    full &&
    basis.sets.every((s) => s.reps >= p.max && s.rir !== null && s.rir >= Math.max(1, p.rir));
  const mixedLoads = basis && basis.sets.some((s) => s.weight !== load);
  const base = Array.from({ length: p.sets }, (_, i) =>
    Math.max(p.min, Math.min(p.max, basis?.sets[i] ? basis.sets[i].reps + 1 : p.min)),
  );
  if (top && !mixedLoads) {
    if (band)
      return {
        weight: load,
        reps: Array(p.sets).fill(p.min),
        message:
          'Try one level less assistance, if clean reps remain at RIR 2. Select the band before logging; do not compare different bands as equal load.',
        previous,
        band,
      };
    const cap = e.equipment.includes('dumbbells')
      ? data.equipment.totalPlates / 2
      : data.equipment.totalPlates;
    if (load > 0 && load + 1 <= cap)
      return {
        weight: load + 1,
        reps: Array(p.sets).fill(p.min),
        message: `All sets reached the ceiling with RIR recorded. Try ${load + 1} kg if your smallest increment allows; return to ${p.min} reps.`,
        previous,
        band,
      };
    return {
      weight: load,
      reps: Array(p.sets).fill(p.max),
      message:
        'Load is capped or bodyweight-only: use a 3-second lowering, a pause, or a harder comfortable variation. Keep the same sets.',
      previous,
      band,
    };
  }
  const lowRir = basis?.sets.some((s) => s.rir !== null && s.rir < p.rir);
  return {
    weight: load,
    reps: lowRir
      ? Array.from({ length: p.sets }, (_, i) => Math.max(1, basis?.sets[i]?.reps || p.min))
      : base,
    message: basis
      ? lowRir
        ? 'Keep resistance and reps steady. Leave more clean reps in reserve before progressing.'
        : `Keep resistance; aim for ${base.join(' / ')} clean ${e.unit === 'seconds' ? 'seconds' : 'reps'}. Missing RIR never triggers an automatic load increase.`
      : `Begin at ${p.min} ${e.unit === 'seconds' ? 'seconds' : 'reps'}, RIR ${p.rir}. Adjust to a clean, repeatable effort.`,
    previous,
    band,
  };
}
export function recommendedRoutine(data: AppData) {
  if (data.settings.routineId)
    return routines.find((r) => r.id === data.settings.routineId) || routines[0];
  const index = Math.abs(daysBetween('2026-01-01', localDate()));
  if (data.profile.posture.includes('Posterior pelvic tilt')) return routines[index % 3];
  return routines[1];
}
export function caloriesEstimate(profile: UserProfile, frequency: number) {
  const bmr =
    10 * profile.weight +
    6.25 * profile.height -
    5 * profile.age +
    (profile.sex === 'male' ? 5 : profile.sex === 'female' ? -161 : -78);
  const maintenance = bmr * (frequency >= 4 ? 1.6 : 1.5);
  return {
    low: Math.round((maintenance + 100) / 100) * 100,
    high: Math.round((maintenance + 250) / 100) * 100,
    maintenance: Math.round(maintenance / 100) * 100,
  };
}
export function recommendedNutrition(data: AppData): NutritionTargets {
  const range = caloriesEstimate(data.profile, data.preferences.frequency);
  const calories = data.goals.muscleGain
    ? Math.round((range.low + range.high) / 200) * 100
    : range.maintenance;
  const protein = Math.round(data.profile.weight * 2);
  const fat = Math.round(data.profile.weight);
  return {
    ...data.nutrition,
    calories,
    protein,
    fat,
    carbs: Math.round((calories - protein * 4 - fat * 9) / 4),
    manual: false,
  };
}
export function movingAverage(entries: { date: string; value: number }[], days = 7) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((entry) => ({
    date: entry.date,
    value: sorted
      .filter((e) => e.date <= entry.date && daysBetween(e.date, entry.date) < days)
      .reduce((s, e, _, a) => s + e.value / a.length, 0),
  }));
}
export function nutritionAdvice(data: AppData) {
  const end = localDate();
  const first = addDays(end, -20);
  const weighins = data.weights.filter((w) => w.date >= first && w.date <= end);
  const early = weighins.filter((w) => w.date <= addDays(first, 6));
  const late = weighins.filter((w) => w.date >= addDays(end, -6));
  if (early.length < 3 || late.length < 3)
    return {
      delta: 0,
      message:
        'Collect at least 3 weigh-ins in each of the first and last weeks of a 3-week window. Review the trend, not a single day.',
    };
  const avg = (list: typeof weighins) => list.reduce((s, w) => s + w.value, 0) / list.length;
  const change = (avg(late) - avg(early)) / 2;
  if (change > 0.4)
    return {
      delta: -100,
      message:
        'Average weight is rising by more than about 0.4 kg/week. Consider 100 kcal less, then reassess over two weeks.',
    };
  const recent = data.sessions.filter((s) => s.date >= first);
  const benchmarks = data.performance
    .filter((p) => p.date >= first && p.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
  const initial = benchmarks[0],
    latest = benchmarks.at(-1);
  const assessmentProgress =
    initial &&
    latest &&
    (latest.pullups > initial.pullups ||
      latest.dips > initial.dips ||
      latest.pushups > initial.pushups ||
      (latest.band === initial.band && latest.assisted > initial.assisted));
  const progressed =
    assessmentProgress ||
    recent.some((s) =>
      s.exercises.some((e) => {
        const prev = [...data.sessions]
          .filter((other) => other.startedAt < s.startedAt)
          .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
          .flatMap((s) => s.exercises)
          .find(
            (other) =>
              other.exercise.id === e.exercise.id &&
              other.sets[0]?.assistance === e.sets[0]?.assistance,
          );
        return (
          prev &&
          Math.max(...e.sets.map((s) => (s.weight || 1) * (s.reps || 1))) >
            Math.max(...prev.sets.map((s) => (s.weight || 1) * (s.reps || 1)))
        );
      }),
    );
  if (Math.abs(change) < 0.08 && recent.length >= 4 && !progressed)
    return {
      delta: 100,
      message:
        'Weight and logged load × reps have been fairly static for three weeks. Consider 100 kcal more and review training consistency.',
    };
  return {
    delta: 0,
    message:
      'Your trend does not call for a change. Keep targets steady and review again after a few weeks.',
  };
}
export function programVersion(
  data: AppData,
  workouts: WorkoutTemplate[],
  reason: string,
): ProgramVersion {
  return {
    id: uid(),
    createdAt: new Date().toISOString(),
    label: `Program v${data.programs.length + 1}`,
    workouts: structuredClone(workouts),
    reason,
  };
}
export function cycleRecommendations(data: AppData, cycle: TrainingCycle) {
  const sessions = data.sessions.filter((s) => s.cycleId === cycle.id);
  const adherence = sessions.length / Math.max(1, cycle.weeks * data.preferences.frequency);
  const skipped = sessions.flatMap((s) =>
    s.exercises.filter((e) => e.skipped).map((e) => e.exercise.name),
  );
  return [
    adherence < 0.7
      ? 'Choose fewer or shorter sessions if that fits your week better.'
      : 'Keep the sequence and progress clean reps before load.',
    `Latest baseline: ${data.profile.pullups} strict pull-ups, ${data.profile.dips} dips. Use current values or reassess comfortably.`,
    skipped.length
      ? `Review recurring skipped movements: ${[...new Set(skipped)].join(', ')}.`
      : 'No recurring exercise skips recorded.',
    cycle.feedback?.needsWork
      ? `Give extra attention to: ${cycle.feedback.needsWork}.`
      : 'Preserve balanced legs, posterior chain, and core work.',
    cycle.feedback?.discomfort
      ? `Substitute painful movements: ${cycle.feedback.discomfort}. Stop for sharp or joint pain.`
      : 'Use feedback to keep movements comfortable.',
    cycle.feedback?.emphasis
      ? `Requested focus: ${cycle.feedback.emphasis}. Reorder priorities before generating the next program.`
      : `Current priority: ${data.goals.priorities.slice(0, 3).join(', ')}.`,
    `Weight trend: ${data.weights.filter((w) => w.date >= cycle.startDate).length} weigh-ins; nutrition changes remain your choice.`,
  ];
}
