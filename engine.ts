import type {
  AvatarId,
  Card,
  GameLogEntry,
  GameStateUpdate,
  HiddenCard,
  PlayableColor,
  PlayCardPayload,
  PlayerPenaltyStatus,
  ServerGameState,
  ServerPlayer,
  SfxCue,
} from '../../types/game';
import { RULES } from '../../types/game';
import { PLAYABLE_COLORS, SPECIAL_BY_ID } from '../constants/cardsData';
import { createShuffledDeck, shuffle } from './deckGenerator';
import { canInterrupt, canPlayCard, needsColor, needsTarget, topCard } from './rules';

/* ───────────────────────── Util ───────────────────────── */

export interface EngineResult {
  ok: boolean;
  error?: string;
  cues: SfxCue[];
}
const bad = (error: string): EngineResult => ({ ok: false, error, cues: [] });
const good = (cues: SfxCue[] = []): EngineResult => ({ ok: true, cues });

let logSeq = 0;
export function logEvent(g: ServerGameState, tone: GameLogEntry['tone'], text: string) {
  g.log.push({ id: `l${logSeq++}`, at: Date.now(), tone, text });
  if (g.log.length > 40) g.log.splice(0, g.log.length - 40);
}

const freshStatus = (): PlayerPenaltyStatus => ({
  jailedTurns: 0,
  mutedTurns: 0,
  revealed: false,
  redAlertPending: false,
  redAlertDeadline: null,
  redAlertSafe: false,
});

export function createLobby(roomCode: string): ServerGameState {
  return {
    roomCode,
    phase: 'lobby',
    players: [],
    deck: [],
    discardPile: [],
    currentTurnIndex: 0,
    direction: 1,
    activeColor: null,
    accumulatedDrawStack: 0,
    stackSourceId: null,
    blackoutRoundsLeft: 0,
    blackoutTurns: 0,
    revealTurns: {},
    turnDeadline: null,
    vote: null,
    pendingChoice: null,
    winnerId: null,
    log: [],
  };
}

export function makePlayer(
  socketId: string,
  nickname: string,
  avatar: AvatarId,
  isHost: boolean,
): ServerPlayer {
  return { id: socketId, socketId, nickname, avatar, isHost, connected: true, hand: [], status: freshStatus() };
}

const current = (g: ServerGameState) => g.players[g.currentTurnIndex];
const turnMs = () => RULES.TURN_SECONDS * 1000;

/* ───────────────────────── Deck & Draw ───────────────────────── */

function refillDeck(g: ServerGameState) {
  if (g.deck.length > 0) return;
  const top = g.discardPile.pop();
  const rest = g.discardPile.splice(0).map((c) => {
    const copy = { ...c };
    delete copy.chosenColor;
    return copy;
  });
  g.deck = shuffle(rest);
  if (top) g.discardPile.push(top);
  // Inflasi Gila bisa menguras semuanya: cetak deck baru.
  if (g.deck.length === 0) g.deck = createShuffledDeck(Math.random().toString(36).slice(2, 5));
}

function drawCards(g: ServerGameState, p: ServerPlayer, n: number): number {
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    refillDeck(g);
    const c = g.deck.pop();
    if (!c) break;
    p.hand.push(c);
    drawn++;
  }
  return drawn;
}

/** Animal Red Alert: mulai jendela 1.5 detik hanya untuk pemain yang baru memainkan kartu. */
function syncRedAlert(g: ServerGameState, p: ServerPlayer, now: number, allowStart: boolean) {
  const s = p.status;
  if (p.hand.length === 1) {
    if (allowStart && !s.redAlertPending && !s.redAlertSafe) {
      s.redAlertPending = true;
      s.redAlertDeadline = now + RULES.RED_ALERT_WINDOW_MS;
    }
  } else {
    s.redAlertPending = false;
    s.redAlertSafe = false;
    s.redAlertDeadline = null;
  }
}

/* ───────────────────────── Giliran ───────────────────────── */

const stepIndex = (g: ServerGameState, from: number) => {
  const n = g.players.length;
  return (((from + g.direction) % n) + n) % n;
};

function advanceTurn(g: ServerGameState, now: number, skip = 0) {
  const n = g.players.length;
  const leaving = current(g);
  if (leaving && leaving.status.mutedTurns > 0) leaving.status.mutedTurns--;

  // Hitung mundur blackout & reveal per giliran
  if (g.blackoutTurns > 0) g.blackoutTurns--;
  for (const id of Object.keys(g.revealTurns)) {
    g.revealTurns[id]--;
    if (g.revealTurns[id] <= 0) {
      delete g.revealTurns[id];
      const pl = g.players.find((x) => x.id === id);
      if (pl) pl.status.revealed = false;
    }
  }

  let i = g.currentTurnIndex;
  let toSkip = skip;
  for (let guard = 0; guard < n * 8; guard++) {
    i = stepIndex(g, i);
    const p = g.players[i];
    if (p.status.jailedTurns > 0) {
      p.status.jailedTurns--;
      logEvent(g, 'info', `${p.nickname} masih di penjara, giliran dilewati.`);
      continue;
    }
    if (toSkip > 0) {
      toSkip--;
      logEvent(g, 'info', `${p.nickname} dilompati.`);
      continue;
    }
    break;
  }
  g.currentTurnIndex = i;
  g.turnDeadline = now + turnMs();
}

function finishIfWon(g: ServerGameState, p: ServerPlayer): boolean {
  if (p.hand.length > 0) return false;
  g.phase = 'finished';
  g.winnerId = p.id;
  g.turnDeadline = null;
  g.vote = null;
  logEvent(g, 'win', `${p.nickname} menang. Kekuasaan mutlak direbut.`);
  return true;
}

/* ───────────────────────── Mulai Game ───────────────────────── */

export function startGame(g: ServerGameState, now: number): EngineResult {
  if (g.phase === 'playing') return bad('Game sudah berjalan.');
  g.players = g.players.filter((p) => p.connected);
  if (g.players.length < RULES.MIN_PLAYERS) return bad(`Minimal ${RULES.MIN_PLAYERS} pemain.`);

  g.deck = createShuffledDeck();
  g.discardPile = [];
  g.accumulatedDrawStack = 0;
  g.stackSourceId = null;
  g.blackoutTurns = 0;
  g.revealTurns = {};
  g.vote = null;
  g.winnerId = null;
  g.direction = 1;
  for (const p of g.players) {
    p.hand = g.deck.splice(0, RULES.START_HAND);
    p.status = freshStatus();
  }
  const first = g.deck.findIndex((c) => c.kind === 'number');
  const start = g.deck.splice(first, 1)[0];
  g.discardPile.push(start);
  g.activeColor = start.color as PlayableColor;
  g.currentTurnIndex = Math.floor(Math.random() * g.players.length);
  g.turnDeadline = now + turnMs();
  g.phase = 'playing';
  logEvent(g, 'chaos', 'Sidang dibuka. Palu diketok.');
  return good(['gavel']);
}

/* ───────────────────────── Efek Kartu ───────────────────────── */

function applyEffect(
  g: ServerGameState,
  p: ServerPlayer,
  card: Card,
  target: ServerPlayer | undefined,
  chosen: PlayableColor | undefined,
  now: number,
  cues: SfxCue[],
): { skip: number; advance: boolean } {
  let skip = 0;
  let advance = true;
  const n = g.players.length;

  if (card.kind === 'action') {
    if (card.action === 'skip') {
      skip = 1;
    } else if (card.action === 'reverse') {
      if (n === 2) skip = 1;
      else g.direction = g.direction === 1 ? -1 : 1;
      logEvent(g, 'info', `${p.nickname} memutar haluan.`);
    } else if (card.action === 'draw_two') {
      g.accumulatedDrawStack += 2;
      g.stackSourceId = p.id;
      logEvent(g, 'penalty', `${p.nickname} melempar denda ringan. Stack: ${g.accumulatedDrawStack}.`);
    }
    return { skip, advance };
  }
  if (card.kind !== 'special' || !card.special) return { skip, advance };

  const addStack = (v: number, label: string) => {
    g.accumulatedDrawStack += v;
    g.stackSourceId = p.id;
    logEvent(g, 'penalty', `${p.nickname} memainkan ${label}. Stack: ${g.accumulatedDrawStack}.`);
  };

  switch (card.special) {
    case 'inflasi_gila':
      addStack(100, 'Inflasi Gila');
      cues.push('plus100_siren');
      break;
    case 'pajak_misterius':
      addStack(50, 'Tagihan Pajak Misterius');
      break;
    case 'denda_birokrasi':
      addStack(20, 'Denda Administrasi Birokrasi');
      break;

    case 'bansos_express': {
      const pool = shuffle(g.players.flatMap((q) => q.hand));
      g.players.forEach((q) => (q.hand = []));
      pool.forEach((c, i) => g.players[i % n].hand.push(c));
      logEvent(g, 'chaos', `Bansos Express! Semua kartu dikumpulkan dan dibagi rata.`);
      cues.push('gavel');
      break;
    }
    case 'ruu_instan': {
      g.direction = Math.random() < 0.5 ? 1 : -1;
      const old = g.players.map((q) => q.hand);
      g.players.forEach((q, i) => (q.hand = old[(i + 1) % n]));
      logEvent(g, 'chaos', 'RUU disahkan kilat. Arah berubah dan semua tangan ditukar ke kiri.');
      cues.push('gavel');
      break;
    }
    case 'mati_listrik':
      g.blackoutTurns = n * 2;
      logEvent(g, 'chaos', 'Mati listrik massal. Semua kartu menghadap bawah selama 2 putaran.');
      cues.push('alarm');
      break;
    case 'dinasti_keluarga': {
      const order = p.hand
        .slice()
        .sort((a, b) => Number(a.kind !== 'number') - Number(b.kind !== 'number'));
      const dumped = order.slice(0, 3);
      const ids = new Set(dumped.map((c) => c.uid));
      p.hand = p.hand.filter((c) => !ids.has(c.uid));
      g.discardPile.push(...dumped);
      const lastColored = [...dumped].reverse().find((c) => c.color !== 'black');
      if (lastColored) g.activeColor = lastColored.color as PlayableColor;
      skip = 1;
      logEvent(g, 'chaos', `${p.nickname} menurunkan ${dumped.length} kartu sekaligus. Dinasti berjaya.`);
      break;
    }
    case 'ott_fiktif':
      if (target) {
        target.status.jailedTurns = 3;
        logEvent(g, 'penalty', `${target.nickname} ditangkap tangan. Dipenjara 3 turn.`);
        cues.push('gavel');
      }
      break;
    case 'pemilu_curang': {
      const victims = g.players.filter((q) => q.id !== p.id && q.hand.length === 1 && q.status.redAlertSafe);
      if (victims.length === 0) logEvent(g, 'info', 'Pemilu curang digelar, tetapi tidak ada yang bisa dicurangi.');
      for (const v of victims) {
        drawCards(g, v, RULES.PEMILU_RESET_HAND - v.hand.length);
        v.status.redAlertSafe = false;
        v.status.redAlertPending = false;
        v.status.redAlertDeadline = null;
        logEvent(g, 'penalty', `Suara ${v.nickname} dianulir. Tangan direset jadi ${RULES.PEMILU_RESET_HAND} kartu.`);
      }
      break;
    }
    case 'audit_independen':
      if (target) {
        target.status.revealed = true;
        g.revealTurns[target.id] = n;
        logEvent(g, 'penalty', `${target.nickname} diaudit. Seluruh kartunya terbuka 1 putaran.`);
      }
      break;
    case 'pajak_kehidupan':
      if (target) {
        const len = target.hand.length;
        const k = Math.min(Math.ceil(len * 0.8), Math.max(len - 1, 0));
        const taken = shuffle(target.hand).slice(0, k);
        const ids = new Set(taken.map((c) => c.uid));
        target.hand = target.hand.filter((c) => !ids.has(c.uid));
        p.hand.push(...taken);
        logEvent(g, 'penalty', `${p.nickname} memajaki ${target.nickname}: ${k} kartu berpindah tangan.`);
      }
      break;
    case 'uang_pelicin':
      if (target) {
        g.currentTurnIndex = g.players.findIndex((q) => q.id === target.id);
        g.turnDeadline = now + turnMs();
        g.stackSourceId = p.id;
        advance = false;
        logEvent(g, 'chaos', `${p.nickname} menyuap kasus. Stack ${g.accumulatedDrawStack} dialihkan ke ${target.nickname}.`);
      }
      break;
    case 'rdp_fiktif':
      g.vote = { kind: 'rdp_fiktif', initiatorId: p.id, votes: {}, deadline: now + 12000 };
      g.turnDeadline = null;
      advance = false;
      logEvent(g, 'chaos', 'Rapat dengar pendapat dibuka. Pilih korban sekarang.');
      cues.push('gavel');
      break;
    case 'buzzer_rp':
      if (target) {
        target.status.mutedTurns = 2;
        logEvent(g, 'penalty', `${target.nickname} dibungkam buzzer 2 turn. Hanya kartu angka.`);
      }
      break;
    case 'janji_kampanye': {
      const col = chosen!;
      for (const q of g.players) {
        if (q.id === p.id) continue;
        if (!q.hand.some((c) => c.color === col)) {
          drawCards(g, q, 5);
          logEvent(g, 'penalty', `${q.nickname} tertipu janji manis. Draw 5.`);
        }
      }
      break;
    }
    case 'kudeta_dewan': {
      const cur = current(g);
      g.players = shuffle(g.players);
      g.currentTurnIndex = g.players.indexOf(cur);
      logEvent(g, 'chaos', 'Kudeta dewan pembina. Urutan duduk diacak.');
      break;
    }
    case 'bantahan':
      logEvent(g, 'chaos', `${p.nickname} membantah. Tagihan ${g.accumulatedDrawStack} dibatalkan.`);
      g.accumulatedDrawStack = 0;
      g.stackSourceId = null;
      break;
    case 'grasi_presiden':
      break; // ditangani playGrasi
  }
  return { skip, advance };
}

/* ───────────────────────── Aksi Pemain ───────────────────────── */

export function playCard(g: ServerGameState, playerId: string, payload: PlayCardPayload, now: number): EngineResult {
  if (g.phase !== 'playing') return bad('Game belum berjalan.');
  if (g.vote) return bad('Voting sedang berjalan.');
  const p = g.players.find((x) => x.id === playerId);
  if (!p) return bad('Pemain tidak ditemukan.');
  const card = p.hand.find((c) => c.uid === payload.cardUid);
  if (!card) return bad('Kartu tidak ada di tanganmu.');

  if (card.special === 'grasi_presiden') return playGrasi(g, p, card, now);
  if (current(g).id !== playerId) return bad('Bukan giliranmu.');

  const top = topCard(g.discardPile);
  if (!canPlayCard(card, { top, activeColor: g.activeColor, stack: g.accumulatedDrawStack, muted: p.status.mutedTurns > 0 })) {
    return bad(p.status.mutedTurns > 0 && card.kind !== 'number' ? 'Kamu dibungkam: hanya kartu angka.' : 'Kartu ini tidak bisa dimainkan sekarang.');
  }

  let chosen: PlayableColor | undefined;
  if (needsColor(card)) {
    if (!payload.chosenColor || !PLAYABLE_COLORS.includes(payload.chosenColor)) return bad('Pilih warna dulu.');
    chosen = payload.chosenColor;
  }
  let target: ServerPlayer | undefined;
  if (needsTarget(card)) {
    target = g.players.find((x) => x.id === payload.targetPlayerId);
    if (!target || target.id === playerId) return bad('Pilih pemain lain sebagai target.');
  }

  // Keluarkan kartu
  p.hand = p.hand.filter((c) => c.uid !== card.uid);
  if (chosen) card.chosenColor = chosen;
  g.discardPile.push(card);
  g.activeColor = chosen ?? (card.color === 'black' ? g.activeColor : (card.color as PlayableColor));

  const name = card.special ? SPECIAL_BY_ID[card.special].name : 'kartu';
  if (card.kind !== 'special') logEvent(g, 'info', `${p.nickname} memainkan ${name}.`);

  const cues: SfxCue[] = ['card_play'];
  const { skip, advance } = applyEffect(g, p, card, target, chosen, now, cues);

  if (finishIfWon(g, p)) return good([...cues, 'gavel']);

  const wasPending = p.status.redAlertPending;
  for (const q of g.players) syncRedAlert(g, q, now, q.id === p.id);
  if (p.status.redAlertPending && !wasPending) {
    cues.push('alarm');
    logEvent(g, 'chaos', `${p.nickname} tinggal 1 kartu. Tekan ANIMAL RED ALERT!`);
  }

  if (advance) advanceTurn(g, now, skip);
  return good(cues);
}

/** Begal Giliran: angka & warna sama persis, di luar giliran. */
export function interruptCard(g: ServerGameState, playerId: string, cardUid: string, now: number): EngineResult {
  if (g.phase !== 'playing') return bad('Game belum berjalan.');
  if (g.vote) return bad('Voting sedang berjalan.');
  const p = g.players.find((x) => x.id === playerId);
  if (!p) return bad('Pemain tidak ditemukan.');
  if (current(g).id === playerId) return bad('Ini giliranmu, mainkan kartu biasa.');
  if (p.status.jailedTurns > 0) return bad('Kamu sedang dipenjara.');
  const card = p.hand.find((c) => c.uid === cardUid);
  if (!card) return bad('Kartu tidak ada di tanganmu.');
  if (!canInterrupt(card, topCard(g.discardPile), g.accumulatedDrawStack)) {
    return bad('Begal gagal: angka dan warna harus sama persis.');
  }

  p.hand = p.hand.filter((c) => c.uid !== cardUid);
  g.discardPile.push(card);
  g.activeColor = card.color as PlayableColor;
  logEvent(g, 'chaos', `${p.nickname} membegal giliran!`);
  const cues: SfxCue[] = ['card_play'];
  if (finishIfWon(g, p)) return good([...cues, 'gavel']);

  const wasPending = p.status.redAlertPending;
  for (const q of g.players) syncRedAlert(g, q, now, q.id === p.id);
  if (p.status.redAlertPending && !wasPending) cues.push('alarm');

  g.currentTurnIndex = g.players.findIndex((q) => q.id === playerId);
  advanceTurn(g, now);
  return good(cues);
}

function playGrasi(g: ServerGameState, p: ServerPlayer, card: Card, now: number): EngineResult {
  p.hand = p.hand.filter((c) => c.uid !== card.uid);
  // Disisipkan di bawah kartu teratas supaya tidak mengubah warna aktif.
  g.discardPile.splice(Math.max(g.discardPile.length - 1, 0), 0, card);
  p.status.jailedTurns = 0;
  p.status.mutedTurns = 0;
  const cues: SfxCue[] = ['gavel'];
  const isCurrent = current(g).id === p.id;
  logEvent(g, 'chaos', `${p.nickname} menerima grasi presiden. Semua hukuman dihapus.`);

  if (finishIfWon(g, p)) return good(cues);
  syncRedAlert(g, p, now, true);
  if (isCurrent && g.accumulatedDrawStack > 0) {
    g.accumulatedDrawStack = 0;
    g.stackSourceId = null;
    advanceTurn(g, now);
  }
  return good(cues);
}

export function drawCard(g: ServerGameState, playerId: string, now: number): EngineResult {
  if (g.phase !== 'playing') return bad('Game belum berjalan.');
  if (g.vote) return bad('Voting sedang berjalan.');
  const cur = current(g);
  if (cur.id !== playerId) return bad('Bukan giliranmu.');
  const stack = g.accumulatedDrawStack;
  const took = drawCards(g, cur, stack > 0 ? stack : 1);
  if (stack > 0) {
    logEvent(g, 'penalty', `${cur.nickname} menampung ${took} kartu.`);
    g.accumulatedDrawStack = 0;
    g.stackSourceId = null;
  }
  syncRedAlert(g, cur, now, false);
  advanceTurn(g, now);
  return good(['card_draw']);
}

export function pressRedAlert(g: ServerGameState, playerId: string): EngineResult {
  const p = g.players.find((x) => x.id === playerId);
  if (!p) return bad('Pemain tidak ditemukan.');
  if (!p.status.redAlertPending || p.hand.length !== 1) return bad('Belum waktunya.');
  p.status.redAlertPending = false;
  p.status.redAlertDeadline = null;
  p.status.redAlertSafe = true;
  logEvent(g, 'info', `${p.nickname}: ANIMAL RED ALERT!`);
  return good(['alarm']);
}

/* ───────────────────────── Voting RDP ───────────────────────── */

export function castVote(g: ServerGameState, voterId: string, targetId: string, now: number): EngineResult {
  const v = g.vote;
  if (!v) return bad('Tidak ada voting.');
  if (voterId === targetId) return bad('Tidak boleh memilih diri sendiri.');
  if (!g.players.some((p) => p.id === voterId)) return bad('Pemain tidak ditemukan.');
  if (!g.players.some((p) => p.id === targetId)) return bad('Target tidak valid.');
  v.votes[voterId] = targetId;
  const cues: SfxCue[] = [];
  const voters = g.players.filter((p) => p.connected);
  if (voters.every((p) => v.votes[p.id])) resolveVote(g, now, cues);
  return good(cues);
}

function resolveVote(g: ServerGameState, now: number, cues: SfxCue[]) {
  const v = g.vote;
  if (!v) return;
  const tally = new Map<string, number>();
  Object.values(v.votes).forEach((t) => tally.set(t, (tally.get(t) ?? 0) + 1));
  let victimId: string | undefined;
  if (tally.size > 0) {
    const max = Math.max(...tally.values());
    const tied = [...tally.entries()].filter(([, c]) => c === max).map(([id]) => id);
    victimId = shuffle(tied)[0];
  } else {
    victimId = shuffle(g.players.filter((p) => p.id !== v.initiatorId))[0]?.id;
  }
  const victim = g.players.find((p) => p.id === victimId);
  g.vote = null;
  if (victim) {
    drawCards(g, victim, 15);
    syncRedAlert(g, victim, now, false);
    logEvent(g, 'penalty', `Hasil RDP: ${victim.nickname} jadi korban. Draw 15.`);
  }
  cues.push('gavel', 'card_draw');
  advanceTurn(g, now);
}

/* ───────────────────────── Tick (timer server) ───────────────────────── */

export function tick(g: ServerGameState, now: number): { changed: boolean; cues: SfxCue[] } {
  const cues: SfxCue[] = [];
  let changed = false;
  if (g.phase !== 'playing') return { changed, cues };

  // Animal Red Alert terlambat: pinalti 5 kartu
  for (const p of g.players) {
    const s = p.status;
    if (s.redAlertPending && s.redAlertDeadline !== null && now > s.redAlertDeadline) {
      drawCards(g, p, RULES.RED_ALERT_PENALTY);
      syncRedAlert(g, p, now, false);
      logEvent(g, 'penalty', `${p.nickname} telat menekan Red Alert. Draw ${RULES.RED_ALERT_PENALTY}.`);
      cues.push('card_draw');
      changed = true;
    }
  }

  if (g.vote) {
    if (now > g.vote.deadline) {
      resolveVote(g, now, cues);
      changed = true;
    }
    return { changed, cues };
  }

  const cur = current(g);
  if (!cur) return { changed, cues };

  // Pemain putus koneksi: ambil stack / draw 1 otomatis agar game tidak macet.
  if (!cur.connected) {
    drawCard(g, cur.id, now);
    return { changed: true, cues: [...cues, 'card_draw'] };
  }

  // Timer 7 detik
  if (g.turnDeadline !== null && now > g.turnDeadline) {
    const penalty = g.accumulatedDrawStack + RULES.TIMEOUT_PENALTY;
    drawCards(g, cur, penalty);
    g.accumulatedDrawStack = 0;
    g.stackSourceId = null;
    syncRedAlert(g, cur, now, false);
    logEvent(g, 'penalty', `${cur.nickname} kena Denda Keterlambatan Birokrasi. Draw ${penalty}.`);
    cues.push('card_draw', 'gavel');
    advanceTurn(g, now);
    changed = true;
  }
  return { changed, cues };
}

/* ───────────────────────── Proyeksi ke Klien ───────────────────────── */

export function toClientState(g: ServerGameState, viewerId: string): GameStateUpdate {
  const viewer = g.players.find((p) => p.id === viewerId);
  const n = Math.max(g.players.length, 1);
  const myHand: Array<Card | HiddenCard> = !viewer
    ? []
    : g.blackoutTurns > 0
      ? viewer.hand.map((c) => ({ uid: c.uid, hidden: true as const }))
      : viewer.hand;

  return {
    roomCode: g.roomCode,
    phase: g.phase,
    currentTurnPlayerId: g.phase === 'playing' ? (current(g)?.id ?? null) : null,
    direction: g.direction,
    discardPile: g.discardPile.slice(-5),
    activeColor: g.activeColor,
    accumulatedDrawStack: g.accumulatedDrawStack,
    blackoutRoundsLeft: Math.ceil(g.blackoutTurns / n),
    deckCount: g.deck.length,
    turnDeadline: g.turnDeadline,
    players: g.players.map((p) => ({
      id: p.id,
      nickname: p.nickname,
      avatar: p.avatar,
      isHost: p.isHost,
      connected: p.connected,
      cardCount: p.hand.length,
      status: { ...p.status },
      revealedHand: p.status.revealed ? p.hand : undefined,
    })),
    myHand,
    pendingChoice: null,
    vote: g.vote,
    winnerId: g.winnerId,
    log: g.log.slice(-30),
  };
}
