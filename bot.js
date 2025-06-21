// bot.js
const { TelegramClient, events } = require('gram');
const { StringSession } = require('gram/sessions');
const input = require('input');
const config = require('./config');
const db = require('./database');
const express = require('express'); 

// --- Cliente de Telegram ---
const session = new StringSession(config.SESSION_STRING);
const client = new TelegramClient(session, config.API_ID, config.API_HASH, {
    connectionRetries: 5,
});

// --- FUNCIONES AUXILIARES ---

async function sendNotificationViaBot(messageText) {
    const url = `https://api.telegram.org/bot${config.BOT_TOKEN}/sendMessage`;
    const payload = {
        chat_id: config.NOTIFY_CHAT_ID,
        text: messageText,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json();
            console.error(`Error al enviar notificación vía bot: Status ${response.status}`, errorData);
        }
    } catch (error) {
        console.error(`Error inesperado al enviar notificación vía bot:`, error);
    }
}

async function getDexscreenerData(tokenAddress) {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
    try {
        const response = await fetch(url, { timeout: 10000 });
        if (response.ok) {
            const data = await response.json();
            if (data && data.pairs && data.pairs.length > 0) {
                return data.pairs[0];
            }
        } else {
            console.error(`Error en DexScreener para ${tokenAddress}: Status ${response.status}`);
        }
    } catch (error) {
        console.error(`Excepción en DexScreener para ${tokenAddress}:`, error);
    }
    return null;
}

function formatDexscreenerInfo(dexscreenerData, caAddress) {
    if (!dexscreenerData) {
        return "ℹ️ _No se pudieron obtener datos de DexScreener._";
    }

    const priceUsd = parseFloat(dexscreenerData.priceUsd || '0');
    const liquidityUsd = dexscreenerData.liquidity?.usd || 0;
    const marketCap = dexscreenerData.fdv || 0;
    const volume24h = dexscreenerData.volume?.h24 || 0;
    const priceChange24h = dexscreenerData.priceChange?.h24 || 0;

    let message = `*📊 Datos de DexScreener:*\n`;
    message += `**Precio USD:** \`${priceUsd.toLocaleString('en-US', { minimumFractionDigits: 8, maximumFractionDigits: 8 })}\`\n`;
    message += `**Market Cap (FDV):** \`$${marketCap.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\`\n`;
    message += `**Liquidez:** \`$${liquidityUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\`\n`;
    message += `**Volumen (24h):** \`$${volume24h.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\`\n`;
    message += `**Cambio Precio (24h):** \`${priceChange24h.toFixed(2)}%\`\n\n`;

    message += `*🔗 Enlaces:*\n[DexScreener](${dexscreenerData.url}) | [GMGN](https://gmgn.ai/sol/token/${caAddress})`;

    if (dexscreenerData.info?.websites?.[0]?.url) {
        message += ` | [Website](${dexscreenerData.info.websites[0].url})`;
    }
    if (dexscreenerData.info?.socials) {
        for (const social of dexscreenerData.info.socials) {
            if (social.platform && social.url) {
                const platform = social.platform.charAt(0).toUpperCase() + social.platform.slice(1);
                message += ` | [${platform}](${social.url})`;
            }
        }
    }
    return message.trim();
}

function formatGenesisNotification(ca, sender, dexscreenerData, existingMentions) {
    const senderName = sender.username ? `@${sender.username}` : sender.firstName;
    let message = `🚨 *Alerta de CA en GeNeSiS Lounge* 🚨\n\n`;
    message += `👤 *Compartido por:* **${senderName}**\n`;
    message += `**Contrato (CA):** \`${ca}\`\n\n`;
    message += `*📜 Historial en otros canales:*\n`;

    if (existingMentions.length > 1) { // >1 porque ya incluimos la actual
        const uniqueChannels = [...new Set(existingMentions.map(m => m.channel_name))];
        message += `❗️ Este CA *ya ha sido mencionado* ${existingMentions.length} veces en ${uniqueChannels.length} canales.\n`;
        message += `**Canales:** \`${uniqueChannels.join('`, `')}\`\n\n`;
    } else {
        message += `✅ ¡Este CA parece ser *nuevo*! No se encontraron menciones previas.\n\n`;
    }
    message += formatDexscreenerInfo(dexscreenerData, ca);
    return message;
}

function formatStandardNotification(ca, tokenData, reason, totalMentions, channelList, dexscreenerData, genesisInfo) {
    const symbol = tokenData.symbol || `Token(${ca.slice(0, 5)}..)`;
    const name = tokenData.name || 'N/A';

    let message = `🚨 *Alerta de Memecoin: ${symbol} (${name})* 🚨\n\n`;
    message += `**Motivo:** ${reason}\n`;
    message += `**Menciones Totales:** ${totalMentions} en ${channelList.length} canales distintos.\n`;
    message += `**Canales:** \`${channelList.join('`, `')}\`\n`;
    message += `**Contrato (CA):** \`${ca}\`\n\n`;

    if (genesisInfo) {
        message += `💡 *Dato Adicional:* Este CA fue compartido en GeNeSiS Lounge por **${genesisInfo}**.\n\n`;
    }
    message += formatDexscreenerInfo(dexscreenerData, ca);
    return message.trim();
}

async function findCaInMessageChain(message) {
    let currentMsg = message;
    for (let i = 0; i < 5; i++) {
        if (!currentMsg) break;
        if (currentMsg.text) {
            const caMatch = currentMsg.text.match(config.CA_PATTERN);
            if (caMatch) return caMatch[0];
        }
        if (currentMsg.isReply) {
            currentMsg = await currentMsg.getReplyMessage();
        } else {
            break;
        }
    }
    return null;
}

// --- MANEJADOR DE EVENTOS ---

async function newMessageHandler(event) {
    const message = event.message;
    if (message.fwdFrom) return;

    // GramJS usa BigInt para los IDs. Lo convertimos a string para manejarlo fácilmente.
    const chatId = message.chatId.toString().replace('-100', '');
    const channelName = config.MONITORED_CHANNELS.get(chatId) || `ID:${chatId}`;
    
    const ca = await findCaInMessageChain(message);
    if (!ca) return;

    console.log(`CA Detectado: ${ca} (en '${channelName}')`);
    
    const memecoinData = await db.getMemecoinFromDb(ca);
    
    // --- Lógica para GeNeSiS Lounge ---
    if (chatId === config.GENESIS_LOUNGE_ID) {
        const sender = await message.getSender();
        const senderId = sender.id.toString();
        
        if (!sender || !config.TRUSTED_USER_IDS.has(senderId)) {
            console.log(`CA en GeNeSiS ignorado (autor no confiable). ID: ${senderId}`);
            return;
        }

        const senderName = sender.username ? `@${sender.username}` : sender.firstName;
        console.log(`¡ALERTA! CA de usuario de confianza (${senderName}) en GeNeSiS Lounge.`);

        await db.addMentionToDb(ca, chatId, channelName);
        const existingMentions = await db.getMentionsFromDb(ca);

        if (!memecoinData) {
            const dexData = await getDexscreenerData(ca);
            if (dexData?.baseToken) {
                await db.addMemecoinToDb(ca, dexData.baseToken.symbol, dexData.baseToken.name);
            }
        }

        await db.updateGenesisMentionInDb(ca, senderName);
        const dexscreenerData = await getDexscreenerData(ca);
        const notification = formatGenesisNotification(ca, sender, dexscreenerData, existingMentions);
        await sendNotificationViaBot(notification);
        return;
    }

    // --- Lógica para Canales Estándar ---
    await db.addMentionToDb(ca, chatId, channelName);
    const allMentionsRows = await db.getMentionsFromDb(ca);
    const totalMentions = allMentionsRows.length;
    const uniqueChannels = [...new Set(allMentionsRows.map(m => m.channel_name))];

    if (!memecoinData) {
        const dexData = await getDexscreenerData(ca);
        if (!dexData?.baseToken) {
            console.warn(`No se encontraron datos en DexScreener para el nuevo CA: ${ca}. Se ignora la notificación.`);
            return;
        }
        await db.addMemecoinToDb(ca, dexData.baseToken.symbol, dexData.baseToken.name);
        console.log(`Primera mención de ${ca} (${dexData.baseToken.symbol}). Almacenado en DB.`);
    }

    if (totalMentions >= 3) {
        const reason = `Alcanzó la **${totalMentions}ª mención** (en ${uniqueChannels.length} canales distintos).`;
        console.log(`¡ALERTA! Razón: ${reason} para CA: ${ca}`);
        
        const dexscreenerData = await getDexscreenerData(ca);
        const updatedMemecoinData = await db.getMemecoinFromDb(ca);

        const messageToSend = formatStandardNotification(
            ca,
            updatedMemecoinData,
            reason,
            totalMentions,
            uniqueChannels,
            dexscreenerData,
            updatedMemecoinData.genesis_mention_by
        );
        await sendNotificationViaBot(messageToSend);
    } else {
        console.log(`CA ${ca} mencionado ${totalMentions} veces. Se requiere la 3ª mención para notificar.`);
    }
}

// --- MANEJADORES DE COMANDOS ---

async function statsHandler(event) {
    const allCoins = await db.getAllMemecoinCas(); // Easiest way to get total
    // A more efficient way would be a dedicated DB count function
    const message = `📊 *Estadísticas del Bot*\n\n` +
                    `🪙 *Memecoins únicos monitoreados:* \`${allCoins.length}\``;
    await event.reply(message);
}

async function deleteHandler(event) {
    const caToDelete = event.patternMatch[1].trim();
    if (!config.CA_PATTERN.test(caToDelete)) {
        await event.reply("❌ El formato del Contrato (CA) no parece válido.");
        return;
    }

    const deleted = await db.deleteMemecoinFromDb(caToDelete);
    if (deleted) {
        const message = `✅ Se eliminó el CA \`${caToDelete}\` y todas sus menciones de la base de datos.`;
        console.log(message);
        await event.reply(message);
    } else {
        await event.reply(`🤷‍♂️ No se encontró el CA \`${caToDelete}\` en la base de datos.`);
    }
}


// --- TAREA EN SEGUNDO PLANO ---

async function marketCapMonitor() {
    while (true) {
        try {
            console.log(`Iniciando verificación de market cap (cada ${config.CHECK_INTERVAL_HOURS} horas)...`);
            const memecoinsToCheck = await db.getAllMemecoinCas();
            let deletedCount = 0;

            for (const { ca_address, symbol, name } of memecoinsToCheck) {
                const dexData = await getDexscreenerData(ca_address);
                if (dexData) {
                    const marketCap = dexData.fdv || 0;
                    if (marketCap > 0 && marketCap < config.MARKET_CAP_THRESHOLD) {
                        const deleted = await db.deleteMemecoinFromDb(ca_address);
                        if (deleted) {
                            deletedCount++;
                            console.log(`📉 Memecoin eliminado: ${symbol} (${name}) con CA \`${ca_address}\`. Market Cap ($${marketCap.toLocaleString()}) por debajo de $${config.MARKET_CAP_THRESHOLD.toLocaleString()}.`);
                        }
                    }
                } else {
                    console.warn(`No se pudieron obtener datos de DexScreener para CA \`${ca_address}\` durante el monitoreo. Se mantendrá.`);
                }
                 // Pequeña pausa para no sobrecargar la API de DexScreener
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            console.log(`Monitoreo de Market Cap completado. Se eliminaron ${deletedCount} memecoins.`);

        } catch (error) {
            console.error("Error en el monitor de Market Cap:", error);
        }
        // Esperar el intervalo
        await new Promise(resolve => setTimeout(resolve, config.CHECK_INTERVAL_HOURS * 3600 * 1000));
    }
}


// --- FUNCIÓN PRINCIPAL ---

async function main() {
    await db.initDb();

    // Convertimos las claves del Map a un array de BigInts para GramJS
    const channelIds = Array.from(config.MONITORED_CHANNELS.keys()).map(id => BigInt(id));
    
    // Configurar manejadores de eventos
    client.addEventHandler(newMessageHandler, new events.NewMessage({ chats: channelIds }));
    client.addEventHandler(statsHandler, new events.NewMessage({ fromUsers: [config.NOTIFY_CHAT_ID], pattern: /^\/stats/ }));
    client.addEventHandler(deleteHandler, new events.NewMessage({ fromUsers: [config.NOTIFY_CHAT_ID], pattern: /^\/eliminar (.+)/ }));

    await client.start({
        phoneNumber: async () => await input.text('Por favor, introduce tu número de teléfono: '),
        password: async () => await input.text('Por favor, introduce tu contraseña de 2FA: '),
        phoneCode: async () => await input.text('Por favor, introduce el código que recibiste: '),
        onError: (err) => console.log(err),
    });

    console.log('¡Cliente de Telegram conectado!');
    if (!config.SESSION_STRING) {
        console.log('\n--- SESSION STRING ---');
        console.log('Copia la siguiente línea y pégala en la variable SESSION_STRING en config.js');
        console.log(client.session.save());
        console.log('----------------------\n');
    }
    
    // Iniciar tarea en segundo plano
    marketCapMonitor();

    console.log("Bot iniciado con persistencia de datos (SQLite).");
    console.log(`Monitoreando ${config.MONITORED_CHANNELS.size} canales/grupos.`);
    console.log(`Los comandos /stats y /eliminar están activos para el usuario ${config.NOTIFY_CHAT_ID}.`);
    console.log("El bot ahora notificará a partir de la 3ª mención de un CA.");
    console.log(`El monitor de Market Cap se ejecutará cada ${config.CHECK_INTERVAL_HOURS} horas y eliminará CAs con MC < $${config.MARKET_CAP_THRESHOLD}.`);
}

const app = express();
const port = process.env.PORT || 10000; // Render necesita que uses el puerto que te asigna

app.get('/', (req, res) => {
  res.send('El bot está vivo y escuchando!');
});

app.listen(port, () => {
  console.log(`Servidor web escuchando en el puerto ${port} para mantener el bot activo.`);
  // Solo después de que el servidor web esté listo, iniciamos el bot.
  main().catch(err => {
    console.error("Error fatal en el bot:", err);
  });
});

main().catch(err => {
    console.error("Error fatal en el bot:", err);
});
