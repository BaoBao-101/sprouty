import { SproutyIcon } from '@/components/icons/SproutyIcon';
import { formatWorkshopLocation } from '@/types/workshop';
import './PlaceMap.css';

/** Google Maps searching a place: what "Chỉ đường" opens, in the app on a phone. */
export function mapsLink(place: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`;
}

/** What a workshop's map looks up: its street address, else the venue name. */
export function placeOf(w: { location: string; address?: string | null }) {
  return w.address?.trim() || w.location;
}

/**
 * A place on a map, right on the page, and the whole card a link to Google
 * Maps. The map is Google's keyless embed, shown as a picture (it takes no
 * pointer events): a tap anywhere opens the real thing, with directions,
 * rather than panning a small box.
 */
export function PlaceMap({ name, address, className = '' }: { name: string; address?: string | null; className?: string }) {
  const query = address?.trim() || name;
  return (
    <a
      className={`place-map ${className}`}
      href={mapsLink(query)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Mở ${name} trên Google Maps`}
    >
      <span className="place-map-frame">
        <iframe
          src={`https://maps.google.com/maps?q=${encodeURIComponent(query)}&hl=vi&z=16&output=embed`}
          title={`Bản đồ: ${name}`}
          loading="lazy"
          tabIndex={-1}
          aria-hidden="true"
        />
      </span>
      <span className="place-map-bar">
        <span className="place-map-pin">
          <SproutyIcon name="pin" size={18} />
        </span>
        <span className="place-map-text">
          <strong>{formatWorkshopLocation({ location: name, address })}</strong>
        </span>
        <span className="place-map-go">
          Mở Google Maps <SproutyIcon name="arrow-right" size={15} />
        </span>
      </span>
    </a>
  );
}
