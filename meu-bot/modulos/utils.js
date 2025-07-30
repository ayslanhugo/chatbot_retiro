// modulos/utils.js (Versão Atualizada)

const stringSimilarity = require('string-similarity');

// A constante botStartTime foi movida para cá
const botStartTime = Date.now();

// A função getUptime foi movida para cá
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

/**
 * Corrige números de telemóvel do Brasil que não têm o nono dígito.
 * @param {string} numero - O número de telefone a ser verificado.
 * @returns {string} - O número de telefone corrigido ou o original.
 */
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

/**
 * Seleciona uma resposta aleatória de uma lista.
 * @param {Array<string>|string} respostas - A lista de respostas ou uma única resposta.
 * @returns {string} - Uma única resposta.
 */
function respostaAleatoria(respostas) {
    if (Array.isArray(respostas)) return respostas[Math.floor(Math.random() * respostas.length)];
    return respostas;
}

/**
 * Normaliza um texto: converte para minúsculas e remove acentos.
 * @param {string} text - O texto a ser normalizado.
 * @returns {string} - O texto normalizado.
 */
function normalizeText(text) {
    if (!text) return '';
    return text.normalize("NFD").replace(/[\u300-\u336f]/g, "").toLowerCase();
}

/**
 * Compara um texto com uma lista de palavras-chave de forma inteligente.
 * @param {string} texto - O texto do usuário.
 * @param {Array<string>} chaves - A lista de palavras-chave.
 * @returns {boolean} - Verdadeiro se houver uma correspondência.
 */
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

    // Teste 1: Correspondência Exata
    const teste1 = chaves.some(chave => textoNormalizado === normalizeText(chave));
    console.log(`- Teste 1 (Correspondência Exata): ${teste1}`);
    if (teste1) {
        console.log(`Resultado FINAL: true (encontrado no Teste 1)`);
        console.log(`--------------------------\n`);
        return true;
    }

    // Teste 2: Inclusão de Substring
    const teste2 = chaves.some(chave => normalizeText(chave).length >= 3 && textoNormalizado.includes(normalizeText(chave)));
    console.log(`- Teste 2 (Inclusão de Substring): ${teste2}`);
    if (teste2) {
        console.log(`Resultado FINAL: true (encontrado no Teste 2)`);
        console.log(`--------------------------\n`);
        return true;
    }
    
    // Teste 3: Similaridade (ignorada para textos curtos como "1" ou "2")
    console.log(`- Teste 3 (Similaridade): Ignorado para textos curtos.`);

    console.log(`Resultado FINAL: false`);
    console.log(`--------------------------\n`);
    return false;
}

// Exportamos as novas funções também
module.exports = {
    botStartTime,
    getUptime,
    normalizarTelefoneBrasil,
    respostaAleatoria,
    normalizeText,
    smartMatch
};