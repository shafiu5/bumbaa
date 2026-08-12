'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Plus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { stockColorClass } from '@/lib/stock'
import { currentMonthRange } from '@/lib/dateRange'
import DateRangeFilter from '@/components/DateRangeFilter'
import { Skeleton, SkeletonCard, SkeletonChart, SkeletonList } from '@/components/Skeleton'
import type { LocationStock, VesselUsage } from '@/lib/types'

const VESSEL_COLORS = ['#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1']
const MAX_AUTO_RETRIES = 4
const RETRY_DELAY_MS = 2000

type Activity = {
  id: string
  kind: 'delivery' | 'fuel_entry' | 'adjustment'
  date: string
  quantity: number
  location_name: string
  vessel_name: string | null
  cost: number | null
  avgCostPerUnit: number | null
}

type ChartRow = { date: string; stock: number }
type VesselEntry = { vesselId: string; date: string; quantity: number }

type DashboardData = {
  stock: LocationStock[]
  usage: VesselUsage[]
  activity: Activity[]
  chartData: ChartRow[]
  vesselEntries: VesselEntry[]
}

type DeliveryRow = {
  id: string
  quantity: number
  total_cost: number | null
  delivered_at: string
  location_id: string
  locations: { name: string } | null
}
type EntryRow = {
  id: string
  quantity: number
  filled_at: string
  vessel_id: string
  location_id: string
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
      .select('id, quantity, total_cost, delivered_at, location_id, locations(name)')
      .order('delivered_at', { ascending: true }),
    supabase
      .from('fuel_entries')
      .select('id, quantity, filled_at, vessel_id, location_id, locations(name), vessels(name)')
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

  const costedByLocation = new Map<string, { totalCost: number; totalQty: number }>()
  for (const d of deliveries) {
    if (d.total_cost == null) continue
    const agg = costedByLocation.get(d.location_id) ?? { totalCost: 0, totalQty: 0 }
    agg.totalCost += d.total_cost
    agg.totalQty += d.quantity
    costedByLocation.set(d.location_id, agg)
  }
  const avgCostByLocation = new Map<string, number>()
  for (const [locationId, agg] of costedByLocation) {
    if (agg.totalQty > 0) avgCostByLocation.set(locationId, agg.totalCost / agg.totalQty)
  }

  const deliveryActivity: Activity[] = deliveries.map((d) => ({
    id: d.id,
    kind: 'delivery',
    date: d.delivered_at,
    quantity: d.quantity,
    location_name: d.locations?.name ?? '—',
    vessel_name: null,
    cost: d.total_cost,
    avgCostPerUnit: null,
  }))
  const entryActivity: Activity[] = entries.map((f) => {
    const avgCostPerUnit = avgCostByLocation.get(f.location_id) ?? null
    return {
      id: f.id,
      kind: 'fuel_entry',
      date: f.filled_at,
      quantity: f.quantity,
      location_name: f.locations?.name ?? '—',
      vessel_name: f.vessels?.name ?? '—',
      cost: avgCostPerUnit != null ? f.quantity * avgCostPerUnit : null,
      avgCostPerUnit,
    }
  })
  const adjustmentActivity: Activity[] = adjustments.map((a) => ({
    id: a.id,
    kind: 'adjustment',
    date: a.adjusted_at,
    quantity: a.quantity,
    location_name: a.locations?.name ?? '—',
    vessel_name: null,
    cost: null,
    avgCostPerUnit: null,
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
  const chartData: ChartRow[] = allDates.map((date) => {
    for (const d of deliveriesByDate.get(date) ?? []) runningStock += d.quantity
    for (const e of entriesByDate.get(date) ?? []) runningStock -= e.quantity
    for (const a of adjustmentsByDate.get(date) ?? []) runningStock += a.quantity
    return { date, stock: runningStock }
  })

  const vesselEntries: VesselEntry[] = entries.map((e) => ({
    vesselId: e.vessel_id,
    date: e.filled_at,
    quantity: e.quantity,
  }))

  return {
    stock: (stockRes.data as LocationStock[]) ?? [],
    usage,
    activity,
    chartData,
    vesselEntries,
  }
}

export default function DashboardPage() {
  const supabase = createClient()
  const [data, setData] = useState<DashboardData>({
    stock: [],
    usage: [],
    activity: [],
    chartData: [],
    vesselEntries: [],
  })
  const [loading, setLoading] = useState(true)

  const [showLogFuel, setShowLogFuel] = useState(false)
  const [vesselId, setVesselId] = useState('')
  const [locationId, setLocationId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [filledAt, setFilledAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [chartFrom, setChartFrom] = useState(() => currentMonthRange().from)
  const [chartTo, setChartTo] = useState(() => currentMonthRange().to)
  const [activityFrom, setActivityFrom] = useState(() => currentMonthRange().from)
  const [activityTo, setActivityTo] = useState(() => currentMonthRange().to)
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

    function attemptLoad(attempt: number) {
      fetchDashboardData(supabase)
        .then((result) => {
          if (cancelled) return
          setData(result)
          setLoadError(null)
          setLoading(false)
        })
        .catch((err) => {
          if (cancelled) return
          if (attempt < MAX_AUTO_RETRIES) {
            setTimeout(() => {
              if (!cancelled) attemptLoad(attempt + 1)
            }, RETRY_DELAY_MS)
          } else {
            setLoadError(err instanceof Error ? err.message : 'Failed to load the dashboard.')
            setLoading(false)
          }
        })
    }

    attemptLoad(0)
    return () => {
      cancelled = true
    }
  }, [])

  const { stock, usage, activity, chartData, vesselEntries } = data
  const effectiveVesselId = vesselId || usage[0]?.vessel_id || ''
  const effectiveLocationId = locationId || stock[0]?.location_id || ''

  const filteredChartData = useMemo(
    () =>
      chartData.filter(
        (d) => (!chartFrom || d.date >= chartFrom) && (!chartTo || d.date <= chartTo)
      ),
    [chartData, chartFrom, chartTo]
  )

  const vesselUsageInRange = useMemo(() => {
    const totals = new Map<string, number>()
    for (const e of vesselEntries) {
      if (chartFrom && e.date < chartFrom) continue
      if (chartTo && e.date > chartTo) continue
      totals.set(e.vesselId, (totals.get(e.vesselId) ?? 0) + e.quantity)
    }
    return usage
      .map((v) => ({ vesselId: v.vessel_id, name: v.name, total: totals.get(v.vessel_id) ?? 0 }))
      .sort((a, b) => b.total - a.total)
  }, [vesselEntries, usage, chartFrom, chartTo])

  function vesselColor(vesselId: string) {
    const idx = vesselUsageInRange.findIndex((v) => v.vesselId === vesselId)
    return VESSEL_COLORS[idx % VESSEL_COLORS.length]
  }

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
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonChart heightClass="h-56" />
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 flex items-center gap-4">
            <Skeleton className="h-40 w-40 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <SkeletonList rows={3} />
          <SkeletonList rows={4} />
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 space-y-2">
          <p className="text-sm text-red-600 dark:text-red-400">
            Still failing after retrying automatically: {loadError}
          </p>
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
            <h2 className="font-semibold mb-2">Stock over time</h2>
            <DateRangeFilter from={chartFrom} to={chartTo} onFromChange={setChartFrom} onToChange={setChartTo} />
            {filteredChartData.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">No activity in this range.</p>
            ) : (
              <div className="h-56 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filteredChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-neutral-800" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip formatter={(v: number) => [`${v.toLocaleString()} L`, 'Stock']} />
                    <Line type="stepAfter" dataKey="stock" stroke="#0284c7" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section>
            <h2 className="font-semibold mb-2">Fuel used by vessel</h2>
            {vesselUsageInRange.length === 0 || vesselUsageInRange.every((v) => v.total === 0) ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">No fuel used in this range.</p>
            ) : (
              <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 flex items-center gap-4">
                <div className="h-40 w-40 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={vesselUsageInRange.filter((v) => v.total > 0)}
                        dataKey="total"
                        nameKey="name"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={2}
                      >
                        {vesselUsageInRange
                          .filter((v) => v.total > 0)
                          .map((v) => (
                            <Cell key={v.vesselId} fill={vesselColor(v.vesselId)} />
                          ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`${v.toLocaleString()} L`, 'Used']} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 min-w-0 divide-y divide-gray-100 dark:divide-neutral-800">
                  {vesselUsageInRange.map((v) => (
                    <div key={v.vesselId} className="flex items-center justify-between py-2 text-sm">
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: vesselColor(v.vesselId) }}
                        />
                        <span className="truncate">{v.name}</span>
                      </span>
                      <span className="font-medium shrink-0 ml-2">{v.total.toLocaleString()} L</span>
                    </div>
                  ))}
                </div>
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
              <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
                {stock.map((s) => (
                  <Link
                    key={s.location_id}
                    href={`/locations/${s.location_id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
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
              <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
                {filteredActivity.map((a) => (
                  <div key={`${a.kind}-${a.id}`} className="flex items-start justify-between px-4 py-3 text-sm">
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
                    <div className="text-right">
                      <span className="font-medium">
                        {a.kind === 'fuel_entry' ? '−' : a.quantity < 0 ? '−' : '+'}
                        {Math.abs(a.quantity).toLocaleString()} L
                      </span>
                      {a.kind === 'delivery' && a.cost != null && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          Total{' '}
                          {a.cost.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      )}
                      {a.kind === 'fuel_entry' && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {a.cost != null
                            ? `≈ ${a.cost.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })} (avg ${a.avgCostPerUnit!.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}/L)`
                            : 'No priced deliveries yet'}
                        </p>
                      )}
                    </div>
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
