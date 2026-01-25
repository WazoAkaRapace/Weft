import { db } from './index.js';
import { users, journals, transcripts, tags } from './schema.js';

/**
 * Seed script for development/testing
 *
 * This script creates sample data for testing the application.
 * Run with: pnpm --filter @weft/server db:seed
 */

async function seed() {
  console.log('🌱 Starting database seed...');

  try {
    // Clear existing data (in reverse order of dependencies)
    console.log('🗑️  Clearing existing data...');
    await db.delete(tags);
    await db.delete(transcripts);
    await db.delete(journals);
    await db.delete(users);

    // Create sample users
    console.log('👤 Creating sample users...');
    const [user1, user2] = await db
      .insert(users)
      .values([
        {
          username: 'johndoe',
          email: 'john@example.com',
          passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456', // Placeholder hash
        },
        {
          username: 'janedoe',
          email: 'jane@example.com',
          passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456', // Placeholder hash
        },
      ])
      .returning();

    console.log(`✅ Created ${[user1, user2].length} users`);

    // Create sample journals for user1
    console.log('📔 Creating sample journals...');
    const [journal1, journal2] = await db
      .insert(journals)
      .values([
        {
          userId: user1.id,
          title: 'My First Video Journal',
          videoPath: '/uploads/john/first-journal.mp4',
          duration: 180, // 3 minutes
          location: 'San Francisco, CA',
          notes: 'Just getting started with video journaling!',
        },
        {
          userId: user1.id,
          title: 'Reflections on Technology',
          videoPath: '/uploads/john/tech-reflections.mp4',
          duration: 300, // 5 minutes
          location: null,
          notes: 'Thinking about the future of AI and software development.',
        },
      ])
      .returning();

    console.log(`✅ Created ${[journal1, journal2].length} journals`);

    // Create sample transcripts
    console.log('📝 Creating sample transcripts...');
    await db.insert(transcripts).values([
      {
        journalId: journal1.id,
        text: 'Hello everyone, this is my first video journal entry. I am excited to start this journey of self-reflection and documentation.',
        segments: [
          { start: 0, end: 2.5, text: 'Hello everyone,' },
          { start: 2.5, end: 5.0, text: 'this is my first' },
          { start: 5.0, end: 8.0, text: 'video journal entry.' },
          { start: 8.0, end: 12.0, text: 'I am excited to start' },
          { start: 12.0, end: 16.0, text: 'this journey of self-reflection' },
          { start: 16.0, end: 19.0, text: 'and documentation.' },
        ],
      },
      {
        journalId: journal2.id,
        text: 'Today I want to talk about the rapid evolution of artificial intelligence and its impact on software development.',
        segments: [
          { start: 0, end: 3.0, text: 'Today I want to talk about' },
          { start: 3.0, end: 7.0, text: 'the rapid evolution of' },
          { start: 7.0, end: 10.0, text: 'artificial intelligence and' },
          { start: 10.0, end: 14.0, text: 'its impact on software development.' },
        ],
      },
    ]);

    console.log('✅ Created 2 transcripts');

    // Create sample tags
    console.log('🏷️  Creating sample tags...');
    await db.insert(tags).values([
      { journalId: journal1.id, tag: 'first' },
      { journalId: journal1.id, tag: 'personal' },
      { journalId: journal1.id, tag: 'introduction' },
      { journalId: journal2.id, tag: 'technology' },
      { journalId: journal2.id, tag: 'ai' },
      { journalId: journal2.id, tag: 'reflection' },
    ]);

    console.log('✅ Created 6 tags');

    console.log('\n✨ Database seeded successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - 2 users created`);
    console.log(`   - 2 journals created`);
    console.log(`   - 2 transcripts created`);
    console.log(`   - 6 tags created`);
    console.log('\n🔐 Sample credentials:');
    console.log(`   Username: johndoe | Email: john@example.com`);
    console.log(`   Username: janedoe | Email: jane@example.com`);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Run seed function
seed()
  .then(() => {
    console.log('\n✅ Seed completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  });
