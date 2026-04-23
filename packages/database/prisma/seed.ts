import { PrismaClient } from "@prisma/client";

import { baseCategories } from "./categories.seed.js";

const prisma = new PrismaClient();

async function main() {
  const activeSlugs = baseCategories.map((category) => category.slug);

  await prisma.category.updateMany({
    where: {
      slug: {
        notIn: activeSlugs
      }
    },
    data: {
      isActive: false
    }
  });

  for (const category of baseCategories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        nameRu: category.nameRu,
        nameEn: category.nameEn,
        isActive: true,
        sortOrder: category.sortOrder
      },
      create: {
        slug: category.slug,
        nameRu: category.nameRu,
        nameEn: category.nameEn,
        isActive: true,
        sortOrder: category.sortOrder
      }
    });
  }

  console.log(`Seeded ${baseCategories.length} categories.`);
}

main()
  .catch((error) => {
    console.error("Database seed failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
