import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useApp } from '../../context/AppContext'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import { Field, FormError, Input } from '../ui/Field'
import { SettingRow } from './SettingRow'

const MIN_PASSWORD_LENGTH = 8
const EMPTY = { currentPassword: '', newPassword: '', confirm: '' }

// Cambiar la contraseña, o crear una si la cuenta entró con Google. El formulario se despliega
// al pedirlo. Una cuenta de Strava sin email no puede usar contraseña: no se muestra
export function PasswordSetting() {
  const { user, setUser } = useAuth()
  const { toast } = useApp()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const bind = (key) => ({ value: form[key], onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })) })

  if (!user.email) return null
  const creating = !user.hasPassword

  function close() {
    setOpen(false)
    setForm(EMPTY)
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.newPassword.length < MIN_PASSWORD_LENGTH) return setError(`La contraseña nueva debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`)
    if (form.newPassword !== form.confirm) return setError('Las contraseñas nuevas no coinciden')
    setSaving(true)
    try {
      const body = { newPassword: form.newPassword, ...(!creating && { currentPassword: form.currentPassword }) }
      const { user: updated } = await api('/auth/me/password', { method: 'PUT', body })
      setUser(updated)
      close()
      toast(creating ? 'Contraseña creada. Ya puedes entrar también con tu email.' : 'Contraseña cambiada.', 'success')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const ready = form.newPassword && form.confirm && (creating || form.currentPassword)
  return (
    <SettingRow
      title="Contraseña"
      status={creating ? 'Aún no tienes. Crea una para entrar también con tu email.' : 'Entras con tu email y tu contraseña.'}
      action={!open && (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>{creating ? 'Crear contraseña' : 'Cambiar'}</Button>
      )}
    >
      {open && (
        <form onSubmit={handleSubmit} noValidate className="mt-2 flex max-w-xl flex-col gap-4 animate-rise-in">
          {/* Email oculto para que el gestor de contraseñas sepa a qué cuenta pertenece */}
          <input type="email" autoComplete="username" value={user.email} readOnly hidden />
          {!creating && (
            <Field label="Contraseña actual">
              {(id) => <Input id={id} type="password" autoComplete="current-password" autoFocus {...bind('currentPassword')} />}
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contraseña nueva" hint={`Al menos ${MIN_PASSWORD_LENGTH} caracteres.`}>
              {(id) => <Input id={id} type="password" autoComplete="new-password" autoFocus={creating} {...bind('newPassword')} />}
            </Field>
            <Field label="Repite la nueva">
              {(id) => <Input id={id} type="password" autoComplete="new-password" {...bind('confirm')} />}
            </Field>
          </div>
          <FormError>{error}</FormError>
          <div className="flex gap-2">
            <Button type="submit" variant="secondary" loading={saving} disabled={!ready}>Guardar contraseña</Button>
            <Button variant="ghost" onClick={close} disabled={saving}>Cancelar</Button>
          </div>
        </form>
      )}
    </SettingRow>
  )
}
