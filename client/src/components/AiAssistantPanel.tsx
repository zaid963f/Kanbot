import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useAi } from '../context/AiContext';
import { useI18n } from '../context/I18nContext';
import { useFadeOut } from '../hooks/useFadeOut';
import { useSprints } from '../hooks/useProjectData';
import { AiDisclaimer, AiThinking, MockBadge } from './AiBits';
import Icon from './Icon';
import Markdown from './Markdown';
import { ErrorMessage } from './States';

const SUGGESTIONS = ['ai.suggestion1', 'ai.suggestion2', 'ai.suggestion3'] as const;

// The "Ask AI" side panel: quick actions + a chat about the current project.
export default function AiAssistantPanel() {
  const ai = useAi();
  const sprints = useSprints(ai.projectId);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const { t } = useI18n();
  useFadeOut(panelRef);
  const { closePanel } = ai;

  // The sprint to summarize: the active one, otherwise the latest completed one.
  const summarizable =
    sprints.data?.find((s) => s.status === 'active') ?? sprints.data?.find((s) => s.status === 'completed');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keep the newest message in view.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [ai.messages.length, ai.isThinking, ai.chatError]);

  // Esc closes the panel (when no dialog is open on top of it).
  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) closePanel();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closePanel]);

  function send(text = input) {
    if (!text.trim() || ai.isThinking) return;
    ai.sendMessage(text);
    setInput('');
  }

  // Enter sends, Shift+Enter adds a new line.
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send();
    }
  }

  return (
    <aside ref={panelRef} className="ai-panel" aria-label={t('ai.assistant')}>
      <div className="ai-panel-header">
        <span className="ai-mark" aria-hidden="true">
          <Icon name="sparkles" size={16} />
        </span>
        <h2>{t('ai.assistant')}</h2>
        <MockBadge />
        <span className="spacer" />
        <button
          type="button"
          className="icon-button ghost"
          onClick={ai.newChat}
          disabled={ai.messages.length === 0 && !ai.chatError}
          aria-label={t('ai.newChat')}
          title={t('ai.newChat')}
        >
          <Icon name="refresh" />
        </button>
        <button type="button" className="icon-button ghost" onClick={closePanel} aria-label={t('ai.closeAssistant')} title={t('common.close')}>
          <Icon name="x" />
        </button>
      </div>

      <div className="ai-actions">
        <button type="button" className="chip-button" onClick={() => ai.openDialog({ type: 'generate', prompt: input.trim() || undefined })}>
          <Icon name="plus" size={14} />
          {t('ai.createTodos')}
        </button>
        <button type="button" className="chip-button" onClick={() => ai.openDialog({ type: 'plan' })}>
          <Icon name="target" size={14} />
          {t('ai.planSprint')}
        </button>
        <button
          type="button"
          className="chip-button"
          disabled={!summarizable || ai.isThinking}
          title={summarizable ? t('ai.summarizeName', { name: summarizable.name }) : t('ai.startFirst')}
          onClick={() => summarizable && ai.summarizeInChat(summarizable, t('ai.summarizeName', { name: summarizable.name }))}
        >
          <Icon name="sprints" size={14} />
          {t('ai.summarizeSprint')}
        </button>
      </div>

      <div className="ai-messages" ref={listRef} aria-live="polite">
        {ai.messages.length === 0 && !ai.isThinking && (
          <div className="ai-welcome">
            <span className="empty-icon">
              <Icon name="sparkles" size={22} />
            </span>
            <h3>{t('ai.welcomeTitle')}</h3>
            <p className="muted">{t('ai.welcomeText')}</p>
            <div className="ai-suggestions">
              {SUGGESTIONS.map((key) => (
                <button key={key} type="button" className="chip-button" onClick={() => send(t(key))}>
                  {t(key)}
                </button>
              ))}
            </div>
          </div>
        )}

        {ai.messages.map((message, index) =>
          message.role === 'user' ? (
            <div key={index} className="ai-message ai-message-user">
              <span className="sr-only">{t('ai.youSaid')}</span>
              {message.content}
            </div>
          ) : (
            <div key={index} className="ai-message-row">
              <span className="ai-mark" aria-hidden="true">
                <Icon name="sparkles" size={14} />
              </span>
              <div className="ai-message ai-message-assistant">
                <span className="sr-only">{t('ai.botSaid')}</span>
                <Markdown>{message.content}</Markdown>
              </div>
            </div>
          ),
        )}

        {ai.isThinking && <AiThinking />}
        {Boolean(ai.chatError) && !ai.isThinking && <ErrorMessage error={ai.chatError} onRetry={ai.retry} />}
      </div>

      <form
        className="ai-composer"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <div className="ai-composer-row">
          <label htmlFor="ai-input" className="sr-only">
            {t('ai.ask')}
          </label>
          <textarea
            id="ai-input"
            ref={inputRef}
            className="input"
            rows={2}
            maxLength={4000}
            placeholder={t('ai.askPlaceholder')}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button type="submit" className="button button-primary" disabled={!input.trim() || ai.isThinking} aria-label={t('ai.send')}>
            <Icon name="send" />
          </button>
        </div>
        <p className="hint">{t('ai.sendHint')}</p>
        <AiDisclaimer />
      </form>
    </aside>
  );
}
