import { z } from 'zod';
import { exercises, initialData } from './data';
import type { AppData } from './types';

export const STORAGE_KEY = 'trn.notebook.v1';
const finite = z.number().finite();
const positive = finite.min(0);
const id = z.string().min(1).max(150);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s, 'Invalid date');
const iso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid timestamp');
const eq = z.enum(['pullup', 'dips', 'chair', 'bands', 'dumbbells', 'barbell', 'mat', 'roller']);
const muscle = z.enum(['Chest', 'Back', 'Shoulders', 'Arms', 'Core', 'Legs', 'Glutes']);
const profile = z.object({
  sex: z.enum(['male', 'female', 'other']),
  age: finite.int().min(16).max(100),
  height: finite.min(100).max(250),
  weight: finite.min(30).max(300),
  pullups: positive.max(100),
  assisted: positive.max(100),
  dips: positive.max(200),
  pushups: positive.max(300),
  dumbbellWeight: positive.max(300),
  rowWeight: positive.max(500),
  pressWeight: positive.max(300),
  posture: z.array(z.string()),
});
const exercise = z.object({
  id,
  name: z.string().min(1),
  muscles: z.array(muscle).min(1),
  secondary: z.array(z.string()),
  equipment: z.array(eq),
  movement: z.string(),
  category: z.enum(['Compound', 'Isolation', 'Core', 'Mobility', 'Posture', 'Warm-up']),
  instructions: z.array(z.string()).min(1),
  mistakes: z.string(),
  cue: z.string(),
  reps: z.tuple([positive, positive]),
  unit: z.literal('seconds').optional(),
  rest: positive,
  rir: positive,
  progression: z.string(),
  regression: z.string(),
  substitutes: z.array(z.string()),
});
const prescription = z
  .object({
    exerciseId: id,
    sets: finite.int().min(1).max(10),
    min: finite.min(1).max(300),
    max: finite.min(1).max(300),
    rest: positive.max(600),
    rir: positive.max(10),
    notes: z.string(),
    group: z.string().optional(),
  })
  .refine((p) => p.max >= p.min, 'Max reps must be at least min reps');
const set = z.object({
  id,
  reps: positive.max(1000),
  weight: positive.max(1000),
  rir: positive.max(10).nullable(),
  assistance: z.string(),
  completedAt: iso,
});
const logged = z.object({
  exercise,
  prescription,
  sets: z.array(set),
  skipped: z.boolean().optional(),
});
const readiness = z.object({
  energy: finite.int().min(1).max(5),
  sleep: finite.int().min(1).max(5),
  soreness: finite.int().min(1).max(5),
});
const feedback = z.object({
  satisfaction: finite.min(1).max(5),
  improved: z.string(),
  needsWork: z.string(),
  disliked: z.string(),
  discomfort: z.string(),
  emphasis: z.string(),
});
const schema = z.object({
  schemaVersion: z.literal(1),
  profile,
  equipment: z.object({
    available: z.array(eq),
    totalPlates: positive.max(500),
    bands: z.array(z.object({ id, label: z.string(), assistance: z.string() })),
    selectedBand: z.string(),
  }),
  goals: z.object({
    muscleGain: z.boolean(),
    posture: z.boolean(),
    abs: z.boolean(),
    strength: z.boolean(),
    targetWeight: finite.min(30).max(300),
    priorities: z
      .array(muscle)
      .length(7)
      .refine((a) => new Set(a).size === 7),
  }),
  preferences: z.object({
    frequency: finite.int().min(1).max(7),
    days: z.array(z.string()),
    maxMinutes: finite.int().min(20).max(120),
    mobilityDays: finite.int().min(0).max(7),
    experience: z.string(),
    preferred: z.array(z.string()),
    avoid: z.array(z.string()),
    injuries: z.string(),
  }),
  programs: z
    .array(
      z.object({
        id,
        createdAt: iso,
        label: z.string(),
        reason: z.string(),
        workouts: z
          .array(
            z.object({
              id,
              name: z.string(),
              focus: z.string(),
              exercises: z.array(prescription).min(1),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
  currentProgramId: id,
  cycles: z
    .array(
      z.object({
        id,
        name: z.string(),
        startDate: date,
        weeks: finite.int().min(1).max(52),
        status: z.enum(['active', 'paused', 'ended']),
        pausedAt: date.nullable(),
        pausedDays: positive,
        endedAt: date.nullable(),
        archived: z.boolean(),
        baseline: profile,
        endBaseline: profile.optional(),
        resetLoads: z.boolean().optional(),
        programId: id,
        nextIndex: positive.int(),
        feedback: feedback.nullable(),
        sourceId: id.optional(),
      }),
    )
    .min(1),
  currentCycleId: id,
  sessions: z.array(
    z.object({
      id,
      date,
      startedAt: iso,
      endedAt: iso,
      duration: positive,
      cycleId: id,
      programId: id,
      workoutId: id,
      name: z.string(),
      exercises: z.array(logged),
      notes: z.string(),
      readiness,
    }),
  ),
  mobility: z.array(z.object({ date, routineId: id })),
  events: z.array(
    z.object({
      id,
      date,
      type: z.enum(['skip', 'rest', 'move']),
      cycleId: id,
      workoutId: id,
      note: z.string(),
    }),
  ),
  weights: z.array(z.object({ id, date, value: finite.min(30).max(300) })),
  measurements: z.array(
    z.object({
      id,
      date,
      waist: positive,
      chest: positive,
      shoulders: positive,
      arm: positive,
      thigh: positive,
    }),
  ),
  performance: z.array(
    z.object({
      id,
      date,
      pullups: positive,
      assisted: positive,
      band: z.string(),
      dips: positive,
      pushups: positive,
    }),
  ),
  nutrition: z.object({
    mode: z.enum(['simple', 'macros']),
    calories: finite.min(1000).max(6000),
    protein: positive.max(400),
    carbs: positive.max(1000),
    fat: positive.max(300),
    manual: z.boolean(),
  }),
  nutritionDays: z.array(
    z.object({
      date,
      meals: z.array(z.string()),
      logs: z.array(
        z.object({
          id,
          name: z.string(),
          calories: positive,
          protein: positive,
          carbs: positive,
          fat: positive,
        }),
      ),
      selections: z.record(z.string(), z.string()),
    }),
  ),
  customExercises: z.array(exercise),
  settings: z.object({
    tab: z.string(),
    units: z.literal('metric'),
    routineId: z.string().nullable(),
    nextDate: date.nullable(),
  }),
  draft: z
    .object({
      id,
      startedAt: iso,
      date,
      cycleId: id,
      programId: id,
      workoutId: id,
      name: z.string(),
      exercises: z.array(logged).min(1),
      exerciseIndex: positive.int(),
      restEnd: positive.nullable(),
      pausedRest: positive.nullable(),
      readiness,
      minutes: positive,
      notes: z.string(),
    })
    .nullable(),
});
export function validateData(input: unknown): AppData {
  const parsed = schema.parse(input) as AppData;
  const programs = new Set(parsed.programs.map((p) => p.id));
  const cycles = new Set(parsed.cycles.map((c) => c.id));
  const exerciseIds = new Set([...exercises, ...parsed.customExercises].map((e) => e.id));
  if (
    programs.size !== parsed.programs.length ||
    cycles.size !== parsed.cycles.length ||
    new Set(parsed.sessions.map((s) => s.id)).size !== parsed.sessions.length
  )
    throw new Error('Duplicate program, cycle, or session IDs.');
  if (
    parsed.programs.some((p) =>
      p.workouts.some((w) => w.exercises.some((e) => !exerciseIds.has(e.exerciseId))),
    )
  )
    throw new Error('A program references a missing exercise.');
  if (!programs.has(parsed.currentProgramId) || !cycles.has(parsed.currentCycleId))
    throw new Error('Current program or cycle is missing.');
  if (
    parsed.cycles.some((c) => !programs.has(c.programId) || (c.status === 'paused' && !c.pausedAt))
  )
    throw new Error('A cycle references a missing program or pause date.');
  if (parsed.sessions.some((s) => !programs.has(s.programId) || !cycles.has(s.cycleId)))
    throw new Error('A workout references a missing program or cycle.');
  if (
    parsed.draft &&
    (!programs.has(parsed.draft.programId) ||
      !cycles.has(parsed.draft.cycleId) ||
      parsed.draft.exerciseIndex >= parsed.draft.exercises.length)
  )
    throw new Error('Invalid in-progress workout.');
  return parsed;
}
export const validateProfile = (input: unknown) => profile.parse(input);
export function readData(): { data: AppData; error: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return { data: raw ? validateData(JSON.parse(raw)) : initialData(), error: null };
  } catch {
    return {
      data: initialData(),
      error:
        'Saved data could not be loaded. Your original storage has been preserved. Download it from Data settings before replacing it.',
    };
  }
}
export function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
export function downloadJson(data: unknown, name: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
