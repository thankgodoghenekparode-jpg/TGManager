import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import BadgeIcon from '@mui/icons-material/Badge';
import { schoolApi, type Guardian } from '../../api/school';
import { parentApi, type InviteGuardianResult } from '../../api/parent';

export function SchoolParentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<InviteGuardianResult | null>(null);

  const { data: guardians } = useQuery({
    queryKey: ['school', 'guardians', search],
    queryFn: () => schoolApi.listGuardians(search || undefined),
  });

  const inviteMutation = useMutation({
    mutationFn: (guardianId: string) => parentApi.invite({ guardianId }),
    onSuccess: (data) => {
      setError(null);
      setInviteResult(data);
      qc.invalidateQueries({ queryKey: ['school', 'guardians'] });
    },
    onError: (e: any) =>
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to grant portal access'),
  });

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Parents & Portal Access
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Grant guardians a login to the parent portal to follow their children's attendance, results and fees.
          </Typography>
        </Box>
        <TextField
          size="small"
          placeholder="Search guardians…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Guardian</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Email</TableCell>
                <TableCell align="right">Portal Access</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(guardians ?? []).map((g: Guardian) => (
                <TableRow key={g.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700}>
                      {g.firstName} {g.lastName}
                    </Typography>
                    {g.occupation && (
                      <Typography variant="caption" color="text.secondary">
                        {g.occupation}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{g.phone}</TableCell>
                  <TableCell>{g.email ?? '—'}</TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<BadgeIcon />}
                      disabled={inviteMutation.isPending}
                      onClick={() => inviteMutation.mutate(g.id)}
                      sx={{ textTransform: 'none' }}
                    >
                      Grant Access
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(guardians ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    No guardians found. Add guardians from the Students page.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={Boolean(inviteResult)} onClose={() => setInviteResult(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Portal Access
          <IconButton size="small" onClick={() => setInviteResult(null)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {inviteResult?.accountCreated ? (
            <Stack spacing={1.5}>
              <Alert severity="success">Parent account created successfully.</Alert>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Login email
                </Typography>
                <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                  {inviteResult.email}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Temporary password
                </Typography>
                <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                  {inviteResult.temporaryPassword}
                </Typography>
              </Box>
              <Typography variant="caption" color="warning.main">
                Share these credentials with the guardian. They should change the password after first login.
              </Typography>
            </Stack>
          ) : (
            <Alert severity="info">
              {inviteResult?.email} already has a parent account for this school. No new password was generated.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteResult(null)}>Done</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
