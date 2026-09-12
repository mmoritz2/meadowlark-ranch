/* ============================================================================================
   chat-filter.js — the word filter behind Meadowlark's chat.

   Written against one specific complaint about the filters in games like this: they block
   ordinary words. "kindness" is blocked because it contains a rude three letters; "courage"
   because of the four in the middle; numbers are blocked wholesale in case someone is swapping
   a phone number. All three of those are false positives, and a filter that eats them teaches
   players that the filter is the enemy.

   So this one matches WHOLE WORDS, not substrings. 'grass', 'classic', 'kindness', 'courage',
   'Scunthorpe' and '2026' can never match, because they are not the blocked token. Only a
   short hard list — the handful of words people pad with symbols to sneak past a filter —
   gets the squashed whole-string pass, and even that is short-circuited by the allow list.

   Normalisation before matching: lowercase, diacritics folded (ｆｕ̈ → fu), leet digits and
   symbols folded back to letters (0→o 1→i 3→e 4→a 5→s 7→t @→a $→s !→i), separators inside a
   word dropped (f-u-c, f.u.c), and runs of the same letter collapsed to two (fuuuuu → fuu…).
   Digits ON THEIR OWN are never touched: "meet me at 1400 by the 3 oaks" passes clean.

   createChatFilter({words,soft,allow,hard}) -> {
     clean(text) -> {text, flagged, words:[…], level:'clean'|'soft'|'hard'},
     isClean(text) -> boolean,
     test(word) -> ''|'soft'|'hard',
     words, soft, allow
   }
   Nothing here touches the DOM or the game; it is pure text in, text out.
   ============================================================================================ */

const LEET={'0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','8':'b','9':'g','@':'a','$':'s','!':'i','|':'i','+':'t','£':'l'};

/* Fold one word down to the form the lists are written in. */
export function normalise(w){
 let s=String(w||'').toLowerCase();
 try{s=s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');}catch(e){}
 s=s.replace(/[0-9@$!|+£]/g,c=>LEET[c]||c);
 s=s.replace(/[^a-z]/g,'');
 s=s.replace(/([a-z])\1{2,}/g,'$1$1');          // fuuuuu -> fuu, so the doubled form is enough
 return s;
}
/* The de-doubled form as well, so 'fuu' and 'fu' both reach the list entry once. */
function variants(w){
 const a=normalise(w);
 const b=a.replace(/([a-z])\1+/g,'$1');
 return b===a?[a]:[a,b];
}

/* The default lists. Deliberately modest: rude words and direct personal attacks, nothing
   that an ordinary sentence about horses could contain. */
export const DEFAULT_WORDS=[
 'arse','arsehole','ass','asshole','bastard','bitch','bollocks','bugger','bullshit','crap','crappy',
 'damn','dammit','goddamn','dick','dickhead','douche','feck','fuck','fucker','fucking','git','jackass',
 'piss','pissed','prick','shit','shite','shitty','slut','tosser','twat','wanker','whore','wtf','stfu',
];
/* Personal attacks. Filtered, but they only count as a 'soft' hit: two of these do not earn a
   mute, where the hard list does. */
export const DEFAULT_SOFT=[
 'idiot','idiots','moron','morons','loser','losers','noob','noobs','ugly','dumbass','shutup',
 'stupidhead','hater','haters','scrub','trashkid','creep','creepy','pervert','stalker','scammer',
];
/* Words the filter must never eat, checked before anything else. The first two are the exact
   words the complaint named; the rest are the classic substring casualties. */
export const DEFAULT_ALLOW=[
 'kindness','kind','courage','courageous','encourage','encouragement','assist','assistant','assess',
 'class','classic','classy','pass','passage','passion','compass','surpass','grass','bass','brass',
 'glass','mass','massive','molasses','bypass','carcass','cassette','associate','analysis','analyse',
 'assemble','assembly','assign','assured','assure','basement','dumbbell','hello','shell','shelling',
 'shitake','titan','titanium','cockatoo','cocktail','peacock','haystack','stack','buttercup','button',
 'scunthorpe','sussex','essex','middlesex','penistone','arsenal','canal','shiitake','dictionary',
 'predict','verdict','addict','cumbria','document','fantastic','specialist',
];
/* The short list that also gets the squashed whole-string pass, because these are the ones
   people pad: f u c k, s-h-i-t, b!tch. Everything else is whole-word only. */
export const DEFAULT_HARD=['fuck','shit','bitch','asshole','bastard','whore','slut','dickhead'];

export function createChatFilter(opts){
 opts=opts||{};
 const hardSet=new Set(), softSet=new Set(), allow=new Set(), padded=[];
 for(const w of (opts.words||DEFAULT_WORDS))for(const v of variants(w))if(v)hardSet.add(v);
 for(const w of (opts.soft||DEFAULT_SOFT))for(const v of variants(w))if(v)softSet.add(v);
 for(const w of (opts.allow||DEFAULT_ALLOW))for(const v of variants(w))if(v)allow.add(v);
 for(const w of (opts.hard||DEFAULT_HARD)){const v=normalise(w);if(v)padded.push(v);}

 /* '' | 'soft' | 'hard' for one token. The allow list wins, always. */
 function test(word){
  for(const v of variants(word)){
   if(!v)continue;
   if(allow.has(v))return '';
   if(hardSet.has(v))return 'hard';
   if(softSet.has(v))return 'soft';
  }
  return '';
 }
 /* The padded pass: only for tokens that were obviously padded — they carry separators or
    digits between letters — so 'assist' typed plainly can never reach it. */
 function padTest(raw){
  const bare=String(raw||'');
  if(!/[^a-zA-Z]/.test(bare))return '';                 // nothing was padded: whole-word already decided
  if(/^[^a-zA-Z]*[0-9][0-9\s.,:+-]*$/.test(bare))return '';  // a plain number, a time, a score: never filtered
  const v=normalise(bare);
  if(!v||v.length<3||allow.has(v))return '';
  for(const p of padded)if(v===p||v.replace(/([a-z])\1+/g,'$1')===p)return 'hard';
  return '';
 }
 function clean(text){
  const src=String(text==null?'':text);
  const hits=[]; let level='';
  const out=src.replace(/\S+/g,tok=>{
   /* Leading and trailing punctuation is not part of the word — "(idiot)!" still matches,
      and comes back as "(*****)!" so the sentence keeps its shape. */
   const m=/^([^\w@$]*)(.*?)(\W*)$/.exec(tok)||[,'',tok,''];
   const core=m[2]||tok;
   const lvl=test(core)||padTest(core);
   if(!lvl)return tok;
   hits.push(normalise(core));
   if(lvl==='hard')level='hard'; else if(level!=='hard')level='soft';
   const stars='*'.repeat(Math.max(3,Math.min(8,normalise(core).length||3)));
   return (m[1]||'')+stars+(m[3]||'');
  });
  return {text:out,flagged:hits.length>0,words:hits,level:level||'clean'};
 }
 return {clean,isClean:t=>!clean(t).flagged,test,normalise,
  words:Array.from(hardSet),soft:Array.from(softSet),allow:Array.from(allow)};
}
