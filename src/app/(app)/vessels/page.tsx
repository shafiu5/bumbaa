'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { VesselUsage } from '@/lib/types'

export default function VesselsPage() {
  const supabase = createClient()
  const [vessels, setVessels] = useState<VesselUsage[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const { data, error } = await supabase.from('vessel_usage').select('*').order('name')
      if (error) throw error
      setVessels((data as VesselUsage[]) ?? [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load vessels.')
    } finally {
      setLoading(false)
    }
  }

  async function addVessel(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('vessels').insert({ name, notes })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setName('')
    setNotes('')
    setShowAdd(false)
    load()
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Vessels</h1>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-medium"
        >
          {showAdd ? <X size={16} strokeWidth={1.75} /> : <Plus size={16} strokeWidth={1.75} />}
          {showAdd ? 'Cancel' : 'Add vessel'}
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={addVessel}
          className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3"
        >
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Vessel name"
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
          />
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            disabled={saving}
            className="w-full rounded-lg bg-sky-600 text-white py-2 font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save vessel'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400 dark:text-gray-500">Loading…</p>
      ) : loadError ? (
        <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 space-y-2">
          <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
          <button onClick={load} className="text-sm font-medium text-sky-600 dark:text-sky-400">
            Retry
          </button>
        </div>
      ) : vessels.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">No vessels yet.</p>
      ) : (
        <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-gray-100 dark:divide-neutral-800">
          {vessels.map((v) => (
            <Link
              key={v.vessel_id}
              href={`/vessels/${v.vessel_id}`}
              className="flex items-center justify-between px-4 py-3"
            >
              <div>
                <p className="font-medium">{v.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{v.fill_count} fills</p>
              </div>
              <span className="font-medium">{v.total_used.toLocaleString()} L</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  )
}
