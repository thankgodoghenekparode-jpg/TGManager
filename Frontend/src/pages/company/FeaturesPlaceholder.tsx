import { Box, Typography } from '@mui/material'

export function FeaturesPlaceholderPage({ title }: { title: string }) {
  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        {title}
      </Typography>
      <Typography color="text.secondary">
        This module is wired into navigation but its full UI is not implemented yet.
      </Typography>
    </Box>
  )
}
