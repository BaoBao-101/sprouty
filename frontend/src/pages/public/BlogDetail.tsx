import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { API, API_BASE } from '@/services/api';
import { formatPrice } from '@/types/product';

interface RecommendedProduct {
  id: number;
  name: string;
  images?: string[];
  bgColor?: string;
  collection?: string;
  ageRange?: string;
  description?: string;
  price: number;
  oldPrice?: number | null;
}

interface Post {
  title: string;
  excerpt?: string;
  coverUrl?: string;
  contentHtml: string;
  recommendedProducts?: RecommendedProduct[];
}

function RecommendedCard({ product }: { product: RecommendedProduct }) {
  const image = product.images?.[0] || `/assets/images/products/kit-${product.id}.svg`;

  return (
    <Link className="blog-reco-card" to={`/shop/${product.id}`}>
      <div className="blog-reco-thumb" style={{ background: product.bgColor || '#FEF5EA' }}>
        <img src={image} alt={product.name} loading="lazy" />
      </div>
      <div className="blog-reco-body">
        <div>
          <div className="blog-reco-title">{product.name}</div>
          <div className="blog-reco-meta">
            {product.collection} · {product.ageRange}
          </div>
          <div className="blog-reco-meta">{product.description}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {product.oldPrice && <span className="blog-reco-old">{formatPrice(product.oldPrice)}</span>}
          <div className="blog-reco-price">{formatPrice(Number(product.price) || 0)}</div>
        </div>
        <span className="btn btn-primary btn-sm blog-reco-cta">Xem sản phẩm</span>
      </div>
    </Link>
  );
}

export default function BlogDetail() {
  const { id: slug } = useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    if (!slug) {
      setError('Thiếu slug bài viết.');
      return;
    }
    API.blog
      .get(slug)
      .then((data: any) => {
        setPost(data.post);
        setError('');
        document.title = `${data.post.title} — Sprouty`;
      })
      .catch((err: any) => setError(err?.message || 'Không tải được bài viết.'));
  }, [slug]);

  useEffect(load, [load]);

  // The admin blog editor pushes an event when a post is saved, so an open
  // article refreshes itself without the reader reloading.
  useEffect(() => {
    const source = new EventSource(`${API_BASE}/blog-events/stream`);
    const onUpdate = (event: MessageEvent) => {
      try {
        const update = JSON.parse(event.data);
        if (update.slug === slug) load();
      } catch {
        load();
      }
    };
    source.addEventListener('blog-updated', onUpdate as EventListener);
    return () => source.close();
  }, [slug, load]);

  const recommendations = (post?.recommendedProducts || []).filter(Boolean);

  return (
    <main className="section-sm">
      <article className="container" style={{ maxWidth: 820 }}>
        <Link to="/blog" className="blog-back">
          ← Blog
        </Link>

        {error && <p style={{ color: 'var(--rose)' }}>{error}</p>}
        {!error && !post && <p style={{ color: 'var(--ink-4)' }}>Đang tải bài viết…</p>}

        {post && (
          <>
            <h1 style={{ marginTop: 16 }}>{post.title}</h1>
            {post.excerpt && <p className="lead">{post.excerpt}</p>}
            {post.coverUrl && <img src={post.coverUrl} alt="" className="blog-cover" />}
            {/* contentHtml is rendered from Markdown by the backend and only
                employees/admins can author it. */}
            <div className="blog-content" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />

            {recommendations.length > 0 && (
              <section className="blog-recommendations">
                <div className="section-title" style={{ marginBottom: 0 }}>
                  <div className="eyebrow">Sản phẩm đề xuất</div>
                  <h2>Gợi ý phù hợp với bài viết này</h2>
                  <p className="lead">
                    Các sản phẩm dưới đây liên quan trực tiếp đến chủ đề bài viết. Bấm vào để chuyển
                    sang trang bán hàng.
                  </p>
                </div>
                <div className="blog-reco-grid">
                  {recommendations.map((product) => (
                    <RecommendedCard key={product.id} product={product} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </article>
    </main>
  );
}
