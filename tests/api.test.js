import { createClient } from '@libsql/client';
import assert from 'assert';

const db = createClient({ url: 'file:sandbox.db' });

// ==========================================
// 시뮬레이션: 백엔드 컨트롤러 함수 (api/index.js 에 구현될 로직)
// ==========================================

async function getMyRooms(email) {
  const result = await db.execute({
    sql: `SELECT r.id, r.name, rm.joined_at 
          FROM rooms r 
          JOIN room_members rm ON r.id = rm.room_id 
          WHERE rm.user_email = ?`,
    args: [email]
  });
  return result.rows;
}

async function approveUser(callerEmail, targetEmail) {
  // 1. Check Caller is Admin
  const caller = await db.execute({
    sql: 'SELECT role FROM users WHERE email = ?',
    args: [callerEmail]
  });
  if (!caller.rows.length || caller.rows[0].role !== 'ADMIN') {
    throw new Error('Forbidden: Admins only');
  }

  // 2. Approve
  await db.execute({
    sql: 'UPDATE users SET role = "APPROVED" WHERE email = ?',
    args: [targetEmail]
  });
  return { success: true };
}

async function inviteToRoom(callerEmail, roomId, targetEmail) {
  // 1. Check Caller is Admin
  const caller = await db.execute({
    sql: 'SELECT role FROM users WHERE email = ?',
    args: [callerEmail]
  });
  if (!caller.rows.length || caller.rows[0].role !== 'ADMIN') {
    throw new Error('Forbidden: Admins only');
  }

  // 2. Add Member
  try {
    await db.execute({
      sql: 'INSERT INTO room_members (room_id, user_email) VALUES (?, ?)',
      args: [roomId, targetEmail]
    });
  } catch (e) {
    if (e.message.includes('UNIQUE') || e.message.includes('constraint')) {
      throw new Error('Already a member or invalid room');
    }
    throw e;
  }
  return { success: true };
}

// ==========================================
// 자가 진단 테스트 파이프라인 (Test Driven)
// ==========================================

async function runTests() {
  console.log('[TEST] 배포 전 코어 로직 단위 테스트 시작\\n');

  try {
    // ----------------------------------------------------
    // Test 1: getMyRooms - 사무국 멤버십 확인
    // ----------------------------------------------------
    console.log('-> Test 1: getMyRooms() 로직 검증');
    const haemillRooms = await getMyRooms('vip776@haemill.ms.kr');
    assert.strictEqual(haemillRooms.length, 1, 'haemill.ms.kr은 사무국 방에 속해야 함');
    assert.strictEqual(haemillRooms[0].name, '사무국', '방 이름 오류');

    const a4kRooms = await getMyRooms('vip776@a4k.ai');
    assert.strictEqual(a4kRooms.length, 0, 'a4k.ai는 아직 방이 없어야 함');
    console.log('   ✅ PASS');

    // ----------------------------------------------------
    // Test 2: approveUser - 어드민 권한 방어 로직 검증
    // ----------------------------------------------------
    console.log('-> Test 2: 관리자가 아닌 계정으로 승인 시도 (보안 모의 침투)');
    try {
      await approveUser('vip776@haemill.ms.kr', 'somebody@gmail.com');
      assert.fail('에러가 발생하지 않음');
    } catch (e) {
      assert.match(e.message, /Forbidden/, '권한 에러가 아닌 다른 에러 발생');
      console.log('   ✅ PASS (정상적으로 차단됨)');
    }

    // ----------------------------------------------------
    // Test 3: inviteToRoom - 어드민 초대 기능 검증
    // ----------------------------------------------------
    console.log('-> Test 3: 어드민이 a4k.ai 계정을 사무국에 초대');
    const adminRooms = await getMyRooms('vip7612@gmail.com');
    const targetRoomId = adminRooms[0].id;
    
    await inviteToRoom('vip7612@gmail.com', targetRoomId, 'vip776@a4k.ai');
    
    const newA4kRooms = await getMyRooms('vip776@a4k.ai');
    assert.strictEqual(newA4kRooms.length, 1, 'a4k.ai 초대가 반영되어야 함');
    assert.strictEqual(newA4kRooms[0].name, '사무국');
    console.log('   ✅ PASS');

    console.log('\\n🎉 [TEST COMPLETE] 모든 백엔드 코어 로직이 Sandbox에서 완벽히 통과했습니다!');
    
  } catch (err) {
    console.error('\\n❌ [TEST FAILED]', err.message);
    process.exit(1);
  }
}

runTests();
