import type { Card, PlayableColor } from '../../types/game';
import { SPECIAL_BY_ID } from '../constants/cardsData';

/** Nilai draw yang ditambahkan kartu ke stack (0 jika bukan kartu stack). */
export function stackValue(card: Card): number {
  if (card.action === 'draw_two') return 2;
  if (card.special) return SPECIAL_BY_ID[card.special].drawValue;
  return 0;
}

export const topCard = (discard: readonly Card[]): Card | undefined => discard[discard.length - 1];

export interface PlayContext {
  top: Card | undefined;
  activeColor: PlayableColor | null;
  stack: number;
  /** Dibungkam Buzzer Rp: hanya kartu angka. */
  muted: boolean;
}

/**
 * Boleh dimainkan pada GILIRAN sendiri?
 * (Grasi Presiden boleh kapan saja, itu ditangani terpisah di engine.)
 */
export function canPlayCard(card: Card, ctx: PlayContext): boolean {
  if (card.special === 'grasi_presiden') return true;
  if (ctx.muted && card.kind !== 'number') return false;

  // Ada stack hukuman: hanya kartu stack, Uang Pelicin, atau Bantahan (khusus +50).
  if (ctx.stack > 0) {
    if (stackValue(card) > 0) return true; // Stack Tanpa Batas
    if (card.special === 'uang_pelicin') return true;
    if (card.special === 'bantahan') return ctx.top?.special === 'pajak_misterius';
    return false;
  }

  if (card.special === 'uang_pelicin') return false; // hanya saat ada stack
  if (card.color === 'black') return true; // wild otoriter
  if (card.color === ctx.activeColor) return true;

  const t = ctx.top;
  if (!t) return true;
  if (card.kind === 'number' && t.kind === 'number' && card.value === t.value) return true;
  if (card.kind === 'action' && t.kind === 'action' && card.action === t.action) return true;
  if (card.kind === 'special' && t.kind === 'special' && card.special === t.special) return true;
  return false;
}

/** Begal Giliran: angka DAN warna sama persis dengan kartu teratas, tanpa stack berjalan. */
export function canInterrupt(card: Card, top: Card | undefined, stack: number): boolean {
  return (
    stack === 0 &&
    !!top &&
    card.kind === 'number' &&
    top.kind === 'number' &&
    card.value === top.value &&
    card.color === top.color
  );
}

/** Perlu memilih warna saat dimainkan (wild hitam atau Janji Kampanye). */
export function needsColor(card: Card): boolean {
  if (card.special === 'grasi_presiden') return false;
  return card.color === 'black' || card.special === 'janji_kampanye';
}

/** Perlu memilih pemain target saat dimainkan. */
export function needsTarget(card: Card): boolean {
  return !!card.special && SPECIAL_BY_ID[card.special].target === 'player';
}

export function getPlayableUids(hand: readonly Card[], ctx: PlayContext): string[] {
  return hand.filter((c) => canPlayCard(c, ctx)).map((c) => c.uid);
}
