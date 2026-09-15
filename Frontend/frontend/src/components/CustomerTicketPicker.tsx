import { useState } from 'react'
import { Autocomplete, Box, Button, Stack, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import type { FormDef, FormSubmission } from '../api/forms'
import { TicketSubmitDialog } from './TicketSubmitDialog'

export function CustomerTicketPicker({
  tickets,
  loading,
  ticketForms,
  value,
  onChange,
  onTicketCreated,
  helperText,
}: {
  tickets: FormSubmission[]
  loading?: boolean
  ticketForms: FormDef[]
  value: string
  onChange: (refNumber: string) => void
  onTicketCreated?: (ticket: FormSubmission) => void
  helperText?: string
}) {
  const [openNew, setOpenNew] = useState(false)
  const options = tickets.filter((t) => t.refNumber)
  const current = options.find((t) => t.refNumber === value) ?? null
  const formNames = new Map(ticketForms.map((f) => [f.id, f.name]))
  const noTicketForms = ticketForms.length === 0
  const effectiveHelperText = noTicketForms
    ? 'No published Customer Ticket form yet — create one on the Forms page first.'
    : helperText

  const searchText = (t: FormSubmission) => {
    const dataValues = Object.values(t.data ?? {})
      .filter((v): v is string | number => typeof v === 'string' || typeof v === 'number')
      .map((v) => String(v))
    return [
      t.refNumber ?? '',
      t.submittedByUser ? `${t.submittedByUser.firstName} ${t.submittedByUser.lastName} ${t.submittedByUser.email}` : '',
      formNames.get(t.formId) ?? '',
      ...dataValues,
    ].join(' ').toLowerCase()
  }

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'flex-start' }}>
      <Autocomplete
        fullWidth
        options={options}
        loading={loading}
        disabled={loading}
        value={current}
        getOptionLabel={(t) => t.refNumber ?? ''}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        filterOptions={(opts, state) => {
          const q = state.inputValue.trim().toLowerCase()
          if (!q) return opts
          return opts.filter((t) => searchText(t).includes(q)).slice(0, 100)
        }}
        onChange={(_, v) => onChange(v ? (v.refNumber as string) : '')}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Customer Ticket (parent)"
            required
            helperText={loading ? 'Loading customer tickets...' : effectiveHelperText}
          />
        )}
        renderOption={(props, t) => (
          <Box component="li" {...props}>
            <Stack>
              <Typography variant="body2" fontWeight={600}>{t.refNumber}</Typography>
              <Typography variant="caption" color="text.secondary">
                {formNames.get(t.formId) ?? 'Customer ticket'}
                {t.submittedByUser ? ` · ${t.submittedByUser.firstName} ${t.submittedByUser.lastName}` : ''}
              </Typography>
            </Stack>
          </Box>
        )}
      />
      <Button
        variant="outlined"
        startIcon={<AddIcon />}
        sx={{ whiteSpace: 'nowrap', mt: { xs: 0, sm: 1 }, width: { xs: '100%', sm: 'auto' } }}
        disabled={ticketForms.length === 0}
        onClick={() => setOpenNew(true)}
      >
        New ticket
      </Button>
      {openNew && (
        <TicketSubmitDialog
          ticketForms={ticketForms}
          onClose={() => setOpenNew(false)}
          onCreated={(ticket) => {
            onChange(ticket.refNumber as string)
            onTicketCreated?.(ticket)
          }}
        />
      )}
    </Stack>
  )
}
