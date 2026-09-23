import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API } from '@/services/api';

interface Post {
  id: number;
  slug: string;
  title: string;
  excerpt?: string;
  coverUrl?: string;
}

export default function Blog() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    API.blog
      .list({ limit: 24 })
      .then((data: any) => {
        if (cancelled) return;
        setPosts(data.posts || []);
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
  }, []);

  return (
    <section className="section-sm">
      <div className="container">
        <h1>Blog Sprouty</h1>
        <p className="lead">
          Ý tưởng trồng cây, chăm sóc Bạn Cây và câu chuyện kỷ niệm từ cộng đồng Sprouty.
        </p>

        <div className="grid-3" style={{ marginTop: 24 }}>
          {status === 'loading' && <p style={{ color: 'var(--ink-4)' }}>Đang tải bài viết…</p>}
          {status === 'error' && <p style={{ color: 'var(--rose)' }}>{error}</p>}
          {status === 'ready' && posts.length === 0 && (
            <p style={{ color: 'var(--ink-4)' }}>Chưa có bài viết nào.</p>
          )}

          {posts.map((post) => (
            <article className="blog-card" key={post.id}>
              {post.coverUrl && <img src={post.coverUrl} alt="" className="blog-card-cover" />}
              <div className="blog-card-body">
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
                <Link className="btn btn-outline btn-sm" to={`/blog/${encodeURIComponent(post.slug)}`}>
                  Đọc bài
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
