import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason
} from "@whiskeysockets/baileys";

import pino from "pino";
import qrcode from "qrcode-terminal";

async function iniciarBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./sessao");

    console.log("🔥 Iniciando FWCK NUKE...");

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: "silent" })
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {

        if (qr) {
            console.log("\n📱 ESCANEIE O QR CODE:\n");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "connecting") {
            console.log("🔄 Conectando ao WhatsApp...");
        }

        if (connection === "open") {
            console.log("\n🔥 FWCK NUKE ONLINE!");
            console.log("📱 Número:", sock.user?.id);
        }

        if (connection === "close") {
            const motivo = lastDisconnect?.error?.output?.statusCode;

            if (motivo !== DisconnectReason.loggedOut) {
                console.log("🔄 Reconectando...");
                iniciarBot();
            } else {
                console.log("❌ Sessão desconectada.");
            }
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message) continue;

            const jid = msg.key.remoteJid;
            if (!jid?.endsWith("@g.us")) continue;

            const texto =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text ||
                "";

            // BLOQUEIO GLOBAL: somente o numero conectado ao bot executa comandos
            if (!msg.key.fromMe) continue;


            if (texto.trim().toLowerCase() === ".menu") {
                await sock.sendMessage(jid, {
                    text: "╭━━〔 FWCK NUKE 〕━━╮\n┃💀.nuke\n╰━━━━━━━━━━━━╯\n🔥 FWCK é os mano!"
                });
                continue;
            }

            if (texto.trim().toLowerCase() !== ".nuke") continue;

            const numeroBot = sock.user?.id?.split(":")[0];
            const autor = msg.key.fromMe
                ? numeroBot
                : msg.key.participant?.split(":")[0]?.split("@")[0];

            // Apenas o próprio número conectado executa o comando
            if (!numeroBot || autor !== numeroBot) continue;

            try {
                const metadata = await sock.groupMetadata(jid);
                const normalizar = valor =>
                    String(valor || "").split(":")[0].split("@")[0].replace(/\D/g, "");

                const identificadoresBot = [
                    sock.user?.id,
                    sock.user?.lid,
                    sock.user?.phoneNumber
                ].map(normalizar).filter(Boolean);

                const bot = metadata.participants.find(p =>
                    [p.id, p.phoneNumber, p.lid].some(
                        id => identificadoresBot.includes(normalizar(id))
                    )
                );

                if (!bot) {
                    console.log("Não encontrei o bot na lista de participantes.");
                    console.log("Identificadores do bot:", identificadoresBot);
                    console.log("Participantes:", metadata.participants);
                    continue;
                }

                if (bot.admin !== "admin" && bot.admin !== "superadmin") {
                    console.log("Bot encontrado, mas sem permissão de administrador.");
                    console.log("Dados do bot:", bot);
                    continue;
                }

                console.log("Administrador confirmado:", bot.id);

                // 1. Troca o nome do grupo
                await sock.groupUpdateSubject(
                    jid,
                    "By FWCK e os mano"
                );

                // 2. Manda a mensagem assim que inicia
                await sock.sendMessage(jid, {
                    text: "By s.fwck\nBy c.fwck\nBy n.fwck\n\nFWCK é os mano!"
                });

                // 3. Filtra todos os participantes (exceto o bot e o criador/superadmin)
                const criadorNormalizado = normalizar(metadata.owner);
                const alvos = metadata.participants
                    .filter(p => {
                        const ehBot = [p.id, p.phoneNumber, p.lid].some(
                            id => identificadoresBot.includes(normalizar(id))
                        );
                        const ehCriador =
                            p.admin === "superadmin" ||
                            (criadorNormalizado &&
                                [p.id, p.phoneNumber, p.lid].some(
                                    id => normalizar(id) === criadorNormalizado
                                ));

                        return !ehBot && !ehCriador;
                    })
                    .map(p => p.id);

                // 4. Remove todos os alvos em lotes
                if (alvos.length > 0) {
                    for (let i = 0; i < alvos.length; i += 20) {
                        const lote = alvos.slice(i, i + 20);
                        await sock.groupParticipantsUpdate(jid, lote, "remove");
                    }
                }

                console.log(`NUKE finalizado: nome atualizado e ${alvos.length} participantes removidos.`);

            } catch (erro) {
                console.error("Erro no comando .nuke:", erro);
            }
        }
    });

}

iniciarBot().catch(console.error);
