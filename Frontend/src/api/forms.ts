import { api } from './client'

export type FormFieldType = 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DATE' | 'SELECT' | 'RADIO' | 'CHECKBOX'

export type RoleKey = 'ACCOUNT_ASSIST' | 'SECRETARY' | 'IT_MANAGER' | 'ENERGY_MANAGER' | 'GENERAL_MANAGER' | 'MD'

export const ROLE_SECTION_KEYS: RoleKey[] = ['ACCOUNT_ASSIST', 'IT_MANAGER', 'ENERGY_MANAGER', 'GENERAL_MANAGER', 'MD']

export const ROLE_SECTION_NAMES = [
  'IT MANAGER EXECUTION',
  'ENERGY MANAGER APPROVAL',
  'GENERAL MANAGER APPROVAL',
  'MD APPROVAL',
] as string[]

export function isRoleSection(f: { section?: string | null; roleKey?: string | null }): boolean {
  if (!f) return false
  if (f.roleKey && ROLE_SECTION_KEYS.includes(f.roleKey as RoleKey)) return true
  const name = (f.section ?? '').replace(/[\s_-]+/g, ' ').trim().toUpperCase()
  if (ROLE_SECTION_NAMES.some((s) => s === name)) return true
  return /(^| )(IT MANAGER|ENERGY MANAGER|GENERAL MANAGER|MANAGING DIRECTOR|MD)( |$)/.test(name)
}

export interface FormField {
  id?: string
  key: string
  label: string
  type: FormFieldType
  required?: boolean
  options?: string[]
  order?: number
  section?: string
  roleKey?: RoleKey | null
}

export interface FormDef {
  id: string
  tenantId: string
  branchId: string | null
  name: string
  description: string | null
  isPublished: boolean
  isCustomerTicket: boolean
  parentFormId: string | null
  parentForm?: { id: string; name: string; isCustomerTicket: boolean }
  childForms?: Array<{ id: string; name: string; isCustomerTicket: boolean }>
  createdAt: string
  updatedAt: string
  createdByUserId?: string
  branch?: { id: string; name: string }
  fields: FormField[]
  _count?: { submissions: number }
}

export interface FormSubmission {
  id: string
  tenantId: string
  formId: string
  submittedByUserId: string
  refNumber: string | null
  parentRefNumber: string | null
  data: Record<string, unknown>
  createdAt: string
  submittedByUser?: { id: string; firstName: string; lastName: string; email: string }
}

export interface CreateFormInput {
  name: string
  description?: string | null
  branchId?: string | null
  isCustomerTicket?: boolean
  parentFormId?: string | null
  fields: Array<
    Omit<FormField, 'id'> & {
      type: FormFieldType
      required?: boolean
      options?: string[]
      order?: number
    }
  >
}

export type UpdateFormInput = Partial<Omit<CreateFormInput, 'branchId'>>

export const formsApi = {
  list(query?: { branchId?: string; published?: boolean }) {
    return api.get<FormDef[]>('/forms', { params: query }).then((r) => r.data)
  },
  get(id: string) {
    return api.get<FormDef>(`/forms/${id}`).then((r) => r.data)
  },
  create(body: CreateFormInput) {
    return api.post<FormDef>('/forms', body).then((r) => r.data)
  },
  update(id: string, body: UpdateFormInput) {
    return api.patch<FormDef>(`/forms/${id}`, body).then((r) => r.data)
  },
  remove(id: string) {
    return api.delete(`/forms/${id}`).then(() => undefined)
  },
  publish(id: string) {
    return api.post(`/forms/${id}/publish`).then((r) => r.data)
  },
  listSubmissions(id: string) {
    return api.get<FormSubmission[]>(`/forms/${id}/submissions`).then((r) => r.data)
  },
  submit(id: string, data: Record<string, unknown>) {
    return api.post<FormSubmission>(`/forms/${id}/submissions`, { data }).then((r) => r.data)
  },
}