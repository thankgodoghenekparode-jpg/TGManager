import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Badge,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Popover,
  Typography,
} from '@mui/material'
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import CheckIcon from '@mui/icons-material/Check'
import { notificationsApi } from '../api/notifications'
import { apiErrorMessage } from '../api/client'
import { getTenantId } from '../api/client'
import {
  connectNotificationsSocket,
  disconnectNotificationsSocket,
  subscribeNotifications,
} from '../lib/notificationsSocket'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(iso).toLocaleDateString()
}

export function NotificationsMenu() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const hasTenant = !!getTenantId()

  const list = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(20),
    enabled: hasTenant,
    refetchInterval: 30_000,
  })
  const unread = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => notificationsApi.unreadCount(),
    enabled: hasTenant,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (!hasTenant) return
    connectNotificationsSocket()
    const unsubscribe = subscribeNotifications(() => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications-unread'] })
    })
    return () => {
      unsubscribe()
      disconnectNotificationsSocket()
    }
  }, [hasTenant, qc])

  const markOne = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications-unread'] })
    },
  })

  const markAll = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      qc.invalidateQueries({ queryKey: ['notifications-unread'] })
    },
    onError: (e) => {
      // "No unread notifications" on a fresh click is fine; surface other errors.
      if (/no unread/i.test(apiErrorMessage(e))) return
    },
  })

  if (!hasTenant) return null

  const count = unread.data?.count ?? 0
  const open = Boolean(anchor)

  const onItem = (id: string) => {
    if (id) markOne.mutate(id)
  }

  return (
    <>
      <IconButton
        color="inherit"
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ mr: 0.5 }}
      >
        <Badge badgeContent={count} color="error">
          {count > 0 ? <NotificationsActiveIcon /> : <NotificationsNoneIcon />}
        </Badge>
      </IconButton>
      <Popover
        open={open}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { mt: 1, width: { xs: 'calc(100vw - 24px)', sm: 360 }, maxWidth: 'calc(100vw - 24px)', maxHeight: { xs: '70vh', sm: 480 }, borderRadius: 3 } } }}
      >
        <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" fontWeight={700}>Notifications</Typography>
          {count > 0 && (
            <Button size="small" startIcon={<CheckIcon />} disabled={markAll.isPending} onClick={() => markAll.mutate()}>
              Mark all read
            </Button>
          )}
        </Box>
        <Divider />
        <List dense sx={{ py: 0.5, overflow: 'auto', maxHeight: 400 }}>
          {(list.data ?? []).slice(0, 20).map((n) => (
            <ListItemButton
              key={n.id}
              onClick={() => {
                setAnchor(null)
                onItem(n.id)
                if (n.type === 'WORKFLOW_PENDING' || n.data?.instanceId) navigate('/app/workflows')
              }}
              sx={{
                alignItems: 'flex-start',
                borderBottom: '1px solid',
                borderColor: 'divider',
                bgcolor: n.readAt ? 'transparent' : 'rgba(79, 70, 229, 0.06)',
              }}
            >
              <ListItemText
                primary={
                  <Typography variant="body2" fontWeight={n.readAt ? 500 : 700} sx={{ whiteSpace: 'normal' }}>
                    {n.title}
                  </Typography>
                }
                secondary={
                  <>
                    {n.body && (
                      <Typography variant="caption" color="text.secondary" component="span" display="block" sx={{ whiteSpace: 'normal' }}>
                        {n.body}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" component="span">
                      {timeAgo(n.createdAt)}
                    </Typography>
                  </>
                }
              />
            </ListItemButton>
          ))}
          {(list.data ?? []).length === 0 && (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                No notifications yet
              </Typography>
            </Box>
          )}
        </List>
      </Popover>
    </>
  )
}
