// THE HOLLOW CROWN — engine + UI. D&D 2024 (SRD 5.2.1) rules implemented in code.
// Part 1: dice, characters, derived stats, state, save/load.
"use strict";
const $ = id => document.getElementById(id);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const esc = s => String(s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

// ---------- Dice ----------
function rollDie(d){ return 1 + Math.floor(Math.random()*d); }
function rollDice(n,d){ let rolls=[],tot=0; for(let i=0;i<n;i++){ const r=rollDie(d); rolls.push(r); tot+=r; } return {rolls,tot}; }
function d20roll(mode){ // mode: 'adv' | 'dis' | null -> {kept, rolls}
  if(mode==='adv'||mode==='dis'){ const a=rollDie(20),b=rollDie(20); return {kept: mode==='adv'?Math.max(a,b):Math.min(a,b), rolls:[a,b]}; }
  const a=rollDie(20); return {kept:a, rolls:[a]};
}
// A full d20 test. Returns {total, kept, crit, fumble, success}
function d20Test({bonus=0, adv=null, dc=null, critRange=20}={}){
  const r = d20roll(adv);
  const total = r.kept + bonus;
  const crit = r.kept>=critRange, fumble = r.kept===1;
  let success = dc==null? null : (crit? true : fumble? false : total>=dc);
  return {total, kept:r.kept, rolls:r.rolls, crit, fumble, success, bonus};
}

// ---------- Class skill choices ----------
const SKILL_CHOICES = {
  barbarian:{n:2,from:["Animal Handling","Athletics","Intimidation","Nature","Perception","Survival"]},
  fighter:{n:2,from:["Acrobatics","Animal Handling","Athletics","History","Insight","Intimidation","Perception","Survival"]},
  rogue:{n:4,from:["Acrobatics","Athletics","Deception","Insight","Intimidation","Investigation","Perception","Performance","Persuasion","Sleight of Hand","Stealth"]},
  monk:{n:2,from:["Acrobatics","Athletics","History","Insight","Religion","Stealth"]},
  cleric:{n:2,from:["History","Insight","Medicine","Persuasion","Religion"]},
  druid:{n:2,from:["Arcana","Animal Handling","Insight","Medicine","Nature","Perception","Religion","Survival"]},
  wizard:{n:2,from:["Arcana","History","Insight","Investigation","Medicine","Religion"]},
  sorcerer:{n:2,from:["Arcana","Deception","Insight","Intimidation","Persuasion","Religion"]},
  warlock:{n:2,from:["Arcana","Deception","History","Intimidation","Investigation","Nature","Religion"]},
  bard:{n:3,from:Object.keys(SKILLS)},
  paladin:{n:2,from:["Athletics","Insight","Intimidation","Medicine","Persuasion","Religion"]},
  ranger:{n:3,from:["Animal Handling","Athletics","Insight","Investigation","Nature","Perception","Stealth","Survival"]},
};

// ---------- Character factory ----------
let CHAR_SEQ = 1;
function makeChar({name, classId, speciesId, bgId, abilities, skills=[], feats=[], isHero=false}){
  const cls = CLASSES[classId];
  const c = {
    uid: "c"+(CHAR_SEQ++), name, classId, speciesId, bgId, isHero,
    level:1, xp:0, abilities:Object.assign({},abilities),
    skillProf: skills.slice(), expertise: [],
    hpRolls:[cls.hitDie], // die-part of max HP per level (level 1 = full die)
    tempHp:0, slotsUsed:{}, pactUsed:0, hitDiceUsed:0,
    equip:{weapon:null, armor:null, shield:false, offhand:null},
    spellsKnown:[], conditions:[], inspiration:false, dead:false, downed:false,
    deathSaves:{s:0,f:0}, concentrating:null, concTarget:null, mageArmor:false,
    res:{}, feats:feats.slice(), subclass:false, wildShape:false, wildTemp:0,
    raging:false, smiteFreeUsed:false, hmFreeUsed:0, luckUsed:0, guidanceReady:false,
    x:0,y:0, color:"#c9a227", token:"?",
  };
  c.hp = maxHp(c);
  resetResources(c,true);
  return c;
}
function resetResources(c, full){
  const cls = c.classId, L = c.level;
  c.res = {};
  if(cls==="barbarian") c.res.rage = CLASSES.barbarian.rageUses(L);
  if(cls==="fighter") c.res.secondWind = L>=10?3:2;
  if(cls==="cleric") c.res.channel = L>=2?2:0;
  if(cls==="paladin") c.res.channel = L>=3?2:0;
  if(cls==="monk") c.res.focus = L>=2?L:0;
  if(cls==="sorcerer") c.res.sorcery = L>=2?L:0;
  if(cls==="bard") c.res.bardic = Math.max(1, amod(c,"cha"));
  if(cls==="paladin") c.res.layPool = 5*L;
  if(cls==="druid") c.res.wildShape = L>=2?2:0;
  if(cls==="warlock") c.res.cunningUsed = false;
  c.smiteFreeUsed = false; c.hmFreeUsed = 0;
  if(full){ c.slotsUsed = {}; c.pactUsed = 0; }
}
function shortRestResources(c){
  if(c.classId==="fighter") c.res.secondWind = Math.min((c.level>=10?3:2), (c.res.secondWind||0)+1);
  if(c.classId==="cleric"||c.classId==="paladin") c.res.channel = Math.min(2,(c.res.channel||0)+1);
  if(c.classId==="monk") c.res.focus = c.level>=2?c.level:0;
  if(c.classId==="druid") c.res.wildShape = c.level>=2?2:0;
  if(c.classId==="warlock") c.pactUsed = 0;
  if(c.classId==="bard" && c.level>=5) c.res.bardic = Math.max(1, amod(c,"cha"));
  if(c.classId==="sorcerer" && c.level>=5) c.res.sorcery = Math.min(c.level,(c.res.sorcery||0)+Math.floor(c.level/2));
}

// ---------- Derived stats ----------
function amod(c,a){ return modOf(c.abilities[a]); }
function pb(c){ return pbForLevel(c.level); }
function hasFeat(c,id){ return c.feats.includes(id); }
function saveBonus(c,a){
  let b = amod(c,a) + (CLASSES[c.classId].saves.includes(a)? pb(c):0);
  // Aura of Protection from a nearby paladin is handled in combat checks; own aura:
  return b;
}
function skillBonus(c,skill){
  const ab = SKILLS[skill];
  let b = amod(c,ab);
  if(c.skillProf.includes(skill)) b += pb(c) * (c.expertise.includes(skill)?2:1);
  else if(c.classId==="bard" && c.level>=2) b += Math.floor(pb(c)/2); // Jack of All Trades
  return b;
}
function passivePerception(c){ return 10 + skillBonus(c,"Perception"); }
function initiativeBonus(c){ let b = amod(c,"dex"); if(hasFeat(c,"alert")) b += pb(c); if(c.classId==="fighter"&&c.level>=7) b+=pb(c); return b; }
function speedOf(c){
  let s = SPECIES[c.speciesId] ? SPECIES[c.speciesId].speed : 30;
  if(c.classId==="monk" && !c.equip.armor) s += c.level>=6?15: c.level>=2?10:0;
  if(c.classId==="barbarian" && c.level>=5 && !(c.equip.armor && armorDef(c.equip.armor).kind==="heavy")) s += 10;
  const arm = c.equip.armor? armorDef(c.equip.armor):null;
  if(arm && arm.strReq && c.abilities.str < arm.strReq) s -= 10;
  return Math.max(5,s);
}
function maxHp(c){
  const cls = CLASSES[c.classId];
  let hp = c.hpRolls.reduce((a,b)=>a+b,0) + amod(c,"con")*c.level;
  if(c.speciesId==="dwarf") hp += c.level;
  if(c.classId==="sorcerer" && c.subclass) hp += c.level; // Draconic Resilience
  if(hasFeat(c,"tough")) hp += 2*c.level;
  hp += (c.aidBonus||0);
  hp -= (c.maxHpReduction||0);
  return Math.max(1,hp);
}
function armorClass(c){
  const dex = amod(c,"dex");
  let ac;
  const arm = c.equip.armor? armorDef(c.equip.armor):null;
  if(c.wildShape) ac = 13 + dex;
  else if(arm){ ac = arm.ac + (arm.bonus||0) + (arm.dexRule==="full"? dex : arm.dexRule==="max2"? Math.min(2,dex) : 0); }
  else if(c.mageArmor) ac = 13 + dex;
  else if(c.classId==="barbarian") ac = 10 + dex + amod(c,"con");
  else if(c.classId==="monk") ac = 10 + dex + amod(c,"wis");
  else if(c.classId==="sorcerer" && c.subclass) ac = 10 + dex + amod(c,"cha");
  else ac = 10 + dex;
  if(c.equip.shield) ac += 2;
  if(c.classId==="fighter" && arm) ac += 1; // Defense fighting style
  if(c.conditions.some(x=>x.name==="Hasted")) ac += 2;
  return ac;
}
function spellAbility(c){ const cl = CLASSES[c.classId]; return cl? cl.spellAbility : null; }
function spellDC(c){ return spellAbility(c)? 8 + amod(c,spellAbility(c)) + pb(c) + (c.classId==="sorcerer"&&c.innateActive?1:0) : 0; }
function spellAtkBonus(c){ return spellAbility(c)? amod(c,spellAbility(c)) + pb(c) : 0; }
function maxSlots(c){
  const t = CLASSES[c.classId].spellcasting;
  if(t==="full") return (FULL_SLOTS[c.level]||[]).slice();
  if(t==="half") return (HALF_SLOTS[c.level]||[]).slice();
  return [];
}
function slotsLeft(c, lvl){
  if(CLASSES[c.classId].spellcasting==="pact"){ const p = PACT_SLOTS[c.level]; return (p && p.lvl===lvl)? p.n - c.pactUsed : 0; }
  const m = maxSlots(c); return (m[lvl-1]||0) - (c.slotsUsed[lvl]||0);
}
function useSlot(c, lvl){
  if(CLASSES[c.classId].spellcasting==="pact"){ c.pactUsed++; return; }
  c.slotsUsed[lvl] = (c.slotsUsed[lvl]||0)+1;
}
function isProficientWith(c, w){
  const cats = CLASSES[c.classId].weapons;
  if(w.cat==="simple") return cats.includes("simple");
  if(cats.includes("martial")) return true;
  if(cats.includes("martial-finesse")) return w.props.includes("Finesse")||w.props.includes("Light");
  if(cats.includes("martial-light")) return w.props.includes("Light");
  return false;
}
function hasMastery(c){ return (CLASSES[c.classId].features[1]||[]).includes("Weapon Mastery"); }
function weaponAttackBonus(c, w){
  const ranged = !!w.ranged;
  const ab = ranged? "dex" : (w.props.includes("Finesse")? (amod(c,"str")>=amod(c,"dex")?"str":"dex") : "str");
  let b = amod(c,ab) + (isProficientWith(c,w)? pb(c):0) + (w.bonus||0);
  if(c.sacredWeapon) b += amod(c,"cha");
  return {bonus:b, ability:ab};
}
function sneakDice(c){ return c.classId==="rogue"? Math.ceil(c.level/2) : 0; }

// ---------- Game state ----------
let G = null;
function newGameState(hero){
  return {
    heroUid: hero.uid, party:[hero], gold: hero.startGold||0,
    inventory: [], // {id, qty}
    map:"emberford", quests:{}, flags:{}, codex:{}, chestsTaken:{}, encountersDone:{},
    log: [], startedAt: Date.now(), playMs: 0, kills:0, ending:null,
    companions:{}, guidanceFor:null,
  };
}
function hero(){ return G.party.find(c=>c.uid===G.heroUid); }
function addItem(id, qty=1){
  const s = G.inventory.find(i=>i.id===id);
  if(s) s.qty += qty; else G.inventory.push({id, qty});
}
function removeItem(id, qty=1){
  const s = G.inventory.find(i=>i.id===id); if(!s) return false;
  s.qty -= qty; if(s.qty<=0) G.inventory = G.inventory.filter(i=>i!==s);
  return true;
}
function countItem(id){ const s = G.inventory.find(i=>i.id===id); return s? s.qty:0; }
function hasItem(id){ return countItem(id)>0 || G.party.some(c=>c.equip.weapon===id||c.equip.armor===id||c.equip.offhand===id); }

// ---------- Log ----------
function log(msg, cls){
  G.log.push({msg, cls:cls||""});
  if(G.log.length>300) G.log.shift();
  const el = $("log"); if(el){ const d=document.createElement("div"); d.className="logline "+(cls||""); d.innerHTML=msg; el.appendChild(d); el.scrollTop = el.scrollHeight; while(el.children.length>300) el.removeChild(el.firstChild); }
}
function toast(msg){ const t=$("toast"); if(!t) return; t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"), 2600); }

// ---------- Save / Load ----------
const SAVE_KEY = "hollow-crown-save-v1";
function saveGame(){
  if(!G || (typeof COMBAT!=="undefined" && COMBAT)) return;
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(G)); }catch(e){}
}
function loadGame(){
  try{ const raw = localStorage.getItem(SAVE_KEY); if(!raw) return null; const g = JSON.parse(raw); CHAR_SEQ = 1000 + g.party.length*10; return g; }catch(e){ return null; }
}
function clearSave(){ try{ localStorage.removeItem(SAVE_KEY); }catch(e){} }

// Part 2: exploration — map rendering, movement, interaction, dialogue, quests, shops, rests.
"use strict";
let curMap = null; // MAPS entry + id
const TILE = 30;
const BLOCKED = new Set(["#","T","W"]);
function tileAt(map,x,y){
  if(y<0||y>=map.tiles.length||x<0||x>=map.tiles[y].length) return "#";
  return map.tiles[y][x];
}
function passable(map,x,y){ return !BLOCKED.has(tileAt(map,x,y)); }
function mapNPCs(){ return (curMap.npcs||[]).filter(n=>npcVisible(n.id)); }
function npcVisible(id){
  if(id==="fenn" && G.companions.fenn) return false;
  if(id==="lyra_s") return G.companions.lyra; // siege Lyra is a visual stand-in; real Lyra is in party
  if(id==="vespera_pre" && G.encountersDone["crypt_vespera"]) return false;
  if(id==="merchant" && questStage("SQ2")>=2) return true;
  return true;
}
function enterMap(mapId, tx, ty){
  let id = mapId;
  if(id==="emberford" && G.flags.siegeActive && !G.quests.MQ5?.done) id = "emberford_siege";
  G.map = id;
  curMap = Object.assign({id}, MAPS[id]);
  const h = hero();
  h.x = tx; h.y = ty;
  // companions trail behind
  let ox = tx, oy = ty;
  for(const c of G.party){ if(c===h) continue; c.x = ox; c.y = Math.min(curMap.tiles.length-1, oy+1); if(!passable(curMap,c.x,c.y)) c.x = Math.max(0,ox-1); }
  onEnterMap(id);
  refreshAll(); saveGame();
}
function onEnterMap(id){
  if(id==="chapel" && questStage("MQ2")===0){ setQuestStage("MQ2",1); log("The chapel air smells of black water and old incense.","sys"); }
  if(id==="irondeep"){
    if(questStage("MQ4")===0) setQuestStage("MQ4",1);
    if(questStage("SQ6")===-1){ startQuest("SQ6",0); log("Side quest started: <b>Irondeep Stragglers</b> — a side-chamber (west rooms) still holds hobgoblins.","sys"); }
  }
  if(id==="crypt" && questStage("MQ6")===0) setQuestStage("MQ6",1);
  if(id==="emberford" && questStage("MQ2")===3){
    completeQuest("MQ2"); startQuest("MQ3",0);
    log("<b>Main quest: The Thorn of the Road.</b> Captain Rusk's bandits hold the Whispering Wood — and, if Fenn's rumours are true, something pale and shining.","sys");
    toast("New main quest: The Thorn of the Road");
  }
  if(id==="emberford" && questStage("MQ4")===3 && !G.flags.siegeActive){
    completeQuest("MQ4"); startQuest("MQ5",0);
    G.flags.siegeActive = true;
    log("<b>THE PALE HARVEST HAS COME.</b> Bells. Screaming. The dead of Emberford walk its streets. Hold the town!","bad");
    toast("Emberford is under attack!");
    enterMap("emberford_siege", hero().x, hero().y);
  }
  if(id==="chapel" && questStage("SQ5")===-1 && questStage("MQ2")>=1){ startQuest("SQ5",0); }
}

// ---------- Quests ----------
function questStage(id){ const q = G.quests[id]; return q? q.stage : -1; }
function startQuest(id, stage=0){
  if(G.quests[id]) return;
  G.quests[id] = {stage, done:false};
  log(`Quest started: <b>${QUESTS[id].name}</b> — ${QUESTS[id].stages[stage]}`,"sys");
}
function setQuestStage(id, stage){
  const q = G.quests[id]; if(!q||q.done) return;
  q.stage = stage;
  log(`Quest updated: <b>${QUESTS[id].name}</b> — ${QUESTS[id].stages[stage]}`,"sys");
  refreshQuests();
}
function completeQuest(id){
  const q = G.quests[id]; if(!q||q.done) return;
  q.done = true;
  const r = QUESTS[id].rewards||{xp:0,gold:0};
  log(`<b>Quest complete: ${QUESTS[id].name}!</b> (+${r.xp} XP${r.gold?`, +${r.gold} gold`:""})`,"good");
  if(r.gold) G.gold += r.gold;
  if(id==="MQ1" && G.flags.mayor_bonus){ G.gold += 20; log("Negotiated bonus: +20 gold.","good"); }
  if(r.xp) awardXp(r.xp);
  if(id==="MQ5"){ G.flags.siegeActive=false; startQuest("MQ6",0); log("<b>Main quest: The Grave Garden.</b> The Royal Crypts wait beneath the temple vaults (north-east door of Emberford).","sys"); }
  refreshAll();
}
function advanceEncounterQuest(enc){
  // Called on encounter victory. Handles per-quest bespoke flow.
  const qid = enc.quest; if(!qid) return;
  const st = questStage(qid);
  if(qid==="MQ1"){ if(enc.id==="mill_goblins") setQuestStage("MQ1",2); if(enc.id==="cellar_chief") setQuestStage("MQ1",3); }
  if(qid==="MQ2"){
    if(enc.id==="chapel_dead1") G.flags.chapelA=true;
    if(enc.id==="chapel_dead2") G.flags.chapelB=true;
    if(G.flags.chapelA && G.flags.chapelB && st===1) setQuestStage("MQ2",2);
    if(enc.id==="chapel_abbot") setQuestStage("MQ2",3);
  }
  if(qid==="MQ3"){
    if(enc.id==="wood_bandits1") G.flags.bandA=true;
    if(enc.id==="wood_bandits2") G.flags.bandB=true;
    if(G.flags.bandA && G.flags.bandB && st===1) setQuestStage("MQ3",2);
    if(enc.id==="rusk_camp"){ setQuestStage("MQ3",3); completeQuest("MQ3"); startQuest("MQ4",0); log("<b>Main quest: Irondeep.</b> The mine road north of Emberford. The last Shard — the Thorns — lies in the deep forge.","sys"); }
  }
  if(qid==="MQ4"){ if(enc.id==="mine_hobs1") setQuestStage("MQ4",2); if(enc.id==="mine_forge") setQuestStage("MQ4",3); }
  if(qid==="MQ5"){ if(enc.id==="siege_wave1") setQuestStage("MQ5",1); if(enc.id==="siege_wave2") setQuestStage("MQ5",2); if(enc.id==="siege_wave3"){ setQuestStage("MQ5",3); completeQuest("MQ5"); } }
  if(qid==="MQ6"){
    if(enc.id==="crypt_dead1") G.flags.cryptA=true;
    if(enc.id==="crypt_dead2") G.flags.cryptB=true;
    if(G.flags.cryptA && G.flags.cryptB && st===1) setQuestStage("MQ6",2);
    if(enc.id==="crypt_vespera"){ setQuestStage("MQ6",3); setTimeout(()=>openDialogue("crown_choice"), 600); }
  }
  if(qid==="SQ1" && enc.id==="cellar_rats") setQuestStage("SQ1",1);
  if(qid==="SQ2" && enc.id==="wood_wolves") setQuestStage("SQ2",2);
  if(qid==="SQ4" && enc.id==="fold_wolves") setQuestStage("SQ4",1);
  if(qid==="SQ6" && enc.id==="mine_hobs2") completeQuest("SQ6");
}

// ---------- XP & levels ----------
function awardXp(xp){
  for(const c of G.party){ if(c.dead) continue; c.xp += xp; }
  log(`The party gains ${xp} XP.`,"sys");
  checkLevelUps();
}
function xpForNext(c){ return c.level>=20? Infinity : XP_TABLE[c.level]; }
function checkLevelUps(){
  for(const c of G.party){
    if(!c.dead && c.level<8 && c.xp >= XP_TABLE[c.level]){ openLevelUp(c); return; } // one at a time
  }
  refreshAll();
}

// ---------- Rendering ----------
function drawMap(){
  const cv = $("map-canvas"); if(!cv||!curMap) return;
  const ctx = cv.getContext("2d");
  const W = curMap.tiles[0].length, H = curMap.tiles.length;
  const ts = Math.floor(Math.min(cv.width/W, cv.height/H));
  const ox = Math.floor((cv.width - ts*W)/2), oy = Math.floor((cv.height - ts*H)/2);
  cv._ts = ts; cv._ox = ox; cv._oy = oy;
  ctx.fillStyle = "#0b0e13"; ctx.fillRect(0,0,cv.width,cv.height);
  const siege = curMap.siege;
  for(let y=0;y<H;y++) for(let x=0;x<W;x++){
    const t = curMap.tiles[y][x], px = ox+x*ts, py = oy+y*ts;
    let col = "#3a2f22";
    if(t==="#") col = curMap.outdoor? "#232a20" : "#3d3a44";
    else if(t==="T") col = "#1e3a1e";
    else if(t==="W") col = "#14425e";
    else if(t===",") col = siege? "#4a4436" : "#55702f";
    else if(t==="=") col = "#6b5836";
    else if(t==="_") col = "#6e5233";
    else if(t==="D") col = "#7a5a30";
    else if(t==="E") col = "#8a6d1f";
    else if(t==="B") col = "#7a6242";
    else if(t==="P") col = "#5c5648";
    else col = curMap.outdoor? "#4d6330" : "#4a4453";
    ctx.fillStyle = col; ctx.fillRect(px,py,ts,ts);
    ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.strokeRect(px+0.5,py+0.5,ts-1,ts-1);
    if(t==="T"){ ctx.fillStyle="#2e5d27"; ctx.beginPath(); ctx.arc(px+ts/2,py+ts/2,ts*0.36,0,7); ctx.fill(); ctx.fillStyle="#3f7a33"; ctx.beginPath(); ctx.arc(px+ts/2,py+ts/2,ts*0.22,0,7); ctx.fill(); }
    if(t==="E"){ ctx.fillStyle="#ffd75e"; ctx.font=`bold ${Math.floor(ts*0.6)}px serif`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("⬆", px+ts/2, py+ts/2+1); }
    if(t==="D"){ ctx.fillStyle="#54380f"; ctx.fillRect(px+ts*0.3,py+ts*0.1,ts*0.4,ts*0.8); }
  }
  // chests
  for(const ch of (curMap.chests||[])){
    if(G.chestsTaken[curMap.id+":"+ch.x+","+ch.y]) continue;
    const px=ox+ch.x*ts, py=oy+ch.y*ts;
    ctx.fillStyle="#8a6d1f"; ctx.fillRect(px+ts*0.2,py+ts*0.3,ts*0.6,ts*0.45);
    ctx.fillStyle="#ffd75e"; ctx.fillRect(px+ts*0.2,py+ts*0.42,ts*0.6,ts*0.08);
  }
  // NPCs
  for(const n of mapNPCs()){
    const def = NPCS[n.id]; if(!def) continue;
    const px=ox+n.x*ts, py=oy+n.y*ts;
    ctx.fillStyle = "#e8c85a"; ctx.beginPath(); ctx.arc(px+ts/2,py+ts/2,ts*0.34,0,7); ctx.fill();
    ctx.fillStyle="#1a1408"; ctx.font=`bold ${Math.floor(ts*0.42)}px sans-serif`; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText("!", px+ts/2, py+ts/2);
    ctx.fillStyle="#fff"; ctx.font=`${Math.max(9,Math.floor(ts*0.34))}px sans-serif`;
    ctx.fillText(def.name.split(" ")[0], px+ts/2, py-4);
  }
  // party
  for(const c of G.party){
    if(c.dead) continue;
    const px=ox+c.x*ts, py=oy+c.y*ts;
    ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(px+ts/2,py+ts/2,ts*0.38,0,7); ctx.fill();
    ctx.strokeStyle = c===hero()? "#ffffff":"rgba(255,255,255,0.35)"; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle="#10131a"; ctx.font=`bold ${Math.floor(ts*0.44)}px sans-serif`; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(c.token, px+ts/2, py+ts/2+1);
    if(c.hp<maxHp(c)){ ctx.fillStyle="#400"; ctx.fillRect(px+2,py+ts-5,ts-4,3); ctx.fillStyle="#d33"; ctx.fillRect(px+2,py+ts-5,(ts-4)*clamp(c.hp/maxHp(c),0,1),3); }
  }
  $("map-name").textContent = curMap.name;
}

// ---------- Exploration movement ----------
function tryMove(dx,dy){
  if(COMBAT || dlgOpen || modalOpen) return;
  const h = hero(); if(h.dead||h.downed) return;
  const nx = h.x+dx, ny = h.y+dy;
  // NPC blocks
  if(mapNPCs().some(n=>n.x===nx&&n.y===ny)) return;
  if(!passable(curMap,nx,ny)) return;
  // party collision
  if(G.party.some(c=>c!==h&&!c.dead&&c.x===nx&&c.y===ny)) return;
  const trail = G.party.filter(c=>!c.dead).map(c=>({c,x:c.x,y:c.y}));
  h.x = nx; h.y = ny;
  for(let i=1;i<trail.length;i++){ trail[i].c.x = trail[i-1].x; trail[i].c.y = trail[i-1].y; }
  afterStep();
}
function afterStep(){
  const h = hero();
  // exit?
  const ex = (curMap.exits||[]).find(e=>e.x===h.x&&e.y===h.y);
  if(ex){
    if(ex.requires && questStage(ex.requires)<0){ log("That way is barred — for now. (Complete the current main quest.)","bad"); }
    else { log(`You travel: ${ex.label}.`,"sys"); enterMap(ex.to, ex.tx, ex.ty); return; }
  }
  // encounter trigger
  for(const enc of (curMap.encounters||[])){
    if(G.encountersDone[curMap.id+":"+enc.id]) continue;
    if(enc.quest && questStage(enc.quest) < (enc.stage||0)) continue;
    if(enc.id==="crypt_vespera") continue; // dialogue-triggered
    const d = Math.max(Math.abs(enc.x-h.x), Math.abs(enc.y-h.y));
    if(d <= (enc.r||3)){ startCombat(enc); return; }
  }
  refreshAll();
}
function adjacentInteract(){
  const h = hero();
  const targets = [];
  for(const n of mapNPCs()) if(Math.abs(n.x-h.x)<=1 && Math.abs(n.y-h.y)<=1) targets.push({kind:"npc", n});
  for(const ch of (curMap.chests||[])){
    if(G.chestsTaken[curMap.id+":"+ch.x+","+ch.y]) continue;
    if(Math.abs(ch.x-h.x)<=1 && Math.abs(ch.y-h.y)<=1) targets.push({kind:"chest", ch});
  }
  return targets;
}
function doInteract(){
  if(COMBAT||dlgOpen||modalOpen) return;
  const t = adjacentInteract();
  if(!t.length){ log("Nothing to interact with here. (Stand next to a person or chest and press E.)","sys"); return; }
  const first = t[0];
  if(first.kind==="npc") talkTo(first.n.id);
  else openChest(first.ch);
}
function openChest(ch){
  const key = curMap.id+":"+ch.x+","+ch.y;
  G.chestsTaken[key] = true;
  const loot = ch.loot||{gold:0,items:[]};
  if(loot.gold){ G.gold += loot.gold; log(`Chest: +${loot.gold} gold.`,"good"); }
  for(const it of (loot.items||[])){ addItem(it); log(`Chest: found <b>${esc(itemName(it))}</b>.`,"good"); }
  if(curMap.id==="chapel" && questStage("SQ5")===0) completeQuest("SQ5");
  refreshAll(); saveGame();
}

// ---------- Dialogue ----------
let dlgOpen = false, dlgNode = null, dlgNpc = null;
function greetingFor(npcId){
  if(npcId==="mayor" && questStage("MQ1")===3) return "mayor_mq1_done";
  if(npcId==="innkeep" && questStage("SQ1")===1) return "inn_done";
  if(npcId==="innkeep" && questStage("SQ1")===0) return "inn_busy";
  if(npcId==="farmer" && questStage("SQ4")===1) return "farmer_done";
  if(npcId==="farmer" && questStage("SQ4")===0) return "farmer_busy";
  if(npcId==="merchant" && questStage("SQ2")===2) return "merchant_saved";
  if(npcId==="widow" && G.quests.SQ3?.done) return "widow_after";
  if(npcId==="lyra" && G.companions.lyra) return "lyra_chat";
  if(npcId==="fenn" && G.companions.fenn) return "fenn_chat";
  return NPCS[npcId].greeting;
}
function talkTo(npcId){
  dlgNpc = npcId;
  showDialogue(greetingFor(npcId));
}
function showDialogue(nodeId){
  dlgNode = DIALOGUES[nodeId]; dlgOpen = true;
  const box = $("dialogue-box"); box.style.display="block";
  $("dlg-name").textContent = dlgNpc? (NPCS[dlgNpc]?.name||"") : "The Hollow Crown";
  $("dlg-text").textContent = dlgNode.text;
  const opt = $("dlg-options"); opt.innerHTML = "";
  for(const o of dlgNode.options){
    if(o.if && !checkCond(o.if)) continue;
    const b = document.createElement("button"); b.className="dlg-opt";
    b.textContent = o.check? `${o.t}  [${o.check.skill} DC ${o.check.dc}]` : o.t;
    b.onclick = ()=>chooseDlgOption(o);
    opt.appendChild(b);
  }
  drawMap();
}
function checkCond(cond){
  if(cond.startsWith("hasitem:")) return hasItem(cond.slice(8));
  return true;
}
function closeDialogue(){ dlgOpen=false; dlgNode=null; dlgNpc=null; $("dialogue-box").style.display="none"; refreshAll(); saveGame(); }
function chooseDlgOption(o){
  if(o.check){
    const h = hero();
    let adv = null;
    if(G.guidanceFor===h.uid){ adv = null; }
    const r = d20Test({bonus: skillBonus(h, o.check.skill), dc: o.check.dc});
    let extra = "";
    if(G.guidanceFor===h.uid){ const g = rollDie(4); r.total += g; r.success = r.total>=o.check.dc; extra = ` + Guidance ${g}`; G.guidanceFor=null; }
    log(`${h.name} — ${o.check.skill} check: rolled ${r.kept} ${fmtMod(r.bonus)}${extra} = ${r.total} vs DC ${o.check.dc} — <b>${r.success?"SUCCESS":"FAILURE"}</b>.`, r.success?"good":"bad");
    if(h.inspiration && !r.success){ const r2 = d20Test({bonus: skillBonus(h,o.check.skill), dc:o.check.dc}); h.inspiration=false; log(`Heroic Inspiration! Reroll: ${r2.kept} ${fmtMod(r2.bonus)} = ${r2.total} — <b>${r2.success?"SUCCESS":"FAILURE"}</b>.`, r2.success?"good":"bad"); showDialogue(r2.success? o.check.ok : o.check.fail); return; }
    showDialogue(r.success? o.check.ok : o.check.fail);
    return;
  }
  if(o.do) applyEffects(o.do);
  if(dlgOpen===false) return; // effects may have closed dialogue (combat/ending)
  if(o.goto) showDialogue(o.goto); else closeDialogue();
}
function applyEffects(doStr){
  for(const eff of doStr.split(";")){
    const [kind, a, b] = eff.split(":");
    if(kind==="quest"){ startQuest(a, parseInt(b||"0",10)); if(parseInt(b||"0",10)>0) setQuestStage(a, parseInt(b,10)); }
    if(kind==="complete"){ completeQuest(a); }
    if(kind==="join"){ joinCompanion(a); }
    if(kind==="gold"){ G.gold += parseInt(a,10); log(`+${a} gold.`,"good"); }
    if(kind==="give"){ addItem(a); log(`Received <b>${esc(itemName(a))}</b>.`,"good"); }
    if(kind==="flag"){ G.flags[a]=true; }
    if(kind==="shop"){ closeDialogue(); openShop(a); }
    if(kind==="rest"){ closeDialogue(); longRest("You rest at the inn. Eight quiet hours."); }
    if(kind==="givequest"){ // givequest:QUEST:ITEM -> consume item, complete quest
      if(removeItem(b)){ log(`You give over the ${esc(itemName(b))}.`,"sys"); completeQuest(a); }
    }
    if(kind==="combat"){ const enc = (MAPS.crypt.encounters).find(e=>e.id===a); closeDialogue(); const saved = curMap; curMap = Object.assign({id:"crypt"}, MAPS.crypt); startCombat(enc); }
    if(kind==="ending"){ endGame(a); }
  }
  refreshAll();
}
function joinCompanion(id){
  if(G.companions[id]) return;
  const def = COMPANIONS[id];
  const c = makeChar({name:def.name, classId:def.classId, speciesId:def.species, bgId:def.background, abilities:def.abilities, skills: SKILL_CHOICES[def.classId].from.slice(0, SKILL_CHOICES[def.classId].n)});
  c.token = def.name[0]; c.color = id==="lyra"? "#e8c85a" : "#7ec850";
  // level companions to roughly hero level
  const target = hero().level;
  while(c.level < target){ c.xp = XP_TABLE[c.level]; levelUpSilent(c); }
  if(def.weapon) { addItemSilent(def.weapon); c.equip.weapon = def.weapon; consumeFromInventory(def.weapon); }
  if(def.armor){ addItemSilent(def.armor); c.equip.armor = def.armor; consumeFromInventory(def.armor); }
  if(def.shield){ addItemSilent("shield"); c.equip.shield = true; consumeFromInventory("shield"); }
  c.hp = maxHp(c);
  const h = hero(); c.x = h.x; c.y = h.y+1;
  G.party.push(c); G.companions[id] = true;
  log(`<b>${def.name}</b> joined the party! (${CLASSES[def.classId].name}, level ${c.level})`,"good");
  toast(`${def.name} joined the party!`);
}
function addItemSilent(id){ addItem(id,1); }
function consumeFromInventory(id){ removeItem(id,1); }
function levelUpSilent(c){
  const avg = Math.floor(CLASSES[c.classId].hitDie/2)+1;
  c.hpRolls.push(avg); c.level++;
  if(c.level===3) c.subclass = true;
  resetResources(c,true); c.hp = maxHp(c);
}

// ---------- Shops ----------
let modalOpen = false;
function openModal(html){ modalOpen = true; $("modal-content").innerHTML = html; $("modal").style.display="flex"; }
function closeModal(){ modalOpen = false; $("modal").style.display="none"; refreshAll(); saveGame(); }
function openShop(shopId){
  const shop = SHOPS[shopId];
  let html = `<h2>${esc(shop.name)}</h2><p>Your gold: <b>${G.gold} gp</b>. You sell at half price.</p><div class="shop-cols"><div><h3>Buy</h3>`;
  for(const id of shop.stock){
    const cost = itemCost(id);
    html += `<div class="shop-row"><span>${esc(itemName(id))} <span class="dim">${itemBlurb(id)}</span></span><button ${G.gold<cost?"disabled":""} onclick="buyItem('${id}',${cost})">${cost} gp</button></div>`;
  }
  html += `</div><div><h3>Sell (your bag)</h3>`;
  if(!G.inventory.length) html += `<p class="dim">Nothing to sell.</p>`;
  for(const s of G.inventory){
    const val = Math.max(1, Math.floor(itemCost(s.id)/2));
    html += `<div class="shop-row"><span>${esc(itemName(s.id))} ×${s.qty}</span><button onclick="sellItem('${s.id}',${val})">${val} gp</button></div>`;
  }
  html += `</div></div><button class="big-btn" onclick="closeModal()">Leave shop</button>`;
  openModal(html);
}
function itemBlurb(id){
  if(WEAPONS[id]){ const w=weaponDef(id); return `${w.dmg[0]}d${w.dmg[1]} ${w.type}${w.mastery?`, Mastery: ${w.mastery}`:""}`; }
  if(ARMOR[id]){ const a=armorDef(id); return a.kind==="shield"? "+2 AC" : `AC ${a.ac+(a.bonus||0)} ${a.kind}`; }
  if(ITEMS[id]) return ITEMS[id].desc||"";
  return "";
}
function buyItem(id, cost){ if(G.gold<cost) return; G.gold -= cost; addItem(id); log(`Bought ${esc(itemName(id))} for ${cost} gp.`,"sys"); openShop(currentShopId); refreshPanels(); }
function sellItem(id, val){ if(!removeItem(id)) return; G.gold += val; log(`Sold ${esc(itemName(id))} for ${val} gp.`,"sys"); openShop(currentShopId); refreshPanels(); }
let currentShopId = null;
const _openShop = openShop;
openShop = function(id){ currentShopId = id; _openShop(id); };

// ---------- Rests ----------
function shortRest(){
  if(COMBAT) return;
  let html = `<h2>Short Rest (1 hour)</h2><p>Spend Hit Dice to recover HP (die + Con modifier each). Warlocks regain Pact slots; several class resources refresh.</p>`;
  for(const c of G.party){
    const hd = CLASSES[c.classId].hitDie, left = c.level - c.hitDiceUsed;
    html += `<div class="shop-row"><span><b>${esc(c.name)}</b> — HP ${c.hp}/${maxHp(c)}, Hit Dice: ${left}/${c.level} (d${hd})</span><span>
      <button ${left<=0||c.hp>=maxHp(c)?"disabled":""} onclick="spendHitDie('${c.uid}')">Spend 1</button>
      <button ${left<=0||c.hp>=maxHp(c)?"disabled":""} onclick="spendHitDie('${c.uid}',true)">Spend all</button></span></div>`;
  }
  html += `<button class="big-btn" onclick="closeModal()">Finish rest</button>`;
  openModal(html);
  for(const c of G.party) shortRestResources(c);
  log("The party takes a Short Rest.","sys");
}
function spendHitDie(uid, all){
  const c = G.party.find(x=>x.uid===uid); if(!c) return;
  const hd = CLASSES[c.classId].hitDie;
  do{
    if(c.hitDiceUsed>=c.level || c.hp>=maxHp(c)) break;
    c.hitDiceUsed++;
    let heal = rollDie(hd) + amod(c,"con");
    if(hasFeat(c,"healer")) heal = Math.max(heal, 2);
    c.hp = Math.min(maxHp(c), c.hp + Math.max(1,heal));
    if(c.downed && c.hp>0){ c.downed=false; c.deathSaves={s:0,f:0}; }
  }while(all);
  shortRest();
  refreshPanels();
}
function tryLongRest(){
  if(COMBAT){ log("You can't rest in combat!","bad"); return; }
  if(curMap && (curMap.id==="emberford" || curMap.id==="emberford_siege")){
    longRest("You take rooms at the Drowned Flagon. Eight hours of real sleep — HP, Hit Dice, spell slots and class resources fully restored.");
  } else {
    log("It's not safe to take a Long Rest here. Long Rests need the inn at Emberford (or another truly safe haven). A Short Rest (R) works anywhere.","bad");
  }
}
function longRest(msg){
  for(const c of G.party){
    if(c.dead) continue;
    c.hp = maxHp(c); c.tempHp = 0; c.hitDiceUsed = 0; c.downed=false; c.deathSaves={s:0,f:0};
    c.conditions = c.conditions.filter(x=>x.name==="Exhaustion");
    c.concentrating = null; c.concTarget = null; c.mageArmor=false; c.raging=false; c.wildShape=false;
    c.maxHpReduction = 0; c.aidBonus = 0; c.relenUsed = false; c.divineFavor = false; c.sacredWeapon = false; c.innateActive = false;
    resetResources(c,true);
    if(c.speciesId==="human") c.inspiration = true;
    // exhaustion drops by 1
    const ex = c.conditions.find(x=>x.name==="Exhaustion"); if(ex){ ex.level--; if(ex.level<=0) c.conditions = c.conditions.filter(x=>x.name!=="Exhaustion"); }
  }
  log(msg||"You take a Long Rest. HP, Hit Dice and spell slots fully restored.","good");
  toast("Long Rest complete");
  refreshAll(); saveGame();
}

// ---------- Panels ----------
function refreshPanels(){
  if(!G) return;
  // Left: party quick info
  const pp = $("party-panel"); pp.innerHTML = "";
  for(const c of G.party){
    const mhp = maxHp(c), ac = armorClass(c);
    const xpNext = xpForNext(c);
    const xpPct = c.level>=8? 100 : clamp(Math.floor(100*(c.xp - XP_TABLE[c.level-1]) / ((XP_TABLE[c.level]||XP_TABLE[c.level-1]) - XP_TABLE[c.level-1])),0,100);
    let slotsHtml = "";
    const ct = CLASSES[c.classId].spellcasting;
    if(ct==="pact"){ const p = PACT_SLOTS[c.level]; if(p) slotsHtml = `<div class="slots">Pact slots (${p.lvl===1?"1st":p.lvl===2?"2nd":p.lvl===3?"3rd":"4th"}): ${"●".repeat(p.n-c.pactUsed)}${"○".repeat(c.pactUsed)}</div>`; }
    else if(ct){ const ms = maxSlots(c); slotsHtml = `<div class="slots">` + ms.map((n,l)=> `${l+1}: ${"●".repeat(slotsLeft(c,l+1))}${"○".repeat(n-slotsLeft(c,l+1))}`).join(" · ") + `</div>`; }
    const conds = c.conditions.map(x=>x.name).join(", ");
    pp.innerHTML += `<div class="pcard ${c.downed?"downed":""} ${c.dead?"dead":""}">
      <div class="pname"><span class="dot" style="background:${c.color}"></span><b>${esc(c.name)}</b> <span class="dim">${CLASSES[c.classId].name} ${c.level}</span>${c.inspiration?' <span title="Heroic Inspiration">★</span>':""}</div>
      <div class="bar hp"><div style="width:${clamp(100*c.hp/mhp,0,100)}%"></div></div>
      <div class="pstats">HP ${c.hp}/${mhp}${c.tempHp?` (+${c.tempHp} temp)`:""} · AC ${ac} · Speed ${speedOf(c)} ft</div>
      <div class="bar xp"><div style="width:${xpPct}%"></div></div>
      <div class="pstats dim">XP ${c.xp}${c.level<8?` / ${xpNext}`:" (max)"} · HD ${c.level-c.hitDiceUsed}/${c.level}${conds?` · <span class="bad">${esc(conds)}</span>`:""}${c.downed?` · <span class="bad">DOWN — death saves ${"✓".repeat(c.deathSaves.s)}${"✗".repeat(c.deathSaves.f)}`:""}</div>
      ${slotsHtml}</div>`;
  }
  $("gold-display").textContent = `🪙 ${G.gold} gp`;
  refreshQuests();
  refreshContext();
}
function refreshQuests(){
  const qp = $("quest-panel"); if(!qp) return;
  let html = `<h3>Quests</h3>`;
  const act = Object.entries(G.quests).filter(([id,q])=>!q.done);
  if(!act.length) html += `<p class="dim">No active quests. Speak with Mayor Thorn in Emberford.</p>`;
  for(const [id,q] of act){
    html += `<div class="quest ${QUESTS[id].main?"main":""}"><b>${QUESTS[id].main?"★ ":""}${esc(QUESTS[id].name)}</b><div>${esc(QUESTS[id].stages[q.stage]||"")}</div></div>`;
  }
  const done = Object.entries(G.quests).filter(([id,q])=>q.done);
  if(done.length) html += `<div class="dim">Completed: ${done.map(([id])=>QUESTS[id].name).join(", ")}</div>`;
  qp.innerHTML = html;
}
function refreshContext(){
  const cp = $("context-panel"); if(!cp) return;
  if(COMBAT){ cp.innerHTML = `<h3>Combat</h3><div id="turn-order"></div>`; renderTurnOrder(); return; }
  const t = adjacentInteract();
  let html = `<h3>Here</h3>`;
  if(t.length){
    for(const x of t){
      if(x.kind==="npc") html += `<button class="ctx-btn" onclick="talkTo('${x.n.id}')">Talk: ${esc(NPCS[x.n.id].name)}</button>`;
      else html += `<button class="ctx-btn" onclick="doInteract()">Open chest</button>`;
    }
  } else html += `<p class="dim">Move with WASD / arrow keys or click a neighbouring tile. E interacts. Nothing beside you right now.</p>`;
  const ex = (curMap.exits||[]).find(e=>Math.abs(e.x-hero().x)<=1&&Math.abs(e.y-hero().y)<=1);
  if(ex) html += `<p class="dim">Exit nearby: ${esc(ex.label)} — step onto the ⬆ tile.</p>`;
  cp.innerHTML = html;
}
function refreshAll(){ refreshPanels(); drawMap(); }

// Part 3a: combat — setup, turns, movement, weapon attacks.
"use strict";
let COMBAT = null;
const sleep = ms => new Promise(r=>setTimeout(r,ms));
function actorState(a){ return COMBAT.state[a.uid]; }
function allActors(){ return COMBAT.actors; }
function livingParty(){ return G.party.filter(c=>!c.dead); }
function activeParty(){ return G.party.filter(c=>!c.dead && !c.downed); }
function enemiesAlive(){ return COMBAT.actors.filter(a=>a.isMonster && !a.dead); }
function distFt(a,b){ return Math.max(Math.abs(a.x-b.x), Math.abs(a.y-b.y))*5; }
function occupied(x,y, ignoreUid){
  if(G.party.some(c=>!c.dead && c.uid!==ignoreUid && c.x===x&&c.y===y)) return true;
  if(COMBAT && COMBAT.actors.some(a=>a.isMonster&&!a.dead&&a.uid!==ignoreUid&&a.x===x&&a.y===y)) return true;
  return false;
}
function bfs(map, sx, sy, maxTiles, ignoreUid){
  const dist = new Map(); dist.set(sx+","+sy, 0);
  const q = [[sx,sy]];
  while(q.length){
    const [x,y] = q.shift(); const d = dist.get(x+","+y);
    if(d>=maxTiles) continue;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const nx=x+dx, ny=y+dy, k=nx+","+ny;
      if(dist.has(k)) continue;
      if(!passable(map,nx,ny)) continue;
      if(occupied(nx,ny,ignoreUid)) continue;
      // no corner cutting through walls diagonally
      if(dx&&dy && (!passable(map,x+dx,y)||!passable(map,x,y+dy))) continue;
      dist.set(k, d+1); q.push([nx,ny]);
    }
  }
  return dist;
}
function startCombat(enc){
  const actors = [];
  const state = {};
  for(const c of G.party){
    if(c.dead) continue;
    actors.push(c); state[c.uid] = freshTurnState();
    c.inCombat = true;
  }
  enc.monsters.forEach(([mid,x,y],i)=>{
    const def = MONSTERS[mid];
    const m = { uid:"m"+enc.id+i, mid, isMonster:true, name:def.name, x, y,
      ac:def.ac, maxHp:def.hp, hp:def.hp, speed:def.speed, ab:def.ab, atk:def.atk, spells:def.spells,
      slotsUsed:0, conditions:[], dead:false, downed:false, color:"#a33", token:def.name[0],
      vuln:def.vuln||[], immune:def.immune||[], resist:def.resist||[], boss:!!def.boss };
    actors.push(m); state[m.uid] = freshTurnState();
    G.codex[mid] = (G.codex[mid]||0)+1;
  });
  // initiative
  const withInit = actors.map(a=>{
    const bonus = a.isMonster? modOf(a.ab.dex) : initiativeBonus(a);
    const r = rollDie(20);
    return {a, init: r+bonus, roll:r, bonus};
  }).sort((p,q)=> q.init-p.init || (q.a.isMonster?0:1)-(p.a.isMonster?0:1));
  COMBAT = { enc, actors: withInit.map(w=>w.a), order: withInit, state, turnIdx:-1, round:0, mode:null, awaiting:null, xpPool: enc.monsters.reduce((s,[mid])=>s+ (monsterXp(mid)),0), over:false };
  log(`<b>Combat!</b> Initiative: ${withInit.map(w=>`${esc(w.a.name)} ${w.init}`).join(", ")}.`,"bad");
  $("combat-bar").style.display="block";
  refreshAll();
  nextTurn();
}
function monsterXp(mid){
  const cr = MONSTERS[mid].cr;
  const table = {"1/8":25,"1/4":50,"1/2":100,"1":200,"2":450,"3":700,"4":1100,"5":1800,"6":2300,"7":2900};
  return table[cr]||50;
}
function freshTurnState(){ return {moveLeft:0, actionUsed:false, bonusUsed:false, reactionUsed:false, attacksLeft:0, dashed:false, disengaged:false, dodging:false, hidden:false, vexTarget:null, sapped:false, guidedTarget:null, reckless:false, smitePending:null}; }
function currentActor(){ return COMBAT.actors[COMBAT.turnIdx]; }
function renderTurnOrder(){
  const el = $("turn-order"); if(!el||!COMBAT) return;
  el.innerHTML = COMBAT.order.map((w,i)=>{
    const a=w.a; const dead = a.dead || (a.downed);
    return `<div class="tord ${i===COMBAT.turnIdx?"cur":""} ${dead?"dead":""}">${i+1}. ${esc(a.name)} <span class="dim">(${w.init})</span> ${a.isMonster?`HP ${Math.max(0,a.hp)}/${a.maxHp}`:`HP ${Math.max(0,a.hp)}/${maxHp(a)}`}</div>`;
  }).join("");
}
async function nextTurn(){
  if(!COMBAT || COMBAT.over) return;
  if(checkCombatEnd()) return;
  COMBAT.turnIdx++;
  if(COMBAT.turnIdx >= COMBAT.actors.length){ COMBAT.turnIdx = 0; COMBAT.round++; log(`— Round ${COMBAT.round+1} —`,"sys"); }
  const a = currentActor();
  const st = actorState(a);
  Object.assign(st, freshTurnState());
  st.moveLeft = a.isMonster? a.speed : speedOf(a);
  if(hasCond(a,"Hasted")) st.moveLeft *= 2;
  if(hasCond(a,"Slowed")) st.moveLeft = Math.max(0, st.moveLeft-10);
  if(a.conditions.some(x=>x.name==="Prone")){ st.moveLeft = Math.floor(st.moveLeft/2); removeCondition(a,"Prone"); log(`${esc(a.name)} stands up (half movement).`,"sys"); }
  if(a.conditions.some(x=>x.name==="Restrained")||a.conditions.some(x=>x.name==="Paralyzed")||a.conditions.some(x=>x.name==="Stunned")) st.moveLeft = 0;
  // spirit guardians aura
  for(const g of COMBAT.actors){
    if(g.dead||g===a) continue;
    if(g.concentrating==="spirit_guardians" && a.isMonster!==g.isMonster && distFt(a,g)<=15){
      const dc = g.isMonster? g.spells.dc : spellDC(g);
      const dmg = rollDice(3,8).tot;
      const sv = a.isMonster? d20Test({bonus: saveBonusMonster(a,"wis"), dc}) : d20Test({bonus: saveBonus(a,"wis"), dc});
      const taken = sv.success? Math.floor(dmg/2):dmg;
      log(`Spirit Guardians scour ${esc(a.name)}: Wis save ${sv.total} vs ${dc} — ${taken} radiant.`,"sys");
      applyDamage(a, taken, "radiant", g);
    }
  }
  refreshAll();
  if(a.dead || (a.isMonster&&a.hp<=0)){ nextTurn(); return; }
  if(!a.isMonster && a.downed){ await deathSaveTurn(a); return; }
  if(a.conditions.some(x=>x.name==="Paralyzed"||x.name==="Stunned"||x.name==="Unconscious")){
    log(`${esc(a.name)} is incapacitated and loses the turn.`,"bad");
    await sleep(500); endTurnEffects(a); nextTurn(); return;
  }
  if(a.isMonster){ renderCombatBar(); await sleep(450); await enemyTurn(a); }
  else renderCombatBar();
}
function endTurnEffects(a){
  // end-of-turn saves for repeat-save conditions
  for(const cond of [...a.conditions]){
    if(cond.repeatSave){
      const sv = a.isMonster? d20Test({bonus: saveBonusMonster(a,cond.repeatSave), dc: cond.dc}) : d20Test({bonus: saveBonus(a,cond.repeatSave), dc: cond.dc});
      if(sv.success){ removeCondition(a, cond.name); log(`${esc(a.name)} shakes off ${cond.name} (save ${sv.total}).`,"good"); }
    }
    if(cond.expires==="turnEnd") removeCondition(a, cond.name);
  }
  if(a.isMonster && a.conditions.some(x=>x.name==="Sapped")) removeCondition(a,"Sapped");
}
function addCondition(a, name, opts={}){
  if(a.conditions.some(x=>x.name===name)) return;
  if(a.immune && a.immune.includes(name.toLowerCase())) return;
  a.conditions.push(Object.assign({name}, opts));
}
function removeCondition(a, name){ a.conditions = a.conditions.filter(x=>x.name!==name); }
function hasCond(a,name){ return a.conditions.some(x=>x.name===name); }
function saveBonusMonster(m, ab){
  let b = modOf(m.ab[ab]);
  return b;
}
async function deathSaveTurn(c){
  const r = rollDie(20);
  if(r===20){ c.hp = 1; c.downed=false; c.deathSaves={s:0,f:0}; log(`<b>${esc(c.name)}</b> rolls a natural 20 on a death save — back up with 1 HP!`,"good"); refreshAll(); renderCombatBar(); return; }
  if(r===1){ c.deathSaves.f += 2; log(`${esc(c.name)} death save: natural 1 — two failures! (${c.deathSaves.s}✓ / ${c.deathSaves.f}✗)`,"bad"); }
  else if(r>=10){ c.deathSaves.s++; log(`${esc(c.name)} death save: ${r} — success (${c.deathSaves.s}✓ / ${c.deathSaves.f}✗).`,"sys"); }
  else { c.deathSaves.f++; log(`${esc(c.name)} death save: ${r} — failure (${c.deathSaves.s}✓ / ${c.deathSaves.f}✗).`,"bad"); }
  if(c.deathSaves.f>=3){
    c.dead = true; log(`<b>${esc(c.name)} has died.</b> The Dawn may yet intervene...`,"bad");
  } else if(c.deathSaves.s>=3){
    log(`${esc(c.name)} is stable (still unconscious).`,"sys");
  }
  refreshAll();
  await sleep(600);
  if(checkCombatEnd()) return;
  nextTurn();
}
function checkCombatEnd(){
  if(!COMBAT || COMBAT.over) return false;
  const foes = enemiesAlive();
  const partyUp = activeParty().length>0 || G.party.some(c=>!c.dead&&c.downed);
  if(foes.length===0){ combatVictory(); return true; }
  if(activeParty().length===0 && !G.party.some(c=>!c.dead&&c.downed&&c.deathSaves.s<3)){ combatDefeat(); return true; }
  if(activeParty().length===0 && G.party.every(c=>c.dead||(c.downed&&c.deathSaves.s>=3))){ combatDefeat(); return true; }
  return false;
}
function combatVictory(){
  COMBAT.over = true;
  const enc = COMBAT.enc;
  const xpEach = Math.max(1, Math.round(COMBAT.xpPool / Math.max(1,livingParty().length)));
  log(`<b>Victory!</b>`,"good");
  G.encountersDone[curMap.id+":"+enc.id] = true;
  G.kills += enc.monsters.length;
  const loot = enc.loot||{gold:0,items:[]};
  if(loot.gold){ G.gold += loot.gold; log(`Loot: +${loot.gold} gold.`,"good"); }
  for(const it of (loot.items||[])){ addItem(it); log(`Loot: <b>${esc(itemName(it))}</b>.`,"good"); }
  for(const c of G.party){ c.concentrating=null; c.concTarget=null; c.raging=false; }
  COMBAT = null;
  $("combat-bar").style.display="none";
  awardXp(xpEach);
  advanceEncounterQuest(enc);
  refreshAll(); saveGame();
}
function combatDefeat(){
  COMBAT.over = true;
  log(`<b>The party falls...</b> — but the Dawn is not done with you. You wake in Emberford's temple, bruised, alive, and poorer. (House rule: the Dawn intervenes.)`,"bad");
  const loss = Math.floor(G.gold*0.1); G.gold -= loss;
  for(const c of G.party){ c.dead=false; c.downed=false; c.deathSaves={s:0,f:0}; c.hp=Math.max(1,Math.floor(maxHp(c)/2)); c.conditions=[]; c.concentrating=null; }
  COMBAT = null;
  $("combat-bar").style.display="none";
  enterMap("emberford", 24, 5);
  refreshAll(); saveGame();
}

// ---------- Movement in combat ----------
function moveActorTo(a, x, y){
  const st = actorState(a);
  const reach = bfs(curMap, a.x, a.y, Math.floor(st.moveLeft/5), a.uid);
  const d = reach.get(x+","+y);
  if(d==null) return false;
  // opportunity attacks: leaving a foe's reach
  const foes = COMBAT.actors.filter(o=>!o.dead && o.isMonster!==a.isMonster && !o.downed);
  for(const f of foes){
    const wasAdj = distFt(f,a)<=5, willAdj = Math.max(Math.abs(f.x-x),Math.abs(f.y-y))*5<=5;
    if(wasAdj && !willAdj && !st.disengaged && !actorState(f).reactionUsed && !hasCond(f,"Incapacitated") && !hasCond(f,"Paralyzed") && !hasCond(f,"Stunned") && !hasCond(f,"Unconscious")){
      actorState(f).reactionUsed = true;
      log(`${esc(f.name)} makes an opportunity attack!`,"sys");
      performAttack(f, a, null, {isOA:true});
      if(a.hp<=0 && !a.isMonster) { refreshAll(); }
    }
  }
  st.moveLeft -= d*5;
  a.x = x; a.y = y;
  refreshAll();
  return true;
}

// ---------- Weapon attacks ----------
function attackAdvantage(att, def, w){
  let adv = false, dis = false;
  const melee = !w.ranged;
  if(hasCond(def,"Prone")){ if(melee) adv=true; else dis=true; }
  if(hasCond(att,"Prone")) dis=true;
  if(hasCond(att,"Poisoned")) dis=true;
  if(hasCond(att,"Restrained")) dis=true;
  if(hasCond(def,"Restrained")||hasCond(def,"Paralyzed")||hasCond(def,"Stunned")||hasCond(def,"Unconscious")||hasCond(def,"Blinded")) adv=true;
  if(hasCond(att,"Blinded")) dis=true;
  if(hasCond(att,"Frightened")) dis=true;
  if(hasCond(def,"FaerieFired")) adv=true;
  if(hasCond(def,"Guided")) adv=true;
  if(actorState(att).dodging===undefined) {}
  if(defenderDodging(def)) dis=true;
  if(hasCond(att,"Invisible")) adv=true;
  if(att.isMonster && MONSTERS[att.mid].packTactics){
    if(COMBAT.actors.some(o=>o!==att&&o.isMonster&&!o.dead&&distFt(o,def)<=5)) adv=true;
  }
  const st = actorState(att);
  if(st.vexTarget===def.uid) adv=true;
  if(st.reckless) adv=true;
  if(!att.isMonster && att.classId==="barbarian"){ /* reckless handled via toggle */ }
  if(def.isMonster===false || true){
    // attacks against a reckless barbarian have advantage
    const dst = COMBAT.state[def.uid]; if(dst && dst.recklessUsed) adv=true;
  }
  if(st.sapped){ dis=true; st.sapped=false; }
  if(hasCond(att,"Mocked")){ dis=true; removeCondition(att,"Mocked"); }
  // ranged in melee
  if(w.ranged && COMBAT.actors.some(o=>!o.dead&&o.isMonster!==att.isMonster&&distFt(o,att)<=5&&!o.downed)) dis=true;
  if(adv&&dis) return null;
  return adv? "adv" : dis? "dis" : null;
}
function defenderDodging(a){ const st = COMBAT.state[a.uid]; return st && st.dodging; }
function performAttack(att, def, weaponOverride, opts={}){
  const st = actorState(att);
  let w, atkBonus, dmgMod, ability;
  if(att.isMonster){
    const atkDef = weaponOverride || att.atk[0];
    w = {name:atkDef.name, dmg:atkDef.dmg, type:atkDef.type, ranged:!!atkDef.ranged, props:[], mastery:null};
    atkBonus = atkDef.bonus; dmgMod = atkDef.mod; ability = "str";
    if(atkDef.multi && !opts.isOA){ for(let i=0;i<atkDef.multi;i++){ if(def.hp>0||def.downed) performAttack(att,def,atkDef,{isOA:true, noMulti:true}); } return; }
  } else {
    const wid = weaponOverride || att.equip.weapon;
    if(att.wildShape){ w = {name:"Bite (Wolf Form)", dmg:[2,4], type:"piercing", props:[], mastery:null, ranged:false}; atkBonus = 4 + (isProficientWith(att,{cat:"simple",props:[]})?0:0); dmgMod = 2; ability="str"; }
    else if(!wid){ w = {name:"Unarmed Strike", dmg:[1,0], type:"bludgeoning", props:[], mastery:null}; const ub = weaponAttackBonus(att,{cat:"simple",props:[],ranged:false}); atkBonus = ub.bonus; dmgMod = amod(att, att.classId==="monk"?"dex":"str"); ability = ub.ability; if(att.classId==="monk"){ w.dmg = [1, att.level>=11?10: att.level>=5?8:6]; } }
    else { w = weaponDef(wid); const ub = weaponAttackBonus(att, w); atkBonus = ub.bonus; dmgMod = amod(att, ub.ability) + (w.bonus||0); ability = ub.ability; }
  }
  const range = w.ranged? (w.name.includes("Longbow")?150: w.name.includes("Crossbow")?80:60) : (w.props.includes("Reach")?10:5);
  const d = distFt(att,def);
  if(d > range + (w.ranged? 40:0)) { log(`${esc(att.name)} is out of range.`,"sys"); return false; }
  let adv = attackAdvantage(att, def, w);
  if(opts.advOverride!==undefined) adv = opts.advOverride;
  // Shield spell reaction (defender)
  const critRange = (!att.isMonster && att.classId==="fighter" && att.subclass)? 19 : (att.isMonster&&MONSTERS[att.mid].critRange)||20;
  const defAC = def.isMonster? def.ac : armorClass(def);
  let r = d20Test({bonus: atkBonus, adv, critRange});
  // Bardic inspiration auto-spend on a near miss for party
  if(!att.isMonster && !r.crit && r.total < defAC && att.inspiredDie){
    const add = rollDie(att.inspiredDie); r.total += add; log(`${esc(att.name)} uses Bardic Inspiration (+${add}) → ${r.total}.`,"good"); att.inspiredDie = 0;
  }
  if(!att.isMonster && att.inspiration && !r.crit && r.total < defAC){
    att.inspiration = false; const r2 = d20Test({bonus: atkBonus, adv, critRange}); log(`${esc(att.name)} — Heroic Inspiration reroll: ${r2.total}.`,"good"); r = r2;
  }
  const hit = r.crit || (!r.fumble && r.total >= defAC);
  const rollTxt = r.rolls.length>1? `[${r.rolls.join(",")}]→${r.kept}` : `${r.kept}`;
  if(!hit){
    log(`${esc(att.name)} attacks ${esc(def.name)} with ${esc(w.name)}: ${rollTxt} ${fmtMod(atkBonus)} = ${r.total} vs AC ${defAC} — <b>miss</b>.`,"sys");
    // Graze mastery
    if(!att.isMonster && w.mastery==="Graze" && hasMastery(att) && !w.ranged){
      const g = Math.max(0, amod(att, ability));
      if(g>0){ log(`Graze: ${g} ${w.type} damage anyway.`,"sys"); applyDamage(def, g, w.type, att); }
    }
    // enemy Shield spell check happens on hit only; done below
    afterAttack(att, def, w, false);
    return false;
  }
  // Shield spell: if defender is a caster with Shield ready, it may turn the hit into a miss
  if(!r.crit && canCastShield(def)){
    castShieldReaction(def);
    const newAC = defAC + 5;
    if(r.total < newAC){ log(`${esc(def.name)} casts <b>Shield</b> — AC ${newAC} — the attack glances off!`,"good"); afterAttack(att,def,w,false); return false; }
  }
  // damage
  let [dn, dd] = w.dmg;
  let rolls = rollDice(r.crit? dn*2:dn, dd);
  let dmg = dd===0? 1 + dmgMod : rolls.tot + dmgMod;
  let parts = [`${r.crit?dn*2:dn}d${dd||1}[${rolls.rolls.join("+")}]${dmgMod?fmtMod(dmgMod):""}`];
  if(att.isMonster && MONSTERS[att.mid].martialAdvantage && COMBAT.actors.some(o=>o!==att&&o.isMonster&&!o.dead&&distFt(o,def)<=5)){
    const ex = rollDice(r.crit?2:1,6); dmg += ex.tot; parts.push(`martial advantage ${ex.tot}`);
  }
  if(!att.isMonster){
    if(att.raging && !w.ranged && ability==="str"){ const rb = CLASSES.barbarian.rageDmg(att.level); dmg += rb; parts.push(`rage +${rb}`); }
    if(att.concentrating==="hunters_mark" && att.concTarget===def.uid){ const ex = rollDice(r.crit?2:1,6); dmg += ex.tot; parts.push(`Hunter's Mark ${ex.tot}`); }
    if(att.concentrating==="hex" && att.concTarget===def.uid){ const ex = rollDice(r.crit?2:1,6); dmg += ex.tot; parts.push(`Hex ${ex.tot} necrotic`); }
    if(att.divineFavor){ const ex = rollDice(r.crit?2:1,4); dmg += ex.tot; parts.push(`Divine Favor ${ex.tot}`); }
    // Sneak attack
    if(att.classId==="rogue" && (w.props.includes("Finesse")||w.ranged) && !st.sneakUsed){
      const allyAdj = G.party.some(o=>o!==att&&!o.dead&&!o.downed&&distFt(o,def)<=5);
      if(adv==="adv" || allyAdj){ const sd = sneakDice(att); const ex = rollDice(r.crit? sd*2:sd, 6); dmg += ex.tot; parts.push(`Sneak Attack ${ex.tot}`); st.sneakUsed = true; }
    }
    // Colossus Slayer (Hunter ranger)
    if(att.classId==="ranger" && att.subclass && !st.colossusUsed && def.hp < def.maxHp){ const ex = rollDice(r.crit?2:1,8); dmg += ex.tot; parts.push(`Colossus Slayer ${ex.tot}`); st.colossusUsed = true; }
    // Frenzy (Berserker)
    if(att.classId==="barbarian" && att.subclass && att.raging && !st.frenzyUsed){ const ex = rollDice(2,6); dmg += ex.tot; parts.push(`Frenzy ${ex.tot}`); st.frenzyUsed = true; }
    if(hasFeat(att,"savage_attacker") && !st.savageUsed){ const alt = rollDice(r.crit?dn*2:dn, dd).tot + (dd===0?1:dmgMod); if(alt>rolls.tot+dmgMod){ dmg += (alt-(rolls.tot+dmgMod)); parts.push(`Savage Attacker reroll`);} st.savageUsed = true; }
  }
  dmg = Math.max(0,dmg);
  log(`${esc(att.name)} attacks ${esc(def.name)} with ${esc(w.name)}: ${rollTxt} ${fmtMod(atkBonus)} = ${r.total} vs AC ${defAC} — <b>${r.crit?"CRITICAL HIT":"hit"}</b> for <b>${dmg}</b> ${w.type} damage. <span class="dim">(${parts.join("; ")})</span>`, r.crit?"good":"sys");
  applyDamage(def, dmg, w.type, att, {crit:r.crit, weapon:w});
  // on-hit riders
  if(def.hp>0 || def.downed!==undefined){
    if(w.mastery && !att.isMonster && hasMastery(att)) applyMastery(att, def, w, ability);
    if(att.isMonster){
      const atkDef = att.atk.find(a=>a.name===w.name);
      if(atkDef && atkDef.trip) monsterSaveOr(def, atkDef.trip, "Prone");
      if(atkDef && atkDef.paralyze) monsterSaveOr(def, atkDef.paralyze, "Paralyzed");
      if(atkDef && atkDef.drain && !def.isMonster){
        const sv = d20Test({bonus: saveBonus(def,"con"), dc:13});
        if(!sv.success){ def.maxHpReduction = (def.maxHpReduction||0) + dmg; if(def.hp>maxHp(def)) def.hp = maxHp(def); log(`Life Drain! ${esc(def.name)}'s maximum HP is reduced by ${dmg} until a Long Rest.`,"bad"); }
      }
    }
  }
  if(!att.isMonster && att.classId==="monk" && !st.stunUsed && att.res.focus>0 && def.isMonster && !def.dead){
    // Stunning Strike offered automatically vs tough foes? Keep manual via toggle button; skip here.
  }
  afterAttack(att, def, w, true);
  // Paladin smite prompt
  if(!att.isMonster && att.classId==="paladin" && !w.ranged && def.isMonster && !def.dead && (slotsLeftAny(att) || !att.smiteFreeUsed)){
    COMBAT.awaiting = {type:"smite", att, def};
    renderCombatBar();
  }
  // Nick mastery: extra offhand attack as part of the Attack action
  if(!att.isMonster && w.mastery==="Nick" && att.equip.offhand && !st.nickUsed && def.isMonster && !def.dead){
    st.nickUsed = true;
    const ow = weaponDef(att.equip.offhand);
    log(`Nick: a second quick strike with the ${esc(ow.name)}.`,"sys");
    performAttack(att, def, att.equip.offhand, {free:true});
  }
  return true;
}
function slotsLeftAny(c){ for(let l=1;l<=5;l++) if(slotsLeft(c,l)>0) return true; return false; }
function monsterSaveOr(target, spec, condName){
  if(target.isMonster) return;
  const sv = d20Test({bonus: saveBonus(target, spec.save), dc: spec.dc});
  if(!sv.success){ addCondition(target, condName, condName==="Paralyzed"? {repeatSave:"con", dc:spec.dc} : {}); log(`${esc(target.name)} fails a ${spec.save} save (${sv.total} vs ${spec.dc}) — <b>${condName}</b>!`,"bad"); }
  else log(`${esc(target.name)} resists (${sv.total} vs ${spec.dc}).`,"sys");
}
function applyMastery(att, def, w, ability){
  const dc = 8 + amod(att,ability) + pb(att);
  switch(w.mastery){
    case "Topple": { const sv = d20Test({bonus: def.isMonster? saveBonusMonster(def,"con") : saveBonus(def,"con"), dc}); if(!sv.success && !hasCond(def,"Prone")){ addCondition(def,"Prone"); log(`Topple! ${esc(def.name)} is knocked <b>Prone</b> (save ${sv.total} vs ${dc}).`,"good"); } break; }
    case "Push": { // move 10 ft away if space
      const dx = Math.sign(def.x-att.x), dy = Math.sign(def.y-att.y);
      for(let i=0;i<2;i++){ const nx=def.x+dx, ny=def.y+dy; if(passable(curMap,nx,ny)&&!occupied(nx,ny,def.uid)){ def.x=nx; def.y=ny; } else break; }
      log(`Push! ${esc(def.name)} is shoved back.`,"sys"); break; }
    case "Slow": addCondition(def,"Slowed",{expires:"turnEnd"}); actorState(def).slowedNext = true; log(`Slow: ${esc(def.name)}'s Speed drops by 10 ft next turn.`,"sys"); break;
    case "Sap": actorState(def).sapped = true; log(`Sap: ${esc(def.name)}'s next attack has Disadvantage.`,"sys"); break;
    case "Vex": actorState(att).vexTarget = def.uid; log(`Vex: ${esc(att.name)} has Advantage on the next attack against ${esc(def.name)}.`,"sys"); break;
    case "Cleave": {
      const other = COMBAT.actors.find(o=>o.isMonster!==att.isMonster&&!o.dead&&o!==def&&distFt(o,def)<=5&&distFt(o,att)<= (w.props.includes("Reach")?10:5));
      if(other && !actorState(att).cleaveUsed){ actorState(att).cleaveUsed = true; const saveAtt = actorState(att).attacksLeft; log(`Cleave! The swing carries into ${esc(other.name)}.`,"sys"); performAttack(att, other, att.equip.weapon, {free:true, cleave:true}); }
      break; }
  }
}
function afterAttack(att, def, w, hit){
  if(hasCond(def,"Guided")) removeCondition(def,"Guided");
  if(att.concentrating==="spirit_guardians"){}
}
function applyDamage(target, amount, type, source, opts={}){
  let amt = amount;
  // monster resistances
  if(target.isMonster){
    if(target.immune.includes(type)) { log(`${esc(target.name)} is immune to ${type}.`,"sys"); amt = 0; }
    else if(target.resist.includes(type)){ amt = Math.floor(amt/2); log(`${esc(target.name)} resists ${type} (halved).`,"sys"); }
    else if(target.vuln && target.vuln.includes(type)){ amt *= 2; log(`${esc(target.name)} is vulnerable to ${type} (doubled)!`,"good"); }
  } else {
    if(target.raging && ["bludgeoning","piercing","slashing"].includes(type)){ amt = Math.floor(amt/2); }
    if(target.speciesId==="tiefling" && type==="fire") amt = Math.floor(amt/2);
    if(target.speciesId==="dragonborn" && type==="fire") amt = Math.floor(amt/2);
    if(target.speciesId==="dwarf" && type==="poison") amt = Math.floor(amt/2);
    if(target.wildShape && target.wildTemp>0){
      const absorbed = Math.min(target.wildTemp, amt); target.wildTemp -= absorbed; amt -= absorbed;
      if(target.wildTemp<=0){ target.wildShape=false; log(`${esc(target.name)}'s Wild Shape ends.`,"sys"); }
      if(amt===0){ refreshAll(); return; }
    }
    if(target.tempHp>0){ const absorbed = Math.min(target.tempHp, amt); target.tempHp -= absorbed; amt -= absorbed; }
  }
  if(target.downed && !target.isMonster && amt>0){
    target.deathSaves.f += opts.crit? 2:1;
    log(`${esc(target.name)} takes damage while down — a death save failure! (${target.deathSaves.s}✓ / ${target.deathSaves.f}✗)`,"bad");
    if(target.deathSaves.f>=3){ target.dead = true; log(`<b>${esc(target.name)} has died.</b>`,"bad"); }
    refreshAll(); return;
  }
  target.hp -= amt;
  // concentration check
  if(!target.isMonster && target.concentrating && amt>0){
    const dc = Math.max(10, Math.floor(amt/2));
    const sv = d20Test({bonus: saveBonus(target,"con"), dc});
    if(!sv.success){ log(`${esc(target.name)} loses concentration on ${SPELLS[target.concentrating].name} (save ${sv.total} vs ${dc}).`,"bad"); endConcentration(target); }
  }
  if(target.isMonster && target.hp<=0){
    // zombie fortitude
    if(target.mid==="zombie" && type!=="radiant" && !opts.crit){
      const sv = d20Test({bonus: saveBonusMonster(target,"con"), dc: 5+amt});
      if(sv.success){ target.hp = 1; log(`Undead Fortitude! The zombie stays up (save ${sv.total}).`,"bad"); refreshAll(); return; }
    }
    target.hp = 0; target.dead = true;
    log(`<b>${esc(target.name)} is defeated!</b>`,"good");
  }
  if(!target.isMonster && target.hp<=0){
    target.hp = 0;
    if(target.speciesId==="orc" && !target.relenUsed){ target.relenUsed = true; target.hp = 1; log(`Relentless Endurance! ${esc(target.name)} drops to 1 HP instead.`,"good"); }
    else {
      target.downed = true; target.deathSaves = {s:0,f:0};
      target.concentrating = null;
      log(`<b>${esc(target.name)} is down!</b> Death saves begin next turn. Healing brings them back.`,"bad");
    }
  }
  refreshAll();
}
function endConcentration(c){
  const sp = c.concentrating; c.concentrating = null; c.concTarget = null; c.divineFavor = false;
  if(sp==="bless"||sp==="faerie_fire"||sp==="haste"){
    for(const a of COMBAT? COMBAT.actors: G.party){ if(a.conditions) a.conditions = a.conditions.filter(x=>x.source!==c.uid); }
  }
  if(sp==="spirit_guardians") removeCondition(c,"SpiritGuardians");
}
function canCastShield(a){
  if(a.isMonster) return a.spells && a.spells.list.includes("shield") && a.slotsUsed< (a.spells.slots||0);
  if(a.dead||a.downed) return false;
  return a.spellsKnown && a.spellsKnown.includes("shield") && slotsLeft(a,1)>0 && !actorState(a).reactionUsed;
}
function castShieldReaction(a){
  if(a.isMonster) a.slotsUsed++; else { useSlot(a,1); actorState(a).reactionUsed = true; }
}

// Part 3b: spellcasting in combat, combat bar UI, canvas interaction.
"use strict";
function extraAttacks(c){
  const f5 = CLASSES[c.classId].features[5]||[];
  return (c.level>=5 && f5.includes("Extra Attack"))? 2:1;
}
function actorAt(x,y){
  const p = G.party.find(c=>!c.dead&&c.x===x&&c.y===y); if(p) return p;
  if(COMBAT) return COMBAT.actors.find(a=>a.isMonster&&!a.dead&&a.x===x&&a.y===y)||null;
  return null;
}
function drawCombatOverlay(){
  if(!COMBAT) return;
  const cv = $("map-canvas"), ctx = cv.getContext("2d");
  const ts = cv._ts, ox = cv._ox, oy = cv._oy; if(!ts) return;
  const a = currentActor();
  // monsters
  for(const m of COMBAT.actors){
    if(!m.isMonster||m.dead) continue;
    const px=ox+m.x*ts, py=oy+m.y*ts;
    ctx.fillStyle = m.boss? "#7a1f1f" : "#a33";
    ctx.beginPath(); ctx.arc(px+ts/2,py+ts/2,ts*0.38,0,7); ctx.fill();
    ctx.strokeStyle = a===m? "#fff":"rgba(0,0,0,0.4)"; ctx.lineWidth=2; ctx.stroke();
    ctx.fillStyle="#fff"; ctx.font=`bold ${Math.floor(ts*0.4)}px sans-serif`; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillText(m.token, px+ts/2, py+ts/2+1);
    ctx.fillStyle="#400"; ctx.fillRect(px+2,py+ts-5,ts-4,3);
    ctx.fillStyle="#d33"; ctx.fillRect(px+2,py+ts-5,(ts-4)*clamp(m.hp/m.maxHp,0,1),3);
    if(m.conditions.length){ ctx.fillStyle="#ffd75e"; ctx.font=`${Math.floor(ts*0.3)}px sans-serif`; ctx.fillText(m.conditions.map(c=>c.name[0]).join(""), px+ts/2, py-3); }
  }
  // movement range for current player actor
  if(a && !a.isMonster && !COMBAT.awaiting){
    const st = actorState(a);
    if(st.moveLeft>0){
      const reach = bfs(curMap, a.x, a.y, Math.floor(st.moveLeft/5), a.uid);
      ctx.fillStyle = "rgba(120,180,255,0.18)";
      for(const k of reach.keys()){ const [x,y] = k.split(",").map(Number); ctx.fillRect(ox+x*ts+1, oy+y*ts+1, ts-2, ts-2); }
    }
    ctx.strokeStyle="#fff"; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(ox+a.x*ts+ts/2, oy+a.y*ts+ts/2, ts*0.46,0,7); ctx.stroke(); ctx.lineWidth=1;
  }
}
const _drawMapBase = drawMap;
drawMap = function(){ _drawMapBase(); drawCombatOverlay(); };

// ---------- Spellcasting ----------
function spellSaveDC(caster){ return caster.isMonster? caster.spells.dc : spellDC(caster); }
function spellAttackBonusOf(caster){ return caster.isMonster? caster.spells.atkBonus : spellAtkBonus(caster); }
function casterMod(caster){ return caster.isMonster? 3 : amod(caster, spellAbility(caster)); }
function tryCounterspell(caster, spellId){
  // Returns true if the spell is countered. 2024: caster keeps the slot if countered.
  const reactors = COMBAT.actors.filter(o=>!o.dead && o!==caster && o.isMonster!==caster.isMonster && !o.downed);
  for(const r of reactors){
    const has = r.isMonster? (r.spells&&r.spells.list.includes("counterspell")&&r.slotsUsed<r.spells.slots) : (r.spellsKnown.includes("counterspell") && slotsLeft(r,3)>0 && !actorState(r).reactionUsed);
    if(!has) continue;
    if(distFt(r,caster)>60) continue;
    if(SPELLS[spellId].lvl<2 && Math.random()<0.5) continue; // don't waste it on trifles
    if(r.isMonster) r.slotsUsed++; else { useSlot(r,3); actorState(r).reactionUsed=true; }
    const sv = d20Test({bonus: caster.isMonster? saveBonusMonster(caster,"con") : saveBonus(caster,"con"), dc: spellSaveDC(r)});
    log(`${esc(r.name)} casts <b>Counterspell</b>! ${esc(caster.name)} Con save ${sv.total} vs DC ${spellSaveDC(r)} — ${sv.success?"the spell holds!":"<b>the spell dissipates</b> (slot kept, 2024 rules)."}` , sv.success?"good":"bad");
    return !sv.success;
  }
  return false;
}
function castSpell(caster, spellId, slotLvl, target, point){
  const sp = SPELLS[spellId];
  if(!caster.isMonster && caster.concentrating && caster.concentrating!==spellId && sp.conc) endConcentration(caster);
  if(tryCounterspell(caster, spellId)) return true; // action spent, slot kept
  if(slotLvl>0 && !caster.isMonster) useSlot(caster, slotLvl);
  if(caster.isMonster) caster.slotsUsed++;
  const mod = casterMod(caster);
  const up = Math.max(0, slotLvl - sp.lvl);
  log(`${esc(caster.name)} casts <b>${sp.name}</b>${slotLvl?` (slot ${slotLvl})`:""}.`,"sys");
  if(sp.conc && !caster.isMonster){ caster.concentrating = spellId; }
  if(sp.conc && caster.isMonster){ caster.concentrating = spellId; }
  const evokerSculpt = !caster.isMonster && caster.classId==="wizard" && caster.subclass;
  const inArea = (cx,cy,rFt)=>{
    const r = rFt/5;
    return COMBAT.actors.filter(o=>!o.dead && Math.hypot(o.x-cx,o.y-cy) <= r+0.01);
  };
  const dealSaveDamage = (t, diceArr, type, saveAb, halfOnSave)=>{
    const sv = t.isMonster? d20Test({bonus: saveBonusMonster(t,saveAb)+(hasCond(t,"Blessed")?rollDie(4):0), dc: spellSaveDC(caster)}) : d20Test({bonus: saveBonus(t,saveAb)+(hasCond(t,"Blessed")?rollDie(4):0), dc: spellSaveDC(caster)});
    let dmg = rollDice(diceArr[0], diceArr[1]).tot;
    if(sp.dmg2) dmg += rollDice(sp.dmg2[0], sp.dmg2[1]).tot;
    let taken = dmg;
    if(sv.success) taken = halfOnSave? Math.floor(dmg/2) : 0;
    log(`${esc(t.name)} ${saveAb.toUpperCase()} save ${sv.total} vs ${spellSaveDC(caster)} — ${taken} ${type} damage.`,"sys");
    if(taken>0) applyDamage(t, taken, type, caster);
    return sv.success;
  };
  const dealAttackDamage = (t, diceArr, type, extraDice=0)=>{
    let adv = null;
    if(hasCond(t,"Paralyzed")||hasCond(t,"Unconscious")) adv = "adv";
    if(hasCond(t,"FaerieFired")||hasCond(t,"Guided")) adv = "adv";
    if(hasCond(caster,"Poisoned")) adv = adv==="adv"? null : "dis";
    const r = d20Test({bonus: spellAttackBonusOf(caster), adv});
    const ac = t.isMonster? t.ac : armorClass(t);
    if(r.crit || (!r.fumble && r.total>=ac)){
      if(!r.crit && canCastShield(t)){ castShieldReaction(t); if(r.total < ac+5){ log(`${esc(t.name)}'s Shield turns the spell aside!`,"good"); return; } }
      let dmg = rollDice((diceArr[0]+extraDice)*(r.crit?2:1), diceArr[1]).tot + (sp.dmgMod? mod:0);
      if(sp===SPELLS.eldritch_blast && !caster.isMonster && caster.agonizing) dmg += amod(caster,"cha");
      if(!caster.isMonster && caster.classId==="sorcerer" && caster.subclass && caster.dragonType===type) dmg += amod(caster,"cha");
      log(`Spell attack ${r.total} vs AC ${ac} — <b>${r.crit?"CRIT":"hit"}</b>, ${dmg} ${type}.`, r.crit?"good":"sys");
      applyDamage(t, dmg, type, caster, {crit:r.crit});
      if(sp.guide && !t.dead) addCondition(t,"Guided");
      if(sp.slow) addCondition(t,"Slowed",{expires:"turnEnd"});
    } else log(`Spell attack ${r.total} vs AC ${ac} — miss.`,"sys");
  };
  switch(spellId){
    case "magic_missile": {
      const darts = sp.darts + up;
      let total = 0; for(let i=0;i<darts;i++) total += rollDie(4)+1;
      log(`${darts} darts strike ${esc(target.name)} unerringly for ${total} force damage.`,"sys");
      applyDamage(target, total, "force", caster);
      break; }
    case "eldritch_blast": {
      const beams = 1 + (caster.level>=5?1:0) + (caster.level>=11?1:0);
      for(let i=0;i<beams && target && !target.dead;i++){
        let dice = [1 + Math.floor((caster.level||1)>=5?0:0), 10];
        const scale = caster.level>=5? 1:0;
        dealAttackDamage(target, [1,10], "force");
        if(!caster.isMonster && caster.agonizing) { /* folded below */ }
      }
      break; }
    case "scorching_ray": {
      const rays = sp.rays + up;
      for(let i=0;i<rays && target && !target.dead;i++) dealAttackDamage(target, sp.dmg, "fire");
      break; }
    case "spiritual_weapon": dealAttackDamage(target, [sp.dmg[0]+ (up>=2? Math.floor(up/2):0), sp.dmg[1]], "force"); break;
    case "fire_bolt": case "ray_of_frost": case "shocking_grasp": case "guiding_bolt": case "inflict_wounds": {
      let dice = sp.dmg.slice();
      if(sp.cantripScale){ const L = caster.level||1; const mult = L>=17?4: L>=11?3: L>=5?2:1; dice = [dice[0]*mult, dice[1]]; }
      if(sp.upcast) dice = [dice[0] + up*sp.upcast[0], dice[1]];
      dealAttackDamage(target, dice, sp.dtype);
      break; }
    case "sacred_flame": case "toll_the_dead": {
      let dice = sp.dmg.slice(); const L = caster.level||1; const mult = L>=17?4: L>=11?3: L>=5?2:1;
      if(sp.dmgHurt && target.hp < target.maxHp) dice = sp.dmgHurt.slice();
      dice = [dice[0]*mult, dice[1]];
      dealSaveDamage(target, dice, sp.dtype, sp.save, false);
      break; }
    case "vicious_mockery": {
      let dice = sp.dmg.slice(); const L = caster.level||1; const mult = L>=17?4: L>=11?3: L>=5?2:1; dice=[dice[0]*mult,dice[1]];
      const before = target.hp;
      const succ = dealSaveDamage(target, dice, sp.dtype, "wis", false);
      if(!succ && !target.dead) addCondition(target,"Mocked");
      break; }
    case "burning_hands": case "thunderwave": {
      const targets = inArea(caster.x, caster.y, 15).filter(o=>o!==caster);
      let dice = sp.dmg.slice(); if(sp.upcast) dice=[dice[0]+up*sp.upcast[0], dice[1]];
      for(const t of targets){ if(evokerSculpt && t.isMonster!==true && !t.isMonster){ log(`${esc(t.name)} is sculpted out of the blast.`,"good"); continue; } dealSaveDamage(t, dice, sp.dtype, sp.save, sp.half);
        if(spellId==="thunderwave" && !t.dead){ const dx=Math.sign(t.x-caster.x), dy=Math.sign(t.y-caster.y); for(let i=0;i<2;i++){ const nx=t.x+dx,ny=t.y+dy; if(passable(curMap,nx,ny)&&!occupied(nx,ny,t.uid)){t.x=nx;t.y=ny;} else break; } } }
      break; }
    case "fireball": case "ice_storm": case "shatter": {
      const rFt = spellId==="shatter"? 10:20;
      const targets = inArea(point.x, point.y, rFt);
      let dice = sp.dmg.slice(); if(sp.upcast) dice=[dice[0]+up*sp.upcast[0], dice[1]];
      for(const t of targets){ if(evokerSculpt && !t.isMonster){ log(`${esc(t.name)} is sculpted out of the blast.`,"good"); continue; } dealSaveDamage(t, dice, sp.dtype, sp.save, true); }
      break; }
    case "lightning_bolt": {
      // line from caster toward point: all actors within 1 tile of the line, up to 100 ft
      const targets = COMBAT.actors.filter(o=>!o.dead && o!==caster && distFt(caster,o)<=100 && Math.abs((o.x-caster.x)*(point.y-caster.y)-(o.y-caster.y)*(point.x-caster.x))<=1 && ((o.x-caster.x)*(point.x-caster.x)+(o.y-caster.y)*(point.y-caster.y))>0);
      let dice = sp.dmg.slice(); if(sp.upcast) dice=[dice[0]+up*sp.upcast[0], dice[1]];
      for(const t of targets){ if(evokerSculpt && !t.isMonster){ continue; } dealSaveDamage(t, dice, sp.dtype, "dex", true); }
      break; }
    case "blight": dealSaveDamage(target, sp.dmg, sp.dtype, "con", true); break;
    case "cure_wounds": case "healing_word": {
      let dice = sp.heal.slice(); if(sp.upcastHeal) dice=[dice[0]+up*sp.upcastHeal[0], dice[1]];
      let amt = rollDice(dice[0],dice[1]).tot + mod;
      if(!caster.isMonster && caster.classId==="cleric" && caster.subclass) amt += 2 + slotLvl; // Disciple of Life
      healTarget(target, amt, caster);
      if(!caster.isMonster && caster.classId==="cleric" && caster.subclass && caster.level>=6 && target!==caster) healTarget(caster, 2+slotLvl, caster);
      break; }
    case "revivify": if(target.dead||target.downed){ target.dead=false; target.downed=false; target.hp=1; target.deathSaves={s:0,f:0}; log(`<b>${esc(target.name)} returns to life with 1 HP!</b>`,"good"); } break;
    case "lesser_restoration": for(const cn of ["Blinded","Deafened","Paralyzed","Poisoned"]) removeCondition(target, cn); log(`${esc(target.name)} is cleansed.`,"good"); break;
    case "bless": {
      const allies = COMBAT.actors.filter(o=>!o.dead && o.isMonster===caster.isMonster && !o.downed).sort((a,b)=>distFt(caster,a)-distFt(caster,b)).slice(0, 3+up);
      for(const t of allies) addCondition(t,"Blessed",{source:caster.uid});
      log(`${allies.map(a=>esc(a.name)).join(", ")} are Blessed (+1d4 to attacks & saves).`,"good");
      break; }
    case "aid": {
      const allies = COMBAT.actors.filter(o=>!o.dead && o.isMonster===caster.isMonster && !o.downed).slice(0,3);
      for(const t of allies){ if(!t.isMonster){ t.aidBonus = 5 + up*5; t.hp += 5 + up*5; } else t.hp += 5; }
      log(`Aid bolsters ${allies.map(a=>esc(a.name)).join(", ")} (+${5+up*5} HP).`,"good");
      break; }
    case "haste": addCondition(target,"Hasted",{source:caster.uid}); log(`${esc(target.name)} is Hasted (+2 AC, double Speed).`,"good"); break;
    case "mage_armor": target.mageArmor = true; log(`${esc(target.name)} is wrapped in Mage Armor (AC 13 + Dex).`,"good"); break;
    case "divine_favor": caster.divineFavor = true; log(`${esc(caster.name)}'s weapon shines with radiant power (+1d4).`,"good"); break;
    case "hunters_mark": case "hex": caster.concTarget = target.uid; log(`${esc(caster.name)} marks ${esc(target.name)} (+1d6 damage on weapon hits).`,"good"); break;
    case "spirit_guardians": addCondition(caster,"SpiritGuardians",{source:caster.uid}); log(`Spirit Guardians swirl around ${esc(caster.name)}.`,"good"); break;
    case "hold_person": {
      const sv = target.isMonster? d20Test({bonus: saveBonusMonster(target,"wis"), dc: spellSaveDC(caster)}) : d20Test({bonus: saveBonus(target,"wis"), dc: spellSaveDC(caster)});
      if(!sv.success){ addCondition(target,"Paralyzed",{repeatSave:"wis", dc: spellSaveDC(caster)}); log(`${esc(target.name)} is <b>Paralyzed</b>!`,"good"); } else log(`${esc(target.name)} resists Hold Person.`,"sys");
      break; }
    case "sleep": {
      const targets = inArea(point.x, point.y, 10).filter(o=>o.isMonster!==caster.isMonster);
      for(const t of targets){ const sv = t.isMonster? d20Test({bonus: saveBonusMonster(t,"wis"), dc: spellSaveDC(caster)}) : d20Test({bonus: saveBonus(t,"wis"), dc: spellSaveDC(caster)});
        if(!sv.success){ addCondition(t,"Unconscious",{sleep:true}); log(`${esc(t.name)} falls asleep.`,"good"); } }
      break; }
    case "web": {
      const targets = inArea(point.x, point.y, 20).filter(o=>o.isMonster!==caster.isMonster);
      for(const t of targets){ const sv = t.isMonster? d20Test({bonus: saveBonusMonster(t,"dex"), dc: spellSaveDC(caster)}) : d20Test({bonus: saveBonus(t,"dex"), dc: spellSaveDC(caster)});
        if(!sv.success){ addCondition(t,"Restrained",{repeatSave:"str", dc: spellSaveDC(caster)}); log(`${esc(t.name)} is stuck in webs — <b>Restrained</b>.`,"good"); } }
      break; }
    case "faerie_fire": {
      const targets = inArea(point.x, point.y, 20);
      for(const t of targets){ const sv = t.isMonster? d20Test({bonus: saveBonusMonster(t,"dex"), dc: spellSaveDC(caster)}) : d20Test({bonus: saveBonus(t,"dex"), dc: spellSaveDC(caster)});
        if(!sv.success) addCondition(t,"FaerieFired",{source:caster.uid}); }
      log(`Faerie Fire outlines the area — attacks against the outlined have Advantage.`,"good");
      break; }
    case "darkness": {
      const targets = inArea(point.x, point.y, 15).filter(o=>o.isMonster!==caster.isMonster);
      for(const t of targets) addCondition(t,"Blinded",{source:caster.uid});
      log(`Magical darkness swallows the area.`,"sys");
      break; }
    case "misty_step": case "dimension_door": {
      const range = spellId==="misty_step"? 30: 500;
      COMBAT.mode = {type:"teleport", range, caster};
      log(`Choose a destination tile within ${range} ft.`,"sys");
      renderCombatBar();
      return "pending";
    }
    case "guidance": G.guidanceFor = (target||caster).uid; log(`${esc((target||caster).name)} is guided (+1d4 to the next check).`,"good"); break;
    default: log(`${sp.name} is cast (utility effect).`,"sys");
  }
  refreshAll();
  return true;
}
function healTarget(t, amt, source){
  if(t.dead) return;
  const before = t.hp;
  t.hp = Math.min(t.isMonster? t.maxHp : maxHp(t), t.hp + amt);
  if(t.downed && t.hp>0){ t.downed=false; t.deathSaves={s:0,f:0}; log(`<b>${esc(t.name)} is back on their feet!</b>`,"good"); }
  log(`${esc(t.name)} regains ${t.hp-before} HP.`,"good");
  refreshAll();
}

// ---------- Combat bar ----------
function renderCombatBar(){
  const bar = $("combat-actions"); if(!bar||!COMBAT) return;
  renderTurnOrder();
  const a = currentActor();
  if(COMBAT.awaiting && COMBAT.awaiting.type==="smite"){
    const {att, def} = COMBAT.awaiting;
    let html = `<b>${esc(att.name)}</b> — the blow lands on ${esc(def.name)}. Divine Smite? `;
    if(!att.smiteFreeUsed) html += `<button onclick="resolveSmite(0)">Free Smite (Paladin's Smite)</button> `;
    for(let l=1;l<=4;l++) if(slotsLeft(att,l)>0) html += `<button onclick="resolveSmite(${l})">Smite — slot ${l}</button> `;
    html += `<button onclick="resolveSmite(-1)">No smite</button>`;
    bar.innerHTML = html; return;
  }
  if(!a || a.isMonster){ bar.innerHTML = `<span class="dim">${a? esc(a.name)+"'s turn…" : ""}</span>`; return; }
  if(a.downed){ bar.innerHTML = `<b>${esc(a.name)}</b> is down, making death saves…`; return; }
  const st = actorState(a);
  const cls = a.classId;
  let html = `<div class="cb-head"><b>${esc(a.name)}</b> · Move ${st.moveLeft} ft · ${st.actionUsed&&st.attacksLeft<=0? "Action used":"Action ready"} · ${st.bonusUsed? "Bonus used":"Bonus ready"}</div><div class="cb-btns">`;
  html += `<button ${st.actionUsed&&st.attacksLeft<=0?"disabled":""} onclick="combatHint('attack')">⚔️ Attack (click a foe)</button>`;
  if(st.attacksLeft>0 && st.actionUsed) html += `<span class="dim">${st.attacksLeft} attack(s) left</span>`;
  html += `<button ${st.actionUsed?"disabled":""} onclick="combatAction('dash')">Dash</button>`;
  html += `<button ${st.actionUsed?"disabled":""} onclick="combatAction('dodge')">Dodge</button>`;
  html += `<button ${st.actionUsed?"disabled":""} onclick="combatAction('disengage')">Disengage</button>`;
  html += `<button ${st.actionUsed?"disabled":""} onclick="combatAction('grapple')">Grapple (click foe)</button>`;
  html += `<button ${st.actionUsed?"disabled":""} onclick="combatAction('shove')">Shove (click foe)</button>`;
  // spells
  if(CLASSES[cls].spellcasting){
    html += `<button onclick="showSpellButtons()">✨ Cast a Spell</button>`;
  }
  html += `<button onclick="showItemButtons()">🎒 Item</button>`;
  // class bonus/action features
  if(cls==="barbarian" && !a.raging) html += `<button ${st.bonusUsed?"disabled":""} onclick="classFeature('rage')">🔥 Rage (${a.res.rage||0})</button>`;
  if(cls==="barbarian") html += `<button onclick="classFeature('reckless')" class="${st.reckless?'on':''}">Reckless Attack ${st.reckless?"ON":""}</button>`;
  if(cls==="fighter") html += `<button ${st.bonusUsed?"disabled":""} onclick="classFeature('secondwind')">Second Wind (${a.res.secondWind||0})</button>`;
  if(cls==="fighter" && !st.surgeUsed) html += `<button onclick="classFeature('surge')">Action Surge</button>`;
  if(cls==="rogue") html += `<button ${st.bonusUsed?"disabled":""} onclick="combatAction('cunning:dash')">Cunning: Dash</button><button ${st.bonusUsed?"disabled":""} onclick="combatAction('cunning:disengage')">Cunning: Disengage</button><button ${st.bonusUsed?"disabled":""} onclick="combatAction('cunning:hide')">Cunning: Hide</button><button ${st.bonusUsed?"disabled":""} onclick="classFeature('steadyaim')">Steady Aim</button>`;
  if(cls==="monk" && a.level>=2){
    html += `<button ${st.bonusUsed?"disabled":""} onclick="classFeature('flurry')">Flurry of Blows (1 Focus)</button>`;
    html += `<button ${st.bonusUsed?"disabled":""} onclick="classFeature('patient')">Patient Defense (1 Focus)</button>`;
    html += `<button ${st.bonusUsed?"disabled":""} onclick="classFeature('stepwind')">Step of the Wind (1 Focus)</button>`;
    html += `<button ${st.bonusUsed?"disabled":""} onclick="classFeature('martialbonus')">Martial Arts Strike</button>`;
  }
  if(cls==="cleric" && a.level>=2) html += `<button ${st.actionUsed?"disabled":""} onclick="classFeature('spark')">Channel: Divine Spark — heal (click ally)</button><button ${st.actionUsed?"disabled":""} onclick="classFeature('turn')">Channel: Turn Undead</button>`;
  if(cls==="paladin") html += `<button ${st.actionUsed?"disabled":""} onclick="classFeature('layon')">Lay on Hands (${a.res.layPool||0}) — click ally</button>`;
  if(cls==="paladin" && a.level>=3) html += `<button ${st.actionUsed?"disabled":""} onclick="classFeature('sacred')">Channel: Sacred Weapon</button>`;
  if(cls==="druid" && a.level>=2 && !a.wildShape) html += `<button ${st.actionUsed?"disabled":""} onclick="classFeature('wildshape')">Wild Shape: Wolf (${a.res.wildShape||0})</button>`;
  if(cls==="bard") html += `<button ${st.bonusUsed?"disabled":""} onclick="classFeature('inspire')">Bardic Inspiration (${a.res.bardic||0}) — click ally</button>`;
  if(cls==="sorcerer" && a.level>=1) html += `<button ${st.bonusUsed?"disabled":""} onclick="classFeature('innate')">Innate Sorcery</button>`;
  if(cls==="warlock" && a.level>=2 && !a.res.cunningUsed) html += `<button onclick="classFeature('cunning')">Magical Cunning (regain pact slots)</button>`;
  if(a.equip.offhand) html += `<button ${st.bonusUsed?"disabled":""} onclick="combatHint('offhand')">Offhand Attack (click foe)</button>`;
  html += `<button class="end-turn" onclick="playerEndTurn()">End Turn ➜</button>`;
  html += `</div><div id="cb-sub"></div>`;
  bar.innerHTML = html;
}
function combatHint(kind){
  const a = currentActor(); COMBAT.mode = {type:kind};
  log(kind==="attack"? "Click a foe in range to attack." : "Click a foe to strike with your offhand weapon (Bonus Action).","sys");
}
function showSpellButtons(){
  const a = currentActor(); const sub = $("cb-sub"); if(!sub) return;
  const list = a.spellsKnown.filter(id=>SPELLS[id]);
  if(!list.length){ sub.innerHTML = `<span class="dim">No spells known. Prepare spells from the Spells menu (out of combat).</span>`; return; }
  let html = "";
  for(const id of list){
    const sp = SPELLS[id];
    if(sp.time==="Reaction"){ continue; }
    if(sp.lvl===0){
      html += `<button onclick="pickSpell('${id}',0)">${sp.name} (cantrip)</button> `;
    } else {
      for(let l=sp.lvl;l<=4;l++){
        if(slotsLeft(a,l)>0) html += `<button onclick="pickSpell('${id}',${l})">${sp.name} (slot ${l})</button> `;
      }
    }
  }
  sub.innerHTML = html || `<span class="dim">No spell slots left.</span>`;
}
function pickSpell(spellId, slotLvl){
  const a = currentActor(); const sp = SPELLS[spellId];
  const st = actorState(a);
  const isBonus = sp.time==="Bonus Action";
  if(isBonus && st.bonusUsed){ log("Bonus Action already used.","bad"); return; }
  if(!isBonus && st.actionUsed){ log("Action already used.","bad"); return; }
  const needsTarget = !sp.self && sp.kind!=="buff" || ["hunters_mark","hex","hold_person"].includes(spellId);
  const selfCast = sp.self || ["bless","aid","spirit_guardians","divine_favor","misty_step","dimension_door","mage_armor"].includes(spellId);
  if(selfCast){
    if(!isBonus) st.actionUsed = true; else st.bonusUsed = true;
    const res = castSpell(a, spellId, slotLvl, a, {x:a.x,y:a.y});
    if(res!=="pending"){ afterPlayerAction(); }
    return;
  }
  COMBAT.mode = {type:"cast", spellId, slotLvl};
  log(`Casting ${sp.name}: click a ${sp.aoe? "tile (area centre)" : "target"}.`,"sys");
}
function showItemButtons(){
  const sub = $("cb-sub"); if(!sub) return;
  const pots = G.inventory.filter(i=>ITEMS[i.id] && ITEMS[i.id].kind==="potion");
  if(!pots.length){ sub.innerHTML = `<span class="dim">No potions in the party bag.</span>`; return; }
  sub.innerHTML = pots.map(p=>`<button onclick="pickPotion('${p.id}')">${esc(ITEMS[p.id].name)} ×${p.qty} (Bonus Action: drink · Action: give to adjacent ally)</button>`).join(" ");
}
function pickPotion(id){ COMBAT.mode = {type:"potion", id}; log("Click yourself (Bonus Action) or an adjacent ally (Action) to use the potion.","sys"); }
function combatAction(kind){
  const a = currentActor(); const st = actorState(a);
  if(kind.startsWith("cunning:")){
    const sub = kind.split(":")[1];
    st.bonusUsed = true;
    if(sub==="dash") st.moveLeft += speedOf(a);
    if(sub==="disengage") st.disengaged = true;
    if(sub==="hide") doHide(a);
    log(`${esc(a.name)} — Cunning Action: ${sub}.`,"sys");
  } else if(kind==="dash"){ st.actionUsed = true; st.moveLeft += speedOf(a); log(`${esc(a.name)} Dashes.`,"sys"); }
  else if(kind==="dodge"){ st.actionUsed = true; st.dodging = true; log(`${esc(a.name)} Dodges — attacks against them have Disadvantage.`,"sys"); }
  else if(kind==="disengage"){ st.actionUsed = true; st.disengaged = true; log(`${esc(a.name)} Disengages.`,"sys"); }
  else if(kind==="grapple"||kind==="shove"){ COMBAT.mode = {type:kind}; log(`Click a foe within 5 ft to ${kind}.`,"sys"); return; }
  refreshAll(); renderCombatBar();
}
function doHide(a){
  const st = actorState(a);
  const check = d20Test({bonus: skillBonus(a,"Stealth")});
  const bestPP = Math.max(...enemiesAlive().map(m=> 10 + modOf(m.ab.wis) + (m.skills&&m.skills.Perception? m.skills.Perception - modOf(m.ab.wis):0)), 10);
  if(check.total>=bestPP){ addCondition(a,"Invisible"); st.hidden = true; log(`${esc(a.name)} hides (Stealth ${check.total} vs Perception ${bestPP}) — Invisible until they attack.`,"good"); }
  else log(`${esc(a.name)} fails to hide (Stealth ${check.total} vs ${bestPP}).`,"sys");
}
function classFeature(kind){
  const a = currentActor(); const st = actorState(a);
  switch(kind){
    case "rage": if((a.res.rage||0)>0){ a.res.rage--; a.raging = true; st.bonusUsed = true; log(`${esc(a.name)} <b>RAGES!</b> (+${CLASSES.barbarian.rageDmg(a.level)} damage, resistance to physical).`,"good"); } break;
    case "reckless": st.reckless = !st.reckless; st.recklessUsed = st.reckless; log(`Reckless Attack ${st.reckless?"ON — your attacks have Advantage; attacks against you too":"OFF"}.`,"sys"); renderCombatBar(); return;
    case "secondwind": if((a.res.secondWind||0)>0){ a.res.secondWind--; st.bonusUsed = true; const h = rollDie(10)+a.level; healTarget(a, h, a); } break;
    case "surge": st.surgeUsed = true; st.actionUsed = false; st.attacksLeft = 0; log(`${esc(a.name)} — <b>Action Surge!</b> Another action.`,"good"); break;
    case "steadyaim": st.bonusUsed = true; st.steadyAim = true; log(`${esc(a.name)} takes Steady Aim — Advantage on the next attack.`,"sys"); break;
    case "flurry": if(a.res.focus>0){ a.res.focus--; st.bonusUsed = true; st.flurryPending = 2; log(`Flurry of Blows: click foes for two unarmed strikes.`,"sys"); COMBAT.mode={type:"flurry"}; renderCombatBar(); return; } break;
    case "patient": if(a.res.focus>0){ a.res.focus--; st.bonusUsed = true; st.dodging = true; log(`Patient Defense — ${esc(a.name)} Dodges.`,"sys"); } break;
    case "stepwind": if(a.res.focus>0){ a.res.focus--; st.bonusUsed = true; st.moveLeft += speedOf(a); st.disengaged = true; log(`Step of the Wind — Dash + Disengage.`,"sys"); } break;
    case "martialbonus": st.bonusUsed = true; COMBAT.mode={type:"martial"}; log("Click a foe for an unarmed strike (Bonus Action).","sys"); renderCombatBar(); return;
    case "spark": COMBAT.mode={type:"spark"}; log("Click an ally to heal with Divine Spark (1d8 + Wis).","sys"); renderCombatBar(); return;
    case "turn": {
      if((a.res.channel||0)<=0){ log("No Channel Divinity left.","bad"); return; }
      a.res.channel--; st.actionUsed = true;
      for(const m of enemiesAlive()){
        if(!["skeleton","zombie","ghoul","wight","drowned_abbot"].includes(m.mid)) continue;
        if(distFt(a,m)>30) continue;
        const sv = d20Test({bonus: saveBonusMonster(m,"wis"), dc: spellDC(a)});
        if(!sv.success){ addCondition(m,"Frightened",{turned:true}); log(`Turn Undead! ${esc(m.name)} is turned (save ${sv.total}).`,"good"); }
      }
      break; }
    case "layon": COMBAT.mode={type:"layon"}; log("Click an ally (or yourself) to heal from the Lay on Hands pool.","sys"); renderCombatBar(); return;
    case "sacred": if((a.res.channel||0)>0){ a.res.channel--; st.actionUsed = true; a.sacredWeapon = true; log(`Sacred Weapon: ${esc(a.name)}'s weapon glows (+Cha to attacks this combat).`,"good"); } break;
    case "wildshape": if((a.res.wildShape||0)>0){ a.res.wildShape--; st.actionUsed = true; a.wildShape = true; a.wildTemp = 11; log(`${esc(a.name)} becomes a <b>wolf</b>! (Bite attack, 11 temp HP, Speed 40.)`,"good"); } break;
    case "inspire": COMBAT.mode={type:"inspire"}; log("Click an ally to give them a Bardic Inspiration die.","sys"); renderCombatBar(); return;
    case "innate": st.bonusUsed = true; a.innateActive = true; log(`Innate Sorcery! +1 spell DC, Advantage on spell attacks for this combat.`,"good"); break;
    case "cunning": a.res.cunningUsed = true; a.pactUsed = Math.max(0, a.pactUsed - Math.ceil(PACT_SLOTS[a.level].n/2)); log(`Magical Cunning: pact slots partially restored.`,"good"); break;
  }
  refreshAll(); renderCombatBar();
}
function resolveSmite(lvl){
  const {att, def} = COMBAT.awaiting; COMBAT.awaiting = null;
  if(lvl>=0 && !def.dead){
    let dice = 2 + (lvl>0? lvl:1);
    if(!att.smiteFreeUsed && lvl===0){ att.smiteFreeUsed = true; dice = 2; }
    else if(lvl>0) useSlot(att, lvl);
    if(def.mid==="fiend"||def.immune&&false) dice++;
    const dmg = rollDice(dice,8).tot;
    log(`<b>Divine Smite!</b> +${dmg} radiant damage.`,"good");
    applyDamage(def, dmg, "radiant", att);
  }
  renderCombatBar(); refreshAll();
  if(checkCombatEnd()) return;
}
function playerEndTurn(){
  const a = currentActor(); if(!a||a.isMonster) return;
  endTurnEffects(a);
  COMBAT.mode = null;
  nextTurn();
}
function afterPlayerAction(){ refreshAll(); renderCombatBar(); if(checkCombatEnd()) return; }

// Part 3c: enemy AI, canvas clicks, keyboard.
"use strict";
async function enemyTurn(m){
  const st = actorState(m);
  await sleep(250);
  if(m.dead || COMBAT.over) { return; }
  // turned undead flee
  if(hasCond(m,"Frightened") && m.conditions.find(x=>x.name==="Frightened")?.turned){
    const away = bfs(curMap, m.x, m.y, Math.floor(st.moveLeft/5), m.uid);
    let best=null,bd=-1;
    for(const k of away.keys()){ const [x,y]=k.split(",").map(Number); const d = Math.min(...activeParty().map(p=>Math.abs(p.x-x)+Math.abs(p.y-y))); if(d>bd){bd=d;best=[x,y];} }
    if(best) moveActorTo(m, best[0], best[1]);
    log(`${esc(m.name)} flees, turned.`,"sys");
    endTurnEffects(m); nextTurn(); return;
  }
  // caster behaviour
  if(m.spells && m.slotsUsed < m.spells.slots && activeParty().length){
    const did = enemyCast(m);
    if(did){ await sleep(400); if(checkCombatEnd()) return; endTurnEffects(m); nextTurn(); return; }
  }
  // choose target: nearest active party member
  const targets = activeParty();
  if(!targets.length){ endTurnEffects(m); nextTurn(); return; }
  let target = targets.sort((a,b)=>distFt(m,a)-distFt(m,b))[0];
  const atkDef = m.atk[0];
  const reach = atkDef.ranged? 60:5;
  if(distFt(m,target) > reach){
    // move toward target: pick reachable tile minimising distance to target
    const reachTiles = bfs(curMap, m.x, m.y, Math.floor(st.moveLeft/5), m.uid);
    let best=null, bd=1e9;
    for(const k of reachTiles.keys()){ const [x,y]=k.split(",").map(Number); const d = Math.max(Math.abs(target.x-x),Math.abs(target.y-y)); if(d<bd){bd=d;best=[x,y];} }
    if(best && (best[0]!==m.x||best[1]!==m.y)) moveActorTo(m, best[0], best[1]);
    await sleep(200);
  }
  if(!m.dead && distFt(m,target) <= reach + (atkDef.ranged?40:0)){
    performAttack(m, target, null, {});
    await sleep(350);
  }
  if(checkCombatEnd()) return;
  endTurnEffects(m);
  nextTurn();
}
function enemyCast(m){
  const list = m.spells.list;
  const party = activeParty();
  if(!party.length) return false;
  const heroT = party.sort((a,b)=>distFt(m,a)-distFt(m,b))[0];
  // acolyte-type: heal a wounded ally monster
  if(list.includes("cure_wounds")){
    const wounded = COMBAT.actors.filter(o=>o.isMonster&&!o.dead&&o.hp<o.maxHp*0.6).sort((a,b)=>a.hp-b.hp)[0];
    if(wounded && distFt(m,wounded)<=5){ castSpell(m, "cure_wounds", 1, wounded, null); return true; }
  }
  if(list.includes("fireball") && distFt(m,heroT)<=150){
    castSpell(m, "fireball", 3, null, {x:heroT.x, y:heroT.y}); return true;
  }
  if(list.includes("blight") && distFt(m,heroT)<=30){ castSpell(m, "blight", 4, heroT, null); return true; }
  if(list.includes("spirit_guardians") && !m.concentrating && distFt(m,heroT)<=20){ castSpell(m, "spirit_guardians", 3, m, null); return true; }
  if(list.includes("hold_person") && distFt(m,heroT)<=60 && Math.random()<0.6){ castSpell(m, "hold_person", 2, heroT, null); return true; }
  if(list.includes("inflict_wounds") && distFt(m,heroT)<=5){ castSpell(m, "inflict_wounds", 1, heroT, null); return true; }
  if(list.includes("magic_missile") && distFt(m,heroT)<=120){ const low = party.sort((a,b)=>a.hp-b.hp)[0]; castSpell(m, "magic_missile", 1, low, null); return true; }
  if(list.includes("sacred_flame") && distFt(m,heroT)<=60){ castSpell(m, "sacred_flame", 0, heroT, null); return true; }
  if(list.includes("spiritual_weapon") && distFt(m,heroT)<=60){ castSpell(m, "spiritual_weapon", 2, heroT, null); return true; }
  if(list.includes("misty_step") && COMBAT.actors.some(o=>!o.isMonster&&!o.dead&&distFt(o,m)<=5)){
    const tiles = bfs(curMap, m.x, m.y, 6, m.uid); let best=null,bd=-1;
    for(const k of tiles.keys()){ const [x,y]=k.split(",").map(Number); const d=Math.min(...party.map(p=>Math.abs(p.x-x)+Math.abs(p.y-y))); if(d>bd){bd=d;best=[x,y];} }
    if(best){ m.x=best[0]; m.y=best[1]; m.slotsUsed++; log(`${esc(m.name)} vanishes in mist and reappears across the room.`,"sys"); refreshAll(); return true; }
  }
  return false;
}

// ---------- Canvas clicks ----------
function canvasTile(ev){
  const cv = $("map-canvas"); const rect = cv.getBoundingClientRect();
  const sx = cv.width/rect.width, sy = cv.height/rect.height;
  const px = (ev.clientX-rect.left)*sx, py = (ev.clientY-rect.top)*sy;
  const x = Math.floor((px-cv._ox)/cv._ts), y = Math.floor((py-cv._oy)/cv._ts);
  return {x,y};
}
function onCanvasClick(ev){
  if(!G||!curMap||dlgOpen||modalOpen) return;
  const {x,y} = canvasTile(ev);
  if(x<0||y<0||x>=curMap.tiles[0].length||y>=curMap.tiles.length) return;
  if(COMBAT){ combatClick(x,y); return; }
  // exploration: interact if adjacent person/chest clicked
  const h = hero();
  const npc = mapNPCs().find(n=>n.x===x&&n.y===y);
  if(npc && Math.abs(npc.x-h.x)<=1&&Math.abs(npc.y-h.y)<=1){ talkTo(npc.id); return; }
  const ch = (curMap.chests||[]).find(c=>c.x===x&&c.y===y && !G.chestsTaken[curMap.id+":"+c.x+","+c.y]);
  if(ch && Math.abs(ch.x-h.x)<=1&&Math.abs(ch.y-h.y)<=1){ openChest(ch); return; }
  // step one tile toward the click
  if(x===h.x&&y===h.y) return;
  const dist = bfs(curMap, x, y, 99, h.uid);
  let best=null, bd=1e9;
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
    const nx=h.x+dx, ny=h.y+dy; const d = dist.get(nx+","+ny);
    if(d!=null && d<bd && passable(curMap,nx,ny) && !mapNPCs().some(n=>n.x===nx&&n.y===ny)){ bd=d; best=[dx,dy]; }
  }
  if(best) tryMove(best[0],best[1]);
}
function combatClick(x,y){
  const a = currentActor();
  if(!a || a.isMonster || a.downed || COMBAT.awaiting) return;
  const st = actorState(a);
  const target = actorAt(x,y);
  const mode = COMBAT.mode;
  if(mode && mode.type==="teleport"){
    const d = Math.max(Math.abs(x-a.x),Math.abs(y-a.y))*5;
    if(d<=mode.range && passable(curMap,x,y) && !occupied(x,y,a.uid)){ a.x=x; a.y=y; COMBAT.mode=null; log(`${esc(a.name)} teleports.`,"sys"); afterPlayerAction(); }
    else log("Can't teleport there.","bad");
    return;
  }
  if(mode && mode.type==="cast"){
    const sp = SPELLS[mode.spellId];
    const isBonus = sp.time==="Bonus Action";
    let tgt = target, point = {x,y};
    if(sp.aoe && !["burning_hands","thunderwave"].includes(mode.spellId)){ /* point target */ tgt = null; }
    if(!sp.aoe && !tgt){ log("Click a creature to target.","bad"); return; }
    if(tgt && distFt(a,tgt) > (sp.range||5) + 5){ log("Out of range.","bad"); return; }
    if(isBonus) st.bonusUsed = true; else st.actionUsed = true;
    COMBAT.mode = null;
    castSpell(a, mode.spellId, mode.slotLvl, tgt, point);
    afterPlayerAction();
    return;
  }
  if(mode && (mode.type==="grapple"||mode.type==="shove")){
    if(!target || target.isMonster!==true){ log("Click a foe.","bad"); return; }
    if(distFt(a,target)>5){ log("Too far.","bad"); return; }
    st.actionUsed = true;
    const dc = 8 + amod(a,"str") + pb(a);
    const saveAb = modOf(target.ab.str)>=modOf(target.ab.dex)? "str":"dex";
    const sv = d20Test({bonus: saveBonusMonster(target, saveAb), dc});
    if(!sv.success){
      if(mode.type==="grapple"){ addCondition(target,"Grappled"); actorState(target).moveLeft = 0; log(`Grappled! ${esc(target.name)} can't move (save ${sv.total} vs ${dc}).`,"good"); }
      else { addCondition(target,"Prone"); log(`Shoved! ${esc(target.name)} is Prone (save ${sv.total} vs ${dc}).`,"good"); }
    } else log(`${esc(target.name)} resists (save ${sv.total} vs ${dc}).`,"sys");
    COMBAT.mode = null; afterPlayerAction(); return;
  }
  if(mode && mode.type==="potion"){
    if(!target || target.isMonster){ log("Click a party member.","bad"); return; }
    const self = target===a;
    if(!self && distFt(a,target)>5){ log("Too far — potions can only be given to adjacent allies.","bad"); return; }
    if(self){ if(st.bonusUsed){ log("Bonus Action used.","bad"); return; } st.bonusUsed = true; }
    else { if(st.actionUsed){ log("Action used.","bad"); return; } st.actionUsed = true; }
    if(removeItem(mode.id)){ const def = ITEMS[mode.id]; const amt = rollDice(def.heal[0],def.heal[1]).tot + def.bonus; log(`${esc(a.name)} uses ${def.name} on ${esc(target.name)}.`,"sys"); healTarget(target, amt, a); }
    COMBAT.mode = null; afterPlayerAction(); return;
  }
  if(mode && mode.type==="spark"){
    if(!target||target.isMonster){ log("Click an ally.","bad"); return; }
    if((a.res.channel||0)<=0){ log("No Channel Divinity left.","bad"); COMBAT.mode=null; return; }
    a.res.channel--; st.actionUsed = true;
    healTarget(target, rollDie(8)+amod(a,"wis"), a);
    COMBAT.mode=null; afterPlayerAction(); return;
  }
  if(mode && mode.type==="layon"){
    if(!target||target.isMonster){ log("Click an ally.","bad"); return; }
    const pool = a.res.layPool||0; if(pool<=0){ log("Lay on Hands pool is empty.","bad"); COMBAT.mode=null; return; }
    const need = maxHp(target)-target.hp; const amt = Math.min(pool, Math.max(need,1));
    a.res.layPool -= amt; st.actionUsed = true;
    if(target.downed||target.hp>0) healTarget(target, amt, a);
    COMBAT.mode=null; afterPlayerAction(); return;
  }
  if(mode && mode.type==="inspire"){
    if(!target||target.isMonster||target===a){ log("Click another ally.","bad"); return; }
    if((a.res.bardic||0)<=0){ log("No Bardic Inspiration left.","bad"); COMBAT.mode=null; return; }
    a.res.bardic--; st.bonusUsed = true;
    target.inspiredDie = a.level>=10?10: a.level>=5?8:6;
    log(`${esc(target.name)} gains a Bardic Inspiration die (d${target.inspiredDie}).`,"good");
    COMBAT.mode=null; afterPlayerAction(); return;
  }
  if(mode && (mode.type==="flurry"||mode.type==="martial")){
    if(!target||!target.isMonster){ log("Click a foe.","bad"); return; }
    if(distFt(a,target)>5){ log("Too far for an unarmed strike.","bad"); return; }
    performAttack(a, target, null, {unarmed:true});
    if(mode.type==="flurry"){ st.flurryPending--; if(st.flurryPending<=0){ COMBAT.mode=null; } }
    else COMBAT.mode=null;
    afterPlayerAction(); return;
  }
  if(mode && mode.type==="offhand"){
    if(!target||!target.isMonster){ log("Click a foe.","bad"); return; }
    st.bonusUsed = true;
    performAttack(a, target, a.equip.offhand, {});
    COMBAT.mode=null; afterPlayerAction(); return;
  }
  // default: attack a foe, or move
  if(target && target.isMonster){
    if(st.actionUsed && st.attacksLeft<=0){ log("No attacks left this turn. (Extra Attack / bonus actions may remain.)","bad"); return; }
    const wid = a.equip.weapon; const w = wid? weaponDef(wid):null;
    const range = a.wildShape? 5 : w? (w.ranged? 80 : (w.props.includes("Reach")?10:5)) : 5;
    if(distFt(a,target) > range){ log(`Too far — move closer (weapon range ${range} ft).`,"bad"); return; }
    if(!st.actionUsed){ st.actionUsed = true; st.attacksLeft = extraAttacks(a); }
    if(st.steadyAim){ st.steadyAim=false; performAttack(a, target, null, {advOverride:"adv"}); }
    else performAttack(a, target, null, {});
    st.attacksLeft--;
    removeCondition(a,"Invisible");
    afterPlayerAction(); return;
  }
  if(target && !target.isMonster){ return; }
  // move
  if(st.moveLeft>0){
    if(moveActorTo(a,x,y)) renderCombatBar();
  }
}

// ---------- Keyboard ----------
document.addEventListener("keydown", ev=>{
  if(!G) return;
  const tag = (ev.target.tagName||"").toLowerCase();
  if(tag==="input"||tag==="textarea"||tag==="select") return;
  if(modalOpen){ if(ev.key==="Escape") closeModal(); return; }
  if(dlgOpen) return;
  const k = ev.key.toLowerCase();
  if(COMBAT){
    if(k==="e" && currentActor() && !currentActor().isMonster) playerEndTurn();
    return;
  }
  if(k==="w"||ev.key==="ArrowUp") tryMove(0,-1);
  else if(k==="s"||ev.key==="ArrowDown") tryMove(0,1);
  else if(k==="a"||ev.key==="ArrowLeft") tryMove(-1,0);
  else if(k==="d"||ev.key==="ArrowRight") tryMove(1,0);
  else if(k==="e") doInteract();
  else if(k==="r") shortRest();
  else if(k==="i") openInventory();
  else if(k==="c") openCharacter();
  else if(k==="p") openSpellsMenu();
  else if(k==="j") openJournal();
  else if(k==="t") openProgression();
  ev.preventDefault?.();
});

// Part 4: menus (character, inventory, spells, progression, armoury, journal, codex),
// level-ups, creation, title/init, ending.
"use strict";
let menuCharUid = null;
function curMenuChar(){ return G.party.find(c=>c.uid===menuCharUid) || hero(); }
function charTabs(active){
  return `<div class="tabs">${G.party.map(c=>`<button class="${c.uid===curMenuChar().uid?"on":""}" onclick="menuCharUid='${c.uid}';${active}()">${esc(c.name)}</button>`).join("")}</div>`;
}
function openCharacter(){
  const c = curMenuChar();
  const cls = CLASSES[c.classId], sp = SPECIES[c.speciesId], bg = BACKGROUNDS[c.bgId];
  let html = `<h2>Character Sheet</h2>${charTabs("openCharacter")}`;
  html += `<p><b>${esc(c.name)}</b> — ${sp.name} ${cls.name} (level ${c.level})${c.subclass?`, ${cls.subclass.name}`:""} · Background: ${bg.name} · XP ${c.xp}</p>`;
  html += `<div class="abgrid">` + ABILITIES.map(a=>`<div class="abbox"><div class="abname">${ABILITY_NAMES[a]}</div><div class="abscore">${c.abilities[a]}</div><div class="abmod">${fmtMod(amod(c,a))}</div><div class="dim">Save ${fmtMod(saveBonus(c,a))}${cls.saves.includes(a)?" ●":""}</div></div>`).join("") + `</div>`;
  html += `<p>AC <b>${armorClass(c)}</b> · Initiative <b>${fmtMod(initiativeBonus(c))}</b> · Speed <b>${speedOf(c)} ft</b> · Passive Perception <b>${passivePerception(c)}</b> · Proficiency Bonus <b>+${pb(c)}</b>${cls.spellcasting?` · Spell DC <b>${spellDC(c)}</b> · Spell attack <b>${fmtMod(spellAtkBonus(c))}</b>`:""}</p>`;
  html += `<h3>Skills</h3><div class="skillgrid">` + Object.keys(SKILLS).map(s=>`<div>${c.skillProf.includes(s)?"●":"○"} ${s} <b>${fmtMod(skillBonus(c,s))}</b> <span class="dim">(${SKILLS[s]})</span></div>`).join("") + `</div>`;
  html += `<h3>Features & Traits</h3><ul class="featlist">`;
  for(let l=1;l<=Math.min(c.level,8);l++) for(const f of (cls.features[l]||[])) html += `<li><b>L${l} ${esc(f.split(":")[0])}</b>${cls.featureText[f]?` — ${esc(cls.featureText[f])}`: f.includes(":")? ` — ${esc(f.split(":").slice(1).join(":"))}`:""}</li>`;
  if(c.subclass) html += `<li><b>Subclass: ${esc(cls.subclass.name)}</b> — ${esc(Object.values(cls.subclass.features).join(" "))}</li>`;
  for(const t of sp.traits) html += `<li>${esc(t)}</li>`;
  html += `<li>Background feat: ${esc(bg.feat)}</li>`;
  for(const f of c.feats) if(FEATS[f]) html += `<li><b>Feat: ${FEATS[f].name}</b> — ${esc(FEATS[f].desc)}</li>`;
  html += `</ul>`;
  if(hasFeat(c,"skilled") && (c.skilledPicks||0)<3){
    html += `<h3>Skilled feat — choose a skill (${(c.skilledPicks||0)}/3)</h3><select id="skilled-sel">${Object.keys(SKILLS).filter(s=>!c.skillProf.includes(s)).map(s=>`<option>${s}</option>`).join("")}</select> <button onclick="pickSkilled()">Add proficiency</button>`;
  }
  html += `<button class="big-btn" onclick="closeModal()">Close</button>`;
  openModal(html);
}
function pickSkilled(){
  const c = curMenuChar(); const s = $("skilled-sel").value;
  c.skillProf.push(s); c.skilledPicks = (c.skilledPicks||0)+1;
  openCharacter(); refreshPanels();
}
function openInventory(){
  const c = curMenuChar();
  let html = `<h2>Inventory — party bag (🪙 ${G.gold} gp)</h2>${charTabs("openInventory")}`;
  // equipment for selected char
  const wOpts = sel => G.inventory.filter(i=>WEAPONS[i.id]).map(i=>`<option value="${i.id}" ${sel===i.id?"selected":""}>${esc(itemName(i.id))} (in bag)</option>`).join("");
  const aOpts = sel => G.inventory.filter(i=>ARMOR[i.id]&&armorDef(i.id).kind!=="shield").map(i=>`<option value="${i.id}" ${sel===i.id?"selected":""}>${esc(itemName(i.id))} (in bag)</option>`).join("");
  html += `<div class="equipbox"><b>${esc(c.name)}'s equipment</b>
    <div>Weapon: <b>${c.equip.weapon? esc(itemName(c.equip.weapon)):"(unarmed)"}</b> <select id="eq-weapon"><option value="">— change to —</option>${wOpts(c.equip.weapon)}</select> <button onclick="equipFromSelect('${c.uid}','weapon')">Equip</button> ${c.equip.weapon?`<button onclick="unequip('${c.uid}','weapon')">Unequip</button>`:""}</div>
    <div>Offhand: <b>${c.equip.offhand? esc(itemName(c.equip.offhand)):"(none)"}</b> <select id="eq-offhand"><option value="">— change to —</option>${wOpts(c.equip.offhand)}</select> <button onclick="equipFromSelect('${c.uid}','offhand')">Equip</button> ${c.equip.offhand?`<button onclick="unequip('${c.uid}','offhand')">Unequip</button>`:""} ${c.equip.shield?`<button onclick="unequip('${c.uid}','shield')">Put away shield</button>`:`<button onclick="equipShield('${c.uid}')" ${countItem("shield")?"":"disabled"}>Equip shield (from bag)</button>`}</div>
    <div>Armour: <b>${c.equip.armor? esc(itemName(c.equip.armor)):"(none)"}</b> → AC ${armorClass(c)} <select id="eq-armor"><option value="">— change to —</option>${aOpts(c.equip.armor)}</select> <button onclick="equipFromSelect('${c.uid}','armor')">Equip</button> ${c.equip.armor?`<button onclick="unequip('${c.uid}','armor')">Unequip</button>`:""}</div>
  </div>`;
  html += `<h3>Bag</h3>`;
  if(!G.inventory.length) html += `<p class="dim">The bag is empty.</p>`;
  for(const s of G.inventory){
    const isPotion = ITEMS[s.id] && ITEMS[s.id].kind==="potion";
    html += `<div class="shop-row"><span><b>${esc(itemName(s.id))}</b> ×${s.qty} <span class="dim">${esc(itemBlurb(s.id))}</span></span><span>${isPotion?`<button onclick="usePotion('${s.id}')">Use on ${esc(c.name)}</button>`:""}</span></div>`;
  }
  const downed = G.party.find(x=>x.downed&&!x.dead);
  if(downed && countItem("healers_kit")) html += `<button onclick="stabilize('${downed.uid}')">Stabilise ${esc(downed.name)} (Healer's Kit)</button>`;
  html += `<button class="big-btn" onclick="closeModal()">Close</button>`;
  openModal(html);
}
function equipFromSelect(uid, slot){
  const c = G.party.find(x=>x.uid===uid); const sel = $("eq-"+slot); const id = sel.value;
  if(!id) return;
  if(slot==="offhand" && c.equip.shield){ log("Can't hold an offhand weapon and a shield.","bad"); return; }
  if(c.equip[slot]) addItem(c.equip[slot]);
  removeItem(id); c.equip[slot] = id;
  log(`${c.name} equips ${itemName(id)}.`,"sys");
  openInventory(); refreshPanels();
}
function unequip(uid, slot){
  const c = G.party.find(x=>x.uid===uid);
  if(slot==="shield"){ c.equip.shield=false; addItem("shield"); }
  else if(c.equip[slot]){ addItem(c.equip[slot]); c.equip[slot]=null; }
  openInventory(); refreshPanels();
}
function equipShield(uid){
  const c = G.party.find(x=>x.uid===uid);
  if(c.equip.offhand){ log("Offhand is full.","bad"); return; }
  if(removeItem("shield")){ c.equip.shield = true; openInventory(); refreshPanels(); }
}
function usePotion(id){
  const c = curMenuChar(); const def = ITEMS[id];
  if(!removeItem(id)) return;
  const amt = rollDice(def.heal[0],def.heal[1]).tot + def.bonus;
  healTarget(c, amt, c);
  openInventory();
}
function stabilize(uid){
  const c = G.party.find(x=>x.uid===uid);
  c.deathSaves = {s:3,f:0};
  log(`${c.name} is stabilised (still at 0 HP — heal them or rest).`,"sys");
  openInventory();
}
function spellLimit(c){
  const cls = CLASSES[c.classId];
  if(cls.prepared) return cls.prepared(c.level);
  if(cls.known) return cls.known(c.level);
  if(cls.spellcasting) return Math.max(1, c.level + amod(c, cls.spellAbility));
  return 0;
}
function openSpellsMenu(){
  const casters = G.party.filter(c=>CLASSES[c.classId].spellcasting);
  if(!casters.length){ openModal(`<h2>Spells</h2><p>No spellcasters in the party yet.</p><button class="big-btn" onclick="closeModal()">Close</button>`); return; }
  if(!casters.find(c=>c.uid===menuCharUid)) menuCharUid = casters[0].uid;
  const c = curMenuChar(); const cls = CLASSES[c.classId];
  let html = `<h2>Spells — ${esc(c.name)}</h2>${charTabs("openSpellsMenu")}`;
  const ms = cls.spellcasting==="pact"? null : maxSlots(c);
  if(cls.spellcasting==="pact"){ const p = PACT_SLOTS[c.level]; html += `<p>Pact Magic: ${p.n} slot(s) of level ${p.lvl}, regained on a Short Rest. Used: ${c.pactUsed}. Spell DC ${spellDC(c)}, attack ${fmtMod(spellAtkBonus(c))}.</p>`; }
  else html += `<p>Slots: ${ms.map((n,l)=>`L${l+1}: ${slotsLeft(c,l+1)}/${n}`).join(" · ")} · Spell DC ${spellDC(c)} · Spell attack ${fmtMod(spellAtkBonus(c))}</p>`;
  html += `<p class="dim">Prepared/known limit: ${spellLimit(c)} spells (cantrips: ${cls.cantrips||0}). Tick spells to prepare them. Changes apply immediately; prepared casters normally change after a Long Rest — house-ruled flexible here.</p>`;
  const classSpells = Object.entries(SPELLS).filter(([id,sp])=>sp.classes.includes(c.classId)).sort((a,b)=>a[1].lvl-b[1].lvl);
  for(const [id,sp] of classSpells){
    const known = c.spellsKnown.includes(id);
    const cantripCount = c.spellsKnown.filter(x=>SPELLS[x]&&SPELLS[x].lvl===0).length;
    const spellCount = c.spellsKnown.filter(x=>SPELLS[x]&&SPELLS[x].lvl>0).length;
    const canAdd = sp.lvl===0? cantripCount < (cls.cantrips||0) : spellCount < spellLimit(c);
    let castBtn = "";
    if(known && !COMBAT && (sp.kind==="heal"||sp.self||["bless","aid","mage_armor","guidance"].includes(id))){
      castBtn = ` <button onclick="castOutOfCombat('${c.uid}','${id}')">Cast now</button>`;
    }
    html += `<div class="shop-row"><span><label><input type="checkbox" ${known?"checked":""} ${!known&&!canAdd?"disabled":""} onchange="toggleSpell('${c.uid}','${id}')"> <b>${sp.name}</b> <span class="dim">${sp.lvl===0?"Cantrip":"Level "+sp.lvl} · ${sp.school} · ${sp.time} · range ${sp.range} ft</span></label><div class="dim">${esc(sp.desc)}</div></span><span>${castBtn}</span></div>`;
  }
  html += `<button class="big-btn" onclick="closeModal()">Close</button>`;
  openModal(html);
}
function toggleSpell(uid, id){
  const c = G.party.find(x=>x.uid===uid);
  if(c.spellsKnown.includes(id)) c.spellsKnown = c.spellsKnown.filter(x=>x!==id);
  else c.spellsKnown.push(id);
  openSpellsMenu();
}
function castOutOfCombat(uid, id){
  const c = G.party.find(x=>x.uid===uid); const sp = SPELLS[id];
  const slotLvl = sp.lvl===0? 0 : (function(){ for(let l=sp.lvl;l<=5;l++) if(slotsLeft(c,l)>0) return l; return 0; })();
  if(sp.lvl>0 && slotLvl===0){ log(`No slots left for ${sp.name}.`,"bad"); return; }
  if(sp.lvl>0) useSlot(c, slotLvl);
  const target = hero();
  if(id==="cure_wounds"||id==="healing_word"){
    const t = G.party.filter(x=>!x.dead).sort((a,b)=>(a.hp/maxHp(a))-(b.hp/maxHp(b)))[0] || c;
    let amt = rollDice(sp.heal[0],sp.heal[1]).tot + amod(c, spellAbility(c));
    if(c.classId==="cleric"&&c.subclass) amt += 2+slotLvl;
    healTarget(t, amt, c);
  }
  else if(id==="mage_armor"){ c.mageArmor = true; log(`${c.name} casts Mage Armor.`,"sys"); }
  else if(id==="aid"){ for(const t of G.party){ if(!t.dead){ t.aidBonus = 5; t.hp += 5; } } log(`Aid: the party gains +5 HP (8 hours).`,"good"); }
  else if(id==="guidance"){ G.guidanceFor = c.uid; log(`${c.name} is guided — their next dialogue/exploration skill check gains +1d4.`,"good"); }
  else if(id==="revivify"){ const t = G.party.find(x=>x.dead); if(t){ t.dead=false; t.hp=1; log(`${t.name} is revived!`,"good"); } }
  else log(`${c.name} casts ${sp.name}.`,"sys");
  openSpellsMenu(); refreshPanels(); saveGame();
}
function openProgression(){
  const c = curMenuChar(); const cls = CLASSES[c.classId];
  let html = `<h2>Progression — ${esc(c.name)}, ${cls.name}</h2>${charTabs("openProgression")}`;
  if(c.level<8 && c.xp>=XP_TABLE[c.level]) html += `<button class="big-btn glow" onclick="openLevelUp(G.party.find(x=>x.uid==='${c.uid}'))">⬆ LEVEL UP to ${c.level+1}!</button>`;
  html += `<div class="tree">`;
  for(let l=1;l<=8;l++){
    const feats = cls.features[l]||[];
    const unlocked = l<=c.level;
    html += `<div class="tnode ${unlocked?"unlocked":"locked"}"><div class="tlvl">Level ${l}</div><div>${feats.length? feats.map(f=>esc(f)).join(" · ") : "<span class='dim'>—</span>"}${l===3?` · <b>Subclass: ${esc(cls.subclass.name)}</b>`:""}${(l===4||l===8)?" · <b>Ability Score Improvement / Feat</b>":""}</div></div>`;
    if(l<8) html += `<div class="tlink ${l<c.level?"unlocked":""}"></div>`;
  }
  html += `</div><p class="dim">XP for next level: ${c.level<8? XP_TABLE[c.level] : "— (campaign cap 8)"}. Current XP: ${c.xp}.</p>`;
  html += `<button class="big-btn" onclick="closeModal()">Close</button>`;
  openModal(html);
}
function openLevelUp(c){
  if(!c || c.level>=8) return;
  const newLevel = c.level+1;
  const hd = CLASSES[c.classId].hitDie;
  let html = `<h2>${esc(c.name)} reaches level ${newLevel}!</h2>`;
  html += `<p>Hit Points — roll your Hit Die (d${hd}) or take the average (${Math.floor(hd/2)+1}), plus Constitution modifier (${fmtMod(amod(c,"con"))}):</p>
    <button onclick="applyLevelUp('${c.uid}','roll')">🎲 Roll d${hd}</button> <button onclick="applyLevelUp('${c.uid}','avg')">Take average</button>`;
  if(newLevel===3) html += `<p><b>Subclass gained: ${CLASSES[c.classId].subclass.name}</b> — ${esc(Object.values(CLASSES[c.classId].subclass.features).join(" "))}</p>`;
  if(newLevel===4||newLevel===8){
    html += `<h3>Ability Score Improvement or Feat</h3>
    <p>+2 to one ability: <select id="asi-one">${ABILITIES.map(a=>`<option value="${a}">${ABILITY_NAMES[a]}</option>`).join("")}</select>
    — or +1/+1: <select id="asi-a">${ABILITIES.map(a=>`<option value="${a}">${ABILITY_NAMES[a]}</option>`).join("")}</select> <select id="asi-b">${ABILITIES.map(a=>`<option value="${a}">${ABILITY_NAMES[a]}</option>`).join("")}</select>
    — or a Feat: <select id="asi-feat"><option value="">(no feat)</option>${Object.entries(FEATS).map(([id,f])=>`<option value="${id}">${f.name}</option>`).join("")}</select></p>
    <p class="dim">If you pick a feat, the ASI is skipped. Your HP choice above is applied together with this choice when you press a button below.</p>
    <button onclick="applyLevelUp('${c.uid}','roll',true)">🎲 Roll HP + apply ASI/Feat</button> <button onclick="applyLevelUp('${c.uid}','avg',true)">Average HP + apply ASI/Feat</button>`;
  }
  html += `<p class="dim">Casters: visit the Spells menu to prepare/know your new spells. Warlocks & others: new features unlock automatically.</p>`;
  openModal(html);
}
function applyLevelUp(uid, mode, withAsi){
  const c = G.party.find(x=>x.uid===uid); if(!c) return;
  const hd = CLASSES[c.classId].hitDie;
  const before = maxHp(c);
  const roll = mode==="roll"? rollDie(hd) : Math.floor(hd/2)+1;
  c.hpRolls.push(roll);
  c.level++;
  if(c.level===3){ c.subclass = true; if(c.classId==="warlock") c.agonizing = true; log(`${c.name} gains the ${CLASSES[c.classId].subclass.name} subclass!`,"good"); }
  if(withAsi){
    const feat = $("asi-feat")?.value;
    if(feat){ c.feats.push(feat); if(feat==="tough"){ /* maxHp handles */ } log(`${c.name} takes the feat: ${FEATS[feat].name}.`,"good"); }
    else {
      const one = $("asi-one")?.value, a = $("asi-a")?.value, b = $("asi-b")?.value;
      // Decide: if the two +1 selects differ from defaults meaningfully — use +2 if user left feat empty AND asi-a==asi-b? Use +2 select when asi-a equals asi-b equals first option? Simplest: apply +1/+1 if a!==b else +2 to 'one'.
      if(a && b && a!==b){ c.abilities[a] = Math.min(20, c.abilities[a]+1); c.abilities[b] = Math.min(20, c.abilities[b]+1); log(`${c.name}: +1 ${ABILITY_NAMES[a]}, +1 ${ABILITY_NAMES[b]}.`,"good"); }
      else if(one){ c.abilities[one] = Math.min(20, c.abilities[one]+2); log(`${c.name}: +2 ${ABILITY_NAMES[one]}.`,"good"); }
    }
  }
  const after = maxHp(c);
  c.hp = Math.min(after, c.hp + (after-before));
  resetResources(c, false);
  // refresh resource maxima while preserving spent feel: full refresh on level up (generous)
  resetResources(c, true); c.slotsUsed = {}; c.pactUsed = 0;
  log(`<b>${c.name} is now level ${c.level}!</b> Max HP ${after}.`,"good");
  toast(`${c.name} reached level ${c.level}!`);
  closeModal();
  checkLevelUps();
  refreshAll(); saveGame();
}
function openArmoury(){
  let html = `<h2>The Armoury — all weapons & armour in the game (SRD 2024)</h2><h3>Weapons</h3><table class="ref"><tr><th>Weapon</th><th>Damage</th><th>Properties</th><th>Mastery</th><th>Cost</th></tr>`;
  for(const [id,w] of Object.entries(WEAPONS)){ if(w.base) continue; html += `<tr><td>${w.name}</td><td>${w.dmg[0]}d${w.dmg[1]} ${w.type}</td><td>${w.props.join(", ")||"—"}</td><td><b>${w.mastery}</b></td><td>${w.cost} gp</td></tr>`; }
  html += `</table><p class="dim">Mastery effects: <b>Cleave</b> extra attack vs an adjacent second foe · <b>Graze</b> miss still deals ability-mod damage · <b>Nick</b> Light extra attack inside the Attack action · <b>Push</b> shove 10 ft · <b>Sap</b> foe's next attack has Disadvantage · <b>Slow</b> −10 ft Speed · <b>Topple</b> Con save or Prone · <b>Vex</b> Advantage on your next attack vs that foe. Magic (+1) weapons appear in shops and loot later in the campaign.</p>`;
  html += `<h3>Armour</h3><table class="ref"><tr><th>Armour</th><th>AC</th><th>Type</th><th>Cost</th></tr>`;
  for(const [id,a] of Object.entries(ARMOR)){ if(a.base) continue; html += `<tr><td>${a.name}</td><td>${a.kind==="shield"? "+2" : a.ac + (a.dexRule==="full"? " + Dex" : a.dexRule==="max2"? " + Dex (max 2)":"")}</td><td>${a.kind}</td><td>${a.cost} gp</td></tr>`; }
  html += `</table><button class="big-btn" onclick="closeModal()">Close</button>`;
  openModal(html);
}
function openJournal(){
  let html = `<h2>Journal</h2>`;
  const entries = Object.entries(G.quests);
  if(!entries.length) html += `<p class="dim">No quests yet.</p>`;
  for(const [id,q] of entries){
    html += `<div class="quest ${QUESTS[id].main?"main":""}"><b>${QUESTS[id].main?"★ ":""}${esc(QUESTS[id].name)}</b> ${q.done?"<span class='good'>(complete)</span>":""}`;
    QUESTS[id].stages.forEach((s,i)=>{ html += `<div class="${q.done||i<q.stage?"done-stage": i===q.stage?"cur-stage":"dim"}">${q.done||i<q.stage?"✓": i===q.stage?"➤":"○"} ${esc(s)}</div>`; });
    html += `</div>`;
  }
  html += `<button class="big-btn" onclick="closeModal()">Close</button>`;
  openModal(html);
}
function openCodex(){
  let html = `<h2>Codex — creatures faced</h2>`;
  const seen = Object.keys(G.codex);
  if(!seen.length) html += `<p class="dim">You haven't fought anything yet.</p>`;
  for(const id of seen){
    const m = MONSTERS[id];
    html += `<div class="quest"><b>${esc(m.name)}</b> <span class="dim">CR ${m.cr} (${monsterXp(id)} XP)</span><div>AC ${m.ac} · HP ${m.hp} · Speed ${m.speed} ft · Attacks: ${m.atk.map(a=>`${a.name} +${a.bonus} (${a.dmg[0]}d${a.dmg[1]}+${a.mod} ${a.type})`).join("; ")}</div><div class="dim">${(m.traits||[]).join(" ")}</div></div>`;
  }
  html += `<button class="big-btn" onclick="closeModal()">Close</button>`;
  openModal(html);
}
function endGame(choice){
  closeDialogue();
  if(G.quests.MQ6) G.quests.MQ6.done = true;
  G.ending = choice;
  const mins = Math.max(1, Math.round((Date.now()-G.startedAt)/60000));
  $("end-text").innerHTML = choice==="destroy"
    ? "You destroyed the Hollow Crown. The dead of Aldermere rest, and Emberford's bell rings until dawn."
    : "You claimed the Hollow Crown. The Ashen Host kneels, waiting for your word.";
  $("end-stats").innerHTML = `Party level ${hero().level} · ${G.kills} foes defeated · ${Object.values(G.quests).filter(q=>q.done).length} quests completed · about ${mins} minutes played`;
  $("end-screen").style.display = "flex";
  clearSave();
}

// ---------- Creation ----------
let createSel = {classId:"fighter", speciesId:"human", bgId:"soldier"};
// Ability-score generation: the three methods from the 2024 Player's Handbook.
let createMethod = "standard"; // "standard" | "pointbuy" | "rolled"
let createRolls = null; // rolled method: [{dice:[4 rolls], dropIdx, total}] x6
let createAssign = {str:0, dex:1, con:2, int:3, wis:4, cha:5}; // ability -> roll index
let createSelScores = {}; // remembered dropdown picks per method, across rebuilds
const POINT_BUY_COST = {8:0, 9:1, 10:2, 11:3, 12:4, 13:5, 14:7, 15:9};
const DIE_FACES = ["⚀","⚁","⚂","⚃","⚄","⚅"];
function captureAbilitySel(){
  if(!$("ab-str")) return;
  if(createMethod==="rolled"){
    for(const a of ABILITIES){ const s = $("ab-"+a); if(s) createAssign[a] = parseInt(s.value,10); }
  } else {
    const store = createSelScores[createMethod] = createSelScores[createMethod] || {};
    for(const a of ABILITIES){ const s = $("ab-"+a); if(s) store[a] = parseInt(s.value,10); }
  }
}
function setCreateMethod(m){ captureAbilitySel(); createMethod = m; buildAbilitySection(); }
function genAbilityRolls(){
  const out = [];
  for(let i=0;i<6;i++){
    const dice = rollDice(4,6).rolls;
    let dropIdx = 0;
    for(let j=1;j<4;j++) if(dice[j] < dice[dropIdx]) dropIdx = j;
    out.push({dice, dropIdx, total: dice.reduce((s,v)=>s+v,0) - dice[dropIdx]});
  }
  return out;
}
function rollCardsHtml(rolls, fake){
  return `<div class="roll-cards">${rolls.map((r,i)=>`<div class="roll-card ${fake?"":"pop"}"><div class="rlabel">Roll ${i+1}</div><div class="dice">${r.dice.map((d,j)=>`<span class="${j===r.dropIdx?"dropped":""}">${DIE_FACES[d-1]}</span>`).join(" ")}</div><div class="rtotal">${r.total}</div><div class="dim small">dropped the ${r.dice[r.dropIdx]}</div></div>`).join("")}</div>`;
}
function rollAbilityScores(){
  buildAbilitySection(); // ensures the roll-cards container + button exist
  const btn = $("roll-btn"); if(btn) btn.disabled = true;
  let ticks = 0;
  const iv = setInterval(()=>{
    ticks++;
    const area = $("roll-cards-wrap");
    if(!area){ clearInterval(iv); return; }
    area.innerHTML = rollCardsHtml(genAbilityRolls(), true);
    if(ticks>=10){
      clearInterval(iv);
      createRolls = genAbilityRolls();
      createAssign = {str:0, dex:1, con:2, int:3, wis:4, cha:5};
      buildAbilitySection();
    }
  }, 70);
}
function updatePointBuyLeft(){
  const el = $("pb-left"); if(!el) return;
  let cost = 0;
  for(const a of ABILITIES){ const s = $("ab-"+a); if(s) cost += POINT_BUY_COST[parseInt(s.value,10)] || 0; }
  const left = 27 - cost;
  el.textContent = left;
  el.style.color = left < 0 ? "var(--bad)" : "var(--gold)";
}
function buildAbilitySection(){
  const el = $("ability-section"); if(!el) return;
  const stdDefault = {str:15, dex:14, con:13, int:12, wis:10, cha:8};
  let html = `<div class="method-row">
    <button class="${createMethod==="standard"?"on":""}" onclick="setCreateMethod('standard')">Standard Array</button>
    <button class="${createMethod==="pointbuy"?"on":""}" onclick="setCreateMethod('pointbuy')">Point Buy (27)</button>
    <button class="${createMethod==="rolled"?"on":""}" onclick="setCreateMethod('rolled')">🎲 Roll Dice (4d6)</button>
  </div>`;
  if(createMethod==="standard"){
    const store = createSelScores.standard || {};
    html += `<p class="dim">Assign each of 15, 14, 13, 12, 10, 8 to one ability.</p>` +
      ABILITIES.map(a=>`<div class="shop-row"><span>${ABILITY_NAMES[a]}</span><select id="ab-${a}">${[15,14,13,12,10,8].map(v=>`<option value="${v}" ${(store[a]??stdDefault[a])===v?"selected":""}>${v}</option>`).join("")}</select></div>`).join("");
  } else if(createMethod==="pointbuy"){
    const store = createSelScores.pointbuy || {};
    html += `<p class="dim">Buy scores with <b>27 points</b>: 8 costs 0 · 9→1 · 10→2 · 11→3 · 12→4 · 13→5 · 14→7 · 15→9. Points left: <b id="pb-left">27</b></p>` +
      ABILITIES.map(a=>`<div class="shop-row"><span>${ABILITY_NAMES[a]}</span><select id="ab-${a}" onchange="updatePointBuyLeft()">${[8,9,10,11,12,13,14,15].map(v=>`<option value="${v}" ${(store[a]??stdDefault[a])===v?"selected":""}>${v} (${POINT_BUY_COST[v]} pts)</option>`).join("")}</select></div>`).join("");
  } else {
    html += `<p class="dim">The classic method: <b>roll four d6, drop the lowest die</b> — six times — then assign each result to the ability you want. Your background boost still applies on top.</p>
    <div id="roll-cards-wrap">${createRolls ? rollCardsHtml(createRolls, false) : `<p class="dim">No rolls yet. Roll when you're ready — you can reroll the whole set until you start the campaign.</p>`}</div>
    <button class="big-btn ${createRolls?"":"glow"}" id="roll-btn" onclick="rollAbilityScores()">🎲 ${createRolls?"Reroll Ability Scores":"Roll Ability Scores"}</button>`;
    if(createRolls){
      html += ABILITIES.map(a=>`<div class="shop-row"><span>${ABILITY_NAMES[a]}</span><select id="ab-${a}">${createRolls.map((r,i)=>`<option value="${i}" ${createAssign[a]===i?"selected":""}>Roll ${i+1} — ${r.total} (${r.dice.join(", ")})</option>`).join("")}</select></div>`).join("");
    }
  }
  el.innerHTML = html;
  if(createMethod==="pointbuy") updatePointBuyLeft();
}
function buildCreate(){
  const el = $("create-form");
  let html = `<div class="create-grid"><div>
    <h3>1 · Class</h3><div class="cards">${Object.entries(CLASSES).map(([id,cl])=>`<button class="card ${createSel.classId===id?"on":""}" onclick="createPick('classId','${id}')"><b>${cl.name}</b><div class="dim">${esc(cl.desc)}</div><div class="dim">Hit Die d${cl.hitDie} · Saves ${cl.saves.map(s=>s.toUpperCase()).join("/")}</div></button>`).join("")}</div>
    <h3>2 · Species</h3><div class="cards">${Object.entries(SPECIES).map(([id,sp])=>`<button class="card ${createSel.speciesId===id?"on":""}" onclick="createPick('speciesId','${id}')"><b>${sp.name}</b><div class="dim">${esc(sp.desc)}</div></button>`).join("")}</div>
    <h3>3 · Background</h3><div class="cards">${Object.entries(BACKGROUNDS).map(([id,bg])=>`<button class="card ${createSel.bgId===id?"on":""}" onclick="createPick('bgId','${id}')"><b>${bg.name}</b><div class="dim">${esc(bg.desc)}</div></button>`).join("")}</div>
    </div><div>
    <h3>4 · Ability Scores</h3>
    <div id="ability-section"></div>
    <p class="dim">Background boost: +2 to one and +1 to another of the background's abilities (${BACKGROUNDS[createSel.bgId].abilities.map(a=>ABILITY_NAMES[a]).join(", ")}), or +1 to all three.</p>
    <div class="shop-row"><span>+2 boost</span><select id="boost2">${BACKGROUNDS[createSel.bgId].abilities.map(a=>`<option value="${a}">${ABILITY_NAMES[a]}</option>`).join("")}</select></div>
    <div class="shop-row"><span>+1 boost</span><select id="boost1">${BACKGROUNDS[createSel.bgId].abilities.map(a=>`<option value="${a}">${ABILITY_NAMES[a]}</option>`).join("")}</select></div>
    <h3>5 · Skills (${SKILL_CHOICES[createSel.classId].n} from your class)</h3>
    <div id="skill-picks">${SKILL_CHOICES[createSel.classId].from.map(s=>`<label class="skillpick"><input type="checkbox" value="${s}" onchange="limitSkills(this,${SKILL_CHOICES[createSel.classId].n})"> ${s}</label>`).join("")}</div>
    <p class="dim">Plus your background's skills: ${BACKGROUNDS[createSel.bgId].skills.join(", ")}${createSel.speciesId==="human"?", plus one more of your choice (Human: Skillful — Perception is added)":""}${createSel.speciesId==="elf"?", plus Perception (Keen Senses)":""}.</p>
    <div id="spell-picks"></div>
    <h3>6 · Name & Alignment</h3>
    <input id="hero-name" type="text" placeholder="Your hero's name" maxlength="24" style="width:100%">
    <select id="hero-align"><option>Lawful Good</option><option>Neutral Good</option><option selected>Chaotic Good</option><option>Lawful Neutral</option><option>True Neutral</option><option>Chaotic Neutral</option><option>Lawful Evil</option><option>Neutral Evil</option><option>Chaotic Evil</option></select>
    <div id="create-err" class="bad"></div>
    <button class="big-btn glow" onclick="finishCreate()">Begin the Campaign ➜</button>
    </div></div>`;
  el.innerHTML = html;
  buildAbilitySection();
  buildSpellPicks();
}
function buildSpellPicks(){
  const el = $("spell-picks"); if(!el) return;
  const cls = CLASSES[createSel.classId];
  if(!cls.spellcasting){ el.innerHTML = ""; return; }
  const cantrips = cls.cantrips||0;
  const lim = createSel.classId==="paladin"||createSel.classId==="ranger"? 2 : (cls.prepared? cls.prepared(1) : cls.known? cls.known(1) : 4);
  const list = Object.entries(SPELLS).filter(([id,sp])=>sp.classes.includes(createSel.classId));
  el.innerHTML = `<h3>Starting Spells</h3>
    <p class="dim">Cantrips (choose ${cantrips}):</p>${list.filter(([id,sp])=>sp.lvl===0).map(([id,sp])=>`<label class="skillpick"><input type="checkbox" class="pick-cantrip" value="${id}" onchange="limitPicks('pick-cantrip',${cantrips})"> ${sp.name}</label>`).join("")}
    <p class="dim">Level 1 spells (choose ${lim}):</p>${list.filter(([id,sp])=>sp.lvl===1).map(([id,sp])=>`<label class="skillpick"><input type="checkbox" class="pick-spell" value="${id}" onchange="limitPicks('pick-spell',${lim})"> ${sp.name}</label>`).join("")}`;
}
function limitPicks(cls, max){
  const boxes = [...document.querySelectorAll("."+cls)];
  const checked = boxes.filter(b=>b.checked);
  boxes.forEach(b=>{ if(!b.checked) b.disabled = checked.length>=max; });
}
function limitSkills(box, max){
  const boxes = [...document.querySelectorAll("#skill-picks input")];
  const checked = boxes.filter(b=>b.checked);
  boxes.forEach(b=>{ if(!b.checked) b.disabled = checked.length>=max; });
}
function createPick(k,v){ captureAbilitySel(); createSel[k]=v; buildCreate(); }
function finishCreate(){
  const err = $("create-err");
  const name = ($("hero-name").value||"").trim() || "Ash";
  const abilities = {};
  if(createMethod==="rolled"){
    if(!createRolls){ err.textContent = "Roll the dice first — tap 🎲 Roll Ability Scores."; return; }
    const idxs = [];
    for(const a of ABILITIES){ const idx = parseInt($("ab-"+a).value,10); idxs.push(idx); abilities[a] = createRolls[idx].total; }
    if(new Set(idxs).size!==6){ err.textContent = "Assign each rolled score to exactly one ability."; return; }
  } else if(createMethod==="pointbuy"){
    let cost = 0;
    for(const a of ABILITIES){ const v = parseInt($("ab-"+a).value,10); abilities[a]=v; cost += POINT_BUY_COST[v]; }
    if(cost>27){ err.textContent = `Point Buy: you've spent ${cost} of 27 points — lower a score or two.`; return; }
  } else {
    const used = [];
    for(const a of ABILITIES){ const v = parseInt($("ab-"+a).value,10); abilities[a]=v; used.push(v); }
    if(new Set(used).size!==6){ err.textContent = "The Standard Array uses each of 15, 14, 13, 12, 10, 8 exactly once."; return; }
  }
  const bg = BACKGROUNDS[createSel.bgId];
  const b2 = $("boost2").value, b1 = $("boost1").value;
  if(b2===b1){ /* +1 to all three instead */ for(const a of bg.abilities) abilities[a]+=1; }
  else { abilities[b2]+=2; abilities[b1]+=1; }
  const skillPicks = [...document.querySelectorAll("#skill-picks input:checked")].map(b=>b.value);
  if(skillPicks.length < SKILL_CHOICES[createSel.classId].n){ err.textContent = `Pick ${SKILL_CHOICES[createSel.classId].n} class skills.`; return; }
  const skills = [...new Set([...skillPicks, ...bg.skills])];
  if(createSel.speciesId==="human"||createSel.speciesId==="elf") if(!skills.includes("Perception")) skills.push("Perception");
  const feats = [];
  if(createSel.bgId==="criminal") feats.push("alert");
  if(createSel.bgId==="soldier") feats.push("savage_attacker");
  if(createSel.bgId==="acolyte"||createSel.bgId==="sage") feats.push("magic_initiate");
  const heroC = makeChar({name, classId:createSel.classId, speciesId:createSel.speciesId, bgId:createSel.bgId, abilities, skills, feats, isHero:true});
  heroC.token = name[0].toUpperCase(); heroC.color = "#ffd75e";
  heroC.alignment = $("hero-align").value;
  if(createSel.bgId==="acolyte") heroC.bonusSpells = ["sacred_flame","cure_wounds"];
  if(createSel.bgId==="sage") heroC.bonusSpells = ["fire_bolt"];
  const cantripPicks = [...document.querySelectorAll(".pick-cantrip:checked")].map(b=>b.value);
  const spellPicks = [...document.querySelectorAll(".pick-spell:checked")].map(b=>b.value);
  heroC.spellsKnown = [...cantripPicks, ...spellPicks, ...(heroC.bonusSpells||[])];
  if(createSel.classId==="warlock") heroC.agonizing = true;
  if(createSel.speciesId==="human") heroC.inspiration = true;
  G = newGameState(heroC);
  G.gold = bg.gold + 10;
  menuCharUid = heroC.uid;
  // starting kit
  for(const id of CLASSES[createSel.classId].startKit) addItem(id);
  const kit = CLASSES[createSel.classId].startKit;
  const w1 = kit.find(id=>WEAPONS[id]); if(w1){ removeItem(w1); heroC.equip.weapon = w1; }
  const w2 = kit.filter(id=>WEAPONS[id])[1]; if(w2 && weaponDef(w2).props.includes("Light") && !kit.includes("shield")){ removeItem(w2); heroC.equip.offhand = w2; }
  const ar = kit.find(id=>ARMOR[id]&&armorDef(id).kind!=="shield"); if(ar){ removeItem(ar); heroC.equip.armor = ar; }
  if(kit.includes("shield")){ removeItem("shield"); heroC.equip.shield = true; }
  heroC.hp = maxHp(heroC);
  $("create-screen").style.display="none";
  $("game-screen").style.display="flex";
  enterMap("emberford", 15, 10);
  log(`<b>${esc(name)}</b> arrives in Emberford, a river town with a goblin problem and a graveyard problem. Speak with <b>Mayor Edda Thorn</b> (north-centre, by the plaza).`,"sys");
  log(`Controls: WASD/arrows or click to move · E to talk/interact · I inventory · C character · P spells · T progression · J journal · R short rest.`,"sys");
  refreshAll(); saveGame();
}

// ---------- Init ----------
function startNewGame(){
  $("title-screen").style.display="none";
  $("create-screen").style.display="block";
  buildCreate();
}
function continueGame(){
  const g = loadGame(); if(!g) return;
  G = g;
  menuCharUid = G.heroUid;
  // restore log UI
  $("log").innerHTML = "";
  for(const l of G.log.slice(-60)){ const d=document.createElement("div"); d.className="logline "+l.cls; d.innerHTML=l.msg; $("log").appendChild(d); }
  $("title-screen").style.display="none";
  $("game-screen").style.display="flex";
  const h = hero();
  enterMap(G.map||"emberford", h.x||15, h.y||10);
  log("Welcome back to Aldermere.","sys");
}
function initGame(){
  $("map-canvas").addEventListener("click", onCanvasClick);
  if(loadGame()) $("continue-btn").style.display="inline-block";
}
document.addEventListener("DOMContentLoaded", initGame);
