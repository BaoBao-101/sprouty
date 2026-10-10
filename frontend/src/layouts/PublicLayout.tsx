import { Navigate, Outlet } from 'react-router-dom';
import { roleLandingPath, useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { AiBubble } from '@/components/AiBubble';
import { AiChatProvider } from '@/contexts/AiChatContext';

export function PublicLayout() {
  const { ready, user } = useAuth();
  if (!ready) return <div className="route-gate">Đang kiểm tra phiên đăng nhập…</div>;
  const landing = user && roleLandingPath(user.role);
  if (landing) return <Navigate to={landing} replace />;
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
