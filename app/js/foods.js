// Built-in food list: [name, kcal per 100 g, protein g per 100 g, typical serving g]
// Values are typical estimates (cooked weight unless noted). Clients can always
// edit calories, and the foods they log are remembered as "My foods".
export const FOODS = [
  // --- Thai dishes ---
  ['Jasmine rice, cooked', 130, 2.7, 180], ['Sticky rice, cooked', 169, 3.5, 120], ['Brown rice, cooked', 123, 2.7, 180],
  ['Riceberry rice, cooked', 140, 3.2, 180], ['Rice porridge (jok) with pork', 70, 4, 350], ['Khao tom (rice soup) with shrimp', 60, 4.5, 400],
  ['Pad kra pao chicken (no rice)', 165, 15, 180], ['Pad kra pao pork (no rice)', 210, 14, 180], ['Pad kra pao with rice & fried egg', 175, 8, 450],
  ['Khao man gai (chicken rice)', 180, 9, 380], ['Khao mok gai (chicken biryani)', 170, 8, 400], ['Khao pad (fried rice) chicken', 170, 6.5, 350],
  ['Khao pad (fried rice) shrimp', 165, 7, 350], ['Pad thai with shrimp', 180, 7, 300], ['Pad see ew pork', 175, 6.5, 320],
  ['Rad na', 120, 5.5, 400], ['Pad krapow moo krob (crispy pork)', 260, 12, 200], ['Khao kha moo (pork leg rice)', 190, 9, 400],
  ['Moo ping (grilled pork skewer)', 250, 18, 100], ['Gai yang (grilled chicken)', 190, 25, 150], ['Kor moo yang (grilled pork neck)', 300, 16, 120],
  ['Larb moo (minced pork salad)', 150, 15, 200], ['Larb gai (minced chicken salad)', 125, 16, 200], ['Nam tok moo', 170, 16, 200],
  ['Som tam Thai (papaya salad)', 55, 1.8, 250], ['Som tam poo plara', 50, 2.5, 250], ['Yum woon sen (glass noodle salad)', 110, 6, 250],
  ['Tom yum goong (clear)', 35, 4, 400], ['Tom yum goong (creamy)', 60, 4, 400], ['Tom kha gai', 95, 5, 400],
  ['Green curry chicken', 130, 8, 300], ['Red curry pork', 140, 7.5, 300], ['Massaman curry chicken', 150, 7, 300],
  ['Panang curry pork', 170, 9, 250], ['Kaeng som (sour curry) fish', 45, 5, 350], ['Kaeng jued (clear soup) tofu & pork', 30, 3, 400],
  ['Khao soi chicken', 140, 7, 450], ['Kuay teow nam (noodle soup) pork', 70, 4.5, 500], ['Boat noodles (kuay teow ruea)', 80, 5, 400],
  ['Yen ta fo', 75, 4, 500], ['Bami moo daeng (egg noodles red pork)', 150, 8, 350], ['Pad pak boong (morning glory)', 90, 3, 150],
  ['Pad pak ruam (mixed stir-fried veg)', 75, 2.5, 200], ['Kai jeow (Thai omelette)', 270, 11, 120], ['Fried egg (kai dao)', 196, 13.6, 50],
  ['Boiled egg', 155, 13, 50], ['Pla tod (fried fish)', 230, 20, 150], ['Pla nueng manao (steamed fish lime)', 100, 17, 300],
  ['Goong ob woon sen (shrimp glass noodles)', 160, 9, 300], ['Satay chicken with peanut sauce', 220, 18, 150], ['Gai tod (fried chicken)', 280, 20, 150],
  ['Spring rolls, fried', 250, 5, 100], ['Moo satay', 230, 17, 120], ['Thai sausage (sai krok)', 300, 12, 80],
  ['Mango sticky rice', 250, 3.5, 250], ['Khanom krok', 230, 3, 100], ['Roti with condensed milk', 330, 6, 120],
  ['Thai milk tea (cha yen), sweet', 75, 1, 400], ['Thai iced coffee (oliang), sweet', 60, 0.5, 400], ['Iced latte, no sugar', 45, 2.5, 400],
  ['Bubble milk tea with pearls', 90, 1, 500], ['Coconut water', 19, 0.7, 300], ['Fresh orange juice', 45, 0.7, 250],
  // --- Proteins ---
  ['Chicken breast, cooked', 165, 31, 150], ['Chicken thigh, skinless, cooked', 210, 26, 150], ['Chicken breast, raw', 120, 22.5, 200],
  ['Pork loin, cooked', 200, 28, 150], ['Pork belly, cooked', 520, 9, 100], ['Minced pork, cooked', 260, 25, 120],
  ['Beef steak (sirloin), cooked', 230, 29, 200], ['Lean minced beef, cooked', 215, 26, 150], ['Salmon, cooked', 206, 22, 150],
  ['Tuna, canned in water', 116, 26, 100], ['Tuna, canned in oil, drained', 198, 29, 100], ['White fish (tilapia), cooked', 130, 26, 150],
  ['Shrimp, cooked', 99, 24, 120], ['Squid, cooked', 120, 18, 120], ['Egg whites', 52, 11, 100],
  ['Whole egg, raw', 143, 12.6, 50], ['Tofu, firm', 145, 15, 150], ['Tofu, soft/silken', 55, 5, 150],
  ['Tempeh', 192, 20, 100], ['Whey protein powder', 400, 80, 30], ['Greek yogurt, plain 0%', 59, 10, 170],
  ['Greek yogurt, plain full-fat', 97, 9, 170], ['Cottage cheese', 98, 11, 150], ['Chicken sausage', 180, 14, 60],
  ['Ham, sliced', 145, 18, 50], ['Bacon, cooked', 540, 37, 20], ['Edamame, shelled', 121, 12, 100],
  // --- Carbs & grains ---
  ['Oats, dry', 389, 17, 50], ['Oatmeal, cooked with water', 70, 2.5, 250], ['White bread, slice', 265, 9, 30],
  ['Wholemeal bread, slice', 250, 12, 35], ['Pasta, cooked', 158, 5.8, 200], ['Rice noodles, cooked', 108, 1.8, 200],
  ['Egg noodles, cooked', 138, 4.5, 200], ['Glass noodles, cooked', 85, 0.1, 150], ['Instant noodles (Mama), prepared', 95, 2, 300],
  ['Potato, boiled', 87, 1.9, 200], ['Sweet potato, baked', 90, 2, 200], ['French fries', 312, 3.4, 120],
  ['Corn, cooked', 96, 3.4, 150], ['Granola', 470, 10, 50], ['Cornflakes', 357, 7.5, 30],
  ['Bagel', 257, 10, 100], ['Tortilla wrap', 310, 8, 60], ['Croissant', 406, 8, 60],
  // --- Fruit & veg ---
  ['Banana', 89, 1.1, 120], ['Apple', 52, 0.3, 180], ['Mango, ripe', 60, 0.8, 200], ['Pineapple', 50, 0.5, 150],
  ['Watermelon', 30, 0.6, 300], ['Papaya', 43, 0.5, 200], ['Guava', 68, 2.6, 150], ['Orange', 47, 0.9, 150],
  ['Grapes', 69, 0.7, 150], ['Dragon fruit', 60, 1.2, 200], ['Durian', 147, 1.5, 150], ['Longan', 60, 1.3, 100],
  ['Strawberries', 32, 0.7, 150], ['Blueberries', 57, 0.7, 100], ['Avocado', 160, 2, 100],
  ['Broccoli, cooked', 35, 2.4, 150], ['Mixed salad greens', 17, 1.3, 100], ['Cucumber', 15, 0.7, 100],
  ['Tomato', 18, 0.9, 120], ['Carrot', 41, 0.9, 100], ['Chinese kale (kana), stir-fried', 80, 2.5, 150],
  // --- Dairy, fats, snacks ---
  ['Milk, whole', 61, 3.2, 250], ['Milk, low-fat', 42, 3.4, 250], ['Soy milk, unsweetened', 33, 3, 250],
  ['Soy milk, sweetened', 54, 3, 250], ['Cheddar cheese', 403, 25, 30], ['Mozzarella', 280, 28, 30],
  ['Butter', 717, 0.9, 10], ['Olive oil', 884, 0, 10], ['Cooking oil (vegetable)', 884, 0, 10],
  ['Peanut butter', 588, 25, 32], ['Almonds', 579, 21, 30], ['Cashews', 553, 18, 30],
  ['Peanuts, roasted', 585, 24, 30], ['Dark chocolate 70%', 600, 8, 25], ['Milk chocolate', 535, 7.6, 40],
  ['Potato chips', 536, 7, 50], ['Protein bar', 360, 30, 60], ['Rice crackers', 390, 7, 30],
  ['Ice cream, vanilla', 207, 3.5, 100], ['Donut, glazed', 452, 5, 60], ['Cookies', 480, 6, 30],
  ['Cake, sponge with cream', 350, 5, 100], ['Honey', 304, 0.3, 20], ['Sugar', 387, 0, 10],
  // --- Fast food & convenience ---
  ['Burger, beef (regular)', 250, 13, 220], ['Cheeseburger', 265, 14, 230], ['Pizza, cheese', 266, 11, 220],
  ['Pizza, pepperoni', 290, 12, 220], ['Fried chicken (fast food)', 290, 21, 200], ['Chicken nuggets', 296, 15, 100],
  ['Hot dog', 290, 10, 100], ['Sandwich, ham & cheese', 260, 13, 200], ['Onigiri (rice ball) tuna mayo', 190, 5, 110],
  ['Sushi, salmon nigiri', 170, 8, 200], ['Gyoza, fried', 230, 9, 120], ['Dim sum (siu mai)', 200, 11, 120],
  ['Ramen, tonkotsu', 95, 4.5, 600], ['Fried rice (generic)', 175, 5, 350], ['Caesar salad with chicken', 150, 10, 300],
  // --- Drinks ---
  ['Cola', 42, 0, 330], ['Cola zero', 0, 0, 330], ['Beer', 43, 0.5, 330], ['Red wine', 85, 0.1, 150],
  ['Orange soda', 48, 0, 330], ['Energy drink', 45, 0, 250], ['Black coffee', 2, 0.3, 250],
  ['Cappuccino', 40, 2, 250], ['Mocha', 70, 2.5, 350], ['Protein shake (whey + water)', 40, 8, 300],
  ['Smoothie, fruit', 60, 1, 400], ['Sports drink', 25, 0, 500],
];

export function searchFoods(q, mine = [], max = 12) {
  q = String(q || '').trim().toLowerCase();
  const all = [
    ...mine.map((m) => ({ name: m.name, kcal100: m.kcal100, p100: m.p100, serving: m.g || 100, mine: true })),
    ...FOODS.map(([name, kcal100, p100, serving]) => ({ name, kcal100, p100, serving, mine: false })),
  ];
  const seen = new Set();
  const out = [];
  if (!q) return all.filter((f) => f.mine).slice(0, max);
  const words = q.split(/\s+/);
  const score = (n) => {
    const s = n.toLowerCase();
    if (!words.every((w) => s.includes(w))) return -1;
    return (s.startsWith(q) ? 3 : 0) + (s.split(/[\s(,]+/).some((t) => t.startsWith(words[0])) ? 2 : 0);
  };
  for (const f of all) {
    const sc = score(f.name); if (sc < 0) continue;
    const key = f.name.toLowerCase(); if (seen.has(key)) continue; seen.add(key);
    out.push({ ...f, sc: sc + (f.mine ? 4 : 0) });
  }
  return out.sort((a, b) => b.sc - a.sc).slice(0, max);
}
