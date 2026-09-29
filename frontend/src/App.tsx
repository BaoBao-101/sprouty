import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PublicLayout } from '@/layouts/PublicLayout';
import { AdminLayout } from '@/layouts/AdminLayout';
import { EmployeeLayout } from '@/layouts/EmployeeLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { LoginModal } from '@/components/LoginModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Public
const Home = lazy(() => import('@/pages/public/Home'));
const Shop = lazy(() => import('@/pages/public/Shop'));
const ProductDetail = lazy(() => import('@/pages/public/ProductDetail'));
const CartPage = lazy(() => import('@/pages/public/CartPage'));
const Payment = lazy(() => import('@/pages/public/Payment'));
const Workshop = lazy(() => import('@/pages/public/Workshop'));
const AiAssistant = lazy(() => import('@/pages/public/AiAssistant'));
const Blog = lazy(() => import('@/pages/public/Blog'));
const BlogDetail = lazy(() => import('@/pages/public/BlogDetail'));
const About = lazy(() => import('@/pages/public/About'));
const Faq = lazy(() => import('@/pages/public/Faq'));
const Contact = lazy(() => import('@/pages/public/Contact'));
const Returns = lazy(() => import('@/pages/public/Returns'));
const Privacy = lazy(() => import('@/pages/public/Privacy'));
const Vip = lazy(() => import('@/pages/public/Vip'));

// Signed-in customer
const Account = lazy(() => import('@/pages/public/Account'));
const MyProducts = lazy(() => import('@/pages/public/MyProducts'));
const MyWorkshops = lazy(() => import('@/pages/public/MyWorkshops'));
const Tree = lazy(() => import('@/pages/public/Tree'));
const Redeem = lazy(() => import('@/pages/public/Redeem'));

// Admin
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminUsers = lazy(() => import('@/pages/admin/Users'));
const AdminOrders = lazy(() => import('@/pages/admin/Orders'));
const AdminSales = lazy(() => import('@/pages/admin/Sales'));
const AdminWorkshops = lazy(() => import('@/pages/admin/Workshops'));
const AdminRedeemCodes = lazy(() => import('@/pages/admin/RedeemCodes'));
const AdminBlog = lazy(() => import('@/pages/admin/BlogAdmin'));
const AdminUserImages = lazy(() => import('@/pages/admin/UserImages'));
const AdminAuditLog = lazy(() => import('@/pages/admin/AuditLog'));
const AdminProducts = lazy(() => import('@/pages/admin/Products'));

// Employee
const EmployeeOrders = lazy(() => import('@/pages/employee/Orders'));
const EmployeeProducts = lazy(() => import('@/pages/employee/Products'));

/** The old site was a set of .html files; keep those URLs working. */
const LEGACY_REDIRECTS: Record<string, string> = {
  '/index.html': '/',
  '/pages/shop.html': '/shop',
  '/pages/product-detail.html': '/shop',
  '/pages/cart.html': '/cart',
  '/pages/payment.html': '/payment',
  '/pages/workshop.html': '/workshop',
  '/pages/ai.html': '/ai',
  '/pages/blog.html': '/blog',
  '/pages/blog-detail.html': '/blog',
  '/pages/about.html': '/about',
  '/pages/faq.html': '/faq',
  '/pages/contact.html': '/contact',
  '/pages/returns.html': '/returns',
  '/pages/privacy.html': '/privacy',
  '/pages/vip.html': '/vip',
  '/pages/account.html': '/account',
  '/pages/my-products.html': '/my-products',
  '/pages/tree.html': '/tree',
  '/pages/redeem.html': '/redeem',
  '/pages/admin/index.html': '/admin',
  '/pages/employee/orders.html': '/employee/orders',
  '/pages/employee/products.html': '/employee/products',
};

function ScrollToTop() {
  const { pathname } = useLocation();
  // Block body on purpose: a concise arrow would return whatever scrollTo
  // returns, and React treats an effect's return value as the cleanup function.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Loading() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--ink-4)' }}>Đang tải…</div>
  );
}

function NotFound() {
  return (
    <div className="container" style={{ textAlign: 'center', padding: '90px 0' }}>
      <div style={{ fontSize: '3rem', marginBottom: 12 }}>🌱</div>
      <h1>Không tìm thấy trang</h1>
      <p style={{ color: 'var(--ink-4)' }}>Trang bạn tìm không tồn tại hoặc đã được chuyển đi.</p>
      <a href="/" className="btn btn-primary" style={{ marginTop: 16, display: 'inline-block' }}>
        Về trang chủ
      </a>
    </div>
  );
}

export function App() {
  return (
    <>
      <ScrollToTop />
      <LoginModal />
      <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <Routes>
          {Object.entries(LEGACY_REDIRECTS).map(([from, to]) => (
            <Route key={from} path={from} element={<Navigate to={to} replace />} />
          ))}

          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/shop/:id" element={<ProductDetail />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/workshop" element={<Workshop />} />
            <Route path="/ai" element={<AiAssistant />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/blog/:id" element={<BlogDetail />} />
            <Route path="/about" element={<About />} />
            <Route path="/faq" element={<Faq />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/returns" element={<Returns />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/vip" element={<Vip />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/payment" element={<Payment />} />
              <Route path="/account" element={<Account />} />
              <Route path="/my-products" element={<MyProducts />} />
              <Route path="/my-workshops" element={<MyWorkshops />} />
              <Route path="/tree" element={<Tree />} />
              <Route path="/redeem" element={<Redeem />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Route>

          <Route element={<ProtectedRoute role="admin" />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="sales" element={<AdminSales />} />
              <Route path="workshops" element={<AdminWorkshops />} />
              <Route path="redeem" element={<AdminRedeemCodes />} />
              <Route path="blog" element={<AdminBlog />} />
              <Route path="user-images" element={<AdminUserImages />} />
              <Route path="audit" element={<AdminAuditLog />} />
              <Route path="products" element={<AdminProducts />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute role="employee" />}>
            <Route path="/employee" element={<EmployeeLayout />}>
              <Route index element={<Navigate to="/employee/orders" replace />} />
              <Route path="orders" element={<EmployeeOrders />} />
              <Route path="products" element={<EmployeeProducts />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
      </ErrorBoundary>
    </>
  );
}
