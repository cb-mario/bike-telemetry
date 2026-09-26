import { initials } from '../lib/user'

// Foto de perfil o, si no hay, iniciales en la tinta de las superficies
export function Avatar({ user, size = 'size-8 text-xs' }) {
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt="" className={`shrink-0 rounded-full object-cover ring-1 ring-zinc-600 ${size}`} />
  }
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full bg-zinc-700 font-semibold text-zinc-50 ring-1 ring-zinc-600 ${size}`}>
      {initials(user)}
    </span>
  )
}
