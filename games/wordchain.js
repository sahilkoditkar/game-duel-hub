const BaseGame = require('./base-game');

// Compact word list for word chain game
const WORDS = new Set([
    'able','acid','aged','also','area','army','away','baby','back','ball','band','bank','base','bath','bean','bear','beat','been','beer','bell',
    'belt','bend','bent','best','bill','bind','bird','bite','blow','blue','blur','boat','body','bold','bolt','bomb','bond','bone','book','boom',
    'boot','bore','born','boss','both','bowl','bulk','burn','busy','cake','call','calm','came','camp','card','care','case','cash','cast','cave',
    'cell','chin','chip','cite','city','clad','clan','clay','clip','club','clue','coal','coat','code','coin','cold','cole','come','cook','cool',
    'cope','copy','cord','core','corn','cost','coup','crew','crop','cult','cure','cute','dado','dale','damn','dare','dark','dart','dash','data',
    'date','dawn','dead','deaf','deal','dean','dear','debt','deed','deem','deep','deer','demo','deny','desk','dial','dice','diet','dirt','disc',
    'dish','dock','does','done','doom','door','dose','down','drab','drag','draw','drew','drip','drop','drug','drum','dual','dull','dumb','dump',
    'dune','dusk','dust','duty','each','earl','earn','ease','east','easy','edge','edit','else','emit','envy','epic','euro','even','ever','evil',
    'exam','exit','face','fact','fade','fail','fair','fake','fall','fame','fang','fare','farm','fast','fate','fear','feat','feed','feel','feet',
    'fell','felt','file','fill','film','find','fine','fire','firm','fish','fist','flag','flat','flaw','fled','flee','flex','flip','flit','flow',
    'foam','foil','fold','folk','fond','font','food','fool','foot','ford','fore','fork','form','fort','foul','four','free','frog','from','fuel',
    'full','fund','fury','fuse','fuss','gain','gait','gale','game','gang','gape','garb','gate','gave','gaze','gear','gene','gift','girl','give',
    'glad','glen','glow','glue','goat','goes','gold','golf','gone','good','gore','grab','gram','gray','grew','grey','grid','grim','grin','grip',
    'grow','gulf','guru','gust','hack','hair','hail','half','hall','halt','hand','hang','harm','harp','hash','hate','haul','have','haze','head',
    'heal','heap','hear','heat','heel','held','help','herb','herd','here','hero','hide','high','hike','hill','hint','hire','hold','hole','holy',
    'home','hood','hook','hope','horn','host','hour','huge','hull','hung','hunt','hurt','hymn','icon','idea','inch','into','iron','isle','item',
    'jack','jail','jazz','jean','jest','jobs','join','joke','jump','jury','just','keen','keep','kept','kick','kill','kind','king','kiss','knee',
    'knew','knit','knob','knot','know','lace','lack','lady','laid','lake','lamp','land','lane','last','late','lawn','lead','leaf','lean','leap',
    'left','lend','lens','less','lick','lied','life','lift','like','limb','lime','limp','line','link','lion','list','live','load','loan','lock',
    'logo','lone','long','look','loop','lord','lose','loss','lost','loud','love','luck','lump','lure','lurk','made','mail','main','make','male',
    'mall','malt','mane','many','mare','mark','mars','mask','mass','mast','mate','maze','meal','mean','meat','meet','melt','memo','mend','menu',
    'mere','mesh','mess','mice','mild','mile','mill','mind','mine','mint','miss','mode','mole','mood','moon','more','moss','most','moth','move',
    'much','muse','must','myth','nail','name','navy','near','neat','neck','need','nest','news','next','nice','nine','node','none','norm','nose',
    'note','noun','nude','odds','okay','once','only','onto','open','oral','ours','oust','over','oven','pace','pack','page','paid','pain','pair',
    'pale','palm','pane','park','part','pass','past','path','peak','peel','peer','pile','pine','pink','pipe','plan','play','plea','plot','ploy',
    'plug','plus','poem','poet','pole','poll','polo','pond','pool','poor','pope','pork','port','pose','post','pour','pray','prey','prop','pull',
    'pulp','pump','pure','push','quit','quiz','race','rack','rage','raid','rail','rain','rank','rape','rare','rash','rate','read','real','rear',
    'reef','rein','rely','rent','rest','rice','rich','ride','rift','ring','riot','rise','risk','road','roam','rock','rode','role','roll','roof',
    'room','root','rope','rose','ruin','rule','rush','ruth','sack','safe','sage','said','sail','sake','sale','salt','same','sand','sane','sang',
    'save','seal','seam','seat','seed','seek','seem','seen','self','sell','send','sent','sept','shed','ship','shop','shot','show','shut','sick',
    'side','sift','sigh','sign','silk','sing','sink','site','size','skin','skip','slab','slam','slap','slim','slip','slit','slot','slow','snap',
    'snow','soak','soar','sock','soft','soil','sold','sole','some','song','soon','sort','soul','span','spin','spit','spot','spur','star','stay',
    'stem','step','stew','stir','stop','stud','such','suit','sure','surf','swim','tail','take','tale','talk','tall','tame','tank','tape','task',
    'taxi','team','tear','tell','temp','tend','tent','term','test','text','than','that','them','then','they','thin','this','thus','tick','tide',
    'tidy','tied','tier','tile','till','tilt','time','tiny','tire','toad','toll','tomb','tone','took','tool','tops','tore','torn','toss','tour',
    'town','trap','tray','tree','trim','trio','trip','trod','true','tube','tuck','tuna','tune','turn','twin','type','ugly','unit','upon','urge',
    'used','user','vain','vale','vary','vast','veil','vein','verb','very','vest','veto','vice','view','vine','visa','void','volt','vote','wade',
    'wage','wait','wake','walk','wall','want','ward','warm','warn','wary','wash','vast','wave','weak','wear','weed','week','weep','weld','well',
    'went','were','west','what','when','whom','wide','wife','wild','will','wilt','wind','wine','wing','wire','wise','wish','with','woke','wolf',
    'wood','wool','word','wore','work','worm','worn','wrap','yard','yeah','year','yell','your','zeal','zero','zinc','zone','zoom',
    'about','above','abuse','actor','adapt','admit','adopt','adult','after','again','agent','agile','agree','ahead','alarm','album','alert',
    'alien','align','alike','alive','alley','allow','alone','along','alter','amaze','ample','angel','anger','angle','anime','ankle','annex',
    'apart','apple','apply','arena','argue','arise','armor','array','arrow','aside','asset','atlas','audio','audit','avoid','await','awake',
    'award','aware','basic','basin','basis','batch','beach','beast','begin','being','below','bench','berry','birth','black','blade','blame',
    'bland','blank','blast','blaze','bleed','blend','bless','blind','bliss','block','blood','bloom','blown','board','boast','bonus','boost',
    'booth','bound','brain','brand','brave','bread','break','breed','brick','bride','brief','bring','broad','broke','brook','brown','brush',
    'build','bunch','burst','buyer','cabin','cable','candy','cargo','carry','catch','cause','cease','chain','chair','chalk','chant','chaos',
    'charm','chart','chase','cheap','check','cheek','cheer','chess','chest','chief','child','chill','china','chunk','civic','civil','claim',
    'clash','class','clean','clear','clerk','click','cliff','climb','cling','climb','clock','clone','close','cloth','cloud','clown','coach',
    'coast','color','comet','comic','coral','count','court','cover','crack','craft','crane','crash','crawl','crazy','cream','creek','crest',
    'crime','crisp','cross','crowd','crown','cruel','crush','curve','cycle','dairy','dance','debut','decay','decor','decoy','delay','delta',
    'dense','depth','derby','devil','diary','dirty','donor','doubt','dough','draft','drain','drake','drama','drank','drape','drawn','dream',
    'dress','drift','drink','drive','drops','drove','drown','drugs','drunk','dryer','dying','eager','early','earth','eight','elder','elect',
    'elite','ember','empty','ended','enemy','enjoy','enter','entry','equal','equip','error','essay','event','every','exact','exert','exile',
    'exist','extra','fable','facet','faint','faith','false','fancy','fatal','fault','feast','fence','fever','fiber','field','fiery','fifth',
    'fifty','fight','final','first','fixed','flame','flash','flesh','flick','float','flock','flood','floor','flora','flour','fluid','flush',
    'focal','focus','force','forge','forth','forum','found','frame','frank','fraud','fresh','front','frost','froze','fruit','gauge','ghost',
    'giant','given','glass','gleam','glide','globe','gloom','glory','gloss','glove','grace','grade','grain','grand','grant','graph','grasp',
    'grass','grave','great','green','greet','grief','grill','grind','groan','groom','gross','group','grove','grown','guard','guess','guest',
    'guide','guild','guilt','habit','happy','harsh','haunt','haven','heart','heavy','hence','herbs','horse','hotel','house','human','humor',
    'hurry','hyper','ideal','image','imply','inbox','index','indie','inner','input','irony','ivory','jewel','joint','joker','judge','juice',
    'juicy','knife','knock','known','label','labor','lance','large','laser','later','laugh','layer','learn','lease','least','leave','legal',
    'lemon','level','light','limit','liner','liver','local','lodge','logic','login','loose','lover','lower','loyal','lucky','lunar','lunch',
    'lying','magic','major','maker','manor','maple','march','marry','match','mayor','media','mercy','merge','merit','metal','meter','midst',
    'might','minor','minus','mixed','model','money','month','moral','motor','mount','mouse','mouth','moved','movie','music','naive','nasty',
    'naval','nerve','never','night','noble','noise','north','noted','novel','nurse','occur','ocean','offer','often','olive','onset','opera',
    'orbit','order','other','outer','owned','owner','oxide','paint','panel','panic','paper','patch','pause','peace','pearl','penny','perch',
    'phase','phone','photo','piano','pilot','pitch','pixel','pizza','place','plain','plane','plant','plate','plaza','plead','pluck','plumb',
    'plume','plump','plunge','point','polar','posed','pound','power','press','price','pride','prime','print','prior','prize','probe','prone',
    'proof','proud','prove','psalm','pulse','punch','pupil','purse','queen','quest','queue','quick','quiet','quota','quote','radar','radio',
    'raise','rally','ranch','range','rapid','reach','react','ready','realm','rebel','refer','reign','relax','relay','renal','renew','reply',
    'rifle','right','rigid','rival','river','robin','robot','rocky','rouge','rough','round','route','royal','ruler','rural','sadly','saint',
    'salad','sauce','scale','scare','scene','scent','scope','score','scout','scrap','sense','serve','seven','shade','shake','shall','shame',
    'shape','share','shark','sharp','shelf','shell','shift','shine','shirt','shock','shoot','shore','short','shout','sight','since','sixth',
    'sixty','sized','skill','skull','slate','slave','sleep','slice','slide','slope','smart','smell','smile','smoke','snake','solar','solid',
    'solve','sorry','sound','south','space','spare','spark','spawn','speak','speed','spell','spend','spent','spice','spine','spite','split',
    'spoke','sport','spray','squad','stack','staff','stage','stain','stair','stake','stale','stall','stamp','stand','stark','start','state',
    'stays','steal','steam','steel','steep','steer','stern','stick','stiff','still','stock','stone','stood','store','storm','story','stove',
    'strap','straw','strip','stuck','study','stuff','style','sugar','suite','super','surge','swamp','swarm','swear','sweep','sweet','swept',
    'swift','swing','sword','swore','sworn','syrup','table','taste','teach','tempo','tense','tenth','theft','theme','there','thick','thief',
    'thing','think','third','those','three','throw','thumb','tight','timer','title','today','token','total','touch','tough','towel','tower',
    'toxic','trace','track','trade','trail','train','trait','trash','trend','trial','tribe','trick','tried','troop','truck','truly','trump',
    'trunk','trust','truth','tumor','twist','ultra','uncle','under','union','unite','unity','upper','upset','urban','usage','usual','valid',
    'valor','value','valve','vault','venue','verse','video','vigor','viral','virus','visit','vital','vivid','vocal','voice','voter','wagon',
    'waste','watch','water','weave','weigh','weird','wheat','wheel','where','which','while','white','whole','whose','widen','width','witch',
    'woman','world','worry','worst','worth','would','wound','wrath','write','wrong','wrote','yield','young','youth',
    // Short common words so players are not stuck with 4-6 letter words only
    'ace','act','add','age','ago','aid','aim','air','ale','all','and','ant','any','ape','apt','arc','are','ark','arm','art',
    'ash','ask','ate','awe','axe','aye','bad','bag','ban','bar','bat','bay','bed','bee','beg','bet','bid','big','bin','bit',
    'boa','bog','boo','bow','box','boy','bud','bug','bun','bus','but','buy','bye','cab','can','cap','car','cat','cog','con',
    'cop','cot','cow','coy','cry','cub','cue','cup','cut','dab','dad','dam','day','den','dew','did','die','dig','dim','dip',
    'dog','dot','dry','dub','dud','due','dug','dye','ear','eat','eel','egg','ego','elf','elk','elm','end','era','eve','ewe',
    'eye','fad','fan','far','fat','fax','fed','fee','few','fig','fin','fir','fit','fix','flu','fly','foe','fog','for','fox',
    'fry','fun','fur','gag','gap','gas','gel','gem','get','gig','gin','gnu','god','got','gum','gun','gut','guy','gym','had',
    'ham','has','hat','hay','hem','hen','her','hew','hey','hid','him','hip','his','hit','hog','hop','hot','how','hub','hue',
    'hug','hum','hut','ice','icy','ill','imp','ink','inn','ion','ire','irk','its','ivy','jab','jam','jar','jaw','jay','jet',
    'jig','job','jog','jot','joy','jug','jut','keg','key','kid','kin','kit','lab','lad','lag','lap','law','lax','lay','led',
    'leg','let','lid','lie','lip','lit','log','lot','low','lug','mad','man','map','mat','may','men','met','mid','mix','mob',
    'mod','mom','mop','mow','mud','mug','nab','nag','nap','net','new','nil','nip','nod','nor','not','now','nun','nut','oak',
    'oar','oat','odd','ode','off','oil','old','one','opt','orb','ore','our','out','owe','owl','own','pad','pal','pan','par',
    'pat','paw','pay','pea','peg','pen','pep','per','pet','pew','pie','pig','pin','pit','ply','pod','pop','pot','pro','pry',
    'pub','pug','pun','pup','put','rag','ram','ran','rap','rat','raw','ray','red','rib','rid','rig','rim','rip','rob','rod',
    'roe','rot','row','rub','rug','rum','run','rut','rye','sad','sag','sap','sat','saw','say','sea','see','set','sew','she',
    'shy','sin','sip','sir','sis','sit','six','ski','sky','sly','sob','sod','son','sow','soy','spa','spy','sty','sub','sue',
    'sum','sun','tab','tag','tan','tap','tar','tax','tea','ten','the','thy','tie','tin','tip','toe','ton','too','top','tow',
    'toy','try','tub','tug','two','ugh','urn','use','van','vat','vet','vex','via','vie','vow','wad','wag','war','was','wax',
    'way','web','wed','wee','wet','who','why','wig','win','wit','woe','wok','won','woo','wow','wry','xenon','xerox','xylem','yacht',
    'yak','yam','yap','yarn','yaw','yawn','yearn','yeast','yelp','yes','yet','yew','yin','yip','yoga','yoke','yolk','you','yummy','zany',
    'zap','zebra','zed','zen','zest','zesty','zing','zip','zit','zonal','zoo'
]);

const MIN_LENGTH = 3;
const MAX_LENGTH = Math.max(...[...WORDS].map(w => w.length));

// Index words by first letter so we can tell when a letter has run dry.
const WORDS_BY_FIRST = new Map();
for (const w of WORDS) {
    if (!WORDS_BY_FIRST.has(w[0])) WORDS_BY_FIRST.set(w[0], []);
    WORDS_BY_FIRST.get(w[0]).push(w);
}

class WordChain extends BaseGame {
    constructor(id, players, startingPlayerIndex, io) {
        super(id, players, startingPlayerIndex);
        this.io = io;
        this.turnTime = 15; // seconds per turn
        this.timer = null;
        this.started = false; // the clock only runs once both clients are ready
        this.paused = false;
        this.gameState = {
            words: [],
            usedWords: new Set(),
            lastLetter: null,
            timeLeft: this.turnTime,
            message: '',
            minLength: MIN_LENGTH,
            maxLength: MAX_LENGTH
        };
    }

    // Called by the GameManager once both players report ready (or after a fallback delay).
    start() {
        if (this.started || this.isGameOver) return;
        this.started = true;
        this.startTurnTimer();
        this.emitState();
    }

    // A player dropped: freeze the clock so nobody loses to a flaky network.
    pause() {
        if (!this.started || this.isGameOver) return;
        this.paused = true;
        this.clearTimer();
        this.gameState.message = 'Paused - waiting for reconnection';
        this.emitState();
    }

    resume() {
        if (!this.started || this.isGameOver || !this.paused) return;
        this.paused = false;
        this.gameState.message = '';
        this.runTimer();
        this.emitState();
    }

    startTurnTimer() {
        this.clearTimer();
        this.gameState.timeLeft = this.turnTime;
        if (!this.started || this.paused) return;
        this.runTimer();
    }

    runTimer() {
        this.clearTimer();
        this.timer = setInterval(() => {
            this.gameState.timeLeft--;

            if (this.gameState.timeLeft <= 0) {
                this.clearTimer();
                // Current player loses (ran out of time)
                this.isGameOver = true;
                this.winner = 1 - this.activePlayerIndex;
                this.gameState.message = 'Time ran out!';
            }
            this.emitState();
        }, 1000);
    }

    clearTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    cleanup() {
        this.clearTimer();
    }

    hasUnusedWordStartingWith(letter) {
        const candidates = WORDS_BY_FIRST.get(letter) || [];
        return candidates.some(w => !this.gameState.usedWords.has(w));
    }

    makeMove(playerIndex, moveData) {
        if (!this.isTurn(playerIndex)) {
            return { valid: false, message: "Not your turn" };
        }
        if (this.isGameOver) {
            return { valid: false, message: "Game is over" };
        }
        if (this.paused) {
            return { valid: false, message: "Game is paused while your opponent reconnects" };
        }

        const raw = moveData && moveData.word;
        if (typeof raw !== 'string') {
            return { valid: false, message: "Type a word" };
        }
        const cleanWord = raw.trim().toLowerCase();

        if (!/^[a-z]+$/.test(cleanWord)) {
            return { valid: false, message: "Letters only, one word" };
        }
        if (cleanWord.length < MIN_LENGTH) {
            return { valid: false, message: `Word too short (min ${MIN_LENGTH} letters)` };
        }
        if (cleanWord.length > MAX_LENGTH) {
            return { valid: false, message: `Word too long (max ${MAX_LENGTH} letters in our list)` };
        }

        if (this.gameState.lastLetter && cleanWord[0] !== this.gameState.lastLetter) {
            return { valid: false, message: `Word must start with '${this.gameState.lastLetter.toUpperCase()}'` };
        }

        if (this.gameState.usedWords.has(cleanWord)) {
            return { valid: false, message: "Word already used" };
        }

        if (!WORDS.has(cleanWord)) {
            return { valid: false, message: `'${cleanWord}' is not in our word list (${MIN_LENGTH}-${MAX_LENGTH} letter common words)` };
        }

        // Valid move
        this.gameState.words.push({ word: cleanWord, player: playerIndex });
        this.gameState.usedWords.add(cleanWord);
        this.gameState.message = '';

        const nextLetter = cleanWord[cleanWord.length - 1];
        if (this.hasUnusedWordStartingWith(nextLetter)) {
            this.gameState.lastLetter = nextLetter;
        } else {
            // Nothing left that starts with this letter: never hand the opponent a forced loss.
            this.gameState.lastLetter = null;
            this.gameState.message = `No words left starting with '${nextLetter.toUpperCase()}' - any word allowed!`;
        }

        this.switchTurn();
        this.startTurnTimer();
        this.emitState();

        return { valid: true };
    }

    getState() {
        return {
            words: this.gameState.words,
            lastLetter: this.gameState.lastLetter,
            timeLeft: this.gameState.timeLeft,
            message: this.gameState.message,
            minLength: this.gameState.minLength,
            maxLength: this.gameState.maxLength,
            started: this.started,
            paused: this.paused,
            activePlayerIndex: this.activePlayerIndex,
            isGameOver: this.isGameOver,
            winner: this.winner
        };
    }
}

module.exports = WordChain;
module.exports.WORDS = WORDS;
