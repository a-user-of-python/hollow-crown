// THE HOLLOW CROWN — SRD 5.2.1 data (D&D 2024 rules). CC-BY 4.0, Wizards of the Coast.
// All numbers from the SRD 5.2.1 / 2024 rules research. PHB-only content is NOT included.
"use strict";

const ABILITIES = ["str","dex","con","int","wis","cha"];
const ABILITY_NAMES = {str:"Strength",dex:"Dexterity",con:"Constitution",int:"Intelligence",wis:"Wisdom",cha:"Charisma"};
const SKILLS = { // skill -> governing ability (2024 list of 18)
  Athletics:"str", Acrobatics:"dex", "Sleight of Hand":"dex", Stealth:"dex",
  Arcana:"int", History:"int", Investigation:"int", Nature:"int", Religion:"int",
  "Animal Handling":"wis", Insight:"wis", Medicine:"wis", Perception:"wis", Survival:"wis",
  Deception:"cha", Intimidation:"cha", Performance:"cha", Persuasion:"cha"
};
const XP_TABLE = [0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000]; // index = level-1
const pbForLevel = l => 2 + Math.floor((l-1)/4);
const modOf = score => Math.floor((score-10)/2);
const fmtMod = m => (m>=0?"+":"")+m;

// Spell slot tables (levels 1..10 shown; campaign caps at 8)
const FULL_SLOTS = {1:[2],2:[3],3:[4,2],4:[4,3],5:[4,3,2],6:[4,3,3],7:[4,3,3,1],8:[4,3,3,2],9:[4,3,3,3,1],10:[4,3,3,3,2]};
const HALF_SLOTS = {1:[2],2:[2],3:[3],4:[3],5:[4,2],6:[4,2],7:[4,3],8:[4,3]}; // 2024 Paladin/Ranger
const PACT_SLOTS = {1:{n:1,lvl:1},2:{n:2,lvl:1},3:{n:2,lvl:2},4:{n:2,lvl:2},5:{n:2,lvl:3},6:{n:2,lvl:3},7:{n:2,lvl:4},8:{n:2,lvl:4}};

// Prepared/known spell counts by level 1-8 (SRD 5.2.1 class tables, verified from the SRD PDF)
const PREPARED_FULL = [4,5,6,7,9,10,11,12];       // Bard, Cleric, Druid, Wizard
const PREPARED_SORC = [2,4,6,7,9,10,11,12];       // Sorcerer (known)
const PREPARED_HALF  = [2,3,4,5,6,6,7,7];         // Paladin, Ranger
const PREPARED_WARLOCK = [2,3,4,5,6,7,8,9];       // Warlock (known)
// Cantrips known by level 1-8
const CANTRIPS = {
  bard:[2,2,2,3,3,3,3,3], cleric:[3,3,3,4,4,4,4,4], druid:[2,2,2,3,3,3,3,3],
  sorcerer:[4,4,4,5,5,5,5,5], wizard:[3,3,3,4,4,4,4,4], warlock:[2,2,2,3,3,3,3,3]
};
const INVOCATIONS_AT = [1,3,3,3,5,5,6,6];         // Warlock invocations known, levels 1-8
const CHANNEL_CLERIC = [0,2,2,2,2,3,3,3];         // Cleric Channel Divinity uses (regain 1 on Short Rest)
const CHANNEL_PALADIN = [0,0,2,2,2,2,2,2];        // Paladin Channel Divinity uses (regain 1 on Short Rest)
const WILD_SHAPE_USES = [0,2,2,2,2,3,3,3];        // Druid Wild Shape uses (regain 1 on Short Rest)
const FAVORED_ENEMY_FREE = [2,2,2,2,3,3,3,3];     // Ranger free Hunter's Mark casts per Long Rest
const SECOND_WIND_USES = l => l>=10?4 : l>=4?3 : 2; // Fighter Second Wind uses (regain 1 on Short Rest)

// Eldritch Invocations (SRD subset). minLvl = Warlock level prerequisite.
const INVOCATIONS = {
  agonizing_blast:{name:"Agonizing Blast",minLvl:2,desc:"Add your Charisma modifier to Eldritch Blast damage rolls."},
  repelling_blast:{name:"Repelling Blast",minLvl:2,desc:"When Eldritch Blast hits, push the creature up to 10 ft away."},
  eldritch_spear:{name:"Eldritch Spear",minLvl:2,desc:"Eldritch Blast range becomes 300 ft."},
  armor_of_shadows:{name:"Armor of Shadows",minLvl:2,desc:"You can cast Mage Armor on yourself at will (toggle in the Spells menu)."},
  devils_sight:{name:"Devil's Sight",minLvl:2,desc:"You see in magical darkness; your own Darkness doesn't blind you."},
  fiendish_vigor:{name:"Fiendish Vigor",minLvl:2,desc:"Cast False Life on yourself at will: gain 1d4+4 temporary HP (Spells menu button)."},
  pact_of_the_blade:{name:"Pact of the Blade",minLvl:1,desc:"Bond with a weapon: you are proficient with it and use Charisma for its attacks. (Simplified: your pact weapon attacks use Charisma.)"},
  pact_of_the_tome:{name:"Pact of the Tome",minLvl:1,desc:"Your grimoire grants extra cantrips. (Simplified: +1 cantrip known.)"},
  pact_of_the_chain:{name:"Pact of the Chain",minLvl:1,desc:"You can cast Find Familiar as a ritual. (Flavour in this build.)"},
};
// Metamagic options (SRD). cost = Sorcery Points.
const METAMAGIC = {
  careful:{name:"Careful Spell",cost:1,desc:"Chosen allies automatically succeed on the spell's saving throw."},
  distant:{name:"Distant Spell",cost:1,desc:"Double the spell's range (or 5 ft becomes 30 ft for touch spells)."},
  empowered:{name:"Empowered Spell",cost:1,desc:"Reroll up to your Charisma modifier of the spell's damage dice."},
  extended:{name:"Extended Spell",cost:1,desc:"Double the spell's duration. (Durations are scene-based here; flavour.)"},
  heightened:{name:"Heightened Spell",cost:2,desc:"One target has Disadvantage on its first saving throw against the spell."},
  quickened:{name:"Quickened Spell",cost:2,desc:"Cast a spell with a casting time of one Action as a Bonus Action."},
  seeking:{name:"Seeking Spell",cost:1,desc:"If a spell attack roll misses, reroll it once."},
  subtle:{name:"Subtle Spell",cost:1,desc:"Cast without verbal/somatic components — it can't be Counterspelled."},
  transmuted:{name:"Transmuted Spell",cost:1,desc:"Change the spell's damage type to another elemental type. (Flavour in this build.)"},
  twinned:{name:"Twinned Spell",cost:1,desc:"A spell that targets one creature also targets a second creature in range."},
};

// ---------------- WEAPONS (SRD) ----------------
// dmg:[count,die], props, mastery (2024), rng = normal range ft (ranged/thrown), cat: simple/martial
const WEAPONS = {
  club:{name:"Club",dmg:[1,4],type:"bludgeoning",cat:"simple",props:["Light"],mastery:"Slow",cost:1},
  dagger:{name:"Dagger",dmg:[1,4],type:"piercing",cat:"simple",props:["Finesse","Light","Thrown 20/60"],mastery:"Nick",cost:2},
  greatclub:{name:"Greatclub",dmg:[1,8],type:"bludgeoning",cat:"simple",props:["Two-Handed"],mastery:"Push",cost:2},
  handaxe:{name:"Handaxe",dmg:[1,6],type:"slashing",cat:"simple",props:["Light","Thrown 20/60"],mastery:"Vex",cost:5},
  javelin:{name:"Javelin",dmg:[1,6],type:"piercing",cat:"simple",props:["Thrown 30/120"],mastery:"Slow",cost:0.5},
  light_hammer:{name:"Light Hammer",dmg:[1,4],type:"bludgeoning",cat:"simple",props:["Light","Thrown 20/60"],mastery:"Nick",cost:2},
  mace:{name:"Mace",dmg:[1,6],type:"bludgeoning",cat:"simple",props:[],mastery:"Sap",cost:5},
  quarterstaff:{name:"Quarterstaff",dmg:[1,6],type:"bludgeoning",cat:"simple",props:["Versatile 1d8"],mastery:"Topple",cost:0.2,versatile:[1,8]},
  sickle:{name:"Sickle",dmg:[1,4],type:"slashing",cat:"simple",props:["Light"],mastery:"Nick",cost:1},
  spear:{name:"Spear",dmg:[1,6],type:"piercing",cat:"simple",props:["Thrown 20/60","Versatile 1d8"],mastery:"Sap",cost:1,versatile:[1,8]},
  light_crossbow:{name:"Light Crossbow",dmg:[1,8],type:"piercing",cat:"simple",props:["Ammunition 80/320","Loading","Two-Handed"],mastery:"Slow",cost:25,ranged:true},
  dart:{name:"Dart",dmg:[1,4],type:"piercing",cat:"simple",props:["Finesse","Thrown 20/60"],mastery:"Vex",cost:0.05},
  shortbow:{name:"Shortbow",dmg:[1,6],type:"piercing",cat:"simple",props:["Ammunition 80/320","Two-Handed"],mastery:"Vex",cost:25,ranged:true},
  sling:{name:"Sling",dmg:[1,4],type:"bludgeoning",cat:"simple",props:["Ammunition 30/120"],mastery:"Slow",cost:0.1,ranged:true},
  battleaxe:{name:"Battleaxe",dmg:[1,8],type:"slashing",cat:"martial",props:["Versatile 1d10"],mastery:"Topple",cost:10,versatile:[1,10]},
  flail:{name:"Flail",dmg:[1,8],type:"bludgeoning",cat:"martial",props:[],mastery:"Sap",cost:10},
  glaive:{name:"Glaive",dmg:[1,10],type:"slashing",cat:"martial",props:["Heavy","Reach","Two-Handed"],mastery:"Graze",cost:20},
  greataxe:{name:"Greataxe",dmg:[1,12],type:"slashing",cat:"martial",props:["Heavy","Two-Handed"],mastery:"Cleave",cost:30},
  greatsword:{name:"Greatsword",dmg:[2,6],type:"slashing",cat:"martial",props:["Heavy","Two-Handed"],mastery:"Graze",cost:50},
  halberd:{name:"Halberd",dmg:[1,10],type:"slashing",cat:"martial",props:["Heavy","Reach","Two-Handed"],mastery:"Cleave",cost:20},
  lance:{name:"Lance",dmg:[1,10],type:"piercing",cat:"martial",props:["Reach"],mastery:"Topple",cost:10},
  longsword:{name:"Longsword",dmg:[1,8],type:"slashing",cat:"martial",props:["Versatile 1d10"],mastery:"Sap",cost:15,versatile:[1,10]},
  maul:{name:"Maul",dmg:[2,6],type:"bludgeoning",cat:"martial",props:["Heavy","Two-Handed"],mastery:"Topple",cost:10},
  morningstar:{name:"Morningstar",dmg:[1,8],type:"piercing",cat:"martial",props:[],mastery:"Sap",cost:15},
  pike:{name:"Pike",dmg:[1,10],type:"piercing",cat:"martial",props:["Heavy","Reach","Two-Handed"],mastery:"Push",cost:5},
  rapier:{name:"Rapier",dmg:[1,8],type:"piercing",cat:"martial",props:["Finesse"],mastery:"Vex",cost:25},
  scimitar:{name:"Scimitar",dmg:[1,6],type:"slashing",cat:"martial",props:["Finesse","Light"],mastery:"Nick",cost:25},
  shortsword:{name:"Shortsword",dmg:[1,6],type:"piercing",cat:"martial",props:["Finesse","Light"],mastery:"Vex",cost:10},
  trident:{name:"Trident",dmg:[1,8],type:"piercing",cat:"martial",props:["Thrown 20/60","Versatile 1d10"],mastery:"Topple",cost:5,versatile:[1,10]},
  warhammer:{name:"Warhammer",dmg:[1,8],type:"bludgeoning",cat:"martial",props:["Versatile 1d10"],mastery:"Push",cost:15,versatile:[1,10]},
  war_pick:{name:"War Pick",dmg:[1,8],type:"piercing",cat:"martial",props:["Versatile 1d10"],mastery:"Sap",cost:5,versatile:[1,10]},
  whip:{name:"Whip",dmg:[1,4],type:"slashing",cat:"martial",props:["Finesse","Reach"],mastery:"Slow",cost:2},
  hand_crossbow:{name:"Hand Crossbow",dmg:[1,6],type:"piercing",cat:"martial",props:["Ammunition 30/120","Light","Loading"],mastery:"Vex",cost:75,ranged:true},
  heavy_crossbow:{name:"Heavy Crossbow",dmg:[1,10],type:"piercing",cat:"martial",props:["Ammunition 100/400","Heavy","Loading","Two-Handed"],mastery:"Push",cost:50,ranged:true},
  longbow:{name:"Longbow",dmg:[1,8],type:"piercing",cat:"martial",props:["Ammunition 150/600","Heavy","Two-Handed"],mastery:"Slow",cost:50,ranged:true},
  // Magic variants sold later / looted (same chassis, +bonus to hit & damage)
  longsword_1:{name:"Longsword +1",base:"longsword",bonus:1,cost:400},
  greataxe_1:{name:"Greataxe +1",base:"greataxe",bonus:1,cost:450},
  shortbow_1:{name:"Shortbow +1",base:"shortbow",bonus:1,cost:350},
  warhammer_1:{name:"Warhammer +1",base:"warhammer",bonus:1,cost:400},
  rapier_1:{name:"Rapier +1",base:"rapier",bonus:1,cost:450},
  mace_1:{name:"Mace +1",base:"mace",bonus:1,cost:300},
  staff_ember:{name:"Emberstaff",base:"quarterstaff",bonus:1,fire:true,cost:600},
};
function weaponDef(id){ const w=WEAPONS[id]; if(!w) return null; if(w.base){ const b=WEAPONS[w.base]; return Object.assign({},b,w,{id}); } return Object.assign({},w,{id}); }

// ---------------- ARMOUR (SRD) ----------------
// dexRule: full | max2 | none. 
const ARMOR = {
  padded:{name:"Padded Armour",ac:11,kind:"light",dexRule:"full",stealthDis:true,cost:5},
  leather:{name:"Leather Armour",ac:11,kind:"light",dexRule:"full",cost:10},
  studded:{name:"Studded Leather",ac:12,kind:"light",dexRule:"full",cost:45},
  hide:{name:"Hide Armour",ac:12,kind:"medium",dexRule:"max2",cost:10},
  chain_shirt:{name:"Chain Shirt",ac:13,kind:"medium",dexRule:"max2",cost:50},
  scale:{name:"Scale Mail",ac:14,kind:"medium",dexRule:"max2",stealthDis:true,cost:50},
  breastplate:{name:"Breastplate",ac:14,kind:"medium",dexRule:"max2",cost:400},
  half_plate:{name:"Half Plate",ac:15,kind:"medium",dexRule:"max2",stealthDis:true,cost:750},
  ring_mail:{name:"Ring Mail",ac:14,kind:"heavy",dexRule:"none",stealthDis:true,cost:30},
  chain_mail:{name:"Chain Mail",ac:16,kind:"heavy",dexRule:"none",strReq:13,stealthDis:true,cost:75},
  splint:{name:"Splint Armour",ac:17,kind:"heavy",dexRule:"none",strReq:15,stealthDis:true,cost:200},
  plate:{name:"Plate Armour",ac:18,kind:"heavy",dexRule:"none",strReq:15,stealthDis:true,cost:1500},
  shield:{name:"Shield",ac:2,kind:"shield",cost:10},
  leather_1:{name:"Leather Armour +1",base:"leather",bonus:1,cost:500},
  chain_mail_1:{name:"Chain Mail +1",base:"chain_mail",bonus:1,cost:800},
};
function armorDef(id){ const a=ARMOR[id]; if(!a) return null; if(a.base){ const b=ARMOR[a.base]; return Object.assign({},b,a,{id}); } return Object.assign({},a,{id}); }

// ---------------- OTHER ITEMS ----------------
const ITEMS = {
  potion_healing:{name:"Potion of Healing",kind:"potion",heal:[2,4],bonus:2,cost:50,desc:"Drink (Bonus Action in 2024): regain 2d4+2 HP."},
  potion_greater:{name:"Potion of Greater Healing",kind:"potion",heal:[4,4],bonus:4,cost:150,desc:"Regain 4d4+4 HP."},
  potion_superior:{name:"Potion of Superior Healing",kind:"potion",heal:[8,4],bonus:8,cost:500,desc:"Regain 8d4+8 HP."},
  antitoxin:{name:"Antitoxin",kind:"gear",cost:50,desc:"Advantage on saves vs Poison for 1 hour. (Use before a fight from Inventory.)"},
  rations:{name:"Rations (1 day)",kind:"gear",cost:0.5,desc:"Food for the road."},
  rope:{name:"Rope, 50 ft",kind:"gear",cost:1,desc:"Sturdy hemp rope."},
  torch:{name:"Torch",kind:"gear",cost:0.01,desc:"Burns for 1 hour."},
  thieves_tools:{name:"Thieves' Tools",kind:"gear",cost:25,desc:"Needed to pick locks."},
  healers_kit:{name:"Healer's Kit",kind:"gear",cost:5,desc:"Stabilise a dying creature without a Medicine check."},
  holy_water:{name:"Holy Water",kind:"gear",cost:25,desc:"Throw at a fiend or undead: 2d6 radiant on a hit."},
  alchemist_fire:{name:"Alchemist's Fire",kind:"gear",cost:50,desc:"Throw: 1d4 fire damage, and 1d4 more each turn until doused."},
  crown_shard_band:{name:"Shard of the Hollow Crown — the Band",kind:"quest",cost:0,desc:"A cold circle of black gold. It hums near the dead."},
  crown_shard_jewel:{name:"Shard of the Hollow Crown — the Jewel",kind:"quest",cost:0,desc:"A pale gem that holds a light that is not light."},
  crown_shard_thorns:{name:"Shard of the Hollow Crown — the Thorns",kind:"quest",cost:0,desc:"The crown's broken spikes, sharp as grief."},
  sun_medallion:{name:"Sun Medallion",kind:"gear",cost:0,desc:"Proof you cleansed the Sunken Chapel."},
  mill_key:{name:"Mill Key",kind:"quest",cost:0,desc:"Opens the Emberford mill cellar."},
};
function itemName(id){
  if(WEAPONS[id]) return weaponDef(id).name;
  if(ARMOR[id]) return armorDef(id).name;
  if(ITEMS[id]) return ITEMS[id].name;
  if(SPELLS[id]) return SPELLS[id].name;
  return id;
}
function itemCost(id){
  if(WEAPONS[id]) return weaponDef(id).cost||0;
  if(ARMOR[id]) return armorDef(id).cost||0;
  if(ITEMS[id]) return ITEMS[id].cost||0;
  return 0;
}

// ---------------- SPELLS (SRD subset, 2024 values) ----------------
// kind: dmg | heal | buff | control | aoe | utility.  save: ability or null (attack roll if atk:true)
// dmg scales: cantrips scaleDice at 5/11/17. upcast: extra dice per slot above base.
const SPELLS = {
  fire_bolt:{name:"Fire Bolt",lvl:0,school:"Evocation",classes:["sorcerer","wizard"],time:"Action",range:120,atk:true,dmg:[1,10],dtype:"fire",cantripScale:true,desc:"Hurl a mote of fire. 1d10 fire damage on a hit."},
  ray_of_frost:{name:"Ray of Frost",lvl:0,school:"Evocation",classes:["sorcerer","wizard"],time:"Action",range:60,atk:true,dmg:[1,8],dtype:"cold",slow:10,cantripScale:true,desc:"1d8 cold damage and the target's Speed drops by 10 ft until your next turn."},
  shocking_grasp:{name:"Shocking Grasp",lvl:0,school:"Evocation",classes:["sorcerer","wizard"],time:"Action",range:5,atk:true,dmg:[1,8],dtype:"lightning",cantripScale:true,desc:"1d8 lightning; the target can't take Reactions until its next turn."},
  sacred_flame:{name:"Sacred Flame",lvl:0,school:"Evocation",classes:["cleric"],time:"Action",range:60,save:"dex",dmg:[1,8],dtype:"radiant",cantripScale:true,desc:"Dexterity save or 1d8 radiant damage."},
  toll_the_dead:{name:"Toll the Dead",lvl:0,school:"Necromancy",classes:["cleric","warlock","wizard"],time:"Action",range:60,save:"wis",dmg:[1,8],dmgHurt:[1,12],dtype:"necrotic",cantripScale:true,desc:"Wisdom save or necrotic damage — d12s if the target is already hurt."},
  eldritch_blast:{name:"Eldritch Blast",lvl:0,school:"Evocation",classes:["warlock"],time:"Action",range:120,atk:true,dmg:[1,10],dtype:"force",beams:true,cantripScale:true,desc:"A beam of crackling energy, 1d10 force. More beams at levels 5, 11, 17."},
  vicious_mockery:{name:"Vicious Mockery",lvl:0,school:"Enchantment",classes:["bard"],time:"Action",range:60,save:"wis",dmg:[1,6],dtype:"psychic",mockery:true,cantripScale:true,desc:"Wisdom save or 1d6 psychic and Disadvantage on its next attack."},
  guidance:{name:"Guidance",lvl:0,school:"Divination",classes:["cleric","druid"],time:"Action",range:5,kind:"buff",conc:true,desc:"Touch a creature: +1d4 to one ability check of its choice within 1 minute. Concentration. (In this game: your next dialogue/exploration skill check.)"},
  light:{name:"Light",lvl:0,school:"Evocation",classes:["bard","cleric","sorcerer","wizard"],time:"Action",range:5,kind:"utility",desc:"An object shines brightly for 1 hour."},
  mage_hand:{name:"Mage Hand",lvl:0,school:"Conjuration",classes:["bard","sorcerer","warlock","wizard"],time:"Action",range:30,kind:"utility",desc:"A spectral hand manipulates objects for 1 minute."},
  minor_illusion:{name:"Minor Illusion",lvl:0,school:"Illusion",classes:["bard","sorcerer","warlock","wizard"],time:"Action",range:30,kind:"utility",desc:"Create a sound or static image for 1 minute."},
  druidcraft:{name:"Druidcraft",lvl:0,school:"Transmutation",classes:["druid"],time:"Action",range:30,kind:"utility",desc:"Whisper to the spirits of nature for small wonders."},
  magic_missile:{name:"Magic Missile",lvl:1,school:"Evocation",classes:["sorcerer","wizard"],time:"Action",range:120,auto:true,darts:3,dmg:[1,4],dmgBonus:1,dtype:"force",upcastDart:true,desc:"Three glowing darts strike unerringly, 1d4+1 force each. +1 dart per slot level above 1st."},
  cure_wounds:{name:"Cure Wounds",lvl:1,school:"Abjuration",classes:["bard","cleric","druid","paladin","ranger"],time:"Action",range:5,kind:"heal",heal:[2,8],upcastHeal:[2,8],desc:"Touch a creature and restore 2d8 + spellcasting modifier HP. (2024: doubled dice.)"},
  healing_word:{name:"Healing Word",lvl:1,school:"Abjuration",classes:["bard","cleric","druid"],time:"Bonus Action",range:60,kind:"heal",heal:[2,4],upcastHeal:[2,4],desc:"A word of comfort restores 2d4 + modifier HP at range. Bonus Action."},
  bless:{name:"Bless",lvl:1,school:"Enchantment",classes:["cleric","paladin"],time:"Action",range:30,kind:"buff",conc:true,targets:3,desc:"Up to 3 allies add 1d4 to attack rolls and saving throws for 1 minute. Concentration."},
  shield:{name:"Shield",lvl:1,school:"Abjuration",classes:["sorcerer","wizard"],time:"Reaction",range:0,kind:"buff",self:true,desc:"Reaction when hit: +5 AC until the start of your next turn, and no damage from Magic Missile."},
  mage_armor:{name:"Mage Armor",lvl:1,school:"Abjuration",classes:["sorcerer","wizard"],time:"Action",range:5,kind:"buff",self:true,desc:"A willing unarmoured creature's AC becomes 13 + Dexterity for 8 hours."},
  thunderwave:{name:"Thunderwave",lvl:1,school:"Evocation",classes:["bard","druid","sorcerer","wizard"],time:"Action",range:15,aoe:"cube15",save:"con",half:true,dmg:[2,8],dtype:"thunder",push:10,upcast:[1,8],desc:"A 15-ft cube of thunder emanating from you: Con save or 2d8 thunder and pushed 10 ft; half damage and no push on a success."},
  burning_hands:{name:"Burning Hands",lvl:1,school:"Evocation",classes:["sorcerer","wizard"],time:"Action",range:15,aoe:"cone15",save:"dex",half:true,dmg:[3,6],dtype:"fire",upcast:[1,6],desc:"A 15-ft cone of flame. Dex save for half of 3d6 fire."},
  guiding_bolt:{name:"Guiding Bolt",lvl:1,school:"Evocation",classes:["cleric"],time:"Action",range:120,atk:true,dmg:[4,6],dtype:"radiant",guide:true,upcast:[1,6],desc:"4d6 radiant on a hit, and the next attack against the target has Advantage."},
  inflict_wounds:{name:"Inflict Wounds",lvl:1,school:"Necromancy",classes:["cleric"],time:"Action",range:5,atk:true,dmg:[2,10],dtype:"necrotic",upcast:[1,10],desc:"Your touch deals 2d10 necrotic on a hit. (2024 version.)"},
  sleep:{name:"Sleep",lvl:1,school:"Enchantment",classes:["bard","sorcerer","wizard"],time:"Action",range:60,aoe:"sphere5",save:"wis",kind:"control",condition:"unconscious",conc:true,desc:"Each creature in a 5-ft sphere makes a Wisdom save or has the Incapacitated condition; it repeats the save at the end of its turns — failing again makes it Unconscious, succeeding ends the spell for it. Ends if the creature takes damage or is shaken awake. Concentration."},
  faerie_fire:{name:"Faerie Fire",lvl:1,school:"Evocation",classes:["bard","druid"],time:"Action",range:60,aoe:"cube20",save:"dex",kind:"control",conc:true,desc:"Outlines creatures in light: attacks against them have Advantage. Dex save negates. Concentration."},
  hunters_mark:{name:"Hunter's Mark",lvl:1,school:"Divination",classes:["ranger"],time:"Bonus Action",range:90,kind:"buff",conc:true,self:true,desc:"Mark a quarry: your weapon attacks deal +1d6 damage to it. Concentration."},
  hex:{name:"Hex",lvl:1,school:"Enchantment",classes:["warlock"],time:"Bonus Action",range:90,kind:"buff",conc:true,desc:"Curse a creature: your attacks deal +1d6 necrotic to it. Concentration."},
  divine_favor:{name:"Divine Favor",lvl:1,school:"Evocation",classes:["paladin"],time:"Bonus Action",range:0,kind:"buff",self:true,desc:"Your weapon attacks deal +1d4 radiant damage for 1 minute. (2024: no concentration.)"},
  heroism:{name:"Heroism",lvl:1,school:"Enchantment",classes:["bard","paladin"],time:"Action",range:5,kind:"buff",conc:true,desc:"A creature gains temporary HP equal to your spellcasting modifier each turn and can't be Frightened."},
  scorching_ray:{name:"Scorching Ray",lvl:2,school:"Evocation",classes:["sorcerer","wizard"],time:"Action",range:120,atk:true,rays:3,dmg:[2,6],dtype:"fire",upcastRay:true,desc:"Three rays of fire, each 2d6 on a hit. +1 ray per slot above 2nd."},
  misty_step:{name:"Misty Step",lvl:2,school:"Conjuration",classes:["sorcerer","warlock","wizard"],time:"Bonus Action",range:0,kind:"utility",self:true,desc:"Teleport up to 30 ft in a veil of silvery mist."},
  hold_person:{name:"Hold Person",lvl:2,school:"Enchantment",classes:["bard","cleric","druid","sorcerer","warlock","wizard"],time:"Action",range:60,save:"wis",kind:"control",condition:"paralyzed",conc:true,humanoidOnly:true,desc:"Wisdom save or Paralyzed for 1 minute (save at end of each turn). Concentration."},
  spiritual_weapon:{name:"Spiritual Weapon",lvl:2,school:"Evocation",classes:["cleric"],time:"Bonus Action",range:60,atk:true,dmg:[1,8],dmgMod:true,dtype:"force",conc:true,upcast:[1,8,2],desc:"A floating weapon strikes: 1d8 + modifier force on a hit. Concentration (2024)."},
  shatter:{name:"Shatter",lvl:2,school:"Evocation",classes:["bard","sorcerer","warlock","wizard"],time:"Action",range:60,aoe:"sphere10",save:"con",half:true,dmg:[3,8],dtype:"thunder",upcast:[1,8],desc:"A sudden ringing blast: Con save for half of 3d8 thunder."},
  web:{name:"Web",lvl:2,school:"Conjuration",classes:["sorcerer","wizard"],time:"Action",range:60,aoe:"cube20",save:"dex",kind:"control",condition:"restrained",conc:true,desc:"Sticky webs: Dex save or Restrained. Concentration."},
  aid:{name:"Aid",lvl:2,school:"Abjuration",classes:["cleric","paladin","ranger"],time:"Action",range:30,kind:"buff",targets:3,aidHp:5,upcastAid:5,desc:"Up to 3 allies gain +5 current and maximum HP for 8 hours."},
  lesser_restoration:{name:"Lesser Restoration",lvl:2,school:"Abjuration",classes:["bard","cleric","druid","paladin","ranger"],time:"Bonus Action",range:5,kind:"heal",cleanse:true,desc:"End one condition on a creature: Blinded, Deafened, Paralyzed, or Poisoned. (2024: Bonus Action.)"},
  darkness:{name:"Darkness",lvl:2,school:"Evocation",classes:["sorcerer","warlock","wizard"],time:"Action",range:60,kind:"control",conc:true,desc:"Magical darkness fills a 15-ft sphere for 10 minutes. (Here: creatures inside have Disadvantage on attacks.)"},
  fireball:{name:"Fireball",lvl:3,school:"Evocation",classes:["sorcerer","wizard"],time:"Action",range:150,aoe:"sphere20",save:"dex",half:true,dmg:[8,6],dtype:"fire",upcast:[1,6],desc:"The classic. A 20-ft sphere of flame, Dex save for half of 8d6 fire."},
  lightning_bolt:{name:"Lightning Bolt",lvl:3,school:"Evocation",classes:["sorcerer","wizard"],time:"Action",range:100,aoe:"line100",save:"dex",half:true,dmg:[8,6],dtype:"lightning",upcast:[1,6],desc:"A 100-ft line of lightning. Dex save for half of 8d6."},
  counterspell:{name:"Counterspell",lvl:3,school:"Abjuration",classes:["sorcerer","warlock","wizard"],time:"Reaction",range:60,kind:"control",desc:"Interrupt a creature casting a spell: it makes a Con save vs your DC or the spell dissipates — but it keeps its slot. (2024 version.)"},
  revivify:{name:"Revivify",lvl:3,school:"Necromancy",classes:["cleric","paladin"],time:"Action",range:5,kind:"heal",revive:true,materialGold:300,desc:"Return a creature that died within the last minute to life with 1 HP. Consumes a diamond worth 300 gp (paid from party gold)."},
  spirit_guardians:{name:"Spirit Guardians",lvl:3,school:"Conjuration",classes:["cleric"],time:"Action",range:15,kind:"buff",conc:true,self:true,sgDmg:[3,8],desc:"Spectral guardians swirl around you: enemies that start their turn within 15 ft take 3d8 radiant (Wis save for half). Concentration."},
  haste:{name:"Haste",lvl:3,school:"Transmutation",classes:["sorcerer","wizard"],time:"Action",range:30,kind:"buff",conc:true,desc:"An ally gains +2 AC, doubled Speed, and an extra action each turn. Concentration."},
  dispel_magic:{name:"Dispel Magic",lvl:3,school:"Abjuration",classes:["bard","cleric","druid","paladin","sorcerer","warlock","wizard"],time:"Action",range:120,kind:"utility",desc:"End magical effects on a creature or object."},
  ice_storm:{name:"Ice Storm",lvl:4,school:"Evocation",classes:["druid","sorcerer","wizard"],time:"Action",range:300,aoe:"sphere20",save:"dex",half:true,dmg:[2,8],dmg2:[4,6],dtype:"cold",desc:"Hail pounds a 20-ft sphere: 2d8 bludgeoning + 4d6 cold, Dex save for half."},
  blight:{name:"Blight",lvl:4,school:"Necromancy",classes:["druid","sorcerer","warlock","wizard"],time:"Action",range:30,save:"con",half:true,dmg:[8,8],dtype:"necrotic",desc:"Withering energy: Con save for half of 8d8 necrotic."},
  dimension_door:{name:"Dimension Door",lvl:4,school:"Conjuration",classes:["bard","sorcerer","warlock","wizard"],time:"Action",range:500,kind:"utility",self:true,desc:"Teleport yourself (and one willing creature) up to 500 ft."},
};

// ---------------- CLASSES (SRD, features levels 1-8) ----------------
const CLASSES = {
  barbarian:{name:"Barbarian",hitDie:12,saves:["str","con"],spellcasting:null,armor:["light","medium","shield"],weapons:["simple","martial"],
    desc:"A fierce warrior who channels Rage in battle.",
    features:{1:["Rage","Unarmored Defense","Weapon Mastery"],2:["Danger Sense","Reckless Attack"],3:["Primal Knowledge","Subclass: Path of the Berserker"],4:["Ability Score Improvement"],5:["Extra Attack","Fast Movement"],6:["Berserker: Frenzy (already active)","Mindless Rage"],7:["Feral Instinct","Instinctive Pounce"],8:["Ability Score Improvement"]},
    featureText:{"Rage":"Bonus Action: +2 damage on Strength attacks, Resistance to bludgeoning/piercing/slashing, Advantage on Strength checks/saves. 2 uses at L1 (more as you level), refreshed by a Long Rest.","Unarmored Defense":"While wearing no armour, AC = 10 + Dex + Con.","Weapon Mastery":"Use the Mastery properties of two kinds of weapons; more at higher levels.","Danger Sense":"Advantage on Dex saves against effects you can see.","Reckless Attack":"Gain Advantage on your Strength attacks this turn; attacks against you have Advantage until your next turn.","Extra Attack":"Attack twice when you take the Attack action.","Fast Movement":"+10 ft Speed while not wearing Heavy armour.","Mindless Rage":"You can't be Charmed or Frightened while raging."},
    subclass:{name:"Path of the Berserker",features:{3:"Frenzy: while raging, the first creature you hit each turn takes extra 2d6 damage (grows with Rage damage).",6:"Mindless Rage (in class features)."}},
    startGold:75,startKit:["greataxe","handaxe","handaxe","leather"],rageUses:l=> l<3?2: l<6?3:4, rageDmg:l=> l<9?2:3,masteryKinds:2},
  fighter:{name:"Fighter",hitDie:10,saves:["str","con"],spellcasting:null,armor:["light","medium","heavy","shield"],weapons:["simple","martial"],
    desc:"A master of all arms and armour.",
    features:{1:["Fighting Style","Second Wind","Weapon Mastery"],2:["Action Surge","Tactical Mind"],3:["Subclass: Champion"],4:["Ability Score Improvement"],5:["Extra Attack","Tactical Shift"],6:["Ability Score Improvement"],7:["Champion: Remarkable Athlete"],8:["Ability Score Improvement"]},
    featureText:{"Fighting Style":"Defense: +1 AC while wearing armour (applied automatically).","Second Wind":"Bonus Action: regain 1d10 + Fighter level HP. 2 uses (3 at level 4, 4 at level 10); regain 1 on a Short Rest, all on a Long Rest.","Action Surge":"Once per Short Rest: take one additional action on your turn.","Weapon Mastery":"Use the Mastery properties of three kinds of weapons.","Extra Attack":"Attack twice when you take the Attack action.","Tactical Mind":"When you fail an ability check, expend a Second Wind use to add 1d10 to the roll."},
    subclass:{name:"Champion",features:{3:"Improved Critical: your weapon attacks crit on 19 or 20.",7:"Remarkable Athlete: Advantage on Initiative and Athletics."}},
    startGold:125,startKit:["chain_mail","greatsword","hand_crossbow","potion_healing"],masteryKinds:3},
  rogue:{name:"Rogue",hitDie:8,saves:["dex","int"],spellcasting:null,armor:["light"],weapons:["simple","martial-finesse"],
    desc:"A stealthy trickster who strikes where it hurts.",
    features:{1:["Expertise","Sneak Attack","Thieves' Cant","Weapon Mastery"],2:["Cunning Action"],3:["Steady Aim","Subclass: Thief"],4:["Ability Score Improvement"],5:["Cunning Strike","Uncanny Dodge"],6:["Expertise"],7:["Evasion","Reliable Talent"],8:["Ability Score Improvement"]},
    featureText:{"Sneak Attack":"Once per turn, deal extra damage (1d6, +1d6 every 2 levels) when you have Advantage or an ally is beside your target, using a Finesse or ranged weapon.","Cunning Action":"Bonus Action to Dash, Disengage, or Hide.","Steady Aim":"Bonus Action: gain Advantage on your next attack this turn if you haven't moved.","Uncanny Dodge":"Reaction: halve the damage of one attack that hits you.","Evasion":"Dex saves for half damage instead become no damage on a success, half on a failure.","Cunning Strike":"Trade Sneak Attack dice for effects (Poison, Trip, Withdraw)."},
    subclass:{name:"Thief",features:{3:"Fast Hands + Second-Story Work: climb faster, use objects as a Bonus Action."}},
    sneakDice:l=>Math.ceil(l/2),startGold:100,startKit:["leather","shortsword","shortsword","shortbow","thieves_tools"],masteryKinds:2},
  monk:{name:"Monk",hitDie:8,saves:["str","dex"],spellcasting:null,armor:[],weapons:["simple","martial-light"],
    desc:"A martial artist channelling Focus through body and mind.",
    features:{1:["Martial Arts","Unarmored Defense"],2:["Focus Points","Unarmored Movement","Uncanny Metabolism"],3:["Deflect Attacks","Subclass: Warrior of the Open Hand"],4:["Ability Score Improvement","Slow Fall"],5:["Extra Attack","Stunning Strike"],6:["Empowered Strikes","Unarmored Movement +10"],7:["Evasion","Stillness of Mind"],8:["Ability Score Improvement"]},
    featureText:{"Martial Arts":"Use Dexterity for unarmed strikes and monk weapons; unarmed strike damage die starts at 1d6 and grows. Bonus Action unarmed strike.","Focus Points":"Spend points (equal to Monk level) on Flurry of Blows, Patient Defense, Step of the Wind. Regained on Short Rest.","Deflect Attacks":"Reaction: reduce an attack's damage by 1d10 + Dex + level; if reduced to 0, you may redirect it.","Stunning Strike":"Once per turn on a hit, spend 1 Focus: target makes a Con save or is Stunned until your next turn."},
    subclass:{name:"Warrior of the Open Hand",features:{3:"Open Hand Technique: your Flurry hits can knock Prone, push, or deny Reactions."}},
    startGold:50,startKit:["spear","dagger","dagger","dagger","dagger"]},
  cleric:{name:"Cleric",hitDie:8,saves:["wis","cha"],spellcasting:"full",spellAbility:"wis",armor:["light","medium","shield"],weapons:["simple"],
    desc:"A priest wielding divine magic in a god's service.",
    features:{1:["Spellcasting","Divine Order"],2:["Channel Divinity"],3:["Subclass: Life Domain"],4:["Ability Score Improvement"],5:["Sear Undead"],6:["Life: Blessed Healer"],7:["Blessed Strikes"],8:["Ability Score Improvement"]},
    featureText:{"Spellcasting":"Prepare Wisdom-based spells; slots as a full caster.","Channel Divinity":"2 uses (more later): Turn Undead or Divine Spark (heal or harm 1d8 + Wis). Regained on Short Rest (1) / Long Rest.","Divine Order":"Protector (martial weapons + heavy armour training) or Thaumaturge. This build: Protector for companions, Thaumaturge for custom."},
    subclass:{name:"Life Domain",features:{3:"Disciple of Life: your healing spells restore extra HP (2 + spell level). Preserve Life via Channel Divinity.",6:"Blessed Healer: when you heal another, you regain 2 + spell level HP."}},
    startGold:110,startKit:["chain_shirt","shield","mace","potion_healing"],cantripsAt:l=>CANTRIPS.cleric[l-1],prepared:l=>PREPARED_FULL[l-1],masteryKinds:0},
  druid:{name:"Druid",hitDie:8,saves:["int","wis"],spellcasting:"full",spellAbility:"wis",armor:["light","shield"],weapons:["simple"],
    desc:"A priest of the Old Faith, wielding the powers of nature.",
    features:{1:["Spellcasting","Druidic","Primal Order"],2:["Wild Shape","Wild Companion"],3:["Subclass: Circle of the Land"],4:["Ability Score Improvement"],5:["Wild Resurgence"],6:["Land: Natural Recovery"],7:["Elemental Fury"],8:["Ability Score Improvement"]},
    featureText:{"Spellcasting":"Prepare Wisdom-based spells; full caster slots.","Wild Shape":"Bonus Action: transform into a beast (here: Wolf form — speed 40, bite attack, Pack Tactics), gaining temporary HP equal to your Druid level. Uses grow with level; regain 1 on a Short Rest.","Wild Companion":"Spend a spell slot or a Wild Shape use to cast Find Familiar (fey) as a Magic action.","Wild Resurgence":"Once per turn, convert a spell slot into a Wild Shape use (no action); or convert a Wild Shape use into a 1st-level slot, once per Long Rest.","Natural Recovery":"Recover spell slots on a Short Rest once per day (up to half your level in slot levels)."},
    subclass:{name:"Circle of the Land",features:{3:"Land's Aid + circle spells for your chosen land (Temperate)."}},
    startGold:50,startKit:["leather","shield","quarterstaff","potion_healing"],cantripsAt:l=>CANTRIPS.druid[l-1],prepared:l=>PREPARED_FULL[l-1],masteryKinds:0},
  wizard:{name:"Wizard",hitDie:6,saves:["int","wis"],spellcasting:"full",spellAbility:"int",armor:[],weapons:["simple"],
    desc:"A scholarly magic-user of supreme versatility.",
    features:{1:["Spellcasting","Ritual Adept","Arcane Recovery"],2:["Scholar"],3:["Subclass: Evoker"],4:["Ability Score Improvement"],5:["Memorize Spell"],6:["Evoker: Potent Cantrip"],7:[],8:["Ability Score Improvement"]},
    featureText:{"Spellcasting":"Your spellbook holds your spells; prepare Intelligence-based spells each day. Full caster slots.","Arcane Recovery":"On a Short Rest, recover spell slots with a combined level up to half your Wizard level (rounded up, none of level 6+), once per Long Rest. (Spells menu button.)","Memorize Spell":"On a Short Rest, swap one prepared spell for another in your spellbook. (Use the Spells menu during/after a rest.)","Scholar":"Expertise in one proficient skill: Arcana, History, Investigation, Medicine, Nature, or Religion (chosen automatically: your best one).","Ritual Adept":"Cast rituals from your spellbook without preparing them."},
    subclass:{name:"Evoker",features:{3:"Sculpt Spells: allies in your evocation areas automatically succeed on their saves and take no damage.",6:"Potent Cantrip: your cantrips deal half damage on a successful save."}},
    startGold:90,startKit:["quarterstaff","dagger","potion_healing","potion_healing"],cantripsAt:l=>CANTRIPS.wizard[l-1],prepared:l=>PREPARED_FULL[l-1],masteryKinds:0},
  sorcerer:{name:"Sorcerer",hitDie:6,saves:["con","cha"],spellcasting:"full",spellAbility:"cha",armor:[],weapons:["simple"],
    desc:"A spellcaster with innate, blood-borne magic.",
    features:{1:["Spellcasting","Innate Sorcery"],2:["Font of Magic","Metamagic"],3:["Subclass: Draconic Sorcery"],4:["Ability Score Improvement"],5:["Sorcerous Restoration"],6:["Draconic: Elemental Affinity"],7:[],8:["Ability Score Improvement"]},
    featureText:{"Spellcasting":"Know Charisma-based spells; full caster slots.","Innate Sorcery":"Bonus Action, 1 minute: +1 spell save DC and Advantage on spell attack rolls. 2 uses per Long Rest.","Metamagic":"2 options (e.g. Quickened, Twinned, Empowered, Heightened) powered by Sorcery Points = level.","Font of Magic":"Convert spell slots <-> Sorcery Points."},
    subclass:{name:"Draconic Sorcery",features:{3:"Draconic Resilience: +level max HP and AC 10+Dex+Cha while unarmoured.",6:"Elemental Affinity: add Cha to one damage roll of your draconic element (chosen: Fire)."}},
    startGold:50,startKit:["spear","dagger","dagger","light_crossbow"],cantripsAt:l=>CANTRIPS.sorcerer[l-1],known:l=>PREPARED_SORC[l-1],masteryKinds:0},
  warlock:{name:"Warlock",hitDie:8,saves:["wis","cha"],spellcasting:"pact",spellAbility:"cha",armor:["light"],weapons:["simple"],
    desc:"A wielder of magic granted by an otherworldly patron.",
    features:{1:["Pact Magic","Eldritch Invocations"],2:["Magical Cunning"],3:["Subclass: The Fiend"],4:["Ability Score Improvement"],5:[],6:["Fiend: Dark One's Own Luck"],7:[],8:["Ability Score Improvement"]},
    featureText:{"Pact Magic":"Few slots, but all at your highest level and regained on a Short Rest.","Eldritch Invocations":"1 at level 1, growing to 6 by level 8 — choose them in the Spells menu. Agonizing Blast needs Warlock level 2.","Magical Cunning":"Once per Long Rest, a 1-minute rite regains up to half your maximum Pact slots (rounded up)."},
    subclass:{name:"The Fiend",features:{3:"Dark One's Blessing: when you reduce a creature to 0 HP, gain temp HP = Cha + Warlock level.",6:"Dark One's Own Luck: add 1d10 to one check or save, once per Short Rest."}},
    startGold:100,startKit:["leather","sickle","dagger","dagger","light_crossbow"],cantripsAt:l=>CANTRIPS.warlock[l-1],known:l=>PREPARED_WARLOCK[l-1],masteryKinds:0},
  bard:{name:"Bard",hitDie:8,saves:["dex","cha"],spellcasting:"full",spellAbility:"cha",armor:["light"],weapons:["simple","martial-finesse"],
    desc:"An inspiring magician whose power echoes creation itself.",
    features:{1:["Spellcasting","Bardic Inspiration"],2:["Expertise","Jack of All Trades"],3:["Subclass: College of Lore"],4:["Ability Score Improvement"],5:["Font of Inspiration"],6:["Lore: Magical Discoveries"],7:["Countercharm"],8:["Ability Score Improvement"]},
    featureText:{"Spellcasting":"Know Charisma-based spells; full caster slots.","Bardic Inspiration":"Bonus Action: give an ally a Bardic Inspiration die (d6, grows) to add to one roll. Uses = Cha mod, regained on Long Rest (Font of Inspiration: also Short Rest at L5).","Jack of All Trades":"Add half your PB to ability checks that don't already use it."},
    subclass:{name:"College of Lore",features:{3:"Bonus proficiencies + Cutting Words: spend Bardic Inspiration to subtract from an enemy's roll."}},
    startGold:90,startKit:["leather","rapier","dagger","dagger"],cantripsAt:l=>CANTRIPS.bard[l-1],known:l=>PREPARED_FULL[l-1],masteryKinds:0},
  paladin:{name:"Paladin",hitDie:10,saves:["wis","cha"],spellcasting:"half",spellAbility:"cha",armor:["light","medium","heavy","shield"],weapons:["simple","martial"],
    desc:"A holy warrior bound to a sacred oath.",
    features:{1:["Lay on Hands","Spellcasting","Weapon Mastery"],2:["Divine Smite","Fighting Style","Paladin's Smite"],3:["Channel Divinity","Subclass: Oath of Devotion"],4:["Ability Score Improvement"],5:["Extra Attack","Faithful Steed"],6:["Aura of Protection"],7:[],8:["Ability Score Improvement"]},
    featureText:{"Lay on Hands":"Bonus Action: restore any number of HP from a pool of 5 x Paladin level with a touch; spending 5 points also cures the Poisoned condition.","Divine Smite":"Bonus Action on a melee hit, once per turn: expend a spell slot for +2d8 radiant (+1d8 per slot level above 1st; +1d8 more against fiends and undead).","Paladin's Smite":"Divine Smite is always prepared and can be cast free once per Long Rest.","Aura of Protection":"You and allies within 10 ft add your Cha mod (minimum +1) to saving throws, while you aren't Incapacitated.","Spellcasting":"2024 Paladins cast from level 1 (half caster)."},
    subclass:{name:"Oath of Devotion",features:{3:"Sacred Weapon via Channel Divinity; Oath spells."}},
    startGold:125,startKit:["chain_mail","shield","longsword","potion_healing"],prepared:l=>PREPARED_HALF[l-1],masteryKinds:2},
  ranger:{name:"Ranger",hitDie:10,saves:["str","dex"],spellcasting:"half",spellAbility:"wis",armor:["light","medium","shield"],weapons:["simple","martial"],
    desc:"A warrior of the wilderness, hunter of favoured enemies.",
    features:{1:["Spellcasting","Favored Enemy","Weapon Mastery"],2:["Deft Explorer","Fighting Style"],3:["Subclass: Hunter"],4:["Ability Score Improvement"],5:["Extra Attack"],6:["Roving"],7:["Hunter: Multiattack Defense"],8:["Ability Score Improvement"]},
    featureText:{"Spellcasting":"Half caster from level 1 (2024), Wisdom-based.","Favored Enemy":"Hunter's Mark is always prepared, and you can cast it free 2 times per Long Rest (3 times from level 5).","Weapon Mastery":"Use the Mastery properties of two kinds of weapons.","Deft Explorer":"Expertise in one skill of your choice (granted automatically to your best Ranger skill).","Roving":"+10 ft Speed while not wearing Heavy armour.","Extra Attack":"Attack twice with the Attack action."},
    subclass:{name:"Hunter",features:{3:"Hunter's Prey: Colossus Slayer — +1d8 damage once per turn to a creature below its HP maximum."}},
    startGold:110,startKit:["studded","longbow","longsword","shortsword"],prepared:l=>PREPARED_HALF[l-1],masteryKinds:2},
};
const CLASS_LIST = Object.keys(CLASSES);

// ---------------- SPECIES (SRD 9) ----------------
const SPECIES = {
  human:{name:"Human",speed:30,size:"Medium",traits:["Resourceful: gain Heroic Inspiration after every Long Rest.","Skillful: proficiency in one extra skill.","Versatile: gain an extra Origin feat."],desc:"Adaptable and ambitious, found everywhere."},
  elf:{name:"Elf",speed:30,size:"Medium",darkvision:60,traits:["Darkvision 60 ft","Fey Ancestry: Advantage on saves vs Charmed.","Keen Senses: Perception proficiency.","Trance: long rest in 4 hours (flavour).","Elven Lineage (High Elf): one Wizard cantrip (this build: Fire Bolt) and Misty Step at level 5."],desc:"Graceful folk with keen senses and long lives."},
  dwarf:{name:"Dwarf",speed:30,size:"Medium",darkvision:120,traits:["Darkvision 120 ft","Dwarven Resilience: Resistance to poison; Advantage on saves vs Poison.","Dwarven Toughness: +1 max HP per level.","Stonecunning: tremorsense on stone (flavour)."],desc:"Stout, steadfast, and nearly impossible to poison."},
  halfling:{name:"Halfling",speed:30,size:"Small",traits:["Brave: Advantage on saves vs Frightened.","Halfling Nimbleness: move through larger creatures' spaces.","Luck: reroll a natural 1 on a d20 test.","Naturally Stealthy: can hide behind larger creatures."],desc:"Small, lucky, and braver than they look."},
  dragonborn:{name:"Dragonborn",speed:30,size:"Medium",darkvision:60,traits:["Draconic Ancestry (Red — Fire).","Breath Weapon: 15-ft cone, Dex save, fire damage (1d10, grows to 4d10), PB uses per Long Rest — usable in place of one attack.","Damage Resistance: Fire.","Darkvision 60 ft."],desc:"Proud heirs of dragonkind."},
  gnome:{name:"Gnome",speed:30,size:"Small",darkvision:60,traits:["Darkvision 60 ft","Gnome Cunning: Advantage on Int, Wis and Cha saves against magic.","Forest Gnome: Speak with Animals (flavour) and Minor Illusion cantrip."],desc:"Curious, clever, and magically hard-headed."},
  goliath:{name:"Goliath",speed:35,size:"Medium",traits:["Speed 35 ft","Giant Ancestry (Stone): Stone's Endurance — Reaction to reduce damage by 1d12 + Con, PB uses per Long Rest.","Large Form (L5): grow Large for 10 minutes.","Powerful Build: count as Large for carrying and grappling."],desc:"Towering descendants of giants."},
  orc:{name:"Orc",speed:30,size:"Medium",darkvision:120,traits:["Darkvision 120 ft","Adrenaline Rush: Dash as a Bonus Action and gain temp HP = PB. PB uses per Long Rest.","Relentless Endurance: drop to 1 HP instead of 0, once per Long Rest."],desc:"Relentless and driven, built for the charge."},
  tiefling:{name:"Tiefling",speed:30,size:"Medium",darkvision:60,traits:["Darkvision 60 ft","Fiendish Legacy (Infernal): Resistance to Fire; Hellish Rebuke at level 3, Darkness at level 5.","Otherworldly Presence: Thaumaturgy cantrip (flavour)."],desc:"Marked by the Nine Hells, but their own souls."},
};

// ---------------- BACKGROUNDS (SRD 4) ----------------
const BACKGROUNDS = {
  acolyte:{name:"Acolyte",abilities:["int","wis","cha"],skills:["Insight","Religion"],feat:"Magic Initiate (Cleric)",gold:50,desc:"You served in a temple, learning rites and scripture. Origin feat: Magic Initiate (Cleric) — here: Sacred Flame + one extra 1st-level Cleric spell prepared."},
  criminal:{name:"Criminal",abilities:["dex","con","int"],skills:["Sleight of Hand","Stealth"],feat:"Alert",gold:16,desc:"You lived by your wits on the wrong side of the law. Origin feat: Alert — +PB to Initiative, swap initiative with an ally (here: +PB to Initiative)."},
  sage:{name:"Sage",abilities:["con","int","wis"],skills:["Arcana","History"],feat:"Magic Initiate (Wizard)",gold:50,desc:"You spent years in libraries and scriptoria. Origin feat: Magic Initiate (Wizard) — here: one extra cantrip (Fire Bolt) + one extra 1st-level Wizard spell."},
  soldier:{name:"Soldier",abilities:["str","dex","con"],skills:["Athletics","Intimidation"],feat:"Savage Attacker",gold:14,desc:"You marched and fought in an army's ranks. Origin feat: Savage Attacker — once per turn, roll weapon damage twice and use either result."},
};

// ---------------- FEATS (for ASI choices + origins) ----------------
const FEATS = {
  tough:{name:"Tough",desc:"+2 max HP per level (retroactive)."},
  lucky:{name:"Lucky",desc:"Luck points = PB per Long Rest: gain Advantage on a d20 test, or impose Disadvantage on an attack against you. (Here: auto-granted Advantage token usable from the Character menu.)"},
  alert:{name:"Alert",desc:"+PB to Initiative (already included if taken)."},
  savage_attacker:{name:"Savage Attacker",desc:"Once per turn, roll weapon damage twice and use either."},
  healer:{name:"Healer",desc:"With a Healer's Kit, heal 1d6+4+level HP as an Action; reroll 1s on healing dice."},
  skilled:{name:"Skilled",desc:"Gain proficiency in any 3 skills (chosen on the Character sheet)."},
  magic_initiate:{name:"Magic Initiate",desc:"Learn 2 cantrips and one 1st-level spell from a chosen class list."},
  durable:{name:"Durable",desc:"Advantage on death saves; as a Bonus Action spend a Hit Die to heal."},
};

// ---------------- MONSTERS (SRD 5.2.1 / 2025 MM values) ----------------
// atk: {name, bonus, dmg:[n,d], type, ranged?, reach?}  traits: keys read by the engine
const MONSTERS = {
  goblin:{profile:"skirmisher",name:"Goblin Warrior",cr:"1/4",xp:50,ac:15,hp:10,speed:30,ab:{str:8,dex:15,con:10,int:10,wis:8,cha:8},skills:{Stealth:6},creatureType:"fey",
    atk:[{name:"Scimitar",bonus:4,dmg:[1,6],mod:2,type:"slashing",advRider:[1,4]},{name:"Shortbow",bonus:4,dmg:[1,6],mod:2,type:"piercing",ranged:true,range:80,advRider:[1,4]}],
    traits:["Nimble Escape: Disengage or Hide as a Bonus Action.","Advantage rider: +1d4 damage when the attack roll had Advantage.","Reaction — Redirect Attack: swap places with a nearby ally, who becomes the target instead."],bonusAction:"disengage",redirectAttack:true},
  skeleton:{profile:"mindless",name:"Skeleton",cr:"1/4",xp:50,ac:14,hp:13,speed:30,ab:{str:10,dex:16,con:15,int:6,wis:8,cha:5},creatureType:"undead",
    atk:[{name:"Shortsword",bonus:5,dmg:[1,6],mod:3,type:"piercing"},{name:"Shortbow",bonus:5,dmg:[1,6],mod:3,type:"piercing",ranged:true,range:80}],
    vuln:["bludgeoning"],immune:["poison"],traits:["Vulnerable to bludgeoning.","Immune to poison."]},
  zombie:{profile:"mindless",name:"Zombie",cr:"1/4",xp:50,ac:8,hp:15,speed:20,ab:{str:13,dex:6,con:16,int:3,wis:6,cha:5},creatureType:"undead",
    atk:[{name:"Slam",bonus:3,dmg:[1,6],mod:1,type:"bludgeoning"}],
    immune:["poison"],traits:["Undead Fortitude: when reduced to 0 HP, Con save (DC 5 + damage) to drop to 1 instead — not on radiant damage or crits."],fortitude:true},
  bandit:{profile:"skirmisher",name:"Bandit",cr:"1/8",xp:25,ac:12,hp:11,speed:30,ab:{str:11,dex:12,con:12,int:10,wis:10,cha:10},creatureType:"humanoid",
    atk:[{name:"Scimitar",bonus:3,dmg:[1,6],mod:1,type:"slashing"},{name:"Light Crossbow",bonus:3,dmg:[1,8],mod:1,type:"piercing",ranged:true,range:80}],
    traits:[]},
  wolf:{profile:"beast",name:"Wolf",cr:"1/4",xp:50,ac:12,hp:11,speed:40,ab:{str:12,dex:15,con:12,int:3,wis:12,cha:6},skills:{Perception:3,Stealth:4},creatureType:"beast",
    atk:[{name:"Bite",bonus:4,dmg:[2,4],mod:2,type:"piercing",trip:{dc:11,save:"str"}}],
    traits:["Pack Tactics: Advantage on attacks if an ally is beside the target."],packTactics:true},
  giant_rat:{profile:"beast",name:"Giant Rat",cr:"1/8",xp:25,ac:13,hp:7,speed:30,ab:{str:7,dex:15,con:11,int:2,wis:10,cha:4},creatureType:"beast",
    atk:[{name:"Bite",bonus:4,dmg:[1,4],mod:2,type:"piercing"}],traits:["Pack Tactics."],packTactics:true},
  cultist_fanatic:{profile:"caster",name:"Cultist Fanatic",cr:"2",xp:450,ac:13,hp:44,speed:30,ab:{str:11,dex:14,con:12,int:10,wis:13,cha:14},creatureType:"humanoid",saveProf:["dex","wis"],
    atk:[{name:"Dagger",bonus:4,dmg:[1,4],mod:2,type:"piercing",multi:2}],
    spells:{dc:13,atkBonus:5,list:["inflict_wounds","hold_person","spiritual_weapon"],slotLevels:{1:4,2:3}},
    traits:["Dark Devotion: Advantage on saves vs Charmed/Frightened.","Spellcaster: Inflict Wounds, Hold Person, Spiritual Weapon."]},
  hobgoblin:{profile:"soldier",name:"Hobgoblin Warrior",cr:"1/2",xp:100,ac:18,hp:11,speed:30,ab:{str:13,dex:12,con:12,int:10,wis:10,cha:9},creatureType:"fey",
    atk:[{name:"Longsword",bonus:3,dmg:[2,10],mod:1,type:"slashing"},{name:"Longbow",bonus:3,dmg:[1,8],mod:1,type:"piercing",ranged:true,range:150,extra:[{dmg:[3,4],type:"poison"}]}],
    traits:["Pack Tactics: Advantage on attacks if an ally is beside the target.","Longbow arrows are poisoned: +3d4 poison damage on a hit."],packTactics:true},
  bugbear:{profile:"brute",name:"Bugbear Warrior",cr:"1",xp:200,ac:14,hp:33,speed:30,ab:{str:15,dex:14,con:13,int:8,wis:11,cha:9},creatureType:"fey",
    atk:[{name:"Morningstar",bonus:4,dmg:[2,8],mod:2,type:"piercing"},{name:"Javelin",bonus:4,dmg:[2,6],mod:2,type:"piercing",ranged:true,range:30}],
    traits:["Brute: weapons deal one extra die (included above).","Surprise Attack: +2d6 if the target is surprised."]},
  ogre:{profile:"brute",name:"Ogre",cr:"2",xp:450,ac:11,hp:68,speed:40,ab:{str:19,dex:8,con:16,int:5,wis:7,cha:7},large:true,creatureType:"giant",
    atk:[{name:"Greatclub",bonus:6,dmg:[2,8],mod:4,type:"bludgeoning"},{name:"Javelin",bonus:6,dmg:[2,6],mod:4,type:"piercing",ranged:true,range:30}],
    traits:[]},
  ghoul:{profile:"beast",name:"Ghoul",cr:"1",xp:200,ac:12,hp:22,speed:30,ab:{str:13,dex:15,con:10,int:7,wis:10,cha:6},creatureType:"undead",
    atk:[{name:"Claws",bonus:4,dmg:[2,4],mod:2,type:"slashing",paralyze:{dc:10,save:"con"}},{name:"Bite",bonus:2,dmg:[2,6],mod:2,type:"piercing"}],
    immune:["poison"],traits:["Claws: Con save DC 10 or Paralyzed 1 minute (not elves)."]},
  wight:{profile:"soldier",name:"Wight",cr:"3",xp:700,ac:14,hp:45,speed:30,ab:{str:15,dex:14,con:16,int:10,wis:13,cha:15},creatureType:"undead",
    atk:[{name:"Longsword",bonus:6,dmg:[1,8],mod:4,type:"slashing"},{name:"Life Drain",bonus:6,dmg:[1,8],mod:4,type:"necrotic",drain:true}],
    resist:["necrotic"],resistNonmagic:true,traits:["Life Drain: on a hit, Con save DC 13 or max HP reduced by the damage.","Resistant to necrotic and to non-magical bludgeoning/piercing/slashing."]},
  acolyte:{profile:"caster",name:"Acolyte",cr:"1/4",xp:50,ac:10,hp:9,speed:30,ab:{str:10,dex:10,con:10,int:10,wis:14,cha:11},creatureType:"humanoid",saveProf:["wis"],
    atk:[{name:"Club",bonus:2,dmg:[1,4],mod:0,type:"bludgeoning"}],
    spells:{dc:12,atkBonus:4,list:["sacred_flame","cure_wounds","bless"],slotLevels:{1:3}},traits:["Spellcaster (healer)."]},
  mage:{profile:"caster",name:"Mage",cr:"6",xp:2300,ac:12,hp:40,speed:30,ab:{str:9,dex:14,con:11,int:17,wis:12,cha:11},creatureType:"humanoid",saveProf:["int","wis"],
    atk:[{name:"Dagger",bonus:5,dmg:[1,4],mod:2,type:"piercing"}],
    spells:{dc:14,atkBonus:6,list:["fireball","magic_missile","counterspell","shield","misty_step"],slotLevels:{1:4,2:3,3:3}},
    traits:["Spellcaster: Fireball, Magic Missile, Counterspell, Shield, Misty Step."]},
  vespera:{profile:"caster",name:"Vespera Thane, the Pale Shepherdess",cr:"7",xp:2900,ac:13,hp:84,speed:30,ab:{str:10,dex:14,con:14,int:16,wis:18,cha:17},boss:true,creatureType:"humanoid",
    atk:[{name:"Shepherd's Crook",bonus:6,dmg:[1,8],mod:3,type:"bludgeoning"}],
    spells:{dc:15,atkBonus:7,list:["blight","hold_person","spirit_guardians","counterspell"],slotLevels:{1:4,2:3,3:2}},
    resist:["necrotic"],traits:["Legendary figurehead of the Ashen Host.","Voice of the Harvest: her spells carry farther than they should."]},
  drowned_abbot:{profile:"caster",name:"The Drowned Abbot",cr:"3",xp:700,ac:13,hp:52,speed:30,ab:{str:14,dex:12,con:16,int:10,wis:15,cha:13},boss:true,creatureType:"undead",
    atk:[{name:"Drowned Censer",bonus:6,dmg:[2,6],mod:3,type:"bludgeoning"}],
    spells:{dc:13,atkBonus:5,list:["inflict_wounds","hold_person"],slotLevels:{1:4,2:3}},
    resist:["necrotic"],traits:["The chapel's last abbot, still ringing the drowned bell."]},
  captain_rusk:{profile:"soldier",name:"Captain Rusk, the Thorn of the Road",cr:"3",xp:700,ac:16,hp:58,speed:30,ab:{str:16,dex:14,con:14,int:11,wis:12,cha:13},boss:true,creatureType:"humanoid",
    atk:[{name:"Greataxe",bonus:6,dmg:[1,12],mod:3,type:"slashing",multi:2}],
    traits:["Bandit captain holding the Jewel shard.","Brutal: crits on 19-20."],critRange:19},
  forge_ogre:{profile:"brute",name:"Ghorza, Forge-Tyrant of Irondeep",cr:"4",xp:1100,ac:13,hp:85,speed:40,ab:{str:20,dex:8,con:17,int:6,wis:8,cha:8},boss:true,large:true,creatureType:"giant",
    atk:[{name:"Forge Maul",bonus:8,dmg:[2,10],mod:5,type:"bludgeoning"}],
    traits:["An ogre who took the mine's deep forge — and the Thorns shard with it."]},
};

const CONDITIONS = ["Blinded","Charmed","Deafened","Frightened","Grappled","Incapacitated","Invisible","Paralyzed","Petrified","Poisoned","Prone","Restrained","Stunned","Unconscious","Exhaustion"];
