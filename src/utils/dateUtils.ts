export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatDate(isoDateString: string): string {
  try {
    const date = new Date(isoDateString);
    if (isNaN(date.getTime())) return isoDateString;
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return isoDateString;
  }
}

export function formatDateTime(isoDateString: string): string {
  try {
    const date = new Date(isoDateString);
    if (isNaN(date.getTime())) return isoDateString;
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoDateString;
  }
}

export function parseRelativeGermanDate(text: string, baseDate = new Date()): string | null {
  const lower = text.toLowerCase();
  const d = new Date(baseDate);

  if (lower.includes('heute')) {
    return d.toISOString().split('T')[0];
  }
  if (lower.includes('morgen')) {
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }
  if (lower.includes('übermorgen')) {
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  }

  const daysOfWeek = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'];
  for (let i = 0; i < daysOfWeek.length; i++) {
    if (lower.includes(daysOfWeek[i])) {
      const currentDay = d.getDay();
      let diff = i - currentDay;
      if (diff <= 0) diff += 7; // Next occurrence
      if (lower.includes('nächste') || lower.includes('nächsten')) {
        diff += 7;
      }
      d.setDate(d.getDate() + diff);
      return d.toISOString().split('T')[0];
    }
  }

  if (lower.includes('ende der woche') || lower.includes('freitag')) {
    const currentDay = d.getDay();
    let diff = 5 - currentDay; // Friday is 5
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split('T')[0];
  }

  return null;
}
