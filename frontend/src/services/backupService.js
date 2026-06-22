import { requestJsonWithAuthRetry } from './apiClient';

export const backupService = {
  async getHistorial() {
    return await requestJsonWithAuthRetry('/api/backups/historial/');
  },

  async crearBackup() {
    return await requestJsonWithAuthRetry('/api/backups/crear/', {
      method: 'POST',
    });
  },

  async restaurarBackup(backupId) {
    return await requestJsonWithAuthRetry(`/api/backups/${backupId}/restaurar/`, {
      method: 'POST',
    });
  },
};