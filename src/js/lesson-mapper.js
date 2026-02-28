import { state, scheduleSave } from './store.js';
import { tokenize } from './relevance.js';

// =============================================
// Motor de Link Automático (Aulas -> Assuntos)
// =============================================

// Distância de Levenshtein Clássica
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
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    return matrix[a.length][b.length];
}

function fuzzySimiliarity(word1, word2) {
    const dist = levenshteinDistance(word1, word2);
    const maxLen = Math.max(word1.length, word2.length);
    if (maxLen === 0) return 1.0;
    return (maxLen - dist) / maxLen;
}

// Compare arrays of tokens to create a Jaccard-like + Fuzzy Matching
function computeTokenMatch(tokensA, tokensB) {
    if (tokensA.length === 0 || tokensB.length === 0) return 0;
    let matches = 0;

    for (const ta of tokensA) {
        let bestWordScore = 0;
        for (const tb of tokensB) {
            const sc = fuzzySimiliarity(ta, tb);
            if (sc > bestWordScore) bestWordScore = sc;
        }
        if (bestWordScore > 0.8) {
            matches++;
        }
    }
    // Penalize primarily by the length of the smaller/target token array
    return matches / Math.min(tokensA.length, tokensB.length);
}

// =============================================
// Auto-Link Core Algorithm
// =============================================

export function findBestSubjectForLesson(lessonName, editalTopics) {
    const tokensLesson = tokenize(lessonName);
    const strLesson = lessonName.toLowerCase().trim();

    let bestMatches = [];

    // Scan all topics in the discipline
    for (const topic of editalTopics) {
        let highestScore = 0;
        const strTopic = topic.nome.toLowerCase().trim();

        // Exact Match
        if (strLesson === strTopic) {
            highestScore = 1.0;
        }
        // Inclusion
        else if (strLesson.includes(strTopic) || strTopic.includes(strLesson)) {
            highestScore = 0.9;
        }
        // Token Fuzzy Matching
        else {
            const tokensTopic = tokenize(topic.nome);
            highestScore = computeTokenMatch(tokensLesson, tokensTopic);
        }

        if (highestScore > 0) {
            bestMatches.push({
                assuntoId: topic.id,
                score: highestScore
            });
        }
    }

    // Sort by descending score
    bestMatches.sort((a, b) => b.score - a.score);
    return bestMatches;
}

// Global Runner that links all unconnected Lessons to Subjects
export function mapAulasToAssuntos(editalId, disciplinaId) {
    const edt = state.editais.find(e => e.id === editalId);
    if (!edt) return 0;
    const disc = edt.disciplinas.find(d => d.id === disciplinaId);
    if (!disc || !disc.aulas || disc.aulas.length === 0) return 0;

    const subjects = disc.assuntos || [];
    if (subjects.length === 0) return 0; // Nothing to link to!

    let linksCreated = 0;

    disc.aulas.forEach(aula => {
        // Only run for unconnected
        if (aula.linkedAssuntoIds && aula.linkedAssuntoIds.length > 0) return;

        const results = findBestSubjectForLesson(aula.nome, subjects);

        // Let's grab combinations > 0.80 (very safe algorithms) or > 0.65 (Sugestions could be mapped, but let's automate everything over 0.70)
        const THRESHOLD = 0.70;
        const matched = results.filter(r => r.score >= THRESHOLD);

        if (matched.length > 0) {
            if (!aula.linkedAssuntoIds) aula.linkedAssuntoIds = [];

            matched.forEach(matchInfo => {
                aula.linkedAssuntoIds.push(matchInfo.assuntoId);

                // Reverse Mapping on the Subject Side
                const subjectRef = subjects.find(s => s.id === matchInfo.assuntoId);
                if (subjectRef) {
                    if (!subjectRef.linkedAulaIds) subjectRef.linkedAulaIds = [];
                    if (!subjectRef.linkedAulaIds.includes(aula.id)) {
                        subjectRef.linkedAulaIds.push(aula.id);
                    }
                }
            });
            linksCreated += matched.length;
        }
    });

    if (linksCreated > 0) scheduleSave();
    return linksCreated;
}
