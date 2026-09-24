// Jerarquía tipográfica compartida

// Etiqueta secundaria: pequeña, en mayúsculas y gris discreto
export function Label({ as: Tag = 'p', className = '', ...props }) {
  return <Tag className={`text-xs font-medium tracking-wider text-zinc-400 uppercase ${className}`} {...props} />
}

// Cifra destacada, con unidad opcional más discreta
export function Metric({ value, unit, className = '' }) {
  return (
    <p className={`text-3xl font-semibold tracking-tight text-zinc-100 ${className}`}>
      {value}
      {unit && <> <span className="ml-0.5 text-base font-normal tracking-normal text-zinc-400">{unit}</span></>}
    </p>
  )
}
