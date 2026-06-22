from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


def _tenant_suffix_from_request(request):
    tenant = getattr(request, "tenant", None)
    schema_name = getattr(tenant, "schema_name", "")
    if schema_name and schema_name != "public":
        return schema_name
    return ""


def get_tenant_cookie_name(base_cookie_name, request):
    suffix = _tenant_suffix_from_request(request)
    if not suffix:
        return base_cookie_name
    return f"{base_cookie_name}_{suffix}"


class CookieOrHeaderJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
            if raw_token is not None:
                validated_token = self.get_validated_token(raw_token)
                return self.get_user(validated_token), validated_token

        cookie_name = getattr(settings, "AUTH_ACCESS_COOKIE_NAME", "access_token")
        tenant_cookie_name = get_tenant_cookie_name(cookie_name, request)

        raw_cookie_token = request.COOKIES.get(tenant_cookie_name) or request.COOKIES.get(cookie_name)
        if not raw_cookie_token:
            return None

        try:
            validated_token = self.get_validated_token(raw_cookie_token)
        except (InvalidToken, TokenError):
            return None

        return self.get_user(validated_token), validated_token
