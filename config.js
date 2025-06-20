// config.js

// --- Credenciales y Configuración ---
// 🔴 ¡MUY IMPORTANTE! Para obtener tu SESSION_STRING:
// 1. Deja este campo vacío la primera vez que ejecutes el bot.
// 2. El bot te pedirá tu número, código de Telegram y contraseña de 2FA en la consola.
// 3. Una vez que inicies sesión, imprimirá una "Session String".
// 4. Copia esa string y pégala aquí para que el bot no te pida tus credenciales cada vez.
const SESSION_STRING = ''; // <-- Pega tu session string aquí después del primer inicio de sesión.

const API_ID = 20491337; // Tu ApiID de my.telegram.org
const API_HASH = '72f87102bdc7c1044b2fa298dee9dca5'; // Tu ApiHash
const BOT_TOKEN = '7562671189:AAEJIWFW8LfESm09CYcR6GgPbhg5eZ5NbAk'; // Tu Bot Token

// ID del chat donde el bot enviará las notificaciones y donde se autorizan los comandos.
const NOTIFY_CHAT_ID = 1048966581;

// --- Configuración de GeNeSiS Lounge y Usuarios de Confianza ---
// Usamos strings para los IDs para evitar problemas con números grandes en JS.
const GENESIS_LOUNGE_ID = '2124901271';
const TRUSTED_USER_IDS = new Map([
    ['1282048314', "GENESIS_CHAI"],
    ['7207841877', "muktartt"],
    ['5056344791', "Altrealite"],
]);

// --- Canales a Monitorear ---
// Usamos un Map para un manejo más fácil y seguro de los IDs.
const MONITORED_CHANNELS = new Map([
    ['2124901271', "GeNeSiS_Lounge"],
    ['2331240414', "Capo's Cousins"],
    ['2604509392', "Beijing don't lie"],
    ['2382209373', "Patrol Pump"],
    ['2048249888', "AI CALL | $SOL"],
    ['2198683628', "Felix Alpha"],
    ['2314485533', "KOL SignalX"],
    ['2338895089', "Pals Gem"],
    ['2495900078', "PUM FUN"],
    ['2433457093', "Chino"],
    ['2341018601', "Solana Dex Paid"],
    ['2318939340', "Solana Xpert Wallet"]
]);

// --- Expresión Regular ---
const CA_PATTERN = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/;

// --- Base de Datos y Monitoreo ---
const DB_FILE = "memecoins.db";
const MARKET_CAP_THRESHOLD = 5000;  // USD
const CHECK_INTERVAL_HOURS = 24;

// Exportamos todo para usarlo en otros archivos
module.exports = {
    SESSION_STRING,
    API_ID,
    API_HASH,
    BOT_TOKEN,
    NOTIFY_CHAT_ID,
    GENESIS_LOUNGE_ID,
    TRUSTED_USER_IDS,
    MONITORED_CHANNELS,
    CA_PATTERN,
    DB_FILE,
    MARKET_CAP_THRESHOLD,
    CHECK_INTERVAL_HOURS
};
