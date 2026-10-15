import { AVATARS } from '../src/lib/constants/cardsData';
import { createLobby, logEvent, makePlayer } from '../src/lib/game-logic/engine';
import { RULES, type AvatarId, type ServerGameState } from '../src/types/game';

type Result = { ok: true; g: ServerGameState } | { ok: false; error: string };

export function sanitizeNickname(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, RULES.NICKNAME_MAX);
}

export function isAvatar(v: unknown): v is AvatarId {
  return typeof v === 'string' && AVATARS.some((a) => a.id === v);
}

export class RoomManager {
  private rooms = new Map<string, ServerGameState>();
  private socketRoom = new Map<string, string>();

  all(): IterableIterator<ServerGameState> {
    return this.rooms.values();
  }

  get(code: string): ServerGameState | undefined {
    return this.rooms.get(code);
  }

  getBySocket(socketId: string): ServerGameState | undefined {
    const code = this.socketRoom.get(socketId);
    return code ? this.rooms.get(code) : undefined;
  }

  private newCode(): string | null {
    for (let i = 0; i < 60; i++) {
      const code = `AWC-${1000 + Math.floor(Math.random() * 9000)}`;
      if (!this.rooms.has(code)) return code;
    }
    return null;
  }

  createRoom(socketId: string, nickname: string, avatar: AvatarId): Result {
    if (this.socketRoom.has(socketId)) return { ok: false, error: 'Kamu sudah ada di sebuah room.' };
    const code = this.newCode();
    if (!code) return { ok: false, error: 'Server penuh, coba lagi sebentar.' };
    const g = createLobby(code);
    g.players.push(makePlayer(socketId, nickname, avatar, true));
    this.rooms.set(code, g);
    this.socketRoom.set(socketId, code);
    logEvent(g, 'info', `${nickname} membuka room ${code}.`);
    return { ok: true, g };
  }

  joinRoom(socketId: string, code: string, nickname: string, avatar: AvatarId): Result {
    if (this.socketRoom.has(socketId)) return { ok: false, error: 'Kamu sudah ada di sebuah room.' };
    const g = this.rooms.get(code);
    if (!g) return { ok: false, error: 'Room tidak ditemukan.' };
    if (g.phase === 'playing') return { ok: false, error: 'Game sudah berjalan.' };
    const active = g.players.filter((p) => p.connected);
    if (active.length >= RULES.MAX_PLAYERS) return { ok: false, error: 'Room penuh (maks 8 pemain).' };
    if (active.some((p) => p.nickname.toLowerCase() === nickname.toLowerCase())) {
      return { ok: false, error: 'Nickname sudah dipakai di room ini.' };
    }
    g.players.push(makePlayer(socketId, nickname, avatar, false));
    this.socketRoom.set(socketId, code);
    logEvent(g, 'info', `${nickname} masuk sidang.`);
    return { ok: true, g };
  }

  leave(socketId: string): { g: ServerGameState | null; deleted: boolean } {
    const code = this.socketRoom.get(socketId);
    if (!code) return { g: null, deleted: false };
    this.socketRoom.delete(socketId);
    const g = this.rooms.get(code);
    if (!g) return { g: null, deleted: false };

    const i = g.players.findIndex((p) => p.socketId === socketId);
    if (i < 0) return { g, deleted: false };
    const p = g.players[i];

    if (g.phase === 'playing') {
      p.connected = false; // tetap di kursi; giliran otomatis ditangani tick()
    } else {
      g.players.splice(i, 1);
    }
    if (p.isHost) {
      p.isHost = false;
      const next = g.players.find((x) => x.connected);
      if (next) next.isHost = true;
    }
    logEvent(g, 'info', `${p.nickname} meninggalkan room.`);

    const connected = g.players.filter((x) => x.connected);
    if (connected.length === 0) {
      this.rooms.delete(code);
      return { g, deleted: true };
    }
    if (g.phase === 'playing' && connected.length === 1) {
      g.phase = 'finished';
      g.winnerId = connected[0].id;
      g.turnDeadline = null;
      g.vote = null;
      logEvent(g, 'win', `${connected[0].nickname} menang karena semua lawan kabur.`);
    }
    return { g, deleted: false };
  }
}
