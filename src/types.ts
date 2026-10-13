export type EquipmentId =
  'pullup' | 'dips' | 'chair' | 'bands' | 'dumbbells' | 'barbell' | 'mat' | 'roller';
export type Muscle = 'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Core' | 'Legs' | 'Glutes';
export interface UserProfile {
  sex: 'male' | 'female' | 'other';
  age: number;
  height: number;
  weight: number;
  pullups: number;
  assisted: number;
  dips: number;
  pushups: number;
  dumbbellWeight: number;
  rowWeight: number;
  pressWeight: number;
  posture: string[];
}
export interface Equipment {
  available: EquipmentId[];
  totalPlates: number;
  bands: { id: string; label: string; assistance: string }[];
  selectedBand: string;
}
export interface Goals {
  muscleGain: boolean;
  posture: boolean;
  abs: boolean;
  strength: boolean;
  targetWeight: number;
  priorities: Muscle[];
}
export interface TrainingPreferences {
  frequency: number;
  days: string[];
  maxMinutes: number;
  mobilityDays: number;
  experience: string;
  preferred: string[];
  avoid: string[];
  injuries: string;
}
export type Category = 'Compound' | 'Isolation' | 'Core' | 'Mobility' | 'Posture' | 'Warm-up';
export interface Exercise {
  id: string;
  name: string;
  muscles: Muscle[];
  secondary: string[];
  equipment: EquipmentId[];
  movement: string;
  category: Category;
  instructions: string[];
  mistakes: string;
  cue: string;
  reps: [number, number];
  unit?: 'seconds';
  rest: number;
  rir: number;
  progression: string;
  regression: string;
  substitutes: string[];
}
export interface ExercisePrescription {
  exerciseId: string;
  sets: number;
  min: number;
  max: number;
  rest: number;
  rir: number;
  notes: string;
  group?: string;
}
export interface WorkoutTemplate {
  id: string;
  name: string;
  focus: string;
  exercises: ExercisePrescription[];
}
export interface ProgramVersion {
  id: string;
  createdAt: string;
  label: string;
  workouts: WorkoutTemplate[];
  reason: string;
}
export interface ExerciseSet {
  id: string;
  reps: number;
  weight: number;
  rir: number | null;
  assistance: string;
  completedAt: string;
}
export interface LoggedExercise {
  exercise: Exercise;
  prescription: ExercisePrescription;
  sets: ExerciseSet[];
  skipped?: boolean;
}
export interface WorkoutSession {
  id: string;
  date: string;
  startedAt: string;
  endedAt: string;
  duration: number;
  cycleId: string;
  programId: string;
  workoutId: string;
  name: string;
  exercises: LoggedExercise[];
  notes: string;
  readiness: Readiness;
}
export interface Readiness {
  energy: number;
  sleep: number;
  soreness: number;
}
export interface CycleFeedback {
  satisfaction: number;
  improved: string;
  needsWork: string;
  disliked: string;
  discomfort: string;
  emphasis: string;
}
export interface TrainingCycle {
  id: string;
  name: string;
  startDate: string;
  weeks: number;
  status: 'active' | 'paused' | 'ended';
  pausedAt: string | null;
  pausedDays: number;
  endedAt: string | null;
  archived: boolean;
  baseline: UserProfile;
  endBaseline?: UserProfile;
  resetLoads?: boolean;
  programId: string;
  nextIndex: number;
  feedback: CycleFeedback | null;
  sourceId?: string;
}
export interface DailyRoutine {
  id: string;
  name: string;
  minutes: number;
  description: string;
  items: { exerciseId: string; dose: string }[];
}
export interface BodyWeightEntry {
  id: string;
  date: string;
  value: number;
}
export interface MeasurementEntry {
  id: string;
  date: string;
  waist: number;
  chest: number;
  shoulders: number;
  arm: number;
  thigh: number;
}
export interface PerformanceEntry {
  id: string;
  date: string;
  pullups: number;
  assisted: number;
  band: string;
  dips: number;
  pushups: number;
}
export interface NutritionTargets {
  mode: 'simple' | 'macros';
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  manual: boolean;
}
export interface MealTemplate {
  id: string;
  name: string;
  slot: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}
export interface NutritionDay {
  date: string;
  meals: string[];
  logs: {
    id: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }[];
  selections: Record<string, string>;
}
export interface ScheduleEvent {
  id: string;
  date: string;
  type: 'skip' | 'rest' | 'move';
  cycleId: string;
  workoutId: string;
  note: string;
}
export interface WorkoutDraft {
  id: string;
  startedAt: string;
  date: string;
  cycleId: string;
  programId: string;
  workoutId: string;
  name: string;
  exercises: LoggedExercise[];
  exerciseIndex: number;
  restEnd: number | null;
  pausedRest: number | null;
  readiness: Readiness;
  minutes: number;
  notes: string;
}
export interface AppSettings {
  tab: string;
  units: 'metric';
  routineId: string | null;
  nextDate: string | null;
}
export interface AppData {
  schemaVersion: 1;
  profile: UserProfile;
  equipment: Equipment;
  goals: Goals;
  preferences: TrainingPreferences;
  programs: ProgramVersion[];
  currentProgramId: string;
  cycles: TrainingCycle[];
  currentCycleId: string;
  sessions: WorkoutSession[];
  mobility: { date: string; routineId: string }[];
  events: ScheduleEvent[];
  weights: BodyWeightEntry[];
  measurements: MeasurementEntry[];
  performance: PerformanceEntry[];
  nutrition: NutritionTargets;
  nutritionDays: NutritionDay[];
  customExercises: Exercise[];
  settings: AppSettings;
  draft: WorkoutDraft | null;
}
