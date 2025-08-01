// modulos/adminCommands.js

const { MessageMedia } = require('whatsapp-web.js');
const config = require('../config.js');
const { getSheetData, getInscritos } = require('./googleServices.js');const { getUptime, respostaAleatoria } = require('./utils.js');

async function handleAdminCommand(command, msg, client) {
    if (command === '/status') {
        await msg.reply(`🤖 Olá, admin! Estou online e funcionando.\n*Tempo de atividade:* ${getUptime()}.`);
    } 
    
    else if (command === '/stats') {
        await msg.reply('📊 Consultando as estatísticas... um momento.');
        const data = await getSheetData();
        const totalInscritos = data ? (data.length > 1 ? data.length - 1 : 0) : 'N/A'; 
        await msg.reply(`*Total de inscritos na planilha:* ${totalInscritos}`);
    } 
    
    else if (command === '/convidar-grupo') {
        const groupId = config.GRUPOS_DIVULGACAO_IDS[0];
        if (!groupId) {
            return await msg.reply("❌ Nenhum grupo de divulgação foi configurado.");
        }

        await msg.reply(`🚀 Comando recebido! A cruzar a lista de membros do grupo com a de inscritos. A iniciar o envio de convites individuais. Este processo pode demorar BASTANTE tempo.`);
        
        const mensagensConvite = [
            `Paz e bem! 🙏 Sou o assistente virtual do Retiro Kerigmático do JCC.\n\nVi que você está no nosso grupo do whatsapp e queria convidá-lo(a) pessoalmente para esta experiência de fé incrível! Se tiver alguma dúvida, é só me perguntar por aqui.`,
            `Oi, tudo na paz? 😊 Meu nome é JCC-Bot e estou ajudando na organização do nosso Retiro. Notei a sua presença no grupo de avisos e queria deixar um convite especial para ti! Dê uma olhada na nossa arte. ✨`,
            `E aí! ✨ Aqui é o assistente virtual do JCC. Como você está no nosso grupo, acredito que tenha interesse no nosso retiro. Queria partilhar a arte do retiro contigo e dizer que estamos à sua espera!`,
        ];

        try {
            // --- NOVA LÓGICA DE VERIFICAÇÃO ---
            // 1. Busca a lista de quem JÁ SE INSCEVEU na planilha
            const inscritos = await getInscritos();
            if (!inscritos) {
                return await msg.reply("❌ Não foi possível ler a lista de inscritos da planilha. A abortar o comando.");
            }
            // Cria uma lista de verificação rápida com os números dos inscritos
            const numerosInscritos = new Set(inscritos.map(i => i.numero));
            // --- FIM DA NOVA LÓGICA ---

            const media = MessageMedia.fromFilePath('./arte-retiro.jpeg');
            const groupChat = await client.getChatById(groupId);
            const allParticipants = groupChat.participants;

            // 2. Filtro ATUALIZADO: agora também remove quem já se inscreveu
            const participantsToMessage = allParticipants.filter(p => 
                !p.isAdmin && 
                !p.isSuperAdmin && 
                p.id._serialized !== client.info.wid._serialized &&
                !numerosInscritos.has(p.id._serialized) // <-- NOVA REGRA!
            );

            console.log(`[CONVITE EM MASSA] Total de ${participantsToMessage.length} participantes para contactar (já excluindo admins e inscritos).`);
            
            for (const participant of participantsToMessage) {
                const mensagemAleatoria = respostaAleatoria(mensagensConvite);
                await client.sendMessage(participant.id._serialized, media, { caption: mensagemAleatoria });
                console.log(`- Convite com arte enviado para ${participant.id._serialized}`);
                await new Promise(resolve => setTimeout(resolve, Math.random() * 30000 + 20000));
            }

            await client.sendMessage(msg.from, `✅ Envio de convites individuais concluído! ${participantsToMessage.length} pessoas foram contactadas.`);
        } catch (e) {
            console.error("[CONVITE EM MASSA] Erro:", e.message);
            await msg.reply("❌ Ocorreu um erro ao executar o comando. Verifique se o ID do grupo está correto e se a imagem 'arte-retiro.png' existe.");
        }
    } 
    
    else {
        await msg.reply(`Comando de admin "${command}" não reconhecido.`);
    }
}

module.exports = { handleAdminCommand };