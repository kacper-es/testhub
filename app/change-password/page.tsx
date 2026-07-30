import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { ChangePasswordForm } from './change-password-form'

export default async function ChangePasswordPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  return <ChangePasswordForm mustChange={user.mustChangePassword} />
}
