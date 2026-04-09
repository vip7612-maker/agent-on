import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

// Gemini API 클라이언트 설정
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'DUMMY_KEY' });

const app = express();
app.use(cors());
app.use(express.json());

// Turso DB 클라이언트 설정
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// 5:00 AM (KST) 기준으로 세션 날짜를 계산하는 함수
function getGlobalSessionDate() {
  const date = new Date(new Date().getTime() + (9 - 5) * 60 * 60 * 1000);
  return date.toISOString().split('T')[0];
}

// 테이블 초기화
async function initDb() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        session_date TEXT
      )
    `);
    
    // session_date 마이그레이션 (기존 데이터 호환)
    try {
      await db.execute('ALTER TABLE messages ADD COLUMN session_date TEXT');
      await db.execute({
        sql: 'UPDATE messages SET session_date = ? WHERE session_date IS NULL',
        args: [getGlobalSessionDate()]
      });
    } catch(e) {} // 이미 존재하면 조용히 넘어감
    
    console.log('[Turso DB] messages 테이블 준비 완료.');
  } catch (err) {
    console.error('[Turso DB] 테이블 초기화 실패:', err);
  }
}
initDb();

// 기존 대화 이력 가져오기 (오직 오늘 세션만)
app.get('/api/chat', async (req, res) => {
  try {
    const sessionDate = getGlobalSessionDate();
    const result = await db.execute({
      sql: 'SELECT * FROM messages WHERE session_date = ? ORDER BY id ASC',
      args: [sessionDate]
    });
    res.json({ success: true, messages: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'DB 조회 실패' });
  }
});

// 새로운 대화 전송 및 응답
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({ success: false, error: '메시지가 없습니다.' });
  }

  try {
    // 사용자 메시지 저장
    await db.execute({
      sql: 'INSERT INTO messages (role, content, session_date) VALUES (?, ?, ?)',
      args: ['user', message, getGlobalSessionDate()]
    });

    // 1. 외부 에이전트(다른 맥미니의 안티그래비티) 연동
    if (process.env.ANTIGRAVITY_WEBHOOK_URL) {
      try {
        await fetch(process.env.ANTIGRAVITY_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });
        // 전송에 성공하면 백엔드 로직 종료 (결과는 나중에 안티그래비티가 웹훅으로 회신)
        return res.json({ success: true, forwarded: true });
      } catch (err) {
        console.error('[Webhook Outbound Error]:', err.message);
        // 실패 시 Gemini 로 폴백 처리
      }
    }

    // 2. Agent ONAi (Gemini) 연동 로직 (안티그래비티가 오프라인이거나 미설정일 때)
    let botResponse = '';
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'DUMMY_KEY') {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `당신의 이름은 'Agent ONAi'이며, 친절하고 다재다능한 AI 비서입니다. 사용자 메시지: ${message}`
        });
        botResponse = response.text;
      } catch (apiErr) {
        console.error('[Gemini API Error]:', apiErr.message);
        botResponse = `Agent ONAi API 연결 중 오류가 발생했습니다. (${apiErr.message})`;
      }
    } else {
      botResponse = `[Agent ONAi] 알림: 다른 맥미니의 안티그래비티 연동 URL(.env 의 ANTIGRAVITY_WEBHOOK_URL) 이 없습니다. 연결을 확인해 주세요. (메시지: ${message})`;
    }
    
    // AI 응답 저장
    await db.execute({
      sql: 'INSERT INTO messages (role, content, session_date) VALUES (?, ?, ?)',
      args: ['bot', botResponse, getGlobalSessionDate()]
    });

    res.json({ success: true, reply: botResponse });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: '메시지 처리 실패' });
  }
});

// 외부 에이전트(안티그래비티)가 대시보드로 데이터를 쏘는 웹훅 (인바운드)
app.post('/api/webhook/inbound', async (req, res) => {
  const { role, content } = req.body;
  if (!content) return res.status(400).json({ success: false, error: 'Missing content' });
  
  try {
    const senderRole = role || 'bot'; // 기본적으로 봇 발화로 처리
    await db.execute({
      sql: 'INSERT INTO messages (role, content, session_date) VALUES (?, ?, ?)',
      args: [senderRole, content, getGlobalSessionDate()]
    });
    console.log(`[Webhook Inbound] ${senderRole}: ${content}`);
    res.json({ success: true, message: 'Saved successfully.' });
  } catch (err) {
    console.error('[Webhook Inbound Error]:', err);
    res.status(500).json({ success: false, error: '웹훅 저장 실패' });
  }
});

// 과거 세션 리스트 불러오기 (History)
app.get('/api/history', async (req, res) => {
  try {
    const todaySession = getGlobalSessionDate();
    const result = await db.execute({
      sql: `
        SELECT session_date, 
               MAX(created_at) as last_created,
               (SELECT content FROM messages m2 WHERE m2.session_date = m1.session_date AND m2.role = 'user' ORDER BY id ASC LIMIT 1) as preview_content,
               COUNT(*) as msg_count
        FROM messages m1
        WHERE session_date != ?
        GROUP BY session_date
        ORDER BY session_date DESC
      `,
      args: [todaySession]
    });
    res.json({ success: true, history: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'History Fetch Error' });
  }
});

// 특정 과거 세션 내용 불러오기
app.get('/api/history/:session_date', async (req, res) => {
  try {
    const { session_date } = req.params;
    const result = await db.execute({
      sql: 'SELECT * FROM messages WHERE session_date = ? ORDER BY id ASC',
      args: [session_date]
    });
    res.json({ success: true, messages: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'Session Fetch Error' });
  }
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`[서버] http://localhost:${PORT} 에서 실행 중...`);
  });
}

export default app;
