const subscribers = new Set();

export function subscribeToBlogEvents(send) {
  subscribers.add(send);
  return () => subscribers.delete(send);
}

export function publishBlogEvent(event) {
  const payload = JSON.stringify({
    ...event,
    occurredAt: new Date().toISOString(),
  });

  for (const send of subscribers) {
    try {
      send(payload);
    } catch {
      subscribers.delete(send);
    }
  }
}
