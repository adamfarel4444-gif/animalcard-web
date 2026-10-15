/**
 * Animal War Card - Shared types (client + server).
 * Server-authoritative: server memegang deck/hand asli, client hanya menerima
 * `GameStateUpdate` yang sudah disaring (hand pemain lain disembunyikan).
 */

/* ───────────────────────── Kartu ───────────────────────── */

export type PlayableColor = 'red' | 'yellow' | 'green' | 'blue';
/** Merah: Darurat Nasional | Kuning: Suap & Anggaran | Hijau: Eksploitasi Lahan | Biru: Janji Manis | Hitam: Otoriter */
export type CardColor = PlayableColor | 'black';

export type CardKind = 'number' | 'action' | 'special';

export type ActionCardId = 'skip' | 'reverse' | 'draw_two';

export type SpecialCardId =
  // Aksi Penindasan & Stack Draw
  | 'inflasi_gila'
  | 'pajak_misterius'
  | 'denda_birokrasi'
  | 'bansos_express'
  // Manipulasi Regulasi & Hukum
  | 'ruu_instan'
  | 'mati_listrik'
  | 'dinasti_keluarga'
  | 'ott_fiktif'
  | 'pemilu_curang'
  | 'audit_independen'
  // Korupsi & Transaksi Gelap
  | 'pajak_kehidupan'
  | 'uang_pelicin'
  | 'rdp_fiktif'
  | 'grasi_presiden'
  // Propaganda & Manipulasi Opini
  | 'buzzer_rp'
  | 'janji_kampanye'
  | 'kudeta_dewan'
  // Kartu penangkal stack (+50)
  | 'bantahan';

export type CardDefId = `n_${PlayableColor}_${number}` | `a_${PlayableColor}_${ActionCardId}` | `s_${SpecialCardId}`;

export type SpecialCategory =
  | 'penindasan'
  | 'regulasi'
  | 'korupsi'
  | 'propaganda';

export type TargetMode = 'none' | 'player' | 'color' | 'vote';

export type AvatarId =
  | 'babi_berjas'
  | 'tikus_berdasi'
  | 'serigala_jubah'
  | 'buaya_lobi'
  | 'ular_izin'
  | 'hering_audit'
  | 'kucing_garong'
  | 'banteng_dewan';

/** Definisi statis sebuah kartu spesial (database satir). */
export interface SpecialCardDefinition {
  id: SpecialCardId;
  /** Nomor registrasi di daftar 1..18 */
  index: number;
  name: string;
  category: SpecialCategory;
  /** Warna kartu ini ada di deck. `black` = wild otoriter (pemain memilih warna berikutnya). */
  colors: CardColor[];
  /** Jumlah salinan PER warna di deck. */
  copiesPerColor: number;
  /** Teks badge singkat di pojok kartu (mis. "+100"). */
  badge: string;
  /** Kunci ikon SVG custom untuk badge/artwork tengah. */
  iconKey: string;
  /** Hewan yang jadi artwork tengah. */
  animal: AvatarId;
  effect: string;
  satire: string;
  target: TargetMode;
  /** Jika > 0, kartu ini menambah accumulatedDrawStack. */
  drawValue: number;
  /** Boleh dimainkan di luar giliran (mis. Grasi Presiden). */
  outOfTurn: boolean;
  /** Apakah kartu ini bisa ditumpuk di atas stack draw yang sedang berjalan. */
  stackable: boolean;
}

/** Instance kartu fisik di deck / hand / discard. */
export interface Card {
  uid: string;
  defId: CardDefId;
  kind: CardKind;
  color: CardColor;
  /** Hanya untuk kartu angka. */
  value?: number;
  action?: ActionCardId;
  special?: SpecialCardId;
  /** Warna yang dipilih saat kartu hitam / wild dimainkan. */
  chosenColor?: PlayableColor;
}

/** Kartu yang tersembunyi (Face Down / hand lawan). */
export interface HiddenCard {
  uid: string;
  hidden: true;
}

/* ───────────────────────── Pemain ───────────────────────── */

export interface PlayerProfile {
  id: string;
  nickname: string; // maks 12 karakter
  avatar: AvatarId;
  isHost: boolean;
  connected: boolean;
}

export interface PlayerPenaltyStatus {
  /** Sisa turn dipenjara (OTT Fiktif). */
  jailedTurns: number;
  /** Sisa turn dibungkam (Buzzer Rp): hanya boleh kartu angka standar. */
  mutedTurns: number;
  /** Hand sedang di-reveal ke semua pemain (Audit Independen) sampai putaran ini selesai. */
  revealed: boolean;
  /** Pemain tersisa 1 kartu dan belum menekan Animal Red Alert. */
  redAlertPending: boolean;
  /** Epoch ms batas akhir menekan tombol (1.5 detik). */
  redAlertDeadline: number | null;
  /** Sudah berhasil menekan Animal Red Alert. */
  redAlertSafe: boolean;
}

export interface PublicPlayer extends PlayerProfile {
  cardCount: number;
  status: PlayerPenaltyStatus;
  /** Diisi jika `revealed` true. */
  revealedHand?: Card[];
}

/* ───────────────────────── State Game ───────────────────────── */

export type RoomPhase = 'lobby' | 'playing' | 'finished';
export type TurnDirection = 1 | -1; // 1 = searah jarum jam

export interface VoteState {
  kind: 'rdp_fiktif';
  initiatorId: string;
  /** voterId -> targetId */
  votes: Record<string, string>;
  deadline: number;
}

export interface PendingChoice {
  playerId: string;
  card: Card;
  need: 'target' | 'color';
}

/** Payload event `game_state_update` untuk SATU pemain. */
export interface GameStateUpdate {
  roomCode: string;
  phase: RoomPhase;
  currentTurnPlayerId: string | null;
  direction: TurnDirection;
  /** Atas pile terakhir ada di index terakhir. */
  discardPile: Card[];
  /** Warna aktif (penting setelah kartu hitam). */
  activeColor: PlayableColor | null;
  accumulatedDrawStack: number;
  /** Berapa putaran lagi seluruh kartu face-down (Mati Listrik Massal). */
  blackoutRoundsLeft: number;
  deckCount: number;
  turnDeadline: number | null; // epoch ms, 7 detik per giliran
  players: PublicPlayer[];
  /** Hand milik pemain penerima. Jika blackout aktif, kartu bisa berupa HiddenCard. */
  myHand: Array<Card | HiddenCard>;
  pendingChoice: PendingChoice | null;
  vote: VoteState | null;
  winnerId: string | null;
  log: GameLogEntry[];
}

export interface GameLogEntry {
  id: string;
  at: number;
  tone: 'info' | 'penalty' | 'chaos' | 'win';
  text: string;
}

/* ───────────────────────── Server-internal ───────────────────────── */

export interface ServerPlayer extends PlayerProfile {
  socketId: string;
  hand: Card[];
  status: PlayerPenaltyStatus;
}

export interface ServerGameState {
  roomCode: string;
  phase: RoomPhase;
  players: ServerPlayer[]; // urutan = urutan duduk
  deck: Card[];
  discardPile: Card[];
  currentTurnIndex: number;
  direction: TurnDirection;
  activeColor: PlayableColor | null;
  accumulatedDrawStack: number;
  /** Warna/jenis penalti stack yang sedang berjalan (untuk validasi stacking & Uang Pelicin). */
  stackSourceId: string | null;
  blackoutRoundsLeft: number;
  /** Sisa turn blackout (dihitung per giliran; 2 putaran = 2 x jumlah pemain). */
  blackoutTurns: number;
  /** playerId -> sisa turn hand-nya di-reveal (Audit Independen). */
  revealTurns: Record<string, number>;
  turnDeadline: number | null;
  vote: VoteState | null;
  pendingChoice: PendingChoice | null;
  winnerId: string | null;
  log: GameLogEntry[];
}

/* ───────────────────────── Socket Events ───────────────────────── */

export interface PlayCardPayload {
  cardUid: string;
  targetPlayerId?: string;
  chosenColor?: PlayableColor;
}

export interface ClientToServerEvents {
  create_room: (p: { nickname: string; avatar: AvatarId }, ack: (r: { ok: boolean; roomCode?: string; error?: string }) => void) => void;
  join_room: (p: { roomCode: string; nickname: string; avatar: AvatarId }, ack: (r: { ok: boolean; error?: string }) => void) => void;
  start_game: () => void;
  play_card: (p: PlayCardPayload) => void;
  /** Begal Giliran: angka & warna sama persis, di luar giliran. */
  interrupt_card: (p: { cardUid: string }) => void;
  draw_card: () => void;
  press_red_alert: () => void;
  cast_vote: (p: { targetPlayerId: string }) => void;
  send_taunt: (p: { tauntId: string }) => void;
  leave_room: () => void;
}

export interface ServerToClientEvents {
  game_state_update: (state: GameStateUpdate) => void;
  sfx_cue: (cue: SfxCue) => void;
  taunt: (p: { fromId: string; tauntId: string }) => void;
  room_error: (p: { message: string }) => void;
}

export type SfxCue =
  | 'card_draw'
  | 'card_play'
  | 'plus100_siren'
  | 'gavel'
  | 'alarm';

/* ───────────────────────── Konstanta Aturan ───────────────────────── */

export const RULES = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 8,
  NICKNAME_MAX: 12,
  TURN_SECONDS: 7,
  TIMEOUT_PENALTY: 3,
  RED_ALERT_WINDOW_MS: 1500,
  RED_ALERT_PENALTY: 5,
  START_HAND: 7,
  PEMILU_RESET_HAND: 10,
} as const;
