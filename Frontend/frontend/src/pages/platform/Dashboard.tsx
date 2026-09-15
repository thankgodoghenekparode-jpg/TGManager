import { useQuery } from '@tanstack/react-query'
import { Box, Card, CardContent, Grid, Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import ApartmentIcon from '@mui/icons-material/Apartment'
import PeopleIcon from '@mui/icons-material/People'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import { platformApi } from '../../api/platform'

export function PlatformDashboardPage() {
  const tenants = useQuery({
    queryKey: ['platform', 'tenants'],
    queryFn: () => platformApi.tenants({ limit: 100 }),
  })
  const users = useQuery({
    queryKey: ['platform', 'users'],
    queryFn: () => platformApi.users({ limit: 100 }),
  })

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} gutterBottom>
        Platform Overview
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, marginTop: -1 }}>
        Health and growth across all tenants
      </Typography>
      <Grid container spacing={2.5}>
        <StatCard label="Tenants" value={tenants.data?.total ?? '—'} icon={<ApartmentIcon fontSize="small" />} tone="#4f46e5" />
        <StatCard label="Platform users" value={users.data?.total ?? '—'} icon={<PeopleIcon fontSize="small" />} tone="#7c3aed" />
        <StatCard
          label="Active tenants"
          value={tenants.data?.items.filter((t) => t.status === 'ACTIVE').length ?? '—'}
          icon={<VerifiedUserIcon fontSize="small" />}
          tone="#059669"
        />
      </Grid>
    </Box>
  )
}

function StatCard({ label, value, icon, tone }: { label: string; value: number | string; icon: ReactNode; tone: string }) {
  return (
    <Grid item xs={12} sm={6} md={4}>
      <Card variant="outlined" sx={{ height: '100%', transition: 'border-color .15s ease, box-shadow .15s ease', '&:hover': { borderColor: 'rgba(49, 87, 213, 0.35)', boxShadow: '0 10px 24px -18px rgba(49, 87, 213, 0.45)' } }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: tone,
                backgroundColor: `${tone}18`,
              }}
            >
              {icon}
            </Box>
            <Typography color="text.secondary" variant="body2" fontWeight={600}>{label}</Typography>
          </Stack>
          <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1.1 }}>{value}</Typography>
        </CardContent>
      </Card>
    </Grid>
  )
}
