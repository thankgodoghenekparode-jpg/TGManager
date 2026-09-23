# TGManager Mobile (native wrapper)

An Expo (React Native) companion app that wraps the existing TGManager web app
in a WebView and delivers **native push notifications** to the phone's
notification center:

- **Android** — delivered via Firebase Cloud Messaging (FCM) through Expo.
- **iPhone** — delivered via Apple Push Notification service (APNs) through Expo.

The web app and this wrapper talk over a small message bridge:

| Direction | Message | What it does |
|---|---|---|
| Web → native | `{ type: "auth", token, tenantId }` | Registers this device with the backend (`POST /push/subscriptions`) using the Expo push token |
| Native → web | `{ type: "navigate", url }` | Opens the given route when a notification is tapped |

## How it works

1. The app loads `APP_URL` (the deployed dashboard) in a WebView.
2. After login, the web app forwards its JWT + tenant id via the bridge
   (`Frontend/src/lib/mobileBridge.ts`, wired from `NotificationsMenu`).
3. This wrapper requests notification permission and obtains an Expo push
   token (`ExponentPushToken[…`).
4. It then registers that token with the backend, which
   `PushService.sendToUser` fans out to via the Expo push service when a chat
   notification is created.
5. Tapping a notification routes back into the web app (`/chat`).

## Setup

### 1. Install dependencies

```bash
cd Mobile
npm install
npx expo install --fix   # align package versions with your Expo SDK
```

### 2. Create an Expo account + project (free)

```bash
# install the EAS CLI once
npm i -g eas-cli
# log in and link a project — copy the Project ID it prints
eas init
```

Put the project id into `app.json`:

```json
"extra": { "eas": { "projectId": "REPLACE_WITH_YOUR_EAS_PROJECT_ID" } }
```

> The push token requires a valid EAS project id. Until it's set, the app runs
> but won't register for push.

### 3. Environment (optional)

Create `Mobile/.env.local` to point at a different app/API:

```bash
EXPO_PUBLIC_APP_URL=https://tg-manager.vercel.app
EXPO_PUBLIC_API_URL=https://tgmanager-backend.onrender.com/api/v1
```

Defaults are the Vercel/Render URLs above.

### 4. Run it

```bash
npm start          # then scan the QR code with Expo Go
npm run android    # Android emulator / device
npm run ios        # iOS simulator — push needs a real device for APNs
```

### 5. Production builds (FCM + APNs)

Real notification delivery on a built app needs native push credentials:

- **Android**: create a Firebase project, add the Android package
  `com.tgmanager.mobile`, download `google-services.json`, and set
  `android.googleServicesFile` in `app.json`.
- **iOS**: in the EAS/Known Managed workflow, add your Apple Push key
  (APNs, `.p8`) to the Expo project credentials (or via `eas credentials`).

```bash
eas build --platform android
eas build --platform ios
```

Or for Expo Go testing without builds, push works through Expo's own APNs
credentials while you're inside Expo Go during development.

## Backend requirements

- `PUSH_ENABLED=true` (Render env) — enables all push delivery.
- Expo tokens never need VAPID keys; Web Push (browser/PWA) additionally needs
  `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` (see root `README.md`).