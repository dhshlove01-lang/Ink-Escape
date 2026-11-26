// 서비스 워커 — 배포 직후에도 옛 화면이 절대 안 뜨게.
// 1) 이 사이트 파일은 받을 때마다 서버에 "바뀌었나?" 물어본다 (cache: 'no-cache'). 안 바뀌었으면 304 라 가볍다.
//    (GitHub Pages 는 파일을 10분 동안 캐시한다.)
// 2) 'v/<배포시각>/…' 주소는 진짜 파일 '…' 로 바꿔 준다. index.html 이 코드(src/·style.css)를 이 주소로 불러서
//    배포마다 주소가 새로워진다 → 브라우저 메모리 캐시(서비스 워커보다 앞에 있음)에 남은 옛 코드가 쓰일 수 없다.
//    응답을 새로 감싸서(new Response) 모듈의 기준 주소가 v/… 로 남게 한다 → 안쪽 import 도 전부 v/… 로 받는다.
// 이 파일은 되도록 고치지 않는다.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

const VER = /^v\/\d+\//;

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' && req.method !== 'HEAD') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 다른 사이트(PeerJS 서버 등)는 손대지 않음
  const scope = self.registration.scope;
  const rel = req.url.startsWith(scope) ? req.url.slice(scope.length) : '';
  if (VER.test(rel)) {
    const real = scope + rel.replace(VER, '');
    e.respondWith(
      fetch(real, { cache: 'no-cache', credentials: 'same-origin' }).then((r) =>
        new Response(r.body, { status: r.status, statusText: r.statusText, headers: r.headers }),
      ),
    );
    return;
  }
  if (req.cache === 'no-store' || req.cache === 'reload') return; // 이미 새로 받는 요청
  const fresh = req.mode === 'navigate' ? fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }) : fetch(new Request(req, { cache: 'no-cache' }));
  e.respondWith(fresh.catch(() => fetch(req)));
});
