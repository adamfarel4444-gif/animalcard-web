import type {
  ActionCardId,
  AvatarId,
  Card,
  CardColor,
  PlayableColor,
  SpecialCardDefinition,
  SpecialCardId,
} from '../../types/game';

/* ───────────────────────── Warna ───────────────────────── */

export const PLAYABLE_COLORS: PlayableColor[] = ['red', 'yellow', 'green', 'blue'];

export const COLOR_META: Record<
  CardColor,
  { label: string; theme: string; hex: string; glow: string }
> = {
  red: { label: 'Merah', theme: 'Darurat Nasional', hex: '#E63946', glow: 'rgba(230,57,70,0.45)' },
  yellow: { label: 'Kuning', theme: 'Suap & Anggaran', hex: '#D4AF37', glow: 'rgba(212,175,55,0.45)' },
  green: { label: 'Hijau', theme: 'Eksploitasi Lahan', hex: '#2E9E5B', glow: 'rgba(46,158,91,0.45)' },
  blue: { label: 'Biru', theme: 'Janji Manis', hex: '#3B7BE8', glow: 'rgba(59,123,232,0.45)' },
  black: { label: 'Hitam', theme: 'Kartu Otoriter', hex: '#1A1A22', glow: 'rgba(255,30,39,0.35)' },
};

/* ───────────────────────── Avatar Hewan Politik ───────────────────────── */

export const AVATARS: { id: AvatarId; name: string; title: string }[] = [
  { id: 'babi_berjas', name: 'Babi Berjas', title: 'Ketua Panitia Anggaran' },
  { id: 'tikus_berdasi', name: 'Tikus Berdasi', title: 'Konsultan Proyek Bayangan' },
  { id: 'serigala_jubah', name: 'Serigala Berjubah', title: 'Penasihat Hukum Penguasa' },
  { id: 'buaya_lobi', name: 'Buaya Lobi', title: 'Juru Lobi Parlemen' },
  { id: 'ular_izin', name: 'Ular Izin', title: 'Direktur Izin Lahan' },
  { id: 'hering_audit', name: 'Hering Auditor', title: 'Pemeriksa yang Selalu Telat' },
  { id: 'kucing_garong', name: 'Kucing Garong', title: 'Menteri Urusan Ikan Asin' },
  { id: 'banteng_dewan', name: 'Banteng Dewan', title: 'Fraksi Mayoritas Tanpa Suara' },
];

/* ───────────────────────── 18 Kartu Spesial ───────────────────────── */

const ALL4: CardColor[] = PLAYABLE_COLORS;

export const SPECIAL_CARDS: SpecialCardDefinition[] = [
  /* — Aksi Penindasan & Stack Draw — */
  {
    id: 'inflasi_gila',
    index: 1,
    name: 'Inflasi Gila',
    category: 'penindasan',
    colors: ['red'],
    copiesPerColor: 2,
    badge: '+100',
    iconKey: 'siren',
    animal: 'babi_berjas',
    effect:
      'Pemain berikutnya HARUS mengambil 100 kartu! Bisa di-stack jika ia punya +100 atau +50 lain; total akumulasi berpindah ke korban berikutnya.',
    satire: 'Harga naik, gaji tetap. Rapat evaluasi dijadwalkan tahun depan.',
    target: 'none',
    drawValue: 100,
    outOfTurn: false,
    stackable: true,
  },
  {
    id: 'pajak_misterius',
    index: 2,
    name: 'Tagihan Pajak Misterius',
    category: 'penindasan',
    colors: ['yellow'],
    copiesPerColor: 3,
    badge: '+50',
    iconKey: 'invoice',
    animal: 'tikus_berdasi',
    effect:
      'Korban draw 50 kartu, kecuali punya kartu Bantahan. Bisa di-stack di atas +50 / +100.',
    satire: 'Pajak apa? Tidak ada yang tahu. Bayar saja.',
    target: 'none',
    drawValue: 50,
    outOfTurn: false,
    stackable: true,
  },
  {
    id: 'denda_birokrasi',
    index: 3,
    name: 'Denda Administrasi Birokrasi',
    category: 'penindasan',
    colors: ['red', 'yellow', 'green', 'blue'],
    copiesPerColor: 1,
    badge: '+20',
    iconKey: 'stamp',
    animal: 'hering_audit',
    effect: 'Draw 20 kartu instan dan LANGSUNG kehilangan giliran (Skip). Bisa di-stack.',
    satire: 'Formulir 27-B kurang satu tanda tangan basah dan materai.',
    target: 'none',
    drawValue: 20,
    outOfTurn: false,
    stackable: true,
  },
  {
    id: 'bansos_express',
    index: 4,
    name: 'Bansos Express',
    category: 'penindasan',
    colors: ['black'],
    copiesPerColor: 2,
    badge: 'RATA',
    iconKey: 'crate',
    animal: 'banteng_dewan',
    effect:
      'Kumpulkan SELURUH kartu semua pemain, kocok, lalu bagikan RATA ke semua pemain di ruangan. Komunisme murni, sekali pakai.',
    satire: 'Pemerataan tiba tepat sebelum pemilu. Kebetulan.',
    target: 'none',
    drawValue: 0,
    outOfTurn: false,
    stackable: false,
  },

  /* — Manipulasi Regulasi & Hukum — */
  {
    id: 'ruu_instan',
    index: 5,
    name: 'RUU Perubahan Aturan Instan',
    category: 'regulasi',
    colors: ['black'],
    copiesPerColor: 2,
    badge: 'RUU',
    iconKey: 'scroll',
    animal: 'serigala_jubah',
    effect:
      'Arah putaran berubah ACAK dan semua pemain menukar seluruh kartu di tangan dengan pemain di sebelah kirinya.',
    satire: 'Disahkan dalam 4 menit, dibacakan dalam 0 menit.',
    target: 'none',
    drawValue: 0,
    outOfTurn: false,
    stackable: false,
  },
  {
    id: 'mati_listrik',
    index: 6,
    name: 'Mati Listrik Massal',
    category: 'regulasi',
    colors: ['black'],
    copiesPerColor: 1,
    badge: 'GELAP',
    iconKey: 'bulb_off',
    animal: 'ular_izin',
    effect:
      'Selama 2 putaran, SEMUA kartu semua pemain face down. Tidak ada yang tahu apa yang dipegang.',
    satire: 'Gangguan teknis. Penyebab: konspirasi server. Bukan salah siapa-siapa.',
    target: 'none',
    drawValue: 0,
    outOfTurn: false,
    stackable: false,
  },
  {
    id: 'dinasti_keluarga',
    index: 7,
    name: 'Dinasti Keluarga',
    category: 'regulasi',
    colors: ['yellow', 'blue'],
    copiesPerColor: 1,
    badge: 'x3',
    iconKey: 'crown_family',
    animal: 'kucing_garong',
    effect:
      'Pemegang melompati giliran orang lain dan langsung menurunkan 3 kartu sekaligus tanpa cek warna/angka.',
    satire: 'Kebetulan anaknya, keponakannya, dan menantunya sama-sama paling berkualitas.',
    target: 'none',
    drawValue: 0,
    outOfTurn: false,
    stackable: false,
  },
  {
    id: 'ott_fiktif',
    index: 8,
    name: 'Operasi Tangkap Tangan Fiktif',
    category: 'regulasi',
    colors: ['red', 'green'],
    copiesPerColor: 1,
    badge: 'PENJARA',
    iconKey: 'handcuffs',
    animal: 'buaya_lobi',
    effect:
      'Penjarakan 1 pemain target selama 3 turn berturut-turut. Ia tidak bisa draw dan tidak bisa jalan.',
    satire: 'Barang bukti: sebuah amplop kosong dan seorang saksi yang lupa.',
    target: 'player',
    drawValue: 0,
    outOfTurn: false,
    stackable: false,
  },
  {
    id: 'pemilu_curang',
    index: 9,
    name: 'Pemilu Kecurangan Terstruktur',
    category: 'regulasi',
    colors: ['black'],
    copiesPerColor: 1,
    badge: 'RESET',
    iconKey: 'ballot_box',
    animal: 'banteng_dewan',
    effect:
      'Jika ada pemain tersisa 1 kartu (sudah teriak ANIMAL!), statusnya dibatalkan dan tangannya direset jadi 10 kartu.',
    satire: 'Suara sah, hasil sah, protes tidak sah.',
    target: 'none',
    drawValue: 0,
    outOfTurn: false,
    stackable: false,
  },
  {
    id: 'audit_independen',
    index: 10,
    name: 'Audit Investigasi Independen',
    category: 'regulasi',
    colors: ['green', 'blue'],
    copiesPerColor: 1,
    badge: 'BUKA',
    iconKey: 'magnifier',
    animal: 'hering_audit',
    effect:
      'Paksa 1 pemain target membuka (reveal) seluruh kartunya ke SEMUA pemain selama 1 putaran.',
    satire: 'Independen, karena auditornya dibayar oleh pihak yang diaudit.',
    target: 'player',
    drawValue: 0,
    outOfTurn: false,
    stackable: false,
  },

  /* — Korupsi & Transaksi Gelap — */
  {
    id: 'pajak_kehidupan',
    index: 11,
    name: 'Pajak Kehidupan 99%',
    category: 'korupsi',
    colors: ['black'],
    copiesPerColor: 1,
    badge: '80%',
    iconKey: 'coin_drain',
    animal: 'tikus_berdasi',
    effect:
      'Pilih 1 target. Ia menyerahkan 80% kartu terbaik di tangannya secara acak kepada pengguna kartu ini.',
    satire: 'Yang tersisa 1% adalah hak Anda untuk bersyukur.',
    target: 'player',
    drawValue: 0,
    outOfTurn: false,
    stackable: false,
  },
  {
    id: 'uang_pelicin',
    index: 12,
    name: 'Uang Pelicin / Suap Kasus',
    category: 'korupsi',
    colors: ['yellow'],
    copiesPerColor: 2,
    badge: 'OPER',
    iconKey: 'envelope',
    animal: 'babi_berjas',
    effect:
      'Batalkan akumulasi stack hukuman (+100, +50, dst.) yang mengarah ke dirimu, lalu alihkan SELURUH akumulasi ke pemain pilihanmu.',
    satire: 'Tidak ada yang bersalah. Hanya ada yang kurang bayar.',
    target: 'player',
    drawValue: 0,
    outOfTurn: false,
    stackable: false,
  },
  {
    id: 'rdp_fiktif',
    index: 13,
    name: 'Rapat Dengar Pendapat Fiktif',
    category: 'korupsi',
    colors: ['black'],
    copiesPerColor: 1,
    badge: 'VOTING',
    iconKey: 'gavel_hall',
    animal: 'serigala_jubah',
    effect:
      'Voting kilat. Semua pemain memilih 1 korban secara kolektif; korban draw 15 kartu.',
    satire: 'Dengar pendapat, lalu putuskan seperti rencana semula.',
    target: 'vote',
    drawValue: 0,
    outOfTurn: false,
    stackable: false,
  },
  {
    id: 'grasi_presiden',
    index: 14,
    name: 'Grasi Presiden / Pengampunan Dosa',
    category: 'korupsi',
    colors: ['black'],
    copiesPerColor: 2,
    badge: 'BEBAS',
    iconKey: 'dove_seal',
    animal: 'kucing_garong',
    effect:
      'Kartu bebas hukuman. Boleh dimainkan KAPAN SAJA, di luar giliran, untuk menghapus seluruh hukuman/denda yang diterima.',
    satire: 'Pengampunan diberikan kepada yang tahu siapa harus ditelepon.',
    target: 'none',
    drawValue: 0,
    outOfTurn: true,
    stackable: false,
  },

  /* — Propaganda & Manipulasi Opini — */
  {
    id: 'buzzer_rp',
    index: 15,
    name: 'Buzzer Rp / Serangan Siber',
    category: 'propaganda',
    colors: ['red', 'blue'],
    copiesPerColor: 1,
    badge: 'MUTE',
    iconKey: 'megaphone_x',
    animal: 'ular_izin',
    effect:
      'Bungkam 1 pemain selama 2 turn. Ia hanya boleh mengeluarkan kartu angka standar.',
    satire: 'Seribu akun, satu naskah, tarif per kicauan.',
    target: 'player',
    drawValue: 0,
    outOfTurn: false,
    stackable: false,
  },
  {
    id: 'janji_kampanye',
    index: 16,
    name: 'Janji Kampanye Manis',
    category: 'propaganda',
    colors: ['blue'],
    copiesPerColor: 2,
    badge: '+5',
    iconKey: 'podium',
    animal: 'buaya_lobi',
    effect:
      'Tentukan 1 warna baru. Semua pemain lain yang TIDAK punya warna itu harus draw 5 kartu.',
    satire: 'Janji hari ini, amnesia besok pagi.',
    target: 'color',
    drawValue: 0,
    outOfTurn: false,
    stackable: false,
  },
  {
    id: 'kudeta_dewan',
    index: 17,
    name: 'Kudeta Dewan Pembina',
    category: 'propaganda',
    colors: ['black'],
    copiesPerColor: 1,
    badge: 'ACAK',
    iconKey: 'chairs',
    animal: 'banteng_dewan',
    effect: 'Urutan duduk seluruh pemain di room diacak.',
    satire: 'Rotasi jabatan. Orangnya sama, kursinya beda.',
    target: 'none',
    drawValue: 0,
    outOfTurn: false,
    stackable: false,
  },

  /* — Penangkal — */
  {
    id: 'bantahan',
    index: 18,
    name: 'Ketiadaan Respon / Bantahan',
    category: 'korupsi',
    colors: ['red', 'yellow', 'green', 'blue'],
    copiesPerColor: 1,
    badge: 'NOL',
    iconKey: 'shield_void',
    animal: 'serigala_jubah',
    effect:
      'Menolak +50 (Tagihan Pajak Misterius) yang menimpamu. Stack berhenti dan tidak ada yang draw.',
    satire: 'Kami belum menerima surat dimaksud. Sekian dan terima kasih.',
    target: 'none',
    drawValue: 0,
    outOfTurn: true,
    stackable: false,
  },
];

export const SPECIAL_BY_ID: Record<SpecialCardId, SpecialCardDefinition> = Object.fromEntries(
  SPECIAL_CARDS.map((c) => [c.id, c]),
) as Record<SpecialCardId, SpecialCardDefinition>;

/* ───────────────────────── Aksi Standar UNO ───────────────────────── */

export const ACTION_CARDS: {
  id: ActionCardId;
  name: string;
  badge: string;
  effect: string;
  copiesPerColor: number;
  drawValue: number;
}[] = [
  { id: 'skip', name: 'Skip Sidang', badge: 'SKIP', effect: 'Pemain berikutnya dilewati.', copiesPerColor: 2, drawValue: 0 },
  { id: 'reverse', name: 'Putar Haluan', badge: 'BALIK', effect: 'Arah putaran dibalik.', copiesPerColor: 2, drawValue: 0 },
  { id: 'draw_two', name: 'Denda Ringan', badge: '+2', effect: 'Korban draw 2. Bisa di-stack.', copiesPerColor: 2, drawValue: 2 },
];

/** Kartu angka: 0 sekali, 1-9 dua kali per warna. */
export const NUMBER_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const numberCopies = (value: number) => (value === 0 ? 1 : 2);

/* ───────────────────────── Stack Draw ───────────────────────── */

/** Nilai draw untuk setiap kartu yang boleh ditumpuk. */
export const STACK_VALUES: Record<string, number> = {
  draw_two: 2,
  denda_birokrasi: 20,
  pajak_misterius: 50,
  inflasi_gila: 100,
};

/* ───────────────────────── Generator Deck ───────────────────────── */

/**
 * Membuat deck lengkap (belum diacak). Pengacakan ada di
 * `lib/game-logic/deckGenerator.ts`.
 */
export function createFullDeck(): Card[] {
  const deck: Card[] = [];
  let n = 0;
  const uid = () => `c${(n++).toString(36)}`;

  for (const color of PLAYABLE_COLORS) {
    for (const value of NUMBER_VALUES) {
      for (let i = 0; i < numberCopies(value); i++) {
        deck.push({ uid: uid(), defId: `n_${color}_${value}`, kind: 'number', color, value });
      }
    }
    for (const a of ACTION_CARDS) {
      for (let i = 0; i < a.copiesPerColor; i++) {
        deck.push({ uid: uid(), defId: `a_${color}_${a.id}`, kind: 'action', color, action: a.id });
      }
    }
  }

  for (const def of SPECIAL_CARDS) {
    for (const color of def.colors) {
      for (let i = 0; i < def.copiesPerColor; i++) {
        deck.push({ uid: uid(), defId: `s_${def.id}`, kind: 'special', color, special: def.id });
      }
    }
  }
  return deck;
}

/** Judul tema pendek untuk tooltip kartu. */
export const CATEGORY_LABEL = {
  penindasan: 'Aksi Penindasan',
  regulasi: 'Manipulasi Regulasi',
  korupsi: 'Korupsi & Transaksi Gelap',
  propaganda: 'Propaganda & Opini',
} as const;

export const ALL_PLAYABLE: CardColor[] = ALL4;
