import { requestJsonWithAuthRetry } from './apiClient';

export const getDashboardData = async () => {
  return requestJsonWithAuthRetry('/api/reportes/dashboard/');
};