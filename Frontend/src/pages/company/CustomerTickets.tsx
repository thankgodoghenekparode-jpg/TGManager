import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Chip,
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
import { formsApi } from '../../api/forms'
import { TicketSubmitDialog } from '../../components/TicketSubmitDialog'
import { Can } from '../../components/PermissionGate'

export function CustomerTicketsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [search, setSearch] = useState('')

  const forms = useQuery({ queryKey: ['forms'], queryFn: () => formsApi.list() })
  const ticketForms = useMemo(
    () => (forms.data ?? []).filter((f) => f.isCustomerTicket && f.isPublished),
    [forms.data],
  )
  const tickets = useQuery({
    queryKey: ['customer-tickets', ticketForms.map((f) => f.id)],
    queryFn: async () => {
      const results = await Promise.all(ticketForms.map((f) => formsApi.listSubmissions(f.id)))
      return results
        .flat()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    },
    enabled: ticketForms.length > 0,
  })

  const invalidateTickets = () => qc.invalidateQueries({ queryKey: ['customer-tickets'] })

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    const all = tickets.data ?? []
    if (!q) return all
    return all.filter(
      (t) =>
        (t.refNumber ?? '').toLowerCase().includes(q) ||
        (t.submittedByUser ? `${t.submittedByUser.firstName} ${t.submittedByUser.lastName}`.toLowerCase() : '').includes(q),
    )
  }, [tickets.data, search])

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5" fontWeight={700}>Customer Tickets</Typography>
        {ticketForms.length === 0 ? (
          <Can permissions={['form.create']}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/app/forms?create=customer-ticket')}>
              Create customer ticket form
            </Button>
          </Can>
        ) : (
          <Can permissions={['form.submit']}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
              New customer ticket
            </Button>
          </Can>
        )}
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        Customer tickets are stored here and wait for child forms to be created and linked to them when starting a workflow.
        While starting a flow (Start workflow), you can search for a ticket and bundle a child form under it.
      </Alert>

      {ticketForms.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          No published Customer Ticket form yet. Create one on the Forms page (a form with "Customer ticket" enabled) before creating tickets.
        </Alert>
      )}

      <TextField
        label="Search by REFF or submitter"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        size="small"
        sx={{ mb: 2, minWidth: { xs: 0, sm: 280 }, width: { xs: '100%', sm: 'auto' } }}
      />

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>REFF</TableCell>
              <TableCell>Form</TableCell>
              <TableCell>Submitted by</TableCell>
              <TableCell>Date</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((t) => {
              const tf = ticketForms.find((f) => f.id === t.formId)
              return (
                <TableRow key={t.id} hover>
                  <TableCell><strong>{t.refNumber}</strong></TableCell>
                  <TableCell>{tf?.name ?? 'Customer ticket'}</TableCell>
                  <TableCell>{t.submittedByUser ? `${t.submittedByUser.firstName} ${t.submittedByUser.lastName}` : '—'}</TableCell>
                  <TableCell>{new Date(t.createdAt).toLocaleString()}</TableCell>
                  <TableCell align="right">
                    <Button size="small" onClick={() => { void navigator.clipboard?.writeText(t.refNumber ?? '') }}>
                      Copy REFF
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  {ticketForms.length === 0
                    ? 'No customer ticket forms available'
                    : tickets.isLoading
                      ? 'Loading customer tickets...'
                      : 'No customer tickets yet. Create the first one.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Chip label={`${rows.length} ticket${rows.length === 1 ? '' : 's'}`} size="small" sx={{ mt: 1 }} variant="outlined" />

      {creating && (
        <TicketSubmitDialog
          ticketForms={ticketForms}
          onClose={() => setCreating(false)}
          onCreated={() => invalidateTickets()}
        />
      )}

    </Box>
  )
}
