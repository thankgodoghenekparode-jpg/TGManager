import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import DownloadIcon from '@mui/icons-material/Download'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import { documentsApi, type DocRecord, type DocumentType } from '../../api/documents'
import { branchesApi } from '../../api/branches'
import { apiErrorMessage } from '../../api/client'
import { Can } from '../../components/PermissionGate'
import { saveBlob } from '../../lib/download'

export function DocumentsPage() {
  const qc = useQueryClient()
  const [branchFilter, setBranchFilter] = useState('')
  const [uploading, setUploading] = useState(false)
  const [confirm, setConfirm] = useState<DocRecord | null>(null)

  const branches = useQuery({ queryKey: ['branches'], queryFn: () => branchesApi.list() })
  const documents = useQuery({
    queryKey: ['documents', branchFilter],
    queryFn: () => documentsApi.list({ branchId: branchFilter || undefined }),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['documents'] })

  const remove = useMutation({
    mutationFn: (id: string) => documentsApi.remove(id),
    onSuccess: () => { setConfirm(null); invalidate() },
  })

  const rows = documents.data ?? []

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Documents</Typography>
        <Can permissions={['document.create']}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setUploading(true)}>
            Upload document
          </Button>
        </Can>
      </Stack>

      <TextField select label="Filter by branch" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} size="small" sx={{ mb: 2, minWidth: 220, width: { xs: '100%', sm: 'auto' } }}>
        <MenuItem value="">All branches</MenuItem>
        {(branches.data ?? []).map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
      </TextField>

      {remove.error && <Alert severity="error" sx={{ mb: 2 }}>{apiErrorMessage(remove.error)}</Alert>}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Branch</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Version</TableCell>
              <TableCell>Size</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((d) => (
              <TableRow key={d.id} hover>
                <TableCell>{d.title}</TableCell>
                <TableCell>{d.branch?.name ?? '—'}</TableCell>
                <TableCell><Chip label={d.type} size="small" /></TableCell>
                <TableCell>v{d.version}</TableCell>
                <TableCell>{d.sizeBytes ? `${formatBytes(d.sizeBytes)}` : '—'}</TableCell>
                <TableCell align="right">
                  <Can permissions={['document.view']}>
                    <IconButton
                      title="Download"
                      onClick={() => {
                        void documentsApi.download(d.id).then((blob) => saveBlob(blob, d.title))
                      }}
                    ><DownloadIcon fontSize="small" /></IconButton>
                  </Can>
                  <Can permissions={['document.delete']}>
                    <IconButton color="error" onClick={() => setConfirm(d)}><DeleteIcon fontSize="small" /></IconButton>
                  </Can>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} align="center">No documents</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>

      {uploading && (
        <UploadDialog
          onClose={() => setUploading(false)}
          onDone={() => { setUploading(false); invalidate() }}
        />
      )}

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)}>
        <DialogTitle>Delete document</DialogTitle>
        <DialogContent>Delete "{confirm?.title}"?</DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button color="error" onClick={() => confirm && remove.mutate(confirm.id)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function UploadDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [fileName, setFileName] = useState('')
  const [title, setTitle] = useState('')
  const [type, setType] = useState<DocumentType>('GENERAL')
  const [branchId, setBranchId] = useState('')
  const [error, setError] = useState('')

  const branches = useQuery({ queryKey: ['branches'], queryFn: () => branchesApi.list() })

  const upload = useMutation({
    mutationFn: (form: FormData) => documentsApi.create(form),
    onSuccess: onDone,
    onError: (e) => setError(apiErrorMessage(e)),
  })

  const pickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setFileName(file?.name ?? '')
  }

  const submit = () => {
    const file = fileRef.current?.files?.[0]
    if (!file) { setError('Choose a file to upload.'); return }
    const form = new FormData()
    form.append('file', file)
    form.append('title', title)
    form.append('type', type)
    if (branchId) form.append('branchId', branchId)
    upload.mutate(form)
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Upload document</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} sx={{ py: 3 }}>
            {fileName || 'Choose file'}
            <input ref={fileRef} type="file" hidden onChange={pickFile} />
          </Button>
          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
          <TextField select label="Type" value={type} onChange={(e) => setType(e.target.value as DocumentType)} fullWidth>
            <MenuItem value="GENERAL">General</MenuItem>
            <MenuItem value="INVENTORY">Inventory</MenuItem>
          </TextField>
          <TextField select label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} fullWidth>
            <MenuItem value="">All branches</MenuItem>
            {(branches.data ?? []).map((b) => <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>)}
          </TextField>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={upload.isPending || !title} onClick={submit}>Upload</Button>
      </DialogActions>
    </Dialog>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
