import React, { useRef, useState } from 'react';
import { Printer, Download, X, CheckCircle, FileText, ShieldCheck } from 'lucide-react';
import type { ApiRecord } from '../services/api';

interface ReceiptWaliModalProps {
  transaction: ApiRecord | null;
  child: ApiRecord | null;
  onClose: () => void;
}

function angkaTerbilang(n: number): string {
  const num = Math.floor(Math.abs(n));
  if (num === 0) return 'Nol Rupiah';

  const satuan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];

  function convert(val: number): string {
    if (val < 12) return satuan[val];
    if (val < 20) return convert(val - 10) + ' Belas';
    if (val < 100) return convert(Math.floor(val / 10)) + ' Puluh ' + convert(val % 10);
    if (val < 200) return 'Seratus ' + convert(val - 100);
    if (val < 1000) return convert(Math.floor(val / 100)) + ' Ratus ' + convert(val % 100);
    if (val < 2000) return 'Seribu ' + convert(val - 1000);
    if (val < 1000000) return convert(Math.floor(val / 1000)) + ' Ribu ' + convert(val % 1000);
    if (val < 1000000000) return convert(Math.floor(val / 1000000)) + ' Juta ' + convert(val % 1000000);
    return convert(Math.floor(val / 1000000000)) + ' Miliar ' + convert(val % 1000000000);
  }

  return (convert(num).trim().replace(/\s+/g, ' ') + ' Rupiah').replace(/^Satu Ratus/, 'Seratus');
}

export function ReceiptWaliModal({ transaction, child, onClose }: ReceiptWaliModalProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [isDownloadingJpg, setIsDownloadingJpg] = useState(false);

  if (!transaction) return null;

  const kodeTrx = String(
    transaction.kode_transaksi ||
    transaction.transaction_code ||
    transaction.receipt_number ||
    transaction.nomor_transaksi ||
    `TRX-${transaction.id || '0000'}`
  );

  const tglBayar = String(transaction.tanggal || transaction.created_at || new Date().toISOString().slice(0, 10));
  const totalBayar = Number(transaction.jumlah || transaction.amount || transaction.jumlah_total || 0);
  const terbilangText = angkaTerbilang(totalBayar);

  const namaSantri = String(
    transaction.siswa_nama ||
    (transaction.siswa as Record<string, unknown> | undefined)?.nama ||
    child?.nama ||
    '-'
  );

  const nisSantri = String(
    transaction.nis ||
    (transaction.siswa as Record<string, unknown> | undefined)?.nis ||
    child?.nis ||
    '-'
  );

  const kelasSantri = String(
    transaction.kelas ||
    (transaction.siswa as Record<string, unknown> | undefined)?.kelas ||
    child?.kelas ||
    '-'
  );

  const kamarSantri = String(
    (transaction.siswa as Record<string, unknown> | undefined)?.kamar ||
    child?.kamar ||
    child?.komplek ||
    '-'
  );

  const namaWali = String(
    transaction.atas_nama ||
    (transaction.wali as Record<string, unknown> | undefined)?.name ||
    child?.nama_wali ||
    'Wali Santri'
  );

  const metodeBayar = String(
    transaction.via ||
    transaction.metode ||
    transaction.metode_pembayaran ||
    'Transfer Bank BSI'
  );

  const penerimaPetugas = String(
    (transaction.creator as Record<string, unknown> | undefined)?.name ||
    transaction.penerima ||
    'Bendahara Pondok'
  );

  const rawItems = (
    Array.isArray(transaction.payment_items) ? transaction.payment_items :
    Array.isArray(transaction.items) ? transaction.items : []
  ) as ApiRecord[];

  const items = rawItems.length > 0 ? rawItems : [
    {
      nama: String(transaction.jenis || transaction.keterangan || 'Pembayaran Biaya Pendidikan Santri'),
      jumlah: totalBayar,
      keterangan: 'Lunas',
    }
  ];

  // PRINT HANDLER
  const handlePrint = () => {
    window.print();
  };

  // DOWNLOAD JPG HANDLER (Native HTML5 Canvas Renderer)
  const handleDownloadJpg = async () => {
    setIsDownloadingJpg(true);
    try {
      const width = 800;
      const height = 1050;
      const canvas = document.createElement('canvas');
      canvas.width = width * 2; // 2x scale for crystal clear HD render
      canvas.height = height * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(2, 2);

      // Background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);

      // Header Banner Border
      ctx.fillStyle = '#138F81';
      ctx.fillRect(0, 0, width, 10);

      // Load and draw official Qomaruddin logo
      const logoImg = new Image();
      logoImg.crossOrigin = 'anonymous';
      logoImg.src = '/logo-qomaruddin.png';
      await new Promise<void>((resolve) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = () => resolve();
      });

      if (logoImg.complete && logoImg.naturalWidth > 0) {
        ctx.drawImage(logoImg, 50, 32, 75, 75);
      }

      // Header Kop text
      ctx.textAlign = 'left';
      ctx.fillStyle = '#138F81';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('YAYASAN PONDOK PESANTREN QOMARUDDIN', 140, 50);

      ctx.fillStyle = '#1e293b';
      ctx.font = '900 18px sans-serif';
      ctx.fillText('LEMBAGA PENDIDIKAN & MADRASAH DINIYAH', 140, 74);

      ctx.fillStyle = '#64748b';
      ctx.font = 'normal 11px sans-serif';
      ctx.fillText('Sampurnan, Bungah, Kabupaten Gresik, Jawa Timur 61152 • Telp: (031) 3949173', 140, 93);
      ctx.fillText('Email: info@ppqomaruddin.itqom.net • Website: ppqomaruddin.itqom.net', 140, 107);

      // Double Line Divider
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(40, 122);
      ctx.lineTo(width - 40, 122);
      ctx.stroke();

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(40, 126);
      ctx.lineTo(width - 40, 126);
      ctx.stroke();

      // Title & Watermark
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 16px sans-serif';
      ctx.fillText('KWITANSI BUKTI PEMBAYARAN SYAHH', width / 2, 155);

      ctx.fillStyle = '#059669';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('NOMOR: ' + kodeTrx, width / 2, 175);

      // Info Box (Santri & Transaksi)
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(40, 195, width - 80, 120, 10);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('DATA SANTRI & WALI', 55, 218);
      ctx.fillText('RINCIAN TRANSAKSI', width / 2 + 10, 218);

      ctx.font = 'normal 11px sans-serif';
      ctx.fillStyle = '#334155';
      ctx.fillText(`Nama Santri : ${namaSantri}`, 55, 242);
      ctx.fillText(`NIS          : ${nisSantri}`, 55, 262);
      ctx.fillText(`Kelas        : ${kelasSantri}`, 55, 282);
      ctx.fillText(`Wali / Ortu  : ${namaWali}`, 55, 302);

      ctx.fillText(`Tanggal Bayar : ${tglBayar}`, width / 2 + 10, 242);
      ctx.fillText(`Metode        : ${metodeBayar}`, width / 2 + 10, 262);
      ctx.fillText(`Bendahara     : ${penerimaPetugas}`, width / 2 + 10, 282);
      ctx.fillText(`Status        : LUNAS (TERVERIFIKASI)`, width / 2 + 10, 302);

      // Table Header
      let curY = 345;
      ctx.fillStyle = '#138F81';
      ctx.fillRect(40, curY, width - 80, 28);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('NO', 55, curY + 18);
      ctx.fillText('URAIAN POS PEMBAYARAN', 95, curY + 18);
      ctx.textAlign = 'right';
      ctx.fillText('JUMLAH (RP)', width - 55, curY + 18);

      // Table Rows
      curY += 28;
      ctx.textAlign = 'left';
      items.forEach((it, i) => {
        ctx.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#f8fafc';
        ctx.fillRect(40, curY, width - 80, 26);
        ctx.strokeStyle = '#f1f5f9';
        ctx.strokeRect(40, curY, width - 80, 26);

        ctx.fillStyle = '#334155';
        ctx.font = 'normal 11px sans-serif';
        ctx.fillText(String(i + 1), 58, curY + 17);
        ctx.fillText(String(it.nama || it.jenis || 'Tagihan Syahriah'), 95, curY + 17);

        ctx.textAlign = 'right';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('Rp ' + Number(it.jumlah || 0).toLocaleString('id-ID'), width - 55, curY + 17);
        ctx.textAlign = 'left';
        curY += 26;
      });

      // Total Box
      curY += 10;
      ctx.fillStyle = '#E8F7F3';
      ctx.strokeStyle = '#138F81';
      ctx.beginPath();
      ctx.roundRect(40, curY, width - 80, 48, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0D7A6F';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('TOTAL PEMBAYARAN (LUNAS)', 55, curY + 22);

      ctx.textAlign = 'right';
      ctx.font = '900 16px sans-serif';
      ctx.fillText('Rp ' + totalBayar.toLocaleString('id-ID'), width - 55, curY + 24);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#475569';
      ctx.font = 'italic 10px sans-serif';
      ctx.fillText(`Terbilang: "${terbilangText}"`, 55, curY + 40);

      // Signature & Stamp
      curY += 80;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#64748b';
      ctx.font = 'normal 11px sans-serif';
      ctx.fillText('Mengetahui / Penyetor,', 140, curY);
      ctx.fillText(`Gresik, ${tglBayar}`, width - 140, curY);
      ctx.fillText('Bendahara Pondok,', width - 140, curY + 16);

      // Stamp circle
      ctx.save();
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(width - 140, curY + 55, 34, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#059669';
      ctx.font = '900 10px sans-serif';
      ctx.fillText('PP. QOMARUDDIN', width - 140, curY + 48);
      ctx.font = '900 12px sans-serif';
      ctx.fillText('★ LUNAS ★', width - 140, curY + 62);
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('BENDAHARA PUSAT', width - 140, curY + 74);
      ctx.restore();

      curY += 95;
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#1e293b';
      ctx.fillText(`( ${namaWali} )`, 140, curY);
      ctx.fillText(`( ${penerimaPetugas} )`, width - 140, curY);

      // Footer notice
      curY += 45;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'normal 9.5px sans-serif';
      ctx.fillText('Kwitansi ini adalah bukti pembayaran yang sah yang diterbitkan secara komputerisasi oleh SIM Pesantren Qomaruddin.', width / 2, curY);
      ctx.fillText(`Dicetak / Diunduh pada: ${new Date().toLocaleString('id-ID')}`, width / 2, curY + 14);

      // Convert canvas to image and download
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const link = document.createElement('a');
      const cleanSantri = namaSantri.replace(/[^a-zA-Z0-9]/g, '_');
      link.download = `Kwitansi_${kodeTrx}_${cleanSantri}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate JPG receipt', err);
    } finally {
      setIsDownloadingJpg(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/65 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      {/* PRINT-ONLY CSS INJECTION */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden !important;
            }
            #printable-kwitansi, #printable-kwitansi * {
              visibility: visible !important;
            }
            #printable-kwitansi {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              margin: 0 !important;
              padding: 20px !important;
              box-shadow: none !important;
              border: none !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}
      </style>

      <div className="bg-white rounded-[26px] shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* MODAL HEADER (ACTION BUTTONS) */}
        <div className="no-print p-4 sm:p-5 bg-gradient-to-r from-[#138F81] to-[#0D7A6F] text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/15 backdrop-blur-xs">
              <FileText size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">Kwitansi Pembayaran Resmi</h3>
              <p className="text-xs text-emerald-100 font-mono">No. {kodeTrx}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-[#138F81] hover:bg-emerald-50 text-xs font-black transition cursor-pointer shadow-sm active:scale-95"
              title="Cetak via Printer"
            >
              <Printer size={15} />
              <span className="hidden sm:inline">Cetak / Print</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadJpg}
              disabled={isDownloadingJpg}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 text-xs font-black transition cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
              title="Download Gambar JPG"
            >
              <Download size={15} />
              <span className="hidden sm:inline">{isDownloadingJpg ? 'Mengunduh...' : 'Unduh JPG'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white transition cursor-pointer"
              title="Tutup Modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* RECEIPT PAPER VIEW (SCROLLABLE & PRINTABLE) */}
        <div className="overflow-y-auto p-4 sm:p-8 bg-[#F4F7F6]">
          <div
            id="printable-kwitansi"
            ref={receiptRef}
            className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-lg text-slate-800 font-sans relative"
          >
            {/* WATERMARK BADGE */}
            <div className="absolute top-36 right-8 pointer-events-none opacity-20 rotate-[-15deg] select-none">
              <div className="border-4 border-emerald-600 rounded-2xl p-3 text-center text-emerald-700 font-black">
                <span className="text-4xl block tracking-widest">LUNAS</span>
                <span className="text-[10px] tracking-wider">SISTEM KEUANGAN PONDOK</span>
              </div>
            </div>

            {/* KOP RESMI PESANTREN */}
            <div className="pb-4 border-b-2 border-slate-900 relative">
              <div className="flex items-center justify-center gap-3 sm:gap-4 mb-2">
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl p-1 bg-[#E1EFF7]/80 border border-[#138F81]/20 flex items-center justify-center shadow-xs shrink-0">
                  <img
                    src="/logo-qomaruddin.png"
                    alt="Logo Pesantren Qomaruddin"
                    className="h-14 w-14 sm:h-16 sm:w-16 object-contain drop-shadow-xs"
                  />
                </div>
                <div className="text-center sm:text-left">
                  <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-[#138F81]">
                    YAYASAN PONDOK PESANTREN QOMARUDDIN
                  </h4>
                  <h1 className="text-lg sm:text-2xl font-black uppercase text-slate-900 tracking-tight leading-tight mt-0.5">
                    LEMBAGA PENDIDIKAN & MADRASAH DINIYAH
                  </h1>
                  <p className="text-[11px] sm:text-xs text-slate-600 font-medium mt-0.5">
                    Sampurnan, Bungah, Kabupaten Gresik, Jawa Timur 61152 • Telp: (031) 3949173
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">
                    Website: ppqomaruddin.itqom.net • Email: info@ppqomaruddin.itqom.net
                  </p>
                </div>
              </div>
            </div>

            {/* JUDUL KWITANSI */}
            <div className="my-4 text-center">
              <h2 className="text-base sm:text-lg font-black uppercase tracking-wide text-slate-900 underline decoration-2 decoration-[#138F81]">
                KWITANSI BUKTI PEMBAYARAN SYAHH
              </h2>
              <div className="inline-flex items-center gap-2 mt-1.5 px-3 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 text-[11px] font-black font-mono">
                <ShieldCheck size={13} className="text-emerald-600" />
                <span>NO: {kodeTrx}</span>
              </div>
            </div>

            {/* GRID DATA SANTRI & PEMBAYAR */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs mb-5">
              <div className="space-y-1.5">
                <h5 className="font-black text-[#138F81] uppercase tracking-wider text-[11px] mb-2 border-b border-slate-200 pb-1">
                  Data Santri:
                </h5>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Nama Santri:</span>
                  <strong className="text-slate-900 font-bold">{namaSantri}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">NIS:</span>
                  <span className="font-mono font-bold text-slate-800">{nisSantri}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Kelas / Jenjang:</span>
                  <span className="font-bold text-slate-800">{kelasSantri}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Kamar / Asrama:</span>
                  <span className="font-medium text-slate-700">{kamarSantri}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <h5 className="font-black text-[#138F81] uppercase tracking-wider text-[11px] mb-2 border-b border-slate-200 pb-1">
                  Informasi Transaksi:
                </h5>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Telah Terima Dari:</span>
                  <strong className="text-slate-900 font-bold">{namaWali}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Tanggal Bayar:</span>
                  <span className="font-bold text-slate-800">{tglBayar}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Metode Bayar:</span>
                  <span className="font-bold text-[#138F81]">{metodeBayar}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Penerima / Bendahara:</span>
                  <span className="font-bold text-slate-800">{penerimaPetugas}</span>
                </div>
              </div>
            </div>

            {/* TABEL RINCIAN ITEM */}
            <div className="mb-4 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#138F81] text-white font-black uppercase text-[11px]">
                    <th className="py-2.5 px-3 text-center w-12">No</th>
                    <th className="py-2.5 px-3">Uraian Pembayaran</th>
                    <th className="py-2.5 px-3 text-right">Nominal (Rp)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium">
                  {items.map((it, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-extrabold text-slate-800">
                        {String(it.nama || it.title || it.jenis || 'Pembayaran Tagihan')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-slate-900 font-mono">
                        Rp {Number(it.jumlah || 0).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* TOTAL & TERBILANG */}
            <div className="p-4 rounded-xl bg-[#E8F7F3] border-2 border-[#138F81]/40 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-black text-[#138F81] uppercase tracking-wider">
                  TOTAL PEMBAYARAN LUNAS
                </span>
                <span className="text-xl sm:text-2xl font-black text-[#0D7A6F] font-mono">
                  Rp {totalBayar.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="mt-2 pt-2 border-t border-[#138F81]/20 text-[11px] text-slate-600 font-medium italic">
                <strong>Terbilang:</strong> &ldquo;{terbilangText}&rdquo;
              </div>
            </div>

            {/* TANDA TANGAN & PENGESAHAN */}
            <div className="grid grid-cols-2 gap-6 text-center text-xs mt-8 pt-2">
              <div>
                <p className="font-medium text-slate-500">Penyetor / Wali Santri,</p>
                <div className="h-16 flex items-center justify-center">
                  <CheckCircle size={24} className="text-emerald-600 opacity-60" />
                </div>
                <p className="font-black text-slate-900 underline">( {namaWali} )</p>
              </div>

              <div className="relative">
                <p className="font-medium text-slate-500">Gresik, {tglBayar}</p>
                <p className="font-bold text-slate-800">Bendahara Pondok,</p>

                {/* STEMPEL CAP LUNAS */}
                <div className="h-16 flex items-center justify-center">
                  <div className="w-24 h-14 border-2 border-emerald-700 rounded-lg flex flex-col items-center justify-center rotate-[-8deg] bg-emerald-50/70 p-1 select-none">
                    <span className="text-[9px] font-black text-emerald-800 tracking-wider">PP. QOMARUDDIN</span>
                    <span className="text-xs font-black text-emerald-900 tracking-widest">★ LUNAS ★</span>
                    <span className="text-[7.5px] font-bold text-emerald-700">BENDAHARA PUSAT</span>
                  </div>
                </div>

                <p className="font-black text-slate-900 underline">( {penerimaPetugas} )</p>
              </div>
            </div>

            {/* FOOTER NOTICE */}
            <div className="mt-8 pt-3 border-t border-slate-200 text-[10px] text-slate-400 text-center">
              Kwitansi ini adalah dokumen sah yang dihasilkan secara elektronik oleh Sistem Informasi Pondok Pesantren Qomaruddin.
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="no-print p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <p className="text-slate-500 font-medium">
            💡 <em>Cetak atau unduh kwitansi ini sebagai arsip bukti pembayaran resmi Anda.</em>
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 font-black text-slate-700 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
