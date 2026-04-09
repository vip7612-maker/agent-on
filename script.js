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
let currentRoomId = null; // 현재 선택된 그룹챗 ID (null이면 1:1 AiON 채팅)
let isPopupMode = false; // 독립창 모드 여부
let popupRoomName = '';

// 초기 로드 시 파라미터 감지
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('room_id')) {
  currentRoomId = urlParams.get('room_id');
  isPopupMode = true;
  document.body.classList.add('popup-mode');
  if (urlParams.has('room_name')) {
    popupRoomName = urlParams.get('room_name');
    document.title = popupRoomName; // 창 제목 변경
  }
}

// 모든 메인 뷰를 숨기고 지정한 뷰만 표시
function showMainView(viewId) {
  var views = ['chatView', 'historyView', 'boardView', 'harnessGalleryView', 'automationGalleryView', 'adminSettingsView', 'accountSettingsView', 'landingView'];
  views.forEach(function(id) {
    var el = document.getElementById(id);
    if(el) el.style.display = 'none';
  });
  var target = document.getElementById(viewId);
  if(target) target.style.display = 'flex';
  // 네비 active 해제
  var nc = document.getElementById('navChat');
  var nh = document.getElementById('navHistory');
  var nb = document.getElementById('navBoard');
  if(nc) nc.classList.remove('active');
  if(nh) nh.classList.remove('active');
  if(nb) nb.classList.remove('active');
  isViewingHistory = true;
}

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
     title.textContent = '생각을 현실로 만드는 AI, AiON agent';
     desc.innerHTML = '단순한 질의응답을 뛰어넘어, 명령만 내리면 백엔드에서 당신의 로컬 환경과 연동되어 <strong>실질적인 업무 시퀀스</strong>를 모조리 수행하는 업계 최고 수준의 전속 비서입니다.';
     icon.innerHTML = '<iconify-icon icon="mdi:message-outline" style="font-size: 4rem;"></iconify-icon>';
  } else if (type === 'history') {
     title.textContent = '지난 채팅 (업무 일지 아카이브)';
     desc.innerHTML = '매일 오전 5시, 당신이 AiON agent와 함께 수행했던 모든 대화와 시스템 자동화 로그가 <strong>하루 단위로 깔끔하게 문서화 및 아카이빙</strong> 됩니다.';
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
  
  if (isPopupMode) {
    const mainSidebar = document.querySelector('.sidebar');
    if(mainSidebar) mainSidebar.style.display = 'none';
    const mobileHeader = document.querySelector('.mobile-header');
    if(mobileHeader) mobileHeader.style.display = 'none';
  }
  
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
    
    // 팝업 모드일 때는 환영 문구를 방 이름으로 대체
    if (isPopupMode && popupRoomName) {
      const subTitleEl = document.querySelector('.welcome-subtitle');
      if(subTitleEl) subTitleEl.innerText = popupRoomName + ' 채팅방에 오신 것을 환영합니다';
      const chatRoomTitle = document.getElementById('chatRoomTitle');
      if(chatRoomTitle) chatRoomTitle.innerText = popupRoomName;
    }

    // 환영 문구를 로그인 계정 이름에 맞춤 개인화
    const greetingTitle = document.getElementById('welcomeTitle');
    if (greetingTitle) {
      const hour = new Date().getHours();
      let emoji = '☀️', timeText = '좋은 하루입니다';
      if (hour >= 5 && hour < 12) { emoji = '☀️'; timeText = '좋은 아침입니다'; }
      else if (hour >= 12 && hour < 14) { emoji = '🌞'; timeText = '활기찬 오후입니다'; }
      else if (hour >= 14 && hour < 18) { emoji = '☕'; timeText = '좋은 오후입니다'; }
      else if (hour >= 18 && hour < 22) { emoji = '🌙'; timeText = '좋은 저녁입니다'; }
      else { emoji = '🌙'; timeText = '좋은 밤입니다'; }
      const displayName = userInfo.name || userInfo.given_name || '사용자';
      greetingTitle.textContent = `${emoji} ${timeText}, ${displayName}님`;
    }
  }
  
  isViewingHistory = false;
  syncChats();
  initUserBackend(userInfo);
}

// 현재 로그인된 사용자 이메일 가져오기
function getCurrentUserEmail() {
  const u = localStorage.getItem('agentOn_user');
  return u ? JSON.parse(u).email : '';
}

// 대화 내역 실시간 동기화 (폴링 기법)
async function syncChats() {
  if (isViewingHistory) return; // 히스토리 화면이거나 과거 대화를 볼 때는 중단
  
  try {
    const url = currentRoomId ? `/api/chat?room_id=${currentRoomId}` : '/api/chat';
    const res = await fetch(url, { headers: { 'User-Email': getCurrentUserEmail() } });
    const data = await res.json();
    if (data.success && data.messages.length !== currentMsgCount) {
      currentMsgCount = data.messages.length;
      
      // 기존 메시지들 비우기
      messagesEl.innerHTML = '';
      if (currentMsgCount > 0) {
        welcomeScreen.style.display = 'none';
        messagesEl.style.display = 'block';
      } else {
        welcomeScreen.style.display = 'flex';
        messagesEl.style.display = 'none';
      }
      
      // 방 헤더 UI 업데이트 (그룹챗이면 항상 표시)
      const chatRoomHeader = document.getElementById('chatRoomHeader');
      if (chatRoomHeader) {
        if (currentRoomId) {
          chatRoomHeader.style.display = 'flex';
        } else {
          chatRoomHeader.style.display = 'none';
        }
      }

      // DB의 최신 메시지 전체 렌더링
      data.messages.forEach(msg => {
        const msgDiv = document.createElement('div');
        
        // 그룹챗: 슬랙 스타일 (아바타 + 이름 + 시간 + 내용)
        if (currentRoomId) {
          const myEmail = getCurrentUserEmail();
          const isMe = msg.sender_email === myEmail;
          msgDiv.className = `message ${isMe ? 'user' : 'bot'}`;
          
          // 상대방 메시지: 아바타 + 이름 + 시간
          if (!isMe) {
            const headerRow = document.createElement('div');
            headerRow.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:6px;';
            
            // 프로필 아바타
            const avatar = document.createElement('div');
            avatar.style.cssText = 'width:28px; height:28px; border-radius:50%; flex-shrink:0; overflow:hidden; background:var(--bg-input); display:flex; align-items:center; justify-content:center; font-size:0.7rem; color:var(--text-high);';
            if (msg.sender_picture) {
              avatar.innerHTML = `<img src="${msg.sender_picture}" style="width:100%;height:100%;object-fit:cover;" alt="">`;
            } else {
              const sName = msg.sender_name || msg.sender_email || '?';
              avatar.textContent = sName.charAt(0).toUpperCase();
            }
            headerRow.appendChild(avatar);
            
            // 이름
            const nameSpan = document.createElement('span');
            nameSpan.style.cssText = 'font-size:0.8rem; font-weight:600; color:var(--text-high);';
            nameSpan.textContent = msg.sender_name || (msg.sender_email ? msg.sender_email.split('@')[0] : '알 수 없음');
            headerRow.appendChild(nameSpan);
            
            // 시간
            const timeSpan = document.createElement('span');
            timeSpan.style.cssText = 'font-size:0.7rem; color:var(--text-muted);';
            if (msg.created_at) {
              const d = new Date(msg.created_at + 'Z');
              const h = d.getHours();
              const m = String(d.getMinutes()).padStart(2, '0');
              const ampm = h < 12 ? '오전' : '오후';
              timeSpan.textContent = `${ampm} ${h % 12 || 12}:${m}`;
            }
            headerRow.appendChild(timeSpan);
            
            msgDiv.appendChild(headerRow);
          } else {
            // 내 메시지: 이름 + 시간 표시 (우측 정렬)
            const myHeaderRow = document.createElement('div');
            myHeaderRow.style.cssText = 'display:flex; align-items:center; justify-content:flex-end; gap:8px; margin-bottom:6px;';
            
            // 이름
            const myNameSpan = document.createElement('span');
            myNameSpan.style.cssText = 'font-size:0.8rem; font-weight:600; color:var(--text-high);';
            myNameSpan.textContent = msg.sender_name || (msg.sender_email ? msg.sender_email.split('@')[0] : '나');
            myHeaderRow.appendChild(myNameSpan);
            
            // 시간
            const myTimeSpan = document.createElement('span');
            myTimeSpan.style.cssText = 'font-size:0.7rem; color:var(--text-muted);';
            if (msg.created_at) {
              const d = new Date(msg.created_at + 'Z');
              const h = d.getHours();
              const m = String(d.getMinutes()).padStart(2, '0');
              const ampm = h < 12 ? '오전' : '오후';
              myTimeSpan.textContent = `${ampm} ${h % 12 || 12}:${m}`;
            }
            myHeaderRow.appendChild(myTimeSpan);
            
            msgDiv.appendChild(myHeaderRow);
          }
        } else {
          msgDiv.className = `message ${msg.role}`;
        }
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = msg.content;
        msgDiv.appendChild(contentDiv);
        
        // 봇 메시지 하단에 복사 버튼 추가 (AiON 채팅에서만)
        if (!currentRoomId && msg.role === 'bot') {
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
          
          const shareBtn = document.createElement('button');
          shareBtn.className = 'action-btn share-btn';
          shareBtn.innerHTML = '<iconify-icon icon="lucide:share-2"></iconify-icon>';
          shareBtn.onclick = (e) => {
             window.showSharePopup(e.currentTarget, msg.content);
          };
          
          actionRow.appendChild(copyBtn);
          actionRow.appendChild(boardBtn);
          actionRow.appendChild(shareBtn);
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
        lContent.textContent = 'AiON agent 작동 중...';
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

  // 하네스가 선택되어 있으면 합성 (AiON 채팅에서만)
  let finalMessage = text;
  if (!currentRoomId && selectedHarness) {
    const lines = selectedHarness.content.split('\n').filter(l => l.trim()).join('\n');
    finalMessage = text + '\n\n[하네스:' + selectedHarness.title + ']\n' + lines;
    selectedHarness = null;
    const indicator = document.getElementById('harnessIndicator');
    if(indicator) indicator.remove();
  }

  // 사용자의 입력은 낙관적 렌더링(Optimistic update)
  const userDiv = document.createElement('div');
  userDiv.className = `message user`;
  const uContent = document.createElement('div');
  uContent.className = 'message-content';
  uContent.textContent = finalMessage;
  userDiv.appendChild(uContent);
  messagesEl.appendChild(userDiv);

  // 로딩 인디케이터 (AiON 채팅에서만 표시)
  if (!currentRoomId) {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = `message bot`;
    loadingDiv.id = 'loadingIndicator';
    const lContent = document.createElement('div');
    lContent.className = 'message-content';
    lContent.textContent = 'Agent ONAi 작동 중...';
    loadingDiv.appendChild(lContent);
    messagesEl.appendChild(loadingDiv);
  }
  
  if (welcomeScreen.style.display !== 'none') {
    welcomeScreen.style.display = 'none';
    messagesEl.style.display = 'block';
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
  
  // 다음 syncChats가 강제로 화면을 덮어쓰기 하도록 카운트 조작
  currentMsgCount = -1;

  try {
    const headers = { 'Content-Type': 'application/json', 'User-Email': getCurrentUserEmail() };
    await fetch('/api/chat', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ message: finalMessage, room_id: currentRoomId })
    });
    // POST 직후 즉각 1회 동기화
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
    const res = await fetch('/api/history', { headers: { 'User-Email': getCurrentUserEmail() } });
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
          const hRes = await fetch('/api/history/' + item.session_date, { headers: { 'User-Email': getCurrentUserEmail() } });
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
       currentRoomId = null;
       document.querySelectorAll('.group-room-btn').forEach(b => b.classList.remove('active'));
       
       chatView.style.display = 'flex';
       historyView.style.display = 'none';
       boardView.style.display = 'none';
       const hgv = document.getElementById('harnessGalleryView');
       if(hgv) hgv.style.display = 'none';
       const agv = document.getElementById('automationGalleryView');
       if(agv) agv.style.display = 'none';
       const lv = document.getElementById('landingView');
       if(lv) lv.style.display = 'none';
       
       // 메시지 영역 즉시 초기화 (그룹챗 잔류 방지)
       messagesEl.innerHTML = '';
       messagesEl.style.display = 'none';
       welcomeScreen.style.display = 'flex';
       currentMsgCount = -1; // 강제 새로고침
       
       // 타이틀 기본값 변경
       const subTitleEl = document.querySelector('.welcome-subtitle');
       if(subTitleEl) subTitleEl.innerText = '무엇을 도와드릴까요?';
       
       const chatRoomHeader = document.getElementById('chatRoomHeader');
       if(chatRoomHeader) chatRoomHeader.style.display = 'none';
       
       // 하네스 버튼 복원, placeholder 복원
       const harnessBtn = document.getElementById('harnessBtn');
       if(harnessBtn) harnessBtn.style.display = '';
       const attachBtn = document.getElementById('attachBtn');
       if(attachBtn) attachBtn.style.display = 'none';
       inputEl.placeholder = 'AiON agent에게 물어보세요...';
       
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
         const res = await fetch('/api/board', { headers: { 'User-Email': getCurrentUserEmail() } });
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

  // --- 관리자 설정 우측 패널 연결 ---
  const adminMenu = document.getElementById('adminSettingMenu');
  if(adminMenu) {
    adminMenu.addEventListener('click', () => {
      showMainView('adminSettingsView');
      loadAdminData();
      document.getElementById('userMenuPopup').classList.remove('show');
    });
  }

  // --- 계정 설정 연결 ---
  const accountMenu = document.getElementById('accountSettingMenu');
  if(accountMenu) {
    accountMenu.addEventListener('click', () => {
      showMainView('accountSettingsView');
      loadAccountSettings();
      document.getElementById('userMenuPopup').classList.remove('show');
    });
  }
  
  const saveAccBtn = document.getElementById('saveAccountSettings');
  if(saveAccBtn) {
    saveAccBtn.addEventListener('click', async () => {
      const newName = document.getElementById('settingsDisplayName').value.trim();
      if(!newName) return alert('이름을 입력해주세요.');
      const email = getCurrentUserEmail();
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ email, name: newName })
        });
        const data = await res.json();
        if(data.success) {
          // 로컬 스토리지 업데이트
          const u = JSON.parse(localStorage.getItem('agentOn_user'));
          u.name = newName;
          localStorage.setItem('agentOn_user', JSON.stringify(u));
          // 사이드바 이름도 업데이트
          const un = document.querySelector('.user-name');
          if(un) un.textContent = newName;
          // 환영 문구도 업데이트
          applyUserInfo(u);
          alert('저장되었습니다.');
        }
      } catch(e) { alert('저장 실패'); }
    });
  }

  // --- 하네스 설정 메뉴 연결 ---
  const harnessMenu = document.getElementById('harnessSettingMenu');
  if(harnessMenu) {
    harnessMenu.addEventListener('click', () => {
      showMainView('harnessGalleryView');
      var addBtn = document.getElementById('addHarnessBtn');
      if(addBtn && window.currentUserRole === 'ADMIN') {
        addBtn.style.display = 'block';
        addBtn.onclick = function() { document.getElementById('harnessCreateForm').style.display = 'block'; };
      }
      loadHarnessGallery();
      document.getElementById('userMenuPopup').classList.remove('show');
    });
  }

  // --- 자동화 설정 메뉴 연결 ---
  const automationMenu = document.getElementById('automationSettingMenu');
  if(automationMenu) {
    automationMenu.addEventListener('click', () => {
      showMainView('automationGalleryView');
      var addBtn = document.getElementById('addAutomationBtn');
      if(addBtn && window.currentUserRole === 'ADMIN') {
        addBtn.style.display = 'block';
        addBtn.onclick = function() { document.getElementById('automationCreateForm').style.display = 'block'; };
      }
      loadAutomationGallery();
      document.getElementById('userMenuPopup').classList.remove('show');
    });
  }
});

// 계정 설정 뷰에 현재 정보 로드
function loadAccountSettings() {
  const u = localStorage.getItem('agentOn_user');
  if(!u) return;
  const user = JSON.parse(u);
  
  // 프로필 사진
  const avatarEl = document.getElementById('settingsAvatar');
  if(avatarEl) {
    if(user.picture) {
      avatarEl.innerHTML = `<img src="${user.picture}" style="width:100%;height:100%;object-fit:cover;" alt="">`;
    } else {
      avatarEl.textContent = (user.name || '?').charAt(0);
    }
  }
  
  // 이름
  const nameEl = document.getElementById('settingsDisplayName');
  if(nameEl) nameEl.value = user.name || '';
  
  // 이메일
  const emailEl = document.getElementById('settingsEmail');
  if(emailEl) emailEl.textContent = user.email || '';
  
  // 역할
  const roleEl = document.getElementById('settingsRole');
  if(roleEl) {
    const roleMap = {'ADMIN': '관리자', 'APPROVED': '승인된 사용자', 'PENDING': '승인 대기'};
    roleEl.textContent = roleMap[window.currentUserRole] || window.currentUserRole || '알 수 없음';
  }
}

// --- 회원 관리 및 그룹 채팅 로직 ---
async function initUserBackend(userInfo) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ email: userInfo.email, name: userInfo.name, picture: userInfo.picture || '' })
    });
    const data = await res.json();
    if(data.success) {
      window.currentUserRole = data.user.role;
      if(data.user.role === 'ADMIN') {
        const adminMenu = document.getElementById('adminSettingMenu');
        if(adminMenu) adminMenu.style.display = 'flex';
      }
      if(data.user.role === 'ADMIN' || data.user.role === 'APPROVED') {
        const harnessMenu = document.getElementById('harnessSettingMenu');
        if(harnessMenu) harnessMenu.style.display = 'flex';
        const automationMenu = document.getElementById('automationSettingMenu');
        if(automationMenu) automationMenu.style.display = 'flex';
      }
      fetchMyRooms(userInfo.email);
    }
  } catch(e) { console.error('Backend init failed', e); }
}

async function fetchMyRooms(email) {
  try {
    const res = await fetch('/api/rooms', { headers: {'User-Email': email} });
    const data = await res.json();
    if(data.success && data.rooms && data.rooms.length > 0) {
      const groupSection = document.getElementById('groupSection');
      if(groupSection) groupSection.style.display = 'block';
      const container = document.getElementById('groupRoomsList');
      if(container) {
        container.innerHTML = data.rooms.map(r => `
          <div class="nav-item group-room-btn" data-id="${r.id}">
            <iconify-icon icon="lucide:hash"></iconify-icon> <span class="nav-label">${r.name}</span>
          </div>
        `).join('');
        container.querySelectorAll('.group-room-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            // 1. 상태 초기화
            currentRoomId = btn.getAttribute('data-id');
            const rName = btn.innerText.trim();
            currentMsgCount = -1;
            
            // 2. 메시지 영역 즉시 비우기 (이전 AiON 채팅 잔류 방지)
            messagesEl.innerHTML = '';
            messagesEl.style.display = 'none';
            welcomeScreen.style.display = 'flex';
            
            // 3. 뷰 전환 (showMainView는 isViewingHistory=true로 설정)
            showMainView('chatView');
            
            // 4. 그룹챗이므로 isViewingHistory를 다시 false로 해제 (syncChats 작동 필수)
            isViewingHistory = false;
            
            // 5. 메뉴 활성화 표시
            container.querySelectorAll('.group-room-btn').forEach(b => b.classList.remove('active'));
            document.getElementById('navChat').classList.remove('active');
            btn.classList.add('active');
            
            // 6. 환영 문구 및 방 헤더 설정
            const subTitleEl = document.querySelector('.welcome-subtitle');
            if(subTitleEl) subTitleEl.innerText = rName + ' 채팅방에 오신 것을 환영합니다';
            const chatRoomTitle = document.getElementById('chatRoomTitle');
            if(chatRoomTitle) chatRoomTitle.innerText = rName;
            const chatRoomHeader = document.getElementById('chatRoomHeader');
            if(chatRoomHeader) chatRoomHeader.style.display = 'flex';
            
            // 8. 입력창 UI 변경: 하네스 버튼 숨기고 파일첨부 버튼 표시
            const harnessBtn = document.getElementById('harnessBtn');
            if(harnessBtn) harnessBtn.style.display = 'none';
            const harnessPopup = document.getElementById('harnessPopup');
            if(harnessPopup) harnessPopup.style.display = 'none';
            const attachBtn = document.getElementById('attachBtn');
            if(attachBtn) attachBtn.style.display = '';
            inputEl.placeholder = '메시지를 입력하세요.';
            
            // 9. 해당 방의 메시지 로드
            syncChats();
          });
        });
      }
    }
  } catch(e) { console.error('Rooms fetch failed', e); }
}

async function loadAdminData() {
  const email = getCurrentUserEmail();
  if(!email) return;
  
  // 1. 사용자 승인 관리,
  try {
    const userRes = await fetch('/api/admin/users', { headers: {'User-Email': email} });
    const userData = await userRes.json();
    if(userData.success) {
      document.getElementById('adminUsersList').innerHTML = userData.users.map(u => {
        const roleColors = {'ADMIN': '#3b82f6', 'APPROVED': '#10b981', 'PENDING': '#f59e0b'};
        const roleLabels = {'ADMIN': '관리자', 'APPROVED': '승인됨', 'PENDING': '대기 중'};
        const isAdmin = u.role === 'ADMIN';
        let actionBtns = '';
        if (!isAdmin) {
          if (u.role === 'PENDING') {
            actionBtns = `<button onclick="window.approveUser('${u.email}', 'APPROVED')" style="padding:5px 12px; border-radius:6px; background:rgba(16,185,129,0.15); border:1px solid #10b981; color:#10b981; cursor:pointer; font-size:0.8rem;">승인</button>`;
          } else {
            actionBtns = `<button onclick="window.approveUser('${u.email}', 'PENDING')" style="padding:5px 12px; border-radius:6px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#ef4444; cursor:pointer; font-size:0.8rem;">해제</button>`;
          }
        }
        return `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 12px; border:1px solid var(--border-color); border-radius:8px; background:var(--bg-main);">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:32px; height:32px; border-radius:50%; background:${roleColors[u.role]}20; display:flex; align-items:center; justify-content:center; color:${roleColors[u.role]}; font-size:0.8rem; font-weight:600;">${(u.name || '?').charAt(0)}</div>
            <div>
              <div style="font-weight:500; font-size:0.95rem;">${u.name || '이름없음'}</div>
              <div style="font-size:0.8rem; color:var(--text-muted);">${u.email}</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:0.75rem; padding:3px 8px; border-radius:4px; background:${roleColors[u.role]}20; color:${roleColors[u.role]};">${roleLabels[u.role] || u.role}</span>
            ${actionBtns}
          </div>
        </div>`;
      }).join('');
    }
  } catch(e) { console.error(e); }

  // 2. 그룹챗 목록 및 멤버 관리
  try {
    const roomRes = await fetch('/api/admin/rooms', { headers: {'User-Email': email} });
    const roomData = await roomRes.json();
    const roomsEl = document.getElementById('adminRoomsList');
    if(!roomsEl) return;
    
    if(roomData.success && roomData.rooms.length > 0) {
      roomsEl.innerHTML = roomData.rooms.map(room => {
        const roomMembers = roomData.members.filter(m => m.room_id === room.id);
        const memberTags = roomMembers.map(m => 
          `<div style="display:inline-flex; align-items:center; gap:4px; padding:4px 8px; border-radius:16px; background:var(--bg-input); font-size:0.8rem; border:1px solid var(--border-color);">
            <span>${m.user_email.split('@')[0]}</span>
            <button onclick="event.stopPropagation(); window.removeMember(${room.id}, '${m.user_email}')" style="background:none; border:none; cursor:pointer; color:#ef4444; font-size:0.9rem; padding:0; line-height:1;" title="삭제">×</button>
          </div>`
        ).join('');
        
        return `<div style="padding:16px; border:1px solid var(--border-color); border-radius:10px; background:var(--bg-main);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <div style="display:flex; align-items:center; gap:8px;">
              <iconify-icon icon="lucide:hash" style="color:#8b5cf6; font-size:1.1rem;"></iconify-icon>
              <input type="text" value="${room.name}" id="roomName_${room.id}" style="font-weight:600; font-size:1rem; background:transparent; border:none; color:var(--text-high); border-bottom:1px solid transparent; transition:border-color 0.2s; padding:2px 0;" onfocus="this.style.borderBottomColor='#8b5cf6'" onblur="this.style.borderBottomColor='transparent'" />
              <button onclick="window.renameRoom(${room.id})" style="padding:3px 8px; border-radius:4px; border:1px solid var(--border-color); background:transparent; color:#8b5cf6; cursor:pointer; font-size:0.75rem;">저장</button>
            </div>
            <button onclick="if(confirm('정말 이 그룹챗을 삭제하시겠습니까?')) window.deleteRoom(${room.id})" style="padding:4px 10px; border-radius:6px; border:1px solid rgba(239,68,68,0.3); background:transparent; color:#ef4444; cursor:pointer; font-size:0.8rem;">삭제</button>
          </div>
          <div style="margin-bottom:10px;">
            <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:6px;">참여자 (${roomMembers.length}명)</div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">${memberTags || '<span style="font-size:0.85rem; color:var(--text-muted);">참여자가 없습니다</span>'}</div>
          </div>
          <div style="display:flex; gap:6px; margin-top:8px;">
            <input type="text" placeholder="이메일로 멤버 추가" id="invite_${room.id}" style="flex:1; padding:8px; border-radius:6px; border:1px solid var(--border-color); background:var(--bg-input); color:var(--text-high); font-size:0.85rem;" />
            <button onclick="window.inviteToRoom(${room.id})" style="padding:8px 14px; border-radius:6px; background:rgba(16,185,129,0.15); border:1px solid #10b981; color:#10b981; cursor:pointer; font-size:0.85rem; white-space:nowrap;">추가</button>
          </div>
        </div>`;
      }).join('');
    } else {
      roomsEl.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.9rem;">개설된 그룹챗이 없습니다.</div>';
    }
  } catch(e) { console.error(e); }
}

// 사용자 승인/해제
window.approveUser = async function(targetEmail, role) {
  const email = getCurrentUserEmail();
  await fetch('/api/admin/users/approve', {
    method: 'POST',
    headers: {"Content-Type": "application/json", "User-Email": email},
    body: JSON.stringify({ targetEmail, role })
  });
  loadAdminData();
}

// 새 그룹챗 개설
window.createNewRoom = async function() {
  const name = document.getElementById('newRoomName').value.trim();
  if(!name) return alert('그룹챗 이름을 입력하세요.');
  const email = getCurrentUserEmail();
  const res = await fetch('/api/admin/rooms', {
    method: 'POST',
    headers: {"Content-Type": "application/json", "User-Email": email},
    body: JSON.stringify({ name })
  });
  const data = await res.json();
  if(data.success) {
    document.getElementById('newRoomName').value = '';
    loadAdminData();
  }
}

// 그룹챗 이름 변경
window.renameRoom = async function(roomId) {
  const input = document.getElementById('roomName_' + roomId);
  const name = input.value.trim();
  if(!name) return;
  const email = getCurrentUserEmail();
  await fetch('/api/admin/rooms/' + roomId, {
    method: 'PUT',
    headers: {"Content-Type": "application/json", "User-Email": email},
    body: JSON.stringify({ name })
  });
  loadAdminData();
}

// 그룹챗 삭제
window.deleteRoom = async function(roomId) {
  const email = getCurrentUserEmail();
  await fetch('/api/admin/rooms/' + roomId, {
    method: 'DELETE',
    headers: {"User-Email": email}
  });
  loadAdminData();
}

// 멤버 추가
window.inviteToRoom = async function(roomId) {
  const input = document.getElementById('invite_' + roomId);
  const targetEmail = input.value.trim();
  if(!targetEmail) return;
  const email = getCurrentUserEmail();
  const res = await fetch('/api/admin/rooms/invite', {
    method: 'POST',
    headers: {"Content-Type": "application/json", "User-Email": email},
    body: JSON.stringify({ roomId, targetEmail })
  });
  const data = await res.json();
  if(data.success) {
    input.value = '';
    loadAdminData();
  } else {
    alert('추가 실패: ' + (data.error || '알 수 없는 에러'));
  }
}

// 멤버 제거
window.removeMember = async function(roomId, targetEmail) {
  if(!confirm(targetEmail + '을(를) 이 채팅방에서 제거하시겠습니까?')) return;
  const email = getCurrentUserEmail();
  await fetch('/api/admin/rooms/remove', {
    method: 'DELETE',
    headers: {"Content-Type": "application/json", "User-Email": email},
    body: JSON.stringify({ roomId, targetEmail })
  });
  loadAdminData();
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
      const res = await fetch('/api/harnesses', { headers: { 'User-Email': getCurrentUserEmail() } });
      const data = await res.json();
      const listEl = document.getElementById('harnessListChat');
      if(data.success && data.harnesses.length > 0) {
        listEl.innerHTML = data.harnesses.map(h => `
          <div class="harness-item" data-id="${h.id}" style="padding:10px 16px; cursor:pointer; display:flex; align-items:center; gap:8px; transition:background 0.15s;" 
               onmouseover="this.style.background='var(--bg-input)'" onmouseout="this.style.background='transparent'">
            <iconify-icon icon="lucide:zap" style="color:#f59e0b; flex-shrink:0;"></iconify-icon>
            <span style="font-weight:500; font-size:0.9rem;">${h.title}</span>
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

// 하네스 갤러리 그리드 렌더링 (역할별 분기)
async function loadHarnessGallery() {
  const userInfoStr = localStorage.getItem('agentOn_user');
  if(!userInfoStr) return;
  const email = JSON.parse(userInfoStr).email;
  try {
    const res = await fetch('/api/admin/harnesses', { headers: {'User-Email': email} });
    const data = await res.json();
    const grid = document.getElementById('harnessGalleryGrid');
    if(!grid) return;
    const isAdmin = data.isAdmin;
    
    // 새 하네스 추가 버튼 표시/숨김
    const addBtn = document.getElementById('addHarnessBtn');
    if(addBtn) addBtn.style.display = isAdmin ? '' : 'none';
    
    if(data.success && data.harnesses && data.harnesses.length > 0) {
      const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
      grid.innerHTML = data.harnesses.map(function(h) {
        var color = colors[h.id % colors.length];
        var enabled = h.user_enabled;
        // 배지: 내 계정 기준 노출/비노출
        var badge = '<span style="position:absolute;top:8px;right:8px;font-size:0.7rem;padding:2px 6px;border-radius:4px;background:'+(enabled?'rgba(16,185,129,0.2)':'rgba(239,68,68,0.2)')+';color:'+(enabled?'#10b981':'#ef4444')+';">'+(enabled?'사용 중':'비활성')+'</span>';
        var btns = '';
        if (isAdmin) {
          btns = '<div style="display:flex;gap:6px;margin-top:12px;border-top:1px solid var(--border-color);padding-top:10px;"><button onclick="event.stopPropagation();window.openHarnessEdit('+h.id+')" style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--border-color);background:transparent;color:#f59e0b;cursor:pointer;font-size:0.8rem;">수정</button><button onclick="event.stopPropagation();window.toggleMyHarness('+h.id+')" style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--border-color);background:transparent;color:var(--text-muted);cursor:pointer;font-size:0.8rem;">'+(enabled?'비활성':'활성')+'</button><button onclick="event.stopPropagation();window.deleteHarness('+h.id+')" style="padding:6px 10px;border-radius:6px;border:1px solid rgba(239,68,68,0.3);background:transparent;color:#ef4444;cursor:pointer;font-size:0.8rem;">삭제</button></div>';
        } else {
          btns = '<div style="display:flex;gap:6px;margin-top:12px;border-top:1px solid var(--border-color);padding-top:10px;"><button onclick="event.stopPropagation();window.toggleMyHarness('+h.id+')" style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--border-color);background:transparent;color:'+(enabled?'#ef4444':'#10b981')+';cursor:pointer;font-size:0.8rem;">'+(enabled?'비활성하기':'활성하기')+'</button></div>';
        }
        var opacity = enabled ? '1' : '0.5';
        return '<div class="harness-card" data-id="'+h.id+'" data-enabled="'+enabled+'" style="position:relative;padding:20px;border:1px solid var(--border-color);border-radius:12px;background:var(--bg-sidebar);cursor:pointer;transition:all 0.2s;overflow:hidden;opacity:'+opacity+';">'+badge+'<div style="width:48px;height:48px;border-radius:12px;background:'+color+'18;display:flex;align-items:center;justify-content:center;margin-bottom:14px;"><iconify-icon icon="lucide:zap" style="font-size:1.4rem;color:'+color+';"></iconify-icon></div><div style="font-weight:600;font-size:1rem;margin-bottom:6px;">'+h.title+'</div><div style="font-size:0.85rem;color:var(--text-muted);line-height:1.5;white-space:pre-wrap;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;">'+h.content+'</div>'+btns+'</div>';
      }).join('');
      grid.querySelectorAll('.harness-card').forEach(function(card) {
        card.addEventListener('click', function() {
          var hId = parseInt(card.dataset.id);
          var en = card.dataset.enabled;
          var harness = data.harnesses.find(function(h){return h.id === hId;});
          if(harness && (en === '1' || en === 1)) {
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

// 계정별 하네스 노출 토글
window.toggleMyHarness = async function(id) {
  const email = getCurrentUserEmail();
  try {
    const res = await fetch('/api/harnesses/' + id + '/toggle', {
      method: 'PUT',
      headers: {'User-Email': email}
    });
    const data = await res.json();
    if(data.success) loadHarnessGallery();
  } catch(e) { console.error(e); }
}

// 로고 버튼 → 하네스 갤러리 뷰 열기
function initHarnessGalleryBtn() {
  var btn = document.getElementById('harnessGalleryBtn');
  if(!btn) return;
  btn.addEventListener('click', function(e) {
    e.preventDefault();
    showMainView('harnessGalleryView');
    loadHarnessGallery();
  });
}

// 그룹챗 공유 팝업 로직
window.showSharePopup = function(targetEl, content) {
  const popup = document.getElementById('sharePopup');
  const roomsList = document.getElementById('shareRoomsList');
  if(!popup || !roomsList) return;

  // 위치 설정 (클릭한 버튼 옆)
  const rect = targetEl.getBoundingClientRect();
  popup.style.top = (rect.top - 10) + 'px';
  popup.style.left = (rect.right + 10) + 'px';
  popup.style.display = 'flex';

  // 방 목록 불러오기 (fetchMyRooms 로직 재사용하거나 별도 fetch)
  const userInfoStr = localStorage.getItem('agentOn_user');
  if(!userInfoStr) return;
  const email = JSON.parse(userInfoStr).email;

  fetch('/api/rooms', { headers: {'User-Email': email} })
    .then(res => res.json())
    .then(data => {
      if(data.success && data.rooms) {
        roomsList.innerHTML = data.rooms.map(r => `
          <div class="share-room-item" data-id="${r.id}" style="padding:8px 12px; border-radius:6px; cursor:pointer; font-size:0.9rem; transition:background 0.2s; display:flex; align-items:center; gap:8px;">
            <iconify-icon icon="lucide:hash" style="color:#8b5cf6;"></iconify-icon> ${r.name}
          </div>
        `).join('');

        roomsList.querySelectorAll('.share-room-item').forEach(item => {
          item.addEventListener('mouseenter', () => item.style.background = 'rgba(255,255,255,0.05)');
          item.addEventListener('mouseleave', () => item.style.background = 'transparent');
          item.addEventListener('click', async () => {
            const roomId = item.getAttribute('data-id');
            const roomName = item.innerText.trim();
            item.innerHTML = '<iconify-icon icon="lucide:loader-2" class="spin"></iconify-icon> 전달 중...';
            
            try {
              const res = await fetch('/api/chat/forward', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content, room_id: roomId })
              });
              const d = await res.json();
              if(d.success) {
                item.innerHTML = '<iconify-icon icon="lucide:check" style="color:#10b981;"></iconify-icon> 전달 완료!';
                setTimeout(() => {
                  popup.style.display = 'none';
                }, 1000);
              } else {
                item.innerHTML = '실패';
              }
            } catch(e) {
              item.innerHTML = '오류';
            }
          });
        });
      }
    });

  // 바깥 클릭 시 닫기
  const closePopup = (e) => {
    if(!popup.contains(e.target) && !targetEl.contains(e.target)) {
      popup.style.display = 'none';
      document.removeEventListener('click', closePopup);
    }
  };
  setTimeout(() => document.addEventListener('click', closePopup), 10);
};



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

// 하네스 수정 모달 열기
window.openHarnessEdit = async function(id) {
  var userInfoStr = localStorage.getItem('agentOn_user');
  if(!userInfoStr) return;
  var email = JSON.parse(userInfoStr).email;
  var res = await fetch('/api/admin/harnesses', { headers: {'User-Email': email} });
  var data = await res.json();
  var h = data.harnesses.find(function(x){return x.id === id;});
  if(!h) return;
  document.getElementById('editHarnessId').value = h.id;
  document.getElementById('editHarnessTitle').value = h.title;
  document.getElementById('editHarnessContent').value = h.content;
  document.getElementById('harnessEditModal').style.display = 'flex';
}

window.saveHarnessEdit = async function() {
  var userInfoStr = localStorage.getItem('agentOn_user');
  if(!userInfoStr) return;
  var email = JSON.parse(userInfoStr).email;
  var id = document.getElementById('editHarnessId').value;
  var title = document.getElementById('editHarnessTitle').value.trim();
  var content = document.getElementById('editHarnessContent').value.trim();
  if(!title || !content) return alert('제목과 내용을 모두 입력해주세요.');
  await fetch('/api/admin/harnesses/' + id, {
    method: 'PUT',
    headers: {"Content-Type": "application/json", "User-Email": email},
    body: JSON.stringify({ title: title, content: content, is_visible: 1 })
  });
  document.getElementById('harnessEditModal').style.display = 'none';
  loadHarnessGallery();
}

// ==========================================
// 자동화(Automation) 갤러리 및 로직
// ==========================================
window.createAutomation = async function() {
  const title = document.getElementById('newAutomationTitle').value.trim();
  const content = document.getElementById('newAutomationContent').value.trim();
  if(!title || !content) return alert('제목과 내용을 모두 입력해주세요.');
  const userInfoStr = localStorage.getItem('agentOn_user');
  if(!userInfoStr) return;
  const email = JSON.parse(userInfoStr).email;
  try {
    const res = await fetch('/api/admin/automations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Email': email },
      body: JSON.stringify({ title, content })
    });
    const data = await res.json();
    if(data.success) {
      document.getElementById('newAutomationTitle').value = '';
      document.getElementById('newAutomationContent').value = '';
      document.getElementById('automationCreateForm').style.display = 'none';
      loadAutomationGallery();
    }
  } catch(e) { console.error('Automation create failed', e); }
};

window.loadAutomationGallery = async function() {
  const userInfoStr = localStorage.getItem('agentOn_user');
  if(!userInfoStr) return;
  const email = JSON.parse(userInfoStr).email;
  const isAdmin = (window.currentUserRole === 'ADMIN');
  const endpoint = isAdmin ? '/api/admin/automations' : '/api/automations';
  const headers = isAdmin ? {'User-Email': email} : {};
  try {
    const res = await fetch(endpoint, { headers });
    const data = await res.json();
    const grid = document.getElementById('automationGalleryGrid');
    if(!grid) return;
    if(data.success && data.automations && data.automations.length > 0) {
      grid.innerHTML = data.automations.map(a => {
        const badge = isAdmin ? `<span style="position:absolute;top:8px;right:8px;font-size:0.7rem;padding:2px 6px;border-radius:4px;background:${a.is_visible?'rgba(16,185,129,0.2)':'rgba(239,68,68,0.2)'};color:${a.is_visible?'#10b981':'#ef4444'};">${a.is_visible?'노출':'숨김'}</span>` : '';
        const btns = isAdmin ? `
          <div style="display:flex;gap:6px;margin-top:12px;border-top:1px solid var(--border-color);padding-top:10px;">
            <button onclick="event.stopPropagation();window.openAutomationEdit(${a.id})" style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--border-color);background:transparent;color:#10b981;cursor:pointer;font-size:0.8rem;">수정</button>
            <button onclick="event.stopPropagation();window.toggleAutomationVisibility(${a.id})" style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--border-color);background:transparent;color:var(--text-muted);cursor:pointer;font-size:0.8rem;">${a.is_visible?'숨기기':'노출'}</button>
            <button onclick="event.stopPropagation();window.deleteAutomation(${a.id})" style="padding:6px 10px;border-radius:6px;border:1px solid rgba(239,68,68,0.3);background:transparent;color:#ef4444;cursor:pointer;font-size:0.8rem;">삭제</button>
          </div>
        ` : '';
        return `
          <div class="harness-card" style="position:relative;padding:20px;border:1px solid var(--border-color);border-radius:12px;background:var(--bg-sidebar);transition:all 0.2s;overflow:hidden;">
            ${badge}
            <div style="width:48px;height:48px;border-radius:12px;background:rgba(16,185,129,0.1);display:flex;align-items:center;justify-content:center;margin-bottom:14px;">
              <iconify-icon icon="lucide:bot" style="font-size:1.4rem;color:#10b981;"></iconify-icon>
            </div>
            <div style="font-weight:600;font-size:1rem;margin-bottom:6px;">${a.title}</div>
            <div style="font-size:0.85rem;color:var(--text-muted);line-height:1.5;white-space:pre-wrap;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;">${a.content}</div>
            ${btns}
          </div>
        `;
      }).join('');
    } else {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted);"><iconify-icon icon="lucide:inbox" style="font-size:3rem;margin-bottom:12px;display:block;"></iconify-icon><div style="font-size:1.1rem;margin-bottom:8px;">등록된 자동화가 없습니다</div><div style="font-size:0.9rem;">'+(isAdmin?'"+ 새 자동화" 버튼을 눌러 추가해보세요.':'관리자가 등록하면 여기에 표시됩니다.')+'</div></div>';
    }
  } catch(e) { console.error('Automation load failed:', e); }
};

window.toggleAutomationVisibility = async function(id) {
  var userInfoStr = localStorage.getItem('agentOn_user');
  if(!userInfoStr) return;
  var email = JSON.parse(userInfoStr).email;
  var listRes = await fetch('/api/admin/automations', { headers: {'User-Email': email} });
  var listData = await listRes.json();
  var a = listData.automations.find(function(x){return x.id === id;});
  if(!a) return;
  await fetch('/api/admin/automations/' + id, {
    method: 'PUT',
    headers: {"Content-Type": "application/json", "User-Email": email},
    body: JSON.stringify({ title: a.title, content: a.content, is_visible: a.is_visible ? 0 : 1 })
  });
  loadAutomationGallery();
};

window.deleteAutomation = async function(id) {
  if(!confirm('이 자동화 작업을 삭제하시겠습니까?')) return;
  var userInfoStr = localStorage.getItem('agentOn_user');
  if(!userInfoStr) return;
  var email = JSON.parse(userInfoStr).email;
  await fetch('/api/admin/automations/' + id, {
    method: 'DELETE',
    headers: {'User-Email': email}
  });
  loadAutomationGallery();
};

window.openAutomationEdit = async function(id) {
  var userInfoStr = localStorage.getItem('agentOn_user');
  if(!userInfoStr) return;
  var email = JSON.parse(userInfoStr).email;
  var res = await fetch('/api/admin/automations', { headers: {'User-Email': email} });
  var data = await res.json();
  var a = data.automations.find(function(x){return x.id === id;});
  if(!a) return;
  document.getElementById('editAutomationId').value = a.id;
  document.getElementById('editAutomationTitle').value = a.title;
  document.getElementById('editAutomationContent').value = a.content;
  document.getElementById('automationEditModal').style.display = 'flex';
};

window.saveAutomationEdit = async function() {
  var userInfoStr = localStorage.getItem('agentOn_user');
  if(!userInfoStr) return;
  var email = JSON.parse(userInfoStr).email;
  var id = document.getElementById('editAutomationId').value;
  var title = document.getElementById('editAutomationTitle').value.trim();
  var content = document.getElementById('editAutomationContent').value.trim();
  if(!title || !content) return alert('제목과 내용을 모두 입력해주세요.');
  await fetch('/api/admin/automations/' + id, {
    method: 'PUT',
    headers: {"Content-Type": "application/json", "User-Email": email},
    body: JSON.stringify({ title: title, content: content, is_visible: 1 })
  });
  document.getElementById('automationEditModal').style.display = 'none';
  loadAutomationGallery();
};

// 초기화
initHarnessPopup();

