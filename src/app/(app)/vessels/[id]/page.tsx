'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowLeft, Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import DateRangeFilter from '@/components/DateRangeFilter'
import type { Location, Vessel } from '@/lib/types'

type EntryRow = {
  id: string
  quantity: number
  filled_at: string
  notes: string
  location_id: string
  locations: { name: string } | null
}
type LocationAvgCostRow = { location_id: string; avg_cost_per_unit: number | null }

export default function VesselDetailPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()
  const [vessel, setVessel] = useState<Vessel | null>(null)
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [avgCostByLocation, setAvgCostByLocation] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)

  const [showAdd, setShowAdd] = useState(false)
  const [locationId, setLocationId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [filledAt, setFilledAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [chartFrom, setChartFrom] = useState('')
  const [chartTo, setChartTo] = useState('')

  useEffect(() => {
    if (id) load()
  }, [id])

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const [vesselRes, entriesRes, locationsRes, avgCostRes] = await Promise.all([
        supabase.from('vessels').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('fuel_entries')
          .select('id, quantity, filled_at, notes, location_id, locations(name)')
          .eq('vessel_id', id)
          .order('filled_at', { ascending: false }),
        supabase.from('locations').select('*').order('name'),
        supabase.from('location_avg_cost').select('location_id, avg_cost_per_unit'),
      ])
      if (vesselRes.error) throw vesselRes.error
      if (entriesRes.error) throw entriesRes.error
      if (locationsRes.error) throw locationsRes.error
      if (avgCostRes.error) throw avgCostRes.error
      setVessel(vesselRes.data as Vessel)
      setEntries((entriesRes.data as unknown as EntryRow[]) ?? [])
      setLocations((locationsRes.data as Location[]) ?? [])
      setAvgCostByLocation(
        new Map(
          ((avgCostRes.data as LocationAvgCostRow[]) ?? [])
            .filter((r) => r.avg_cost_per_unit != null)
            .map((r) => [r.location_id, r.avg_cost_per_unit as number])
        )
      )
      if (!locationId && locationsRes.data?.[0]) {
        setLocationId(locationsRes.data[0].id)
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load this vessel.')
    } finally {
      setLoading(false)
    }
  }

  async function addEntry(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('fuel_entries').insert({
      vessel_id: id,
      location_id: locationId,
      quantity: Number(quantity),
      filled_at: filledAt,
      notes,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setQuantity('')
    setNotes('')
    setShowAdd(false)
    load()
  }

  const chartData = useMemo(() => {
    const byMonth = new Map<string, number>()
    for (const e of entries) {
      if (chartFrom && e.filled_at < chartFrom) continue
      if (chartTo && e.filled_at > chartTo) continue
      const month = e.filled_at.slice(0, 7)
      byMonth.set(month, (byMonth.get(month) ?? 0) + Number(e.quantity))
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([month, total]) => ({ month, total }))
  }, [entries, chartFrom, chartTo])

  const totalUsed = entries.reduce((sum, e) => sum + Number(e.quantity), 0)

  if (loading) {
    return <main className="max-w-2xl mx-auto px-4 py-6 text-gray-400 dark:text-gray-500">Loading…</main>
  }
  if (loadError) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 space-y-2">
          <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
          <button onClick={load} className="text-sm font-medium text-sky-600 dark:text-sky-400">
            Retry
          </button>
        </div>
      </main>
    )
  }
  if (!vessel) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Link
          href="/vessels"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
        >
          <ArrowLeft size={16} strokeWidth={1.75} />
          Vessels
        </Link>
        <p className="text-gray-400 dark:text-gray-500">Vessel not found.</p>
      </main>
    )
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <Link
        href="/vessels"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
      >
        <ArrowLeft size={16} strokeWidth={1.75} />
        Vessels
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{vessel.name}</h1>
        {vessel.notes && <p className="text-sm text-gray-500 dark:text-gray-400">{vessel.notes}</p>}
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Total used: <span className="font-medium text-gray-900 dark:text-gray-100">{totalUsed.toLocaleString()} L</span>
        </p>
      </div>

      <section>
        <h2 className="font-semibold mb-2">Usage by month</h2>
        <DateRangeFilter from={chartFrom} to={chartTo} onFromChange={setChartFrom} onToChange={setChartTo} />
        {chartData.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No fuel logged yet.</p>
        ) : (
          <div className="h-56 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-neutral-800" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`${v.toLocaleString()} L`, 'Used']} />
                <Bar dataKey="total" fill="#0284c7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Fuel log</h2>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-medium"
          >
            {showAdd ? <X size={16} strokeWidth={1.75} /> : <Plus size={16} strokeWidth={1.75} />}
            {showAdd ? 'Cancel' : 'Log fuel'}
          </button>
        </div>

        {showAdd && (
          <form
            onSubmit={addEntry}
            className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3 mb-3"
          >
            <select
              required
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
            >
              {locations.length === 0 && <option value="">No locations yet</option>}
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Quantity (litres)"
              className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
            />
            <input
              required
              type="date"
              value={filledAt}
              onChange={(e) => setFilledAt(e.target.value)}
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
              disabled={saving || !locationId}
              className="w-full rounded-lg bg-sky-600 text-white py-2 font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save entry'}
            </button>
          </form>
        )}

        {entries.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No fuel logged yet.</p>
        ) : (
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-gray-100 dark:divide-neutral-800">
            {entries.map((e) => {
              const avgCostPerUnit = avgCostByLocation.get(e.location_id) ?? null
              const cost = avgCostPerUnit != null ? Number(e.quantity) * avgCostPerUnit : null
              return (
                <div key={e.id} className="flex items-start justify-between px-4 py-3 text-sm">
                  <div>
                    <p>{e.locations?.name ?? '—'}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {e.filled_at}
                      {e.notes ? ` · ${e.notes}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-medium">{Number(e.quantity).toLocaleString()} L</span>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {cost != null
                        ? `≈ ${cost.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} (avg ${avgCostPerUnit!.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}/L)`
                        : 'No priced deliveries yet'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
