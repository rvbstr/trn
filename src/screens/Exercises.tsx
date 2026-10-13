import { useState } from 'react';
import { ArrowRight, BookOpen, Plus, Search } from 'lucide-react';
import { useApp } from '../context';
import { Button, Field, Label, Modal, PageTitle, Select, TextArea, Toggle } from '../components';
import { compatible, library } from '../engine';
import { uid } from '../utils';
import type { EquipmentId, Exercise, Muscle } from '../types';

export const equipmentNames: Record<EquipmentId, string> = {
  pullup: 'Pull-up bar',
  dips: 'Parallel bars',
  chair: 'Captain’s chair',
  bands: 'Resistance bands',
  dumbbells: 'Adjustable dumbbells',
  barbell: 'Barbell',
  mat: 'Exercise mat',
  roller: 'Foam roller',
};
export function Exercises() {
  const { data, update, notify } = useApp();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [custom, setCustom] = useState(false);
  const [form, setForm] = useState({
    name: '',
    muscle: 'Chest' as Muscle,
    secondary: '',
    category: 'Compound' as Exercise['category'],
    movement: 'Horizontal push',
    instructions: '',
    cue: '',
    progression: '',
    regression: '',
    min: 8,
    max: 12,
    rest: 90,
    rir: 2,
    equipment: [] as EquipmentId[],
  });
  const list = library(data).filter(
    (e) =>
      (category === 'All' || e.category === category) &&
      (!onlyAvailable || compatible(e, data)) &&
      (e.name + ' ' + e.muscles.join(' ')).toLowerCase().includes(search.toLowerCase()),
  );
  function saveCustom() {
    if (
      !form.name.trim() ||
      !form.instructions.trim() ||
      !form.cue.trim() ||
      form.min < 1 ||
      form.max < form.min ||
      form.max > 300 ||
      form.rest < 0 ||
      form.rest > 600 ||
      form.rir < 0 ||
      form.rir > 10
    ) {
      notify('Add a name, instructions and cue, and check rep, rest and RIR ranges.');
      return;
    }
    const e: Exercise = {
      id: uid(),
      name: form.name.trim(),
      muscles: [form.muscle],
      secondary: form.secondary
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      equipment: form.equipment,
      movement: form.movement,
      category: form.category,
      instructions: form.instructions.split('\n').filter(Boolean),
      cue: form.cue,
      mistakes: 'Avoid forced range, momentum, and painful movement. Stop for sharp or joint pain.',
      reps: [form.min, form.max],
      rest: form.rest,
      rir: form.rir,
      progression: form.progression || 'Add clean reps before resistance.',
      regression: form.regression || 'Reduce load or use an easier comfortable variation.',
      substitutes: [],
    };
    update((d) => {
      d.customExercises.push(e);
    });
    setCustom(false);
    notify('Custom exercise added to your library and program editor.');
  }
  return (
    <>
      <PageTitle
        eyebrow="A REFERENCE, WHEN YOU NEED IT"
        title="Know the movement."
        description="Technique, intent, and a next step for every exercise."
        action={
          <Button variant="secondary" onClick={() => setCustom(true)}>
            <Plus size={16} />
            Custom exercise
          </Button>
        }
      />
      <div className="library-controls">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="Search exercises"
            placeholder="Find an exercise or muscle…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <Select label="Category" value={category} onChange={setCategory}>
          {['All', 'Compound', 'Isolation', 'Core', 'Mobility', 'Posture', 'Warm-up'].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <label className="check-line">
          <input
            type="checkbox"
            checked={onlyAvailable}
            onChange={(e) => setOnlyAvailable(e.target.checked)}
          />
          Available equipment only
        </label>
      </div>
      <div className="library-grid">
        {list.map((e) => (
          <button className="card library-card" key={e.id} onClick={() => setSelected(e)}>
            <div className="library-card-top">
              <Label>{e.category.toUpperCase()}</Label>
              <ArrowRight size={16} />
            </div>
            <h3>{e.name}</h3>
            <p>{e.muscles.join(' · ')}</p>
            <small>{e.equipment.map((id) => equipmentNames[id]).join(' · ') || 'Bodyweight'}</small>
            <div className="library-dose">
              <span>
                {e.reps.join('–')} {e.unit === 'seconds' ? 'seconds' : 'reps'}
              </span>
              <span>{e.rest}s rest</span>
            </div>
          </button>
        ))}
      </div>
      {!list.length && (
        <div className="empty">
          <BookOpen size={26} />
          <h3>No matching movements</h3>
          <p>Try a different name or category.</p>
        </div>
      )}
      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)}>
          <div className="pill-row">
            <span>{selected.category}</span>
            <span>{selected.movement}</span>
            <span>
              {selected.reps.join('–')} {selected.unit === 'seconds' ? 'sec' : 'reps'}
            </span>
          </div>
          <div className="note">
            <strong>{selected.cue}</strong>
          </div>
          <Label>PRIMARY MUSCLES</Label>
          <p>{selected.muscles.join(' · ')}</p>
          {selected.secondary.length > 0 && (
            <>
              <Label>SECONDARY</Label>
              <p>{selected.secondary.join(' · ')}</p>
            </>
          )}
          <Label>EQUIPMENT</Label>
          <p>{selected.equipment.map((id) => equipmentNames[id]).join(' · ') || 'Bodyweight'}</p>
          <Label>HOW TO</Label>
          <ol className="instructions">
            {selected.instructions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          <Label>COMMON MISTAKES</Label>
          <p>{selected.mistakes}</p>
          <Label>PROGRESSION</Label>
          <p>{selected.progression}</p>
          <Label>REGRESSION</Label>
          <p>{selected.regression}</p>
          <Label>REST & EFFORT</Label>
          <p>
            {selected.rest} seconds · RIR {selected.rir}. RIR 2 ≈ two more clean reps possible.
          </p>
          <Label>SUBSTITUTIONS</Label>
          <div className="pill-row">
            {selected.substitutes
              .map((id) => library(data).find((e) => e.id === id))
              .filter((e): e is Exercise => !!e)
              .map((e) => (
                <button key={e.id} onClick={() => setSelected(e)}>
                  {e.name}
                  <ArrowRight size={12} />
                </button>
              ))}
          </div>
        </Modal>
      )}
      {custom && (
        <Modal title="Add your own movement" wide onClose={() => setCustom(false)}>
          <div className="form-grid">
            <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Select
              label="Primary muscle"
              value={form.muscle}
              onChange={(v) => setForm({ ...form, muscle: v as Muscle })}
            >
              {data.goals.priorities.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
            <Field
              label="Secondary muscles (comma separated)"
              value={form.secondary}
              onChange={(v) => setForm({ ...form, secondary: v })}
            />
            <Select
              label="Category"
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v as Exercise['category'] })}
            >
              {['Compound', 'Isolation', 'Core', 'Mobility', 'Posture', 'Warm-up'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
            <Select
              label="Movement pattern"
              value={form.movement}
              onChange={(v) => setForm({ ...form, movement: v })}
            >
              {[
                'Horizontal push',
                'Vertical push',
                'Horizontal pull',
                'Vertical pull',
                'Squat',
                'Hinge',
                'Elbow flexion',
                'Elbow extension',
                'Scapular control',
                'Anti-extension',
                'Trunk flexion',
                'Pelvic control',
                'Hip flexion',
                'Hip mobility',
              ].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          </div>
          <Label>REQUIRED EQUIPMENT</Label>
          <div className="equipment-toggles">
            {Object.entries(equipmentNames).map(([id, name]) => (
              <Toggle
                key={id}
                checked={form.equipment.includes(id as EquipmentId)}
                onChange={() =>
                  setForm({
                    ...form,
                    equipment: form.equipment.includes(id as EquipmentId)
                      ? form.equipment.filter((e) => e !== id)
                      : [...form.equipment, id as EquipmentId],
                  })
                }
              >
                {name}
              </Toggle>
            ))}
          </div>
          <TextArea
            label="Instructions (one step per line)"
            value={form.instructions}
            onChange={(v) => setForm({ ...form, instructions: v })}
          />
          <TextArea
            label="Technique cue"
            value={form.cue}
            onChange={(v) => setForm({ ...form, cue: v })}
          />
          <div className="form-grid">
            {(['min', 'max', 'rest', 'rir'] as const).map((k) => (
              <Field
                key={k}
                label={{ min: 'Min reps', max: 'Max reps', rest: 'Rest · sec', rir: 'RIR' }[k]}
                type="number"
                value={form[k]}
                onChange={(v) => setForm({ ...form, [k]: Number(v) })}
              />
            ))}
          </div>
          <TextArea
            label="Progression"
            value={form.progression}
            onChange={(v) => setForm({ ...form, progression: v })}
          />
          <TextArea
            label="Regression"
            value={form.regression}
            onChange={(v) => setForm({ ...form, regression: v })}
          />
          <Button onClick={saveCustom}>Add to exercise library</Button>
        </Modal>
      )}
    </>
  );
}
