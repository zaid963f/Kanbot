import type { CreateProjectRequest, ProjectWithStats, UpdateProjectRequest } from '../types/api';
import { request } from './client';

export async function getProjects() {
  const data = await request<{ projects: ProjectWithStats[] }>('GET', '/projects');
  return data.projects;
}

export async function createProject(body: CreateProjectRequest) {
  const data = await request<{ project: ProjectWithStats }>('POST', '/projects', body);
  return data.project;
}

export async function updateProject(id: string, body: UpdateProjectRequest) {
  const data = await request<{ project: ProjectWithStats }>('PATCH', `/projects/${id}`, body);
  return data.project;
}

export function deleteProject(id: string) {
  return request<void>('DELETE', `/projects/${id}`);
}
