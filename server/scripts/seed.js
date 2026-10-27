const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from server root .env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const { User, Room, Question, VoteLog } = require('../models');

const MONGO_URI = process.env.MONGO_URI || process.env.dbURL || 'mongodb://127.0.0.1:27017/quickpoll_live';

const seedDatabase = async () => {
  try {
    console.log('--------------------------------------------------');
    console.log('[Seed Engine] Connecting to database...');
    console.log(`[Seed Engine] Target URI: ${MONGO_URI}`);
    await mongoose.connect(MONGO_URI);
    console.log('[Seed Engine] Successfully connected.');

    // Step 1: Wipe all existing collections
    console.log('\n[Seed Engine] Wiping existing data...');
    await Promise.all([
      User.deleteMany({}),
      Room.deleteMany({}),
      Question.deleteMany({}),
      VoteLog.deleteMany({}),
    ]);
    console.log('✓ Collections purged: users, rooms, questions, votelogs');

    // Step 2: Seed Demo Presenter User
    console.log('\n[Seed Engine] Seeding Demo Presenter User...');
    const demoUser = await User.create({
      name: 'Professor Alan Turing',
      email: 'teacher@college.edu',
      password: 'password123', // Automatically hashed by User model pre-save hook
    });
    console.log(`✓ Presenter Created: ${demoUser.name} (${demoUser.email}) [ID: ${demoUser._id}]`);

    // Step 3: Seed Demo Active Room
    console.log('\n[Seed Engine] Seeding Demo Room (PIN: 4892)...');
    const demoRoom = await Room.create({
      pin: '4892',
      presenterId: demoUser._id,
      title: 'System Design & Distributed Systems Pop Quiz',
      status: 'active',
      activeQuestionId: null, // Will update after questions are seeded
    });
    console.log(`✓ Room Created: "${demoRoom.title}" [PIN: ${demoRoom.pin}]`);

    // Step 4: Seed 3 High-Yield Distributed Systems Questions
    console.log('\n[Seed Engine] Seeding Pop Quiz Questions...');
    const questionsData = [
      {
        roomId: demoRoom._id,
        order: 1,
        text: 'Which index best optimizes geo coordinates queries in MongoDB?',
        options: [
          { id: 'opt_geo_1', text: '2dsphere Index', voteCount: 0 },
          { id: 'opt_geo_2', text: 'B-Tree Standard Index', voteCount: 0 },
          { id: 'opt_geo_3', text: 'Hash Index', voteCount: 0 },
          { id: 'opt_geo_4', text: 'Compound Text Index', voteCount: 0 },
        ],
        isLocked: false,
      },
      {
        roomId: demoRoom._id,
        order: 2,
        text: 'Which protocol fits bi-directional real-time streaming with lowest connection overhead?',
        options: [
          { id: 'opt_proto_1', text: 'WebSocket', voteCount: 0 },
          { id: 'opt_proto_2', text: 'HTTP Long-Polling', voteCount: 0 },
          { id: 'opt_proto_3', text: 'Server-Sent Events (SSE)', voteCount: 0 },
          { id: 'opt_proto_4', text: 'Periodic Short Polling', voteCount: 0 },
        ],
        isLocked: false,
      },
      {
        roomId: demoRoom._id,
        order: 3,
        text: 'In the CAP theorem, what does Partition Tolerance guarantee?',
        options: [
          { id: 'opt_cap_1', text: 'System continues operating despite arbitrary message loss/network splits', voteCount: 0 },
          { id: 'opt_cap_2', text: 'Every read is guaranteed to return the latest write', voteCount: 0 },
          { id: 'opt_cap_3', text: 'Zero read latency across geo-replicated replica sets', voteCount: 0 },
          { id: 'opt_cap_4', text: 'Data schema updates are atomic across all nodes', voteCount: 0 },
        ],
        isLocked: false,
      },
    ];

    const createdQuestions = await Question.insertMany(questionsData);
    createdQuestions.forEach((q) => {
      console.log(`  ✓ Question #${q.order}: "${q.text.substring(0, 50)}..." (${q.options.length} options)`);
    });

    // Step 5: Link First Question as the Active Question in Room
    demoRoom.activeQuestionId = createdQuestions[0]._id;
    await demoRoom.save();
    console.log(`✓ Active Question Set to Question #1 [ID: ${createdQuestions[0]._id}]`);

    console.log('\n==================================================');
    console.log('🚀 SEEDING COMPLETED SUCCESSFULLY');
    console.log('==================================================');
    console.log('Presenter Credentials:');
    console.log('  • Email:    teacher@college.edu');
    console.log('  • Password: password123');
    console.log('Live Room:');
    console.log('  • Title:    "System Design & Distributed Systems Pop Quiz"');
    console.log('  • PIN:      4892');
    console.log('  • Status:   active');
    console.log('  • Questions: 3 seeded');
    console.log('--------------------------------------------------\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ [Seed Engine Error] Seeding failed:', error);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
};

seedDatabase();

