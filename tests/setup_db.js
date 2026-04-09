import { createClient } from '@libsql/client';

const db = createClient({
  url: 'file:sandbox.db',
});

async function main() {
  console.log('[Sandbox] Initializing Database Schema...');

  // 1. Users Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'PENDING', -- 'ADMIN', 'APPROVED', 'PENDING'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Rooms Table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(created_by) REFERENCES users(email)
    )
  `);

  // 3. Room Members Table
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

  // 4. Messages Table Expansion (Simulation)
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

  console.log('[Sandbox] Schema successfully created.');

  // CLEAR DATA FOR TEST IDEMPOTENCY
  await db.execute(`DELETE FROM room_members`);
  await db.execute(`DELETE FROM messages`);
  await db.execute(`DELETE FROM rooms`);
  await db.execute(`DELETE FROM users`);

  // Insert Seed Data
  console.log('[Sandbox] Seeding initial data...');
  
  // -- users
  await db.execute(`INSERT INTO users (email, name, role) VALUES ('vip7612@gmail.com', 'Admin User', 'ADMIN')`);
  await db.execute(`INSERT INTO users (email, name, role) VALUES ('vip776@haemill.ms.kr', 'Haemill User', 'APPROVED')`);
  await db.execute(`INSERT INTO users (email, name, role) VALUES ('vip776@a4k.ai', 'A4K User', 'APPROVED')`);
  
  // -- rooms
  const roomRes = await db.execute(`INSERT INTO rooms (name, created_by) VALUES ('사무국', 'vip7612@gmail.com') RETURNING id`);
  const roomId = roomRes.rows[0].id;

  // -- room members
  await db.execute({
    sql: `INSERT INTO room_members (room_id, user_email) VALUES (?, ?)`,
    args: [roomId, 'vip7612@gmail.com']
  });
  await db.execute({
    sql: `INSERT INTO room_members (room_id, user_email) VALUES (?, ?)`,
    args: [roomId, 'vip776@haemill.ms.kr']
  });

  console.log('[Sandbox] Seed successfully applied.');

  // Validate State
  const users = await db.execute('SELECT * FROM users');
  console.log('\\n[TEST] => Current Users:');
  console.table(users.rows);

  const rooms = await db.execute('SELECT * FROM rooms');
  console.log('\\n[TEST] => Rooms:');
  console.table(rooms.rows);

  const members = await db.execute({
    sql: 'SELECT r.name, rm.user_email FROM room_members rm JOIN rooms r ON rm.room_id = r.id'
  });
  console.log('\\n[TEST] => Room Memberships:');
  console.table(members.rows);
}

main().catch(console.error);
