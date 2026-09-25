import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { FormError } from './ui/Field'
import { Spinner } from './ui/Spinner'
import { Icon } from './ui/Icon'

const MAX_MB = 15

function validateFile(file) {
  if (!/\.gpx$/i.test(file.name)) return 'Solo se admiten archivos .gpx'
  if (file.size > MAX_MB * 1024 * 1024) return `El archivo supera el máximo de ${MAX_MB} MB`
  return null
}

// Zona para soltar o elegir un .gpx; lo sube y avisa con la actividad creada
export function GpxDropzone({ initialFile, onInitialFileUsed, onImported }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(null) // nombre del archivo en curso
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const startedRef = useRef(null)

  async function upload(file) {
    const invalid = validateFile(file)
    if (invalid) return setError(invalid)

    setError('')
    setUploading(file.name)
    try {
      const form = new FormData()
      form.append('file', file)
      const activity = await api('/activities/upload-gpx', { method: 'POST', body: form })
      onImported(activity)
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(null)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  // Archivo soltado sobre el dashboard: se sube al abrir (una sola vez, también en StrictMode)
  useEffect(() => {
    if (initialFile && startedRef.current !== initialFile) {
      startedRef.current = initialFile
      onInitialFileUsed?.()
      upload(initialFile)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile])

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && !uploading) upload(file)
  }

  return (
    <div className="flex flex-col gap-4">
      <label
        onDragEnter={(e) => { e.preventDefault(); setDragging(true) }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false) }}
        onDrop={handleDrop}
        className={`group relative flex min-h-56 cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border border-dashed
          px-6 py-10 text-center transition-colors duration-150 ease-out
          has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-2/50
          ${dragging
            ? 'border-brand-2/70 bg-brand/10'
            : 'border-zinc-700 bg-zinc-950/40 hover:border-zinc-500 hover:bg-zinc-900/60'}
          ${uploading ? 'pointer-events-none' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".gpx,application/gpx+xml"
          className="sr-only"
          disabled={Boolean(uploading)}
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />

        {uploading ? (
          <>
            <div className="flex size-12 items-center justify-center rounded-full bg-zinc-800/80 text-zinc-100">
              <Spinner className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-100">Analizando ruta…</p>
              <p className="mt-1 max-w-64 truncate text-xs text-zinc-500">{uploading}</p>
            </div>
          </>
        ) : (
          <>
            <div className={`flex size-12 items-center justify-center rounded-full transition-all duration-200
              ${dragging ? 'bg-brand text-brand-ink' : 'bg-zinc-800/80 text-zinc-300 group-hover:text-zinc-100'}`}>
              <Icon name="upload" className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-100">
                {dragging ? 'Suelta para importar' : 'Arrastra tu archivo .gpx aquí'}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                o <span className="text-zinc-300 underline decoration-zinc-600 underline-offset-2">elige un archivo</span> · máx. {MAX_MB} MB
              </p>
            </div>
          </>
        )}
      </label>

      <p className="text-center text-xs text-zinc-500">
        Distancia, desnivel, tiempo en movimiento y pulso se calculan automáticamente.
      </p>
      <FormError>{error}</FormError>
    </div>
  )
}
