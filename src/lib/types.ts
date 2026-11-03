export const categories = [
  "Computadores",
  "Notebooks",
  "Componentes",
  "Periféricos",
  "Armazenamento",
  "Redes",
  "Cabos e acessórios",
] as const;
export const statuses = [
  "Recebido",
  "Em manutenção",
  "Aguardando devolução",
  "Entregue",
] as const;
export const reasons = [
  "Estoque inicial",
  "Compra/reposição",
  "Venda",
  "Devolução",
  "Perda/avaria",
  "Ajuste de inventário",
] as const;
export type Status = (typeof statuses)[number];
export interface Product {
  id: string;
  name: string;
  code: string;
  category: string;
  brand: string;
  description: string;
  quantity: number;
  minimum: number;
  cost: number | null;
  price: number | null;
  expiry: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface Movement {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  type: "entrada" | "saida";
  quantity: number;
  before: number;
  after: number;
  reason: string;
  note: string;
  user: string;
  date: string;
}
export interface OrderEvent {
  status: Status;
  date: string;
  user: string;
}
export interface ServiceOrder {
  id: string;
  number: string;
  equipment: string;
  issue: string;
  status: Status;
  receivedAt: string;
  deliveredAt: string | null;
  user: string;
  events: OrderEvent[];
}
export interface Store {
  products: Product[];
  movements: Movement[];
  orders: ServiceOrder[];
}
export type Command =
  | {
      kind: "product.save";
      id?: string;
      data: {
        name: string;
        code: string;
        category: string;
        brand: string;
        description: string;
        minimum: number;
        cost: number | null;
        price: number | null;
        expiry: string;
        initial: number;
      };
    }
  | { kind: "product.archive"; id: string }
  | {
      kind: "movement.create";
      data: {
        productId: string;
        type: "entrada" | "saida";
        quantity: number;
        reason: string;
        note: string;
      };
    }
  | { kind: "order.create"; data: { equipment: string; issue: string } }
  | { kind: "order.status"; id: string; status: Status };
