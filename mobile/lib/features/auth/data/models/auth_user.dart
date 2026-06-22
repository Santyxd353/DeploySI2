class AuthUser {
  const AuthUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
    required this.canAccessAdmin,
  });

  final int id;
  final String email;
  final String firstName;
  final String lastName;
  final String role;
  final bool canAccessAdmin;

  bool get isClientRole => role.toLowerCase() == 'cliente';
  bool get isRepartidorRole => role.toLowerCase() == 'repartidor';
  bool get canAccessMobileApp => isClientRole || isRepartidorRole;

  String get fullName {
    final joined = '$firstName $lastName'.trim();
    return joined.isEmpty ? email : joined;
  }

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: (json['id'] as num?)?.toInt() ?? 0,
      email: (json['email'] as String? ?? '').trim(),
      firstName: (json['first_name'] as String? ?? '').trim(),
      lastName: (json['last_name'] as String? ?? '').trim(),
      role: (json['role'] as String? ?? '').trim(),
      canAccessAdmin: json['can_access_admin'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'first_name': firstName,
      'last_name': lastName,
      'role': role,
      'can_access_admin': canAccessAdmin,
    };
  }
}

class AuthSession {
  const AuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.user,
  });

  final String accessToken;
  final String refreshToken;
  final AuthUser user;
}
