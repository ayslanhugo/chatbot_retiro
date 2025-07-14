// index.test.js

// Importamos a função que queremos testar.
// NOTA: Precisamos de exportar a função smartMatch do index.js para que isto funcione.
// (Vou mostrar como fazer isso a seguir)
const { smartMatch, normalizeText } = require('./index.js');

// O 'describe' agrupa testes relacionados. É como um capítulo do nosso livro de testes.
describe('Função smartMatch', () => {

    // O 'it' ou 'test' descreve um cenário específico que estamos a testar.
    it('deve retornar true para uma correspondência exata', () => {
        const texto = 'Qual o valor?';
        const chaves = ['data', 'local', 'valor'];
        // 'expect' é a nossa asserção. Estamos à espera que o resultado de smartMatch seja 'true'.
        expect(smartMatch(texto, chaves)).toBe(true);
    });

    it('deve retornar true para uma correspondência por inclusão', () => {
        const texto = 'gostaria de saber o valor da inscrição';
        const chaves = ['data', 'local', 'valor'];
        expect(smartMatch(texto, chaves)).toBe(true);
    });

    it('deve retornar true para palavras com erros de ortografia (similaridade)', () => {
        const texto = 'qual o valorr?'; // "valorr" em vez de "valor"
        const chaves = ['data', 'local', 'valor'];
        expect(smartMatch(texto, chaves)).toBe(true);
    });

    it('deve retornar false quando não há correspondência', () => {
        const texto = 'fala sobre os passarinhos';
        const chaves = ['data', 'local', 'valor'];
        expect(smartMatch(texto, chaves)).toBe(false);
    });

    it('deve ignorar acentos e letras maiúsculas', () => {
        const texto = 'Qual a sua IDADE?';
        const chaves = ['data', 'local', 'idade'];
        expect(smartMatch(texto, chaves)).toBe(true);
    });
});


// Podemos também testar a nossa outra função auxiliar
describe('Função normalizeText', () => {
    it('deve remover acentos e converter para minúsculas', () => {
        const texto = 'Olá, Coração! BÊNÇÃO';
        const resultadoEsperado = 'ola, coracao! bencao';
        expect(normalizeText(texto)).toBe(resultadoEsperado);
    });
});