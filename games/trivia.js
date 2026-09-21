const BaseGame = require('./base-game');

// General-knowledge bank. Every entry has exactly one correct option (answer = index into options).
const QUESTION_BANK = [
    // Geography
    { q: 'What is the capital city of Australia?', options: ['Canberra', 'Sydney', 'Melbourne', 'Perth'], answer: 0 },
    { q: 'Which is the longest river in South America?', options: ['Amazon', 'Parana', 'Orinoco', 'Sao Francisco'], answer: 0 },
    { q: 'Which country has the largest land area in the world?', options: ['Russia', 'Canada', 'China', 'United States'], answer: 0 },
    { q: 'Mount Everest sits on the border of Nepal and which other country?', options: ['China', 'India', 'Bhutan', 'Pakistan'], answer: 0 },
    { q: 'What is the largest ocean on Earth?', options: ['Pacific', 'Atlantic', 'Indian', 'Arctic'], answer: 0 },
    { q: 'What is the largest hot desert in the world?', options: ['Sahara', 'Gobi', 'Kalahari', 'Arabian'], answer: 0 },
    { q: 'What is the capital city of Canada?', options: ['Ottawa', 'Toronto', 'Vancouver', 'Montreal'], answer: 0 },
    { q: 'What is the capital city of Japan?', options: ['Tokyo', 'Osaka', 'Kyoto', 'Hiroshima'], answer: 0 },
    { q: 'The city of Marrakesh is in which country?', options: ['Morocco', 'Egypt', 'Tunisia', 'Turkey'], answer: 0 },
    { q: 'What is the smallest country in the world by area?', options: ['Vatican City', 'Monaco', 'Malta', 'San Marino'], answer: 0 },
    { q: 'Which US state is the largest by area?', options: ['Alaska', 'Texas', 'California', 'Montana'], answer: 0 },
    { q: 'Which river flows through the centre of Paris?', options: ['Seine', 'Loire', 'Rhone', 'Thames'], answer: 0 },
    { q: 'What is the largest country in South America?', options: ['Brazil', 'Argentina', 'Peru', 'Colombia'], answer: 0 },
    { q: 'In which city is the Eiffel Tower?', options: ['Paris', 'Lyon', 'Brussels', 'Marseille'], answer: 0 },
    { q: 'What is the capital city of Italy?', options: ['Rome', 'Milan', 'Venice', 'Naples'], answer: 0 },
    { q: 'Which ocean lies between Africa and Australia?', options: ['Indian', 'Atlantic', 'Pacific', 'Southern'], answer: 0 },
    { q: 'What is the currency of Japan?', options: ['Yen', 'Won', 'Yuan', 'Baht'], answer: 0 },

    // Science & nature
    { q: 'What is the chemical symbol for gold?', options: ['Au', 'Ag', 'Gd', 'Go'], answer: 0 },
    { q: 'How many planets are in our solar system?', options: ['8', '7', '9', '10'], answer: 0 },
    { q: 'Which planet is known as the Red Planet?', options: ['Mars', 'Venus', 'Jupiter', 'Mercury'], answer: 0 },
    { q: 'Which gas do plants take in from the air for photosynthesis?', options: ['Carbon dioxide', 'Oxygen', 'Nitrogen', 'Hydrogen'], answer: 0 },
    { q: 'What is the hardest natural substance?', options: ['Diamond', 'Quartz', 'Steel', 'Granite'], answer: 0 },
    { q: 'At what temperature does water boil at sea level, in Celsius?', options: ['100', '90', '110', '120'], answer: 0 },
    { q: 'Which organ pumps blood around the human body?', options: ['Heart', 'Liver', 'Lungs', 'Kidney'], answer: 0 },
    { q: 'How many bones are in an adult human body?', options: ['206', '186', '226', '256'], answer: 0 },
    { q: 'What is the largest planet in our solar system?', options: ['Jupiter', 'Saturn', 'Neptune', 'Earth'], answer: 0 },
    { q: 'Which planet is closest to the Sun?', options: ['Mercury', 'Venus', 'Earth', 'Mars'], answer: 0 },
    { q: 'What is the chemical symbol for sodium?', options: ['Na', 'So', 'Sd', 'S'], answer: 0 },
    { q: 'Which element has the atomic number 1?', options: ['Hydrogen', 'Helium', 'Oxygen', 'Carbon'], answer: 0 },
    { q: 'What is the closest star to Earth?', options: ['The Sun', 'Sirius', 'Polaris', 'Alpha Centauri'], answer: 0 },
    { q: 'What is the largest animal alive today?', options: ['Blue whale', 'African elephant', 'Giraffe', 'Great white shark'], answer: 0 },
    { q: 'How many legs does a spider have?', options: ['8', '6', '10', '12'], answer: 0 },
    { q: 'What is the fastest land animal?', options: ['Cheetah', 'Lion', 'Horse', 'Greyhound'], answer: 0 },
    { q: 'What is the tallest animal in the world?', options: ['Giraffe', 'Elephant', 'Ostrich', 'Camel'], answer: 0 },
    { q: 'At what temperature does water freeze, in Fahrenheit?', options: ['32', '0', '10', '100'], answer: 0 },
    { q: 'Which force keeps the planets in orbit around the Sun?', options: ['Gravity', 'Magnetism', 'Friction', 'Electricity'], answer: 0 },

    // History
    { q: 'In which year did World War II end?', options: ['1945', '1939', '1941', '1950'], answer: 0 },
    { q: 'Who was the first President of the United States?', options: ['George Washington', 'Thomas Jefferson', 'Abraham Lincoln', 'John Adams'], answer: 0 },
    { q: 'The Great Wall is located in which country?', options: ['China', 'Japan', 'India', 'Mongolia'], answer: 0 },
    { q: 'In which year did humans first walk on the Moon?', options: ['1969', '1959', '1972', '1965'], answer: 0 },
    { q: 'Which ancient civilization built the pyramids of Giza?', options: ['Egyptians', 'Romans', 'Greeks', 'Aztecs'], answer: 0 },
    { q: 'In which year did the Titanic sink?', options: ['1912', '1905', '1920', '1898'], answer: 0 },
    { q: 'Julius Caesar was a famous leader of which ancient civilization?', options: ['Rome', 'Greece', 'Persia', 'Egypt'], answer: 0 },

    // Sport
    { q: 'How many players does a soccer team have on the field at one time?', options: ['11', '9', '10', '12'], answer: 0 },
    { q: 'In which sport would you perform a slam dunk?', options: ['Basketball', 'Volleyball', 'Tennis', 'Rugby'], answer: 0 },
    { q: 'How often are the Summer Olympic Games normally held?', options: ['Every 4 years', 'Every 2 years', 'Every 5 years', 'Every year'], answer: 0 },
    { q: 'Which country hosted the 2016 Summer Olympics?', options: ['Brazil', 'China', 'United Kingdom', 'Japan'], answer: 0 },
    { q: 'How many holes are played in a standard round of golf?', options: ['18', '9', '12', '20'], answer: 0 },
    { q: 'In tennis, what word is used for a score of zero?', options: ['Love', 'Nil', 'Duck', 'Zip'], answer: 0 },
    { q: 'How many rings are on the Olympic flag?', options: ['5', '4', '6', '7'], answer: 0 },
    { q: 'Which sport is played with a shuttlecock?', options: ['Badminton', 'Squash', 'Table tennis', 'Lacrosse'], answer: 0 },
    { q: 'How many squares are on a chessboard?', options: ['64', '48', '81', '100'], answer: 0 },

    // Arts & literature
    { q: 'Who painted the Mona Lisa?', options: ['Leonardo da Vinci', 'Michelangelo', 'Raphael', 'Pablo Picasso'], answer: 0 },
    { q: 'Who composed the "Moonlight Sonata"?', options: ['Beethoven', 'Mozart', 'Bach', 'Chopin'], answer: 0 },
    { q: 'Who wrote "Romeo and Juliet"?', options: ['William Shakespeare', 'Charles Dickens', 'Jane Austen', 'Mark Twain'], answer: 0 },
    { q: 'How many strings does a standard guitar have?', options: ['6', '4', '5', '8'], answer: 0 },
    { q: 'Which artist painted "The Starry Night"?', options: ['Vincent van Gogh', 'Claude Monet', 'Salvador Dali', 'Rembrandt'], answer: 0 },
    { q: 'How many keys does a standard full-size piano have?', options: ['88', '76', '96', '100'], answer: 0 },
    { q: 'Who wrote the "Harry Potter" books?', options: ['J.K. Rowling', 'Roald Dahl', 'J.R.R. Tolkien', 'C.S. Lewis'], answer: 0 },

    // Food
    { q: 'Sushi originally comes from which country?', options: ['Japan', 'China', 'Thailand', 'Korea'], answer: 0 },
    { q: 'Guacamole is made mainly from which fruit?', options: ['Avocado', 'Tomato', 'Lime', 'Cucumber'], answer: 0 },
    { q: 'What is the main ingredient of traditional hummus?', options: ['Chickpeas', 'Lentils', 'Peanuts', 'Rice'], answer: 0 },
    { q: 'Which spice is made from the dried stigmas of a crocus flower?', options: ['Saffron', 'Turmeric', 'Paprika', 'Cinnamon'], answer: 0 },
    { q: 'Which nut is the main ingredient of marzipan?', options: ['Almond', 'Walnut', 'Peanut', 'Hazelnut'], answer: 0 },
    { q: 'Pizza originated in which country?', options: ['Italy', 'Greece', 'France', 'Spain'], answer: 0 },

    // Technology
    { q: 'What does "CPU" stand for?', options: ['Central Processing Unit', 'Computer Power Unit', 'Central Program Utility', 'Core Processing Unit'], answer: 0 },
    { q: 'Who co-founded Microsoft with Paul Allen?', options: ['Bill Gates', 'Steve Jobs', 'Mark Zuckerberg', 'Elon Musk'], answer: 0 },
    { q: 'What does "HTML" stand for?', options: ['HyperText Markup Language', 'HyperText Machine Language', 'Home Tool Markup Language', 'HyperLink Text Markup Language'], answer: 0 },
    { q: 'In which year was the first iPhone released?', options: ['2007', '2005', '2009', '2010'], answer: 0 },
    { q: 'What does "www" stand for in a web address?', options: ['World Wide Web', 'World Web Wire', 'Wide World Web', 'Web World Wide'], answer: 0 },
    { q: 'Which company makes the PlayStation game console?', options: ['Sony', 'Nintendo', 'Microsoft', 'Sega'], answer: 0 },
    { q: 'How many bits are in one byte?', options: ['8', '4', '16', '32'], answer: 0 },
    { q: 'Which programming language shares its name with a type of coffee?', options: ['Java', 'Python', 'Ruby', 'Swift'], answer: 0 }
];

const TOTAL_QUESTIONS = 10;
const QUESTION_TIME = 15;      // seconds per question
const REVEAL_DELAY_MS = 2500;  // pause after the reveal before the next question

function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

class Trivia extends BaseGame {
    // options (optional, tests only): { questions: [...bank entries], rng: () => [0,1) }
    constructor(id, players, startingPlayerIndex, options) {
        super(id, players, startingPlayerIndex);
        const opts = options && typeof options === 'object' ? options : {};
        this.rng = typeof opts.rng === 'function' ? opts.rng : Math.random;

        const pool = Array.isArray(opts.questions) && opts.questions.length > 0
            ? opts.questions.slice()
            : shuffle(QUESTION_BANK.slice(), this.rng);
        this.total = Math.min(TOTAL_QUESTIONS, pool.length);
        this.questions = pool.slice(0, this.total).map(entry => this.prepareQuestion(entry));

        this.questionIndex = 0;
        this.answers = [null, null];
        this.scores = [0, 0];
        this.phase = 'answering'; // 'answering' | 'reveal' | 'finished'
        this.lastResult = null;
        this.timeLeft = QUESTION_TIME;
        this.questionTime = QUESTION_TIME;
        this.revealDelayMs = REVEAL_DELAY_MS;

        this.started = false;
        this.paused = false;
        this.timer = null;
        this.advanceTimeout = null;
        this.activePlayerIndex = null;
    }

    // Shuffle the options and remember where the correct one ended up.
    prepareQuestion(entry) {
        const order = shuffle([0, 1, 2, 3], this.rng);
        return {
            q: entry.q,
            options: order.map(i => entry.options[i]),
            correctIndex: order.indexOf(entry.answer)
        };
    }

    get current() {
        return this.questions[this.questionIndex] || null;
    }

    // ---- clock -----------------------------------------------------------

    start() {
        if (this.started || this.isGameOver) return;
        this.started = true;
        this.runTimer();
        this.emitState();
    }

    pause() {
        if (!this.started || this.isGameOver || this.paused) return;
        this.paused = true;
        this.clearTimer();
        this.clearAdvance();
        this.emitState();
    }

    resume() {
        if (!this.started || this.isGameOver || !this.paused) return;
        this.paused = false;
        if (this.phase === 'answering') this.runTimer();
        else if (this.phase === 'reveal') this.scheduleAdvance();
        this.emitState();
    }

    runTimer() {
        this.clearTimer();
        if (!this.started || this.paused || this.phase !== 'answering') return;
        this.timer = setInterval(() => {
            this.timeLeft--;
            if (this.timeLeft <= 0) {
                this.timeLeft = 0;
                this.resolveQuestion();
                return;
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

    scheduleAdvance() {
        this.clearAdvance();
        this.advanceTimeout = setTimeout(() => {
            this.advanceTimeout = null;
            this.advance();
        }, this.revealDelayMs);
    }

    clearAdvance() {
        if (this.advanceTimeout) {
            clearTimeout(this.advanceTimeout);
            this.advanceTimeout = null;
        }
    }

    cleanup() {
        this.clearTimer();
        this.clearAdvance();
    }

    // ---- moves -----------------------------------------------------------

    makeMove(playerIndex, moveData) {
        if (this.isGameOver) {
            return { valid: false, message: 'Game is over' };
        }
        if (!this.started) {
            return { valid: false, message: 'Clock starts when both are ready' };
        }
        if (this.paused) {
            return { valid: false, message: 'Game is paused while your opponent reconnects' };
        }
        if (this.phase !== 'answering') {
            return { valid: false, message: 'Wait for the next question' };
        }
        const answer = moveData ? moveData.answer : undefined;
        if (!BaseGame.isIntInRange(answer, 0, 3)) {
            return { valid: false, message: 'Pick one of the four answers' };
        }
        if (this.answers[playerIndex] !== null) {
            return { valid: false, message: 'You already answered' };
        }

        this.answers[playerIndex] = answer;

        if (this.answers[0] !== null && this.answers[1] !== null) {
            this.resolveQuestion();
        } else {
            this.emitState();
        }
        return { valid: true };
    }

    // Both answered or time ran out: score it and show the answer for a moment.
    resolveQuestion() {
        if (this.phase !== 'answering') return;
        this.clearTimer();
        const correct = this.current.correctIndex;
        for (let i = 0; i < 2; i++) {
            if (this.answers[i] === correct) this.scores[i]++;
        }
        this.lastResult = { correctIndex: correct, answers: this.answers.slice() };
        this.phase = 'reveal';
        this.scheduleAdvance();
        this.emitState();
    }

    advance() {
        if (this.phase !== 'reveal') return;
        this.questionIndex++;
        if (this.questionIndex >= this.total) {
            this.questionIndex = this.total - 1;
            this.finish();
            return;
        }
        this.answers = [null, null];
        this.timeLeft = this.questionTime;
        this.phase = 'answering';
        this.runTimer();
        this.emitState();
    }

    finish() {
        this.phase = 'finished';
        this.isGameOver = true;
        if (this.scores[0] > this.scores[1]) this.winner = 0;
        else if (this.scores[1] > this.scores[0]) this.winner = 1;
        else this.winner = 'draw';
        this.cleanup();
        this.emitState();
    }

    // ---- state -----------------------------------------------------------

    getState() {
        return this.getStateForPlayer(0);
    }

    getStateForPlayer(playerIndex) {
        const cur = this.current;
        const revealed = this.phase === 'reveal' || this.phase === 'finished';
        // The question is hidden until the clock starts so nobody gets extra reading time.
        const showQuestion = cur && (this.started || this.isGameOver);
        return {
            questionIndex: this.questionIndex,
            total: this.total,
            question: showQuestion ? { q: cur.q, options: cur.options.slice() } : null,
            myAnswer: this.answers[playerIndex],
            opponentAnswered: this.answers[1 - playerIndex] !== null,
            phase: this.phase,
            correctIndex: revealed ? cur.correctIndex : null,
            lastResult: revealed ? this.lastResult : null,
            scores: this.scores.slice(),
            timeLeft: this.timeLeft,
            started: this.started,
            paused: this.paused,
            activePlayerIndex: null,
            isGameOver: this.isGameOver,
            winner: this.winner
        };
    }
}

module.exports = Trivia;
module.exports.QUESTION_BANK = QUESTION_BANK;
