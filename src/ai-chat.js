(() => {
  const rootId = 'vn-ai-chat-root';
  if (document.getElementById(rootId)) return;

  const suggestions = [
    'ベトナム市場の特徴を教えて',
    '競合調査では何が分かりますか？',
    '調査レポートのサンプルを見たい',
  ];
  const answers = new Map([
    [
      suggestions[0],
      'ベトナムでは、若い人口構成や都市部を中心とした消費市場の拡大など、複数の市場変化が見られます。\n\nVN Insight AIでは、公開情報だけでなく、競合・価格・流通チャネル・現地情報などを整理し、意思決定に使いやすい形でまとめます。',
    ],
    [
      suggestions[1],
      '競合企業のサービス内容、価格帯、ターゲット、販売チャネル、訴求ポイントなどを整理できます。\n\nさらに現地情報と組み合わせることで、日本からのWeb調査だけでは把握しにくい市場状況も確認できます。',
    ],
    [
      suggestions[2],
      'VN Insight AIでは、調査目的に応じて市場概要、競合比較、現地情報、示唆などを整理したレポートを想定しています。\n\nこのサイトはポートフォリオ用デモのため、現在はサンプル表示です。\n\n詳しいサービス内容はページ内をご覧ください。',
    ],
  ]);
  const freeAnswer =
    'ご質問ありがとうございます。\n\nこのチャットはポートフォリオ用のAIアシスタントデモです。\n\n実際のサービスでは、ベトナム市場・競合・現地情報などをもとにリサーチ結果を整理する想定です。\n\n上のサンプル質問もお試しください。';

  const root = document.createElement('div');
  root.id = rootId;
  root.className = 'vn-ai-chat-root';
  root.innerHTML = `
    <button
      class="vn-ai-chat-launcher"
      type="button"
      aria-label="VN Insight AIチャットを開く"
      aria-expanded="false"
      aria-controls="vn-ai-chat-panel"
    >
      <span class="vn-ai-chat-launcher-icon" aria-hidden="true">✦</span>
      <span class="vn-ai-chat-launcher-label">AIに質問</span>
    </button>
    <section
      class="vn-ai-chat-panel"
      id="vn-ai-chat-panel"
      role="region"
      aria-labelledby="vn-ai-chat-title"
      aria-hidden="true"
      hidden
      inert
    >
      <header class="vn-ai-chat-header">
        <div class="vn-ai-chat-heading">
          <h2 class="vn-ai-chat-title" id="vn-ai-chat-title">VN Insight AI</h2>
          <p class="vn-ai-chat-subtitle">AI Research Assistant</p>
        </div>
        <span class="vn-ai-chat-demo-badge">DEMO</span>
        <button class="vn-ai-chat-close" type="button" aria-label="チャットを閉じる">
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <div
        class="vn-ai-chat-messages"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="チャットメッセージ"
      >
        <div class="vn-ai-chat-message vn-ai-chat-message-assistant">
          <p class="vn-ai-chat-message-text">こんにちは。VN Insight AIです。\nベトナム市場について何をお調べしますか？</p>
        </div>
        <div class="vn-ai-chat-suggestions" role="group" aria-label="質問候補">
          ${suggestions
            .map(
              (question, index) => `
                <button class="vn-ai-chat-suggestion" type="button" data-vn-ai-chat-suggestion="${index}">
                  ${question}
                </button>`,
            )
            .join('')}
        </div>
      </div>
      <form class="vn-ai-chat-form">
        <label class="vn-ai-chat-sr-only" for="vn-ai-chat-input">質問を入力</label>
        <input
          class="vn-ai-chat-input"
          id="vn-ai-chat-input"
          name="message"
          type="text"
          placeholder="ベトナム市場について質問する"
          autocomplete="off"
        >
        <button class="vn-ai-chat-send" type="submit" aria-label="メッセージを送信">
          送信
        </button>
      </form>
    </section>
  `;
  document.body.append(root);

  const launcher = root.querySelector('.vn-ai-chat-launcher');
  const launcherLabel = root.querySelector('.vn-ai-chat-launcher-label');
  const panel = root.querySelector('.vn-ai-chat-panel');
  const closeButton = root.querySelector('.vn-ai-chat-close');
  const messages = root.querySelector('.vn-ai-chat-messages');
  const suggestionButtons = [...root.querySelectorAll('.vn-ai-chat-suggestion')];
  const form = root.querySelector('.vn-ai-chat-form');
  const input = root.querySelector('.vn-ai-chat-input');
  const sendButton = root.querySelector('.vn-ai-chat-send');
  const mobileQuery = window.matchMedia('(max-width: 767px)');
  const activeTimers = new Set();
  let isOpen = false;
  let isComposing = false;
  let imeEnterGuard = false;
  let isBusy = false;
  let hasCompactLauncher = false;
  let hidePanelTimer = null;
  let mobileShrinkTimer = null;
  let panelOpenFrame = null;
  let mobileScrollListener = null;
  let isCleanedUp = false;

  const schedule = (callback, delay) => {
    const timer = window.setTimeout(() => {
      activeTimers.delete(timer);
      callback();
    }, delay);
    activeTimers.add(timer);
    return timer;
  };

  const clearScheduled = (timer) => {
    if (timer === null) return;
    window.clearTimeout(timer);
    activeTimers.delete(timer);
  };

  const scrollMessagesToLatest = () => {
    messages.scrollTop = messages.scrollHeight;
  };

  const setBusy = (busy) => {
    isBusy = busy;
    input.disabled = busy;
    sendButton.disabled = busy;
    suggestionButtons.forEach((button) => {
      button.disabled = busy;
    });
    form.setAttribute('aria-busy', String(busy));
  };

  const appendMessage = (text, sender) => {
    const message = document.createElement('div');
    message.className = `vn-ai-chat-message vn-ai-chat-message-${sender}`;
    const paragraph = document.createElement('p');
    paragraph.className = 'vn-ai-chat-message-text';
    paragraph.textContent = text;
    message.append(paragraph);
    messages.append(message);
    scrollMessagesToLatest();
    return message;
  };

  const showTypingIndicator = () => {
    const message = document.createElement('div');
    message.className = 'vn-ai-chat-message vn-ai-chat-message-assistant vn-ai-chat-typing';
    message.innerHTML = `
      <span class="vn-ai-chat-sr-only">回答を作成中</span>
      <span class="vn-ai-chat-typing-dots" aria-hidden="true">
        <span></span><span></span><span></span>
      </span>
    `;
    messages.append(message);
    scrollMessagesToLatest();
    return message;
  };

  const sendMessage = (question, answer) => {
    if (isBusy) return;
    appendMessage(question, 'user');
    setBusy(true);
    schedule(() => {
      const typing = showTypingIndicator();
      schedule(() => {
        const response = document.createElement('div');
        response.className = 'vn-ai-chat-message vn-ai-chat-message-assistant';
        const paragraph = document.createElement('p');
        paragraph.className = 'vn-ai-chat-message-text';
        paragraph.textContent = answer;
        response.append(paragraph);
        typing.replaceWith(response);
        scrollMessagesToLatest();
        setBusy(false);
      }, 850);
    }, 180);
  };

  const openPanel = () => {
    if (isOpen || root.inert) return;
    clearScheduled(hidePanelTimer);
    hidePanelTimer = null;
    isOpen = true;
    launcher.setAttribute('aria-expanded', 'true');
    panel.hidden = false;
    panel.inert = false;
    panel.setAttribute('aria-hidden', 'false');
    if (panelOpenFrame !== null) cancelAnimationFrame(panelOpenFrame);
    panelOpenFrame = requestAnimationFrame(() => {
      panelOpenFrame = null;
      if (isOpen) panel.classList.add('vn-ai-chat-panel-open');
    });
    closeButton.focus();
  };

  const closePanel = (restoreFocus = true) => {
    if (!isOpen) return;
    isOpen = false;
    launcher.setAttribute('aria-expanded', 'false');
    panel.inert = true;
    panel.setAttribute('aria-hidden', 'true');
    if (panelOpenFrame !== null) {
      cancelAnimationFrame(panelOpenFrame);
      panelOpenFrame = null;
    }
    panel.classList.remove('vn-ai-chat-panel-open');
    clearScheduled(hidePanelTimer);
    hidePanelTimer = schedule(() => {
      panel.hidden = true;
      hidePanelTimer = null;
    }, 180);
    if (restoreFocus && !root.inert) launcher.focus();
  };

  const stopMobileShrinkProcess = () => {
    clearScheduled(mobileShrinkTimer);
    mobileShrinkTimer = null;
    if (mobileScrollListener) {
      window.removeEventListener('scroll', mobileScrollListener);
      mobileScrollListener = null;
    }
  };

  const compactLauncher = () => {
    if (hasCompactLauncher) return;
    hasCompactLauncher = true;
    launcherLabel.textContent = 'AIチャット';
    launcher.classList.add('vn-ai-chat-launcher-compact');
    stopMobileShrinkProcess();
  };

  const startMobileShrinkProcess = () => {
    stopMobileShrinkProcess();
    if (!mobileQuery.matches) {
      launcherLabel.textContent = 'AIに質問';
      launcher.classList.remove('vn-ai-chat-launcher-compact');
      return;
    }
    if (hasCompactLauncher) {
      launcherLabel.textContent = 'AIチャット';
      launcher.classList.add('vn-ai-chat-launcher-compact');
      return;
    }

    const initialScrollY = window.scrollY;
    mobileScrollListener = () => {
      if (Math.abs(window.scrollY - initialScrollY) >= 10) compactLauncher();
    };
    window.addEventListener('scroll', mobileScrollListener, { passive: true });
    mobileShrinkTimer = schedule(compactLauncher, 5000);
  };

  const handleViewportChange = () => {
    startMobileShrinkProcess();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isBusy || isComposing || imeEnterGuard || event.isComposing) return;
    const question = input.value.trim();
    if (!question) return;
    input.value = '';
    sendMessage(question, freeAnswer);
  };

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    imeEnterGuard = isComposing || event.isComposing || event.keyCode === 229;
    if (imeEnterGuard) schedule(() => {
      imeEnterGuard = false;
    }, 0);
  };

  const handleEscape = (event) => {
    if (event.key === 'Escape' && isOpen) closePanel();
  };

  const handleModalState = () => {
    const modalIsOpen = document.body.classList.contains('overflow-hidden');
    root.inert = modalIsOpen;
    if (modalIsOpen) closePanel(false);
  };

  const handlePageHide = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    stopMobileShrinkProcess();
    activeTimers.forEach((timer) => window.clearTimeout(timer));
    activeTimers.clear();
    if (panelOpenFrame !== null) cancelAnimationFrame(panelOpenFrame);
    mobileQuery.removeEventListener('change', handleViewportChange);
    document.removeEventListener('keydown', handleEscape);
    modalObserver.disconnect();
    window.removeEventListener('pagehide', handlePageHide);
  };

  launcher.addEventListener('click', () => {
    if (isOpen) closePanel();
    else openPanel();
  });
  closeButton.addEventListener('click', () => closePanel());
  document.addEventListener('keydown', handleEscape);
  suggestionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const question = suggestions[Number(button.dataset.vnAiChatSuggestion)];
      if (question) sendMessage(question, answers.get(question));
    });
  });
  form.addEventListener('submit', handleSubmit);
  input.addEventListener('compositionstart', () => {
    isComposing = true;
  });
  input.addEventListener('compositionend', () => {
    isComposing = false;
    imeEnterGuard = false;
  });
  input.addEventListener('keydown', handleKeyDown);

  const modalObserver = new MutationObserver(handleModalState);
  modalObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  handleModalState();
  mobileQuery.addEventListener('change', handleViewportChange);
  window.addEventListener('pagehide', handlePageHide, { once: true });
  startMobileShrinkProcess();
})();
