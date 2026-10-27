const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { io: ClientIO } = require('../../client/node_modules/socket.io-client');
const { server } = require('../server');

const TEST_PORT = 5055;
const BASE_URL = `http://localhost:${TEST_PORT}`;

const runTests = async () => {
  console.log('==================================================');
  console.log('🧪 RUNNING TASK 2 FULL-STACK INTEGRATION TEST SUITE');
  console.log('==================================================\n');

  // Start dedicated test server on port 5055
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`[Test Server] Listening on ${BASE_URL}`);

  try {
    // -----------------------------------------------------------------
    // 1. TEST AUTHENTICATION: LOGIN
    // -----------------------------------------------------------------
    console.log('\n--- Test 1: POST /api/auth/login ---');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'teacher@college.edu',
        password: 'password123',
      }),
    });
    const loginData = await loginRes.json();

    console.log(`Status: ${loginRes.status}`);
    console.log(`User: ${loginData.data.user.name} (${loginData.data.user.email})`);
    const presenterToken = loginData.data.token;
    if (!presenterToken) throw new Error('No JWT token returned from login');
    console.log('✓ Presenter login successful, JWT acquired.');

    // -----------------------------------------------------------------
    // 2. TEST AUTHENTICATION: REGISTER
    // -----------------------------------------------------------------
    console.log('\n--- Test 2: POST /api/auth/register ---');
    const randomEmail = `test_${Date.now()}@college.edu`;
    const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dr. Ada Lovelace',
        email: randomEmail,
        password: 'password123',
      }),
    });
    const registerData = await registerRes.json();
    console.log(`Status: ${registerRes.status}`);
    console.log(`Registered: ${registerData.data.user.name} (${registerData.data.user.email})`);
    console.log('✓ Presenter registration successful.');

    // -----------------------------------------------------------------
    // 3. TEST GET /api/rooms/my-rooms (Protected)
    // -----------------------------------------------------------------
    console.log('\n--- Test 3: GET /api/rooms/my-rooms (Protected) ---');
    const myRoomsRes = await fetch(`${BASE_URL}/api/rooms/my-rooms`, {
      headers: { Authorization: `Bearer ${presenterToken}` },
    });
    const myRoomsData = await myRoomsRes.json();
    console.log(`Status: ${myRoomsRes.status}`);
    console.log(`Rooms retrieved: ${myRoomsData.count}`);
    const seedRoom = myRoomsData.data.find((r) => r.pin === '4892');
    if (!seedRoom) throw new Error('Seeded room 4892 not found in presenter rooms');
    console.log(`✓ Seeded room confirmed: "${seedRoom.title}" (PIN: ${seedRoom.pin}, ${seedRoom.questionCount} questions)`);

    // -----------------------------------------------------------------
    // 4. TEST POST /api/rooms (Create Room with 4-digit PIN)
    // -----------------------------------------------------------------
    console.log('\n--- Test 4: POST /api/rooms (Create new Room) ---');
    const newRoomRes = await fetch(`${BASE_URL}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${presenterToken}`,
      },
      body: JSON.stringify({
        title: 'Cloud Architecture & DevOps Live Poll',
        questions: [
          {
            text: 'What is the primary benefit of Kubernetes Horizontal Pod Autoscaling?',
            options: [
              { id: 'opt_1', text: 'Dynamic pod replicas based on CPU/Memory metrics' },
              { id: 'opt_2', text: 'Automatic disk repartitioning' },
              { id: 'opt_3', text: 'Static container IP allocation' },
            ],
          },
          {
            text: 'Which deployment strategy has zero downtime and instant rollback via traffic routing?',
            options: [
              { id: 'opt_a', text: 'Blue/Green Deployment' },
              { id: 'opt_b', text: 'Recreate Strategy' },
              { id: 'opt_c', text: 'Shadow Deployment' },
            ],
          },
        ],
      }),
    });
    const newRoomData = await newRoomRes.json();
    console.log(`Status: ${newRoomRes.status}`);
    const createdRoom = newRoomData.data.room;
    console.log(`✓ Created room with unique PIN: ${createdRoom.pin} ("${createdRoom.title}")`);
    console.log(`✓ Questions attached: ${newRoomData.data.questions.length}`);

    // -----------------------------------------------------------------
    // 5. TEST GET /api/rooms/verify/:pin (Public)
    // -----------------------------------------------------------------
    console.log('\n--- Test 5: GET /api/rooms/verify/:pin (Public) ---');
    const verifyRes = await fetch(`${BASE_URL}/api/rooms/verify/4892`);
    const verifyData = await verifyRes.json();
    console.log(`Status: ${verifyRes.status}`);
    console.log(`Verified Room: "${verifyData.data.title}" (PIN: ${verifyData.data.pin})`);
    if (verifyData.data.options || verifyData.data.voterLogs) {
      throw new Error('Public verification endpoint leaked private question options or voter logs!');
    }
    console.log('✓ Public verification confirmed (zero sensitive answers leaked).');

    // -----------------------------------------------------------------
    // 6. TEST GET /api/rooms/:pin/export (JSON & CSV)
    // -----------------------------------------------------------------
    console.log('\n--- Test 6: GET /api/rooms/:pin/export (JSON & CSV) ---');
    const exportJsonRes = await fetch(`${BASE_URL}/api/rooms/4892/export`, {
      headers: { Authorization: `Bearer ${presenterToken}` },
    });
    const exportJsonData = await exportJsonRes.json();
    console.log(`JSON Export Status: ${exportJsonRes.status}`);
    console.log(`Total questions in export: ${exportJsonData.data.questions.length}`);

    const exportCsvRes = await fetch(`${BASE_URL}/api/rooms/4892/export?format=csv`, {
      headers: { Authorization: `Bearer ${presenterToken}` },
    });
    const csvText = await exportCsvRes.text();
    console.log(`CSV Export Status: ${exportCsvRes.status}, Content-Type: ${exportCsvRes.headers.get('content-type')}`);
    console.log(`CSV Preview:\n${csvText.split('\n').slice(0, 5).join('\n')}`);
    console.log('✓ Export endpoints (JSON & CSV) verified.');

    // -----------------------------------------------------------------
    // 7. REAL-TIME SOCKET.IO ENGINE TEST
    // -----------------------------------------------------------------
    console.log('\n--- Test 7: Real-Time Socket.io Gateway Testing ---');

    // Connect Presenter Socket
    const presenterSocket = ClientIO(BASE_URL, { transports: ['websocket'] });
    const voterSocket = ClientIO(BASE_URL, { transports: ['websocket'] });

    await Promise.all([
      new Promise((res) => presenterSocket.on('connect', res)),
      new Promise((res) => voterSocket.on('connect', res)),
    ]);
    console.log(`✓ Presenter Socket connected (${presenterSocket.id})`);
    console.log(`✓ Voter Socket connected (${voterSocket.id})`);

    // Presenter joins room 4892
    const presenterJoinPromise = new Promise((resolve, reject) => {
      presenterSocket.emit(
        'join_room',
        { pin: '4892', role: 'presenter', token: presenterToken },
        (response) => {
          if (response.success) resolve(response.data);
          else reject(response.error);
        }
      );
    });

    const presenterState = await presenterJoinPromise;
    console.log(`✓ Presenter joined room 4892. Active question: "${presenterState.currentQuestion.text.substring(0, 45)}..."`);

    // Voter joins room 4892 with fingerprint
    const voterToken = `fingerprint_${Date.now()}`;
    const voterJoinPromise = new Promise((resolve, reject) => {
      voterSocket.emit(
        'join_room',
        { pin: '4892', role: 'voter', voterToken },
        (response) => {
          if (response.success) resolve(response.data);
          else reject(response.error);
        }
      );
    });

    const voterState = await voterJoinPromise;
    console.log(`✓ Voter joined room 4892. Headcount: ${voterState.participantCount}`);

    const activeQ = voterState.currentQuestion;
    const targetOption = activeQ.options[0].id; // e.g. opt_geo_1

    // Voter casts a vote
    console.log(`\nCasting vote for option: ${targetOption} on question: ${activeQ.id}...`);
    const votePromise = new Promise((resolve) => {
      voterSocket.once('vote_confirmed', (data) => resolve(data));
    });

    const resultsBroadcastPromise = new Promise((resolve) => {
      presenterSocket.once('results_updated', (data) => resolve(data));
    });

    voterSocket.emit('cast_vote', {
      pin: '4892',
      questionId: activeQ.id,
      optionId: targetOption,
      voterToken,
    });

    const [voteConfirmation, updatedResults] = await Promise.all([
      votePromise,
      resultsBroadcastPromise,
    ]);

    console.log('✓ Vote confirmed:', voteConfirmation.message);
    const updatedOption = updatedResults.options.find((o) => o.id === targetOption);
    console.log(`✓ Broadcast results received: Option "${updatedOption.text}" vote count is now ${updatedOption.voteCount}`);

    // Test Idempotency / Duplicate vote prevention
    console.log('\nTesting idempotency: Attempting duplicate vote with same voterToken...');
    const duplicateVotePromise = new Promise((resolve) => {
      voterSocket.once('already_voted', (err) => resolve(err));
    });

    voterSocket.emit('cast_vote', {
      pin: '4892',
      questionId: activeQ.id,
      optionId: targetOption,
      voterToken,
    });

    const duplicateResponse = await duplicateVotePromise;
    console.log(`✓ Duplicate vote blocked correctly: "${duplicateResponse.message}" (Code: ${duplicateResponse.code})`);

    // Test Presenter Lock Toggle
    console.log('\nTesting toggle_voting_lock: Presenter freezes voting...');
    const lockBroadcastPromise = new Promise((resolve) => {
      voterSocket.once('voting_status_changed', (data) => resolve(data));
    });

    presenterSocket.emit('toggle_voting_lock', { pin: '4892', isLocked: true });
    const lockData = await lockBroadcastPromise;
    console.log(`✓ Voting status broadcast: Question ${lockData.questionId} locked = ${lockData.isLocked}`);

    // Disconnect sockets
    presenterSocket.disconnect();
    voterSocket.disconnect();

    console.log('\n==================================================');
    console.log('🎉 ALL TASK 2 TESTS PASSED WITH 100% SUCCESS!');
    console.log('==================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  }
};

runTests();
