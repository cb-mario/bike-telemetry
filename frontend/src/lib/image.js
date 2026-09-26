// Recorta una imagen al cuadrado central y la reduce a `size` px antes de subirla, para que
// la foto de perfil pese unas decenas de kB. WebP si el navegador sabe generarlo; si no, JPEG
export async function squareImage(file, size = 256) {
  let bitmap
  try {
    // Respeta la orientación EXIF de las fotos del móvil
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('No se puede leer esa imagen. Prueba con una foto JPG o PNG.')
  }
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  bitmap.close()

  const toBlob = (type) => new Promise((resolve) => canvas.toBlob(resolve, type, 0.85))
  // Sin soporte de WebP, toBlob devuelve PNG: entonces mejor JPEG, que pesa menos
  let blob = await toBlob('image/webp')
  if (blob?.type !== 'image/webp') blob = await toBlob('image/jpeg')
  if (!blob) throw new Error('No se pudo preparar la foto.')
  return blob
}
