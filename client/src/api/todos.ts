import type { BulkCreateTodosResponse, CreateTodoRequest, MoveTodoRequest, Todo, UpdateTodoRequest } from '../types/api';
import { request } from './client';

// All todos of a project (backlog + every sprint). Pages filter them themselves.
export async function getTodos(projectId: string) {
  const data = await request<{ todos: Todo[] }>('GET', `/projects/${projectId}/todos`);
  return data.todos;
}

export async function createTodo(projectId: string, body: CreateTodoRequest) {
  const data = await request<{ todo: Todo }>('POST', `/projects/${projectId}/todos`, body);
  return data.todo;
}

export async function updateTodo(id: string, body: UpdateTodoRequest) {
  const data = await request<{ todo: Todo }>('PATCH', `/todos/${id}`, body);
  return data.todo;
}

export async function moveTodo(id: string, body: MoveTodoRequest) {
  const data = await request<{ todo: Todo }>('POST', `/todos/${id}/move`, body);
  return data.todo;
}

export function deleteTodo(id: string) {
  return request<void>('DELETE', `/todos/${id}`);
}

// Several todos at once (e.g. AI drafts the user kept).
export async function bulkCreateTodos(projectId: string, todos: CreateTodoRequest[]) {
  const data = await request<BulkCreateTodosResponse>('POST', `/projects/${projectId}/todos/bulk`, { todos });
  return data.todos;
}
