/* Barre latérale en accordéon, filtrée par droits (port React de l'ancien rail()). Les clics passent par data-act
 * (délégation d'évènements de App.boot) : App.actions.go / nav-toggle / nav-mobile. */
import Icon from './Icon';

type Item = [page: string, tab: string | null, label: string, right?: string];
type Mod = { k: string; label: string; icon: string; page?: string; right: string; only?: string; items?: Item[] };

export default function Sidebar() {
  const App = window.App;
  const badges: Record<string, number> = App.badges();
  const act = App.activeItem();
  const open: Record<string, boolean> = App.ui.navOpen || {};
  const co = App.co();
  const role = App.user().role;
  const mobile = !!App.ui.navMobile;

  return (
    <aside className={'rail' + (mobile ? ' open' : '')}>
      <div className="brand">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={window.YIEL_LOGO_DARK || ''} alt="Yiel" />
        <span>myyiel · Finance &amp; RH</span>
        <button type="button" className="nav-burger" data-act="nav-mobile" aria-expanded={mobile} aria-controls="mainnav">
          <Icon name={mobile ? 'x' : 'menu'} />
          <span>Menu</span>
        </button>
      </div>
      <nav className="nav" id="mainnav" aria-label="Modules">
        {(App.NAV2 as [string, Mod[]][]).map(([section, all]) => {
          const mods = all.filter((m) => App.can(m.right) && (!m.only || role === m.only));
          if (!mods.length) return null;
          return (
            <div key={section} style={{ display: 'contents' }}>
              <div className="grp">{section}</div>
              {mods.map((m) => {
                const isAct = !!act && act.m === m.k;
                if (!m.items) {
                  return (
                    <button key={m.k} type="button" className={'mod' + (isAct ? ' on' : '')} data-act="go" data-page={m.page} aria-current={isAct ? 'page' : undefined}>
                      <Icon name={m.icon} />
                      <span>{m.label}</span>
                      {m.page && badges[m.page] ? <span className="badge">{badges[m.page]}</span> : null}
                    </button>
                  );
                }
                const items = m.items.filter((it) => !it[3] || App.can(it[3]));
                const isOpen = open[m.k] !== undefined ? open[m.k] : isAct;
                let sum = 0;
                const seen: Record<string, number> = {};
                items.forEach((it) => {
                  const k1 = it[0] + '|' + it[1];
                  if (badges[k1]) sum += badges[k1];
                  else if (!seen[it[0]] && badges[it[0]]) {
                    seen[it[0]] = 1;
                    sum += badges[it[0]];
                  }
                });
                const shownPage: Record<string, number> = {};
                return (
                  <div key={m.k} style={{ display: 'contents' }}>
                    <button type="button" className={'mod' + (isAct ? ' act' : '') + (isOpen ? ' open' : '')} data-act="nav-toggle" data-k={m.k} aria-expanded={isOpen} aria-controls={'sub_' + m.k}>
                      <Icon name={m.icon} />
                      <span>{m.label}</span>
                      {!isOpen && sum ? <span className="badge">{sum}</span> : null}
                      <svg className="chev" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    <div className="sub" id={'sub_' + m.k} hidden={!isOpen}>
                      {items.map((it, i) => {
                        const on = isAct && m.items!.indexOf(it) === act.i;
                        const k1 = it[0] + '|' + it[1];
                        const bb = badges[k1] || (!shownPage[it[0]] && !it[1] ? badges[it[0]] : 0);
                        shownPage[it[0]] = 1;
                        return (
                          <button key={i} type="button" className={on ? 'on' : ''} data-act="go" data-page={it[0]} data-tab={it[1] || undefined} aria-current={on ? 'page' : undefined}>
                            <span>{it[2]}</span>
                            {bb ? <span className="badge">{bb}</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="foot">
        <b>{co.framework}</b>
        Système {co.system === 'smt' ? 'minimal de trésorerie' : 'normal'} · tenue en {co.currency}
        <br />
        Régime fiscal : {co.taxRegime}
      </div>
    </aside>
  );
}
