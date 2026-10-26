import { createRoot } from 'react-dom/client';
import { thumbnail } from '@/components/PlantThumbnail3D';
import PlantEmbed from '@/pages/public/PlantEmbed';

/*
 * The 3D plant page on its own, for the mobile app: mobile/scripts/build-embed.mjs
 * builds this into one self-contained HTML file that ships inside the app, so
 * the plant shows at once, offline too, with the website's own model.
 *
 * With ?thumbs in the address it draws nothing and becomes the app's
 * thumbnail studio instead: the app asks for a still of each plant and gets
 * the same picture the website's plant cards show (PlantThumbnail3D).
 */
if (new URLSearchParams(location.search).has('thumbs')) {
  const tell = (message: string) => window.ReactNativeWebView?.postMessage(message);
  (window as unknown as { __sproutyThumb: (id: string, props: Parameters<typeof thumbnail>[0]) => void }).__sproutyThumb = (id, props) => {
    let src = '';
    try { src = thumbnail(props, { width: 450, height: 300, type: 'image/jpeg', quality: 0.86 }); } catch { /* the app keeps its drawing */ }
    tell(JSON.stringify({ thumb: id, src }));
  };
  tell('thumbs-ready');
} else {
  createRoot(document.getElementById('root')!).render(<PlantEmbed />);
}
