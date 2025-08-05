"use client";

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { InvoiceData, InvoiceItem, AFIPResponse } from '@/types/invoice';

// Schema de validación
const InvoiceItemSchema = z.object({
  id: z.string(),
  descripcion: z.string().min(1, 'La descripción es requerida'),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
  precioUnitario: z.number().positive('El precio unitario debe ser mayor a 0'),
  alicuotaIVA: z.number().min(0).max(100),
  importeIVA: z.number().min(0),
  importeTotal: z.number().positive()
});

const ClienteSchema = z.object({
  tipoDocumento: z.string().min(1, 'El tipo de documento es requerido'),
  numeroDocumento: z.string().min(1, 'El número de documento es requerido'),
  razonSocial: z.string().min(1, 'La razón social es requerida'),
  domicilio: z.string().min(1, 'El domicilio es requerido'),
  condicionIVA: z.string().min(1, 'La condición de IVA es requerida')
});

const InvoiceFormSchema = z.object({
  tipoComprobante: z.enum(['factura', 'nota_credito', 'nota_debito']),
  puntoVenta: z.number().positive(),
  numeroComprobante: z.number().positive(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido'),
  cliente: ClienteSchema,
  items: z.array(InvoiceItemSchema).min(1, 'Se requiere al menos un item'),
  observaciones: z.string().optional()
});

type InvoiceFormData = z.infer<typeof InvoiceFormSchema>;

export default function InvoicePage() {
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<AFIPResponse | null>(null);
  const [nextNumber, setNextNumber] = useState<number>(1);

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(InvoiceFormSchema),
    defaultValues: {
      tipoComprobante: 'factura',
      puntoVenta: 1,
      numeroComprobante: 1,
      fecha: new Date().toISOString().split('T')[0],
      cliente: {
        tipoDocumento: 'CUIT',
        numeroDocumento: '',
        razonSocial: '',
        domicilio: '',
        condicionIVA: 'Responsable Inscripto'
      },
      items: [{
        id: '1',
        descripcion: '',
        cantidad: 1,
        precioUnitario: 0,
        alicuotaIVA: 21,
        importeIVA: 0,
        importeTotal: 0
      }],
      observaciones: ''
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items'
  });

  // Obtener próximo número de comprobante
  useEffect(() => {
    const fetchNextNumber = async () => {
      try {
        const response = await fetch('/api/factura');
        const data = await response.json();
        if (data.success) {
          setNextNumber(data.data.proximoNumero);
          form.setValue('numeroComprobante', data.data.proximoNumero);
          form.setValue('puntoVenta', data.data.puntoVenta);
        }
      } catch (error) {
        console.error('Error al obtener próximo número:', error);
      }
    };

    fetchNextNumber();
  }, [form]);

  // Calcular totales automáticamente
  const watchedItems = form.watch('items');
  
  useEffect(() => {
    watchedItems.forEach((item, index) => {
      const subtotalItem = item.cantidad * item.precioUnitario;
      const ivaItem = subtotalItem * (item.alicuotaIVA / 100);
      const totalItem = subtotalItem + ivaItem;

      form.setValue(`items.${index}.importeIVA`, Number(ivaItem.toFixed(2)));
      form.setValue(`items.${index}.importeTotal`, Number(totalItem.toFixed(2)));
    });
  }, [watchedItems, form]);

  const calculateTotals = () => {
    const items = form.getValues('items');
    const subtotal = items.reduce((sum, item) => sum + (item.cantidad * item.precioUnitario), 0);
    const totalIVA = items.reduce((sum, item) => sum + item.importeIVA, 0);
    const total = subtotal + totalIVA;

    return {
      subtotal: Number(subtotal.toFixed(2)),
      totalIVA: Number(totalIVA.toFixed(2)),
      total: Number(total.toFixed(2))
    };
  };

  const onSubmit = async (data: InvoiceFormData) => {
    setIsLoading(true);
    setResponse(null);

    try {
      const totals = calculateTotals();
      
      const invoiceData: InvoiceData = {
        ...data,
        ...totals
      };

      const response = await fetch('/api/factura', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invoiceData),
      });

      const result = await response.json();
      setResponse(result);

      if (result.success) {
        // Incrementar número de comprobante para próxima factura
        form.setValue('numeroComprobante', nextNumber + 1);
        setNextNumber(nextNumber + 1);
      }

    } catch (error) {
      setResponse({
        success: false,
        error: 'Error de conexión al servidor'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addItem = () => {
    append({
      id: (fields.length + 1).toString(),
      descripcion: '',
      cantidad: 1,
      precioUnitario: 0,
      alicuotaIVA: 21,
      importeIVA: 0,
      importeTotal: 0
    });
  };

  const totals = calculateTotals();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header Image */}
      <div className="w-full h-48 overflow-hidden rounded-lg">
        <img
          src="https://placehold.co/1920x400?text=Sistema+de+Facturacion+Electronica+Argentina+AFIP+Moderno+y+Profesional"
          alt="Sistema de Facturación Electrónica Argentina AFIP Moderno y Profesional"
          className="w-full h-full object-cover"
          onError={(e) => { 
            e.currentTarget.onerror = null; 
            e.currentTarget.src = ''; 
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Tipo de Comprobante */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Comprobante</CardTitle>
            <CardDescription>
              Seleccione el tipo de comprobante y complete los datos básicos
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipoComprobante">Tipo de Comprobante</Label>
              <Select
                value={form.watch('tipoComprobante')}
                onValueChange={(value) => form.setValue('tipoComprobante', value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="factura">Factura</SelectItem>
                  <SelectItem value="nota_credito">Nota de Crédito</SelectItem>
                  <SelectItem value="nota_debito">Nota de Débito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="puntoVenta">Punto de Venta</Label>
              <Input
                {...form.register('puntoVenta', { valueAsNumber: true })}
                type="number"
                readOnly
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="numeroComprobante">Número de Comprobante</Label>
              <Input
                {...form.register('numeroComprobante', { valueAsNumber: true })}
                type="number"
                readOnly
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha</Label>
              <Input
                {...form.register('fecha')}
                type="date"
              />
            </div>
          </CardContent>
        </Card>

        {/* Datos del Cliente */}
        <Card>
          <CardHeader>
            <CardTitle>Datos del Cliente</CardTitle>
            <CardDescription>
              Complete la información del cliente o receptor del comprobante
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipoDocumento">Tipo de Documento</Label>
              <Select
                value={form.watch('cliente.tipoDocumento')}
                onValueChange={(value) => form.setValue('cliente.tipoDocumento', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CUIT">CUIT</SelectItem>
                  <SelectItem value="CUIL">CUIL</SelectItem>
                  <SelectItem value="DNI">DNI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="numeroDocumento">Número de Documento</Label>
              <Input
                {...form.register('cliente.numeroDocumento')}
                placeholder="Ej: 20-12345678-9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="razonSocial">Razón Social</Label>
              <Input
                {...form.register('cliente.razonSocial')}
                placeholder="Nombre o razón social del cliente"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="condicionIVA">Condición IVA</Label>
              <Select
                value={form.watch('cliente.condicionIVA')}
                onValueChange={(value) => form.setValue('cliente.condicionIVA', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar condición" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Responsable Inscripto">Responsable Inscripto</SelectItem>
                  <SelectItem value="Monotributista">Monotributista</SelectItem>
                  <SelectItem value="Exento">Exento</SelectItem>
                  <SelectItem value="Consumidor Final">Consumidor Final</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="domicilio">Domicilio</Label>
              <Input
                {...form.register('cliente.domicilio')}
                placeholder="Dirección completa del cliente"
              />
            </div>
          </CardContent>
        </Card>

        {/* Items de la Factura */}
        <Card>
          <CardHeader>
            <CardTitle>Detalle de Items</CardTitle>
            <CardDescription>
              Agregue los productos o servicios a facturar
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-1 md:grid-cols-6 gap-4 p-4 border rounded-lg">
                <div className="md:col-span-2 space-y-2">
                  <Label>Descripción</Label>
                  <Input
                    {...form.register(`items.${index}.descripcion`)}
                    placeholder="Descripción del producto/servicio"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Cantidad</Label>
                  <Input
                    {...form.register(`items.${index}.cantidad`, { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    min="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Precio Unitario</Label>
                  <Input
                    {...form.register(`items.${index}.precioUnitario`, { valueAsNumber: true })}
                    type="number"
                    step="0.01"
                    min="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>IVA %</Label>
                  <Select
                    value={form.watch(`items.${index}.alicuotaIVA`).toString()}
                    onValueChange={(value) => form.setValue(`items.${index}.alicuotaIVA`, Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0%</SelectItem>
                      <SelectItem value="10.5">10.5%</SelectItem>
                      <SelectItem value="21">21%</SelectItem>
                      <SelectItem value="27">27%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Total</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      value={`$${form.watch(`items.${index}.importeTotal`).toFixed(2)}`}
                      readOnly
                      className="bg-muted"
                    />
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => remove(index)}
                      >
                        ×
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" onClick={addItem}>
              Agregar Item
            </Button>
          </CardContent>
        </Card>

        {/* Totales */}
        <Card>
          <CardHeader>
            <CardTitle>Totales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-right">
              <div>
                <Label>Subtotal</Label>
                <div className="text-2xl font-semibold">${totals.subtotal.toFixed(2)}</div>
              </div>
              <div>
                <Label>IVA</Label>
                <div className="text-2xl font-semibold">${totals.totalIVA.toFixed(2)}</div>
              </div>
              <div>
                <Label>Total</Label>
                <div className="text-3xl font-bold text-primary">${totals.total.toFixed(2)}</div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="observaciones">Observaciones</Label>
              <Textarea
                {...form.register('observaciones')}
                placeholder="Observaciones adicionales (opcional)"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Botón de Envío */}
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={isLoading}>
            {isLoading ? 'Procesando...' : 'Generar Comprobante'}
          </Button>
        </div>
      </form>

      {/* Respuesta de AFIP */}
      {response && (
        <Card>
          <CardHeader>
            <CardTitle>
              {response.success ? 'Comprobante Autorizado' : 'Error en el Procesamiento'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {response.success ? (
              <div className="space-y-4">
                <Alert>
                  <AlertDescription>
                    El comprobante ha sido autorizado correctamente por AFIP
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>CAE (Código de Autorización Electrónica)</Label>
                    <div className="font-mono text-lg">{response.cae}</div>
                  </div>
                  <div>
                    <Label>Fecha de Vencimiento CAE</Label>
                    <div className="font-mono text-lg">{response.fechaVencimientoCae}</div>
                  </div>
                </div>

                {response.qrCode && (
                  <div className="text-center">
                    <Label>Código QR</Label>
                    <div className="mt-2">
                      <img src={response.qrCode} alt="Código QR" className="mx-auto" />
                    </div>
                  </div>
                )}

                {response.observaciones && response.observaciones.length > 0 && (
                  <div>
                    <Label>Observaciones</Label>
                    <div className="space-y-1">
                      {response.observaciones.map((obs, index) => (
                        <Badge key={index} variant="secondary">{obs}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Alert variant="destructive">
                <AlertDescription>
                  {response.error}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
