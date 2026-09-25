// 通信：PeerJS（WebRTC）。ホストが中継し、全員の状態をまとめる
/* global Peer */
const PREFIX = 'jpcraft-';
const ICE = { config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] } };

export class Net {
  constructor() { this.peer = null; this.conns = new Map(); this.isHost = false; this.id = null; this.on = {}; }
  emit(ev, ...a) { this.on[ev]?.(...a); }
  // 部屋を作る
  host() {
    return new Promise((res, rej) => {
      const code = Math.random().toString(36).slice(2, 8);
      this.peer = new Peer(PREFIX + code, ICE);
      this.isHost = true; this.id = 'h';
      this.peer.on('open', () => res(code));
      this.peer.on('error', e => { this.emit('error', e); rej(e); });
      this.peer.on('connection', c => {
        c.on('open', () => { this.conns.set(c.peer, c); this.emit('join', c.peer); });
        c.on('data', d => this.emit('msg', c.peer, d));
        const bye = () => { if (this.conns.delete(c.peer)) this.emit('leave', c.peer); };
        c.on('close', bye); c.on('error', bye);
      });
      this.peer.on('disconnected', () => { try { this.peer.reconnect(); } catch (e) { } });
    });
  }
  // 部屋に入る
  join(code) {
    return new Promise((res, rej) => {
      this.peer = new Peer(undefined, ICE); this.isHost = false;
      const t = setTimeout(() => rej(new Error('timeout')), 15000);
      this.peer.on('open', id => {
        this.id = id;
        const c = this.peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        c.on('open', () => { clearTimeout(t); this.conns.set('h', c); res(id); });
        c.on('data', d => this.emit('msg', 'h', d));
        c.on('close', () => this.emit('lost'));
        c.on('error', e => this.emit('lost', e));
      });
      this.peer.on('error', e => { clearTimeout(t); this.emit('error', e); rej(e); });
    });
  }
  send(to, msg) { const c = this.conns.get(to); if (c && c.open) c.send(msg); }
  toHost(msg) { if (this.isHost) this.emit('msg', 'h', msg); else this.send('h', msg); }
  broadcast(msg, except) { for (const [id, c] of this.conns) if (id !== except && c.open) c.send(msg); }
  close() { try { this.peer?.destroy(); } catch (e) { } this.conns.clear(); this.peer = null; }
}
