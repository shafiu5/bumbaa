export type Vessel = {
  id: string
  name: string
  notes: string
  created_at: string
}

export type Location = {
  id: string
  name: string
  notes: string
  low_stock_threshold: number | null
  created_at: string
}

export type Delivery = {
  id: string
  location_id: string
  quantity: number
  delivered_at: string
  notes: string
  created_at: string
}

export type FuelEntry = {
  id: string
  vessel_id: string
  location_id: string
  quantity: number
  filled_at: string
  notes: string
  created_at: string
}

export type Adjustment = {
  id: string
  location_id: string
  quantity: number
  adjusted_at: string
  notes: string
  created_at: string
}

export type LocationStock = {
  location_id: string
  name: string
  low_stock_threshold: number | null
  total_delivered: number
  total_dispensed: number
  total_adjusted: number
  current_stock: number
}

export type VesselUsage = {
  vessel_id: string
  name: string
  total_used: number
  fill_count: number
}
