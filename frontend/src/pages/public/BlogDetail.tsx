import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { API, API_BASE } from '@/services/api';
import { formatPrice } from '@/types/product';
import { productImage } from '@/services/products';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import './BlogDetail.css';

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
  category?: string;
}

interface Post {
  title: string;
  excerpt?: string;
  coverUrl?: string;
  contentHtml: string;
  publishedAt?: string | null;
  createdAt?: string;
  author?: { name: string } | null;
  recommendedProducts?: RecommendedProduct[];
}

/** About 200 words a minute, the pace a parent reads at between other things. */
function readingMinutes(html: string) {
  const words = html.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * A product the article recommends, as the shop shows one: picture first,
 * then name, a two-line summary and the price. The old card ran the whole
 * description down a narrow column and printed the original price as plain
 * text, so it read as a second, higher price rather than a discount.
 */
function RecommendedCard({ product }: { product: RecommendedProduct }) {
  const image = productImage({ id: product.id, images: product.images });
  const plan = product.category === 'membership';
  const discount =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : 0;

  return (
    <Link className="bd-reco" to={plan ? '/vip' : `/shop/${product.id}`}>
      <span className="bd-reco-thumb" style={{ background: product.bgColor || '#FEF5EA' }}>
        <img src={image} alt="" loading="lazy" />
        {discount > 0 && <span className="bd-reco-off">−{discount}%</span>}
      </span>
      <span className="bd-reco-body">
        <span className="bd-reco-meta">
          {plan ? 'Gói thành viên' : [product.collection, product.ageRange].filter(Boolean).join(' · ')}
        </span>
        <strong>{product.name}</strong>
        {product.description && <span className="bd-reco-desc">{product.description}</span>}
        <span className="bd-reco-foot">
          <span className="bd-reco-price">
            {formatPrice(Number(product.price) || 0)}
            {discount > 0 && <s>{formatPrice(product.oldPrice as number)}</s>}
          </span>
          <span className="bd-reco-go">
            Xem <SproutyIcon name="arrow-right" size={15} />
          </span>
        </span>
      </span>
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
    <main className="section-sm bd">
      <article className="container bd-article">
        <Link to="/blog" className="blog-back">
          ← Blog
        </Link>

        {error && <p style={{ color: 'var(--rose)' }}>{error}</p>}
        {!error && !post && <p style={{ color: 'var(--ink-4)' }}>Đang tải bài viết…</p>}

        {post && (
          <>
            <header className="bd-head">
              <span className="bd-meta">
                {new Date(post.publishedAt || post.createdAt || Date.now()).toLocaleDateString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
                {post.author?.name ? ` · ${post.author.name}` : ''} · {readingMinutes(post.contentHtml)} phút đọc
              </span>
              <h1>{post.title}</h1>
              {post.excerpt && <p className="bd-lead">{post.excerpt}</p>}
            </header>
            {post.coverUrl && <img src={post.coverUrl} alt="" className="blog-cover" />}
            {/* contentHtml is rendered from Markdown by the backend and only
                employees/admins can author it. */}
            <div className="blog-content" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />

            {recommendations.length > 0 && (
              <section className="bd-recos" aria-label="Sản phẩm đề xuất">
                <div className="bd-recos-head">
                  <span className="bd-recos-kicker">
                    <SproutyIcon name="sprout" size={15} /> Thử cùng bé
                  </span>
                  <h2>Sản phẩm gợi ý cho bài viết này</h2>
                </div>
                <div className="bd-recos-grid">
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
