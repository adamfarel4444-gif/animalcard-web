import { createServer } from 'http';
import { Server, type Socket } from 'socket.io';
import {
  castVote,
  drawCard,
  interruptCard,
  playCard,
  pressRedAlert,
  startGame,
  tick,
  toClientState,
  type EngineResult,
} from '../src/lib/game-logic/engine';
import type {
  ClientToServerEvents,
  ServerGameState,
  ServerToClientEvents,
  SfxCue,
} from '../src/types/game';
import { RoomManager, isAvatar, sanitizeNickname } from './roomManager';

const PORT = Number(process.env.PORT ?? 4000);
const ORIGINS = (process.env.CLIENT_ORIGIN ?? 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const httpServer = createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('animal-war-card server ok');
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: ORIGINS, methods: ['GET', 'POST'] },
});
type S = Socket<ClientToServerEvents, ServerToClientEvents>;

const rooms = new RoomManager();
const lastTaunt = new Map<string, number>();

function broadcast(g: ServerGameState) {
  for (const p of g.players) {
    if (p.connected) io.to(p.socketId).emit('game_state_update', toClientState(g, p.id));
  }
}

function emitCues(g: ServerGameState, cues: SfxCue[]) {
  for (const c of cues) io.to(g.roomCode).emit('sfx_cue', c);
}

function act(socket: S, run: (g: ServerGameState) => EngineResult) {
  const g = rooms.getBySocket(socket.id);
  if (!g) return void socket.emit('room_error', { message: 'Kamu belum ada di room.' });
  const r = run(g);
  if (!r.ok) return void socket.emit('room_error', { message: r.error ?? 'Aksi ditolak.' });
  emitCues(g, r.cues);
  broadcast(g);
}

function handleLeave(socket: S) {
  const { g, deleted } = rooms.leave(socket.id);
  if (g) {
    void socket.leave(g.roomCode);
    if (!deleted) broadcast(g);
  }
  lastTaunt.delete(socket.id);
}

io.on('connection', (socket) => {
  socket.on('create_room', (p, ack) => {
    const nick = sanitizeNickname(p?.nickname);
    if (!nick) return ack({ ok: false, error: 'Nickname wajib diisi.' });
    if (!isAvatar(p?.avatar)) return ack({ ok: false, error: 'Avatar tidak valid.' });
    const r = rooms.createRoom(socket.id, nick, p.avatar);
    if (!r.ok) return ack({ ok: false, error: r.error });
    void socket.join(r.g.roomCode);
    ack({ ok: true, roomCode: r.g.roomCode });
    broadcast(r.g);
  });

  socket.on('join_room', (p, ack) => {
    const nick = sanitizeNickname(p?.nickname);
    const code = typeof p?.roomCode === 'string' ? p.roomCode.trim().toUpperCase() : '';
    if (!nick) return ack({ ok: false, error: 'Nickname wajib diisi.' });
    if (!isAvatar(p?.avatar)) return ack({ ok: false, error: 'Avatar tidak valid.' });
    if (!/^AWC-\d{4}$/.test(code)) return ack({ ok: false, error: 'Format kode: AWC-1234.' });
    const r = rooms.joinRoom(socket.id, code, nick, p.avatar);
    if (!r.ok) return ack({ ok: false, error: r.error });
    void socket.join(code);
    ack({ ok: true });
    broadcast(r.g);
  });

  socket.on('start_game', () =>
    act(socket, (g) => {
      const me = g.players.find((p) => p.id === socket.id);
      if (!me?.isHost) return { ok: false, error: 'Hanya host yang bisa memulai.', cues: [] };
      return startGame(g, Date.now());
    }),
  );
  socket.on('play_card', (p) => act(socket, (g) => playCard(g, socket.id, p ?? ({} as never), Date.now())));
  socket.on('interrupt_card', (p) => act(socket, (g) => interruptCard(g, socket.id, String(p?.cardUid), Date.now())));
  socket.on('draw_card', () => act(socket, (g) => drawCard(g, socket.id, Date.now())));
  socket.on('press_red_alert', () => act(socket, (g) => pressRedAlert(g, socket.id)));
  socket.on('cast_vote', (p) => act(socket, (g) => castVote(g, socket.id, String(p?.targetPlayerId), Date.now())));

  socket.on('send_taunt', (p) => {
    const g = rooms.getBySocket(socket.id);
    const id = typeof p?.tauntId === 'string' ? p.tauntId.slice(0, 32) : '';
    const now = Date.now();
    if (!g || !id || now - (lastTaunt.get(socket.id) ?? 0) < 1000) return;
    lastTaunt.set(socket.id, now);
    io.to(g.roomCode).emit('taunt', { fromId: socket.id, tauntId: id });
  });

  socket.on('leave_room', () => handleLeave(socket));
  socket.on('disconnect', () => handleLeave(socket));
});

// Timer server: giliran 7 detik, Red Alert 1.5 detik, voting.
setInterval(() => {
  const now = Date.now();
  for (const g of rooms.all()) {
    if (g.phase !== 'playing') continue;
    const r = tick(g, now);
    if (r.changed) {
      emitCues(g, r.cues);
      broadcast(g);
    }
  }
}, 250);

httpServer.listen(PORT, () => {
  console.log(`[awc] server listening on :${PORT}, origins: ${ORIGINS.join(', ')}`);
});
