import type {
  AiStatusResponse,
  ChatMessage,
  ChatResponse,
  GenerateTodosRequest,
  GenerateTodosResponse,
  PlanSprintRequest,
  PlanSprintResponse,
  SprintSummaryResponse,
} from '../types/api';
import { request } from './client';

export function getAiStatus() {
  return request<AiStatusResponse>('GET', '/ai/status');
}

// Nothing is saved: the drafts are saved later with bulkCreateTodos().
export function generateTodos(projectId: string, body: GenerateTodosRequest) {
  return request<GenerateTodosResponse>('POST', `/projects/${projectId}/ai/generate-todos`, body);
}

export function planSprint(projectId: string, body: PlanSprintRequest) {
  return request<PlanSprintResponse>('POST', `/projects/${projectId}/ai/plan-sprint`, body);
}

// Saved on the sprint by the server (sprint.summary).
export function summarizeSprint(sprintId: string) {
  return request<SprintSummaryResponse>('POST', `/sprints/${sprintId}/ai/summary`);
}

// The server keeps no chat memory: always send the whole conversation.
export async function sendChat(projectId: string, messages: ChatMessage[]) {
  return request<ChatResponse>('POST', `/projects/${projectId}/ai/chat`, { messages });
}
