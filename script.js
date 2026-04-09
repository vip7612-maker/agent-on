// script.js

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const welcomeScreen = document.getElementById('welcomeScreen');
const menuToggle = document.querySelector('.menu-toggle');
const sidebar = document.querySelector('.sidebar');

let isWaitingForBot = false;
let currentMsgCount = 0;

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
        messagesEl.appendChild(msgDiv);
        
        // DB에 최신 봇의 답변이 생겼다면 대기 상태 종료
        if (msg.role === 'bot') {
          isWaitingForBot = false;
        }
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
  updateGreeting();
  syncChats();

  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }
});
