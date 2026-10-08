import { Outlet } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AiBubble } from '@/components/AiBubble';
import { AiChatProvider } from '@/contexts/AiChatContext';

export function PublicLayout() {
  // The provider wraps the outlet rather than sitting inside a page, so the
  // conversation survives moving from one page to the next.
  return (
    <AiChatProvider>
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
      <AiBubble />
    </AiChatProvider>
  );
}
