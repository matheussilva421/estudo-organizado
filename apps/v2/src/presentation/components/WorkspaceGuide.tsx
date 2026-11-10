type Props = {
  title: string;
  description: string;
  links: Array<{ href: string; label: string }>;
  evidence: string;
  testId: string;
};

export function WorkspaceGuide({ title, description, links, evidence, testId }: Props) {
  return (
    <aside className="workspace-guide" aria-label={title} data-testid={testId}>
      <div className="workspace-guide-copy">
        <p className="eyebrow">Workspace contextual</p>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <nav className="workspace-guide-links" aria-label={`Atalhos de ${title}`}>
        {links.map((link) => (
          <a key={link.href} href={link.href}>
            {link.label}
          </a>
        ))}
      </nav>
      <p className="source-note">{evidence}</p>
    </aside>
  );
}
