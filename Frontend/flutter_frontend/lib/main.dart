import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/browser_client.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

const String _defaultApiBaseUrl = 'http://localhost:4000/api/v1';
const String _apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: _defaultApiBaseUrl,
);

void main() {
  runApp(const TGManagerApp());
}

class TGManagerApp extends StatefulWidget {
  const TGManagerApp({super.key});

  @override
  State<TGManagerApp> createState() => _TGManagerAppState();
}

class _TGManagerAppState extends State<TGManagerApp> {
  late final AppState state;

  @override
  void initState() {
    super.initState();
    state = AppState(ApiClient(baseUrl: _apiBaseUrl));
    state.bootstrap();
  }

  @override
  Widget build(BuildContext context) {
    return AppScope(
      state: state,
      child: MaterialApp(
        title: 'TGManager',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        home: const AppRouter(),
      ),
    );
  }
}

class AppScope extends InheritedNotifier<AppState> {
  const AppScope({
    required AppState state,
    required super.child,
    super.key,
  }) : super(notifier: state);

  static AppState of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'AppScope is missing');
    return scope!.notifier!;
  }
}

class AppState extends ChangeNotifier {
  AppState(this.api);

  final ApiClient api;
  bool initialized = false;
  bool loading = false;
  AuthUser? user;
  CurrentTenant? tenant;
  List<TenantMembership> memberships = const [];
  String route = '/';
  String? error;

  bool get isPlatformUser =>
      user?.role == 'SUPER_ADMIN' || user?.role == 'PLATFORM_SUPPORT';

  Future<void> bootstrap() async {
    loading = true;
    notifyListeners();
    try {
      final session = await api.me();
      user = session.user;
      memberships = session.memberships;
      await _ensureTenantSelection();
      route = _initialRoute();
    } catch (_) {
      user = null;
      memberships = const [];
      route = '/login';
    } finally {
      initialized = true;
      loading = false;
      notifyListeners();
    }
  }

  Future<void> login(String email, String password) async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      user = await api.login(email, password);
      final session = await api.me();
      user = session.user;
      memberships = session.memberships;
      await _ensureTenantSelection();
      route = _initialRoute();
    } catch (e) {
      error = apiErrorMessage(e);
      rethrow;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> requestPasswordReset(String email) async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      await api.postJson('/auth/forgot-password', {'email': email});
    } catch (e) {
      error = apiErrorMessage(e);
      rethrow;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> resetPassword(String token, String newPassword) async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      await api.postJson('/auth/reset-password', {
        'token': token,
        'newPassword': newPassword,
      });
      route = '/login';
    } catch (e) {
      error = apiErrorMessage(e);
      rethrow;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> changePassword(
    String currentPassword,
    String newPassword,
  ) async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      await api.patchJson('/auth/change-password', {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      });
    } catch (e) {
      error = apiErrorMessage(e);
      rethrow;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> loadTenant() async {
    final current =
        await api.getJson('/tenants/current') as Map<String, dynamic>;
    tenant = CurrentTenant.fromJson(current);
    await api.setTenantId(tenant!.id);
  }

  Future<void> selectTenant(TenantMembership membership) async {
    await api.setTenantId(membership.id);
    await loadTenant();
    go('/app');
  }

  Future<void> _ensureTenantSelection() async {
    if (user == null) return;
    if (isPlatformUser) {
      tenant = null;
      await api.setTenantId(null);
      return;
    }

    final selectedTenant = api.tenantId;
    final hasSelectedMembership = selectedTenant != null &&
        memberships.any((membership) => membership.id == selectedTenant);

    if (!hasSelectedMembership) {
      tenant = null;
      if (memberships.length != 1) {
        await api.setTenantId(null);
        return;
      }
      await api.setTenantId(memberships.first.id);
    }

    await loadTenant();
  }

  Future<void> logout() async {
    try {
      await api.postJson('/auth/logout', const {});
    } catch (_) {
      // Logout should still clear local UI state if the session already expired.
    }
    await api.setTenantId(null);
    user = null;
    tenant = null;
    memberships = const [];
    route = '/login';
    notifyListeners();
  }

  void go(String nextRoute) {
    route = _guardRoute(nextRoute);
    notifyListeners();
  }

  String _initialRoute() {
    if (user == null) return '/login';
    if (isPlatformUser) return '/admin';
    final selectedTenant = api.tenantId;
    final hasSelectedMembership = selectedTenant != null &&
        memberships.any((membership) => membership.id == selectedTenant);
    return hasSelectedMembership ? '/app' : '/select-company';
  }

  String _guardRoute(String nextRoute) {
    if (!initialized) return route;
    if (user == null) {
      return switch (nextRoute) {
        '/forgot-password' ||
        '/password-reset-request' ||
        '/reset-password' =>
          nextRoute,
        _ => '/login',
      };
    }
    if (nextRoute == '/login' || nextRoute == '/') return _initialRoute();
    if (nextRoute.startsWith('/admin') && !isPlatformUser) {
      return _initialRoute();
    }
    if (nextRoute.startsWith('/app') && isPlatformUser) return '/admin';
    if (nextRoute.startsWith('/app') && tenant == null) {
      return '/select-company';
    }
    return nextRoute;
  }
}

class AppRouter extends StatelessWidget {
  const AppRouter({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    if (!state.initialized) {
      return const SplashScreen();
    }

    final route = state.route;
    if (route == '/login') return const LoginScreen();
    if (route == '/forgot-password' || route == '/password-reset-request') {
      return const PasswordResetRequestScreen();
    }
    if (route == '/reset-password') return const ResetPasswordScreen();
    if (route == '/select-company') return const SelectCompanyScreen();
    if (route.startsWith('/admin')) return PlatformShell(route: route);
    if (route.startsWith('/app')) return CompanyShell(route: route);
    return const LoginScreen();
  }
}

class ApiClient {
  ApiClient({required this.baseUrl});

  final String baseUrl;
  final http.Client _client = BrowserClient()..withCredentials = true;
  String? tenantId;

  Uri _uri(String path) {
    if (baseUrl.startsWith('http://') || baseUrl.startsWith('https://')) {
      return Uri.parse('$baseUrl$path');
    }
    return Uri.base.resolve('$baseUrl$path');
  }

  Future<void> hydrate() async {
    final prefs = await SharedPreferences.getInstance();
    tenantId = prefs.getString('tgmanager:tenantId');
  }

  Future<void> setTenantId(String? id) async {
    tenantId = id;
    final prefs = await SharedPreferences.getInstance();
    if (id == null) {
      await prefs.remove('tgmanager:tenantId');
    } else {
      await prefs.setString('tgmanager:tenantId', id);
    }
  }

  Map<String, String> get _headers {
    return {
      'Content-Type': 'application/json',
      if (tenantId != null) 'x-tenant-id': tenantId!,
    };
  }

  Future<AuthUser> login(String email, String password) async {
    final data = await postJson('/auth/login', {
      'email': email,
      'password': password,
    }) as Map<String, dynamic>;
    return AuthUser.fromJson(data['user'] as Map<String, dynamic>);
  }

  Future<SessionData> me() async {
    await hydrate();
    final data = await getJson('/auth/me') as Map<String, dynamic>;
    return SessionData.fromJson(data);
  }

  Future<dynamic> getJson(String path) async {
    final response = await _client.get(_uri(path), headers: _headers);
    return _decode(response);
  }

  Future<dynamic> postJson(String path, Map<String, dynamic> body) {
    return _sendJson('POST', path, body);
  }

  Future<dynamic> patchJson(
    String path,
    Map<String, dynamic> body,
  ) {
    return _sendJson('PATCH', path, body);
  }

  Future<dynamic> deleteJson(String path) {
    return _sendJson('DELETE', path, const {});
  }

  Future<dynamic> _sendJson(
    String method,
    String path,
    Map<String, dynamic> body,
  ) async {
    final request = http.Request(method, _uri(path))
      ..headers.addAll(_headers)
      ..body = jsonEncode(body);
    final streamed = await _client.send(request);
    return _decode(await http.Response.fromStream(streamed));
  }

  dynamic _decode(http.Response response) {
    final body =
        response.body.isEmpty ? <String, dynamic>{} : jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    }
    final mapBody = body is Map<String, dynamic> ? body : <String, dynamic>{};
    throw ApiException(
      statusCode: response.statusCode,
      message: _messageFromBody(mapBody) ??
          response.reasonPhrase ??
          'Request failed',
    );
  }

  String? _messageFromBody(Map<String, dynamic> body) {
    final message = body['message'];
    if (message is List && message.isNotEmpty) return message.first.toString();
    if (message is String) return message;
    return null;
  }
}

String apiErrorMessage(Object error) {
  if (error is ApiException) return error.message;
  return 'An unexpected error occurred';
}

class ApiException implements Exception {
  ApiException({required this.statusCode, required this.message});

  final int statusCode;
  final String message;

  @override
  String toString() => message;
}

class SessionData {
  const SessionData({required this.user, required this.memberships});

  final AuthUser? user;
  final List<TenantMembership> memberships;

  factory SessionData.fromJson(Map<String, dynamic> json) {
    return SessionData(
      user: json['user'] == null
          ? null
          : AuthUser.fromJson(json['user'] as Map<String, dynamic>),
      memberships: ((json['memberships'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(TenantMembership.fromJson)
          .toList(),
    );
  }
}

class AuthUser {
  const AuthUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
  });

  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String role;

  String get fullName => '$firstName $lastName';
  String get initials {
    final parts = fullName.trim().split(RegExp(r'\s+'));
    return parts.take(2).map((part) => part[0]).join().toUpperCase();
  }

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      firstName: json['firstName']?.toString() ?? '',
      lastName: json['lastName']?.toString() ?? '',
      role: json['role']?.toString() ?? 'USER',
    );
  }
}

class TenantMembership {
  const TenantMembership({
    required this.id,
    required this.name,
    required this.slug,
    required this.status,
    required this.onboardingStatus,
    this.planName,
  });

  final String id;
  final String name;
  final String slug;
  final String status;
  final String onboardingStatus;
  final String? planName;

  factory TenantMembership.fromJson(Map<String, dynamic> json) {
    final plan = json['plan'];
    return TenantMembership(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      slug: json['slug']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      onboardingStatus: json['onboardingStatus']?.toString() ?? '',
      planName: plan is Map<String, dynamic> ? plan['name']?.toString() : null,
    );
  }
}

class CurrentTenant {
  const CurrentTenant({
    required this.id,
    required this.name,
    required this.slug,
    required this.status,
    required this.onboardingStatus,
    required this.planName,
    required this.permissions,
    required this.isCompanyAdmin,
  });

  final String id;
  final String name;
  final String slug;
  final String status;
  final String onboardingStatus;
  final String planName;
  final List<String> permissions;
  final bool isCompanyAdmin;

  factory CurrentTenant.fromJson(Map<String, dynamic> json) {
    final plan = json['plan'];
    return CurrentTenant(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Company',
      slug: json['slug']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      onboardingStatus: json['onboardingStatus']?.toString() ?? '',
      planName: plan is Map<String, dynamic>
          ? plan['name']?.toString() ?? 'Plan'
          : 'Plan',
      permissions: ((json['permissions'] as List?) ?? const [])
          .map((permission) => permission.toString())
          .toList(),
      isCompanyAdmin: json['isCompanyAdmin'] == true,
    );
  }
}

const Color _ink = Color(0xff161311);
const Color _coal = Color(0xfff5f1ec);
const Color _paper = Color(0xff161311);
const Color _surface = Color(0xff221e1b);
const Color _surfaceElevated = Color(0xff2c2723);
const Color _line = Color(0xff342e28);
const Color _acid = Color(0xffd4b491);
const Color _mint = Color(0xffc5a079);
const Color _muted = Color(0xffa69c92);
const Color _accentWarmMuted = Color(0xff3e342b);

class AppTheme {
  static ThemeData light() {
    const scheme = ColorScheme.dark(
      primary: _acid,
      secondary: _mint,
      tertiary: _accentWarmMuted,
      surface: _surface,
      onSurface: _coal,
      onSurfaceVariant: _muted,
      error: Color(0xffe55b4c),
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: _paper,
      fontFamily: 'Arial',
      textTheme: const TextTheme(
        headlineLarge: TextStyle(
          fontSize: 42,
          fontWeight: FontWeight.w800,
          height: 1.05,
          color: _coal,
          letterSpacing: -0.5,
        ),
        headlineSmall: TextStyle(
          fontSize: 26,
          fontWeight: FontWeight.w800,
          height: 1.1,
          color: _coal,
        ),
        titleLarge: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.w800,
          color: _coal,
        ),
        titleMedium: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w700,
          color: _coal,
        ),
        bodyMedium: TextStyle(fontSize: 14, color: _coal),
        bodySmall: TextStyle(fontSize: 12, color: _muted),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: _paper,
        foregroundColor: _coal,
        elevation: 0,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
      ),
      cardTheme: CardThemeData(
        color: _surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(22),
          side: const BorderSide(color: _line),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: _acid,
          foregroundColor: _ink,
          minimumSize: const Size.fromHeight(52),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26)),
          textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: _acid,
          textStyle: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
      iconButtonTheme: IconButtonThemeData(
        style: IconButton.styleFrom(
          foregroundColor: _coal,
          backgroundColor: _surfaceElevated,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
            side: const BorderSide(color: _line),
          ),
        ),
      ),
      listTileTheme: const ListTileThemeData(
        iconColor: _acid,
        textColor: _coal,
        selectedColor: _ink,
        selectedTileColor: _acid,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: _surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24),
          side: const BorderSide(color: _line),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: _surfaceElevated,
        labelStyle: const TextStyle(color: _muted),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: _line),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: _line),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(18),
          borderSide: const BorderSide(color: _acid, width: 1.6),
        ),
      ),
    );
  }
}

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final email = TextEditingController();
  final password = TextEditingController();
  final formKey = GlobalKey<FormState>();
  String? error;

  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    return AuthScaffold(
      title: 'Welcome back',
      subtitle: 'Sign in to TGManager',
      child: Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (error != null) ErrorBanner(message: error!),
            TextFormField(
              controller: email,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Email'),
              validator: (value) =>
                  value == null || value.isEmpty ? 'Email is required' : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: password,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Password'),
              validator: (value) => value == null || value.isEmpty
                  ? 'Password is required'
                  : null,
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: state.loading ? null : () => _submit(state),
              child: state.loading
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Sign in'),
            ),
            TextButton(
              onPressed: () => state.go('/forgot-password'),
              child: const Text('Forgot password?'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit(AppState state) async {
    if (!formKey.currentState!.validate()) return;
    try {
      await state.login(email.text.trim(), password.text);
    } catch (_) {
      setState(() => error = state.error);
    }
  }
}

class PasswordResetRequestScreen extends StatefulWidget {
  const PasswordResetRequestScreen({super.key});

  @override
  State<PasswordResetRequestScreen> createState() =>
      _PasswordResetRequestScreenState();
}

class _PasswordResetRequestScreenState
    extends State<PasswordResetRequestScreen> {
  final email = TextEditingController();
  String? message;
  String? error;

  @override
  void dispose() {
    email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    return AuthScaffold(
      title: 'Reset password',
      subtitle: 'Request a reset link for your account',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (message != null) SuccessBanner(message: message!),
          if (error != null) ErrorBanner(message: error!),
          TextField(
            controller: email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Email'),
          ),
          const SizedBox(height: 18),
          FilledButton(
            onPressed: state.loading ? null : () => _submit(state),
            child: const Text('Send reset link'),
          ),
          TextButton(
            onPressed: () => state.go('/login'),
            child: const Text('Back to login'),
          ),
        ],
      ),
    );
  }

  Future<void> _submit(AppState state) async {
    try {
      await state.requestPasswordReset(email.text.trim());
      setState(() {
        message = 'If the email exists, a reset link has been sent.';
        error = null;
      });
    } catch (_) {
      setState(() {
        error = state.error;
        message = null;
      });
    }
  }
}

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final token = TextEditingController();
  final password = TextEditingController();
  final formKey = GlobalKey<FormState>();
  String? error;

  @override
  void dispose() {
    token.dispose();
    password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    return AuthScaffold(
      title: 'Set new password',
      subtitle: 'Use the password reset link from your email',
      child: Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (error != null) ErrorBanner(message: error!),
            TextFormField(
              controller: token,
              decoration: const InputDecoration(labelText: 'Reset token'),
              validator: (value) => value == null || value.isEmpty
                  ? 'Reset token is required'
                  : null,
            ),
            const SizedBox(height: 14),
            TextFormField(
              controller: password,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'New password'),
              validator: (value) => value == null || value.length < 8
                  ? 'Use at least 8 characters'
                  : null,
            ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: state.loading ? null : () => _submit(state),
              child: const Text('Reset password'),
            ),
            TextButton(
              onPressed: () => state.go('/login'),
              child: const Text('Back to login'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit(AppState state) async {
    if (!formKey.currentState!.validate()) return;
    try {
      await state.resetPassword(token.text.trim(), password.text);
    } catch (_) {
      setState(() => error = state.error);
    }
  }
}

class AuthScaffold extends StatelessWidget {
  const AuthScaffold({
    required this.title,
    required this.subtitle,
    required this.child,
    super.key,
  });

  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AuthBackground(
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              final wide = constraints.maxWidth >= 900;
              return Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 1120),
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: wide
                        ? Row(
                            children: [
                              const Expanded(child: AuthBrandPanel()),
                              const SizedBox(width: 16),
                              Expanded(
                                child: _AuthFormPanel(title, subtitle, child),
                              ),
                            ],
                          )
                        : _AuthFormPanel(title, subtitle, child),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _AuthFormPanel extends StatelessWidget {
  const _AuthFormPanel(this.title, this.subtitle, this.child);

  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const LogoRow(),
            const SizedBox(height: 28),
            Text(title, style: Theme.of(context).textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text(
              subtitle,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: _muted,
                  ),
            ),
            const SizedBox(height: 28),
            child,
          ],
        ),
      ),
    );
  }
}

class AuthBrandPanel extends StatelessWidget {
  const AuthBrandPanel({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 560),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: _line, width: 1.2),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: DecoratedBox(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                Color(0xff2a231d),
                Color(0xff1d1815),
                Color(0xff161311),
              ],
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(36),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: _accentWarmMuted,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: _acid.withValues(alpha: 0.3)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.auto_awesome, color: _acid, size: 14),
                      SizedBox(width: 6),
                      Text(
                        'DESIGNNEST MANAGEMENT',
                        style: TextStyle(
                          color: _acid,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1.1,
                        ),
                      ),
                    ],
                  ),
                ),
                const Spacer(),
                Text(
                  'Beautiful Spaces,\nThoughtfully\nManaged.',
                  style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                    color: _coal,
                    fontSize: 44,
                    height: 1.1,
                  ),
                ),
                const SizedBox(height: 18),
                const Text(
                  'Transform your organization into a unified, high-performance workspace with modern tools and intelligent dashboards.',
                  style: TextStyle(
                    color: _muted,
                    fontSize: 15,
                    height: 1.5,
                    fontWeight: FontWeight.w400,
                  ),
                ),
                const SizedBox(height: 32),
                const _BalancePreviewCard(),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class AuthBackground extends StatelessWidget {
  const AuthBackground({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: _ink,
      ),
      child: child,
    );
  }
}

class _BalancePreviewCard extends StatelessWidget {
  const _BalancePreviewCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: _surfaceElevated,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _line),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('System Health', style: TextStyle(color: _muted, fontSize: 12, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                '99.9%',
                style: TextStyle(
                  color: _coal,
                  fontSize: 32,
                  fontWeight: FontWeight.w800,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: _acid,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Row(
                  children: [
                    Text('Get Started', style: TextStyle(color: _ink, fontWeight: FontWeight.w800, fontSize: 13)),
                    SizedBox(width: 4),
                    Icon(Icons.arrow_forward, color: _ink, size: 16),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Row(
            children: [
              Icon(Icons.check_circle, color: _acid, size: 16),
              SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Active operations across all branches',
                  style: TextStyle(color: _muted, fontSize: 12),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class SelectCompanyScreen extends StatelessWidget {
  const SelectCompanyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Choose a company'),
        actions: [
          IconButton(
            tooltip: 'Logout',
            onPressed: state.logout,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: ListView.separated(
        padding: const EdgeInsets.all(24),
        itemCount: state.memberships.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final membership = state.memberships[index];
          return Card(
            child: ListTile(
              leading: Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: _acid,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: _ink),
                ),
                child: const Icon(Icons.apartment, color: _ink),
              ),
              title: Text(membership.name),
              subtitle: Text(
                [
                  membership.slug,
                  membership.planName,
                  membership.onboardingStatus,
                ]
                    .whereType<String>()
                    .where((value) => value.isNotEmpty)
                    .join(' - '),
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => state.selectTenant(membership),
            ),
          );
        },
      ),
    );
  }
}

Future<void> showChangePasswordDialog(BuildContext context) {
  final state = AppScope.of(context);
  final currentPassword = TextEditingController();
  final newPassword = TextEditingController();
  final formKey = GlobalKey<FormState>();
  String? error;

  return showDialog<void>(
    context: context,
    builder: (dialogContext) {
      return StatefulBuilder(
        builder: (context, setState) {
          return AlertDialog(
            title: const Text('Change password'),
            content: Form(
              key: formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (error != null) ErrorBanner(message: error!),
                  TextFormField(
                    controller: currentPassword,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Current password',
                    ),
                    validator: (value) => value == null || value.isEmpty
                        ? 'Current password is required'
                        : null,
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: newPassword,
                    obscureText: true,
                    decoration:
                        const InputDecoration(labelText: 'New password'),
                    validator: (value) => value == null || value.length < 8
                        ? 'Use at least 8 characters'
                        : null,
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () async {
                  if (!formKey.currentState!.validate()) return;
                  try {
                    await state.changePassword(
                      currentPassword.text,
                      newPassword.text,
                    );
                    if (dialogContext.mounted) Navigator.pop(dialogContext);
                  } catch (_) {
                    setState(() => error = state.error);
                  }
                },
                child: const Text('Save'),
              ),
            ],
          );
        },
      );
    },
  ).whenComplete(() {
    currentPassword.dispose();
    newPassword.dispose();
  });
}

class PlatformShell extends StatelessWidget {
  const PlatformShell({required this.route, super.key});

  final String route;

  @override
  Widget build(BuildContext context) {
    return ShellScaffold(
      title: 'TGManager',
      subtitle: 'Platform',
      navItems: platformNav,
      selectedRoute: route,
      child: screenForRoute(route, platformScreens),
    );
  }
}

class CompanyShell extends StatelessWidget {
  const CompanyShell({required this.route, super.key});

  final String route;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    return ShellScaffold(
      title: state.tenant?.name ?? 'Company',
      subtitle: 'Workspace',
      navItems: companyNav,
      selectedRoute: route,
      child: screenForRoute(route, companyScreens),
    );
  }
}

class ShellScaffold extends StatefulWidget {
  const ShellScaffold({
    required this.title,
    required this.subtitle,
    required this.navItems,
    required this.selectedRoute,
    required this.child,
    super.key,
  });

  final String title;
  final String subtitle;
  final List<NavEntry> navItems;
  final String selectedRoute;
  final Widget child;

  @override
  State<ShellScaffold> createState() => _ShellScaffoldState();
}

class _ShellScaffoldState extends State<ShellScaffold> {
  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 900;
    final state = AppScope.of(context);
    final drawer = AppDrawer(
      title: widget.title,
      subtitle: widget.subtitle,
      navItems: widget.navItems,
      selectedRoute: widget.selectedRoute,
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.subtitle.toUpperCase(),
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.2,
          ),
        ),
        automaticallyImplyLeading: !wide,
        actions: [
          IconButton(
            tooltip: 'Notifications',
            onPressed: () {},
            icon: const Icon(Icons.notifications_outlined),
          ),
          PopupMenuButton<String>(
            tooltip: 'Account',
            onSelected: (value) {
              if (value == 'password') showChangePasswordDialog(context);
              if (value == 'logout') state.logout();
            },
            itemBuilder: (context) => const [
              PopupMenuItem(value: 'password', child: Text('Change password')),
              PopupMenuItem(value: 'logout', child: Text('Logout')),
            ],
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: CircleAvatar(
                backgroundColor: _ink,
                foregroundColor: _acid,
                radius: 16,
                child: Text(state.user?.initials ?? '?'),
              ),
            ),
          ),
        ],
      ),
      drawer: wide ? null : Drawer(child: drawer),
      body: Row(
        children: [
          if (wide) SizedBox(width: 284, child: drawer),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(28, 18, 28, 32),
              children: [widget.child],
            ),
          ),
        ],
      ),
    );
  }
}

class AppDrawer extends StatelessWidget {
  const AppDrawer({
    required this.title,
    required this.subtitle,
    required this.navItems,
    required this.selectedRoute,
    super.key,
  });

  final String title;
  final String subtitle;
  final List<NavEntry> navItems;
  final String selectedRoute;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    return Container(
      color: _ink,
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 20, 18, 16),
              child: LogoRow(
                title: title,
                subtitle: subtitle,
                inverse: true,
              ),
            ),
            const Divider(height: 1, color: Color(0xff242424)),
            Expanded(
              child: ListView(
                padding:
                    const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
                children: [
                  for (final item in navItems)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: ListTile(
                        leading: Icon(item.icon),
                        title: Text(item.label),
                        selected: selectedRoute == item.route,
                        iconColor: const Color(0xffdedbd2),
                        textColor: const Color(0xffdedbd2),
                        selectedColor: _ink,
                        selectedTileColor: _acid,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                        onTap: () {
                          Navigator.maybePop(context);
                          state.go(item.route);
                        },
                      ),
                    ),
                ],
              ),
            ),
            if (state.user != null)
              Container(
                margin: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xff171717),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xff2a2a2a)),
                ),
                child: ListTile(
                  leading: CircleAvatar(
                    backgroundColor: _acid,
                    foregroundColor: _ink,
                    child: Text(state.user!.initials),
                  ),
                  title: Text(
                    state.user!.fullName,
                    style: const TextStyle(color: _surface),
                  ),
                  subtitle: Text(
                    state.user!.email,
                    style: const TextStyle(color: Color(0xffaaa69b)),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

Widget screenForRoute(String route, Map<String, Widget Function()> screens) {
  return (screens[route] ?? screens.values.first).call();
}

final platformNav = [
  const NavEntry('Dashboard', '/admin', Icons.dashboard_outlined),
  const NavEntry('Tenants', '/admin/tenants', Icons.apartment_outlined),
  const NavEntry('Plans', '/admin/plans', Icons.workspace_premium_outlined),
  const NavEntry('Users', '/admin/users', Icons.people_outline),
  const NavEntry('Settings', '/admin/settings', Icons.settings_outlined),
  const NavEntry(
    'Account requests',
    '/admin/account-requests',
    Icons.assignment_outlined,
  ),
];

final companyNav = [
  const NavEntry('Dashboard', '/app', Icons.dashboard_outlined),
  const NavEntry('Branches', '/app/branches', Icons.apartment_outlined),
  const NavEntry(
      'Departments', '/app/departments', Icons.account_tree_outlined),
  const NavEntry('Groups', '/app/groups', Icons.groups_outlined),
  const NavEntry('Staff', '/app/staff', Icons.people_outline),
  const NavEntry('Roles', '/app/roles', Icons.security_outlined),
  const NavEntry('Schedules', '/app/schedules', Icons.calendar_month_outlined),
  const NavEntry('Attendance', '/app/attendance', Icons.fact_check_outlined),
  const NavEntry('Chat', '/app/chat', Icons.chat_bubble_outline),
  const NavEntry('Documents', '/app/documents', Icons.description_outlined),
  const NavEntry('Memos', '/app/memos', Icons.note_alt_outlined),
  const NavEntry('Inventory', '/app/inventory', Icons.inventory_2_outlined),
  const NavEntry('Forms', '/app/forms', Icons.dynamic_form_outlined),
  const NavEntry('Tickets', '/app/customer-tickets', Icons.support_agent),
  const NavEntry('Workflows', '/app/workflows', Icons.task_alt_outlined),
  const NavEntry('Reports', '/app/reports', Icons.bar_chart_outlined),
  const NavEntry('Weekly reports', '/app/weekly-reports', Icons.event_note),
  const NavEntry('Audit', '/app/audit', Icons.manage_search_outlined),
  const NavEntry('Integrations', '/app/integrations', Icons.hub_outlined),
  const NavEntry('Settings', '/app/settings', Icons.settings_outlined),
];

const branchFields = [
  FormFieldSpec(key: 'name', label: 'Name', required: true),
  FormFieldSpec(key: 'address', label: 'Address', required: true),
  FormFieldSpec(
      key: 'latitude', label: 'Latitude', required: true, number: true),
  FormFieldSpec(
      key: 'longitude', label: 'Longitude', required: true, number: true),
  FormFieldSpec(key: 'radiusMeters', label: 'Radius meters', number: true),
  FormFieldSpec(key: 'phoneNumber', label: 'Phone number'),
  FormFieldSpec(key: 'openingTime', label: 'Opening time'),
  FormFieldSpec(key: 'closingTime', label: 'Closing time'),
  FormFieldSpec(key: 'timezone', label: 'Timezone'),
];

const namedFields = [
  FormFieldSpec(key: 'name', label: 'Name', required: true),
];

const descriptiveNamedFields = [
  FormFieldSpec(key: 'name', label: 'Name', required: true),
  FormFieldSpec(key: 'description', label: 'Description', multiline: true),
];

const branchScopedNamedFields = [
  FormFieldSpec(key: 'branchId', label: 'Branch ID', required: true),
  FormFieldSpec(key: 'name', label: 'Name', required: true),
];

const groupFields = [
  FormFieldSpec(key: 'branchId', label: 'Branch ID', required: true),
  FormFieldSpec(key: 'name', label: 'Name', required: true),
  FormFieldSpec(key: 'description', label: 'Description', multiline: true),
];

const roleFields = [
  FormFieldSpec(key: 'name', label: 'Name', required: true),
  FormFieldSpec(key: 'description', label: 'Description', multiline: true),
  FormFieldSpec(key: 'branchId', label: 'Branch ID'),
];

const inventoryFields = [
  FormFieldSpec(key: 'branchId', label: 'Branch ID', required: true),
  FormFieldSpec(key: 'name', label: 'Name', required: true),
  FormFieldSpec(key: 'sku', label: 'SKU'),
  FormFieldSpec(key: 'quantity', label: 'Quantity', number: true),
  FormFieldSpec(key: 'unit', label: 'Unit'),
  FormFieldSpec(key: 'minQuantity', label: 'Minimum quantity', number: true),
  FormFieldSpec(key: 'location', label: 'Location'),
];

const memoFields = [
  FormFieldSpec(key: 'title', label: 'Title', required: true),
  FormFieldSpec(key: 'body', label: 'Body', required: true, multiline: true),
  FormFieldSpec(key: 'through', label: 'Through'),
  FormFieldSpec(key: 'branchId', label: 'Branch ID'),
];

const scheduleFields = [
  FormFieldSpec(key: 'scope', label: 'Scope', required: true),
  FormFieldSpec(key: 'branchId', label: 'Branch ID'),
  FormFieldSpec(key: 'departmentId', label: 'Department ID'),
  FormFieldSpec(key: 'staffRecordId', label: 'Staff record ID'),
  FormFieldSpec(
      key: 'resumptionTime', label: 'Resumption time', required: true),
  FormFieldSpec(key: 'closingTime', label: 'Closing time', required: true),
  FormFieldSpec(
      key: 'latePeriodMinutes', label: 'Late period minutes', number: true),
  FormFieldSpec(key: 'timezone', label: 'Timezone'),
];

const formBuilderFields = [
  FormFieldSpec(key: 'name', label: 'Name', required: true),
  FormFieldSpec(key: 'description', label: 'Description', multiline: true),
  FormFieldSpec(key: 'branchId', label: 'Branch ID'),
];

final platformScreens = <String, Widget Function()>{
  '/admin': () => const PlatformDashboardScreen(),
  '/admin/tenants': () => const DataListScreen(
        title: 'Tenants',
        endpoint: '/platform/tenants',
        icon: Icons.apartment_outlined,
      ),
  '/admin/plans': () => const DataListScreen(
        title: 'Plans',
        endpoint: '/platform/plans',
        icon: Icons.workspace_premium_outlined,
      ),
  '/admin/users': () => const DataListScreen(
        title: 'Users',
        endpoint: '/platform/users',
        icon: Icons.people_outline,
      ),
  '/admin/settings': () => const PlaceholderScreen(title: 'Platform settings'),
  '/admin/account-requests': () => const DataListScreen(
        title: 'Email change requests',
        endpoint: '/admin/account-requests/email-change',
        icon: Icons.assignment_outlined,
      ),
};

final companyScreens = <String, Widget Function()>{
  '/app': () => const CompanyDashboardScreen(),
  '/app/branches': () => const EditableListScreen(
        title: 'Branches',
        endpoint: '/branches',
        icon: Icons.apartment_outlined,
        fields: branchFields,
        createDefaults: {
          'workingDays': [1, 2, 3, 4, 5],
          'timezone': 'Africa/Lagos'
        },
      ),
  '/app/departments': () => const EditableListScreen(
        title: 'Departments',
        endpoint: '/departments',
        icon: Icons.account_tree_outlined,
        fields: branchScopedNamedFields,
        updateFields: namedFields,
      ),
  '/app/groups': () => const EditableListScreen(
        title: 'Groups',
        endpoint: '/groups',
        icon: Icons.groups_outlined,
        fields: groupFields,
        updateFields: descriptiveNamedFields,
      ),
  '/app/staff': () => const DataListScreen(
        title: 'Staff',
        endpoint: '/staff',
        icon: Icons.people_outline,
      ),
  '/app/roles': () => const EditableListScreen(
        title: 'Roles',
        endpoint: '/company-roles',
        icon: Icons.security_outlined,
        fields: roleFields,
        createDefaults: {'permissions': []},
        updateFields: descriptiveNamedFields,
      ),
  '/app/schedules': () => const EditableListScreen(
        title: 'Schedules',
        endpoint: '/schedules',
        icon: Icons.calendar_month_outlined,
        fields: scheduleFields,
        createDefaults: {
          'scope': 'BRANCH',
          'workingDays': [1, 2, 3, 4, 5],
          'timezone': 'Africa/Lagos'
        },
      ),
  '/app/attendance': () => const AttendanceScreen(),
  '/app/chat': () => const PlaceholderScreen(title: 'Chat'),
  '/app/documents': () => const DataListScreen(
        title: 'Documents',
        endpoint: '/documents',
        icon: Icons.description_outlined,
      ),
  '/app/memos': () => const EditableListScreen(
        title: 'Memos',
        endpoint: '/memos',
        icon: Icons.note_alt_outlined,
        fields: memoFields,
        createDefaults: {
          'audience': {'all': true}
        },
      ),
  '/app/inventory': () => const EditableListScreen(
        title: 'Inventory',
        endpoint: '/inventory',
        icon: Icons.inventory_2_outlined,
        fields: inventoryFields,
        updateFields: [
          FormFieldSpec(key: 'name', label: 'Name', required: true),
          FormFieldSpec(key: 'sku', label: 'SKU'),
          FormFieldSpec(key: 'unit', label: 'Unit'),
          FormFieldSpec(
              key: 'minQuantity', label: 'Minimum quantity', number: true),
          FormFieldSpec(key: 'location', label: 'Location'),
        ],
      ),
  '/app/forms': () => const EditableListScreen(
        title: 'Forms',
        endpoint: '/forms',
        icon: Icons.dynamic_form_outlined,
        fields: formBuilderFields,
        createDefaults: {'fields': []},
      ),
  '/app/customer-tickets': () => const DataListScreen(
        title: 'Customer tickets',
        endpoint: '/chat/conversations',
        icon: Icons.support_agent,
      ),
  '/app/workflows': () => const DataListScreen(
        title: 'Workflows',
        endpoint: '/workflows/templates',
        icon: Icons.task_alt_outlined,
      ),
  '/app/reports': () => const ReportsScreen(),
  '/app/weekly-reports': () => const DataListScreen(
        title: 'Weekly reports',
        endpoint: '/weekly-reports',
        icon: Icons.event_note,
      ),
  '/app/audit': () => const DataListScreen(
        title: 'Audit logs',
        endpoint: '/audit',
        icon: Icons.manage_search_outlined,
      ),
  '/app/integrations': () => const DataListScreen(
        title: 'API keys',
        endpoint: '/integrations/api-keys',
        icon: Icons.hub_outlined,
      ),
  '/app/settings': () => const DataObjectScreen(
        title: 'Company settings',
        endpoint: '/settings',
        icon: Icons.settings_outlined,
      ),
  '/app/account/change-email': () =>
      const PlaceholderScreen(title: 'Change email'),
  '/app/account/requests': () => const DataListScreen(
        title: 'My requests',
        endpoint: '/account/requests',
        icon: Icons.history,
      ),
};

class NavEntry {
  const NavEntry(this.label, this.route, this.icon);

  final String label;
  final String route;
  final IconData icon;
}

class PlatformDashboardScreen extends StatelessWidget {
  const PlatformDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const DashboardGrid(
      title: 'Platform Dashboard',
      subtitle: 'Manage tenants, plans, users, and account requests.',
      cards: [
        MetricCard(label: 'Tenants', value: 'Live', icon: Icons.apartment),
        MetricCard(
            label: 'Plans', value: 'Active', icon: Icons.workspace_premium),
        MetricCard(label: 'Users', value: 'Managed', icon: Icons.people),
        MetricCard(label: 'Requests', value: 'Review', icon: Icons.assignment),
      ],
    );
  }
}

class CompanyDashboardScreen extends StatelessWidget {
  const CompanyDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final tenant = state.tenant;
    return DashboardGrid(
      title: '${tenant?.name ?? 'Company'} Dashboard',
      subtitle: 'A quick pulse on your organisation.',
      cards: [
        const MetricCard(
            label: 'Branches', value: 'Open', icon: Icons.apartment),
        const MetricCard(label: 'Staff', value: 'Active', icon: Icons.people),
        const MetricCard(
            label: 'Reports', value: 'Weekly', icon: Icons.event_note),
        MetricCard(
          label: 'Plan',
          value: tenant?.planName ?? 'Current',
          icon: Icons.workspace_premium,
        ),
      ],
      footer: tenant?.onboardingStatus != null &&
              tenant!.onboardingStatus != 'COMPLETED'
          ? InfoPanel(
              title: 'Onboarding',
              message: 'Current stage: ${tenant.onboardingStatus}',
            )
          : null,
    );
  }
}

class DashboardGrid extends StatelessWidget {
  const DashboardGrid({
    required this.title,
    required this.subtitle,
    required this.cards,
    this.footer,
    super.key,
  });

  final String title;
  final String subtitle;
  final List<MetricCard> cards;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final state = AppScope.of(context);
    final user = state.user;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Welcome Header & Quick Action
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: _accentWarmMuted,
                  child: Text(
                    user?.initials ?? 'TG',
                    style: const TextStyle(color: _acid, fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                ),
                const SizedBox(width: 14),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Welcome back,', style: TextStyle(color: _muted, fontSize: 13, fontWeight: FontWeight.w500)),
                    Text(
                      user?.fullName ?? 'Manager',
                      style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 20, fontWeight: FontWeight.w800),
                    ),
                  ],
                ),
              ],
            ),
            IconButton(
              onPressed: () {},
              icon: const Icon(Icons.notifications_none_rounded, color: _coal),
              tooltip: 'Notifications',
            ),
          ],
        ),
        const SizedBox(height: 24),

        // Hero Highlight Banner (Matches "My Project - Modern Living Room" card from reference design)
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            color: _accentWarmMuted,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: _acid.withValues(alpha: 0.2)),
            boxShadow: const [
              BoxShadow(
                color: Color(0x33000000),
                blurRadius: 20,
                offset: Offset(0, 8),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Active Workspace', style: TextStyle(color: _acid, fontSize: 12, fontWeight: FontWeight.w700)),
                    const SizedBox(height: 4),
                    Text(
                      state.tenant?.name ?? 'Main Headquarters',
                      style: const TextStyle(color: _coal, fontSize: 22, fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: _surfaceElevated,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Text('12 Active Teams', style: TextStyle(color: _muted, fontSize: 11, fontWeight: FontWeight.w600)),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Container(
                width: 44,
                height: 44,
                decoration: const BoxDecoration(
                  color: _acid,
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.arrow_forward_rounded, color: _ink, size: 22),
              ),
            ],
          ),
        ),
        const SizedBox(height: 28),

        // "My Spaces" / Core Categories Section
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'My Spaces',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 18, fontWeight: FontWeight.w800),
            ),
            const Text('See All', style: TextStyle(color: _muted, fontSize: 13, fontWeight: FontWeight.w600)),
          ],
        ),
        const SizedBox(height: 14),
        LayoutBuilder(
          builder: (context, constraints) {
            final width = constraints.maxWidth;
            final columns = width >= 1100 ? 4 : width >= 600 ? 4 : 2;
            return GridView.count(
              crossAxisCount: columns,
              crossAxisSpacing: 14,
              mainAxisSpacing: 14,
              childAspectRatio: 1.3,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              children: const [
                _CategoryCard(icon: Icons.meeting_room_outlined, label: 'Main Office', sub: 'Active'),
                _CategoryCard(icon: Icons.inventory_2_outlined, label: 'Warehouse', sub: 'Stocked'),
                _CategoryCard(icon: Icons.people_outline, label: 'Staff Hub', sub: '24 Members'),
                _CategoryCard(icon: Icons.add_rounded, label: 'Add Space', sub: 'Create new', isAdd: true),
              ],
            );
          },
        ),
        const SizedBox(height: 28),

        // Quick Metrics Section
        Text(
          'Quick Metrics',
          style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 18, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 14),
        LayoutBuilder(
          builder: (context, constraints) {
            final width = constraints.maxWidth;
            final columns = width >= 1100 ? 4 : width >= 720 ? 2 : 1;
            return GridView.count(
              crossAxisCount: columns,
              crossAxisSpacing: 14,
              mainAxisSpacing: 14,
              childAspectRatio: 2.6,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              children: cards,
            );
          },
        ),
        if (footer != null) ...[
          const SizedBox(height: 24),
          footer!,
        ],
      ],
    );
  }
}

class _CategoryCard extends StatelessWidget {
  const _CategoryCard({
    required this.icon,
    required this.label,
    required this.sub,
    this.isAdd = false,
  });

  final IconData icon;
  final String label;
  final String sub;
  final bool isAdd;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isAdd ? Colors.transparent : _surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isAdd ? _line : _line,
          style: isAdd ? BorderStyle.solid : BorderStyle.solid,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: isAdd ? _surfaceElevated : _accentWarmMuted,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(icon, color: isAdd ? _muted : _acid, size: 20),
          ),
          const SizedBox(height: 12),
          Text(
            label,
            style: const TextStyle(color: _coal, fontSize: 14, fontWeight: FontWeight.w700),
          ),
          Text(
            sub,
            style: const TextStyle(color: _muted, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class MetricCard extends StatelessWidget {
  const MetricCard({
    required this.label,
    required this.value,
    required this.icon,
    super.key,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: _accentWarmMuted,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _acid.withValues(alpha: 0.2)),
              ),
              child: Icon(icon, color: _acid, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    label.toUpperCase(),
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: _muted,
                          letterSpacing: 0.8,
                        ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    value,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: _coal,
                        ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class DataListScreen extends StatefulWidget {
  const DataListScreen({
    required this.title,
    required this.endpoint,
    required this.icon,
    super.key,
  });

  final String title;
  final String endpoint;
  final IconData icon;

  @override
  State<DataListScreen> createState() => _DataListScreenState();
}

class _DataListScreenState extends State<DataListScreen> {
  late Future<List<dynamic>> future;

  @override
  void initState() {
    super.initState();
    future = _load();
  }

  Future<List<dynamic>> _load() async {
    final state = AppScope.of(context);
    final data = await state.api.getJson(widget.endpoint);
    if (data is List) return data;
    if (data is! Map<String, dynamic>) return const [];
    final items = data['items'];
    if (items is List) return items;
    final values = data.values.whereType<List>().toList();
    if (values.isNotEmpty) return values.first;
    return const [];
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<dynamic>>(
      future: future,
      builder: (context, snapshot) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            PageHeader(
              title: widget.title,
              subtitle: 'Flutter view connected to ${widget.endpoint}.',
              action: IconButton(
                tooltip: 'Refresh',
                onPressed: () => setState(() => future = _load()),
                icon: const Icon(Icons.refresh),
              ),
            ),
            const SizedBox(height: 16),
            if (snapshot.connectionState == ConnectionState.waiting)
              const Center(child: CircularProgressIndicator())
            else if (snapshot.hasError)
              ErrorBanner(message: apiErrorMessage(snapshot.error!))
            else
              ItemsCard(
                icon: widget.icon,
                items: snapshot.data ?? const [],
              ),
          ],
        );
      },
    );
  }
}

class EditableListScreen extends StatefulWidget {
  const EditableListScreen({
    required this.title,
    required this.endpoint,
    required this.icon,
    required this.fields,
    this.createDefaults = const {},
    this.updateFields,
    super.key,
  });

  final String title;
  final String endpoint;
  final IconData icon;
  final List<FormFieldSpec> fields;
  final Map<String, dynamic> createDefaults;
  final List<FormFieldSpec>? updateFields;

  @override
  State<EditableListScreen> createState() => _EditableListScreenState();
}

class _EditableListScreenState extends State<EditableListScreen> {
  late Future<List<dynamic>> future;

  @override
  void initState() {
    super.initState();
    future = _load();
  }

  Future<List<dynamic>> _load() async {
    final state = AppScope.of(context);
    final data = await state.api.getJson(widget.endpoint);
    if (data is List) return data;
    if (data is! Map<String, dynamic>) return const [];
    final items = data['items'];
    if (items is List) return items;
    final values = data.values.whereType<List>().toList();
    if (values.isNotEmpty) return values.first;
    return const [];
  }

  void _refresh() {
    setState(() => future = _load());
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<dynamic>>(
      future: future,
      builder: (context, snapshot) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            PageHeader(
              title: widget.title,
              subtitle:
                  'Create, update, and review records from ${widget.endpoint}.',
              action: Wrap(
                spacing: 8,
                children: [
                  IconButton(
                    tooltip: 'Refresh',
                    onPressed: _refresh,
                    icon: const Icon(Icons.refresh),
                  ),
                  FilledButton.icon(
                    onPressed: () => _openEditor(),
                    icon: const Icon(Icons.add),
                    label: const Text('New'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (snapshot.connectionState == ConnectionState.waiting)
              const Center(child: CircularProgressIndicator())
            else if (snapshot.hasError)
              ErrorBanner(message: apiErrorMessage(snapshot.error!))
            else
              EditableItemsCard(
                icon: widget.icon,
                items: snapshot.data ?? const [],
                onEdit: (item) => _openEditor(item: item),
                onDelete: (item) => _delete(item),
              ),
          ],
        );
      },
    );
  }

  Future<void> _openEditor({Map<String, dynamic>? item}) async {
    final saved = await showRecordEditor(
      context: context,
      title: item == null ? 'New ${widget.title}' : 'Edit ${widget.title}',
      fields:
          item == null ? widget.fields : widget.updateFields ?? widget.fields,
      initial: item,
      defaults: item == null ? widget.createDefaults : const {},
      onSave: (body) async {
        final state = AppScope.of(context);
        if (item == null) {
          await state.api.postJson(widget.endpoint, body);
        } else {
          final id = item['id']?.toString();
          if (id == null || id.isEmpty) {
            throw ApiException(statusCode: 0, message: 'Record id is missing');
          }
          await state.api.patchJson('${widget.endpoint}/$id', body);
        }
      },
    );
    if (saved == true) _refresh();
  }

  Future<void> _delete(Map<String, dynamic> item) async {
    final id = item['id']?.toString();
    if (id == null || id.isEmpty) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete record'),
        content: Text('Delete ${itemLabel(item)}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    if (!mounted) return;
    final state = AppScope.of(context);
    try {
      await state.api.deleteJson('${widget.endpoint}/$id');
      _refresh();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(apiErrorMessage(e))),
      );
    }
  }
}

class FormFieldSpec {
  const FormFieldSpec({
    required this.key,
    required this.label,
    this.required = false,
    this.number = false,
    this.multiline = false,
  });

  final String key;
  final String label;
  final bool required;
  final bool number;
  final bool multiline;
}

Future<bool?> showRecordEditor({
  required BuildContext context,
  required String title,
  required List<FormFieldSpec> fields,
  required Map<String, dynamic> defaults,
  required Future<void> Function(Map<String, dynamic> body) onSave,
  Map<String, dynamic>? initial,
}) {
  final formKey = GlobalKey<FormState>();
  final controllers = {
    for (final field in fields)
      field.key: TextEditingController(
        text: initial?[field.key]?.toString() ??
            defaults[field.key]?.toString() ??
            '',
      ),
  };
  String? error;

  return showDialog<bool>(
    context: context,
    builder: (dialogContext) {
      return StatefulBuilder(
        builder: (context, setState) {
          return AlertDialog(
            title: Text(title),
            content: SizedBox(
              width: 460,
              child: Form(
                key: formKey,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (error != null) ErrorBanner(message: error!),
                      for (final field in fields) ...[
                        TextFormField(
                          controller: controllers[field.key],
                          keyboardType: field.number
                              ? const TextInputType.numberWithOptions(
                                  decimal: true)
                              : TextInputType.text,
                          minLines: field.multiline ? 3 : 1,
                          maxLines: field.multiline ? 6 : 1,
                          decoration: InputDecoration(labelText: field.label),
                          validator: (value) {
                            if (field.required &&
                                (value == null || value.trim().isEmpty)) {
                              return '${field.label} is required';
                            }
                            if (field.number &&
                                value != null &&
                                value.trim().isNotEmpty &&
                                num.tryParse(value.trim()) == null) {
                              return '${field.label} must be a number';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 14),
                      ],
                    ],
                  ),
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () async {
                  if (!formKey.currentState!.validate()) return;
                  final body = <String, dynamic>{...defaults};
                  for (final field in fields) {
                    final raw = controllers[field.key]!.text.trim();
                    if (raw.isEmpty) continue;
                    body[field.key] = field.number ? num.parse(raw) : raw;
                  }
                  try {
                    await onSave(body);
                    if (dialogContext.mounted) {
                      Navigator.pop(dialogContext, true);
                    }
                  } catch (e) {
                    setState(() => error = apiErrorMessage(e));
                  }
                },
                child: const Text('Save'),
              ),
            ],
          );
        },
      );
    },
  ).whenComplete(() {
    for (final controller in controllers.values) {
      controller.dispose();
    }
  });
}

class DataObjectScreen extends StatefulWidget {
  const DataObjectScreen({
    required this.title,
    required this.endpoint,
    required this.icon,
    super.key,
  });

  final String title;
  final String endpoint;
  final IconData icon;

  @override
  State<DataObjectScreen> createState() => _DataObjectScreenState();
}

class _DataObjectScreenState extends State<DataObjectScreen> {
  late Future<Map<String, dynamic>> future;

  @override
  void initState() {
    super.initState();
    future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final state = AppScope.of(context);
    final data = await state.api.getJson(widget.endpoint);
    return data is Map<String, dynamic> ? data : <String, dynamic>{};
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: future,
      builder: (context, snapshot) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            PageHeader(
              title: widget.title,
              subtitle: 'Flutter view connected to ${widget.endpoint}.',
              action: IconButton(
                tooltip: 'Refresh',
                onPressed: () => setState(() => future = _load()),
                icon: const Icon(Icons.refresh),
              ),
            ),
            const SizedBox(height: 16),
            if (snapshot.connectionState == ConnectionState.waiting)
              const Center(child: CircularProgressIndicator())
            else if (snapshot.hasError)
              ErrorBanner(message: apiErrorMessage(snapshot.error!))
            else
              ObjectCard(icon: widget.icon, data: snapshot.data ?? const {}),
          ],
        );
      },
    );
  }
}

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  late Future<AttendanceViewData> future;

  @override
  void initState() {
    super.initState();
    future = _load();
  }

  Future<AttendanceViewData> _load() async {
    final state = AppScope.of(context);
    final summaryData = await state.api.getJson('/attendance/summary');
    final recordsData = await state.api.getJson('/attendance');
    return AttendanceViewData(
      summary: summaryData is Map<String, dynamic> ? summaryData : const {},
      records: recordsData is List ? recordsData : const [],
    );
  }

  void _refresh() {
    setState(() => future = _load());
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<AttendanceViewData>(
      future: future,
      builder: (context, snapshot) {
        final data = snapshot.data;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            PageHeader(
              title: 'Attendance',
              subtitle: 'Clock in, clock out, and review attendance records.',
              action: Wrap(
                spacing: 8,
                children: [
                  IconButton(
                    tooltip: 'Refresh',
                    onPressed: _refresh,
                    icon: const Icon(Icons.refresh),
                  ),
                  FilledButton.icon(
                    onPressed: () => _openClockDialog(clockIn: true),
                    icon: const Icon(Icons.login),
                    label: const Text('Clock in'),
                  ),
                  OutlinedButton.icon(
                    onPressed: () => _openClockDialog(clockIn: false),
                    icon: const Icon(Icons.logout),
                    label: const Text('Clock out'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            if (snapshot.connectionState == ConnectionState.waiting)
              const Center(child: CircularProgressIndicator())
            else if (snapshot.hasError)
              ErrorBanner(message: apiErrorMessage(snapshot.error!))
            else ...[
              AttendanceSummaryCard(summary: data?.summary ?? const {}),
              const SizedBox(height: 16),
              ItemsCard(
                icon: Icons.fact_check_outlined,
                items: data?.records ?? const [],
              ),
            ],
          ],
        );
      },
    );
  }

  Future<void> _openClockDialog({required bool clockIn}) async {
    final saved = await showClockDialog(context: context, clockIn: clockIn);
    if (saved == true) _refresh();
  }
}

class AttendanceViewData {
  const AttendanceViewData({required this.summary, required this.records});

  final Map<String, dynamic> summary;
  final List<dynamic> records;
}

class AttendanceSummaryCard extends StatelessWidget {
  const AttendanceSummaryCard({required this.summary, super.key});

  final Map<String, dynamic> summary;

  @override
  Widget build(BuildContext context) {
    final total = summary['total'] ?? summary['totalRecords'] ?? 0;
    final present = summary['present'] ?? summary['presentDays'] ?? 0;
    final byStatus = summary['byStatus'];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Summary', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                SummaryChip(label: 'Total', value: total.toString()),
                SummaryChip(label: 'Present', value: present.toString()),
                if (byStatus is Map)
                  for (final entry in byStatus.entries.take(6))
                    SummaryChip(
                      label: entry.key.toString(),
                      value: entry.value.toString(),
                    ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

Future<bool?> showClockDialog({
  required BuildContext context,
  required bool clockIn,
}) {
  final state = AppScope.of(context);
  final latitude = TextEditingController();
  final longitude = TextEditingController();
  final staffRecordId = TextEditingController();
  final note = TextEditingController();
  final formKey = GlobalKey<FormState>();
  String? error;

  return showDialog<bool>(
    context: context,
    builder: (dialogContext) {
      return StatefulBuilder(
        builder: (context, setState) {
          return AlertDialog(
            title: Text(clockIn ? 'Clock in' : 'Clock out'),
            content: Form(
              key: formKey,
              child: SizedBox(
                width: 420,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (error != null) ErrorBanner(message: error!),
                    TextFormField(
                      controller: latitude,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Latitude'),
                      validator: (value) =>
                          num.tryParse((value ?? '').trim()) == null
                              ? 'Latitude is required'
                              : null,
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: longitude,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Longitude'),
                      validator: (value) =>
                          num.tryParse((value ?? '').trim()) == null
                              ? 'Longitude is required'
                              : null,
                    ),
                    if (clockIn) ...[
                      const SizedBox(height: 14),
                      TextFormField(
                        controller: staffRecordId,
                        decoration:
                            const InputDecoration(labelText: 'Staff record ID'),
                      ),
                    ],
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: note,
                      minLines: 2,
                      maxLines: 4,
                      decoration: const InputDecoration(labelText: 'Note'),
                    ),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () async {
                  if (!formKey.currentState!.validate()) return;
                  final body = <String, dynamic>{
                    'latitude': num.parse(latitude.text.trim()),
                    'longitude': num.parse(longitude.text.trim()),
                    if (note.text.trim().isNotEmpty) 'note': note.text.trim(),
                    if (clockIn && staffRecordId.text.trim().isNotEmpty)
                      'staffRecordId': staffRecordId.text.trim(),
                  };
                  try {
                    await state.api.postJson(
                      clockIn
                          ? '/attendance/clock-in'
                          : '/attendance/clock-out',
                      body,
                    );
                    if (dialogContext.mounted) {
                      Navigator.pop(dialogContext, true);
                    }
                  } catch (e) {
                    setState(() => error = apiErrorMessage(e));
                  }
                },
                child: Text(clockIn ? 'Clock in' : 'Clock out'),
              ),
            ],
          );
        },
      );
    },
  ).whenComplete(() {
    latitude.dispose();
    longitude.dispose();
    staffRecordId.dispose();
    note.dispose();
  });
}

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  late Future<ReportsViewData> future;

  @override
  void initState() {
    super.initState();
    future = _load();
  }

  Future<ReportsViewData> _load() async {
    final state = AppScope.of(context);
    final attendance = await state.api.getJson('/reports/attendance');
    final staff = await state.api.getJson('/reports/staff');
    final inventory = await state.api.getJson('/reports/inventory');
    return ReportsViewData(
      attendance: attendance is Map<String, dynamic> ? attendance : const {},
      staff: staff is Map<String, dynamic> ? staff : const {},
      inventory: inventory is Map<String, dynamic> ? inventory : const {},
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<ReportsViewData>(
      future: future,
      builder: (context, snapshot) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            PageHeader(
              title: 'Reports',
              subtitle:
                  'Attendance, staff, and inventory summaries from the reporting API.',
              action: IconButton(
                tooltip: 'Refresh',
                onPressed: () => setState(() => future = _load()),
                icon: const Icon(Icons.refresh),
              ),
            ),
            const SizedBox(height: 16),
            if (snapshot.connectionState == ConnectionState.waiting)
              const Center(child: CircularProgressIndicator())
            else if (snapshot.hasError)
              ErrorBanner(message: apiErrorMessage(snapshot.error!))
            else
              ReportsGrid(data: snapshot.data!),
          ],
        );
      },
    );
  }
}

class ReportsViewData {
  const ReportsViewData({
    required this.attendance,
    required this.staff,
    required this.inventory,
  });

  final Map<String, dynamic> attendance;
  final Map<String, dynamic> staff;
  final Map<String, dynamic> inventory;
}

class ReportsGrid extends StatelessWidget {
  const ReportsGrid({required this.data, super.key});

  final ReportsViewData data;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final columns = constraints.maxWidth >= 1000
            ? 3
            : constraints.maxWidth >= 680
                ? 2
                : 1;
        return GridView.count(
          crossAxisCount: columns,
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
          childAspectRatio: 1.5,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          children: [
            ReportCard(
              title: 'Attendance',
              icon: Icons.fact_check_outlined,
              summary: data.attendance['summary'],
            ),
            ReportCard(
              title: 'Staff',
              icon: Icons.people_outline,
              summary: data.staff['summary'],
            ),
            ReportCard(
              title: 'Inventory',
              icon: Icons.inventory_2_outlined,
              summary: data.inventory['summary'],
            ),
          ],
        );
      },
    );
  }
}

class ReportCard extends StatelessWidget {
  const ReportCard({
    required this.title,
    required this.icon,
    required this.summary,
    super.key,
  });

  final String title;
  final IconData icon;
  final dynamic summary;

  @override
  Widget build(BuildContext context) {
    final values =
        summary is Map ? (summary as Map).entries.take(6).toList() : const [];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: Theme.of(context).colorScheme.primary),
                const SizedBox(width: 10),
                Text(title, style: Theme.of(context).textTheme.titleMedium),
              ],
            ),
            const SizedBox(height: 14),
            if (values.isEmpty)
              const Text('No report data available.')
            else
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final entry in values)
                    SummaryChip(
                      label: entry.key.toString(),
                      value: _compactValue(entry.value),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  String _compactValue(dynamic value) {
    if (value is Map) return value.length.toString();
    if (value is num) return value.toString();
    return value?.toString() ?? '0';
  }
}

class SummaryChip extends StatelessWidget {
  const SummaryChip({required this.label, required this.value, super.key});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Chip(
      label: Text('$label: $value'),
      backgroundColor: _acid,
      side: const BorderSide(color: _ink),
    );
  }
}

class ObjectCard extends StatelessWidget {
  const ObjectCard({required this.icon, required this.data, super.key});

  final IconData icon;
  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final entries = data.entries
        .where((entry) => entry.value == null || entry.value is! Map)
        .take(12)
        .toList();
    if (entries.isEmpty) {
      return const InfoPanel(
        title: 'No details',
        message: 'Nothing to show yet.',
      );
    }
    return Card(
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: entries.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, index) {
          final entry = entries[index];
          return ListTile(
            leading: Icon(icon),
            title: Text(_titleCase(entry.key)),
            subtitle: Text(entry.value?.toString() ?? 'Not set'),
          );
        },
      ),
    );
  }

  String _titleCase(String input) {
    return input
        .replaceAllMapped(RegExp(r'([A-Z])'), (match) => ' ${match.group(1)}')
        .replaceAll('_', ' ')
        .trim();
  }
}

class EditableItemsCard extends StatelessWidget {
  const EditableItemsCard({
    required this.icon,
    required this.items,
    required this.onEdit,
    required this.onDelete,
    super.key,
  });

  final IconData icon;
  final List<dynamic> items;
  final void Function(Map<String, dynamic> item) onEdit;
  final void Function(Map<String, dynamic> item) onDelete;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const InfoPanel(
          title: 'No records', message: 'Nothing to show yet.');
    }
    return Card(
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: items.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, index) {
          final item = items[index];
          final map = item is Map<String, dynamic> ? item : <String, dynamic>{};
          return ListTile(
            leading: Icon(icon),
            title: Text(itemLabel(map)),
            subtitle: Text(itemSubtitle(map)),
            trailing: PopupMenuButton<String>(
              tooltip: 'Actions',
              onSelected: (value) {
                if (value == 'edit') onEdit(map);
                if (value == 'delete') onDelete(map);
              },
              itemBuilder: (context) => const [
                PopupMenuItem(value: 'edit', child: Text('Edit')),
                PopupMenuItem(value: 'delete', child: Text('Delete')),
              ],
            ),
          );
        },
      ),
    );
  }
}

String itemLabel(Map<String, dynamic> item) {
  for (final key in ['name', 'title', 'email', 'sku', 'code', 'id']) {
    final value = item[key];
    if (value != null && value.toString().isNotEmpty) return value.toString();
  }
  return 'Record';
}

String itemSubtitle(Map<String, dynamic> item) {
  final parts = <String>[];
  for (final key in ['status', 'slug', 'address', 'unit', 'createdAt']) {
    final value = item[key];
    if (value != null && value.toString().isNotEmpty) {
      parts.add(value.toString());
    }
    if (parts.length == 2) break;
  }
  return parts.isEmpty ? 'Tap actions to manage' : parts.join(' - ');
}

class ItemsCard extends StatelessWidget {
  const ItemsCard({required this.icon, required this.items, super.key});

  final IconData icon;
  final List<dynamic> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const InfoPanel(
          title: 'No records', message: 'Nothing to show yet.');
    }
    return Card(
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: items.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, index) {
          final item = items[index];
          final map = item is Map<String, dynamic> ? item : <String, dynamic>{};
          final title =
              _firstText(map, ['name', 'title', 'email', 'code', 'id']);
          final subtitle =
              _firstText(map, ['description', 'status', 'slug', 'createdAt']);
          return ListTile(
            leading: Icon(icon),
            title: Text(title ?? 'Record ${index + 1}'),
            subtitle: subtitle == null ? null : Text(subtitle),
          );
        },
      ),
    );
  }

  String? _firstText(Map<String, dynamic> map, List<String> keys) {
    for (final key in keys) {
      final value = map[key];
      if (value != null && value.toString().isNotEmpty) return value.toString();
    }
    return null;
  }
}

class PlaceholderScreen extends StatelessWidget {
  const PlaceholderScreen({required this.title, super.key});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        PageHeader(
          title: title,
          subtitle: 'This route has been moved into the Flutter shell.',
        ),
        const SizedBox(height: 16),
        const InfoPanel(
          title: 'Ready for feature migration',
          message:
              'The route, navigation, guards, and layout are in Flutter. The detailed form/table workflow can be filled in next.',
        ),
      ],
    );
  }
}

class PageHeader extends StatelessWidget {
  const PageHeader({
    required this.title,
    required this.subtitle,
    this.action,
    super.key,
  });

  final String title;
  final String subtitle;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(4, 0, 4, 8),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: _line)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: _muted,
                      ),
                ),
              ],
            ),
          ),
          if (action != null) action!,
        ],
      ),
    );
  }
}

class LogoRow extends StatelessWidget {
  const LogoRow({
    this.title = 'TGManager',
    this.subtitle = 'Workforce operations',
    this.inverse = false,
    super.key,
  });

  final String title;
  final String subtitle;
  final bool inverse;

  @override
  Widget build(BuildContext context) {
    final textColor = inverse ? _surface : _ink;
    final subColor = inverse ? const Color(0xffaaa69b) : _muted;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: inverse ? _acid : _ink,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            Icons.business_center,
            color: inverse ? _ink : _acid,
          ),
        ),
        const SizedBox(width: 12),
        Flexible(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: textColor,
                    ),
              ),
              Text(
                subtitle,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: subColor,
                    ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class ErrorBanner extends StatelessWidget {
  const ErrorBanner({required this.message, super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    return BannerBox(
      icon: Icons.error_outline,
      color: Theme.of(context).colorScheme.error,
      message: message,
    );
  }
}

class SuccessBanner extends StatelessWidget {
  const SuccessBanner({required this.message, super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    return BannerBox(
      icon: Icons.check_circle_outline,
      color: const Color(0xff059669),
      message: message,
    );
  }
}

class InfoPanel extends StatelessWidget {
  const InfoPanel({required this.title, required this.message, super.key});

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(
          children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: _acid,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: _ink),
              ),
              child: const Icon(Icons.info_outline, color: _ink, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title,
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 4),
                  Text(message),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class BannerBox extends StatelessWidget {
  const BannerBox({
    required this.icon,
    required this.color,
    required this.message,
    super.key,
  });

  final IconData icon;
  final Color color;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color == _mint || color == const Color(0xff059669)
            ? _acid
            : color.withValues(alpha: .08),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: color == _mint || color == const Color(0xff059669)
              ? _ink
              : color.withValues(alpha: .25),
        ),
      ),
      child: Row(
        children: [
          Icon(
            icon,
            color: color == _mint || color == const Color(0xff059669)
                ? _ink
                : color,
          ),
          const SizedBox(width: 10),
          Expanded(child: Text(message)),
        ],
      ),
    );
  }
}
