# TGManager Flutter Frontend

This directory contains the Flutter/Dart frontend conversion. The current React/Vite app in `../frontend` is intentionally left untouched so the working app is not broken while the Flutter surface is expanded.

## Run

Install Flutter, then from this directory run:

```powershell
flutter pub get
flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:3000/api/v1
```

If `API_BASE_URL` is not provided, the app uses `/api/v1`, matching the existing Vite frontend default.

## What Is Converted

- Login, session bootstrap, logout, password reset, and change-password flows.
- Tenant selection and tenant header persistence.
- Platform and company shells with guarded navigation.
- Dashboard-style screens and route coverage for the React router.
- Generic list/detail screens connected to the matching backend endpoints for core modules.
- Shared API client with JSON requests, relative or absolute API base URLs, and `x-tenant-id` headers.
