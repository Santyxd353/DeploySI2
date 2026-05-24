from rest_framework import serializers
from .models import BackupLog, BackupSchedule

class BackupLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = BackupLog
        fields = '__all__'


class BackupScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = BackupSchedule
        fields = [
            'id', 'frequency', 'time_of_day', 'day_of_week',
            'day_of_month', 'cron_expression', 'is_active',
            'last_run', 'next_run'
        ]
        read_only_fields = ['last_run', 'next_run']