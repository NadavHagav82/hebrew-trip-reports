import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from '@react-pdf/renderer';
import { format } from 'date-fns';

Font.register({
  family: 'Heebo',
  src: 'https://fonts.gstatic.com/s/heebo/v21/NGSpv5_NC0k9P_v6ZUCbLRAHxK1EiS2cckOnz02SXQ.ttf',
});

interface Expense {
  id: string;
  expense_date: string;
  category: string;
  description: string;
  amount: number;
  currency: string;
  amount_in_ils: number;
  receipts?: {
    id: string;
    file_url: string;
    file_name: string;
    file_type: string;
  }[];
}

interface Report {
  id: string;
  trip_destination: string;
  trip_start_date: string;
  trip_end_date: string;
  trip_purpose: string;
  status: 'draft' | 'open' | 'pending' | 'approved' | 'rejected' | 'closed';
  total_amount_ils: number;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
  daily_allowance?: number;
}

interface Profile {
  full_name: string;
  employee_id: string;
  department: string;
}

interface ReportPdfProps {
  report: Report;
  expenses: Expense[];
  profile?: Profile | null;
}

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    padding: 40,
    fontFamily: 'Heebo',
  },
  headerBox: {
    backgroundColor: '#2c3e50',
    padding: 16,
    marginBottom: 24,
    textAlign: 'right',
  },
  title: {
    fontSize: 20,
    color: '#ffffff',
    marginBottom: 4,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 10,
    color: '#ecf0f1',
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 12,
    marginTop: 20,
    textAlign: 'right',
    color: '#2c3e50',
    borderBottomWidth: 2,
    borderBottomColor: '#3498db',
    paddingBottom: 4,
  },
  infoTable: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
    paddingVertical: 8,
  },
  infoLabel: {
    width: '40%',
    fontSize: 10,
    textAlign: 'right',
    paddingRight: 12,
    fontWeight: 600,
  },
  infoValue: {
    width: '60%',
    fontSize: 10,
    textAlign: 'left',
    paddingLeft: 8,
  },
  table: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#bdc3c7',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#34495e',
    borderBottomWidth: 2,
    borderBottomColor: '#2c3e50',
  },
  tableHeaderCell: {
    padding: 8,
    textAlign: 'right',
  },
  tableHeaderText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 700,
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
  },
  tableCell: {
    padding: 6,
    textAlign: 'right',
  },
  tableCellText: {
    fontSize: 9,
    textAlign: 'right',
  },
  numberCell: {
    width: '8%',
  },
  dateCell: {
    width: '15%',
  },
  categoryCell: {
    width: '18%',
  },
  descriptionCell: {
    width: '32%',
  },
  amountCell: {
    width: '13%',
  },
  ilsCell: {
    width: '14%',
  },
  summaryBox: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#ecf0f1',
    borderWidth: 1,
    borderColor: '#bdc3c7',
  },
  summaryTitle: {
    fontSize: 14,
    marginBottom: 8,
    textAlign: 'right',
    fontWeight: 700,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 10,
    textAlign: 'right',
  },
  summaryValue: {
    fontSize: 10,
    textAlign: 'right',
    fontWeight: 600,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#2c3e50',
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: 700,
    textAlign: 'right',
  },
  totalValue: {
    fontSize: 12,
    fontWeight: 700,
    textAlign: 'right',
    color: '#2c3e50',
  },
  receiptPage: {
    flexDirection: 'column',
    padding: 40,
    fontFamily: 'Heebo',
  },
  receiptHeaderBox: {
    backgroundColor: '#2c3e50',
    padding: 12,
    marginBottom: 20,
    textAlign: 'right',
  },
  receiptPageTitle: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'right',
  },
  receiptContainer: {
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#bdc3c7',
    padding: 12,
  },
  receiptTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
    textAlign: 'right',
    color: '#2c3e50',
  },
  receiptDetails: {
    fontSize: 9,
    marginBottom: 8,
    textAlign: 'right',
    color: '#7f8c8d',
  },
  receiptImage: {
    maxWidth: '100%',
    maxHeight: 400,
    objectFit: 'contain',
  },
});

const getCategoryLabel = (category: string) => {
  const labels: Record<string, string> = {
    flights: 'טיסות',
    accommodation: 'לינה',
    food: 'מזון',
    transportation: 'תחבורה',
    miscellaneous: 'שונות',
  };
  return labels[category] || category;
};

const calculateTripDuration = (report: Report) => {
  const start = new Date(report.trip_start_date);
  const end = new Date(report.trip_end_date);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

export const ReportPdf: React.FC<ReportPdfProps> = ({ report, expenses }) => {
  const categoryTotals = expenses.reduce((acc, exp) => {
    if (!acc[exp.category]) acc[exp.category] = 0;
    acc[exp.category] += exp.amount_in_ils;
    return acc;
  }, {} as Record<string, number>);

  // Calculate grand total by currency
  const grandTotalByCurrency = expenses.reduce((acc, exp) => {
    if (!acc[exp.currency]) acc[exp.currency] = 0;
    acc[exp.currency] += exp.amount;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerBox}>
          <Text style={styles.title}>דוח נסיעה עסקית</Text>
          <Text style={styles.subtitle}>
            נוצר ב: {format(new Date(), 'dd/MM/yyyy HH:mm')}
          </Text>
        </View>

        {/* Trip Details */}
        <Text style={styles.sectionTitle}>פרטי הנסיעה</Text>
        <View style={styles.infoTable}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>שם החברה:</Text>
            <Text style={styles.infoValue}>{report.trip_destination}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>מטרת הנסיעה:</Text>
            <Text style={styles.infoValue}>{report.trip_purpose}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>תאריך התחלה:</Text>
            <Text style={styles.infoValue}>
              {format(new Date(report.trip_start_date), 'dd/MM/yyyy')}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>תאריך סיום:</Text>
            <Text style={styles.infoValue}>
              {format(new Date(report.trip_end_date), 'dd/MM/yyyy')}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>משך הנסיעה:</Text>
            <Text style={styles.infoValue}>{calculateTripDuration(report)} ימים</Text>
          </View>
          {report.daily_allowance && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>אש״ל ליום:</Text>
              <Text style={styles.infoValue}>
                ${report.daily_allowance} (סה״כ: ${report.daily_allowance * calculateTripDuration(report)})
              </Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>תאריך יצירה:</Text>
            <Text style={styles.infoValue}>
              {format(new Date(report.created_at), 'dd/MM/yyyy HH:mm')}
            </Text>
          </View>
        </View>

        {/* Expenses Table */}
        <Text style={styles.sectionTitle}>סיכום הוצאות</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={[styles.tableHeaderCell, styles.ilsCell]}>
              <Text style={styles.tableHeaderText}>סכום בש"ח</Text>
            </View>
            <View style={[styles.tableHeaderCell, styles.amountCell]}>
              <Text style={styles.tableHeaderText}>סכום</Text>
            </View>
            <View style={[styles.tableHeaderCell, styles.descriptionCell]}>
              <Text style={styles.tableHeaderText}>תיאור</Text>
            </View>
            <View style={[styles.tableHeaderCell, styles.categoryCell]}>
              <Text style={styles.tableHeaderText}>קטגוריה</Text>
            </View>
            <View style={[styles.tableHeaderCell, styles.dateCell]}>
              <Text style={styles.tableHeaderText}>תאריך</Text>
            </View>
            <View style={[styles.tableHeaderCell, styles.numberCell]}>
              <Text style={styles.tableHeaderText}>#</Text>
            </View>
          </View>

          {expenses.map((expense, index) => (
            <View key={expense.id} style={styles.tableRow}>
              <View style={[styles.tableCell, styles.ilsCell]}>
                <Text style={styles.tableCellText}>₪{expense.amount_in_ils.toFixed(2)}</Text>
              </View>
              <View style={[styles.tableCell, styles.amountCell]}>
                <Text style={styles.tableCellText}>
                  {expense.amount} {expense.currency}
                </Text>
              </View>
              <View style={[styles.tableCell, styles.descriptionCell]}>
                <Text style={styles.tableCellText}>{expense.description}</Text>
              </View>
              <View style={[styles.tableCell, styles.categoryCell]}>
                <Text style={styles.tableCellText}>{getCategoryLabel(expense.category)}</Text>
              </View>
              <View style={[styles.tableCell, styles.dateCell]}>
                <Text style={styles.tableCellText}>
                  {format(new Date(expense.expense_date), 'dd/MM/yyyy')}
                </Text>
              </View>
              <View style={[styles.tableCell, styles.numberCell]}>
                <Text style={styles.tableCellText}>{index + 1}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>סיכום לפי קטגוריות</Text>
          {Object.entries(categoryTotals).map(([category, total]) => (
            <View key={category} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{getCategoryLabel(category)}:</Text>
              <Text style={styles.summaryValue}>₪{total.toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>סה"כ:</Text>
            <Text style={styles.totalValue}>₪{report.total_amount_ils.toFixed(2)}</Text>
          </View>
          {Object.entries(grandTotalByCurrency).length > 0 && (
            <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#bdc3c7' }}>
              <Text style={{ fontSize: 11, marginBottom: 8, textAlign: 'right', fontWeight: 600, color: '#2c3e50' }}>
                סה"כ לפי מטבעות:
              </Text>
              {Object.entries(grandTotalByCurrency).map(([currency, amount]) => (
                <View key={currency} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{currency}:</Text>
                  <Text style={styles.summaryValue}>{amount.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Page>

      {/* Receipt Pages */}
      {expenses.map((expense, expenseIndex) => {
        const imageReceipts = expense.receipts?.filter(r => r.file_type === 'image') || [];
        
        // Debug log
        console.log(`Expense ${expenseIndex + 1} (${expense.description}):`, {
          hasReceipts: !!expense.receipts,
          receiptsCount: expense.receipts?.length || 0,
          imageReceiptsCount: imageReceipts.length,
          receipts: expense.receipts,
        });
        
        if (imageReceipts.length === 0) return null;

        return imageReceipts.map((receipt, receiptIndex) => (
          <Page key={`${expense.id}-${receipt.id}`} size="A4" style={styles.receiptPage}>
            <View style={styles.receiptHeaderBox}>
              <Text style={styles.receiptPageTitle}>צילומי חשבוניות ומסמכים</Text>
            </View>

            <View style={styles.receiptContainer}>
              <Text style={styles.receiptTitle}>
                חשבונית מס׳ {expenseIndex + 1} - {expense.description}
              </Text>
              <Text style={styles.receiptDetails}>
                תאריך: {format(new Date(expense.expense_date), 'dd/MM/yyyy')} | 
                סכום: {expense.amount} {expense.currency} (₪{expense.amount_in_ils.toFixed(2)})
              </Text>
              <Image 
                src={receipt.file_url} 
                style={styles.receiptImage}
              />
            </View>
          </Page>
        ));
      })}
    </Document>
  );
};
