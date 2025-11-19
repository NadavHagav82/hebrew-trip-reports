import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
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
}

interface ReportPdfProps {
  report: Report;
  expenses: Expense[];
}

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    padding: 32,
    fontFamily: 'Heebo',
    direction: 'rtl',
  },
  header: {
    textAlign: 'right',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 8,
    marginTop: 16,
  },
  row: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 11,
  },
  value: {
    fontSize: 11,
    fontWeight: 600,
  },
  table: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#cccccc',
  },
  tableHeader: {
    flexDirection: 'row-reverse',
    backgroundColor: '#424242',
  },
  tableHeaderCell: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  tableHeaderText: {
    fontSize: 10,
    color: '#ffffff',
    textAlign: 'right',
  },
  tableRow: {
    flexDirection: 'row-reverse',
  },
  tableCell: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#eeeeee',
  },
  tableCellText: {
    fontSize: 9,
    textAlign: 'right',
  },
  summaryRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#cccccc',
    paddingTop: 8,
  },
  bold: {
    fontWeight: 700,
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

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>דוח נסיעה</Text>
          <Text style={styles.label}>יעד: <Text style={styles.value}>{report.trip_destination}</Text></Text>
          <Text style={styles.label}>מטרת הנסיעה: <Text style={styles.value}>{report.trip_purpose}</Text></Text>
          <Text style={styles.label}>
            תאריך התחלה: <Text style={styles.value}>{format(new Date(report.trip_start_date), 'dd/MM/yyyy')}</Text>
          </Text>
          <Text style={styles.label}>
            תאריך סיום: <Text style={styles.value}>{format(new Date(report.trip_end_date), 'dd/MM/yyyy')}</Text>
          </Text>
          <Text style={styles.label}>
            משך הנסיעה: <Text style={styles.value}>{calculateTripDuration(report)} ימים</Text>
          </Text>
          <Text style={styles.label}>
            תאריך יצירה: <Text style={styles.value}>{format(new Date(report.created_at), 'dd/MM/yyyy HH:mm')}</Text>
          </Text>
        </View>

        <Text style={styles.sectionTitle}>הוצאות</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <View style={styles.tableHeaderCell}>
              <Text style={styles.tableHeaderText}>תאריך</Text>
            </View>
            <View style={styles.tableHeaderCell}>
              <Text style={styles.tableHeaderText}>קטגוריה</Text>
            </View>
            <View style={styles.tableHeaderCell}>
              <Text style={styles.tableHeaderText}>תיאור</Text>
            </View>
            <View style={styles.tableHeaderCell}>
              <Text style={styles.tableHeaderText}>סכום</Text>
            </View>
            <View style={styles.tableHeaderCell}>
              <Text style={styles.tableHeaderText}>סכום בש"ח</Text>
            </View>
          </View>

          {expenses.map((expense) => (
            <View key={expense.id} style={styles.tableRow}>
              <View style={styles.tableCell}>
                <Text style={styles.tableCellText}>
                  {format(new Date(expense.expense_date), 'dd/MM/yyyy')}
                </Text>
              </View>
              <View style={styles.tableCell}>
                <Text style={styles.tableCellText}>{getCategoryLabel(expense.category)}</Text>
              </View>
              <View style={styles.tableCell}>
                <Text style={styles.tableCellText}>{expense.description}</Text>
              </View>
              <View style={styles.tableCell}>
                <Text style={styles.tableCellText}>
                  {expense.amount} {expense.currency}
                </Text>
              </View>
              <View style={styles.tableCell}>
                <Text style={styles.tableCellText}>₪{expense.amount_in_ils.toFixed(2)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.bold}>סה"כ:</Text>
          <Text style={styles.bold}>₪{report.total_amount_ils.toFixed(2)}</Text>
        </View>

        {Object.entries(categoryTotals).map(([category, total]) => (
          <View key={category} style={styles.row}>
            <Text style={styles.label}>{getCategoryLabel(category)}:</Text>
            <Text style={styles.value}>₪{total.toFixed(2)}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
};
