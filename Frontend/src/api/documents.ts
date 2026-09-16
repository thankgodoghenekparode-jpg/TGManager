import { api } from './client'

export type DocumentType = 'GENERAL' | 'INVENTORY'

export interface DocumentGrant {
  id: string
  userId: string
  permission: 'READ' | 'WRITE'
  user?: { id: string; email: string; firstName: string; lastName: string }
}

export interface DocRecord {
  id: string
  tenantId: string
  branchId: string | null
  createdByUserId: string
  type: DocumentType
  title: string
  storageKey?: string | null
  mimeType: string | null
  sizeBytes: number | null
  version: number
  metadata?: unknown
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  branch?: { id: string; name: string }
  createdBy?: { id: string; firstName: string; lastName: string; email: string }
  grants?: DocumentGrant[]
}

export interface ListDocumentsQuery {
  branchId?: string
  type?: DocumentType
}

export const documentsApi = {
  list(query?: ListDocumentsQuery) {
    return api.get<DocRecord[]>('/documents', { params: query }).then((r) => r.data)
  },
  get(id: string) {
    return api.get<DocRecord>(`/documents/${id}`).then((r) => r.data)
  },
  presign(id: string) {
    return api.get<{ url: string | null; stream: boolean }>(`/documents/${id}/presign`).then((r) => r.data)
  },
  create(body: FormData) {
    return api
      .post<DocRecord>('/documents', body, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data)
  },
  uploadVersion(id: string, body: FormData) {
    return api
      .post<DocRecord>(`/documents/${id}/versions`, body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },
  update(id: string, body: { title?: string; branchId?: string | null; type?: DocumentType; metadata?: unknown }) {
    return api.patch<DocRecord>(`/documents/${id}`, body).then((r) => r.data)
  },
  remove(id: string) {
    return api.delete(`/documents/${id}`).then(() => undefined)
  },
  listGrants(id: string) {
    return api.get<DocumentGrant[]>(`/documents/${id}/grants`).then((r) => r.data)
  },
  addGrant(id: string, body: { userId: string; permission: 'READ' | 'WRITE' }) {
    return api.post<DocumentGrant>(`/documents/${id}/grants`, body).then((r) => r.data)
  },
  removeGrant(id: string, userId: string) {
    return api.delete(`/documents/${id}/grants/${userId}`).then(() => undefined)
  },
  download(id: string) {
    return api
      .get<Blob>(`/documents/${id}/download`, { responseType: 'blob' })
      .then((r) => r.data)
  },
}