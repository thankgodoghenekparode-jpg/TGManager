import { api } from './client'

export interface TenantSettings {
  defaultLatitude?: number
  defaultLongitude?: number
  defaultRadiusMeters?: number
  defaultResumptionTime?: string
  defaultClosingTime?: string
  defaultLatePeriodMinutes?: number
  defaultWorkingDays?: number[]
  timezone?: string
  frontendUrl?: string
  apiUrl?: string
}

export const settingsApi = {
  get() {
    return api.get<TenantSettings>('/settings').then((r) => r.data)
  },
  update(body: Partial<TenantSettings>) {
    return api.post<TenantSettings>('/settings', body).then((r) => r.data)
  },
}