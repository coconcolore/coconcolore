import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download } from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import html2canvas from 'html2canvas';
import jspdf from 'jspdf';

export default function InvoicePreview({ invoice, onClose }) {
  const printRef = useRef();

  const handleDownloadPDF = async () => {
    const element = printRef.current;
    const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jspdf('p', 'mm', 'a4');
    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(`${invoice.invoice_number}.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center overflow-y-auto p-4 md:p-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
        {/* Actions bar */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-display font-semibold text-foreground">Rechnungsvorschau</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
              <Download className="w-4 h-4 mr-2" />PDF
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Invoice content */}
        <div ref={printRef} className="p-8 md:p-12 bg-white text-foreground">
          {/* Header */}
          <div className="flex justify-between items-start mb-10">
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground">RECHNUNG</h1>
              <p className="text-sm text-muted-foreground mt-1">{invoice.invoice_number}</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold text-foreground">KursStudio</p>
              <p className="text-muted-foreground">Deine Adresse hier</p>
            </div>
          </div>

          {/* Client & Date */}
          <div className="grid grid-cols-2 gap-8 mb-10">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Rechnungsempfänger</p>
              <p className="font-semibold text-foreground">{invoice.client_name}</p>
              {invoice.client_email && <p className="text-sm text-muted-foreground">{invoice.client_email}</p>}
              {invoice.client_address && <p className="text-sm text-muted-foreground whitespace-pre-line">{invoice.client_address}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Details</p>
              <p className="text-sm text-foreground">
                Datum: {format(new Date(invoice.created_date), 'dd.MM.yyyy', { locale: de })}
              </p>
              {invoice.due_date && (
                <p className="text-sm text-foreground">
                  Fällig: {format(new Date(invoice.due_date), 'dd.MM.yyyy', { locale: de })}
                </p>
              )}
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full mb-8">
            <thead>
              <tr className="border-b-2 border-foreground/10">
                <th className="text-left py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Beschreibung</th>
                <th className="text-right py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Menge</th>
                <th className="text-right py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Preis</th>
                <th className="text-right py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Summe</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((item, idx) => (
                <tr key={idx} className="border-b border-foreground/5">
                  <td className="py-3 text-sm text-foreground">{item.description}</td>
                  <td className="py-3 text-sm text-right text-foreground">{item.quantity}</td>
                  <td className="py-3 text-sm text-right text-foreground">{item.unit_price?.toFixed(2)} €</td>
                  <td className="py-3 text-sm text-right font-medium text-foreground">{item.total?.toFixed(2)} €</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Zwischensumme</span>
                <span className="text-foreground">{invoice.subtotal?.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">MwSt. ({invoice.tax_rate || 19}%)</span>
                <span className="text-foreground">{invoice.tax_amount?.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t-2 border-foreground/10">
                <span className="text-foreground">Gesamt</span>
                <span style={{color: 'hsl(38, 80%, 50%)'}}>{invoice.total_amount?.toFixed(2)} €</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="mt-10 pt-6 border-t border-foreground/5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Anmerkungen</p>
              <p className="text-sm text-muted-foreground">{invoice.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}