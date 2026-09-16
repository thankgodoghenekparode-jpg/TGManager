import { api } from './client'

export interface InventoryItem {
  id: string
  tenantId: string
  branchId: string
  sku: string | null
  name: string
  quantity: number
  unit: string | null
  minQuantity: number
  location: string | null
  createdByUserId: string
  createdAt: string
  updatedAt: string
  branch?: { id: string; name: string }
}

export interface CreateInventoryInput {
  branchId: string
  sku?: string | null
  name: string
  quantity?: number
  unit?: string | null
  minQuantity?: number
  location?: string | null
}

export type UpdateInventoryInput = Partial<Omit<CreateInventoryInput, 'branchId' | 'quantity'>>

export const inventoryApi = {
  list(query?: { branchId?: string; lowStock?: boolean }) {
    return api.get<InventoryItem[]>('/inventory', { params: query }).then((r) => r.data)
  },
  get(id: string) {
    return api.get<InventoryItem>(`/inventory/${id}`).then((r) => r.data)
  },
  create(body: CreateInventoryInput) {
    return api.post<InventoryItem>('/inventory', body).then((r) => r.data)
  },
  update(id: string, body: UpdateInventoryInput) {
    return api.patch<InventoryItem>(`/inventory/${id}`, body).then((r) => r.data)
  },
  adjust(id: string, body: { delta: number; reason: string }) {
    return api.post<InventoryItem>(`/inventory/${id}/adjust`, body).then((r) => r.data)
  },
  remove(id: string) {
    return api.delete(`/inventory/${id}`).then(() => undefined)
  },
}