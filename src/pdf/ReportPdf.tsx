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
    padding: 50,
    fontFamily: 'Heebo',
    backgroundColor: '#ffffff',
  },
  headerBox: {
    backgroundColor: '#dbeafe',
    padding: 30,
    marginBottom: 35,
    textAlign: 'right',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  title: {
    fontSize: 36,
    color: '#1e3a8a',
    marginBottom: 8,
    textAlign: 'right',
    fontWeight: 900,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#1e40af',
    textAlign: 'right',
    fontWeight: 700,
  },
  sectionTitle: {
    fontSize: 24,
    marginBottom: 18,
    marginTop: 30,
    textAlign: 'right',
    color: '#000000',
    borderBottomWidth: 2,
    borderBottomColor: '#3b82f6',
    paddingBottom: 8,
    fontWeight: 900,
  },
  infoTable: {
    marginBottom: 25,
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 10,
  },
  infoRow: {
    flexDirection: 'row-reverse',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 12,
    alignItems: 'center',
  },
  infoLabel: {
    width: '35%',
    fontSize: 13,
    textAlign: 'right',
    paddingRight: 16,
    fontWeight: 900,
    color: '#000000',
  },
  infoValue: {
    width: '65%',
    fontSize: 13,
    textAlign: 'left',
    paddingLeft: 12,
    color: '#000000',
    fontWeight: 900,
  },
  table: {
    marginTop: 16,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#93c5fd',
    backgroundColor: '#ffffff',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderBottomWidth: 3,
    borderBottomColor: '#374151',
  },
  tableHeaderCell: {
    padding: 14,
    textAlign: 'right',
  },
  tableHeaderText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: 700,
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  tableRowEven: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#f0f9ff',
  },
  tableCell: {
    padding: 12,
    textAlign: 'right',
  },
  tableCellText: {
    fontSize: 12,
    textAlign: 'right',
    color: '#000000',
    fontWeight: 900,
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
    backgroundColor: '#e0f2fe',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#93c5fd',
  },
  summaryTitle: {
    fontSize: 15,
    marginBottom: 10,
    textAlign: 'right',
    fontWeight: 700,
    color: '#3b82f6',
  },
  summaryRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  summaryLabel: {
    fontSize: 10,
    textAlign: 'right',
    color: '#000000',
    fontWeight: 900,
  },
  summaryValue: {
    fontSize: 10,
    textAlign: 'right',
    fontWeight: 900,
    color: '#000000',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#1f2937',
    borderRadius: 6,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: 700,
    textAlign: 'right',
    color: '#ffffff',
  },
  totalValue: {
    fontSize: 15,
    fontWeight: 700,
    textAlign: 'right',
    color: '#ffffff',
  },
  receiptPage: {
    flexDirection: 'column',
    padding: 50,
    fontFamily: 'Heebo',
    backgroundColor: '#ffffff',
  },
  receiptHeaderBox: {
    backgroundColor: '#dbeafe',
    padding: 24,
    marginBottom: 30,
    textAlign: 'right',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  receiptPageTitle: {
    fontSize: 26,
    color: '#1e3a8a',
    textAlign: 'right',
    fontWeight: 900,
  },
  receiptContainer: {
    marginBottom: 30,
    borderWidth: 2,
    borderColor: '#93c5fd',
    borderRadius: 10,
    padding: 20,
    backgroundColor: '#ffffff',
  },
  receiptTitle: {
    fontSize: 16,
    fontWeight: 900,
    marginBottom: 12,
    textAlign: 'right',
    color: '#000000',
  },
  receiptDetails: {
    fontSize: 12,
    marginBottom: 16,
    textAlign: 'right',
    color: '#000000',
    fontWeight: 900,
  },
  receiptImage: {
    maxWidth: '100%',
    maxHeight: 700,
    objectFit: 'contain',
    borderRadius: 6,
    alignSelf: 'center',
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
            <Text style={styles.infoLabel}>מספר ימים</Text>
            <Text style={styles.infoValue}>{calculateTripDuration(report)}</Text>
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

        {/* Expenses Table - Start on page 2 */}
        <Text style={styles.sectionTitle} break>סיכום הוצאות</Text>
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

        {/* Daily Allowance Section */}
        {report.daily_allowance && (
          <View
            style={[
              styles.summaryBox,
              { marginTop: 20, backgroundColor: '#dbeafe', borderColor: '#60a5fa' },
            ]}
            wrap={false}
          >
            <Text style={[styles.summaryTitle, { color: '#1e40af' }]}>אש"ל יומי</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>אש"ל יומי</Text>
              <Text style={styles.summaryValue}>${report.daily_allowance.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>מספר ימים</Text>
              <Text style={styles.summaryValue}>{calculateTripDuration(report)}</Text>
            </View>
            <View
              style={[
                styles.summaryRow,
                { marginTop: 10, paddingTop: 10, borderTopWidth: 2, borderTopColor: '#60a5fa' },
              ]}
            >
              <Text style={[styles.summaryLabel, { color: '#1e40af', fontWeight: 700 }]}>סה"כ אש"ל לתקופה</Text>
              <Text
                style={[
                  styles.summaryValue,
                  { color: '#1e40af', fontSize: 12, fontWeight: 700 },
                ]}
              >
                ${(
                  report.daily_allowance * calculateTripDuration(report)
                ).toFixed(2)}
              </Text>
            </View>
          </View>
        )}

        {/* Summary */}
        <View style={styles.summaryBox} wrap={false}>
          <Text style={styles.summaryTitle}>סיכום לפי קטגוריות</Text>
          {Object.entries(categoryTotals).map(([category, total]) => (
            <View key={category} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{getCategoryLabel(category)}</Text>
              <Text style={styles.summaryValue}>₪{total.toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>סה"כ כולל:</Text>
            <Text style={styles.totalValue}>₪{report.total_amount_ils?.toFixed(2) || '0.00'}</Text>
          </View>
          {Object.entries(grandTotalByCurrency).length > 0 && (
            <View
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTopWidth: 2,
                borderTopColor: '#93c5fd',
              }}
            >
              <Text
                style={{
                  fontSize: 15,
                  marginBottom: 10,
                  textAlign: 'right',
                  fontWeight: 700,
                  color: '#1f2937',
                }}
              >
                סה"כ לפי מטבעות:
              </Text>
              {Object.entries(grandTotalByCurrency).map(([currency, amount]) => (
                <View key={currency} style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>{currency}</Text>
                  <Text style={styles.summaryValue}>{amount.toFixed(2)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Page>

      {/* Receipt Pages - Start on new page */}
      {expenses.map((expense, expenseIndex) => {
        const imageReceipts = expense.receipts?.filter(r => r.file_type === 'image') || [];
        
        if (imageReceipts.length === 0) return null;

        return imageReceipts.map((receipt, receiptIndex) => (
          <Page key={`${expense.id}-${receipt.id}`} size="A4" orientation="portrait" style={styles.receiptPage} wrap={false}>
            <View style={styles.receiptHeaderBox}>
              <Text style={styles.receiptPageTitle}>פירוט הוצאות וקבלות</Text>
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
