export interface InvoiceItem {
  id: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  alicuotaIVA: number;
  importeIVA: number;
  importeTotal: number;
}

export interface ClienteData {
  tipoDocumento: string;
  numeroDocumento: string;
  razonSocial: string;
  domicilio: string;
  condicionIVA: string;
}

export interface InvoiceData {
  tipoComprobante: 'factura' | 'nota_credito' | 'nota_debito';
  puntoVenta: number;
  numeroComprobante: number;
  fecha: string;
  cliente: ClienteData;
  items: InvoiceItem[];
  subtotal: number;
  totalIVA: number;
  total: number;
  observaciones?: string;
}

export interface AFIPResponse {
  success: boolean;
  cae?: string;
  fechaVencimientoCae?: string;
  numeroComprobante?: number;
  qrCode?: string;
  error?: string;
  observaciones?: string[];
}

export interface AFIPConfig {
  cuit: string;
  puntoVenta: number;
  certificatePath: string;
  certificatePassword: string;
  endpoint: string;
  ambiente: 'testing' | 'production';
}
