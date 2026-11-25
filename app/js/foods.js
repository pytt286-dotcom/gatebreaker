// Built-in food list: [name, kcal/100 g, protein g/100 g, carbs g/100 g, fat g/100 g, typical serving g]
// Values are cooked weight unless noted.
// CALORIES USE THE UPPER END of the usual published range for each food, and
// protein the lower end (coach's rule: overstate the bad, understate the good).
// Restaurant and street food varies a lot, so the safe side is the high side:
// if a client's log says "on track", reality is on track or better.
// Clients can always edit any number, and the foods they log are remembered as "My foods".
export const FOODS = [
  // --- Thai dishes ---
  ['Jasmine rice, cooked', 145, 2.5, 32, 0.3, 180], ['Sticky rice, cooked', 200, 3.5, 44, 0.4, 120], ['Brown rice, cooked', 125, 2.5, 26, 1, 180],
  ['Riceberry rice, cooked', 150, 3, 31, 1.2, 180], ['Rice porridge (jok) with pork', 90, 3.5, 12, 3, 350], ['Khao tom (rice soup) with shrimp', 75, 4, 11, 1.5, 400],
  ['Pad kra pao chicken (no rice)', 200, 14, 6, 13, 180], ['Pad kra pao pork (no rice)', 250, 13, 6, 19, 180], ['Pad kra pao with rice & fried egg', 190, 7.5, 22, 8, 450],
  ['Khao man gai (chicken rice)', 200, 8.5, 24, 7.5, 380], ['Khao mok gai (chicken biryani)', 195, 8, 24, 7.5, 400], ['Khao pad (fried rice) chicken', 190, 6, 25, 7, 350],
  ['Khao pad (fried rice) shrimp', 185, 6, 25, 6.5, 350], ['Pad thai with shrimp', 215, 7, 28, 8, 300], ['Pad see ew pork', 210, 6.5, 26, 9, 320],
  ['Rad na', 140, 5, 17, 5.5, 400], ['Pad krapow moo krob (crispy pork)', 300, 11, 6, 26, 200], ['Khao kha moo (pork leg rice)', 200, 8.5, 21, 9, 400],
  ['Moo ping (grilled pork skewer)', 280, 17, 10, 19, 100], ['Gai yang (grilled chicken)', 215, 23, 2, 13, 150], ['Kor moo yang (grilled pork neck)', 340, 15, 2, 30, 120],
  ['Larb moo (minced pork salad)', 175, 14, 5, 11, 200], ['Larb gai (minced chicken salad)', 145, 15, 5, 7, 200], ['Nam tok moo', 190, 15, 5, 12, 200],
  ['Som tam Thai (papaya salad)', 75, 1.5, 13, 2, 250], ['Som tam poo plara', 60, 2, 10, 1.2, 250], ['Yum woon sen (glass noodle salad)', 130, 5.5, 15, 5.5, 250],
  ['Tom yum goong (clear)', 45, 3.5, 3, 2, 400], ['Tom yum goong (creamy)', 85, 3.5, 3.5, 6.5, 400], ['Tom kha gai', 120, 4.5, 4, 9.5, 400],
  ['Green curry chicken', 160, 7, 5, 12.5, 300], ['Red curry pork', 165, 7, 5, 13, 300], ['Massaman curry chicken', 180, 6.5, 10, 12.5, 300],
  ['Panang curry pork', 200, 8.5, 6, 15.5, 250], ['Kaeng som (sour curry) fish', 55, 4.5, 5, 1.5, 350], ['Kaeng jued (clear soup) tofu & pork', 40, 3, 2, 2, 400],
  ['Khao soi chicken', 165, 6.5, 15, 8.5, 450], ['Kuay teow nam (noodle soup) pork', 85, 4, 10, 3, 500], ['Boat noodles (kuay teow ruea)', 95, 4.5, 11, 3.5, 400],
  ['Yen ta fo', 90, 3.5, 11, 3.5, 500], ['Bami moo daeng (egg noodles red pork)', 175, 7.5, 22, 6, 350], ['Pad pak boong (morning glory)', 110, 2.5, 4, 9, 150],
  ['Pad pak ruam (mixed stir-fried veg)', 95, 2, 5, 7.5, 200], ['Kai jeow (Thai omelette)', 320, 10, 1.5, 30, 120], ['Fried egg (kai dao)', 230, 13, 0.8, 19, 50],
  ['Boiled egg', 155, 12.5, 1.1, 10.6, 50], ['Pla tod (fried fish)', 260, 19, 5, 18, 150], ['Pla nueng manao (steamed fish lime)', 115, 16, 3, 4, 300],
  ['Goong ob woon sen (shrimp glass noodles)', 185, 8, 20, 8, 300], ['Satay chicken with peanut sauce', 250, 17, 9, 16, 150], ['Gai tod (fried chicken)', 310, 19, 9, 22, 150],
  ['Spring rolls, fried', 290, 4.5, 28, 17.5, 100], ['Moo satay', 260, 16, 8, 18, 120], ['Thai sausage (sai krok)', 340, 11, 12, 27, 80],
  ['Mango sticky rice', 280, 3, 46, 9.5, 250], ['Khanom krok', 260, 2.5, 30, 14.5, 100], ['Roti with condensed milk', 380, 5.5, 47, 18.5, 120],
  ['Thai milk tea (cha yen), sweet', 95, 0.8, 15, 3.5, 400], ['Thai iced coffee (oliang), sweet', 75, 0.3, 17, 0.6, 400], ['Iced latte, no sugar', 50, 2.3, 3.5, 2.6, 400],
  ['Bubble milk tea with pearls', 110, 0.8, 19, 3.3, 500], ['Coconut water', 24, 0.5, 5.5, 0.2, 300], ['Fresh orange juice', 50, 0.6, 11.5, 0.2, 250],
  // --- Proteins ---
  ['Chicken breast, cooked', 170, 30, 0, 4.5, 150], ['Chicken thigh, skinless, cooked', 215, 25, 0, 12, 150], ['Chicken breast, raw', 125, 22, 0, 3, 200],
  ['Pork loin, cooked', 230, 26, 0, 14, 150], ['Pork belly, cooked', 540, 9, 0, 55, 100], ['Minced pork, cooked', 300, 23, 0, 23, 120],
  ['Beef steak (sirloin), cooked', 250, 27, 0, 15.5, 200], ['Lean minced beef, cooked', 250, 25, 0, 16, 150], ['Salmon, cooked', 230, 21, 0, 15.5, 150],
  ['Tuna, canned in water', 120, 25, 0, 1.5, 100], ['Tuna, canned in oil, drained', 200, 27, 0, 10, 100], ['White fish (tilapia), cooked', 130, 25, 0, 3, 150],
  ['Shrimp, cooked', 105, 22, 0.5, 1.5, 120], ['Squid, cooked', 125, 17, 4, 3.5, 120], ['Egg whites', 52, 10.5, 0.7, 0.2, 100],
  ['Whole egg, raw', 150, 12, 0.7, 10, 50], ['Tofu, firm', 145, 14, 3, 8.5, 150], ['Tofu, soft/silken', 62, 5, 2, 3.5, 150],
  ['Tempeh', 195, 19, 9, 10.8, 100], ['Whey protein powder', 410, 72, 10, 7, 30], ['Greek yogurt, plain 0%', 62, 9.5, 4, 0.4, 170],
  ['Greek yogurt, plain full-fat', 100, 8.5, 4, 5.5, 170], ['Cottage cheese', 103, 10.5, 3.5, 4.5, 150], ['Chicken sausage', 210, 13, 4, 15.5, 60],
  ['Ham, sliced', 150, 17, 2, 8, 50], ['Bacon, cooked', 545, 35, 1.4, 42, 20], ['Edamame, shelled', 125, 11, 9, 5.2, 100],
  // --- Carbs & grains ---
  ['Oats, dry', 389, 13, 66, 7, 50], ['Oatmeal, cooked with water', 75, 2.4, 12, 1.4, 250], ['White bread, slice', 270, 8, 49, 3.5, 30],
  ['Wholemeal bread, slice', 260, 10, 43, 4, 35], ['Pasta, cooked', 160, 5.5, 31, 1, 200], ['Rice noodles, cooked', 110, 1.7, 24.5, 0.2, 200],
  ['Egg noodles, cooked', 140, 4.5, 25, 2.1, 200], ['Glass noodles, cooked', 90, 0.1, 21, 0.1, 150], ['Instant noodles (Mama), prepared', 100, 2, 13, 4.5, 300],
  ['Potato, boiled', 87, 1.8, 20, 0.1, 200], ['Sweet potato, baked', 90, 1.8, 20.7, 0.2, 200], ['French fries', 320, 3.2, 41, 15.5, 120],
  ['Corn, cooked', 96, 3.2, 19, 1.5, 150], ['Granola', 490, 9, 60, 22, 50], ['Cornflakes', 380, 7, 84, 0.9, 30],
  ['Bagel', 275, 9.5, 53, 1.7, 100], ['Tortilla wrap', 320, 8, 50, 8, 60], ['Croissant', 420, 7.5, 45, 21, 60],
  // --- Fruit & veg ---
  ['Banana', 95, 1, 23, 0.3, 120], ['Apple', 60, 0.3, 14, 0.2, 180], ['Mango, ripe', 70, 0.7, 17, 0.4, 200],
  ['Pineapple', 55, 0.5, 13, 0.1, 150], ['Watermelon', 35, 0.5, 8, 0.2, 300], ['Papaya', 45, 0.4, 11, 0.3, 200],
  ['Guava', 70, 2.2, 14, 1, 150], ['Orange', 50, 0.8, 12, 0.2, 150], ['Grapes', 75, 0.6, 18, 0.2, 150],
  ['Dragon fruit', 65, 1.1, 13, 0.4, 200], ['Durian', 165, 1.4, 27, 5.3, 150], ['Longan', 65, 1.2, 15, 0.1, 100],
  ['Strawberries', 35, 0.6, 7.7, 0.3, 150], ['Blueberries', 60, 0.7, 14.5, 0.3, 100], ['Avocado', 170, 1.8, 8.5, 15, 100],
  ['Broccoli, cooked', 40, 2.3, 7, 0.4, 150], ['Mixed salad greens', 20, 1.2, 3.3, 0.2, 100], ['Cucumber', 16, 0.6, 3.6, 0.1, 100],
  ['Tomato', 20, 0.8, 3.9, 0.2, 120], ['Carrot', 42, 0.8, 9.6, 0.2, 100], ['Chinese kale (kana), stir-fried', 100, 2.3, 5, 8, 150],
  // --- Dairy, fats, snacks ---
  ['Milk, whole', 65, 3.2, 4.8, 3.6, 250], ['Milk, low-fat', 50, 3.3, 5, 1.8, 250], ['Soy milk, unsweetened', 40, 3, 1.5, 2, 250],
  ['Soy milk, sweetened', 65, 2.8, 8, 2, 250], ['Cheddar cheese', 410, 24, 2, 34, 30], ['Mozzarella', 300, 22, 2.2, 22, 30],
  ['Butter', 717, 0.8, 0.1, 81, 10], ['Olive oil', 884, 0, 0, 100, 10], ['Cooking oil (vegetable)', 884, 0, 0, 100, 10],
  ['Peanut butter', 600, 22, 18, 50, 32], ['Almonds', 600, 20, 21, 51, 30], ['Cashews', 580, 16, 32, 44, 30],
  ['Peanuts, roasted', 600, 23, 21, 50, 30], ['Dark chocolate 70%', 610, 7.5, 44, 43, 25], ['Milk chocolate', 550, 7, 58, 31, 40],
  ['Potato chips', 560, 6, 52, 35, 50], ['Protein bar', 400, 28, 40, 13, 60], ['Rice crackers', 420, 7, 80, 8, 30],
  ['Ice cream, vanilla', 220, 3.5, 24, 12, 100], ['Donut, glazed', 460, 5, 50, 26, 60], ['Cookies', 500, 5.5, 64, 24, 30],
  ['Cake, sponge with cream', 380, 4.5, 40, 22, 100], ['Honey', 310, 0.3, 82, 0, 20], ['Sugar', 400, 0, 100, 0, 10],
  // --- Fast food & convenience ---
  ['Burger, beef (regular)', 270, 12.5, 25, 13, 220], ['Cheeseburger', 290, 14, 25, 15, 230], ['Pizza, cheese', 290, 11, 32, 12.5, 220],
  ['Pizza, pepperoni', 310, 12, 30, 15.5, 220], ['Fried chicken (fast food)', 320, 20, 11, 21.5, 200], ['Chicken nuggets', 320, 14, 18, 21, 100],
  ['Hot dog', 300, 10, 24, 18, 100], ['Sandwich, ham & cheese', 280, 12.5, 28, 12.5, 200], ['Onigiri (rice ball) tuna mayo', 210, 4.5, 32, 6.5, 110],
  ['Sushi, salmon nigiri', 185, 7.5, 30, 3.5, 200], ['Gyoza, fried', 260, 8.5, 24, 13.5, 120], ['Dim sum (siu mai)', 230, 10, 16, 13.5, 120],
  ['Ramen, tonkotsu', 115, 4, 12, 5.5, 600], ['Fried rice (generic)', 195, 4.5, 26, 7.5, 350], ['Caesar salad with chicken', 180, 9, 6, 13, 300],
  // --- Drinks ---
  ['Cola', 44, 0, 11, 0, 330], ['Cola zero', 1, 0, 0, 0, 330], ['Beer', 45, 0.4, 3.6, 0, 330],
  ['Red wine', 88, 0.1, 2.7, 0, 150], ['Orange soda', 50, 0, 12.5, 0, 330], ['Energy drink', 50, 0, 12, 0, 250],
  ['Black coffee', 2, 0.1, 0, 0, 250], ['Cappuccino', 50, 2.5, 4, 2.5, 250], ['Mocha', 90, 2.5, 12, 3.5, 350],
  ['Protein shake (whey + water)', 42, 7.5, 1, 0.6, 300], ['Protein shake (whey + milk)', 70, 5.5, 4.5, 2.8, 350], ['Smoothie, fruit', 70, 0.8, 16, 0.4, 400],
  ['Sports drink', 26, 0, 6.4, 0, 500],
];
const BUILTIN = new Map(FOODS.map((f) => [f[0].toLowerCase(), f]));
const fromRow = ([name, kcal100, p100, c100, f100, serving]) => ({ name, kcal100, p100, c100, f100, serving });

/**
 * One "My foods" record → a pickable item. Three kinds:
 *  - same name as a built-in food: uses the built-in values (so old, lower
 *    values saved before an update are corrected), keeping the client's usual amount
 *  - per-100 g (weighed): kcal100 …
 *  - per serving (amount unknown): kcalServ … (also repairs old records where
 *    "1 g" was typed for an unknown amount, e.g. 300 kcal → 30,000 kcal/100 g)
 */
export function mineItem(m) {
  const b = BUILTIN.get(String(m.name || '').toLowerCase());
  if (b) return { ...fromRow(b), serving: m.g || b[5], mine: true };
  const k100 = Number(m.kcal100);
  if (m.kcalServ !== undefined && m.kcalServ !== null) return { name: m.name, kcalServ: m.kcalServ, pServ: m.pServ ?? null, cServ: m.cServ ?? null, fServ: m.fServ ?? null, serving: null, mine: true };
  if (!isFinite(k100) || k100 > 900) {
    const g = Number(m.g) || 0;
    const per = (v) => (v === null || v === undefined || !isFinite(Number(v)) ? null : Math.round(Number(v) * g) / 100);
    return { name: m.name, kcalServ: isFinite(k100) ? Math.round((k100 * g) / 100) : null, pServ: per(m.p100), cServ: per(m.c100), fServ: per(m.f100), serving: null, mine: true };
  }
  return { name: m.name, kcal100: k100, p100: m.p100 ?? null, c100: m.c100 ?? null, f100: m.f100 ?? null, serving: m.g || 100, mine: true };
}

export function searchFoods(q, mine = [], max = 12) {
  q = String(q || '').trim().toLowerCase();
  const all = [...mine.map(mineItem), ...FOODS.map((r) => ({ ...fromRow(r), mine: false }))];
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
