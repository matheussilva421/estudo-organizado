import { canSubmitTitle, type FormState } from '../ui-state';

type SubjectFormProps = {
  form: FormState;
  onTitleChange: (title: string) => void;
  onSubmit: () => void;
  locked?: boolean;
};

export function SubjectForm({ form, onTitleChange, onSubmit, locked = false }: SubjectFormProps) {
  const disabled = locked || form.submitting || !canSubmitTitle(form.title);

  return (
    <form
      className="subject-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label htmlFor="subject-title">Nova disciplina</label>
      <div className="subject-form-row">
        <input
          id="subject-title"
          name="subject-title"
          value={form.title}
          maxLength={120}
          autoComplete="off"
          aria-invalid={form.error ? 'true' : 'false'}
          aria-describedby={form.error ? 'subject-error' : undefined}
          readOnly={locked}
          placeholder="Ex.: Direito Constitucional"
          onChange={(event) => onTitleChange(event.target.value)}
        />
        <button type="submit" className="button-primary" disabled={disabled}>
          {form.submitting ? 'Salvando…' : 'Adicionar disciplina'}
        </button>
      </div>
      {form.error ? (
        <p id="subject-error" className="form-error" role="alert">
          {form.error}
        </p>
      ) : null}
    </form>
  );
}
