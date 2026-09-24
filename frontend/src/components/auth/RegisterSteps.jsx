import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Button } from '../ui/Button'
import { Field, FormError, Input } from '../ui/Field'
import { SegmentedControl } from '../ui/SegmentedControl'
import { SEX_OPTIONS, ageFromBirthDate, bmiCategory, estimatedMaxHr } from '../../lib/user'
import { formatNumber, todayInput } from '../../lib/format'

const STEPS = [
  { title: 'Crea tu cuenta', description: 'Con esto entrarás a BikeTelemetry.' },
  { title: 'Sobre ti', description: 'Tu nombre y edad personalizan las métricas.' },
  { title: 'Tu cuerpo', description: 'Altura y peso permiten estimar calorías e IMC.', optional: true },
  { title: 'Tu corazón', description: 'Afinan tus zonas de pulso. Si no los sabes, los estimamos.', optional: true },
]

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const num = (v) => (v === '' ? null : Number(v))

// Valida el paso actual con los mismos rangos que el backend
function validateStep(step, f) {
  if (step === 0) {
    if (!EMAIL_REGEX.test(f.email.trim())) return 'Introduce un email válido.'
    if (f.password.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
  }
  if (step === 1) {
    if (!f.name.trim()) return 'Dinos cómo te llamas.'
    if (f.name.trim().length > 60) return 'El nombre no puede superar 60 caracteres.'
    if (f.birthDate) {
      const age = ageFromBirthDate(f.birthDate)
      if (age == null || age < 10 || age > 100) return 'La edad debe estar entre 10 y 100 años.'
    }
  }
  if (step === 2) {
    if (f.heightCm !== '' && !(Number.isInteger(num(f.heightCm)) && num(f.heightCm) >= 100 && num(f.heightCm) <= 230)) return 'La altura debe estar entre 100 y 230 cm.'
    if (f.weightKg !== '' && !(num(f.weightKg) >= 30 && num(f.weightKg) <= 250)) return 'El peso debe estar entre 30 y 250 kg.'
  }
  if (step === 3) {
    if (f.restingHr !== '' && !(Number.isInteger(num(f.restingHr)) && num(f.restingHr) >= 30 && num(f.restingHr) <= 120)) return 'La FC en reposo debe estar entre 30 y 120 bpm.'
    if (f.maxHr !== '' && !(Number.isInteger(num(f.maxHr)) && num(f.maxHr) >= 100 && num(f.maxHr) <= 220)) return 'La FC máxima debe estar entre 100 y 220 bpm.'
    if (f.restingHr !== '' && f.maxHr !== '' && num(f.restingHr) >= num(f.maxHr)) return 'La FC en reposo debe ser menor que la máxima.'
  }
  return null
}

function Estimate({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-brand/25 bg-brand/10 px-4 py-3">
      <p className="text-xs font-medium tracking-wider text-zinc-400 uppercase">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight text-zinc-50">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-400">{hint}</p>}
    </div>
  )
}

export function RegisterSteps() {
  const { authenticate } = useAuth()
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [f, setF] = useState({
    email: '', password: '', name: '', birthDate: '', sex: '', heightCm: '', weightKg: '', restingHr: '', maxHr: '',
  })
  // Al editar un campo desaparece el error del paso
  const bind = (key) => ({ value: f[key], onChange: (e) => { setError(''); setF((prev) => ({ ...prev, [key]: e.target.value })) } })

  const age = ageFromBirthDate(f.birthDate)
  const bmi = num(f.heightCm) && num(f.weightKg) ? num(f.weightKg) / (num(f.heightCm) / 100) ** 2 : null
  const isLast = step === STEPS.length - 1

  function go(to) {
    setDirection(to > step ? 1 : -1)
    setError('')
    setStep(to)
  }

  async function submit() {
    setSubmitting(true)
    setError('')
    const profile = {
      name: f.name.trim(),
      ...(f.birthDate && { birthDate: f.birthDate }),
      ...(f.sex && { sex: f.sex }),
      ...(f.heightCm !== '' && { heightCm: num(f.heightCm) }),
      ...(f.weightKg !== '' && { weightKg: num(f.weightKg) }),
      ...(f.restingHr !== '' && { restingHr: num(f.restingHr) }),
      ...(f.maxHr !== '' && { maxHr: num(f.maxHr) }),
    }
    try {
      await authenticate('register', f.email.trim(), f.password, profile)
    } catch (err) {
      setSubmitting(false)
      // Email ya registrado: se vuelve al primer paso para corregirlo
      if (err.status === 409) {
        go(0)
        setError(err.message)
      } else setError(err.message)
    }
  }

  function next(e) {
    e.preventDefault()
    const invalid = validateStep(step, f)
    if (invalid) return setError(invalid)
    if (isLast) submit()
    else go(step + 1)
  }

  // Omitir un paso opcional: se vacían sus campos
  function skip() {
    const cleared = step === 2 ? { heightCm: '', weightKg: '' } : { restingHr: '', maxHr: '' }
    setF((prev) => ({ ...prev, ...cleared }))
    if (isLast) submit()
    else go(step + 1)
  }

  return (
    <form onSubmit={next} noValidate className="flex flex-col gap-6">
      {/* Progreso */}
      <div>
        <div className="flex gap-1.5" aria-hidden>
          {STEPS.map((s, i) => (
            <div key={s.title} className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-800">
              <div className={`h-full rounded-full bg-linear-to-r from-brand to-brand-2 transition-transform duration-500 ease-out origin-left ${i <= step ? 'scale-x-100' : 'scale-x-0'}`} />
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs font-medium tracking-wider text-zinc-400 uppercase">
          Paso {step + 1} de {STEPS.length}{STEPS[step].optional && ' · opcional'}
        </p>
      </div>

      <div key={step} className={direction > 0 ? 'animate-[step-in-right_380ms_cubic-bezier(0.22,1,0.36,1)_both]' : 'animate-[step-in-left_380ms_cubic-bezier(0.22,1,0.36,1)_both]'}>
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-50">{STEPS[step].title}</h2>
        <p className="mt-1.5 text-sm text-zinc-400">{STEPS[step].description}</p>

        <div className="mt-6 flex flex-col gap-4">
          {step === 0 && (
            <>
              <Field label="Email">{(id) => <Input id={id} type="email" autoComplete="email" autoFocus placeholder="tu@email.com" {...bind('email')} />}</Field>
              <Field label="Contraseña" hint="Mínimo 8 caracteres.">{(id) => <Input id={id} type="password" autoComplete="new-password" {...bind('password')} />}</Field>
            </>
          )}
          {step === 1 && (
            <>
              <Field label="Nombre">{(id) => <Input id={id} autoComplete="name" autoFocus maxLength={60} placeholder="Cómo quieres que te llamemos" {...bind('name')} />}</Field>
              <Field label="Fecha de nacimiento" hint={age != null && age >= 10 && age <= 100 ? `${age} años` : 'Para estimar tu FC máxima'}>
                {(id) => <Input id={id} type="date" max={todayInput()} {...bind('birthDate')} />}
              </Field>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium tracking-wider text-zinc-400 uppercase">Sexo</span>
                <SegmentedControl label="Sexo" options={[...SEX_OPTIONS, { value: '', label: 'Prefiero no decirlo' }]}
                  value={f.sex} onChange={(sex) => setF((prev) => ({ ...prev, sex }))} />
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Altura (cm)">{(id) => <Input id={id} type="number" inputMode="numeric" autoFocus placeholder="175" {...bind('heightCm')} />}</Field>
                <Field label="Peso (kg)">{(id) => <Input id={id} type="number" inputMode="decimal" step="0.1" placeholder="70" {...bind('weightKg')} />}</Field>
              </div>
              {bmi && bmi > 10 && bmi < 80 && <Estimate label="IMC estimado" value={formatNumber(bmi, 1)} hint={bmiCategory(bmi)} />}
            </>
          )}
          {step === 3 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="FC en reposo">{(id) => <Input id={id} type="number" inputMode="numeric" autoFocus placeholder="55" {...bind('restingHr')} />}</Field>
                <Field label="FC máxima">{(id) => <Input id={id} type="number" inputMode="numeric" placeholder={estimatedMaxHr(age) ?? '185'} {...bind('maxHr')} />}</Field>
              </div>
              {estimatedMaxHr(age) && f.maxHr === '' && (
                <Estimate label="FC máxima estimada" value={`${estimatedMaxHr(age)} bpm`} hint="Según tu edad (fórmula de Tanaka). Podrás cambiarla en tu perfil." />
              )}
            </>
          )}
        </div>
      </div>

      <FormError>{error}</FormError>

      <div className="flex items-center gap-2">
        {step > 0 && <Button variant="ghost" onClick={() => go(step - 1)} disabled={submitting}>Atrás</Button>}
        <div className="flex-1" />
        {STEPS[step].optional && <Button variant="ghost" onClick={skip} disabled={submitting}>Omitir</Button>}
        <Button type="submit" loading={submitting} className="min-w-32">{isLast ? 'Crear cuenta' : 'Continuar'}</Button>
      </div>
    </form>
  )
}
