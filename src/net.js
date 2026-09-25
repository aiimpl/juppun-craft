// 通信：PeerJS（WebRTC）。ホストが中継し、全員の状態をまとめる
/* global Peer */
const PREFIX = 'jpcraft1-';
const ICE = { config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] } };

export class Net {
  constructor() { this.peer = null; this.conns = new Map(); this.isHost = false; this.id = null; this.on = {}; }
  emit(ev, ...a) { this.on[ev]?.(...a); }
  // 部屋を作る（code を指定すればその番号で。使われていれば 'unavailable-id' で失敗）
  host(code = Math.random().toString(36).slice(2, 8)) {
    return new Promise((res, rej) => {
      const peer = this.peer = new Peer(PREFIX + code, ICE);
      this.isHost = true; this.id = 'h';
      let opened = false;
      peer.on('open', () => { opened = true; res(code); });
      peer.on('error', e => { if (!opened) { try { peer.destroy(); } catch (x) { } rej(e); } else this.emit('error', e); });
      peer.on('connection', c => {
        c.on('open', () => { this.conns.set(c.peer, c); this.emit('join', c.peer); });
        c.on('data', d => this.emit('msg', c.peer, d));
        const bye = () => { if (this.conns.delete(c.peer)) this.emit('leave', c.peer); };
        c.on('close', bye); c.on('error', bye);
      });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { } });
    });
  }
  // 部屋に入る（部屋がなければ 'peer-unavailable' で失敗）
  join(code, timeout = 12000) {
    return new Promise((res, rej) => {
      const peer = this.peer = new Peer(undefined, ICE); this.isHost = false;
      let done = false;
      const fail = e => { if (done) return; done = true; clearTimeout(t); try { peer.destroy(); } catch (x) { } rej(e); };
      const t = setTimeout(() => fail({ type: 'timeout' }), timeout);
      peer.on('open', id => {
        this.id = id;
        const c = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        c.on('open', () => { if (done) return; done = true; clearTimeout(t); this.conns.set('h', c); res(id); });
        c.on('data', d => this.emit('msg', 'h', d));
        c.on('close', () => { if (done) this.emit('lost'); });
        c.on('error', e => { if (done) this.emit('lost', e); else fail(e); });
      });
      peer.on('error', e => { if (!done) fail(e); else this.emit('error', e); });
    });
  }
  // だれでも参加：公開部屋を一度に訪ね、入れる部屋を探す。見つからなければ空き番号を返す
  quick(codes, hello, pass) {
    return new Promise(async (res) => {
      const peer = this.peer = new Peer(undefined, ICE); this.isHost = false;
      await new Promise(r => peer.on('open', id => { this.id = id; r(); }));
      const state = new Map(codes.map(c => [c, 'wait'])), conns = new Map();
      let finished = false;
      const finish = (v) => {
        if (finished) return; finished = true;
        for (const [code, c] of conns) if (!v.code || code !== v.code) { try { c.close(); } catch (e) { } }
        if (!v.code) { try { peer.destroy(); } catch (e) { } this.peer = null; }
        res(v);
      };
      const check = () => {
        if (finished) return;
        // 番号の小さい順に：入れる部屋があればそこ、まだ返事待ちがあれば待つ
        for (const code of codes) {
          const st = state.get(code);
          if (st === 'wait') return;
          if (st?.welcome) {
            const c = conns.get(code); c.removeAllListeners('data');
            this.conns.set('h', c);
            c.on('data', d => this.emit('msg', 'h', d));
            c.on('close', () => this.emit('lost')); c.on('error', e => this.emit('lost', e));
            return finish({ code, welcome: st.welcome });
          }
        }
        finish({ empty: codes.find(c => state.get(c) === 'none') || null });
      };
      peer.on('error', e => {
        if (e.type !== 'peer-unavailable') return;
        const code = codes.find(c => String(e.message).endsWith(PREFIX + c));
        if (code && state.get(code) === 'wait') { state.set(code, 'none'); check(); }
      });
      for (const code of codes) {
        const c = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' }); conns.set(code, c);
        c.on('open', () => c.send({ ...hello, quick: pass }));
        c.on('data', d => {
          if (d.t === 'welcome') { state.set(code, { welcome: d }); check(); }
          else if (d.t === 'full') { state.set(code, 'full'); try { c.close(); } catch (e) { } check(); }
        });
      }
      // 返事がない部屋は、閉じかけの部屋として飛ばす
      setTimeout(() => { for (const c of codes) if (state.get(c) === 'wait') state.set(c, 'timeout'); check(); }, 6000);
    });
  }
  send(to, msg) { const c = this.conns.get(to); if (c && c.open) c.send(msg); }
  broadcast(msg, except) { for (const [id, c] of this.conns) if (id !== except && c.open) c.send(msg); }
  kick(id) { const c = this.conns.get(id); this.conns.delete(id); setTimeout(() => { try { c?.close(); } catch (e) { } }, 300); }
  close() { this.on = {}; try { this.peer?.destroy(); } catch (e) { } this.conns.clear(); this.peer = null; }
}

// あいことば → 部屋番号（同じ言葉なら同じ番号）
export function codeFromWord(word) {
  const s = word.normalize('NFKC').trim().toLowerCase();
  let h1 = 0x811c9dc5, h2 = 0x1234567;
  for (const ch of s) { const c = ch.codePointAt(0); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 ^ c, 2246822519) >>> 0; }
  return 'w' + h1.toString(36) + h2.toString(36).slice(0, 4);
}
export const PUBLIC_SLOTS = 12;
