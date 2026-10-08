import { useState, useEffect, type ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import SchoolIcon from '@mui/icons-material/School';
import { schoolApi } from '../../api/school';
import { tenantsApi } from '../../api/tenants';
import { tenantLogoUrl, apiErrorMessage } from '../../api/client';
import { useTenantStore } from '../../store/tenant';

export function SchoolSettingsPage() {
  const qc = useQueryClient();
  const tenant = useTenantStore((s) => s.current);
  const [successMsg, setSuccessMsg] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['school', 'profile'],
    queryFn: () => schoolApi.getProfile(),
  });

  const [form, setForm] = useState({
    motto: '',
    principalName: '',
    schoolType: 'SECONDARY',
    ownershipType: 'PRIVATE',
    currency: 'NGN',
    openingTime: '07:30',
    lateThreshold: '07:50',
    geofenceRadius: 250,
    address: '',
    city: '',
    state: '',
    phone: '',
    email: '',
    website: '',
  });

  useEffect(() => {
    if (profile) {
      setForm({
        motto: profile.motto || 'Knowledge, Integrity and Excellence',
        principalName: profile.principalName || 'Dr. Kingsley Adeyemi',
        schoolType: profile.schoolType || 'SECONDARY',
        ownershipType: profile.ownershipType || 'PRIVATE',
        currency: profile.currency || 'NGN',
        openingTime: profile.openingTime || '07:30',
        lateThreshold: profile.lateThreshold || '07:50',
        geofenceRadius: profile.geofenceRadius || 250,
        address: profile.address || 'Plot 14, Commercial Avenue, Ikeja',
        city: profile.city || 'Ikeja',
        state: profile.state || 'Lagos',
        phone: profile.phone || '+234 802 345 6789',
        email: profile.email || 'info@tgeasymodel.edu.ng',
        website: profile.website || 'https://tgeasymodel.edu.ng',
      });
    }
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: (data: typeof form) => schoolApi.updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school', 'profile'] });
      setSuccessMsg(true);
      setTimeout(() => setSuccessMsg(false), 4000);
    },
  });

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 900 }}>
      {/* Title */}
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h5" fontWeight={700}>
            School Profile & Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Institution identity, gate schedule parameters, and official contact details
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={updateMutation.isPending}
          onClick={() => updateMutation.mutate(form)}
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </Stack>

      {successMsg && (
        <Alert icon={<CheckCircleIcon />} severity="success">
          School configuration and operational parameters updated successfully!
        </Alert>
      )}

      {/* School Crest & Branding */}
      <SchoolBrandingCard />

      {/* Institution Identity */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
            Institution Identity
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Institution Legal Name"
                disabled
                value={tenant?.name ?? 'TGEasy Model College'}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="School Motto"
                value={form.motto}
                onChange={(e) => setForm({ ...form, motto: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Head of School / Principal Name"
                value={form.principalName}
                onChange={(e) => setForm({ ...form, principalName: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                select
                fullWidth
                size="small"
                label="School Type"
                value={form.schoolType}
                onChange={(e) => setForm({ ...form, schoolType: e.target.value })}
              >
                <MenuItem value="NURSERY">Nursery / Early Years</MenuItem>
                <MenuItem value="PRIMARY">Primary School</MenuItem>
                <MenuItem value="SECONDARY">Secondary / High School</MenuItem>
                <MenuItem value="COMBINED">Combined K-12</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                select
                fullWidth
                size="small"
                label="Currency"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              >
                <MenuItem value="NGN">NGN (₦ - Nigerian Naira)</MenuItem>
                <MenuItem value="USD">USD ($ - US Dollar)</MenuItem>
                <MenuItem value="GBP">GBP (£ - British Pound)</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Gate & Attendance Parameters */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
            Gate & Attendance Parameters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                type="time"
                label="Morning Gate Opening Time"
                InputLabelProps={{ shrink: true }}
                value={form.openingTime}
                onChange={(e) => setForm({ ...form, openingTime: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                type="time"
                label="Late Arrival Cutoff Time"
                InputLabelProps={{ shrink: true }}
                value={form.lateThreshold}
                onChange={(e) => setForm({ ...form, lateThreshold: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Security Geofence Radius (Meters)"
                value={form.geofenceRadius}
                onChange={(e) => setForm({ ...form, geofenceRadius: Number(e.target.value) })}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Campus Contact & Address */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
            Official Campus Contact & Address
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Campus Address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="City / LGA"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="State"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Official Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                size="small"
                label="Official Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="School Website"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}

function SchoolBrandingCard() {
  const tenant = useTenantStore((s) => s.current);
  const [logoError, setLogoError] = useState('');
  const logoUrl = tenantLogoUrl(tenant?.id, tenant?.logoKey);

  const upload = useMutation({
    mutationFn: (file: File) => tenantsApi.uploadLogo(file),
    onSuccess: () => {
      setLogoError('');
      void useTenantStore.getState().load();
    },
    onError: (e) => setLogoError(apiErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: () => tenantsApi.removeLogo(),
    onSuccess: () => {
      setLogoError('');
      void useTenantStore.getState().load();
    },
    onError: (e) => setLogoError(apiErrorMessage(e)),
  });

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setLogoError('Please choose a PNG, JPEG or WebP image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('The logo must be smaller than 2 MB.');
      return;
    }
    upload.mutate(file);
  };

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          School Crest & Official Logo
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Upload your official institution crest or emblem. It automatically replaces the default logo across the school portal, navigation bar, printable student ID cards, official fee receipts, and terminal report sheets.
        </Typography>

        {logoError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {logoError}
          </Alert>
        )}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center">
          <Box
            sx={{
              width: 104,
              height: 104,
              borderRadius: 3,
              border: '2px dashed',
              borderColor: 'primary.main',
              bgcolor: 'background.default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              flexShrink: 0,
              p: 1,
            }}
          >
            {logoUrl ? (
              <Box
                component="img"
                src={logoUrl}
                alt="School crest"
                sx={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <Stack alignItems="center" spacing={0.5}>
                <SchoolIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary' }}>No Crest</Typography>
              </Stack>
            )}
          </Box>

          <Stack spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1.5} flexWrap="wrap">
              <label htmlFor="school-logo-input">
                <Button
                  variant="contained"
                  component="span"
                  startIcon={<CloudUploadIcon />}
                  disabled={upload.isPending || remove.isPending}
                >
                  {upload.isPending ? 'Uploading Crest...' : 'Upload School Crest'}
                </Button>
              </label>
              <input
                id="school-logo-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                hidden
                onChange={handleFile}
              />
              {tenant?.logoKey && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  disabled={upload.isPending || remove.isPending}
                  onClick={() => remove.mutate()}
                >
                  {remove.isPending ? 'Removing...' : 'Remove Crest'}
                </Button>
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Accepted formats: PNG, JPEG, WebP. Maximum size: 2 MB. High-resolution square or transparent PNG recommended.
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
