/**
 * Prisma Seed Script - PartyQuiz Platform
 * 
 * Creates comprehensive demo data including:
 * - 3 demo users (OWNER, ADMIN, EDITOR)
 * - 1 demo workspace
 * - 12 example questions (all main types)
 * - 3 complete quizzes
 * - 1 active demo session
 * 
 * Run with: pnpm prisma db seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding PartyQuiz Platform...\n');

  // Clean existing data
  console.log('🧹 Cleaning database...');
  await prisma.liveAnswer.deleteMany();
  await prisma.livePlayer.deleteMany();
  await prisma.liveSession.deleteMany();
  await prisma.quizItem.deleteMany();
  await prisma.quizRound.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.questionMedia.deleteMany();
  await prisma.questionOption.deleteMany();
  await prisma.question.deleteMany();
  await prisma.workspaceMember.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();

  // Create users
  console.log('👤 Creating users...');
  
  const admin = await prisma.user.create({
    data: {
      email: 'admin@partyquiz.demo',
      name: 'Demo Admin',
      emailVerified: new Date(),
    },
  });

  const host = await prisma.user.create({
    data: {
      email: 'host@partyquiz.demo',
      name: 'Quiz Host',
      emailVerified: new Date(),
    },
  });

  const editor = await prisma.user.create({
    data: {
      email: 'editor@partyquiz.demo',
      name: 'Content Editor',
      emailVerified: new Date(),
    },
  });

  // Create workspace
  console.log('🏢 Creating workspace...');
  
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Demo Workspace',
      slug: 'demo-workspace',
      description: 'Demo workspace with example quizzes',
      ownerId: admin.id,
      members: {
        create: [
          { userId: admin.id, role: 'OWNER' },
          { userId: host.id, role: 'ADMIN' },
          { userId: editor.id, role: 'EDITOR' },
        ],
      },
    },
  });

  // Create questions
  console.log('❓ Creating questions...');

  // Q1: MC_SINGLE
  const q1 = await prisma.question.create({
    data: {
      workspaceId: workspace.id,
      type: 'MC_SINGLE',
      title: 'Capital of France',
      prompt: 'What is the capital of France?',
      difficulty: 2,
      status: 'PUBLISHED',
      createdBy: editor.id,
      options: {
        create: [
          { text: 'Paris', isCorrect: true, order: 1 },
          { text: 'London', isCorrect: false, order: 2 },
          { text: 'Berlin', isCorrect: false, order: 3 },
          { text: 'Madrid', isCorrect: false, order: 4 },
        ],
      },
    },
  });

  // Q2: MC_MULTIPLE
  const q2 = await prisma.question.create({
    data: {
      workspaceId: workspace.id,
      type: 'MC_MULTIPLE',
      title: 'Programming Languages',
      prompt: 'Which are programming languages?',
      difficulty: 3,
      status: 'PUBLISHED',
      createdBy: editor.id,
      options: {
        create: [
          { text: 'Python', isCorrect: true, order: 1 },
          { text: 'HTML', isCorrect: false, order: 2 },
          { text: 'JavaScript', isCorrect: true, order: 3 },
          { text: 'CSS', isCorrect: false, order: 4 },
        ],
      },
    },
  });

  // Q3: TRUE_FALSE
  const q3 = await prisma.question.create({
    data: {
      workspaceId: workspace.id,
      type: 'TRUE_FALSE',
      title: 'Flat Earth',
      prompt: 'The Earth is flat.',
      difficulty: 1,
      status: 'PUBLISHED',
      createdBy: editor.id,
      options: {
        create: [
          { text: 'True', isCorrect: false, order: 1 },
          { text: 'False', isCorrect: true, order: 2 },
        ],
      },
    },
  });

  // Q4: OPEN_TEXT
  const q4 = await prisma.question.create({
    data: {
      workspaceId: workspace.id,
      type: 'OPEN_TEXT',
      title: 'Famous Painting',
      prompt: 'Name the painting by Da Vinci with an enigmatic smile',
      explanation: 'The Mona Lisa, housed in the Louvre Museum',
      difficulty: 3,
      status: 'PUBLISHED',
      createdBy: editor.id,
      options: {
        create: [{ text: 'Mona Lisa', isCorrect: true, order: 1 }],
      },
    },
  });

  // Q5: ESTIMATION
  const q5 = await prisma.question.create({
    data: {
      workspaceId: workspace.id,
      type: 'ESTIMATION',
      title: 'Days in Year',
      prompt: 'How many days in a non-leap year?',
      difficulty: 1,
      status: 'PUBLISHED',
      createdBy: editor.id,
      options: {
        create: [{ text: '365', isCorrect: true, order: 1 }],
      },
    },
  });

  // Q6: ORDER
  const q6 = await prisma.question.create({
    data: {
      workspaceId: workspace.id,
      type: 'ORDER',
      title: 'Planet Order',
      prompt: 'Order planets by distance from Sun:',
      difficulty: 4,
      status: 'PUBLISHED',
      createdBy: editor.id,
      options: {
        create: [
          { text: 'Mercury', isCorrect: true, order: 1 },
          { text: 'Venus', isCorrect: true, order: 2 },
          { text: 'Earth', isCorrect: true, order: 3 },
          { text: 'Mars', isCorrect: true, order: 4 },
        ],
      },
    },
  });

  // Q7: PHOTO_QUESTION
  const q7 = await prisma.question.create({
    data: {
      workspaceId: workspace.id,
      type: 'PHOTO_QUESTION',
      title: 'Famous Landmark',
      prompt: 'What landmark is this?',
      difficulty: 2,
      status: 'PUBLISHED',
      createdBy: editor.id,
      options: {
        create: [
          { text: 'Eiffel Tower', isCorrect: true, order: 1 },
          { text: 'Leaning Tower', isCorrect: false, order: 2 },
          { text: 'Big Ben', isCorrect: false, order: 3 },
        ],
      },
      media: {
        create: [{
          provider: 'UPLOAD',
          mediaType: 'IMAGE',
          reference: { url: 'demo/eiffel.jpg' },
          order: 1,
        }],
      },
    },
  });

  // Q8: MUSIC_GUESS_TITLE
  const q8 = await prisma.question.create({
    data: {
      workspaceId: workspace.id,
      type: 'MUSIC_GUESS_TITLE',
      title: 'Name That Song',
      prompt: 'What is this song title?',
      difficulty: 3,
      status: 'PUBLISHED',
      createdBy: editor.id,
      options: {
        create: [{ text: 'Mr. Brightside', isCorrect: true, order: 1 }],
      },
      media: {
        create: [{
          provider: 'SPOTIFY',
          mediaType: 'AUDIO',
          reference: { trackId: '3n3Ppam7vgaVa1iaRUc9Lp' },
          metadata: { startMs: 0, durationMs: 30000 },
          order: 1,
        }],
      },
    },
  });

  // Q9: MUSIC_GUESS_ARTIST
  const q9 = await prisma.question.create({
    data: {
      workspaceId: workspace.id,
      type: 'MUSIC_GUESS_ARTIST',
      title: 'Name That Artist',
      prompt: 'Who is the artist?',
      difficulty: 3,
      status: 'PUBLISHED',
      createdBy: editor.id,
      options: {
        create: [{ text: 'The Weeknd', isCorrect: true, order: 1 }],
      },
      media: {
        create: [{
          provider: 'SPOTIFY',
          mediaType: 'AUDIO',
          reference: { trackId: '0VjIjW4GlUZAMYd2vXMi3b' },
          metadata: { startMs: 10000, durationMs: 30000 },
          order: 1,
        }],
      },
    },
  });

  // Q10: YOUTUBE_SCENE
  const q10 = await prisma.question.create({
    data: {
      workspaceId: workspace.id,
      type: 'YOUTUBE_SCENE_QUESTION',
      title: 'YouTube Scene',
      prompt: 'What video is this from?',
      difficulty: 2,
      status: 'PUBLISHED',
      createdBy: editor.id,
      options: {
        create: [
          { text: 'Rick Astley Music Video', isCorrect: true, order: 1 },
          { text: 'Movie Scene', isCorrect: false, order: 2 },
        ],
      },
      media: {
        create: [{
          provider: 'YOUTUBE',
          mediaType: 'VIDEO',
          reference: { videoId: 'dQw4w9WgXcQ' },
          metadata: { startMs: 42000, durationMs: 15000 },
          order: 1,
        }],
      },
    },
  });

  // Q11: POLL
  const q11 = await prisma.question.create({
    data: {
      workspaceId: workspace.id,
      type: 'POLL',
      title: 'Pizza Poll',
      prompt: 'Favorite pizza topping?',
      difficulty: 1,
      status: 'PUBLISHED',
      createdBy: editor.id,
      options: {
        create: [
          { text: 'Pepperoni', isCorrect: false, order: 1 },
          { text: 'Mushrooms', isCorrect: false, order: 2 },
          { text: 'Pineapple', isCorrect: false, order: 3 },
          { text: 'Olives', isCorrect: false, order: 4 },
        ],
      },
    },
  });

  // Q12: PHOTO_OPEN
  const q12 = await prisma.question.create({
    data: {
      workspaceId: workspace.id,
      type: 'PHOTO_OPEN',
      title: 'Historical Figure',
      prompt: 'Name this person:',
      difficulty: 3,
      status: 'PUBLISHED',
      createdBy: editor.id,
      options: {
        create: [{ text: 'Albert Einstein', isCorrect: true, order: 1 }],
      },
      media: {
        create: [{
          provider: 'UPLOAD',
          mediaType: 'IMAGE',
          reference: { url: 'demo/einstein.jpg' },
          order: 1,
        }],
      },
    },
  });

  console.log('✅ Created 12 questions');

  // Create quizzes
  console.log('📝 Creating quizzes...');

  // Quiz 1: General Knowledge
  const quiz1 = await prisma.quiz.create({
    data: {
      workspaceId: workspace.id,
      title: 'General Knowledge Quiz',
      description: 'Test your knowledge across topics',
      createdBy: host.id,
      rounds: {
        create: [
          {
            title: 'Round 1: Basics',
            order: 1,
            items: {
              create: [
                {
                  itemType: 'QUESTION',
                  questionId: q1.id,
                  order: 1,
                  settingsJson: { timeLimit: 20, points: 100 },
                },
                {
                  itemType: 'QUESTION',
                  questionId: q3.id,
                  order: 2,
                  settingsJson: { timeLimit: 10, points: 50 },
                },
                {
                  itemType: 'QUESTION',
                  questionId: q5.id,
                  order: 3,
                  settingsJson: { timeLimit: 15, points: 100 },
                },
              ],
            },
          },
          {
            title: 'Round 2: Challenge',
            order: 2,
            items: {
              create: [
                {
                  itemType: 'QUESTION',
                  questionId: q2.id,
                  order: 1,
                  settingsJson: { timeLimit: 25, points: 150 },
                },
                {
                  itemType: 'QUESTION',
                  questionId: q6.id,
                  order: 2,
                  settingsJson: { timeLimit: 30, points: 200 },
                },
                {
                  itemType: 'MINIGAME',
                  minigameType: 'SWAN_RACE',
                  order: 3,
                  settingsJson: { duration: 60 },
                },
              ],
            },
          },
        ],
      },
    },
  });

  // Quiz 2: Music Quiz
  const quiz2 = await prisma.quiz.create({
    data: {
      workspaceId: workspace.id,
      title: '🎵 Music Quiz',
      description: 'For music lovers!',
      createdBy: host.id,
      rounds: {
        create: [{
          title: 'Music Round',
          order: 1,
          items: {
            create: [
              {
                itemType: 'QUESTION',
                questionId: q8.id,
                order: 1,
                settingsJson: { timeLimit: 30, points: 200 },
              },
              {
                itemType: 'QUESTION',
                questionId: q9.id,
                order: 2,
                settingsJson: { timeLimit: 30, points: 200 },
              },
            ],
          },
        }],
      },
    },
  });

  // Quiz 3: Party Quiz
  const quiz3 = await prisma.quiz.create({
    data: {
      workspaceId: workspace.id,
      title: '🎉 Party Quiz',
      description: 'Fun for everyone!',
      createdBy: host.id,
      rounds: {
        create: [{
          title: 'Party Round',
          order: 1,
          items: {
            create: [
              {
                itemType: 'QUESTION',
                questionId: q7.id,
                order: 1,
                settingsJson: { timeLimit: 20, points: 150 },
              },
              {
                itemType: 'QUESTION',
                questionId: q11.id,
                order: 2,
                settingsJson: { timeLimit: 15, points: 0 },
              },
              {
                itemType: 'QUESTION',
                questionId: q10.id,
                order: 3,
                settingsJson: { timeLimit: 25, points: 150 },
              },
            ],
          },
        }],
      },
    },
  });

  console.log('✅ Created 3 quizzes\n');

  // Create quiz templates
  console.log('📝 Creating quiz templates...');

  // Template 1: Birthday Party Quiz
  const birthdayTemplate = await prisma.quiz.create({
    data: {
      workspaceId: workspace.id,
      title: '🎉 Birthday Party Quiz',
      description: 'Fun and easy quiz perfect for birthday parties with friends and family',
      isTemplate: true,
      createdBy: admin.id,
      rounds: {
        create: [
          {
            title: 'Warm-Up Fun',
            order: 1,
            items: {
              create: [
                { questionId: q1.id, order: 1, itemType: 'QUESTION' },
                { questionId: q2.id, order: 2, itemType: 'QUESTION' },
                { questionId: q5.id, order: 3, itemType: 'QUESTION' },
              ],
            },
          },
          {
            title: 'Music Round',
            order: 2,
            items: {
              create: [
                { questionId: q9.id, order: 1, itemType: 'QUESTION' },
                { questionId: q10.id, order: 2, itemType: 'QUESTION' },
              ],
            },
          },
        ],
      },
    },
  });

  // Template 2: Corporate Team Event
  const corporateTemplate = await prisma.quiz.create({
    data: {
      workspaceId: workspace.id,
      title: '💼 Corporate Team Event',
      description: 'Professional team-building quiz for corporate events and workshops',
      isTemplate: true,
      createdBy: admin.id,
      rounds: {
        create: [
          {
            title: 'Icebreaker',
            order: 1,
            items: {
              create: [
                { questionId: q1.id, order: 1, itemType: 'QUESTION' },
                { questionId: q3.id, order: 2, itemType: 'QUESTION' },
              ],
            },
          },
          {
            title: 'Team Challenge',
            order: 2,
            items: {
              create: [
                { questionId: q4.id, order: 1, itemType: 'QUESTION' },
                { questionId: q6.id, order: 2, itemType: 'QUESTION' },
              ],
            },
          },
        ],
      },
    },
  });

  // Template 3: Pub Quiz Night
  const pubTemplate = await prisma.quiz.create({
    data: {
      workspaceId: workspace.id,
      title: '🍺 Classic Pub Quiz',
      description: 'Traditional pub quiz with geography, history, and general knowledge',
      isTemplate: true,
      createdBy: admin.id,
      rounds: {
        create: [
          {
            title: 'Geography & History',
            order: 1,
            items: {
              create: [
                { questionId: q1.id, order: 1, itemType: 'QUESTION' },
                { questionId: q2.id, order: 2, itemType: 'QUESTION' },
                { questionId: q3.id, order: 3, itemType: 'QUESTION' },
              ],
            },
          },
          {
            title: 'Science & Nature',
            order: 2,
            items: {
              create: [
                { questionId: q4.id, order: 1, itemType: 'QUESTION' },
                { questionId: q5.id, order: 2, itemType: 'QUESTION' },
              ],
            },
          },
          {
            title: 'Entertainment',
            order: 3,
            items: {
              create: [
                { questionId: q9.id, order: 1, itemType: 'QUESTION' },
                { questionId: q11.id, order: 2, itemType: 'QUESTION' },
              ],
            },
          },
        ],
      },
    },
  });

  console.log('✅ Created 3 quiz templates\n');

  // Create demo session
  console.log('🎮 Creating demo session...');

  await prisma.liveSession.create({
    data: {
      workspaceId: workspace.id,
      quizId: quiz1.id,
      code: 'DEMO123',
      status: 'LOBBY',
      hostUserId: host.id,
      players: {
        create: [
          {
            name: 'Alice',
            deviceIdHash: `device-${Date.now()}-1`,
            avatar: '🦄',
          },
          {
            name: 'Bob',
            deviceIdHash: `device-${Date.now()}-2`,
            avatar: '🐻',
          },
        ],
      },
    },
  });

  console.log('✅ Created demo session\n');

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✨ Seeding Complete!\n');
  console.log('📊 Created:');
  console.log('  • 3 users');
  console.log('  • 1 workspace');
  console.log('  • 12 questions (all types)');
  console.log('  • 3 quizzes');
  console.log('  • 3 quiz templates');
  console.log('  • 1 live session\n');
  console.log('🔑 Demo Credentials:');
  console.log('  • admin@partyquiz.demo');
  console.log('  • host@partyquiz.demo');
  console.log('  • editor@partyquiz.demo\n');
  console.log('🎯 Session Code: DEMO123\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('\n❌ Seeding failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
