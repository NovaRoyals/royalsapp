export function formatEventParts(iso: string) {
  const date = new Date(iso);
  return {
    day: String(date.getDate()),
    month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
    time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
}
