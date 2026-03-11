import { prisma } from '../../src/config/prisma.js';

const NUM = 20;

const slugify = (s: string) =>
  s
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '');

async function main() {
  console.log(`Seeding ${NUM} items per collection...`);

  // Brands
  for (let i = 1; i <= NUM; i++) {
    const name = `Brand ${i}`;
    const slug = slugify(name);
    await prisma.brand.upsert({
      where: { slug },
      update: {},
      create: { name, slug, image: null }
    });
  }
  console.log(`Seeded ${NUM} brands`);

  // Product categories
  for (let i = 1; i <= NUM; i++) {
    const name = `Product Category ${i}`;
    const slug = slugify(name);
    await prisma.productCategory.upsert({
      where: { slug },
      update: {},
      create: { name, slug, image: null }
    });
  }
  console.log(`Seeded ${NUM} product categories`);

  // Blog categories
  for (let i = 1; i <= NUM; i++) {
    const name = `Blog Category ${i}`;
    const slug = slugify(name);
    await prisma.blogCategory.upsert({
      where: { slug },
      update: {},
      create: { name, slug, image: null }
    });
  }
  console.log(`Seeded ${NUM} blog categories`);

  // Product tags
  for (let i = 1; i <= NUM; i++) {
    const name = `Product Tag ${i}`;
    const slug = slugify(name);
    await prisma.productTag.upsert({
      where: { slug },
      update: {},
      create: { name, slug }
    });
  }
  console.log(`Seeded ${NUM} product tags`);

  // Blog tags
  for (let i = 1; i <= NUM; i++) {
    const name = `Blog Tag ${i}`;
    const slug = slugify(name);
    await prisma.blogTag.upsert({
      where: { slug },
      update: {},
      create: { name, slug }
    });
  }
  console.log(`Seeded ${NUM} blog tags`);

  console.log('Seeding finished.');
}

main()
  .catch((err) => {
    console.error('seed error', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
