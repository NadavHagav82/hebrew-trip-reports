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
  status: 'draft' | 'open' | 'closed' | 'pending_approval';
  total_amount_ils: number;
  submitted_at: string | null;
  approved_at: string | null;
  manager_approval_requested_at?: string | null;
  manager_approval_token?: string | null;
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
    backgroundColor: '#ffffff',
  },
  headerBox: {
    backgroundColor: '#1e3a8a',
    padding: 20,
    marginBottom: 30,
    textAlign: 'right',
    borderRadius: 10,
  },
  title: {
    fontSize: 24,
    color: '#ffffff',
    marginBottom: 6,
    textAlign: 'right',
    fontWeight: 700,
  },
  subtitle: {
    fontSize: 12,
    color: '#dbeafe',
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 16,
    marginTop: 28,
    textAlign: 'right',
    color: '#1e3a8a',
    borderBottomWidth: 3,
    borderBottomColor: '#3b82f6',
    paddingBottom: 6,
    fontWeight: 700,
  },
  infoTable: {
    marginBottom: 20,
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  infoRow: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 10,
  },
  infoLabel: {
    width: '40%',
    fontSize: 11,
    textAlign: 'right',
    paddingRight: 12,
    fontWeight: 700,
    color: '#374151',
  },
  infoValue: {
    width: '60%',
    fontSize: 11,
    textAlign: 'left',
    paddingLeft: 8,
    color: '#1f2937',
  },
  table: {
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e3a8a',
    borderBottomWidth: 2,
    borderBottomColor: '#1e40af',
  },
  tableHeaderCell: {
    padding: 12,
    textAlign: 'right',
  },
  tableHeaderText: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: 700,
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tableRowEven: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  tableCell: {
    padding: 10,
    textAlign: 'right',
  },
  tableCellText: {
    fontSize: 10,
    textAlign: 'right',
    color: '#1f2937',
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
    marginTop: 28,
    padding: 20,
    backgroundColor: '#dbeafe',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  summaryTitle: {
    fontSize: 16,
    marginBottom: 12,
    textAlign: 'right',
    fontWeight: 700,
    color: '#1e3a8a',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 11,
    textAlign: 'right',
    color: '#374151',
  },
  summaryValue: {
    fontSize: 11,
    textAlign: 'right',
    fontWeight: 700,
    color: '#1e3a8a',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 3,
    borderTopColor: '#1e3a8a',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: 700,
    textAlign: 'right',
    color: '#1e3a8a',
  },
  totalValue: {
    fontSize: 14,
    fontWeight: 700,
    textAlign: 'right',
    color: '#1e3a8a',
  },
  receiptPage: {
    flexDirection: 'column',
    padding: 40,
    fontFamily: 'Heebo',
    backgroundColor: '#ffffff',
  },
  receiptHeaderBox: {
    backgroundColor: '#1e3a8a',
    padding: 16,
    marginBottom: 24,
    textAlign: 'right',
    borderRadius: 10,
  },
  receiptPageTitle: {
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'right',
    fontWeight: 700,
  },
  receiptContainer: {
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#f9fafb',
  },
  receiptTitle: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 10,
    textAlign: 'right',
    color: '#1e3a8a',
  },
  receiptDetails: {
    fontSize: 10,
    marginBottom: 12,
    textAlign: 'right',
    color: '#6b7280',
  },
  receiptImage: {
    maxWidth: '100%',
    maxHeight: 400,
    objectFit: 'contain',
    borderRadius: 4,
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

export const ReportPdf: React.FC<ReportPdfProps> = ({ report, expenses, profile }) => {
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

  const tripStart = format(new Date(report.trip_start_date), 'dd/MM/yyyy');
  const tripEnd = format(new Date(report.trip_end_date), 'dd/MM/yyyy');
  const tripRange = `${tripStart} - ${tripEnd}`;

  const mainCurrency = expenses[0]?.currency || 'USD';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerBox}>
          <Text style={styles.title}>דוח נסיעה עסקית</Text>
          <Text style={styles.subtitle}>
            {report.trip_destination} | {tripRange}
          </Text>
        </View>

        {/* Trip Details */}
        <Text style={styles.sectionTitle}>פרטי הנסיעה</Text>
        <View style={styles.infoTable}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>שם העובד</Text>
            <Text style={styles.infoValue}>{profile?.full_name || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>חברה</Text>
            <Text style={styles.infoValue}>{profile?.department || '-'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>יעד</Text>
            <Text style={styles.infoValue}>{report.trip_destination}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>תאריכי נסיעה</Text>
            <Text style={styles.infoValue}>{tripRange}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>מטרת הנסיעה</Text>
            <Text style={styles.infoValue}>{report.trip_purpose}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>מטבע</Text>
            <Text style={styles.infoValue}>{mainCurrency}</Text>
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
            <View key={expense.id} style={index % 2 === 0 ? styles.tableRow : styles.tableRowEven}>
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
            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 2, borderTopColor: '#3b82f6' }}>
              <Text style={{ fontSize: 13, marginBottom: 10, textAlign: 'right', fontWeight: 700, color: '#1e3a8a' }}>
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
