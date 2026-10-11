import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { WebView } from 'react-native-webview'

declare const process: { env: Record<string, string | undefined> }

const APP_URL: string =
  process.env.EXPO_PUBLIC_APP_URL ?? 'https://tg-manager.vercel.app'

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
 * Turn an incoming deep link or notification URL into a web route.
 * Supports both the custom scheme (`tgmanager://chat`) and absolute URLs that
 * point at the deployed app (e.g. from a universal link).
 */
export function resolveDeepLink(url: string, appUrl = APP_URL): string | null {
  if (!url) return null
  if (url.startsWith('tgmanager://')) {
    const path = url.replace('tgmanager://', '').replace(/^\/+/, '')
    return path ? `${appUrl.replace(/\/$/, '')}/${path}` : appUrl
  }
  try {
    const target = new URL(url)
    const origin = new URL(appUrl).origin
    if (target.origin === origin) return url
  } catch {
    // Not an absolute URL — ignore.
  }
  return null
}

/**
 * TGManager native wrapper.
 *
 * Loads the existing web app in a WebView and registers this device for push
 * notifications via Expo (FCM on Android, APNs on iOS). The web app performs
 * the authenticated `POST /push/subscriptions` call itself (so the httpOnly
 * session cookies apply); this wrapper only hands it the Expo push token over
 * the message bridge and forwards notification/deep-link navigation back.
 */
export default function App() {
  const webRef = useRef<WebView>(null)
  const pushTokenRef = useRef<string | null>(null)
  const [webKey, setWebKey] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)

  const postToWeb = useCallback((payload: Record<string, unknown>) => {
    webRef.current?.postMessage(JSON.stringify(payload))
  }, [])

  const sendPushToken = useCallback(() => {
    if (pushTokenRef.current) {
      postToWeb({ type: 'push-token', token: pushTokenRef.current })
    }
  }, [postToWeb])

  const navigateWeb = useCallback(
    (url: string) => {
      const target = resolveDeepLink(url)
      if (target) postToWeb({ type: 'navigate', url: target })
    },
    [postToWeb],
  )

  // Obtain the device push token once, then hand it to the web app.
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
      if (!projectId || projectId === 'REPLACE_WITH_YOUR_EAS_PROJECT_ID') return
      let perms = await Notifications.getPermissionsAsync()
      if (!perms.granted) perms = await Notifications.requestPermissionsAsync()
      if (!perms.granted) return
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: String(projectId),
      })
      if (cancelled) return
      pushTokenRef.current = token.data
      sendPushToken()
    })().catch(() => {
      // Push is best-effort; never crash the app over it.
    })
    return () => {
      cancelled = true
    }
  }, [sendPushToken])

  // Tapping a notification routes back into the web app.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const url = response.notification.request.content.data?.url
        if (typeof url === 'string') navigateWeb(url)
      },
    )
    return () => sub.remove()
  }, [navigateWeb])

  // Deep links, both cold-start and while running.
  useEffect(() => {
    void Linking.getInitialURL().then((url) => {
      if (url) navigateWeb(url)
    })
    const sub = Linking.addEventListener('url', ({ url }) => navigateWeb(url))
    return () => sub.remove()
  }, [navigateWeb])

  const onMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      try {
        const msg = JSON.parse(String(event?.nativeEvent?.data ?? '')) as {
          type?: string
        }
        // The web app signals it is ready (and again after each login); (re)send
        // the push token so registration survives reloads and the token/ready
        // race in either direction.
        if (msg.type === 'ready' || msg.type === 'auth') {
          sendPushToken()
        }
      } catch {
        // Ignore malformed messages from the web app.
      }
    },
    [sendPushToken],
  )

  const retry = useCallback(() => {
    setLoadError(null)
    setWebKey((k) => k + 1)
  }, [])

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      {loadError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>You're offline</Text>
          <Text style={styles.errorBody}>{loadError}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={retry}
            accessibilityRole="button"
          >
            <Text style={styles.retryLabel}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          key={webKey}
          ref={webRef}
          source={{ uri: APP_URL }}
          onMessage={onMessage}
          originWhitelist={['*']}
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows={false}
          pullToRefreshEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4f46e5" />
            </View>
          )}
          onLoad={() => setLoadError(null)}
          onError={() =>
            setLoadError(
              'Unable to reach TGManager. Check your connection and try again.',
            )
          }
          style={styles.container}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: '#ffffff',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  errorBody: {
    fontSize: 15,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 999,
  },
  retryLabel: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
})
