import React, { useState, useEffect, useCallback } from 'react';
import api from '../utils/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import TableBase, { AutoInput } from './TableBase.jsx';
import DebtorsTable from './DebtorsTable.jsx';
import ItemSearch from './ItemSearch.jsx';
import Calculator from './Calculator.jsx';

// ── Shared helpers ────────────────────────────────────────────────────────────
function Field({ label, children, hint }) {
  return (
    <div className="form-group" style={{ marginBottom: 0 }}>
      <label className="form-label">{label}</label>
      {children}
      {hint && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>{hint}</div>}
    </div>
  );
}

function FormGrid({ children, onSave, onCancel, saving, submitLabel }) {
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(); }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {children}
      </div>
      <div className="flex gap-2 mt-4">
        <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
          {saving ? <span className="spinner"></span> : (submitLabel || 'Save')}
        </button>
        <button className="btn btn-secondary btn-sm" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// Hook: look up live stock for a given item number
function useStockCheck(itemNumber) {
  const [stock, setStock] = useState(null);
  useEffect(() => {
    if (!itemNumber || itemNumber.trim() === '') { setStock(null); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.post(`/tables/stockcheck`, { item_number: itemNumber.trim() });
        setStock(data);
      } catch {
        setStock(null);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [itemNumber]);
  return stock;
}

// Stock badge shown next to item number field
function StockBadge({ stock }) {
  if (!stock) return null;
  if (!stock.found) return (
    <div style={{ fontSize: 11, color: 'var(--red)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
      ⚠ Item not found in In Stock
    </div>
  );
  return (
    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', marginTop: 4,
      color: stock.quantity < 5 ? 'var(--red)' : stock.quantity < 20 ? 'var(--orange)' : 'var(--green)' }}>
      Stock available: <strong>{stock.quantity}</strong> units
    </div>
  );
}

// ── 1. IN STOCK form ──────────────────────────────────────────────────────────
function InStockForm({ onSave, onCancel, saving, itemOptions }) {
  const [f, setF] = useState({ item_number: '', quantity: '', price: '', image_url: '', low_stock_threshold: '10' });
  const stock = useStockCheck(f.item_number);
  const s = k => v => setF(p => ({ ...p, [k]: v }));
  return (
    <FormGrid onSave={() => onSave(f)} onCancel={onCancel} saving={saving}
      submitLabel={stock?.found ? 'Add to Existing Stock' : 'Add New Item'}>
      <Field label="Item Number" hint={stock?.found ? `Will add to existing stock of ${stock.quantity}` : 'New item will be created'}>
        <AutoInput value={f.item_number} onChange={s('item_number')} options={itemOptions} placeholder="e.g. ITM-001" required />
      </Field>
      <Field label="Quantity">
        <input className="form-input" type="number" min="0" value={f.quantity}
          onChange={e => setF(p => ({ ...p, quantity: e.target.value }))} required placeholder="0" />
      </Field>
      <Field label="Price (₦)">
        <input className="form-input" type="number" min="0" value={f.price}
          onChange={e => setF(p => ({ ...p, price: e.target.value }))} required placeholder="0" />
      </Field>
      <Field label="Low Stock Alert At">
        <input className="form-input" type="number" min="1" value={f.low_stock_threshold}
          onChange={e => setF(p => ({ ...p, low_stock_threshold: e.target.value }))} placeholder="10" />
      </Field>
      <Field label="Image URL (optional)">
        <input className="form-input" value={f.image_url}
          onChange={e => setF(p => ({ ...p, image_url: e.target.value }))} placeholder="https://..." />
      </Field>
    </FormGrid>
  );
}

// ── 1b. RESTOCK ITEM form ──────────────────────────────────────────────────────
function RestockItemForm({ onSave, onCancel, saving, itemOptions }) {
  const [f, setF] = useState({ item_number: '', quantity: '', price: '', image_url: '', low_stock_threshold: '10' });
  const stock = useStockCheck(f.item_number);
  const s = k => v => setF(p => ({ ...p, [k]: v }));
  return (
    <FormGrid onSave={() => onSave(f)} onCancel={onCancel} saving={saving}
      submitLabel="Restock Item">
      <Field label="Item Number" hint="Adds to Restock History & In Stock balance">
        <AutoInput value={f.item_number} onChange={s('item_number')} options={itemOptions} placeholder="e.g. ITM-001" required />
      </Field>
      <Field label="Quantity">
        <input className="form-input" type="number" min="0" value={f.quantity}
          onChange={e => setF(p => ({ ...p, quantity: e.target.value }))} required placeholder="0" />
      </Field>
      <Field label="Price (₦)">
        <input className="form-input" type="number" min="0" value={f.price}
          onChange={e => setF(p => ({ ...p, price: e.target.value }))} required placeholder="0" />
      </Field>
      <Field label="Low Stock Alert At">
        <input className="form-input" type="number" min="1" value={f.low_stock_threshold}
          onChange={e => setF(p => ({ ...p, low_stock_threshold: e.target.value }))} placeholder="10" />
      </Field>
      <Field label="Image URL (optional)">
        <input className="form-input" value={f.image_url}
          onChange={e => setF(p => ({ ...p, image_url: e.target.value }))} placeholder="https://..." />
      </Field>
    </FormGrid>
  );
}

// ── 2. SOLD OUT form ──────────────────────────────────────────────────────────
function SoldOutForm({ onSave, onCancel, saving, itemOptions }) {
  const [f, setF] = useState({ item_number: '', quantity: '', customer_info: '', price: '' });
  const [feedback, setFeedback] = useState('');
  const stock = useStockCheck(f.item_number);
  const s = k => v => setF(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setFeedback('');
    try {
      const res = await onSave(f);
      if (res?.stockRemaining !== undefined) {
        setFeedback(`✓ Sale recorded. "${f.item_number}" stock remaining: ${res.stockRemaining}`);
      }
    } catch(e) {}
  };

  return (
    <div>
      <FormGrid onSave={handleSave} onCancel={onCancel} saving={saving} submitLabel="Record Sale">
        <div>
          <Field label="Item Number">
            <AutoInput value={f.item_number} onChange={s('item_number')} options={itemOptions} placeholder="e.g. ITM-001" required />
          </Field>
          <StockBadge stock={stock} />
        </div>
        <Field label="Quantity Sold">
          <input className="form-input" type="number" min="1" value={f.quantity}
            onChange={e => setF(p => ({ ...p, quantity: e.target.value }))} required placeholder="0"
          />
          {stock?.found && f.quantity && Number(f.quantity) > stock.quantity && (
            <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
              ⚠ Exceeds available stock ({stock.quantity})
            </div>
          )}
        </Field>
        <Field label="Price (₦)">
          <input className="form-input" type="number" min="0" value={f.price}
            onChange={e => setF(p => ({ ...p, price: e.target.value }))} required placeholder="0" />
        </Field>
        <Field label="Customer Info (optional)">
          <input className="form-input" value={f.customer_info}
            onChange={e => setF(p => ({ ...p, customer_info: e.target.value }))} placeholder="Name / Phone" />
        </Field>
      </FormGrid>
      {feedback && (
        <div className="alert alert-success" style={{ marginTop: 10 }}>{feedback}</div>
      )}
    </div>
  );
}

// ── 3. DEBTORS form ───────────────────────────────────────────────────────────
function DebtorForm({ onSave, onCancel, saving, itemOptions }) {
  const [f, setF] = useState({ customer_info: '', price: '', item_number: '', quantity: '' });
  const stock = useStockCheck(f.item_number);
  const s = k => v => setF(p => ({ ...p, [k]: v }));
  return (
    <FormGrid onSave={() => onSave(f)} onCancel={onCancel} saving={saving} submitLabel="Add Debtor">
      <Field label="Customer Info">
        <input className="form-input" value={f.customer_info}
          onChange={e => setF(p => ({ ...p, customer_info: e.target.value }))} required placeholder="Name / Phone" />
      </Field>
      <div>
        <Field label="Item Number">
          <AutoInput value={f.item_number} onChange={s('item_number')} options={itemOptions} placeholder="e.g. ITM-001" required />
        </Field>
        <StockBadge stock={stock} />
      </div>
      <Field label="Quantity Taken">
        <input className="form-input" type="number" min="1" value={f.quantity}
          onChange={e => setF(p => ({ ...p, quantity: e.target.value }))} required placeholder="0" />
        {stock?.found && f.quantity && Number(f.quantity) > stock.quantity && (
          <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
            ⚠ Exceeds available stock ({stock.quantity})
          </div>
        )}
      </Field>
      <Field label="Amount Owed (₦)">
        <input className="form-input" type="number" min="0" value={f.price}
          onChange={e => setF(p => ({ ...p, price: e.target.value }))} required placeholder="0" />
      </Field>
    </FormGrid>
  );
}

// ── 5. RETURNED ITEMS form ────────────────────────────────────────────────────
function ReturnedForm({ onSave, onCancel, saving, itemOptions }) {
  const [f, setF] = useState({ item_number: '', quantity: '', customer_info: '' });
  const [feedback, setFeedback] = useState('');
  const stock = useStockCheck(f.item_number);
  const s = k => v => setF(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setFeedback('');
    try {
      const res = await onSave(f);
      if (res?.stockAfter !== undefined) {
        setFeedback(`✓ Return recorded. "${f.item_number}" stock now: ${res.stockAfter}`);
      }
    } catch(e) {}
  };

  return (
    <div>
      <FormGrid onSave={handleSave} onCancel={onCancel} saving={saving} submitLabel="Record Return">
        <div>
          <Field label="Item Number">
            <AutoInput value={f.item_number} onChange={s('item_number')} options={itemOptions} placeholder="e.g. ITM-001" required />
          </Field>
          {stock?.found && (
            <div style={{ fontSize: 11, color: 'var(--blue)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
              Current stock: {stock.quantity} → will become {stock.quantity + (Number(f.quantity) || 0)} after return
            </div>
          )}
          {stock && !stock.found && (
            <div style={{ fontSize: 11, color: 'var(--red)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
              ⚠ Item not found in stock
            </div>
          )}
        </div>
        <Field label="Quantity Returned">
          <input className="form-input" type="number" min="1" value={f.quantity}
            onChange={e => setF(p => ({ ...p, quantity: e.target.value }))} required placeholder="0" />
        </Field>
        <Field label="Returned By">
          <input className="form-input" value={f.customer_info}
            onChange={e => setF(p => ({ ...p, customer_info: e.target.value }))} placeholder="Name / Phone" />
        </Field>
      </FormGrid>
      {feedback && <div className="alert alert-success" style={{ marginTop: 10 }}>{feedback}</div>}
    </div>
  );
}

// ── Column formatters ─────────────────────────────────────────────────────────
const fmtNaira = v => v != null ? `₦${Number(v).toLocaleString()}` : '—';
const fmtWorker = row => row.worker_id?.name || '—';

// ── Column definitions ────────────────────────────────────────────────────────
const IN_STOCK_COLS = [
  { key: 'item',      label: 'Item Number',     field: 'item_number', autocomplete: true,
    valueStyle: () => ({ color: 'var(--text)', fontWeight: 500 }) },
  { key: 'qty',       label: 'Quantity',         field: 'quantity',    type: 'number', mono: true,
    valueStyle: r => ({ color: r.quantity <= r.low_stock_threshold ? 'var(--red)' : 'var(--accent)', fontWeight: 700 }) },
  { key: 'price',     label: 'Price (₦)',        field: 'price',       type: 'number', mono: true, format: fmtNaira },
  { key: 'threshold', label: 'Alert At',         field: 'low_stock_threshold', type: 'number', mono: true,
    valueStyle: () => ({ color: 'var(--text-dim)', fontSize: 11 }) },
  { key: 'image',     label: 'Image',            field: 'image_url',
    render: (row, isEditing, editData, setField) => isEditing
      ? <input className="inline-input" style={{ width: 160 }} value={editData.image_url || ''}
          onChange={e => setField('image_url', e.target.value)} placeholder="URL" />
      : row.image_url
        ? <a href={row.image_url} target="_blank" rel="noreferrer"
            style={{ color: 'var(--blue)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>View</a>
        : <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>—</span>
  },
  { key: 'date',   label: 'Date',   field: 'date',   mono: true, valueStyle: () => ({ color: 'var(--text-dim)', fontSize: 11 }) },
  { key: 'worker', label: 'Worker', render: row => <span style={{ color: 'var(--blue)', fontSize: 12 }}>{fmtWorker(row)}</span> },
  { key: 'status', label: 'Status', render: row => (
    <span className={`badge ${row.quantity <= row.low_stock_threshold ? 'badge-locked' : 'badge-editable'}`}>
      {row.quantity <= row.low_stock_threshold ? '⚠ Low' : '✓ OK'}
    </span>
  )},
];

const RESTOCK_ITEM_COLS = [
  { key: 'item',      label: 'Item Number',     field: 'item_number', autocomplete: true,
    valueStyle: () => ({ color: 'var(--text)', fontWeight: 500 }) },
  { key: 'qty',       label: 'Quantity Added',         field: 'quantity',    type: 'number', mono: true, valueStyle: () => ({ color: 'var(--green)' }) },
  { key: 'price',     label: 'Price (₦)',        field: 'price',       type: 'number', mono: true, format: fmtNaira },
  { key: 'image',     label: 'Image',            field: 'image_url',
    render: row => row.image_url
        ? <a href={row.image_url} target="_blank" rel="noreferrer"
            style={{ color: 'var(--blue)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>View</a>
        : <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>—</span>
  },
  { key: 'date',   label: 'Date',   field: 'date',   mono: true, valueStyle: () => ({ color: 'var(--text-dim)', fontSize: 11 }) },
  { key: 'worker', label: 'Worker', render: row => <span style={{ color: 'var(--blue)', fontSize: 12 }}>{fmtWorker(row)}</span> },
];

const SOLD_OUT_COLS = [
  { key: 'date',     label: 'Date',          field: 'date',          mono: true, valueStyle: () => ({ color: 'var(--text-dim)', fontSize: 11 }) },
  { key: 'item',     label: 'Item Number',   field: 'item_number',   autocomplete: true,
    valueStyle: () => ({ color: 'var(--text)', fontWeight: 500 }) },
  { key: 'qty',      label: 'Qty Sold',      field: 'quantity',      type: 'number', mono: true,
    valueStyle: () => ({ color: 'var(--orange)' }) },
  { key: 'customer', label: 'Customer Info', field: 'customer_info',
    valueStyle: () => ({ color: 'var(--text-muted)' }) },
  { key: 'price',    label: 'Price (₦)',     field: 'price',         type: 'number', mono: true, format: fmtNaira },
  { key: 'worker',   label: 'Worker',        render: row => <span style={{ color: 'var(--blue)', fontSize: 12 }}>{fmtWorker(row)}</span> },
];

const DEBTOR_COLS = [
  { key: 'date',     label: 'Date',          field: 'date',          mono: true, valueStyle: () => ({ color: 'var(--text-dim)', fontSize: 11 }) },
  { key: 'customer', label: 'Customer Info', field: 'customer_info',
    valueStyle: () => ({ color: 'var(--text)', fontWeight: 500 }) },
  { key: 'item',     label: 'Item Number',   field: 'item_number',   autocomplete: true,
    valueStyle: () => ({ color: 'var(--text-muted)' }) },
  { key: 'qty',      label: 'Quantity',      field: 'quantity',      type: 'number', mono: true },
  { key: 'price',    label: 'Amount Owed (₦)', field: 'price',       type: 'number', mono: true,
    format: fmtNaira, valueStyle: r => ({ color: r.paid ? 'var(--green)' : 'var(--red)' }) },
  { key: 'paid', label: 'Status', field: 'paid',
    render: (row, isEditing, editData, setField) => isEditing
      ? <select className="form-input" style={{ width: 100, padding: '4px 8px' }}
          value={editData.paid ? 'true' : 'false'}
          onChange={e => setField('paid', e.target.value === 'true')}>
          <option value="false">Owes</option>
          <option value="true">Paid</option>
        </select>
      : <span className={`badge ${row.paid ? 'badge-editable' : 'badge-locked'}`}>
          {row.paid ? '✓ Paid' : 'Owes'}
        </span>
  },
  { key: 'worker', label: 'Worker', render: row => <span style={{ color: 'var(--blue)', fontSize: 12 }}>{fmtWorker(row)}</span> },
];

const RESTOCKED_COLS = [
  { key: 'item',      label: 'Item Number',      field: 'item_number',
    valueStyle: () => ({ color: 'var(--text)', fontWeight: 500 }) },
  { key: 'qty',       label: 'Qty Remaining',    field: 'quantity',      mono: true,
    valueStyle: () => ({ color: 'var(--red)', fontWeight: 700 }) },
  { key: 'threshold', label: 'Alert Threshold',  field: 'low_stock_threshold', mono: true,
    valueStyle: () => ({ color: 'var(--text-dim)' }) },
  { key: 'date',   label: 'Last Updated', field: 'date',   mono: true, valueStyle: () => ({ color: 'var(--text-dim)', fontSize: 11 }) },
  { key: 'worker', label: 'Worker',       render: row => <span style={{ color: 'var(--blue)', fontSize: 12 }}>{fmtWorker(row)}</span> },
  { key: 'alert',  label: 'Action',       render: () => <span className="badge badge-locked">⚠ Restock Now</span> },
];

const RETURNED_COLS = [
  { key: 'item',     label: 'Item Number', field: 'item_number',  autocomplete: true,
    valueStyle: () => ({ color: 'var(--text)', fontWeight: 500 }) },
  { key: 'date',     label: 'Date',        field: 'date',         mono: true, valueStyle: () => ({ color: 'var(--text-dim)', fontSize: 11 }) },
  { key: 'qty',      label: 'Qty Returned',field: 'quantity',     type: 'number', mono: true,
    valueStyle: () => ({ color: 'var(--blue)' }) },
  { key: 'customer', label: 'Returned By', field: 'customer_info',
    valueStyle: () => ({ color: 'var(--text-muted)' }) },
  { key: 'worker',   label: 'Worker',      render: row => <span style={{ color: 'var(--blue)', fontSize: 12 }}>{fmtWorker(row)}</span> },
];

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'instock',   label: 'In Stock',      icon: '📦' },
  { id: 'soldout',   label: 'Sold Out',      icon: '🛒' },
  { id: 'debtors',   label: 'Debtors',       icon: '💳' },
  { id: 'restockitem', label: 'Restock Item',  icon: '📥' },
  { id: 'restocked', label: 'Restock Alert', icon: '⚠️' },
  { id: 'returned',  label: 'Returned',      icon: '↩️' },
];

// ── InStock wrapper: workers view-only, admins can edit ───────────────────────
function InStockTabWrapper({ itemOptions, refreshSignal, makeOnSave, isAdmin }) {
  return (
    <TableBase
      title="In Stock"
      subtitle={
        isAdmin
          ? 'Full control. Adding an existing item number tops up its quantity.'
          : 'View-only for workers. Only admins can edit stock. You can still search items above.'
      }
      endpoint="instock"
      columns={IN_STOCK_COLS}
      addForm={isAdmin ? (props) => <InStockForm {...props} onSave={makeOnSave('instock')} /> : null}
      itemOptions={itemOptions}
      emptyMsg="No stock items yet"
      refreshSignal={refreshSignal}
      canAdd={isAdmin}
      canDelete={isAdmin}
      workerReadOnly={!isAdmin}
    />
  );
}

// ── Main AllTables Component ──────────────────────────────────────────────────
export default function AllTables({ refreshSignal }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState('instock');
  const [itemOptions, setItemOptions] = useState([]);
  const [innerRefresh, setInnerRefresh] = useState(0);
  const [showCalc, setShowCalc] = useState(false);

  const refresh = () => setInnerRefresh(s => s + 1);

  const fetchItems = useCallback(async () => {
    try {
      const res = await api.get('/tables/items');
      setItemOptions(res.data);
    } catch {}
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems, refreshSignal, innerRefresh]);

  const makeOnSave = (endpoint) => async (data) => {
    const res = await api.post(`/tables/${endpoint}`, data);
    refresh();
    fetchItems();
    return res.data;
  };

  const sig = `${refreshSignal}-${innerRefresh}`;

  return (
    <div>
      {/* Search bar + Calculator button */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <ItemSearch itemOptions={itemOptions} />
        </div>
        <button onClick={() => setShowCalc(true)} className="btn btn-secondary"
          style={{ padding: '11px 16px', borderRadius: 8, display: 'flex', alignItems: 'center',
            gap: 8, border: '1px solid var(--border-light)', whiteSpace: 'nowrap' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <rect x="4" y="2" width="16" height="20" rx="2"/>
            <line x1="8" y1="6" x2="16" y2="6"/>
            <line x1="8" y1="10" x2="16" y2="10"/>
            <line x1="8" y1="14" x2="12" y2="14"/>
          </svg>
          Calculator
        </button>
      </div>

      {showCalc && <Calculator onClose={() => setShowCalc(false)} />}

      {/* Tab nav */}
      <div className="tab-nav">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`tab-item ${activeTab === t.id ? 'active' : ''}`}>
            <span style={{ marginRight: 6 }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {activeTab === 'instock' && (
        <InStockTabWrapper
          itemOptions={itemOptions}
          refreshSignal={sig}
          makeOnSave={makeOnSave}
          isAdmin={isAdmin}
        />
      )}
      {activeTab === 'soldout' && (
        <TableBase title="Sold Out" subtitle="Recording a sale automatically deducts from In Stock. Cannot sell more than available."
          endpoint="soldout" columns={SOLD_OUT_COLS}
          addForm={(props) => <SoldOutForm {...props} onSave={makeOnSave('soldout')} />}
          itemOptions={itemOptions} emptyMsg="No sales recorded yet"
          refreshSignal={sig} canAdd canDelete />
      )}
      {activeTab === 'debtors' && (
        <DebtorsTable itemOptions={itemOptions} refreshSignal={sig} />
      )}
      {activeTab === 'restocked' && (
        <TableBase title="Restock Alert" subtitle="Auto-calculated from In Stock. Items shown here are at or below their low stock threshold. Read-only."
          endpoint="restocked" columns={RESTOCKED_COLS}
          emptyMsg="✓ All items are well stocked"
          refreshSignal={sig} canAdd={false} readOnly />
      )}
      {activeTab === 'restockitem' && (
        <TableBase title="Restock Item" subtitle="Logs restocked items. Adding here also updates the In Stock balance. Cannot edit or delete."
          endpoint="restockitem" columns={RESTOCK_ITEM_COLS}
          addForm={(props) => <RestockItemForm {...props} onSave={makeOnSave('restockitem')} />}
          itemOptions={itemOptions} emptyMsg="No restock history"
          refreshSignal={sig} canAdd={true} canDelete={false} workerReadOnly={false} />
      )}
      {activeTab === 'returned' && (
        <TableBase title="Returned Items" subtitle="Recording a return adds the quantity back to In Stock automatically."
          endpoint="returned" columns={RETURNED_COLS}
          addForm={(props) => <ReturnedForm {...props} onSave={makeOnSave('returned')} />}
          itemOptions={itemOptions} emptyMsg="No returns recorded"
          refreshSignal={sig} canAdd canDelete />
      )}
    </div>
  );
}
