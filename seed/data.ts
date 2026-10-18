/**
 * The launch content, taken from Mezcalito's own menu and deals pages
 * (mezcalitobarandgrill.com, October 2026) and their public listings.
 *
 * Prices are copied exactly. Heat, fusion and tags are editorial first
 * guesses for the filters and The Selector; staff can change them in the
 * admin. Everything listed under `UNCONFIRMED` must be checked with the owner
 * before launch — their own pages contradict each other on these points.
 */
import type { ClockTime, Localized, TimeRange } from '../src/domain/types';
import type { ReservationRules } from '../src/domain/capacity';
import { draftFromPreset, type SeasonDraft } from '../src/domain/seasonPresets.ts';

const L = (en: string, es: string, fr: string, de: string): Localized => ({ en, es, fr, de });
/** Proper names (Rasta Pasta, Quesabirria, Festival) stay as they are on the menu. */
const same = (name: string): Localized => ({ en: name });
const rd = (pesos: number) => pesos * 100;

export const UNCONFIRMED = [
  'Main phone: the site says 809-959-3794, Google and Facebook say 809-959-1646, Uber Eats says 809-493-2864.',
  'Happy hour: reviews say 5–9 pm, the old footer said 2–11 pm.',
  'Karaoke night: Wednesday (old footer) or Sunday (deals page).',
  'Brunch & Bubbly hours (old footer: 11 am–3 pm).',
  'Whether the 10% service charge applies to pickup and delivery as well as dine-in.',
  'Cocktail, MEGA drink, rum punch and hookah prices (not listed anywhere).',
  'Delivery zone and fees; seating capacity and reservation windows.',
  'Exact map pin (the old site embeds 18.69218, −68.42596).',
];

export interface SeedCategory {
  id: string;
  name: Localized;
}

export interface SeedGroup {
  id: string;
  label: Localized;
  min: number;
  max: number;
  options: { id: string; label: Localized; price: number }[];
}

export interface SeedItem {
  id: string;
  category: string;
  name: Localized;
  description?: Localized;
  price?: number;
  unit?: 'each' | 'lb';
  variants?: { id: string; label: Localized; price: number }[];
  groups?: string[];
  heat?: number;
  fusion?: number;
  tags?: string[];
}

export const categories: SeedCategory[] = [
  { id: 'appetizers', name: L('Appetizers', 'Entradas', 'Entrées', 'Vorspeisen') },
  { id: 'rasta-pasta', name: same('Rasta Pasta') },
  { id: 'specialties', name: L('Specialties', 'Especialidades', 'Spécialités', 'Spezialitäten') },
  { id: 'tacos', name: L('Tacos & more', 'Tacos y más', 'Tacos & plus', 'Tacos & mehr') },
  { id: 'seafood', name: L('Seafood', 'Mariscos', 'Fruits de mer', 'Meeresfrüchte') },
  { id: 'bowls-wraps', name: L('Bowls & wraps', 'Bowls y wraps', 'Bowls & wraps', 'Bowls & Wraps') },
  { id: 'burgers', name: L('Burgers', 'Hamburguesas', 'Burgers', 'Burger') },
  { id: 'salads', name: L('Salads', 'Ensaladas', 'Salades', 'Salate') },
  { id: 'kids', name: L('Kids', 'Niños', 'Enfants', 'Kinder') },
  { id: 'sides', name: L('Sides', 'Acompañantes', 'Accompagnements', 'Beilagen') },
  { id: 'desserts', name: L('Desserts', 'Postres', 'Desserts', 'Desserts') },
  { id: 'drinks', name: L('Juices & sodas', 'Jugos y refrescos', 'Jus & sodas', 'Säfte & Softdrinks') },
];

const chicken = L('Chicken', 'Pollo', 'Poulet', 'Hähnchen');
const shrimp = L('Shrimp', 'Camarones', 'Crevettes', 'Garnelen');
const beef = L('Beef', 'Res', 'Bœuf', 'Rind');
const pork = L('Pork', 'Cerdo', 'Porc', 'Schwein');
const goat = L('Goat', 'Chivo', 'Chèvre', 'Ziege');
const oxtail = L('Oxtail', 'Rabo de res', 'Queue de bœuf', 'Ochsenschwanz');
const ackee = same('Ackee');
const curried = L('Curried', 'Al curry', 'Au curry', 'Curry');
const garlicButter = L('Garlic butter', 'Mantequilla de ajo', 'Beurre à l’ail', 'Knoblauchbutter');
const fried = L('Fried', 'Frito', 'Frit', 'Frittiert');

export const sides: { id: string; name: Localized }[] = [
  { id: 'rice-peas', name: L('Jamaican rice & peas', 'Arroz con habichuelas jamaiquino', 'Riz aux pois jamaïcain', 'Jamaikanischer Reis mit Bohnen') },
  { id: 'white-rice', name: L('White rice', 'Arroz blanco', 'Riz blanc', 'Weißer Reis') },
  { id: 'black-beans', name: L('Black beans', 'Habichuelas negras', 'Haricots noirs', 'Schwarze Bohnen') },
  { id: 'steamed-veg', name: L('Steamed vegetables', 'Vegetales al vapor', 'Légumes vapeur', 'Gedämpftes Gemüse') },
  { id: 'ripe-plantain', name: L('Ripe plantain', 'Plátano maduro', 'Banane plantain mûre', 'Reife Kochbanane') },
  { id: 'fries', name: L('French fries', 'Papas fritas', 'Frites', 'Pommes frites') },
  { id: 'tostones', name: L('Tostones (green plantain)', 'Tostones', 'Tostones (banane verte)', 'Tostones (grüne Kochbanane)') },
  { id: 'mash', name: L('Mashed potatoes', 'Puré de papas', 'Purée de pommes de terre', 'Kartoffelpüree') },
  { id: 'mac-cheese', name: L('Mac & cheese', 'Macarrones con queso', 'Mac & cheese', 'Mac & Cheese') },
  { id: 'festival', name: L('Festival (sweet fried dumpling)', 'Festival (bollito frito dulce)', 'Festival (beignet sucré frit)', 'Festival (süßes frittiertes Teigbällchen)') },
];

export const groups: SeedGroup[] = [
  {
    id: 'side',
    label: L('Side of choice', 'Acompañante a elegir', 'Accompagnement au choix', 'Beilage nach Wahl'),
    min: 1,
    max: 1,
    options: sides.map((s) => ({ id: s.id, label: s.name, price: 0 })),
  },
  {
    id: 'nacho-protein',
    label: L('Add protein', 'Agregar proteína', 'Ajouter une protéine', 'Protein dazu'),
    min: 0,
    max: 3,
    options: [
      { id: 'chicken', label: chicken, price: rd(140) },
      { id: 'shrimp', label: shrimp, price: rd(160) },
      { id: 'beef', label: beef, price: rd(170) },
    ],
  },
  {
    id: 'add-protein',
    label: L('Add protein', 'Agregar proteína', 'Ajouter une protéine', 'Protein dazu'),
    min: 0,
    max: 2,
    options: [
      { id: 'chicken', label: chicken, price: rd(140) },
      { id: 'beef', label: beef, price: rd(170) },
      { id: 'shrimp', label: shrimp, price: rd(160) },
      { id: 'ackee', label: ackee, price: rd(140) },
    ],
  },
  {
    id: 'wing-sauce',
    label: L('Sauce', 'Salsa', 'Sauce', 'Soße'),
    min: 1,
    max: 1,
    options: [
      { id: 'bbq-honey-garlic', label: L('BBQ honey garlic', 'BBQ miel y ajo', 'BBQ miel-ail', 'BBQ Honig-Knoblauch'), price: 0 },
      { id: 'buffalo', label: same('Buffalo'), price: 0 },
    ],
  },
  {
    id: 'shrimp-sauce',
    label: L('Sauce', 'Salsa', 'Sauce', 'Soße'),
    min: 1,
    max: 1,
    options: [
      { id: 'curry', label: L('Curry', 'Curry', 'Curry', 'Curry'), price: 0 },
      { id: 'sweet-chilli', label: L('Sweet chilli', 'Chile dulce', 'Piment doux', 'Süße Chili'), price: 0 },
    ],
  },
  {
    id: 'shrimp-style',
    label: L('Style', 'Estilo', 'Préparation', 'Zubereitung'),
    min: 1,
    max: 1,
    options: [
      { id: 'curried', label: curried, price: 0 },
      { id: 'garlic-butter', label: garlicButter, price: 0 },
    ],
  },
  {
    id: 'fish-style',
    label: L('Your way', 'A tu gusto', 'À votre façon', 'Nach Wunsch'),
    min: 1,
    max: 1,
    options: [
      { id: 'escovitch', label: L('Escovitch (pickled, peppery)', 'Escovitch (en escabeche picante)', 'Escovitch (mariné, poivré)', 'Escovitch (eingelegt, pfeffrig)'), price: 0 },
      { id: 'fried', label: fried, price: 0 },
      { id: 'steamed', label: L('Steamed', 'Al vapor', 'Vapeur', 'Gedämpft'), price: 0 },
      { id: 'brown-stew', label: L('Brown stewed', 'Guisado brown stew', 'Brown stew (mijoté)', 'Brown Stew (geschmort)'), price: 0 },
    ],
  },
  {
    id: 'lobster-style',
    label: L('Style', 'Estilo', 'Préparation', 'Zubereitung'),
    min: 1,
    max: 1,
    options: [
      { id: 'curried', label: curried, price: 0 },
      { id: 'garlic-butter', label: garlicButter, price: 0 },
      { id: 'fried', label: fried, price: 0 },
    ],
  },
];

export const items: SeedItem[] = [
  // ── Appetizers ────────────────────────────────────────────────────────────
  {
    id: 'ackee-saltfish-tostones', category: 'appetizers', price: rd(485), heat: 1, fusion: -1, tags: ['signature', 'seafood'],
    name: L('Ackee & saltfish tostones', 'Tostones con ackee y bacalao', 'Tostones ackee & morue', 'Tostones mit Ackee & Stockfisch'),
    description: L(
      'Jamaica’s national dish on crisp green-plantain tostones.',
      'El plato nacional de Jamaica sobre tostones crujientes.',
      'Le plat national jamaïcain sur des tostones croustillants.',
      'Jamaikas Nationalgericht auf knusprigen Tostones.',
    ),
  },
  {
    id: 'boneless-bites', category: 'appetizers', price: rd(550), heat: 0, fusion: 0,
    name: L('Boneless bites', 'Boneless', 'Bouchées de poulet', 'Boneless Bites'),
    description: L(
      'Crispy fried chicken breast in BBQ honey garlic.',
      'Pechuga de pollo frita y crujiente en BBQ de miel y ajo.',
      'Blanc de poulet frit croustillant, sauce BBQ miel-ail.',
      'Knusprig frittierte Hähnchenbrust in BBQ-Honig-Knoblauch.',
    ),
  },
  {
    id: 'wings', category: 'appetizers', price: rd(595), groups: ['wing-sauce'], heat: 1, fusion: 0,
    name: L('Wings (6)', 'Alitas (6)', 'Ailes de poulet (6)', 'Chicken Wings (6)'),
    description: L(
      'Six crispy wings, BBQ honey garlic or buffalo.',
      'Seis alitas crujientes, BBQ de miel y ajo o búfalo.',
      'Six ailes croustillantes, BBQ miel-ail ou buffalo.',
      'Sechs knusprige Wings, BBQ-Honig-Knoblauch oder Buffalo.',
    ),
  },
  {
    id: 'bacon-jalapeno-taquitos', category: 'appetizers', price: rd(499), heat: 3, fusion: 2,
    name: L('Bacon jalapeño taquitos', 'Taquitos de tocineta y jalapeño', 'Taquitos bacon-jalapeño', 'Taquitos mit Bacon & Jalapeño'),
    description: L(
      'Corn tortillas rolled with cheese, bacon and jalapeño.',
      'Tortillas de maíz enrolladas con queso, tocineta y jalapeño.',
      'Tortillas de maïs roulées, fromage, bacon et jalapeño.',
      'Gerollte Maistortillas mit Käse, Bacon und Jalapeño.',
    ),
  },
  {
    id: 'nachos', category: 'appetizers', price: rd(499), groups: ['nacho-protein'], heat: 2, fusion: 2, tags: ['vegetarian'],
    name: same('Nachos'),
    description: L(
      'Corn chips, melted cheese, pico de gallo, jalapeño.',
      'Totopos de maíz, queso derretido, pico de gallo, jalapeño.',
      'Chips de maïs, fromage fondu, pico de gallo, jalapeño.',
      'Maischips, geschmolzener Käse, Pico de Gallo, Jalapeño.',
    ),
  },
  {
    id: 'guacamole-chips', category: 'appetizers', price: rd(485), heat: 0, fusion: 2, tags: ['vegetarian'],
    name: L('Guacamole & chips', 'Guacamole con totopos', 'Guacamole & chips', 'Guacamole & Chips'),
    description: L(
      'Avocado, onion, tomato and cilantro, with corn chips.',
      'Aguacate, cebolla, tomate y cilantro, con totopos.',
      'Avocat, oignon, tomate et coriandre, avec chips de maïs.',
      'Avocado, Zwiebel, Tomate und Koriander, mit Maischips.',
    ),
  },
  {
    id: 'stamp-and-go', category: 'appetizers', price: rd(495), heat: 1, fusion: -2, tags: ['seafood', 'first-timer'],
    name: same('Stamp & Go'),
    description: L(
      'Jamaican saltfish fritters with tomato and onion.',
      'Frituras jamaiquinas de bacalao con tomate y cebolla.',
      'Beignets jamaïcains de morue, tomate et oignon.',
      'Jamaikanische Stockfisch-Krapfen mit Tomate und Zwiebel.',
    ),
  },
  {
    id: 'crispy-shrimp', category: 'appetizers', price: rd(599), groups: ['shrimp-sauce'], heat: 1, fusion: 0, tags: ['seafood'],
    name: L('Crispy shrimp', 'Camarones crujientes', 'Crevettes croustillantes', 'Knusprige Garnelen'),
    description: L(
      'With curry or sweet chilli sauce.',
      'Con salsa de curry o de chile dulce.',
      'Sauce curry ou piment doux.',
      'Mit Curry- oder süßer Chilisoße.',
    ),
  },
  {
    id: 'calamari', category: 'appetizers', price: rd(550), heat: 0, fusion: 0, tags: ['seafood'],
    name: L('Calamari', 'Calamares', 'Calamars', 'Calamari'),
    description: L(
      'Crispy fried calamari with tartar sauce.',
      'Calamares fritos crujientes con salsa tártara.',
      'Calamars frits croustillants, sauce tartare.',
      'Knusprig frittierte Calamari mit Remoulade.',
    ),
  },
  {
    id: 'loaded-fries', category: 'appetizers', price: rd(650), heat: 0, fusion: 0,
    name: L('Loaded fries', 'Papas cargadas', 'Frites garnies', 'Loaded Fries'),
    description: L(
      'Fries with melted cheese, bacon and chicken.',
      'Papas fritas con queso derretido, tocineta y pollo.',
      'Frites, fromage fondu, bacon et poulet.',
      'Pommes mit geschmolzenem Käse, Bacon und Hähnchen.',
    ),
  },

  // ── Rasta Pasta ───────────────────────────────────────────────────────────
  {
    id: 'rasta-pasta', category: 'rasta-pasta', heat: 1, fusion: -1, tags: ['signature', 'first-timer'],
    name: same('Rasta Pasta'),
    description: L(
      'Penne in creamy Alfredo with bell peppers, onion and parmesan. Guests’ favourite: oxtail.',
      'Penne en salsa Alfredo con pimientos, cebolla y parmesano. La favorita: rabo de res.',
      'Penne sauce Alfredo, poivrons, oignon et parmesan. La préférée : queue de bœuf.',
      'Penne in Alfredosoße mit Paprika, Zwiebel und Parmesan. Gästeliebling: Ochsenschwanz.',
    ),
    variants: [
      { id: 'chicken', label: chicken, price: rd(1199) },
      { id: 'shrimp', label: shrimp, price: rd(1399) },
      { id: 'goat', label: goat, price: rd(1495) },
      { id: 'oxtail', label: oxtail, price: rd(1595) },
      { id: 'chicken-shrimp', label: L('Chicken & shrimp', 'Pollo y camarones', 'Poulet & crevettes', 'Hähnchen & Garnelen'), price: rd(1699) },
      { id: 'lobster', label: L('Lobster (seasonal)', 'Langosta (de temporada)', 'Langouste (de saison)', 'Languste (saisonal)'), price: rd(1995) },
    ],
  },

  // ── Specialties ───────────────────────────────────────────────────────────
  {
    id: 'jerk', category: 'specialties', groups: ['side'], heat: 4, fusion: -2, tags: ['signature'],
    name: L('Jamaican jerk', 'Jerk jamaiquino', 'Jerk jamaïcain', 'Jamaikanisches Jerk'),
    description: L(
      'Green seasoning, pimento and habanero heat. With a side of your choice.',
      'Sazón verde, pimienta de Jamaica y picante de ají. Con acompañante a elegir.',
      'Assaisonnement vert, piment de la Jamaïque et habanero. Avec un accompagnement au choix.',
      'Grüne Würzpaste, Piment und Habanero-Schärfe. Mit Beilage nach Wahl.',
    ),
    variants: [
      { id: 'chicken', label: chicken, price: rd(1199) },
      { id: 'pork', label: pork, price: rd(1295) },
    ],
  },
  {
    id: 'curried-goat', category: 'specialties', price: rd(1595), groups: ['side'], heat: 3, fusion: -2,
    name: L('Curried goat', 'Chivo al curry', 'Cabri au curry', 'Ziegencurry'),
    description: L(
      'Slow-cooked in Jamaican curry with green seasoning and hot pepper. With a side of your choice.',
      'Cocido lento en curry jamaiquino con sazón verde y ají picante. Con acompañante a elegir.',
      'Mijoté au curry jamaïcain, assaisonnement vert et piment. Avec un accompagnement au choix.',
      'Langsam gegart in jamaikanischem Curry mit grüner Würze und Chili. Mit Beilage nach Wahl.',
    ),
  },
  {
    id: 'braised-oxtail', category: 'specialties', price: rd(1799), groups: ['side'], heat: 1, fusion: -2, tags: ['signature', 'first-timer'],
    name: L('Braised oxtail', 'Rabo de res guisado', 'Queue de bœuf braisée', 'Geschmorter Ochsenschwanz'),
    description: L(
      'Braised oxtail with beans, onion, peppers and pimento — the one Punta Cana talks about. With a side of your choice.',
      'Rabo de res guisado con habichuelas, cebolla, pimientos y pimienta de Jamaica — del que habla Punta Cana. Con acompañante a elegir.',
      'Queue de bœuf braisée, haricots, oignon, poivrons et piment de la Jamaïque — celle dont parle Punta Cana. Avec un accompagnement au choix.',
      'Geschmorter Ochsenschwanz mit Bohnen, Zwiebel, Paprika und Piment — der, von dem Punta Cana spricht. Mit Beilage nach Wahl.',
    ),
  },
  {
    id: 'fajitas', category: 'specialties', heat: 1, fusion: 2, tags: ['vegetarian-option'],
    name: same('Fajitas'),
    description: L(
      'Sizzling peppers and onion with flour tortillas, cheese, sour cream, beans and guacamole.',
      'Pimientos y cebolla a la plancha con tortillas de harina, queso, crema agria, frijoles y guacamole.',
      'Poivrons et oignons grésillants, tortillas de blé, fromage, crème aigre, haricots et guacamole.',
      'Brutzelnde Paprika und Zwiebeln mit Weizentortillas, Käse, Sauerrahm, Bohnen und Guacamole.',
    ),
    variants: [
      { id: 'chicken', label: chicken, price: rd(699) },
      { id: 'shrimp', label: shrimp, price: rd(799) },
      { id: 'beef', label: beef, price: rd(825) },
      { id: 'vegetables', label: L('Vegetables', 'Vegetales', 'Légumes', 'Gemüse'), price: rd(599) },
    ],
  },
  {
    id: 'fried-chicken', category: 'specialties', price: rd(695), groups: ['side'], heat: 0, fusion: -1,
    name: L('Fried chicken (3 pcs)', 'Pollo frito (3 piezas)', 'Poulet frit (3 morceaux)', 'Brathähnchen (3 Stück)'),
    description: L(
      'Three pieces, battered and crispy. With a side of your choice.',
      'Tres piezas, empanizadas y crujientes. Con acompañante a elegir.',
      'Trois morceaux panés et croustillants. Avec un accompagnement au choix.',
      'Drei Stück, paniert und knusprig. Mit Beilage nach Wahl.',
    ),
  },

  // ── Tacos & more ──────────────────────────────────────────────────────────
  {
    id: 'beef-taco', category: 'tacos', price: rd(495), heat: 1, fusion: 2,
    name: L('Beef taco', 'Taco de res', 'Taco au bœuf', 'Rindfleisch-Taco'),
    description: L(
      'Tortilla, cheese, beef, guacamole, onion and cilantro.',
      'Tortilla, queso, res, guacamole, cebolla y cilantro.',
      'Tortilla, fromage, bœuf, guacamole, oignon et coriandre.',
      'Tortilla, Käse, Rind, Guacamole, Zwiebel und Koriander.',
    ),
  },
  {
    id: 'chicken-taco', category: 'tacos', price: rd(350), heat: 0, fusion: 1,
    name: L('Chicken taco', 'Taco de pollo', 'Taco au poulet', 'Hähnchen-Taco'),
    description: L(
      'Tortilla, cheese, chicken, pico de gallo, lettuce and garlic mayo.',
      'Tortilla, queso, pollo, pico de gallo, lechuga y mayonesa de ajo.',
      'Tortilla, fromage, poulet, pico de gallo, laitue et mayo à l’ail.',
      'Tortilla, Käse, Hähnchen, Pico de Gallo, Salat und Knoblauchmayo.',
    ),
  },
  {
    id: 'oxtail-taco', category: 'tacos', price: rd(495), heat: 1, fusion: 0, tags: ['signature', 'first-timer'],
    name: L('Oxtail taco', 'Taco de rabo de res', 'Taco à la queue de bœuf', 'Ochsenschwanz-Taco'),
    description: L(
      'Shredded braised oxtail, cheese and slaw in a tortilla — Jamaica and Mexico in one bite.',
      'Rabo guisado deshilachado, queso y ensalada de col — Jamaica y México en un bocado.',
      'Queue de bœuf effilochée, fromage et coleslaw — la Jamaïque et le Mexique en une bouchée.',
      'Gezupfter Ochsenschwanz, Käse und Krautsalat — Jamaika und Mexiko in einem Bissen.',
    ),
  },
  {
    id: 'jerk-pork-taco', category: 'tacos', price: rd(390), heat: 3, fusion: 0, tags: ['signature'],
    name: L('Jerk pork taco', 'Taco de cerdo jerk', 'Taco au porc jerk', 'Jerk-Schwein-Taco'),
    description: L(
      'Jerk pork, cheese, pineapple and caramelized onion.',
      'Cerdo jerk, queso, piña y cebolla caramelizada.',
      'Porc jerk, fromage, ananas et oignon caramélisé.',
      'Jerk-Schwein, Käse, Ananas und karamellisierte Zwiebel.',
    ),
  },
  {
    id: 'shrimp-taco', category: 'tacos', price: rd(485), heat: 1, fusion: 1, tags: ['seafood'],
    name: L('Shrimp taco', 'Taco de camarones', 'Taco aux crevettes', 'Garnelen-Taco'),
    description: L(
      'Shrimp, cheese, mango, pico de gallo and a mango drizzle.',
      'Camarones, queso, mango, pico de gallo y salsa de mango.',
      'Crevettes, fromage, mangue, pico de gallo et filet de sauce mangue.',
      'Garnelen, Käse, Mango, Pico de Gallo und Mangosoße.',
    ),
  },
  {
    id: 'curried-goat-taco', category: 'tacos', price: rd(389), heat: 3, fusion: 0,
    name: L('Curried goat taco', 'Taco de chivo al curry', 'Taco au cabri curry', 'Ziegencurry-Taco'),
    description: L(
      'Corn tortilla, curried goat, cheese, onion and cilantro.',
      'Tortilla de maíz, chivo al curry, queso, cebolla y cilantro.',
      'Tortilla de maïs, cabri au curry, fromage, oignon et coriandre.',
      'Maistortilla, Ziegencurry, Käse, Zwiebel und Koriander.',
    ),
  },
  {
    id: 'quesabirria', category: 'tacos', price: rd(595), heat: 2, fusion: 2, tags: ['signature'],
    name: same('Quesabirria'),
    description: L(
      'Three corn tortillas crisped with beef birria and cheese, onion and cilantro.',
      'Tres tortillas de maíz doradas con birria de res, queso, cebolla y cilantro.',
      'Trois tortillas de maïs dorées, birria de bœuf, fromage, oignon et coriandre.',
      'Drei knusprige Maistortillas mit Rinder-Birria, Käse, Zwiebel und Koriander.',
    ),
  },
  {
    id: 'quesadillas', category: 'tacos', heat: 0, fusion: 2, tags: ['vegetarian-option'],
    name: same('Quesadillas'),
    description: L(
      'Flour tortilla, cheese, pico de gallo, sour cream and guacamole.',
      'Tortilla de harina, queso, pico de gallo, crema agria y guacamole.',
      'Tortilla de blé, fromage, pico de gallo, crème aigre et guacamole.',
      'Weizentortilla, Käse, Pico de Gallo, Sauerrahm und Guacamole.',
    ),
    variants: [
      { id: 'cheese', label: L('Cheese', 'Queso', 'Fromage', 'Käse'), price: rd(490) },
      { id: 'chicken', label: chicken, price: rd(565) },
      { id: 'pork', label: pork, price: rd(575) },
      { id: 'shrimp', label: shrimp, price: rd(585) },
      { id: 'beef', label: beef, price: rd(595) },
    ],
  },

  // ── Seafood ───────────────────────────────────────────────────────────────
  {
    id: 'shrimp-ceviche', category: 'seafood', price: rd(795), heat: 1, fusion: 1, tags: ['seafood', 'signature'],
    name: L('Shrimp ceviche', 'Ceviche de camarones', 'Ceviche de crevettes', 'Garnelen-Ceviche'),
    description: L(
      'Shrimp cured in lime with onion, tomato and cilantro.',
      'Camarones curados en limón con cebolla, tomate y cilantro.',
      'Crevettes marinées au citron vert, oignon, tomate et coriandre.',
      'In Limette gegarte Garnelen mit Zwiebel, Tomate und Koriander.',
    ),
  },
  {
    id: 'saucy-shrimp', category: 'seafood', price: rd(985), groups: ['shrimp-style', 'side'], heat: 2, fusion: -1, tags: ['seafood'],
    name: L('Saucy shrimp', 'Camarones en salsa', 'Crevettes en sauce', 'Garnelen in Soße'),
    description: L(
      'Curried or in garlic butter. With a side of your choice.',
      'Al curry o en mantequilla de ajo. Con acompañante a elegir.',
      'Au curry ou au beurre à l’ail. Avec un accompagnement au choix.',
      'Curry oder Knoblauchbutter. Mit Beilage nach Wahl.',
    ),
  },
  {
    id: 'fish-your-way', category: 'seafood', price: rd(1450), unit: 'lb', groups: ['fish-style', 'side'], heat: 2, fusion: -2, tags: ['seafood'],
    name: L('Fish your way', 'Pescado a tu gusto', 'Poisson à votre façon', 'Fisch nach Wunsch'),
    description: L(
      'Whole fish, priced by the pound: escovitch, fried, steamed or brown stewed. With a side of your choice.',
      'Pescado entero, por libra: escovitch, frito, al vapor o guisado. Con acompañante a elegir.',
      'Poisson entier, à la livre : escovitch, frit, vapeur ou brown stew. Avec un accompagnement au choix.',
      'Ganzer Fisch, nach Pfund: Escovitch, frittiert, gedämpft oder Brown Stew. Mit Beilage nach Wahl.',
    ),
  },
  {
    id: 'lobster', category: 'seafood', price: rd(1985), unit: 'lb', groups: ['lobster-style', 'side'], heat: 1, fusion: -1, tags: ['seafood'],
    name: L('Lobster', 'Langosta', 'Langouste', 'Languste'),
    description: L(
      'By the pound: curried, garlic butter or fried. With a side of your choice.',
      'Por libra: al curry, en mantequilla de ajo o frita. Con acompañante a elegir.',
      'À la livre : au curry, au beurre à l’ail ou frite. Avec un accompagnement au choix.',
      'Nach Pfund: Curry, Knoblauchbutter oder frittiert. Mit Beilage nach Wahl.',
    ),
  },

  // ── Bowls & wraps ─────────────────────────────────────────────────────────
  {
    id: 'fusion-bowl', category: 'bowls-wraps', price: rd(535), groups: ['add-protein'], heat: 2, fusion: 0, tags: ['vegetarian'],
    name: L('Fusion bowl', 'Fusion bowl', 'Bowl fusion', 'Fusion Bowl'),
    description: L(
      'White rice, pico de gallo, sweet corn, beans, guacamole, jalapeño and cilantro. Add ackee to go full fusion.',
      'Arroz blanco, pico de gallo, maíz dulce, frijoles, guacamole, jalapeño y cilantro. Agrega ackee para la fusión completa.',
      'Riz blanc, pico de gallo, maïs doux, haricots, guacamole, jalapeño et coriandre. Ajoutez de l’ackee pour la fusion totale.',
      'Weißer Reis, Pico de Gallo, Mais, Bohnen, Guacamole, Jalapeño und Koriander. Mit Ackee wird es echte Fusion.',
    ),
  },
  {
    id: 'jerk-chicken-pineapple-wrap', category: 'bowls-wraps', price: rd(599), heat: 2, fusion: 0,
    name: L('Jerk chicken pineapple wrap', 'Wrap de pollo jerk con piña', 'Wrap poulet jerk & ananas', 'Jerk-Hähnchen-Ananas-Wrap'),
    description: L(
      'Flour tortilla, jerk chicken, pineapple, lettuce, cheese and ranch.',
      'Tortilla de harina, pollo jerk, piña, lechuga, queso y ranch.',
      'Tortilla de blé, poulet jerk, ananas, laitue, fromage et sauce ranch.',
      'Weizentortilla, Jerk-Hähnchen, Ananas, Salat, Käse und Ranch.',
    ),
  },
  {
    id: 'burrito', category: 'bowls-wraps', heat: 1, fusion: 2, tags: ['vegetarian-option'],
    name: same('Burrito'),
    description: L(
      'White rice, pico de gallo, sweet corn, beans, guacamole, jalapeño and cilantro.',
      'Arroz blanco, pico de gallo, maíz dulce, frijoles, guacamole, jalapeño y cilantro.',
      'Riz blanc, pico de gallo, maïs doux, haricots, guacamole, jalapeño et coriandre.',
      'Weißer Reis, Pico de Gallo, Mais, Bohnen, Guacamole, Jalapeño und Koriander.',
    ),
    variants: [
      { id: 'veggie', label: L('Veggie', 'Vegetariano', 'Végétarien', 'Vegetarisch'), price: rd(499) },
      { id: 'chicken', label: chicken, price: rd(599) },
      { id: 'shrimp', label: shrimp, price: rd(700) },
      { id: 'beef', label: beef, price: rd(749) },
    ],
  },

  // ── Burgers ───────────────────────────────────────────────────────────────
  { id: 'classic-burger', category: 'burgers', price: rd(569), name: L('Classic burger', 'Hamburguesa clásica', 'Burger classique', 'Klassischer Burger') },
  { id: 'bacon-bbq-burger', category: 'burgers', price: rd(600), name: L('Bacon BBQ burger', 'Hamburguesa BBQ con tocineta', 'Burger bacon BBQ', 'Bacon-BBQ-Burger') },
  {
    id: 'crispy-chicken-sandwich', category: 'burgers', price: rd(490),
    name: L('Crispy chicken sandwich', 'Sándwich de pollo crujiente', 'Sandwich poulet croustillant', 'Crispy-Chicken-Sandwich'),
    description: L('Fries included.', 'Incluye papas fritas.', 'Frites incluses.', 'Mit Pommes.'),
  },

  // ── Salads ────────────────────────────────────────────────────────────────
  { id: 'garden-salad', category: 'salads', price: rd(499), groups: ['add-protein'], tags: ['vegetarian'], name: L('Garden salad', 'Ensalada verde', 'Salade du jardin', 'Gartensalat') },
  { id: 'caesar-salad', category: 'salads', price: rd(390), groups: ['add-protein'], name: L('Caesar salad', 'Ensalada César', 'Salade César', 'Caesar Salad') },

  // ── Kids ──────────────────────────────────────────────────────────────────
  {
    id: 'chicken-tenders', category: 'kids', price: rd(350), tags: ['kids'],
    name: L('Chicken tenders', 'Tiras de pollo', 'Aiguillettes de poulet', 'Hähnchenstreifen'),
    description: L('Fries included.', 'Incluye papas fritas.', 'Frites incluses.', 'Mit Pommes.'),
  },
  {
    id: 'fish-fingers', category: 'kids', price: rd(450), tags: ['kids', 'seafood'],
    name: L('Fish fingers', 'Dedos de pescado', 'Bâtonnets de poisson', 'Fischstäbchen'),
    description: L('Fries included.', 'Incluye papas fritas.', 'Frites incluses.', 'Mit Pommes.'),
  },

  // ── Sides (also sold on their own) ────────────────────────────────────────
  ...sides.map(
    (s): SeedItem => ({
      id: `side-${s.id}`,
      category: 'sides',
      price: rd(200),
      name: s.name,
      fusion: s.id === 'rice-peas' || s.id === 'festival' ? -2 : 0,
      tags: s.id === 'festival' ? ['first-timer', 'vegetarian'] : ['vegetarian'],
    }),
  ),

  // ── Desserts ──────────────────────────────────────────────────────────────
  {
    id: 'droodie-cookies', category: 'desserts',
    name: L('Droodie cookies', 'Galletas Droodie', 'Cookies Droodie', 'Droodie Cookies'),
    variants: [
      { id: 'chocolate-chip', label: L('Chocolate chip (2)', 'Chispas de chocolate (2)', 'Pépites de chocolat (2)', 'Schokostückchen (2)'), price: rd(300) },
      { id: 'carrot-cake', label: L('Carrot cake (2)', 'Bizcocho de zanahoria (2)', 'Carrot cake (2)', 'Karottenkuchen (2)'), price: rd(300) },
      { id: 'guava-crunch', label: L('Guava crunch (4)', 'Guayaba crujiente (4)', 'Goyave croquante (4)', 'Guaven-Crunch (4)'), price: rd(300) },
    ],
  },
  { id: 'vanilla-flan', category: 'desserts', price: rd(450), fusion: 2, name: L('Vanilla flan', 'Flan de vainilla', 'Flan à la vanille', 'Vanille-Flan') },
  { id: 'jamaican-bread-pudding', category: 'desserts', price: rd(529), fusion: -2, name: L('Jamaican bread pudding', 'Budín de pan jamaiquino', 'Pudding au pain jamaïcain', 'Jamaikanischer Brotpudding') },

  // ── Juices & sodas ────────────────────────────────────────────────────────
  ...(
    [
      ['strawberry', L('Strawberry juice', 'Jugo de fresa', 'Jus de fraise', 'Erdbeersaft'), 200],
      ['passionfruit', L('Passion fruit juice', 'Jugo de chinola', 'Jus de fruit de la passion', 'Maracujasaft'), 200],
      ['mango', L('Mango juice', 'Jugo de mango', 'Jus de mangue', 'Mangosaft'), 200],
      ['orange', L('Orange juice', 'Jugo de naranja', 'Jus d’orange', 'Orangensaft'), 200],
      ['pineapple', L('Pineapple juice', 'Jugo de piña', 'Jus d’ananas', 'Ananassaft'), 200],
      ['cranberry', L('Cranberry juice', 'Jugo de arándano', 'Jus de canneberge', 'Cranberrysaft'), 250],
      ['coca-cola', same('Coca-Cola'), 100],
      ['coca-cola-zero', same('Coca-Cola Zero'), 100],
      ['sprite', same('Sprite'), 100],
      ['ginger-ale', same('Ginger Ale'), 100],
    ] as const
  ).map(([id, name, price]): SeedItem => ({ id: `drink-${id}`, category: 'drinks', price: rd(price), name, tags: ['drink', 'vegetarian'] })),
];

export interface SeedSpecial {
  id: string;
  title: Localized;
  body: Localized;
  days: number[];
  start: ClockTime;
  end: ClockTime;
  price?: number;
  cta: 'order' | 'book' | 'none';
  itemIds?: string[];
  flyer: { bg: string; ink: string; sticker?: string };
}

export const specials: SeedSpecial[] = [
  {
    id: 'happy-hour', days: [], start: '17:00', end: '21:00', price: rd(175), cta: 'none',
    title: L('Happy hour', 'Happy hour', 'Happy hour', 'Happy Hour'),
    body: L('Half-off margaritas and martinis, every day.', 'Margaritas y martinis a mitad de precio, todos los días.', 'Margaritas et martinis à moitié prix, tous les jours.', 'Margaritas und Martinis zum halben Preis, jeden Tag.'),
    flyer: { bg: 'sunset', ink: 'ink', sticker: '½' },
  },
  {
    id: 'taco-tuesday', days: [2], start: '08:00', end: '24:00', price: rd(199), cta: 'order',
    itemIds: ['shrimp-taco', 'beef-taco', 'chicken-taco', 'oxtail-taco'],
    title: L('Taco Tuesday', 'Martes de tacos', 'Mardi tacos', 'Taco-Dienstag'),
    body: L('Shrimp, beef, chicken or oxtail tacos, all day.', 'Tacos de camarón, res, pollo o rabo, todo el día.', 'Tacos crevettes, bœuf, poulet ou queue de bœuf, toute la journée.', 'Tacos mit Garnelen, Rind, Hähnchen oder Ochsenschwanz, den ganzen Tag.'),
    flyer: { bg: 'hibiscus', ink: 'cream', sticker: 'RD$199' },
  },
  {
    id: 'wingsday', days: [3], start: '08:00', end: '24:00', price: rd(899), cta: 'order', itemIds: ['wings'],
    title: L('Wingsday Wednesday', 'Miércoles de alitas', 'Mercredi ailes', 'Wings-Mittwoch'),
    body: L('The wings deal, all Wednesday.', 'La oferta de alitas, todo el miércoles.', 'L’offre ailes de poulet, tout le mercredi.', 'Das Wings-Angebot, den ganzen Mittwoch.'),
    flyer: { bg: 'gold', ink: 'ink' },
  },
  {
    id: 'ladies-night', days: [4], start: '18:00', end: '24:00', price: rd(999), cta: 'book', itemIds: ['rasta-pasta'],
    title: L('Ladies Night', 'Noche de chicas', 'Soirée filles', 'Ladies Night'),
    body: L('Rasta Pasta and a glass of wine.', 'Rasta Pasta y una copa de vino.', 'Rasta Pasta et un verre de vin.', 'Rasta Pasta und ein Glas Wein.'),
    flyer: { bg: 'mezcal', ink: 'cream', sticker: '♀' },
  },
  {
    id: 'unlimited-hookah', days: [6], start: '18:00', end: '24:00', price: rd(2999), cta: 'book',
    title: L('Unlimited hookah', 'Hookah ilimitado', 'Chicha à volonté', 'Unbegrenzt Shisha'),
    body: L('Every flavour, all night Saturday.', 'Todos los sabores, toda la noche del sábado.', 'Tous les parfums, tout le samedi soir.', 'Alle Sorten, die ganze Samstagnacht.'),
    flyer: { bg: 'ink', ink: 'lagoon' },
  },
  {
    id: 'brunch-bubbly', days: [0], start: '11:00', end: '15:00', price: rd(699), cta: 'book',
    title: L('Brunch & Bubbly', 'Brunch & burbujas', 'Brunch & bulles', 'Brunch & Bubbles'),
    body: L('Sunday brunch with bottomless mimosas.', 'Brunch del domingo con mimosas ilimitadas.', 'Brunch du dimanche avec mimosas à volonté.', 'Sonntagsbrunch mit unbegrenzt Mimosas.'),
    flyer: { bg: 'lagoon', ink: 'ink' },
  },
  {
    id: 'rum-reggae', days: [0], start: '18:00', end: '22:00', price: rd(350), cta: 'book',
    title: L('Rum & Reggae Sunday', 'Domingo de ron y reggae', 'Dimanche rhum & reggae', 'Rum & Reggae Sonntag'),
    body: L('Reggae on the sound system, karaoke and half-off rum punch.', 'Reggae en el sound system, karaoke y rum punch a mitad de precio.', 'Reggae sur le sound system, karaoké et punch au rhum à moitié prix.', 'Reggae vom Soundsystem, Karaoke und Rum Punch zum halben Preis.'),
    flyer: { bg: 'jungle', ink: 'gold', sticker: 'One Love' },
  },
];

export interface SeedSeason extends SeasonDraft {
  published: boolean;
}

// Seasons start from the presets the admin offers; Día de Muertos is live
// for launch, Christmas waits as a draft.
export const seasons: SeedSeason[] = [
  { ...draftFromPreset('dia-de-muertos', '2026-10-18')!, published: true },
  { ...draftFromPreset('navidad-caribena', '2026-10-18')!, published: false },
];

const daily = (open: ClockTime, close: ClockTime): TimeRange[][] => Array.from({ length: 7 }, () => [{ open, close }]);

export const settings = {
  hours: daily('08:00', '24:00'),
  closures: [],
  contact: {
    phone: '+18099591646',
    whatsapp: '+18092120782',
    email: 'info@mezcalitobarandgrill.com',
    confirmed: false,
  },
  address: {
    street: 'Calle Pedro Mir',
    locality: 'Bávaro',
    region: 'La Altagracia',
    country: 'DO',
    lat: 18.69218,
    lng: -68.42596,
    note: L('One block from the beach', 'A una cuadra de la playa', 'À une rue de la plage', 'Einen Block vom Strand'),
  },
  social: {
    instagram: 'https://www.instagram.com/mezcalitord/',
    tiktok: 'https://www.tiktok.com/@mezcalitodomrep',
    facebook: 'https://www.facebook.com/profile.php?id=100064275751852',
    ubereats: 'https://www.ubereats.com/do-en/store/mezcalito-bar-and-grill-punta-cana/Wqf2ad_DXYeWDoK7TzYL-w',
  },
  // Shown on the home page as written; staff update it from Google.
  reviewsSummary: { rating: 4.6, count: 1150, source: 'Google', asOf: '2026-10' },
  pricing: {
    itbisRate: 0.18,
    serviceRate: { dine_in: 0.1, pickup: 0.1, delivery: 0.1 },
    usdRate: 63,
    weightStepLb: 0.5,
    minWeightLb: 1,
    maxQtyPerLine: 20,
  },
  // Empty until the owner sets the zone: delivery then falls back to Uber Eats.
  deliveryZones: [],
  reservations: {
    slotMinutes: 30,
    seatingMinutes: 90,
    capacity: 40,
    maxParty: 12,
    minLeadMinutes: 60,
    maxDaysAhead: 60,
    windows: daily('12:00', '22:00'),
    overrides: [],
  } satisfies ReservationRules,
};
