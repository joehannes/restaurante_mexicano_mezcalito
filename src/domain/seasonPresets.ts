/**
 * Ready-made rotations staff can start a season from: the dates, a palette,
 * the hero copy and a first page, in all four languages. Everything is a
 * starting point — the season editor changes any of it before publishing.
 */
import type { Localized } from './types';

export type SeasonBlock =
  | { type: 'story'; title: Localized; body: Localized }
  | { type: 'dishes'; title: Localized; itemIds: string[] }
  | { type: 'nights'; specialIds: string[] }
  | { type: 'gallery'; images: string[] };

export interface SeasonDraft {
  slug: string;
  name: Localized;
  startsOn: string;
  endsOn: string;
  priority: number;
  tokens: Record<string, string>;
  hero: { kicker: Localized; headline: Localized; body: Localized; cta: 'order' | 'book' };
  blocks: SeasonBlock[];
}

const L = (en: string, es: string, fr: string, de: string): Localized => ({ en, es, fr, de });

interface Preset extends Omit<SeasonDraft, 'startsOn' | 'endsOn'> {
  /** MM-DD; an end before the start falls in the next year. */
  from: string;
  to: string;
}

const signatures = L('On the menu this season', 'En el menú esta temporada', 'Au menu cette saison', 'Diese Saison auf der Karte');

export const PRESETS: Preset[] = [
  {
    slug: 'dia-de-muertos',
    from: '10-24',
    to: '11-03',
    priority: 10,
    name: L('Día de Muertos', 'Día de Muertos', 'Día de Muertos', 'Día de Muertos'),
    tokens: { '--c-gold': '#f59f0b', '--c-hibiscus': '#e8287f', '--c-mezcal': '#5b2a86', '--c-cream': '#fff3df' },
    hero: {
      kicker: L('New rotation', 'Nueva rotación', 'Nouvelle rotation', 'Neue Rotation'),
      headline: L('Half calavera. Whole heart.', 'Media calavera. Corazón entero.', 'Mi-calavera. Tout le cœur.', 'Halb Calavera. Ganzes Herz.'),
      body: L(
        'Marigolds on the terrace, candles on the bar and the sound system playing for the ones we remember. 1–2 November.',
        'Cempasúchil en la terraza, velas en la barra y el sound system tocando por los que recordamos. 1–2 de noviembre.',
        'Des œillets d’Inde sur la terrasse, des bougies au bar et le sound system pour ceux dont on se souvient. 1–2 novembre.',
        'Tagetes auf der Terrasse, Kerzen an der Bar und das Soundsystem für die, an die wir denken. 1.–2. November.',
      ),
      cta: 'book',
    },
    blocks: [
      {
        type: 'story',
        title: L('Remember them loud', 'Recordarlos a todo volumen', 'Se souvenir en musique', 'Laut erinnern'),
        body: L(
          'In Mexico the dead come home for two nights, and the living cook their favourite dishes. Bring a photo for the ofrenda by the DJ booth — we light a candle for every one.',
          'En México los muertos vuelven a casa dos noches y los vivos cocinan sus platos favoritos. Trae una foto para la ofrenda junto a la cabina del DJ — encendemos una vela por cada una.',
          'Au Mexique, les morts rentrent à la maison deux nuits, et les vivants cuisinent leurs plats préférés. Apporte une photo pour l’ofrenda près de la cabine du DJ — on allume une bougie pour chacune.',
          'In Mexiko kommen die Toten für zwei Nächte nach Hause, und die Lebenden kochen ihre Lieblingsgerichte. Bring ein Foto für die Ofrenda am DJ-Pult mit — für jedes zünden wir eine Kerze an.',
        ),
      },
      { type: 'dishes', title: signatures, itemIds: ['quesabirria', 'braised-oxtail', 'jerk-pork-taco', 'vanilla-flan'] },
    ],
  },
  {
    slug: 'navidad-caribena',
    from: '12-01',
    to: '01-06',
    priority: 5,
    name: L('Caribbean Christmas', 'Navidad Caribeña', 'Noël caribéen', 'Karibische Weihnacht'),
    tokens: { '--c-hibiscus': '#d7263d', '--c-jungle': '#1f7a3a', '--c-gold': '#f2c14e' },
    hero: {
      kicker: L('Holiday rotation', 'Rotación navideña', 'Rotation des fêtes', 'Festtags-Rotation'),
      headline: L('Sorrel season is here.', 'Llegó la temporada de sorrel.', 'C’est la saison du sorrel.', 'Sorrel-Saison ist da.'),
      body: L(
        'Jamaican sorrel, Mexican ponche and a Christmas line-up on the sound system.',
        'Sorrel jamaiquino, ponche mexicano y una programación navideña en el sound system.',
        'Sorrel jamaïcain, ponche mexicain et une programmation de Noël sur le sound system.',
        'Jamaikanischer Sorrel, mexikanischer Ponche und ein Weihnachts-Line-up vom Soundsystem.',
      ),
      cta: 'book',
    },
    blocks: [
      {
        type: 'story',
        title: L('Same flower, two Christmases', 'La misma flor, dos Navidades', 'Même fleur, deux Noëls', 'Eine Blüte, zwei Weihnachten'),
        body: L(
          'Jamaica drinks sorrel at Christmas; Mexico calls the same hibiscus jamaica. We pour both — and the company Christmas party is on us to plan.',
          'Jamaica toma sorrel en Navidad; México llama jamaica a la misma flor. Servimos las dos — y la fiesta de Navidad de tu empresa la organizamos nosotros.',
          'La Jamaïque boit du sorrel à Noël ; le Mexique appelle jamaica le même hibiscus. On sert les deux — et on organise ta fête de fin d’année.',
          'Jamaika trinkt zu Weihnachten Sorrel, Mexiko nennt denselben Hibiskus Jamaica. Wir schenken beides aus — und planen eure Firmen-Weihnachtsfeier.',
        ),
      },
      { type: 'dishes', title: signatures, itemIds: ['curried-goat', 'braised-oxtail', 'jamaican-bread-pudding'] },
    ],
  },
  {
    slug: 'carnaval',
    from: '02-01',
    to: '02-28',
    priority: 6,
    name: L('Carnaval', 'Carnaval', 'Carnaval', 'Karneval'),
    tokens: { '--c-hibiscus': '#ff2e88', '--c-lagoon': '#00b4d8', '--c-gold': '#ffd23f', '--c-mezcal': '#3a0ca3' },
    hero: {
      kicker: L('Carnival rotation', 'Rotación de carnaval', 'Rotation carnaval', 'Karnevals-Rotation'),
      headline: L('Masks on. Volume up.', 'Caretas puestas. Volumen arriba.', 'Masques en place. Volume à fond.', 'Masken auf. Lauter.'),
      body: L(
        'Every February Sunday the Dominican carnival takes the streets — and the party ends on our terrace.',
        'Cada domingo de febrero el carnaval dominicano toma las calles — y la fiesta termina en nuestra terraza.',
        'Chaque dimanche de février, le carnaval dominicain prend la rue — et la fête finit sur notre terrasse.',
        'Jeden Februarsonntag zieht der dominikanische Karneval durch die Straßen — und die Party endet auf unserer Terrasse.',
      ),
      cta: 'book',
    },
    blocks: [{ type: 'nights', specialIds: ['rum-reggae', 'unlimited-hookah'] }],
  },
  {
    slug: 'reggae-month',
    from: '02-01',
    to: '02-28',
    priority: 4,
    name: L('Reggae Month', 'Mes del Reggae', 'Mois du reggae', 'Reggae-Monat'),
    tokens: { '--c-jungle': '#0f8a3c', '--c-gold': '#ffcc00', '--c-hibiscus': '#e63946' },
    hero: {
      kicker: L('February is Reggae Month', 'Febrero es el Mes del Reggae', 'Février, mois du reggae', 'Februar ist Reggae-Monat'),
      headline: L('One love, all month.', 'One love, todo el mes.', 'One love, tout le mois.', 'One love, den ganzen Monat.'),
      body: L(
        'Jamaica celebrates its music every February. So do we: roots on Sundays, dancehall on Saturdays.',
        'Jamaica celebra su música cada febrero. Nosotros también: roots los domingos, dancehall los sábados.',
        'La Jamaïque fête sa musique chaque février. Nous aussi : roots le dimanche, dancehall le samedi.',
        'Jamaika feiert jeden Februar seine Musik. Wir auch: Roots am Sonntag, Dancehall am Samstag.',
      ),
      cta: 'book',
    },
    blocks: [{ type: 'nights', specialIds: ['rum-reggae'] }],
  },
  {
    slug: 'cinco-de-mayo',
    from: '04-28',
    to: '05-05',
    priority: 6,
    name: L('Cinco de Mayo', 'Cinco de Mayo', 'Cinco de Mayo', 'Cinco de Mayo'),
    tokens: { '--c-jungle': '#006847', '--c-hibiscus': '#ce1126', '--c-gold': '#f4b400' },
    hero: {
      kicker: L('Mexico week', 'Semana mexicana', 'Semaine mexicaine', 'Mexiko-Woche'),
      headline: L('Tacos, margaritas, mariachi energy.', 'Tacos, margaritas y energía de mariachi.', 'Tacos, margaritas, énergie mariachi.', 'Tacos, Margaritas, Mariachi-Energie.'),
      body: L(
        'A week of the Mexican half of the menu, turned all the way up.',
        'Una semana con la mitad mexicana del menú a todo volumen.',
        'Une semaine pour la moitié mexicaine du menu, à fond.',
        'Eine Woche für die mexikanische Hälfte der Karte, voll aufgedreht.',
      ),
      cta: 'order',
    },
    blocks: [{ type: 'dishes', title: signatures, itemIds: ['quesabirria', 'beef-taco', 'shrimp-taco', 'nachos', 'guacamole-chips'] }],
  },
  {
    slug: 'jamaica-independence',
    from: '07-30',
    to: '08-06',
    priority: 6,
    name: L('Jamaica Independence', 'Independencia de Jamaica', 'Indépendance de la Jamaïque', 'Jamaikas Unabhängigkeit'),
    tokens: { '--c-jungle': '#009b3a', '--c-gold': '#fed100', '--c-ink': '#000000' },
    hero: {
      kicker: L('6 August', '6 de agosto', '6 août', '6. August'),
      headline: L('Out of many, one people.', 'De muchos, un solo pueblo.', 'De plusieurs, un seul peuple.', 'Aus vielen ein Volk.'),
      body: L(
        'Emancipendence week: jerk on the grill, ackee and saltfish, and the sound system on Jamaica time.',
        'Semana de Emancipación e Independencia: jerk en la parrilla, ackee con bacalao y el sound system en hora jamaiquina.',
        'Semaine de l’Émancipation et de l’Indépendance : jerk au grill, ackee et morue, et le sound system à l’heure jamaïcaine.',
        'Emancipendence-Woche: Jerk vom Grill, Ackee mit Stockfisch und das Soundsystem auf Jamaika-Zeit.',
      ),
      cta: 'book',
    },
    blocks: [{ type: 'dishes', title: signatures, itemIds: ['jerk', 'ackee-saltfish-tostones', 'curried-goat', 'stamp-and-go'] }],
  },
  {
    slug: 'independencia-mexico',
    from: '09-10',
    to: '09-16',
    priority: 6,
    name: L('Mexican Independence', 'Independencia de México', 'Indépendance du Mexique', 'Mexikos Unabhängigkeit'),
    tokens: { '--c-jungle': '#006847', '--c-hibiscus': '#ce1126', '--c-cream': '#fffaf0' },
    hero: {
      kicker: L('16 September', '16 de septiembre', '16 septembre', '16. September'),
      headline: L('¡Viva México! (and Jamaica too.)', '¡Viva México! (y Jamaica también.)', '¡Viva México! (et la Jamaïque aussi.)', '¡Viva México! (und Jamaika auch.)'),
      body: L(
        'El Grito on the terrace at night, birria all week.',
        'El Grito en la terraza por la noche, birria toda la semana.',
        'El Grito sur la terrasse le soir, birria toute la semaine.',
        'El Grito abends auf der Terrasse, Birria die ganze Woche.',
      ),
      cta: 'book',
    },
    blocks: [{ type: 'dishes', title: signatures, itemIds: ['quesabirria', 'fajitas', 'burrito', 'vanilla-flan'] }],
  },
  {
    slug: 'big-game',
    from: '',
    to: '',
    priority: 3,
    name: L('Big game nights', 'Noches de partido', 'Soirées match', 'Spielabende'),
    tokens: { '--c-lagoon': '#00a6d6', '--c-gold': '#ffc300' },
    hero: {
      kicker: L('On the big screens', 'En las pantallas', 'Sur grand écran', 'Auf den großen Screens'),
      headline: L('Every goal gets a round.', 'Cada gol merece una ronda.', 'Chaque but mérite une tournée.', 'Jedes Tor verdient eine Runde.'),
      body: L(
        'The match on every TV, MEGA drinks for the table, wings and nachos for the half-time.',
        'El partido en todas las pantallas, MEGA tragos para la mesa, alitas y nachos para el medio tiempo.',
        'Le match sur tous les écrans, des MEGA cocktails pour la table, ailes et nachos pour la mi-temps.',
        'Das Spiel auf jedem Bildschirm, MEGA-Drinks für den Tisch, Wings und Nachos zur Halbzeit.',
      ),
      cta: 'book',
    },
    blocks: [{ type: 'dishes', title: signatures, itemIds: ['wings', 'nachos', 'loaded-fries', 'boneless-bites'] }],
  },
];

const addOneYear = (date: string) => `${Number(date.slice(0, 4)) + 1}${date.slice(4)}`;

/**
 * A preset as a draft season for the next time it comes round from `today`
 * (YYYY-MM-DD). Presets without fixed dates (big games) run two weeks from today.
 */
export function draftFromPreset(slug: string, today: string): SeasonDraft | undefined {
  const preset = PRESETS.find((p) => p.slug === slug);
  if (!preset) return undefined;
  const { from, to, ...rest } = preset;
  let startsOn: string;
  let endsOn: string;
  if (!from) {
    startsOn = today;
    const end = new Date(`${today}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 14);
    endsOn = end.toISOString().slice(0, 10);
  } else {
    const year = today.slice(0, 4);
    startsOn = `${year}-${from}`;
    endsOn = to < from ? `${Number(year) + 1}-${to}` : `${year}-${to}`;
    if (endsOn < today) {
      startsOn = addOneYear(startsOn);
      endsOn = addOneYear(endsOn);
    }
  }
  return { ...rest, startsOn, endsOn, blocks: structuredClone(rest.blocks) };
}
