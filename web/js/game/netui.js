// Network play UI: the status line / invitation in the pause menu (host), connection info on the loading screen
// (guest).
import { $ } from './dom.js';

export function createNetUI(ctx) {
  const { msg } = ctx;

  // ================== network play (net.js) ==================
  // status line / invitation in the pause menu (host), connection info on the loading screen (guest)
  const netUI = {
    status(text) { const el = $('netStatus'); el.textContent = text || ''; el.style.display = text ? 'block' : 'none'; },
    panel(html) { const el = $('netPanel'); el.innerHTML = html; el.classList.toggle('hidden', !html); return el; },
    hostRoom(room) {
      this.panel(`<h3>Сетевая игра</h3><p>Код комнаты: <b class="code">${room}</b></p>` +
        `<p class="small">Второй игрок: главное меню → «Сетевая игра» → «Присоединиться» → этот код.</p>`);
      this.status(`Сеть: ждём второго игрока · код комнаты ${room}`);
    },
    hostCode(code, onAnswer) {
      const el = this.panel(`<h3>Сетевая игра</h3>
        <p class="small">1. Передай второму игроку код-приглашение (он вводит его в меню «Сетевая игра → Присоединиться»):</p>
        <textarea readonly id="netOffer">${code}</textarea><button id="netCopy">Копировать</button>
        <p class="small">2. Вставь код ответа, который он пришлёт:</p>
        <textarea id="netAnswer" placeholder="код ответа"></textarea><button id="netAccept">Подключить</button>`);
      el.querySelector('#netCopy').onclick = e => { e.stopPropagation(); copyText(code); };
      el.querySelector('#netAccept').onclick = e => { e.stopPropagation(); onAnswer(el.querySelector('#netAnswer').value); };
      el.onclick = e => e.stopPropagation();
      this.status('Сеть: ждём второго игрока — приглашение в меню паузы (ESC)');
    },
    guestWait(code) {
      const el = $('netJoin');
      el.classList.remove('hidden');
      if (!code) { el.innerHTML = '<p>Ждём ответа хозяина игры...</p>'; return; }
      el.innerHTML = `<p class="small">Передай хозяину игры этот код ответа (он вставляет его в меню паузы):</p>
        <textarea readonly>${code}</textarea><button id="netCopy2">Копировать</button><p class="small">Ждём подключения...</p>`;
      el.querySelector('#netCopy2').onclick = () => copyText(code);
    },
    connected() {
      $('netJoin').classList.add('hidden');
      this.panel(`<h3>Сетевая игра</h3><p>Второй игрок в игре.</p>`);
    },
  };
  function copyText(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => msg('Скопировано'), () => {});
  }

  return { netUI };
}
