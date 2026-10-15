import type { Card } from '../../types/game';
import { createFullDeck } from '../constants/cardsData';

/** Fisher-Yates shuffle (tidak mengubah array asal). */
export function shuffle<T>(input: readonly T[]): T[] {
  const a = input.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deck baru yang sudah diacak. `salt` mencegah bentrok uid saat deck dibuat ulang di tengah game. */
export function createShuffledDeck(salt = ''): Card[] {
  const deck = createFullDeck().map((c) => ({ ...c, uid: `${salt}${c.uid}` }));
  return shuffle(deck);
}

/** Bagikan `size` kartu ke tiap pemain dari ujung deck. */
export function dealHands(deck: Card[], playerCount: number, size: number): Card[][] {
  const hands: Card[][] = [];
  for (let i = 0; i < playerCount; i++) hands.push(deck.splice(0, size));
  return hands;
}
