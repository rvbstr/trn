import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Download, Plus, Save, Trash2, Upload } from 'lucide-react';
import { useApp } from '../context';
import { Button, Field, Label, Modal, PageTitle, Select, TextArea, Toggle } from '../components';
import { library, programVersion, recommendedNutrition, recommendedWorkouts } from '../engine';
import { initialData } from '../data';
import { downloadJson, STORAGE_KEY, validateData, validateProfile } from '../storage';
import { localDate, uid } from '../utils';
import { equipmentNames } from './Exercises';
import { Cycle } from './Cycle';
import type { AppData, EquipmentId, Goals, TrainingPreferences, UserProfile } from '../types';

export function Settings() {
  const { data, update, replace, notify, go, storageError } = useApp();
  const [section, setSection] = useState(storageError ? 'Data' : 'Profile');
  const [profile, setProfile] = useState({ ...data.profile });
  const [goals, setGoals] = useState({ ...data.goals, priorities: [...data.goals.priorities] });
  const [preferences, setPreferences] = useState(structuredClone(data.preferences));
  const [equipment, setEquipment] = useState(structuredClone(data.equipment));
  const [query, setQuery] = useState('');
  const [pendingImport, setPendingImport] = useState<AppData | null>(null);
  const [importError, setImportError] = useState('');
  const [reset, setReset] = useState(false);
  const [resetText, setResetText] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  function saveProfile() {
    try {
      validateProfile(profile);
    } catch {
      notify('Check profile values and strength ranges.');
      return;
    }
    if (
      profile.age < 16 ||
      profile.age > 100 ||
      profile.height < 100 ||
      profile.height > 250 ||
      profile.weight < 30 ||
      profile.weight > 300 ||
      profile.pullups < 0 ||
      profile.pullups > 100 ||
      profile.assisted < 0 ||
      profile.assisted > 100 ||
      profile.dips < 0 ||
      profile.dips > 200 ||
      profile.pushups < 0 ||
      profile.pushups > 300 ||
      [profile.dumbbellWeight, profile.rowWeight, profile.pressWeight].some((n) => n < 0 || n > 300)
    ) {
      notify('Check your age, height, weight, strength, and working-weight ranges.');
      return;
    }
    update((d) => {
      d.profile = structuredClone(profile);
    });
    notify('Profile saved. Existing workout records are unchanged.');
  }
  function saveGoals() {
    if (
      !Number.isFinite(goals.targetWeight) ||
      goals.targetWeight < 30 ||
      goals.targetWeight > 300
    ) {
      notify('Enter a body-weight goal from 30–300 kg.');
      return;
    }
    update((d) => {
      d.goals = structuredClone(goals);
    });
    notify('Goals saved. Regenerate the program to apply priorities.');
  }
  function savePreferences() {
    if (
      [preferences.frequency, preferences.maxMinutes, preferences.mobilityDays].some(
        (n) => !Number.isInteger(n),
      ) ||
      preferences.frequency < 1 ||
      preferences.frequency > 7 ||
      preferences.maxMinutes < 20 ||
      preferences.maxMinutes > 120 ||
      preferences.mobilityDays < 0 ||
      preferences.mobilityDays > 7
    ) {
      notify('Check schedule ranges.');
      return;
    }
    update((d) => {
      d.preferences = structuredClone(preferences);
    });
    notify('Schedule and movement preferences saved.');
  }
  function saveEquipment() {
    if (
      !Number.isFinite(equipment.totalPlates) ||
      equipment.totalPlates < 0 ||
      equipment.totalPlates > 500 ||
      equipment.bands.some((b) => !b.label.trim()) ||
      new Set(equipment.bands.map((b) => b.label.trim())).size !== equipment.bands.length
    ) {
      notify('Use distinct, nonempty band labels and 0–500 kg total plates.');
      return;
    }
    update((d) => {
      d.equipment = structuredClone(equipment);
      if (!equipment.bands.some((b) => b.id === equipment.selectedBand))
        d.equipment.selectedBand = equipment.bands[0]?.id || '';
    });
    notify('Equipment saved. Regenerate your program to apply changes.');
  }
  function regenerate() {
    const workouts = recommendedWorkouts(data);
    if (workouts.some((w) => !w.exercises.length)) {
      notify('Equipment or exclusions leave a workout empty. Adjust those settings first.');
      return;
    }
    if (
      !window.confirm(
        'Replace custom program settings with a new recommendation? Old versions and historical workouts are preserved.',
      )
    )
      return;
    update((d) => {
      const p = programVersion(
        d,
        workouts,
        'Updated profile, schedule, equipment, and muscle priorities',
      );
      d.programs.push(p);
      d.currentProgramId = p.id;
      d.cycles.find((c) => c.id === d.currentCycleId)!.programId = p.id;
    });
    notify('New program generated from saved settings.');
  }
  async function importFile(file: File) {
    setImportError('');
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('This backup is larger than 10 MB.');
      const parsed = validateData(JSON.parse(await file.text()));
      setPendingImport(parsed);
    } catch (e) {
      setImportError(
        e instanceof Error
          ? `Import rejected: ${e.message.split('\n').slice(0, 4).join(' ')}`
          : 'This file is not a valid TRN backup.',
      );
    }
    if (fileInput.current) fileInput.current.value = '';
  }
  function reorder(i: number, delta: number) {
    const list = [...goals.priorities];
    [list[i], list[i + delta]] = [list[i + delta], list[i]];
    setGoals({ ...goals, priorities: list });
  }
  const tabs = [
    'Profile',
    'Goals',
    'Schedule',
    'Equipment',
    'Program',
    'Training cycles',
    'Nutrition',
    'Data',
  ];
  return (
    <>
      <PageTitle
        eyebrow="MAKE IT YOURS"
        title="Your practice, your parameters."
        description="Change what’s ahead. Keep what you’ve done."
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {tabs.map((t) => (
            <button key={t} className={section === t ? 'active' : ''} onClick={() => setSection(t)}>
              {t}
            </button>
          ))}
        </nav>
        <div className="settings-content">
          {section === 'Profile' && (
            <section className="card">
              <Label>PERSONAL BASELINE</Label>
              <h2>A starting point, not a limit.</h2>
              <div className="form-grid">
                <Select
                  label="Sex (calorie estimate)"
                  value={profile.sex}
                  onChange={(v) => setProfile({ ...profile, sex: v as UserProfile['sex'] })}
                >
                  {['male', 'female', 'other'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
                {(
                  [
                    'age',
                    'height',
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
                        age: 'Age · years',
                        height: 'Height · cm',
                        weight: 'Weight · kg',
                        pullups: 'Strict pull-up maximum',
                        assisted: 'Assisted pull-up reps',
                        dips: 'Dip maximum',
                        pushups: 'Push-up maximum',
                        dumbbellWeight: 'Common dumbbell · kg each',
                        rowWeight: 'Barbell row working weight · kg',
                        pressWeight: 'DB overhead press · kg each',
                      }[k]
                    }
                    type="number"
                    min={0}
                    step={k === 'weight' ? 0.1 : 1}
                    value={profile[k]}
                    onChange={(v) => setProfile({ ...profile, [k]: Number(v) })}
                  />
                ))}
              </div>
              <h3>Posture / movement tendencies</h3>
              <p className="small muted">
                Your observations, not a diagnosis. Pelvic position varies; professional assessment
                may help if there is pain or significant movement limitation.
              </p>
              <div className="equipment-toggles">
                {[
                  'Posterior pelvic tilt',
                  'Anterior pelvic tilt',
                  'Rounded shoulders',
                  'Forward head tendency',
                  'Thoracic stiffness',
                  'None / unsure',
                ].map((p) => (
                  <Toggle
                    key={p}
                    checked={profile.posture.includes(p)}
                    onChange={() =>
                      setProfile({
                        ...profile,
                        posture: profile.posture.includes(p)
                          ? profile.posture.filter((x) => x !== p)
                          : p === 'None / unsure'
                            ? [p]
                            : [...profile.posture.filter((x) => x !== 'None / unsure'), p],
                      })
                    }
                  >
                    {p}
                  </Toggle>
                ))}
              </div>
              <Button onClick={saveProfile}>
                <Save size={16} />
                Save profile
              </Button>
              <p className="small muted">
                Historical workout snapshots and assessments remain intact. Use Progress to record a
                dated benchmark or weight.
              </p>
            </section>
          )}
          {section === 'Goals' && (
            <section className="card">
              <Label>YOUR DIRECTION</Label>
              <h2>Athletic, capable, balanced.</h2>
              {(['muscleGain', 'posture', 'abs', 'strength'] as const).map((k) => (
                <Toggle
                  key={k}
                  checked={goals[k]}
                  onChange={() => setGoals({ ...goals, [k]: !goals[k] })}
                >
                  {
                    {
                      muscleGain: 'Gradual muscle gain',
                      posture: 'Posture & movement capacity',
                      abs: 'Visible abdominal definition',
                      strength: 'Pull-up & upper-body strength',
                    }[k]
                  }
                </Toggle>
              ))}
              <Field
                label="Body-weight goal · kg"
                type="number"
                min={30}
                max={300}
                step={0.1}
                value={goals.targetWeight}
                onChange={(v) => setGoals({ ...goals, targetWeight: Number(v) })}
              />
              <h3>Muscle priorities</h3>
              <p className="small muted">
                Reorder to choose accessory emphasis. Essential lower-body and core work stays
                balanced.
              </p>
              <div className="priority-list">
                {goals.priorities.map((m, i) => (
                  <div key={m}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    <strong>{m}</strong>
                    <button
                      className="icon-button"
                      aria-label={`Move ${m} up`}
                      disabled={i === 0}
                      onClick={() => reorder(i, -1)}
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Move ${m} down`}
                      disabled={i === goals.priorities.length - 1}
                      onClick={() => reorder(i, 1)}
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <Button onClick={saveGoals}>Save goals</Button>
            </section>
          )}
          {section === 'Schedule' && (
            <section className="card">
              <Label>A SUSTAINABLE RHYTHM</Label>
              <h2>Make space for the work.</h2>
              <div className="form-grid">
                <Field
                  label="Strength workouts / week"
                  type="number"
                  min={1}
                  max={7}
                  step={1}
                  value={preferences.frequency}
                  onChange={(v) => setPreferences({ ...preferences, frequency: Number(v) })}
                />
                <Field
                  label="Maximum session · minutes"
                  type="number"
                  min={20}
                  max={120}
                  step={1}
                  value={preferences.maxMinutes}
                  onChange={(v) => setPreferences({ ...preferences, maxMinutes: Number(v) })}
                />
                <Field
                  label="Daily mobility · days / week"
                  type="number"
                  min={0}
                  max={7}
                  step={1}
                  value={preferences.mobilityDays}
                  onChange={(v) => setPreferences({ ...preferences, mobilityDays: Number(v) })}
                />
                <Select
                  label="Experience"
                  value={preferences.experience}
                  onChange={(v) => setPreferences({ ...preferences, experience: v })}
                >
                  {['Beginner / returning', 'Intermediate', 'Experienced'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </Select>
              </div>
              <h3>Preferred days · optional</h3>
              <div className="day-pills">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <button
                    key={day}
                    className={preferences.days.includes(day) ? 'active' : ''}
                    onClick={() =>
                      setPreferences({
                        ...preferences,
                        days: preferences.days.includes(day)
                          ? preferences.days.filter((d) => d !== day)
                          : [...preferences.days, day],
                      })
                    }
                  >
                    {day}
                  </button>
                ))}
              </div>
              <p className="small muted">
                A preference, never a fixed calendar requirement. The A → B → C sequence continues
                after a missed day.
              </p>
              <TextArea
                label="Injuries or painful movements"
                value={preferences.injuries}
                onChange={(v) => setPreferences({ ...preferences, injuries: v })}
                placeholder="Notes to review before training. Mark related movements as Avoid below."
              />
              <div className="warning small">
                Stop or substitute for sharp or joint pain. Notes cannot diagnose an injury;
                explicitly exclude painful movements below.
              </div>
              <Field label="Find movement preferences" value={query} onChange={setQuery} />
              <div className="movement-preferences">
                <div className="preference-heading">
                  <span>Exercise</span>
                  <span>Prefer</span>
                  <span>Avoid</span>
                </div>
                {library(data)
                  .filter(
                    (e) =>
                      ['Compound', 'Isolation', 'Core'].includes(e.category) &&
                      e.name.toLowerCase().includes(query.toLowerCase()),
                  )
                  .map((e) => (
                    <div key={e.id}>
                      <span>{e.name}</span>
                      {(['preferred', 'avoid'] as const).map((k) => (
                        <input
                          key={k}
                          type="checkbox"
                          aria-label={`${k === 'avoid' ? 'Avoid' : 'Prefer'} ${e.name}`}
                          checked={preferences[k].includes(e.id)}
                          onChange={() =>
                            setPreferences({
                              ...preferences,
                              [k]: preferences[k].includes(e.id)
                                ? preferences[k].filter((x) => x !== e.id)
                                : [...preferences[k], e.id],
                              [k === 'avoid' ? 'preferred' : 'avoid']: preferences[
                                k === 'avoid' ? 'preferred' : 'avoid'
                              ].filter((x) => x !== e.id),
                            })
                          }
                        />
                      ))}
                    </div>
                  ))}
              </div>
              <Button onClick={savePreferences}>Save schedule & preferences</Button>
            </section>
          )}
          {section === 'Equipment' && (
            <section className="card">
              <Label>YOUR HOME SETUP</Label>
              <h2>Work with what you have.</h2>
              <div className="equipment-toggles">
                {Object.entries(equipmentNames).map(([id, name]) => (
                  <Toggle
                    key={id}
                    checked={equipment.available.includes(id as EquipmentId)}
                    onChange={() =>
                      setEquipment({
                        ...equipment,
                        available: equipment.available.includes(id as EquipmentId)
                          ? equipment.available.filter((e) => e !== id)
                          : [...equipment.available, id as EquipmentId],
                      })
                    }
                  >
                    {name}
                  </Toggle>
                ))}
              </div>
              <Field
                label="Available weight plates · kg total"
                type="number"
                min={0}
                max={500}
                step={0.5}
                value={equipment.totalPlates}
                onChange={(v) => setEquipment({ ...equipment, totalPlates: Number(v) })}
                help="Conservative load recommendations use half this total per dumbbell. Bar weight and exact plate increments vary; adjust logged load."
              />
              <h3>Your resistance bands</h3>
              {equipment.bands.map((band, i) => (
                <div className="band-editor" key={band.id}>
                  <Field
                    label="Label"
                    value={band.label}
                    onChange={(v) =>
                      setEquipment({
                        ...equipment,
                        bands: equipment.bands.map((b, j) => (i === j ? { ...b, label: v } : b)),
                      })
                    }
                  />
                  <Field
                    label="Assistance / resistance"
                    value={band.assistance}
                    onChange={(v) =>
                      setEquipment({
                        ...equipment,
                        bands: equipment.bands.map((b, j) =>
                          i === j ? { ...b, assistance: v } : b,
                        ),
                      })
                    }
                  />
                  <button
                    className="icon-button"
                    aria-label={`Remove ${band.label} band`}
                    onClick={() =>
                      setEquipment({
                        ...equipment,
                        bands: equipment.bands.filter((_, j) => i !== j),
                      })
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button
                className="text-link"
                onClick={() =>
                  setEquipment({
                    ...equipment,
                    bands: [
                      ...equipment.bands,
                      { id: uid(), label: `Band ${equipment.bands.length + 1}`, assistance: '' },
                    ],
                  })
                }
              >
                <Plus size={15} />
                Add a band
              </button>
              <Select
                label="Current pull-up assistance"
                value={equipment.selectedBand}
                onChange={(v) => setEquipment({ ...equipment, selectedBand: v })}
              >
                {!equipment.bands.length && <option value="">No bands</option>}
                {equipment.bands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </Select>
              <Button onClick={saveEquipment}>Save equipment</Button>
            </section>
          )}
          {section === 'Program' && (
            <section className="card">
              <Label>RECOMMENDATIONS & YOUR EDITS</Label>
              <h2>Let the plan follow you.</h2>
              <p>
                After saving profile, equipment, exclusions, goals or schedule, regenerate to apply
                those parameters. This preserves old versions and historical workouts. Ongoing
                sessions retain their original snapshot.
              </p>
              <div className="button-row">
                <Button onClick={regenerate}>Generate from saved settings</Button>
                <Button variant="secondary" onClick={() => go('Plan')}>
                  Open program editor
                </Button>
              </div>
              <p className="small muted">
                An injury note is shown before training. Use explicit movement exclusions to remove
                painful exercises from generated plans.
              </p>
            </section>
          )}
          {section === 'Training cycles' && <Cycle />}
          {section === 'Nutrition' && (
            <section className="card">
              <Label>A STARTING ESTIMATE</Label>
              <h2>Adjust slowly, with evidence.</h2>
              <p>
                Targets stay unchanged until you choose to update them. Use the current profile
                estimate, or set your own calories and macros in Nutrition.
              </p>
              <div className="button-row">
                <Button
                  onClick={() => {
                    if (
                      window.confirm(
                        'Replace nutrition targets with an estimate from the current profile?',
                      )
                    ) {
                      update((d) => {
                        d.nutrition = recommendedNutrition(d);
                      });
                      notify('Profile-based nutrition targets applied.');
                    }
                  }}
                >
                  Apply profile estimate
                </Button>
                <Button variant="secondary" onClick={() => go('Nutrition')}>
                  Edit nutrition targets
                </Button>
              </div>
            </section>
          )}
          {section === 'Data' && (
            <section className="card">
              <Label>YOUR NOTEBOOK BELONGS TO YOU</Label>
              <h2>Keep a copy.</h2>
              <p>
                Data is stored in this browser on this site’s origin. Clearing website data or using
                a different browser will not carry it over. Export a backup regularly.
              </p>
              <div className="data-counts">
                <span>{data.sessions.length} sessions</span>
                <span>{data.cycles.length} cycles</span>
                <span>{data.weights.length} weigh-ins</span>
                <span>{data.programs.length} program versions</span>
              </div>
              <div className="button-row">
                <Button onClick={() => downloadJson(data, `trn-backup-${localDate()}.json`)}>
                  <Download size={16} />
                  Export all data
                </Button>
                <Button variant="secondary" onClick={() => fileInput.current?.click()}>
                  <Upload size={16} />
                  Import JSON backup
                </Button>
              </div>
              <input
                type="file"
                accept="application/json,.json"
                ref={fileInput}
                className="sr-only"
                aria-label="Import data file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void importFile(f);
                }}
              />
              {importError && (
                <div className="warning" role="alert">
                  {importError}
                </div>
              )}
              {storageError && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    const raw = localStorage.getItem(STORAGE_KEY);
                    downloadJson({ originalStorage: raw }, `trn-recovery-${localDate()}.json`);
                  }}
                >
                  Download original storage for recovery
                </Button>
              )}
              <div className="note">
                <strong>Everything is included.</strong>
                <p>
                  Profile, equipment, goals, program versions, cycles, every logged set, unfinished
                  workout and timer, mobility, meals, nutrition targets, weights, measurements,
                  custom exercises, and preferences. Import validates the complete format before
                  replacement.
                </p>
              </div>
              <h3>A fresh notebook</h3>
              <p className="small muted">Reset removes all local application data. Export first.</p>
              <Button variant="danger" onClick={() => setReset(true)}>
                Reset app
              </Button>
            </section>
          )}
        </div>
      </div>
      {pendingImport && (
        <Modal title="Restore this notebook?" onClose={() => setPendingImport(null)}>
          <p>
            This backup contains {pendingImport.sessions.length} sessions,{' '}
            {pendingImport.cycles.length} cycles, {pendingImport.weights.length} weigh-ins, and{' '}
            {pendingImport.programs.length} program versions.
          </p>
          <div className="warning">
            Import replaces all current local data, including any unfinished session. Export your
            current notebook first if you want to keep it.
          </div>
          <div className="button-row">
            <Button
              variant="secondary"
              onClick={() => downloadJson(data, `trn-before-import-${localDate()}.json`)}
            >
              Export current data
            </Button>
            <Button
              onClick={() => {
                replace(pendingImport);
                setPendingImport(null);
                notify('Backup restored.');
              }}
            >
              Replace & restore
            </Button>
          </div>
        </Modal>
      )}
      {reset && (
        <Modal title="Reset your entire notebook?" onClose={() => setReset(false)}>
          <div className="warning">
            All workouts, cycles, measurements, meals, and personal settings on this browser will be
            removed. This cannot be undone without a backup.
          </div>
          <Field label="Type RESET to confirm" value={resetText} onChange={setResetText} />
          <Button
            variant="danger"
            disabled={resetText !== 'RESET'}
            onClick={() => {
              replace(initialData());
              setReset(false);
              setResetText('');
              notify('A fresh notebook is ready.');
            }}
          >
            Delete all data & reset
          </Button>
        </Modal>
      )}
    </>
  );
}
