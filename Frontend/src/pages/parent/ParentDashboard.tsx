import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CampaignIcon from '@mui/icons-material/Campaign';
import { parentApi } from '../../api/parent';
import { schoolApi, type SchoolAnnouncement } from '../../api/school';
import { useAuthStore } from '../../store/auth';

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

export function ParentDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['parent', 'me'],
    queryFn: () => parentApi.me(),
  });

  const { data: announcementsData } = useQuery({
    queryKey: ['parent', 'announcements'],
    queryFn: () => schoolApi.listAnnouncements({ limit: 10 }),
  });

  const news: SchoolAnnouncement[] =
    announcementsData?.items.filter(
      (a) => a.audience === 'ALL' || a.audience === 'PARENTS',
    ) ?? [];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box>
        <Typography variant="h5" fontWeight={700}>
          Welcome, {profile?.guardian?.firstName ?? user?.firstName ?? 'Parent'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Track your children's attendance, academic results and fee invoices in one place.
        </Typography>
      </Box>

      {!isLoading && (profile?.children?.length ?? 0) === 0 && (
        <Card>
          <CardContent sx={{ py: 6, textAlign: 'center' }}>
            <SchoolIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography variant="subtitle1" fontWeight={700}>
              No children linked yet
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Contact the school administration to link your children to this account.
            </Typography>
          </CardContent>
        </Card>
      )}

      <Grid container spacing={2}>
        {(profile?.children ?? []).map((child) => (
          <Grid item xs={12} sm={6} md={4} key={child.id}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                  <Avatar
                    src={child.passportPhoto ?? undefined}
                    sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}
                  >
                    {child.firstName?.[0]}
                    {child.lastName?.[0]}
                  </Avatar>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" fontWeight={700} noWrap>
                      {child.firstName} {child.lastName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      {child.admissionNumber}
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
                  <Chip
                    label={child.currentClass?.name ?? 'Unassigned'}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                  <Chip label={child.relationship} size="small" />
                  {child.isPrimary && <Chip label="Primary" size="small" color="success" />}
                </Stack>
                <Button
                  fullWidth
                  variant="contained"
                  endIcon={<ArrowForwardIcon />}
                  onClick={() => navigate(`/parent/children/${child.id}`)}
                  sx={{ textTransform: 'none' }}
                >
                  View Child
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {news.length > 0 && (
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <CampaignIcon sx={{ color: 'primary.main' }} />
            <Typography variant="h6" fontWeight={700}>
              School News
            </Typography>
          </Stack>
          <Stack spacing={1.5}>
            {news.map((item) => (
              <Card key={item.id}>
                <CardContent sx={{ py: 1.75, px: 2.25 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ wordBreak: 'break-word' }}>
                      {item.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                      {timeAgo(item.publishedAt)}
                    </Typography>
                  </Stack>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                  >
                    {item.content}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
