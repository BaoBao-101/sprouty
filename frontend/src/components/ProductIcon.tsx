import { useState } from 'react';

/**
 * Small square product icon used in admin tables. Falls back to a box emoji
 * when the product has no matching PNG in sprouty-icons.
 */
export function ProductIcon({ name, size = 20 }: { name: string; size?: number }) {
  const [failed, setFailed] = useState(false);

  return (
    <span className="product-icon" style={{ width: size, height: size }}>
      {failed || !name ? (
        '📦'
      ) : (
        <img
          src={`/assets/images/sprouty-icons/${name}.png`}
          alt=""
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
