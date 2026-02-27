import { state, scheduleSave } from './store.js';

// =============================================
// NLP / Inferência de Textos e Fuzzy Match
// =============================================

// Lista de palavras que não agregam peso semântico na comparação
const STOPWORDS = new Set([
    'o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas',
    'de', 'do', 'da', 'dos', 'das',
    'em', 'no', 'na', 'nos', 'nas',
    'por', 'pelo', 'pela', 'pelos', 'pelas',
    'para', 'pro', 'pra', 'com', 'sem',
    'e', 'ou', 'mas', 'porém', 'todavia', 'contudo',
    'que', 'se', 'como', 'quando', 'onde',
    'lei', 'artigo', 'art', 'inciso', 'capítulo', 'título',
    'conceito', 'noções', 'introdução', 'teoria', 'geral', 'parte'
]);

// Normalização pesada: minúsculas, remove acentos, remove pontuação, split em tokens válidos
export function tokenize(text) {
    if (!text) return [];
    const normalized = text.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^\w\s]/gi, ' ') // Remove non-alfanumerico
        .replace(/\s+/g, ' ')
        .trim();

    return normalized.split(' ').filter(word => word.length > 2 && !STOPWORDS.has(word));
}

// Distância de Levenshtein Clássica (para achar typos ou variações mínimas)
function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1, // deletion
                matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }
    return matrix[a.length][b.length];
}

// Retorna similaridade entre 0 e 1 usando Levenshtein
function fuzzySimiliarity(word1, word2) {
    const dist = levenshteinDistance(word1, word2);
    const maxLen = Math.max(word1.length, word2.length);
    if (maxLen === 0) return 1.0;
    return (maxLen - dist) / maxLen;
}

// Compara dois conjuntos de tokens e retorna % de match (0.0 a 1.0)
function computeTokenMatch(tokensA, tokensB) {
    if (tokensA.length === 0 || tokensB.length === 0) return 0;

    let matches = 0;
    // Tenta o Jaccard Similarity (Intersecção sobre União) ajustado com Fuzzy
    for (const ta of tokensA) {
        let bestWordScore = 0;
        for (const tb of tokensB) {
            const sc = fuzzySimiliarity(ta, tb);
            if (sc > bestWordScore) bestWordScore = sc;
        }
        if (bestWordScore > 0.8) { // Considera matching se fuzzy > 80%
            matches++;
        }
    }
    // Penaliza baseado no tamanho do texto base (Assunto do Edital)
    return matches / Math.max(tokensA.length, tokensB.length);
}


// =============================================
// Motor de Busca - Edital vs Ranking
// =============================================

/**
 * Retorna O MELHOR match de um assunto do Edital contra a base da Banca (hotTopics).
 * Retorno: { matchedItem, score: (0..1), confidence: 'HIGH'/'MEDIUM'/'LOW', reason: string }
 */
export function findBestMatch(editalSubjectName, disciplinaId = null) {
    const hotTopics = state.bancaRelevance?.hotTopics || [];
    const userMap = state.bancaRelevance?.userMappings?.[editalSubjectName];

    // 1. OVERRIDE MANUAL: se o usuário já fixou um mapeamento na revisão assistida
    if (userMap) {
        if (userMap === 'NONE') {
            return { matchedItem: null, score: 0.05, confidence: 'HIGH', reason: 'Marcado como sem incidência pelo usuário' };
        }
        const forcedMatch = hotTopics.find(h => h.id === userMap);
        if (forcedMatch) {
            return { matchedItem: forcedMatch, score: 1.0, confidence: 'HIGH', reason: 'Mapeamento Fixado Manualmente' };
        }
    }

    // 2. BUSCA NO HOT TOPICS (Se não há override)
    if (!hotTopics.length) return { matchedItem: null, score: 0.05, confidence: 'LOW', reason: 'Nenhum dado de banca definido' };

    const tokensA = tokenize(editalSubjectName);
    const strA = editalSubjectName.toLowerCase().trim();

    let bestMatch = null;
    let highestScore = 0;
    let bestReason = '';
    let bestConf = 'LOW';

    for (const ht of hotTopics) {
        // Opcional: Filtra por disciplina se a lista tiver `disciplinaId` setado
        if (disciplinaId && ht.disciplinaId && ht.disciplinaId !== disciplinaId) continue;

        const strB = ht.nome.toLowerCase().trim();

        // Match Exato
        if (strA === strB) {
            return { matchedItem: ht, score: 1.0, confidence: 'HIGH', reason: 'Match Exato de Título' };
        }

        // Match de Inclusão (Um contém totalmente o outro)
        if (strA.includes(strB) || strB.includes(strA)) {
            const sc = 0.9;
            if (sc > highestScore) {
                highestScore = sc;
                bestMatch = ht;
                bestReason = 'Contém Nome Parcial';
                bestConf = 'HIGH';
            }
        }

        // Match Parcial & Fuzzy (Tokenização Complexa)
        const tokensB = tokenize(ht.nome);
        const tokenScore = computeTokenMatch(tokensA, tokensB);

        if (tokenScore > highestScore) {
            highestScore = tokenScore;
            bestMatch = ht;
            if (tokenScore > 0.8) {
                bestConf = 'MEDIUM';
                bestReason = 'Termos Altamente Similares (Algoritmo)';
            } else {
                bestConf = 'LOW';
                bestReason = `Plausível Semelhança Textual (${Math.round(tokenScore * 100)}%)`;
            }
        }
    }

    // Se nem o Fuzzy achar algo decente (> 40%), assume que não cai/não bateu
    if (highestScore < 0.4) {
        return { matchedItem: null, score: 0.05, confidence: 'HIGH', reason: 'Sem incidência detectada nas chaves da Banca' };
    }

    return { matchedItem: bestMatch, score: highestScore, confidence: bestConf, reason: bestReason };
}

// =============================================
// Score Final & Engine de Prioridades
// =============================================

export function calculateFinalRelevance(editalSubjectCtx) {
    /*
       editalSubjectCtx = { assuntoNome, disciplinaId, ... }
    */
    const matchStruct = findBestMatch(editalSubjectCtx.assuntoNome, editalSubjectCtx.disciplinaId);
    if (!matchStruct.matchedItem) {
        return { finalScore: 0.0, priority: 'P3', matchData: matchStruct };
    }

    const ht = matchStruct.matchedItem;

    // A. Calcula Incidence (Relevancia Real da Banca) 
    // -> (pode vir como 'rank' numérico ou 'weight' percentual de 0 a 1)
    let incidenceScore = 0;
    if (ht.weight !== undefined) {
        incidenceScore = ht.weight; // já vem de 0 a 100 ou 0 a 1
        if (incidenceScore > 1) incidenceScore = incidenceScore / 100;
    } else if (ht.rank !== undefined) {
        // Rank #1 = peso máximo, decai progressivamente (alpha = 0.7 aprox)
        incidenceScore = 1 / Math.pow(ht.rank, 0.7);
    } else if (ht.level !== undefined) {
        // "Alta" = 1.0 | "Media" = 0.6 | "Baixa" = 0.3
        incidenceScore = ht.level === 'ALTA' ? 1.0 : (ht.level === 'MEDIA' ? 0.6 : 0.3);
    }

    // B. Combina IncidenceScore (A Banca Cobra?) com MatchScore (Quão exato bate a String?)
    // peso do MatchScore é vital, porque se a string bater apenas 50%, a certeza cai pela metade.
    let finalScore = incidenceScore * matchStruct.score;

    // Plus: Context Bonus (+0.1 se for pré-requisito ou alvo ruim)
    // Se o acerto < 60% e o arquivo tem mts erros.. aumenta a prioridade!
    if (editalSubjectCtx.erros / (editalSubjectCtx.acertos + editalSubjectCtx.erros + 1) > 0.6) {
        finalScore += 0.1;
    }

    let priority = 'P3';
    // Limiares default (Top 20% = P1) (P2 = 60-20%) -> Aqui traduzimos de forma semi-arbitrária até ter o dataset completo do Edital 
    if (finalScore >= 0.75) priority = 'P1';
    else if (finalScore >= 0.40) priority = 'P2';

    return {
        finalScore: Math.round(finalScore * 100), // Ex: 85 (score bruto)
        priority,
        matchData: matchStruct
    };
}

// Engine de Macro-Ordenação (Iterador do Edital)
export function applyRankingToEdital(editalId) {
    const edt = state.editais.find(e => e.id === editalId);
    if (!edt) return [];

    let flatList = [];

    // Calcula Score Real Time
    edt.disciplinas.forEach(d => {
        d.assuntos.forEach(a => {
            const result = calculateFinalRelevance({
                assuntoNome: a.nome,
                disciplinaId: d.id,
                acertos: a.acertos || 0,
                erros: a.erros || 0
            });

            flatList.push({
                discId: d.id,
                discNome: d.nome,
                assuntoId: a.id,
                assuntoNome: a.nome,
                ...result
            });
        });
    });

    // Ordena do Maior Score pro Menor
    flatList.sort((a, b) => b.finalScore - a.finalScore);

    // Ajusta o percentil Real do P1 e P2 (Sobrescrevendo a regra semi-arbitrária se possível)
    const len = flatList.length;
    if (len > 0) {
        const top20Index = Math.floor(len * 0.2);
        const top60Index = Math.floor(len * 0.6);

        flatList.forEach((item, index) => {
            if (index <= top20Index) item.priority = 'P1';
            else if (index <= top60Index) item.priority = 'P2';
            else item.priority = 'P3';
        });
    }

    return flatList;
}

// Aceita a Ordem Sugerida e joga pro Array principal (Persistindo no State)
export function commitEditalOrdering(editalId, rankedFlatList) {
    const edt = state.editais.find(e => e.id === editalId);
    if (!edt) return false;

    // Agrupa a FlatList de volta em Disciplinas
    const grouped = {};
    rankedFlatList.forEach(item => {
        if (!grouped[item.discId]) grouped[item.discId] = [];
        grouped[item.discId].push(item);
    });

    // Reorganiza os arrays `assuntos` baseados no Score
    edt.disciplinas.forEach(d => {
        const sortedItemsForDisc = grouped[d.id] || [];
        // Mapeia o array original de assuntos pro ordenado
        const newAssuntosArray = [];
        sortedItemsForDisc.forEach(sItem => {
            const originalAssunto = d.assuntos.find(a => a.id === sItem.assuntoId);
            if (originalAssunto) newAssuntosArray.push(originalAssunto);
        });

        // Se alguma coisa ficou de fora do rank (bug), adere no final pra não excluir dados
        d.assuntos.forEach(a => {
            if (!newAssuntosArray.find(na => na.id === a.id)) newAssuntosArray.push(a);
        });

        d.assuntos = newAssuntosArray;
    });

    scheduleSave();
    return true;
}

// Reverte a marcação de P1/P2/P3 e ordena os Assuntos ao estado neutro de um Edital específico
export function revertEditalOrdering(editalId, disciplinaId) {
    const edt = state.editais.find(e => e.id === editalId);
    if (!edt) return false;

    // Busca a disciplina desejada
    const disc = edt.disciplinas.find(d => d.id === disciplinaId);
    if (!disc) return false;

    // Sort Alfabético para perder a predição herdada (Ordem Default)
    // Retira do DB qualquer tag de simulaçao persistente (se a gente passar a salvar no futuro)
    disc.assuntos.sort((a, b) => a.nome.localeCompare(b.nome));

    scheduleSave();
    return true;
}

