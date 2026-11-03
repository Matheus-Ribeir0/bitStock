"use client";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Boxes,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Cpu,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  Search,
  ShieldCheck,
  TriangleAlert,
  Wrench,
  X,
} from "lucide-react";
import {
  clientAuth,
  supabaseConfigured,
  accessToken,
} from "@/lib/supabase-client";
import { applyCommand, demoStore, emptyStore, expiryInfo } from "@/lib/domain";
import {
  categories,
  statuses,
  type Command,
  type Product,
  type ServiceOrder,
  type Store,
} from "@/lib/types";
import { Badge, currency, date, Empty, Modal } from "./ui";
import { MovementForm, OrderForm, ProductForm, type Save } from "./forms";
type View = "overview" | "products" | "movements" | "orders";
type Session = { mode: "demo" } | { mode: "supabase"; user: User };
type Dialog =
  | { kind: "product"; product?: Product }
  | { kind: "movement"; type: "entrada" | "saida"; productId?: string }
  | { kind: "order" }
  | { kind: "product-detail"; id: string }
  | { kind: "order-detail"; id: string }
  | { kind: "archive"; id: string }
  | null;
const navigation = [
  { id: "overview" as const, label: "Visão geral", icon: LayoutDashboard },
  { id: "products" as const, label: "Produtos", icon: Package },
  { id: "movements" as const, label: "Movimentações", icon: ArrowDownLeft },
  { id: "orders" as const, label: "Ordens de serviço", icon: Wrench },
];
const descriptions = {
  overview: "Tudo o que sua loja precisa, em um só lugar.",
  products: "Consulte, cadastre e organize os produtos da sua loja.",
  movements: "Acompanhe cada entrada e saída do seu estoque.",
  orders: "Do recebimento à entrega, acompanhe cada equipamento.",
};
const DEMO_KEY = "bitstock.demo.v1";
function statusTone(status: string) {
  return status === "Entregue"
    ? "green"
    : status === "Em manutenção"
      ? "blue"
      : status === "Aguardando devolução"
        ? "amber"
        : "neutral";
}
function stockBadge(p: Product) {
  return !p.active ? (
    <Badge>Arquivado</Badge>
  ) : p.quantity === 0 ? (
    <Badge tone="red">Sem estoque</Badge>
  ) : p.quantity <= p.minimum ? (
    <Badge tone="amber">Estoque baixo</Badge>
  ) : (
    <Badge tone="green">Em estoque</Badge>
  );
}
function Login({
  onDemo,
  error: externalError,
}: {
  onDemo: () => void;
  error: string;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand">
          <span className="brand-icon">
            <Boxes size={25} />
          </span>
          bit<span>Stock</span>
        </div>
        <div>
          <span className="eyebrow">MENOS BUROCRACIA. MAIS CONTROLE.</span>
          <h1>
            Sua loja organizada.
            <br />
            Sua rotina mais leve.
          </h1>
          <p>
            Produtos, estoque e manutenção conectados para você cuidar do que
            importa.
          </p>
          <div className="login-features">
            <span>
              <Package size={21} />
              Estoque sempre à mão
            </span>
            <span>
              <Wrench size={21} />
              Manutenção do início ao fim
            </span>
            <span>
              <ShieldCheck size={21} />
              Informações em um só lugar
            </span>
          </div>
        </div>
        <small>
          Projeto de extensão · Tecnologia a serviço do comércio local
        </small>
      </section>
      <section className="login-form">
        <div className="login-card">
          <span className="small-symbol">
            <Cpu size={25} />
          </span>
          <h2>Bem-vindo ao bitStock</h2>
          <p>Entre para acessar a gestão da sua loja.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setPending(true);
              setError("");
              try {
                const { error } = await clientAuth().signInWithPassword({
                  email: String(f.get("email")),
                  password: String(f.get("password")),
                });
                if (error) throw error;
              } catch {
                setError(
                  supabaseConfigured
                    ? "Não foi possível entrar. Confira seu e-mail e senha e tente novamente."
                    : "O acesso da loja ainda não está configurado. Use a demonstração para conhecer o sistema.",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            <label className="field">
              <span>E-mail</span>
              <input
                name="email"
                type="email"
                required
                placeholder="seuemail@loja.com.br"
                autoComplete="username"
              />
            </label>
            <label className="field">
              <span>Senha</span>
              <input
                name="password"
                type="password"
                required
                placeholder="Sua senha"
                autoComplete="current-password"
              />
            </label>
            {error || externalError ? (
              <p role="alert" className="form-error">
                {error || externalError}
              </p>
            ) : null}
            <button className="button primary" disabled={pending}>
              {pending ? "Entrando…" : "Entrar na minha loja"}
              <ArrowRight size={17} />
            </button>
          </form>
          <div className="divider">
            <span>Conheça a ferramenta</span>
          </div>
          <button className="button secondary demo-button" onClick={onDemo}>
            Explorar demonstração
            <ArrowRight size={16} />
          </button>
          <small className="login-note">
            A demonstração usa dados fictícios salvos neste navegador. O acesso
            da loja é exclusivo para contas autorizadas.
          </small>
        </div>
      </section>
    </main>
  );
}
export function Workspace() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [store, setStore] = useState<Store>(emptyStore);
  const [name, setName] = useState("Colaborador");
  const [view, setView] = useState<View>("overview");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [filter, setFilter] = useState("active");
  const [orderFilter, setOrderFilter] = useState("");
  const [movementType, setMovementType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const saving = useRef(false);
  async function load() {
    setLoading(true);
    setError("");
    try {
      const token = await accessToken();
      const res = await fetch("/api/store", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStore(data.store);
      setName(data.name);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar os dados.",
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!supabaseConfigured) {
      setReady(true);
      return;
    }
    let active = true;
    let lastUid: string | null | undefined;
    const update = (user: User | null) => {
      if (!active) return;
      if (lastUid === (user?.id ?? null)) return;
      lastUid = user?.id ?? null;
      setSession(user ? { mode: "supabase", user } : null);
      setStore(emptyStore());
      setReady(true);
      if (user) void load();
    };
    // Não aguardar chamadas do SDK dentro do callback síncrono de autenticação.
    const {
      data: { subscription },
    } = clientAuth().onAuthStateChange((_event, current) => {
      setTimeout(() => update(current?.user ?? null), 0);
    });
    clientAuth()
      .getSession()
      .then(({ data, error }) => {
        if (error && active)
          setError("Não foi possível recuperar sua sessão. Entre novamente.");
        update(data.session?.user ?? null);
      });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  function startDemo() {
    try {
      const saved = localStorage.getItem(DEMO_KEY);
      const data: Store = saved ? JSON.parse(saved) : demoStore();
      if (
        !Array.isArray(data.products) ||
        !Array.isArray(data.movements) ||
        !Array.isArray(data.orders)
      )
        throw new Error("Dados de demonstração inválidos.");
      setStore(data);
      setSession({ mode: "demo" });
      setName("Marina Costa");
      setError("");
    } catch {
      setError(
        "Não foi possível abrir os dados locais. Libere o armazenamento do navegador ou remova apenas a chave bitstock.demo.v1 para reiniciar a demonstração.",
      );
    }
  }
  async function logout() {
    if (session?.mode === "supabase") {
      try {
        const { error } = await clientAuth().signOut();
        if (error) throw error;
      } catch {
        setToast("Não foi possível sair. Tente novamente.");
        return;
      }
    }
    setSession(null);
    setStore(emptyStore());
    setDialog(null);
    setError("");
    setView("overview");
  }
  const save: Save = async (command, operationId) => {
    if (saving.current || !session)
      throw new Error("Aguarde a operação atual.");
    saving.current = true;
    try {
      if (session.mode === "demo") {
        // Releitura dentro de um Web Lock evita sobrescritas entre abas compatíveis.
        const execute = () => {
          const raw = localStorage.getItem(DEMO_KEY);
          const current = raw ? (JSON.parse(raw) as Store) : store;
          const next = applyCommand(
            current,
            command,
            name,
            new Date().toISOString(),
            operationId,
          );
          localStorage.setItem(DEMO_KEY, JSON.stringify(next));
          setStore(next);
        };
        if (navigator.locks) await navigator.locks.request(DEMO_KEY, execute);
        else execute();
      } else {
        const token = await accessToken();
        const res = await fetch("/api/store", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ command, operationId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setStore(data.store);
      }
      setToast("Tudo certo! Registro salvo com sucesso.");
    } finally {
      saving.current = false;
    }
  };
  function go(next: View, preset?: string) {
    setView(next);
    setSearch("");
    setCategory("");
    setFilter(next === "products" ? (preset ?? "active") : "active");
    setOrderFilter(next === "orders" ? (preset ?? "") : "");
    setMovementType("");
    setFrom("");
    setTo("");
    setMobile(false);
  }
  const active = store.products.filter((p) => p.active);
  const low = active.filter((p) => p.quantity <= p.minimum);
  const expiring = active.filter((p) =>
    ["soon", "expired"].includes(expiryInfo(p.expiry).kind),
  );
  const openOrders = store.orders.filter((o) => o.status !== "Entregue");
  const query = search.trim().toLocaleLowerCase("pt-BR");
  const products = store.products.filter(
    (p) =>
      (!query ||
        `${p.name} ${p.code}`.toLocaleLowerCase("pt-BR").includes(query)) &&
      (!category || p.category === category) &&
      (filter === "archived"
        ? !p.active
        : p.active &&
          (filter === "low"
            ? p.quantity <= p.minimum
            : filter === "expiry"
              ? ["soon", "expired"].includes(expiryInfo(p.expiry).kind)
              : true)),
  );
  const orders = store.orders
    .filter(
      (o) =>
        (!query ||
          `${o.number} ${o.equipment}`
            .toLocaleLowerCase("pt-BR")
            .includes(query)) &&
        (!orderFilter ||
          (orderFilter === "open"
            ? o.status !== "Entregue"
            : o.status === orderFilter)),
    )
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const localDay = (value: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  const movements = store.movements
    .filter(
      (m) =>
        (!query ||
          `${m.productName} ${m.productCode}`
            .toLocaleLowerCase("pt-BR")
            .includes(query)) &&
        (!movementType || m.type === movementType) &&
        (!from || localDay(m.date) >= from) &&
        (!to || localDay(m.date) <= to),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const selectedProduct =
    dialog && "id" in dialog
      ? store.products.find((p) => p.id === dialog.id)
      : undefined;
  const selectedOrder =
    dialog?.kind === "order-detail"
      ? store.orders.find((o) => o.id === dialog.id)
      : undefined;
  if (!ready)
    return (
      <div className="boot" role="status">
        <Boxes size={30} />
        <p>Preparando sua loja…</p>
      </div>
    );
  if (!session) return <Login onDemo={startDemo} error={error} />;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Ir para o conteúdo
      </a>
      {mobile ? (
        <button
          className="nav-overlay"
          aria-label="Fechar menu"
          onClick={() => setMobile(false)}
        />
      ) : null}
      <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
        <div className="brand">
          <span className="brand-icon">
            <Boxes size={24} />
          </span>
          bit<span>Stock</span>
        </div>
        <div className="store-switch">
          <span className="store-avatar">
            <Cpu size={20} />
          </span>
          <div>
            <strong>Minha loja</strong>
            <small>Informática e manutenção</small>
          </div>
          <ShieldCheck size={16} />
        </div>
        <span className="nav-label">PRINCIPAL</span>
        <nav aria-label="Navegação principal">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-current={view === id ? "page" : undefined}
              className={view === id ? "active" : ""}
              onClick={() => go(id)}
            >
              <Icon size={19} />
              {label}
              {id === "orders" && openOrders.length ? (
                <span className="nav-count" aria-hidden="true">
                  {openOrders.length}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-icon">
              <Check size={17} />
            </span>
            <strong>Uma rotina mais simples</strong>
            <p>Organização que faz a diferença no seu dia a dia.</p>
          </div>
          <div className="profile">
            <span className="avatar">
              {name
                .split(" ")
                .map((x) => x[0])
                .slice(0, 2)
                .join("")}
            </span>
            <div>
              <strong>{name}</strong>
              <small>
                {session.mode === "demo" ? "Demonstração" : "Equipe da loja"}
              </small>
            </div>
            <button
              className="icon-button"
              aria-label="Sair da conta"
              onClick={logout}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menu"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>Minha loja</span>
            <ChevronRight size={14} />
            <strong>{navigation.find((n) => n.id === view)?.label}</strong>
          </div>
          <span className="today">
            <CalendarDays size={15} />
            {date(new Date().toISOString())}
          </span>
        </header>
        {session.mode === "demo" ? (
          <div className="demo-banner">
            <span>
              <span className="live-dot" />
              Demonstração · dados fictícios salvos neste navegador
            </span>
            <button onClick={logout}>
              Acessar minha loja
              <ArrowRight size={14} />
            </button>
          </div>
        ) : null}
        <main id="main" className="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">GESTÃO DA LOJA</div>
              <h1>{navigation.find((n) => n.id === view)?.label}</h1>
              <p>{descriptions[view]}</p>
            </div>
            <button
              className="button primary"
              disabled={loading || !!error}
              onClick={() =>
                setDialog(
                  view === "orders"
                    ? { kind: "order" }
                    : view === "movements"
                      ? { kind: "movement", type: "entrada" }
                      : { kind: "product" },
                )
              }
            >
              <Plus size={18} />
              {view === "orders"
                ? "Nova ordem de serviço"
                : view === "movements"
                  ? "Nova movimentação"
                  : "Cadastrar produto"}
            </button>
          </div>
          {error ? (
            <div className="error-panel" role="alert">
              <TriangleAlert size={21} />
              <p>{error}</p>
              <button
                className="button secondary"
                onClick={() => session.mode === "supabase" && void load()}
              >
                Tentar novamente
              </button>
            </div>
          ) : loading ? (
            <div className="loading-panel" role="status">
              Carregando os dados da loja…
            </div>
          ) : (
            <>
              {view === "overview" ? (
                <>
                  <div className="welcome-line">
                    <span>
                      <span className="greeting-dot" />
                      Olá, {name.split(" ")[0]}. Vamos organizar o dia?
                    </span>
                    <span>Seu negócio, sob controle.</span>
                  </div>
                  <div className="stats-grid">
                    {[
                      {
                        title: "Produtos cadastrados",
                        value: active.length,
                        sub: "Produtos ativos na loja",
                        icon: Package,
                        tone: "teal",
                        action: () => go("products"),
                      },
                      {
                        title: "Unidades em estoque",
                        value: active.reduce((sum, p) => sum + p.quantity, 0),
                        sub: "Disponíveis para venda",
                        icon: Boxes,
                        tone: "blue",
                        action: () => go("products"),
                      },
                      {
                        title: "Estoque baixo",
                        value: low.length,
                        sub: low.length
                          ? "Produtos precisam de reposição"
                          : "Estoque em dia",
                        icon: TriangleAlert,
                        tone: "amber",
                        action: () => go("products", "low"),
                      },
                      {
                        title: "Atenção à validade",
                        value: expiring.length,
                        sub: "Vencidos ou nos próximos 30 dias",
                        icon: CalendarDays,
                        tone: "rose",
                        action: () => go("products", "expiry"),
                      },
                      {
                        title: "Ordens em andamento",
                        value: openOrders.length,
                        sub: "Equipamentos em atendimento",
                        icon: Wrench,
                        tone: "violet",
                        action: () => go("orders", "open"),
                      },
                      {
                        title: "Aguardando devolução",
                        value: openOrders.filter(
                          (o) => o.status === "Aguardando devolução",
                        ).length,
                        sub: "Prontos para entregar ao cliente",
                        icon: Clock3,
                        tone: "teal",
                        action: () => go("orders", "Aguardando devolução"),
                      },
                    ].map((s) => (
                      <button
                        key={s.title}
                        className="stat-card"
                        onClick={s.action}
                      >
                        <div className="stat-top">
                          <span>{s.title}</span>
                          <span className={`stat-icon ${s.tone}`}>
                            <s.icon size={19} />
                          </span>
                        </div>
                        <strong>{s.value.toString().padStart(2, "0")}</strong>
                        <small>{s.sub}</small>
                      </button>
                    ))}
                  </div>
                  <div className="quick-actions">
                    <span>Acesso rápido</span>
                    <button
                      onClick={() =>
                        setDialog({ kind: "movement", type: "entrada" })
                      }
                    >
                      <ArrowDownLeft size={18} />
                      Registrar entrada
                    </button>
                    <button
                      onClick={() =>
                        setDialog({ kind: "movement", type: "saida" })
                      }
                    >
                      <ArrowUpRight size={18} />
                      Registrar saída
                    </button>
                    <button onClick={() => setDialog({ kind: "order" })}>
                      <Plus size={18} />
                      Nova ordem de serviço
                    </button>
                  </div>
                  <div className="dashboard-columns">
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Precisam de atenção</h2>
                          <p>Pequenos cuidados para manter tudo em dia.</p>
                        </div>
                        <Badge tone="amber">
                          {low.length + expiring.length} alertas
                        </Badge>
                      </div>
                      <div className="attention-list">
                        {low.length + expiring.length === 0 ? (
                          <Empty
                            title="Tudo em dia por aqui"
                            text="Nenhum alerta de estoque ou validade."
                          />
                        ) : (
                          <>
                            {low.map((p) => (
                              <button
                                key={`low-${p.id}`}
                                onClick={() =>
                                  setDialog({
                                    kind: "product-detail",
                                    id: p.id,
                                  })
                                }
                              >
                                <span
                                  className={`attention-icon ${p.quantity === 0 ? "rose" : "amber"}`}
                                >
                                  <Package size={19} />
                                </span>
                                <span>
                                  <strong>{p.name}</strong>
                                  <small>
                                    {p.quantity === 0
                                      ? "Sem unidades disponíveis"
                                      : `${p.quantity} un. disponíveis · mínimo ${p.minimum}`}
                                  </small>
                                </span>
                                {stockBadge(p)}
                                <ChevronRight size={16} />
                              </button>
                            ))}
                            {expiring.map((p) => (
                              <button
                                key={`exp-${p.id}`}
                                onClick={() =>
                                  setDialog({
                                    kind: "product-detail",
                                    id: p.id,
                                  })
                                }
                              >
                                <span className="attention-icon rose">
                                  <CalendarDays size={19} />
                                </span>
                                <span>
                                  <strong>{p.name}</strong>
                                  <small>Validade: {date(p.expiry)}</small>
                                </span>
                                <Badge
                                  tone={
                                    expiryInfo(p.expiry).kind === "expired"
                                      ? "red"
                                      : "amber"
                                  }
                                >
                                  {expiryInfo(p.expiry).label}
                                </Badge>
                                <ChevronRight size={16} />
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                      <div className="panel-bottom">
                        <button
                          className="text-button"
                          onClick={() => go("products", "low")}
                        >
                          Consultar produtos
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>Na bancada</h2>
                          <p>Acompanhe os atendimentos em aberto.</p>
                        </div>
                        <Wrench size={19} />
                      </div>
                      <div className="bench-list">
                        {openOrders.length ? (
                          openOrders.slice(0, 3).map((o) => (
                            <button
                              key={o.id}
                              onClick={() =>
                                setDialog({ kind: "order-detail", id: o.id })
                              }
                            >
                              <span className="order-line">
                                <small>{o.number}</small>
                                <Badge tone={statusTone(o.status)}>
                                  {o.status}
                                </Badge>
                              </span>
                              <strong>{o.equipment}</strong>
                              <small className="muted">{o.issue}</small>
                            </button>
                          ))
                        ) : (
                          <Empty
                            title="Bancada livre"
                            text="As novas ordens de serviço aparecerão aqui."
                          />
                        )}
                      </div>
                      <div className="panel-bottom">
                        <button
                          className="text-button"
                          onClick={() => go("orders", "open")}
                        >
                          Ver ordens de serviço
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </section>
                  </div>
                  <section className="panel recent-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Últimas movimentações</h2>
                        <p>O que entrou e saiu do estoque recentemente.</p>
                      </div>
                      <button
                        className="text-button"
                        onClick={() => go("movements")}
                      >
                        Ver histórico
                        <ArrowRight size={16} />
                      </button>
                    </div>
                    <MovementTable movements={movements.slice(0, 5)} />
                  </section>
                </>
              ) : null}
              {view === "products" ? (
                <section className="panel">
                  <div className="toolbar">
                    <SearchBox
                      value={search}
                      onChange={setSearch}
                      placeholder="Buscar por nome ou código…"
                    />
                    <select
                      aria-label="Filtrar por categoria"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="">Todas as categorias</option>
                      {categories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Situação do estoque"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="active">Produtos ativos</option>
                      <option value="low">Estoque baixo ou zerado</option>
                      <option value="expiry">Alertas de validade</option>
                      <option value="archived">Arquivados</option>
                    </select>
                  </div>
                  <div className="list-count">
                    {products.length}{" "}
                    {products.length === 1
                      ? "produto encontrado"
                      : "produtos encontrados"}
                  </div>
                  {products.length ? (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Produto</th>
                            <th>Categoria</th>
                            <th>Estoque / mínimo</th>
                            <th>Situação</th>
                            <th>Validade</th>
                            <th>
                              <span className="sr-only">Ações</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {products.map((p) => (
                            <tr key={p.id}>
                              <td>
                                <button
                                  className="product-link"
                                  onClick={() =>
                                    setDialog({
                                      kind: "product-detail",
                                      id: p.id,
                                    })
                                  }
                                >
                                  <span className="product-thumb">
                                    <Cpu size={21} />
                                  </span>
                                  <span>
                                    <strong>{p.name}</strong>
                                    <small>{p.code}</small>
                                  </span>
                                </button>
                              </td>
                              <td data-label="Categoria">{p.category}</td>
                              <td data-label="Estoque">
                                <strong>{p.quantity} un.</strong>
                                <small className="cell-small">
                                  Mínimo: {p.minimum}
                                </small>
                              </td>
                              <td data-label="Situação">{stockBadge(p)}</td>
                              <td data-label="Validade">
                                {p.expiry ? (
                                  <>
                                    <span>{date(p.expiry)}</span>
                                    <small
                                      className={`cell-small ${expiryInfo(p.expiry).kind === "expired" ? "danger-text" : ""}`}
                                    >
                                      {expiryInfo(p.expiry).label}
                                    </small>
                                  </>
                                ) : (
                                  <span className="muted">Não se aplica</span>
                                )}
                              </td>
                              <td>
                                <button
                                  className="icon-button"
                                  aria-label={`Ver ${p.name}`}
                                  onClick={() =>
                                    setDialog({
                                      kind: "product-detail",
                                      id: p.id,
                                    })
                                  }
                                >
                                  <ChevronRight size={19} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <Empty
                      title={
                        store.products.length
                          ? "Nenhum produto encontrado"
                          : "Seu estoque começa aqui"
                      }
                      text={
                        store.products.length
                          ? "Ajuste os filtros ou tente outro nome ou código."
                          : "Clique em Cadastrar produto para começar."
                      }
                    />
                  )}
                </section>
              ) : null}
              {view === "movements" ? (
                <section className="panel">
                  <div className="toolbar">
                    <SearchBox
                      value={search}
                      onChange={setSearch}
                      placeholder="Buscar produto ou código…"
                    />
                    <select
                      aria-label="Tipo de movimentação"
                      value={movementType}
                      onChange={(e) => setMovementType(e.target.value)}
                    >
                      <option value="">Entradas e saídas</option>
                      <option value="entrada">Entradas</option>
                      <option value="saida">Saídas</option>
                    </select>
                    <label className="date-filter">
                      De
                      <input
                        aria-label="Data inicial"
                        type="date"
                        value={from}
                        onChange={(e) => setFrom(e.target.value)}
                      />
                    </label>
                    <label className="date-filter">
                      Até
                      <input
                        aria-label="Data final"
                        type="date"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="list-count">
                    {movements.length} movimentações · histórico preservado
                  </div>
                  <MovementTable movements={movements} />
                </section>
              ) : null}
              {view === "orders" ? (
                <>
                  <div className="order-tabs">
                    <button
                      className={!orderFilter ? "active" : ""}
                      onClick={() => setOrderFilter("")}
                    >
                      Todas <span>{store.orders.length}</span>
                    </button>
                    {statuses.map((s) => (
                      <button
                        key={s}
                        className={orderFilter === s ? "active" : ""}
                        onClick={() => setOrderFilter(s)}
                      >
                        {s}
                        <span>
                          {store.orders.filter((o) => o.status === s).length}
                        </span>
                      </button>
                    ))}
                  </div>
                  <section className="panel">
                    <div className="toolbar">
                      <SearchBox
                        value={search}
                        onChange={setSearch}
                        placeholder="Buscar ordem ou equipamento…"
                      />
                      <select
                        aria-label="Filtrar ordens"
                        value={orderFilter}
                        onChange={(e) => setOrderFilter(e.target.value)}
                      >
                        <option value="">Todas as situações</option>
                        <option value="open">Em andamento</option>
                        {statuses.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    {orders.length ? (
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Ordem / equipamento</th>
                              <th>Recebimento</th>
                              <th>Situação</th>
                              <th>Responsável</th>
                              <th>
                                <span className="sr-only">Ações</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {orders.map((o) => (
                              <tr key={o.id}>
                                <td>
                                  <button
                                    className="product-link"
                                    onClick={() =>
                                      setDialog({
                                        kind: "order-detail",
                                        id: o.id,
                                      })
                                    }
                                  >
                                    <span className="product-thumb">
                                      <Wrench size={20} />
                                    </span>
                                    <span>
                                      <small>{o.number}</small>
                                      <strong>{o.equipment}</strong>
                                    </span>
                                  </button>
                                </td>
                                <td data-label="Recebimento">
                                  {date(o.receivedAt, true)}
                                </td>
                                <td data-label="Situação">
                                  <Badge tone={statusTone(o.status)}>
                                    {o.status}
                                  </Badge>
                                </td>
                                <td data-label="Responsável">{o.user}</td>
                                <td>
                                  <button
                                    className="icon-button"
                                    aria-label={`Abrir ${o.number}`}
                                    onClick={() =>
                                      setDialog({
                                        kind: "order-detail",
                                        id: o.id,
                                      })
                                    }
                                  >
                                    <ChevronRight size={19} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <Empty
                        title="Nenhuma ordem de serviço"
                        text="Crie uma nova ordem para registrar o recebimento de um equipamento ou ajuste os filtros."
                      />
                    )}
                  </section>
                  <p className="footnote">
                    <ShieldCheck size={15} />
                    Equipamentos de clientes são acompanhados separadamente do
                    estoque de venda.
                  </p>
                </>
              ) : null}
            </>
          )}
          <footer className="app-footer">
            <span>
              bitStock <span>·</span> Organização para o seu dia a dia.
            </span>
            <span>Projeto de extensão · Indústria 4.0</span>
          </footer>
        </main>
      </div>
      {dialog?.kind === "product" ? (
        <ProductForm
          product={dialog.product}
          onSave={save}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "movement" ? (
        <MovementForm
          products={store.products}
          type={dialog.type}
          productId={dialog.productId}
          onSave={save}
          onClose={() => setDialog(null)}
        />
      ) : null}
      {dialog?.kind === "order" ? (
        <OrderForm onSave={save} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === "product-detail" && selectedProduct ? (
        <Modal
          title={selectedProduct.name}
          subtitle={`${selectedProduct.code} · ${selectedProduct.category}`}
          onClose={() => setDialog(null)}
        >
          <div className="detail-body">
            <div className="detail-summary">
              {stockBadge(selectedProduct)}
              <strong>
                {selectedProduct.quantity} <small>unidades em estoque</small>
              </strong>
            </div>
            <dl className="details-grid">
              <div>
                <dt>Estoque mínimo</dt>
                <dd>{selectedProduct.minimum} un.</dd>
              </div>
              <div>
                <dt>Marca</dt>
                <dd>{selectedProduct.brand || "—"}</dd>
              </div>
              <div>
                <dt>Custo</dt>
                <dd>{currency(selectedProduct.cost)}</dd>
              </div>
              <div>
                <dt>Preço de venda</dt>
                <dd>{currency(selectedProduct.price)}</dd>
              </div>
              <div>
                <dt>Validade</dt>
                <dd>
                  {date(selectedProduct.expiry)}
                  {selectedProduct.expiry ? (
                    <small>{expiryInfo(selectedProduct.expiry).label}</small>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>Descrição</dt>
                <dd>{selectedProduct.description || "—"}</dd>
              </div>
            </dl>
            {selectedProduct.active ? (
              <div className="detail-actions">
                <button
                  className="button primary"
                  onClick={() =>
                    setDialog({
                      kind: "movement",
                      type: "entrada",
                      productId: selectedProduct.id,
                    })
                  }
                >
                  <ArrowDownLeft size={17} />
                  Entrada
                </button>
                <button
                  className="button secondary"
                  onClick={() =>
                    setDialog({
                      kind: "movement",
                      type: "saida",
                      productId: selectedProduct.id,
                    })
                  }
                >
                  <ArrowUpRight size={17} />
                  Saída
                </button>
                <button
                  className="button secondary"
                  onClick={() =>
                    setDialog({ kind: "product", product: selectedProduct })
                  }
                >
                  Editar
                </button>
                <button
                  className="text-button danger-text"
                  onClick={() =>
                    setDialog({ kind: "archive", id: selectedProduct.id })
                  }
                >
                  Arquivar
                </button>
              </div>
            ) : null}
            <h3 className="section-label">Histórico do produto</h3>
            <MovementTable
              movements={store.movements
                .filter((m) => m.productId === selectedProduct.id)
                .sort((a, b) => b.date.localeCompare(a.date))}
            />
          </div>
        </Modal>
      ) : null}
      {dialog?.kind === "archive" && selectedProduct ? (
        <ArchiveDialog
          product={selectedProduct}
          save={save}
          close={() => setDialog(null)}
        />
      ) : null}
      {selectedOrder ? (
        <OrderDetail
          order={selectedOrder}
          save={save}
          close={() => setDialog(null)}
        />
      ) : null}
      {toast ? (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button
            className="icon-button"
            aria-label="Fechar aviso"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder: string;
}) {
  return (
    <div className="search-box">
      <Search size={18} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value ? (
        <button
          className="icon-button"
          aria-label="Limpar busca"
          onClick={() => onChange("")}
        >
          <X size={15} />
        </button>
      ) : null}
    </div>
  );
}
function MovementTable({ movements }: { movements: Store["movements"] }) {
  return movements.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Movimentação</th>
            <th>Quantidade</th>
            <th>Motivo / observação</th>
            <th>Data e responsável</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => (
            <tr key={m.id}>
              <td>
                <strong>{m.productName}</strong>
                <small className="cell-small">{m.productCode}</small>
              </td>
              <td data-label="Movimentação">
                <Badge tone={m.type === "entrada" ? "green" : "blue"}>
                  {m.type === "entrada" ? (
                    <ArrowDownLeft size={13} />
                  ) : (
                    <ArrowUpRight size={13} />
                  )}{" "}
                  {m.type === "entrada" ? "Entrada" : "Saída"}
                </Badge>
              </td>
              <td data-label="Quantidade">
                <strong className={m.type === "entrada" ? "positive" : ""}>
                  {m.type === "entrada" ? "+" : "−"}
                  {m.quantity} un.
                </strong>
                <small className="cell-small">
                  {m.before} → {m.after}
                </small>
              </td>
              <td data-label="Motivo">
                {m.reason}
                {m.note ? <small className="cell-small">{m.note}</small> : null}
              </td>
              <td data-label="Data e responsável">
                {date(m.date, true)}
                <small className="cell-small">{m.user}</small>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty
      title="Nenhuma movimentação"
      text="As entradas e saídas registradas aparecerão aqui."
    />
  );
}
function ArchiveDialog({
  product,
  save,
  close,
}: {
  product: Product;
  save: Save;
  close: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [id] = useState(() => crypto.randomUUID());
  return (
    <Modal
      title="Arquivar produto?"
      onClose={() => {
        if (!pending) close();
      }}
    >
      <div className="detail-body">
        <p>
          O produto <strong>{product.name}</strong> sairá da lista de ativos e
          não receberá novas movimentações. O histórico será preservado.
        </p>
        {product.quantity > 0 ? (
          <p className="info-note">
            Este produto ainda possui {product.quantity} unidades. Confira o
            saldo antes de arquivar.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : null}
      </div>
      <div className="modal-footer">
        <button className="button secondary" disabled={pending} onClick={close}>
          Cancelar
        </button>
        <button
          className="button danger"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              await save({ kind: "product.archive", id: product.id }, id);
              close();
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Não foi possível arquivar.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          {pending ? "Arquivando…" : "Confirmar arquivamento"}
        </button>
      </div>
    </Modal>
  );
}
function OrderDetail({
  order,
  save,
  close,
}: {
  order: ServiceOrder;
  save: Save;
  close: () => void;
}) {
  const [status, setStatus] = useState(order.status);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef({ id: crypto.randomUUID(), status: order.status });
  return (
    <Modal
      title={order.equipment}
      subtitle={order.number}
      onClose={() => {
        if (!pending) close();
      }}
    >
      <div className="detail-body">
        <Badge tone={statusTone(order.status)}>{order.status}</Badge>
        <dl className="details-grid">
          <div>
            <dt>Recebido em</dt>
            <dd>{date(order.receivedAt, true)}</dd>
          </div>
          <div>
            <dt>Registrado por</dt>
            <dd>{order.user}</dd>
          </div>
          <div className="wide">
            <dt>Problema relatado</dt>
            <dd>{order.issue}</dd>
          </div>
          {order.deliveredAt ? (
            <div>
              <dt>Entregue em</dt>
              <dd>{date(order.deliveredAt, true)}</dd>
            </div>
          ) : null}
        </dl>
        {order.status !== "Entregue" ? (
          <form
            className="status-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              setError("");
              if (operation.current.status !== status)
                operation.current = { id: crypto.randomUUID(), status };
              try {
                await save(
                  { kind: "order.status", id: order.id, status },
                  operation.current.id,
                );
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Não foi possível atualizar.",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            <label className="field">
              <span>Atualizar situação</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <button
              className="button primary"
              disabled={pending || status === order.status}
            >
              {pending
                ? "Salvando…"
                : status === "Entregue"
                  ? "Registrar entrega"
                  : "Atualizar situação"}
            </button>
          </form>
        ) : null}
        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : null}
        <h3 className="section-label">Histórico do atendimento</h3>
        <ol className="timeline">
          {order.events.map((event, i) => (
            <li key={`${event.date}-${i}`}>
              <span className="timeline-dot">
                <Check size={12} />
              </span>
              <div>
                <strong>{event.status}</strong>
                <small>
                  {date(event.date, true)} · {event.user}
                </small>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Modal>
  );
}
