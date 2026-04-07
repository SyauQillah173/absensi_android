import 'package:flutter/material.dart';

import '../../services/api_service.dart';
import '../../services/cache_service.dart';

class PembayaranScreen extends StatefulWidget {
  const PembayaranScreen({super.key});

  @override
  State<PembayaranScreen> createState() => _PembayaranScreenState();
}

class _PembayaranScreenState extends State<PembayaranScreen>
    with TickerProviderStateMixin {
  static const _cacheToday = 'pembayaran_today';
  static const _cacheAll = 'pembayaran_all';
  static const _cacheTypes = 'payment_types_all';
  static const _cacheSiswa = 'pembayaran_siswa_with_wali';

  static const List<String> _allPaymentMethods = [
    'Tunai',
    'Transfer Dana',
    'Bank BRI',
    'Bank Mandiri',
    'Bank BSI',
    'Bank BCA',
    'QRIS',
  ];

  late final AnimationController _animController;
  late final Animation<double> _fadeIn;
  late final TabController _tabController;

  bool _isLoading = true;
  bool _isOfflineMode = false;
  bool _isSyncing = false;
  String? _errorMessage;

  List<Map<String, dynamic>> _pembayaranHariIni = [];
  List<Map<String, dynamic>> _allPembayaran = [];
  List<Map<String, dynamic>> _paymentTypes = [];
  List<Map<String, dynamic>> _siswaList = [];

  int _totalHariIni = 0;
  int _jumlahTransaksiHariIni = 0;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeIn = Tween<double>(
      begin: 0,
      end: 1,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
    _tabController = TabController(length: 3, vsync: this);
    _animController.forward();
    _loadData();
  }

  @override
  void dispose() {
    _animController.dispose();
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData({bool forceRefresh = false}) async {
    if (!mounted) return;

    setState(() {
      _isLoading =
          _pembayaranHariIni.isEmpty &&
          _allPembayaran.isEmpty &&
          _paymentTypes.isEmpty;
      _isSyncing = true;
      _errorMessage = null;
    });

    if (!forceRefresh || _allPembayaran.isEmpty) {
      await _loadCachedData();
    }

    try {
      final results = await Future.wait([
        ApiService.getPembayaran(),
        ApiService.getAllPembayaran(),
        ApiService.getPaymentTypes(),
        ApiService.getSiswa(withWali: true),
      ]);

      final todayResult = results[0];
      final allResult = results[1];
      final typesResult = results[2];
      final siswaResult = results[3];

      await CacheService.save(_cacheToday, todayResult);
      await CacheService.save(_cacheAll, allResult);
      await CacheService.save(_cacheTypes, typesResult);
      await CacheService.save(_cacheSiswa, siswaResult);

      if (!mounted) return;
      setState(() {
        _consumeData(
          todayResult: todayResult,
          allResult: allResult,
          typesResult: typesResult,
          siswaResult: siswaResult,
        );
        _isLoading = false;
        _isOfflineMode = false;
        _isSyncing = false;
        _errorMessage = null;
      });
    } catch (e) {
      if (!mounted) return;

      if (_allPembayaran.isEmpty && _paymentTypes.isEmpty) {
        setState(() {
          _isLoading = false;
          _isSyncing = false;
          _errorMessage =
              'Data keuangan belum bisa dimuat.\nCoba cek koneksi dan backend.';
        });
      } else {
        setState(() {
          _isLoading = false;
          _isSyncing = false;
          _isOfflineMode = true;
        });
      }
    }
  }

  Future<void> _loadCachedData() async {
    final todayCached = await CacheService.get(_cacheToday);
    final allCached = await CacheService.get(_cacheAll);
    final typeCached = await CacheService.get(_cacheTypes);
    final siswaCached = await CacheService.get(_cacheSiswa);

    if (!mounted) return;

    if (todayCached is Map<String, dynamic> ||
        allCached is Map<String, dynamic> ||
        typeCached is Map<String, dynamic> ||
        siswaCached is Map<String, dynamic>) {
      setState(() {
        _consumeData(
          todayResult: todayCached is Map<String, dynamic> ? todayCached : null,
          allResult: allCached is Map<String, dynamic> ? allCached : null,
          typesResult: typeCached is Map<String, dynamic> ? typeCached : null,
          siswaResult: siswaCached is Map<String, dynamic> ? siswaCached : null,
        );
        _isLoading = false;
        _isOfflineMode = true;
      });
    }
  }

  void _consumeData({
    Map<String, dynamic>? todayResult,
    Map<String, dynamic>? allResult,
    Map<String, dynamic>? typesResult,
    Map<String, dynamic>? siswaResult,
  }) {
    if (todayResult != null) {
      _pembayaranHariIni = List<Map<String, dynamic>>.from(
        todayResult['data'] ?? [],
      );
      _totalHariIni = todayResult['total_hari_ini'] ?? 0;
      _jumlahTransaksiHariIni = todayResult['jumlah_transaksi'] ?? 0;
    }
    if (allResult != null) {
      _allPembayaran = List<Map<String, dynamic>>.from(allResult['data'] ?? []);
    }
    if (typesResult != null) {
      _paymentTypes = List<Map<String, dynamic>>.from(typesResult['data'] ?? []);
    }
    if (siswaResult != null) {
      _siswaList = List<Map<String, dynamic>>.from(siswaResult['data'] ?? []);
    }
  }

  void _showSnack(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError
            ? const Color(0xFFE65100)
            : const Color(0xFF138F81),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  void _showOfflineActionMessage() {
    _showSnack(
      'Mode offline hanya untuk melihat data terakhir. Sambungkan ke server untuk tambah atau ubah pembayaran.',
      isError: true,
    );
  }

  Color _getJenisColor(String jenis) {
    final raw = jenis.toLowerCase();
    if (raw.contains('spp')) return const Color(0xFF138F81);
    if (raw.contains('ujian')) return const Color(0xFF2E86DE);
    if (raw.contains('kitab') || raw.contains('buku')) {
      return const Color(0xFF6C5CE7);
    }
    if (raw.contains('daftar')) return const Color(0xFFE65100);
    return const Color(0xFF636E72);
  }

  Color _getViaColor(String via) {
    switch (via) {
      case 'Transfer Dana':
        return const Color(0xFF00B894);
      case 'Bank BRI':
      case 'Bank Mandiri':
      case 'Bank BSI':
      case 'Bank BCA':
        return const Color(0xFF0984E3);
      case 'QRIS':
        return const Color(0xFF6C5CE7);
      case 'Tunai':
        return const Color(0xFFE65100);
      default:
        return const Color(0xFF636E72);
    }
  }

  IconData _getViaIcon(String via) {
    switch (via) {
      case 'Transfer Dana':
        return Icons.send_rounded;
      case 'QRIS':
        return Icons.qr_code_rounded;
      case 'Tunai':
        return Icons.payments_rounded;
      default:
        return Icons.account_balance_rounded;
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'Lunas':
        return const Color(0xFF138F81);
      case 'Menunggu':
        return const Color(0xFFE65100);
      case 'Belum Lunas':
        return const Color(0xFFD63031);
      default:
        return const Color(0xFF636E72);
    }
  }

  String _formatRupiah(int amount) {
    final raw = amount.toString();
    var result = '';
    var count = 0;
    for (var i = raw.length - 1; i >= 0; i--) {
      count++;
      result = raw[i] + result;
      if (count % 3 == 0 && i != 0) {
        result = '.$result';
      }
    }
    return 'Rp $result';
  }

  String _formatDate(DateTime value) {
    return '${value.year}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
  }

  String _paymentDisplayName(Map<String, dynamic> payment) {
    final paymentType = _extractPaymentType(payment);
    return paymentType?['nama']?.toString() ??
        payment['jenis']?.toString() ??
        'Pembayaran';
  }

  Map<String, dynamic>? _extractPaymentType(Map<String, dynamic> payment) {
    final raw = payment['payment_type'] ?? payment['paymentType'];
    if (raw is Map<String, dynamic>) return raw;
    if (raw is Map) return Map<String, dynamic>.from(raw);
    return null;
  }

  String _waliNameFromSiswa(Map<String, dynamic> siswa) {
    final wali = siswa['wali'];
    if (wali is Map && wali['name'] != null && wali['name'].toString().isNotEmpty) {
      return wali['name'].toString();
    }
    final fallback = siswa['nama_wali']?.toString() ?? '';
    return fallback.isEmpty ? 'Wali Santri' : fallback;
  }

  void _showQuickActions() {
    if (_isOfflineMode) {
      _showOfflineActionMessage();
      return;
    }

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(20, 18, 20, 24),
        decoration: const BoxDecoration(
          color: Color(0xFFE1EFF7),
          borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 42,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[400],
                borderRadius: BorderRadius.circular(4),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Tambah Data Keuangan',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: Color(0xFF2D3436),
              ),
            ),
            const SizedBox(height: 14),
            _buildSheetAction(
              icon: Icons.receipt_long_rounded,
              color: const Color(0xFF138F81),
              title: 'Tambah Pembayaran',
              subtitle: 'Catat transaksi siswa yang sedang dibayar saat ini.',
              onTap: () {
                Navigator.pop(ctx);
                _showAddPembayaranDialog();
              },
            ),
            _buildSheetAction(
              icon: Icons.wallet_rounded,
              color: const Color(0xFFE65100),
              title: 'Tambah Tipe Pembayaran',
              subtitle: 'Buat master tagihan baru untuk wali dan transaksi berikutnya.',
              onTap: () {
                Navigator.pop(ctx);
                _showPaymentTypeDialog();
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSheetAction({
    required IconData icon,
    required Color color,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        width: double.infinity,
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Row(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 10,
                      color: Color(0xFF636E72),
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(
              Icons.chevron_right_rounded,
              color: Color(0xFF636E72),
            ),
          ],
        ),
      ),
    );
  }

  void _showAddPembayaranDialog() {
    final nominalController = TextEditingController();
    final keteranganController = TextEditingController();
    int? selectedSiswaId;
    int? selectedPaymentTypeId;
    String selectedWaliName = '';
    String selectedVia = '';
    String selectedStatus = 'Lunas';
    DateTime selectedDate = DateTime.now();
    bool isSaving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          final activePaymentTypes = _paymentTypes
              .where((type) => type['status']?.toString() != 'Nonaktif')
              .toList();
          final selectedType = selectedPaymentTypeId == null
              ? null
              : activePaymentTypes.firstWhere(
                  (type) => type['id'] == selectedPaymentTypeId,
                  orElse: () => <String, dynamic>{},
                );
          final selectedMethods = selectedType == null || selectedType.isEmpty
              ? _allPaymentMethods
              : List<String>.from(selectedType['metode_pembayaran'] ?? []);

          return Container(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(ctx).size.height * 0.9,
            ),
            padding: EdgeInsets.fromLTRB(
              24,
              20,
              24,
              MediaQuery.of(ctx).viewInsets.bottom + 24,
            ),
            decoration: const BoxDecoration(
              color: Color(0xFFE1EFF7),
              borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
            ),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.grey[400],
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Tambah Pembayaran Baru',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _buildFieldLabel('Siswa'),
                  _buildDropdownBox<int>(
                    value: selectedSiswaId,
                    hint: 'Pilih siswa',
                    items: _siswaList.map((siswa) {
                      return DropdownMenuItem<int>(
                        value: siswa['id'] as int,
                        child: Text(
                          '${siswa['nama']} - ${siswa['kelas'] ?? '-'}',
                          style: const TextStyle(fontSize: 13),
                        ),
                      );
                    }).toList(),
                    onChanged: (value) {
                      final siswa = _siswaList.firstWhere((item) => item['id'] == value);
                      setModalState(() {
                        selectedSiswaId = value;
                        selectedWaliName = _waliNameFromSiswa(siswa);
                      });
                    },
                  ),
                  const SizedBox(height: 14),
                  _buildFieldLabel('Atas Nama'),
                  _buildReadOnlyField(selectedWaliName.isEmpty ? 'Nama wali akan terisi otomatis' : selectedWaliName),
                  const SizedBox(height: 14),
                  _buildFieldLabel('Tipe Pembayaran'),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: activePaymentTypes.map((type) {
                      final isSelected = selectedPaymentTypeId == type['id'];
                      final color = _getJenisColor(type['nama']?.toString() ?? '');
                      return GestureDetector(
                        onTap: () {
                          setModalState(() {
                            selectedPaymentTypeId = type['id'] as int;
                            nominalController.text =
                                (type['nominal_default'] ?? 0).toString();
                            final methods = List<String>.from(
                              type['metode_pembayaran'] ?? [],
                            );
                            selectedVia = methods.isNotEmpty ? methods.first : '';
                          });
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: isSelected ? color : Colors.white,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            type['nama']?.toString() ?? '-',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: isSelected ? Colors.white : color,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  if (activePaymentTypes.isEmpty) ...[
                    const SizedBox(height: 8),
                    const Text(
                      'Belum ada tipe pembayaran aktif. Tambahkan dulu dari tab Tipe Bayar.',
                      style: TextStyle(
                        fontSize: 11,
                        color: Color(0xFFE65100),
                      ),
                    ),
                  ],
                  const SizedBox(height: 14),
                  _buildFieldLabel('Nominal (Rp)'),
                  TextField(
                    controller: nominalController,
                    keyboardType: TextInputType.number,
                    decoration: _inputDecoration(hint: '350000', prefixText: 'Rp '),
                  ),
                  const SizedBox(height: 14),
                  _buildFieldLabel('Metode Pembayaran'),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: selectedMethods.map((method) {
                      final isSelected = selectedVia == method;
                      final color = _getViaColor(method);
                      return GestureDetector(
                        onTap: () => setModalState(() => selectedVia = method),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: isSelected ? color : Colors.white,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                _getViaIcon(method),
                                size: 14,
                                color: isSelected ? Colors.white : color,
                              ),
                              const SizedBox(width: 4),
                              Text(
                                method,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: isSelected ? Colors.white : color,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 14),
                  _buildFieldLabel('Tanggal'),
                  GestureDetector(
                    onTap: () async {
                      final date = await showDatePicker(
                        context: ctx,
                        initialDate: selectedDate,
                        firstDate: DateTime(2024),
                        lastDate: DateTime(2035),
                      );
                      if (date != null) {
                        setModalState(() => selectedDate = date);
                      }
                    },
                    child: _buildReadOnlyField(
                      '${selectedDate.day}/${selectedDate.month}/${selectedDate.year}',
                      icon: Icons.calendar_today_rounded,
                    ),
                  ),
                  const SizedBox(height: 14),
                  _buildFieldLabel('Status'),
                  Row(
                    children: ['Lunas', 'Belum Lunas', 'Menunggu'].map((status) {
                      final isSelected = selectedStatus == status;
                      final color = _getStatusColor(status);
                      return Expanded(
                        child: GestureDetector(
                          onTap: () => setModalState(() => selectedStatus = status),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            margin: const EdgeInsets.symmetric(horizontal: 3),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: isSelected ? color : Colors.white,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Center(
                              child: Text(
                                status,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: isSelected ? Colors.white : color,
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 14),
                  _buildFieldLabel('Keterangan'),
                  TextField(
                    controller: keteranganController,
                    maxLines: 2,
                    decoration: _inputDecoration(hint: 'Catatan opsional...'),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: isSaving
                          ? null
                          : () async {
                              final nominal = int.tryParse(nominalController.text);
                              if (selectedSiswaId == null ||
                                  selectedPaymentTypeId == null ||
                                  nominal == null ||
                                  nominal <= 0 ||
                                  selectedVia.isEmpty) {
                                _showSnack(
                                  'Lengkapi siswa, tipe pembayaran, nominal, dan metode.',
                                  isError: true,
                                );
                                return;
                              }

                              setModalState(() => isSaving = true);
                              try {
                                await ApiService.createPembayaran({
                                  'siswa_id': selectedSiswaId,
                                  'payment_type_id': selectedPaymentTypeId,
                                  'atas_nama': selectedWaliName,
                                  'via': selectedVia,
                                  'jumlah': nominal,
                                  'tanggal': _formatDate(selectedDate),
                                  'status': selectedStatus,
                                  'keterangan': keteranganController.text.trim(),
                                });
                                if (ctx.mounted) Navigator.pop(ctx);
                                await _loadData(forceRefresh: true);
                                _showSnack('Pembayaran berhasil disimpan.');
                              } catch (e) {
                                setModalState(() => isSaving = false);
                                _showSnack('Gagal menyimpan pembayaran: $e', isError: true);
                              }
                            },
                      icon: isSaving
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.check_circle_rounded, size: 20),
                      label: Text(
                        isSaving ? 'Menyimpan...' : 'Simpan Pembayaran',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF138F81),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        elevation: 0,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _showPaymentTypeDialog({Map<String, dynamic>? paymentType}) {
    final namaController = TextEditingController(
      text: paymentType?['nama']?.toString() ?? '',
    );
    final deskripsiController = TextEditingController(
      text: paymentType?['deskripsi']?.toString() ?? '',
    );
    final nominalController = TextEditingController(
      text: (paymentType?['nominal_default'] ?? '').toString(),
    );
    var selectedPeriode = paymentType?['periode']?.toString() ?? 'bulanan';
    var selectedStatus = paymentType?['status']?.toString() ?? 'Aktif';
    final selectedMethods = List<String>.from(
      paymentType?['metode_pembayaran'] ?? const [],
    );
    var isSaving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          return Container(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(ctx).size.height * 0.9,
            ),
            padding: EdgeInsets.fromLTRB(
              24,
              20,
              24,
              MediaQuery.of(ctx).viewInsets.bottom + 24,
            ),
            decoration: const BoxDecoration(
              color: Color(0xFFE1EFF7),
              borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
            ),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.grey[400],
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    paymentType == null
                        ? 'Tambah Tipe Pembayaran'
                        : 'Edit Tipe Pembayaran',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _buildFieldLabel('Nama Tipe Pembayaran'),
                  TextField(
                    controller: namaController,
                    decoration: _inputDecoration(hint: 'Contoh: Kitab Tahunan'),
                  ),
                  const SizedBox(height: 14),
                  _buildFieldLabel('Deskripsi'),
                  TextField(
                    controller: deskripsiController,
                    maxLines: 2,
                    decoration: _inputDecoration(hint: 'Penjelasan singkat tagihan'),
                  ),
                  const SizedBox(height: 14),
                  _buildFieldLabel('Nominal Default'),
                  TextField(
                    controller: nominalController,
                    keyboardType: TextInputType.number,
                    decoration: _inputDecoration(hint: '250000', prefixText: 'Rp '),
                  ),
                  const SizedBox(height: 14),
                  _buildFieldLabel('Periode Pembayaran'),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: const ['sekali', 'bulanan', 'tahunan'].map((period) {
                      return period;
                    }).map((period) {
                      final isSelected = selectedPeriode == period;
                      return GestureDetector(
                        onTap: () => setModalState(() => selectedPeriode = period),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: isSelected
                                ? const Color(0xFFE65100)
                                : Colors.white,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            period[0].toUpperCase() + period.substring(1),
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: isSelected
                                  ? Colors.white
                                  : const Color(0xFFE65100),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 14),
                  _buildFieldLabel('Metode Pembayaran Didukung'),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: _allPaymentMethods.map((method) {
                      final isSelected = selectedMethods.contains(method);
                      final color = _getViaColor(method);
                      return GestureDetector(
                        onTap: () {
                          setModalState(() {
                            if (isSelected) {
                              selectedMethods.remove(method);
                            } else {
                              selectedMethods.add(method);
                            }
                          });
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: isSelected ? color : Colors.white,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Text(
                            method,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: isSelected ? Colors.white : color,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 14),
                  _buildFieldLabel('Status'),
                  Row(
                    children: ['Aktif', 'Nonaktif'].map((status) {
                      final isSelected = selectedStatus == status;
                      final color = status == 'Aktif'
                          ? const Color(0xFF138F81)
                          : const Color(0xFFE65100);
                      return Expanded(
                        child: GestureDetector(
                          onTap: () => setModalState(() => selectedStatus = status),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 180),
                            margin: const EdgeInsets.symmetric(horizontal: 3),
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            decoration: BoxDecoration(
                              color: isSelected ? color : Colors.white,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Center(
                              child: Text(
                                status,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: isSelected ? Colors.white : color,
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: isSaving
                          ? null
                          : () async {
                              final nominal = int.tryParse(nominalController.text);
                              if (namaController.text.trim().isEmpty ||
                                  nominal == null ||
                                  selectedMethods.isEmpty) {
                                _showSnack(
                                  'Lengkapi nama, nominal, dan metode pembayaran.',
                                  isError: true,
                                );
                                return;
                              }

                              setModalState(() => isSaving = true);
                              final payload = {
                                'nama': namaController.text.trim(),
                                'deskripsi': deskripsiController.text.trim(),
                                'nominal_default': nominal,
                                'periode': selectedPeriode,
                                'metode_pembayaran': selectedMethods,
                                'status': selectedStatus,
                              };

                              try {
                                if (paymentType == null) {
                                  await ApiService.createPaymentType(payload);
                                } else {
                                  await ApiService.updatePaymentType(
                                    paymentType['id'] as int,
                                    payload,
                                  );
                                }
                                if (ctx.mounted) Navigator.pop(ctx);
                                await _loadData(forceRefresh: true);
                                _showSnack(
                                  paymentType == null
                                      ? 'Tipe pembayaran berhasil ditambahkan.'
                                      : 'Tipe pembayaran berhasil diperbarui.',
                                );
                              } catch (e) {
                                setModalState(() => isSaving = false);
                                _showSnack('Gagal menyimpan tipe pembayaran: $e', isError: true);
                              }
                            },
                      icon: isSaving
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Icon(
                              paymentType == null
                                  ? Icons.add_card_rounded
                                  : Icons.save_rounded,
                            ),
                      label: Text(
                        isSaving
                            ? 'Menyimpan...'
                            : paymentType == null
                            ? 'Simpan Tipe Pembayaran'
                            : 'Simpan Perubahan',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFE65100),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Future<void> _confirmDeletePaymentType(Map<String, dynamic> paymentType) async {
    if (_isOfflineMode) {
      _showOfflineActionMessage();
      return;
    }

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Hapus Tipe Pembayaran',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        content: Text(
          'Hapus tipe pembayaran "${paymentType['nama']}"? Tipe yang sudah dipakai transaksi bisa ditolak backend.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Batal'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFE65100),
            ),
            child: const Text(
              'Hapus',
              style: TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      await ApiService.deletePaymentType(paymentType['id'] as int);
      await _loadData(forceRefresh: true);
      _showSnack('Tipe pembayaran berhasil dihapus.');
    } catch (e) {
      _showSnack('Gagal menghapus tipe pembayaran: $e', isError: true);
    }
  }

  Future<void> _togglePaymentTypeStatus(Map<String, dynamic> paymentType) async {
    if (_isOfflineMode) {
      _showOfflineActionMessage();
      return;
    }

    final currentStatus = paymentType['status']?.toString() ?? 'Aktif';
    final newStatus = currentStatus == 'Aktif' ? 'Nonaktif' : 'Aktif';

    try {
      await ApiService.updatePaymentType(paymentType['id'] as int, {
        'status': newStatus,
      });
      await _loadData(forceRefresh: true);
      _showSnack('Status tipe pembayaran -> $newStatus');
    } catch (e) {
      _showSnack('Gagal mengubah status tipe pembayaran: $e', isError: true);
    }
  }

  Future<void> _confirmDeletePayment(int id, String name) async {
    if (_isOfflineMode) {
      _showOfflineActionMessage();
      return;
    }

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          'Hapus Pembayaran',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
        ),
        content: Text('Hapus pembayaran "$name"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Batal'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFE65100),
            ),
            child: const Text(
              'Hapus',
              style: TextStyle(color: Colors.white),
            ),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      await ApiService.deletePembayaran(id);
      await _loadData(forceRefresh: true);
      _showSnack('Pembayaran berhasil dihapus.');
    } catch (e) {
      _showSnack('Gagal menghapus pembayaran: $e', isError: true);
    }
  }

  InputDecoration _inputDecoration({String? hint, String? prefixText}) {
    return InputDecoration(
      hintText: hint,
      prefixText: prefixText,
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide.none,
      ),
    );
  }

  Widget _buildFieldLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: Color(0xFF636E72),
        ),
      ),
    );
  }

  Widget _buildReadOnlyField(String value, {IconData? icon}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          if (icon != null) ...[
            Icon(icon, size: 16, color: const Color(0xFF138F81)),
            const SizedBox(width: 10),
          ],
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: Color(0xFF2D3436),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDropdownBox<T>({
    required T? value,
    required String hint,
    required List<DropdownMenuItem<T>> items,
    required ValueChanged<T?> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          isExpanded: true,
          value: value,
          hint: Text(hint),
          items: items,
          onChanged: onChanged,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showQuickActions,
        backgroundColor: const Color(0xFF138F81),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text(
          'Tambah Data',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      body: SafeArea(
        child: FadeTransition(
          opacity: _fadeIn,
          child: Column(
            children: [
              _buildProfileBar(),
              const SizedBox(height: 12),
              _buildCreditCard(),
              const SizedBox(height: 12),
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFFE1EFF7),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: TabBar(
                  controller: _tabController,
                  indicator: BoxDecoration(
                    color: const Color(0xFF138F81),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  labelColor: Colors.white,
                  unselectedLabelColor: const Color(0xFF636E72),
                  labelStyle: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                  tabs: const [
                    Tab(text: 'Hari Ini'),
                    Tab(text: 'Riwayat'),
                    Tab(text: 'Tipe Bayar'),
                  ],
                ),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: _isLoading
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: Color(0xFF138F81),
                        ),
                      )
                    : _errorMessage != null
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.wifi_off_rounded,
                              size: 46,
                              color: Color(0xFFE65100),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              _errorMessage!,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 13,
                                color: Color(0xFF636E72),
                              ),
                            ),
                            const SizedBox(height: 16),
                            ElevatedButton.icon(
                              onPressed: () => _loadData(forceRefresh: true),
                              icon: const Icon(Icons.refresh_rounded),
                              label: const Text('Coba Lagi'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF138F81),
                                foregroundColor: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      )
                    : TabBarView(
                        controller: _tabController,
                        children: [
                          _buildPaymentList(
                            _pembayaranHariIni,
                            'Belum ada pembayaran hari ini',
                          ),
                          _buildPaymentList(
                            _allPembayaran,
                            'Belum ada riwayat pembayaran',
                          ),
                          _buildPaymentTypeList(),
                        ],
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProfileBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFE1EFF7),
          borderRadius: BorderRadius.circular(25),
        ),
        child: Row(
          children: [
            Container(
              width: 50,
              height: 50,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: Color(0xFFFFDC80),
              ),
              child: const Icon(
                Icons.account_balance_wallet_rounded,
                color: Color(0xFFE65100),
                size: 28,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Expanded(
                        child: Text(
                          'Keuangan',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF2D3436),
                          ),
                        ),
                      ),
                      if (_isOfflineMode)
                        _statusBadge('Offline', const Color(0xFFE65100)),
                      if (_isSyncing && !_isLoading) ...[
                        const SizedBox(width: 6),
                        _statusBadge('Sync', const Color(0xFF138F81)),
                      ],
                    ],
                  ),
                  Text(
                    '$_jumlahTransaksiHariIni transaksi hari ini',
                    style: const TextStyle(
                      fontSize: 11,
                      color: Color(0xFF636E72),
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: () => Navigator.pop(context),
              icon: const Icon(Icons.close_rounded, size: 22),
            ),
          ],
        ),
      ),
    );
  }

  Widget _statusBadge(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 8,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }

  Widget _buildCreditCard() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF138F81), Color(0xFF0984E3), Color(0xFF6C5CE7)],
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(Icons.credit_card_rounded, color: Colors.white, size: 18),
                    SizedBox(width: 8),
                    Text(
                      'Total Masuk Hari Ini',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: Colors.white70,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 16),
            Text(
              _formatRupiah(_totalHariIni),
              style: const TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w800,
                color: Colors.white,
                letterSpacing: 1,
              ),
            ),
            const SizedBox(height: 14),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'PENERIMA',
                      style: TextStyle(
                        fontSize: 8,
                        fontWeight: FontWeight.w600,
                        color: Colors.white.withValues(alpha: 0.6),
                        letterSpacing: 1,
                      ),
                    ),
                    const SizedBox(height: 2),
                    const Text(
                      'Madrasah Diniyah Qomaruddin',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'TRANSAKSI',
                      style: TextStyle(
                        fontSize: 8,
                        fontWeight: FontWeight.w600,
                        color: Colors.white.withValues(alpha: 0.6),
                        letterSpacing: 1,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '$_jumlahTransaksiHariIni Siswa',
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPaymentList(List<Map<String, dynamic>> list, String emptyMessage) {
    if (list.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.receipt_long_rounded,
              size: 48,
              color: Color(0xFF636E72),
            ),
            const SizedBox(height: 12),
            Text(
              emptyMessage,
              style: const TextStyle(fontSize: 14, color: Color(0xFF636E72)),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => _loadData(forceRefresh: true),
      color: const Color(0xFF138F81),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        itemCount: list.length,
        itemBuilder: (context, index) => _buildPaymentItem(list[index], index),
      ),
    );
  }

  Widget _buildPaymentItem(Map<String, dynamic> payment, int index) {
    final siswa = payment['siswa'] is Map
        ? Map<String, dynamic>.from(payment['siswa'] as Map)
        : null;
    final wali = payment['wali'] is Map
        ? Map<String, dynamic>.from(payment['wali'] as Map)
        : null;
    final name = siswa?['nama']?.toString() ?? payment['atas_nama']?.toString() ?? '-';
    final atasNama = wali?['name']?.toString() ?? payment['atas_nama']?.toString() ?? '-';
    final jenis = _paymentDisplayName(payment);
    final via = payment['via']?.toString() ?? '-';
    final jumlah = payment['jumlah'] is int ? payment['jumlah'] as int : 0;
    final tanggal = payment['tanggal']?.toString() ?? '';
    final status = payment['status']?.toString() ?? 'Lunas';
    final keterangan = payment['keterangan']?.toString() ?? '';
    final jenisColor = _getJenisColor(jenis);
    final viaColor = _getViaColor(via);
    final statusColor = _getStatusColor(status);
    final paymentType = _extractPaymentType(payment);

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: Duration(milliseconds: 350 + (index * 60)),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, 18 * (1 - value)),
            child: child,
          ),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          children: [
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: jenisColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Center(
                    child: Text(
                      name.isNotEmpty ? name[0].toUpperCase() : 'S',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: jenisColor,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        name,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF2D3436),
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        'a.n $atasNama',
                        style: const TextStyle(
                          fontSize: 10,
                          color: Color(0xFF636E72),
                        ),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      _formatRupiah(jumlah),
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: statusColor,
                      ),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      tanggal,
                      style: const TextStyle(
                        fontSize: 9,
                        color: Color(0xFF636E72),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                _smallChip(jenis, jenisColor),
                const SizedBox(width: 6),
                _smallChip(via, viaColor, icon: _getViaIcon(via)),
                if (paymentType != null) ...[
                  const SizedBox(width: 6),
                  _smallChip(
                    paymentType['periode']?.toString() ?? '-',
                    const Color(0xFF6C5CE7),
                  ),
                ],
                const Spacer(),
                _smallChip(status, statusColor),
                if (payment['id'] != null) ...[
                  const SizedBox(width: 6),
                  GestureDetector(
                    onTap: () => _confirmDeletePayment(
                      payment['id'] as int,
                      name,
                    ),
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE65100).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Icon(
                        Icons.delete_outline_rounded,
                        size: 14,
                        color: Color(0xFFE65100),
                      ),
                    ),
                  ),
                ],
              ],
            ),
            if (keterangan.isNotEmpty) ...[
              const SizedBox(height: 6),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFF5F5F5),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  keterangan,
                  style: const TextStyle(
                    fontSize: 10,
                    color: Color(0xFF636E72),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildPaymentTypeList() {
    if (_paymentTypes.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.wallet_outlined,
              size: 48,
              color: Color(0xFF636E72),
            ),
            const SizedBox(height: 12),
            const Text(
              'Belum ada tipe pembayaran',
              style: TextStyle(fontSize: 14, color: Color(0xFF636E72)),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: () => _loadData(forceRefresh: true),
      color: const Color(0xFF138F81),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        itemCount: _paymentTypes.length,
        itemBuilder: (context, index) {
          final type = _paymentTypes[index];
          final color = _getJenisColor(type['nama']?.toString() ?? '');
          final methods = List<String>.from(type['metode_pembayaran'] ?? []);
          final status = type['status']?.toString() ?? 'Aktif';
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(
                        Icons.wallet_rounded,
                        color: color,
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            type['nama']?.toString() ?? '-',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF2D3436),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            type['deskripsi']?.toString().isNotEmpty == true
                                ? type['deskripsi'].toString()
                                : 'Master tagihan pembayaran',
                            style: const TextStyle(
                              fontSize: 10,
                              color: Color(0xFF636E72),
                            ),
                          ),
                        ],
                      ),
                    ),
                    _smallChip(
                      status,
                      status == 'Aktif'
                          ? const Color(0xFF138F81)
                          : const Color(0xFFE65100),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    _smallChip(
                      _formatRupiah(type['nominal_default'] ?? 0),
                      const Color(0xFF138F81),
                    ),
                    _smallChip(
                      type['periode']?.toString() ?? '-',
                      const Color(0xFF6C5CE7),
                    ),
                    ...methods.map((method) => _smallChip(method, _getViaColor(method))),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _actionButton(
                        label: 'Edit',
                        icon: Icons.edit_rounded,
                        color: const Color(0xFF2E86DE),
                        onTap: () => _showPaymentTypeDialog(paymentType: type),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _actionButton(
                        label: status == 'Aktif' ? 'Nonaktifkan' : 'Aktifkan',
                        icon: status == 'Aktif'
                            ? Icons.toggle_off_rounded
                            : Icons.toggle_on_rounded,
                        color: status == 'Aktif'
                            ? const Color(0xFFE65100)
                            : const Color(0xFF138F81),
                        onTap: () => _togglePaymentTypeStatus(type),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _actionButton(
                        label: 'Hapus',
                        icon: Icons.delete_rounded,
                        color: const Color(0xFFE65100),
                        onTap: () => _confirmDeletePaymentType(type),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _smallChip(String text, Color color, {IconData? icon}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 10, color: color),
            const SizedBox(width: 3),
          ],
          Text(
            text,
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionButton({
    required String label,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 9),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
