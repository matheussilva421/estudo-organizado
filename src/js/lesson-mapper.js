import { state, scheduleSave } from './store.js?v=8.2';
import { tokenize, computeTokenMatch } from './relevance.js?v=8.2';

// =============================================
// Motor de Link Automático (Aulas -> Assuntos)
// =============================================


// =============================================
// Auto-Link Core Algorithm
// =============================================

function findBestSubjectForLesson(lessonName, editalTopics) {
    // Pre-tokenize lesson name
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
            if (!topic._tokens) topic._tokens = tokenize(topic.nome);
            highestScore = computeTokenMatch(tokensLesson, topic._tokens);
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
