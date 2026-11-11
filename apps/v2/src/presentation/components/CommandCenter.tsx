import { useEffect, useRef, useState } from 'react';
import type { RouteModule } from '../routing';

export type CommandItem = { id: string; label: string; module: RouteModule };

type Props = {
  open: boolean;
  commands: CommandItem[];
  onClose: () => void;
  onNavigate: (module: RouteModule) => void;
  onSearch: (query: string) => void;
};

export function CommandCenter({ open, commands, onClose, onNavigate, onSearch }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery('');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const normalized = query.trim().toLowerCase();
  const filtered = commands.filter((command) =>
    normalized ? command.label.toLowerCase().includes(normalized) : true,
  );

  function activate(): void {
    const command = filtered[selected];
    if (command) onNavigate(command.module);
    else if (query.trim()) onSearch(query.trim());
  }

  return (
    <div
      className="command-overlay"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="command-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-center-title"
        data-testid="command-center"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSelected((current) => Math.min(filtered.length - 1, current + 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSelected((current) => Math.max(0, current - 1));
          } else if (event.key === 'Tab') {
            event.preventDefault();
            inputRef.current?.focus();
          } else if (event.key === 'Enter') {
            event.preventDefault();
            activate();
          }
        }}
      >
        <h2 id="command-center-title">Central de comandos</h2>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded="true"
          aria-controls="command-list"
          aria-activedescendant={
            filtered[selected]
              ? 'command-option-' + filtered[selected].id
              : 'command-search-option'
          }
          value={query}
          aria-label="Buscar destinos ou o acervo local"
          placeholder="Ir para… ou buscar no acervo"
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(0);
          }}
        />
        <ul id="command-list" role="listbox" aria-label="Destinos">
          {filtered.map((command, index) => (
            <li
              key={command.id}
              id={'command-option-' + command.id}
              role="option"
              aria-selected={index === selected}
              onClick={() => onNavigate(command.module)}
            >
              {command.label}
            </li>
          ))}
          {filtered.length === 0 ? (
            <li
              id="command-search-option"
              role="option"
              aria-selected={selected === 0}
              onClick={() => (query.trim() ? onSearch(query.trim()) : undefined)}
            >
              Buscar “{query.trim()}” no acervo local
            </li>
          ) : null}
        </ul>
        <p className="hint">Ctrl+Shift+K abre · Esc fecha · Enter navega. Nenhum comando altera dados.</p>
      </div>
    </div>
  );
}

