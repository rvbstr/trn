import { useState } from 'react';
import { Check, Edit3, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../context';
import { Button, Field, Label, Modal, PageTitle, SectionHead, Select, Stat } from '../components';
import { mealTemplates } from '../data';
import { caloriesEstimate, nutritionAdvice, recommendedNutrition } from '../engine';
import { localDate, uid } from '../utils';
import type { NutritionDay } from '../types';

export function Nutrition() {
  const { data, update, notify } = useApp();
  const today = localDate();
  const [editing, setEditing] = useState(false);
  const [targets, setTargets] = useState({ ...data.nutrition });
  const [log, setLog] = useState(false);
  const [food, setFood] = useState({ name: '', calories: 0, protein: 0, carbs: 0, fat: 0 });
  const day = data.nutritionDays.find((d) => d.date === today) || {
    date: today,
    meals: [],
    logs: [],
    selections: {},
  };
  const slots = ['Breakfast', 'Lunch', 'Snack', 'Dinner', 'Optional snack'];
  const selected = slots.map(
    (slot) =>
      mealTemplates.find((m) => m.id === day.selections[slot]) ||
      mealTemplates.find((m) => m.slot === slot)!,
  );
  const checked = mealTemplates.filter((m) => day.meals.includes(m.id));
  const source = data.nutrition.mode === 'simple' ? checked : day.logs;
  const totals = source.reduce(
    (s, m) => ({
      calories: s.calories + m.calories,
      protein: s.protein + m.protein,
      carbs: s.carbs + m.carbs,
      fat: s.fat + m.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
  const range = caloriesEstimate(data.profile, data.preferences.frequency);
  const advice = nutritionAdvice(data);
  function dayUpdate(fn: (day: NutritionDay) => void) {
    update((d) => {
      let nd = d.nutritionDays.find((d) => d.date === today);
      if (!nd) {
        nd = { date: today, meals: [], logs: [], selections: {} };
        d.nutritionDays.push(nd);
      }
      fn(nd);
    });
  }
  return (
    <>
      <PageTitle
        eyebrow="FUEL & RECOVERY"
        title="Eat for the work ahead."
        description="A gentle surplus. Enough protein. Meals you can repeat."
        action={
          <Button
            variant="secondary"
            onClick={() => {
              setTargets({ ...data.nutrition });
              setEditing(true);
            }}
          >
            <Edit3 size={16} />
            Edit targets
          </Button>
        }
      />
      <div className="stats-grid four card">
        {(['calories', 'protein', 'carbs', 'fat'] as const).map((k) => (
          <Stat
            key={k}
            label={
              { calories: 'Daily energy', protein: 'Protein', carbs: 'Carbohydrates', fat: 'Fat' }[
                k
              ]
            }
            value={data.nutrition[k]}
            unit={k === 'calories' ? 'kcal' : 'g'}
            detail={
              k === 'calories'
                ? `Estimated start: ${range.low}–${range.high} kcal`
                : k === 'protein'
                  ? `${Math.round(data.profile.weight * 1.6)}–${Math.round(data.profile.weight * 2.2)} g / day range`
                  : undefined
            }
          />
        ))}
      </div>
      <div className="section-head">
        <div className="page-tabs">
          {(['simple', 'macros'] as const).map((mode) => (
            <button
              key={mode}
              className={data.nutrition.mode === mode ? 'active' : ''}
              onClick={() =>
                update((d) => {
                  d.nutrition.mode = mode;
                })
              }
            >
              {mode === 'simple' ? 'Simple nutrition' : 'Macro tracking'}
            </button>
          ))}
        </div>
        <Label>TODAY’S FOOD</Label>
      </div>
      <div className="nutrition-layout">
        <div>
          {data.nutrition.mode === 'simple' ? (
            <>
              <p className="muted">
                A structure, not a rulebook. Swap a meal and check it off when eaten. Portions and
                nutrition are approximate.
              </p>
              <div className="meal-list">
                {selected.map((meal, i) => (
                  <section className="card meal-card" key={meal.slot}>
                    <div className="meal-index">{String(i + 1).padStart(2, '0')}</div>
                    <div className="meal-content">
                      <Label>{meal.slot.toUpperCase()}</Label>
                      <h3>{meal.name}</h3>
                      <p>{meal.description}</p>
                      <div className="mini-meta">
                        <strong>~{meal.calories} kcal</strong>
                        <span>~{meal.protein} g protein</span>
                      </div>
                      <Select
                        label={`Swap ${meal.slot.toLowerCase()}`}
                        value={meal.id}
                        onChange={(id) =>
                          dayUpdate((day) => {
                            day.meals = day.meals.filter(
                              (id) =>
                                !mealTemplates.some((m) => m.slot === meal.slot && m.id === id),
                            );
                            day.selections[meal.slot] = id;
                          })
                        }
                      >
                        {mealTemplates
                          .filter((m) => m.slot === meal.slot)
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                      </Select>
                    </div>
                    <button
                      className={`meal-check ${day.meals.includes(meal.id) ? 'checked' : ''}`}
                      aria-label={`Mark ${meal.slot.toLowerCase()} eaten`}
                      aria-pressed={day.meals.includes(meal.id)}
                      onClick={() =>
                        dayUpdate((day) => {
                          day.meals = day.meals.includes(meal.id)
                            ? day.meals.filter((id) => id !== meal.id)
                            : [...day.meals, meal.id];
                        })
                      }
                    >
                      <Check size={20} />
                    </button>
                  </section>
                ))}
              </div>
            </>
          ) : (
            <section className="card">
              <SectionHead
                title="Your food log"
                aside={
                  <Button variant="secondary" onClick={() => setLog(true)}>
                    <Plus size={15} />
                    Add food
                  </Button>
                }
              />
              <p className="muted">
                Enter a food, meal, or daily total. No food database or weighing requirement.
              </p>
              {day.logs.length ? (
                day.logs.map((item) => (
                  <div className="food-log" key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <small>
                        {item.calories} kcal · P {item.protein} · C {item.carbs} · F {item.fat} g
                      </small>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={`Delete ${item.name}`}
                      onClick={() =>
                        dayUpdate((day) => {
                          day.logs = day.logs.filter((l) => l.id !== item.id);
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty">
                  <h3>Start with your next meal.</h3>
                  <p>Logging is optional. Simple nutrition is always available.</p>
                </div>
              )}
            </section>
          )}
        </div>
        <aside>
          <section className="card">
            <Label>{data.nutrition.mode === 'simple' ? 'MEALS EATEN' : 'LOGGED TODAY'}</Label>
            <h3>
              {totals.calories} <span className="muted">/ {data.nutrition.calories} kcal</span>
            </h3>
            {(['calories', 'protein', 'carbs', 'fat'] as const).map((k) => (
              <div className="macro-meter" key={k}>
                <div>
                  <span>{k === 'carbs' ? 'Carbohydrates' : k[0].toUpperCase() + k.slice(1)}</span>
                  <strong>
                    {totals[k]} / {data.nutrition[k]} {k === 'calories' ? 'kcal' : 'g'}
                  </strong>
                </div>
                <div className="thin-progress">
                  <i
                    style={{
                      width: `${Math.min(100, (totals[k] / Math.max(1, data.nutrition[k])) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            <small className="muted">
              Simple meal estimates and macro entries are kept separately when switching modes.
            </small>
          </section>
          <section className="card nutrition-advice">
            <Label>A SMALL ADJUSTMENT, IF NEEDED</Label>
            <h3>Watch the average.</h3>
            <p>{advice.message}</p>
            {advice.delta !== 0 && (
              <Button
                variant="secondary"
                onClick={() => {
                  if (
                    window.confirm(
                      `Apply ${advice.delta > 0 ? '+' : ''}${advice.delta} kcal to your daily target?`,
                    )
                  ) {
                    update((d) => {
                      d.nutrition.calories += advice.delta;
                      d.nutrition.carbs = Math.max(
                        0,
                        d.nutrition.carbs + Math.round(advice.delta / 4),
                      );
                      d.nutrition.manual = true;
                    });
                    notify('Target adjusted with your confirmation.');
                  }
                }}
              >
                Apply {advice.delta > 0 ? '+' : ''}
                {advice.delta} kcal
              </Button>
            )}
            <p className="small muted">
              A starting estimate, not an exact requirement. Aim for slow gain; visible abs depend
              substantially on body-fat level as well as training. Targets never change
              automatically.
            </p>
          </section>
        </aside>
      </div>
      {editing && (
        <Modal title="Nutrition targets" onClose={() => setEditing(false)}>
          <p>
            Estimated lean-gain starting range: {range.low}–{range.high} kcal. Default protein is
            approximately 2 g/kg, within 1.6–2.2 g/kg/day.
          </p>
          <div className="form-grid">
            {(['calories', 'protein', 'carbs', 'fat'] as const).map((k) => (
              <Field
                key={k}
                label={`${k[0].toUpperCase() + k.slice(1)} · ${k === 'calories' ? 'kcal' : 'g'}`}
                type="number"
                min={k === 'calories' ? 1000 : 0}
                max={{ calories: 6000, protein: 400, carbs: 1000, fat: 300 }[k]}
                value={targets[k]}
                onChange={(v) => setTargets({ ...targets, [k]: Number(v) })}
              />
            ))}
          </div>
          <p className="small muted">
            Macros account for roughly {targets.protein * 4 + targets.carbs * 4 + targets.fat * 9}{' '}
            kcal. Meals and labels vary; close is useful.
          </p>
          <div className="button-row">
            <Button
              onClick={() => {
                if (
                  targets.calories < 1000 ||
                  targets.calories > 6000 ||
                  targets.protein < 0 ||
                  targets.protein > 400 ||
                  targets.carbs < 0 ||
                  targets.carbs > 1000 ||
                  targets.fat < 0 ||
                  targets.fat > 300
                ) {
                  notify('Check the target ranges.');
                  return;
                }
                update((d) => {
                  d.nutrition = { ...targets, manual: true };
                });
                setEditing(false);
                notify('Nutrition targets saved.');
              }}
            >
              Save targets
            </Button>
            <Button variant="secondary" onClick={() => setTargets(recommendedNutrition(data))}>
              Use profile estimate
            </Button>
          </div>
        </Modal>
      )}
      {log && (
        <Modal title="Add food or a meal" onClose={() => setLog(false)}>
          <Field
            label="Food / meal"
            value={food.name}
            onChange={(v) => setFood({ ...food, name: v })}
          />
          <div className="form-grid">
            {(['calories', 'protein', 'carbs', 'fat'] as const).map((k) => (
              <Field
                key={k}
                label={`${k[0].toUpperCase() + k.slice(1)} · ${k === 'calories' ? 'kcal' : 'g'}`}
                type="number"
                min={0}
                max={6000}
                value={food[k]}
                onChange={(v) => setFood({ ...food, [k]: Number(v) })}
              />
            ))}
          </div>
          <Button
            onClick={() => {
              if (
                !food.name.trim() ||
                Object.values(food).some(
                  (v) => typeof v === 'number' && (!Number.isFinite(v) || v < 0 || v > 6000),
                )
              ) {
                notify('Enter a name and nonnegative nutrition values.');
                return;
              }
              dayUpdate((day) => {
                day.logs.push({ id: uid(), ...food });
              });
              setLog(false);
              setFood({ name: '', calories: 0, protein: 0, carbs: 0, fat: 0 });
            }}
          >
            Add to today’s log
          </Button>
        </Modal>
      )}
    </>
  );
}
