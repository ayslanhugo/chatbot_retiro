// modulos/utils.js

const stringSimilarity = require('string-similarity');

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
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Compara um texto com uma lista de palavras-chave de forma inteligente.
 * @param {string} texto - O texto do usuário.
 * @param {Array<string>} chaves - A lista de palavras-chave.
 * @returns {boolean} - Verdadeiro se houver uma correspondência.
 */
function smartMatch(texto, chaves) {
    const textoNormalizado = normalizeText(texto);
    if (!chaves || chaves.length === 0) return false;
    if (chaves.some(chave => textoNormalizado === normalizeText(chave))) return true;
    if (chaves.some(chave => normalizeText(chave).length >= 3 && textoNormalizado.includes(normalizeText(chave)))) return true;
    const palavrasDoTexto = textoNormalizado.split(' ');
    const SIMILARITY_THRESHOLD = 0.80;
    for (let palavra of palavrasDoTexto) {
        palavra = palavra.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
        if (palavra.length < 4) continue;
        for (const chave of chaves) {
            if (chave.includes(' ')) continue;
            const chaveNormalizada = normalizeText(chave);
            if (stringSimilarity.compareTwoStrings(palavra, chaveNormalizada) >= SIMILARITY_THRESHOLD) return true;
        }
    }
    return false;
}

module.exports = {
    normalizarTelefoneBrasil,
    respostaAleatoria,
    normalizeText,
    smartMatch
};