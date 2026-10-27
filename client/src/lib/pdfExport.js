import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportPollToPDF = (exportData) => {
  if (!exportData || !exportData.room) {
    throw new Error('Invalid export data provided for PDF generation.');
  }

  const { room, questions = [] } = exportData;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Primary palette
  const PRIMARY = [16, 185, 129]; // Emerald 500
  const DARK = [15, 23, 42];      // Slate 900
  const GRAY = [100, 116, 139];   // Slate 500
  const LIGHT_BG = [248, 250, 252];

  // 1. Header Banner
  doc.setFillColor(...DARK);
  doc.rect(0, 0, pageWidth, 80, 'F');

  doc.setTextColor(...PRIMARY);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('QuickPoll Live', 40, 45);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Official Real-Time Polling Analytics Report', 40, 62);

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.text(`Generated: ${dateStr}`, pageWidth - 40, 48, { align: 'right' });

  // 2. Room Metadata Card
  let currentY = 105;
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(40, currentY, pageWidth - 80, 75, 6, 6, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(40, currentY, pageWidth - 80, 75, 6, 6, 'D');

  doc.setTextColor(...DARK);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(room.title || 'Live Poll Session', 55, currentY + 25);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);

  doc.text(`Session PIN:`, 55, currentY + 45);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...PRIMARY);
  doc.text(room.pin || 'N/A', 115, currentY + 45);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(`Status:`, 180, currentY + 45);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text(String(room.status || 'active').toUpperCase(), 220, currentY + 45);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(`Total Questions:`, 320, currentY + 45);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text(String(questions.length), 400, currentY + 45);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(`Total Voters:`, 55, currentY + 62);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text(String(room.totalUniqueVoters ?? 0), 115, currentY + 62);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(`Created:`, 180, currentY + 62);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...DARK);
  doc.text(new Date(room.createdAt || Date.now()).toLocaleDateString(), 225, currentY + 62);

  currentY += 95;

  // 3. Questions Breakdown
  const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];

  questions.forEach((q, qIndex) => {
    // Check if new page needed
    if (currentY > pageHeight - 160) {
      doc.addPage();
      currentY = 40;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(`Question #${q.order || qIndex + 1}: ${q.text}`, 40, currentY);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(`Total Votes: ${q.totalVotes || 0}`, pageWidth - 40, currentY, { align: 'right' });

    currentY += 10;

    const tableRows = (q.options || []).map((opt, optIndex) => {
      const letter = optionLetters[optIndex % optionLetters.length];
      const count = opt.voteCount || 0;
      const pct = opt.percentage !== undefined ? `${opt.percentage}%` : '0%';
      return [letter, opt.text, count, pct];
    });

    autoTable(doc, {
      startY: currentY,
      margin: { left: 40, right: 40 },
      head: [['Option', 'Choice Description', 'Vote Count', 'Percentage']],
      body: tableRows,
      theme: 'grid',
      headStyles: {
        fillColor: DARK,
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'left',
      },
      columnStyles: {
        0: { cellWidth: 50, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 80, halign: 'center' },
        3: { cellWidth: 80, halign: 'center', fontStyle: 'bold' },
      },
      styles: {
        fontSize: 9,
        cellPadding: 6,
        textColor: DARK,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    currentY = doc.lastAutoTable.finalY + 25;
  });

  // 4. Footer on each page
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(40, pageHeight - 30, pageWidth - 40, pageHeight - 30);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text('QuickPoll Live • Verified Real-Time Polling Platform', 40, pageHeight - 18);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 40, pageHeight - 18, { align: 'right' });
  }

  // Save the PDF
  const filename = `QuickPoll_${room.pin}_Analytics_Report.pdf`;
  doc.save(filename);
};
