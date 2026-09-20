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
  if (!text) return null;
  const lower = text.toLowerCase().trim();
  const d = new Date(baseDate);

  // Local YYYY-MM-DD formatting (safe from UTC timezone shifts)
  const formatISO = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // 1. Explicit German dates: "25.09.", "25.09.2026", "25. September"
  const fullDateMatch = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (fullDateMatch) {
    const day = parseInt(fullDateMatch[1], 10);
    const month = parseInt(fullDateMatch[2], 10) - 1;
    const year = parseInt(fullDateMatch[3], 10);
    const target = new Date(year, month, day);
    if (!isNaN(target.getTime())) return formatISO(target);
  }

  const shortDateMatch = text.match(/(\d{1,2})\.(\d{1,2})\.?(?!\d)/);
  if (shortDateMatch && !text.match(/\d{1,2}:\d{2}/)) {
    const day = parseInt(shortDateMatch[1], 10);
    const month = parseInt(shortDateMatch[2], 10) - 1;
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const year = d.getFullYear();
      const target = new Date(year, month, day);
      if (!isNaN(target.getTime())) return formatISO(target);
    }
  }

  const germanMonthNames = ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'dezember'];
  for (let m = 0; m < germanMonthNames.length; m++) {
    const monthName = germanMonthNames[m];
    const regex = new RegExp(`(\\d{1,2})\\.\\s*${monthName}(?:\\s*(\\d{4}))?`, 'i');
    const match = text.match(regex);
    if (match) {
      const day = parseInt(match[1], 10);
      const year = match[2] ? parseInt(match[2], 10) : d.getFullYear();
      const target = new Date(year, m, day);
      if (!isNaN(target.getTime())) return formatISO(target);
    }
  }

  // 2. Relative keywords: übermorgen, morgen, heute
  if (lower.includes('übermorgen')) {
    d.setDate(d.getDate() + 2);
    return formatISO(d);
  }
  if (lower.includes('morgen')) {
    d.setDate(d.getDate() + 1);
    return formatISO(d);
  }
  if (lower.includes('heute')) {
    return formatISO(d);
  }

  // 3. "in X Tagen" / "in X Wochen"
  const inDaysMatch = lower.match(/in\s+(\d+)\s+tag/i);
  if (inDaysMatch) {
    d.setDate(d.getDate() + parseInt(inDaysMatch[1], 10));
    return formatISO(d);
  }
  const inWeeksMatch = lower.match(/in\s+(\d+)\s+woche/i);
  if (inWeeksMatch) {
    d.setDate(d.getDate() + parseInt(inWeeksMatch[1], 10) * 7);
    return formatISO(d);
  }
  if (lower.includes('in einer woche') || lower.includes('in 1 woche')) {
    d.setDate(d.getDate() + 7);
    return formatISO(d);
  }
  if (lower.includes('in zwei wochen') || lower.includes('in 2 wochen')) {
    d.setDate(d.getDate() + 14);
    return formatISO(d);
  }

  // 4. Weekdays with ISO 8601 calendar week logic (Monday = 1, ..., Sunday = 7)
  const currentIsoDay = d.getDay() === 0 ? 7 : d.getDay();
  const weekdaysMap: Array<[string, number]> = [
    ['montag', 1],
    ['dienstag', 2],
    ['mittwoch', 3],
    ['donnerstag', 4],
    ['freitag', 5],
    ['samstag', 6],
    ['sonntag', 7]
  ];

  const isNextWeekPhrase = lower.includes('nächste woche') || lower.includes('nächster woche') || lower.includes('kommende woche') || lower.includes('kommenden woche');
  const isOverNextWeek = lower.includes('übernächste woche') || lower.includes('übernächster woche');

  for (const [dayName, targetIsoDay] of weekdaysMap) {
    if (lower.includes(dayName)) {
      if (isNextWeekPhrase || isOverNextWeek) {
        // "nächste Woche [Wochentag]": target day in the upcoming calendar week (starts next Monday)
        const daysUntilNextMonday = 8 - currentIsoDay;
        let offset = daysUntilNextMonday + (targetIsoDay - 1);
        if (isOverNextWeek) offset += 7;
        d.setDate(d.getDate() + offset);
        return formatISO(d);
      } else if (lower.includes('nächsten') || lower.includes('nächste')) {
        // "nächsten [Wochentag]": skip immediate occurrence if already passed or today
        let diff = targetIsoDay - currentIsoDay;
        if (diff <= 0) diff += 7;
        diff += 7;
        d.setDate(d.getDate() + diff);
        return formatISO(d);
      } else {
        // Immediate upcoming occurrence (e.g. "am Dienstag", "bis Freitag", "diesen Dienstag")
        let diff = targetIsoDay - currentIsoDay;
        if (diff <= 0) diff += 7;
        d.setDate(d.getDate() + diff);
        return formatISO(d);
      }
    }
  }

  // 5. "Ende der Woche"
  if (lower.includes('ende der woche')) {
    let diff = 5 - currentIsoDay;
    if (diff <= 0) diff += 7;
    d.setDate(d.getDate() + diff);
    return formatISO(d);
  }

  return null;
}
