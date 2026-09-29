import { api } from './api'

// Archivos de salidas grabadas que entiende la API
export const ACTIVITY_FILE = /\.(fit|gpx)$/i
export const MAX_FILE_MB = 15

// Se descartan los ocultos: macOS crea copias "._nombre.fit" en las unidades USB (FAT) del aparato
const isCandidate = (file) => ACTIVITY_FILE.test(file.name) && !file.name.startsWith('.')

// De una lista de archivos (input o carpeta) deja solo las salidas, sin repetir, de la más antigua a la más reciente
export function pickActivityFiles(files) {
  const seen = new Set()
  return [...files]
    .filter(isCandidate)
    .filter((f) => {
      const key = `${f.webkitRelativePath || f.name}:${f.size}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.lastModified - b.lastModified || a.name.localeCompare(b.name))
}

// Lee todas las entradas de una carpeta (readEntries devuelve por lotes)
function readAllEntries(reader) {
  return new Promise((resolve, reject) => {
    const all = []
    const next = () => reader.readEntries((batch) => {
      if (!batch.length) return resolve(all)
      all.push(...batch)
      next()
    }, reject)
    next()
  })
}

async function entryFiles(entry) {
  if (entry.isFile) return [await new Promise((resolve, reject) => entry.file(resolve, reject))]
  if (!entry.isDirectory) return []
  const children = await readAllEntries(entry.createReader())
  return (await Promise.all(children.map(entryFiles))).flat()
}

// Archivos soltados: si se arrastra una carpeta (la unidad del Garmin, p. ej.), se recorre entera
export async function droppedFiles(dataTransfer) {
  const entries = [...(dataTransfer.items ?? [])]
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry?.())
  if (!entries.length || entries.some((e) => !e)) return [...dataTransfer.files]
  return (await Promise.all(entries.map(entryFiles))).flat()
}

export function hasFitFile(files) {
  return [...files].some((f) => /\.fit$/i.test(f.name))
}

// Sube un archivo y clasifica el resultado: importada, ya guardada o descartada (con el motivo)
async function importOne(file) {
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    return { file, status: 'failed', message: `Supera el máximo de ${MAX_FILE_MB} MB` }
  }
  const form = new FormData()
  form.append('file', file)
  try {
    const activity = await api('/activities/import', { method: 'POST', body: form })
    return { file, status: 'imported', activity }
  } catch (err) {
    if (err.status === 409) return { file, status: 'duplicate', message: err.message }
    return { file, status: 'failed', message: err.message }
  }
}

// Importa los archivos con unas pocas subidas en paralelo; avisa de cada resultado
export async function importFiles(files, { concurrency = 3, onResult, signal } = {}) {
  let index = 0
  async function worker() {
    while (index < files.length && !signal?.aborted) {
      const file = files[index++]
      onResult(await importOne(file))
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker))
}
