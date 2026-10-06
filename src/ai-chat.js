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

/* VN Insight AI multilingual layer */
(() => {
  const STORAGE_KEY = 'vnInsightLanguage';
  const SUPPORTED = ['ja', 'en', 'vi', 'zh', 'ko', 'es', 'fr'];
  const LABELS = { ja: '日本語', en: 'English', vi: 'Tiếng Việt', zh: '简体中文', ko: '한국어', es: 'Español', fr: 'Français' };
  const DISPLAY_CODES = { ja: 'JP', en: 'EN', vi: 'VN', zh: 'CN', ko: 'KR', es: 'ES', fr: 'FR' };
  const FONT_STACKS = {
    ja: '"Noto Sans JP", "Plus Jakarta Sans", sans-serif',
    zh: '"Noto Sans SC", "Noto Sans JP", sans-serif',
    ko: '"Noto Sans KR", "Noto Sans JP", sans-serif',
    en: '"Plus Jakarta Sans", "Noto Sans", sans-serif',
    vi: '"Plus Jakarta Sans", "Noto Sans", sans-serif',
    es: '"Plus Jakarta Sans", "Noto Sans", sans-serif',
    fr: '"Plus Jakarta Sans", "Noto Sans", sans-serif',
  };
  const seo = {
    ja: ['VN Insight AI｜ベトナム進出を支援するAIリサーチサービス', 'ベトナム進出を検討する中小企業向けのAIリサーチサービス「VN Insight AI」のデモLP。市場調査・競合分析・現地情報の整理を効率化します。'],
    en: ['VN Insight AI | AI Research for Entering Vietnam', 'VN Insight AI helps SMEs explore the Vietnamese market by organizing market research, competitor analysis, and locally verified information.'],
    vi: ['VN Insight AI | Nghiên cứu AI hỗ trợ thâm nhập Việt Nam', 'VN Insight AI hỗ trợ doanh nghiệp vừa và nhỏ nghiên cứu thị trường Việt Nam, phân tích đối thủ và tổng hợp thông tin được xác minh tại địa phương.'],
    zh: ['VN Insight AI｜助力企业进入越南的AI调研服务', 'VN Insight AI面向计划进入越南市场的中小企业，提供市场调研、竞品分析与本地信息整理服务。'],
    ko: ['VN Insight AI | 베트남 진출을 지원하는 AI 리서치', 'VN Insight AI는 베트남 진출을 검토하는 중소기업을 위해 시장 조사, 경쟁사 분석, 현지 검증 정보를 체계적으로 제공합니다.'],
    es: ['VN Insight AI | Investigación con IA para entrar en Vietnam', 'VN Insight AI ayuda a pymes a estudiar el mercado vietnamita mediante investigación de mercado, análisis competitivo e información verificada localmente.'],
    fr: ['VN Insight AI | Recherche IA pour réussir au Vietnam', 'VN Insight AI aide les PME à étudier le marché vietnamien grâce à la recherche de marché, l’analyse concurrentielle et des informations vérifiées localement.'],
  };

  const rows = [
    ['選ばれる理由','Why us','Lý do lựa chọn','选择我们的理由','선택받는 이유','Por qué elegirnos','Pourquoi nous choisir'],
    ['機能','Features','Tính năng','功能','기능','Funciones','Fonctionnalités'],
    ['ご利用の流れ','How it works','Quy trình','使用流程','이용 절차','Cómo funciona','Fonctionnement'],
    ['他社比較','Comparison','So sánh','对比','비교','Comparativa','Comparatif'],
    ['よくある質問','FAQ','Câu hỏi thường gặp','常见问题','자주 묻는 질문','Preguntas frecuentes','Questions fréquentes'],
    ['無料でサンプルを見る','View a free sample','Xem mẫu miễn phí','免费查看样本','무료 샘플 보기','Ver una muestra gratis','Voir un exemple gratuit'],
    ['サンプルレポートを見る','View sample report','Xem báo cáo mẫu','查看样本报告','샘플 보고서 보기','Ver informe de muestra','Voir le rapport exemple'],
    ['ベトナム市場特化型・次世代海外リサーチプラットフォーム','Next-generation research platform built for the Vietnamese market','Nền tảng nghiên cứu thế hệ mới chuyên sâu về thị trường Việt Nam','专注越南市场的新一代海外调研平台','베트남 시장에 특화된 차세대 해외 리서치 플랫폼','Plataforma de investigación de nueva generación especializada en Vietnam','Plateforme de recherche nouvelle génération dédiée au marché vietnamien'],
    ['役員会を動かすのは、','What moves the board is','Điều thuyết phục ban lãnh đạo là','真正推动董事会决策的，是','경영진을 움직이는 것은','Lo que convence al consejo son','Ce qui convainc la direction, ce sont'],
    ['現地で確かめた','locally verified','thông tin được xác minh tại chỗ','经本地核实的','현지에서 확인한','datos verificados localmente','des '],
    ['「一次情報」','“primary-source insights”','“thông tin sơ cấp”','“一手信息”','“1차 정보”','«datos de primera fuente»','«données terrain»'],
    ['だ。','.','.','。','.','.','.'],
    ['AIの圧倒的な演算力と、','Combine the processing power of AI with','Kết hợp sức mạnh xử lý của AI với','融合AI强大的处理能力与','AI의 강력한 처리 능력과','Combinamos la potencia de la IA con','Nous combinons la puissance de l’IA avec'],
    ['ベトナム在住プロの','hands-on verification by professionals in Vietnam.','khả năng kiểm chứng thực tế của chuyên gia tại Việt Nam.','越南当地专业人员的','베트남 현지 전문가의','la verificación práctica de profesionales en Vietnam.','la vérification concrète de professionnels au Vietnam.'],
    ['「泥臭いファクトチェック」を融合。','hands-on fact-checking.','quy trình kiểm chứng thực tế.','务实事实核查。','철저한 팩트체크를 결합합니다.','una verificación rigurosa de los hechos.','une vérification rigoureuse des faits.'],
    ['最短48時間で、','In as little as 48 hours,','Chỉ từ 48 giờ,','最快48小时内，','최단 48시간에','En tan solo 48 horas,','En 48 heures seulement,'],
    ['意思決定に必要な情報を整理。','we organize the information needed to make decisions.','chúng tôi tổng hợp thông tin cần thiết cho việc ra quyết định.','整理决策所需信息。','의사결정에 필요한 정보를 정리합니다.','organizamos la información necesaria para decidir.','nous structurons les informations nécessaires à la décision.'],
    ['ダッシュボード','Dashboard','Bảng điều khiển','仪表板','대시보드','Panel','Tableau de bord'],
    ['業界レポート','Industry reports','Báo cáo ngành','行业报告','산업 보고서','Informes sectoriales','Rapports sectoriels'],
    ['調査プラン','Research plan','Gói nghiên cứu','调研方案','조사 플랜','Plan de investigación','Plan de recherche'],
    ['照合データ','Verified data','Dữ liệu đối chiếu','核验数据','검증 데이터','Datos verificados','Données vérifiées'],
    ['レポート出力','Report export','Xuất báo cáo','报告导出','보고서 출력','Exportar informe','Exporter le rapport'],
    ['設定','Settings','Cài đặt','设置','설정','Configuración','Paramètres'],
    ['ベトナム市場サマリー・ダッシュボード','Vietnam Market Summary Dashboard','Bảng tổng quan thị trường Việt Nam','越南市场概览仪表板','베트남 시장 요약 대시보드','Panel resumen del mercado vietnamita','Tableau de synthèse du marché vietnamien'],
    ['表示データはすべてサンプルです','All displayed data is sample data','Toàn bộ dữ liệu hiển thị là dữ liệu mẫu','所有显示数据均为样本','표시된 데이터는 모두 샘플입니다','Todos los datos mostrados son de ejemplo','Toutes les données affichées sont des exemples'],
    ['GDP成長率','GDP growth','Tăng trưởng GDP','GDP增长率','GDP 성장률','Crecimiento del PIB','Croissance du PIB'],
    ['(サンプル値)','(sample value)','(giá trị mẫu)','（样本值）','(샘플 값)','(valor de ejemplo)','(valeur exemple)'],
    ['総人口','Total population','Tổng dân số','总人口','총인구','Población total','Population totale'],
    ['万人','0,000 people','vạn người','万人','만 명','0.000 personas','dizaines de milliers'],
    ['消費者物価指数','Consumer price index','Chỉ số giá tiêu dùng','消费者价格指数','소비자물가지수','Índice de precios al consumo','Indice des prix à la consommation'],
    ['FDI認可額','Approved FDI','FDI được phê duyệt','获批FDI金额','FDI 승인액','IED aprobada','IDE approuvés'],
    ['億USD','USD 100M','trăm triệu USD','亿美元','억 USD','cientos de millones USD','centaines de millions USD'],
    ['実質GDP成長率の推移','Real GDP growth trend','Xu hướng tăng trưởng GDP thực','实际GDP增长趋势','실질 GDP 성장률 추이','Evolución del crecimiento real del PIB','Évolution de la croissance réelle du PIB'],
    ['産業別GDP構成比(2026)','GDP share by industry (2026)','Cơ cấu GDP theo ngành (2026)','各行业GDP占比（2026）','산업별 GDP 구성비(2026)','Composición del PIB por sector (2026)','Répartition du PIB par secteur (2026)'],
    ['製造業','Manufacturing','Sản xuất','制造业','제조업','Manufactura','Industrie manufacturière'],
    ['卸売・小売','Wholesale & retail','Bán buôn & bán lẻ','批发与零售','도소매','Mayorista y minorista','Commerce de gros et de détail'],
    ['不動産・建設','Real estate & construction','Bất động sản & xây dựng','房地产与建筑','부동산·건설','Inmobiliario y construcción','Immobilier et construction'],
    ['情報通信','Information & communications','Thông tin & truyền thông','信息通信','정보통신','Información y comunicaciones','Information et communications'],
    ['その他','Other','Khác','其他','기타','Otros','Autres'],
    ['注目成長セクター TOPS','Top growth sectors','Nhóm ngành tăng trưởng nổi bật','重点增长行业','주목 성장 산업','Sectores de mayor crecimiento','Secteurs à forte croissance'],
    ['YoY成長率','YoY growth','Tăng trưởng YoY','同比增长率','전년 대비 성장률','Crecimiento interanual','Croissance annuelle'],
    ['Eコマース・小売','E-commerce & retail','Thương mại điện tử & bán lẻ','电商与零售','이커머스·소매','Comercio electrónico y minorista','E-commerce et commerce de détail'],
    ['製造業 (電子部品・半導体)','Manufacturing (electronics & semiconductors)','Sản xuất (linh kiện điện tử & bán dẫn)','制造业（电子元件与半导体）','제조업(전자부품·반도체)','Manufactura (electrónica y semiconductores)','Industrie (électronique et semi-conducteurs)'],
    ['再生可能エネルギー','Renewable energy','Năng lượng tái tạo','可再生能源','재생에너지','Energías renovables','Énergies renouvelables'],
    ['IT・ソフトウェア','IT & software','CNTT & phần mềm','IT与软件','IT·소프트웨어','TI y software','IT et logiciels'],
    ['物流・コールドチェーン','Logistics & cold chain','Logistics & chuỗi lạnh','物流与冷链','물류·콜드체인','Logística y cadena de frío','Logistique et chaîne du froid'],
    ['ホーチミン拠点 一次監査速報','Ho Chi Minh primary audit update','Cập nhật kiểm chứng sơ cấp tại TP.HCM','胡志明市一手调研速报','호찌민 1차 조사 속보','Actualización de auditoría primaria en Ho Chi Minh','Point d’audit primaire à Hô Chi Minh-Ville'],
    ['対面監査','On-site audit','Kiểm chứng trực tiếp','实地核查','대면 조사','Auditoría presencial','Audit sur place'],
    ['確認データを見る','View verified data','Xem dữ liệu đã xác minh','查看核验数据','검증 데이터 보기','Ver datos verificados','Voir les données vérifiées'],
    ['現地情報と照合','Cross-checked locally','Đối chiếu thông tin tại địa phương','与本地信息核对','현지 정보와 대조','Contrastado localmente','Recoupé localement'],
    ['数字で見る、','VN Insight AI in numbers','VN Insight AI qua các con số','数据看VN Insight AI','숫자로 보는 VN Insight AI','VN Insight AI en cifras','VN Insight AI en chiffres'],
    ['最短納品','Fastest delivery','Giao nhanh nhất','最快交付','최단 납기','Entrega más rápida','Délai minimum'],
    ['時間','hours','giờ','小时','시간','horas','heures'],
    ['スピード納品','Fast delivery','Giao nhanh','快速交付','신속 납품','Entrega rápida','Livraison rapide'],
    ['検証プロセス','Verification process','Quy trình xác minh','核验流程','검증 프로세스','Proceso de verificación','Processus de vérification'],
    ['段階','stages','bước','阶段','단계','etapas','étapes'],
    ['AI分析＋現地検証','AI analysis + local verification','Phân tích AI + xác minh tại chỗ','AI分析＋本地核验','AI 분석＋현지 검증','Análisis IA + verificación local','Analyse IA + vérification locale'],
    ['納品形式','Delivery formats','Định dạng bàn giao','交付格式','납품 형식','Formatos de entrega','Formats de livraison'],
    ['形式','formats','định dạng','种格式','형식','formatos','formats'],
    ['PDF＋PPTX対応','PDF + PPTX supported','Hỗ trợ PDF + PPTX','支持PDF＋PPTX','PDF＋PPTX 지원','Compatible con PDF + PPTX','PDF + PPTX pris en charge'],
    ['情報方針','Information policy','Nguyên tắc thông tin','信息方针','정보 원칙','Política de información','Politique d’information'],
    ['一次情報','Primary sources','Thông tin sơ cấp','一手信息','1차 정보','Fuentes','Sources'],
    ['現地情報を重視','Local information first','Ưu tiên thông tin địa phương','重视本地信息','현지 정보 중시','Prioridad a la información local','Priorité aux informations locales'],
    ['選ばれる3つの理由','Three reasons to choose us','3 lý do lựa chọn chúng tôi','选择我们的三大理由','선택받는 3가지 이유','Tres razones para elegirnos','Trois raisons de nous choisir'],
    ['効率的なマクロ構造化','Efficient macro-level structuring','Cấu trúc hóa vĩ mô hiệu quả','高效宏观结构化','효율적인 거시 구조화','Estructuración macro eficiente','Structuration macro efficace'],
    ['AIを活用して、ベトナム各地に散在するデータを効率的に整理。','AI efficiently organizes data scattered across Vietnam.','AI giúp tổng hợp hiệu quả dữ liệu phân tán trên khắp Việt Nam.','利用AI高效整理分散在越南各地的数据。','AI로 베트남 각지에 흩어진 데이터를 효율적으로 정리합니다.','La IA organiza eficazmente datos dispersos por Vietnam.','L’IA structure efficacement les données dispersées au Vietnam.'],
    ['AI統合・構造化','AI integration & structuring','Tích hợp & cấu trúc hóa bằng AI','AI整合与结构化','AI 통합·구조화','Integración y estructuración con IA','Intégration et structuration par IA'],
    ['現地の泥臭いリアルファクト','Real facts from the field','Sự thật thực tế tại địa phương','来自本地的一线事实','현지에서 확인한 실제 팩트','Hechos reales sobre el terreno','Des faits réels du terrain'],
    ['AIの出力を現地情報や一次情報と照合し、精度を高める確認体制。','A verification process that cross-checks AI output with local and primary-source information.','Quy trình đối chiếu kết quả AI với thông tin địa phương và nguồn sơ cấp để nâng cao độ chính xác.','将AI输出与本地信息及一手资料核对，提高准确性。','AI 결과를 현지 정보와 1차 정보로 대조해 정확도를 높입니다.','Verificamos los resultados de la IA con información local y fuentes primarias.','Nous recoupons les résultats de l’IA avec des informations locales et des sources primaires.'],
    ['AI分析','AI analysis','Phân tích AI','AI分析','AI 분석','Análisis IA','Analyse IA'],
    ['現地チーム','Local team','Đội ngũ địa phương','本地团队','현지 팀','Equipo local','Équipe locale'],
    ['検証','Verify','Xác minh','核验','검증','Verificar','Vérifier'],
    ['エビデンス','Evidence','Bằng chứng','证据','근거','Evidencia','Preuves'],
    ['確認','Review','Kiểm tra','确认','확인','Revisar','Contrôle'],
    ['データ','Data','Dữ liệu','数据','데이터','Datos','Données'],
    ['圧倒的な手軽さとSaaS体験','Effortless SaaS experience','Trải nghiệm SaaS đơn giản vượt trội','极简便的SaaS体验','압도적으로 간편한 SaaS 경험','Una experiencia SaaS extraordinariamente sencilla','Une expérience SaaS remarquablement simple'],
    ['重々しい契約なしで、ダッシュボードから知りたい業界を選ぶだけでレポートが手に入る。','No lengthy contract: select an industry in the dashboard and receive your report.','Không cần hợp đồng phức tạp: chỉ cần chọn ngành trên bảng điều khiển để nhận báo cáo.','无需繁琐合同，只需在仪表板选择行业即可获得报告。','복잡한 계약 없이 대시보드에서 산업을 선택하면 보고서를 받을 수 있습니다.','Sin contratos pesados: elige un sector en el panel y recibe el informe.','Sans contrat complexe : choisissez un secteur dans le tableau de bord et recevez le rapport.'],
    ['調査プランを選択','Select a research plan','Chọn gói nghiên cứu','选择调研方案','조사 플랜 선택','Seleccionar plan','Choisir un plan'],
    ['業界を選択','Select an industry','Chọn ngành','选择行业','산업 선택','Seleccionar sector','Choisir un secteur'],
    ['EC・小売','E-commerce & retail','TMĐT & bán lẻ','电商与零售','EC·소매','E-commerce y minorista','E-commerce et commerce de détail'],
    ['IT・SaaS','IT & SaaS','CNTT & SaaS','IT与SaaS','IT·SaaS','TI y SaaS','IT et SaaS'],
    ['市場参入調査','Market entry research','Nghiên cứu thâm nhập thị trường','市场进入调研','시장 진출 조사','Estudio de entrada al mercado','Étude d’entrée sur le marché'],
    ['競合調査','Competitor research','Nghiên cứu đối thủ','竞品调研','경쟁사 조사','Estudio de competencia','Étude concurrentielle'],
    ['プレビュー','Preview','Xem trước','预览','미리보기','Vista previa','Aperçu'],
    ['EC市場トレンドレポート','E-commerce Market Trend Report','Báo cáo xu hướng thị trường TMĐT','电商市场趋势报告','EC 시장 트렌드 보고서','Informe de tendencias del e-commerce','Rapport sur les tendances de l’e-commerce'],
    ['2026速報版','2026 flash edition','Bản nhanh 2026','2026速报版','2026 속보판','Edición rápida 2026','Édition express 2026'],
    ['調査を開始する','Start research','Bắt đầu nghiên cứu','开始调研','조사 시작','Iniciar investigación','Lancer la recherche'],
  ];

  const extraRows = [
    ['従来の海外リサーチの課題と、VN Insight AIの解決','The challenges of traditional overseas research — and the VN Insight AI solution','Thách thức của nghiên cứu thị trường truyền thống và giải pháp của VN Insight AI','传统海外调研的痛点与VN Insight AI的解决方案','기존 해외 리서치의 과제와 VN Insight AI의 해결책','Los retos de la investigación internacional tradicional y la solución de VN Insight AI','Les limites de la recherche internationale traditionnelle et la solution VN Insight AI'],
    ['従来の手法・痛み','Traditional approach and pain points','Phương pháp truyền thống & điểm đau','传统方式与痛点','기존 방식과 문제점','Métodos tradicionales y dificultades','Méthodes traditionnelles et difficultés'],
    ['コンサルの重さ','Heavy consulting engagement','Gánh nặng tư vấn','咨询服务过重','컨설팅의 부담','El peso de la consultoría','La lourdeur du conseil'],
    ['見積もりは数千万円、納期は数ヶ月。','Quotes run into tens of millions of yen, with delivery taking months.','Chi phí lên tới hàng chục triệu yên và thời gian giao kéo dài nhiều tháng.','报价高达数千万日元，交付周期长达数月。','수천만 엔의 견적과 수개월의 납기.','Presupuestos de decenas de millones de yenes y plazos de varios meses.','Des devis de plusieurs dizaines de millions de yens et des délais de plusieurs mois.'],
    ['フェーズ1の「手探り状態」に過ぎないのに、','Even though you are only exploring the first phase,','Dù mới chỉ ở giai đoạn đầu thăm dò,','明明只是第一阶段的探索期，','아직 1단계 탐색에 불과한데도','Aunque solo se esté explorando la primera fase,','Alors qu’il ne s’agit encore que d’une première phase exploratoire,'],
    ['経営陣にこの予算を通せるわけがない。','there is no realistic way to secure board approval for that budget.','rất khó để ban lãnh đạo phê duyệt ngân sách như vậy.','这样的预算根本难以通过管理层审批。','이 예산을 경영진에게 승인받기는 어렵습니다.','es difícil conseguir la aprobación del consejo para ese presupuesto.','il est difficile de faire approuver un tel budget par la direction.'],
    ['情報のノイズ','Information noise','Nhiễu thông tin','信息噪声','정보 노이즈','Ruido informativo','Bruit informationnel'],
    ['検索で出てくるベトナムの情報は古いマクロデータばかり。ネット上の情報や、汎用AIによるハルシネーション（幻覚）の嘘ノイズに踊らされる恐怖。','Search results are often limited to outdated macro data, with the added risk of unreliable web information and hallucinations from general-purpose AI.','Kết quả tìm kiếm thường chỉ có dữ liệu vĩ mô cũ, cộng thêm rủi ro từ thông tin trực tuyến thiếu tin cậy và ảo giác của AI phổ thông.','搜索结果往往只有过时的宏观数据，还存在网络信息不可靠及通用AI幻觉的风险。','검색 결과는 오래된 거시 데이터가 대부분이며 웹 정보와 범용 AI 환각의 위험도 있습니다.','Los resultados suelen limitarse a datos macro obsoletos, con información web poco fiable y alucinaciones de IA generalista.','Les résultats se limitent souvent à des données macro obsolètes, avec des informations web peu fiables et des hallucinations d’IA généraliste.'],
    ['最短48時間で、現地官公庁の一次データや公開情報を効率的に整理。','In as little as 48 hours, we organize primary data from local authorities and relevant public information.','Chỉ từ 48 giờ, chúng tôi tổng hợp dữ liệu sơ cấp từ cơ quan địa phương và thông tin công khai liên quan.','最快48小时内，高效整理当地政府部门的一手数据及公开信息。','최단 48시간에 현지 관공서의 1차 데이터와 공개 정보를 정리합니다.','En tan solo 48 horas organizamos datos primarios de organismos locales e información pública relevante.','En 48 heures seulement, nous structurons les données primaires des autorités locales et les informations publiques pertinentes.'],
    ['ホーチミンの現地情報と照合し、意思決定に活用しやすい形で整理。','We cross-check with information from Ho Chi Minh City and structure it for practical decision-making.','Chúng tôi đối chiếu với thông tin tại TP.HCM và trình bày theo cách dễ áp dụng vào quyết định.','结合胡志明市本地信息核验，并整理为便于决策的形式。','호찌민 현지 정보와 대조해 의사결정에 활용하기 쉬운 형태로 정리합니다.','Contrastamos con información de Ho Chi Minh y la estructuramos para facilitar la toma de decisiones.','Nous recoupons avec des informations de Hô Chi Minh-Ville et les structurons pour faciliter la décision.'],
    ['低コスト','Lower cost','Chi phí thấp','低成本','저비용','Menor coste','Coût réduit'],
    ['最短48時間','From 48 hours','Từ 48 giờ','最快48小时','최단 48시간','Desde 48 horas','À partir de 48 heures'],
    ['主な機能ハイライト','Feature highlights','Điểm nổi bật','核心功能亮点','주요 기능','Funciones destacadas','Fonctionnalités clés'],
    ['スマートなダッシュボード','Smart dashboard','Bảng điều khiển thông minh','智能仪表板','스마트 대시보드','Panel inteligente','Tableau de bord intelligent'],
    ['業界・調査プランを選ぶだけで、最適なレポートを自動生成。','Select an industry and research plan to generate the most suitable report.','Chỉ cần chọn ngành và gói nghiên cứu để tự động tạo báo cáo phù hợp.','只需选择行业与调研方案，即可自动生成最合适的报告。','산업과 조사 플랜을 선택하면 최적의 보고서를 자동 생성합니다.','Elige sector y plan para generar automáticamente el informe adecuado.','Choisissez un secteur et un plan pour générer automatiquement le rapport adapté.'],
    ['物流','Logistics','Logistics','物流','물류','Logística','Logistique'],
    ['消費者インサイト','Consumer insights','Thông tin người tiêu dùng','消费者洞察','소비자 인사이트','Insights de consumidor','Insights consommateurs'],
    ['レポート生成','Generate report','Tạo báo cáo','生成报告','보고서 생성','Generar informe','Générer le rapport'],
    ['最近のレポート','Recent reports','Báo cáo gần đây','最近报告','최근 보고서','Informes recientes','Rapports récents'],
    ['製造業レポート','Manufacturing report','Báo cáo sản xuất','制造业报告','제조업 보고서','Informe de manufactura','Rapport industrie'],
    ['消費者インサイトレポート','Consumer insights report','Báo cáo người tiêu dùng','消费者洞察报告','소비자 인사이트 보고서','Informe de insights de consumidor','Rapport insights consommateurs'],
    ['確認プロセス','Verification process','Quy trình xác minh','核验流程','확인 프로세스','Proceso de verificación','Processus de vérification'],
    ['データ・グラフ・引用の出典を確認し、現地情報との照合過程を示します。','We verify the sources behind data, charts, and citations, and show how they were cross-checked locally.','Chúng tôi xác minh nguồn dữ liệu, biểu đồ và trích dẫn, đồng thời thể hiện quá trình đối chiếu tại địa phương.','核实数据、图表与引用来源，并展示与本地信息的核验过程。','데이터·그래프·인용 출처를 확인하고 현지 정보와의 대조 과정을 제시합니다.','Verificamos las fuentes de datos, gráficos y citas, y mostramos el contraste local.','Nous vérifions les sources des données, graphiques et citations, ainsi que leur recoupement local.'],
    ['情報確認','Information verified','Thông tin đã xác minh','信息核验','정보 확인','Información verificada','Information vérifiée'],
    ['稟議書最適化エクスポート','Export optimized for internal approval','Xuất định dạng tối ưu cho phê duyệt nội bộ','面向内部审批的优化导出','사내 결재 최적화 출력','Exportación optimizada para aprobación interna','Export optimisé pour validation interne'],
    ['社内共有や検討に活用しやすいフォーマットで出力。','Export in formats suited to internal sharing and review.','Xuất theo định dạng thuận tiện cho chia sẻ và xem xét nội bộ.','以便于内部共享和评估的格式导出。','사내 공유와 검토에 활용하기 쉬운 형식으로 출력합니다.','Exporta en formatos prácticos para compartir y evaluar internamente.','Exportez dans des formats adaptés au partage et à l’évaluation internes.'],
    ['他社比較表','Competitor comparison','Bảng so sánh','对比表','타사 비교표','Tabla comparativa','Tableau comparatif'],
    ['ベトナムへの情熱と、プロとしての責任','Passion for Vietnam, professional responsibility','Tâm huyết với Việt Nam, trách nhiệm nghề nghiệp','对越南的热忱与专业责任','베트남에 대한 열정과 전문가의 책임','Pasión por Vietnam y responsabilidad profesional','Passion pour le Vietnam et responsabilité professionnelle'],
    ['私たちは単なる調査会社ではありません。','We are more than a research company.','Chúng tôi không chỉ là một công ty nghiên cứu.','我们不只是一家调研公司。','우리는 단순한 조사 회사가 아닙니다.','Somos más que una empresa de investigación.','Nous sommes plus qu’un cabinet d’études.'],
    ['AIだけでは拾いきれない現地の声まで。一次情報を重視するリサーチ体制です。','Our research framework prioritizes primary sources and local voices that AI alone cannot capture.','Quy trình nghiên cứu ưu tiên nguồn sơ cấp và tiếng nói địa phương mà AI đơn thuần không thể nắm bắt.','我们的调研体系重视AI难以捕捉的本地声音与一手信息。','AI만으로 포착하기 어려운 현지 목소리와 1차 정보를 중시합니다.','Priorizamos fuentes primarias y voces locales que la IA por sí sola no puede captar.','Nous privilégions les sources primaires et les voix locales que l’IA seule ne peut saisir.'],
    ['日本企業の意思決定を支えるため、AIの情報処理と現地で得られる一次情報を組み合わせ、社内検討に活用しやすい形で整理します。','To support Japanese companies’ decisions, we combine AI processing with local primary information and organize it for internal review.','Để hỗ trợ doanh nghiệp Nhật ra quyết định, chúng tôi kết hợp xử lý AI với thông tin sơ cấp tại địa phương và trình bày thuận tiện cho xem xét nội bộ.','为支持日本企业决策，我们结合AI信息处理与本地一手信息，整理为便于内部评估的形式。','일본 기업의 의사결정을 위해 AI 정보 처리와 현지 1차 정보를 결합해 사내 검토에 활용하기 쉽게 정리합니다.','Para apoyar las decisiones de empresas japonesas, combinamos IA e información primaria local en un formato útil para la evaluación interna.','Pour soutenir les décisions des entreprises japonaises, nous combinons traitement IA et informations primaires locales dans un format adapté à l’évaluation interne.'],
    ['Webからプランを選択','Choose a plan online','Chọn gói trực tuyến','在线选择方案','웹에서 플랜 선택','Elige un plan en la web','Choisissez un plan en ligne'],
    ['最短1分、煩雑な要件定義は不要','As little as one minute, with no complex requirements process','Chỉ từ 1 phút, không cần xác định yêu cầu phức tạp','最快1分钟，无需复杂需求定义','최단 1분, 복잡한 요구사항 정의 불필요','Desde un minuto, sin procesos complejos','Dès une minute, sans cadrage complexe'],
    ['AI分析 ＋ 事実監査','AI analysis + fact audit','Phân tích AI + kiểm chứng sự thật','AI分析＋事实核查','AI 분석＋사실 검증','Análisis IA + auditoría factual','Analyse IA + audit factuel'],
    ['AIで整理した情報を現地情報と照合','Cross-check AI-organized information with local sources','Đối chiếu thông tin do AI tổng hợp với nguồn địa phương','将AI整理的信息与本地资料核对','AI가 정리한 정보를 현지 정보와 대조','Contrastamos la información organizada por IA con fuentes locales','Nous recoupons les informations structurées par l’IA avec des sources locales'],
    ['最短48時間で納品','Delivery from 48 hours','Bàn giao từ 48 giờ','最快48小时交付','최단 48시간 납품','Entrega desde 48 horas','Livraison à partir de 48 heures'],
    ['社内検討に活用しやすい整理済みデータ','Structured data ready for internal review','Dữ liệu có cấu trúc, sẵn sàng cho xem xét nội bộ','便于内部评估的结构化数据','사내 검토에 활용하기 쉬운 정리된 데이터','Datos estructurados para evaluación interna','Données structurées prêtes pour l’évaluation interne'],
  ];

  const faqRows = [
    ['情報ソースはただのネット上のコピペですか？','Are your sources just copied from the web?','Nguồn thông tin có chỉ sao chép từ Internet không?','信息来源只是从网上复制吗？','정보 출처는 단순한 인터넷 복사인가요?','¿Las fuentes son simples copias de Internet?','Vos sources sont-elles simplement copiées du Web ?'],
    ['いいえ、単なるコピー＆ペーストではありません。AIが膨大なデータを収集・構造化した後、ベトナム現地の専門チームが一次情報との照合や事実確認（ファクトチェック）を行います。そのため、高い精度の情報をご提供できます。','No. After AI collects and structures large volumes of data, our Vietnam-based specialists cross-check primary sources and verify the facts, enabling us to provide highly accurate information.','Không. Sau khi AI thu thập và cấu trúc lượng dữ liệu lớn, đội ngũ chuyên gia tại Việt Nam đối chiếu nguồn sơ cấp và kiểm chứng sự thật để cung cấp thông tin có độ chính xác cao.','不是。AI收集并结构化大量数据后，越南本地专业团队会与一手资料核对并进行事实核查，从而提供高准确度的信息。','아닙니다. AI가 방대한 데이터를 수집·구조화한 뒤 베트남 현지 전문가가 1차 정보 대조와 팩트체크를 수행해 정확도 높은 정보를 제공합니다.','No. Tras recopilar y estructurar los datos con IA, especialistas en Vietnam contrastan fuentes primarias y verifican los hechos para ofrecer información precisa.','Non. Après collecte et structuration par l’IA, nos spécialistes au Vietnam recoupent les sources primaires et vérifient les faits afin de fournir des informations précises.'],
    ['違いは何ですか？','What is the difference?','Điểm khác biệt là gì?','有什么不同？','차이점은 무엇인가요?','¿Cuál es la diferencia?','Quelle est la différence ?'],
    ['一般的なAIツールの出力には、情報の出典や最新性を確認する必要があります。VN Insight AIはAIの情報処理と現地情報・一次情報の照合を組み合わせ、社内検討にも活用しやすい形で情報を整理します。','General AI outputs still require source and recency checks. VN Insight AI combines AI processing with local and primary-source verification, then structures the information for practical internal review.','Kết quả từ AI phổ thông vẫn cần kiểm tra nguồn và độ cập nhật. VN Insight AI kết hợp xử lý AI với đối chiếu thông tin địa phương và nguồn sơ cấp, rồi trình bày thuận tiện cho xem xét nội bộ.','通用AI的输出仍需核查来源与时效。VN Insight AI结合AI处理、本地信息及一手资料核验，并整理为便于内部评估的形式。','일반 AI 출력은 출처와 최신성 확인이 필요합니다. VN Insight AI는 AI 처리와 현지·1차 정보 검증을 결합해 사내 검토에 활용하기 쉽게 정리합니다.','Los resultados de una IA general requieren comprobar fuentes y actualidad. VN Insight AI combina el procesamiento con verificación local y primaria, y estructura la información para uso interno.','Les résultats d’une IA généraliste nécessitent de vérifier les sources et l’actualité. VN Insight AI combine traitement IA, vérification locale et sources primaires dans un format exploitable en interne.'],
    ['同じになりませんか？','Could the same thing happen again?','Liệu có lặp lại tình trạng đó không?','会不会重蹈覆辙？','같은 결과가 되지 않을까요?','¿Podría pasar lo mismo?','Cela pourrait-il se reproduire ?'],
    ['AIによるデータ整理と、現地情報・一次情報との照合を組み合わせます。公開情報だけでは分かりにくい現地の状況も、社内で検討しやすい形にまとめるサービス設計です。','We combine AI-driven data structuring with local and primary-source verification, including field conditions that public information alone may not reveal, in a format suited to internal review.','Chúng tôi kết hợp cấu trúc dữ liệu bằng AI với đối chiếu thông tin địa phương và nguồn sơ cấp, bao gồm cả bối cảnh khó thấy từ dữ liệu công khai, theo định dạng thuận tiện cho nội bộ.','我们结合AI数据整理与本地及一手资料核验，将公开信息难以呈现的当地情况也整理为便于内部评估的形式。','AI 데이터 정리와 현지·1차 정보 검증을 결합해 공개 정보만으로 알기 어려운 현지 상황도 사내 검토에 적합하게 제공합니다.','Combinamos estructuración con IA y verificación local y primaria, incluyendo realidades que no se ven solo con información pública, en un formato útil para la evaluación interna.','Nous combinons structuration par IA et vérification locale et primaire, y compris des réalités difficiles à saisir via les seules sources publiques, dans un format adapté à l’évaluation interne.'],
    ['レポートの納品形式はどのようなものですか？','In which formats are reports delivered?','Báo cáo được bàn giao ở định dạng nào?','报告以什么格式交付？','보고서는 어떤 형식으로 제공되나요?','¿En qué formatos se entregan los informes?','Sous quels formats les rapports sont-ils livrés ?'],
    ['PDFおよびPowerPoint（PPTX）形式での納品に対応しております。社内稟議や会議でのプレゼンテーションにそのままご活用いただけるフォーマットでご提供します。','Reports are available in PDF and PowerPoint (PPTX), ready for internal approval documents and meeting presentations.','Báo cáo được cung cấp ở định dạng PDF và PowerPoint (PPTX), sẵn sàng dùng cho phê duyệt nội bộ và thuyết trình.','支持PDF和PowerPoint（PPTX）格式，可直接用于内部审批和会议演示。','PDF 및 PowerPoint(PPTX) 형식으로 제공하며 사내 결재와 회의 발표에 바로 활용할 수 있습니다.','Entregamos en PDF y PowerPoint (PPTX), listos para aprobaciones internas y presentaciones.','Les rapports sont fournis en PDF et PowerPoint (PPTX), prêts pour les validations internes et les présentations.'],
    ['特定のニッチな業界や専門的な調査プランにも対応していますか？','Do you support niche industries or specialized research plans?','Có hỗ trợ ngành ngách hoặc gói nghiên cứu chuyên sâu không?','是否支持细分行业或专业调研方案？','특정 틈새 산업이나 전문 조사 플랜도 지원하나요?','¿Trabajáis con sectores nicho o planes especializados?','Prenez-vous en charge les secteurs de niche ou les études spécialisées ?'],
    ['はい、対応可能です。基本プラン以外にも、お客様独自のニーズに合わせたカスタム調査も承っております。お気軽にサポートチームまでご相談ください。','Yes. In addition to our standard plans, we offer custom research tailored to your needs. Please contact our support team.','Có. Ngoài các gói tiêu chuẩn, chúng tôi cung cấp nghiên cứu tùy chỉnh theo nhu cầu riêng. Vui lòng liên hệ đội ngũ hỗ trợ.','可以。除标准方案外，我们也提供按需求定制的调研，欢迎联系支持团队。','네. 기본 플랜 외에도 고객 요구에 맞춘 맞춤 조사를 제공합니다. 지원팀에 문의해 주세요.','Sí. Además de los planes estándar, ofrecemos estudios a medida. Contacta con nuestro equipo de soporte.','Oui. En plus des offres standard, nous proposons des études sur mesure. Contactez notre équipe support.'],
  ];

  const modalRows = [
    ['【デモ】ベトナム市場分析レポート サンプル','[Demo] Vietnam Market Analysis — Sample Report','[Demo] Báo cáo mẫu phân tích thị trường Việt Nam','【演示】越南市场分析样本报告','[데모] 베트남 시장 분석 샘플 보고서','[Demo] Informe de muestra del mercado vietnamita','[Démo] Exemple de rapport sur le marché vietnamien'],
    ['AI構造化データ ✕ 現地情報との照合例','AI-structured data × local cross-check example','Dữ liệu do AI cấu trúc × ví dụ đối chiếu địa phương','AI结构化数据 × 本地信息核验示例','AI 구조화 데이터 × 현지 정보 대조 예시','Datos estructurados por IA × contraste local','Données structurées par IA × exemple de recoupement local'],
    ['ポートフォリオ用デモ','Portfolio demo','Demo portfolio','作品集演示','포트폴리오 데모','Demo de portafolio','Démo de portfolio'],
    ['マクロ経済・市場規模指標サマリー','Macroeconomic and market-size summary','Tóm tắt kinh tế vĩ mô & quy mô thị trường','宏观经济与市场规模指标概览','거시경제·시장 규모 지표 요약','Resumen macroeconómico y de tamaño de mercado','Synthèse macroéconomique et taille de marché'],
    ['数値の表示例','Example metric','Ví dụ số liệu','数值示例','수치 표시 예시','Ejemplo de cifra','Exemple de valeur'],
    ['指標の表示例','Example indicator','Ví dụ chỉ số','指标示例','지표 표시 예시','Ejemplo de indicador','Exemple d’indicateur'],
    ['EC・主要プラットフォーム比較（表示例）','E-commerce platform comparison (example)','So sánh nền tảng TMĐT (ví dụ)','电商主要平台比较（示例）','EC 주요 플랫폼 비교(예시)','Comparación de plataformas de e-commerce (ejemplo)','Comparatif des principales plateformes e-commerce (exemple)'],
    ['AIアナリストのキーインサイト','Key insights from the AI analyst','Nhận định chính từ chuyên gia AI','AI分析师关键洞察','AI 애널리스트 핵심 인사이트','Insights clave del analista IA','Insights clés de l’analyste IA'],
    ['ECプラットフォームごとの傾向を、公開情報や現地で確認した情報と照らし合わせて整理する想定です。','The report is designed to organize platform-level trends by cross-checking public information with locally verified findings.','Báo cáo dự kiến tổng hợp xu hướng từng nền tảng bằng cách đối chiếu thông tin công khai với dữ liệu xác minh tại địa phương.','报告将结合公开信息与本地核实内容，整理各电商平台趋势。','공개 정보와 현지 확인 정보를 대조해 플랫폼별 동향을 정리합니다.','El informe organiza tendencias por plataforma contrastando información pública y hallazgos verificados localmente.','Le rapport structure les tendances par plateforme en recoupant les informations publiques et les constats locaux.'],
    ['※本画面はポートフォリオ用のデモレポートです。表示内容・数値はサンプルです。','This is a portfolio demo report. All content and figures are samples.','Đây là báo cáo demo portfolio. Toàn bộ nội dung và số liệu là mẫu.','本页面为作品集演示报告，所示内容与数值均为样本。','본 화면은 포트폴리오용 데모 보고서이며 내용과 수치는 샘플입니다.','Este es un informe demo de portafolio. Todo el contenido y las cifras son de ejemplo.','Ceci est un rapport de démonstration. Tous les contenus et chiffres sont des exemples.'],
    ['PDFサンプル（完全版）をダウンロード','Download full PDF sample','Tải bản PDF mẫu đầy đủ','下载完整PDF样本','PDF 전체 샘플 다운로드','Descargar muestra PDF completa','Télécharger l’exemple PDF complet'],
    ['無料トライアルで全データを見る','View all data with a free trial','Xem toàn bộ dữ liệu với bản dùng thử miễn phí','通过免费试用查看全部数据','무료 체험으로 전체 데이터 보기','Ver todos los datos con una prueba gratis','Voir toutes les données avec l’essai gratuit'],
    ['サンプルレポートのダウンロードを開始しました','Sample report download started','Đã bắt đầu tải báo cáo mẫu','样本报告已开始下载','샘플 보고서 다운로드를 시작했습니다','Se ha iniciado la descarga del informe de muestra','Le téléchargement du rapport exemple a commencé'],
    ['無料トライアルの登録画面へ移動します','Opening free trial registration','Đang mở trang đăng ký dùng thử miễn phí','正在打开免费试用注册页面','무료 체험 등록 화면으로 이동합니다','Abriendo el registro de prueba gratuita','Ouverture de l’inscription à l’essai gratuit'],
  ];

  const chat = {
    ja: { open:'VN Insight AIチャットを開く', close:'チャットを閉じる', log:'チャットメッセージ', group:'質問候補', ask:'AIに質問', compact:'AIチャット', hello:'こんにちは。VN Insight AIです。\nベトナム市場について何をお調べしますか？', input:'質問を入力', placeholder:'ベトナム市場について質問する', send:'送信', sending:'回答を作成中', suggestions:['ベトナム市場の特徴を教えて','競合調査では何が分かりますか？','調査レポートのサンプルを見たい'] },
    en: { open:'Open VN Insight AI chat', close:'Close chat', log:'Chat messages', group:'Suggested questions', ask:'Ask AI', compact:'AI Chat', hello:'Hello, this is VN Insight AI.\nWhat would you like to learn about the Vietnamese market?', input:'Enter a question', placeholder:'Ask about the Vietnamese market', send:'Send', sending:'Preparing an answer', suggestions:['What are the key features of the Vietnamese market?','What can competitor research reveal?','Show me a sample research report'] },
    vi: { open:'Mở chat VN Insight AI', close:'Đóng chat', log:'Tin nhắn chat', group:'Câu hỏi gợi ý', ask:'Hỏi AI', compact:'Chat AI', hello:'Xin chào, đây là VN Insight AI.\nBạn muốn tìm hiểu điều gì về thị trường Việt Nam?', input:'Nhập câu hỏi', placeholder:'Hỏi về thị trường Việt Nam', send:'Gửi', sending:'Đang chuẩn bị câu trả lời', suggestions:['Đặc điểm chính của thị trường Việt Nam là gì?','Nghiên cứu đối thủ cho biết điều gì?','Cho tôi xem báo cáo nghiên cứu mẫu'] },
    zh: { open:'打开VN Insight AI聊天', close:'关闭聊天', log:'聊天消息', group:'推荐问题', ask:'咨询AI', compact:'AI聊天', hello:'您好，这里是VN Insight AI。\n您想了解越南市场的哪些信息？', input:'输入问题', placeholder:'咨询越南市场', send:'发送', sending:'正在生成回答', suggestions:['越南市场有哪些主要特点？','竞品调研可以了解什么？','查看调研报告样本'] },
    ko: { open:'VN Insight AI 채팅 열기', close:'채팅 닫기', log:'채팅 메시지', group:'추천 질문', ask:'AI에 질문', compact:'AI 채팅', hello:'안녕하세요. VN Insight AI입니다.\n베트남 시장에 대해 무엇을 알아볼까요?', input:'질문 입력', placeholder:'베트남 시장에 대해 질문하기', send:'전송', sending:'답변 작성 중', suggestions:['베트남 시장의 특징을 알려 주세요','경쟁사 조사로 무엇을 알 수 있나요?','조사 보고서 샘플을 보고 싶어요'] },
    es: { open:'Abrir chat de VN Insight AI', close:'Cerrar chat', log:'Mensajes del chat', group:'Preguntas sugeridas', ask:'Preguntar a IA', compact:'Chat IA', hello:'Hola, soy VN Insight AI.\n¿Qué quieres saber sobre el mercado vietnamita?', input:'Escribe una pregunta', placeholder:'Pregunta sobre el mercado vietnamita', send:'Enviar', sending:'Preparando respuesta', suggestions:['¿Cuáles son las características del mercado vietnamita?','¿Qué revela un estudio de competencia?','Quiero ver un informe de muestra'] },
    fr: { open:'Ouvrir le chat VN Insight AI', close:'Fermer le chat', log:'Messages du chat', group:'Questions suggérées', ask:'Interroger l’IA', compact:'Chat IA', hello:'Bonjour, ici VN Insight AI.\nQue souhaitez-vous savoir sur le marché vietnamien ?', input:'Saisir une question', placeholder:'Posez une question sur le marché vietnamien', send:'Envoyer', sending:'Préparation de la réponse', suggestions:['Quelles sont les caractéristiques du marché vietnamien ?','Que révèle une étude concurrentielle ?','Voir un exemple de rapport'] },
  };

  const fragmentRows = [
    ['「2026年改定の新投資法により、外資系小売チェーンの出店規制(ENT)緩和が試験導入。主要都市部での進出スピードが従来の2倍に加速する見通し。」','“The revised 2026 Investment Law pilots relaxed ENT rules for foreign retail chains, potentially doubling expansion speed in major cities.”','“Luật Đầu tư sửa đổi năm 2026 thí điểm nới lỏng quy định ENT cho chuỗi bán lẻ nước ngoài, có thể tăng gấp đôi tốc độ mở rộng tại các thành phố lớn.”','“2026年修订投资法试行放宽外资零售连锁的ENT限制，主要城市的扩张速度预计将提升至两倍。”','“2026년 개정 투자법으로 외국계 소매 체인의 ENT 규제가 시범 완화되어 주요 도시 진출 속도가 두 배 빨라질 전망입니다.”','«La Ley de Inversión revisada en 2026 prueba una flexibilización del ENT para cadenas extranjeras, que podría duplicar su expansión en las grandes ciudades.»','«La loi sur l’investissement révisée en 2026 teste un assouplissement de l’ENT pour les chaînes étrangères, susceptible de doubler leur expansion dans les grandes villes.»'],
    ['従来の海外リサーチの','Traditional overseas research','Nghiên cứu thị trường nước ngoài truyền thống','传统海外调研的','기존 해외 리서치의','Investigación internacional tradicional','Études internationales traditionnelles'],
    ['課題','challenges','vấn đề','问题','과제','problemas','difficultés'],
    ['課題①','Challenge 1','Vấn đề 1','问题①','과제 ①','Problema 1','Difficulté 1'],
    ['課題②','Challenge 2','Vấn đề 2','问题②','과제 ②','Problema 2','Difficulté 2'],
    ['ベトナムのEC市場規模','Vietnam e-commerce market size','Quy mô thị trường TMĐT Việt Nam','越南电商市场规模','베트남 EC 시장 규모','Tamaño del e-commerce vietnamita','Taille du e-commerce vietnamien'],
    ['推移','Trend','Xu hướng','趋势','추이','Evolución','Évolution'],
    ['(億USD)','(USD 100M)','(100 triệu USD)','（亿美元）','(억 USD)','(cientos de M USD)','(centaines de M USD)'],
    ['（出典を確認）','(View sources)','(Xem nguồn)','（查看来源）','(출처 확인)','(Ver fuentes)','(Voir les sources)'],
    ['PDF出力','Export PDF','Xuất PDF','导出PDF','PDF 출력','Exportar PDF','Exporter en PDF'],
    ['PPTX出力','Export PPTX','Xuất PPTX','导出PPTX','PPTX 출력','Exportar PPTX','Exporter en PPTX'],
    ['ベトナム市場参入に関するご提案','Vietnam Market Entry Proposal','Đề xuất thâm nhập thị trường Việt Nam','越南市场进入提案','베트남 시장 진출 제안','Propuesta de entrada en Vietnam','Proposition d’entrée au Vietnam'],
    ['- 2026年最新版 -','- 2026 edition -','- Bản mới nhất 2026 -','- 2026最新版 -','- 2026년 최신판 -','- Edición 2026 -','- Édition 2026 -'],
    ['比較軸','Criteria','Tiêu chí','比较维度','비교 기준','Criterio','Critère'],
    ['① 一般的な海外コンサル /','① Overseas consultancies /','① Tư vấn quốc tế /','① 一般海外咨询 /','① 일반 해외 컨설팅 /','① Consultoras internacionales /','① Cabinets internationaux /'],
    ['大手リサーチ','major research firms','công ty nghiên cứu lớn','大型调研公司','대형 리서치사','grandes firmas de estudios','grands instituts d’études'],
    ['② 一般的なAIツール','② General AI tools','② Công cụ AI phổ thông','② 通用AI工具','② 일반 AI 도구','② Herramientas de IA generales','② Outils d’IA généralistes'],
    ['コスト','Cost','Chi phí','成本','비용','Coste','Coût'],
    ['数千万円〜','Tens of millions of yen+','Từ hàng chục triệu yên','数千万日元起','수천만 엔~','Decenas de millones de yenes+','Dizaines de millions de yens+'],
    ['無料〜','Free+','Miễn phí+','免费起','무료~','Gratis+','Gratuit+'],
    ['月額数千円','a few thousand yen/month','vài nghìn yên/tháng','每月数千日元','월 수천 엔','miles de yenes/mes','quelques milliers de yens/mois'],
    ['従来の','Compared with traditional services','So với dịch vụ truyền thống','与传统服务相比','기존 서비스 대비','Frente a servicios tradicionales','Face aux services traditionnels'],
    ['導入しやすい料金設計','Accessible pricing','Mức giá dễ tiếp cận','易于采用的价格','도입하기 쉬운 요금','Precios accesibles','Tarification accessible'],
    ['納品スピード','Delivery speed','Tốc độ bàn giao','交付速度','납품 속도','Velocidad de entrega','Délai de livraison'],
    ['数週間〜','Several weeks+','Vài tuần+','数周起','수주~','Varias semanas+','Plusieurs semaines+'],
    ['数ヶ月','months','vài tháng','数月','수개월','meses','mois'],
    ['即時','Instant','Tức thì','即时','즉시','Inmediato','Immédiat'],
    ['（情報の深さに限界）','(limited depth)','(độ sâu hạn chế)','（信息深度有限）','(정보 깊이 제한)','(profundidad limitada)','(profondeur limitée)'],
    ['情報の正確性・','Information accuracy &','Độ chính xác &','信息准确性与','정보 정확성·','Precisión y','Précision et'],
    ['リアルさ','local relevance','tính thực tế','真实性','현실성','realismo local','pertinence locale'],
    ['古い情報や','Outdated or','Thông tin cũ hoặc','陈旧信息及','오래된 정보나','Información antigua o','Informations anciennes ou'],
    ['二次情報が中心','mostly secondary sources','chủ yếu nguồn thứ cấp','以二手资料为主','2차 정보 중심','fuentes secundarias','sources secondaires'],
    ['ハルシネーションの','High hallucination','Nguy cơ ảo giác','幻觉','할루시네이션','Alto riesgo de','Risque élevé'],
    ['リスク大','risk','cao','风险高','위험 큼','alucinación','d’hallucination'],
    ['一次情報＋','Primary sources +','Nguồn sơ cấp +','一手资料＋','1차 정보＋','Fuentes primarias +','Sources primaires +'],
    ['手軽さ','Ease of use','Tính tiện lợi','便捷性','간편함','Facilidad','Simplicité'],
    ['契約・','Contracts &','Hợp đồng &','合同及','계약·','Contratos y','Contrats et'],
    ['要件定義が煩雑','complex requirements','yêu cầu phức tạp','需求定义繁琐','요건 정의가 복잡','requisitos complejos','cadrage complexe'],
    ['使いやすいが','Easy to use, but','Dễ dùng nhưng','易用，但','사용하기 쉽지만','Fácil, pero','Simple, mais'],
    ['信頼性に課題','reliability concerns','độ tin cậy hạn chế','可靠性存疑','신뢰성에 과제','fiabilidad limitada','fiabilité limitée'],
    ['Webで完結、','Fully online,','Hoàn toàn trực tuyến,','全程在线，','웹에서 완결,','100 % en línea,','100 % en ligne,'],
    ['すぐに使える','ready immediately','dùng ngay','即刻可用','바로 사용 가능','listo al instante','prêt immédiatement'],
    ['責任','responsibility','trách nhiệm','责任','책임','responsabilidad','responsabilité'],
    ['（最短48時間で納品）','(delivery from 48 hours)','(bàn giao từ 48 giờ)','（最快48小时交付）','(최단 48시간 납품)','(entrega desde 48 horas)','(livraison à partir de 48 heures)'],
    ['情報ソースは','Are the sources','Nguồn thông tin có','信息来源','정보 출처는','¿Las fuentes son','Les sources sont-elles'],
    ['ただのネット上の','just copied from','chỉ sao chép từ','只是网上','단순한 인터넷','simples copias de','simplement copiées du'],
    ['コピペですか？','the web?','Internet không?','复制吗？','복사인가요?','Internet?','Web ?'],
    ['社内の若手から','A junior colleague says,','Nhân viên trẻ đề xuất:','公司年轻员工提出：','사내 젊은 직원이','Un compañero joven dice:','Un jeune collègue affirme :'],
    ['「生成AIやAI検索ツールを','“Why not use generative AI','“Chỉ cần dùng AI tạo sinh','“直接使用生成式AI','“생성형 AI나 AI 검색 도구를','«¿Por qué no usar IA generativa','«Pourquoi ne pas utiliser l’IA générative'],
    ['直接使えば十分では？」と','or AI search directly?”','hay công cụ tìm kiếm AI?”','或AI搜索工具不就够了吗？”','직접 쓰면 충분하지 않나요?”라고','o buscadores de IA?»','ou les moteurs de recherche IA ?»'],
    ['提案され反論できません。','and I cannot respond.','và tôi chưa biết phản hồi.','我无法反驳。','제안해 반박하기 어렵습니다.','y no sé qué responder.','et je ne sais pas quoi répondre.'],
    ['過去に高額な','Previously, an expensive','Trước đây, một đơn vị','过去曾委托高价','과거 고액의','Antes, una consultora cara','Auparavant, un cabinet coûteux'],
    ['コンサルに依頼して、','consultancy delivered','tư vấn đắt tiền đã cung cấp','咨询公司，却得到','컨설팅에 의뢰했지만','nos entregó','nous a livré'],
    ['ネットで拾えるような','a shallow report based on','báo cáo hời hợt từ','网上就能找到的','인터넷에서 찾을 법한','un informe superficial','un rapport superficiel'],
    ['薄いレポートを出されて','readily available web data,','dữ liệu có sẵn trên mạng,','浅薄报告，','얕은 보고서를 받아','con datos de Internet,','tiré du Web,'],
    ['失望しました。','which was disappointing.','khiến tôi thất vọng.','令人失望。','실망했습니다.','y fue decepcionante.','ce qui fut décevant.'],
    ['レポートの納品形式は','In which formats are reports','Báo cáo được bàn giao','报告以什么格式','보고서는 어떤 형식으로','¿En qué formatos se','Sous quels formats les'],
    ['どのようなものですか？','delivered?','ở định dạng nào?','交付？','제공되나요?','entregan?','rapports sont-ils livrés ?'],
    ['特定のニッチな業界や','Do you support niche industries','Có hỗ trợ ngành ngách','是否支持细分行业','특정 틈새 산업이나','¿Trabajáis con sectores nicho','Prenez-vous en charge les secteurs de niche'],
    ['専門的な調査プランにも','or specialized research','hoặc nghiên cứu chuyên sâu','或专业调研','전문 조사 플랜도','o estudios especializados','ou les études spécialisées'],
    ['対応していますか？','plans?','không?','方案？','지원하나요?','?','?'],
    ['役員会を沈黙させ、','Give the board confidence,','Thuyết phục ban lãnh đạo,','让董事会信服，','경영진을 설득하고,','Convence al consejo','Convainquez la direction'],
    ['あなたの身を守るための最終決断を。','and make a decision you can stand behind.','và đưa ra quyết định vững chắc.','做出经得起检验的最终决策。','스스로 책임질 수 있는 최종 결정을 내리세요.','y toma una decisión que puedas defender.','et prenez une décision que vous pourrez défendre.'],
    ['情報の確実性が、あなたのビジネスの未来を左右する。','Reliable information shapes the future of your business.','Thông tin đáng tin cậy quyết định tương lai doanh nghiệp.','可靠信息决定企业未来。','확실한 정보가 비즈니스의 미래를 좌우합니다.','La información fiable define el futuro de tu negocio.','La fiabilité de l’information détermine l’avenir de votre activité.'],
    ['サービス','Services','Dịch vụ','服务','서비스','Servicios','Services'],
    ['サービスについて','About the service','Về dịch vụ','服务介绍','서비스 소개','Sobre el servicio','À propos du service'],
    ['調査プロセス','Research process','Quy trình nghiên cứu','调研流程','조사 프로세스','Proceso de investigación','Processus d’étude'],
    ['サンプルレポート','Sample report','Báo cáo mẫu','样本报告','샘플 보고서','Informe de muestra','Rapport exemple'],
    ['会社情報','Company','Công ty','公司信息','회사 정보','Empresa','Entreprise'],
    ['運営情報','Operator information','Thông tin vận hành','运营信息','운영 정보','Información del operador','Informations légales'],
    ['プライバシーポリシー','Privacy policy','Chính sách bảo mật','隐私政策','개인정보 처리방침','Política de privacidad','Politique de confidentialité'],
    ['お問い合わせ','Contact','Liên hệ','联系我们','문의','Contacto','Contact'],
    ['サンプルレポートを見る →','View sample report →','Xem báo cáo mẫu →','查看样本报告 →','샘플 보고서 보기 →','Ver informe de muestra →','Voir le rapport exemple →'],
    ['クレジットカード登録不要・1分で完了','No credit card · Takes 1 minute','Không cần thẻ · Hoàn tất trong 1 phút','无需信用卡・1分钟完成','카드 등록 불필요·1분 완료','Sin tarjeta · 1 minuto','Sans carte · 1 minute'],
    ['プライバシーポリシー ｜ お問い合わせ','Privacy policy | Contact','Chính sách bảo mật | Liên hệ','隐私政策｜联系我们','개인정보 처리방침 | 문의','Privacidad | Contacto','Confidentialité | Contact'],
    ['運営情報 ｜ プライバシーポリシー','Operator info | Privacy policy','Thông tin vận hành | Chính sách bảo mật','运营信息｜隐私政策','운영 정보 | 개인정보 처리방침','Información legal | Privacidad','Informations légales | Confidentialité'],
    ['言語を選択','Select language','Chọn ngôn ngữ','选择语言','언어 선택','Seleccionar idioma','Choisir la langue'],
    ['メニューを開閉','Toggle menu','Mở/đóng menu','打开/关闭菜单','메뉴 열기/닫기','Abrir/cerrar menú','Ouvrir/fermer le menu'],
    ['閉じる','Close','Đóng','关闭','닫기','Cerrar','Fermer'],
    ['AIに質問','Ask AI','Hỏi AI','咨询AI','AI에 질문','Preguntar a IA','Interroger l’IA'],
    ['AIチャット','AI Chat','Chat AI','AI聊天','AI 채팅','Chat IA','Chat IA'],
  ];

  const chatRows = [
    ['ベトナム市場の特徴を教えて','What are the key features of the Vietnamese market?','Đặc điểm chính của thị trường Việt Nam là gì?','越南市场有哪些主要特点？','베트남 시장의 특징을 알려 주세요','¿Cuáles son las características del mercado vietnamita?','Quelles sont les caractéristiques du marché vietnamien ?'],
    ['競合調査では何が分かりますか？','What can competitor research reveal?','Nghiên cứu đối thủ cho biết điều gì?','竞品调研可以了解什么？','경쟁사 조사로 무엇을 알 수 있나요?','¿Qué revela un estudio de competencia?','Que révèle une étude concurrentielle ?'],
    ['調査レポートのサンプルを見たい','Show me a sample research report','Cho tôi xem báo cáo nghiên cứu mẫu','查看调研报告样本','조사 보고서 샘플을 보고 싶어요','Quiero ver un informe de muestra','Voir un exemple de rapport'],
    ['ベトナムでは、若い人口構成や都市部を中心とした消費市場の拡大など、複数の市場変化が見られます。 VN Insight AIでは、公開情報だけでなく、競合・価格・流通チャネル・現地情報などを整理し、意思決定に使いやすい形でまとめます。','Vietnam is seeing several market shifts, including a young population and expanding urban consumption. VN Insight AI organizes public data together with competitor, pricing, distribution-channel, and local information into a decision-ready format.','Việt Nam đang có nhiều thay đổi như dân số trẻ và tiêu dùng đô thị tăng. VN Insight AI tổng hợp dữ liệu công khai cùng thông tin đối thủ, giá, kênh phân phối và dữ liệu địa phương để hỗ trợ ra quyết định.','越南正经历年轻人口结构、城市消费扩张等多项市场变化。VN Insight AI将公开信息与竞品、价格、渠道及本地信息整合为便于决策的形式。','베트남에서는 젊은 인구와 도시 소비시장 확대 등 여러 변화가 나타납니다. VN Insight AI는 공개 정보와 경쟁사·가격·유통·현지 정보를 의사결정에 활용하기 쉽게 정리합니다.','Vietnam vive cambios como una población joven y la expansión del consumo urbano. VN Insight AI organiza datos públicos, competencia, precios, canales e información local para facilitar decisiones.','Le Vietnam connaît plusieurs évolutions, notamment une population jeune et l’essor de la consommation urbaine. VN Insight AI structure données publiques, concurrence, prix, canaux et informations locales pour faciliter la décision.'],
    ['競合企業のサービス内容、価格帯、ターゲット、販売チャネル、訴求ポイントなどを整理できます。 さらに現地情報と組み合わせることで、日本からのWeb調査だけでは把握しにくい市場状況も確認できます。','We can organize competitors’ services, pricing, targets, sales channels, and value propositions. Combined with local information, this also reveals market conditions that are difficult to assess through web research from Japan alone.','Có thể tổng hợp dịch vụ, mức giá, khách hàng mục tiêu, kênh bán và điểm khác biệt của đối thủ. Kết hợp dữ liệu địa phương giúp làm rõ những điều khó thấy khi chỉ nghiên cứu trực tuyến từ Nhật Bản.','可整理竞品的服务、价格、目标客户、销售渠道和卖点。结合本地信息，还能了解仅从日本进行网络调研难以掌握的市场情况。','경쟁사의 서비스, 가격대, 타깃, 판매 채널, 소구점을 정리합니다. 현지 정보와 결합해 일본 내 웹 조사만으로 파악하기 어려운 시장 상황도 확인할 수 있습니다.','Organizamos servicios, precios, públicos, canales y propuestas de los competidores. Al combinarlo con información local, se revelan condiciones difíciles de detectar solo con investigación web desde Japón.','Nous structurons offres, prix, cibles, canaux et arguments des concurrents. Le recoupement local révèle aussi des réalités difficiles à saisir depuis le Japon par la seule recherche Web.'],
    ['VN Insight AIでは、調査目的に応じて市場概要、競合比較、現地情報、示唆などを整理したレポートを想定しています。 このサイトはポートフォリオ用デモのため、現在はサンプル表示です。 詳しいサービス内容はページ内をご覧ください。','VN Insight AI reports are designed to organize market overviews, competitor comparisons, local information, and implications for each research objective. This portfolio demo currently shows sample content. See the page for service details.','Báo cáo VN Insight AI tổng hợp tổng quan thị trường, so sánh đối thủ, thông tin địa phương và hàm ý theo mục tiêu nghiên cứu. Đây là demo portfolio nên hiện chỉ hiển thị nội dung mẫu. Xem chi tiết dịch vụ trên trang.','VN Insight AI报告会根据调研目的整理市场概况、竞品比较、本地信息与洞察。本网站为作品集演示，目前显示样本内容。服务详情请参阅页面。','VN Insight AI 보고서는 조사 목적에 따라 시장 개요, 경쟁사 비교, 현지 정보와 시사점을 정리합니다. 이 사이트는 포트폴리오 데모이므로 현재 샘플을 표시합니다. 자세한 내용은 페이지를 확인해 주세요.','Los informes de VN Insight AI organizan panorama de mercado, competencia, información local e implicaciones según el objetivo. Este sitio es una demo de portafolio y muestra contenido de ejemplo. Consulta la página para más detalles.','Les rapports VN Insight AI structurent aperçu du marché, comparaison concurrentielle, informations locales et enseignements selon l’objectif. Ce site de démonstration présente actuellement des exemples. Consultez la page pour les détails.'],
    ['ご質問ありがとうございます。 このチャットはポートフォリオ用のAIアシスタントデモです。 実際のサービスでは、ベトナム市場・競合・現地情報などをもとにリサーチ結果を整理する想定です。 上のサンプル質問もお試しください。','Thank you for your question. This chat is a portfolio AI-assistant demo. The actual service is designed to organize research findings about the Vietnamese market, competitors, and local information. You can also try a sample question above.','Cảm ơn câu hỏi của bạn. Đây là demo trợ lý AI cho portfolio. Dịch vụ thực tế dự kiến tổng hợp kết quả nghiên cứu về thị trường Việt Nam, đối thủ và thông tin địa phương. Bạn cũng có thể thử câu hỏi mẫu ở trên.','感谢您的提问。本聊天为作品集AI助手演示。实际服务将整理越南市场、竞品及本地信息等调研结果。您也可以尝试上方的样本问题。','질문해 주셔서 감사합니다. 이 채팅은 포트폴리오용 AI 도우미 데모입니다. 실제 서비스에서는 베트남 시장, 경쟁사, 현지 정보를 바탕으로 조사 결과를 정리합니다. 위 샘플 질문도 이용해 보세요.','Gracias por tu pregunta. Este chat es una demo de asistente de IA para portafolio. El servicio real organiza resultados sobre el mercado vietnamita, competencia e información local. También puedes probar una pregunta de ejemplo.','Merci pour votre question. Ce chat est une démonstration d’assistant IA. Le service réel structure les résultats sur le marché vietnamien, la concurrence et les informations locales. Vous pouvez aussi essayer une question exemple.'],
  ];

  const modalFragmentRows = [
    ['AI出力の確認例','AI output review example','Ví dụ kiểm tra đầu ra AI','AI输出核查示例','AI 출력 확인 예시','Ejemplo de revisión de salida IA','Exemple de contrôle de sortie IA'],
    ['市場規模データ','Market-size data','Dữ liệu quy mô thị trường','市场规模数据','시장 규모 데이터','Datos de tamaño de mercado','Données de taille de marché'],
    ['マクロ経済指標','Macroeconomic indicator','Chỉ số kinh tế vĩ mô','宏观经济指标','거시경제 지표','Indicador macroeconómico','Indicateur macroéconomique'],
    ['人口関連データ','Population data','Dữ liệu dân số','人口相关数据','인구 관련 데이터','Datos de población','Données démographiques'],
    ['投資関連データ','Investment data','Dữ liệu đầu tư','投资相关数据','투자 관련 데이터','Datos de inversión','Données d’investissement'],
    ['データソース: デモ用表示例','Data source: demo example','Nguồn dữ liệu: ví dụ demo','数据来源：演示示例','데이터 출처: 데모 예시','Fuente: ejemplo de demo','Source : exemple de démonstration'],
    ['Tiki / その他','Tiki / Other','Tiki / Khác','Tiki / 其他','Tiki / 기타','Tiki / Otros','Tiki / Autres'],
    ['現地確認プロセスの表示例','Local verification process example','Ví dụ quy trình xác minh địa phương','本地核验流程示例','현지 확인 프로세스 예시','Ejemplo de verificación local','Exemple de vérification locale'],
    ['現地ヒアリング情報の表示例','Local interview information example','Ví dụ thông tin phỏng vấn địa phương','本地访谈信息示例','현지 인터뷰 정보 예시','Ejemplo de entrevistas locales','Exemple d’entretiens locaux'],
    ['対象:','Subject:','Đối tượng:','对象：','대상:','Objeto:','Objet :'],
    ['現地ヒアリング情報の掲載例','Example of local interview findings','Ví dụ kết quả phỏng vấn địa phương','本地访谈内容示例','현지 인터뷰 정보 예시','Ejemplo de hallazgos locales','Exemple de constats locaux'],
    ['「現地で確認した情報や一次情報を、意思決定に活用しやすい形で整理する想定です。」','“Locally verified and primary-source information is organized into a decision-ready format.”','“Thông tin xác minh tại địa phương và nguồn sơ cấp được trình bày để hỗ trợ ra quyết định.”','“将本地核实信息和一手资料整理为便于决策的形式。”','“현지 확인 정보와 1차 정보를 의사결정에 활용하기 쉽게 정리합니다.”','«La información local y primaria se organiza para facilitar la toma de decisiones.»','«Les informations locales et primaires sont structurées pour faciliter la décision.»'],
  ];

const residualRows = [
    ['進行中の市場調査プロジェクト・プラン管理','Active market research projects & plan management','Quản lý dự án nghiên cứu thị trường và kế hoạch đang thực hiện','进行中的市场调研项目与方案管理','진행 중인 시장 조사 프로젝트·플랜 관리','Proyectos de investigación activos y gestión de planes','Projets d’étude en cours et gestion des plans'],
    ['進行中','In progress','Đang thực hiện','进行中','진행 중','En curso','En cours'],
    ['ホーチミン市 競合店舗・価格帯実態調査','Ho Chi Minh City competitor stores & pricing survey','Khảo sát cửa hàng đối thủ và mức giá tại TP.HCM','胡志明市竞品门店与价格带实况调研','호찌민시 경쟁 매장·가격대 실태 조사','Estudio de tiendas competidoras y precios en Ciudad Ho Chi Minh','Étude des points de vente concurrents et des prix à Hô Chi Minh-Ville'],
    ['全体進捗','Overall progress','Tiến độ tổng thể','总体进度','전체 진행률','Progreso total','Avancement global'],
    ['調査期間:','Research period:','Thời gian nghiên cứu:','调研期间：','조사 기간:','Periodo del estudio:','Période d’étude :'],
    ['担当拠点:','Responsible office:','Đơn vị phụ trách:','负责网点：','담당 거점:','Oficina responsable:','Bureau responsable :'],
    ['HCMCリサーチチーム (5名)','HCMC research team (5 members)','Đội nghiên cứu TP.HCM (5 người)','HCMC调研团队（5人）','HCMC 리서치팀(5명)','Equipo de investigación de HCMC (5 personas)','Équipe de recherche HCMC (5 personnes)'],
    ['フェーズ別進捗ステータス','Progress by phase','Tiến độ theo giai đoạn','分阶段进度','단계별 진행 상태','Progreso por fase','Avancement par phase'],
    ['AI一次データ収集','AI primary-data collection','Thu thập dữ liệu sơ cấp bằng AI','AI一手数据收集','AI 1차 데이터 수집','Recopilación de datos primarios con IA','Collecte de données primaires par IA'],
    ['完了 (100%)','Complete (100%)','Hoàn tất (100%)','完成（100%）','완료(100%)','Completado (100 %)','Terminé (100 %)'],
    ['財務・法規制監査','Financial & regulatory audit','Kiểm toán tài chính và pháp lý','财务与法规审查','재무·법규 감사','Auditoría financiera y regulatoria','Audit financier et réglementaire'],
    ['現地対面ヒアリング','On-site interviews','Phỏng vấn trực tiếp tại địa phương','本地面对面访谈','현지 대면 인터뷰','Entrevistas presenciales locales','Entretiens locaux en présentiel'],
    ['進行中 (50%)','In progress (50%)','Đang thực hiện (50%)','进行中（50%）','진행 중(50%)','En curso (50 %)','En cours (50 %)'],
    ['最終報告書納品','Final report delivery','Bàn giao báo cáo cuối cùng','最终报告交付','최종 보고서 납품','Entrega del informe final','Livraison du rapport final'],
    ['待機中 (0%)','Pending (0%)','Đang chờ (0%)','等待中（0%）','대기 중(0%)','Pendiente (0 %)','En attente (0 %)'],
    ['調査タスク・チェックリスト','Research task checklist','Danh sách nhiệm vụ nghiên cứu','调研任务清单','조사 작업 체크리스트','Lista de tareas de investigación','Liste des tâches de recherche'],
    ['3 / 5 完了','3 / 5 complete','Hoàn tất 3 / 5','已完成3 / 5','3 / 5 완료','3 / 5 completadas','3 / 5 terminées'],
    ['マクロ経済指標の検証（GDP / 為替 / インフレ率）','Validate macroeconomic indicators (GDP / FX / inflation)','Xác minh chỉ số vĩ mô (GDP / tỷ giá / lạm phát)','验证宏观经济指标（GDP／汇率／通胀率）','거시경제 지표 검증(GDP / 환율 / 물가상승률)','Validar indicadores macroeconómicos (PIB / cambio / inflación)','Valider les indicateurs macroéconomiques (PIB / change / inflation)'],
    ['現地競合アライアンス分析（主要卸・ディストリビューター5社）','Analyze local competitor alliances (5 major wholesalers/distributors)','Phân tích liên minh đối thủ địa phương (5 nhà bán buôn/phân phối lớn)','分析本地竞品联盟（5家主要批发商／经销商）','현지 경쟁사 제휴 분석(주요 도매·유통사 5곳)','Analizar alianzas de competidores locales (5 mayoristas/distribuidores)','Analyser les alliances concurrentes locales (5 grossistes/distributeurs)'],
    ['1区・7区の対象競合店舗20箇所での実地覆面調査','On-site mystery shopping at 20 competitor stores in Districts 1 and 7','Khảo sát khách hàng bí mật tại 20 cửa hàng đối thủ ở Quận 1 và 7','在第1郡和第7郡的20家竞品门店开展实地暗访','1군·7군 경쟁 매장 20곳 현장 미스터리 쇼핑','Cliente misterioso en 20 tiendas competidoras de los distritos 1 y 7','Visites mystère dans 20 points de vente concurrents des 1er et 7e arrondissements'],
    ['許認可リスク・関税適用の現地弁護士オピニオン照会','Obtain local legal opinion on licensing risks and tariffs','Xin ý kiến luật sư địa phương về rủi ro giấy phép và thuế quan','咨询本地律师关于许可风险及关税适用的意见','인허가 리스크·관세 적용 현지 변호사 의견 조회','Solicitar opinión jurídica local sobre licencias y aranceles','Obtenir un avis juridique local sur les autorisations et les droits de douane'],
    ['経営企画・役員会向け納品サマリー執筆','Draft delivery summary for corporate planning and the board','Soạn tóm tắt bàn giao cho bộ phận kế hoạch và ban lãnh đạo','撰写面向经营企划与董事会的交付摘要','경영기획·이사회용 납품 요약 작성','Redactar el resumen para planificación y consejo','Rédiger la synthèse destinée à la planification et à la direction'],
    ['と、VN Insight AIの解決','and the VN Insight AI solution','và giải pháp của VN Insight AI','与VN Insight AI的解决方案','그리고 VN Insight AI의 해결책','y la solución de VN Insight AI','et la solution VN Insight AI'],
    ['検索で出てくるベトナムの情報は古い','Vietnam information found through search is often outdated,','Thông tin về Việt Nam tìm thấy qua công cụ tìm kiếm thường đã cũ,','搜索到的越南信息往往陈旧，','검색으로 찾는 베트남 정보는 오래된','La información sobre Vietnam encontrada en buscadores suele estar desactualizada,','Les informations sur le Vietnam trouvées en ligne sont souvent obsolètes,'],
    ['マクロデータばかり。ネット上の情報や、','limited to macro data. Online sources and','chủ yếu là dữ liệu vĩ mô. Nguồn trực tuyến và','且多为宏观数据。网络信息以及','거시 데이터뿐입니다. 온라인 정보와','y se limita a datos macro. Las fuentes en línea y','et limitées aux données macro. Les sources en ligne et'],
    ['汎用AIによるハルシネーション（幻覚）の','hallucinations from general-purpose AI create','ảo giác từ AI phổ thông tạo ra','通用AI的幻觉会带来','범용 AI의 할루시네이션으로 인한','las alucinaciones de la IA general generan','les hallucinations des IA généralistes créent'],
    ['嘘ノイズに踊らされる恐怖。','a real risk of being misled by false signals.','nguy cơ bị dẫn dắt bởi tín hiệu sai lệch.','被虚假噪声误导的风险。','거짓 노이즈에 휘둘릴 위험이 있습니다.','el riesgo de dejarse llevar por señales falsas.','un risque réel d’être induit en erreur.'],
    ['出典：Statista, MoIT, GSO','Sources: Statista, MoIT, GSO','Nguồn: Statista, MoIT, GSO','来源：Statista、MoIT、GSO','출처: Statista, MoIT, GSO','Fuentes: Statista, MoIT, GSO','Sources : Statista, MoIT, GSO'],
    ['ベトナムへの情熱と、','Passion for Vietnam, ','Niềm đam mê với Việt Nam, ','对越南的热情，','베트남을 향한 열정과 ','Pasión por Vietnam y ','La passion du Vietnam et '],
    ['プロとしての','professional ','tinh thần ','专业','프로로서의 ','la ','la '],
    ['クレジットカード登録不要','No credit card required','Không cần đăng ký thẻ tín dụng','无需信用卡','카드 등록 불필요','No se requiere tarjeta','Aucune carte bancaire requise'],
    ['1分で完了','Takes 1 minute','Hoàn tất trong 1 phút','1分钟完成','1분이면 완료','Listo en 1 minuto','Terminé en 1 minute'],
    ['24時間以内にご連絡','We will contact you within 24 hours','Liên hệ trong vòng 24 giờ','24小时内联系','24시간 이내 연락','Te contactaremos en 24 horas','Nous vous contactons sous 24 heures'],
    ['ベトナム市場の一次情報を、','Primary-source insights on the Vietnamese market,','Thông tin sơ cấp về thị trường Việt Nam,','越南市场的一手信息，','베트남 시장의 1차 정보를,','Información primaria del mercado vietnamita,','Des informations de première main sur le marché vietnamien,'],
    ['現地調査とAIで意思決定につなげる。','turned into decisions through local research and AI.','được chuyển hóa thành quyết định nhờ nghiên cứu tại chỗ và AI.','通过本地调研与AI转化为决策。','현지 조사와 AI로 의사결정에 연결합니다.','convertida en decisiones mediante investigación local e IA.','transformées en décisions grâce à la recherche locale et à l’IA.'],
  ];

const step6Rows = [
  ["すべて","All","Tất cả","全部","전체","Todos","Tous"],
  ["製造・物流","Manufacturing & Logistics","Sản xuất & Logistics","制造与物流","제조·물류","Manufactura y logística","Industrie et logistique"],
  ["消費財・EC","Consumer Goods & E-commerce","Hàng tiêu dùng & TMĐT","消费品与电商","소비재·이커머스","Bienes de consumo y e-commerce","Biens de consommation et e-commerce"],
  ["不動産","Real Estate","Bất động sản","房地产","부동산","Inmobiliario","Immobilier"],
  ["法規制","Regulations","Quy định pháp lý","法规","법규","Regulación","Réglementation"],
  ["ベトナム主要業界レポート・市場動向","Vietnam Industry Reports & Market Trends","Báo cáo ngành & xu hướng thị trường Việt Nam","越南主要行业报告与市场趋势","베트남 주요 산업 보고서·시장 동향","Informes sectoriales y tendencias del mercado de Vietnam","Rapports sectoriels et tendances du marché vietnamien"],
  ["業界・キーワードでレポートを検索...","Search reports by industry or keyword...","Tìm báo cáo theo ngành hoặc từ khóa...","按行业或关键词搜索报告...","산업·키워드로 보고서 검색...","Buscar informes por sector o palabra clave...","Rechercher des rapports par secteur ou mot-clé..."],
  ["件表示中","items shown","mục đang hiển thị","条显示中","건 표시 중","elementos mostrados","éléments affichés"],
  ["PDFダウンロード","Download PDF","Tải PDF","下载PDF","PDF 다운로드","Descargar PDF","Télécharger le PDF"],
  ["IT/DX市場予測","IT/DX Market Outlook","Dự báo thị trường IT/DX","IT/DX市场预测","IT/DX 시장 전망","Perspectivas del mercado IT/DX","Perspectives du marché IT/DX"],
  ["小売/EC市場規模","Retail/E-commerce Market Size","Quy mô thị trường bán lẻ/TMĐT","零售/电商市场规模","소매/이커머스 시장 규모","Tamaño del mercado retail/e-commerce","Taille du marché retail/e-commerce"],
  ["製造業・物流","Manufacturing & Logistics","Sản xuất & Logistics","制造业与物流","제조업·물류","Industria y logística","Industrie et logistique"],
  ["2026年 ベトナムIT/DX市場動向予測レポート (PDF)","2026 Vietnam IT/DX Market Outlook Report (PDF)","Báo cáo triển vọng thị trường IT/DX Việt Nam 2026 (PDF)","2026年越南IT/DX市场趋势预测报告（PDF）","2026년 베트남 IT/DX 시장 전망 보고서 (PDF)","Informe de perspectivas del mercado IT/DX de Vietnam 2026 (PDF)","Rapport sur les perspectives du marché IT/DX au Vietnam en 2026 (PDF)"],
  ["受託開発からAI・クラウドへの移行動向と主要メガテック10社詳細比較。","Shift from outsourced development to AI/cloud and detailed comparison of 10 major tech companies.","Xu hướng chuyển từ gia công sang AI/cloud và so sánh 10 tập đoàn công nghệ lớn.","从外包开发向AI与云转型的趋势及10家主要科技公司详细对比。","수탁 개발에서 AI·클라우드 전환 동향과 주요 빅테크 10개사 상세 비교.","Transición del desarrollo externalizado a IA/cloud y comparación de 10 grandes tecnológicas.","Transition du développement externalisé vers l’IA/cloud et comparaison de 10 grands groupes technologiques."],
  ["ベトナム小売・EC市場参入完全ガイド","Complete Guide to Vietnam Retail & E-commerce Market Entry","Cẩm nang toàn diện thâm nhập thị trường bán lẻ & TMĐT Việt Nam","越南零售与电商市场进入完整指南","베트남 소매·이커머스 시장 진출 완전 가이드","Guía completa de entrada al mercado retail y e-commerce de Vietnam","Guide complet d’entrée sur le marché vietnamien du retail et de l’e-commerce"],
  ["Shopee/TikTok Shop二強時代の物流ネットワークと消費者の購買決定要因。","Logistics networks and consumer purchase drivers in the Shopee/TikTok Shop era.","Mạng lưới logistics và yếu tố quyết định mua hàng trong thời kỳ Shopee/TikTok Shop.","Shopee/TikTok Shop双雄时代的物流网络与消费者购买决策因素。","Shopee/TikTok Shop 양강 시대의 물류 네트워크와 소비자 구매 결정 요인.","Redes logísticas y factores de compra en la era Shopee/TikTok Shop.","Réseaux logistiques et facteurs d’achat à l’ère Shopee/TikTok Shop."],
  ["北部・南部 工業団地インフラ・コスト徹底比較","North vs. South Industrial Parks: Infrastructure & Cost Comparison","So sánh hạ tầng & chi phí KCN miền Bắc và miền Nam","越南北部与南部工业园区基础设施及成本对比","북부·남부 산업단지 인프라·비용 비교","Comparativa de infraestructura y costes de parques industriales del norte y sur","Comparatif des infrastructures et coûts des zones industrielles du Nord et du Sud"],
  ["ハノイ近郊 vs ホーチミン経済圏の電力安定性・人件費・税制優遇措置の実態。","Power stability, labor costs and tax incentives: Hanoi outskirts vs. HCMC region.","Độ ổn định điện, chi phí nhân công và ưu đãi thuế: vùng ven Hà Nội so với TP.HCM.","河内近郊与胡志明市经济圈的供电稳定性、人力成本及税收优惠对比。","하노이 근교와 호찌민 경제권의 전력 안정성·인건비·세제 혜택 비교.","Estabilidad eléctrica, costes laborales e incentivos fiscales: Hanói vs. HCMC.","Stabilité électrique, coûts salariaux et incitations fiscales : Hanoï vs HCMC."],
  ["外資規制・2026年法改正ロードマップ解説書","Foreign Investment Regulations & 2026 Legal Reform Roadmap","Quy định đầu tư nước ngoài & lộ trình sửa đổi luật 2026","外资监管与2026年法律修订路线图","외자 규제·2026년 법 개정 로드맵","Regulación de inversión extranjera y hoja de ruta legal 2026","Réglementation des investissements étrangers et feuille de route juridique 2026"],
  ["新投資法・環境基準改定に伴う認可取得プロセスの変更点と実務上の留意点。","Licensing changes and practical considerations under revised investment and environmental rules.","Thay đổi quy trình cấp phép và lưu ý thực tiễn theo luật đầu tư và môi trường sửa đổi.","新投资法及环境标准修订后的许可流程变化与实务注意事项。","신 투자법·환경 기준 개정에 따른 인허가 절차 변경과 실무 유의사항.","Cambios de licencias y consideraciones prácticas tras reformas de inversión y medio ambiente.","Évolutions des autorisations et points de vigilance après réforme de l’investissement et de l’environnement."],
  ["日系企業の現地合弁・M&A成功と失敗の教訓集","Lessons from Japanese Companies’ JV & M&A Successes and Failures","Bài học thành công và thất bại từ liên doanh & M&A của doanh nghiệp Nhật","日资企业本地合资与M&A成败经验","일본계 기업의 현지 합작·M&A 성공과 실패 사례","Lecciones de éxitos y fracasos de JV y M&A de empresas japonesas","Enseignements des succès et échecs de JV et M&A d’entreprises japonaises"],
  ["過去5年間に進出した中堅・中小企業42社の事例から紐解くリスク管理術。","Risk-management lessons from 42 SME and mid-sized market-entry cases over five years.","Bài học quản trị rủi ro từ 42 trường hợp doanh nghiệp vừa và nhỏ trong 5 năm.","从过去5年42家中小及中型企业进入市场案例中总结风险管理方法。","최근 5년간 진출한 중견·중소기업 42개 사례에서 배우는 리스크 관리.","Lecciones de gestión de riesgos de 42 casos de entrada de pymes en cinco años.","Leçons de gestion des risques tirées de 42 implantations de PME et ETI sur cinq ans."],
  ["ベトナム脱炭素・グリーン成長投資機会分析","Vietnam Decarbonization & Green Growth Investment Opportunities","Cơ hội đầu tư khử carbon & tăng trưởng xanh tại Việt Nam","越南脱碳与绿色增长投资机会分析","베트남 탈탄소·녹색성장 투자 기회 분석","Oportunidades de inversión en descarbonización y crecimiento verde en Vietnam","Opportunités d’investissement dans la décarbonation et la croissance verte au Vietnam"],
  ["屋根置き太陽光・省エネ設備投資への政府補助金と日系デベロッパー動向。","Government incentives for rooftop solar and energy efficiency, plus Japanese developer trends.","Trợ cấp cho điện mặt trời mái nhà, tiết kiệm năng lượng và xu hướng nhà phát triển Nhật.","屋顶光伏与节能投资政府补贴及日资开发商动向。","옥상형 태양광·에너지 절감 투자 정부 보조금과 일본계 개발사 동향.","Incentivos para solar en tejado y eficiencia energética, y tendencias de desarrolladores japoneses.","Aides au solaire en toiture et à l’efficacité énergétique, et tendances des développeurs japonais."],
  ["現地情報と照合した 財務・市場データライブラリ","Financial & Market Data Library Cross-checked with Local Sources","Thư viện dữ liệu tài chính & thị trường đã đối chiếu nguồn địa phương","经本地信息核验的财务与市场数据库","현지 정보와 대조한 재무·시장 데이터 라이브러리","Biblioteca de datos financieros y de mercado contrastados localmente","Bibliothèque de données financières et de marché recoupées localement"],
  ["全382件収録","382 records in total","Tổng cộng 382 bản ghi","共收录382条","총 382건 수록","382 registros en total","382 entrées au total"],
  ["財務データ","Financial Data","Dữ liệu tài chính","财务数据","재무 데이터","Datos financieros","Données financières"],
  ["シェア率","Market Share","Thị phần","市场份额","점유율","Cuota de mercado","Part de marché"],
  ["人件費","Labor Cost","Chi phí nhân công","人力成本","인건비","Coste laboral","Coût de la main-d’œuvre"],
  ["項目・企業名","Item / Company","Mục / Công ty","项目/企业名称","항목·기업명","Elemento / Empresa","Élément / Entreprise"],
  ["カテゴリ","Category","Danh mục","类别","카테고리","Categoría","Catégorie"],
  ["数値・指標","Value / Metric","Giá trị / Chỉ số","数值/指标","수치·지표","Valor / Indicador","Valeur / Indicateur"],
  ["情報ソース (一次情報)","Source (Primary)","Nguồn (sơ cấp)","信息来源（一手资料）","정보 소스 (1차 정보)","Fuente (primaria)","Source (primaire)"],
  ["検証日時","Verified At","Thời điểm xác minh","核验时间","검증 일시","Fecha de verificación","Date de vérification"],
  ["ステータス","Status","Trạng thái","状态","상태","Estado","Statut"],
  ["企業名・指標名・情報ソースで検索...","Search by company, metric or source...","Tìm theo công ty, chỉ số hoặc nguồn...","按企业、指标或信息来源搜索...","기업명·지표명·정보 소스로 검색...","Buscar por empresa, indicador o fuente...","Rechercher par entreprise, indicateur ou source..."],
  ["全データ382件中","Out of 382 records","Trong tổng số 382 bản ghi","共382条数据中","전체 382건 중","De 382 registros","Sur 382 entrées"],
  ["件を表示","items shown","mục được hiển thị","条显示","건 표시","elementos mostrados","éléments affichés"],
  ["CSVエクスポート","Export CSV","Xuất CSV","导出CSV","CSV 내보내기","Exportar CSV","Exporter en CSV"],
  ["照合","Verified","Đã đối chiếu","已核验","대조 완료","Verificado","Vérifié"],
  ["VinGroup Retail (HCM商業施設賃料)","VinGroup Retail (HCMC commercial rent)","VinGroup Retail (giá thuê thương mại HCMC)","VinGroup Retail（HCMC商业设施租金）","VinGroup Retail (HCMC 상업시설 임대료)","VinGroup Retail (alquiler comercial en HCMC)","VinGroup Retail (loyers commerciaux à HCMC)"],
  ["現地登記簿・店舗対面ヒアリング","Local registry & in-person store interviews","Đăng ký địa phương & phỏng vấn trực tiếp tại cửa hàng","本地登记资料与门店面对面访谈","현지 등기부·매장 대면 인터뷰","Registro local y entrevistas presenciales","Registre local et entretiens en magasin"],
  ["Shopee VN vs TikTok Shop (EC流通シェア)","Shopee VN vs TikTok Shop (e-commerce share)","Shopee VN vs TikTok Shop (thị phần TMĐT)","Shopee VN vs TikTok Shop（电商份额）","Shopee VN vs TikTok Shop (이커머스 점유율)","Shopee VN vs TikTok Shop (cuota e-commerce)","Shopee VN vs TikTok Shop (part e-commerce)"],
  ["税務申告データ・電子決済統計","Tax filing data & e-payment statistics","Dữ liệu khai thuế & thống kê thanh toán điện tử","税务申报数据与电子支付统计","세무 신고 데이터·전자결제 통계","Datos fiscales y estadísticas de pagos electrónicos","Données fiscales et statistiques de paiement électronique"],
  ["Masan Group (日用品・調味料流通マージン)","Masan Group (FMCG & seasoning distribution margin)","Masan Group (biên lợi nhuận phân phối FMCG & gia vị)","Masan Group（日用品与调味品流通利润率）","Masan Group (생활용품·조미료 유통 마진)","Masan Group (margen de distribución de consumo y condimentos)","Masan Group (marge de distribution produits courants et condiments)"],
  ["公開年次決算・現地情報","Published annual results & local information","Báo cáo năm công khai & thông tin địa phương","公开年度财报与本地信息","공개 연차 결산·현지 정보","Resultados anuales publicados e información local","Résultats annuels publiés et informations locales"],
  ["外資100%小売出店ライセンス (ENT審査)","100% foreign-owned retail license (ENT review)","Giấy phép bán lẻ 100% vốn nước ngoài (thẩm định ENT)","外资100%零售许可（ENT审查）","외자 100% 소매 라이선스 (ENT 심사)","Licencia retail 100 % extranjera (revisión ENT)","Licence retail 100 % étrangère (examen ENT)"],
  ["商工省(MoIT)通達・弁護士確認","MoIT circulars & lawyer verification","Thông tư MoIT & xác nhận luật sư","工贸部（MoIT）通知与律师核验","상공부(MoIT) 통지·변호사 확인","Circulares del MoIT y verificación jurídica","Circulaires du MoIT et vérification juridique"],
  ["FPT Corporation (ITエンジニア初任給)","FPT Corporation (entry-level IT engineer salary)","FPT Corporation (lương khởi điểm kỹ sư IT)","FPT Corporation（IT工程师起薪）","FPT Corporation (IT 엔지니어 초봉)","FPT Corporation (salario inicial de ingeniero IT)","FPT Corporation (salaire d’entrée d’un ingénieur IT)"],
  ["現地HR企業3社給与サーベイ","Salary surveys from 3 local HR firms","Khảo sát lương từ 3 công ty nhân sự địa phương","3家本地HR公司的薪资调查","현지 HR 기업 3개사 급여 서베이","Encuestas salariales de 3 firmas locales de RR. HH.","Enquêtes salariales de 3 cabinets RH locaux"],
  ["ハノイ近郊 物流倉庫空室率 (ロジスティクス)","Logistics warehouse vacancy near Hanoi","Tỷ lệ trống kho logistics gần Hà Nội","河内近郊物流仓库空置率","하노이 근교 물류창고 공실률","Vacancia de almacenes logísticos cerca de Hanói","Taux de vacance des entrepôts logistiques près de Hanoï"],
  ["物流指標","Logistics Metric","Chỉ số logistics","物流指标","물류 지표","Indicador logístico","Indicateur logistique"],
  ["港湾局データ・デベロッパー監査","Port authority data & developer audit","Dữ liệu cảng vụ & kiểm toán chủ đầu tư","港务局数据与开发商审计","항만청 데이터·개발사 감사","Datos de autoridad portuaria y auditoría del promotor","Données de l’autorité portuaire et audit du développeur"],
  ["カスタムレポート生成・エクスポート","Custom Report Generation & Export","Tạo & xuất báo cáo tùy chỉnh","生成与导出自定义报告","맞춤 보고서 생성·내보내기","Generación y exportación de informes personalizados","Génération et export de rapports personnalisés"],
  ["出力履歴:","Export history:","Lịch sử xuất:","导出历史：","출력 이력:","Historial de exportación:","Historique des exports :"],
  ["件","items","mục","条","건","elementos","éléments"],
  ["① 調査対象期間","① Research period","① Thời gian nghiên cứu","① 调研时间范围","① 조사 대상 기간","① Periodo de investigación","① Période de recherche"],
  ["直近1ヶ月","Last month","1 tháng gần nhất","最近1个月","최근 1개월","Último mes","Dernier mois"],
  ["直近3ヶ月","Last 3 months","3 tháng gần nhất","最近3个月","최근 3개월","Últimos 3 meses","3 derniers mois"],
  ["2026年予測","2026 forecast","Dự báo 2026","2026年预测","2026년 전망","Previsión 2026","Prévisions 2026"],
  ["全期間","All time","Toàn bộ thời gian","全部期间","전체 기간","Todo el periodo","Toute la période"],
  ["② ファイル出力形式","② File format","② Định dạng tệp","② 文件格式","② 파일 출력 형식","② Formato de archivo","② Format de fichier"],
  ["PDF (役員会提出用)","PDF (board-ready)","PDF (dùng cho ban lãnh đạo)","PDF（董事会提交用）","PDF (이사회 제출용)","PDF (para consejo)","PDF (pour le conseil)"],
  ["CSV (ローデータ)","CSV (raw data)","CSV (dữ liệu thô)","CSV（原始数据）","CSV (원시 데이터)","CSV (datos brutos)","CSV (données brutes)"],
  ["PPTX (スライド)","PPTX (slides)","PPTX (slide)","PPTX（幻灯片）","PPTX (슬라이드)","PPTX (diapositivas)","PPTX (diapositives)"],
  ["③ 抽出セクション選択","③ Select sections","③ Chọn mục xuất","③ 选择导出章节","③ 추출 섹션 선택","③ Seleccionar secciones","③ Sélectionner les sections"],
  ["マクロ経済指標・実質GDP推移","Macroeconomic indicators & real GDP trend","Chỉ số vĩ mô & xu hướng GDP thực","宏观经济指标与实际GDP走势","거시경제 지표·실질 GDP 추이","Indicadores macroeconómicos y evolución del PIB real","Indicateurs macroéconomiques et évolution du PIB réel"],
  ["現地競合分析・シェア率比較","Local competitor analysis & market-share comparison","Phân tích đối thủ địa phương & so sánh thị phần","本地竞品分析与市场份额对比","현지 경쟁사 분석·점유율 비교","Análisis de competidores locales y comparación de cuota","Analyse des concurrents locaux et comparaison des parts de marché"],
  ["法規制リスク・許認可チェック","Regulatory risk & licensing check","Rủi ro pháp lý & kiểm tra giấy phép","法规风险与许可检查","법규 리스크·인허가 체크","Riesgo regulatorio y revisión de licencias","Risques réglementaires et vérification des autorisations"],
  ["財務シミュレーション・事業計画","Financial simulation & business plan","Mô phỏng tài chính & kế hoạch kinh doanh","财务模拟与商业计划","재무 시뮬레이션·사업 계획","Simulación financiera y plan de negocio","Simulation financière et plan d’affaires"],
  ["出力履歴ログ (直近作成ファイル)","Export history (recent files)","Lịch sử xuất (tệp gần đây)","导出历史（最近文件）","출력 이력 (최근 파일)","Historial de exportación (archivos recientes)","Historique des exports (fichiers récents)"],
  ["再ダウンロード","Download again","Tải lại","重新下载","재다운로드","Volver a descargar","Télécharger à nouveau"],
  ["アカウント・システム設定","Account & System Settings","Cài đặt tài khoản & hệ thống","账户与系统设置","계정·시스템 설정","Configuración de cuenta y sistema","Paramètres du compte et du système"],
  ["アカウント・組織情報","Account & Organization","Tài khoản & tổ chức","账户与组织信息","계정·조직 정보","Cuenta y organización","Compte et organisation"],
  ["ユーザー名","User Name","Tên người dùng","用户名","사용자명","Nombre de usuario","Nom d’utilisateur"],
  ["メールアドレス","Email Address","Địa chỉ email","邮箱地址","이메일 주소","Correo electrónico","Adresse e-mail"],
  ["所属組織 / 部署","Organization / Department","Tổ chức / Bộ phận","所属组织/部门","소속 조직 / 부서","Organización / Departamento","Organisation / Service"],
  ["アカウント権限","Account Role","Quyền tài khoản","账户权限","계정 권한","Rol de cuenta","Rôle du compte"],
  ["最高管理者 (全機能解放)","Super Admin (all features)","Quản trị viên cao nhất (toàn bộ tính năng)","超级管理员（全部功能）","최고 관리자 (전체 기능)","Superadministrador (todas las funciones)","Super administrateur (toutes les fonctions)"],
  ["通知・配信設定","Notifications & Delivery","Thông báo & phân phối","通知与推送设置","알림·배포 설정","Notificaciones y distribución","Notifications et diffusion"],
  ["週次ベトナム市場サマリー通知","Weekly Vietnam market summary","Tóm tắt thị trường Việt Nam hàng tuần","每周越南市场摘要","주간 베트남 시장 요약 알림","Resumen semanal del mercado de Vietnam","Résumé hebdomadaire du marché vietnamien"],
  ["毎週月曜日AM9:00に最新指標をメール配信","Email latest indicators every Monday at 9:00 AM","Gửi email chỉ số mới nhất lúc 9:00 sáng thứ Hai","每周一上午9:00邮件发送最新指标","매주 월요일 오전 9시에 최신 지표 이메일 발송","Enviar los últimos indicadores cada lunes a las 9:00","Envoi des derniers indicateurs chaque lundi à 9 h"],
  ["調査タスク完了・レポート納品通知","Research task completion & report delivery","Hoàn thành nhiệm vụ nghiên cứu & bàn giao báo cáo","调研任务完成与报告交付","조사 작업 완료·보고서 납품 알림","Finalización de tareas y entrega de informes","Fin des tâches de recherche et livraison des rapports"],
  ["現地監査が完了した瞬間にSlack/メールへ速報","Instant Slack/email alert when local audit completes","Thông báo ngay qua Slack/email khi kiểm toán tại chỗ hoàn tất","本地审查完成后立即通过Slack/邮件通知","현지 감사 완료 즉시 Slack/이메일 알림","Aviso inmediato por Slack/email al finalizar la auditoría local","Alerte immédiate Slack/e-mail à la fin de l’audit local"],
  ["外資法規制・リスク急変アラート","Foreign investment regulation & risk alerts","Cảnh báo quy định đầu tư nước ngoài & rủi ro","外资法规与风险变动警报","외자 법규·리스크 급변 알림","Alertas de regulación extranjera y riesgo","Alertes réglementation des investissements étrangers et risques"],
  ["投資法・環境基準改定時の重要アラート","Priority alerts for investment-law/environmental changes","Cảnh báo quan trọng khi luật đầu tư/môi trường thay đổi","投资法或环境标准修订的重要警报","투자법·환경 기준 개정 시 중요 알림","Alertas prioritarias por cambios legales o ambientales","Alertes prioritaires lors de changements juridiques ou environnementaux"],
  ["API連携キー管理","API Integration Key Management","Quản lý khóa tích hợp API","API集成密钥管理","API 연동 키 관리","Gestión de claves API","Gestion des clés API"],
  ["キーをコピー","Copy Key","Sao chép khóa","复制密钥","키 복사","Copiar clave","Copier la clé"],
  ["再生成","Regenerate","Tạo lại","重新生成","재생성","Regenerar","Régénérer"],
  ["表示言語設定 (Language)","Display Language","Ngôn ngữ hiển thị","显示语言","표시 언어","Idioma de visualización","Langue d’affichage"],
  ["設定を保存","Save Settings","Lưu cài đặt","保存设置","설정 저장","Guardar configuración","Enregistrer les paramètres"],
  ["サンプルレポートのリクエストを受け付けました","Sample report request received","Đã nhận yêu cầu báo cáo mẫu","已收到样本报告请求","샘플 보고서 요청을 접수했습니다","Solicitud de informe de muestra recibida","Demande de rapport d’exemple reçue"],
  ["APIキーをクリップボードにコピーしました","API key copied to clipboard","Đã sao chép khóa API","API密钥已复制到剪贴板","API 키를 클립보드에 복사했습니다","Clave API copiada","Clé API copiée"],
  ["APIキーを再生成しました","API key regenerated","Đã tạo lại khóa API","API密钥已重新生成","API 키를 재생성했습니다","Clave API regenerada","Clé API régénérée"],
  ["設定を保存しました","Settings saved","Đã lưu cài đặt","设置已保存","설정을 저장했습니다","Configuración guardada","Paramètres enregistrés"],
  ["調査を開始しました","Research started","Đã bắt đầu nghiên cứu","调研已开始","조사를 시작했습니다","Investigación iniciada","Recherche lancée"],
  ["レポートを生成中...","Generating report...","Đang tạo báo cáo...","正在生成报告...","보고서 생성 중...","Generando informe...","Génération du rapport..."],
  ["PDFを出力中...","Exporting PDF...","Đang xuất PDF...","正在导出PDF...","PDF 출력 중...","Exportando PDF...","Export du PDF..."],
  ["PPTXを出力中...","Exporting PPTX...","Đang xuất PPTX...","正在导出PPTX...","PPTX 출력 중...","Exportando PPTX...","Export du PPTX..."],
  ["アクションを実行しました","Action completed","Đã thực hiện thao tác","操作已执行","작업을 실행했습니다","Acción completada","Action effectuée"],
  ["← 横にスワイプして比較 →","← Swipe horizontally to compare →","← Vuốt ngang để so sánh →","← 横向滑动进行比较 →","← 가로로 스와이프하여 비교 →","← Desliza horizontalmente para comparar →","← Balayez horizontalement pour comparer →"],
];

const step6FixRows = [
  ["IT・DX","IT/DX","IT/DX","IT/DX","IT/DX","IT/DX","IT/DX"],
  ["6件表示中","6 items shown","Đang hiển thị 6 mục","显示6条","6건 표시 중","6 elementos mostrados","6 éléments affichés"],
  ["全データ382件中 6件を表示","Showing 6 of 382 records","Hiển thị 6/382 bản ghi","显示382条中的6条","전체 382건 중 6건 표시","Mostrando 6 de 382 registros","Affichage de 6 éléments sur 382"],
  ["28.5% (平均粗利)","28.5% (avg. gross margin)","28,5% (biên lợi nhuận gộp TB)","28.5%（平均毛利率）","28.5% (평균 매출총이익률)","28,5 % (margen bruto medio)","28,5 % (marge brute moyenne)"],
  ["取得期間: 平均4.2ヶ月","Lead time: 4.2 months on average","Thời gian: trung bình 4,2 tháng","办理周期：平均4.2个月","취득 기간: 평균 4.2개월","Plazo: 4,2 meses de media","Délai : 4,2 mois en moyenne"],
  ["4.8% (需給逼迫)","4.8% (tight supply-demand)","4,8% (cung-cầu thắt chặt)","4.8%（供需紧张）","4.8% (수급 타이트)","4,8 % (oferta-demanda ajustada)","4,8 % (offre-demande tendue)"],
  ["$135 / ㎡ / 月","$135 / m² / month","135 USD / m² / tháng","135美元 / ㎡ / 月","$135 / ㎡ / 월","135 USD / m² / mes","135 $ / m² / mois"],
  ["$920 / 月","$920 / month","920 USD / tháng","920美元 / 月","$920 / 월","920 USD / mes","920 $ / mois"],
  ["出力履歴: 3件","Export history: 3 items","Lịch sử xuất: 3 mục","导出历史：3条","출력 이력: 3건","Historial de exportación: 3 elementos","Historique des exports : 3 éléments"],
  ["「PDF」レポートを生成・出力","Generate & export PDF report","Tạo & xuất báo cáo PDF","生成并导出PDF报告","PDF 보고서 생성·출력","Generar y exportar informe PDF","Générer et exporter le rapport PDF"],
  ["「CSV」レポートを生成・出力","Generate & export CSV report","Tạo & xuất báo cáo CSV","生成并导出CSV报告","CSV 보고서 생성·출력","Generar y exportar informe CSV","Générer et exporter le rapport CSV"],
  ["「PPTX」レポートを生成・出力","Generate & export PPTX report","Tạo & xuất báo cáo PPTX","生成并导出PPTX报告","PPTX 보고서 생성·출력","Generar y exportar informe PPTX","Générer et exporter le rapport PPTX"],
  ["表示","Show","Hiển thị","显示","표시","Mostrar","Afficher"],
];

const toastRows = [
  ["確認データ(CSV)をダウンロードしました","Verified data (CSV) downloaded","Đã tải dữ liệu đã xác minh (CSV)","已下载核验数据（CSV）","확인 데이터(CSV)를 다운로드했습니다","Datos verificados (CSV) descargados","Données vérifiées (CSV) téléchargées"],
  ["レポート生成のシミュレーションを開始しました","Report-generation simulation started","Đã bắt đầu mô phỏng tạo báo cáo","已开始报告生成模拟","보고서 생성 시뮬레이션을 시작했습니다","Simulación de generación de informe iniciada","Simulation de génération de rapport lancée"],
  ["EC市場トレンドレポートを開きます","Opening e-commerce market trends report","Đang mở báo cáo xu hướng thị trường TMĐT","正在打开电商市场趋势报告","이커머스 시장 트렌드 보고서를 엽니다","Abriendo informe de tendencias de e-commerce","Ouverture du rapport sur les tendances e-commerce"],
  ["製造業レポートを開きます","Opening manufacturing report","Đang mở báo cáo ngành sản xuất","正在打开制造业报告","제조업 보고서를 엽니다","Abriendo informe de manufactura","Ouverture du rapport sur l’industrie manufacturière"],
  ["消費者インサイトレポートを開きます","Opening consumer insights report","Đang mở báo cáo insight người tiêu dùng","正在打开消费者洞察报告","소비자 인사이트 보고서를 엽니다","Abriendo informe de insights del consumidor","Ouverture du rapport sur les insights consommateurs"],
  ["隠す","Hide","Ẩn","隐藏","숨기기","Ocultar","Masquer"],
];

const attributeRows = [
    ['現地情報と照合 - Checked with local sources','Cross-checked with local sources','Đối chiếu với nguồn địa phương','已与本地信息核对','현지 정보와 대조 - Checked with local sources','Contrastado con fuentes locales','Recoupé avec des sources locales'],
    ['ベトナム全土の散らばった各種データ','Dispersed data from across Vietnam','Dữ liệu phân tán trên toàn Việt Nam','分散在越南各地的数据','베트남 전역에 흩어진 각종 데이터','Datos dispersos por todo Vietnam','Données dispersées dans tout le Vietnam'],
  ];

  const allRows = [...rows, ...extraRows, ...faqRows, ...modalRows, ...fragmentRows, ...chatRows, ...modalFragmentRows, ...residualRows, ...step6Rows, ...step6FixRows, ...toastRows, ...attributeRows];
  const maps = Object.fromEntries(SUPPORTED.map((lang, index) => [lang, new Map(allRows.map(row => [row[0], row[index] || row[0]]))]));
  const originals = new WeakMap();
  let currentLanguage = 'ja';
  let observer;
  let applying = false;

  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
  const chooseInitialLanguage = () => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED.includes(saved)) return saved;
    const browserLanguages = [...(navigator.languages || []), navigator.language].filter(Boolean);
    for (const value of browserLanguages) {
      const code = value.toLowerCase().split('-')[0];
      if (SUPPORTED.includes(code)) return code;
    }
    return 'ja';
  };

  const translateDynamicText = (source, language) => {
    if (language === 'ja') return source;

    let match = source.match(/^カスタムレポート（(.+?)）の出力が完了しました$/);
    if (match) {
      const format = match[1];
      return {
        en: `Custom report (${format}) export completed`,
        vi: `Đã xuất xong báo cáo tùy chỉnh (${format})`,
        zh: `自定义报告（${format}）导出完成`,
        ko: `맞춤 보고서(${format}) 내보내기가 완료되었습니다`,
        es: `Informe personalizado (${format}) exportado correctamente`,
        fr: `Rapport personnalisé (${format}) exporté avec succès`,
      }[language] || source;
    }

    match = source.match(/^「(.+)」のダウンロードを開始しました$/);
    if (match) {
      const title = maps[language].get(match[1]) || match[1];
      return {
        en: `Started downloading “${title}”`,
        vi: `Đã bắt đầu tải xuống “${title}”`,
        zh: `已开始下载“${title}”`,
        ko: `“${title}” 다운로드를 시작했습니다`,
        es: `Se inició la descarga de «${title}»`,
        fr: `Téléchargement de « ${title} » démarré`,
      }[language] || source;
    }

    match = source.match(/^(.+?) を再ダウンロードしました$/);
    if (match) {
      const name = match[1];
      return {
        en: `${name} downloaded again`,
        vi: `Đã tải lại ${name}`,
        zh: `已重新下载 ${name}`,
        ko: `${name} 재다운로드 완료`,
        es: `${name} descargado de nuevo`,
        fr: `${name} téléchargé à nouveau`,
      }[language] || source;
    }

    match = source.match(/^(\d+) \/ (\d+) 完了$/);
    if (match) {
      const done = match[1];
      const total = match[2];
      return {
        en: `${done} / ${total} complete`,
        vi: `Hoàn tất ${done} / ${total}`,
        zh: `已完成 ${done} / ${total}`,
        ko: `${done} / ${total} 완료`,
        es: `${done} / ${total} completadas`,
        fr: `${done} / ${total} terminées`,
      }[language] || source;
    }

    match = source.match(/^(\d+)件表示中$/);
    if (match) {
      const count = match[1];
      return {
        en: `${count} items shown`,
        vi: `Đang hiển thị ${count} mục`,
        zh: `显示${count}条`,
        ko: `${count}건 표시 중`,
        es: `${count} elementos mostrados`,
        fr: `${count} éléments affichés`,
      }[language] || source;
    }

    match = source.match(/^全データ(\d+)件中 (\d+)件を表示$/);
    if (match) {
      const total = match[1];
      const count = match[2];
      return {
        en: `Showing ${count} of ${total} records`,
        vi: `Hiển thị ${count}/${total} bản ghi`,
        zh: `显示${total}条中的${count}条`,
        ko: `전체 ${total}건 중 ${count}건 표시`,
        es: `Mostrando ${count} de ${total} registros`,
        fr: `Affichage de ${count} éléments sur ${total}`,
      }[language] || source;
    }

    match = source.match(/^出力履歴: (\d+)件$/);
    if (match) {
      const count = match[1];
      return {
        en: `Export history: ${count} items`,
        vi: `Lịch sử xuất: ${count} mục`,
        zh: `导出历史：${count}条`,
        ko: `출력 이력: ${count}건`,
        es: `Historial de exportación: ${count} elementos`,
        fr: `Historique des exports : ${count} éléments`,
      }[language] || source;
    }

    return null;
  };

  const isDynamicTranslatable = source =>
    /^カスタムレポート（.+?）の出力が完了しました$/.test(source) ||
    /^「.+」のダウンロードを開始しました$/.test(source) ||
    /^.+? を再ダウンロードしました$/.test(source) ||
    /^\d+ \/ \d+ 完了$/.test(source) ||
    /^\d+件表示中$/.test(source) ||
    /^全データ\d+件中 \d+件を表示$/.test(source) ||
    /^出力履歴: \d+件$/.test(source);

  const translateTextNode = node => {
    if (!node.nodeValue || node.parentElement?.closest('script,style,[data-i18n-ignore]')) return;
    let source = originals.get(node);
    const trimmed = normalize(node.nodeValue);
    if (maps.ja.has(trimmed) || isDynamicTranslatable(trimmed)) {
      source = trimmed;
      originals.set(node, source);
    }
    if (!source) return;
    const replacement = maps[currentLanguage].get(source) || translateDynamicText(source, currentLanguage) || source;
    const leading = node.nodeValue.match(/^\s*/)?.[0] || '';
    const trailing = node.nodeValue.match(/\s*$/)?.[0] || '';
    node.nodeValue = `${leading}${replacement}${trailing}`;
  };

  const translateAttributes = root => {
    const elements = root.nodeType === 1 ? [root, ...root.querySelectorAll('[aria-label],[placeholder],[title],[alt]')] : [];
    elements.forEach(element => ['aria-label','placeholder','title','alt'].forEach(attr => {
      if (!element.hasAttribute(attr)) return;
      const key = `i18nOriginal${attr.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())}`;
      const current = element.getAttribute(attr);
      if (!element.dataset[key] && maps.ja.has(normalize(current))) element.dataset[key] = normalize(current);
      const source = element.dataset[key];
      if (source) element.setAttribute(attr, maps[currentLanguage].get(source) || source);
    }));
  };

  const translateChat = () => {
    const root = document.getElementById('vn-ai-chat-root');
    if (!root) return;
    const copy = chat[currentLanguage];
    const set = (selector, value) => { const element = root.querySelector(selector); if (element) element.textContent = value; };
    const attr = (selector, name, value) => { const element = root.querySelector(selector); if (element) element.setAttribute(name, value); };
    attr('.vn-ai-chat-launcher','aria-label',copy.open);
    attr('.vn-ai-chat-close','aria-label',copy.close);
    attr('.vn-ai-chat-messages','aria-label',copy.log);
    attr('.vn-ai-chat-suggestions','aria-label',copy.group);
    attr('.vn-ai-chat-input','placeholder',copy.placeholder);
    attr('.vn-ai-chat-send','aria-label',copy.send);
    set('.vn-ai-chat-launcher-label', root.querySelector('.vn-ai-chat-launcher')?.classList.contains('vn-ai-chat-launcher-compact') ? copy.compact : copy.ask);
    set('.vn-ai-chat-message-assistant:first-child .vn-ai-chat-message-text', copy.hello);
    set('.vn-ai-chat-sr-only[for="vn-ai-chat-input"]', copy.input);
    set('.vn-ai-chat-send', copy.send);
    root.querySelectorAll('.vn-ai-chat-suggestion').forEach((button,index)=>{ if(copy.suggestions[index]) button.textContent=copy.suggestions[index]; });
    root.querySelectorAll('.vn-ai-chat-typing .vn-ai-chat-sr-only').forEach(element => { element.textContent = copy.sending; });
  };

  const LANGUAGE_MENU_TRANSITION_MS = 200;

  const closeLanguageMenu = (menu, focusTrigger = false) => {
    const trigger = menu.previousElementSibling;
    trigger?.setAttribute('aria-expanded', 'false');

    if (!menu.hidden) {
      menu.classList.remove('is-open');
      window.setTimeout(() => {
        if (!menu.classList.contains('is-open')) menu.hidden = true;
      }, LANGUAGE_MENU_TRANSITION_MS);
    }

    if (focusTrigger) trigger?.focus();
  };

  const openLanguageMenu = (menu, trigger) => {
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');

    void menu.offsetHeight;
    menu.classList.add('is-open');
  };

  const languageMenu = mode => {
    const wrap = document.createElement('div');
    wrap.className = `vn-i18n-switcher vn-i18n-${mode}`;
    wrap.dataset.i18nIgnore = 'true';
    wrap.innerHTML = `<button class="vn-i18n-trigger" type="button" aria-label="${maps[currentLanguage].get('言語を選択') || 'Select language'}" aria-haspopup="listbox" aria-expanded="false"><span aria-hidden="true">🌐</span><span class="vn-i18n-current"></span><span class="vn-i18n-chevron" aria-hidden="true">▾</span></button><div class="vn-i18n-menu" role="listbox" hidden></div>`;
    const trigger = wrap.querySelector('.vn-i18n-trigger');
    const menu = wrap.querySelector('.vn-i18n-menu');
    const render = () => {
      wrap.querySelector('.vn-i18n-current').textContent = LABELS[currentLanguage];
      trigger.setAttribute('aria-label', maps[currentLanguage].get('言語を選択') || 'Select language');
      menu.innerHTML = SUPPORTED.map(code => `<button type="button" role="option" data-language="${code}" aria-selected="${code === currentLanguage}"><span class="vn-i18n-option-label"><span class="vn-i18n-code" aria-hidden="true">${DISPLAY_CODES[code]}</span><span>${LABELS[code]}</span></span>${code === currentLanguage ? '<span aria-hidden="true">✓</span>' : ''}</button>`).join('');
      menu.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.language, true)));
    };
    trigger.addEventListener('click', event => {
      event.stopPropagation();
      const open = menu.closest('.vn-i18n-desktop') ? menu.hidden || !menu.classList.contains('is-open') : menu.hidden;
      document.querySelectorAll('.vn-i18n-menu').forEach(other => {
        if (other !== menu) closeLanguageMenu(other);
      });
      if (open) {
        openLanguageMenu(menu, trigger);
        menu.querySelector('[aria-selected="true"]')?.focus();
      } else {
        closeLanguageMenu(menu);
      }
    });
    trigger.addEventListener('keydown', event => {
      if (['ArrowDown','Enter',' '].includes(event.key) && menu.hidden) { event.preventDefault(); trigger.click(); }
    });
    menu.addEventListener('keydown', event => {
      const options = [...menu.querySelectorAll('[role="option"]')];
      const index = options.indexOf(document.activeElement);
      if (event.key === 'ArrowDown') { event.preventDefault(); options[(index + 1) % options.length].focus(); }
      if (event.key === 'ArrowUp') { event.preventDefault(); options[(index - 1 + options.length) % options.length].focus(); }
      if (event.key === 'Escape') { closeLanguageMenu(menu, true); }
    });
    wrap.refresh = render;
    render();
    return wrap;
  };

  const ensureSwitchers = () => {
    const header = document.querySelector('header');
    if (!header) return;
    if (!header.querySelector('.vn-i18n-desktop')) {
      const desktopCta = [...header.querySelectorAll('button')].find(button => button.classList.contains('lg:block'));
      if (desktopCta) desktopCta.before(languageMenu('desktop'));
    }
    const hamburger = header.querySelector('button[aria-label]');
    const mobilePanels = [...header.querySelectorAll('div')].filter(element => element !== hamburger?.parentElement && element.querySelector('a[href="#why-choose-us"]') && !element.classList.contains('hidden'));
    const mobilePanel = mobilePanels.sort((a,b)=>a.childElementCount-b.childElementCount)[0];
    if (mobilePanel && !mobilePanel.querySelector('.vn-i18n-mobile')) {
      const mobileCta = [...mobilePanel.children].find(element => element.tagName === 'BUTTON');
      const switcher = languageMenu('mobile');
      if (mobileCta) mobileCta.after(switcher);
      else mobilePanel.append(switcher);
    }
  };

  const updateMetadata = () => {
    const [title, description] = seo[currentLanguage];
    document.documentElement.lang = currentLanguage;
    document.documentElement.dataset.language = currentLanguage;
    document.body.style.fontFamily = FONT_STACKS[currentLanguage];
    document.title = title;
    const setMeta = (selector, value) => { const element = document.querySelector(selector); if (element) element.setAttribute('content', value); };
    setMeta('meta[name="description"]', description);
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
  };

  const applyTo = root => {
    if (root.nodeType === 3) return translateTextNode(root);
    if (root.nodeType !== 1 || root.closest?.('[data-i18n-ignore]')) return;
    translateAttributes(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) translateTextNode(node);
  };

  function applyLanguage() {
    if (applying) return;
    applying = true;
    observer?.disconnect();
    updateMetadata();
    ensureSwitchers();
    applyTo(document.body);
    translateChat();
    document.querySelectorAll('.vn-i18n-switcher').forEach(element => element.refresh?.());
    observer?.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-label','placeholder','title','alt'] });
    applying = false;
  }

  function setLanguage(language, persist = false) {
    if (!SUPPORTED.includes(language)) language = 'ja';
    currentLanguage = language;
    if (persist) localStorage.setItem(STORAGE_KEY, language);
    applyLanguage();
    document.dispatchEvent(new CustomEvent('vnInsightLanguageChange', { detail: { language } }));
  }

  document.addEventListener('click', event => {
    if (!event.target.closest('.vn-i18n-switcher')) document.querySelectorAll('.vn-i18n-menu').forEach(menu => closeLanguageMenu(menu));
  });
  observer = new MutationObserver(mutations => {
    if (applying) return;
    applying = true;
    observer.disconnect();
    mutations.forEach(mutation => {
      if (mutation.type === 'characterData') translateTextNode(mutation.target);
      mutation.addedNodes?.forEach(applyTo);
      if (mutation.type === 'attributes') translateAttributes(mutation.target);
    });
    ensureSwitchers();
    translateChat();
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-label','placeholder','title','alt'] });
    applying = false;
  });

  const start = () => {
    currentLanguage = chooseInitialLanguage();
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@500;700;900&family=Noto+Sans+SC:wght@500;700;900&display=swap';
    document.head.append(fontLink);
    applyLanguage();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
