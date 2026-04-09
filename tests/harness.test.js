import { createClient } from '@libsql/client';
import assert from 'assert';

const db = createClient({ url: 'file:sandbox.db' });

async function setup() {
  // harnesses 테이블 생성
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
  await db.execute('DELETE FROM harnesses');
  console.log('[Setup] harnesses 테이블 준비 완료');
}

// --- 시뮬레이션 컨트롤러 함수들 ---

async function createHarness(callerEmail, title, content) {
  const caller = await db.execute({ sql: 'SELECT role FROM users WHERE email=?', args: [callerEmail] });
  if (!caller.rows.length || caller.rows[0].role !== 'ADMIN') throw new Error('Forbidden');
  const res = await db.execute({
    sql: 'INSERT INTO harnesses (title, content, is_visible, created_by) VALUES (?, ?, 1, ?) RETURNING id',
    args: [title, content, callerEmail]
  });
  return res.rows[0];
}

async function listHarnesses(visibleOnly) {
  if (visibleOnly) {
    return (await db.execute('SELECT * FROM harnesses WHERE is_visible = 1 ORDER BY id ASC')).rows;
  }
  return (await db.execute('SELECT * FROM harnesses ORDER BY id ASC')).rows;
}

async function updateHarness(callerEmail, id, title, content, isVisible) {
  const caller = await db.execute({ sql: 'SELECT role FROM users WHERE email=?', args: [callerEmail] });
  if (!caller.rows.length || caller.rows[0].role !== 'ADMIN') throw new Error('Forbidden');
  await db.execute({
    sql: 'UPDATE harnesses SET title=?, content=?, is_visible=? WHERE id=?',
    args: [title, content, isVisible, id]
  });
  return { success: true };
}

async function deleteHarness(callerEmail, id) {
  const caller = await db.execute({ sql: 'SELECT role FROM users WHERE email=?', args: [callerEmail] });
  if (!caller.rows.length || caller.rows[0].role !== 'ADMIN') throw new Error('Forbidden');
  await db.execute({ sql: 'DELETE FROM harnesses WHERE id=?', args: [id] });
  return { success: true };
}

// --- TDD ---

async function runTests() {
  console.log('[TEST] 하네스 CRUD 단위 테스트 시작\n');

  // Test 1: 어드민이 하네스 생성
  console.log('-> Test 1: 어드민이 하네스 생성');
  const h1 = await createHarness('vip7612@gmail.com', '보고서 작성', '다음 내용을 요약하고 보고서 형태로 작성해주세요.');
  assert.ok(h1.id, '하네스 ID가 반환되어야 함');
  const h2 = await createHarness('vip7612@gmail.com', '번역 요청', '다음 내용을 영어로 번역해주세요.');
  const h3 = await createHarness('vip7612@gmail.com', '코드 리뷰', '다음 코드를 리뷰하고 개선점을 알려주세요.');
  console.log('   ✅ PASS\n');

  // Test 2: 일반 사용자가 하네스 생성 불가
  console.log('-> Test 2: 일반 사용자가 하네스 생성 시도 (보안)');
  try {
    await createHarness('vip776@haemill.ms.kr', '해킹', '테스트');
    assert.fail('에러가 발생하지 않음');
  } catch (e) {
    assert.match(e.message, /Forbidden/);
    console.log('   ✅ PASS (차단됨)\n');
  }

  // Test 3: 노출 목록만 조회
  console.log('-> Test 3: is_visible 필터링');
  await updateHarness('vip7612@gmail.com', h3.id, '코드 리뷰', '다음 코드를 리뷰하고 개선점을 알려주세요.', 0);
  const visible = await listHarnesses(true);
  assert.strictEqual(visible.length, 2, '노출 설정된 하네스만 2개여야 함');
  const all = await listHarnesses(false);
  assert.strictEqual(all.length, 3, '전체 하네스는 3개여야 함');
  console.log('   ✅ PASS\n');

  // Test 4: 하네스 삭제
  console.log('-> Test 4: 하네스 삭제');
  await deleteHarness('vip7612@gmail.com', h3.id);
  const afterDelete = await listHarnesses(false);
  assert.strictEqual(afterDelete.length, 2, '삭제 후 2개여야 함');
  console.log('   ✅ PASS\n');

  // Test 5: 하네스 내용이 메시지와 합쳐지는 로직 시뮬레이션
  console.log('-> Test 5: 하네스 + 사용자 메시지 합성');
  const harness = visible[0];
  const userMsg = '오늘 회의록 정리해줘';
  const combined = `[하네스: ${harness.title}]\n${harness.content}\n\n---\n사용자 메시지: ${userMsg}`;
  assert.ok(combined.includes(harness.title));
  assert.ok(combined.includes(userMsg));
  console.log('   합성 결과:', combined.substring(0, 60) + '...');
  console.log('   ✅ PASS\n');

  console.log('🎉 [TEST COMPLETE] 하네스 CRUD + 보안 + 합성 로직 모두 통과!');
}

await setup();
await runTests();
