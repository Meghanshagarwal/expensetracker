import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Expense, Person } from '@/types';

// Helper to format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

// Helper to format currency
const formatCurrency = (amount: number) => {
  return `Rs. ${amount.toFixed(2)}`;
};

export const exportToCSV = (expenses: Expense[], persons: Person[]) => {
  const personMap = new Map(persons.map(p => [p._id, p.name]));
  const headers = ['Date', 'Title', 'Category', 'Amount (Rs)', 'Person', 'Payment Method', 'Notes'];
  
  const rows = expenses.map(exp => [
    formatDate(exp.date),
    exp.title,
    exp.category,
    exp.amount,
    personMap.get(exp.personId) || 'Unknown',
    exp.paymentMethod,
    exp.notes || '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Expense_Report_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToExcel = (expenses: Expense[], persons: Person[]) => {
  const personMap = new Map(persons.map(p => [p._id, p.name]));
  const data = expenses.map(exp => ({
    Date: formatDate(exp.date),
    Title: exp.title,
    Category: exp.category,
    'Amount (Rs)': exp.amount,
    Person: personMap.get(exp.personId) || 'Unknown',
    'Payment Method': exp.paymentMethod,
    Notes: exp.notes || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses');
  XLSX.writeFile(workbook, `Expense_Report_${Date.now()}.xlsx`);
};

export const exportToPDF = (expenses: Expense[], persons: Person[]) => {
  const personMap = new Map(persons.map(p => [p._id, p.name]));
  const doc = new jsPDF() as any;

  // Header banner
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, 210, 35, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text('EXPENSE TRACKER REPORT', 14, 18);
  
  doc.setFontSize(9);
  doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 14, 27);
  doc.text(`Total Records: ${expenses.length}`, 150, 27);

  // Total summary card below header
  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text(`Summary Total Spend: ${formatCurrency(totalAmount)}`, 14, 45);

  // Table header & data
  const tableColumn = ['Date', 'Title', 'Category', 'Amount', 'Person', 'Method'];
  const tableRows = expenses.map(exp => [
    formatDate(exp.date),
    exp.title,
    exp.category,
    formatCurrency(exp.amount),
    personMap.get(exp.personId) || 'Unknown',
    exp.paymentMethod,
  ]);

  doc.autoTable({
    startY: 50,
    head: [tableColumn],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [59, 130, 246] }, // Blue 500
    alternateRowStyles: { fillColor: [248, 250, 252] }, // Slate 50
    margin: { top: 50 },
  });

  doc.save(`Expense_Report_${Date.now()}.pdf`);
};
