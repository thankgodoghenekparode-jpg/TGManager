import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { formsApi, isRoleSection, type FormDef, type FormSubmission } from '../api/forms'
import { FormFieldInput } from './FormFields'
import { apiErrorMessage } from '../api/client'

export function TicketSubmitDialog({
  ticketForms,
  initialFormId,
  onClose,
  onCreated,
}: {
  ticketForms: FormDef[]
  initialFormId?: string | null
  onClose: () => void
  onCreated: (ticket: FormSubmission) => void
}) {
  const [formId, setFormId] = useState(initialFormId ?? ticketForms[0]?.id ?? '')
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [error, setError] = useState('')

  const form = ticketForms.find((f) => f.id === formId) ?? null
  const sections = form
    ? Array.from(new Set(form.fields.map((f) => f.section || 'General')))
    : []

  const setValue = (key: string, value: unknown) => setValues((prev) => ({ ...prev, [key]: value }))

  const submit = useMutation({
    mutationFn: async () => {
      if (!form) throw new Error('No customer ticket form selected')
      return formsApi.submit(form.id, { ...values })
    },
    onSuccess: (ticket) => {
      onCreated(ticket)
      onClose()
    },
    onError: (e) => setError(apiErrorMessage(e)),
  })

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>New customer ticket</DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 1.5, sm: 2 } }}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}
          {ticketForms.length > 1 && (
            <TextField
              select
              label="Customer ticket form"
              value={formId}
              onChange={(e) => { setFormId(e.target.value); setValues({}) }}
              fullWidth
            >
              <MenuItem value="">Select…</MenuItem>
              {ticketForms.map((f) => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
            </TextField>
          )}
          {!form && (
            <Typography color="text.secondary">
              No customer ticket form available. Create one on the Forms page first.
            </Typography>
          )}
          {form && sections.map((section) => (
            <Box key={section}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 1 }}>
                {section}
              </Typography>
              <Stack spacing={2}>
                {form.fields.filter((f) => (f.section || 'General') === section).map((f) => (
                  <FormFieldInput
                    key={f.key}
                    field={f}
                    value={values[f.key]}
                    disabled={isRoleSection(f)}
                    onChange={(v) => setValue(f.key, v)}
                  />
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 2 }, flexWrap: 'wrap' }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!form || submit.isPending} onClick={() => submit.mutate()}>
          {submit.isPending ? 'Creating…' : 'Create customer ticket'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
