from threading import local


_local = local()


def set_current_tenant(tenant):
    _local.current_tenant = tenant


def get_current_tenant():
    return getattr(_local, "current_tenant", None)


def clear_current_tenant():
    if hasattr(_local, "current_tenant"):
        delattr(_local, "current_tenant")
