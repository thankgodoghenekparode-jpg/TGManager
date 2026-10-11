import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CampaignIcon from '@mui/icons-material/Campaign';
import { schoolApi, type AnnouncementAudience, type SchoolAnnouncement } from '../../api/school';

const AUDIENCE_LABELS: Record<AnnouncementAudience, string> = {
  ALL: 'Everyone',
  STUDENTS: 'Students',
  PARENTS: 'Parents',
  STAFF: 'Staff',
};

interface AnnouncementForm {
  title: string;
  content: string;
  audience: AnnouncementAudience;
}

const EMPTY_FORM: AnnouncementForm = { title: '', content: '', audience: 'ALL' };

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function AnnouncementsPage() {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolAnnouncement | null>(null);
  const [form, setForm] = useState<AnnouncementForm>(EMPTY_FORM);
  const [toDelete, setToDelete] = useState<SchoolAnnouncement | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['school', 'announcements'],
    queryFn: () => schoolApi.listAnnouncements({ limit: 100 }),
  });

  const announcements = data?.items ?? [];

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ['school', 'announcements'] });

  const saveMutation = useMutation({
    mutationFn: (payload: AnnouncementForm) =>
      editing
        ? schoolApi.updateAnnouncement(editing.id, {
            title: payload.title,
            content: payload.content,
            audience: payload.audience,
          })
        : schoolApi.createAnnouncement(payload),
    onSuccess: () => {
      setDialogOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      setError(null);
      invalidate();
    },
    onError: (e: any) =>
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to save announcement'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => schoolApi.deleteAnnouncement(id),
    onSuccess: () => {
      setToDelete(null);
      setError(null);
      invalidate();
    },
    onError: (e: any) =>
      setError(e?.response?.data?.message ?? e?.message ?? 'Failed to delete announcement'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (item: SchoolAnnouncement) => {
    setEditing(item);
    setForm({ title: item.title, content: item.content, audience: item.audience });
    setDialogOpen(true);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>
            School Announcements
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Broadcast updates to students, parents and staff.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          New Announcement
        </Button>
      </Stack>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {isLoading && (
        <Typography variant="body2" color="text.secondary">
          Loading announcements…
        </Typography>
      )}

      <Stack spacing={2} sx={{ maxWidth: 860 }}>
        {announcements.map((item) => (
          <Card key={item.id}>
            <Box sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
                  <CampaignIcon sx={{ color: 'primary.main' }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ wordBreak: 'break-word' }}>
                      {item.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {timeAgo(item.publishedAt)}
                      {item.createdBy ? ` • by ${item.createdBy.firstName} ${item.createdBy.lastName}` : ''}
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <Chip
                    label={AUDIENCE_LABELS[item.audience] ?? item.audience}
                    size="small"
                    color={item.audience === 'ALL' ? 'primary' : 'default'}
                    variant={item.audience === 'ALL' ? 'filled' : 'outlined'}
                  />
                  <Tooltip title="Edit">
                    <IconButton size="small" onClick={() => openEdit(item)}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => setToDelete(item)}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {item.content}
              </Typography>
            </Box>
          </Card>
        ))}

        {!isLoading && announcements.length === 0 && (
          <Card sx={{ p: 6, textAlign: 'center', color: 'text.secondary' }}>
            <CampaignIcon sx={{ fontSize: 42, mb: 1, opacity: 0.5 }} />
            <Typography variant="body1" fontWeight={600}>
              No announcements yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create your first announcement to reach students, parents and staff.
            </Typography>
          </Card>
        )}
      </Stack>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Announcement' : 'New Announcement'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              size="small"
              label="Title"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <TextField
              fullWidth
              label="Message"
              required
              multiline
              minRows={4}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
            <FormControl fullWidth size="small">
              <InputLabel>Audience</InputLabel>
              <Select
                label="Audience"
                value={form.audience}
                onChange={(e) =>
                  setForm({ ...form, audience: e.target.value as AnnouncementAudience })
                }
              >
                {Object.entries(AUDIENCE_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!form.title.trim() || !form.content.trim() || saveMutation.isPending}
            onClick={() => saveMutation.mutate(form)}
          >
            {editing ? 'Save Changes' : 'Publish'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={Boolean(toDelete)} onClose={() => setToDelete(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete announcement?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            "{toDelete?.title}" will be permanently removed. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteMutation.isPending}
            onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}