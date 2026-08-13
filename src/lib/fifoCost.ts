// FIFO (first-in, first-out) fuel cost allocation.
//
// Each priced delivery is a "batch" at its own price. A dispense (fuel_entries
// row) draws from the oldest remaining batch(es) at that location first; if a
// single dispense spans more than one batch, its cost is the quantity-weighted
// average of the batches it drew from. This means editing a delivery's price
// only changes the cost of dispenses that actually drew from that batch, never
// dispenses that were fully covered by other batches — unlike a single
// location-wide blended average, which changes retroactively for everything.
//
// Unpriced deliveries and stock adjustments are ignored for costing (same as
// before): they still add to physical stock elsewhere, but contribute no
// batch here. If a dispense runs out of priced batches before its full
// quantity is accounted for, it's reported as not fully priced and the caller
// should treat it as unpriced rather than show a misleading partial number.

export type DeliveryForCosting = {
  id: string
  location_id: string
  quantity: number
  total_cost: number | null
  delivered_at: string
  created_at: string
}

export type EntryForCosting = {
  id: string
  location_id: string
  quantity: number
  filled_at: string
  created_at: string
}

export type FifoCostResult = {
  cost: number | null
  unitCost: number | null
}

export function computeFifoCosts(
  deliveries: DeliveryForCosting[],
  entries: EntryForCosting[]
): Map<string, FifoCostResult> {
  const results = new Map<string, FifoCostResult>()

  const locationIds = new Set<string>()
  for (const d of deliveries) locationIds.add(d.location_id)
  for (const e of entries) locationIds.add(e.location_id)

  for (const locationId of locationIds) {
    type Event =
      | { kind: 'delivery'; date: string; createdAt: string; delivery: DeliveryForCosting }
      | { kind: 'entry'; date: string; createdAt: string; entry: EntryForCosting }

    const events: Event[] = [
      ...deliveries
        .filter((d) => d.location_id === locationId)
        .map((d): Event => ({ kind: 'delivery', date: d.delivered_at, createdAt: d.created_at, delivery: d })),
      ...entries
        .filter((e) => e.location_id === locationId)
        .map((e): Event => ({ kind: 'entry', date: e.filled_at, createdAt: e.created_at, entry: e })),
    ]
    events.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1
      return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0
    })

    const batches: { remaining: number; price: number }[] = []

    for (const ev of events) {
      if (ev.kind === 'delivery') {
        if (ev.delivery.total_cost != null && ev.delivery.quantity > 0) {
          batches.push({ remaining: ev.delivery.quantity, price: ev.delivery.total_cost / ev.delivery.quantity })
        }
        continue
      }

      let toConsume = ev.entry.quantity
      let consumedQty = 0
      let costAccum = 0
      while (toConsume > 0 && batches.length > 0) {
        const batch = batches[0]
        const take = Math.min(batch.remaining, toConsume)
        costAccum += take * batch.price
        consumedQty += take
        batch.remaining -= take
        toConsume -= take
        if (batch.remaining <= 0) batches.shift()
      }

      const fullyPriced = toConsume <= 0 && consumedQty > 0
      results.set(ev.entry.id, {
        cost: fullyPriced ? costAccum : null,
        unitCost: fullyPriced ? costAccum / consumedQty : null,
      })
    }
  }

  return results
}
