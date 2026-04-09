// script.js

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const welcomeScreen = document.getElementById('welcomeScreen');
const menuToggle = document.querySelector('.menu-toggle');
const sidebar = document.querySelector('.sidebar');

let isWaitingForBot = false;
let currentMsgCount = 0;
let isViewingHistory = false;
let selectedHarness = null; // 선택된 하네스 객체 {id, title, content}

const GOOGLE_CLIENT_ID = '877998748218-emlbeacavipfdl1od8k61b4034on29n3.apps.googleusercontent.com';

// 구글 OAuth 2.0 로그인 (Implicit Flow)
function oauthSignIn() {
  const oauth2Endpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
  const form = document.createElement('form');
  form.setAttribute('method', 'GET');
  form.setAttribute('action', oauth2Endpoint);

  const params = {
    'client_id': GOOGLE_CLIENT_ID,
    'redirect_uri': window.location.origin, // 예: https://agent-on.vercel.app
    'response_type': 'token',
    'scope': 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
    'include_granted_scopes': 'true',
    'state': 'login'
  };

  for (const p in params) {
    const input = document.createElement('input');
    input.setAttribute('type', 'hidden');
    input.setAttribute('name', p);
    input.setAttribute('value', params[p]);
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

// 구글 토큰 추출 및 사용자 정보 로드
let savedToken = localStorage.getItem('agentOn_token');
let savedUserStr = localStorage.getItem('agentOn_user');
let savedUser = savedUserStr ? JSON.parse(savedUserStr) : null;

async function checkGoogleLogin() {
  const fragmentString = location.hash.substring(1);
  const params = {};
  const regex = /([^&=]+)=([^&]*)/g;
  let m;
  while ((m = regex.exec(fragmentString))) {
    params[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
  }
  
  if (Object.keys(params).length > 0 && params['access_token']) {
    savedToken = params['access_token'];
    localStorage.setItem('agentOn_token', savedToken);
    window.history.replaceState({}, document.title, window.location.pathname);
  }
  
  if (savedToken) {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${savedToken}` }
      });
      const userInfo = await res.json();
      if (userInfo.error) {
        localStorage.removeItem('agentOn_token');
        localStorage.removeItem('agentOn_user');
        showLandingPage();
        return;
      }
      localStorage.setItem('agentOn_user', JSON.stringify(userInfo));
      applyUserInfo(userInfo);
    } catch (err) {
      console.error('Failed to fetch user info', err);
      if (savedUser) applyUserInfo(savedUser);
      else showLandingPage();
    }
  } else {
    showLandingPage();
  }
}

function updateLandingView(type) {
  const title = document.getElementById('landingTitle');
  const desc = document.getElementById('landingDesc');
  const icon = document.getElementById('landingIcon');
  if(!title || !desc || !icon) return;
  
  if (type === 'chat') {
     title.textContent = '생각을 현실로 만드는 AI, Agent ONAi';
     desc.innerHTML = '단순한 질의응답을 뛰어넘어, 명령만 내리면 백엔드에서 당신의 로컬 환경과 연동되어 <strong>실질적인 업무 시퀀스</strong>를 모조리 수행하는 업계 최고 수준의 전속 비서입니다.';
     icon.innerHTML = '<iconify-icon icon="mdi:message-outline" style="font-size: 4rem;"></iconify-icon>';
  } else if (type === 'history') {
     title.textContent = '지난 채팅 (업무 일지 아카이브)';
     desc.innerHTML = '매일 오전 5시, 당신이 Agent ONAi와 함께 수행했던 모든 대화와 시스템 자동화 로그가 <strong>하루 단위로 깔끔하게 문서화 및 아카이빙</strong> 됩니다.';
     icon.innerHTML = '<iconify-icon icon="mdi:history" style="font-size: 4rem;"></iconify-icon>';
  } else if (type === 'board') {
     title.textContent = '나만의 강력한 지식 스크랩, Board';
     desc.innerHTML = '핵심적인 답변이나 나중에 다시 활용하고 싶은 복잡한 코드, 결과물을 찾으셨나요? <strong>채팅 내 핀(Pin) 아이콘</strong>을 클릭하여 이 보드에 영구 지식으로 보관하세요.';
     icon.innerHTML = '<iconify-icon icon="mdi:text-box-check-outline" style="font-size: 4rem;"></iconify-icon>';
  }
}

function showLandingPage() {
  const sn = document.getElementById('sidebarNav');
  if(sn) sn.style.display = 'flex';
  const lv = document.getElementById('landingView');
  if(lv) lv.style.display = 'flex';
  const cv = document.getElementById('chatView');
  if(cv) cv.style.display = 'none';
  const hv = document.getElementById('historyView');
  if(hv) hv.style.display = 'none';
  const bv = document.getElementById('boardView');
  if(bv) bv.style.display = 'none';
  
  const loginBtn = document.getElementById('googleLoginBtn');
  if(loginBtn) loginBtn.style.display = 'flex';
  const profileDiv = document.getElementById('userProfile');
  if(profileDiv) profileDiv.style.display = 'none';
  isViewingHistory = true; // stop sync
  
  // default
  updateLandingView('chat');
  const nchat = document.getElementById('navChat');
  if(nchat) nchat.classList.add('active');
  const nhis = document.getElementById('navHistory');
  if(nhis) nhis.classList.remove('active');
  const nbrd = document.getElementById('navBoard');
  if(nbrd) nbrd.classList.remove('active');
}

function applyUserInfo(userInfo) {
  const sn = document.getElementById('sidebarNav');
  if(sn) sn.style.display = 'flex';
  const lv = document.getElementById('landingView');
  if(lv) lv.style.display = 'none';
  const cv = document.getElementById('chatView');
  if(cv) cv.style.display = 'flex';
  
  const googleBtn = document.getElementById('googleLoginBtn');
  if (googleBtn) googleBtn.style.display = 'none';
  
  const userProfile = document.getElementById('userProfile');
  if (userProfile) userProfile.style.display = 'flex';
  
  if (userProfile) {
    const avatarDiv = userProfile.querySelector('.avatar');
    if (userInfo.picture) {
      avatarDiv.style.background = 'transparent';
      avatarDiv.innerHTML = `<img src="${userInfo.picture}" alt="profile" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    } else {
      avatarDiv.textContent = userInfo.given_name ? userInfo.given_name[0] : '이';
    }
    userProfile.querySelector('.user-name').textContent = userInfo.name || '이경진';
    
    if (userInfo.email) {
      const menuEmail = document.getElementById('menuEmail');
      if (menuEmail) menuEmail.textContent = userInfo.email;
    }
    
    const greetingTitle = document.getElementById('welcomeTitle');
    if (greetingTitle && greetingTitle.textContent.includes('교장님')) {
      greetingTitle.textContent = greetingTitle.textContent.replace('교장님', userInfo.name + ' 교장님');
    }
  }
  
  isViewingHistory = false;
  syncChats();
  initUserBackend(userInfo);
}

// 대화 내역 실시간 동기화 (폴링 기법)
async function syncChats() {
  if (isViewingHistory) return; // 히스토리 화면이거나 과거 대화를 볼 때는 중단
  
  try {
    const res = await fetch('/api/chat');
    const data = await res.json();
    if (data.success && data.messages.length !== currentMsgCount) {
      currentMsgCount = data.messages.length;
      
      // 기존 메시지들 비우기
      messagesEl.innerHTML = '';
      if (currentMsgCount > 0 && welcomeScreen.style.display !== 'none') {
        welcomeScreen.style.display = 'none';
        messagesEl.style.display = 'block';
      }

      // DB의 최신 메시지 전체 렌더링
      data.messages.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${msg.role}`;
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = msg.content;
        msgDiv.appendChild(contentDiv);
        
        // 봇 메시지 하단에 복사 버튼 추가
        if (msg.role === 'bot') {
          const actionRow = document.createElement('div');
          actionRow.className = 'message-actions';
          
          const copyBtn = document.createElement('button');
          copyBtn.className = 'action-btn copy-btn';
          copyBtn.innerHTML = '<iconify-icon icon="lucide:copy"></iconify-icon>';
          copyBtn.onclick = () => {
             navigator.clipboard.writeText(msg.content);
             copyBtn.innerHTML = '<iconify-icon icon="lucide:check"></iconify-icon>';
             setTimeout(() => {
               copyBtn.innerHTML = '<iconify-icon icon="lucide:copy"></iconify-icon>';
             }, 2000);
          };
          
          const boardBtn = document.createElement('button');
          boardBtn.className = 'action-btn board-btn';
          boardBtn.innerHTML = msg.is_pinned ? '<iconify-icon icon="lucide:pin" style="color:var(--text-high);"></iconify-icon>' : '<iconify-icon icon="lucide:pin"></iconify-icon>';
          boardBtn.onclick = async () => {
             const og = boardBtn.innerHTML;
             boardBtn.innerHTML = '<iconify-icon icon="lucide:loader-2"></iconify-icon>';
             try {
               const r = await fetch('/api/board/' + msg.id, { method: 'PUT' });
               const d = await r.json();
               if(d.success) {
                 msg.is_pinned = d.is_pinned;
                 boardBtn.innerHTML = msg.is_pinned ? '<iconify-icon icon="lucide:pin" style="color:var(--text-high);"></iconify-icon>' : '<iconify-icon icon="lucide:pin"></iconify-icon>';
               } else boardBtn.innerHTML = og;
             } catch(e) { boardBtn.innerHTML = og; }
          };
          
          actionRow.appendChild(copyBtn);
          actionRow.appendChild(boardBtn);
          msgDiv.appendChild(actionRow);
          isWaitingForBot = false;
        }

        messagesEl.appendChild(msgDiv);
      });

      // 만약 아직 안티그래비티 등으로부터 답변을 대기 중이라면 로딩 인디케이터 유지
      if (isWaitingForBot) {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = `message bot`;
        loadingDiv.id = 'loadingIndicator';
        const lContent = document.createElement('div');
        lContent.className = 'message-content';
        lContent.textContent = 'Agent ONAi 작동 중...';
        loadingDiv.appendChild(lContent);
        messagesEl.appendChild(loadingDiv);
      }
      
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  } catch (err) {
    console.error('동기화 실패:', err);
  }
}

// 2초 간격으로 새 메시지 모니터링 (다른 맥미니에서 인바운드 웹훅으로 쏘는 데이터 포착용)
setInterval(syncChats, 2000);

// 메시지 전송 핸들러
async function handleSend() {
  const text = inputEl.value.trim();
  if (!text) return;
  
  inputEl.value = '';
  isWaitingForBot = true;

  // 하네스가 선택되어 있으면 합성
  let finalMessage = text;
  if (selectedHarness) {
    finalMessage = `[하네스: ${selectedHarness.title}]\n${selectedHarness.content}\n\n---\n사용자 메시지: ${text}`;
    selectedHarness = null;
    const indicator = document.getElementById('harnessIndicator');
    if(indicator) indicator.remove();
  }

  // 사용자의 입력은 낙관적 렌더링(Optimistic update)
  const userDiv = document.createElement('div');
  userDiv.className = `message user`;
  const uContent = document.createElement('div');
  uContent.className = 'message-content';
  uContent.textContent = text;
  userDiv.appendChild(uContent);
  messagesEl.appendChild(userDiv);

  // 로딩 인디케이터 즉시 표시
  const loadingDiv = document.createElement('div');
  loadingDiv.className = `message bot`;
  loadingDiv.id = 'loadingIndicator';
  const lContent = document.createElement('div');
  lContent.className = 'message-content';
  lContent.textContent = 'Agent ONAi 작동 중...';
  loadingDiv.appendChild(lContent);
  messagesEl.appendChild(loadingDiv);
  
  if (welcomeScreen.style.display !== 'none') {
    welcomeScreen.style.display = 'none';
    messagesEl.style.display = 'block';
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
  
  // 다음 syncChats가 강제로 화면을 덮어쓰기 하도록 카운트 조작
  currentMsgCount = -1;

  try {
    await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: finalMessage })
    });
    // POST 직후 즉각 1회 동기화 (Gemini 폴백이 작동했을 수 있으므로)
    syncChats();
  } catch (err) {
    console.error(err);
  }
}

sendBtn.addEventListener('click', handleSend);
inputEl.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    handleSend();
  }
});

if (menuToggle && sidebar) {
  menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });
}

// 시간에 따른 동적 인사말 변경
function updateGreeting() {
  const greetingTitle = document.getElementById('welcomeTitle');
  if (!greetingTitle) return;
  
  const hour = new Date().getHours();
  let greeting = '안녕하세요';
  let icon = '☀️';

  if (hour >= 5 && hour < 12) {
    greeting = '좋은 아침입니다';
    icon = '🌅';
  } else if (hour >= 12 && hour < 18) {
    greeting = '활기찬 오후입니다';
    icon = '☀️';
  } else if (hour >= 18 && hour < 22) {
    greeting = '편안한 저녁입니다';
    icon = '🌇';
  } else {
    greeting = '좋은 밤입니다';
    icon = '🌙';
  }

  greetingTitle.textContent = `${icon} ${greeting}, 교장님`;
}

// History 및 Board 네비게이션 제어
const navChat = document.getElementById('navChat');
const navHistory = document.getElementById('navHistory');
const navBoard = document.getElementById('navBoard');
const chatView = document.getElementById('chatView');
const historyView = document.getElementById('historyView');
const boardView = document.getElementById('boardView');
const historyList = document.getElementById('historyList');
const boardList = document.getElementById('boardList');

function timeSince(dateString) {
  // SQLite CURRENT_TIMESTAMP is UTC
  const date = new Date(dateString.replace(' ', 'T') + 'Z');
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + "년 전";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + "개월 전";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + "일 전";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + "시간 전";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + "분 전";
  return Math.floor(seconds) + "초 전";
}

async function loadHistoryList() {
  if (!historyList) return;
  try {
    historyList.innerHTML = '<div style="padding:16px;color:var(--text-muted);">과거 대화 불러오는 중...</div>';
    const res = await fetch('/api/history');
    const data = await res.json();
    historyList.innerHTML = '';
    
    if (data.history.length === 0) {
      historyList.innerHTML = '<div style="padding:16px;color:var(--text-muted);">(아직 이전 날짜의 채팅 기록이 없습니다. 오늘 대화는 내일 오전 5시 이후에 자동 이관됩니다.)</div>';
      return;
    }
    
    data.history.forEach(item => {
      const div = document.createElement('div');
      div.className = 'history-item';
      
      const title = item.preview_content || '새로운 대화';
      const metaText = `마지막 메시지: ${timeSince(item.last_created)} · 총 ${item.msg_count}개`;
      
      div.innerHTML = `
        <div class="history-title">${title}</div>
        <div class="history-meta">${metaText}</div>
      `;
      div.onclick = async () => {
        // 클릭 시 해당 과거 대화 로드
        navChat.classList.add('active');
        navHistory.classList.remove('active');
        chatView.style.display = 'flex';
        historyView.style.display = 'none';
        isViewingHistory = true; // 과거 모드 (폴링 중단)
        
        messagesEl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);">과거 세션 불러오는 중...</div>';
        welcomeScreen.style.display = 'none';
        messagesEl.style.display = 'block';
        
        try {
          const hRes = await fetch('/api/history/' + item.session_date);
          const hData = await hRes.json();
          messagesEl.innerHTML = `<div style="text-align:center; padding:16px 0 24px; font-size:0.85rem; color:var(--text-muted);">---- [ ${item.session_date} ] 과거 대화 내역입니다 ----</div>`;
          
          hData.messages.forEach(msg => {
            const msgDiv = document.createElement('div');
            msgDiv.className = `message ${msg.role}`;
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            contentDiv.textContent = msg.content;
            msgDiv.appendChild(contentDiv);
            messagesEl.appendChild(msgDiv);
          });
          messagesEl.scrollTop = messagesEl.scrollHeight;
        } catch(e) { console.error(e); }
      };
      historyList.appendChild(div);
    });
  } catch (err) { console.error(err); }
}

if (navChat && navHistory && navBoard) {
  navChat.addEventListener('click', () => {
    navChat.classList.add('active');
    navHistory.classList.remove('active');
    navBoard.classList.remove('active');
    
    if (localStorage.getItem('agentOn_token')) {
       isViewingHistory = false;
       chatView.style.display = 'flex';
       historyView.style.display = 'none';
       boardView.style.display = 'none';
       const hgv = document.getElementById('harnessGalleryView');
       if(hgv) hgv.style.display = 'none';
       const lv = document.getElementById('landingView');
       if(lv) lv.style.display = 'none';
       currentMsgCount = -1; // 강제 새로고침
       syncChats();
    } else {
       isViewingHistory = true;
       chatView.style.display = 'none';
       historyView.style.display = 'none';
       boardView.style.display = 'none';
       const hgv2 = document.getElementById('harnessGalleryView');
       if(hgv2) hgv2.style.display = 'none';
       const lv = document.getElementById('landingView');
       if(lv) lv.style.display = 'flex';
       updateLandingView('chat');
    }
  });
  
  navHistory.addEventListener('click', () => {
    isViewingHistory = true;
    navHistory.classList.add('active');
    navChat.classList.remove('active');
    navBoard.classList.remove('active');
    
    if (localStorage.getItem('agentOn_token')) {
       historyView.style.display = 'flex';
       chatView.style.display = 'none';
       boardView.style.display = 'none';
       const hgv3 = document.getElementById('harnessGalleryView');
       if(hgv3) hgv3.style.display = 'none';
       const lv = document.getElementById('landingView');
       if(lv) lv.style.display = 'none';
       loadHistoryList();
    } else {
       chatView.style.display = 'none';
       historyView.style.display = 'none';
       boardView.style.display = 'none';
       const hgv4 = document.getElementById('harnessGalleryView');
       if(hgv4) hgv4.style.display = 'none';
       const lv = document.getElementById('landingView');
       if(lv) lv.style.display = 'flex';
       updateLandingView('history');
    }
  });

  navBoard.addEventListener('click', async () => {
    isViewingHistory = true;
    navBoard.classList.add('active');
    navChat.classList.remove('active');
    navHistory.classList.remove('active');
    
    if (localStorage.getItem('agentOn_token')) {
       boardView.style.display = 'flex';
       chatView.style.display = 'none';
       historyView.style.display = 'none';
       const hgv5 = document.getElementById('harnessGalleryView');
       if(hgv5) hgv5.style.display = 'none';
       const lv = document.getElementById('landingView');
       if(lv) lv.style.display = 'none';
       
       if (!boardList) return;
       boardList.innerHTML = '<div style="color:var(--text-muted); text-align:center;">저장된 보드 답변 불러오는 중...</div>';
       try {
         const res = await fetch('/api/board');
         const data = await res.json();
         boardList.innerHTML = '';
         if(data.messages.length === 0) {
           boardList.innerHTML = '<div style="color:var(--text-muted); text-align:center;">아직 저장된 보드 항목이 없습니다. (답변 하단의 핀 아이콘 클릭)</div>';
           return;
         }
         
         const now = new Date();
         const recentClips = [];
         const pastClips = [];

         data.messages.forEach(msg => {
           let dateObj = new Date();
           if (msg.created_at) {
             dateObj = new Date(msg.created_at.replace(' ', 'T') + 'Z');
           }
           const diffDays = Math.ceil(Math.abs(now - dateObj) / (1000 * 60 * 60 * 24));
           if (diffDays > 7) pastClips.push(msg);
           else recentClips.push(msg);
         });

         const createBoardDOM = (msg) => {
           const div = document.createElement('div');
           div.style.cssText = "background: var(--bg-input); border-radius:12px; padding: 20px; border:1px solid var(--border-color); position: relative;";
           
           const delBtn = document.createElement('button');
           delBtn.className = 'icon-btn';
           delBtn.style.cssText = "position: absolute; top: 16px; right: 16px; color: var(--text-muted); font-size: 1.2rem; padding: 4px; box-shadow: none; border: none; background: transparent;";
           delBtn.innerHTML = '<iconify-icon icon="lucide:trash-2"></iconify-icon>';
           delBtn.onclick = async () => {
              if(confirm('이 답변을 보드에서 제거하시겠습니까?')) {
                await fetch('/api/board/' + msg.id, { method: 'PUT' });
                navBoard.click(); // 삭제 후 보드 자동 새로고침
              }
           };

           const meta = document.createElement('div');
           meta.style.cssText = "font-size:0.85rem; color:var(--text-muted); margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; padding-right: 32px;";
           meta.innerHTML = `<span><iconify-icon icon="lucide:pin" style="color:var(--text-high); vertical-align:middle;"></iconify-icon> ${msg.session_date || '오늘'}</span>`;
           
           const content = document.createElement('div');
           content.style.lineHeight = "1.6";
           content.textContent = msg.content;
           
           div.appendChild(delBtn);
           div.appendChild(meta);
           div.appendChild(content);
           return div;
         };

         if (recentClips.length > 0) {
           const h3 = document.createElement('h3');
           h3.style.cssText = "font-size: 1.05rem; color: var(--text-high); margin: 0 0 12px 0; font-weight: 500;";
           h3.textContent = "최신 클립";
           boardList.appendChild(h3);
           recentClips.forEach(msg => boardList.appendChild(createBoardDOM(msg)));
         }

         if (pastClips.length > 0) {
           const h3 = document.createElement('h3');
           h3.style.cssText = "font-size: 1.05rem; color: var(--text-muted); margin: 24px 0 12px 0; font-weight: 500;";
           h3.textContent = "지난 클립 (1주일 경과)";
           boardList.appendChild(h3);
           pastClips.forEach(msg => boardList.appendChild(createBoardDOM(msg)));
         }
       } catch(err) { console.error(err); }
    } else {
       chatView.style.display = 'none';
       historyView.style.display = 'none';
       boardView.style.display = 'none';
       const lv = document.getElementById('landingView');
       if(lv) lv.style.display = 'flex';
       updateLandingView('board');
    }
  });
}

// 로고 클릭시 홈(채팅)으로
const logos = document.querySelectorAll('.logo');
logos.forEach(logo => {
  logo.addEventListener('click', () => {
    if (localStorage.getItem('agentOn_token') && navChat) {
       navChat.click();
    }
  });
});

// 앱 실행 시 구동 로직
window.addEventListener('DOMContentLoaded', () => {
  checkGoogleLogin();
  updateGreeting();

  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

  const googleLoginBtn = document.getElementById('googleLoginBtn');
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', oauthSignIn);
  }
  
  // 모바일에서 채팅 영역 터치 시 사이드바 숨김 처리
  const mainContent = document.querySelector('.main-content');
  if (mainContent) {
    mainContent.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        // 모바일 상단 헤더(햄버거 메뉴 영역) 터치가 아닌 경우에만 닫기
        if (!e.target.closest('.mobile-header')) {
          if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
          }
        }
      }
    });
  }

  // 사용자 마이페이지/설정 팝업 제어
  const userProfile = document.getElementById('userProfile');
  const userMenuPopup = document.getElementById('userMenuPopup');
  if (userProfile && userMenuPopup) {
    userProfile.addEventListener('click', (e) => {
      e.stopPropagation();
      userMenuPopup.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!userMenuPopup.contains(e.target) && !userProfile.contains(e.target)) {
        userMenuPopup.classList.remove('show');
      }
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('agentOn_token');
        localStorage.removeItem('agentOn_user');
        window.history.replaceState({}, document.title, window.location.pathname);
        location.reload(); // 로그아웃을 위해 새로고침
      });
    }
  }

  // --- 관리자 모달 이벤트 연결 ---
  const adminMenu = document.getElementById('adminSettingMenu');
  if(adminMenu) {
    adminMenu.addEventListener('click', () => {
      document.getElementById('adminModal').style.display = 'flex';
      loadAdminData();
      document.getElementById('userMenuPopup').classList.remove('show');
    });
  }
});

// --- 회원 관리 및 그룹 채팅 로직 ---
async function initUserBackend(userInfo) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ email: userInfo.email, name: userInfo.name })
    });
    const data = await res.json();
    if(data.success) {
      window.currentUserRole = data.user.role;
      if(data.user.role === 'ADMIN') {
        const adminMenu = document.getElementById('adminSettingMenu');
        if(adminMenu) adminMenu.style.display = 'flex';
      }
      fetchMyRooms(userInfo.email);
    }
  } catch(e) { console.error('Backend init failed', e); }
}

async function fetchMyRooms(email) {
  try {
    const res = await fetch('/api/rooms', { headers: {'User-Email': email} });
    const data = await res.json();
    if(data.success && data.rooms) {
      const container = document.getElementById('groupRoomsList');
      if(container) {
        container.innerHTML = data.rooms.map(r => `
          <div class="nav-item group-room-btn" data-id="${r.id}" style="padding: 10px 16px;">
            <iconify-icon icon="lucide:hash"></iconify-icon> <span class="nav-label">${r.name}</span>
          </div>
        `).join('');
      }
    }
  } catch(e) { console.error('Rooms fetch failed', e); }
}

async function loadAdminData() {
  const userInfoStr = localStorage.getItem('agentOn_user');
  if(!userInfoStr) return;
  const email = JSON.parse(userInfoStr).email;
  
  // Load users
  try {
    const userRes = await fetch('/api/admin/users', { headers: {'User-Email': email} });
    const userData = await userRes.json();
    if(userData.success) {
      document.getElementById('adminUsersList').innerHTML = userData.users.map(u => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border:1px solid var(--border-color); border-radius:8px;">
          <div><b>${u.name}</b> (${u.email}) - <span style="color:${u.role==='APPROVED'?'#10b981':(u.role==='PENDING'?'#f59e0b':'#3b82f6')}">${u.role}</span></div>
          <button onclick="window.approveUser('${u.email}', 'APPROVED')" style="padding:4px 8px; border-radius:4px; border:1px solid var(--border-color); background:var(--bg-main); color:var(--text-main); cursor:pointer;">승인</button>
        </div>
      `).join('');
    }
  } catch(e) {}

  // Load Rooms/Members
  try {
    const roomRes = await fetch('/api/admin/rooms', { headers: {'User-Email': email} });
    const roomData = await roomRes.json();
    if(roomData.success) {
      const secretariat = roomData.rooms.find(r => r.name === '사무국');
      const targetRoomId = secretariat ? secretariat.id : 1;
      const usersInRoom = roomData.members.filter(m => m.room_id === targetRoomId).map(m => m.user_email);
      document.getElementById('adminRoomMembersList').innerHTML = `
        <div style="margin-bottom:8px; font-size:0.9rem; color:var(--text-muted);">현재 멤버: ${usersInRoom.join(', ')}</div>
        <div style="display:flex; gap:8px;">
           <input type="text" id="inviteEmail" placeholder="초대할 이메일 입력" style="flex:1; padding:8px; border-radius:8px; border:1px solid var(--border-color); background:transparent; color:var(--text-main);" />
           <button onclick="window.inviteUser(${targetRoomId})" style="padding:8px 16px; border-radius:8px; background:var(--user-msg); border:none; cursor:pointer;">초대</button>
        </div>
      `;
    }
  } catch(e) {}
}

window.approveUser = async function(targetEmail, role) {
  const userInfoStr = localStorage.getItem('agentOn_user');
  if(!userInfoStr) return;
  const email = JSON.parse(userInfoStr).email;
  await fetch('/api/admin/users/approve', {
    method: 'POST',
    headers: {"Content-Type": "application/json", "User-Email": email},
    body: JSON.stringify({ targetEmail, role })
  });
  alert('승인 처리되었습니다.');
  loadAdminData();
}

window.inviteUser = async function(roomId) {
  const userInfoStr = localStorage.getItem('agentOn_user');
  if(!userInfoStr) return;
  const email = JSON.parse(userInfoStr).email;
  const targetEmail = document.getElementById('inviteEmail').value;
  if(!targetEmail) return;
  const res = await fetch('/api/admin/rooms/invite', {
    method: 'POST',
    headers: {"Content-Type": "application/json", "User-Email": email},
    body: JSON.stringify({ roomId, targetEmail })
  });
  const data = await res.json();
  if(data.success) {
    alert('초대되었습니다.');
    loadAdminData();
  } else {
    alert('초대 실패: ' + (data.error || '알 수 없는 에러'));
  }
}

// ========================================
// 하네스 로직
// ========================================

// 채팅창 하네스 팝업 토글
function initHarnessPopup() {
  const btn = document.getElementById('harnessBtn');
  const popup = document.getElementById('harnessPopup');
  if(!btn || !popup) return;

  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if(popup.style.display === 'block') {
      popup.style.display = 'none';
      return;
    }
    // 서버에서 노출용 하네스 목록 가져오기
    try {
      const res = await fetch('/api/harnesses');
      const data = await res.json();
      const listEl = document.getElementById('harnessListChat');
      if(data.success && data.harnesses.length > 0) {
        listEl.innerHTML = data.harnesses.map(h => `
          <div class="harness-item" data-id="${h.id}" style="padding:10px 16px; cursor:pointer; display:flex; align-items:center; gap:8px; transition:background 0.15s;" 
               onmouseover="this.style.background='var(--bg-input)'" onmouseout="this.style.background='transparent'">
            <iconify-icon icon="lucide:zap" style="color:#f59e0b; flex-shrink:0;"></iconify-icon>
            <div>
              <div style="font-weight:500; font-size:0.9rem;">${h.title}</div>
              <div style="font-size:0.75rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">${h.content}</div>
            </div>
          </div>
        `).join('');
        // 클릭 이벤트 바인딩
        listEl.querySelectorAll('.harness-item').forEach(item => {
          item.addEventListener('click', () => {
            const hId = parseInt(item.dataset.id);
            const harness = data.harnesses.find(h => h.id === hId);
            if(harness) selectHarness(harness);
            popup.style.display = 'none';
          });
        });
      } else {
        listEl.innerHTML = '<div style="padding:12px 16px; color:var(--text-muted); font-size:0.85rem;">등록된 하네스가 없습니다.<br>관리자 설정에서 추가하세요.</div>';
      }
    } catch(e) { console.error(e); }
    popup.style.display = 'block';
  });

  // 바깥 클릭 시 닫기
  document.addEventListener('click', (e) => {
    if(!popup.contains(e.target) && !btn.contains(e.target)) {
      popup.style.display = 'none';
    }
  });
}

function selectHarness(harness) {
  selectedHarness = harness;
  // 입력창 위에 선택된 하네스 인디케이터 표시
  let indicator = document.getElementById('harnessIndicator');
  if(!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'harnessIndicator';
    indicator.style.cssText = 'display:flex; align-items:center; gap:6px; padding:6px 12px; margin-bottom:4px; background:rgba(245,158,11,0.15); border-radius:8px; font-size:0.8rem; color:#f59e0b;';
    const inputContainer = document.querySelector('.input-container');
    if(inputContainer) inputContainer.insertBefore(indicator, inputContainer.firstChild);
  }
  indicator.innerHTML = `<iconify-icon icon="lucide:zap"></iconify-icon> <b>${harness.title}</b> 하네스 적용 중 <button onclick="clearHarness()" style="margin-left:auto; background:none; border:none; cursor:pointer; color:#f59e0b;"><iconify-icon icon="lucide:x"></iconify-icon></button>`;
  inputEl.focus();
}

window.clearHarness = function() {
  selectedHarness = null;
  const indicator = document.getElementById('harnessIndicator');
  if(indicator) indicator.remove();
}

// 관리자 하네스 CRUD
window.createHarness = async function() {
  const userInfoStr = localStorage.getItem('agentOn_user');
  if(!userInfoStr) return;
  const email = JSON.parse(userInfoStr).email;
  const title = document.getElementById('newHarnessTitle').value.trim();
  const content = document.getElementById('newHarnessContent').value.trim();
  if(!title || !content) return alert('제목과 내용을 모두 입력해주세요.');
  const res = await fetch('/api/admin/harnesses', {
    method: 'POST',
    headers: {"Content-Type": "application/json", "User-Email": email},
    body: JSON.stringify({ title, content })
  });
  const data = await res.json();
  if(data.success) {
    document.getElementById('newHarnessTitle').value = '';
    document.getElementById('newHarnessContent').value = '';
    document.getElementById('harnessCreateForm').style.display = 'none';
    loadHarnessGallery();
  }
}

// 하네스 갤러리 그리드 렌더링 (썸네일 카드)
async function loadHarnessGallery() {
  const userInfoStr = localStorage.getItem('agentOn_user');
  if(!userInfoStr) return;
  const email = JSON.parse(userInfoStr).email;
  const isAdmin = (window.currentUserRole === 'ADMIN');
  const endpoint = isAdmin ? '/api/admin/harnesses' : '/api/harnesses';
  const headers = isAdmin ? {'User-Email': email} : {};
  try {
    const res = await fetch(endpoint, { headers });
    const data = await res.json();
    const grid = document.getElementById('harnessGalleryGrid');
    if(!grid) return;
    if(data.success && data.harnesses && data.harnesses.length > 0) {
      const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
      grid.innerHTML = data.harnesses.map(function(h) {
        var color = colors[h.id % colors.length];
        var badge = isAdmin ? '<span style="position:absolute;top:8px;right:8px;font-size:0.7rem;padding:2px 6px;border-radius:4px;background:'+(h.is_visible?'rgba(16,185,129,0.2)':'rgba(239,68,68,0.2)')+';color:'+(h.is_visible?'#10b981':'#ef4444')+';">'+(h.is_visible?'노출':'숨김')+'</span>' : '';
        var btns = isAdmin ? '<div style="display:flex;gap:6px;margin-top:12px;border-top:1px solid var(--border-color);padding-top:10px;"><button onclick="event.stopPropagation();window.toggleHarnessVisibility('+h.id+')" style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--border-color);background:transparent;color:var(--text-muted);cursor:pointer;font-size:0.8rem;">'+(h.is_visible?'숨기기':'노출')+'</button><button onclick="event.stopPropagation();window.deleteHarness('+h.id+')" style="padding:6px 10px;border-radius:6px;border:1px solid rgba(239,68,68,0.3);background:transparent;color:#ef4444;cursor:pointer;font-size:0.8rem;">삭제</button></div>' : '';
        return '<div class="harness-card" data-id="'+h.id+'" data-visible="'+h.is_visible+'" style="position:relative;padding:20px;border:1px solid var(--border-color);border-radius:12px;background:var(--bg-sidebar);cursor:pointer;transition:all 0.2s;overflow:hidden;">'+badge+'<div style="width:48px;height:48px;border-radius:12px;background:'+color+'18;display:flex;align-items:center;justify-content:center;margin-bottom:14px;"><iconify-icon icon="lucide:zap" style="font-size:1.4rem;color:'+color+';"></iconify-icon></div><div style="font-weight:600;font-size:1rem;margin-bottom:6px;">'+h.title+'</div><div style="font-size:0.85rem;color:var(--text-muted);line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">'+h.content+'</div>'+btns+'</div>';
      }).join('');
      grid.querySelectorAll('.harness-card').forEach(function(card) {
        card.addEventListener('click', function() {
          var hId = parseInt(card.dataset.id);
          var vis = card.dataset.visible;
          var harness = data.harnesses.find(function(h){return h.id === hId;});
          if(harness && (vis === '1' || vis === 1)) {
            selectHarness(harness);
            document.getElementById('navChat').click();
          }
        });
      });
    } else {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted);"><iconify-icon icon="lucide:inbox" style="font-size:3rem;margin-bottom:12px;display:block;"></iconify-icon><div style="font-size:1.1rem;margin-bottom:8px;">등록된 하네스가 없습니다</div><div style="font-size:0.9rem;">'+(isAdmin?'"+ 새 하네스" 버튼을 눌러 첫 하네스를 만들어보세요.':'관리자가 하네스를 등록하면 여기에 표시됩니다.')+'</div></div>';
    }
  } catch(e) { console.error('Gallery load failed:', e); }
}

// 로고 버튼 → 하네스 갤러리 뷰 열기
function initHarnessGalleryBtn() {
  var btn = document.getElementById('harnessGalleryBtn');
  if(!btn) return;
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    var gv = document.getElementById('harnessGalleryView');
    var cv = document.getElementById('chatView');
    var hv = document.getElementById('historyView');
    var bv = document.getElementById('boardView');
    var lv = document.getElementById('landingView');
    if(cv) cv.style.display = 'none';
    if(hv) hv.style.display = 'none';
    if(bv) bv.style.display = 'none';
    if(lv) lv.style.display = 'none';
    var nc = document.getElementById('navChat');
    var nh = document.getElementById('navHistory');
    var nb = document.getElementById('navBoard');
    if(nc) nc.classList.remove('active');
    if(nh) nh.classList.remove('active');
    if(nb) nb.classList.remove('active');
    if(gv) gv.style.display = 'flex';
    var addBtn = document.getElementById('addHarnessBtn');
    if(addBtn && window.currentUserRole === 'ADMIN') {
      addBtn.style.display = 'block';
      addBtn.onclick = function() { document.getElementById('harnessCreateForm').style.display = 'block'; };
    }
    isViewingHistory = true;
    loadHarnessGallery();
  });
}

window.toggleHarnessVisibility = async function(id) {
  var userInfoStr = localStorage.getItem('agentOn_user');
  if(!userInfoStr) return;
  var email = JSON.parse(userInfoStr).email;
  var listRes = await fetch('/api/admin/harnesses', { headers: {'User-Email': email} });
  var listData = await listRes.json();
  var h = listData.harnesses.find(function(x){return x.id === id;});
  if(!h) return;
  await fetch('/api/admin/harnesses/' + id, {
    method: 'PUT',
    headers: {"Content-Type": "application/json", "User-Email": email},
    body: JSON.stringify({ title: h.title, content: h.content, is_visible: h.is_visible ? 0 : 1 })
  });
  loadHarnessGallery();
}

window.deleteHarness = async function(id) {
  if(!confirm('이 하네스를 삭제하시겠습니까?')) return;
  var userInfoStr = localStorage.getItem('agentOn_user');
  if(!userInfoStr) return;
  var email = JSON.parse(userInfoStr).email;
  await fetch('/api/admin/harnesses/' + id, {
    method: 'DELETE',
    headers: {'User-Email': email}
  });
  loadHarnessGallery();
}

// 초기화
initHarnessPopup();
initHarnessGalleryBtn();
