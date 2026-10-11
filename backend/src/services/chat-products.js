export function chatProducts(reply_text, catalogue) {
      const productIds = [...reply_text.matchAll(/\[\[kit:(\d+)\]\]/g)].map(match => Number(match[1]));
      const products = [...new Set(productIds)].map(id => catalogue.find(p => p.id === id)).filter(Boolean).slice(0, 4).map(p => ({
        id: p.id, name: p.name, price: Number(p.price), ageRange: p.ageRange, image: p.images?.[0] || null,
      }));
      return { reply: reply_text.replace(/\[\[kit:[^\]]*\]\]/g, '').trim(), products };
}
