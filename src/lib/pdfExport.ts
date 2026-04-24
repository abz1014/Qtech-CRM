/**
 * PDF Export Utilities
 * Generates PDF files for invoices and reports
 */

export function generateInvoicePDF(invoiceData: any): string {
  // HTML template for invoice
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Invoice ${invoiceData.invoice_number}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #333;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            border: 1px solid #ddd;
            padding: 20px;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #0066cc;
            padding-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            color: #0066cc;
          }
          .invoice-number {
            font-size: 12px;
            color: #666;
          }
          .details {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .detail-block h3 {
            margin: 0 0 10px 0;
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
          }
          .detail-block p {
            margin: 5px 0;
            font-size: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th {
            background-color: #f5f5f5;
            border: 1px solid #ddd;
            padding: 10px;
            text-align: left;
            font-weight: bold;
            font-size: 12px;
          }
          td {
            border: 1px solid #ddd;
            padding: 10px;
            font-size: 14px;
          }
          .amount-column {
            text-align: right;
          }
          .summary {
            width: 300px;
            margin-left: auto;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #ddd;
            font-size: 14px;
          }
          .summary-row.total {
            border-bottom: 2px solid #0066cc;
            font-weight: bold;
            font-size: 16px;
            color: #0066cc;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
          }
          .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
          }
          .status-pending {
            background-color: #fef3c7;
            color: #92400e;
          }
          .status-paid {
            background-color: #dcfce7;
            color: #166534;
          }
          .status-partial {
            background-color: #fed7aa;
            color: #9a3412;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>INVOICE</h1>
            <p class="invoice-number">${invoiceData.invoice_number}</p>
          </div>

          <div class="details">
            <div class="detail-block">
              <h3>From</h3>
              <p><strong>Q-Tech CRM</strong></p>
              <p>Lahore, Pakistan</p>
              <p>info@qtech.pk</p>
            </div>
            <div class="detail-block">
              <h3>Bill To</h3>
              <p><strong>${invoiceData.client_name}</strong></p>
              <p>Invoice Date: ${invoiceData.issued_date}</p>
              <p>Due Date: ${invoiceData.due_date}</p>
            </div>
            <div class="detail-block">
              <h3>Status</h3>
              <p><span class="status-badge status-${invoiceData.payment_status.toLowerCase()}">${invoiceData.payment_status}</span></p>
              <p>Amount: PKR ${new Intl.NumberFormat('en-PK').format(invoiceData.invoice_amount)}</p>
              <p>Paid: PKR ${new Intl.NumberFormat('en-PK').format(invoiceData.amount_paid)}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th class="amount-column">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Professional Services & Deliverables</td>
                <td class="amount-column">PKR ${new Intl.NumberFormat('en-PK').format(invoiceData.invoice_amount)}</td>
              </tr>
            </tbody>
          </table>

          <div class="summary">
            <div class="summary-row">
              <span>Subtotal:</span>
              <span>PKR ${new Intl.NumberFormat('en-PK').format(invoiceData.invoice_amount)}</span>
            </div>
            <div class="summary-row">
              <span>Tax (0%):</span>
              <span>PKR 0</span>
            </div>
            <div class="summary-row total">
              <span>Total Amount:</span>
              <span>PKR ${new Intl.NumberFormat('en-PK').format(invoiceData.invoice_amount)}</span>
            </div>
            <div class="summary-row">
              <span>Amount Paid:</span>
              <span>PKR ${new Intl.NumberFormat('en-PK').format(invoiceData.amount_paid)}</span>
            </div>
            <div class="summary-row">
              <span>Balance Due:</span>
              <span>PKR ${new Intl.NumberFormat('en-PK').format(invoiceData.invoice_amount - invoiceData.amount_paid)}</span>
            </div>
          </div>

          <div class="footer">
            <p>Thank you for your business!</p>
            <p>Payment Terms: Due on or before ${invoiceData.due_date}</p>
            <p>Generated on ${new Date().toLocaleDateString('en-PK')}</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return html;
}

export function generateReportPDF(reportData: any, reportType: 'pnl' | 'projects'): string {
  const isProjectReport = reportType === 'projects';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${isProjectReport ? 'Project Profitability' : 'Profit & Loss Statement'} Report</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #333;
          }
          .container {
            max-width: 900px;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #0066cc;
            padding-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            color: #0066cc;
            font-size: 24px;
          }
          .header p {
            margin: 10px 0 0 0;
            color: #666;
            font-size: 12px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th {
            background-color: #f5f5f5;
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
            font-weight: bold;
            font-size: 12px;
          }
          td {
            border: 1px solid #ddd;
            padding: 10px;
            font-size: 13px;
          }
          .amount-column {
            text-align: right;
          }
          .total-row {
            background-color: #f5f5f5;
            font-weight: bold;
            border-top: 2px solid #0066cc;
          }
          .profit-positive {
            color: #16a34a;
          }
          .profit-negative {
            color: #dc2626;
          }
          .section-title {
            background-color: #e8f0fe;
            font-weight: bold;
            font-size: 14px;
            margin-top: 20px;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 11px;
            color: #666;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${isProjectReport ? 'Project Profitability Report' : 'Profit & Loss Statement'}</h1>
            <p>Generated on ${new Date().toLocaleDateString('en-PK')} | Q-Tech CRM</p>
          </div>

          <table>
            <thead>
              ${isProjectReport ? `
                <tr>
                  <th>Project/RFQ</th>
                  <th class="amount-column">Revenue</th>
                  <th class="amount-column">Expenses</th>
                  <th class="amount-column">Profit</th>
                  <th class="amount-column">Margin %</th>
                </tr>
              ` : `
                <tr>
                  <th>Period</th>
                  <th class="amount-column">Revenue</th>
                  <th class="amount-column">Expenses</th>
                  <th class="amount-column">Profit</th>
                  <th class="amount-column">Margin %</th>
                </tr>
              `}
            </thead>
            <tbody>
              ${reportData.rows.map((row: any) => `
                <tr>
                  <td>${row[0]}</td>
                  <td class="amount-column">PKR ${new Intl.NumberFormat('en-PK').format(row[1])}</td>
                  <td class="amount-column">PKR ${new Intl.NumberFormat('en-PK').format(row[2])}</td>
                  <td class="amount-column ${parseInt(row[3]) >= 0 ? 'profit-positive' : 'profit-negative'}">PKR ${new Intl.NumberFormat('en-PK').format(row[3])}</td>
                  <td class="amount-column">${row[4]}%</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td>TOTAL</td>
                <td class="amount-column">PKR ${new Intl.NumberFormat('en-PK').format(reportData.totals.revenue)}</td>
                <td class="amount-column">PKR ${new Intl.NumberFormat('en-PK').format(reportData.totals.expenses)}</td>
                <td class="amount-column ${reportData.totals.profit >= 0 ? 'profit-positive' : 'profit-negative'}">PKR ${new Intl.NumberFormat('en-PK').format(reportData.totals.profit)}</td>
                <td class="amount-column">${reportData.totals.margin}%</td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            <p>This is an automated report generated by Q-Tech CRM Bookkeeping Module</p>
            <p>For questions or clarifications, please contact the finance team</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return html;
}

export async function downloadPDFFromHTML(html: string, fileName: string): Promise<void> {
  // Create a blob from the HTML
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  // For production, you would use a library like jsPDF or html2pdf
  // For now, we'll create a simple download of HTML that can be printed to PDF
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Open PDF in a new window (for printing or viewing)
 * Used when user wants to preview before downloading
 */
export function openPDFPreview(html: string): void {
  const newWindow = window.open('', '', 'height=600,width=800');
  if (newWindow) {
    newWindow.document.write(html);
    newWindow.document.close();
  }
}
