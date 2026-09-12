/* ============================================================================================
   FEATURE MODULES — the registry, and the whole contract in one place.
   ============================================================================================

   Each package is one file in this directory that exports  { id, install(G) }.  This file
   imports all sixteen and exports FEATURES; ranch3d.html calls installFeatures() once, just
   before the animation loop starts, which builds the context object G and calls
   f.install(G) for every entry (errors are caught and logged as 'feature <id>', so one
   broken package never stops the others).  A package edits ONLY its own file here and the
   inline hot spots it was assigned.  Nothing may touch game state at import time: imports
   are hoisted and run before a single const in the game exists — do everything in install.

   ---- 1. Register ------------------------------------------------------------------------
     export const id='my-package';
     export function install(G){ ... }

   ---- 2. What G exposes (all names final; read them, never re-declare them) -------------
     G.THREE G.scene G.camera G.renderer G.composer
     G.$ G.toast G.hidePanels G.openDlg G.nameSprite G.beep G.sChime G.sGem G.sNeigh G.sCoin
     G.save   {KEY, fresh(), sync(fn), ensure(fn), ensureHorse(fn), flag(s,name), build, boot}
     G.money  {addCoins, addGems, addKeys, grantGems(s,n), payReward(s,r), rewardLabel(r),
               rewardKind(k,pay,label), refreshWallet, statBump, logEarn}
     G.xp     {addXp3D(n,opts), applyXp(s,h,n), grantStatXp(s,h,k,xp), addSP, passAdd, masteryOf,
               statCeil(h,k), statCap, statNeed, effStats, ensureStats, trainXp}
     G.mul(name,s,h,ctx) -> product of every factor registered with
     G.addMul(name, fn(s,h,ctx)->number).  Names in use: 'xp' 'gem' 'coin' 'event'
               'stamDrain' 'stamRegen' 'speed' 'accel' 'jump' 'bond'.  VIP and the ranch level
               are already registered as 'coin'/'xp' factors — add yours, never edit addCoins.
     G.quest  {questEvt, dailyEvt, story:{append(entries), insertBefore(idx,entries,tag), list()},
               types{} , addDaily(row), addAch(row), STORY, DAILYQ, ACHS, NPC_DEFS,
               storyIdx(), storyProg(), todayDaily, claimDaily, claimAch, saveStory, missionDone}
     G.tables {EVENTS3 RACE_ROUTES RACE_ITEMS BREEDS3 TIER_BASE FOODS3 FEED_TIER_LBL PERS PERS_KEYS
               SEASONS PASS_FREE PASS_GOLD VIP_PLANS WAGE_TIERS WEEK_TIERS CALENDAR DECOR_CAT
               RANCH_LEVELS RANCH_PERKS TACK_SETS RARITIES GEAR_SLOTS GEAR_NOUN GEAR_ADJ RAR_SELL
               RAR_W RAR_COL SUMMON_TIERS SUMMON_POOL PETS3 BOARDS MILES NEIGHBOURS WILD_BREEDS
               EMOTES MASTERY_UNLOCKS TAIL_COLS STUD_COLS DYE_HAIR DYE_BODY DYE_MARK MARKS STAT_KEYS
               STAT_LBL CHESTS COLL_SETS FT REGIONS TRAIL_STOPS TACK_ROOM NAMES3 REWARD_KINDS
               TRAITS{} BREED_CEIL{} HAIR_STYLES{mane:[],tail:[]} KEYMAP}
     G.horse  {myHorses, rideIdx(), ridden(), RIG(), TACK(), player, herd(), remotes,
               grantHorse(s,breedKey,opts), makeFoal(s,a,b,opts), breedSrc(b), breedAvailable(b,ctx),
               sourceRule(fn(ctx,b)->true|false|undefined), reloadHorses, rebuildAll, attachTack,
               dressWithRig, makeHorse, applyCoat, hairColour, horseEmote, bondGain, persMul,
               gearBonus, genGear, gearSet, setBonus, refreshTack, dressSaddle, breedLabel, horseValue}
     G.world  {things, colliders, walls, groundH, terrainH, riverZ, riverLevel, streamX, pathDist,
               followCamera, ranchArchitecture, arrivalArt, geology, box, tube, blob,
               mats:{plankBrownMat,whitePaintMat,paintMat}, makeGate, buildPen, buildDecorMesh,
               addThing(t), addNPC(def), addFT(entry), addRegion(rg), addBuilding(o),
               addForageSpot(item,box,mk), addBoard(row), npcList, visitors, spawnCritter,
               updateShoes, regionAt(x,z), mapMarkers[], miniMarkers[], forage, nearThing(), buildFtBar}
     G.net    {SOCIAL, net, remotes, lbData, myName, isFriend, publish(topic,obj,opts),
               subscribe(topic), sendChat(text,extra), onMessage(topic,payloadStr), publishMyBoards,
               openProfile, chatMsg, showBubble, netConnect, topic(t), subs}
     G.time   {seasonNow, weekKey, isoWeekKey(t), dateKey(t), marketDay, calMonth}
     G.course {get(), startCourse, cancelCourse, finishCourse, finishDressage, awardRibbons,
               judgeJump, weeklyFeatured, startDressage, startDrill, startRoundup, ARENA_LETTERS,
               DRESSAGE_TESTS, eventPar(ev), kinds{}}
     G.ui     see section 4.
     G.key(name) -> the key code for a KEYMAP name ('care' 'shop' 'events' 'stable' 'quests'
               'club' 'boards' 'chat' 'pet' 'whistle' 'slide' 'wild' 'firstPerson' 'emoteBar'
               'kick' 'brush' 'guitar' 'sprint'), honouring the player's s.keymap overrides.
     G.on(name,fn) / G.run(name,...args) / G.off(name,fn)  — the event bus (section 3).
     G.installed[] / G.errors[]  — what installFeatures recorded (for QA).

   ---- 3. Hooks: G.on(name, fn).  G.run returns the FIRST truthy result, so a hook can
           swallow input or a message by returning true. ----------------------------------
     'tick'        (dt,t)                 every frame, after the built-in tick cluster
     'ride'        (RIDE,dt)              mutate RIDE={target,spMul,acMul,agMul,jpMul,drain,regen,
                                          jumpMul,noJump,fwd,back,gallop,HS,PM} before the stamina
                                          and acceleration integrate
     'key'/'keyup' (e)                    keydown (return true to swallow) / keyup
     'camera'      ({camDesired,camLook,camSafe,dt,t,sp,grounded})  return true to own the camera
     'netPos'      (payload,s,h)          add fields to the /pos packet
     'remote'      (m,r)                  after a remote rider updates
     'remoteTick'  (r,dt,t)               per remote per frame
     'chat'        (m,nm2)                a /chat message (return true to swallow it)
     'message'     (topic,m)              every MQTT message before the built-in dispatch
     'connect'     (club)                 after the built-in subscribes
     'wallet'      (s)                    end of refreshWallet — paint #dustEl/#btokEl/#tokEl, pips
     'courseFinish'({c,ev,stars,RB,pay,dressage,pct?})   after pay is computed
     'courseStart' (course)               end of startCourse / startDressage
     'ribbons'     (RB0)                  mutate RB0.rib (acc/lineOff/refusals default 0)
     'careAct'     (k,s,h)                an unknown care action (return true if handled)
     'dlg'         (def,s) -> html        extra html in an NPC's idle dialogue
     'seasonRoll'  (s,prevKey,newKey)     'weekRoll' (s)      'passClaim' (sv,r,i,gold)
     'rebuild' ()  'attachTack' (h)  'coat' (h)   'grantHorse' (s,h,opts)   'foal' (s,foal,a,b,opts)
     'boot'        (s,BOOT_INFO)          end of installFeatures (BOOT_INFO={rolled,wkClosed})
     'state'       (o)                    render_game_to_text — APPEND keys only
     'interval30'  (s,now)                the 30 s save pass       'dailyEvt' (type,val)
     'region'      (rg)                   the player entered a region
     A thing pushed with addThing may carry its own tick(dt,t,dist), label(t) and use(t).

   ---- 4. Panels, dock buttons, tabs, sections, actions (G.ui) ---------------------------
     G.ui.panel({id:'inboxPanel', title:'📥 Inbox',
                 dock:{label:'📥', after:'questBtn', title:'Inbox', pip:()=>n},   // or sys:true
                 hotkey:'KeyJ',
                 render(p,s){ return html; },                      // or write into p yourself
                 vr:{tab:'inbox', label:'Inbox', build(rows,sv){ ... return note; }}})
       creates <div id class="fpanel">, registers it with hidePanels, inserts the button,
       and toggles on click.  G.ui.open(id) / toggle(id) / rerender(id).
     G.ui.shopTab({id,label,pos?,render(s,h)->html,bind?(p,s)})  — same shape for
       G.ui.questTab, G.ui.lbTab, G.ui.buildTab.  Registering an existing id OVERRIDES it.
     Sections (fn returns html spliced at one point of the renderer):
       careSection(fn(s,h))  careHeader(fn(s,h))  stableRow(fn(h,i))  stableHeader(fn(s))
       eventCard(fn(s,h))  eventRow(fn(ev,s,h))  onlineSection(fn(s))  moneyRow(fn(s))
       buildSection(fn(sv))  lbWeekSection(fn(s))  passRow(fn(s))  profileSection(fn(name,r))
     Actions: G.ui.action('inbox',(args,btn)=>...) and render  data-fx="inbox:claim:12".
       Inputs/selects use data-fxin.  Every built-in renderer ends with bindFx(p).
       Built in: close[:panelId]  open:panelId  shop:tab  rerender:panelId.
     G.ui.nameDialog({title,def,max,onDone(name|null)})   G.ui.confirm({title,body,onYes,onNo})
     G.ui.hud.badge(btnId,n)   G.ui.hud.stat('dustEl',html)   G.ui.hotkey(code,fn)

   ---- 5. Save fields --------------------------------------------------------------------
     G.save.ensure(s=>{ s.myThing=s.myThing||{}; });   // ||-guards only; runs on every
     G.save.ensureHorse(h=>{ h.myField??=null; });     // read/write, so keep it cheap
     ensureCore already gives you: items stats life flags mig pid dust inbox btok tokens doors
     perks mastery wardrobe codes seenBuild friends{} blocked rider keymap a11y story{idx,prog,v}
     and on every horse: traits variant blood hair acc fx sex bondDay trait lineage.
     G.save.flag(s,'seen-x') is a one-shot boolean.  Read with G.save.fresh(), write with
     G.save.sync(s=>...).  Never keep a reference to a save object across frames.

   ---- 6. Data tables --------------------------------------------------------------------
     EVENTS3.push(row)            RACE_ROUTES[key]=[[x,z],...]     FOODS3[k]={...}
     G.quest.addDaily(row)        G.quest.addAch(row)              BREEDS3.push(row)
     PETS3.push  SUMMON_TIERS.push  TACK_SETS[k]=  DECOR_CAT[k]=  WILD_BREEDS.push  EMOTES[k]=
     G.quest.story.append([...]) / insertBefore(idx,[...],'tag')
     G.world.addFT(['🏰 Name',x,z])  addRegion({name,x,z,r})  addNPC({id,name,icon,x,z,hat,shirt,
       idle, extraHtml?(s), role?:{open:'shopTab',label}, onTalk?(def,s)})
     G.world.addBoard({k,g,label,rate,cap?,val?(s)})   G.world.addThing({kind,id,g,x,z,label,use,tick})
     G.world.addBuilding({x,z,rot,build:()=>group,label,r})
     G.world.addForageSpot('berry',[cx,cz,rMin,rMax,count],()=>group)
     G.world.mapMarkers.push({x,z,glyph,label?,hidden?(s)})   miniMarkers.push({x,z,col})
     G.tables.BREED_CEIL['breed']={speed:9,...}   G.tables.TRAITS['nimble']={...}
     G.money.rewardKind('scroll',(s,v)=>{...},v=>v+'📜')   rewards {c,g,k,p,sp,xp,sxp,items,gear,
       dust,btok,tok,tickets} are pre-registered; payReward(s,r) pays whatever it knows.
     G.horse.sourceRule((ctx,b)=>...) decides whether a breed shows in 'shop'|'market'|'summon'.
     G.course.kinds['gauntlet']=ev=>{...} builds a course for EVENTS3 rows with kind:'gauntlet'.

   ---- 7. Club messages ------------------------------------------------------------------
     G.net.subscribe('notice')                 // inside the club: srf1/<club>/notice
     G.net.subscribe('srf1/{club}/members/#')  // absolute, {club} is filled in
     G.net.publish('notice',{text:'...'},{retain:true})   // {id,n} are added for you
     G.on('message',(topic,m)=>{ if(topic.endsWith('/notice')){ ...; return true; } });
     Piggy-back on chat instead with G.net.sendChat(text,{fr:1}) and G.on('chat',(m,nm)=>...).
     QA can feed synthetic messages with G.net.onMessage(topic, JSON.stringify({...})).

   ---- 8. Headless checks ----------------------------------------------------------------
     Open ranch3d.html?qa=<pkg>: window.__features is G.  Wait on render_game_to_text()
     graphics.horseReady, then drive the game (window.advanceTime(ms) steps deterministically).
     Copy tools/qa-features.cjs as tools/qa-<pkg>.cjs.
   ============================================================================================ */
import * as stats from './stats-progression.js';
import * as roster from './horse-roster.js';
import * as bond from './bond-personality-emotes.js';
import * as mastery from './mastery-style.js';
import * as tack from './tack-wardrobe.js';
import * as course from './course-engine.js';
import * as events from './events-pvp.js';
import * as story from './story-quests.js';
import * as account from './account-economy.js';
import * as market from './market-summon-keys-pets.js';
import * as breeding from './breeding.js';
import * as ranch from './ranch.js';
import * as world from './world.js';
import * as clubs from './clubs-boards.js';
import * as social from './social-play.js';
import * as seasons from './seasons.js';
import * as uikit from './ui-kit.js';
import * as ui2horse from './ui2-horse.js';
export const FEATURES=[stats,roster,bond,mastery,tack,course,events,story,account,market,breeding,ranch,world,clubs,social,seasons,uikit,ui2horse];
