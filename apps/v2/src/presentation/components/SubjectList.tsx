import { useState } from 'react';
import type { StudySubject } from '../../domain/subject';

type SubjectListProps = {
  subjects: StudySubject[];
  onRename: (subject: StudySubject, title: string) => Promise<void>;
};

export function SubjectList({ subjects, onRename }: SubjectListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  if (subjects.length === 0) {
    return <p className="empty-state">Nenhuma disciplina local ainda. Crie a primeira acima.</p>;
  }

  return (
    <ul className="subject-list" aria-label="Disciplinas locais">
      {subjects.map((subject) => (
        <li key={subject.id} className="subject-item">
          {editingId === subject.id ? (
            <form
              className="rename-form"
              onSubmit={(event) => {
                event.preventDefault();
                const title = draft.trim();
                if (!title) return;
                void onRename(subject, title).then(() => setEditingId(null));
              }}
            >
              <label htmlFor={`rename-${subject.id}`}>Novo nome para {subject.title}</label>
              <input
                id={`rename-${subject.id}`}
                value={draft}
                maxLength={120}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button type="submit" className="button-primary">Salvar nome</button>
              <button type="button" className="button-ghost" onClick={() => setEditingId(null)}>
                Cancelar
              </button>
            </form>
          ) : (
            <div className="subject-row">
              <span className="subject-title">{subject.title}</span>
              <button
                type="button"
                className="button-ghost"
                onClick={() => {
                  setEditingId(subject.id);
                  setDraft(subject.title);
                }}
              >
                Renomear {subject.title}
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
