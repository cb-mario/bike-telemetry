import { useState } from 'react'
import { ActivityForm } from './ActivityForm'
import { GpxDropzone } from './GpxDropzone'
import { RoutePreview } from './RoutePreview'
import { Button } from './ui/Button'
import { SegmentedControl } from './ui/SegmentedControl'
import { Label } from './ui/Text'
import { formatDate, formatDuration, formatKm, formatNumber } from '../lib/format'
import { Icon } from './ui/Icon'

const MODES = [
  { value: 'gpx', label: 'Importar GPX' },
  { value: 'manual', label: 'Manual' },
]

// Contenido del modal "Nueva salida": importación GPX (por defecto) o formulario manual
export function NewActivity({ initialMode = 'gpx', initialFile, onCreated, onClose }) {
  const [mode, setMode] = useState(initialMode)
  const [imported, setImported] = useState(null)
  // El archivo soltado sobre el dashboard se usa una sola vez (no al volver a esta vista)
  const [pendingFile, setPendingFile] = useState(initialFile)

  if (imported) {
    return <ImportSummary activity={imported} onAnother={() => setImported(null)} onClose={onClose} />
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="self-start">
        <SegmentedControl label="Tipo de registro" options={MODES} value={mode} onChange={setMode} />
      </div>
      {mode === 'gpx' ? (
        <GpxDropzone
          initialFile={pendingFile}
          onInitialFileUsed={() => setPendingFile(null)}
          onImported={(activity) => {
            setImported(activity)
            onCreated()
          }}
        />
      ) : (
        <ActivityForm onCancel={onClose} onCreated={() => { onCreated(); onClose() }} />
      )}
    </div>
  )
}

function ImportSummary({ activity: a, onAnother, onClose }) {
  const stats = [
    ['Distancia', formatKm(a.distanceKm)],
    ['Tiempo', formatDuration(a.durationMin)],
    ['Desnivel', a.elevationGain != null ? `${formatNumber(a.elevationGain)} m` : '—'],
    ['FC media', a.avgHr != null ? `${a.avgHr} bpm` : '—'],
  ]
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zone-2/15 text-zone-2"><Icon name="check" strokeWidth={2} /></span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-100">{a.title}</p>
          <p className="text-xs text-zinc-500">Importada · {formatDate(a.date)}</p>
        </div>
      </div>

      {a.routePreview && (
        <div className="flex justify-center rounded-xl border border-zinc-800 bg-zinc-950/40 py-4">
          <RoutePreview segments={a.routePreview} width={320} height={160} padding={10} markers />
        </div>
      )}

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label}>
            <Label as="dt">{label}</Label>
            <dd className="mt-1 text-lg font-semibold tracking-tight text-zinc-100">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onAnother}>Importar otra</Button>
        <Button onClick={onClose}>Listo</Button>
      </div>
    </div>
  )
}
