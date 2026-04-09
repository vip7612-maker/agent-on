// script.js

const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const welcomeScreen = document.getElementById('welcomeScreen');
const menuToggle = document.querySelector('.menu-toggle');
const sidebar = document.querySelector('.sidebar');

// 대화 내역 초기 로드
async function loadChatHistory() {
  try {
    const res = await fetch('/api/chat');
    const data = await res.json();
    if (data.success && data.messages.length > 0) {
      data.messages.forEach(msg => {
        appendMessage(msg.content, msg.role);
      });
    }
  } catch (err) {
    console.error('채팅 기록을 불러오는 데 실패했습니다.', err);
  }
}

// 메시지를 렌더링하는 함수
function appendMessage(text, sender) {
  if (welcomeScreen.style.display !== 'none') {
    welcomeScreen.style.display = 'none';
    messagesEl.style.display = 'block';
  }

  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${sender}`;
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = text;
  
  msgDiv.appendChild(contentDiv);
  messagesEl.appendChild(msgDiv);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// 메시지 전송 핸들러
async function handleSend() {
  const text = inputEl.value.trim();
  if (!text) return;
  
  appendMessage(text, 'user');
  inputEl.value = '';
  
  // 로딩 인디케이터 (간단히 처리)
  const loadingId = 'loading-' + Date.now();
  const msgDiv = document.createElement('div');
  msgDiv.className = `message bot`;
  msgDiv.id = loadingId;
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';
  contentDiv.textContent = '온비서가 답변을 작성 중입니다...';
  msgDiv.appendChild(contentDiv);
  messagesEl.appendChild(msgDiv);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    // 백엔드로 전송
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    
    // 로딩 메시지 삭제
    document.getElementById(loadingId).remove();

    if (data.success) {
      appendMessage(data.reply, 'bot');
    } else {
      appendMessage('오류가 발생했습니다.', 'bot');
    }
  } catch (err) {
    console.error(err);
    document.getElementById(loadingId).remove();
    appendMessage('네트워크 오류가 발생했습니다.', 'bot');
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
  loadChatHistory();
});
