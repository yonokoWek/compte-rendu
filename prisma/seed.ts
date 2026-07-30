import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed activity categories
  const categories = [
    { name: 'Prière Matinale', unit: 'minutes', sortOrder: 1, isPersonal: true, icon: 'sunrise' },
    { name: 'Prière Seule', unit: 'minutes', sortOrder: 2, isPersonal: true, icon: 'user' },
    { name: 'RDQD', unit: 'minutes', sortOrder: 3, isPersonal: true, icon: 'book-open' },
    { name: 'Prière pour la RDQD', unit: 'minutes', sortOrder: 4, isPersonal: true, icon: 'book-open-check' },
    { name: 'Lecture Biblique', unit: 'minutes', sortOrder: 5, isPersonal: true, icon: 'book' },
    { name: 'Littérature Chrétienne', unit: 'minutes', sortOrder: 6, isPersonal: true, icon: 'library' },
    { name: 'Prière Violente', unit: 'minutes', sortOrder: 7, isPersonal: true, icon: 'flame' },
    { name: "Renversement des idoles", unit: 'minutes', sortOrder: 8, isPersonal: true, icon: 'shield' },
    { name: 'Retraite', unit: 'count', sortOrder: 9, isPersonal: true, icon: 'mountain' },
    { name: 'Evangelisation', unit: 'count', sortOrder: 10, isPersonal: false, icon: 'megaphone' },
    { name: 'Personnes confessées', unit: 'count', sortOrder: 11, isPersonal: false, icon: 'users' },
    { name: 'Jeunes', unit: 'count', sortOrder: 12, isPersonal: false, icon: 'graduation-cap' },
    { name: 'Réunions ou prière en groupe', unit: 'minutes', sortOrder: 13, isPersonal: false, icon: 'users-round' },
  ];

  for (const cat of categories) {
    await prisma.activityCategory.upsert({
      where: { id: cat.name.toLowerCase().replace(/\s+/g, '-') },
      update: cat,
      create: { id: cat.name.toLowerCase().replace(/\s+/g, '-'), ...cat },
    });
  }

  // Seed default user profile
  await prisma.userProfile.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      firstName: 'Yannick',
      lastName: 'WEKA',
      assembly: 'Adewui',
      mentor: 'FR VIVOR Jérémie',
    },
  });

  console.log('Seed completed successfully');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
