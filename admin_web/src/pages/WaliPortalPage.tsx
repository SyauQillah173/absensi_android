import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  Bell,
  BookOpen,
  Building2,
  Calendar,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  DoorOpen,
  FileText,
  GraduationCap,
  HeartHandshake,
  HelpCircle,
  Home,
  Info,
  KeyRound,
  LogOut,
  MapPin,
  MessageCircle,
  Phone,
  QrCode,
  Receipt,
  RefreshCw,
  School,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  UserCheck,
  UserRound,
  Users,
  Wallet,
  XCircle,
  Zap,
  UploadCloud,
  Eye,
  X,
  Image as ImageIcon,
  Printer,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { PwaInstallBanner, PwaHeaderInstallButton } from '../components/PwaInstallBanner';
import { NotificationPermissionPrompt } from '../components/NotificationPermissionPrompt';
import { api, type ApiRecord } from '../services/api';
import { ReceiptWaliModal } from '../components/ReceiptWaliModal';
import { ensurePushSubscribed, sendTestPushNotification, clearAppBadge } from '../utils/pushNotification';

type WaliTabKey = 'biodata' | 'keuangan' | 'absensi' | 'nilai';
type AbsensiSubTab = 'madin' | 'ngaji' | 'sholat';
type KeuanganSubTab = 'tagihan' | 'riwayat' | 'transfer';
type NilaiSubTab = 'akademik' | 'hafalan';

const ACADEMIC_MONTH_ORDER = [
  { month: 7, label: 'Jul', semester: 'Ganjil' },
  { month: 8, label: 'Agu', semester: 'Ganjil' },
  { month: 9, label: 'Sep', semester: 'Ganjil' },
  { month: 10, label: 'Okt', semester: 'Ganjil' },
  { month: 11, label: 'Nov', semester: 'Ganjil' },
  { month: 12, label: 'Des', semester: 'Ganjil' },
  { month: 1, label: 'Jan', semester: 'Genap' },
  { month: 2, label: 'Feb', semester: 'Genap' },
  { month: 3, label: 'Mar', semester: 'Genap' },
  { month: 4, label: 'Apr', semester: 'Genap' },
  { month: 5, label: 'Mei', semester: 'Genap' },
  { month: 6, label: 'Jun', semester: 'Genap' },
];

function formatGridNumber(val: number): string {
  if (!val || val === 0) return '0';
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function WaliPortalPage() {
  const { session, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<WaliTabKey>('keuangan');
  const [absensiSubTab, setAbsensiSubTab] = useState<AbsensiSubTab>('madin');
  const [keuanganSubTab, setKeuanganSubTab] = useState<KeuanganSubTab>('tagihan');
  const [nilaiSubTab, setNilaiSubTab] = useState<NilaiSubTab>('akademik');

  // Change password and security warning states
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [securityWarningDismissed, setSecurityWarningDismissed] = useState(() => {
    return session?.id ? sessionStorage.getItem(`dismissed_wali_pwd_warning_${session.id}`) === 'true' : false;
  });

  // Copied account number feedback
  const [copiedRekening, setCopiedRekening] = useState(false);

  // Multi-child list
  const [childrenList, setChildrenList] = useState<ApiRecord[]>(() => {
    return Array.isArray(session?.anak) ? session.anak : [];
  });
  const [selectedChildId, setSelectedChildId] = useState<number | null>(() => {
    if (Array.isArray(session?.anak) && session.anak.length > 0) {
      return Number(session.anak[0].id ?? 0);
    }
    return null;
  });

  // Data states
  const [isLoading, setIsLoading] = useState(false);
  const [childData, setChildData] = useState<ApiRecord | null>(null);
  const [biodata, setBiodata] = useState<ApiRecord | null>(null);
  const [keuanganData, setKeuanganData] = useState<ApiRecord | null>(null);
  const [absensiMadinData, setAbsensiMadinData] = useState<ApiRecord | null>(null);
  const [absensiSholatData, setAbsensiSholatData] = useState<ApiRecord | null>(null);
  const [absensiNgajiData, setAbsensiNgajiData] = useState<ApiRecord | null>(null);
  const [nilaiData, setNilaiData] = useState<ApiRecord | null>(null);

  // Search filter for bills
  const [billSearch, setBillSearch] = useState('');
  const [billStatusFilter, setBillStatusFilter] = useState<'all' | 'belum' | 'lunas'>('all');

  // Transfer verification states
  const [verifikasiList, setVerifikasiList] = useState<ApiRecord[]>([]);
  const [selectedBillIds, setSelectedBillIds] = useState<number[]>([]);
  const [transferFile, setTransferFile] = useState<File | null>(null);
  const [transferFilePreview, setTransferFilePreview] = useState<string | null>(null);
  const [isCompressingImage, setIsCompressingImage] = useState(false);
  const [compressedInfo, setCompressedInfo] = useState<{ origSize: string; compSize: string; savedPercent: number } | null>(null);
  const [transferBank, setTransferBank] = useState('BSI');
  const [transferSenderName, setTransferSenderName] = useState(() => session?.name || '');
  const [transferSenderRek, setTransferSenderRek] = useState('');
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [transferNotes, setTransferNotes] = useState('');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [submitTransferSuccess, setSubmitTransferSuccess] = useState<string | null>(null);
  const [submitTransferError, setSubmitTransferError] = useState<string | null>(null);
  const [previewProofImage, setPreviewProofImage] = useState<string | null>(null);
  const [selectedReceiptTransaction, setSelectedReceiptTransaction] = useState<ApiRecord | null>(null);

  // Month & year filter for attendance
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());

  // Push Notification Test State & Feedback
  const [isTestingNotif, setIsTestingNotif] = useState(false);
  const [notifTestFeedback, setNotifTestFeedback] = useState<string | null>(null);

  // Auto sync push subscription & clear app badge when logged in
  useEffect(() => {
    if (session?.id) {
      ensurePushSubscribed({ userId: session.id, role: 'wali' });
      clearAppBadge();
    }
  }, [session?.id]);

  const handleTestNotification = async () => {
    setIsTestingNotif(true);
    setNotifTestFeedback(null);
    try {
      await ensurePushSubscribed({ userId: session?.id, role: 'wali' });
      const res = await sendTestPushNotification({
        userId: session?.id,
        title: 'Qomaruddin: Notifikasi HP Terhubung! 🔔',
        body: `Halo Bapak/Ibu ${session?.name || 'Wali'}, notifikasi real-time presensi & transaksi santri kini aktif di HP Anda!`
      });
      setNotifTestFeedback(res.message || 'Notifikasi uji berhasil dikirim ke HP Anda!');
    } catch (e: any) {
      setNotifTestFeedback(e?.message || 'Gagal mengirim notifikasi uji. Pastikan izin notifikasi diaktifkan di HP Anda.');
    } finally {
      setIsTestingNotif(false);
      setTimeout(() => setNotifTestFeedback(null), 7000);
    }
  };

  // Load children list on mount if empty
  useEffect(() => {
    async function fetchChildren() {
      try {
        const res = await api.waliAnak();
        const list = Array.isArray(res.data) ? (res.data as ApiRecord[]) : [];
        if (list.length > 0) {
          setChildrenList(list);
          if (!selectedChildId) {
            setSelectedChildId(Number(list[0].id));
          }
        }
      } catch (err) {
        console.error('Failed to load children list', err);
      }
    }
    if (childrenList.length === 0) {
      fetchChildren();
    }
  }, [childrenList.length, selectedChildId]);

  // Load current child data when selectedChildId changes
  useEffect(() => {
    if (!selectedChildId) return;

    let isMounted = true;
    async function loadAllDataForChild(siswaId: number) {
      setIsLoading(true);
      try {
        // Run parallel queries
        const [bioRes, payRes, madinRes, sholatRes, ngajiRes, nilaiRes, verifRes] = await Promise.allSettled([
          api.waliBiodata(siswaId),
          api.waliPembayaran(siswaId),
          api.waliAbsensi(siswaId, { bulan: selectedMonth, tahun: selectedYear }),
          api.waliAbsensiSholat(siswaId, { bulan: selectedMonth, tahun: selectedYear }),
          api.waliAbsensiNgaji(siswaId, { bulan: selectedMonth, tahun: selectedYear }),
          api.waliNilai(siswaId),
          api.waliGetVerifikasiPembayaran(siswaId),
        ]);

        if (!isMounted) return;

        if (bioRes.status === 'fulfilled' && bioRes.value.success) {
          const bio = bioRes.value.data as ApiRecord;
          setBiodata(bio);
          setChildData(bio);
        } else {
          // fallback to matching child in childrenList
          const found = childrenList.find((c) => Number(c.id) === siswaId);
          if (found) {
            setChildData(found);
            setBiodata(found);
          }
        }

        if (payRes.status === 'fulfilled' && payRes.value.success) {
          setKeuanganData(payRes.value);
        }

        if (verifRes.status === 'fulfilled' && verifRes.value.success) {
          setVerifikasiList(Array.isArray(verifRes.value.data) ? (verifRes.value.data as ApiRecord[]) : []);
        }

        if (madinRes.status === 'fulfilled' && madinRes.value.success) {
          setAbsensiMadinData(madinRes.value);
        }

        if (sholatRes.status === 'fulfilled' && sholatRes.value.success) {
          setAbsensiSholatData(sholatRes.value);
        }

        if (ngajiRes.status === 'fulfilled' && ngajiRes.value.success) {
          setAbsensiNgajiData(ngajiRes.value);
        }

        if (nilaiRes.status === 'fulfilled' && nilaiRes.value.success) {
          setNilaiData(nilaiRes.value);
        }
      } catch (error) {
        console.error('Error fetching data for child:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadAllDataForChild(selectedChildId);

    return () => {
      isMounted = false;
    };
  }, [selectedChildId, selectedMonth, selectedYear, childrenList]);

  // Reload attendance when filter changes
  const handleReloadAttendance = async () => {
    if (!selectedChildId) return;
    try {
      const [madinRes, sholatRes, ngajiRes] = await Promise.allSettled([
        api.waliAbsensi(selectedChildId, { bulan: selectedMonth, tahun: selectedYear }),
        api.waliAbsensiSholat(selectedChildId, { bulan: selectedMonth, tahun: selectedYear }),
        api.waliAbsensiNgaji(selectedChildId, { bulan: selectedMonth, tahun: selectedYear }),
      ]);
      if (madinRes.status === 'fulfilled' && madinRes.value.success) {
        setAbsensiMadinData(madinRes.value);
      }
      if (sholatRes.status === 'fulfilled' && sholatRes.value.success) {
        setAbsensiSholatData(sholatRes.value);
      }
      if (ngajiRes.status === 'fulfilled' && ngajiRes.value.success) {
        setAbsensiNgajiData(ngajiRes.value);
      }
    } catch (err) {
      console.error('Failed to reload attendance', err);
    }
  };

  // Memoized values
  const studentName = String(childData?.nama || biodata?.nama || session?.name || 'Santri');
  const studentNis = String(childData?.nis || biodata?.nis || '-');
  const studentKelas = String(childData?.kelas || biodata?.kelas || (biodata?.academicClass as Record<string, unknown> | undefined)?.name || '-');
  const studentKomplek = String(childData?.komplek || biodata?.komplek || (biodata?.dormitoryRoom as Record<string, unknown> | undefined)?.komplek || '-');
  const studentKamar = String(childData?.kamar || biodata?.kamar || (biodata?.dormitoryRoom as Record<string, unknown> | undefined)?.name || '-');
  const studentStatus = String(childData?.status || biodata?.status || 'Aktif');

  // Financial calculations
  const totalBelumLunas = Number(keuanganData?.total_belum_lunas ?? 0);
  const totalLunas = Number(keuanganData?.total_lunas ?? 0);
  const tagihanList = useMemo(() => {
    return Array.isArray(keuanganData?.tagihan) ? (keuanganData.tagihan as ApiRecord[]) : [];
  }, [keuanganData]);

  const historyList = useMemo(() => {
    const list = Array.isArray(keuanganData?.riwayat_transaksi)
      ? (keuanganData.riwayat_transaksi as ApiRecord[])
      : Array.isArray(keuanganData?.data)
      ? (keuanganData.data as ApiRecord[])
      : Array.isArray(keuanganData?.transaksi)
      ? (keuanganData.transaksi as ApiRecord[])
      : [];
    return list;
  }, [keuanganData]);

  interface MonthSlot {
    month: number;
    label: string;
    isBilled: boolean;
    isPaid: boolean;
    isOverdue: boolean;
    amount: number;
    notes?: string;
    bill?: ApiRecord;
  }

  interface MonthlyRow {
    typeName: string;
    months: MonthSlot[];
  }

  interface GeneralRow {
    title: string;
    amount: number;
    paidAmount: number;
    remainingAmount: number;
    status: 'LUNAS' | 'BELUM LUNAS' | 'KURANG BAYAR';
    bill: ApiRecord;
  }

  interface AcademicYearBillsGroup {
    academicYear: string;
    monthly: MonthlyRow[];
    general: GeneralRow[];
  }

  const groupedYearBills = useMemo<AcademicYearBillsGroup[]>(() => {
    const yearMap = new Map<string, ApiRecord[]>();

    tagihanList.forEach((bill) => {
      const rawYear = String(bill.tahun_ajaran || '').trim();
      const yearKey = rawYear || '2026/2027';
      if (!yearMap.has(yearKey)) {
        yearMap.set(yearKey, []);
      }
      yearMap.get(yearKey)!.push(bill);
    });

    if (yearMap.size === 0) {
      return [];
    }

    const result: AcademicYearBillsGroup[] = [];

    yearMap.forEach((billsInYear, academicYear) => {
      const monthlyBills: ApiRecord[] = [];
      const generalBills: ApiRecord[] = [];

      billsInYear.forEach((b) => {
        const pMonth = b.period_month != null ? Number(b.period_month) : null;
        const periodTypeCode = String(
          (b.payment_type as Record<string, unknown> | undefined)?.period_type &&
            typeof (b.payment_type as Record<string, unknown>).period_type === 'object'
            ? ((b.payment_type as Record<string, unknown>).period_type as Record<string, unknown>).code
            : ''
        ).toLowerCase();

        if (pMonth !== null && pMonth >= 1 && pMonth <= 12) {
          monthlyBills.push(b);
        } else if (periodTypeCode === 'bulanan') {
          monthlyBills.push(b);
        } else {
          generalBills.push(b);
        }
      });

      // Group monthly bills by type
      const monthlyTypeMap = new Map<string, { typeName: string; bills: ApiRecord[] }>();
      monthlyBills.forEach((b) => {
        const typeName = String(
          (b.payment_type as Record<string, unknown> | undefined)?.nama ||
          (b.title ? String(b.title).replace(/\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|\d{4}).*/i, '') : '') ||
          'SPP'
        ).trim() || 'SPP';

        if (!monthlyTypeMap.has(typeName)) {
          monthlyTypeMap.set(typeName, { typeName, bills: [] });
        }
        monthlyTypeMap.get(typeName)!.bills.push(b);
      });

      const monthlyRows: MonthlyRow[] = [];
      monthlyTypeMap.forEach(({ typeName, bills }) => {
        const months = ACADEMIC_MONTH_ORDER.map((slot) => {
          const matchBill = bills.find((b) => Number(b.period_month) === slot.month);
          if (matchBill) {
            const status = String(matchBill.status_tagihan || matchBill.status || '');
            const isPaid = status.toLowerCase() === 'lunas';
            const isOverdue = status.toLowerCase() === 'terlambat';
            const amount = Number(matchBill.amount || matchBill.nominal || 0);
            const notes = String(matchBill.notes || matchBill.keterangan || '').trim();
            return {
              month: slot.month,
              label: slot.label,
              isBilled: true,
              isPaid,
              isOverdue,
              amount,
              notes: notes || undefined,
              bill: matchBill,
            };
          }
          return {
            month: slot.month,
            label: slot.label,
            isBilled: false,
            isPaid: false,
            isOverdue: false,
            amount: 0,
            bill: undefined,
          };
        });

        monthlyRows.push({
          typeName,
          months,
        });
      });

      // Process general bills
      const generalRows: GeneralRow[] = generalBills.map((b) => {
        const title = String(
          b.title ||
          b.nama ||
          (b.payment_type as Record<string, unknown> | undefined)?.nama ||
          'Tagihan Umum'
        );
        const amount = Number(b.amount || b.nominal || 0);
        const status = String(b.status_tagihan || b.status || '');
        const isLunas = status.toLowerCase() === 'lunas';
        const paidAmount = isLunas ? amount : Number(b.paid_amount || 0);
        const remainingAmount = isLunas ? 0 : Math.max(0, amount - paidAmount);

        return {
          title,
          amount,
          paidAmount,
          remainingAmount,
          status: isLunas ? 'LUNAS' : (paidAmount > 0 ? 'KURANG BAYAR' : 'BELUM LUNAS'),
          bill: b,
        };
      });

      result.push({
        academicYear,
        monthly: monthlyRows,
        general: generalRows,
      });
    });

    return result.sort((a, b) => b.academicYear.localeCompare(a.academicYear));
  }, [tagihanList]);

  const filteredGroupedYearBills = useMemo(() => {
    return groupedYearBills
      .map((group) => {
        const filteredMonthly = group.monthly.filter((row) => {
          if (billSearch === '') return true;
          return row.typeName.toLowerCase().includes(billSearch.toLowerCase());
        });

        const filteredGeneral = group.general.filter((item) => {
          const matchSearch =
            billSearch === '' ||
            item.title.toLowerCase().includes(billSearch.toLowerCase());
          const isLunas = item.status === 'LUNAS';
          if (billStatusFilter === 'belum') {
            return matchSearch && !isLunas;
          }
          if (billStatusFilter === 'lunas') {
            return matchSearch && isLunas;
          }
          return matchSearch;
        });

        return {
          ...group,
          monthly: filteredMonthly,
          general: filteredGeneral,
        };
      })
      .filter((group) => group.monthly.length > 0 || group.general.length > 0);
  }, [groupedYearBills, billSearch, billStatusFilter]);

  // Unpaid bills for online transfer
  const unpaidBills = useMemo(() => {
    return tagihanList.filter((b) => {
      const s = String(b.status_tagihan || b.status || '').toLowerCase();
      return s !== 'lunas' && s !== 'sudah lunas';
    });
  }, [tagihanList]);

  const totalSelectedTransferAmount = useMemo(() => {
    return unpaidBills
      .filter((b) => selectedBillIds.includes(Number(b.id)))
      .reduce((sum, b) => sum + Number(b.amount || 0), 0);
  }, [unpaidBills, selectedBillIds]);

  const toggleBillSelection = (id: number) => {
    setSelectedBillIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllUnpaid = () => {
    setSelectedBillIds(unpaidBills.map((b) => Number(b.id)));
  };

  const clearSelectedBills = () => {
    setSelectedBillIds([]);
  };

  const compressImageToWebp = async (file: File, maxDimension = 1200, quality = 0.75): Promise<File> => {
    if (!file.type.startsWith('image/')) return file;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const cleanName = file.name.replace(/\.[^/.]+$/, '') + '.webp';
            const compressedFile = new File([blob], cleanName, {
              type: 'image/webp',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          'image/webp',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = URL.createObjectURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;
    if (rawFile.size > 15 * 1024 * 1024) {
      setSubmitTransferError('Ukuran file maksimal 15MB.');
      return;
    }
    setIsCompressingImage(true);
    setSubmitTransferError(null);
    try {
      const compressed = await compressImageToWebp(rawFile, 1200, 0.75);
      setTransferFile(compressed);

      const origKb = (rawFile.size / 1024).toFixed(0);
      const compKb = (compressed.size / 1024).toFixed(0);
      const saved = Math.max(0, Math.round(((rawFile.size - compressed.size) / rawFile.size) * 100));
      setCompressedInfo({
        origSize: `${origKb} KB`,
        compSize: `${compKb} KB`,
        savedPercent: saved,
      });

      const reader = new FileReader();
      reader.onload = () => {
        setTransferFilePreview(reader.result as string);
      };
      reader.readAsDataURL(compressed);
    } catch {
      setTransferFile(rawFile);
      const reader = new FileReader();
      reader.onload = () => {
        setTransferFilePreview(reader.result as string);
      };
      reader.readAsDataURL(rawFile);
    } finally {
      setIsCompressingImage(false);
    }
  };

  const handleSubmitTransferProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBillIds.length === 0) {
      setSubmitTransferError('Silakan centang/pilih minimal satu pos tagihan yang ingin dibayar.');
      return;
    }
    if (!transferFile) {
      setSubmitTransferError('Silakan unggah foto bukti struk transfer bank.');
      return;
    }
    if (!selectedChildId) return;

    setIsSubmittingTransfer(true);
    setSubmitTransferError(null);
    setSubmitTransferSuccess(null);

    try {
      const selectedItems = unpaidBills.filter((b) => selectedBillIds.includes(Number(b.id)));
      const formData = new FormData();
      formData.append('siswa_id', String(selectedChildId));
      formData.append('tanggal_transfer', transferDate);
      formData.append('bank_pengirim', transferBank);
      formData.append('nama_pengirim', transferSenderName);
      formData.append('nomor_rekening_pengirim', transferSenderRek);
      formData.append('catatan_wali', transferNotes);
      formData.append('file', transferFile);
      formData.append('selected_bills', JSON.stringify(selectedItems));

      const res = await api.waliUploadBuktiTransfer(formData);
      if (res.success) {
        setSubmitTransferSuccess('Alhamdulillah! Bukti transfer berhasil diunggah dan sedang menunggu verifikasi bendahara.');
        setTransferFile(null);
        setTransferFilePreview(null);
        setSelectedBillIds([]);
        setTransferNotes('');
        // Reload list verifikasi
        const vRes = await api.waliGetVerifikasiPembayaran(selectedChildId);
        if (vRes.success && Array.isArray(vRes.data)) {
          setVerifikasiList(vRes.data);
        }
      } else {
        setSubmitTransferError(res.message || 'Gagal mengirim bukti transfer.');
      }
    } catch (err) {
      setSubmitTransferError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat mengunggah bukti.');
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  // Attendance stats
  const madinStats = (absensiMadinData?.stats ?? absensiMadinData?.statistik ?? absensiMadinData?.ringkasan ?? {}) as ApiRecord;
  const madinGrouped = useMemo(() => {
    return Array.isArray(absensiMadinData?.grouped)
      ? (absensiMadinData.grouped as ApiRecord[])
      : Array.isArray(absensiMadinData?.data)
      ? (absensiMadinData.data as ApiRecord[])
      : Array.isArray(absensiMadinData?.records)
      ? (absensiMadinData.records as ApiRecord[])
      : [];
  }, [absensiMadinData]);

  const sholatStats = (absensiSholatData?.stats ?? absensiSholatData?.statistik ?? absensiSholatData?.ringkasan ?? {}) as ApiRecord;
  const sholatGrouped = useMemo(() => {
    return Array.isArray(absensiSholatData?.grouped)
      ? (absensiSholatData.grouped as ApiRecord[])
      : Array.isArray(absensiSholatData?.data)
      ? (absensiSholatData.data as ApiRecord[])
      : Array.isArray(absensiSholatData?.records)
      ? (absensiSholatData.records as ApiRecord[])
      : [];
  }, [absensiSholatData]);

  const ngajiStats = (absensiNgajiData?.stats ?? absensiNgajiData?.statistik ?? absensiNgajiData?.ringkasan ?? {}) as ApiRecord;
  const ngajiGrouped = useMemo(() => {
    return Array.isArray(absensiNgajiData?.grouped)
      ? (absensiNgajiData.grouped as ApiRecord[])
      : Array.isArray(absensiNgajiData?.data)
      ? (absensiNgajiData.data as ApiRecord[])
      : Array.isArray(absensiNgajiData?.records)
      ? (absensiNgajiData.records as ApiRecord[])
      : [];
  }, [absensiNgajiData]);

  const totalMadinPresensi = Number(madinStats.total ?? 0);
  const hadirMadinPresensi = Number(madinStats.hadir ?? 0);
  const madinPercent = totalMadinPresensi > 0 ? Math.round((hadirMadinPresensi / totalMadinPresensi) * 100) : 100;

  // Nilai records
  const raportList = useMemo(() => {
    return Array.isArray(nilaiData?.raport)
      ? (nilaiData.raport as ApiRecord[])
      : Array.isArray(nilaiData?.nilai_pelajaran)
      ? (nilaiData.nilai_pelajaran as ApiRecord[])
      : Array.isArray(nilaiData?.data)
      ? (nilaiData.data as ApiRecord[])
      : [];
  }, [nilaiData]);

  const hafalanList = useMemo(() => {
    return Array.isArray(nilaiData?.hafalan)
      ? (nilaiData.hafalan as ApiRecord[])
      : Array.isArray(nilaiData?.nilai_hafalan)
      ? (nilaiData.nilai_hafalan as ApiRecord[])
      : [];
  }, [nilaiData]);

  const monthsList = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maret' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Agustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'Desember' },
  ];

  const handleCopyRekening = () => {
    navigator.clipboard.writeText('7171202688');
    setCopiedRekening(true);
    setTimeout(() => setCopiedRekening(false), 2500);
  };

  return (
    <div className="q-app-shell min-h-screen bg-[#FFDC80] dark:bg-[#0B1120] p-2.5 sm:p-4 lg:p-6 theme-light overflow-x-hidden font-sans transition-colors duration-300">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        {/* ========================================================================= */}
        {/* 1. TOP NAVBAR (MATCHING ADMIN DASHBOARD HEADER / OBSIDIAN DARK) */}
        {/* ========================================================================= */}
        <header className="q-topbar flex min-h-14 sm:min-h-16 items-center justify-between gap-2 sm:gap-3 rounded-2xl sm:rounded-[26px] bg-[#FFFDF7] px-4 sm:px-6 shadow-xl shadow-black/10 transition-colors duration-300">
          {/* BRANDING WITH PROJECT TEAL LOGO */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl p-1.5 bg-[#E1EFF7] flex items-center justify-center shadow-xs shrink-0">
              <img
                src="/logo-qomaruddin.png"
                alt="Logo Qomaruddin"
                className="h-8 w-8 sm:h-9 sm:w-9 object-contain drop-shadow-xs"
              />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-[#138F81] tracking-tight leading-none">
                  Portal Wali Santri
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-[#E8F7F3] text-[#138F81] border border-[#138F81]/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#138F81] animate-pulse" />
                  Live Database
                </span>
              </div>
              <p className="text-xs font-semibold text-[#636E72] mt-0.5 hidden sm:block">
                Yayasan Pondok Pesantren Qomaruddin • Sampurnan Bungah Gresik
              </p>
            </div>
          </div>

          {/* USER CONTROLS, THEMETOGGLE & WALI PROFILE */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="hidden lg:flex flex-col items-end pr-3 border-r border-slate-200">
              <div className="flex items-center gap-1.5 text-xs font-black text-[#2D3436]">
                <ShieldCheck size={14} className="text-[#138F81]" />
                <span>{session?.name || 'Wali Santri'}</span>
              </div>
              <span className="text-[10px] font-extrabold text-[#138F81] bg-[#E8F7F3] px-2 py-0.5 rounded-md border border-[#138F81]/20 mt-0.5">
                Wali Santri Resmi
              </span>
            </div>

            {/* 🔔 TOMBOL UJI NOTIFIKASI KE HP */}
            <button
              type="button"
              onClick={handleTestNotification}
              disabled={isTestingNotif}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#0D7A6F] bg-emerald-50 hover:bg-[#138F81] hover:text-white border border-emerald-200/80 rounded-xl sm:rounded-2xl transition shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
              title="Kirim Notifikasi Uji ke Status Bar HP Ini"
            >
              <Bell size={14} className={isTestingNotif ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{isTestingNotif ? 'Mengirim...' : 'Uji Notif HP'}</span>
            </button>

            {/* TOMBOL INSTAL APLIKASI DI HEADER */}
            <PwaHeaderInstallButton />

            {/* CANGGIH & MODERN THEME TOGGLE */}
            <ThemeToggle showDropdown={true} />

            <button
              type="button"
              onClick={() => setIsChangePasswordOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-[#138F81] bg-[#E1EFF7] hover:bg-[#138F81] hover:text-white rounded-xl sm:rounded-2xl transition shadow-xs cursor-pointer active:scale-95"
              title="Ganti Kata Sandi Akun"
            >
              <KeyRound size={14} />
              <span className="hidden sm:inline">Ganti Sandi</span>
            </button>

            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-200 rounded-xl sm:rounded-2xl transition shadow-xs cursor-pointer active:scale-95"
              title="Keluar dari Portal Wali"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </header>

        {/* ========================================================================= */}
        {/* 2. NON-MANDATORY SECURITY WARNING BANNER */}
        {/* ========================================================================= */}
        {session?.must_change_password && !securityWarningDismissed && (
          <div className="q-card rounded-2xl sm:rounded-[24px] bg-white p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-amber-300">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-2xl bg-[#FFF8E1] text-[#E65100] shrink-0">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h4 className="text-sm font-black text-[#2D3436] flex items-center gap-2">
                  Rekomendasi Keamanan Akun Wali
                  <span className="text-[10px] bg-amber-100 text-amber-900 font-black px-2 py-0.5 rounded-full border border-amber-300">
                    Sandi Bawaan
                  </span>
                </h4>
                <p className="text-xs text-[#636E72] font-medium mt-0.5 leading-relaxed">
                  Akun Anda saat ini masih menggunakan kata sandi default (<code className="bg-[#E1EFF7] px-1.5 py-0.5 rounded font-mono font-bold text-[#138F81]">siswa12345</code>). Demi keamanan data santri dan tagihan, kami sarankan untuk mengganti kata sandi Anda.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(true)}
                className="px-3.5 py-2 text-xs font-black rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white transition shadow-md cursor-pointer"
              >
                🔒 Ganti Sandi Sekarang
              </button>
              <button
                type="button"
                onClick={() => {
                  if (session?.id) sessionStorage.setItem(`dismissed_wali_pwd_warning_${session.id}`, 'true');
                  setSecurityWarningDismissed(true);
                }}
                className="px-3 py-2 text-xs font-bold rounded-xl text-[#636E72] bg-[#E1EFF7] hover:bg-[#d5e7f2] transition cursor-pointer"
              >
                Nanti Saja
              </button>
            </div>
          </div>
        )}

        {/* MULTI CHILD SWITCHER (IF > 1) */}
        {childrenList.length > 1 && (
          <div className="q-card flex flex-wrap items-center gap-2 p-3.5 bg-white rounded-2xl sm:rounded-[24px]">
            <span className="text-xs font-black text-[#2D3436] pl-1 flex items-center gap-1.5">
              <Users size={15} className="text-[#138F81]" />
              Pilih Santri:
            </span>
            {childrenList.map((child) => (
              <button
                key={String(child.id)}
                type="button"
                onClick={() => setSelectedChildId(Number(child.id))}
                className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer ${
                  Number(child.id) === selectedChildId
                    ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/25'
                    : 'bg-[#E1EFF7] text-[#138F81] hover:bg-[#d0e5f2]'
                }`}
              >
                👨‍🎓 {String(child.nama || 'Santri')} ({String(child.nis || '-')})
              </button>
            ))}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. HERO SANTRI PROFILE CARD (SIGNATURE TEAL & ACCENT YELLOW) */}
        {/* ========================================================================= */}
        <section className="relative overflow-hidden rounded-2xl sm:rounded-[28px] bg-gradient-to-br from-[#138F81] via-[#0D7A6F] to-[#0A5C54] text-white p-6 sm:p-8 shadow-xl shadow-[#138F81]/25 border-2 border-white/20">
          {/* Subtle Ambient Glow */}
          <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute right-1/4 -bottom-10 h-44 w-44 rounded-full bg-[#FFDC80]/20 blur-2xl pointer-events-none" />

          {/* Watermark Emblem */}
          <div className="absolute right-4 top-4 text-white/5 font-serif text-8xl font-black select-none pointer-events-none">
            ۞
          </div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4 sm:gap-6">
              {/* AVATAR WITH YELLOW EMBLEM ACCENT */}
              <div className="relative shrink-0">
                <div className="grid h-18 w-18 sm:h-22 sm:w-22 place-items-center rounded-2xl sm:rounded-3xl bg-[#FFDC80] text-[#0D7A6F] text-2xl sm:text-3xl font-black shadow-lg shadow-black/20">
                  {studentName.charAt(0).toUpperCase()}
                </div>
                <span
                  className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-emerald-400 border-2 border-[#138F81] shadow-xs"
                  title="Santri Aktif Terdaftar"
                />
              </div>

              {/* NAME & EMBOSSED METADATA */}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight">
                    {studentName}
                  </h2>
                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-[#FFDC80] text-[#0D7A6F] shadow-xs">
                    <CheckCircle2 size={12} />
                    {studentStatus}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 mt-2.5 text-xs sm:text-sm text-white font-semibold">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-white/15 backdrop-blur-xs border border-white/20">
                    <UserRound size={14} className="text-[#FFDC80]" />
                    NIS: <strong className="text-white font-extrabold">{studentNis}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-white/15 backdrop-blur-xs border border-white/20">
                    <School size={14} className="text-[#FFDC80]" />
                    Kelas: <strong className="text-white font-extrabold">{studentKelas}</strong>
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-white/15 backdrop-blur-xs border border-white/20">
                    <Building2 size={14} className="text-[#FFDC80]" />
                    Asrama: <strong className="text-white font-extrabold">{studentKomplek}</strong> • Kamar: <strong className="text-white font-extrabold">{studentKamar}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* QUICK KPI PILLS */}
            <div className="flex items-center gap-3 self-stretch lg:self-auto justify-between lg:justify-end border-t border-white/15 pt-4 lg:border-t-0 lg:pt-0">
              {/* KEWAJIBAN KEUANGAN */}
              <button
                type="button"
                onClick={() => setActiveTab('keuangan')}
                className="px-4 py-2.5 text-center rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 transition cursor-pointer text-left sm:text-center"
              >
                <span className="block text-[10px] uppercase font-black text-[#FFDC80] tracking-wider">
                  Kewajiban Tagihan
                </span>
                <span
                  className={`text-xs font-black px-2.5 py-0.5 rounded-lg inline-block mt-1 ${
                    totalBelumLunas > 0
                      ? 'bg-[#FFDC80] text-[#0D7A6F] shadow-sm'
                      : 'bg-emerald-400 text-emerald-950'
                  }`}
                >
                  {totalBelumLunas > 0
                    ? `⚠️ ${tagihanList.filter((t) => t.status_tagihan !== 'Lunas').length} Pos (Rp ${totalBelumLunas.toLocaleString('id-ID')})`
                    : '✅ Semua Lunas'}
                </span>
              </button>

              <div className="h-10 w-px bg-white/20 hidden sm:block" />

              {/* KEHADIRAN MADIN */}
              <button
                type="button"
                onClick={() => setActiveTab('absensi')}
                className="px-4 py-2.5 text-center rounded-2xl bg-white/15 hover:bg-white/25 border border-white/20 transition cursor-pointer"
              >
                <span className="block text-[10px] uppercase font-black text-white/80 tracking-wider">
                  Disiplin Kehadiran
                </span>
                <span className="text-sm font-black text-white block mt-0.5">
                  {totalMadinPresensi > 0 ? `${madinPercent}% Hadir` : '100% (Disiplin)'}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. NAVIGATION TABS (MATCHING PROJECT DESIGN SYSTEM) */}
        {/* ========================================================================= */}
        <nav className="flex items-center gap-2 overflow-x-auto p-1.5 rounded-2xl sm:rounded-[24px] bg-white shadow-xl shadow-black/5 scrollbar-none">
          {[
            {
              key: 'keuangan',
              label: 'Keuangan & Tagihan',
              icon: Wallet,
              badge: totalBelumLunas > 0 ? `${tagihanList.filter((t) => t.status_tagihan !== 'Lunas').length} Tagihan` : null,
              badgeColor: 'bg-amber-100 text-[#E65100] font-black border border-amber-300',
            },
            {
              key: 'absensi',
              label: 'Absensi Realtime',
              icon: CalendarCheck,
              badge: totalMadinPresensi > 0 ? `${hadirMadinPresensi} Hadir` : null,
              badgeColor: 'bg-[#E8F7F3] text-[#138F81] border border-[#138F81]/30',
            },
            { key: 'biodata', label: 'Data Diri Santri', icon: User, badge: null, badgeColor: '' },
            { key: 'nilai', label: 'Nilai & Hafalan', icon: Award, badge: null, badgeColor: '' },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as WaliTabKey)}
                className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-black rounded-xl sm:rounded-2xl transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#138F81] text-white shadow-lg shadow-[#138F81]/25'
                    : 'text-[#636E72] hover:bg-[#E1EFF7] hover:text-[#138F81]'
                }`}
              >
                <Icon size={17} className={isActive ? 'text-white' : 'text-[#636E72]'} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      isActive ? 'bg-[#FFDC80] text-[#0D7A6F]' : tab.badgeColor
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* ========================================================================= */}
        {/* 5. TAB CONTENTS */}
        {/* ========================================================================= */}
        {isLoading ? (
          <div className="q-card py-16 text-center rounded-[28px] bg-white">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#E1EFF7] border-t-[#138F81] mx-auto mb-3" />
            <p className="text-xs font-black text-[#138F81] animate-pulse">
              Memuat data santri & tagihan secara realtime...
            </p>
          </div>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* TAB 1: KEUANGAN & TAGIHAN REALTIME */}
            {/* ========================================================================= */}
            {activeTab === 'keuangan' && (
              <div className="space-y-4 sm:space-y-6">
                {/* 3 BANKING CARDS: TOTAL TAGIHAN, TOTAL LUNAS, BSI OFFICIAL ACCOUNT */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                  {/* CARD 1: TAGIHAN MENUNGGU (THEME ORANGE BANKING CARD) */}
                  <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#E65100] via-[#EF6C00] to-[#F57C00] p-6 text-white shadow-xl shadow-orange-950/15 border-2 border-orange-300/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* EMV Microchip Motif */}
                        <div className="h-7 w-9 rounded-md bg-[#FFDC80] border border-amber-200 shadow-inner grid grid-cols-2 gap-0.5 p-0.5">
                          <div className="border-r border-amber-600/50" />
                          <div className="border-l border-amber-600/50" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-orange-100">
                          TAGIHAN AKTIF
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-black/25 text-white border border-white/20">
                        {tagihanList.filter((t) => t.status_tagihan !== 'Lunas').length} Pos Belum Lunas
                      </span>
                    </div>

                    <div className="mt-5">
                      <span className="text-xs font-bold text-orange-100 block">Total Tagihan Tertunggak</span>
                      <p className="text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight">
                        Rp {totalBelumLunas.toLocaleString('id-ID')}
                      </p>
                    </div>

                    <div className="mt-5 pt-3.5 border-t border-white/20 flex items-center justify-between text-[11px] text-orange-100 font-semibold">
                      <span>SPP & Kewajiban Terdaftar</span>
                      <span className="font-black text-[#FFDC80]">Harap Dilunasi</span>
                    </div>
                  </div>

                  {/* CARD 2: PEMBAYARAN LUNAS (THEME TEAL BANKING CARD) */}
                  <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-[#138F81] via-[#0D7A6F] to-[#0A5C54] p-6 text-white shadow-xl shadow-teal-950/15 border-2 border-teal-300/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* Contactless Wave Motif */}
                        <div className="h-7 w-9 rounded-md bg-white/20 border border-white/30 flex items-center justify-center">
                          <CheckCircle2 size={18} className="text-white" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-teal-100">
                          TERVERIFIKASI
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-black/25 text-white border border-white/20">
                        {historyList.length} Kwitansi Tercatat
                      </span>
                    </div>

                    <div className="mt-5">
                      <span className="text-xs font-bold text-teal-100 block">Total Pembayaran Lunas</span>
                      <p className="text-2xl sm:text-3xl font-black text-white mt-1 tracking-tight">
                        Rp {totalLunas.toLocaleString('id-ID')}
                      </p>
                    </div>

                    <div className="mt-5 pt-3.5 border-t border-white/20 flex items-center justify-between text-[11px] text-teal-100 font-semibold">
                      <span>Kas Tunai & Rekening Yayasan</span>
                      <span className="font-black text-[#FFDC80]">Tersinkron Realtime</span>
                    </div>
                  </div>

                  {/* CARD 3: REKENING RESMI & KONFIRMASI BENDAHARA */}
                  <div className="q-card rounded-[26px] bg-white border-2 border-[#138F81]/25 p-6 shadow-xl shadow-black/5 space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-[#2D3436] uppercase tracking-wide flex items-center gap-1.5">
                          <Building2 size={16} className="text-[#138F81]" />
                          Rekening Resmi Pesantren
                        </span>
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-[#E8F7F3] text-[#138F81] border border-[#138F81]/20">
                          BSI Syariah
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-[#636E72] mt-1">
                        Bank Syariah Indonesia (BSI)
                      </p>
                      <div className="flex items-center justify-between bg-[#E1EFF7] p-3 rounded-2xl border border-[#138F81]/20 mt-2.5">
                        <span className="font-mono font-black text-base sm:text-lg text-[#0D7A6F] tracking-wider">
                          7171 2026 88
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyRekening}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white transition shadow-sm cursor-pointer"
                        >
                          {copiedRekening ? <Check size={13} /> : <Copy size={13} />}
                          {copiedRekening ? 'Tersalin' : 'Salin'}
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] font-medium text-[#636E72] leading-tight">
                      a.n. <strong className="text-[#2D3436]">Yayasan Pondok Pesantren Qomaruddin</strong>. Pembayaran juga dapat dilakukan tunai di loket bendahara pondok.
                    </p>
                  </div>
                </div>

                {/* SUB-TABS: DAFTAR TAGIHAN VS RIWAYAT TRANSAKSI */}
                <div className="q-card bg-white rounded-[28px] shadow-xl shadow-black/5 p-5 sm:p-7 space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setKeuanganSubTab('tagihan')}
                        className={`px-4 py-2.5 text-xs font-black rounded-xl transition cursor-pointer ${
                          keuanganSubTab === 'tagihan'
                            ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/25'
                            : 'bg-[#E1EFF7] text-[#138F81] hover:bg-[#d0e5f2]'
                        }`}
                      >
                        📋 Ringkasan Tagihan ({tagihanList.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setKeuanganSubTab('transfer')}
                        className={`px-4 py-2.5 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
                          keuanganSubTab === 'transfer'
                            ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/25'
                            : 'bg-[#E1EFF7] text-[#138F81] hover:bg-[#d0e5f2]'
                        }`}
                      >
                        <CreditCard size={14} />
                        <span>Bayar Online & Bukti TF</span>
                        {verifikasiList.filter((v) => v.status === 'menunggu').length > 0 && (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black animate-pulse">
                            {verifikasiList.filter((v) => v.status === 'menunggu').length}
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setKeuanganSubTab('riwayat')}
                        className={`px-4 py-2.5 text-xs font-black rounded-xl transition cursor-pointer ${
                          keuanganSubTab === 'riwayat'
                            ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/25'
                            : 'bg-[#E1EFF7] text-[#138F81] hover:bg-[#d0e5f2]'
                        }`}
                      >
                        🧾 Riwayat Transaksi & Kwitansi ({historyList.length})
                      </button>
                    </div>

                    {/* SEARCH & FILTER CONTROLS FOR BILLS */}
                    {keuanganSubTab === 'tagihan' && (
                      <div className="flex items-center gap-2">
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            placeholder="Cari bulan / tagihan..."
                            value={billSearch}
                            onChange={(e) => setBillSearch(e.target.value)}
                            className="pl-8 pr-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-[#f8fafc] text-[#2D3436] placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#138F81]/40"
                          />
                        </div>
                        <select
                          value={billStatusFilter}
                          onChange={(e) => setBillStatusFilter(e.target.value as 'all' | 'belum' | 'lunas')}
                          className="px-3 py-2 text-xs font-black rounded-xl border border-slate-200 bg-[#f8fafc] text-[#2D3436] focus:outline-hidden cursor-pointer"
                        >
                          <option value="all">Semua Status</option>
                          <option value="belum">Belum Lunas</option>
                          <option value="lunas">Sudah Lunas</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* TAB 1 CONTENT: DAFTAR TAGIHAN (GRID BULANAN & UMUM SESUAI TEMA PROJEK & SCREENSHOT) */}
                  {keuanganSubTab === 'tagihan' ? (
                    <>
                      {/* PROMINENT ONLINE PAYMENT CTA BANNER */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-[#138F81]/15 via-[#FFDC80]/30 to-[#138F81]/15 p-4 rounded-2xl border border-[#138F81]/30">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-[#138F81] text-white shadow-md shadow-[#138F81]/25 shrink-0">
                            <CreditCard size={20} />
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-black text-[#2D3436]">Pembayaran Mandiri via Transfer Bank</h4>
                            <p className="text-[11px] font-semibold text-[#636E72]">
                              Pilih pos tagihan yang ingin dibayar, transfer via BSI, lalu kirim bukti struk untuk diverifikasi bendahara secara realtime.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setKeuanganSubTab('transfer')}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white text-xs font-black shadow-lg shadow-[#138F81]/25 transition cursor-pointer shrink-0"
                        >
                          <CreditCard size={15} />
                          <span>Bayar Tagihan Sekarang 👉</span>
                        </button>
                      </div>

                      {filteredGroupedYearBills.length === 0 ? (
                      <div className="py-14 text-center text-slate-400">
                        <CheckCircle2 size={42} className="mx-auto mb-2 text-[#138F81]" />
                        <p className="text-sm font-black text-[#2D3436]">Tidak ada tagihan tertunggak.</p>
                        <p className="text-xs text-[#636E72] mt-0.5">Semua kewajiban pembayaran santri sudah tercatat lunas.</p>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        {filteredGroupedYearBills.map((group, gIdx) => (
                          <div key={gIdx} className="space-y-5">
                            {/* TAHUN AJARAN HEADER */}
                            <div className="border-b border-gray-200 pb-2.5 flex items-center justify-between">
                              <div className="text-base sm:text-lg font-normal text-gray-700">
                                Tahun Ajaran: <strong className="font-extrabold text-gray-900">{group.academicYear}</strong>
                              </div>
                            </div>

                            {/* 1. BULANAN SECTION */}
                            {group.monthly.length > 0 && (
                              <div className="space-y-2">
                                <h3 className="text-xs sm:text-sm font-black tracking-wider text-gray-800 uppercase">
                                  BULANAN
                                </h3>
                                <div className="overflow-x-auto border border-gray-200">
                                  <table className="w-full min-w-[700px] border-collapse text-xs">
                                    <thead>
                                      <tr className="bg-[#F2F4F7] font-bold text-gray-800">
                                        <th className="border border-gray-200 px-4 py-2.5 text-center font-black w-48">
                                          Tipe Pembayaran
                                        </th>
                                        {ACADEMIC_MONTH_ORDER.map((m) => (
                                          <th
                                            key={m.month}
                                            className="border border-gray-200 px-1 py-2.5 text-center font-bold w-12"
                                            title={m.semester === 'Ganjil' ? `${m.label} (Semester Ganjil)` : `${m.label} (Semester Genap)`}
                                          >
                                            {m.label}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {group.monthly.map((row, rIdx) => (
                                        <tr key={rIdx}>
                                          <td className="border border-gray-200 bg-white px-4 py-3 text-center font-bold text-gray-800">
                                            {row.typeName}
                                          </td>
                                          {row.months.map((m) => {
                                            const isPaid = m.isPaid;
                                            const isBilled = m.isBilled;

                                            return (
                                              <td
                                                key={m.month}
                                                className="border border-gray-200 p-0 text-center"
                                                title={
                                                  !isBilled
                                                    ? `Bulan ${m.label} - Tidak Ditagihkan / Libur`
                                                    : isPaid
                                                    ? `Bulan ${m.label} - LUNAS ✓ (Rp ${m.amount.toLocaleString('id-ID')})${m.notes ? ` • Catatan: ${m.notes}` : ''}`
                                                    : `Bulan ${m.label} - BELUM LUNAS (Rp ${m.amount.toLocaleString('id-ID')})${m.notes ? ` • Catatan: ${m.notes}` : ''}`
                                                }
                                              >
                                                {!isBilled ? (
                                                  <div className="flex h-11 w-full items-center justify-center bg-gray-100 text-gray-400 font-bold">
                                                    -
                                                  </div>
                                                ) : isPaid ? (
                                                  <div className="relative flex h-11 w-full items-center justify-center bg-[#00A86B] text-white font-bold text-base select-none">
                                                    <span>✓</span>
                                                    {m.notes && (
                                                      <span
                                                        className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-[#FFDC80] ring-1 ring-white shadow-xs"
                                                        title={`Catatan: ${m.notes}`}
                                                      />
                                                    )}
                                                  </div>
                                                ) : (
                                                  <div className="relative flex h-11 w-full items-center justify-center bg-[#E74C3C] text-white font-black text-sm select-none">
                                                    <span>X</span>
                                                    {m.notes && (
                                                      <span
                                                        className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-[#FFDC80] ring-1 ring-white shadow-xs"
                                                        title={`Catatan: ${m.notes}`}
                                                      />
                                                    )}
                                                  </div>
                                                )}
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>

                                {/* KETERANGAN / LEGEND BULANAN & CATATAN KHUSUS */}
                                <div className="space-y-3 pt-1">
                                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-gray-500">
                                    <div className="flex flex-wrap items-center gap-4">
                                      <div className="flex items-center gap-1.5">
                                        <span className="flex h-4 w-4 items-center justify-center rounded bg-[#00A86B] text-[10px] font-bold text-white">✓</span>
                                        <span>Sudah Lunas</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="flex h-4 w-4 items-center justify-center rounded bg-[#E74C3C] text-[10px] font-black text-white">X</span>
                                        <span>Belum Lunas</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="flex h-4 w-4 items-center justify-center rounded bg-gray-200 text-[10px] font-bold text-gray-500">-</span>
                                        <span>Libur / Tidak Ditagihkan</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="flex h-2.5 w-2.5 rounded-full bg-[#FFDC80] ring-1 ring-amber-400"></span>
                                        <span className="text-amber-700 font-bold">Ada Catatan Khusus</span>
                                      </div>
                                    </div>
                                    <div className="text-[11px] font-medium text-gray-400">
                                      *Semester Ganjil: Jul–Des • Semester Genap: Jan–Jun
                                    </div>
                                  </div>

                                  {/* DETAIL CATATAN KHUSUS BULANAN UNTUK WALI SANTRI */}
                                  {group.monthly.some((r) => r.months.some((m) => Boolean(m.notes))) && (
                                    <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 text-xs text-amber-950 space-y-2">
                                      <div className="flex items-center gap-1.5 font-black uppercase tracking-wider text-[11px] text-amber-900">
                                        <span>💡</span>
                                        <span>Keterangan Khusus Tagihan Bulanan:</span>
                                      </div>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-4">
                                        {group.monthly.flatMap((r) =>
                                          r.months
                                            .filter((m) => Boolean(m.notes))
                                            .map((m) => (
                                              <div key={`${r.typeName}-${m.month}`} className="rounded-xl bg-white/80 p-2.5 border border-amber-200 space-y-0.5">
                                                <div className="flex items-center justify-between font-extrabold text-xs text-slate-800">
                                                  <span>{r.typeName} - Bulan {m.label}</span>
                                                  <span className="font-black text-[#138F81]">Rp {m.amount.toLocaleString('id-ID')}</span>
                                                </div>
                                                <p className="text-[11px] text-amber-900 font-semibold italic">
                                                  "{m.notes}"
                                                </p>
                                              </div>
                                            ))
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* 2. UMUM SECTION */}
                            {group.general.length > 0 && (
                              <div className="space-y-2 pt-2">
                                <h3 className="text-xs sm:text-sm font-black tracking-wider text-gray-800 uppercase">
                                  UMUM
                                </h3>
                                <div className="overflow-x-auto border border-gray-200">
                                  <table className="w-full min-w-[700px] border-collapse text-xs">
                                    <thead>
                                      <tr className="bg-[#F2F4F7] font-bold text-gray-800">
                                        <th className="border border-gray-200 px-4 py-2.5 text-center font-black">
                                          Tipe Pembayaran
                                        </th>
                                        <th className="border border-gray-200 px-4 py-2.5 text-center font-black w-36 sm:w-44">
                                          Tagihan
                                        </th>
                                        <th className="border border-gray-200 px-4 py-2.5 text-center font-black w-36 sm:w-44">
                                          Dibayar
                                        </th>
                                        <th className="border border-gray-200 px-4 py-2.5 text-center font-black w-36 sm:w-44">
                                          Kurang Bayar
                                        </th>
                                        <th className="border border-gray-200 px-4 py-2.5 text-center font-black w-36 sm:w-44">
                                          Status
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {group.general.map((item, iIdx) => {
                                        const isLunas = item.status === 'LUNAS';
                                        const isKurang = item.status === 'KURANG BAYAR';

                                        return (
                                          <tr key={iIdx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-800">
                                              {item.title}
                                            </td>
                                            <td className="border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-800">
                                              {formatGridNumber(item.amount)}
                                            </td>
                                            <td className="border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-800">
                                              {formatGridNumber(item.paidAmount)}
                                            </td>
                                            <td className="border border-gray-200 bg-white px-4 py-3 text-center font-medium text-gray-800">
                                              {formatGridNumber(item.remainingAmount)}
                                            </td>
                                            <td
                                              className={`border border-gray-200 p-0 text-center font-bold text-xs ${
                                                isLunas
                                                  ? 'bg-[#00A86B] text-white'
                                                  : isKurang
                                                  ? 'bg-amber-500 text-white'
                                                  : 'bg-[#E74C3C] text-white'
                                              }`}
                                            >
                                              <div className="flex h-full min-h-[42px] items-center justify-center font-black tracking-wider text-xs uppercase select-none">
                                                {item.status}
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : keuanganSubTab === 'transfer' ? (
                    /* TAB 3 CONTENT: BAYAR ONLINE VIA TRANSFER & UPLOAD BUKTI TF */
                    <div className="space-y-6">
                      {/* ALERT FEEDBACK */}
                      {submitTransferSuccess && (
                        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-emerald-800">
                          <CheckCircle2 className="shrink-0 text-emerald-600 mt-0.5" size={18} />
                          <div>
                            <h5 className="text-xs font-black">Bukti Transfer Berhasil Terkirim!</h5>
                            <p className="text-xs mt-0.5 text-emerald-700">{submitTransferSuccess}</p>
                          </div>
                        </div>
                      )}

                      {submitTransferError && (
                        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800">
                          <AlertTriangle className="shrink-0 text-rose-600 mt-0.5" size={18} />
                          <div>
                            <h5 className="text-xs font-black">Perhatian / Gagal Mengirim</h5>
                            <p className="text-xs mt-0.5 text-rose-700">{submitTransferError}</p>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* FORM CHECKOUT TRANSFER (7 COLS) */}
                        <div className="lg:col-span-7 space-y-5">
                          {/* STEP 1: PILIH TAGIHAN */}
                          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#138F81] text-white text-xs font-black">
                                  1
                                </span>
                                <h4 className="text-xs sm:text-sm font-black text-[#2D3436]">Pilih Tagihan yang Ingin Dibayar</h4>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                <button
                                  type="button"
                                  onClick={selectAllUnpaid}
                                  className="text-[#138F81] hover:underline font-bold cursor-pointer"
                                >
                                  Pilih Semua
                                </button>
                                <span className="text-slate-300">•</span>
                                <button
                                  type="button"
                                  onClick={clearSelectedBills}
                                  className="text-slate-500 hover:underline font-bold cursor-pointer"
                                >
                                  Hapus Pilihan
                                </button>
                              </div>
                            </div>

                            {unpaidBills.length === 0 ? (
                              <div className="p-6 rounded-xl bg-white text-center text-slate-400 border border-slate-200/60">
                                <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" />
                                <p className="text-xs font-black text-[#2D3436]">Alhamdulillah, semua tagihan santri sudah lunas!</p>
                              </div>
                            ) : (
                              <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {unpaidBills.map((b) => {
                                  const bId = Number(b.id);
                                  const isSelected = selectedBillIds.includes(bId);
                                  const amount = Number(b.amount || 0);
                                  return (
                                    <div
                                      key={bId}
                                      onClick={() => toggleBillSelection(bId)}
                                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all ${
                                        isSelected
                                          ? 'bg-teal-50/90 border-[#138F81] shadow-xs'
                                          : 'bg-white border-slate-200 hover:border-slate-300'
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => {}}
                                          className="w-4 h-4 rounded text-[#138F81] focus:ring-[#138F81] border-slate-300 cursor-pointer"
                                        />
                                        <div>
                                          <div className="text-xs font-black text-[#2D3436]">{String(b.title || 'Tagihan')}</div>
                                          <div className="text-[10px] text-slate-500 font-semibold">
                                            Tahun: {String(b.tahun_ajaran || '2025/2026')} {b.due_date ? `• Jatuh Tempo: ${b.due_date}` : ''}
                                          </div>
                                          {Boolean(b.notes || b.keterangan) && (
                                            <div className="text-[10px] font-bold text-amber-800 bg-amber-50 rounded-md px-1.5 py-0.5 mt-0.5 inline-flex items-center gap-1 border border-amber-200">
                                              <span>💡</span>
                                              <span>{String(b.notes || b.keterangan)}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <span className="text-xs font-black text-[#138F81]">Rp {amount.toLocaleString('id-ID')}</span>
                                        <div className="text-[9px] font-black uppercase text-amber-600">Belum Lunas</div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* TOTAL NOMINAL PILL */}
                            <div className="p-3.5 rounded-xl bg-[#138F81]/10 border border-[#138F81]/25 flex items-center justify-between">
                              <span className="text-xs font-bold text-[#2D3436]">
                                🎯 {selectedBillIds.length} tagihan terpilih
                              </span>
                              <div className="text-right">
                                <span className="text-[10px] text-[#636E72] block font-semibold">Total Nominal Transfer:</span>
                                <span className="text-sm sm:text-base font-black text-[#138F81]">
                                  Rp {totalSelectedTransferAmount.toLocaleString('id-ID')}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* STEP 2: REKENING BANK TUJUAN */}
                          <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#138F81] text-white text-xs font-black">
                                2
                              </span>
                              <h4 className="text-xs sm:text-sm font-black text-[#2D3436]">Transfer ke Rekening Resmi Pondok</h4>
                            </div>
                            <div className="p-4 rounded-xl bg-white border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                              <div>
                                <span className="text-[11px] font-bold text-slate-500">Bank Syariah Indonesia (BSI)</span>
                                <div className="text-base sm:text-lg font-black font-mono tracking-wider text-[#2D3436]">
                                  7171 2026 88
                                </div>
                                <span className="text-[11px] font-medium text-slate-600 block">
                                  a.n. <strong>Yayasan Pondok Pesantren Qomaruddin</strong>
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText('7171202688');
                                    setCopiedRekening(true);
                                    setTimeout(() => setCopiedRekening(false), 2000);
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-[#138F81] text-white text-xs font-bold hover:bg-[#0D7A6F] transition cursor-pointer flex items-center gap-1.5"
                                >
                                  {copiedRekening ? <Check size={13} /> : <Copy size={13} />}
                                  <span>{copiedRekening ? 'Tersalin' : 'Salin Rekening'}</span>
                                </button>
                                {totalSelectedTransferAmount > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(String(totalSelectedTransferAmount));
                                      alert(`Nominal Rp ${totalSelectedTransferAmount.toLocaleString('id-ID')} berhasil disalin!`);
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold hover:bg-amber-200 transition cursor-pointer flex items-center gap-1.5"
                                  >
                                    <Copy size={13} />
                                    <span>Salin Nominal</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* STEP 3: FORM BUKTI TRANSFER & PENGIRIM */}
                          <form onSubmit={handleSubmitTransferProof} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                            <div className="flex items-center gap-2">
                              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#138F81] text-white text-xs font-black">
                                3
                              </span>
                              <h4 className="text-xs sm:text-sm font-black text-[#2D3436]">Unggah Struk TF & Identitas Pengirim</h4>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Tanggal Transfer *</label>
                                <input
                                  type="date"
                                  value={transferDate}
                                  onChange={(e) => setTransferDate(e.target.value)}
                                  required
                                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-[#2D3436] focus:outline-hidden focus:ring-2 focus:ring-[#138F81]/40"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Bank Pengirim *</label>
                                <input
                                  type="text"
                                  placeholder="BSI / BCA / BRI / Mandiri / DANA"
                                  value={transferBank}
                                  onChange={(e) => setTransferBank(e.target.value)}
                                  required
                                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-[#2D3436] focus:outline-hidden focus:ring-2 focus:ring-[#138F81]/40"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Atas Nama Rekening Pengirim *</label>
                                <input
                                  type="text"
                                  placeholder="Nama pemilik rekening pengirim"
                                  value={transferSenderName}
                                  onChange={(e) => setTransferSenderName(e.target.value)}
                                  required
                                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-[#2D3436] focus:outline-hidden focus:ring-2 focus:ring-[#138F81]/40"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Nomor Rekening Pengirim (Opsional)</label>
                                <input
                                  type="text"
                                  placeholder="Nomor rekening pengirim"
                                  value={transferSenderRek}
                                  onChange={(e) => setTransferSenderRek(e.target.value)}
                                  className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-[#2D3436] focus:outline-hidden focus:ring-2 focus:ring-[#138F81]/40"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-xs font-bold text-slate-700 block mb-1">Catatan Tambahan untuk Bendahara (Opsional)</label>
                              <input
                                type="text"
                                placeholder="Contoh: Titipan SPP 2 bulan dari ibu"
                                value={transferNotes}
                                onChange={(e) => setTransferNotes(e.target.value)}
                                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-white text-[#2D3436] focus:outline-hidden focus:ring-2 focus:ring-[#138F81]/40"
                              />
                            </div>

                            {/* UPLOAD STRUK ZONE */}
                            <div>
                              <label className="text-xs font-bold text-slate-700 block mb-1">Foto Bukti Transfer (Struk ATM / M-Banking) *</label>
                              <div className="relative border-2 border-dashed border-slate-300 hover:border-[#138F81] rounded-2xl p-4 text-center bg-white transition-colors">
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                                  onChange={handleFileChange}
                                  required={!transferFile}
                                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                {isCompressingImage ? (
                                  <div className="flex flex-col items-center justify-center py-6 text-slate-500">
                                    <RefreshCw size={24} className="animate-spin text-[#138F81] mb-2" />
                                    <span className="text-xs font-bold text-[#138F81]">Mengompres & mengoptimasi foto...</span>
                                  </div>
                                ) : transferFilePreview ? (
                                  <div className="flex flex-col items-center gap-2">
                                    <img
                                      src={transferFilePreview}
                                      alt="Preview Struk"
                                      className="max-h-44 rounded-xl object-contain border border-slate-200 shadow-xs"
                                    />
                                    <span className="text-[11px] font-bold text-emerald-700">✓ {transferFile?.name}</span>
                                    {compressedInfo && (
                                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                                        <span>⚡ Hemat:</span>
                                        <span className="line-through text-slate-400 text-[10px]">{compressedInfo.origSize}</span>
                                        <span>➔ {compressedInfo.compSize}</span>
                                        <span className="bg-emerald-600 text-white text-[9px] px-1.5 py-0.5 rounded-full">Turun {compressedInfo.savedPercent}%</span>
                                      </div>
                                    )}
                                    <span className="text-[10px] text-slate-400">Klik untuk mengganti foto struk</span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center py-4">
                                    <UploadCloud size={36} className="text-[#138F81] mb-2" />
                                    <span className="text-xs font-black text-[#2D3436]">Pilih atau Tarik Foto Bukti Transfer ke Sini</span>
                                    <span className="text-[10px] text-slate-400 mt-1">Format: JPG, PNG, WEBP (Otomatis dikompres hemat server)</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <button
                              type="submit"
                              disabled={isSubmittingTransfer || selectedBillIds.length === 0}
                              className="w-full py-3 rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-md shadow-[#138F81]/25 transition cursor-pointer flex items-center justify-center gap-2"
                            >
                              {isSubmittingTransfer ? (
                                <>
                                  <RefreshCw size={16} className="animate-spin" />
                                  <span>Mengirim Bukti Transfer ke Bendahara...</span>
                                </>
                              ) : (
                                <>
                                  <CreditCard size={16} />
                                  <span>Kirim Bukti Pembayaran ke Bendahara 🚀</span>
                                </>
                              )}
                            </button>
                          </form>
                        </div>

                        {/* STATUS PENGAJUAN BUKTI TF (5 COLS) */}
                        <div className="lg:col-span-5 space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs sm:text-sm font-black text-[#2D3436]">
                              Status Pengajuan Online ({verifikasiList.length})
                            </h4>
                            <button
                              type="button"
                              onClick={async () => {
                                if (selectedChildId) {
                                  const vRes = await api.waliGetVerifikasiPembayaran(selectedChildId);
                                  if (vRes.success && Array.isArray(vRes.data)) {
                                    setVerifikasiList(vRes.data);
                                  }
                                }
                              }}
                              className="text-[11px] font-bold text-[#138F81] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <RefreshCw size={11} /> Refresh
                            </button>
                          </div>

                          {verifikasiList.length === 0 ? (
                            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center text-slate-400">
                              <Receipt size={36} className="mx-auto mb-2 text-slate-300" />
                              <p className="text-xs font-black text-[#2D3436]">Belum ada riwayat transfer online.</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">Bukti transfer yang Anda kirim akan muncul di sini beserta status ACC/Tolak dari bendahara.</p>
                            </div>
                          ) : (
                            <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1 custom-scrollbar">
                              {verifikasiList.map((item, idx) => {
                                const isMenunggu = item.status === 'menunggu';
                                const isDisetujui = item.status === 'disetujui';
                                const isDitolak = item.status === 'ditolak';
                                const totalNominal = Number(item.total_nominal || 0);
                                const bills = Array.isArray(item.selected_bills) ? (item.selected_bills as ApiRecord[]) : [];

                                return (
                                  <div
                                    key={item.id ? String(item.id) : idx}
                                    className={`p-4 rounded-2xl border transition-all ${
                                      isMenunggu
                                        ? 'bg-amber-50/50 border-amber-200'
                                        : isDisetujui
                                        ? 'bg-emerald-50/50 border-emerald-200'
                                        : 'bg-rose-50/50 border-rose-200'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <div>
                                        <span className="font-mono text-[11px] font-black text-[#2D3436]">
                                          {String(item.kode_pengajuan || '-')}
                                        </span>
                                        <div className="text-[10px] text-slate-500 font-semibold">
                                          TF: {String(item.tanggal_transfer || item.created_at || '-')}
                                        </div>
                                      </div>
                                      <div>
                                        {isMenunggu && (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black border border-amber-300">
                                            <Clock size={11} className="animate-spin" /> Menunggu Verifikasi
                                          </span>
                                        )}
                                        {isDisetujui && (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300">
                                            <CheckCircle2 size={11} /> Disetujui (Lunas)
                                          </span>
                                        )}
                                        {isDitolak && (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black border border-rose-300">
                                            <XCircle size={11} /> Ditolak
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="text-sm font-black text-[#138F81] mb-2">
                                      Rp {totalNominal.toLocaleString('id-ID')}
                                      <span className="text-[10px] font-normal text-slate-500 ml-1">
                                        (via {String(item.bank_pengirim || 'Bank')} a.n {String(item.nama_pengirim || '-')})
                                      </span>
                                    </div>

                                    {/* BILLS CHIPS */}
                                    <div className="flex flex-wrap gap-1 mb-2.5">
                                      {bills.map((b, bIdx) => (
                                        <span
                                          key={bIdx}
                                          className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-bold text-slate-700"
                                        >
                                          {String(b.title || 'Pos Bayar')} (Rp {Number(b.amount || 0).toLocaleString('id-ID')})
                                        </span>
                                      ))}
                                    </div>

                                    {/* CATATAN PETUGAS / ALASAN PENOLAKAN */}
                                    {Boolean(item.catatan_petugas) && (
                                      <div className={`p-2.5 rounded-xl text-[11px] mb-2.5 ${
                                        isDitolak
                                          ? 'bg-rose-100 text-rose-800 font-bold border border-rose-200'
                                          : 'bg-white text-slate-600 border border-slate-200'
                                      }`}>
                                        <span className="font-black">Catatan Bendahara:</span> {String(item.catatan_petugas)}
                                        <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                                          {Boolean(item.bukti_url) ? (
                                            <button
                                              type="button"
                                              onClick={() => setPreviewProofImage(String(item.bukti_url))}
                                              className="text-xs font-bold text-[#138F81] hover:underline flex items-center gap-1 cursor-pointer"
                                            >
                                              <Eye size={13} /> Lihat Foto Struk
                                            </button>
                                          ) : (
                                            <span className="text-[11px] font-semibold text-slate-500 italic flex items-center gap-1">
                                              <CheckCircle2 size={12} className="text-emerald-600" />
                                              {item.is_purged ? 'Arsip foto dibersihkan (Lunas & Sah)' : 'Tanpa lampiran foto'}
                                            </span>
                                          )}
                                          {Boolean(item.kode_transaksi) && (
                                            <span className="text-[10px] font-mono text-emerald-700 font-bold">
                                              No. TRX: {String(item.kode_transaksi)}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* TAB 2 CONTENT: RIWAYAT TRANSAKSI & KWITANSI */
                    historyList.length === 0 ? (
                      <div className="py-14 text-center text-slate-400">
                        <FileText size={42} className="mx-auto mb-2 text-slate-300" />
                        <p className="text-sm font-black text-[#2D3436]">Belum ada riwayat pembayaran tercatat.</p>
                        <p className="text-xs text-[#636E72] mt-0.5">Riwayat akan langsung otomatis muncul saat bendahara memverifikasi pembayaran.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-[#E1EFF7] text-[#138F81] font-black uppercase text-[11px]">
                              <th className="py-3.5 pl-4 rounded-l-xl">No. Kwitansi / Transaksi</th>
                              <th className="py-3.5 px-3">Tanggal Bayar</th>
                              <th className="py-3.5 px-3">Metode</th>
                              <th className="py-3.5 px-3">Penerima / Bendahara</th>
                              <th className="py-3.5 px-3 text-right">Jumlah Bayar</th>
                              <th className="py-3.5 px-3 text-center">Status</th>
                              <th className="py-3.5 pr-4 text-center rounded-r-xl">Cetak Kwitansi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {historyList.map((tr, idx) => (
                              <tr key={idx} className="hover:bg-[#F8FBFC] transition-colors">
                                <td className="py-3.5 pl-4 font-black text-[#2D3436] font-mono">
                                  {String(tr.kode_transaksi || tr.transaction_code || tr.receipt_number || tr.nomor_transaksi || tr.id || '-')}
                                </td>
                                <td className="py-3.5 px-3 text-[#2D3436] font-bold">
                                  {String(tr.tanggal || (typeof tr.created_at === 'string' ? tr.created_at.slice(0, 10) : '') || '-')}
                                </td>
                                <td className="py-3.5 px-3 text-[#636E72] font-semibold">
                                  <span className="px-2.5 py-0.5 rounded-md bg-[#E1EFF7] text-[#138F81] text-[10px] font-black uppercase">
                                    {String(tr.via || tr.metode || tr.metode_pembayaran || 'Tunai')}
                                  </span>
                                </td>
                                <td className="py-3.5 px-3 text-[#636E72] font-semibold">
                                  {String((tr.creator as Record<string, unknown> | undefined)?.name || tr.penerima || (tr.user as Record<string, unknown> | undefined)?.name || 'Bendahara Pondok')}
                                </td>
                                <td className="py-3.5 px-3 text-right font-black text-[#138F81] text-sm font-mono">
                                  Rp {Number(tr.jumlah || tr.amount || tr.jumlah_total || 0).toLocaleString('id-ID')}
                                </td>
                                <td className="py-3.5 px-3 text-center">
                                  <span className="inline-block px-2.5 py-1 text-[10px] font-black rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-300">
                                    🟢 LUNAS
                                  </span>
                                </td>
                                <td className="py-3.5 pr-4 text-center">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedReceiptTransaction(tr)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#138F81] to-[#0D7A6F] hover:from-[#0D7A6F] hover:to-[#095A52] text-white text-[11px] font-black shadow-xs transition active:scale-95 cursor-pointer"
                                    title="Lihat & Cetak Kwitansi Resmi"
                                  >
                                    <Printer size={13} />
                                    <span>Cetak Kwitansi</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}

                  {/* FOOTNOTE GUIDANCE FOR PARENTS */}
                  <div className="p-4 rounded-2xl bg-[#E1EFF7] border border-[#138F81]/20 text-xs text-[#2D3436] flex items-start gap-3 mt-4">
                    <Info size={18} className="text-[#138F81] shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-black text-[#138F81]">Petunjuk Pembayaran untuk Wali Santri:</h5>
                      <p className="mt-0.5 text-[#636E72] font-medium leading-relaxed">
                        Pembayaran Syahriah & SPP dapat ditunaikan langsung di <strong>Kantor Bendahara Pondok Pesantren Qomaruddin</strong> atau melalui transfer bank ke rekening yayasan resmi. Setelah transfer, bendahara akan memverifikasi bukti transaksi dan menerbitkan kwitansi realtime.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 2: ABSENSI REALTIME (MADIN, SHOLAT, NGAJI) */}
            {/* ========================================================================= */}
            {activeTab === 'absensi' && (
              <div className="space-y-4 sm:space-y-6">
                {/* FILTER HEADER (BULAN, TAHUN & SUB-TABS) */}
                <div className="q-card bg-white rounded-[26px] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl shadow-black/5">
                  <div className="flex items-center gap-2">
                    <Calendar size={18} className="text-[#138F81]" />
                    <span className="text-xs font-black text-[#2D3436] uppercase tracking-wide">
                      Filter Periode:
                    </span>
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                      className="px-3 py-1.5 text-xs font-black rounded-xl border border-slate-200 bg-[#f8fafc] text-[#2D3436] focus:ring-2 focus:ring-[#138F81]/30 outline-hidden cursor-pointer"
                    >
                      {monthsList.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                      className="px-3 py-1.5 text-xs font-black rounded-xl border border-slate-200 bg-[#f8fafc] text-[#2D3436] focus:ring-2 focus:ring-[#138F81]/30 outline-hidden cursor-pointer"
                    >
                      {[2024, 2025, 2026, 2027].map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleReloadAttendance}
                      className="p-2 text-[#138F81] hover:text-white bg-[#E1EFF7] hover:bg-[#138F81] rounded-xl transition cursor-pointer"
                      title="Perbarui Data Presensi"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>

                  {/* 3 SUB-TABS: MADIN, NGAJI, SHOLAT */}
                  <div className="flex items-center gap-1.5 bg-[#E1EFF7] p-1.5 rounded-2xl">
                    {[
                      { id: 'madin', label: 'Madin Diniyah' },
                      { id: 'sholat', label: 'Jamaah Sholat' },
                      { id: 'ngaji', label: 'Ngaji Kitab' },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setAbsensiSubTab(st.id as AbsensiSubTab)}
                        className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer ${
                          absensiSubTab === st.id
                            ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/25'
                            : 'text-[#636E72] hover:text-[#138F81]'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* STATS COUNTERS */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div className="q-card bg-[#E8F7F3] rounded-[22px] p-4 sm:p-5 border-2 border-[#138F81]/20 shadow-md">
                    <span className="text-[11px] font-black text-[#138F81] uppercase block">Total Hadir</span>
                    <p className="text-2xl sm:text-3xl font-black text-[#0D7A6F] mt-1">
                      {absensiSubTab === 'madin' ? String(madinStats.hadir ?? 0) : absensiSubTab === 'ngaji' ? String(ngajiStats.hadir ?? 0) : String(sholatStats.masuk ?? 0)} Hari
                    </p>
                  </div>
                  <div className="q-card bg-[#E1EFF7] rounded-[22px] p-4 sm:p-5 border-2 border-sky-300/30 shadow-md">
                    <span className="text-[11px] font-black text-sky-800 uppercase block">Izin</span>
                    <p className="text-2xl sm:text-3xl font-black text-sky-700 mt-1">
                      {absensiSubTab === 'madin' ? String(madinStats.izin ?? 0) : absensiSubTab === 'ngaji' ? String(ngajiStats.izin ?? 0) : String(sholatStats.izin ?? 0)} Hari
                    </p>
                  </div>
                  <div className="q-card bg-[#FFF8E1] rounded-[22px] p-4 sm:p-5 border-2 border-amber-300/40 shadow-md">
                    <span className="text-[11px] font-black text-amber-800 uppercase block">Sakit</span>
                    <p className="text-2xl sm:text-3xl font-black text-amber-700 mt-1">
                      {absensiSubTab === 'madin' ? String(madinStats.sakit ?? 0) : absensiSubTab === 'ngaji' ? String(ngajiStats.sakit ?? 0) : String(sholatStats.sakit ?? 0)} Hari
                    </p>
                  </div>
                  <div className="q-card bg-[#FEE2E2] rounded-[22px] p-4 sm:p-5 border-2 border-rose-300/40 shadow-md">
                    <span className="text-[11px] font-black text-rose-800 uppercase block">Alfa / Tanpa Keterangan</span>
                    <p className="text-2xl sm:text-3xl font-black text-rose-700 mt-1">
                      {absensiSubTab === 'madin' ? String(madinStats.alfa ?? 0) : absensiSubTab === 'ngaji' ? String(ngajiStats.alfa ?? 0) : '0'} Hari
                    </p>
                  </div>
                </div>

                {/* LOGS LIST */}
                <div className="q-card bg-white rounded-[28px] p-5 sm:p-7 space-y-4 shadow-xl shadow-black/5">
                  <h3 className="text-sm font-black text-[#2D3436] flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="flex items-center gap-2">
                      <CalendarCheck size={18} className="text-[#138F81]" />
                      Jurnal Kehadiran {absensiSubTab === 'madin' ? 'Madrasah Diniyah' : absensiSubTab === 'ngaji' ? 'Pengajian Kitab Kuning' : 'Sholat Berjamaah'}
                    </span>
                    <span className="text-xs font-bold text-[#138F81]">
                      Bulan {monthsList.find((m) => m.value === selectedMonth)?.label} {selectedYear}
                    </span>
                  </h3>

                  {/* MADIN LOGS */}
                  {absensiSubTab === 'madin' && (
                    madinGrouped.length === 0 ? (
                      <div className="py-12 text-center text-slate-400">
                        <CalendarCheck size={38} className="mx-auto mb-2 text-[#138F81]/40" />
                        <p className="text-sm font-black text-[#2D3436]">Belum ada catatan absensi madin pada bulan ini.</p>
                        {Number(absensiMadinData?.total_all_records ?? 0) > 0 && (
                          <div className="mt-4 inline-flex flex-col sm:flex-row items-center gap-2.5 p-3 px-4 rounded-2xl bg-amber-50 text-amber-900 border border-amber-200 text-xs font-bold shadow-xs">
                            <span>💡 Terdeteksi presensi santri tersimpan pada bulan lain. Coba pilih <strong>Bulan Agustus {selectedYear}</strong>:</span>
                            <button
                              type="button"
                              onClick={() => setSelectedMonth(8)}
                              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-black cursor-pointer shadow-xs transition active:scale-95"
                            >
                              Lihat Presensi Agustus
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {madinGrouped.map((day, idx) => {
                          const records = (Array.isArray(day.records) ? day.records : []) as ApiRecord[];
                          return (
                            <div key={idx} className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200">
                              <div className="flex items-center justify-between mb-2.5">
                                <span className="text-xs font-black text-[#2D3436]">
                                  📅 {String(day.hari || '')}, {String(day.tanggal || '')}
                                </span>
                                <span className="text-[10px] font-extrabold text-[#138F81]">{records.length} Mata Pelajaran</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {records.map((rec, rIdx) => (
                                  <div key={rIdx} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                                    <div>
                                      <p className="text-xs font-black text-[#2D3436]">{String(rec.mapel || 'Pelajaran')}</p>
                                      <p className="text-[10px] text-[#636E72] font-medium">Pengajar: {String(rec.diinput_oleh || 'Ustadz')}</p>
                                    </div>
                                    <span
                                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-md ${
                                        rec.status === 'Hadir'
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                          : rec.status === 'Izin'
                                          ? 'bg-sky-50 text-sky-700 border border-sky-300'
                                          : rec.status === 'Sakit'
                                          ? 'bg-amber-50 text-amber-800 border border-amber-300'
                                          : 'bg-rose-50 text-rose-700 border border-rose-300'
                                      }`}
                                    >
                                      {String(rec.status || 'Hadir')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                  {/* SHOLAT LOGS */}
                  {absensiSubTab === 'sholat' && (
                    sholatGrouped.length === 0 ? (
                      <div className="py-12 text-center text-slate-400">
                        <Home size={38} className="mx-auto mb-2 text-[#138F81]/40" />
                        <p className="text-sm font-black text-[#2D3436]">Belum ada catatan absensi sholat pada bulan ini.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sholatGrouped.map((day, idx) => {
                          const records = (Array.isArray(day.records) ? day.records : []) as ApiRecord[];
                          return (
                            <div key={idx} className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200">
                              <div className="flex items-center justify-between mb-2.5">
                                <span className="text-xs font-black text-[#2D3436]">
                                  🕌 {String(day.hari || '')}, {String(day.tanggal || '')}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                {records.map((rec, rIdx) => (
                                  <div key={rIdx} className="bg-white p-2.5 rounded-xl border border-slate-200 text-center shadow-2xs">
                                    <p className="text-[11px] font-black text-[#2D3436]">{String(rec.jenis_sholat || 'Sholat')}</p>
                                    <span className="inline-block mt-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-300">
                                      {String(rec.status || 'Masuk')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}

                  {/* NGAJI LOGS */}
                  {absensiSubTab === 'ngaji' && (
                    ngajiGrouped.length === 0 ? (
                      <div className="py-12 text-center text-slate-400">
                        <BookOpen size={38} className="mx-auto mb-2 text-[#138F81]/40" />
                        <p className="text-sm font-black text-[#2D3436]">Belum ada catatan absensi ngaji pada bulan ini.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {ngajiGrouped.map((day, idx) => {
                          const records = (Array.isArray(day.records) ? day.records : []) as ApiRecord[];
                          return (
                            <div key={idx} className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200">
                              <div className="flex items-center justify-between mb-2.5">
                                <span className="text-xs font-black text-[#2D3436]">
                                  📖 {String(day.hari || '')}, {String(day.tanggal || '')}
                                </span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {records.map((rec, rIdx) => (
                                  <div key={rIdx} className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                                    <div>
                                      <p className="text-xs font-black text-[#2D3436]">{String(rec.kitab || rec.mapel || 'Ngaji Kitab')}</p>
                                      <p className="text-[10px] text-[#636E72] font-medium">Sesi: {String(rec.sesi || 'Kajian Sore')}</p>
                                    </div>
                                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-300">
                                      {String(rec.status || 'Masuk')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 3: DATA DIRI SANTRI (BIODATA & AKADEMIK) */}
            {/* ========================================================================= */}
            {activeTab === 'biodata' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                {/* 1. DATA PRIBADI SANTRI */}
                <div className="q-card bg-white rounded-[28px] p-6 sm:p-7 shadow-xl shadow-black/5 space-y-4">
                  <h3 className="text-sm font-black text-[#2D3436] flex items-center gap-2 pb-3 border-b border-slate-100">
                    <UserRound size={18} className="text-[#138F81]" />
                    Data Identitas Pribadi
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Nama Lengkap</span>
                      <p className="font-black text-[#2D3436] text-sm mt-0.5">{studentName}</p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Nomor Induk Santri (NIS)</span>
                      <p className="font-black text-[#2D3436] text-sm mt-0.5">{studentNis}</p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">NISN</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">{String(biodata?.nisn || '-')}</p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Jenis Kelamin</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">
                        {String(biodata?.jenis_kelamin || '').toUpperCase() === 'L' || String(biodata?.jenis_kelamin || '').toLowerCase().includes('laki')
                          ? '👨 Laki-laki (Putra)'
                          : '👩 Perempuan (Putri)'}
                      </p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Tempat, Tanggal Lahir</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">
                        {String(biodata?.tempat_lahir || '-')}, {String(biodata?.tanggal_lahir || '-')}
                      </p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Status Santri</span>
                      <span className="inline-block mt-0.5 px-2.5 py-0.5 text-[10px] font-black text-[#138F81] bg-[#E8F7F3] border border-[#138F81]/20 rounded-md">
                        🟢 {studentStatus}
                      </span>
                    </div>
                    <div className="sm:col-span-2 bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Alamat Lengkap</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">
                        {String(biodata?.alamat || biodata?.desa || biodata?.kecamatan || biodata?.kabupaten || 'Sampurnan Bungah Gresik')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. DATA AKADEMIK MADIN */}
                <div className="q-card bg-white rounded-[28px] p-6 sm:p-7 shadow-xl shadow-black/5 space-y-4">
                  <h3 className="text-sm font-black text-[#2D3436] flex items-center gap-2 pb-3 border-b border-slate-100">
                    <GraduationCap size={18} className="text-[#138F81]" />
                    Data Akademik Madrasah Diniyah
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Kelas Madin</span>
                      <p className="font-black text-[#2D3436] text-sm mt-0.5">{studentKelas}</p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Kelompok Belajar</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">
                        {String((biodata?.kelompok_belajar as Record<string, unknown> | undefined)?.nama ?? biodata?.kelompok ?? 'Reguler')}
                      </p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Tahun Masuk / Angkatan</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">{String(biodata?.tahun_masuk || biodata?.angkatan || '2025/2026')}</p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Asal Sekolah Formal</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">{String(biodata?.asal_sekolah || (biodata?.schoolOrigin as Record<string, unknown> | undefined)?.name || 'MTs Assa\'adah')}</p>
                    </div>
                  </div>
                </div>

                {/* 3. DATA PONDOK & ASRAMA */}
                <div className="q-card bg-white rounded-[28px] p-6 sm:p-7 shadow-xl shadow-black/5 space-y-4">
                  <h3 className="text-sm font-black text-[#2D3436] flex items-center gap-2 pb-3 border-b border-slate-100">
                    <Building2 size={18} className="text-[#138F81]" />
                    Data Komplek Pondok & Kamar
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Komplek / Asrama</span>
                      <p className="font-black text-[#2D3436] text-sm mt-0.5">{studentKomplek}</p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Nomor / Nama Kamar</span>
                      <p className="font-black text-[#2D3436] text-sm mt-0.5">{studentKamar}</p>
                    </div>
                    <div className="sm:col-span-2 bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Status Tempat Tinggal</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">
                        {studentKomplek !== '-' ? '🏡 Santri Mukim (Mondok)' : '🚶 Santri Kalong'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. DATA ORANG TUA & WALI */}
                <div className="q-card bg-white rounded-[28px] p-6 sm:p-7 shadow-xl shadow-black/5 space-y-4">
                  <h3 className="text-sm font-black text-[#2D3436] flex items-center gap-2 pb-3 border-b border-slate-100">
                    <HeartHandshake size={18} className="text-[#138F81]" />
                    Data Orang Tua / Wali
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Nama Ayah</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">{String(biodata?.nama_ayah || '-')}</p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Nama Ibu</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">{String(biodata?.nama_ibu || '-')}</p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">Nama Wali Terdaftar</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">
                        {String(biodata?.nama_wali || (biodata?.wali as Record<string, unknown> | undefined)?.name || session?.name || '-')}
                      </p>
                    </div>
                    <div className="bg-[#E1EFF7]/50 p-3 rounded-2xl border border-[#E1EFF7]">
                      <span className="text-[#636E72] font-bold block">No. WhatsApp / HP Wali</span>
                      <p className="font-extrabold text-[#2D3436] mt-0.5">
                        {String(biodata?.no_telepon_wali || biodata?.no_hp || (biodata?.wali as Record<string, unknown> | undefined)?.no_hp || '-')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================================= */}
            {/* TAB 4: NILAI & HAFALAN SANTRI */}
            {/* ========================================================================= */}
            {activeTab === 'nilai' && (
              <div className="space-y-4 sm:space-y-6">
                <div className="q-card bg-white rounded-[28px] p-5 sm:p-7 space-y-4 shadow-xl shadow-black/5">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                    <button
                      type="button"
                      onClick={() => setNilaiSubTab('akademik')}
                      className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer ${
                        nilaiSubTab === 'akademik'
                          ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/25'
                          : 'bg-[#E1EFF7] text-[#138F81] hover:bg-[#d0e5f2]'
                      }`}
                    >
                      📊 Raport Nilai Akademik Madin ({raportList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setNilaiSubTab('hafalan')}
                      className={`px-4 py-2 text-xs font-black rounded-xl transition cursor-pointer ${
                        nilaiSubTab === 'hafalan'
                          ? 'bg-[#138F81] text-white shadow-md shadow-[#138F81]/25'
                          : 'bg-[#E1EFF7] text-[#138F81] hover:bg-[#d0e5f2]'
                      }`}
                    >
                      📖 Catatan Setoran Hafalan Al-Qur'an ({hafalanList.length})
                    </button>
                  </div>

                  {nilaiSubTab === 'akademik' ? (
                    raportList.length === 0 ? (
                      <div className="py-14 text-center text-slate-400">
                        <Award size={42} className="mx-auto mb-2 text-[#138F81]/40" />
                        <p className="text-sm font-black text-[#2D3436]">Belum ada data nilai raport untuk semester ini.</p>
                        <p className="text-xs text-[#636E72] mt-0.5">Nilai akan otomatis muncul saat dewan guru madin selesai merekap nilai.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-[#E1EFF7] text-[#138F81] font-black uppercase text-[11px]">
                              <th className="py-3.5 pl-4 rounded-l-xl">Mata Pelajaran</th>
                              <th className="py-3.5 px-3 text-center">Tugas</th>
                              <th className="py-3.5 px-3 text-center">UTS</th>
                              <th className="py-3.5 px-3 text-center">UAS</th>
                              <th className="py-3.5 px-3 text-center">Nilai Akhir</th>
                              <th className="py-3.5 pr-4 text-center rounded-r-xl">Predikat</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {raportList.map((row, idx) => (
                              <tr key={idx} className="hover:bg-[#F8FBFC] transition-colors">
                                <td className="py-3.5 pl-4 font-black text-[#2D3436]">
                                  {String((row.mata_pelajaran as Record<string, unknown> | undefined)?.nama ?? row.mapel ?? 'Mata Pelajaran')}
                                </td>
                                <td className="py-3.5 px-3 text-center text-[#2D3436] font-bold">{String(row.nilai_tugas ?? '-')}</td>
                                <td className="py-3.5 px-3 text-center text-[#2D3436] font-bold">{String(row.nilai_uts ?? '-')}</td>
                                <td className="py-3.5 px-3 text-center text-[#2D3436] font-bold">{String(row.nilai_uas ?? '-')}</td>
                                <td className="py-3.5 px-3 text-center font-black text-[#138F81] text-sm">
                                  {String(row.nilai_akhir ?? row.nilai ?? '-')}
                                </td>
                                <td className="py-3.5 pr-4 text-center">
                                  <span className="inline-block px-2.5 py-0.5 text-[10px] font-black rounded-md bg-emerald-50 text-emerald-700 border border-emerald-300">
                                    {String(row.predikat ?? 'A')}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  ) : (
                    hafalanList.length === 0 ? (
                      <div className="py-14 text-center text-slate-400">
                        <BookOpen size={42} className="mx-auto mb-2 text-[#138F81]/40" />
                        <p className="text-sm font-black text-[#2D3436]">Belum ada riwayat setoran hafalan Al-Qur'an.</p>
                        <p className="text-xs text-[#636E72] mt-0.5">Catatan ziyadah dan muroja'ah akan tampil secara berurutan.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {hafalanList.map((haf, idx) => (
                          <div key={idx} className="p-4 rounded-2xl bg-[#f8fafc] border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-[#2D3436]">
                                  📖 {String(haf.surah ?? haf.surat ?? 'Surah')}
                                </span>
                                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-[#E1EFF7] text-[#138F81] border border-[#138F81]/20">
                                  Juz {String(haf.juz ?? '1')}
                                </span>
                              </div>
                              <p className="text-xs text-[#636E72] font-semibold mt-1">
                                Ayat {String(haf.ayat_awal ?? '1')} - {String(haf.ayat_akhir ?? 'Selesai')} • Tanggal: {String(haf.tanggal || '-')}
                              </p>
                              {Boolean(haf.catatan) && (
                                <p className="text-[11px] text-[#0D7A6F] italic mt-1 font-bold">
                                  💬 Catatan: "{String(haf.catatan)}"
                                </p>
                              )}
                            </div>
                            <div className="text-right whitespace-nowrap">
                              <span className="text-xs font-black px-3 py-1 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-300 inline-block">
                                {String(haf.predikat || haf.nilai || 'Mumtaz')}
                              </span>
                              <p className="text-[10px] text-[#636E72] font-semibold mt-1">
                                Pembina: {String((haf.creator as Record<string, unknown> | undefined)?.name ?? haf.ustadz ?? 'Ustadz Pembina')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ========================================================================= */}
        {/* 6. AESTHETIC FOOTER (MATCHING ADMIN SYSTEM) */}
        {/* ========================================================================= */}
        <footer className="q-card rounded-2xl sm:rounded-[26px] bg-[#FFFDF7] p-5 shadow-xl shadow-black/5 text-[#636E72]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div>
              <p className="text-xs font-black text-[#2D3436] tracking-tight">
                Portal Informasi & Presensi Santri Terpadu
              </p>
              <p className="text-[11px] font-bold text-[#636E72]">
                Yayasan Pondok Pesantren Qomaruddin • Managed by <span className="font-extrabold text-[#138F81]">IT QOMARUDDIN ( ITQOM )</span>
              </p>
            </div>

            <div className="flex items-center gap-2.5 text-[11px] font-bold">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F7F3] text-[#138F81] border border-[#138F81]/20 font-black text-[10px]">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Monitoring
              </span>
              <span className="text-[11px] font-semibold text-[#636E72]">
                © 2026 PP. Qomaruddin
              </span>
            </div>
          </div>
        </footer>
      </div>

      {/* ========================================================================= */}
      {/* 7. CHANGE PASSWORD MODAL */}
      {/* ========================================================================= */}
      {isChangePasswordOpen && (
        <WaliChangePasswordModal
          identifier={studentNis !== '-' ? studentNis : studentName !== 'Santri' ? studentName : session?.email || session?.name || 'siswa'}
          onClose={() => setIsChangePasswordOpen(false)}
          onSuccess={() => {
            if (session?.id) sessionStorage.setItem(`dismissed_wali_pwd_warning_${session.id}`, 'true');
            setSecurityWarningDismissed(true);
          }}
        />
      )}
      {/* ========================================================================= */}
      {/* 8. PREVIEW PROOF IMAGE MODAL */}
      {/* ========================================================================= */}
      {previewProofImage && (
        <div
          onClick={() => setPreviewProofImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs cursor-zoom-out animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl w-full max-h-[90vh] bg-white rounded-3xl p-5 shadow-2xl border border-slate-200 flex flex-col items-center cursor-default space-y-3"
          >
            <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-xs font-black text-[#2D3436] flex items-center gap-2">
                <ImageIcon size={16} className="text-[#138F81]" /> Foto Bukti Struk Transfer Bank
              </span>
              <button
                type="button"
                onClick={() => setPreviewProofImage(null)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-1 w-full flex items-center justify-center overflow-auto max-h-[70vh]">
              <img
                src={previewProofImage}
                alt="Bukti Transfer"
                className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-md"
              />
            </div>
            <div className="w-full pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Klik di luar atau tombol silang untuk menutup</span>
              <a
                href={previewProofImage}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-[#138F81] text-white font-black hover:bg-[#0D7A6F] transition cursor-pointer"
              >
                Buka Resolusi Penuh ↗
              </a>
            </div>
          </div>
        </div>
      )}

      {/* KWITANSI RESMI MODAL (VIEW, PRINT & DOWNLOAD JPG) */}
      {selectedReceiptTransaction && (
        <ReceiptWaliModal
          transaction={selectedReceiptTransaction}
          child={childData || (biodata as ApiRecord)}
          onClose={() => setSelectedReceiptTransaction(null)}
        />
      )}

      {/* Feedback Toast Uji Notifikasi */}
      {notifTestFeedback && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-[#0D7A6F] text-white text-xs font-bold shadow-2xl animate-fade-in border border-teal-300/40">
          <Bell className="w-4 h-4 text-amber-300 shrink-0" />
          <span>{notifTestFeedback}</span>
          <button
            onClick={() => setNotifTestFeedback(null)}
            className="ml-2 text-white/70 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 📲 PWA 1-Click Install Banner (Instal Langsung dari Chrome tanpa Play Store) */}
      <PwaInstallBanner />

      {/* 🔔 Izin Notifikasi Real-Time Wali Santri */}
      <NotificationPermissionPrompt userId={session?.id} role="wali" />
    </div>
  );
}

function WaliChangePasswordModal({
  identifier,
  onClose,
  onSuccess,
}: {
  identifier: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('siswa12345');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setError('Kata sandi baru minimal 6 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi kata sandi baru tidak cocok.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await api.changePassword({
        identifier,
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirmation: confirmPassword,
      });
      setSuccess('Kata sandi berhasil diperbarui!');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengganti kata sandi. Cek kembali password lama/default Anda.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="q-card bg-white rounded-[28px] p-6 max-w-md w-full shadow-2xl border border-slate-100 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#E1EFF7] text-[#138F81]">
              <KeyRound size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#2D3436]">Ganti Kata Sandi Akun</h3>
              <p className="text-[11px] text-[#636E72] font-bold truncate max-w-[220px]">Login: {identifier}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <XCircle size={18} />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold">
            ✓ {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="font-bold text-[#2D3436] block mb-1">
              Kata Sandi Saat Ini / Default
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="siswa12345"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-[#f8fafc] font-mono text-xs focus:ring-2 focus:ring-[#138F81]/30 outline-hidden"
            />
            <span className="text-[10px] text-[#636E72] font-semibold mt-1 block">
              Default awal akun wali santri adalah: <code className="font-bold text-[#138F81]">siswa12345</code>
            </span>
          </div>

          <div>
            <label className="font-bold text-[#2D3436] block mb-1">
              Kata Sandi Baru
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-mono text-xs focus:ring-2 focus:ring-[#138F81]/30 outline-hidden"
            />
          </div>

          <div>
            <label className="font-bold text-[#2D3436] block mb-1">
              Konfirmasi Kata Sandi Baru
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi kata sandi baru"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white font-mono text-xs focus:ring-2 focus:ring-[#138F81]/30 outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-black rounded-xl bg-[#138F81] hover:bg-[#0D7A6F] text-white disabled:opacity-50 transition cursor-pointer shadow-md shadow-[#138F81]/25"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Kata Sandi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
