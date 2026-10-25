/* Barre supérieure : société, exercice, recherche (Ctrl K), contrôle D = C, notifications, utilisateur de démonstration.
 * Port React de l'ancien top(). Les actions réutilisent App.actions (modules hérités). */
import Icon from './Icon';

type Row = { id: string; name: string; role: string; companies: string[] };

export default function Topbar() {
  const App = window.App;
  const Y = window.Yiel;
  const d = App.D();
  const u = App.user();
  const tt = App.totals();
  const users: Row[] = (App.S.users || []).filter((x: Row) => x.companies.indexOf(App.cid()) > -1);
  const notifCount: number = App.notifs ? App.notifs().length : 0;
  const initials = u.name.split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const A = App.actions;
  const balanced = tt.d === tt.c;

  return (
    <>
      <header className="top">
        <label className="sr" htmlFor="sel-co">Société</label>
        <select className="sel" id="sel-co" value={App.cid()} onChange={(e) => A['switch-company'](e.currentTarget)}>
          {App.S.companies.map((c: { id: string; name: string }) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <label className="sr" htmlFor="sel-year">Exercice</label>
        <select className="sel" id="sel-year" value={App.year()} onChange={(e) => A['switch-year'](e.currentTarget)}>
          {d.fiscalYears.map((f: { year: number; status: string }) => (
            <option key={f.year} value={f.year}>Exercice {f.year}{f.status === 'closed' ? ' · clôturé' : ' · ouvert'}</option>
          ))}
        </select>
        <button type="button" className="search-trigger" data-act="palette">
          <Icon name="search" />
          <span>Rechercher un compte, un tiers, une pièce, une action…</span>
          <kbd>Ctrl K</kbd>
        </button>
        <span className={'balance-pill' + (balanced ? '' : ' bad')} title={`Débits ${Y.util.fmt(tt.d)} · crédits ${Y.util.fmt(tt.c)} (toutes les écritures validées)`}>
          <i />
          {balanced ? 'D = C · ' : 'D ≠ C · '}
          {Y.util.fmt(tt.d)}
        </span>
        <button type="button" className="bell" data-act="ntf-open" aria-label={`Notifications (${notifCount})`}>
          <Icon name="bell" />
          {notifCount ? <span className="badge">{notifCount}</span> : null}
        </button>
        <div className="who">
          <span className="avatar" aria-hidden="true">{initials}</span>
          <label className="sr" htmlFor="sel-user">Utilisateur</label>
          <select className="sel" id="sel-user" value={u.id} onChange={(e) => A['switch-user'](e.currentTarget)} title="Démonstration : changez d’utilisateur pour voir les droits par rôle">
            {users.map((x) => (
              <option key={x.id} value={x.id}>{x.name} · {Y.ROLES[x.role].label}</option>
            ))}
          </select>
        </div>
      </header>
      {App.sim ? (
        <div className="sim-band" role="status">
          <Icon name="layers" />
          <span>Mode simulation : vous travaillez sur une copie. Rien n’est enregistré tant que vous ne conservez pas le résultat.</span>
          <span style={{ marginLeft: 'auto' }} className="actions">
            <button type="button" className="btn sm" data-act="sim-end" data-keep="0">Abandonner la simulation</button>
            <button type="button" className="btn sm acc" data-act="sim-end" data-keep="1">Conserver le résultat</button>
          </span>
        </div>
      ) : null}
    </>
  );
}
