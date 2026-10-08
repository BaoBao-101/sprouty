/**
 * One conversation, wherever it is shown.
 *
 * The assistant appears in two places: a bubble that follows the reader from
 * page to page, and the roomy /ai page with photo upload and voice. They are
 * the same thread — ask two questions in the bubble, open the full page, and
 * the answers are already there.
 *
 * Holding the state up here is also what lets the bubble survive navigation.
 * The provider sits above the router outlet, so moving from the shop to a
 * workshop does not unmount it and does not throw the conversation away.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';

export interface AiMessage {
  role: 'user' | 'ai';
  text: string;
  imageUrl?: string;
  time: string;
}

interface AiChatValue {
  messages: AiMessage[];
  typing: boolean;
  /** The assistant can be gated behind a redeem code. */
  locked: boolean;
  send: (text: string, imageUrl?: string) => Promise<void>;
  clear: () => void;
}

const AiChatContext = createContext<AiChatValue | null>(null);

/** How many turns of context the model is given. */
const CONTEXT_TURNS = 6;

function now() {
  return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

export function AiChatProvider({ children }: { children: ReactNode }) {
  const { user, isLoggedIn } = useAuth();

  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [history, setHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [typing, setTyping] = useState(false);
  const [locked, setLocked] = useState(false);

  // Staff always get through; everyone else may need an activation code.
  useEffect(() => {
    if (!isLoggedIn) {
      setLocked(false);
      return;
    }
    let cancelled = false;
    API.redeem
      .entitlements()
      .then((state: any) => {
        if (cancelled) return;
        const isStaff = user?.role === 'employee' || user?.role === 'admin';
        setLocked(!!state.aiRequiresEntitlement && !state.features?.ai_assistant && !isStaff);
      })
      .catch(() => !cancelled && setLocked(false));
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, user]);

  const send = useCallback(
    async (text: string, imageUrl?: string) => {
      if (locked) {
        showToast('Nhập mã kích hoạt để dùng trợ lý AI', 'error');
        return;
      }
      const question = text.trim();
      if (!question && !imageUrl) return;

      setMessages((m) => [...m, { role: 'user', text: question, imageUrl, time: now() }]);
      const nextHistory = [...history, { role: 'user', content: question }];
      setHistory(nextHistory);
      setTyping(true);

      // The system prompt is built on the server (finding F-07): it knows who
      // is signed in and looks the catalogue up itself, so one sent from here
      // would only be a claim it has to ignore.
      try {
        const { reply } = await API.chat.send(nextHistory.slice(-CONTEXT_TURNS));
        setHistory((h) => [...h, { role: 'assistant', content: reply }]);
        setMessages((m) => [...m, { role: 'ai', text: reply, time: now() }]);
      } catch (err: any) {
        // The server says why it refused - not signed in, no activation code,
        // too many questions. Replacing every one of those with "lỗi kết nối"
        // asked the reader to retry something that fails the same way twice.
        const text = err?.message || 'Xin lỗi, có lỗi kết nối. Vui lòng thử lại sau!';
        setMessages((m) => [...m, { role: 'ai', text, time: now() }]);
      } finally {
        setTyping(false);
      }
    },
    [history, locked],
  );

  const clear = useCallback(() => {
    setMessages([]);
    setHistory([]);
  }, []);

  const value = useMemo<AiChatValue>(
    () => ({ messages, typing, locked, send, clear }),
    [messages, typing, locked, send, clear],
  );

  return <AiChatContext.Provider value={value}>{children}</AiChatContext.Provider>;
}

export function useAiChat() {
  const value = useContext(AiChatContext);
  if (!value) throw new Error('useAiChat must be used inside AiChatProvider');
  return value;
}
