import { categories, reasons, statuses } from "./types";
import type {
  Command,
  Movement,
  OrderEvent,
  Product,
  ServiceOrder,
  Status,
  Store,
} from "./types";

function fail(message: string): never {
  throw new Error(message);
}
function record(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    fail(message);
  return value as Record<string, unknown>;
}
function str(
  value: unknown,
  label: string,
  max: number,
  optional = false,
): string {
  if (typeof value !== "string") return fail(`${label} deve ser um texto.`);
  const result = value.trim();
  if (!optional && !result) fail(`${label} é obrigatório.`);
  if (result.length > max)
    fail(`${label} deve ter no máximo ${max} caracteres.`);
  return result;
}
function integer(value: unknown, label: string, positive = false): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < (positive ? 1 : 0)
  )
    fail(
      `${label} deve ser um número inteiro ${positive ? "maior que zero" : "não negativo"}.`,
    );
  return value as number;
}
function money(value: unknown, label: string): number | null {
  if (value === null) return null;
  return integer(value, label);
}
function dateTime(value: unknown, label: string): string {
  const result = str(value, label, 64);
  if (!Number.isFinite(Date.parse(result)))
    fail(`${label} deve ser uma data válida.`);
  return result;
}
function expiry(value: unknown): string {
  const result = str(value, "Validade", 10, true);
  if (!result) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(result);
  if (!match) fail("Validade deve ser uma data ISO válida (AAAA-MM-DD).");
  const [, y, m, d] = match;
  const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (
    dt.getUTCFullYear() !== Number(y) ||
    dt.getUTCMonth() !== Number(m) - 1 ||
    dt.getUTCDate() !== Number(d)
  )
    fail("Validade deve ser uma data ISO válida (AAAA-MM-DD).");
  return result;
}
function isoDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function expiryInfo(
  expiryDate: string,
  now: Date = new Date(),
): {
  kind: "none" | "ok" | "soon" | "expired";
  days: number | null;
  label: string;
} {
  const value = expiry(expiryDate);
  if (!value) return { kind: "none", days: null, label: "Sem validade" };
  const today = isoDay(now);
  const days = Math.round(
    (Date.parse(`${value}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      86400000,
  );
  if (days < 0)
    return {
      kind: "expired",
      days,
      label: `Vencido há ${Math.abs(days)} ${days === -1 ? "dia" : "dias"}`,
    };
  if (days <= 30)
    return {
      kind: "soon",
      days,
      label:
        days === 0
          ? "Vence hoje"
          : `Vence em ${days} ${days === 1 ? "dia" : "dias"}`,
    };
  return { kind: "ok", days, label: `Vence em ${days} dias` };
}
export function emptyStore(): Store {
  return { products: [], movements: [], orders: [] };
}

export function applyCommand(
  store: Store,
  command: Command,
  user: string,
  now: string,
  operationId: string,
): Store {
  const src = record(store, "Estoque inválido.");
  if (
    !Array.isArray(src.products) ||
    !Array.isArray(src.movements) ||
    !Array.isArray(src.orders)
  )
    fail("Estoque inválido.");
  const c = record(command, "Comando inválido.");
  const actor = str(user, "Usuário", 120);
  const timestamp = dateTime(now, "Data da operação");
  const opId = str(operationId, "Identificador da operação", 120);
  const products = src.products as Product[],
    movements = src.movements as Movement[],
    orders = src.orders as ServiceOrder[];
  const next = (): Store => ({
    products: [...products],
    movements: [...movements],
    orders: [...orders],
  });
  if (c.kind === "product.save") {
    const data = record(c.data, "Dados do produto inválidos.");
    const id =
      c.id === undefined ? opId : str(c.id, "Identificador do produto", 120);
    const old = products.find((p) => p.id === id);
    if (c.id !== undefined && !old) fail("Produto não encontrado.");
    if (old?.active === false) fail("Produto arquivado não pode ser alterado.");
    const name = str(data.name, "Nome", 120),
      code = str(data.code, "Código", 40),
      category = str(data.category, "Categoria", 80);
    if (!(categories as readonly string[]).includes(category))
      fail("Categoria inválida.");
    const brand = str(data.brand, "Marca", 80, true),
      description = str(data.description, "Descrição", 500, true);
    const minimum = integer(data.minimum, "Estoque mínimo"),
      cost = money(data.cost, "Custo"),
      price = money(data.price, "Preço"),
      validUntil = expiry(data.expiry);
    const initial = integer(data.initial, "Estoque inicial");
    if (
      products.some(
        (p) =>
          p.id !== id &&
          p.code.trim().toLocaleLowerCase("pt-BR") ===
            code.toLocaleLowerCase("pt-BR"),
      )
    )
      fail("Já existe um produto com esse código.");
    if (old && initial !== old.quantity)
      fail(
        "O saldo não pode ser editado diretamente; registre uma movimentação.",
      );
    if (!old && initial > 0 && movements.some((m) => m.id === opId))
      fail("Identificador de movimentação já utilizado.");
    const product: Product = {
      id,
      name,
      code,
      category,
      brand,
      description,
      quantity: old?.quantity ?? initial,
      minimum,
      cost,
      price,
      expiry: validUntil,
      active: true,
      createdAt: old?.createdAt ?? timestamp,
      updatedAt: timestamp,
    };
    const result = next();
    result.products = old
      ? products.map((p) => (p.id === id ? product : p))
      : [...products, product];
    if (!old && initial > 0)
      result.movements = [
        ...movements,
        {
          id: opId,
          productId: id,
          productName: name,
          productCode: code,
          type: "entrada",
          quantity: initial,
          before: 0,
          after: initial,
          reason: "Estoque inicial",
          note: "",
          user: actor,
          date: timestamp,
        },
      ];
    return result;
  }
  if (c.kind === "product.archive") {
    const id = str(c.id, "Identificador do produto", 120),
      old = products.find((p) => p.id === id);
    if (!old) fail("Produto não encontrado.");
    if (!old.active) return next();
    const result = next();
    result.products = products.map((p) =>
      p.id === id ? { ...p, active: false, updatedAt: timestamp } : p,
    );
    return result;
  }
  if (c.kind === "movement.create") {
    const data = record(c.data, "Dados da movimentação inválidos.");
    const productId = str(data.productId, "Produto", 120),
      p = products.find((x) => x.id === productId);
    if (!p) fail("Produto não encontrado.");
    if (!p.active) fail("Produto arquivado não pode receber movimentações.");
    const type = data.type;
    if (type !== "entrada" && type !== "saida")
      fail("Tipo de movimentação inválido.");
    const quantity = integer(data.quantity, "Quantidade", true),
      reason = str(data.reason, "Motivo", 40),
      note = str(data.note, "Observação", 300, true);
    if (!(reasons as readonly string[]).includes(reason))
      fail("Motivo de movimentação inválido.");
    const after =
      type === "entrada" ? p.quantity + quantity : p.quantity - quantity;
    if (!Number.isSafeInteger(after))
      fail("Saldo resultante fora do limite seguro.");
    if (after < 0) fail("Estoque insuficiente para essa saída.");
    if (movements.some((m) => m.id === opId))
      fail("Identificador de movimentação já utilizado.");
    const result = next();
    result.products = products.map((x) =>
      x.id === p.id ? { ...p, quantity: after, updatedAt: timestamp } : x,
    );
    result.movements = [
      ...movements,
      {
        id: opId,
        productId,
        productName: p.name,
        productCode: p.code,
        type,
        quantity,
        before: p.quantity,
        after,
        reason,
        note,
        user: actor,
        date: timestamp,
      },
    ];
    return result;
  }
  if (c.kind === "order.create") {
    const data = record(c.data, "Dados da ordem inválidos.");
    const equipment = str(data.equipment, "Equipamento", 160),
      issue = str(data.issue, "Problema relatado", 1000);
    if (orders.some((o) => o.id === opId))
      fail("Identificador de ordem já utilizado.");
    const number = uniqueOrderNumber(opId, orders);
    const event: OrderEvent = {
      status: "Recebido",
      date: timestamp,
      user: actor,
    };
    const order: ServiceOrder = {
      id: opId,
      number,
      equipment,
      issue,
      status: "Recebido",
      receivedAt: timestamp,
      deliveredAt: null,
      user: actor,
      events: [event],
    };
    return { ...next(), orders: [...orders, order] };
  }
  if (c.kind === "order.status") {
    const id = str(c.id, "Identificador da ordem", 120),
      status = c.status;
    if (
      typeof status !== "string" ||
      !(statuses as readonly string[]).includes(status)
    )
      fail("Situação da ordem inválida.");
    const order = orders.find((o) => o.id === id);
    if (!order) fail("Ordem de serviço não encontrada.");
    if (order.status === status) return next();
    if (order.status === "Entregue")
      fail("Ordem entregue não pode ser reaberta.");
    if (
      order.events.some(
        (e) => e.date === timestamp && e.status === status && e.user === actor,
      )
    )
      fail("Essa mudança de situação já foi registrada.");
    const updated = {
      ...order,
      status: status as Status,
      deliveredAt: status === "Entregue" ? timestamp : null,
      events: [
        ...order.events,
        { status: status as Status, date: timestamp, user: actor },
      ],
    };
    const result = next();
    result.orders = orders.map((o) => (o.id === id ? updated : o));
    return result;
  }
  return fail("Tipo de comando inválido.");
}
function uniqueOrderNumber(id: string, orders: ServiceOrder[]): string {
  const base =
    id
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(-12)
      .toUpperCase() || "OS";
  let number = `OS-${base}`,
    suffix = 2;
  while (
    orders.some(
      (o) =>
        o.number.toLocaleLowerCase("pt-BR") ===
        number.toLocaleLowerCase("pt-BR"),
    )
  )
    number = `OS-${base}-${suffix++}`;
  return number;
}

export function demoStore(now: Date = new Date()): Store {
  const day = isoDay(now),
    ts = `${day}T12:00:00.000-03:00`;
  const products: Product[] = [
    [
      "p1",
      "Desktop Ryzen 5",
      "PC-001",
      "Computadores",
      "BitStock",
      "Computador para escritório",
      8,
      2,
      285000,
      359900,
      "",
    ],
    [
      "p2",
      "Notebook Lenovo IdeaPad",
      "NB-014",
      "Notebooks",
      "Lenovo",
      "Notebook 15,6 polegadas",
      4,
      2,
      310000,
      399900,
      "",
    ],
    [
      "p3",
      "SSD NVMe 1 TB",
      "SSD-1TB",
      "Armazenamento",
      "Kingston",
      "SSD PCIe 4.0",
      12,
      3,
      42000,
      59900,
      "",
    ],
    [
      "p4",
      "Memória DDR4 16 GB",
      "MEM-16",
      "Componentes",
      "Kingston",
      "Módulo 3200 MHz",
      2,
      4,
      18500,
      27900,
      "",
    ],
    [
      "p5",
      "Mouse sem fio",
      "PER-022",
      "Periféricos",
      "Logitech",
      "Mouse óptico",
      16,
      5,
      6500,
      11900,
      "",
    ],
    [
      "p6",
      "Cabo HDMI 2 m",
      "CAB-02",
      "Cabos e acessórios",
      "Pix",
      "Cabo HDMI 2.0",
      0,
      5,
      1800,
      3900,
      "",
    ],
    [
      "p7",
      "Roteador Wi-Fi 6",
      "NET-006",
      "Redes",
      "TP-Link",
      "Dual band gigabit",
      5,
      2,
      24900,
      34900,
      "",
    ],
    [
      "p8",
      "Pasta térmica 4 g",
      "COMP-PT",
      "Componentes",
      "Implastec",
      "Pasta para processador",
      6,
      2,
      900,
      1800,
      new Date(Date.parse(`${day}T00:00:00Z`) + 20 * 86400000)
        .toISOString()
        .slice(0, 10),
    ],
  ].map((a) => ({
    id: a[0] as string,
    name: a[1] as string,
    code: a[2] as string,
    category: a[3] as string,
    brand: a[4] as string,
    description: a[5] as string,
    quantity: a[6] as number,
    minimum: a[7] as number,
    cost: a[8] as number,
    price: a[9] as number,
    expiry: a[10] as string,
    active: true,
    createdAt: ts,
    updatedAt: ts,
  }));
  const movements: Movement[] = [
    {
      id: "m1",
      productId: "p3",
      productName: "SSD NVMe 1 TB",
      productCode: "SSD-1TB",
      type: "entrada",
      quantity: 12,
      before: 0,
      after: 12,
      reason: "Compra/reposição",
      note: "Compra mensal",
      user: "Marina Costa",
      date: ts,
    },
    {
      id: "m2",
      productId: "p5",
      productName: "Mouse sem fio",
      productCode: "PER-022",
      type: "saida",
      quantity: 2,
      before: 18,
      after: 16,
      reason: "Venda",
      note: "Venda balcão",
      user: "Lucas Almeida",
      date: ts,
    },
    {
      id: "m3",
      productId: "p4",
      productName: "Memória DDR4 16 GB",
      productCode: "MEM-16",
      type: "entrada",
      quantity: 2,
      before: 0,
      after: 2,
      reason: "Devolução",
      note: "Embalagem íntegra",
      user: "Marina Costa",
      date: ts,
    },
    {
      id: "m4",
      productId: "p6",
      productName: "Cabo HDMI 2 m",
      productCode: "CAB-02",
      type: "saida",
      quantity: 1,
      before: 1,
      after: 0,
      reason: "Perda/avaria",
      note: "Conector danificado",
      user: "Lucas Almeida",
      date: ts,
    },
  ];
  const orders: ServiceOrder[] = [
    {
      id: "os1",
      number: "OS-2026-041",
      equipment: "Notebook Acer Aspire 5",
      issue: "Não inicia após atualização",
      status: "Recebido",
      receivedAt: ts,
      deliveredAt: null,
      user: "Marina Costa",
      events: [{ status: "Recebido", date: ts, user: "Marina Costa" }],
    },
    {
      id: "os2",
      number: "OS-2026-042",
      equipment: "Desktop montado",
      issue: "Desligamentos durante jogos",
      status: "Em manutenção",
      receivedAt: ts,
      deliveredAt: null,
      user: "Lucas Almeida",
      events: [
        { status: "Recebido", date: ts, user: "Lucas Almeida" },
        { status: "Em manutenção", date: ts, user: "Marina Costa" },
      ],
    },
    {
      id: "os3",
      number: "OS-2026-043",
      equipment: "Notebook Dell Inspiron",
      issue: "Troca de teclado",
      status: "Aguardando devolução",
      receivedAt: ts,
      deliveredAt: null,
      user: "Marina Costa",
      events: [
        { status: "Recebido", date: ts, user: "Marina Costa" },
        { status: "Em manutenção", date: ts, user: "Lucas Almeida" },
        { status: "Aguardando devolução", date: ts, user: "Lucas Almeida" },
      ],
    },
    {
      id: "os4",
      number: "OS-2026-040",
      equipment: "PC compacto",
      issue: "Limpeza e revisão preventiva",
      status: "Entregue",
      receivedAt: ts,
      deliveredAt: ts,
      user: "Lucas Almeida",
      events: [
        { status: "Recebido", date: ts, user: "Lucas Almeida" },
        { status: "Entregue", date: ts, user: "Marina Costa" },
      ],
    },
  ];
  return { products, movements, orders };
}
