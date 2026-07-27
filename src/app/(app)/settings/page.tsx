'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, TriangleAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const RESET_PHRASE = 'RESET'

export default function SettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const [resetConfirmText, setResetConfirmText] = useState('')
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [resetSuccess, setResetSuccess] = useState(false)

  async function changePassword(e: FormEvent) {
    e.preventDefault()
    setSuccess(false)
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setSaving(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setSuccess(true)
    setPassword('')
    setConfirmPassword('')
  }

  async function signOut() {
    setSigningOut(true)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  async function resetActivity(e: FormEvent) {
    e.preventDefault()
    setResetting(true)
    setResetError(null)
    setResetSuccess(false)
    try {
      const [deliveriesRes, entriesRes, adjustmentsRes] = await Promise.all([
        supabase.from('deliveries').delete().not('id', 'is', null),
        supabase.from('fuel_entries').delete().not('id', 'is', null),
        supabase.from('adjustments').delete().not('id', 'is', null),
      ])
      if (deliveriesRes.error) throw deliveriesRes.error
      if (entriesRes.error) throw entriesRes.error
      if (adjustmentsRes.error) throw adjustmentsRes.error
      setResetSuccess(true)
      setResetConfirmText('')
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Failed to reset activity.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section>
        <h2 className="font-semibold mb-2">Change password</h2>
        <form
          onSubmit={changePassword}
          className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3"
        >
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password"
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
          />
          <input
            type="password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {success && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">Password updated.</p>
          )}
          <button
            disabled={saving}
            className="w-full rounded-lg bg-sky-600 text-white py-2 font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </section>

      <section>
        <button
          onClick={signOut}
          disabled={signingOut}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 py-2 font-medium disabled:opacity-50"
        >
          <LogOut size={16} strokeWidth={1.75} />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </section>

      <section>
        <h2 className="font-semibold mb-2 flex items-center gap-1.5 text-red-600 dark:text-red-400">
          <TriangleAlert size={18} strokeWidth={1.75} />
          Danger zone
        </h2>
        <form
          onSubmit={resetActivity}
          className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-4 space-y-3"
        >
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">Reset all activity</p>
            <p className="text-sm text-red-600/80 dark:text-red-400/70 mt-1">
              Permanently deletes every delivery, fuel entry, and stock adjustment across all locations
              and vessels. Your vessels and locations themselves are kept, but their stock and usage
              history resets to zero. This cannot be undone.
            </p>
          </div>
          <input
            type="text"
            value={resetConfirmText}
            onChange={(e) => setResetConfirmText(e.target.value)}
            placeholder={`Type ${RESET_PHRASE} to confirm`}
            className="w-full rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-neutral-900 px-3 py-2"
          />
          {resetError && <p className="text-sm text-red-600 dark:text-red-400">{resetError}</p>}
          {resetSuccess && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              All activity has been cleared.
            </p>
          )}
          <button
            disabled={resetting || resetConfirmText !== RESET_PHRASE}
            className="w-full rounded-lg bg-red-600 text-white py-2 font-medium disabled:opacity-50"
          >
            {resetting ? 'Resetting…' : 'Reset all activity'}
          </button>
        </form>
      </section>
    </main>
  )
}
