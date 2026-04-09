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

// 테이블 초기화 및 마이그레이션
async function initDb() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        email TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'PENDING',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(created_by) REFERENCES users(email)
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS room_members (
        room_id INTEGER,
        user_email TEXT,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (room_id, user_email),
        FOREIGN KEY(room_id) REFERENCES rooms(id),
        FOREIGN KEY(user_email) REFERENCES users(email)
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER NULL,
        sender_email TEXT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        is_pinned INTEGER DEFAULT 0,
        session_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(room_id) REFERENCES rooms(id)
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS harnesses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        is_visible INTEGER DEFAULT 1,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(created_by) REFERENCES users(email)
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS automations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        is_visible INTEGER DEFAULT 1,
        created_by TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(created_by) REFERENCES users(email)
      )
    `);
    
    // Seed initial admin if not exists
    try {
      await db.execute(`INSERT OR IGNORE INTO users (email, name, role) VALUES ('vip7612@gmail.com', 'Admin', 'ADMIN')`);
      await db.execute(`INSERT OR IGNORE INTO users (email, name, role) VALUES ('vip776@haemill.ms.kr', 'Haemill', 'APPROVED')`);
      await db.execute(`INSERT OR IGNORE INTO users (email, name, role) VALUES ('vip776@a4k.ai', 'A4K', 'APPROVED')`);
      
      const res1 = await db.execute(`SELECT id FROM rooms WHERE name = '그룹챗1'`);
      if (res1.rows.length === 0) {
        const roomRes = await db.execute(`INSERT INTO rooms (name, created_by) VALUES ('그룹챗1', 'vip7612@gmail.com') RETURNING id`);
        const roomId = roomRes.rows[0].id;
        await db.execute(`INSERT OR IGNORE INTO room_members (room_id, user_email) VALUES (?, ?)`, [roomId, 'vip7612@gmail.com']);
        await db.execute(`INSERT OR IGNORE INTO room_members (room_id, user_email) VALUES (?, ?)`, [roomId, 'vip776@haemill.ms.kr']);
        await db.execute(`INSERT OR IGNORE INTO room_members (room_id, user_email) VALUES (?, ?)`, [roomId, 'vip776@a4k.ai']);
      } else {
        const roomId = res1.rows[0].id;
        await db.execute(`INSERT OR IGNORE INTO room_members (room_id, user_email) VALUES (?, ?)`, [roomId, 'vip776@haemill.ms.kr']);
        await db.execute(`INSERT OR IGNORE INTO room_members (room_id, user_email) VALUES (?, ?)`, [roomId, 'vip776@a4k.ai']);
      }
      
      const res2 = await db.execute(`SELECT id FROM rooms WHERE name = '그룹챗2'`);
      if (res2.rows.length === 0) {
        const roomRes = await db.execute(`INSERT INTO rooms (name, created_by) VALUES ('그룹챗2', 'vip7612@gmail.com') RETURNING id`);
        const roomId = roomRes.rows[0].id;
        await db.execute(`INSERT OR IGNORE INTO room_members (room_id, user_email) VALUES (?, ?)`, [roomId, 'vip7612@gmail.com']);
        await db.execute(`INSERT OR IGNORE INTO room_members (room_id, user_email) VALUES (?, ?)`, [roomId, 'vip776@haemill.ms.kr']);
        await db.execute(`INSERT OR IGNORE INTO room_members (room_id, user_email) VALUES (?, ?)`, [roomId, 'vip776@a4k.ai']);
      } else {
        const roomId = res2.rows[0].id;
        await db.execute(`INSERT OR IGNORE INTO room_members (room_id, user_email) VALUES (?, ?)`, [roomId, 'vip776@haemill.ms.kr']);
        await db.execute(`INSERT OR IGNORE INTO room_members (room_id, user_email) VALUES (?, ?)`, [roomId, 'vip776@a4k.ai']);
      }
    } catch(e) { console.log('Seed skip:', e.message); }

    // 마이그레이션 속성들
    try { await db.execute('ALTER TABLE messages ADD COLUMN session_date TEXT'); } catch(e){}
    try { await db.execute({ sql: 'UPDATE messages SET session_date = ? WHERE session_date IS NULL', args: [getGlobalSessionDate()] }); } catch(e){}
    try { await db.execute('ALTER TABLE messages ADD COLUMN is_pinned INTEGER DEFAULT 0'); } catch(e){}
    try { await db.execute('ALTER TABLE messages ADD COLUMN room_id INTEGER NULL'); } catch(e){}
    try { await db.execute('ALTER TABLE messages ADD COLUMN sender_email TEXT NULL'); } catch(e){}

    console.log('[Turso DB] 모든 테이블 준비 및 마이그레이션 완료.');
  } catch (err) {
    console.error('[Turso DB] 테이블 초기화 실패:', err);
  }
}
initDb();

// 기존 대화 이력 가져오기 (room_id가 있으면 해당 룸 전체, 없으면 개인의 오늘 세션)
app.get('/api/chat', async (req, res) => {
  try {
    const roomId = req.query.room_id || null;
    const sessionDate = getGlobalSessionDate();
    let result;
    if (roomId) {
      result = await db.execute({
        sql: 'SELECT * FROM messages WHERE room_id = ? ORDER BY id ASC',
        args: [roomId]
      });
    } else {
      result = await db.execute({
        sql: 'SELECT * FROM messages WHERE session_date = ? AND room_id IS NULL ORDER BY id ASC',
        args: [sessionDate]
      });
    }
    res.json({ success: true, messages: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'DB 조회 실패' });
  }
});

// 새로운 대화 전송 및 응답
app.post('/api/chat', async (req, res) => {
  const { message, room_id } = req.body;
  
  if (!message) {
    return res.status(400).json({ success: false, error: '메시지가 없습니다.' });
  }

  try {
    const senderEmail = req.headers['user-email'] || null;
    
    // 사용자 메시지 저장
    await db.execute({
      sql: 'INSERT INTO messages (role, content, session_date, room_id, sender_email) VALUES (?, ?, ?, ?, ?)',
      args: ['user', message, getGlobalSessionDate(), room_id || null, senderEmail]
    });

    // 그룹챗이면 AI 봇 호출 없이 메시지만 저장하고 종료
    if (room_id) {
      return res.json({ success: true, isGroupChat: true });
    }

    // 1. 외부 에이전트(다른 맥미니의 안티그래비티) 연동
    if (process.env.ANTIGRAVITY_WEBHOOK_URL) {
      try {
        await fetch(process.env.ANTIGRAVITY_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, room_id })
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
      sql: 'INSERT INTO messages (role, content, session_date, room_id) VALUES (?, ?, ?, ?)',
      args: ['bot', botResponse, getGlobalSessionDate(), null]
    });

    res.json({ success: true, reply: botResponse });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: '메시지 처리 실패' });
  }
});

// 외부 에이전트(안티그래비티)가 대시보드로 데이터를 쏘는 웹훅 (인바운드)
app.post('/api/webhook/inbound', async (req, res) => {
  const { role, content, room_id } = req.body;
  if (!content) return res.status(400).json({ success: false, error: 'Missing content' });
  
  try {
    const senderRole = role || 'bot'; // 기본적으로 봇 발화로 처리
    await db.execute({
      sql: 'INSERT INTO messages (role, content, session_date, room_id) VALUES (?, ?, ?, ?)',
      args: [senderRole, content, getGlobalSessionDate(), room_id || null]
    });
    console.log(`[Webhook Inbound] ${senderRole}: ${content}`);
    res.json({ success: true, message: 'Saved successfully.' });
  } catch (err) {
    console.error('[Webhook Inbound Error]:', err);
    res.status(500).json({ success: false, error: '웹훅 저장 실패' });
  }
});

// 그룹챗으로 메시지 전달
app.post('/api/chat/forward', async (req, res) => {
  const { content, room_id } = req.body;
  if (!content || !room_id) return res.status(400).json({ success: false, error: '내용과 대상 방 ID가 필요합니다.' });
  
  try {
    await db.execute({
      sql: 'INSERT INTO messages (role, content, session_date, room_id) VALUES (?, ?, ?, ?)',
      args: ['bot', content, getGlobalSessionDate(), room_id]
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: '메시지 전달 실패' });
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

// Board 저장/해제 토글
app.put('/api/board/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const current = await db.execute({ sql: 'SELECT is_pinned FROM messages WHERE id = ?', args: [id] });
    if (current.rows.length === 0) return res.status(404).json({ success: false });
    
    const newVal = current.rows[0].is_pinned ? 0 : 1;
    await db.execute({ sql: 'UPDATE messages SET is_pinned = ? WHERE id = ?', args: [newVal, id] });
    res.json({ success: true, is_pinned: newVal });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'DB Error' });
  }
});

// Board 리스트 불러오기 (고정된 모든 답변)
app.get('/api/board', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM messages WHERE is_pinned = 1 ORDER BY id DESC');
    res.json({ success: true, messages: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: 'DB Error' });
  }
});

// =====================================
// [그룹 채팅 및 회원 관리] API
// =====================================

// 로그인 (사용자 등록)
app.post('/api/auth/login', async (req, res) => {
  const { email, name } = req.body;
  if(!email) return res.status(400).json({ error: 'Email required' });
  try {
    await db.execute({
      sql: `INSERT OR IGNORE INTO users (email, name, role) VALUES (?, ?, 'PENDING')`,
      args: [email, name || email.split('@')[0]]
    });
    const user = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
    res.json({ success: true, user: user.rows[0] });
  } catch(e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 소속된 단체 채팅룸 목록
app.get('/api/rooms', async (req, res) => {
  const email = req.headers['user-email'];
  if(!email) return res.status(401).json({ error: 'Auth required' });
  try {
    const result = await db.execute({
      sql: `SELECT r.id, r.name FROM rooms r JOIN room_members rm ON r.id = rm.room_id WHERE rm.user_email = ?`,
      args: [email]
    });
    res.json({ success: true, rooms: result.rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 어드민용: 모든 사용자 목록 (가입 승인 등)
app.get('/api/admin/users', async (req, res) => {
  const email = req.headers['user-email'];
  try {
    const caller = await db.execute({ sql: 'SELECT role FROM users WHERE email=?', args: [email] });
    if (!caller.rows.length || caller.rows[0].role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    const users = await db.execute('SELECT * FROM users ORDER BY created_at DESC');
    res.json({ success: true, users: users.rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 어드민용: 모든 방 목록 및 멤버 정보
app.get('/api/admin/rooms', async (req, res) => {
  const email = req.headers['user-email'];
  try {
    const caller = await db.execute({ sql: 'SELECT role FROM users WHERE email=?', args: [email] });
    if (!caller.rows.length || caller.rows[0].role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    const rooms = await db.execute('SELECT * FROM rooms');
    const members = await db.execute('SELECT * FROM room_members');
    res.json({ success: true, rooms: rooms.rows, members: members.rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/rooms', async (req, res) => {
  const email = req.headers['user-email'];
  const { name } = req.body;
  try {
    const caller = await db.execute({ sql: 'SELECT role FROM users WHERE email=?', args: [email] });
    if (!caller.rows.length || caller.rows[0].role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    await db.execute({ sql: 'INSERT INTO rooms (name, created_by) VALUES (?, ?)', args: [name, email] });
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/rooms/invite', async (req, res) => {
  const email = req.headers['user-email'];
  const { roomId, targetEmail } = req.body;
  try {
    const caller = await db.execute({ sql: 'SELECT role FROM users WHERE email=?', args: [email] });
    if (!caller.rows.length || caller.rows[0].role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    await db.execute({ sql: 'INSERT OR IGNORE INTO room_members (room_id, user_email) VALUES (?, ?)', args: [roomId, targetEmail] });
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/admin/rooms/remove', async (req, res) => {
  const email = req.headers['user-email'];
  const { roomId, targetEmail } = req.body;
  try {
    const caller = await db.execute({ sql: 'SELECT role FROM users WHERE email=?', args: [email] });
    if (!caller.rows.length || caller.rows[0].role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    await db.execute({ sql: 'DELETE FROM room_members WHERE room_id = ? AND user_email = ?', args: [roomId, targetEmail] });
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 어드민용: 회원 승인
app.post('/api/admin/users/approve', async (req, res) => {
  const email = req.headers['user-email'];
  const { targetEmail, role } = req.body;
  try {
    const caller = await db.execute({ sql: 'SELECT role FROM users WHERE email=?', args: [email] });
    if (!caller.rows.length || caller.rows[0].role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    await db.execute({ sql: 'UPDATE users SET role = ? WHERE email = ?', args: [role || 'APPROVED', targetEmail] });
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// =====================================
// [하네스 관리] API
// =====================================

// 노출된 하네스 목록 (채팅창 팝업용)
app.get('/api/harnesses', async (req, res) => {
  try {
    const result = await db.execute('SELECT id, title, content FROM harnesses WHERE is_visible = 1 ORDER BY id ASC');
    res.json({ success: true, harnesses: result.rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 전체 하네스 목록 (어드민 관리용)
app.get('/api/admin/harnesses', async (req, res) => {
  const email = req.headers['user-email'];
  try {
    const caller = await db.execute({ sql: 'SELECT role FROM users WHERE email=?', args: [email] });
    if (!caller.rows.length || caller.rows[0].role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    const result = await db.execute('SELECT * FROM harnesses ORDER BY id ASC');
    res.json({ success: true, harnesses: result.rows });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 하네스 생성
app.post('/api/admin/harnesses', async (req, res) => {
  const email = req.headers['user-email'];
  const { title, content } = req.body;
  try {
    const caller = await db.execute({ sql: 'SELECT role FROM users WHERE email=?', args: [email] });
    if (!caller.rows.length || caller.rows[0].role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    await db.execute({ sql: 'INSERT INTO harnesses (title, content, is_visible, created_by) VALUES (?, ?, 1, ?)', args: [title, content, email] });
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 하네스 수정
app.put('/api/admin/harnesses/:id', async (req, res) => {
  const email = req.headers['user-email'];
  const { id } = req.params;
  const { title, content, is_visible } = req.body;
  try {
    const caller = await db.execute({ sql: 'SELECT role FROM users WHERE email=?', args: [email] });
    if (!caller.rows.length || caller.rows[0].role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    await db.execute({ sql: 'UPDATE harnesses SET title=?, content=?, is_visible=? WHERE id=?', args: [title, content, is_visible ?? 1, id] });
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 하네스 삭제
app.delete('/api/admin/harnesses/:id', async (req, res) => {
  const email = req.headers['user-email'];
  const { id } = req.params;
  try {
    const caller = await db.execute({ sql: 'SELECT role FROM users WHERE email=?', args: [email] });
    if (!caller.rows.length || caller.rows[0].role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    await db.execute({ sql: 'DELETE FROM harnesses WHERE id=?', args: [id] });
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// Automations CRUD API
// ============================================

app.get('/api/admin/automations', async (req, res) => {
  const email = req.headers['user-email'];
  try {
    const caller = await db.execute({ sql: 'SELECT role FROM users WHERE email=?', args: [email] });
    if (!caller.rows.length || caller.rows[0].role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    const result = await db.execute('SELECT * FROM automations ORDER BY id DESC');
    res.json({ success: true, automations: result.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/automations', async (req, res) => {
  const email = req.headers['user-email'];
  const { title, content } = req.body;
  try {
    const caller = await db.execute({ sql: 'SELECT role FROM users WHERE email=?', args: [email] });
    if (!caller.rows.length || caller.rows[0].role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    await db.execute({
      sql: 'INSERT INTO automations (title, content, created_by) VALUES (?, ?, ?)',
      args: [title, content, email]
    });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/admin/automations/:id', async (req, res) => {
  const email = req.headers['user-email'];
  const { id } = req.params;
  const { title, content, is_visible } = req.body;
  try {
    const caller = await db.execute({ sql: 'SELECT role FROM users WHERE email=?', args: [email] });
    if (!caller.rows.length || caller.rows[0].role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    await db.execute({
      sql: 'UPDATE automations SET title = ?, content = ?, is_visible = ? WHERE id = ?',
      args: [title, content, is_visible, id]
    });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/admin/automations/:id', async (req, res) => {
  const email = req.headers['user-email'];
  try {
    const caller = await db.execute({ sql: 'SELECT role FROM users WHERE email=?', args: [email] });
    if (!caller.rows.length || caller.rows[0].role !== 'ADMIN') return res.status(403).json({ error: 'Forbidden' });
    await db.execute({ sql: 'DELETE FROM automations WHERE id=?', args: [req.params.id] });
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/automations', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM automations WHERE is_visible = 1 ORDER BY id DESC');
    res.json({ success: true, automations: result.rows });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`[서버] http://localhost:${PORT} 에서 실행 중...`);
  });
}

export default app;
