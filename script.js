// script.js

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const welcomeScreen = document.getElementById('welcomeScreen');
const menuToggle = document.querySelector('.menu-toggle');
const sidebar = document.querySelector('.sidebar');

let isWaitingForBot = false;
let currentMsgCount = 0;

const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com'; // TODO: 구글 클라우드 콘솔의 OAuth 클라이언트 ID로 변경 필수

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
async function checkGoogleLogin() {
  const fragmentString = location.hash.substring(1);
  const params = {};
  const regex = /([^&=]+)=([^&]*)/g;
  let m;
  while ((m = regex.exec(fragmentString))) {
    params[decodeURIComponent(m[1])] = decodeURIComponent(m[2]);
  }
  
  if (Object.keys(params).length > 0 && params['access_token']) {
    // 1. URL 해시 정리 (주소창 깔끔하게)
    window.history.replaceState({}, document.title, window.location.pathname);
    
    try {
      // 2. 구글에서 프로필 정보 가져오기
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${params['access_token']}` }
      });
      const userInfo = await res.json();
      
      // 3. UI 업데이트
      const googleBtn = document.getElementById('googleLoginBtn');
      if (googleBtn) googleBtn.style.display = 'none';
      
      const userProfile = document.getElementById('userProfile');
      if (userProfile) userProfile.style.display = 'flex';
      
      // 프로필 이미지 및 이름 세팅
      if (userProfile) {
        const avatarDiv = userProfile.querySelector('.avatar');
        if (userInfo.picture) {
          avatarDiv.style.background = 'transparent';
          avatarDiv.innerHTML = `<img src="${userInfo.picture}" alt="profile" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        } else {
          avatarDiv.textContent = userInfo.given_name ? userInfo.given_name[0] : '이';
        }
        userProfile.querySelector('.user-name').textContent = userInfo.name || '이경진';
        
        // 동적 인사말 호칭도 업데이트
        const greetingTitle = document.getElementById('welcomeTitle');
        if (greetingTitle && greetingTitle.textContent.includes('교장님')) {
          greetingTitle.textContent = greetingTitle.textContent.replace('교장님', userInfo.name + ' 교장님');
        }
      }
    } catch (err) {
      console.error('Failed to fetch user info', err);
    }
  }
}

// 대화 내역 실시간 동기화 (폴링 기법)
async function syncChats() {
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
          
          actionRow.appendChild(copyBtn);
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
        lContent.textContent = '온비서(안티그래비티) 작동 중...';
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
  lContent.textContent = '온비서(안티그래비티) 작동 중...';
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
      body: JSON.stringify({ message: text })
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

// 앱 실행 시 구동 로직
window.addEventListener('DOMContentLoaded', () => {
  checkGoogleLogin();
  updateGreeting();
  syncChats();

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
});
