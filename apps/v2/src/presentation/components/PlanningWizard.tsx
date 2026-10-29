import { useEffect, useState } from 'react';
import type { PlanGenerationPreview } from '../../domain/planning-generator';
import type { EditalDiscipline } from '../../domain/edital';
import type { Assunto } from '../../domain/content';

export type WizardInput = {
  name: string;
  kind: 'CYCLE' | 'FINAL_STRETCH';
  examDate: string | null;
  editalId: string;
  startDate: string;
  horizonDays: number;
  selectedLinks: { editalDisciplineId: string; assuntoId?: string; label?: string; plannedMinutes: number }[];
};

type Props = {
  editais: { id: string; title: string }[];
  links: EditalDiscipline[];
  assuntos: Assunto[];
  onPreview: (input: WizardInput) => PlanGenerationPreview | { error: string };
  onConfirm: (input: WizardInput) => Promise<boolean>;
  locked: boolean;
};

export function PlanningWizard({ editais, links, assuntos, onPreview, onConfirm, locked }: Props) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'CYCLE' | 'FINAL_STRETCH'>('CYCLE');
  const [examDate, setExamDate] = useState('');
  const [editalId, setEditalId] = useState(editais[0]?.id ?? '');
  const [startDate, setStartDate] = useState('2027-01-04');
  const [horizonDays, setHorizonDays] = useState(14);
  const [minutes, setMinutes] = useState(60);
  const [linkId, setLinkId] = useState(links[0]?.id ?? '');
  const [selectedLinkIds, setSelectedLinkIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<PlanGenerationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const storageKey = 'v2:f3:wizard';

  // Content arrives after mount (F2 snapshot), so the effective selection must
  // fall back to the first available option instead of a stale empty string.
  const activeEditalId = editalId || editais[0]?.id || '';
  // Disciplines are always scoped to the selected edital.
  const editalLinks = links.filter((item) => item.editalId === activeEditalId);
  const activeLinkId = linkId || editalLinks[0]?.id || '';
  const effectiveSelection = (
    selectedLinkIds.length > 0 ? selectedLinkIds : activeLinkId ? [activeLinkId] : []
  ).filter((id) => editalLinks.some((item) => item.id === id));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as Record<string, unknown>;
      // Restoring the persisted wizard is the whole point of this effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(typeof saved.name === 'string' ? saved.name : '');
      setKind(saved.kind === 'FINAL_STRETCH' ? 'FINAL_STRETCH' : 'CYCLE');
      setExamDate(typeof saved.examDate === 'string' ? saved.examDate : '');
      setEditalId(typeof saved.editalId === 'string' ? saved.editalId : '');
      setStartDate(typeof saved.startDate === 'string' ? saved.startDate : '2027-01-04');
      setHorizonDays(typeof saved.horizonDays === 'number' ? saved.horizonDays : 14);
      setMinutes(typeof saved.minutes === 'number' ? saved.minutes : 60);
      setSelectedLinkIds(Array.isArray(saved.selectedLinkIds) ? (saved.selectedLinkIds as string[]) : []);
    } catch {
      // A corrupted local draft is ignored; the wizard starts clean.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          name,
          kind,
          examDate,
          editalId,
          startDate,
          horizonDays,
          minutes,
          selectedLinkIds,
        }),
      );
    } catch {
      // Storage may be unavailable; the wizard keeps working in memory.
    }
  }, [name, kind, examDate, editalId, startDate, horizonDays, minutes, selectedLinkIds]);

  function buildInput(): WizardInput {
    return {
      name: name.trim() || 'Plano',
      kind,
      examDate: examDate || null,
      editalId: activeEditalId,
      startDate,
      horizonDays,
      selectedLinks: effectiveSelection.map((id) => {
        const assunto = assuntos.find((item) => item.editalDisciplineId === id);
        return {
          editalDisciplineId: id,
          assuntoId: assunto?.id,
          label: assunto?.title ?? 'Conteúdo',
          plannedMinutes: minutes,
        };
      }),
    };
  }

  const step = preview ? 2 : 1;

  return (
    <section className="panel" aria-labelledby="wizard-title" data-testid="planning-wizard">
      <h2 id="wizard-title">Wizard determinístico</h2>
      <p className="planning-step" data-step={step}>Etapa {step} de 2</p>
      <div className="planning-form">
        <label>
          Nome
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Tipo
          <select value={kind} onChange={(event) => setKind(event.target.value as 'CYCLE' | 'FINAL_STRETCH')}>
            <option value="CYCLE">Ciclo (sem prova)</option>
            <option value="FINAL_STRETCH">Reta Final (com prova)</option>
          </select>
        </label>
        {kind === 'FINAL_STRETCH' ? (
          <label>
            Data da prova
            <input type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} />
          </label>
        ) : null}
        <label>
          Edital
          <select
            aria-label="Edital do planejamento"
            value={activeEditalId}
            onChange={(event) => setEditalId(event.target.value)}
          >
            {editais.map((edital) => (
              <option key={edital.id} value={edital.id}>{edital.title}</option>
            ))}
          </select>
        </label>
        <fieldset className="planning-disciplines">
          <legend>Disciplinas deste edital</legend>
          {editalLinks.length === 0 ? (
            <p className="empty-state">Vincule uma disciplina a este edital primeiro.</p>
          ) : (
            editalLinks.map((link) => (
              <label key={link.id}>
                <input
                  type="checkbox"
                  value={link.id}
                  checked={effectiveSelection.includes(link.id)}
                  onChange={(event) => {
                    setLinkId(link.id);
                    setSelectedLinkIds((current) => {
                      const base = current.length > 0 ? current : [link.id];
                      return event.target.checked
                        ? [...new Set([...base, link.id])]
                        : base.filter((id) => id !== link.id);
                    });
                  }}
                />
                {link.displayAlias ?? link.subjectId}
              </label>
            ))
          )}
        </fieldset>
        <label>
          Início
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </label>
        <label>
          Horizonte (dias)
          <input
            type="number"
            min={1}
            max={120}
            value={horizonDays}
            onChange={(event) => setHorizonDays(Number(event.target.value))}
          />
        </label>
        <label>
          Duração (min)
          <input
            type="number"
            min={5}
            max={480}
            value={minutes}
            onChange={(event) => setMinutes(Number(event.target.value))}
          />
        </label>
      </div>
      {error ? <p className="inline-notice" role="alert">{error}</p> : null}
      {preview ? (
        <div data-testid="wizard-preview">
          <p>
            Prévia: {preview.blocks.length} blocos alocados, {preview.unallocated.length} não alocados.
            Assinatura {preview.inputRevisionSignature}.
          </p>
          <button type="button" data-action="confirm-generation" onClick={() => void confirm()}>
            Confirmar e criar cenário
          </button>
          <button type="button" onClick={() => setPreview(null)}>Voltar</button>
        </div>
      ) : (
        <button
          type="button"
          data-action="preview-generation"
          disabled={locked || effectiveSelection.length === 0 || !activeEditalId}
          onClick={() => {
            const result = onPreview(buildInput());
            if ('error' in result) {
              setError(result.error);
              setPreview(null);
              return;
            }
            setError(null);
            setPreview(result);
          }}
        >
          Gerar prévia
        </button>
      )}
    </section>
  );

  async function confirm(): Promise<void> {
    const ok = await onConfirm(buildInput());
    if (!ok) setError('Não foi possível criar o cenário.');
    else setPreview(null);
  }
}
