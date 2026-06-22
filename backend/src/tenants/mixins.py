from django.db import connection, models

from .context import get_current_tenant


class TenantAwareQuerySet(models.QuerySet):
    def for_tenant(self, tenant):
        if tenant is None or getattr(tenant, "schema_name", "public") == "public":
            return self
        return self.filter(tenant=tenant)


class TenantAwareManager(models.Manager):
    def get_queryset(self):
        qs = TenantAwareQuerySet(self.model, using=self._db)
        tenant = get_current_tenant() or getattr(connection, "tenant", None)
        if tenant is None or getattr(tenant, "schema_name", "public") == "public":
            return qs
        return qs.filter(tenant=tenant)


class TenantAwareModel(models.Model):
    tenant = models.ForeignKey(
        "tenants.Tenant",
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)s_set",
        null=True,
        blank=True,
        editable=False,
        db_index=True,
    )

    class Meta:
        abstract = True

    objects = TenantAwareManager()
    all_objects = models.Manager()

    def save(self, *args, **kwargs):
        if self.tenant_id is None:
            tenant = get_current_tenant() or getattr(connection, "tenant", None)
            if tenant is not None and getattr(tenant, "schema_name", None) != "public":
                self.tenant = tenant
        super().save(*args, **kwargs)
