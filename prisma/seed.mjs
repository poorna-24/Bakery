// Seeds the eight starter categories with a handful of sample items, so the
// menu is not an empty page the first time you open it. Safe to re-run: it
// skips anything that already exists, and it never deletes your own data.
//
//   npm run db:seed

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const CATEGORIES = [
  {
    name: "Cakes",
    description: "Celebrate life's sweet moments with our handcrafted cakes.",
    items: [
      {
        name: "Choco Truffle Cake",
        description: "Rich Belgian chocolate sponge layered with truffle cream.",
        price: 650,
        unit: "per kg",
        isEggless: false,
        isBestseller: true,
        variants: [
          { label: "500 g", price: 350 },
          { label: "1 kg", price: 650 },
        ],
      },
      {
        name: "Butter Scotch Cake",
        description: "Caramel sponge with crunchy butterscotch praline.",
        price: 600,
        unit: "per kg",
        variants: [
          { label: "500 g", price: 320 },
          { label: "1 kg", price: 600 },
        ],
      },
      {
        name: "Fresh Pineapple Cake",
        description: "Light vanilla sponge with pineapple chunks and cream.",
        price: 550,
        unit: "per kg",
      },
      {
        name: "Eggless Coffee Walnut Cake",
        description: "Mild coffee sponge finished with roasted walnuts.",
        price: 700,
        unit: "per kg",
        isEggless: true,
      },
    ],
  },
  {
    name: "Traditional Cakes Collection",
    description: "The old favourites, baked the way they always were.",
    items: [
      { name: "Plum Cake", description: "Dry fruits soaked for weeks.", price: 320, unit: "per box" },
      { name: "Madeira Cake", description: "Dense buttery loaf, perfect with chai.", price: 240, unit: "per piece" },
    ],
  },
  {
    name: "Hot & Fresh Bites",
    description: "Out of the oven through the day.",
    items: [
      { name: "Veg Puff", description: "Flaky pastry with spiced vegetable filling.", price: 25, unit: "per piece", isBestseller: true },
      { name: "Chicken Puff", description: "Flaky pastry with masala chicken.", price: 40, unit: "per piece", isVeg: false },
      { name: "Paneer Roll", description: "Grilled paneer wrapped in a soft roll.", price: 90, unit: "per piece" },
      { name: "Samosa", description: "Classic potato and pea filling.", price: 20, unit: "per piece" },
    ],
  },
  {
    name: "Pizza, Burgers & More",
    description: "Made to order, served hot.",
    items: [
      { name: "Margherita Pizza", description: "Tomato, mozzarella, basil.", price: 180, unit: "per piece" },
      { name: "Veg Burger", description: "Crisp patty, lettuce, house sauce.", price: 110, unit: "per piece" },
    ],
  },
  {
    name: "Fresh Juice, Cold Drinks & Milk Shake",
    description: "Cold, fresh, no concentrates.",
    items: [
      { name: "Cold Coffee", description: "Double shot, thick and chilled.", price: 90, unit: "per glass", isBestseller: true },
      { name: "Mango Milkshake", description: "Seasonal alphonso, thick pour.", price: 100, unit: "per glass" },
      { name: "Fresh Lime Soda", description: "Sweet or salted.", price: 50, unit: "per glass" },
    ],
  },
  {
    name: "Breads, Dry Cakes & Biscuits",
    description: "Baked fresh every morning.",
    items: [
      { name: "Milk Bread", description: "Soft sandwich loaf.", price: 45, unit: "per piece" },
      { name: "Whole Wheat Bread", description: "100% atta, no maida.", price: 60, unit: "per piece" },
      { name: "Butter Biscuits", description: "Crumbly tea-time biscuits.", price: 180, unit: "per kg" },
      { name: "Osmania Biscuits", description: "The Hyderabad classic.", price: 200, unit: "per kg", isBestseller: true },
    ],
  },
  {
    name: "Chocolate Delights",
    description: "Handmade in small batches.",
    items: [
      { name: "Assorted Chocolate Box", description: "Twelve pieces, mixed fillings.", price: 450, unit: "per box" },
      { name: "Chocolate Brownie", description: "Fudgy centre, walnut top.", price: 70, unit: "per piece" },
    ],
  },
  {
    name: "Kidz Lava, Donut & More",
    description: "For the little ones.",
    items: [
      { name: "Choco Lava Cup", description: "Warm centre, melts on the spoon.", price: 80, unit: "per piece", isBestseller: true },
      { name: "Sprinkle Donut", description: "Glazed and covered in sprinkles.", price: 60, unit: "per piece" },
    ],
  },
];

async function main() {
  let addedCategories = 0;
  let addedItems = 0;

  for (const [index, entry] of CATEGORIES.entries()) {
    const slug = slugify(entry.name);
    let category = await prisma.category.findUnique({ where: { slug } });

    if (!category) {
      category = await prisma.category.create({
        data: {
          name: entry.name,
          slug,
          description: entry.description,
          sortOrder: index,
        },
      });
      addedCategories++;
    }

    for (const [itemIndex, item] of entry.items.entries()) {
      const exists = await prisma.item.findFirst({
        where: { categoryId: category.id, name: item.name },
      });
      if (exists) continue;

      await prisma.item.create({
        data: {
          categoryId: category.id,
          name: item.name,
          description: item.description ?? "",
          price: item.price,
          unit: item.unit,
          isVeg: item.isVeg ?? true,
          isEggless: item.isEggless ?? false,
          isBestseller: item.isBestseller ?? false,
          isAvailable: true,
          sortOrder: itemIndex,
          variants: {
            create: (item.variants ?? []).map((variant, order) => ({
              label: variant.label,
              price: variant.price,
              sortOrder: order,
            })),
          },
        },
      });
      addedItems++;
    }
  }

  console.log(`Seed complete: ${addedCategories} categories, ${addedItems} items added.`);
  console.log("No photos are seeded — upload those from the admin panel.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
