import { Fragment } from 'react';
import type { ResinEstimate, ResinEstimateLine } from '@/lib/resinEstimates/types';
import { RESIN_COMPANY, LOGO_DATA_URI } from '@/lib/resinEstimates/company';

function fmt(n: number) {
  return `R ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' });
}

// Olympic Resins branded quote — product-based line items grouped by category.
// Rendered to PDF via puppeteer (setContent) and shared with the /print page.
export default function ResinEstimateDocument({
  est, lines,
}: { est: ResinEstimate; lines: ResinEstimateLine[] }) {
  // group by category (Resin / Solvent/Thinner / Other), preserving first-seen order
  const cats = [...new Map(lines.map(l => [l.category ?? 'Products', l.category ?? 'Products'])).keys()];
  const subtotal = lines.reduce((s, l) => s + l.unit_price * l.qty, 0);
  const vat = subtotal * 0.15;
  const total = subtotal + vat;

  const termLines = (est.terms?.trim()
    ? est.terms.split('\n').map(t => t.trim()).filter(Boolean)
    : [
        'Prices are quoted per kilogram, excluding VAT unless stated, and exclude delivery unless agreed in writing.',
        'Prices are subject to change in line with raw-material and exchange-rate movements.',
        `This quote is valid for 30 days from the date of issue (${est.estimate_number}).`,
        'Orders are subject to product availability and minimum order quantities.',
        'Payment terms as agreed on the customer account; proof of payment to be emailed with the estimate number as reference.',
      ]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background:#fff; font-family:'Barlow', Arial, Helvetica, sans-serif; color:#2b2b2d; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        h1,h2,h3,.qtitle,.qproject-title,.qnote .amt,.qtotals .grand .val { font-family:'Barlow Condensed','Barlow',Arial,sans-serif; }
        .page { max-width: 860px; margin: 0 auto; padding: 0 24px 12px; }
        @media print { .page { padding: 0 18px 10px; } }
        @page { margin: 10mm 10mm 10mm 10mm; }
        @page :first { margin-top: 0; }

        /* Header */
        .qhead { display:grid; grid-template-columns:auto 1fr auto; align-items:center; background:#fff; border-bottom:3px solid #2805A0; margin:0 -24px 0; }
        @media print { .qhead { margin:0 -18px 0; } }
        .qhead-left { display:flex; align-items:center; padding:6px 10px 6px 24px; }
        .qlogo { width:150px; height:74px; object-fit:contain; object-position:left center; }
        .qtitle-block { display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:0 10px; }
        .qtitle { font-size:26px; font-weight:900; letter-spacing:0.06em; color:#0D0D0D; line-height:1; }
        .qtagline { font-size:8px; font-weight:700; letter-spacing:0.18em; color:#6b7280; text-transform:uppercase; margin-top:3px; }
        .qmeta { text-align:right; font-size:11px; color:#414143; line-height:1.5; padding:4px 24px 4px 10px; white-space:nowrap; }
        .qmeta b { color:#1a1a1a; }

        .qstrip { background:#0D0D0D; color:#fff; font-size:9px; letter-spacing:0.02em; display:flex; flex-wrap:wrap; gap:12px; padding:4px 24px; margin:0 -24px 8px; }

        .qsec-label { font-size:8px; font-weight:800; letter-spacing:0.16em; text-transform:uppercase; color:#2805A0; margin-bottom:3px; }
        .qproject-title { font-size:16px; font-weight:800; color:#1a1a1a; margin-bottom:3px; }
        .qproject-desc { font-size:11px; color:#5e6362; line-height:1.4; max-width:62%; }

        .qparties { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin:8px 0 10px; page-break-inside:avoid; break-inside:avoid; }
        .qparty-name { font-size:12px; font-weight:800; color:#1a1a1a; }
        .qparty-detail { font-size:10.5px; color:#5e6362; margin-top:1px; line-height:1.4; }

        table.qlines { width:100%; border-collapse:collapse; }
        table.qlines thead { display:table-header-group; }
        table.qlines thead th { font-size:8px; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#fff; background:#0D0D0D; padding:4px 8px; text-align:left; }
        table.qlines thead th.r { text-align:right; }
        .qsec-row td { background:#EDEAF9; color:#2805A0; font-weight:800; font-size:10px; letter-spacing:0.08em; text-transform:uppercase; padding:4px 8px; border-top:2px solid #2805A0; }
        .qsec-row td.amt { text-align:right; }
        table.qlines tbody tr { page-break-inside:avoid; break-inside:avoid; }
        table.qlines tbody td { font-size:10.5px; padding:3px 8px; border-bottom:1px solid #eef0ec; color:#2b2b2d; }
        table.qlines tbody td.r { text-align:right; }
        table.qlines tbody td.muted { color:#8a908e; }

        .qbottom { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px; align-items:stretch; page-break-inside:avoid; break-inside:avoid; }
        .qnote { background:#EDEAF9; border:1px solid #C9BEEE; border-radius:5px; padding:8px 12px; }
        .qnote .lbl { font-size:8px; font-weight:800; letter-spacing:0.14em; text-transform:uppercase; color:#2805A0; }
        .qnote .amt { font-size:20px; font-weight:900; color:#2805A0; margin:2px 0 3px; }
        .qnote .sub { font-size:10px; color:#5e6362; }
        .qtotals { align-self:start; }
        .qtotals .row { display:flex; justify-content:space-between; padding:3px 2px; font-size:11px; border-bottom:1px solid #e4e6e2; }
        .qtotals .row .lbl { color:#5e6362; }
        .qtotals .row .val { font-weight:700; color:#1a1a1a; }
        .qtotals .grand { display:flex; justify-content:space-between; align-items:center; background:#2805A0; border-radius:4px; padding:7px 12px; margin-top:4px; }
        .qtotals .grand .lbl { font-size:10px; font-weight:800; letter-spacing:0.08em; text-transform:uppercase; color:#fff; }
        .qtotals .grand .val { font-size:18px; font-weight:900; color:#fff; }

        .qtb { display:grid; grid-template-columns:1.3fr 1fr; gap:16px; page-break-inside:avoid; break-inside:avoid; }
        .qtb-label { font-size:8px; font-weight:800; letter-spacing:0.16em; text-transform:uppercase; color:#2805A0; margin-bottom:4px; }
        .qterms li { font-size:10px; color:#5e6362; line-height:1.45; margin:0 0 2px 12px; }
        .qbank-row { display:flex; justify-content:space-between; border-bottom:1px dotted #d6d9d3; padding:3px 0; font-size:10px; }
        .qbank-row .k { color:#5e6362; }
        .qbank-row .v { font-weight:700; color:#1a1a1a; }

        .qaccept { background:#f7f6f3; border:1.5px solid #e4e6e2; border-radius:5px; padding:10px 14px 12px; color:#2b2b2d; page-break-inside:avoid; break-inside:avoid; }
        .qaccept .h { font-size:8px; font-weight:800; letter-spacing:0.16em; text-transform:uppercase; color:#2805A0; margin-bottom:3px; }
        .qaccept .p { font-size:10px; line-height:1.4; margin-bottom:16px; color:#5e6362; }
        .qsign { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }
        .qsign .line { border-top:1.5px solid #0D0D0D; padding-top:4px; margin-top:28px; font-size:8px; letter-spacing:0.12em; text-transform:uppercase; color:#5e6362; }

        .qfooter { margin-top:10px; text-align:center; font-size:9px; color:#9aa09c; border-top:1px solid #e4e6e2; padding-top:6px; }
        .qcont-row td { background:#0D0D0D; color:#9aa09c; font-size:7px; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; padding:2px 8px; border:none; }
        .qcont-row td.right { text-align:right; }
      `}</style>

      <div className="page">
        {/* Header */}
        <div className="qhead">
          <div className="qhead-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="qlogo" src={LOGO_DATA_URI} alt={RESIN_COMPANY.name} />
          </div>
          <div className="qtitle-block">
            <div className="qtitle">ESTIMATE / QUOTE</div>
            <div className="qtagline">{RESIN_COMPANY.name} · {RESIN_COMPANY.tagline}</div>
          </div>
          <div className="qmeta">
            <div><b>No.</b> {est.estimate_number}</div>
            <div><b>Date</b> {fmtDate(est.date_issued)}</div>
            <div><b>Valid</b> {est.valid_until ? fmtDate(est.valid_until) : '30 days'}</div>
          </div>
        </div>

        {/* Company strip */}
        <div className="qstrip">
          <span>{RESIN_COMPANY.name}</span>
          <span>Reg {RESIN_COMPANY.reg}</span>
          <span>VAT {RESIN_COMPANY.vat}</span>
          <span>Tel: {RESIN_COMPANY.phone}</span>
          <span>{RESIN_COMPANY.email}</span>
        </div>

        {/* Prepared for / by */}
        <div className="qparties">
          <div>
            <div className="qsec-label">Prepared for</div>
            <div className="qparty-name">{est.client}</div>
            <div className="qparty-detail">
              {est.contact_name && <>Attention: {est.contact_name}<br /></>}
              {est.site && <>{est.site}<br /></>}
              {est.contact_email && <>{est.contact_email}<br /></>}
              {est.contact_phone && <>{est.contact_phone}</>}
            </div>
          </div>
          <div>
            <div className="qsec-label">Prepared by</div>
            <div className="qparty-name">{est.prepared_by ?? RESIN_COMPANY.preparedBy}</div>
            <div className="qparty-detail">{RESIN_COMPANY.name}</div>
          </div>
        </div>

        {/* Line items */}
        <table className="qlines">
          <thead>
            <tr className="qcont-row">
              <td colSpan={3}>{RESIN_COMPANY.name} · {est.estimate_number}</td>
              <td colSpan={2} className="right">{est.client}</td>
            </tr>
            <tr>
              <th style={{ width: '48%' }}>Product</th>
              <th>Unit</th>
              <th className="r">Qty</th>
              <th className="r">Unit price</th>
              <th className="r">Amount</th>
            </tr>
          </thead>
          <tbody>
            {cats.map(catKey => {
              const catLines = lines.filter(l => (l.category ?? 'Products') === catKey);
              const catTotal = catLines.reduce((s, l) => s + l.unit_price * l.qty, 0);
              return (
                <Fragment key={`cat-${catKey}`}>
                  <tr className="qsec-row">
                    <td colSpan={4}>{catKey}</td>
                    <td className="amt">{fmt(catTotal)}</td>
                  </tr>
                  {catLines.map(l => (
                    <tr key={l.id}>
                      <td>{l.description}{l.product_code ? <span className="muted"> · {l.product_code}</span> : null}</td>
                      <td className="muted">{l.unit ?? 'kg'}</td>
                      <td className="r">{l.qty}</td>
                      <td className="r">{fmt(l.unit_price)}</td>
                      <td className="r" style={{ fontWeight: 600 }}>{fmt(l.unit_price * l.qty)}</td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        {/* Notes + totals */}
        <div className="qbottom">
          <div className="qnote">
            <div className="lbl">{est.notes?.trim() ? 'Notes' : 'Order Total (incl. VAT)'}</div>
            {est.notes?.trim()
              ? <div className="sub" style={{ marginTop: '4px' }}>{est.notes}</div>
              : <><div className="amt">{fmt(total)}</div>
                  <div className="sub">Prices per kg · excludes delivery unless agreed</div></>}
          </div>
          <div className="qtotals">
            <div className="row"><span className="lbl">Subtotal (excl. VAT)</span><span className="val">{fmt(subtotal)}</span></div>
            <div className="row"><span className="lbl">VAT @ 15%</span><span className="val">{fmt(vat)}</span></div>
            <div className="grand"><span className="lbl">Total (incl. VAT)</span><span className="val">{fmt(total)}</span></div>
          </div>
        </div>

        {/* Terms + banking */}
        <div className="qtb" style={{ marginBottom: '10px', marginTop: '10px' }}>
          <div>
            <div className="qtb-label">Terms &amp; Conditions</div>
            <ul className="qterms">
              {termLines.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
          <div>
            <div className="qtb-label">Banking Details</div>
            <div className="qbank-row"><span className="k">Account name</span><span className="v">{RESIN_COMPANY.bank.accountName}</span></div>
            <div className="qbank-row"><span className="k">Bank</span><span className="v">{RESIN_COMPANY.bank.bank}</span></div>
            <div className="qbank-row"><span className="k">Branch code</span><span className="v">{RESIN_COMPANY.bank.branchCode}</span></div>
            <div className="qbank-row"><span className="k">Account no.</span><span className="v">{RESIN_COMPANY.bank.accountNo}</span></div>
          </div>
        </div>

        {/* Accept */}
        <div className="qaccept">
          <div className="h">Accept this Estimate / Quote</div>
          <div className="p">I accept this estimate/quote and authorise {RESIN_COMPANY.name} to proceed with the supply described, subject to the terms above.</div>
          <div className="qsign">
            <div className="line">Signature</div>
            <div className="line">Name &amp; Capacity</div>
            <div className="line">Date</div>
          </div>
        </div>

        <div className="qfooter">
          Estimate/Quote {est.estimate_number} · {est.client} · {RESIN_COMPANY.name} · {RESIN_COMPANY.website}
        </div>
      </div>
    </>
  );
}
