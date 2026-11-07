'use strict';
// Leyenda: # pared · . piso · , patio · D puerta cerrada · c mueble (cobertura)
// P inicio del equipo · m matón · e escopetero · b jefe
const MAPS = [
  {
    name: 'Casa de huéspedes', par: 6,
    brief: 'Tres sospechosos armados en una casa de dos alas. Entrada por la puerta del frente.',
    rows: [
      '############',
      '#....#.....#',
      '#.c..D..m..#',
      '#....#...c.#',
      '####D#######',
      '#......#...#',
      '#.m....D.e.#',
      '#...c..#...#',
      '##D#########',
      ',,,,,,,,,,,,',
      ',,P,P,P,,,,,',
    ],
  },
  {
    name: 'Taller clandestino', par: 9,
    brief: 'Cuatro hostiles repartidos en dos pisos de cuartos. El jefe cuida la sala del fondo.',
    rows: [
      '############',
      '#...#......#',
      '#.c.D..c.e.#',
      '#...#......#',
      '##D#####D###',
      '#.m.#...m..#',
      '#.c.D..c...#',
      '#...#......#',
      '###D########',
      '#.....#....#',
      '#.c...D..b.#',
      '#.....#....#',
      '#####D######',
      ',,,,,,,,,,,,',
      ',,P,P,P,,,,,',
    ],
  },
  {
    name: 'La mansión', par: 12,
    brief: 'Seis hostiles, pasillo central y un salón principal. Abre con cuidado, no tienes refuerzos.',
    rows: [
      '############',
      '#.....b....#',
      '#.c.......c#',
      '#....e.....#',
      '##D##D##D###',
      '#...#..#...#',
      '#.m.D..D.m.#',
      '#...#..#...#',
      '#####D######',
      '#........m.#',
      '#.c......c.#',
      '#.....e....#',
      '####D#######',
      ',,,,,,,,,,,,',
      ',,P,P,P,,,,,',
    ],
  },
];

const CLASSES = {
  asalto: {
    name: 'Asalto', letter: 'A', hp: 10, mov: 4, rng: 7, dmg: 3, acc: 75, uses: 2,
    special: 'Flash', cost: 1,
    desc: 'Equilibrado. Flash: aturde a todos en radio 2 de una casilla visible (2 usos).',
  },
  sniper: {
    name: 'Sniper', letter: 'S', hp: 7, mov: 3, rng: 12, dmg: 4, acc: 85, uses: 0,
    special: 'Tiro certero', cost: 2,
    desc: 'Largo alcance y puntería alta, frágil. Tiro certero: gasta 2 PA, no falla y hace 6 de daño.',
  },
  escudo: {
    name: 'Escudo', letter: 'E', hp: 14, mov: 3, rng: 4, dmg: 4, acc: 70, uses: 0,
    special: 'Escudo arriba', cost: 1,
    desc: 'Aguanta más y reduce 1 el daño que recibe. Abre puertas gratis. Escudo arriba: -3 de daño hasta tu próximo turno.',
  },
  medico: {
    name: 'Médico', letter: 'M', hp: 8, mov: 4, rng: 6, dmg: 2, acc: 70, uses: 2,
    special: 'Botiquín', cost: 1,
    desc: 'Poco daño, mucha utilidad. Botiquín: cura 5 a un aliado a 2 casillas o menos (2 usos).',
  },
};

const ENEMIES = {
  m: { name: 'Matón', hp: 5, dmg: 2, rng: 6, acc: 65, mov: 3 },
  e: { name: 'Escopetero', hp: 6, dmg: 4, rng: 3, acc: 72, mov: 3 },
  b: { name: 'Jefe', hp: 10, dmg: 3, rng: 7, acc: 72, mov: 3 },
};
