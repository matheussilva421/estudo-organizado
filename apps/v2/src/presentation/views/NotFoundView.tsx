import { routeHref } from '../routing';

export function NotFoundView() {
  return (
    <section className="view notfound-view" aria-labelledby="notfound-title" data-testid="f6-notfound">
      <p className="eyebrow">Rota inválida</p>
      <h2 id="notfound-title">Este endereço não corresponde a um destino permitido</h2>
      <p>
        Nenhum dado foi revelado ou alterado. O link pode estar desatualizado, apontar para outro
        perfil ou conter um identificador inválido.
      </p>
      <p className="actions-row">
        <a className="button-primary" href={routeHref({ module: 'home', entityId: null, query: {}, invalid: false })}>
          Ir para o início
        </a>
        <a className="button-ghost" href={routeHref({ module: 'content', entityId: null, query: {}, invalid: false })}>
          Abrir conteúdo
        </a>
      </p>
    </section>
  );
}

