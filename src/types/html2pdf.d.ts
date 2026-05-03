declare module "html2pdf.js" {
  interface Html2PdfOptions {
    margin?: number | number[];
    filename?: string;
    image?: { type?: string; quality?: number };
    html2canvas?: Record<string, unknown>;
    jsPDF?: Record<string, unknown>;
  }
  interface Html2PdfInstance {
    set(opt: Html2PdfOptions): Html2PdfInstance;
    from(el: HTMLElement | string): Html2PdfInstance;
    save(filename?: string): Promise<void>;
    output(type?: string): unknown;
    toPdf(): Html2PdfInstance;
  }
  function html2pdf(): Html2PdfInstance;
  export default html2pdf;
}
