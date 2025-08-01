// modulos/adminCommands.js

const config = require('../config.js');
const { getSheetData } = require('./googleServices.js');
const { getUptime } = require('./utils.js');
const { lerLeads } = require('./agendador.js'); // Precisamos importar a função de ler leads

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
    
    else if (command === '/leads') {
        await msg.reply('📋 Consultando a lista de interessados (leads)...');
        const leads = lerLeads(); // Carrega os leads do arquivo .json
        const chavesLeads = Object.keys(leads);

        if (!chavesLeads || chavesLeads.length === 0) {
            return await msg.reply("✅ Nenhum lead pendente encontrado no momento.");
        }
        
        let resposta = '🤵 Lista de Interessados (Leads):\n\n';
        chavesLeads.forEach((leadId, index) => {
            const lead = leads[leadId];
            // Extrai o número de telefone do ID
            const numero = leadId.split('@')[0];
            resposta += `${index + 1}. *Nome:* ${lead.nome} - *Tel:* ${numero}\n`;
        });
        
        resposta += `\n*Total de Leads:* ${chavesLeads.length}`;
        await msg.reply(resposta);
    } 
    
    else if (command === '/ajuda') {
        const ajuda = `🤖 *Painel de Ajuda - Admin*\n\nAqui estão os comandos disponíveis:\n
*/status* - Verifica se o bot está online e o tempo de atividade.
*/stats* - Mostra o número total de inscritos na planilha.
*/leads* - Lista todas as pessoas que demonstraram interesse mas ainda não se inscreveram.
*/ajuda* - Mostra esta mensagem de ajuda.`;
        await msg.reply(ajuda);
    } 
    
    else {
        await msg.reply(`Comando de admin "${command}" não reconhecido. Digite */ajuda* para ver a lista de comandos.`);
    }
}

module.exports = { handleAdminCommand };