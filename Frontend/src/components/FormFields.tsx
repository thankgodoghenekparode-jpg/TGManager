import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  TextField,
} from '@mui/material'
import type { FormField } from '../api/forms'

export function FormFieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FormField
  value: unknown
  onChange: (v: unknown) => void
  disabled?: boolean
}) {
  const options = field.options ?? []
  switch (field.type) {
    case 'TEXT':
    case 'NUMBER':
      return (
        <TextField
          label={field.label}
          value={(value as string | number | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          fullWidth
          disabled={disabled}
          InputProps={{ inputMode: field.type === 'NUMBER' ? 'numeric' : 'text' }}
        />
      )
    case 'TEXTAREA':
      return (
        <TextField
          label={field.label}
          value={(value as string | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          fullWidth
          multiline
          minRows={3}
          disabled={disabled}
        />
      )
    case 'DATE':
      return (
        <TextField
          type="date"
          label={field.label}
          value={(value as string | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          fullWidth
          disabled={disabled}
          InputLabelProps={{ shrink: true }}
        />
      )
    case 'SELECT':
      return (
        <TextField
          select
          label={field.label}
          value={(value as string | undefined) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          fullWidth
          disabled={disabled}
        >
          <MenuItem value=""><em>Select…</em></MenuItem>
          {options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
        </TextField>
      )
    case 'RADIO':
      return (
        <FormControl fullWidth disabled={disabled}>
          <FormLabel>{field.label}{field.required ? ' *' : ''}</FormLabel>
          <RadioGroup
            value={(value as string | undefined) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            row
            sx={{ flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap' }}
          >
            {options.map((o) => <FormControlLabel key={o} value={o} control={<Radio />} label={o} sx={{ mr: { xs: 0, sm: 2 } }} />)}
          </RadioGroup>
        </FormControl>
      )
    case 'CHECKBOX':
      return (
        <FormControlLabel
          control={<Checkbox checked={value === true} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />}
          label={field.label}
        />
      )
    default:
      return null
  }
}
