import { InvoiceData, AFIPResponse, AFIPConfig } from '@/types/invoice';
import * as forge from 'node-forge';
import * as xml2js from 'xml2js';
import QRCode from 'qrcode';

export class AFIPService {
  private config: AFIPConfig;

  constructor() {
    this.config = {
      cuit: process.env.AFIP_CUIT || '',
      puntoVenta: parseInt(process.env.AFIP_PUNTO_VENTA || '1'),
      certificatePath: process.env.AFIP_CERT_PATH || '',
      certificatePassword: process.env.AFIP_CERT_PASSWORD || '',
      endpoint: process.env.AFIP_ENDPOINT || 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx',
      ambiente: (process.env.NODE_ENV === 'production' ? 'production' : 'testing') as 'testing' | 'production'
    };
  }

  private getTipoComprobante(tipo: string): number {
    const tipos = {
      'factura': 1, // Factura A
      'nota_credito': 2, // Nota de Crédito A
      'nota_debito': 3 // Nota de Débito A
    };
    return tipos[tipo as keyof typeof tipos] || 1;
  }

  private async generateXMLRequest(invoiceData: InvoiceData): Promise<string> {
    const tipoComprobante = this.getTipoComprobante(invoiceData.tipoComprobante);
    
    const xmlData = {
      'soap:Envelope': {
        '$': {
          'xmlns:soap': 'http://www.w3.org/2003/05/soap-envelope',
          'xmlns:ar': 'http://ar.gov.afip.dif.FEV1/'
        },
        'soap:Header': {},
        'soap:Body': {
          'ar:FECAESolicitar': {
            'ar:Auth': {
              'ar:Token': 'TOKEN_PLACEHOLDER',
              'ar:Sign': 'SIGN_PLACEHOLDER',
              'ar:Cuit': this.config.cuit
            },
            'ar:FeCAEReq': {
              'ar:FeCabReq': {
                'ar:CantReg': 1,
                'ar:PtoVta': this.config.puntoVenta,
                'ar:CbteTipo': tipoComprobante
              },
              'ar:FeDetReq': {
                'ar:FECAEDetRequest': {
                  'ar:Concepto': 1, // Productos
                  'ar:DocTipo': 80, // CUIT
                  'ar:DocNro': invoiceData.cliente.numeroDocumento,
                  'ar:CbteDesde': invoiceData.numeroComprobante,
                  'ar:CbteHasta': invoiceData.numeroComprobante,
                  'ar:CbteFch': invoiceData.fecha.replace(/-/g, ''),
                  'ar:ImpTotal': invoiceData.total.toFixed(2),
                  'ar:ImpTotConc': 0,
                  'ar:ImpNeto': invoiceData.subtotal.toFixed(2),
                  'ar:ImpOpEx': 0,
                  'ar:ImpIVA': invoiceData.totalIVA.toFixed(2),
                  'ar:ImpTrib': 0,
                  'ar:MonId': 'PES',
                  'ar:MonCotiz': 1,
                  'ar:Iva': {
                    'ar:AlicIva': invoiceData.items.map(item => ({
                      'ar:Id': 5, // 21%
                      'ar:BaseImp': (item.cantidad * item.precioUnitario).toFixed(2),
                      'ar:Importe': item.importeIVA.toFixed(2)
                    }))
                  }
                }
              }
            }
          }
        }
      }
    };

    const builder = new xml2js.Builder({
      xmldec: { version: '1.0', encoding: 'UTF-8' }
    });
    
    return builder.buildObject(xmlData);
  }

  private async signXML(xml: string): Promise<string> {
    // En un entorno real, aquí se firmaría el XML con el certificado digital
    // Por ahora, simulamos la firma
    return xml.replace('TOKEN_PLACEHOLDER', 'SIMULATED_TOKEN')
             .replace('SIGN_PLACEHOLDER', 'SIMULATED_SIGNATURE');
  }

  private async generateQRCode(invoiceData: InvoiceData, cae: string): Promise<string> {
    const qrData = {
      ver: 1,
      fecha: invoiceData.fecha,
      cuit: this.config.cuit,
      ptoVta: this.config.puntoVenta,
      tipoCmp: this.getTipoComprobante(invoiceData.tipoComprobante),
      nroCmp: invoiceData.numeroComprobante,
      importe: invoiceData.total,
      moneda: 'PES',
      ctz: 1,
      tipoDocRec: 80,
      nroDocRec: invoiceData.cliente.numeroDocumento,
      tipoCodAut: 'E',
      codAut: cae
    };

    const qrString = JSON.stringify(qrData);
    return await QRCode.toDataURL(qrString);
  }

  public async sendInvoice(invoiceData: InvoiceData): Promise<AFIPResponse> {
    try {
      // Validar datos requeridos
      if (!invoiceData.cliente.numeroDocumento || !invoiceData.items.length) {
        return {
          success: false,
          error: 'Datos incompletos: se requiere CUIT del cliente e items'
        };
      }

      // Generar XML de solicitud
      const xmlRequest = await this.generateXMLRequest(invoiceData);
      
      // Firmar XML
      const signedXML = await this.signXML(xmlRequest);

      // En un entorno real, aquí se enviaría a AFIP
      // Por ahora, simulamos una respuesta exitosa
      const simulatedCAE = this.generateSimulatedCAE();
      const fechaVencimiento = this.getFechaVencimientoCAE();
      
      // Generar código QR
      const qrCode = await this.generateQRCode(invoiceData, simulatedCAE);

      return {
        success: true,
        cae: simulatedCAE,
        fechaVencimientoCae: fechaVencimiento,
        numeroComprobante: invoiceData.numeroComprobante,
        qrCode: qrCode,
        observaciones: ['Comprobante autorizado correctamente']
      };

    } catch (error) {
      console.error('Error en AFIP Service:', error);
      return {
        success: false,
        error: `Error al procesar la factura: ${error instanceof Error ? error.message : 'Error desconocido'}`
      };
    }
  }

  private generateSimulatedCAE(): string {
    // Generar CAE simulado de 14 dígitos
    return Math.floor(Math.random() * 99999999999999).toString().padStart(14, '0');
  }

  private getFechaVencimientoCAE(): string {
    // CAE vence 10 días después de la emisión
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + 10);
    return fecha.toISOString().split('T')[0];
  }

  public async getNextInvoiceNumber(tipoComprobante: string): Promise<number> {
    // En un entorno real, esto consultaría a AFIP el último número usado
    // Por ahora, generamos un número simulado
    return Math.floor(Math.random() * 1000) + 1;
  }
}

export const afipService = new AFIPService();
