import { ArrowRight, Check, ChevronDown, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { num, prettyDate } from './utils';

export function Label({ children }: { children: ReactNode }) {
  return <span className="eyebrow">{children}</span>;
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-title">
      <div>
        <Label>{eyebrow}</Label>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </header>
  );
}
export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  type = 'button',
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`button ${variant} ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-mark">—</span>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Field({
  label,
  value,
  onChange,
  type = 'text',
  min,
  max,
  step,
  required = false,
  help,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  help?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        aria-label={label}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        step={step}
        required={required}
      />
      {help && <small>{help}</small>}
    </label>
  );
}
export function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <span className="select-wrap">
        <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
          {children}
        </select>
        <ChevronDown size={14} />
      </span>
    </label>
  );
}
export function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
      />
    </label>
  );
}
export function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className={`toggle-row ${checked ? 'checked' : ''}`}
      onClick={onChange}
      aria-pressed={checked}
    >
      <span>{children}</span>
      <span className="check-box">{checked && <Check size={14} />}</span>
    </button>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    const close = () => closeRef.current();
    el?.addEventListener('cancel', close);
    return () => {
      el?.removeEventListener('cancel', close);
      el?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? 'modal wide' : 'modal'}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}
export function SectionHead({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {aside}
    </div>
  );
}
export function Stat({
  label,
  value,
  unit,
  detail,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  detail?: string;
}) {
  return (
    <div className="stat">
      <Label>{label}</Label>
      <div className="stat-number">
        {value}
        <span>{unit}</span>
      </div>
      {detail && <small>{detail}</small>}
    </div>
  );
}
export function LinkButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="text-link" onClick={onClick}>
      {children}
      <ArrowRight size={15} />
    </button>
  );
}
export function Chart({
  points,
  unit,
  label,
  secondary,
}: {
  points: { date: string; value: number }[];
  unit: string;
  label: string;
  secondary?: { date: string; value: number }[];
}) {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length)
    return (
      <div className="chart-empty">
        <span>No entries in this range</span>
        <small>Record a measurement or complete a session to see your trend.</small>
      </div>
    );
  const vals = [...sorted, ...(secondary || [])].map((p) => p.value);
  const low = Math.min(...vals);
  const high = Math.max(...vals);
  const padding = Math.max((high - low) * 0.3, 0.5);
  const min = low - padding;
  const max = high + padding;
  const start = Date.parse(sorted[0].date);
  const end = Date.parse(sorted.at(-1)!.date);
  const x = (date: string) =>
    45 + ((Date.parse(date) - start) / Math.max(86400000, end - start)) * 485;
  const y = (v: number) => 145 - ((v - min) / (max - min)) * 115;
  const path = (p: typeof sorted) =>
    p.map((v, i) => `${i ? 'L' : 'M'}${x(v.date)},${y(v.value)}`).join(' ');
  return (
    <div className="chart">
      <svg
        role="img"
        aria-label={`${label}: ${sorted.map((p) => `${prettyDate(p.date)} ${num(p.value)} ${unit}`).join(', ')}`}
        viewBox="0 0 560 190"
      >
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line
              x1="45"
              x2="530"
              y1={y(min + (max - min) * v)}
              y2={y(min + (max - min) * v)}
              stroke="var(--line)"
            />
            <text x="4" y={y(min + (max - min) * v) + 4}>
              {num(min + (max - min) * v)}
            </text>
          </g>
        ))}
        <path
          d={path(sorted)}
          fill="none"
          stroke={secondary ? 'var(--chart-secondary)' : 'var(--accent)'}
          strokeWidth={secondary ? 1.5 : 2.5}
        />
        {secondary && (
          <path d={path(secondary)} fill="none" stroke="var(--accent)" strokeWidth="2.5" />
        )}
        {sorted.map((p, i) => (
          <circle key={i} cx={x(p.date)} cy={y(p.value)} r="3" fill="var(--accent)">
            <title>
              {prettyDate(p.date)}: {num(p.value)} {unit}
            </title>
          </circle>
        ))}
        <text x="45" y="180">
          {prettyDate(sorted[0].date, { day: 'numeric', month: 'short' })}
        </text>
        <text x="530" y="180" textAnchor="end">
          {prettyDate(sorted.at(-1)!.date, { day: 'numeric', month: 'short' })}
        </text>
      </svg>
      <small>
        {secondary ? 'Pale: daily entries · Green: 7-day moving average' : `${label} · ${unit}`}
      </small>
    </div>
  );
}
