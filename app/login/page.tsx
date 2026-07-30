import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { LoginForm } from './login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ changed?: string }>
}) {
  const user = await getSessionUser()
  if (user) redirect(user.mustChangePassword ? '/change-password' : '/')

  const { changed } = await searchParams
  return <LoginForm changed={changed === '1'} />
}
