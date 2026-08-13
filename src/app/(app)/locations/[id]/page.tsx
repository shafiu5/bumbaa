'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowLeft, Pencil, Plus, Sliders, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { stockColorClass } from '@/lib/stock'
import { currentMonthRange } from '@/lib/dateRange'
import DateRangeFilter from '@/components/DateRangeFilter'
import { Skeleton, SkeletonChart, SkeletonHeader, SkeletonList } from '@/components/Skeleton'
import { computeFifoCosts } from '@/lib/fifoCost'
import type { Location } from '@/lib/types'

type DeliveryRow = {
  id: string
  quantity: number
  total_cost: number | null
  delivered_at: string
  created_at: string
  notes: string
}
type EntryRow = {
  id: string
  quantity: number
  filled_at: string
  created_at: string
  notes: string
  vessels: { name: string } | null
}
type AdjustmentRow = { id: string; quantity: number; adjusted_at: string; notes: string }

type TimelineItem = {
  id: string
  kind: 'delivery' | 'dispense' | 'adjustment'
  date: string
  quantity: number
  label: string
  totalCost?: number | null
  unitCost?: number | null
}

export default function LocationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const supabase = createClient()
  const [location, setLocation] = useState<Location | null>(null)
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([])
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([])
  const [loading, setLoading] = useState(true)

  const [showAdd, setShowAdd] = useState(false)
  const [quantity, setQuantity] = useState('')
  const [pricePerLiter, setPricePerLiter] = useState('')
  const [deliveredAt, setDeliveredAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showAdjust, setShowAdjust] = useState(false)
  const [adjustDirection, setAdjustDirection] = useState<'add' | 'remove'>('add')
  const [adjustQuantity, setAdjustQuantity] = useState('')
  const [adjustedAt, setAdjustedAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [adjustNotes, setAdjustNotes] = useState('')
  const [savingAdjust, setSavingAdjust] = useState(false)
  const [adjustError, setAdjustError] = useState<string | null>(null)

  const [thresholdInput, setThresholdInput] = useState('')
  const [savingThreshold, setSavingThreshold] = useState(false)
  const [thresholdError, setThresholdError] = useState<string | null>(null)

  const [chartFrom, setChartFrom] = useState(() => currentMonthRange().from)
  const [chartTo, setChartTo] = useState(() => currentMonthRange().to)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [editingDeliveryId, setEditingDeliveryId] = useState<string | null>(null)
  const [editPricePerLiter, setEditPricePerLiter] = useState('')
  const [savingEditPrice, setSavingEditPrice] = useState(false)
  const [editPriceError, setEditPriceError] = useState<string | null>(null)

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editEntryQuantity, setEditEntryQuantity] = useState('')
  const [editEntryDate, setEditEntryDate] = useState('')
  const [savingEditEntry, setSavingEditEntry] = useState(false)
  const [editEntryError, setEditEntryError] = useState<string | null>(null)

  useEffect(() => {
    if (id) load()
  }, [id])

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const [locationRes, deliveriesRes, entriesRes, adjustmentsRes] = await Promise.all([
        supabase.from('locations').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('deliveries')
          .select('id, quantity, total_cost, delivered_at, created_at, notes')
          .eq('location_id', id)
          .order('delivered_at', { ascending: false }),
        supabase
          .from('fuel_entries')
          .select('id, quantity, filled_at, created_at, notes, vessels(name)')
          .eq('location_id', id)
          .order('filled_at', { ascending: false }),
        supabase
          .from('adjustments')
          .select('id, quantity, adjusted_at, notes')
          .eq('location_id', id)
          .order('adjusted_at', { ascending: false }),
      ])
      if (locationRes.error) throw locationRes.error
      if (deliveriesRes.error) throw deliveriesRes.error
      if (entriesRes.error) throw entriesRes.error
      if (adjustmentsRes.error) throw adjustmentsRes.error
      const loadedLocation = locationRes.data as Location | null
      setLocation(loadedLocation)
      setThresholdInput(loadedLocation?.low_stock_threshold?.toString() ?? '')
      setDeliveries((deliveriesRes.data as DeliveryRow[]) ?? [])
      setEntries((entriesRes.data as unknown as EntryRow[]) ?? [])
      setAdjustments((adjustmentsRes.data as AdjustmentRow[]) ?? [])
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load this location.')
    } finally {
      setLoading(false)
    }
  }

  async function saveThreshold(e: FormEvent) {
    e.preventDefault()
    setSavingThreshold(true)
    setThresholdError(null)
    const value = thresholdInput.trim() === '' ? null : Number(thresholdInput)
    const { error } = await supabase
      .from('locations')
      .update({ low_stock_threshold: value })
      .eq('id', id)
    setSavingThreshold(false)
    if (error) {
      setThresholdError(error.message)
      return
    }
    setLocation((prev) => (prev ? { ...prev, low_stock_threshold: value } : prev))
  }

  const computedTotalCost =
    pricePerLiter.trim() !== '' && quantity.trim() !== ''
      ? Number(pricePerLiter) * Number(quantity)
      : null

  async function addDelivery(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('deliveries').insert({
      location_id: id,
      quantity: Number(quantity),
      total_cost: computedTotalCost,
      delivered_at: deliveredAt,
      notes,
    })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setQuantity('')
    setPricePerLiter('')
    setNotes('')
    setShowAdd(false)
    load()
  }

  async function addAdjustment(e: FormEvent) {
    e.preventDefault()
    setSavingAdjust(true)
    setAdjustError(null)
    const signedQuantity = adjustDirection === 'add' ? Number(adjustQuantity) : -Number(adjustQuantity)
    const { error } = await supabase.from('adjustments').insert({
      location_id: id,
      quantity: signedQuantity,
      adjusted_at: adjustedAt,
      notes: adjustNotes,
    })
    setSavingAdjust(false)
    if (error) {
      setAdjustError(error.message)
      return
    }
    setAdjustQuantity('')
    setAdjustNotes('')
    setShowAdjust(false)
    load()
  }

  function startEditPrice(delivery: { id: string; quantity: number; totalCost?: number | null }) {
    setEditingDeliveryId(delivery.id)
    setEditPriceError(null)
    setEditPricePerLiter(
      delivery.totalCost != null ? (delivery.totalCost / delivery.quantity).toString() : ''
    )
  }

  function cancelEditPrice() {
    setEditingDeliveryId(null)
    setEditPricePerLiter('')
    setEditPriceError(null)
  }

  async function saveEditPrice(delivery: { id: string; quantity: number }) {
    setSavingEditPrice(true)
    setEditPriceError(null)
    const newTotalCost =
      editPricePerLiter.trim() === '' ? null : Number(editPricePerLiter) * delivery.quantity
    const { error } = await supabase
      .from('deliveries')
      .update({ total_cost: newTotalCost })
      .eq('id', delivery.id)
    setSavingEditPrice(false)
    if (error) {
      setEditPriceError(error.message)
      return
    }
    cancelEditPrice()
    load()
  }

  function startEditEntry(entry: { id: string; quantity: number; date: string }) {
    setEditingEntryId(entry.id)
    setEditEntryError(null)
    setEditEntryQuantity(entry.quantity.toString())
    setEditEntryDate(entry.date)
  }

  function cancelEditEntry() {
    setEditingEntryId(null)
    setEditEntryQuantity('')
    setEditEntryDate('')
    setEditEntryError(null)
  }

  async function saveEditEntry(entryId: string) {
    setSavingEditEntry(true)
    setEditEntryError(null)
    const { error } = await supabase
      .from('fuel_entries')
      .update({ quantity: Number(editEntryQuantity), filled_at: editEntryDate })
      .eq('id', entryId)
    setSavingEditEntry(false)
    if (error) {
      setEditEntryError(error.message)
      return
    }
    cancelEditEntry()
    load()
  }

  const fifoCosts = useMemo(
    () =>
      computeFifoCosts(
        deliveries.map((d) => ({ ...d, location_id: id })),
        entries.map((e) => ({ ...e, location_id: id }))
      ),
    [deliveries, entries, id]
  )

  const timeline: TimelineItem[] = useMemo(() => {
    const d: TimelineItem[] = deliveries.map((x) => ({
      id: x.id,
      kind: 'delivery',
      date: x.delivered_at,
      quantity: x.quantity,
      label: 'Delivery',
      totalCost: x.total_cost,
    }))
    const e: TimelineItem[] = entries.map((x) => ({
      id: x.id,
      kind: 'dispense',
      date: x.filled_at,
      quantity: x.quantity,
      label: x.vessels?.name ?? 'Vessel',
      totalCost: fifoCosts.get(x.id)?.cost ?? null,
      unitCost: fifoCosts.get(x.id)?.unitCost ?? null,
    }))
    const a: TimelineItem[] = adjustments.map((x) => ({
      id: x.id,
      kind: 'adjustment',
      date: x.adjusted_at,
      quantity: x.quantity,
      label: x.notes || (x.quantity >= 0 ? 'Stock added' : 'Stock removed'),
    }))
    return [...d, ...e, ...a].sort((a, b) => (a.date < b.date ? -1 : 1))
  }, [deliveries, entries, adjustments, fifoCosts])

  const chartData = useMemo(() => {
    let running = 0
    return timeline.map((t) => {
      running += t.kind === 'dispense' ? -t.quantity : t.quantity
      return { date: t.date, stock: running }
    })
  }, [timeline])

  const currentStock = chartData.length ? chartData[chartData.length - 1].stock : 0

  const filteredChartData = useMemo(
    () =>
      chartData.filter(
        (d) => (!chartFrom || d.date >= chartFrom) && (!chartTo || d.date <= chartTo)
      ),
    [chartData, chartFrom, chartTo]
  )

  if (loading) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <SkeletonHeader />
        <Skeleton className="h-20 rounded-2xl" />
        <SkeletonChart />
        <SkeletonList rows={4} />
      </main>
    )
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
  if (!location) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <Link
          href="/locations"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
        >
          <ArrowLeft size={16} strokeWidth={1.75} />
          Locations
        </Link>
        <p className="text-gray-400 dark:text-gray-500">Location not found.</p>
      </main>
    )
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <Link
        href="/locations"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
      >
        <ArrowLeft size={16} strokeWidth={1.75} />
        Locations
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{location.name}</h1>
        {location.notes && <p className="text-sm text-gray-500 dark:text-gray-400">{location.notes}</p>}
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Current stock:{' '}
          <span className={`font-medium ${stockColorClass(currentStock, location.low_stock_threshold)}`}>
            {currentStock.toLocaleString()} L
          </span>
          {location.low_stock_threshold != null && currentStock <= location.low_stock_threshold && (
            <span className="ml-2 text-xs font-medium text-amber-600 dark:text-amber-400">Low stock</span>
          )}
        </p>
      </div>

      <section>
        <h2 className="font-semibold mb-2">Low stock alert</h2>
        <form
          onSubmit={saveThreshold}
          className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 flex items-end gap-3"
        >
          <div className="flex-1">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
              Alert when stock falls to or below (litres)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
              placeholder="No alert set"
              className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
            />
          </div>
          <button
            disabled={savingThreshold}
            className="rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {savingThreshold ? 'Saving…' : 'Save'}
          </button>
        </form>
        {thresholdError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{thresholdError}</p>}
      </section>

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
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Activity</h2>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowAdjust(false)
                setShowAdd((v) => !v)
              }}
              className="flex items-center gap-1.5 rounded-lg bg-sky-600 text-white px-4 py-2 text-sm font-medium"
            >
              {showAdd ? <X size={16} strokeWidth={1.75} /> : <Plus size={16} strokeWidth={1.75} />}
              {showAdd ? 'Cancel' : 'Log delivery'}
            </button>
            <button
              onClick={() => {
                setShowAdd(false)
                setShowAdjust((v) => !v)
              }}
              className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-neutral-700 px-4 py-2 text-sm font-medium"
            >
              {showAdjust ? <X size={16} strokeWidth={1.75} /> : <Sliders size={16} strokeWidth={1.75} />}
              {showAdjust ? 'Cancel' : 'Adjust stock'}
            </button>
          </div>
        </div>

        {showAdd && (
          <form
            onSubmit={addDelivery}
            className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3 mb-3"
          >
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Quantity delivered (litres)"
              className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={pricePerLiter}
              onChange={(e) => setPricePerLiter(e.target.value)}
              placeholder="Price per litre (optional)"
              className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
            />
            {computedTotalCost != null && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Total: <span className="font-medium text-gray-900 dark:text-gray-100">{computedTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </p>
            )}
            <input
              required
              type="date"
              value={deliveredAt}
              onChange={(e) => setDeliveredAt(e.target.value)}
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
              {saving ? 'Saving…' : 'Save delivery'}
            </button>
          </form>
        )}

        {showAdjust && (
          <form
            onSubmit={addAdjustment}
            className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 space-y-3 mb-3"
          >
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Use this to correct stock without a delivery or fill — e.g. a physical recount or spillage.
            </p>
            <div className="flex rounded-lg border border-gray-300 dark:border-neutral-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setAdjustDirection('add')}
                className={`flex-1 py-2 text-sm font-medium ${
                  adjustDirection === 'add'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white dark:bg-neutral-900 text-gray-600 dark:text-gray-400'
                }`}
              >
                Add stock
              </button>
              <button
                type="button"
                onClick={() => setAdjustDirection('remove')}
                className={`flex-1 py-2 text-sm font-medium ${
                  adjustDirection === 'remove'
                    ? 'bg-red-600 text-white'
                    : 'bg-white dark:bg-neutral-900 text-gray-600 dark:text-gray-400'
                }`}
              >
                Remove stock
              </button>
            </div>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={adjustQuantity}
              onChange={(e) => setAdjustQuantity(e.target.value)}
              placeholder="Quantity (litres)"
              className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
            />
            <input
              required
              type="date"
              value={adjustedAt}
              onChange={(e) => setAdjustedAt(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
            />
            <textarea
              value={adjustNotes}
              onChange={(e) => setAdjustNotes(e.target.value)}
              placeholder="Reason (optional, e.g. physical recount)"
              rows={2}
              className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2"
            />
            {adjustError && <p className="text-sm text-red-600 dark:text-red-400">{adjustError}</p>}
            <button
              disabled={savingAdjust}
              className="w-full rounded-lg bg-sky-600 text-white py-2 font-medium disabled:opacity-50"
            >
              {savingAdjust ? 'Saving…' : 'Save adjustment'}
            </button>
          </form>
        )}

        {timeline.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No activity logged yet.</p>
        ) : (
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 divide-y divide-gray-100 dark:divide-neutral-800 overflow-hidden">
            {[...timeline].reverse().map((t) => (
              <div key={`${t.kind}-${t.id}`} className="px-4 py-3 text-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p>
                      {t.kind === 'delivery'
                        ? 'Delivery'
                        : t.kind === 'dispense'
                          ? `Dispensed → ${t.label}`
                          : `Adjustment: ${t.label}`}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {t.date}
                      {t.kind === 'dispense' && editingEntryId !== t.id && (
                        <button
                          type="button"
                          onClick={() => startEditEntry(t)}
                          className="inline-flex items-center gap-0.5 text-sky-600 dark:text-sky-400 ml-1"
                        >
                          <Pencil size={11} strokeWidth={1.75} />
                          Edit
                        </button>
                      )}
                    </p>
                    {t.kind === 'delivery' && editingDeliveryId !== t.id && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {t.totalCost != null ? (
                          <>
                            {(t.totalCost / t.quantity).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            /L · Total{' '}
                            {t.totalCost.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </>
                        ) : (
                          'No price set'
                        )}{' '}
                        <button
                          type="button"
                          onClick={() => startEditPrice(t)}
                          className="inline-flex items-center gap-0.5 text-sky-600 dark:text-sky-400 ml-1"
                        >
                          <Pencil size={11} strokeWidth={1.75} />
                          {t.totalCost != null ? 'Edit' : 'Add price'}
                        </button>
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-medium">
                      {t.kind === 'dispense' ? '−' : t.quantity < 0 ? '−' : '+'}
                      {Math.abs(t.quantity).toLocaleString()} L
                    </span>
                    {t.kind === 'dispense' && editingEntryId !== t.id && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {t.totalCost != null
                          ? `≈ ${t.totalCost.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} (${t.unitCost!.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}/L)`
                          : 'No priced deliveries yet'}
                      </p>
                    )}
                  </div>
                </div>

                {t.kind === 'dispense' && editingEntryId === t.id && (
                  <div className="mt-2 flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Quantity (litres)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        autoFocus
                        value={editEntryQuantity}
                        onChange={(e) => setEditEntryQuantity(e.target.value)}
                        placeholder="Quantity (litres)"
                        className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Date</label>
                      <input
                        type="date"
                        value={editEntryDate}
                        onChange={(e) => setEditEntryDate(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={savingEditEntry}
                      onClick={() => saveEditEntry(t.id)}
                      className="rounded-lg bg-sky-600 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                    >
                      {savingEditEntry ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditEntry}
                      className="rounded-lg border border-gray-300 dark:border-neutral-700 px-3 py-1.5 text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {t.kind === 'dispense' && editingEntryId === t.id && editEntryError && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{editEntryError}</p>
                )}

                {t.kind === 'delivery' && editingDeliveryId === t.id && (
                  <div className="mt-2 flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Price per litre
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        autoFocus
                        value={editPricePerLiter}
                        onChange={(e) => setEditPricePerLiter(e.target.value)}
                        placeholder="Price per litre"
                        className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-1.5 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={savingEditPrice}
                      onClick={() => saveEditPrice(t)}
                      className="rounded-lg bg-sky-600 text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                    >
                      {savingEditPrice ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditPrice}
                      className="rounded-lg border border-gray-300 dark:border-neutral-700 px-3 py-1.5 text-sm font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {t.kind === 'delivery' && editingDeliveryId === t.id && editPriceError && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{editPriceError}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
