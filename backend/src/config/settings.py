import os
import re
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent.parent

load_dotenv(ROOT_DIR / ".env")
load_dotenv(BASE_DIR.parent / ".env")

# Directorio para backups externos (montado desde docker-compose)
BACKUP_DIR = '/app/backups'

# Seguridad básica
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "change-me")
DEBUG = os.getenv("DJANGO_DEBUG", "True").lower() == "true"

ALLOWED_HOSTS = [
    h.strip()
    for h in os.getenv("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost").split(",")
    if h.strip()
]

SAAS_ROOT_DOMAIN = os.getenv("SAAS_ROOT_DOMAIN", "localhost")
SAAS_PUBLIC_BASE_URL = os.getenv("SAAS_PUBLIC_BASE_URL", "http://localhost:5173")
SAAS_BILLING_SUCCESS_URL = os.getenv("SAAS_BILLING_SUCCESS_URL", "http://localhost:5173/admin/suscripcion?status=ok")
SAAS_BILLING_CANCEL_URL = os.getenv("SAAS_BILLING_CANCEL_URL", "http://localhost:5173/admin/suscripcion?status=cancel")

if SAAS_ROOT_DOMAIN == "localhost" and ".localhost" not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(".localhost")
elif SAAS_ROOT_DOMAIN and f".{SAAS_ROOT_DOMAIN}" not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(f".{SAAS_ROOT_DOMAIN}")

SHARED_APPS = [
    "django_tenants",
    "tenants",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
]

TENANT_APPS = [
    "core",
    "inventarios",
    "backup",
    "clientes",
    "ventas",
    "carrito",
    "predicciones",
    "reportes",
]

INSTALLED_APPS = SHARED_APPS + [app for app in TENANT_APPS if app not in SHARED_APPS]

MIDDLEWARE = [
    "django_tenants.middleware.main.TenantMainMiddleware",
    "tenants.middleware.DevTenantHeaderMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "tenants.middleware.TenantContextMiddleware",
    "corsheaders.middleware.CorsMiddleware",       # CORS lo más arriba posible
    "tenants.middleware.TenantAccessMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.tenant_urls"
PUBLIC_SCHEMA_URLCONF = "config.public_urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

# Base de datos PostgreSQL (configurada por variables de entorno)
DATABASES = {
    "default": {
        "ENGINE": "django_tenants.postgresql_backend",
        "NAME": os.getenv("POSTGRES_DB", "app_db"),
        "USER": os.getenv("POSTGRES_USER", "app_user"),
        "PASSWORD": os.getenv("POSTGRES_PASSWORD", "app_password"),
        "HOST": os.getenv("POSTGRES_HOST", "localhost"),
        "PORT": os.getenv("POSTGRES_PORT", "5432"),
    }
}

DATABASE_ROUTERS = ("django_tenants.routers.TenantSyncRouter",)
TENANT_MODEL = "tenants.Tenant"
TENANT_DOMAIN_MODEL = "tenants.Domain"
PG_EXTRA_SEARCH_PATHS = []
SHOW_PUBLIC_IF_NO_TENANT_FOUND = True

# Validación de contraseñas
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# Internacionalización
LANGUAGE_CODE = "es-es"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Archivos estáticos y media
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Configuración de correo electrónico
PASSWORD_RESET_TIMEOUT = int(os.getenv("DJANGO_PASSWORD_RESET_TIMEOUT", "900"))
EMAIL_BACKEND = os.getenv(
    "DJANGO_EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend",
)
DEFAULT_FROM_EMAIL = os.getenv("DJANGO_DEFAULT_FROM_EMAIL", "no-reply@saludplus.local")
FRONTEND_RESET_PASSWORD_URL = os.getenv(
    "FRONTEND_RESET_PASSWORD_URL",
    "http://localhost:5173/reset-password",
)
FRONTEND_VERIFY_EMAIL_URL = os.getenv(
    "FRONTEND_VERIFY_EMAIL_URL",
    "http://localhost:5173/verify-email",
)

# ============================================================
# CONFIGURACIÓN CORS COMPLETA
# ============================================================
# Orígenes permitidos (desde variable de entorno o valor por defecto)
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]

CORS_ALLOWED_ORIGIN_REGEXES = [
    pattern.strip()
    for pattern in os.getenv("CORS_ALLOWED_ORIGIN_REGEXES", "").split(",")
    if pattern.strip()
]

if SAAS_PUBLIC_BASE_URL and SAAS_PUBLIC_BASE_URL not in CORS_ALLOWED_ORIGINS:
    CORS_ALLOWED_ORIGINS.append(SAAS_PUBLIC_BASE_URL)

if SAAS_ROOT_DOMAIN:
    escaped_root = re.escape(SAAS_ROOT_DOMAIN)
    wildcard_pattern = rf"^https?://([a-zA-Z0-9-]+\.)*{escaped_root}$"
    if wildcard_pattern not in CORS_ALLOWED_ORIGIN_REGEXES:
        CORS_ALLOWED_ORIGIN_REGEXES.append(wildcard_pattern)

# Permitir credenciales
CORS_ALLOW_CREDENTIALS = True

# Headers permitidos
CORS_ALLOW_HEADERS = [
    "accept",
    "accept-encoding",
    "authorization",
    "content-type",
    "dnt",
    "origin",
    "user-agent",
    "x-csrftoken",
    "x-requested-with",
    "x-carrito-token",
    "x-tenant-subdomain",
]

# Métodos permitidos
CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
]

# En modo DEBUG, permitir todos los orígenes (útil para desarrollo)
if DEBUG:
    CORS_ALLOW_ALL_ORIGINS = True
    if '*' not in ALLOWED_HOSTS:
        ALLOWED_HOSTS.append('*')

# Orígenes confiables para CSRF (necesario si se usan cookies de sesión)
CSRF_TRUSTED_ORIGINS = ['http://localhost:5173']

if SAAS_PUBLIC_BASE_URL and SAAS_PUBLIC_BASE_URL not in CSRF_TRUSTED_ORIGINS:
    CSRF_TRUSTED_ORIGINS.append(SAAS_PUBLIC_BASE_URL)

if SAAS_ROOT_DOMAIN:
    http_wildcard = f"http://*.{SAAS_ROOT_DOMAIN}"
    https_wildcard = f"https://*.{SAAS_ROOT_DOMAIN}"
    if http_wildcard not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(http_wildcard)
    if https_wildcard not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(https_wildcard)
# ============================================================

# Configuración de cookies JWT
AUTH_ACCESS_COOKIE_NAME = os.getenv("AUTH_ACCESS_COOKIE_NAME", "access_token")
AUTH_REFRESH_COOKIE_NAME = os.getenv("AUTH_REFRESH_COOKIE_NAME", "refresh_token")
AUTH_ACCESS_COOKIE_AGE = int(os.getenv("AUTH_ACCESS_COOKIE_AGE", "900"))
AUTH_REFRESH_COOKIE_AGE = int(os.getenv("AUTH_REFRESH_COOKIE_AGE", "604800"))
AUTH_COOKIE_SECURE = os.getenv("AUTH_COOKIE_SECURE", "False").lower() == "true"
AUTH_COOKIE_SAMESITE = os.getenv("AUTH_COOKIE_SAMESITE", "Lax")

# Django REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "core.authentication.CookieOrHeaderJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.AllowAny",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 8,
}

# Simple JWT
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(seconds=AUTH_ACCESS_COOKIE_AGE),
    "REFRESH_TOKEN_LIFETIME": timedelta(seconds=AUTH_REFRESH_COOKIE_AGE),
    "ROTATE_REFRESH_TOKENS": False,
    "BLACKLIST_AFTER_ROTATION": False,
}

# Caché
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": os.getenv("DJANGO_CACHE_LOCATION", "saludplus-cache"),
    }
}

# Límites de tasa para autenticación
AUTH_RATE_LIMIT_WINDOW_SEC = int(os.getenv("AUTH_RATE_LIMIT_WINDOW_SEC", "60"))
AUTH_LOGIN_MAX_REQUESTS_PER_IP = int(os.getenv("AUTH_LOGIN_MAX_REQUESTS_PER_IP", "20"))
AUTH_REGISTER_MAX_REQUESTS_PER_IP = int(os.getenv("AUTH_REGISTER_MAX_REQUESTS_PER_IP", "10"))
AUTH_RESET_MAX_REQUESTS_PER_IP = int(os.getenv("AUTH_RESET_MAX_REQUESTS_PER_IP", "10"))

# Bloqueo progresivo en login
AUTH_LOGIN_LOCK_THRESHOLD = int(os.getenv("AUTH_LOGIN_LOCK_THRESHOLD", "5"))
AUTH_LOGIN_LOCK_BASE_SEC = int(os.getenv("AUTH_LOGIN_LOCK_BASE_SEC", "60"))
AUTH_LOGIN_LOCK_MAX_SEC = int(os.getenv("AUTH_LOGIN_LOCK_MAX_SEC", "900"))
AUTH_LOGIN_FAILURE_TTL_SEC = int(os.getenv("AUTH_LOGIN_FAILURE_TTL_SEC", "86400"))

# ============================================================
# STRIPE CONFIGURATION (modo pruebas)
# ============================================================
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_PUBLIC_KEY = os.getenv("STRIPE_PUBLIC_KEY", "")
STRIPE_CURRENCY = os.getenv("STRIPE_CURRENCY", "BOB")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")

# Gemini reports assistant
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_REPORTS_MODEL = os.getenv("GEMINI_REPORTS_MODEL", "gemini-3.1-flash-lite")
GEMINI_AUDIO_MODEL = os.getenv("GEMINI_AUDIO_MODEL", GEMINI_REPORTS_MODEL)


LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'DEBUG',
    },
}
