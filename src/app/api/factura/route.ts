import { NextRequest, NextResponse } from 'next/server';
import { afipService } from '@/lib/afip';
import { InvoiceData } from '@/types/invoice';
import { z } from 'zod';

// Esquema de validación con Zod
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

const InvoiceSchema = z.object({
  tipoComprobante: z.enum(['factura', 'nota_credito', 'nota_debito']),
  puntoVenta: z.number().positive(),
  numeroComprobante: z.number().positive(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
  cliente: ClienteSchema,
  items: z.array(InvoiceItemSchema).min(1, 'Se requiere al menos un item'),
  subtotal: z.number().positive(),
  totalIVA: z.number().min(0),
  total: z.number().positive(),
  observaciones: z.string().optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validar datos de entrada
    const validationResult = InvoiceSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos de factura inválidos',
          details: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      );
    }

    const invoiceData: InvoiceData = validationResult.data;

    // Validar que los totales sean correctos
    const calculatedSubtotal = invoiceData.items.reduce(
      (sum, item) => sum + (item.cantidad * item.precioUnitario), 
      0
    );
    
    const calculatedIVA = invoiceData.items.reduce(
      (sum, item) => sum + item.importeIVA, 
      0
    );

    if (Math.abs(calculatedSubtotal - invoiceData.subtotal) > 0.01) {
      return NextResponse.json(
        {
          success: false,
          error: 'El subtotal calculado no coincide con el enviado'
        },
        { status: 400 }
      );
    }

    if (Math.abs(calculatedIVA - invoiceData.totalIVA) > 0.01) {
      return NextResponse.json(
        {
          success: false,
          error: 'El total de IVA calculado no coincide con el enviado'
        },
        { status: 400 }
      );
    }

    // Enviar factura a AFIP
    const afipResponse = await afipService.sendInvoice(invoiceData);

    if (!afipResponse.success) {
      return NextResponse.json(
        {
          success: false,
          error: afipResponse.error || 'Error al procesar la factura en AFIP'
        },
        { status: 500 }
      );
    }

    // Respuesta exitosa
    return NextResponse.json({
      success: true,
      data: {
        cae: afipResponse.cae,
        fechaVencimientoCae: afipResponse.fechaVencimientoCae,
        numeroComprobante: afipResponse.numeroComprobante,
        qrCode: afipResponse.qrCode,
        observaciones: afipResponse.observaciones
      }
    });

  } catch (error) {
    console.error('Error en API de factura:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Error interno del servidor'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tipoComprobante = searchParams.get('tipo') || 'factura';
    
    // Obtener próximo número de comprobante
    const nextNumber = await afipService.getNextInvoiceNumber(tipoComprobante);
    
    return NextResponse.json({
      success: true,
      data: {
        proximoNumero: nextNumber,
        puntoVenta: parseInt(process.env.AFIP_PUNTO_VENTA || '1')
      }
    });
    
  } catch (error) {
    console.error('Error al obtener próximo número:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener información de numeración'
      },
      { status: 500 }
    );
  }
}
