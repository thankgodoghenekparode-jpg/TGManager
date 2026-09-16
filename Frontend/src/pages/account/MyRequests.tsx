import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import type { AccountRequestStatus } from '../../api/account'
import { accountApi } from '../../api/account'

const STATUS_COLOR: Record<AccountRequestStatus, 'default' | 'info' | 'success' | 'error'> = {
  PENDING: 'info',
  APPROVED: 'success',
  REJECTED: 'error',
  COMPLETED: 'success',
}

const TYPE_LABEL: Record<string, string> = {
  EMAIL_CHANGE: 'Email Change',
  PASSWORD_RESET: 'Password Reset',
}

export function MyRequestsPage() {
  const requests = useQuery({
    queryKey: ['account', 'my-requests'],
    queryFn: () => accountApi.myRequests(),
  })

  const rows = requests.data?.items ?? []

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>My Account Requests</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Email change and password reset requests you have submitted, and their status.
      </Typography>

      {requests.isLoading ? (
        <CircularProgress />
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Request Type</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Description</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={`${r.type}-${r.id}`} hover>
                  <TableCell>{TYPE_LABEL[r.type] ?? r.type}</TableCell>
                  <TableCell>{new Date(r.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell><Chip label={r.status} size="small" color={STATUS_COLOR[r.status]} /></TableCell>
                  <TableCell>{r.description}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={4} align="center">No account requests found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
