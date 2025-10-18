import { TravelConciergeChat } from './travelConciergeChat';

export function initChat(onItineraryChange?: (changes: unknown[]) => void) {
  return new TravelConciergeChat(onItineraryChange);
}

export type { TravelConciergeChat };
