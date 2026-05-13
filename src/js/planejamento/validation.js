/**
 * Validation logic for the planejamento wizard.
 * Pure functions — receive draft as parameter, return boolean.
 */
export function validateStep(step, draft) {
  if (step === 1) return !!draft.tipo;
  if (step === 2) return draft.disciplinas.length > 0;
  if (step === 3) return true; // sliders always have values
  if (step === 4) {
    const min = parseInt(draft.horarios.sessaoMin, 10) || 0;
    const max = parseInt(draft.horarios.sessaoMax, 10) || 0;
    if (min < 1 || max < min) return false;

    if (draft.tipo === 'ciclo') {
      const hs = parseFloat(draft.horarios.horasSemanais) || 0;
      return hs > 0;
    } else {
      let hasTime = false;
      for (let i = 0; i < 7; i++) {
        const val = draft.horarios.horasPorDia[i];
        if (val && val.trim() !== '' && draft.horarios.diasAtivos.includes(i)) hasTime = true;
      }
      return hasTime && draft.horarios.diasAtivos.length > 0;
    }
  }
  return false;
}
