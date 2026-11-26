import { Emitter } from './Emitter.js';
import { MSG } from '../shared/protocol.js';

// 방장 서버와의 연결. 메시지 종류(t)별로 이벤트를 낸다. 핑에는 자동으로 답한다.
export class Connection extends Emitter {
  constructor(link) {
    super();
    this.link = link;
    this.closed = false;
    link.onMessage((msg) => {
      if (msg?.t === MSG.PING) return link.send({ t: MSG.PONG, at: msg.at });
      this.emit(msg?.t, msg);
    });
    link.onClose(() => {
      this.closed = true;
      this.emit('close');
    });
  }

  send(msg) {
    if (!this.closed) this.link.send(msg);
  }

  close() {
    this.link.close();
  }
}
