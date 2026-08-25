/* Feed the Farm - who lives here, what they like, and what they say.
   Kept out of the game code so another animal is an entry rather than a new
   branch. `voice` is a little score for the synth in assets/toy.js?v=e18d652ba5d1 each step
   is a note, `at` is when it starts. */

export const FOODS = {
  hay:    { id:'hay',    icon:'🌾', name:'Hay' },
  corn:   { id:'corn',   icon:'🌽', name:'Corn' },
  carrot: { id:'carrot', icon:'🥕', name:'A carrot' },
  apple:  { id:'apple',  icon:'🍎', name:'An apple' },
  seeds:  { id:'seeds',  icon:'🌰', name:'Seeds' },
  water:  { id:'water',  icon:'💧', name:'Water' }
};
/* Everyone drinks, so water is never the wrong answer. Nothing here is ever
   refused either - an animal offered something it does not love will still
   come and have a nibble, it just does not do its happy thing. */
export const ALWAYS = ['water'];

export const ANIMALS = [
  { id:'cow', emoji:'🐄', name:'Cow', likes:['hay','corn'], size:1.25, speed:34,
    gift:'🥛', trick:null,
    voice:[{f:150,d:.5,type:'sawtooth',vol:.05,slide:-40,at:0},
           {f:130,d:.55,type:'sawtooth',vol:.045,slide:-30,at:.34}] },

  /* No gift for the pig: a truffle is 🌰 and so are the seeds, and a child
     cannot tell a reward from the feed still lying on the grass. The mud
     splash is its own reward, and not every animal needs to hand you a thing. */
  { id:'pig', emoji:'🐷', name:'Pig', likes:['corn','apple'], size:1.0, speed:40,
    gift:null, trick:'mud',
    voice:[{f:300,d:.10,type:'square',vol:.045,slide:-140,at:0},
           {f:300,d:.10,type:'square',vol:.045,slide:-140,at:.16},
           {f:280,d:.13,type:'square',vol:.04,slide:-120,at:.32}] },

  { id:'chicken', emoji:'🐔', name:'Chicken', likes:['seeds','corn'], size:.72, speed:56,
    gift:'🥚', trick:null,
    voice:[{f:900,d:.06,type:'square',vol:.035,slide:-260,at:0},
           {f:820,d:.06,type:'square',vol:.035,slide:-220,at:.12},
           {f:1000,d:.09,type:'square',vol:.03,slide:-300,at:.26}] },

  { id:'horse', emoji:'🐴', name:'Horse', likes:['apple','carrot'], size:1.3, speed:62,
    gift:null, trick:'gallop',
    voice:[{f:700,d:.14,type:'sawtooth',vol:.04,slide:-260,at:0},
           {f:520,d:.12,type:'sawtooth',vol:.04,slide:-160,at:.15},
           {f:430,d:.10,type:'sawtooth',vol:.035,slide:-120,at:.28},
           {f:360,d:.22,type:'sawtooth',vol:.035,slide:-100,at:.39}] },

  { id:'goat', emoji:'🐐', name:'Goat', likes:['hay','carrot','apple','corn'], size:.9, speed:50,
    gift:'🧀', trick:'jump',
    voice:[{f:470,d:.07,type:'triangle',vol:.045,slide:-40,at:0},
           {f:440,d:.07,type:'triangle',vol:.045,slide:40,at:.09},
           {f:470,d:.07,type:'triangle',vol:.045,slide:-40,at:.18},
           {f:430,d:.14,type:'triangle',vol:.04,slide:-90,at:.27}] },

  { id:'sheep', emoji:'🐑', name:'Sheep', likes:['hay'], size:.95, speed:36,
    gift:'🧶', trick:null,
    voice:[{f:400,d:.10,type:'triangle',vol:.045,slide:-30,at:0},
           {f:380,d:.10,type:'triangle',vol:.045,slide:30,at:.11},
           {f:360,d:.26,type:'triangle',vol:.04,slide:-70,at:.22}] },

  { id:'duck', emoji:'🦆', name:'Duck', likes:['seeds','corn'], size:.68, speed:48,
    gift:'🥚', trick:null,
    voice:[{f:520,d:.09,type:'square',vol:.04,slide:-180,at:0},
           {f:500,d:.09,type:'square',vol:.04,slide:-170,at:.15}] }
];
