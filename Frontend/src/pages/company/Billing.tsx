import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium'
import { useSearchParams } from 'react-router-dom'
import {
  billingApi,
  CREDIT_LABELS,
  formatCredits,
  formatPriceCents,
  type CatalogPlan,
} from '../../api/billing'
import { apiErrorMessage } from '../../api/client'
import { Can } from '../../components/PermissionGate'

const CREDIT_KINDS = ['push', 'email', 'sms', 'storage'] as const

export function BillingPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const checkoutResult = searchParams.get('checkout')
  const [checkoutError, setCheckoutError] = useState('')
  const [pendingPlanCode, setPendingPlanCode] = useState<string | null>(null)

  const clearCheckoutResult = () => {
    setSearchParams(
      (next) => {
        next.delete('checkout')
        return next
      },
      { replace: true },
    )
  }

  const status = useQuery({ queryKey: ['billing'], queryFn: () => billingApi.status() })
  const catalog = useQuery({ queryKey: ['plans', 'catalog'], queryFn: () => billingApi.catalog() })

  const checkout = useMutation({
    mutationFn: (planCode: string) => billingApi.checkout(planCode),
    onSuccess: (res) => {
      setCheckoutError('')
      window.location.assign(res.url)
    },
    onError: (e) => {
      setPendingPlanCode(null)
      setCheckoutError(apiErrorMessage(e))
    },
  })

  const currentCode = status.data?.plan?.code ?? null
  const currentPriceCents = status.data?.plan?.priceCents ?? 0

  const sortedCatalog = useMemo(
    () => [...(catalog.data ?? [])].sort((a, b) => a.priceCents - b.priceCents),
    [catalog.data],
  )

  const isLoading = status.isLoading || catalog.isLoading
  const billingUnavailable = status.isError || Boolean(status.error)

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ mb: 1 }}>
        <Typography variant="h5" fontWeight={800}>Billing & plan</Typography>
        {status.data?.status && (
          <Chip
            size="small"
            label={status.data.status}
            color={status.data.status === 'ACTIVE' ? 'success' : status.data.status === 'TRIAL' ? 'info' : 'warning'}
          />
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 680 }}>
        Manage your subscription. Credits are add-on usage bundles (push, email, SMS, storage) that
        come with your plan and are consumed by notifications as they are sent.
      </Typography>

      {checkoutResult === 'success' && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={clearCheckoutResult}>
          Your subscription has been updated. Welcome aboard!
        </Alert>
      )}
      {checkoutResult === 'cancelled' && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={clearCheckoutResult}>
          Checkout was cancelled. Your current plan is unchanged.
        </Alert>
      )}
      {checkoutError && <Alert severity="error" sx={{ mb: 2 }}>{checkoutError}</Alert>}

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack spacing={3}>
          {billingUnavailable && (
            <Alert severity="warning">
              Billing has not been configured on this deployment yet. Payments will be available
              once the owner adds Stripe keys to the server.
            </Alert>
          )}

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={800}>
                {status.data?.plan ? `Current plan: ${status.data.plan.name}` : 'Current plan'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {status.data?.plan
                  ? `${formatPriceCents(status.data.plan.priceCents)} / month`
                  : 'No active subscription.'}
              </Typography>
              <CreditsBar credits={status.data?.credits ?? {}} />
            </CardContent>
          </Card>

          <Grid container spacing={2}>
            {sortedCatalog.map((plan) => (
              <Grid item xs={12} sm={6} md={4} key={plan.code}>
                <PlanCard
                  plan={plan}
                  isCurrent={plan.code === currentCode}
                  canManage={billingUnavailable === false}
                  busy={checkout.isPending && pendingPlanCode === plan.code}
                  actionLabel={actionLabel(plan.code, currentCode, currentPriceCents)}
                  onSelect={() => {
                    setPendingPlanCode(plan.code)
                    checkout.mutate(plan.code)
                  }}
                />
              </Grid>
            ))}
          </Grid>
          <Box sx={{ height: 16 }} />
        </Stack>
      )}
    </Box>
  )
}

function CreditsBar({ credits }: { credits: Record<string, number> }) {
  const anyCredits = CREDIT_KINDS.some((kind) => (credits[kind] ?? 0) > 0)
  if (!anyCredits) {
    return <Typography variant="body2" color="text.secondary">No add-on credits in this plan.</Typography>
  }
  return (
    <Stack spacing={1.5}>
      {CREDIT_KINDS.filter((kind) => (credits[kind] ?? 0) > 0).map((kind) => {
        const used = 0
        const available = credits[kind] ?? 0
        const pct = used === 0 ? 100 : Math.max(0, Math.min(100, ((available - used) / available) * 100))
        return (
          <Box key={kind}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
              <Typography variant="body2">{CREDIT_LABELS[kind] ?? kind}</Typography>
              <Typography variant="body2" color="text.secondary">
                {used.toLocaleString()} / {formatCredits(kind, available)}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={pct}
              color={pct < 30 ? 'warning' : 'success'}
              sx={{ height: 6, borderRadius: 1 }}
            />
          </Box>
        )
      })}
    </Stack>
  )
}

function PlanCard({
  plan,
  isCurrent,
  canManage,
  busy,
  actionLabel,
  onSelect,
}: {
  plan: CatalogPlan
  isCurrent: boolean
  canManage: boolean
  busy: boolean
  actionLabel: string
  onSelect: () => void
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderColor: plan.highlight ? 'primary.main' : 'divider',
        borderWidth: plan.highlight ? 2 : 1,
      }}
    >
      <CardContent sx={{ flex: 1 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6" fontWeight={800}>{plan.name}</Typography>
          {plan.highlight && (
            <Chip
              size="small"
              color="primary"
              icon={<WorkspacePremiumIcon />}
              label={plan.highlight}
            />
          )}
        </Stack>
        <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5 }}>
          {formatPriceCents(plan.priceCents)}
          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
            {plan.priceCents === 0 ? 'forever' : `/ ${plan.billingCycle}`}
          </Typography>
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
          {plan.limits.maxStaff === null
            ? 'Unlimited branches and staff'
            : `Up to ${plan.limits.maxBranches} branch${plan.limits.maxBranches === 1 ? '' : 'es'} and ${plan.limits.maxStaff} staff`}
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Stack spacing={1} sx={{ minHeight: 176 }}>
          {plan.features.map((feature) => (
            <Stack key={feature} direction="row" spacing={1} alignItems="flex-start">
              <CheckIcon fontSize="small" color="success" sx={{ mt: 0.25 }} />
              <Typography variant="body2">{feature}</Typography>
            </Stack>
          ))}
        </Stack>
      </CardContent>
      <Box sx={{ p: 2, pt: 0 }}>
        <Can permissions={['tenant.manage']}>
          <Button
            fullWidth
            size="large"
            variant={isCurrent ? 'outlined' : plan.highlight ? 'contained' : 'outlined'}
            disabled={isCurrent || busy || !canManage}
            onClick={onSelect}
          >
            {isCurrent ? 'Current plan' : busy ? 'Redirecting…' : actionLabel}
          </Button>
        </Can>
      </Box>
    </Card>
  )
}

function actionLabel(planCode: string, currentCode: string | null, currentPriceCents: number): string {
  if (!currentCode) return 'Upgrade'
  if (planCode === currentCode) return 'Current plan'
  const targetPrice = { free: 0, pro: 4900, enterprise: 14900 }[planCode] ?? 0
  return targetPrice > currentPriceCents ? 'Upgrade' : 'Switch'
}