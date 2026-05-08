import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function AddressAutocomplete({ value, onChange, onSelect }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const debouncedValue = useDebounce(value, 400);

  useEffect(() => {
    const handler = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!debouncedValue || debouncedValue.length < 4) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(debouncedValue)}&format=json&addressdetails=1&limit=6&countrycodes=de,at,ch`,
      { headers: { 'Accept-Language': 'de' } }
    )
      .then(r => r.json())
      .then(data => {
        setSuggestions(data);
        setOpen(data.length > 0);
      })
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, [debouncedValue]);

  const handleSelect = (item) => {
    const addr = item.address || {};
    const street = [addr.road, addr.house_number].filter(Boolean).join(' ');
    onSelect({
      street: street || value,
      zip: addr.postcode || '',
      city: addr.city || addr.town || addr.village || addr.municipality || '',
      country: addr.country || '',
    });
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div className="space-y-2" ref={ref}>
      <Label>Straße & Hausnummer</Label>
      <div className="relative">
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Musterstraße 42"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />
        )}
        {open && suggestions.length > 0 && (
          <ul className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-56 overflow-auto text-sm">
            {suggestions.map((item, i) => (
              <li
                key={i}
                className="px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground leading-snug"
                onMouseDown={() => handleSelect(item)}
              >
                <span className="font-medium">
                  {[item.address?.road, item.address?.house_number].filter(Boolean).join(' ')}
                </span>
                {item.address?.postcode || item.address?.city ? (
                  <span className="text-muted-foreground ml-1 text-xs">
                    — {[item.address?.postcode, item.address?.city || item.address?.town || item.address?.village].filter(Boolean).join(' ')}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function InvoiceTab({ profile, update }) {
  const handleAddressSelect = ({ street, zip, city, country }) => {
    update('invoice_street', street);
    update('invoice_zip', zip);
    update('invoice_city', city);
    update('invoice_country', country);
  };

  return (
    <Card className="p-6 space-y-5">
      <p className="text-sm text-muted-foreground">Diese Daten erscheinen auf deinen Rechnungen</p>

      <div className="space-y-2">
        <Label>Name / Firma *</Label>
        <Input
          value={profile.invoice_name}
          onChange={e => update('invoice_name', e.target.value)}
          placeholder="Max Mustermann oder Galerie XY GmbH"
        />
      </div>

      <div className="space-y-2">
        <Label>Telefonnummer *</Label>
        <Input
          type="tel"
          value={profile.phone}
          onChange={e => update('phone', e.target.value)}
          placeholder="+49 123 456789"
          required
        />
      </div>

      <AddressAutocomplete
        value={profile.invoice_street}
        onChange={val => update('invoice_street', val)}
        onSelect={handleAddressSelect}
      />

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label>PLZ</Label>
          <Input
            value={profile.invoice_zip}
            onChange={e => update('invoice_zip', e.target.value)}
            placeholder="12345"
            maxLength={10}
          />
        </div>
        <div className="col-span-2 space-y-2">
          <Label>Stadt</Label>
          <Input
            value={profile.invoice_city}
            onChange={e => update('invoice_city', e.target.value)}
            placeholder="Berlin"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Land</Label>
        <Input
          value={profile.invoice_country}
          onChange={e => update('invoice_country', e.target.value)}
          placeholder="Deutschland"
        />
      </div>

      <div className="space-y-2">
        <Label>Steuernummer / USt-IdNr.</Label>
        <Input
          value={profile.invoice_tax_id}
          onChange={e => update('invoice_tax_id', e.target.value)}
          placeholder="123/456/789"
        />
      </div>

      <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
        💡 Deine IBAN für Auszahlungen pflegst du im Tab <strong>Auszahlung</strong>.
      </div>
    </Card>
  );
}