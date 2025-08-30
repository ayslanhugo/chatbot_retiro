// modulos/utils.js (Versão Corrigida)

const stringSimilarity = require('string-similarity');
const fs = require('fs');

const botStartTime = Date.now();

function formatarNumeroParaEnvio(numero) {
    if (!numero) return null;

    // 1. Limpa tudo que não for número
    let numLimpo = String(numero).replace(/[^0-9]/g, '');

    // 2. Garante que começa com 55 (código do Brasil)
    if (numLimpo.length >= 10 && !numLimpo.startsWith('55')) {
        numLimpo = '55' + numLimpo;
    }

    // Se não tiver código de país ou for curto demais, retorna o que tem.
    if (!numLimpo.startsWith('55') || numLimpo.length < 12) {
        return numLimpo;
    }

    // 3. Isola o número após o '55'
    const ddd = numLimpo.substring(2, 4);
    let corpoNumero = numLimpo.substring(4);

    // 4. Se o corpo do número tem 9 dígitos e o primeiro é '9', removemos ele.
    if (corpoNumero.length === 9 && corpoNumero.startsWith('9')) {
        corpoNumero = corpoNumero.substring(1); // Pega a partir do segundo caractere
        const numeroCorrigido = `55${ddd}${corpoNumero}`;
        console.log(`[FORMATADOR] Número ${numLimpo} ajustado para ${numeroCorrigido} (removido o 9)`);
        return numeroCorrigido;
    }

    // Retorna o número limpo se nenhuma regra se aplicou
    return numLimpo;
}

function getUptime() {
    const uptimeSeconds = Math.floor((Date.now() - botStartTime) / 1000);
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    let uptimeString = '';
    if (days > 0) uptimeString += `${days}d `;
    if (hours > 0) uptimeString += `${hours}h `;
    if (minutes > 0) uptimeString += `${minutes}m`;
    return uptimeString.trim() || 'menos de um minuto';
}

function normalizarTelefoneBrasil(numero) {
    let numLimpo = String(numero).replace(/[^0-9]/g, '');
    if (!numLimpo.startsWith('55')) {
        return numLimpo;
    }
    const ddd = numLimpo.substring(2, 4);
    const corpoNumero = numLimpo.substring(4);
    if (corpoNumero.length === 8) {
        const numeroCorrigido = `55${ddd}9${corpoNumero}`;
        console.log(`[NORMALIZADOR] Número ${numLimpo} corrigido para ${numeroCorrigido}`);
        return numeroCorrigido;
    }
    return numLimpo;
}

function respostaAleatoria(respostas) {
    if (Array.isArray(respostas)) return respostas[Math.floor(Math.random() * respostas.length)];
    return respostas;
}

function normalizeText(text) {
    if (!text) return '';
    return text.normalize("NFD").replace(/[\u300-\u336f]/g, "").toLowerCase();
}

function smartMatch(texto, chaves) {
    console.log(`\n--- [DEBUG smartMatch] ---`);
    console.log(`Texto de entrada: "${texto}"`);
    console.log(`Chaves de entrada: [${chaves.join(', ')}]`);

    const textoNormalizado = normalizeText(texto);
    if (!chaves || chaves.length === 0) {
        console.log(`Resultado: false (sem chaves)`);
        console.log(`--------------------------\n`);
        return false;
    }

    const teste1 = chaves.some(chave => textoNormalizado === normalizeText(chave));
    console.log(`- Teste 1 (Correspondência Exata): ${teste1}`);
    if (teste1) {
        console.log(`Resultado FINAL: true (encontrado no Teste 1)`);
        console.log(`--------------------------\n`);
        return true;
    }

    const teste2 = chaves.some(chave => normalizeText(chave).length >= 3 && textoNormalizado.includes(normalizeText(chave)));
    console.log(`- Teste 2 (Inclusão de Substring): ${teste2}`);
    if (teste2) {
        console.log(`Resultado FINAL: true (encontrado no Teste 2)`);
        console.log(`--------------------------\n`);
        return true;
    }
    
    console.log(`- Teste 3 (Similaridade): Ignorado para textos curtos.`);
    console.log(`Resultado FINAL: false`);
    console.log(`--------------------------\n`);
    return false;
}

// ----- FUNÇÕES MOVIDAS PARA O LOCAL CORRETO -----
function lerLeads() {
    try {
        // Corrigi o caminho para ser relativo à raiz do projeto onde o bot corre
        if (fs.existsSync('./leads.json')) {
            const data = fs.readFileSync('./leads.json', 'utf-8');
            return data.trim() ? JSON.parse(data) : {};
        }
    } catch (error) { console.error('Erro ao ler o arquivo de leads:', error); }
    return {};
}

function salvarLeads(leads) {
    try {
        // Corrigi o caminho também
        fs.writeFileSync('./leads.json', JSON.stringify(leads, null, 2));
    } catch (error) { console.error('Erro ao salvar o arquivo de leads:', error); }
}
// --------------------------------------------------

module.exports = {
    botStartTime,
    getUptime,
    formatarNumeroParaEnvio,
    respostaAleatoria,
    normalizeText,
    smartMatch,
    lerLeads, 
    salvarLeads     
};