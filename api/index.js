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

// 테이블 초기화 (테스트 하네스 규칙 준수)
async function initDb() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('[Turso DB] messages 테이블 준비 완료.');
  } catch (err) {
    console.error('[Turso DB] 테이블 초기화 실패:', err);
  }
}
initDb();

// 기존 대화 이력 가져오기
app.get('/api/chat', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM messages ORDER BY id ASC');
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
      sql: 'INSERT INTO messages (role, content) VALUES (?, ?)',
      args: ['user', message]
    });

    // 온비서 AI (Gemini 3.1 Pro / 2.5 Flash) 연동 로직
    let botResponse = '';
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'DUMMY_KEY') {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `당신의 이름은 '온비서(Agent On)'이며, 친절하고 다재다능한 AI 비서입니다. 사용자 메시지에 자연스럽게 답변해주세요.\n사용자 메시지: ${message}`
        });
        botResponse = response.text;
      } catch (apiErr) {
        console.error('[Gemini API Error]:', apiErr.message);
        botResponse = `온비서 API 연결 중 오류가 발생했습니다. (${apiErr.message})`;
      }
    } else {
      botResponse = `[온비서] 정상적으로 연결되었습니다. 실제 답변을 위해 .env 에 GEMINI_API_KEY 를 입력해주세요. (입력한 내용: ${message})`;
    }
    
    // AI 응답 저장
    await db.execute({
      sql: 'INSERT INTO messages (role, content) VALUES (?, ?)',
      args: ['bot', botResponse]
    });

    // 3. 외부 에이전트(안티그래비티)로 메시지 전달 (웹훅 아웃바운드)
    if (process.env.ANTIGRAVITY_WEBHOOK_URL) {
      try {
        await fetch(process.env.ANTIGRAVITY_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });
      } catch (err) {
        console.error('[Webhook Outbound Error]:', err.message);
      }
    }

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
      sql: 'INSERT INTO messages (role, content) VALUES (?, ?)',
      args: [senderRole, content]
    });
    console.log(`[Webhook Inbound] ${senderRole}: ${content}`);
    res.json({ success: true, message: 'Saved successfully.' });
  } catch (err) {
    console.error('[Webhook Inbound Error]:', err);
    res.status(500).json({ success: false, error: '웹훅 저장 실패' });
  }
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`[서버] http://localhost:${PORT} 에서 실행 중...`);
  });
}

export default app;
