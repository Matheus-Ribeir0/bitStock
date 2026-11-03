"use client";
import { useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Field, Modal } from "./ui";
import { categories, reasons, type Command, type Product } from "@/lib/types";
export type Save = (command: Command, operationId: string) => Promise<void>;
export function ProductForm({
  product,
  onSave,
  onClose,
}: {
  product?: Product;
  onSave: Save;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [operationId] = useState(() => crypto.randomUUID());
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError("");
    setPending(true);
    const value = (key: string) => String(f.get(key) ?? "");
    const money = (key: string) =>
      value(key) === "" ? null : Math.round(Number(value(key)) * 100);
    try {
      await onSave(
        {
          kind: "product.save",
          id: product?.id,
          data: {
            name: value("name"),
            code: value("code"),
            category: value("category"),
            brand: value("brand"),
            description: value("description"),
            minimum: Number(value("minimum")),
            cost: money("cost"),
            price: money("price"),
            expiry: value("expiry"),
            initial: product?.quantity ?? Number(value("initial")),
          },
        },
        operationId,
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível salvar. Tente novamente.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal
      title={product ? "Editar produto" : "Cadastrar produto"}
      subtitle="Mantenha as informações do estoque organizadas."
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Nome do produto *" wide>
            <input
              name="name"
              required
              maxLength={120}
              defaultValue={product?.name}
              placeholder="Ex.: SSD NVMe 1 TB"
              autoFocus
            />
          </Field>
          <Field label="Código interno *">
            <input
              name="code"
              required
              maxLength={40}
              defaultValue={product?.code}
              placeholder="Ex.: SSD-001"
            />
          </Field>
          <Field label="Categoria *">
            <select
              name="category"
              required
              defaultValue={product?.category ?? ""}
            >
              <option value="" disabled>
                Selecione uma categoria
              </option>
              {categories.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Marca">
            <input
              name="brand"
              maxLength={80}
              defaultValue={product?.brand}
              placeholder="Opcional"
            />
          </Field>
          <Field label="Estoque mínimo">
            <input
              name="minimum"
              type="number"
              min="0"
              step="1"
              required
              defaultValue={product?.minimum ?? 0}
            />
          </Field>
          {!product ? (
            <Field
              label="Quantidade inicial"
              hint="Será registrada como entrada no histórico."
            >
              <input
                name="initial"
                type="number"
                min="0"
                step="1"
                required
                defaultValue={0}
              />
            </Field>
          ) : null}
          <Field label="Validade" hint="Preencha apenas quando aplicável.">
            <input name="expiry" type="date" defaultValue={product?.expiry} />
          </Field>
          <Field label="Preço de custo (R$)">
            <input
              name="cost"
              type="number"
              min="0"
              step="0.01"
              defaultValue={product?.cost == null ? "" : product.cost / 100}
              placeholder="Opcional"
            />
          </Field>
          <Field label="Preço de venda (R$)">
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              defaultValue={product?.price == null ? "" : product.price / 100}
              placeholder="Opcional"
            />
          </Field>
          <Field label="Descrição" wide>
            <textarea
              name="description"
              rows={2}
              maxLength={500}
              defaultValue={product?.description}
              placeholder="Informações complementares do produto"
            />
          </Field>
        </div>
        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : null}
        <div className="modal-footer">
          <button
            type="button"
            className="button secondary"
            disabled={pending}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="button primary" disabled={pending}>
            <Check size={17} />
            {pending ? "Salvando…" : "Salvar produto"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function MovementForm({
  products,
  type: initialType,
  productId: initialId,
  onSave,
  onClose,
}: {
  products: Product[];
  type: "entrada" | "saida";
  productId?: string;
  onSave: Save;
  onClose: () => void;
}) {
  const [productId, setProductId] = useState(initialId ?? "");
  const [type, setType] = useState(initialType);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [operationId] = useState(() => crypto.randomUUID());
  const product = products.find((p) => p.id === productId);
  const after = product
    ? product.quantity + (type === "entrada" ? quantity : -quantity)
    : null;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (after !== null && after < 0) return;
    const f = new FormData(e.currentTarget);
    setError("");
    setPending(true);
    try {
      await onSave(
        {
          kind: "movement.create",
          data: {
            productId,
            type,
            quantity,
            reason: String(f.get("reason")),
            note: String(f.get("note")),
          },
        },
        operationId,
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Falha ao registrar. Tente novamente.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal
      title="Registrar movimentação"
      subtitle="O saldo e o histórico são atualizados juntos."
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="type-switch">
          <button
            type="button"
            className={type === "entrada" ? "selected" : ""}
            onClick={() => setType("entrada")}
          >
            <ArrowDownLeft size={18} />
            Entrada
          </button>
          <button
            type="button"
            className={type === "saida" ? "selected" : ""}
            onClick={() => setType("saida")}
          >
            <ArrowUpRight size={18} />
            Saída
          </button>
        </div>
        <div className="form-grid">
          <Field label="Produto *" wide>
            <select
              required
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              autoFocus
            >
              <option value="">Selecione um produto</option>
              {products
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.code}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Quantidade *">
            <input
              type="number"
              required
              min="1"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              aria-invalid={after !== null && after < 0}
              aria-describedby={
                after !== null && after < 0 ? "balance-error" : undefined
              }
            />
          </Field>
          <Field label="Motivo *">
            <select
              name="reason"
              required
              defaultValue={
                initialType === "entrada" ? "Compra/reposição" : "Venda"
              }
            >
              {reasons.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="Observação" wide>
            <textarea
              name="note"
              rows={2}
              maxLength={300}
              placeholder="Detalhes ou justificativa do ajuste"
            />
          </Field>
        </div>
        {product ? (
          <div className="balance-preview">
            <span>
              Saldo atual <strong>{product.quantity} un.</strong>
            </span>
            <span>
              Após a operação <strong>{after} un.</strong>
            </span>
          </div>
        ) : null}
        {after !== null && after < 0 ? (
          <p id="balance-error" role="alert" className="form-error">
            <AlertTriangle size={16} />
            Estoque insuficiente. Disponível: {product?.quantity} unidades.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : null}
        <div className="modal-footer">
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={pending}
          >
            Cancelar
          </button>
          <button
            className="button primary"
            disabled={pending || !product || (after !== null && after < 0)}
          >
            {pending ? "Registrando…" : "Confirmar movimentação"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function OrderForm({
  onSave,
  onClose,
}: {
  onSave: Save;
  onClose: () => void;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [operationId] = useState(() => crypto.randomUUID());
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    setError("");
    try {
      await onSave(
        {
          kind: "order.create",
          data: {
            equipment: String(f.get("equipment")),
            issue: String(f.get("issue")),
          },
        },
        operationId,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar ordem.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal
      title="Nova ordem de serviço"
      subtitle="Registre o recebimento de um equipamento para manutenção."
      onClose={() => {
        if (!pending) onClose();
      }}
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Identificação do equipamento *" wide>
            <input
              name="equipment"
              required
              maxLength={160}
              placeholder="Ex.: Notebook Dell Inspiron 15, prata"
              autoFocus
            />
          </Field>
          <Field label="Problema relatado *" wide>
            <textarea
              name="issue"
              required
              maxLength={1000}
              rows={4}
              placeholder="Descreva o motivo da entrada do equipamento"
            />
          </Field>
        </div>
        <p className="info-note">
          O número da ordem, a data de recebimento e o responsável serão
          registrados automaticamente. Este equipamento não entra no estoque de
          venda.
        </p>
        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : null}
        <div className="modal-footer">
          <button
            type="button"
            className="button secondary"
            disabled={pending}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="button primary" disabled={pending}>
            {pending ? "Criando…" : "Criar ordem de serviço"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
