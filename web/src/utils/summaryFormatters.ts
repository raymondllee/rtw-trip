/**
 * Formatting utilities for itinerary summary generation
 */

/**
 * Format a date range string
 */
export function formatDateRange(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return 'Dates TBD';
  if (!endDate) return formatDate(startDate!);

  const start = new Date(startDate!);
  const end = new Date(endDate!);

  // Same day
  if (startDate === endDate) {
    return formatDate(startDate);
  }

  // Same month and year
  if (start.getUTCMonth() === end.getUTCMonth() && start.getUTCFullYear() === end.getUTCFullYear()) {
    const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' };
    const endDay = end.getUTCDate();
    const monthYear = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return `${start.getUTCDate()} - ${endDay}, ${monthYear}`;
  }

  // Same year
  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    return `${startStr} - ${endStr}`;
  }

  // Different years
  const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return `${startStr} - ${endStr}`;
}

/**
 * Format a single date
 */
export function formatDate(dateStr?: string): string {
  if (!dateStr) return 'TBD';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Format a month and year
 */
export function formatMonthYear(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Format duration in days with optional weeks
 */
export function formatDuration(days: number, includeWeeks: boolean = true): string {
  if (days === 0) return '0 days';
  if (days === 1) return '1 day';

  if (!includeWeeks || days < 7) {
    return `${days} days`;
  }

  const weeks = Math.floor(days / 7);
  const remainingDays = days % 7;

  if (remainingDays === 0) {
    return weeks === 1 ? '1 week' : `${weeks} weeks`;
  }

  // For cleaner display, just show days if complex
  if (days < 14) {
    return `${days} days`;
  }

  // Show weeks with decimal
  const weeksDecimal = (days / 7).toFixed(1);
  return `${days} days (~${weeksDecimal} weeks)`;
}

/**
 * Format currency amount
 */
export function formatCurrency(amount: number, currency: string = 'USD', showSymbol: boolean = true): string {
  if (currency === 'USD' && showSymbol) {
    return `$${formatNumber(amount)}`;
  }

  const formatted = formatNumber(amount);
  return showSymbol ? `${currency} ${formatted}` : formatted;
}

/**
 * Format a number with thousands separators
 */
export function formatNumber(num: number, decimals: number = 0): string {
  return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, total: number, decimals: number = 1): string {
  if (total === 0) return '0%';
  const percentage = (value / total) * 100;
  return `${percentage.toFixed(decimals)}%`;
}

/**
 * Calculate average and format
 */
export function formatAverage(total: number, count: number, decimals: number = 1): string {
  if (count === 0) return '0';
  return (total / count).toFixed(decimals);
}

/**
 * Format a list of items with commas and "and"
 */
export function formatList(items: string[], maxItems?: number): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];

  const displayItems = maxItems ? items.slice(0, maxItems) : items;
  const remaining = items.length - displayItems.length;

  if (displayItems.length === 2) {
    const result = displayItems.join(' and ');
    return remaining > 0 ? `${result} and ${remaining} more` : result;
  }

  const lastItem = displayItems.pop();
  const result = displayItems.join(', ') + ', and ' + lastItem;
  return remaining > 0 ? `${result}, and ${remaining} more` : result;
}

/**
 * Get continent emoji
 */
export function getContinentEmoji(continent?: string): string {
  const emojiMap: Record<string, string> = {
    'Africa': '🌍',
    'Antarctica': '🐧',
    'Asia': '🌏',
    'Europe': '🌍',
    'North America': '🌎',
    'South America': '🌎',
    'Oceania': '🌏'
  };
  return continent ? (emojiMap[continent] || '🌍') : '🌍';
}

/**
 * Get cost category emoji
 */
export function getCategoryEmoji(category: string): string {
  const emojiMap: Record<string, string> = {
    'accommodation': '🏨',
    'food': '🍽️',
    'transport': '✈️',
    'activities': '🎯',
    'entertainment': '🎭',
    'shopping': '🛍️',
    'other': '💰'
  };
  return emojiMap[category.toLowerCase()] || '💰';
}

/**
 * Truncate text to a maximum length
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Pluralize a word based on count
 */
export function pluralize(word: string, count: number, plural?: string): string {
  if (count === 1) return word;
  return plural || word + 's';
}

/**
 * Sort countries by a specific field
 */
export function sortByField<T>(items: T[], field: keyof T, descending: boolean = true): T[] {
  return [...items].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return descending ? bVal - aVal : aVal - bVal;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return descending ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
    }

    return 0;
  });
}

/**
 * Calculate days between two dates
 */
export function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Group items by a field
 */
export function groupBy<T>(items: T[], getKey: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }

  return groups;
}

/**
 * Get color for a cost category
 */
export function getCategoryColor(category: string): string {
  const colorMap: Record<string, string> = {
    'accommodation': '#3b82f6',  // blue
    'food': '#10b981',           // green
    'transport': '#f59e0b',      // orange
    'activities': '#8b5cf6',     // purple
    'entertainment': '#ec4899',  // pink
    'shopping': '#14b8a6',       // teal
    'other': '#6b7280'           // gray
  };
  return colorMap[category.toLowerCase()] || colorMap['other'];
}

/**
 * Get month name from date string
 */
export function getMonthName(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
}

/**
 * Get year from date string
 */
export function getYear(dateStr: string): number {
  const date = new Date(dateStr);
  return date.getUTCFullYear();
}
