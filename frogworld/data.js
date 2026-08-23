/* Frog World - species and habitat data.
   Behaviour lives here rather than being spread through the game code, so a
   new frog is a new entry and not a new set of if-statements. The MVP ships
   one species; the fields the others will need are already modelled. */

export const SPECIES = {
  'green-tree-frog': {
    id: 'green-tree-frog',
    name: 'Green Tree Frog',
    habitat: 'wetland-tree',
    climbing: 1,                 // 0 none .. 1 excellent
    swimming: .6,
    jump: 1,                     // multiplier on hop distance
    weight: .7,                  // heavier frogs arc lower and land harder
    eggLocation: 'water',        // where this species puts its eggs
    active: 'night',
    size: 1,
    skin:  '#6FAE4B',
    belly: '#EFE7C8',
    dark:  '#4A7F33',
    stripe:'#E8F0C8',
    eye:   '#D8A93C',
    tadpole: '#3E3A32',
    egg:   'rgba(60,72,50,.55)',
    toePads: true,
    call: { pulses: 5, freq: 430, spread: 60, buzz: 'sawtooth', gap: .13, len: .09 },
    facts: ['Climbs with sticky toe pads.', 'Calls on warm, wet nights.']
  }
};

export const HABITATS = {
  'wetland-tree': {
    id: 'wetland-tree',
    name: 'Pond and trees',
    /* fractions of the world, which is taller than the screen so there is
       somewhere to climb to */
    worldTall: 2.15,
    waterTop: .70,               // surface, as a fraction of world height
    bankX: .58,                  // water to the left, bank to the right
    trunkX: .80,
    branches: [.16, .34, .52],   // world-height fractions where branches sit
    lilies: [.16, .30, .44],     // x fractions across the water
    reeds: [.06, .13, .49, .55],
    insects: ['fly', 'moth', 'beetle'],
    dayInsects: ['butterfly', 'dragonfly'],
    nightInsects: ['moth', 'firefly']
  }
};
