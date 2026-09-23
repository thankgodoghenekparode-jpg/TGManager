import { useCallback, useEffect, useRef } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { WebView } from 'react-native-webview'

declare const process: { env: Record<string, string | undefined> }

const APP_URL: string =
  process.env.EXPO_PUBLIC_APP_URL ?? 'https://tg-manager.vercel.app'
const API_BASE: string =
  process.env.EXPO_PUBLIC_API_URL ??
  'https://tgmanager-backend.onrender.com/api/v1'

// Show notifications in the OS notification center even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

/**
 * TGManager native wrapper.
 *
 * Loads the existing web app in a WebView and registers this device for push
 * notifications via Expo (FCM on Android, APNs on iOS). The web app forwards
 * its auth session through `window.ReactNativeWebView.postMessage`, and this
 * wrapper posts pushes + tap-navigation back to the web app.
 */
export default function App() {
  const webRef = useRef<WebView>(null)
  const authRef = useRef<{ token: string; tenantId: string } | null>(null)
  const pushTokenRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Chat',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
        })
      }
      const projectId = Constants.expoConfig?.extra?.eas?.projectId
      if (!projectId) return
      const perms = await Notifications.getPermissionsAsync()
      if (!perms.granted) {
        const next = await Notifications.requestPermissionsAsync()
        if (!next.granted) return
      }
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: String(projectId),
      })
      if (!cancelled) pushTokenRef.current = token.data
    })().catch(() => {})

    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const url = response.notification.request.content.data?.url
        if (typeof url === 'string') {
          webRef.current?.postMessage(JSON.stringify({ type: 'navigate', url }))
        }
      },
    )

    return () => {
      cancelled = true
      sub.remove()
    }
  }, [])

  const syncPushToken = useCallback(async () => {
    if (!authRef.current || !pushTokenRef.current) return
    try {
      await fetch(`${API_BASE}/push/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authRef.current.token}`,
          'x-tenant-id': authRef.current.tenantId,
          'User-Agent': `tgmanager-mobile (expo, ${Platform.OS} ${String(Platform.Version)})`,
        },
        body: JSON.stringify({
          subscription: { endpoint: pushTokenRef.current },
        }),
      })
    } catch {
      // Push registration is best-effort; never crash the app over it.
    }
  }, [])

  const onMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data) as {
          type?: string
          token?: string
          tenantId?: string
        }
        if (msg.type === 'auth' && msg.token && msg.tenantId) {
          authRef.current = { token: msg.token, tenantId: msg.tenantId }
          void syncPushToken()
        } else if (msg.type === 'logout') {
          authRef.current = null
        }
      } catch {
        // Ignore malformed messages from the web app.
      }
    },
    [syncPushToken],
  )

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <WebView
        ref={webRef}
        source={{ uri: APP_URL }}
        onMessage={onMessage}
        originWhitelist={['*']}
        allowsBackForwardNavigationGestures
        setSupportMultipleWindows={false}
        style={styles.container}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
})