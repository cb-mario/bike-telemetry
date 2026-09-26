// Fila de ajustes de la tarjeta «Cuenta y acceso»: qué es, en qué estado está y su acción.
// `children` ocupa la fila entera bajo el estado (p. ej. un formulario desplegado)
export function SettingRow({ title, status, action, children }) {
  return (
    <div className="grid gap-x-6 gap-y-2 px-5 py-4 sm:grid-cols-[11rem_1fr_auto] sm:items-center">
      <h3 className="text-sm font-medium text-zinc-100">{title}</h3>
      <div className="min-w-0 text-sm text-zinc-400">{status}</div>
      {action && <div className="flex justify-start sm:justify-end">{action}</div>}
      {children && <div className="sm:col-span-2 sm:col-start-2">{children}</div>}
    </div>
  )
}
