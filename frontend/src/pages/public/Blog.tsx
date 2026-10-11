import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { API } from '@/services/api';
import { SproutyIcon, type IconName } from '@/components/icons/SproutyIcon';
import { Pager } from '@/components/Pager';
import './Blog.css';

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  coverUrl?: string | null;
  publishedAt?: string | null;
  createdAt?: string;
  author?: { name: string } | null;
}

const PER_PAGE = 9;

function postDate(post: Post) {
  const iso = post.publishedAt || post.createdAt;
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** A stable look per post, so a post without a cover still has a face. */
const ARTS: Array<{ bg: string; icon: IconName }> = [
  { bg: 'linear-gradient(135deg, #DCFCE7, #BBF7D0)', icon: 'sprout' },
  { bg: 'linear-gradient(135deg, #FEF3C7, #FDE68A)', icon: 'sun' },
  { bg: 'linear-gradient(135deg, #E0F2FE, #BAE6FD)', icon: 'water' },
  { bg: 'linear-gradient(135deg, #FCE7F3, #FBCFE8)', icon: 'flower' },
  { bg: 'linear-gradient(135deg, #EDE9FE, #DDD6FE)', icon: 'leaf' },
];
function artFor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ARTS[h % ARTS.length];
}

function Cover({ post, big = false }: { post: Post; big?: boolean }) {
  if (post.coverUrl) return <img src={post.coverUrl} alt="" loading="lazy" />;
  const art = artFor(post.id);
  return (
    <span className="bl-art" style={{ background: art.bg }} aria-hidden="true">
      <span className="bl-art-ring">
        <SproutyIcon name={art.icon} size={big ? 64 : 40} />
      </span>
    </span>
  );
}

/**
 * The blog, as a magazine rather than a list.
 *
 * It was a heading and a grid of `.blog-card`s that had no styles at all: a
 * post without a cover was a bare title and a button, there was no date, no
 * search and no paging, and the tab kept the title of whatever page came
 * before. Now the newest post leads, the rest sit in a grid, every post has a
 * picture (its cover, or an illustration of its own), and the search reaches
 * titles, summaries and full text.
 */
export default function Blog() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Blog — Sprouty';
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    const params: Record<string, string> = { page: String(page), limit: String(PER_PAGE) };
    if (search) params.search = search;
    API.blog
      .list(params)
      .then((data: any) => {
        if (cancelled) return;
        setPosts(data.posts || []);
        setTotal(data.total || 0);
        setStatus('ready');
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err?.message || 'Không tải được bài viết.');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [page, search]);

  function submit(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(query.trim());
  }

  function clearSearch() {
    setQuery('');
    setSearch('');
    setPage(1);
  }

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  // The newest post leads the first page of the unfiltered list; a search
  // result is a plain grid, ranked as it came.
  const featured = !search && page === 1 ? posts[0] : null;
  const rest = featured ? posts.slice(1) : posts;

  return (
    <>
      <div className="bl-hero">
        <div className="container">
          <div className="breadcrumb bl-crumb">
            <Link to="/">Trang chủ</Link> › Blog
          </div>
          <span className="bl-kicker">
            <SproutyIcon name="leaf" size={15} /> Blog Sprouty
          </span>
          <h1>Góc chăm cây & nuôi dạy bé</h1>
          <p>Ý tưởng trồng cây cùng con, mẹo chăm Bạn Cây và những câu chuyện kỷ niệm từ cộng đồng Sprouty.</p>

          <form className="bl-search" onSubmit={submit} role="search">
            <svg className="bl-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              placeholder="Tìm bài viết: tưới cây, mầm non, workshop…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Tìm bài viết"
            />
            <button type="submit" className="btn btn-primary">
              Tìm
            </button>
          </form>
        </div>
      </div>

      <section className="bl-body">
        <div className="container">
          {search && status !== 'loading' && (
            <div className="bl-result">
              <span>
                {total ? `${total} bài viết` : 'Không có bài viết nào'} cho “<b>{search}</b>”
              </span>
              <button type="button" className="bl-link" onClick={clearSearch}>
                Xoá tìm kiếm
              </button>
            </div>
          )}

          {status === 'loading' && (
            <div className="bl-grid" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div className="bl-card bl-skeleton" key={i} />
              ))}
            </div>
          )}
          {status === 'error' && <div className="bl-msg is-error">{error}</div>}
          {status === 'ready' && posts.length === 0 && (
            <div className="bl-empty">
              <SproutyIcon name="leaf" size={36} />
              <strong>{search ? 'Không tìm thấy bài viết phù hợp' : 'Chưa có bài viết nào'}</strong>
              <span>
                {search
                  ? 'Thử một từ khoá khác, hoặc xem tất cả bài viết.'
                  : 'Sprouty đang viết những bài đầu tiên — quay lại sau nhé.'}
              </span>
              {search && (
                <button type="button" className="btn btn-outline" onClick={clearSearch}>
                  Xem tất cả bài viết
                </button>
              )}
            </div>
          )}

          {status === 'ready' && featured && (
            <Link to={`/blog/${encodeURIComponent(featured.slug)}`} className="bl-featured">
              <span className="bl-featured-cover">
                <Cover post={featured} big />
                <span className="bl-badge">Bài mới nhất</span>
              </span>
              <span className="bl-featured-body">
                <span className="bl-meta">
                  {postDate(featured)}
                  {featured.author?.name ? ` · ${featured.author.name}` : ''}
                </span>
                <strong>{featured.title}</strong>
                {featured.excerpt && <p>{featured.excerpt}</p>}
                <span className="bl-read">
                  Đọc bài viết <SproutyIcon name="arrow-right" size={17} />
                </span>
              </span>
            </Link>
          )}

          {status === 'ready' && rest.length > 0 && (
            <>
              {featured && <h2 className="bl-section-title">Bài viết khác</h2>}
              <div className="bl-grid">
                {rest.map((post) => (
                  <Link to={`/blog/${encodeURIComponent(post.slug)}`} className="bl-card" key={post.id}>
                    <span className="bl-card-cover">
                      <Cover post={post} />
                    </span>
                    <span className="bl-card-body">
                      <span className="bl-meta">{postDate(post)}</span>
                      <strong>{post.title}</strong>
                      {post.excerpt && <p>{post.excerpt}</p>}
                      <span className="bl-read">
                        Đọc tiếp <SproutyIcon name="arrow-right" size={15} />
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </>
          )}

          {status === 'ready' && total > PER_PAGE && (
            <Pager page={page} pages={pages} total={total} unit="bài viết" onChange={setPage} />
          )}
        </div>
      </section>
    </>
  );
}
