/* Quote Studio — génération du PDF client (jsPDF + AutoTable, vectoriel, A4).
   Ne reçoit que la vue client (SADoc.publicView) : coûts internes et notes privées n'y figurent jamais. */
(function () {
  'use strict';

  var COL = { ink: [23, 19, 15], mute: [92, 85, 75], bronze: [122, 91, 23], gold: [201, 162, 74], line: [203, 192, 173], paper: [239, 232, 220], night: [13, 12, 11] };
  var W = 210, H = 297, M = 16, BOTTOM = H - 20;

  function registerFonts(pdf) {
    var F = window.SA_PDF_FONTS || {};
    [['Archivo-Regular', 'Archivo', 'normal'], ['Archivo-SemiBold', 'Archivo', 'bold'],
     ['Archivo-CondensedExtraBold', 'ArchivoCond', 'normal'], ['InstrumentSerif-Italic', 'Serif', 'italic']].forEach(function (f) {
      if (!F[f[0]]) return;
      pdf.addFileToVFS(f[0] + '.ttf', F[f[0]]);
      pdf.addFont(f[0] + '.ttf', f[1], f[2]);
    });
    return !!F['Archivo-Regular'];
  }

  function build(view) {
    var JsPDF = window.jspdf.jsPDF;
    var pdf = new JsPDF({ unit: 'mm', format: 'a4', compress: true });
    var hasFonts = registerFonts(pdf);
    var SANS = hasFonts ? 'Archivo' : 'helvetica', COND = hasFonts ? 'ArchivoCond' : 'helvetica', SERIF = hasFonts ? 'Serif' : 'times';
    pdf.setProperties({ title: view.title + ' ' + view.number + ' — Sultan Agency', subject: view.subject || view.title, author: 'Sultan Agency', creator: 'Quote Studio' });

    var y = M;
    function font(f, style, size, color) { pdf.setFont(f, style || 'normal'); pdf.setFontSize(size); pdf.setTextColor.apply(pdf, color || COL.ink); }
    function text(str, x, yy, opts) { pdf.text(String(str), x, yy, opts || {}); }
    function ensure(h) { if (y + h > BOTTOM) { pdf.addPage(); y = M + 4; } }
    function label(str, x, yy) { font(SANS, 'bold', 6.6, COL.mute); pdf.setCharSpace(0.6); text(str.toUpperCase(), x, yy); pdf.setCharSpace(0); }
    function wrap(str, width, size) { pdf.setFontSize(size); return pdf.splitTextToSize(String(str), width); }

    /* ---------- En-tête ---------- */
    pdf.setDrawColor.apply(pdf, COL.gold); pdf.setLineWidth(0.5); pdf.rect(M, y, 12, 12);
    font(COND, 'normal', 11, COL.bronze); text('SA', M + 6, y + 8, { align: 'center' });
    font(COND, 'normal', 15, COL.ink); pdf.setCharSpace(0.4); text('SULTAN AGENCY', M + 16, y + 5.4); pdf.setCharSpace(0);
    font(SANS, 'normal', 7.2, COL.mute); text(view.agency.tagline, M + 16, y + 9.4);
    font(SERIF, 'italic', 9.5, COL.bronze); text(view.agency.slogan, M + 16, y + 13.6);

    font(COND, 'normal', 26, COL.ink); text(view.title.toUpperCase(), W - M, y + 8.5, { align: 'right' });
    font(SANS, 'bold', 9.5, COL.ink); text(view.number, W - M, y + 14, { align: 'right' });
    var dy = y + 19;
    view.dates.forEach(function (d) {
      font(SANS, 'bold', 7.6, COL.ink); var vw = pdf.getTextWidth(d.value); text(d.value, W - M, dy, { align: 'right' });
      font(SANS, 'normal', 7.6, COL.mute); text(d.label + ' :', W - M - vw - 1.4, dy, { align: 'right' });
      dy += 4;
    });
    if (view.reference) { font(SANS, 'normal', 7.6, COL.mute); text(view.reference, W - M, dy, { align: 'right' }); dy += 4; }
    y = Math.max(y + 20, dy) + 2;
    pdf.setDrawColor.apply(pdf, COL.gold); pdf.setLineWidth(0.6); pdf.line(M, y, W - M, y);
    y += 8;

    /* ---------- Émetteur / client ---------- */
    var colW = (W - 2 * M - 10) / 2, x2 = M + colW + 10;
    label('Émetteur', M, y); label(view.isInvoice ? 'Facturé à' : 'Client', x2, y);
    var y1 = y + 5, y2 = y + 5;
    font(SANS, 'bold', 10, COL.ink); text(view.agency.name, M, y1); y1 += 4.6;
    font(SANS, 'normal', 8.2, COL.ink);
    view.agency.lines.forEach(function (l) { wrap(l, colW, 8.2).forEach(function (s) { text(s, M, y1); y1 += 3.8; }); });
    font(SANS, 'bold', 10, COL.ink); wrap(view.client.name, colW, 10).forEach(function (s) { text(s, x2, y2); y2 += 4.6; });
    font(SANS, 'normal', 8.2, COL.ink);
    view.client.lines.forEach(function (l) { wrap(l, colW, 8.2).forEach(function (s) { text(s, x2, y2); y2 += 3.8; }); });
    y = Math.max(y1, y2) + 5;

    /* ---------- Objet ---------- */
    if (view.subject || view.description) {
      ensure(16);
      pdf.setFillColor.apply(pdf, COL.paper);
      var descLines = view.description ? wrap(view.description, W - 2 * M - 10, 8.4) : [];
      var subjLines = view.subject ? wrap(view.subject, W - 2 * M - 10, 10.5) : [];
      var boxH = 7 + subjLines.length * 4.8 + descLines.length * 3.9 + 3;
      if (y + boxH > BOTTOM) { pdf.addPage(); y = M + 4; }
      pdf.rect(M, y, W - 2 * M, boxH, 'F');
      label('Objet', M + 5, y + 5.5);
      var oy = y + 10.5;
      font(SANS, 'bold', 10.5, COL.ink); subjLines.forEach(function (s) { text(s, M + 5, oy); oy += 4.8; });
      font(SANS, 'normal', 8.4, COL.ink); descLines.forEach(function (s) { text(s, M + 5, oy); oy += 3.9; });
      y += boxH + 6;
    }

    /* ---------- Tableau des prestations ----------
       Désignation et description dans une même cellule (jamais séparées par un saut de page) :
       le texte est découpé à l'avance, puis dessiné avec deux styles. */
    var COL0 = W - 2 * M - 14 - 36 - 36, PADL = 3, PADR = 3;
    var body = [];
    view.sections.forEach(function (sec) {
      body.push([{ content: sec.title.toUpperCase(), colSpan: 4, styles: { font: COND, fontSize: 8.6, textColor: COL.ink, fillColor: COL.paper, cellPadding: { top: 2.2, bottom: 1.8, left: 3, right: 3 } } }]);
      sec.rows.forEach(function (r) {
        pdf.setFont(SANS, 'bold'); var lab = wrap(r.label, COL0 - PADL - PADR, 8.8);
        pdf.setFont(SANS, 'normal'); var des = r.desc ? wrap(r.desc, COL0 - PADL - PADR, 7.6) : [];
        /* hauteur réservée : lignes du libellé (4,1 mm) + lignes de description (3,4 mm), exprimées en lignes de 8,8 pt */
        var units = Math.ceil((lab.length * 4.1 + (des.length ? 0.8 + des.length * 3.4 : 0)) / 4.1);
        var filler = []; for (var k = 0; k < units; k++) filler.push(' ');
        body.push([
          { content: filler.join('\n'), styles: { font: SANS, fontSize: 8.8 }, lab: lab, des: des },
          { content: r.qty, styles: { halign: 'center' } },
          { content: r.unit, styles: { halign: 'right' } },
          { content: r.total, styles: { halign: 'right', fontStyle: 'bold' } }
        ]);
      });
    });
    if (body.length) {
      ensure(24);
      window.autoTable(pdf, {
        startY: y, margin: { left: M, right: M, top: M + 4, bottom: 22 },
        head: [['Désignation', 'Qté', 'Prix unitaire', 'Montant']],
        body: body, theme: 'plain', rowPageBreak: 'avoid',
        styles: { font: SANS, fontSize: 8.6, textColor: COL.ink, cellPadding: { top: 2.8, bottom: 2.8, left: PADL, right: 2 }, overflow: 'linebreak', valign: 'top' },
        headStyles: { font: SANS, fontStyle: 'bold', fontSize: 7, textColor: COL.mute, cellPadding: { top: 2, bottom: 2.4, left: 3, right: 2 } },
        columnStyles: { 0: { cellWidth: COL0 }, 1: { cellWidth: 14, halign: 'center' }, 2: { cellWidth: 36, halign: 'right' }, 3: { cellWidth: 36, halign: 'right' } },
        didParseCell: function (h) { if (h.section === 'head' && h.column.index > 0) h.cell.styles.halign = h.column.index === 1 ? 'center' : 'right'; },
        willDrawCell: function (h) { if (h.section === 'body' && h.cell.raw && h.cell.raw.lab) h.cell.text = []; },
        didDrawCell: function (h) {
          var raw = h.cell.raw;
          if (h.section === 'body' && raw && raw.lab) {
            var yy = h.cell.y + 2.8 + 3;
            font(SANS, 'bold', 8.8, COL.ink); raw.lab.forEach(function (s) { text(s, h.cell.x + PADL, yy); yy += 4.1; });
            if (raw.des.length) { yy += 0.8 - 0.7; font(SANS, 'normal', 7.6, COL.mute); raw.des.forEach(function (s) { text(s, h.cell.x + PADL, yy); yy += 3.4; }); }
          }
          pdf.setDrawColor.apply(pdf, COL.line); pdf.setLineWidth(0.2);
          pdf.line(h.cell.x, h.cell.y + h.cell.height, h.cell.x + h.cell.width, h.cell.y + h.cell.height);
        }
      });
      y = pdf.lastAutoTable.finalY + 6;
    }

    /* ---------- Totaux ---------- */
    var tw = 84, tx = W - M - tw;
    var rows = view.totals.length + 1;
    ensure(rows * 5.2 + 12);
    view.totals.forEach(function (r) {
      font(SANS, 'normal', 8.6, COL.mute); text(r.label, tx, y);
      font(SANS, 'bold', 8.6, COL.ink); text(r.value, W - M, y, { align: 'right' }); y += 5.2;
    });
    pdf.setDrawColor.apply(pdf, COL.ink); pdf.setLineWidth(0.5); pdf.line(tx, y - 1.6, W - M, y - 1.6);
    y += 4.2;
    font(SANS, 'bold', 8.2, COL.ink); text(view.grand.label, tx, y);
    font(COND, 'normal', 15, COL.ink); text(view.grand.value, W - M, y + 0.6, { align: 'right' });
    y += 8;
    if (view.isInvoice && view.paid) {
      font(SANS, 'normal', 8.6, COL.mute); text('Déjà réglé', tx, y); font(SANS, 'bold', 8.6, COL.ink); text('-' + view.paidLabel, W - M, y, { align: 'right' }); y += 5.2;
      font(SANS, 'bold', 9.4, COL.bronze); text('Reste à payer', tx, y); text(view.remainingLabel, W - M, y, { align: 'right' }); y += 7;
    }

    if (view.recurring.length) {
      ensure(view.recurring.length * 5 + 12);
      label('Abonnements — facturés séparément selon leur périodicité', M, y); y += 5;
      view.recurring.forEach(function (r) {
        font(SANS, 'normal', 8.6, COL.mute); text(r.label, M, y);
        font(SANS, 'bold', 8.6, COL.ink); text(r.value, W - M, y, { align: 'right' }); y += 5;
      });
      y += 1;
    }
    if (view.rateNote) { ensure(8); font(SANS, 'normal', 7.4, COL.mute); wrap(view.rateNote, W - 2 * M, 7.4).forEach(function (s) { text(s, M, y); y += 3.4; }); y += 3; }

    /* ---------- Modalités de paiement ---------- */
    if (view.schedule.steps.length) {
      ensure(10 + view.schedule.steps.length * 6);
      y += 2; label('Modalités de paiement', M, y); y += 2;
      window.autoTable(pdf, {
        startY: y, margin: { left: M, right: M, top: M + 4, bottom: 22 }, theme: 'plain',
        head: [['Échéance', '%', 'Montant', 'Date prévue']],
        body: view.schedule.steps.map(function (s) { return [s.label, window.SACalc.fmtQty(s.percent) + ' %', s.amount == null ? '' : window.SACalc.fmtXof(s.amount), s.date ? window.SACalc.fmtDate(s.date) : (view.blank ? '' : '—')]; }),
        styles: { font: SANS, fontSize: 8.4, textColor: COL.ink, cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 } },
        headStyles: { font: SANS, fontStyle: 'bold', fontSize: 7, textColor: COL.mute },
        columnStyles: { 1: { cellWidth: 16, halign: 'right' }, 2: { cellWidth: 36, halign: 'right', fontStyle: 'bold' }, 3: { cellWidth: 28, halign: 'right' } },
        didParseCell: function (h) { if (h.section === 'head' && h.column.index > 0) h.cell.styles.halign = 'right'; },
        didDrawCell: function (h) { pdf.setDrawColor.apply(pdf, COL.line); pdf.setLineWidth(0.2); pdf.line(h.cell.x, h.cell.y + h.cell.height, h.cell.x + h.cell.width, h.cell.y + h.cell.height); }
      });
      y = pdf.lastAutoTable.finalY + 5;
    }
    if (view.paymentMethods) {
      ensure(10); label('Moyens de paiement', M, y); y += 4.4;
      font(SANS, 'normal', 8.2, COL.ink); wrap(view.paymentMethods, W - 2 * M, 8.2).forEach(function (s) { ensure(4); text(s, M, y); y += 3.8; }); y += 3;
    }
    if (view.clientNotes) {
      ensure(10); label('Remarques', M, y); y += 4.4;
      font(SANS, 'normal', 8.2, COL.ink); wrap(view.clientNotes, W - 2 * M, 8.2).forEach(function (s) { ensure(4); text(s, M, y); y += 3.8; }); y += 3;
    }

    /* ---------- Conditions ---------- */
    if (view.conditions.length) {
      ensure(14); y += 1; label('Conditions commerciales', M, y); y += 4.6;
      view.conditions.forEach(function (c) {
        var ls = wrap(c, W - 2 * M - 4, 7.6);
        ensure(ls.length * 3.4 + 1);
        pdf.setFillColor.apply(pdf, COL.gold); pdf.rect(M, y - 1.6, 1.4, 1.4, 'F');
        font(SANS, 'normal', 7.6, COL.ink);
        ls.forEach(function (s) { text(s, M + 4, y); y += 3.4; });
        y += 1.2;
      });
    }

    /* ---------- Signatures ---------- */
    if (view.signature) {
      var sh = 34;
      if (y + sh + 6 > BOTTOM) { pdf.addPage(); y = M + 4; }
      y += 5;
      var bw = (W - 2 * M - 8) / 2;
      [[M, 'Pour Sultan Agency', 'Date et signature'], [M + bw + 8, 'Bon pour accord — le client', 'Nom, date, signature et cachet, précédés de la mention « Bon pour accord »']].forEach(function (b) {
        pdf.setDrawColor.apply(pdf, COL.line); pdf.setLineWidth(0.3); pdf.rect(b[0], y, bw, sh);
        label(b[1], b[0] + 4, y + 6);
        font(SANS, 'normal', 7, COL.mute); wrap(b[2], bw - 8, 7).forEach(function (s, i) { text(s, b[0] + 4, y + 10.5 + i * 3.2); });
      });
      y += sh;
    }

    /* ---------- Pied de page ---------- */
    var n = pdf.getNumberOfPages();
    for (var p = 1; p <= n; p++) {
      pdf.setPage(p);
      pdf.setDrawColor.apply(pdf, COL.line); pdf.setLineWidth(0.2); pdf.line(M, H - 13, W - M, H - 13);
      font(SANS, 'normal', 6.8, COL.mute); text(view.footer, M, H - 8.6);
      text(view.title + ' ' + view.number + ' · page ' + p + ' / ' + n, W - M, H - 8.6, { align: 'right' });
    }
    return pdf;
  }

  function fileName(view, client) {
    var c = String(client || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    return view.number + (c ? '-' + c : '') + '.pdf';
  }

  window.SAPdf = { build: build, fileName: fileName };
})();
