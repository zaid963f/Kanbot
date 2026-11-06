import type { CompleteSprintRequest, CreateSprintRequest, Sprint, StartSprintRequest, UpdateSprintRequest } from '../types/api';
import { request } from './client';

export async function getSprints(projectId: string) {
  const data = await request<{ sprints: Sprint[] }>('GET', `/projects/${projectId}/sprints`);
  return data.sprints;
}

export async function createSprint(projectId: string, body: CreateSprintRequest) {
  const data = await request<{ sprint: Sprint }>('POST', `/projects/${projectId}/sprints`, body);
  return data.sprint;
}

export async function updateSprint(id: string, body: UpdateSprintRequest) {
  const data = await request<{ sprint: Sprint }>('PATCH', `/sprints/${id}`, body);
  return data.sprint;
}

export function deleteSprint(id: string) {
  return request<void>('DELETE', `/sprints/${id}`);
}

export async function startSprint(id: string, body: StartSprintRequest) {
  const data = await request<{ sprint: Sprint }>('POST', `/sprints/${id}/start`, body);
  return data.sprint;
}

export async function completeSprint(id: string, body: CompleteSprintRequest) {
  const data = await request<{ sprint: Sprint }>('POST', `/sprints/${id}/complete`, body);
  return data.sprint;
}
