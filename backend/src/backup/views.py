from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.core.management import call_command
from django.db import connection

from .models import BackupLog, BackupSchedule
from .serializers import BackupLogSerializer, BackupScheduleSerializer
from tenants.models import Tenant


# ──────────────────────────────────────────────
# Vista para backups manuales (ya existente)
# ──────────────────────────────────────────────
class BackupViewSet(viewsets.ViewSet):

    @action(detail=False, methods=['post'])
    def crear(self, request):
        """Ejecuta un backup manual"""
        try:
            call_command('backup_db', type='manual')
            return Response(
                {'message': 'Backup creado exitosamente'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def historial(self, request):
        """Lista los últimos backups realizados"""
        logs = BackupLog.objects.all()[:50]
        serializer = BackupLogSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def restaurar(self, request, pk=None):
        """Restaura la base de datos del tenant desde un backup específico"""
        from .backup_service import restore_backup

        try:
            backup_log = BackupLog.objects.get(pk=pk)
        except BackupLog.DoesNotExist:
            return Response(
                {'error': 'Backup no encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )

        if backup_log.status != 'success':
            return Response(
                {'error': 'Solo se puede restaurar desde backups con estado exitoso'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not backup_log.file_path:
            return Response(
                {'error': 'El backup no tiene archivo asociado'},
                status=status.HTTP_400_BAD_REQUEST
            )

        schema_name = connection.schema_name
        if schema_name == 'public':
            return Response(
                {'error': 'No se puede restaurar desde el schema público'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            restore_backup(backup_log.file_path, schema_name)
            return Response({
                'message': f'Restauración completada exitosamente desde el backup del {backup_log.timestamp.strftime("%d/%m/%Y %H:%M:%S")}'
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ──────────────────────────────────────────────
# Vista para la programación automática (nueva)
# ──────────────────────────────────────────────
class BackupScheduleViewSet(viewsets.ModelViewSet):
    """
    CRUD para que cada tenant administre su propia programación de backups.
    """
    serializer_class = BackupScheduleSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        schema_name = connection.schema_name
        if schema_name == 'public':
            return BackupSchedule.objects.none()
        tenant = Tenant.objects.get(schema_name=schema_name)
        return BackupSchedule.objects.filter(tenant=tenant)

    def perform_create(self, serializer):
        schema_name = connection.schema_name
        tenant = Tenant.objects.get(schema_name=schema_name)
        serializer.save(tenant=tenant)