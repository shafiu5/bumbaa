'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { stockColorClass } from '@/lib/stock'
import DateRangeFilter from '@/components/DateRangeFilter'
import type { LocationStock, VesselUsage } from '@/lib/types'

const VESSEL_COLORS = ['#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1']

type Activity = {
  id: string
  kind: 'delivery' | 'fuel_entry' | 'adjustment'
  date: string
  quantity: number
  location_name: string
  vessel_name: string | null
}

type ChartRow = { date: string; stock: number; [vesselId: string]: number | string }

type DashboardData = {
  stock: LocationStock[]
  usage: VesselUsage[]
  activity: Activity[]
  chartData: ChartRow[]
}

type DeliveryRow = {
  id: string
  quantity: number
  delivered_at: string
  locations: { name: string } | null
}
type EntryRow = {
  id: string
  quantity: number
  filled_at: string
  vessel_id: string
  locations: { name: string } | null
  vessels: { name: string } | null
}
type AdjustmentRow = {
  id: string
  quantity: number
  adjusted_at: string
  locations: { name: string } | null
}

async function fetchDashboardData(
  supabase: ReturnType<typeof createClient>
): Promise<DashboardData> {
  const [stockRes, usageRes, deliveriesRes, entriesRes, adjustmentsRes] = await Promise.all([
    supabase.from('location_stock').select('*').order('name'),
    supabase.from('vessel_usage').select('*').order('total_used', { ascending: false }),
    supabase
      .from('deliveries')
      .select('id, quantity, delivered_at, locations(name)')
      .order('delivered_at', { ascending: true }),
    supabase
      .from('fuel_entries')
      .select('id, quantity, filled_at, vessel_id, locations(name), vessels(name)')
      .order('filled_at', { ascending: true }),
    supabase
      .from('adjustments')
      .select('id, quantity, adjusted_at, locations(name)')
      .order('adjusted_at', { ascending: true }),
  ])
  if (stockRes.error) throw stockRes.error
  if (usageRes.error) throw usageRes.error
  if (deliveriesRes.error) throw deliveriesRes.error
  if (entriesRes.error) throw entriesRes.error
  if (adjustmentsRes.error) throw adjustmentsRes.error

  const deliveries = (deliveriesRes.data as unknown as DeliveryRow[]) ?? []
  const entries = (entriesRes.data as unknown as EntryRow[]) ?? []
  const adjustments = (adjustmentsRes.data as unknown as AdjustmentRow[]) ?? []
  const usage = (usageRes.data as VesselUsage[]) ?? []

  const deliveryActivity: Activity[] = deliveries.map((d) => ({
    id: d.id,
    kind: 'delivery',
    date: d.delivered_at,
    quantity: d.quantity,
    location_name: d.locations?.name ?? '—',
    vessel_name: null,
  }))
  const entryActivity: Activity[] = entries.map((f) => ({
    id: f.id,
    kind: 'fuel_entry',
    date: f.filled_at,
    quantity: f.quantity,
    location_name: f.locations?.name ?? '—',
    vessel_name: f.vessels?.name ?? '—',
  }))
  const adjustmentActivity: Activity[] = adjustments.map((a) => ({
    id: a.id,
    kind: 'adjustment',
    date: a.adjusted_at,
    quantity: a.quantity,
    location_name: a.locations?.name ?? '—',
    vessel_name: null,
  }))
  const activity = [...deliveryActivity, ...entryActivity, ...adjustmentActivity].sort((a, b) =>
    a.date < b.date ? 1 : -1
  )

  const deliveriesByDate = new Map<string, DeliveryRow[]>()
  for (const d of deliveries) {
    deliveriesByDate.set(d.delivered_at, [...(deliveriesByDate.get(d.delivered_at) ?? []), d])
  }
  const entriesByDate = new Map<string, EntryRow[]>()
  for (const e of entries) {
    entriesByDate.set(e.filled_at, [...(entriesByDate.get(e.filled_at) ?? []), e])
  }
  const adjustmentsByDate = new Map<string, AdjustmentRow[]>()
  for (const a of adjustments) {
    adjustmentsByDate.set(a.adjusted_at, [...(adjustmentsByDate.get(a.adjusted_at) ?? []), a])
  }

  const allDates = [
    ...new Set([...deliveriesByDate.keys(), ...entriesByDate.keys(), ...adjustmentsByDate.keys()]),
  ].sort()

  let runningStock = 0
  const vesselRunning: Record<string, number> = Object.fromEntries(usage.map((v) => [v.vessel_id, 0]))
  const chartData: ChartRow[] = allDates.map((date) => {
    for (const d of deliveriesByDate.get(date) ?? []) runningStock += d.quantity
    for (const e of entriesByDate.get(date) ?? []) {
      runningStock -= e.quantity
      vesselRunning[e.vessel_id] = (vesselRunning[e.vessel_id] ?? 0) + e.quantity
    }
    for (const a of adjustmentsByDate.get(date) ?? []) runningStock += a.quantity
    return { date, stock: runningStock, ...vesselRunning }
  })

  return {
    stock: (stockRes.data as LocationStock[]) ?? [],
    usage,
    activity,
    chartData,
  }
}

export default function DashboardPage() {
  const supabase = createClient()
  const [data, setData] = useState<DashboardData>({ stock: [], usage: [], activity: [], chartData: [] })
  const [loading, setLoading] = useState(true)

  const [showLogFuel, setShowLogFuel] = useState(false)
  const [vesselId, setVesselId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [filledAt, setFilledAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [chartFrom, setChartFrom] = useState('')
  const [chartTo, setChartTo] = useState('')
  const [activityFrom, setActivityFrom] = useState('')
  const [activityTo, setActivityTo] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)

  async function refresh() {
    setLoadError(null)
    try {
      const result = await fetchDashboardData(supabase)
      setData(result)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load the dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    fetchDashboardData(supabase)
      .then((result) => {
        if (cancelled) return
        setData(result)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof Error ? err.message : 'Failed to load the dashboard.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const { stock, usage, activity, chartData } = data
  const effectiveVesselId = vesselId || usage[0]?.vessel_id || ''
  const effectiveLocationId = locationId || stock[0]?.location_id || ''

  const filteredChartData = useMemo(
    () =>
      chartData.filter(
        (d) => (!chartFrom || d.date >= chartFrom) && (!chartTo || d.date <= chartTo)
      ),
    [chartData, chartFrom, chartTo]
  )

  const filteredActivity = useMemo(() => {
    if (!activityFrom && !activityTo) return activity.slice(0, 8)
    return activity
      .filter((a) => (!activityFrom || a.date >= activityFrom) && (!activityTo || a.date <= activityTo))
      .slice(0, 50)
  }, [activity, activityFrom, activityTo])

  async function logFuel(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('fuel_entries').insert({
      vessel_id: effectiveVesselId,
      location_id: effectiveLocationId,
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
    setShowLogFuel(false)
    refresh()
  }

  const totalStock = stock.reduce((sum, s) => sum + s.current_stock, 0)
  const totalUsed = usage.reduce((sum, u) => sum + u.total_used, 0)

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button
          onClick={() => setShowLogFuel((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-medium"
        >
          {showLogFuel ? <X size={16} strokeWidth={1.75} /> : <Plus size={16} strokeWidth={1.75} />}
          {showLogFuel ? 'Cancel' : 'Log fuel'}
        </button>
      </div>

      {showLogFuel && (
        <form
          onSubmit={logFuel}
          className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3"
        >
          <select
            required
            value={effectiveVesselId}
            onChange={(e) => setVesselId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
          >
            {usage.length === 0 && <option value="">No vessels yet</option>}
            {usage.map((v) => (
              <option key={v.vessel_id} value={v.vessel_id}>
                {v.name}
              </option>
            ))}
          </select>
          <select
            required
            value={effectiveLocationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
          >
            {stock.length === 0 && <option value="">No locations yet</option>}
            {stock.map((l) => (
              <option key={l.location_id} value={l.location_id}>
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
            disabled={saving || !effectiveVesselId || !effectiveLocationId}
            className="w-full rounded-lg bg-sky-600 text-white py-2 font-medium disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save entry'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-gray-400 dark:text-gray-500">Loading…</p>
      ) : loadError ? (
        <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 space-y-2">
          <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
          <button onClick={refresh} className="text-sm font-medium text-sky-600 dark:text-sky-400">
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total stock on hand</p>
              <p className="text-2xl font-bold">{totalStock.toLocaleString()} L</p>
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">Total fuel used</p>
              <p className="text-2xl font-bold">{totalUsed.toLocaleString()} L</p>
            </div>
          </div>

          <section>
            <h2 className="font-semibold mb-2">Fleet-wide stock &amp; usage</h2>
            <DateRangeFilter from={chartFrom} to={chartTo} onFromChange={setChartFrom} onToChange={setChartTo} />
            {filteredChartData.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">No activity in this range.</p>
            ) : (
              <div className="h-64 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filteredChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-neutral-800" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number, key: string) => [`${v.toLocaleString()} L`, key]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="stepAfter"
                      dataKey="stock"
                      name="Total stock"
                      stroke="#0284c7"
                      strokeWidth={2}
                      dot={false}
                    />
                    {usage.map((v, i) => (
                      <Line
                        key={v.vessel_id}
                        type="monotone"
                        dataKey={v.vessel_id}
                        name={v.name}
                        stroke={VESSEL_COLORS[i % VESSEL_COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">Stock by location</h2>
              <Link href="/locations" className="text-sm text-sky-600 dark:text-sky-400">
                View all
              </Link>
            </div>
            {stock.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                No locations yet. <Link href="/locations" className="text-sky-600 dark:text-sky-400">Add one</Link>.
              </p>
            ) : (
              <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-gray-100 dark:divide-neutral-800">
                {stock.map((s) => (
                  <Link
                    key={s.location_id}
                    href={`/locations/${s.location_id}`}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <span>{s.name}</span>
                    <span className={`font-medium ${stockColorClass(s.current_stock, s.low_stock_threshold)}`}>
                      {s.current_stock.toLocaleString()} L
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="font-semibold mb-2">Recent activity</h2>
            <DateRangeFilter
              from={activityFrom}
              to={activityTo}
              onFromChange={setActivityFrom}
              onToChange={setActivityTo}
            />
            {filteredActivity.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                {activityFrom || activityTo ? 'No activity in this range.' : 'Nothing logged yet.'}
              </p>
            ) : (
              <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-gray-100 dark:divide-neutral-800">
                {filteredActivity.map((a) => (
                  <div key={`${a.kind}-${a.id}`} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <p>
                        {a.kind === 'delivery'
                          ? `Delivery → ${a.location_name}`
                          : a.kind === 'fuel_entry'
                            ? `${a.vessel_name} ← ${a.location_name}`
                            : `Adjustment → ${a.location_name}`}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{a.date}</p>
                    </div>
                    <span className="font-medium">
                      {a.kind === 'fuel_entry' ? '−' : a.quantity < 0 ? '−' : '+'}
                      {Math.abs(a.quantity).toLocaleString()} L
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}
