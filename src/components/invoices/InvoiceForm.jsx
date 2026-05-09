import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function InvoiceForm({ onSubmit, onCancel, isSubmitting, nextNumber }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    invoice_number: nextNumber || '',
    client_name: '',
    client_email: '',
    client_address: '',
    items: [{ description: '', quantity: 1, unit_price: 0, total: 0 }],
    tax_rate: 19,
    due_date: '',
    notes: '',
    status: 'entwurf',
  });

  const updateItem = (idx, field, value) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    if (field === 'quantity' || field === 'unit_price') {
      items[idx].total = (items[idx].quantity || 0) * (items[idx].unit_price || 0);
    }
    setForm(prev => ({ ...prev, items }));
  };

  const addItem = () => setForm(prev => ({
    ...prev,
    items: [...prev.items, { description: '', quantity: 1, unit_price: 0, total: 0 }],
  }));

  const removeItem = (idx) => setForm(prev => ({
    ...prev,
    items: prev.items.filter((_, i) => i !== idx),
  }));

  const subtotal = form.items.reduce((sum, item) => sum + (item.total || 0), 0);
  const taxAmount = subtotal * (form.tax_rate / 100);
  const totalAmount = subtotal + taxAmount;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...form,
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
    });
  };

  return (
    <Card className="p-6">
      <h2 className="font-display text-xl font-semibold mb-6">{t('invoiceForm.title')}</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('invoiceForm.invoiceNumber')}</Label>
            <Input value={form.invoice_number} onChange={(e) => setForm(p => ({ ...p, invoice_number: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>{t('invoiceForm.dueDate')}</Label>
            <Input type="date" value={form.due_date} onChange={(e) => setForm(p => ({ ...p, due_date: e.target.value }))} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('invoiceForm.clientName')}</Label>
            <Input value={form.client_name} onChange={(e) => setForm(p => ({ ...p, client_name: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>{t('invoiceForm.clientEmail')}</Label>
            <Input type="email" value={form.client_email} onChange={(e) => setForm(p => ({ ...p, client_email: e.target.value }))} />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('invoiceForm.clientAddress')}</Label>
          <Textarea value={form.client_address} onChange={(e) => setForm(p => ({ ...p, client_address: e.target.value }))} rows={2} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <Label className="text-base">{t('invoiceForm.positions')}</Label>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="w-3 h-3 mr-1" />{t('invoiceForm.add')}
            </Button>
          </div>
          <div className="space-y-3">
            {form.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-12 sm:col-span-5">
                  {idx === 0 && <Label className="text-xs text-muted-foreground">{t('invoiceForm.description')}</Label>}
                  <Input value={item.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} placeholder={t('invoiceForm.description')} />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  {idx === 0 && <Label className="text-xs text-muted-foreground">{t('invoiceForm.quantity')}</Label>}
                  <Input type="number" min="0" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  {idx === 0 && <Label className="text-xs text-muted-foreground">{t('invoiceForm.price')}</Label>}
                  <Input type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} />
                </div>
                <div className="col-span-3 sm:col-span-2">
                  {idx === 0 && <Label className="text-xs text-muted-foreground">{t('invoiceForm.sum')}</Label>}
                  <p className="h-10 flex items-center font-medium">{item.total.toFixed(2)} €</p>
                </div>
                <div className="col-span-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)} disabled={form.items.length <= 1}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 pt-4 border-t">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">{t('invoiceForm.subtotal')}</span>
            <span className="font-medium w-24 text-right">{subtotal.toFixed(2)} €</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">{t('invoiceForm.vat', { rate: form.tax_rate })}</span>
            <span className="font-medium w-24 text-right">{taxAmount.toFixed(2)} €</span>
          </div>
          <div className="flex items-center gap-4 text-lg font-bold">
            <span>{t('invoiceForm.total')}</span>
            <span className="w-24 text-right text-primary">{totalAmount.toFixed(2)} €</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t('invoiceForm.notes')}</Label>
          <Textarea value={form.notes} onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} placeholder={t('invoiceForm.notesPlaceholder')} />
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('invoiceForm.create')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
