import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { sendChat, summarizeSprint } from '../api/ai';
import type { ChatMessage, Sprint } from '../types/api';

// Which AI dialog is open. "generate" can start with a prompt (e.g. typed in the chat box).
export type AiDialog = { type: 'generate'; prompt?: string } | { type: 'plan' };

interface AiContextType {
  projectId: string;
  // the assistant drawer
  isPanelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  // the generate / plan dialogs
  dialog: AiDialog | null;
  openDialog: (dialog: AiDialog) => void;
  closeDialog: () => void;
  // the chat (kept while the drawer is closed, reset when the project changes)
  messages: ChatMessage[];
  isThinking: boolean;
  chatError: unknown;
  sendMessage: (text: string) => void;
  summarizeInChat: (sprint: Sprint, label: string) => void; // label = the user's message, e.g. "Summarize Sprint 3"
  retry: () => void;
  newChat: () => void;
}

const AiContext = createContext<AiContextType | null>(null);

// The server accepts at most 30 messages per chat request.
const MAX_MESSAGES = 30;

export function AiProvider({ projectId, children }: { projectId: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [dialog, setDialog] = useState<AiDialog | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [chatError, setChatError] = useState<unknown>(null);
  // The last AI call, so "Try again" can repeat it.
  const [lastRun, setLastRun] = useState<(() => Promise<string>) | null>(null);

  // Bumped on every reset, so an answer that arrives after "New chat" / a project switch is ignored.
  const chatVersion = useRef(0);
  const currentProject = useRef(projectId);
  useEffect(() => {
    currentProject.current = projectId;
  }, [projectId]);

  function newChat() {
    chatVersion.current += 1;
    setMessages([]);
    setIsThinking(false);
    setChatError(null);
    setLastRun(null);
  }

  // A new project starts with a fresh conversation and closed dialogs.
  const [chatProjectId, setChatProjectId] = useState(projectId);
  if (chatProjectId !== projectId) {
    setChatProjectId(projectId);
    setMessages([]);
    setIsThinking(false);
    setChatError(null);
    setLastRun(null);
    setDialog(null);
  }

  async function execute(run: () => Promise<string>) {
    const version = chatVersion.current;
    const isStale = () => version !== chatVersion.current || currentProject.current !== projectId;
    setLastRun(() => run);
    setChatError(null);
    setIsThinking(true);
    try {
      const content = await run();
      if (isStale()) return;
      setMessages((current) => [...current, { role: 'assistant', content }]);
    } catch (error) {
      if (isStale()) return;
      setChatError(error);
    } finally {
      if (!isStale()) setIsThinking(false);
    }
  }

  function sendMessage(text: string) {
    const content = text.trim();
    if (!content || isThinking) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    execute(async () => {
      const data = await sendChat(projectId, next.slice(-MAX_MESSAGES));
      return data.message.content;
    });
  }

  function summarizeInChat(sprint: Sprint, label: string) {
    if (isThinking) return;
    setMessages((current) => [...current, { role: 'user', content: label }]);
    execute(async () => {
      const data = await summarizeSprint(sprint.id);
      // The summary is saved on the sprint: refresh so the board / sprint page show it too.
      queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      return data.summary.content;
    });
  }

  function retry() {
    if (lastRun && !isThinking) execute(lastRun);
  }

  const value: AiContextType = {
    projectId,
    isPanelOpen: isPanelOpen && projectId !== '', // no project (e.g. the projects list) = no assistant
    openPanel: () => setIsPanelOpen(true),
    closePanel: () => setIsPanelOpen(false),
    dialog,
    openDialog: setDialog,
    closeDialog: () => setDialog(null),
    messages,
    isThinking,
    chatError,
    sendMessage,
    summarizeInChat,
    retry,
    newChat,
  };

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}

export function useAi() {
  const context = useContext(AiContext);
  if (!context) throw new Error('useAi must be used inside AiProvider');
  return context;
}
