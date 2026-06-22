import subprocess
import os
import tarfile
import datetime
import tempfile
from django.conf import settings
from tenants.models import Tenant  # Asegurate de importar tu modelo

def create_backup(tenant=None):
    """
    Realiza el backup de la BD y los archivos media.
    Si se proporciona un tenant, solo se respalda el esquema de ese tenant.
    Devuelve (ruta_archivo, tamaño) o lanza excepción.
    """
    now = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_dir = settings.BACKUP_DIR
    os.makedirs(backup_dir, exist_ok=True)

    db_settings = settings.DATABASES['default']
    env = os.environ.copy()
    env['PGPASSWORD'] = db_settings['PASSWORD']

    # 1. Volcado de PostgreSQL
    dump_file = os.path.join(backup_dir, f'backup_{now}.dump')

    if tenant:
        # Solo el esquema del tenant (asumiendo tenant.schema_name)
        schema = tenant.schema_name  # Ajustá si tu modelo usa otro campo
        pg_dump_cmd = [
            'pg_dump',
            '-h', db_settings['HOST'],
            '-p', str(db_settings.get('PORT', 5432)),
            '-U', db_settings['USER'],
            '-d', db_settings['NAME'],
            '-n', schema,            # <-- Solo el esquema
            '-F', 'c',
            '-f', dump_file,
        ]
    else:
        # Backup completo de la base de datos (todos los esquemas)
        pg_dump_cmd = [
            'pg_dump',
            '-h', db_settings['HOST'],
            '-p', str(db_settings.get('PORT', 5432)),
            '-U', db_settings['USER'],
            '-d', db_settings['NAME'],
            '-F', 'c',
            '-f', dump_file,
        ]

    try:
        subprocess.run(pg_dump_cmd, check=True, env=env, capture_output=True)
    except subprocess.CalledProcessError as e:
        raise Exception(f"Error en pg_dump: {e.stderr.decode()}")

    # 2. Crear tar.gz con dump + media
    tar_file = os.path.join(backup_dir, f'backup_{now}.tar.gz')
    with tarfile.open(tar_file, 'w:gz') as tar:
        tar.add(dump_file, arcname=os.path.basename(dump_file))

        media_root = settings.MEDIA_ROOT
        if os.path.exists(media_root):
            if tenant:
                # Opción 1: Incluir toda la carpeta media (genérico pero más pesado)
                # tar.add(media_root, arcname='media')

                # Opción 2 (recomendada si tus archivos están en subcarpetas por tenant):
                # Ejemplo: media/tenants/<schema_name>/
                tenant_media_dir = os.path.join(media_root, 'tenants', schema)
                if os.path.exists(tenant_media_dir):
                    tar.add(tenant_media_dir, arcname='media')
                else:
                    # Si no existe subcarpeta, no agregamos nada o todo
                    tar.add(media_root, arcname='media')  # fallback
            else:
                tar.add(media_root, arcname='media')

    # Limpiar el dump individual
    os.remove(dump_file)

    file_size = os.path.getsize(tar_file)
    return tar_file, file_size