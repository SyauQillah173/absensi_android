import 'dart:async';

import 'package:flutter/material.dart';
import 'package:connectivity_plus/connectivity_plus.dart';

import '../../services/api_service.dart';
import '../../services/cache_service.dart';
import '../../services/payment_security_service.dart';
import '../../services/pembayaran_export_service.dart';
import '../../services/session_service.dart';
import '../../services/sync_service.dart';
import '../../widgets/app_feedback.dart';
import '../../widgets/billing_summary_view.dart';
import 'payment_security_settings_screen.dart';

class PembayaranScreen extends StatefulWidget {
  const PembayaranScreen({super.key});

  @override
  State<PembayaranScreen> createState() => _PembayaranScreenState();
}

class _PembayaranScreenState extends State<PembayaranScreen>
    with TickerProviderStateMixin, WidgetsBindingObserver {
  static const _cacheToday = 'pembayaran_today';
  static const _cacheAll = 'pembayaran_all';
  static const _cacheTypes = 'payment_types_all';
  static const _cacheSiswa = 'pembayaran_siswa_with_wali';
  static const _cacheMethods = 'payment_methods_all';
  static const _cachePeriods = 'payment_period_types_all';

  static const List<String> _fallbackPaymentMethods = [
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
  final TextEditingController _billingSearchController =
      TextEditingController();
  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;

  bool _isLoading = true;
  bool _isOfflineMode = false;
  bool _isSyncing = false;
  bool _loadInFlight = false;
  String? _errorMessage;
  String? _offlineReason;

  List<Map<String, dynamic>> _pembayaranHariIni = [];
  List<Map<String, dynamic>> _allPembayaran = [];
  List<Map<String, dynamic>> _paymentTypes = [];
  List<Map<String, dynamic>> _paymentMethodRows = [];
  List<Map<String, dynamic>> _paymentPeriodTypes = [];
  List<Map<String, dynamic>> _academicPeriods = [];
  List<String> _paymentMethods = List<String>.from(_fallbackPaymentMethods);
  List<Map<String, dynamic>> _siswaList = [];
  Map<String, dynamic>? _activeAcademicPeriod;
  Map<String, dynamic>? _studentBillingSummary;
  Map<String, dynamic>? _paymentSecuritySetting;

  int _totalHariIni = 0;
  int _jumlahTransaksiHariIni = 0;
  int _userId = 0;
  String _userRole = '';
  final Set<int> _paymentTypeStatusPending = <int>{};
  final Set<int> _paymentTypeDeletePending = <int>{};
  final Set<String> _paymentDeletePendingKeys = <String>{};
  int _paymentSettingsTab = 0;
  int? _billingSiswaId;
  int? _billingAcademicYearId;
  int? _billingSemesterId;
  int? _billingPaymentTypeId;
  String _billingStatus = 'Semua';
  bool _isBillingLoading = false;
  String? _billingError;

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
    _tabController = TabController(length: 4, vsync: this);
    _animController.forward();
    WidgetsBinding.instance.addObserver(this);
    _connectivitySubscription = Connectivity().onConnectivityChanged.listen(
      _handleConnectivityChanged,
    );
    _loadData();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _connectivitySubscription?.cancel();
    _billingSearchController.dispose();
    _animController.dispose();
    _tabController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _loadData(forceRefresh: true);
    }
  }

  void _handleConnectivityChanged(List<ConnectivityResult> results) {
    final hasConnection = results.any(
      (result) => result != ConnectivityResult.none,
    );
    if (hasConnection) {
      _loadData(forceRefresh: true);
      return;
    }

    if (!mounted) return;
    setState(() {
      _isOfflineMode = true;
      _isSyncing = false;
      _offlineReason =
          'Perangkat sedang tidak terhubung internet. Menampilkan cache pembayaran terakhir.';
    });
  }

  Future<void> _loadData({bool forceRefresh = false}) async {
    if (!mounted) return;
    if (_loadInFlight) return;
    _loadInFlight = true;

    try {
      _userId = await SessionService.getUserId();
      _userRole = await SessionService.getUserRole();
      _paymentSecuritySetting = await PaymentSecurityService.getCachedSetting(
        _userId,
      );

      setState(() {
        _isLoading =
            _pembayaranHariIni.isEmpty &&
            _allPembayaran.isEmpty &&
            _paymentTypes.isEmpty;
        _isSyncing = true;
        _errorMessage = null;
      });

      if (!forceRefresh || _allPembayaran.isEmpty) {
        await _loadCachedData(markOffline: false);
      }

      if (!await _hasNetworkConnection()) {
        if (_pembayaranHariIni.isEmpty && _allPembayaran.isEmpty) {
          await _loadCachedData(
            markOffline: true,
            reason:
                'Perangkat sedang tidak terhubung internet. Menampilkan cache pembayaran terakhir.',
          );
        }
        if (!mounted) return;
        setState(() {
          _isLoading = false;
          _isSyncing = false;
          _isOfflineMode = true;
          _offlineReason =
              'Perangkat sedang tidak terhubung internet. Menampilkan cache pembayaran terakhir.';
          _errorMessage = _allPembayaran.isEmpty && _pembayaranHariIni.isEmpty
              ? 'Data pembayaran belum bisa dimuat karena perangkat offline.'
              : null;
        });
        return;
      }

      final results = await Future.wait([
        _guardPaymentRequest(ApiService.getPembayaran()),
        _guardPaymentRequest(ApiService.getAllPembayaran()),
        _guardPaymentRequest(ApiService.getPaymentTypes()),
        _guardPaymentRequest(ApiService.getSiswa(withWali: true)),
        _guardPaymentRequest(ApiService.getPaymentMethods()),
        _guardPaymentRequest(ApiService.getPaymentPeriodTypes()),
        _guardPaymentRequest(ApiService.getAcademicPeriods()),
      ]);

      final todayResult = results[0];
      final allResult = results[1];
      final typesResult = results[2];
      final siswaResult = results[3];
      final methodsResult = results[4];
      final periodsResult = results[5];
      final academicPeriodsResult = results[6];

      final paymentEndpointOnline =
          todayResult.isSuccess || allResult.isSuccess;

      if (todayResult.isSuccess) {
        await CacheService.save(_cacheToday, todayResult.data!);
      }
      if (allResult.isSuccess) {
        await CacheService.save(_cacheAll, allResult.data!);
      }
      if (typesResult.isSuccess) {
        await CacheService.save(_cacheTypes, typesResult.data!);
      }
      if (siswaResult.isSuccess) {
        await CacheService.save(_cacheSiswa, siswaResult.data!);
      }
      if (methodsResult.isSuccess) {
        await CacheService.save(_cacheMethods, methodsResult.data!);
      }
      if (periodsResult.isSuccess) {
        await CacheService.save(_cachePeriods, periodsResult.data!);
      }

      if (_userRole == 'admin' && paymentEndpointOnline) {
        try {
          final securityResult = await ApiService.getPaymentSecuritySettings(
            _userId,
          );
          _paymentSecuritySetting = Map<String, dynamic>.from(
            securityResult['data'] ?? const {},
          );
          await PaymentSecurityService.cacheSetting(
            _userId,
            _paymentSecuritySetting!,
          );
        } catch (_) {}
      }

      final offlineReason = paymentEndpointOnline
          ? null
          : 'Endpoint pembayaran belum bisa dijangkau: ${todayResult.error ?? allResult.error ?? 'request pembayaran gagal'}. Menampilkan cache terakhir.';

      if (!mounted) return;
      setState(() {
        _consumeData(
          todayResult: todayResult.data,
          allResult: allResult.data,
          typesResult: typesResult.data,
          siswaResult: siswaResult.data,
          methodsResult: methodsResult.data,
          periodsResult: periodsResult.data,
          academicPeriodsResult: academicPeriodsResult.data,
        );
        _isLoading = false;
        _isOfflineMode = !paymentEndpointOnline;
        _isSyncing = false;
        _offlineReason = offlineReason;
        _errorMessage =
            !paymentEndpointOnline &&
                _pembayaranHariIni.isEmpty &&
                _allPembayaran.isEmpty
            ? 'Data pembayaran belum bisa dimuat dari server.\n$offlineReason'
            : null;
      });
    } finally {
      _loadInFlight = false;
    }
  }

  Future<bool> _hasNetworkConnection() async {
    try {
      final results = await Connectivity().checkConnectivity();
      return results.any((result) => result != ConnectivityResult.none);
    } catch (_) {
      return true;
    }
  }

  Future<_PaymentRequestResult> _guardPaymentRequest(
    Future<Map<String, dynamic>> request,
  ) async {
    try {
      return _PaymentRequestResult.success(await request);
    } catch (e) {
      return _PaymentRequestResult.failure(e.toString());
    }
  }

  Future<void> _loadCachedData({
    bool markOffline = true,
    String? reason,
  }) async {
    final todayCached = await CacheService.get(_cacheToday);
    final allCached = await CacheService.get(_cacheAll);
    final typeCached = await CacheService.get(_cacheTypes);
    final siswaCached = await CacheService.get(_cacheSiswa);
    final methodsCached = await CacheService.get(_cacheMethods);
    final periodsCached = await CacheService.get(_cachePeriods);

    if (!mounted) return;

    if (todayCached is Map<String, dynamic> ||
        allCached is Map<String, dynamic> ||
        typeCached is Map<String, dynamic> ||
        siswaCached is Map<String, dynamic> ||
        methodsCached is Map<String, dynamic> ||
        periodsCached is Map<String, dynamic>) {
      setState(() {
        _consumeData(
          todayResult: todayCached is Map<String, dynamic> ? todayCached : null,
          allResult: allCached is Map<String, dynamic> ? allCached : null,
          typesResult: typeCached is Map<String, dynamic> ? typeCached : null,
          siswaResult: siswaCached is Map<String, dynamic> ? siswaCached : null,
          methodsResult: methodsCached is Map<String, dynamic>
              ? methodsCached
              : null,
          periodsResult: periodsCached is Map<String, dynamic>
              ? periodsCached
              : null,
        );
        _isLoading = false;
        if (markOffline) {
          _isOfflineMode = true;
          _offlineReason = reason ?? 'Menampilkan cache pembayaran terakhir.';
        }
      });
    }
  }

  void _consumeData({
    Map<String, dynamic>? todayResult,
    Map<String, dynamic>? allResult,
    Map<String, dynamic>? typesResult,
    Map<String, dynamic>? siswaResult,
    Map<String, dynamic>? methodsResult,
    Map<String, dynamic>? periodsResult,
    Map<String, dynamic>? academicPeriodsResult,
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
      _paymentTypes = List<Map<String, dynamic>>.from(
        typesResult['data'] ?? [],
      );
    }
    if (siswaResult != null) {
      _siswaList = List<Map<String, dynamic>>.from(siswaResult['data'] ?? []);
    }
    if (methodsResult != null) {
      final methods = List<Map<String, dynamic>>.from(
        methodsResult['data'] ?? [],
      );
      _paymentMethodRows = methods;
      final names = methods
          .where((item) => item['is_active'] != false)
          .map((item) => item['name']?.toString().trim() ?? '')
          .where((name) => name.isNotEmpty)
          .toList();
      if (names.isNotEmpty) {
        _paymentMethods = names;
      }
    }
    if (periodsResult != null) {
      _paymentPeriodTypes = List<Map<String, dynamic>>.from(
        periodsResult['data'] ?? [],
      );
    }
    if (academicPeriodsResult != null) {
      _academicPeriods = List<Map<String, dynamic>>.from(
        academicPeriodsResult['data'] ?? [],
      );
      _activeAcademicPeriod = academicPeriodsResult['active'] is Map
          ? Map<String, dynamic>.from(academicPeriodsResult['active'] as Map)
          : null;
      _billingAcademicYearId ??=
          (_activeAcademicPeriod?['academic_year_id'] as num?)?.toInt();
      _billingSemesterId ??= (_activeAcademicPeriod?['semester_id'] as num?)
          ?.toInt();
    }
  }

  void _upsertPaymentLocal(Map<String, dynamic> payment) {
    _upsertIntoPaymentList(_allPembayaran, payment);

    if (_isTodayPayment(payment)) {
      _upsertIntoPaymentList(_pembayaranHariIni, payment);
    }

    _sortPayments(_allPembayaran);
    _sortPayments(_pembayaranHariIni);
    _recalculateTodaySummary();
    _isOfflineMode = false;
    _offlineReason = null;
    _errorMessage = null;
  }

  void _upsertIntoPaymentList(
    List<Map<String, dynamic>> rows,
    Map<String, dynamic> payment,
  ) {
    final index = rows.indexWhere((row) => _samePaymentIdentity(row, payment));
    if (index >= 0) {
      rows[index] = payment;
      return;
    }
    rows.insert(0, payment);
  }

  bool _samePaymentIdentity(Map<String, dynamic> a, Map<String, dynamic> b) {
    final aTarget = a['delete_target'] is Map
        ? Map<String, dynamic>.from(a['delete_target'] as Map)
        : null;
    final bTarget = b['delete_target'] is Map
        ? Map<String, dynamic>.from(b['delete_target'] as Map)
        : null;

    if (aTarget != null && bTarget != null) {
      return aTarget['type']?.toString() == bTarget['type']?.toString() &&
          (aTarget['id'] as num?)?.toInt() == (bTarget['id'] as num?)?.toInt();
    }

    return a['source']?.toString() == b['source']?.toString() &&
        (a['id'] as num?)?.toInt() == (b['id'] as num?)?.toInt();
  }

  void _removePaymentLocal(Map<String, dynamic> deleteTarget) {
    _allPembayaran.removeWhere(
      (payment) => _matchesDeleteTarget(payment, deleteTarget),
    );
    _pembayaranHariIni.removeWhere(
      (payment) => _matchesDeleteTarget(payment, deleteTarget),
    );
    _recalculateTodaySummary();
    _isOfflineMode = false;
    _offlineReason = null;
    _errorMessage = null;
  }

  bool _matchesDeleteTarget(
    Map<String, dynamic> payment,
    Map<String, dynamic> deleteTarget,
  ) {
    final targetType = deleteTarget['type']?.toString() ?? 'legacy';
    final targetId = (deleteTarget['id'] as num?)?.toInt();
    if (targetId == null) return false;

    final rowTarget = payment['delete_target'] is Map
        ? Map<String, dynamic>.from(payment['delete_target'] as Map)
        : null;
    if (rowTarget != null) {
      return rowTarget['type']?.toString() == targetType &&
          (rowTarget['id'] as num?)?.toInt() == targetId;
    }

    if (targetType == 'transaction') {
      return (payment['transaction_id'] as num?)?.toInt() == targetId;
    }

    return payment['source']?.toString() == 'legacy' &&
        (payment['id'] as num?)?.toInt() == targetId;
  }

  String? _deleteTargetKey(Map<String, dynamic> deleteTarget) {
    final targetType = deleteTarget['type']?.toString() ?? 'legacy';
    final targetId = (deleteTarget['id'] as num?)?.toInt();
    if (targetId == null) return null;
    return '$targetType:$targetId';
  }

  bool _isTodayPayment(Map<String, dynamic> payment) {
    return payment['tanggal']?.toString() == _formatDate(DateTime.now());
  }

  void _sortPayments(List<Map<String, dynamic>> rows) {
    rows.sort((a, b) {
      final dateCompare = (b['tanggal']?.toString() ?? '').compareTo(
        a['tanggal']?.toString() ?? '',
      );
      if (dateCompare != 0) return dateCompare;

      final bTimestamp = (b['sort_timestamp'] as num?)?.toInt() ?? 0;
      final aTimestamp = (a['sort_timestamp'] as num?)?.toInt() ?? 0;
      if (bTimestamp != aTimestamp) return bTimestamp.compareTo(aTimestamp);

      return (b['created_at']?.toString() ?? '').compareTo(
        a['created_at']?.toString() ?? '',
      );
    });
  }

  void _recalculateTodaySummary() {
    _totalHariIni = _pembayaranHariIni.fold<int>(
      0,
      (sum, item) => sum + ((item['jumlah'] as num?)?.toInt() ?? 0),
    );
    _jumlahTransaksiHariIni = _pembayaranHariIni.length;
  }

  Future<void> _savePaymentCaches() async {
    await Future.wait([
      CacheService.save(_cacheToday, {
        'success': true,
        'total_hari_ini': _totalHariIni,
        'jumlah_transaksi': _jumlahTransaksiHariIni,
        'data': _pembayaranHariIni,
      }),
      CacheService.save(_cacheAll, {'success': true, 'data': _allPembayaran}),
    ]);
  }

  Future<void> _refreshPaymentRowsInBackground() async {
    if (_loadInFlight || !await _hasNetworkConnection()) return;

    try {
      final results = await Future.wait([
        _guardPaymentRequest(ApiService.getPembayaran()),
        _guardPaymentRequest(ApiService.getAllPembayaran()),
      ]);

      if (!mounted) return;
      final todayResult = results[0];
      final allResult = results[1];
      setState(() {
        _consumeData(todayResult: todayResult.data, allResult: allResult.data);
        _isOfflineMode = !(todayResult.isSuccess || allResult.isSuccess);
        _isSyncing = false;
      });

      if (todayResult.isSuccess) {
        await CacheService.save(_cacheToday, todayResult.data!);
      }
      if (allResult.isSuccess) {
        await CacheService.save(_cacheAll, allResult.data!);
      }
    } catch (_) {}
  }

  void _upsertPaymentTypeLocal(Map<String, dynamic> paymentType) {
    final id = (paymentType['id'] as num?)?.toInt();
    if (id == null) return;

    final index = _paymentTypes.indexWhere(
      (item) => (item['id'] as num?)?.toInt() == id,
    );
    if (index >= 0) {
      _paymentTypes[index] = paymentType;
    } else {
      _paymentTypes.insert(0, paymentType);
    }
    _paymentTypes.sort(
      (a, b) =>
          (a['nama']?.toString() ?? '').compareTo(b['nama']?.toString() ?? ''),
    );
  }

  List<Map<String, String>> _availablePaymentPeriods() {
    final source = _paymentPeriodTypes.isEmpty
        ? const [
            {'code': 'harian', 'name': 'Harian'},
            {'code': 'bulanan', 'name': 'Bulanan'},
            {'code': 'umum', 'name': 'Umum'},
            {'code': 'sekali', 'name': 'Sekali'},
            {'code': 'tahunan', 'name': 'Tahunan'},
          ]
        : _paymentPeriodTypes;

    return source
        .where((period) => period['is_active'] != false)
        .map((period) {
          final code = (period['code'] ?? period['name'] ?? '')
              .toString()
              .trim()
              .toLowerCase();
          final name = (period['name'] ?? period['code'] ?? '')
              .toString()
              .trim();
          return {'code': code, 'name': name.isEmpty ? code : name};
        })
        .where((period) => period['code']!.isNotEmpty)
        .toList();
  }

  Future<void> _savePaymentTypeCache() async {
    await CacheService.save(_cacheTypes, {
      'success': true,
      'data': _paymentTypes,
    });
  }

  Future<void> _refreshPaymentTypesInBackground() async {
    try {
      final result = await ApiService.getPaymentTypes();
      if (!mounted) return;
      setState(() {
        _consumeData(typesResult: result);
      });
      await CacheService.save(_cacheTypes, result);
    } catch (_) {}
  }

  void _upsertPaymentMethodLocal(Map<String, dynamic> method) {
    final id = (method['id'] as num?)?.toInt();
    if (id == null) return;
    final index = _paymentMethodRows.indexWhere(
      (item) => (item['id'] as num?)?.toInt() == id,
    );
    if (index >= 0) {
      _paymentMethodRows[index] = method;
    } else {
      _paymentMethodRows.add(method);
    }
    _paymentMethodRows.sort((a, b) {
      final orderCompare = ((a['sort_order'] as num?)?.toInt() ?? 100)
          .compareTo((b['sort_order'] as num?)?.toInt() ?? 100);
      if (orderCompare != 0) return orderCompare;
      return (a['name']?.toString() ?? '').compareTo(
        b['name']?.toString() ?? '',
      );
    });
    _paymentMethods = _paymentMethodRows
        .where((item) => item['is_active'] != false)
        .map((item) => item['name']?.toString().trim() ?? '')
        .where((name) => name.isNotEmpty)
        .toList();
  }

  void _upsertPaymentPeriodLocal(Map<String, dynamic> period) {
    final id = (period['id'] as num?)?.toInt();
    if (id == null) return;
    final index = _paymentPeriodTypes.indexWhere(
      (item) => (item['id'] as num?)?.toInt() == id,
    );
    if (index >= 0) {
      _paymentPeriodTypes[index] = period;
    } else {
      _paymentPeriodTypes.add(period);
    }
    _paymentPeriodTypes.sort((a, b) {
      final orderCompare = ((a['sort_order'] as num?)?.toInt() ?? 100)
          .compareTo((b['sort_order'] as num?)?.toInt() ?? 100);
      if (orderCompare != 0) return orderCompare;
      return (a['name']?.toString() ?? '').compareTo(
        b['name']?.toString() ?? '',
      );
    });
  }

  Future<void> _savePaymentMethodCache() async {
    await CacheService.save(_cacheMethods, {
      'success': true,
      'data': _paymentMethodRows,
    });
  }

  Future<void> _savePaymentPeriodCache() async {
    await CacheService.save(_cachePeriods, {
      'success': true,
      'data': _paymentPeriodTypes,
    });
  }

  Future<void> _refreshPaymentMethodsInBackground() async {
    try {
      final result = await ApiService.getPaymentMethods();
      if (!mounted) return;
      setState(() => _consumeData(methodsResult: result));
      await CacheService.save(_cacheMethods, result);
    } catch (_) {}
  }

  Future<void> _refreshPaymentPeriodsInBackground() async {
    try {
      final result = await ApiService.getPaymentPeriodTypes();
      if (!mounted) return;
      setState(() => _consumeData(periodsResult: result));
      await CacheService.save(_cachePeriods, result);
    } catch (_) {}
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
      _offlineReason ??
          'Mode offline hanya untuk melihat data terakhir. Sambungkan ke server untuk tambah atau ubah pembayaran.',
      isError: true,
    );
  }

  Future<void> _loadStudentBillingSummary() async {
    final siswaId = _billingSiswaId;
    if (siswaId == null || siswaId <= 0) {
      setState(() {
        _billingError = 'Pilih santri terlebih dahulu.';
      });
      return;
    }

    setState(() {
      _isBillingLoading = true;
      _billingError = null;
    });

    try {
      final result = await ApiService.getPaymentBillStudentSummary(
        siswaId: siswaId,
        academicYearId: _billingAcademicYearId,
        semesterId: _billingSemesterId,
        status: _billingStatus,
        paymentTypeId: _billingPaymentTypeId,
      );
      if (!mounted) return;
      setState(() {
        _studentBillingSummary = result['data'] is Map
            ? Map<String, dynamic>.from(result['data'] as Map)
            : null;
        _isBillingLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _billingError = 'Gagal memuat cek tagihan: $e';
        _isBillingLoading = false;
      });
    }
  }

  List<Map<String, dynamic>> _filteredBillingStudents([String? rawQuery]) {
    final query = (rawQuery ?? _billingSearchController.text)
        .trim()
        .toLowerCase();
    if (query.isEmpty) return _siswaList;

    return _siswaList.where((siswa) {
      final nama = siswa['nama']?.toString().toLowerCase() ?? '';
      final nis = siswa['nis']?.toString().toLowerCase() ?? '';
      final nisn = siswa['nisn']?.toString().toLowerCase() ?? '';
      final kelas = siswa['kelas']?.toString().toLowerCase() ?? '';
      return nama.contains(query) ||
          nis.contains(query) ||
          nisn.contains(query) ||
          kelas.contains(query);
    }).toList();
  }

  List<Map<String, dynamic>> _semesterOptionsForBillingYear() {
    final year = _academicPeriods.firstWhere(
      (item) => (item['id'] as num?)?.toInt() == _billingAcademicYearId,
      orElse: () => const <String, dynamic>{},
    );
    return List<Map<String, dynamic>>.from(year['semesters'] ?? const []);
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

  bool _isMonthlyPaymentType(Map<String, dynamic> type) {
    final periode = type['periode']?.toString().toLowerCase() ?? '';
    final nama = type['nama']?.toString().toLowerCase() ?? '';
    return periode.contains('bulan') ||
        periode == 'bulanan' ||
        nama.contains('spp') ||
        nama.contains('syahriyah');
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
    final rawItems = payment['payment_items'];
    if (rawItems is List && rawItems.isNotEmpty) {
      final itemNames = _paymentItemNames(payment);
      if (itemNames.isNotEmpty) {
        return itemNames.join(', ');
      }
    }
    return _fallbackPaymentDisplayName(payment);
  }

  String _fallbackPaymentDisplayName(Map<String, dynamic> payment) {
    final paymentType = _extractPaymentType(payment);
    final paymentTypeName = paymentType?['nama']?.toString().trim() ?? '';
    if (paymentTypeName.isNotEmpty) {
      return paymentTypeName;
    }

    final jenis = payment['jenis']?.toString().trim() ?? '';
    if (jenis.isNotEmpty) {
      return jenis;
    }

    return 'Pembayaran';
  }

  Map<String, dynamic>? _extractPaymentType(Map<String, dynamic> payment) {
    final raw = payment['payment_type'] ?? payment['paymentType'];
    if (raw is Map<String, dynamic>) return raw;
    if (raw is Map) return Map<String, dynamic>.from(raw);
    return null;
  }

  String _waliNameFromSiswa(Map<String, dynamic> siswa) {
    final wali = siswa['wali'];
    if (wali is Map &&
        wali['name'] != null &&
        wali['name'].toString().isNotEmpty) {
      return wali['name'].toString();
    }
    final fallback = siswa['nama_wali']?.toString() ?? '';
    return fallback;
  }

  List<Map<String, dynamic>> _extractPaymentItems(
    Map<String, dynamic> payment,
  ) {
    final raw = payment['payment_items'];
    if (raw is List) {
      return List<Map<String, dynamic>>.from(
        raw.map((item) => Map<String, dynamic>.from(item as Map)),
      );
    }

    final paymentType = _extractPaymentType(payment);
    return [
      {
        'payment_type_id': payment['payment_type_id'],
        'nama': _fallbackPaymentDisplayName(payment),
        'jumlah': payment['jumlah'] ?? 0,
        'status': payment['status'],
        'periode': paymentType?['periode']?.toString() ?? '-',
        'payment_type': paymentType,
      },
    ];
  }

  List<String> _paymentItemNames(Map<String, dynamic> payment) {
    return _extractPaymentItems(payment)
        .map((item) => item['nama']?.toString() ?? '')
        .where((name) => name.trim().isNotEmpty)
        .toList();
  }

  Future<void> _openPaymentSecuritySettings() async {
    final result = await Navigator.push<Map<String, dynamic>>(
      context,
      MaterialPageRoute(builder: (_) => const PaymentSecuritySettingsScreen()),
    );
    if (result != null && mounted) {
      setState(() {
        _paymentSecuritySetting = result;
      });
    }
  }

  Future<bool> _ensurePaymentSecurityReady() async {
    if (_userRole != 'admin') {
      return false;
    }

    return true;
  }

  Future<Map<String, dynamic>?> _authenticatePaymentBeforeSave() async {
    final setting = _paymentSecuritySetting;
    final biometricIsConfigured = setting?['biometric_required'] == true;

    if (biometricIsConfigured) {
      final result = await PaymentSecurityService.verifyPayment(
        setting: setting!,
        reason:
            'Verifikasi biometrik perangkat admin diperlukan sebelum transaksi pembayaran disimpan.',
      );
      if (result['success'] == true) {
        return result;
      }

      _showSnack(
        result['message']?.toString() ??
            'Verifikasi biometrik gagal. Gunakan password admin jika biometrik perangkat tidak tersedia.',
        isError: true,
      );
    }

    return _promptAdminSecurityFallbackForPayment();
  }

  Future<Map<String, dynamic>?> _promptAdminSecurityFallbackForPayment() async {
    final pinEnabled = _paymentSecuritySetting?['pin_enabled'] == true;
    String secret = '';
    final result = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
          title: Text(
            pinEnabled ? 'Verifikasi PIN Transaksi' : 'Verifikasi Admin',
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                pinEnabled
                    ? 'Masukkan PIN transaksi admin untuk mengotorisasi pembayaran ini.'
                    : 'PIN transaksi belum diatur. Masukkan password admin sementara, lalu atur PIN di Keamanan Pembayaran.',
                style: const TextStyle(
                  fontSize: 12,
                  color: Color(0xFF636E72),
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                obscureText: true,
                autofocus: true,
                maxLength: pinEnabled ? 12 : null,
                keyboardType: pinEnabled
                    ? TextInputType.number
                    : TextInputType.visiblePassword,
                decoration: _inputDecoration(
                  hint: pinEnabled ? 'PIN transaksi' : 'Password admin',
                ).copyWith(counterText: ''),
                onChanged: (value) => secret = value,
                onSubmitted: (_) => Navigator.pop(dialogContext, secret),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Batal'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(dialogContext, secret),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF138F81),
                foregroundColor: Colors.white,
              ),
              child: const Text('Verifikasi'),
            ),
          ],
        );
      },
    );

    if (result == null || result.trim().isEmpty) {
      _showSnack(
        pinEnabled
            ? 'PIN transaksi wajib diisi untuk menyimpan pembayaran.'
            : 'Password admin wajib diisi untuk menyimpan pembayaran.',
        isError: true,
      );
      return null;
    }

    return {
      'verified_at': DateTime.now().toIso8601String(),
      'method': pinEnabled ? 'admin_pin' : 'admin_password',
      'mode': pinEnabled ? 'admin_pin_fallback' : 'admin_password_fallback',
      'device_label': pinEnabled
          ? 'admin-pin-fallback'
          : 'admin-password-fallback',
      if (pinEnabled)
        'payment_security_pin': result.trim()
      else
        'payment_security_password': result,
    };
  }

  Future<void> _showQuickActions() async {
    if (_isOfflineMode) {
      _showOfflineActionMessage();
      return;
    }

    final action = await showModalBottomSheet<String>(
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
              onTap: () => Navigator.pop(ctx, 'payment'),
            ),
            if (_userRole == 'admin')
              _buildSheetAction(
                icon: Icons.shield_rounded,
                color: const Color(0xFF2E86DE),
                title: 'Keamanan Pembayaran',
                subtitle:
                    'Atur biometrik perangkat. Jika tidak tersedia, pembayaran dikunci password admin.',
                onTap: () => Navigator.pop(ctx, 'security'),
              ),
            _buildSheetAction(
              icon: Icons.wallet_rounded,
              color: const Color(0xFFE65100),
              title: 'Tambah Tipe Pembayaran',
              subtitle:
                  'Buat master tagihan baru untuk wali dan transaksi berikutnya.',
              onTap: () => Navigator.pop(ctx, 'type'),
            ),
            _buildSheetAction(
              icon: Icons.account_balance_wallet_rounded,
              color: const Color(0xFF138F81),
              title: 'Tambah Metode Pembayaran',
              subtitle:
                  'Atur metode aktif seperti bank, tunai, QRIS, atau e-wallet.',
              onTap: () => Navigator.pop(ctx, 'method'),
            ),
            _buildSheetAction(
              icon: Icons.calendar_month_rounded,
              color: const Color(0xFF2E86DE),
              title: 'Tambah Periode Pembayaran',
              subtitle:
                  'Atur bulanan Jan-Des, semester, umum, dan jatuh tempo.',
              onTap: () => Navigator.pop(ctx, 'period'),
            ),
            if (_userRole == 'admin')
              _buildSheetAction(
                icon: Icons.table_view_rounded,
                color: const Color(0xFF2E86DE),
                title: 'Rekap Pembayaran Excel',
                subtitle:
                    'Unduh rekap seluruh pembayaran siswa untuk administrasi.',
                onTap: () => Navigator.pop(ctx, 'export'),
              ),
          ],
        ),
      ),
    );
    if (!mounted || action == null) return;

    switch (action) {
      case 'payment':
        if (await _ensurePaymentSecurityReady()) {
          await _showAddPembayaranDialog();
        }
        break;
      case 'security':
        _openPaymentSecuritySettings();
        break;
      case 'type':
        await _showPaymentTypeDialog();
        break;
      case 'method':
        await _showPaymentMethodDialog();
        break;
      case 'period':
        await _showPaymentPeriodDialog();
        break;
      case 'export':
        await _exportAllPaymentExcel();
        break;
    }
  }

  Future<void> _exportAllPaymentExcel() async {
    if (_userRole != 'admin') {
      _showSnack('Rekap Excel pembayaran hanya untuk admin.', isError: true);
      return;
    }

    try {
      final payload = await ApiService.getPembayaranRekapExport(
        userId: _userId,
      );
      final rows = List<Map<String, dynamic>>.from(payload['data'] ?? const []);
      if (rows.isEmpty) {
        _showSnack(
          'Belum ada transaksi pembayaran untuk direkap.',
          isError: true,
        );
        return;
      }

      await PembayaranExportService.exportAllPaymentsExcel(payload);
    } catch (e) {
      _showSnack('Gagal membuat rekap pembayaran: $e', isError: true);
    }
  }

  Future<void> _exportStudentPaymentPdf(int siswaId) async {
    try {
      final payload = await ApiService.getPembayaranStudentRekap(
        userId: _userId,
        siswaId: siswaId,
      );
      final rows = List<Map<String, dynamic>>.from(
        (payload['data'] as Map<String, dynamic>? ?? const {})['rows'] ??
            const [],
      );
      if (rows.isEmpty) {
        _showSnack(
          'Belum ada transaksi pembayaran untuk siswa ini.',
          isError: true,
        );
        return;
      }

      await PembayaranExportService.printStudentPaymentReport(payload);
    } catch (e) {
      _showSnack('Gagal membuat PDF pembayaran: $e', isError: true);
    }
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
            const Icon(Icons.chevron_right_rounded, color: Color(0xFF636E72)),
          ],
        ),
      ),
    );
  }

  Future<void> _showAddPembayaranDialog() async {
    final keteranganController = TextEditingController();
    final siswaSearchController = TextEditingController();
    int? selectedSiswaId;
    final selectedPaymentTypeIds = <int>{};
    final nominalControllers = <int, TextEditingController>{};
    final selectedMonthsByType = <int, Set<int>>{};
    final monthlyOptionsByType = <int, List<Map<String, dynamic>>>{};
    final monthlyLoadingTypes = <int>{};
    List<Map<String, dynamic>> modalSiswaList = List<Map<String, dynamic>>.from(
      _siswaList,
    );
    String selectedWaliName = '';
    String selectedVia = '';
    String selectedStatus = 'Lunas';
    String? siswaPeriodMessage;
    int? selectedAcademicYearId =
        (_activeAcademicPeriod?['academic_year_id'] as num?)?.toInt();
    int? selectedSemesterId = (_activeAcademicPeriod?['semester_id'] as num?)
        ?.toInt();
    DateTime selectedDate = DateTime.now();
    bool isSaving = false;
    bool isLoadingSiswa = false;
    bool sheetOpen = true;
    bool initialSiswaLoadRequested = false;
    Timer? siswaSearchDebounce;

    Future<void> loadSiswaForPeriod(
      StateSetter setModalState, {
      String search = '',
    }) async {
      if (selectedAcademicYearId == null) return;
      setModalState(() {
        isLoadingSiswa = true;
        siswaPeriodMessage = null;
      });
      try {
        final result = await ApiService.getSiswa(
          withWali: true,
          forPayment: true,
          search: search.trim().isEmpty ? null : search.trim(),
          academicYearId: selectedAcademicYearId,
          semesterId: selectedSemesterId,
        );
        if (!mounted || !sheetOpen) return;
        final rows = List<Map<String, dynamic>>.from(result['data'] ?? []);
        setModalState(() {
          modalSiswaList = rows;
          if (selectedSiswaId != null &&
              !rows.any((item) => item['id'] == selectedSiswaId)) {
            selectedSiswaId = null;
            selectedWaliName = '';
          }
          siswaPeriodMessage = rows.isEmpty
              ? 'Data santri belum tersedia di tahun ajaran ini. Silakan sinkronisasi data santri terlebih dahulu di Setting Akademik.'
              : null;
          isLoadingSiswa = false;
        });
      } catch (e) {
        if (!mounted || !sheetOpen) return;
        setModalState(() {
          isLoadingSiswa = false;
          siswaPeriodMessage = 'Gagal memuat santri periode ini: $e';
        });
      }
    }

    Future<void> loadMonthlyOptions(
      int typeId,
      StateSetter setModalState,
    ) async {
      if (selectedSiswaId == null || selectedAcademicYearId == null) return;
      setModalState(() => monthlyLoadingTypes.add(typeId));
      try {
        final result = await ApiService.getPaymentBillMonthlyOptions(
          siswaId: selectedSiswaId!,
          paymentTypeId: typeId,
          academicYearId: selectedAcademicYearId!,
          semesterId: selectedSemesterId,
        );
        if (!mounted || !sheetOpen) return;
        setModalState(() {
          monthlyOptionsByType[typeId] = List<Map<String, dynamic>>.from(
            result['data'] ?? [],
          );
          monthlyLoadingTypes.remove(typeId);
        });
      } catch (e) {
        if (!mounted || !sheetOpen) return;
        setModalState(() {
          monthlyLoadingTypes.remove(typeId);
        });
        _showSnack('Gagal memuat bulan pembayaran: $e', isError: true);
      }
    }

    final createdPayment =
        await showModalBottomSheet<Map<String, dynamic>>(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (ctx) => StatefulBuilder(
            builder: (ctx, setModalState) {
              if (!initialSiswaLoadRequested &&
                  selectedAcademicYearId != null) {
                initialSiswaLoadRequested = true;
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (sheetOpen) unawaited(loadSiswaForPeriod(setModalState));
                });
              }
              final activePaymentTypes = _paymentTypes
                  .where((type) => type['status']?.toString() != 'Nonaktif')
                  .toList();
              final selectedTypes = activePaymentTypes
                  .where((type) => selectedPaymentTypeIds.contains(type['id']))
                  .toList();
              final siswaSearch = siswaSearchController.text
                  .trim()
                  .toLowerCase();
              final filteredModalSiswaList = siswaSearch.isEmpty
                  ? modalSiswaList
                  : modalSiswaList.where((siswa) {
                      final haystack =
                          '${siswa['nama'] ?? ''} ${siswa['nis'] ?? ''} ${siswa['nisn'] ?? ''} ${siswa['kelas'] ?? ''}'
                              .toLowerCase();
                      return haystack.contains(siswaSearch);
                    }).toList();

              List<String> selectedMethods = List<String>.from(_paymentMethods);
              if (selectedTypes.isNotEmpty) {
                final methodSets = selectedTypes
                    .map(
                      (type) =>
                          Set<String>.from(type['metode_pembayaran'] ?? []),
                    )
                    .toList();
                final intersection = methodSets
                    .skip(1)
                    .fold<Set<String>>(
                      Set<String>.from(methodSets.first),
                      (result, current) => result.intersection(current),
                    );
                selectedMethods =
                    intersection.isEmpty
                          ? const <String>[]
                          : intersection.toList()
                      ..sort();
                if (selectedMethods.isNotEmpty &&
                    !selectedMethods.contains(selectedVia)) {
                  selectedVia = selectedMethods.first;
                }
              }

              int totalNominal = 0;
              for (final type in selectedTypes) {
                final typeId = type['id'] as int;
                if (_isMonthlyPaymentType(type)) {
                  final months = selectedMonthsByType[typeId] ?? const <int>{};
                  final options = monthlyOptionsByType[typeId] ?? const [];
                  final fallbackAmount =
                      (type['nominal_default'] as num?)?.toInt() ?? 0;
                  for (final month in months) {
                    final option = options.firstWhere(
                      (item) => (item['month'] as num?)?.toInt() == month,
                      orElse: () => const <String, dynamic>{},
                    );
                    totalNominal +=
                        (option['amount'] as num?)?.toInt() ?? fallbackAmount;
                  }
                } else {
                  final controller = nominalControllers[typeId];
                  final value = int.tryParse(controller?.text ?? '') ?? 0;
                  totalNominal += value;
                }
              }
              final semesterOptions = _academicPeriods.firstWhere(
                (item) =>
                    (item['id'] as num?)?.toInt() == selectedAcademicYearId,
                orElse: () => const <String, dynamic>{},
              )['semesters'];
              final availableSemesters = List<Map<String, dynamic>>.from(
                semesterOptions is List ? semesterOptions : const [],
              );

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
                      TextField(
                        controller: siswaSearchController,
                        onChanged: (value) {
                          setModalState(() {});
                          siswaSearchDebounce?.cancel();
                          siswaSearchDebounce = Timer(
                            const Duration(milliseconds: 300),
                            () {
                              if (sheetOpen) {
                                unawaited(
                                  loadSiswaForPeriod(
                                    setModalState,
                                    search: value,
                                  ),
                                );
                              }
                            },
                          );
                        },
                        decoration: _inputDecoration(
                          hint: 'Cari nama / NIS / NISN',
                        ),
                      ),
                      if (siswaSearch.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        _buildStudentSearchResults(
                          students: filteredModalSiswaList,
                          isLoading: isLoadingSiswa,
                          emptyMessage: 'Siswa tidak ditemukan',
                          onSelected: (siswa) {
                            setModalState(() {
                              selectedSiswaId = (siswa['id'] as num?)?.toInt();
                              selectedWaliName = _waliNameFromSiswa(siswa);
                              siswaSearchController.clear();
                              monthlyOptionsByType.clear();
                              selectedMonthsByType.clear();
                            });
                            for (final type in selectedTypes) {
                              if (_isMonthlyPaymentType(type)) {
                                unawaited(
                                  loadMonthlyOptions(
                                    type['id'] as int,
                                    setModalState,
                                  ),
                                );
                              }
                            }
                          },
                        ),
                      ],
                      const SizedBox(height: 8),
                      _buildDropdownBox<int>(
                        value:
                            filteredModalSiswaList.any(
                              (siswa) => siswa['id'] == selectedSiswaId,
                            )
                            ? selectedSiswaId
                            : null,
                        hint: isLoadingSiswa
                            ? 'Memuat siswa...'
                            : 'Pilih siswa',
                        items: filteredModalSiswaList.map((siswa) {
                          return DropdownMenuItem<int>(
                            value: siswa['id'] as int,
                            child: Text(
                              '${siswa['nama']} - ${siswa['nis'] ?? '-'} - ${siswa['kelas'] ?? '-'}',
                              style: const TextStyle(fontSize: 13),
                            ),
                          );
                        }).toList(),
                        onChanged: (value) {
                          final siswa = modalSiswaList.firstWhere(
                            (item) => item['id'] == value,
                          );
                          setModalState(() {
                            selectedSiswaId = value;
                            selectedWaliName = _waliNameFromSiswa(siswa);
                            monthlyOptionsByType.clear();
                            selectedMonthsByType.clear();
                          });
                          for (final type in selectedTypes) {
                            if (_isMonthlyPaymentType(type)) {
                              unawaited(
                                loadMonthlyOptions(
                                  type['id'] as int,
                                  setModalState,
                                ),
                              );
                            }
                          }
                        },
                      ),
                      if (!isLoadingSiswa &&
                          filteredModalSiswaList.isEmpty) ...[
                        const SizedBox(height: 8),
                        const Text(
                          'Santri tidak ditemukan pada periode/filter ini.',
                          style: TextStyle(
                            fontSize: 11,
                            color: Color(0xFFE65100),
                            height: 1.4,
                          ),
                        ),
                      ],
                      if (siswaPeriodMessage != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          siswaPeriodMessage!,
                          style: const TextStyle(
                            fontSize: 11,
                            color: Color(0xFFE65100),
                            height: 1.4,
                          ),
                        ),
                      ],
                      const SizedBox(height: 14),
                      _buildFieldLabel('Atas Nama'),
                      _buildReadOnlyField(
                        selectedWaliName.isEmpty
                            ? selectedSiswaId == null
                                  ? 'Nama wali akan terisi otomatis'
                                  : 'Wali belum terhubung'
                            : selectedWaliName,
                      ),
                      const SizedBox(height: 14),
                      _buildFieldLabel('Tahun Ajaran dan Semester'),
                      Row(
                        children: [
                          Expanded(
                            child: _buildDropdownBox<int>(
                              value:
                                  _academicPeriods.any(
                                    (year) =>
                                        (year['id'] as num?)?.toInt() ==
                                        selectedAcademicYearId,
                                  )
                                  ? selectedAcademicYearId
                                  : null,
                              hint: 'Tahun ajaran',
                              items: _academicPeriods.map((year) {
                                return DropdownMenuItem<int>(
                                  value: (year['id'] as num).toInt(),
                                  child: Text(
                                    year['name']?.toString() ?? '-',
                                    style: const TextStyle(fontSize: 12),
                                  ),
                                );
                              }).toList(),
                              onChanged: (value) {
                                setModalState(() {
                                  selectedAcademicYearId = value;
                                  final year = _academicPeriods.firstWhere(
                                    (item) =>
                                        (item['id'] as num?)?.toInt() == value,
                                    orElse: () => const <String, dynamic>{},
                                  );
                                  final semesters =
                                      List<Map<String, dynamic>>.from(
                                        year['semesters'] ?? const [],
                                      );
                                  selectedSemesterId = semesters.isNotEmpty
                                      ? (semesters.first['id'] as num?)?.toInt()
                                      : null;
                                  selectedSiswaId = null;
                                  selectedWaliName = '';
                                  selectedMonthsByType.clear();
                                  monthlyOptionsByType.clear();
                                });
                                unawaited(loadSiswaForPeriod(setModalState));
                              },
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _buildDropdownBox<int>(
                              value:
                                  availableSemesters.any(
                                    (semester) =>
                                        (semester['id'] as num?)?.toInt() ==
                                        selectedSemesterId,
                                  )
                                  ? selectedSemesterId
                                  : null,
                              hint: 'Semester',
                              items: availableSemesters.map((semester) {
                                return DropdownMenuItem<int>(
                                  value: (semester['id'] as num).toInt(),
                                  child: Text(
                                    semester['name']?.toString() ?? '-',
                                    style: const TextStyle(fontSize: 12),
                                  ),
                                );
                              }).toList(),
                              onChanged: (value) {
                                setModalState(() {
                                  selectedSemesterId = value;
                                  selectedSiswaId = null;
                                  selectedWaliName = '';
                                  selectedMonthsByType.clear();
                                  monthlyOptionsByType.clear();
                                });
                                unawaited(loadSiswaForPeriod(setModalState));
                              },
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      _buildFieldLabel('Tipe Pembayaran'),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: activePaymentTypes.map((type) {
                          final typeId = type['id'] as int;
                          final isSelected = selectedPaymentTypeIds.contains(
                            typeId,
                          );
                          final color = _getJenisColor(
                            type['nama']?.toString() ?? '',
                          );
                          return GestureDetector(
                            onTap: () {
                              final nextIds = <int>{...selectedPaymentTypeIds};
                              final nextControllers =
                                  Map<int, TextEditingController>.from(
                                    nominalControllers,
                                  );
                              if (isSelected) {
                                nextIds.remove(typeId);
                                nextControllers.remove(typeId)?.dispose();
                                selectedMonthsByType.remove(typeId);
                                monthlyOptionsByType.remove(typeId);
                              } else {
                                nextIds.add(typeId);
                                if (_isMonthlyPaymentType(type)) {
                                  selectedMonthsByType[typeId] = <int>{};
                                } else {
                                  nextControllers[typeId] =
                                      TextEditingController(
                                        text: (type['nominal_default'] ?? 0)
                                            .toString(),
                                      );
                                }
                              }

                              final selectedTypeObjects = activePaymentTypes
                                  .where((item) => nextIds.contains(item['id']))
                                  .toList();
                              final methodSets = selectedTypeObjects
                                  .map(
                                    (item) => Set<String>.from(
                                      item['metode_pembayaran'] ?? [],
                                    ),
                                  )
                                  .toList();
                              if (methodSets.isNotEmpty) {
                                final intersection = methodSets
                                    .skip(1)
                                    .fold<Set<String>>(
                                      Set<String>.from(methodSets.first),
                                      (result, current) =>
                                          result.intersection(current),
                                    );
                                if (intersection.isEmpty) {
                                  if (!isSelected) {
                                    nextIds.remove(typeId);
                                    nextControllers.remove(typeId)?.dispose();
                                  }
                                  _showSnack(
                                    'Item yang dipilih tidak punya metode pembayaran bersama. Sesuaikan kombinasi item.',
                                    isError: true,
                                  );
                                  return;
                                }
                              }

                              setModalState(() {
                                selectedPaymentTypeIds
                                  ..clear()
                                  ..addAll(nextIds);
                                nominalControllers
                                  ..clear()
                                  ..addAll(nextControllers);
                                if (selectedPaymentTypeIds.isEmpty) {
                                  selectedVia = '';
                                }
                              });
                              if (!isSelected && _isMonthlyPaymentType(type)) {
                                unawaited(
                                  loadMonthlyOptions(typeId, setModalState),
                                );
                              }
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
                      _buildFieldLabel('Rincian Item Pembayaran'),
                      if (selectedTypes.isEmpty)
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Text(
                            'Pilih minimal satu tipe pembayaran. Anda bisa memilih beberapa item sekaligus dan sistem akan menghitung total otomatis.',
                            style: TextStyle(
                              fontSize: 11,
                              color: Color(0xFF636E72),
                              height: 1.5,
                            ),
                          ),
                        )
                      else
                        Column(
                          children: selectedTypes.map((type) {
                            final typeId = type['id'] as int;
                            final color = _getJenisColor(
                              type['nama']?.toString() ?? '',
                            );
                            final isMonthly = _isMonthlyPaymentType(type);
                            final controller = nominalControllers[typeId];
                            final monthOptions =
                                monthlyOptionsByType[typeId] ?? const [];
                            final selectedMonths =
                                selectedMonthsByType[typeId] ?? <int>{};
                            return Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    width: 38,
                                    height: 38,
                                    decoration: BoxDecoration(
                                      color: color.withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Icon(
                                      Icons.wallet_rounded,
                                      color: color,
                                      size: 18,
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          type['nama']?.toString() ?? '-',
                                          style: const TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w700,
                                            color: Color(0xFF2D3436),
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        if (isMonthly)
                                          monthlyLoadingTypes.contains(typeId)
                                              ? const Padding(
                                                  padding: EdgeInsets.symmetric(
                                                    vertical: 8,
                                                  ),
                                                  child:
                                                      LinearProgressIndicator(
                                                        color: Color(
                                                          0xFF138F81,
                                                        ),
                                                      ),
                                                )
                                              : Wrap(
                                                  spacing: 6,
                                                  runSpacing: 6,
                                                  children: monthOptions.map((
                                                    option,
                                                  ) {
                                                    final month =
                                                        (option['month']
                                                                as num?)
                                                            ?.toInt();
                                                    final canPay =
                                                        option['can_pay'] !=
                                                        false;
                                                    final checked =
                                                        month != null &&
                                                        selectedMonths.contains(
                                                          month,
                                                        );
                                                    return ChoiceChip(
                                                      label: Text(
                                                        option['label']
                                                                ?.toString() ??
                                                            '-',
                                                        style: TextStyle(
                                                          fontSize: 10,
                                                          fontWeight:
                                                              FontWeight.w700,
                                                          color: !canPay
                                                              ? const Color(
                                                                  0xFF636E72,
                                                                )
                                                              : checked
                                                              ? Colors.white
                                                              : const Color(
                                                                  0xFF138F81,
                                                                ),
                                                        ),
                                                      ),
                                                      selected: checked,
                                                      onSelected:
                                                          canPay &&
                                                              month != null
                                                          ? (selected) {
                                                              setModalState(() {
                                                                final months =
                                                                    selectedMonthsByType
                                                                        .putIfAbsent(
                                                                          typeId,
                                                                          () =>
                                                                              <
                                                                                int
                                                                              >{},
                                                                        );
                                                                selected
                                                                    ? months.add(
                                                                        month,
                                                                      )
                                                                    : months.remove(
                                                                        month,
                                                                      );
                                                              });
                                                            }
                                                          : null,
                                                      selectedColor:
                                                          const Color(
                                                            0xFF138F81,
                                                          ),
                                                      disabledColor:
                                                          const Color(
                                                            0xFFEFF3F5,
                                                          ),
                                                      backgroundColor:
                                                          Colors.white,
                                                    );
                                                  }).toList(),
                                                )
                                        else
                                          TextField(
                                            controller: controller,
                                            keyboardType: TextInputType.number,
                                            onChanged: (_) =>
                                                setModalState(() {}),
                                            decoration: _inputDecoration(
                                              hint:
                                                  (type['nominal_default'] ?? 0)
                                                      .toString(),
                                              prefixText: 'Rp ',
                                            ),
                                          ),
                                        if (isMonthly &&
                                            monthOptions.any(
                                              (option) =>
                                                  option['status']
                                                      ?.toString() ==
                                                  'Lunas',
                                            ))
                                          const Padding(
                                            padding: EdgeInsets.only(top: 6),
                                            child: Text(
                                              'Bulan yang sudah lunas tidak bisa dipilih ulang.',
                                              style: TextStyle(
                                                fontSize: 10,
                                                color: Color(0xFF636E72),
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }).toList(),
                        ),
                      const SizedBox(height: 12),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: const Color(
                            0xFF138F81,
                          ).withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Row(
                          children: [
                            const Expanded(
                              child: Text(
                                'Total Pembayaran',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF2D3436),
                                ),
                              ),
                            ),
                            Text(
                              _formatRupiah(totalNominal),
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF138F81),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      _buildFieldLabel('Metode Pembayaran'),
                      if (selectedTypes.isNotEmpty && selectedMethods.isEmpty)
                        const Padding(
                          padding: EdgeInsets.only(bottom: 8),
                          child: Text(
                            'Item yang dipilih tidak memiliki metode pembayaran yang sama.',
                            style: TextStyle(
                              fontSize: 11,
                              color: Color(0xFFE65100),
                            ),
                          ),
                        ),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: selectedMethods.map((method) {
                          final isSelected = selectedVia == method;
                          final color = _getViaColor(method);
                          return GestureDetector(
                            onTap: () =>
                                setModalState(() => selectedVia = method),
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
                        children: ['Lunas', 'Belum Lunas', 'Menunggu'].map((
                          status,
                        ) {
                          final isSelected = selectedStatus == status;
                          final color = _getStatusColor(status);
                          return Expanded(
                            child: GestureDetector(
                              onTap: () =>
                                  setModalState(() => selectedStatus = status),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 200),
                                margin: const EdgeInsets.symmetric(
                                  horizontal: 3,
                                ),
                                padding: const EdgeInsets.symmetric(
                                  vertical: 10,
                                ),
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
                        decoration: _inputDecoration(
                          hint: 'Catatan opsional...',
                        ),
                      ),
                      const SizedBox(height: 20),
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: ElevatedButton.icon(
                          onPressed: isSaving
                              ? null
                              : () async {
                                  if (selectedSiswaId == null ||
                                      selectedPaymentTypeIds.isEmpty ||
                                      totalNominal <= 0 ||
                                      selectedVia.isEmpty) {
                                    _showSnack(
                                      'Lengkapi siswa, item pembayaran, nominal, dan metode.',
                                      isError: true,
                                    );
                                    return;
                                  }

                                  final paymentItems = <Map<String, dynamic>>[];
                                  for (final type in selectedTypes) {
                                    final typeId = type['id'] as int;
                                    if (_isMonthlyPaymentType(type)) {
                                      final months =
                                          selectedMonthsByType[typeId] ??
                                          <int>{};
                                      final options =
                                          monthlyOptionsByType[typeId] ??
                                          const [];
                                      if (months.isEmpty) {
                                        _showSnack(
                                          'Pilih minimal satu bulan untuk ${type['nama']}.',
                                          isError: true,
                                        );
                                        return;
                                      }
                                      for (final month in months) {
                                        final option = options.firstWhere(
                                          (item) =>
                                              (item['month'] as num?)
                                                  ?.toInt() ==
                                              month,
                                          orElse: () =>
                                              const <String, dynamic>{},
                                        );
                                        if (option['can_pay'] == false) {
                                          _showSnack(
                                            'Bulan ${option['label'] ?? month} sudah lunas dan tidak bisa dibayar ulang.',
                                            isError: true,
                                          );
                                          return;
                                        }
                                        paymentItems.add({
                                          'payment_type_id': typeId,
                                          'period_month': month,
                                          'jumlah':
                                              (option['amount'] as num?)
                                                  ?.toInt() ??
                                              (type['nominal_default'] as num?)
                                                  ?.toInt() ??
                                              0,
                                          'academic_year_id':
                                              selectedAcademicYearId,
                                          'semester_id': selectedSemesterId,
                                        });
                                      }
                                    } else {
                                      final value = int.tryParse(
                                        nominalControllers[typeId]?.text ?? '',
                                      );
                                      paymentItems.add({
                                        'payment_type_id': typeId,
                                        'jumlah': value ?? 0,
                                        'academic_year_id':
                                            selectedAcademicYearId,
                                        'semester_id': selectedSemesterId,
                                      });
                                    }
                                  }

                                  if (paymentItems.any(
                                    (item) => (item['jumlah'] as int) <= 0,
                                  )) {
                                    _showSnack(
                                      'Nominal tiap item pembayaran harus lebih dari nol.',
                                      isError: true,
                                    );
                                    return;
                                  }

                                  final biometric =
                                      await _authenticatePaymentBeforeSave();
                                  if (biometric == null) {
                                    return;
                                  }

                                  setModalState(() => isSaving = true);
                                  try {
                                    final result = await ApiService.createPembayaran({
                                      'user_id': _userId,
                                      'siswa_id': selectedSiswaId,
                                      'atas_nama': selectedWaliName,
                                      'via': selectedVia,
                                      'jumlah': totalNominal,
                                      'tanggal': _formatDate(selectedDate),
                                      'status': selectedStatus,
                                      'academic_year_id':
                                          selectedAcademicYearId,
                                      'semester_id': selectedSemesterId,
                                      'keterangan': keteranganController.text
                                          .trim(),
                                      'payment_items': paymentItems,
                                      'biometric_verified_at':
                                          biometric['verified_at'],
                                      'biometric_verification_method':
                                          biometric['method'],
                                      'biometric_verification_mode':
                                          biometric['mode'],
                                      'device_label': biometric['device_label'],
                                      if (biometric['payment_security_password'] !=
                                          null)
                                        'payment_security_password':
                                            biometric['payment_security_password'],
                                      if (biometric['payment_security_pin'] !=
                                          null)
                                        'payment_security_pin':
                                            biometric['payment_security_pin'],
                                    });
                                    final createdPayment = result['data'] is Map
                                        ? Map<String, dynamic>.from(
                                            result['data'] as Map,
                                          )
                                        : null;

                                    unawaited(
                                      SyncService.notifyDataChanged(
                                        SyncTopics.pembayaran,
                                        message: 'Pembayaran santri diperbarui',
                                        showNotification: true,
                                      ),
                                    );
                                    if (ctx.mounted) {
                                      Navigator.pop(
                                        ctx,
                                        createdPayment ?? <String, dynamic>{},
                                      );
                                    }
                                  } catch (e) {
                                    if (!sheetOpen) return;
                                    setModalState(() => isSaving = false);
                                    _showSnack(
                                      'Gagal menyimpan pembayaran: $e',
                                      isError: true,
                                    );
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
                              : const Icon(
                                  Icons.check_circle_rounded,
                                  size: 20,
                                ),
                          label: Text(
                            isSaving
                                ? 'Menyimpan...'
                                : 'Simpan Multi Pembayaran',
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
        ).whenComplete(() {
          sheetOpen = false;
          siswaSearchDebounce?.cancel();
          siswaSearchController.dispose();
          keteranganController.dispose();
          for (final controller in nominalControllers.values) {
            controller.dispose();
          }
        });

    if (!mounted || createdPayment == null) return;
    if (createdPayment.isNotEmpty) {
      setState(() {
        _upsertPaymentLocal(createdPayment);
      });
      unawaited(_savePaymentCaches());
    }
    unawaited(_refreshPaymentRowsInBackground());
    final paymentSiswaId =
        (createdPayment['siswa_id'] as num?)?.toInt() ??
        ((createdPayment['siswa'] is Map)
            ? ((createdPayment['siswa'] as Map)['id'] as num?)?.toInt()
            : null);
    if (_billingSiswaId != null && _billingSiswaId == paymentSiswaId) {
      unawaited(_loadStudentBillingSummary());
    }
    AppSuccessOverlay.show(context, 'Pembayaran berhasil disimpan');
  }

  Future<void> _showPaymentTypeDialog({
    Map<String, dynamic>? paymentType,
  }) async {
    final namaController = TextEditingController(
      text: paymentType?['nama']?.toString() ?? '',
    );
    final deskripsiController = TextEditingController(
      text: paymentType?['deskripsi']?.toString() ?? '',
    );
    final nominalController = TextEditingController(
      text: (paymentType?['nominal_default'] ?? '').toString(),
    );
    final dueDayController = TextEditingController(
      text:
          (paymentType?['due_day'] ??
                  ((paymentType?['bill_rules'] is List &&
                          (paymentType!['bill_rules'] as List).isNotEmpty)
                      ? (paymentType['bill_rules'] as List).first['due_day']
                      : 10))
              .toString(),
    );
    var selectedPeriode = paymentType?['periode']?.toString() ?? 'bulanan';
    var selectedStatus = paymentType?['status']?.toString() ?? 'Aktif';
    final selectedMethods = List<String>.from(
      paymentType?['metode_pembayaran'] ?? const [],
    );
    var isSaving = false;
    var sheetOpen = true;

    final savedType =
        await showModalBottomSheet<Map<String, dynamic>>(
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
                        decoration: _inputDecoration(
                          hint: 'Contoh: Kitab Tahunan',
                        ),
                      ),
                      const SizedBox(height: 14),
                      _buildFieldLabel('Deskripsi'),
                      TextField(
                        controller: deskripsiController,
                        maxLines: 2,
                        decoration: _inputDecoration(
                          hint: 'Penjelasan singkat tagihan',
                        ),
                      ),
                      const SizedBox(height: 14),
                      _buildFieldLabel('Nominal Default'),
                      TextField(
                        controller: nominalController,
                        keyboardType: TextInputType.number,
                        decoration: _inputDecoration(
                          hint: '250000',
                          prefixText: 'Rp ',
                        ),
                      ),
                      if (selectedPeriode == 'bulanan') ...[
                        const SizedBox(height: 14),
                        _buildFieldLabel('Tanggal Jatuh Tempo Bulanan'),
                        TextField(
                          controller: dueDayController,
                          keyboardType: TextInputType.number,
                          decoration: _inputDecoration(
                            hint: '10',
                            suffixText: 'setiap bulan',
                          ),
                        ),
                      ],
                      const SizedBox(height: 14),
                      _buildFieldLabel('Periode Pembayaran'),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: _availablePaymentPeriods().map((period) {
                          final code = period['code']!;
                          final name = period['name']!;
                          final isSelected = selectedPeriode == code;
                          return GestureDetector(
                            onTap: () =>
                                setModalState(() => selectedPeriode = code),
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
                                name,
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
                        children: _paymentMethods.map((method) {
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
                              onTap: () =>
                                  setModalState(() => selectedStatus = status),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 180),
                                margin: const EdgeInsets.symmetric(
                                  horizontal: 3,
                                ),
                                padding: const EdgeInsets.symmetric(
                                  vertical: 10,
                                ),
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
                                  final nominal = int.tryParse(
                                    nominalController.text,
                                  );
                                  final dueDay =
                                      int.tryParse(dueDayController.text) ?? 10;
                                  if (selectedPeriode == 'bulanan' &&
                                      (dueDay < 1 || dueDay > 31)) {
                                    _showSnack(
                                      'Tanggal jatuh tempo bulanan harus 1 sampai 31.',
                                      isError: true,
                                    );
                                    return;
                                  }
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
                                  final payload = <String, dynamic>{
                                    'nama': namaController.text.trim(),
                                    'deskripsi': deskripsiController.text
                                        .trim(),
                                    'nominal_default': nominal,
                                    'periode': selectedPeriode,
                                    'target_type': 'all',
                                    'starts_on': DateTime.now()
                                        .toIso8601String()
                                        .substring(0, 10),
                                    'metode_pembayaran': selectedMethods,
                                    'status': selectedStatus,
                                  };
                                  if (selectedPeriode == 'bulanan') {
                                    payload['due_day'] = dueDay.clamp(1, 31);
                                  }

                                  try {
                                    Map<String, dynamic> result;
                                    if (paymentType == null) {
                                      result =
                                          await ApiService.createPaymentType(
                                            payload,
                                          );
                                    } else {
                                      result =
                                          await ApiService.updatePaymentType(
                                            paymentType['id'] as int,
                                            payload,
                                          );
                                    }
                                    final savedType = result['data'] is Map
                                        ? Map<String, dynamic>.from(
                                            result['data'] as Map,
                                          )
                                        : null;
                                    if (ctx.mounted) {
                                      Navigator.pop(
                                        ctx,
                                        savedType ?? <String, dynamic>{},
                                      );
                                    }
                                  } catch (e) {
                                    if (!sheetOpen) return;
                                    setModalState(() => isSaving = false);
                                    _showSnack(
                                      'Gagal menyimpan tipe pembayaran: $e',
                                      isError: true,
                                    );
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
        ).whenComplete(() {
          sheetOpen = false;
          namaController.dispose();
          deskripsiController.dispose();
          nominalController.dispose();
          dueDayController.dispose();
        });

    if (!mounted || savedType == null) return;
    if (savedType.isNotEmpty) {
      setState(() {
        _upsertPaymentTypeLocal(savedType);
      });
      unawaited(_savePaymentTypeCache());
    }
    unawaited(_refreshPaymentTypesInBackground());
    _showSnack(
      paymentType == null
          ? 'Tipe pembayaran berhasil ditambahkan.'
          : 'Tipe pembayaran berhasil diperbarui.',
    );
  }

  Future<void> _confirmDeletePaymentType(
    Map<String, dynamic> paymentType,
  ) async {
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
            child: const Text('Hapus', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    final id = (paymentType['id'] as num?)?.toInt();
    if (id == null || _paymentTypeDeletePending.contains(id)) return;
    final previousTypes = _paymentTypes
        .map((item) => Map<String, dynamic>.from(item))
        .toList();

    if (mounted) {
      setState(() {
        _paymentTypeDeletePending.add(id);
        _paymentTypes.removeWhere(
          (item) => (item['id'] as num?)?.toInt() == id,
        );
      });
    }
    unawaited(_savePaymentTypeCache());

    try {
      await ApiService.deletePaymentType(id);
      unawaited(_savePaymentTypeCache());
      unawaited(_refreshPaymentTypesInBackground());
      _showSnack('Tipe pembayaran berhasil dihapus.');
    } catch (e) {
      if (mounted) {
        setState(() {
          _paymentTypes = previousTypes;
        });
        unawaited(_savePaymentTypeCache());
      }
      _showSnack('Gagal menghapus tipe pembayaran: $e', isError: true);
    } finally {
      if (mounted) {
        setState(() => _paymentTypeDeletePending.remove(id));
      } else {
        _paymentTypeDeletePending.remove(id);
      }
    }
  }

  Future<void> _togglePaymentTypeStatus(
    Map<String, dynamic> paymentType,
  ) async {
    if (_isOfflineMode) {
      _showOfflineActionMessage();
      return;
    }

    final currentStatus = paymentType['status']?.toString() ?? 'Aktif';
    final newStatus = currentStatus == 'Aktif' ? 'Nonaktif' : 'Aktif';
    final id = (paymentType['id'] as num?)?.toInt();
    if (id == null || _paymentTypeStatusPending.contains(id)) return;
    final previousType = Map<String, dynamic>.from(paymentType);
    final optimisticType = {...previousType, 'status': newStatus};

    if (mounted) {
      setState(() {
        _paymentTypeStatusPending.add(id);
        _upsertPaymentTypeLocal(optimisticType);
      });
      unawaited(_savePaymentTypeCache());
    }

    try {
      final result = await ApiService.updatePaymentType(id, {
        'status': newStatus,
      });
      final updatedType = result['data'] is Map
          ? Map<String, dynamic>.from(result['data'] as Map)
          : {...paymentType, 'status': newStatus};
      if (mounted) {
        setState(() {
          _upsertPaymentTypeLocal(updatedType);
        });
      }
      unawaited(_savePaymentTypeCache());
      unawaited(_refreshPaymentTypesInBackground());
      _showSnack('Status tipe pembayaran -> $newStatus');
    } catch (e) {
      if (mounted) {
        setState(() {
          _upsertPaymentTypeLocal(previousType);
        });
        unawaited(_savePaymentTypeCache());
      }
      _showSnack('Gagal mengubah status tipe pembayaran: $e', isError: true);
    } finally {
      if (mounted) {
        setState(() => _paymentTypeStatusPending.remove(id));
      } else {
        _paymentTypeStatusPending.remove(id);
      }
    }
  }

  Future<void> _showPaymentMethodDialog({Map<String, dynamic>? method}) async {
    final nameController = TextEditingController(
      text: method?['name']?.toString() ?? '',
    );
    final codeController = TextEditingController(
      text: method?['code']?.toString() ?? '',
    );
    final descriptionController = TextEditingController(
      text: method?['description']?.toString() ?? '',
    );
    final sortController = TextEditingController(
      text: (method?['sort_order'] ?? 100).toString(),
    );
    var isActive = method?['is_active'] != false;
    var isSaving = false;
    var sheetOpen = true;

    final savedMethod =
        await showModalBottomSheet<Map<String, dynamic>>(
          context: context,
          isScrollControlled: true,
          backgroundColor: Colors.transparent,
          builder: (ctx) => StatefulBuilder(
            builder: (ctx, setModalState) {
              return Container(
                constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(ctx).size.height * 0.86,
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
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        method == null
                            ? 'Tambah Metode Pembayaran'
                            : 'Edit Metode Pembayaran',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF2D3436),
                        ),
                      ),
                      const SizedBox(height: 16),
                      _buildFieldLabel('Nama Metode'),
                      TextField(
                        controller: nameController,
                        decoration: _inputDecoration(hint: 'Contoh: Bank BCA'),
                      ),
                      const SizedBox(height: 12),
                      _buildFieldLabel('Kode Metode'),
                      TextField(
                        controller: codeController,
                        decoration: _inputDecoration(hint: 'bank_bca'),
                      ),
                      const SizedBox(height: 12),
                      _buildFieldLabel('Urutan Tampil'),
                      TextField(
                        controller: sortController,
                        keyboardType: TextInputType.number,
                        decoration: _inputDecoration(hint: '100'),
                      ),
                      const SizedBox(height: 12),
                      _buildFieldLabel('Keterangan'),
                      TextField(
                        controller: descriptionController,
                        maxLines: 2,
                        decoration: _inputDecoration(hint: 'Opsional'),
                      ),
                      const SizedBox(height: 14),
                      SwitchListTile.adaptive(
                        contentPadding: EdgeInsets.zero,
                        value: isActive,
                        activeThumbColor: const Color(0xFF138F81),
                        title: const Text(
                          'Metode aktif',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF2D3436),
                          ),
                        ),
                        subtitle: const Text(
                          'Metode nonaktif tidak muncul di form pembayaran baru.',
                          style: TextStyle(
                            fontSize: 11,
                            color: Color(0xFF636E72),
                          ),
                        ),
                        onChanged: (value) =>
                            setModalState(() => isActive = value),
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: ElevatedButton.icon(
                          onPressed: isSaving
                              ? null
                              : () async {
                                  final name = nameController.text.trim();
                                  if (name.isEmpty) {
                                    _showSnack(
                                      'Nama metode pembayaran wajib diisi.',
                                      isError: true,
                                    );
                                    return;
                                  }
                                  setModalState(() => isSaving = true);
                                  final payload = <String, dynamic>{
                                    'name': name,
                                    'code': codeController.text.trim(),
                                    'description': descriptionController.text
                                        .trim(),
                                    'sort_order':
                                        int.tryParse(sortController.text) ??
                                        100,
                                    'is_active': isActive,
                                  };
                                  try {
                                    final result = method == null
                                        ? await ApiService.createPaymentMethod(
                                            payload,
                                          )
                                        : await ApiService.updatePaymentMethod(
                                            (method['id'] as num).toInt(),
                                            payload,
                                          );
                                    final saved = result['data'] is Map
                                        ? Map<String, dynamic>.from(
                                            result['data'] as Map,
                                          )
                                        : null;
                                    if (ctx.mounted) {
                                      Navigator.pop(
                                        ctx,
                                        saved ?? <String, dynamic>{},
                                      );
                                    }
                                  } catch (e) {
                                    if (!sheetOpen) return;
                                    setModalState(() => isSaving = false);
                                    _showSnack(
                                      'Gagal menyimpan metode pembayaran: $e',
                                      isError: true,
                                    );
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
                              : const Icon(Icons.save_rounded),
                          label: Text(
                            isSaving ? 'Menyimpan...' : 'Simpan Metode',
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF138F81),
                            foregroundColor: Colors.white,
                            disabledBackgroundColor: const Color(
                              0xFF138F81,
                            ).withValues(alpha: 0.45),
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
        ).whenComplete(() {
          sheetOpen = false;
          nameController.dispose();
          codeController.dispose();
          descriptionController.dispose();
          sortController.dispose();
        });

    if (!mounted || savedMethod == null) return;
    if (savedMethod.isNotEmpty) {
      setState(() => _upsertPaymentMethodLocal(savedMethod));
      unawaited(_savePaymentMethodCache());
    }
    unawaited(_refreshPaymentMethodsInBackground());
    _showSnack(
      method == null
          ? 'Metode pembayaran berhasil ditambahkan.'
          : 'Metode pembayaran berhasil diperbarui.',
    );
  }

  Future<void> _togglePaymentMethodStatus(Map<String, dynamic> method) async {
    final id = (method['id'] as num?)?.toInt();
    if (id == null) return;
    final nextActive = method['is_active'] == false;
    try {
      final result = await ApiService.updatePaymentMethod(id, {
        'is_active': nextActive,
      });
      final updated = result['data'] is Map
          ? Map<String, dynamic>.from(result['data'] as Map)
          : {...method, 'is_active': nextActive};
      if (!mounted) return;
      setState(() => _upsertPaymentMethodLocal(updated));
      unawaited(_savePaymentMethodCache());
      _showSnack(nextActive ? 'Metode diaktifkan.' : 'Metode dinonaktifkan.');
    } catch (e) {
      _showSnack('Gagal mengubah metode pembayaran: $e', isError: true);
    }
  }

  Future<void> _deletePaymentMethod(Map<String, dynamic> method) async {
    final id = (method['id'] as num?)?.toInt();
    if (id == null) return;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Hapus Metode Pembayaran'),
        content: Text(
          'Hapus metode "${method['name']}"? Jika sudah dipakai, sistem akan menonaktifkan saja.',
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
            child: const Text('Lanjut', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await ApiService.deletePaymentMethod(id);
      if (!mounted) return;
      setState(() {
        _paymentMethodRows.removeWhere(
          (item) => (item['id'] as num?)?.toInt() == id,
        );
        _paymentMethods = _paymentMethodRows
            .where((item) => item['is_active'] != false)
            .map((item) => item['name']?.toString().trim() ?? '')
            .where((name) => name.isNotEmpty)
            .toList();
      });
      unawaited(_refreshPaymentMethodsInBackground());
      _showSnack('Metode pembayaran berhasil diperbarui.');
    } catch (e) {
      _showSnack('Gagal menghapus metode pembayaran: $e', isError: true);
    }
  }

  Future<void> _showPaymentPeriodDialog({Map<String, dynamic>? period}) async {
    final nameController = TextEditingController(
      text: period?['name']?.toString() ?? '',
    );
    final codeController = TextEditingController(
      text: period?['code']?.toString() ?? '',
    );
    final descriptionController = TextEditingController(
      text: period?['description']?.toString() ?? '',
    );
    final dueDayController = TextEditingController(
      text: (period?['due_day'] ?? 10).toString(),
    );
    final sortController = TextEditingController(
      text: (period?['sort_order'] ?? 100).toString(),
    );
    var usesMonth = period?['uses_month'] == true;
    var usesSemester = period?['uses_semester'] != false;
    var needsDueDay = period?['needs_due_day'] == true;
    var isActive = period?['is_active'] != false;
    var monthMode = period?['month_mode']?.toString() == 'full_year'
        ? 'full_year'
        : 'semester';
    var isSaving = false;
    var sheetOpen = true;

    final savedPeriod =
        await showModalBottomSheet<Map<String, dynamic>>(
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
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        period == null
                            ? 'Tambah Periode Pembayaran'
                            : 'Edit Periode Pembayaran',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF2D3436),
                        ),
                      ),
                      const SizedBox(height: 16),
                      _buildFieldLabel('Nama Periode'),
                      TextField(
                        controller: nameController,
                        decoration: _inputDecoration(hint: 'Contoh: Bulanan'),
                      ),
                      const SizedBox(height: 12),
                      _buildFieldLabel('Kode Periode'),
                      TextField(
                        controller: codeController,
                        decoration: _inputDecoration(hint: 'bulanan'),
                      ),
                      const SizedBox(height: 12),
                      _buildFieldLabel('Mode Bulan'),
                      Row(
                        children: [
                          Expanded(
                            child: _choicePill(
                              label: 'Semester',
                              selected: monthMode == 'semester',
                              color: const Color(0xFF138F81),
                              onTap: () =>
                                  setModalState(() => monthMode = 'semester'),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: _choicePill(
                              label: 'Jan-Des',
                              selected: monthMode == 'full_year',
                              color: const Color(0xFF2E86DE),
                              onTap: () =>
                                  setModalState(() => monthMode = 'full_year'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      SwitchListTile.adaptive(
                        contentPadding: EdgeInsets.zero,
                        value: usesMonth,
                        activeThumbColor: const Color(0xFF138F81),
                        title: const Text('Memakai bulan'),
                        onChanged: (value) =>
                            setModalState(() => usesMonth = value),
                      ),
                      SwitchListTile.adaptive(
                        contentPadding: EdgeInsets.zero,
                        value: usesSemester,
                        activeThumbColor: const Color(0xFF138F81),
                        title: const Text('Mengikuti semester'),
                        onChanged: (value) =>
                            setModalState(() => usesSemester = value),
                      ),
                      SwitchListTile.adaptive(
                        contentPadding: EdgeInsets.zero,
                        value: needsDueDay,
                        activeThumbColor: const Color(0xFF138F81),
                        title: const Text('Memiliki jatuh tempo'),
                        onChanged: (value) =>
                            setModalState(() => needsDueDay = value),
                      ),
                      if (needsDueDay) ...[
                        const SizedBox(height: 10),
                        _buildFieldLabel('Tanggal Jatuh Tempo'),
                        TextField(
                          controller: dueDayController,
                          keyboardType: TextInputType.number,
                          decoration: _inputDecoration(
                            hint: '10',
                            suffixText: 'setiap periode',
                          ),
                        ),
                      ],
                      const SizedBox(height: 12),
                      _buildFieldLabel('Urutan Tampil'),
                      TextField(
                        controller: sortController,
                        keyboardType: TextInputType.number,
                        decoration: _inputDecoration(hint: '100'),
                      ),
                      const SizedBox(height: 12),
                      _buildFieldLabel('Keterangan'),
                      TextField(
                        controller: descriptionController,
                        maxLines: 2,
                        decoration: _inputDecoration(hint: 'Opsional'),
                      ),
                      const SizedBox(height: 10),
                      SwitchListTile.adaptive(
                        contentPadding: EdgeInsets.zero,
                        value: isActive,
                        activeThumbColor: const Color(0xFF138F81),
                        title: const Text('Periode aktif'),
                        onChanged: (value) =>
                            setModalState(() => isActive = value),
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        height: 48,
                        child: ElevatedButton.icon(
                          onPressed: isSaving
                              ? null
                              : () async {
                                  final name = nameController.text.trim();
                                  final dueDay =
                                      int.tryParse(dueDayController.text) ?? 10;
                                  if (name.isEmpty) {
                                    _showSnack(
                                      'Nama periode pembayaran wajib diisi.',
                                      isError: true,
                                    );
                                    return;
                                  }
                                  if (needsDueDay &&
                                      (dueDay < 1 || dueDay > 31)) {
                                    _showSnack(
                                      'Tanggal jatuh tempo harus 1 sampai 31.',
                                      isError: true,
                                    );
                                    return;
                                  }
                                  setModalState(() => isSaving = true);
                                  final code = codeController.text.trim();
                                  final payload = <String, dynamic>{
                                    'name': name,
                                    'code': code,
                                    'description': descriptionController.text
                                        .trim(),
                                    'uses_month': usesMonth,
                                    'uses_semester': usesSemester,
                                    'month_mode': monthMode,
                                    'needs_due_day': needsDueDay,
                                    'due_day': needsDueDay ? dueDay : null,
                                    'is_monthly':
                                        code.toLowerCase() == 'bulanan' ||
                                        usesMonth,
                                    'is_general':
                                        code.toLowerCase() == 'umum' ||
                                        (!usesMonth && !usesSemester),
                                    'is_daily': code.toLowerCase() == 'harian',
                                    'sort_order':
                                        int.tryParse(sortController.text) ??
                                        100,
                                    'is_active': isActive,
                                  };
                                  try {
                                    final result = period == null
                                        ? await ApiService.createPaymentPeriodType(
                                            payload,
                                          )
                                        : await ApiService.updatePaymentPeriodType(
                                            (period['id'] as num).toInt(),
                                            payload,
                                          );
                                    final saved = result['data'] is Map
                                        ? Map<String, dynamic>.from(
                                            result['data'] as Map,
                                          )
                                        : null;
                                    if (ctx.mounted) {
                                      Navigator.pop(
                                        ctx,
                                        saved ?? <String, dynamic>{},
                                      );
                                    }
                                  } catch (e) {
                                    if (!sheetOpen) return;
                                    setModalState(() => isSaving = false);
                                    _showSnack(
                                      'Gagal menyimpan periode pembayaran: $e',
                                      isError: true,
                                    );
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
                              : const Icon(Icons.save_rounded),
                          label: Text(
                            isSaving ? 'Menyimpan...' : 'Simpan Periode',
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2E86DE),
                            foregroundColor: Colors.white,
                            disabledBackgroundColor: const Color(
                              0xFF2E86DE,
                            ).withValues(alpha: 0.45),
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
        ).whenComplete(() {
          sheetOpen = false;
          nameController.dispose();
          codeController.dispose();
          descriptionController.dispose();
          dueDayController.dispose();
          sortController.dispose();
        });

    if (!mounted || savedPeriod == null) return;
    if (savedPeriod.isNotEmpty) {
      setState(() => _upsertPaymentPeriodLocal(savedPeriod));
      unawaited(_savePaymentPeriodCache());
    }
    unawaited(_refreshPaymentPeriodsInBackground());
    _showSnack(
      period == null
          ? 'Periode pembayaran berhasil ditambahkan.'
          : 'Periode pembayaran berhasil diperbarui.',
    );
  }

  Future<void> _togglePaymentPeriodStatus(Map<String, dynamic> period) async {
    final id = (period['id'] as num?)?.toInt();
    if (id == null) return;
    final nextActive = period['is_active'] == false;
    try {
      final result = await ApiService.updatePaymentPeriodType(id, {
        'is_active': nextActive,
      });
      final updated = result['data'] is Map
          ? Map<String, dynamic>.from(result['data'] as Map)
          : {...period, 'is_active': nextActive};
      if (!mounted) return;
      setState(() => _upsertPaymentPeriodLocal(updated));
      unawaited(_savePaymentPeriodCache());
      _showSnack(nextActive ? 'Periode diaktifkan.' : 'Periode dinonaktifkan.');
    } catch (e) {
      _showSnack('Gagal mengubah periode pembayaran: $e', isError: true);
    }
  }

  Future<void> _deletePaymentPeriod(Map<String, dynamic> period) async {
    final id = (period['id'] as num?)?.toInt();
    if (id == null) return;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Hapus Periode Pembayaran'),
        content: Text(
          'Hapus periode "${period['name']}"? Jika sudah dipakai, sistem akan menonaktifkan saja.',
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
            child: const Text('Lanjut', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await ApiService.deletePaymentPeriodType(id);
      if (!mounted) return;
      setState(() {
        _paymentPeriodTypes.removeWhere(
          (item) => (item['id'] as num?)?.toInt() == id,
        );
      });
      unawaited(_refreshPaymentPeriodsInBackground());
      _showSnack('Periode pembayaran berhasil diperbarui.');
    } catch (e) {
      _showSnack('Gagal menghapus periode pembayaran: $e', isError: true);
    }
  }

  Future<void> _confirmDeletePayment(
    Map<String, dynamic> deleteTarget,
    String name,
  ) async {
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
            child: const Text('Hapus', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    final deleteKey = _deleteTargetKey(deleteTarget);
    if (deleteKey == null) {
      _showSnack('Target pembayaran tidak valid', isError: true);
      return;
    }
    if (_paymentDeletePendingKeys.contains(deleteKey)) return;

    final previousAll = _allPembayaran
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
    final previousToday = _pembayaranHariIni
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
    final previousTotal = _totalHariIni;
    final previousCount = _jumlahTransaksiHariIni;

    if (mounted) {
      setState(() {
        _paymentDeletePendingKeys.add(deleteKey);
        _removePaymentLocal(deleteTarget);
      });
    }
    unawaited(_savePaymentCaches());

    try {
      final targetType = deleteTarget['type']?.toString() ?? 'legacy';
      final targetId = (deleteTarget['id'] as num?)?.toInt();
      if (targetId == null) {
        throw Exception('Target pembayaran tidak valid');
      }
      if (targetType == 'transaction') {
        await ApiService.deletePaymentTransaction(targetId);
      } else {
        await ApiService.deletePembayaran(targetId);
      }
      unawaited(
        SyncService.notifyDataChanged(
          SyncTopics.pembayaran,
          message: 'Data pembayaran telah diperbarui',
        ),
      );
      unawaited(_savePaymentCaches());
      unawaited(_refreshPaymentRowsInBackground());
      _showSnack('Pembayaran berhasil dihapus.');
    } catch (e) {
      if (mounted) {
        setState(() {
          _allPembayaran = previousAll;
          _pembayaranHariIni = previousToday;
          _totalHariIni = previousTotal;
          _jumlahTransaksiHariIni = previousCount;
        });
        unawaited(_savePaymentCaches());
      }
      _showSnack('Gagal menghapus pembayaran: $e', isError: true);
    } finally {
      if (mounted) {
        setState(() => _paymentDeletePendingKeys.remove(deleteKey));
      } else {
        _paymentDeletePendingKeys.remove(deleteKey);
      }
    }
  }

  InputDecoration _inputDecoration({
    String? hint,
    String? prefixText,
    String? suffixText,
  }) {
    return InputDecoration(
      hintText: hint,
      prefixText: prefixText,
      suffixText: suffixText,
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

  Widget _buildStudentSearchResults({
    required List<Map<String, dynamic>> students,
    required bool isLoading,
    required String emptyMessage,
    required ValueChanged<Map<String, dynamic>> onSelected,
  }) {
    if (isLoading) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
        ),
        child: const LinearProgressIndicator(color: Color(0xFF138F81)),
      );
    }

    if (students.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Text(
          emptyMessage,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: Color(0xFFE65100),
          ),
        ),
      );
    }

    return Container(
      constraints: const BoxConstraints(maxHeight: 180),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
      ),
      child: ListView.separated(
        shrinkWrap: true,
        padding: const EdgeInsets.symmetric(vertical: 6),
        itemCount: students.length > 8 ? 8 : students.length,
        separatorBuilder: (_, _) => const Divider(height: 1),
        itemBuilder: (_, index) {
          final siswa = students[index];
          final wali = _waliNameFromSiswa(siswa);
          return ListTile(
            dense: true,
            title: Text(
              siswa['nama']?.toString() ?? '-',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: Color(0xFF2D3436),
              ),
            ),
            subtitle: Text(
              '${siswa['nis'] ?? '-'} - ${siswa['nisn'] ?? '-'} - ${siswa['kelas'] ?? '-'}${wali.isNotEmpty ? ' - Wali: $wali' : ''}',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 10, color: Color(0xFF636E72)),
            ),
            onTap: () => onSelected(siswa),
          );
        },
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
        onPressed: () => unawaited(_showQuickActions()),
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
                    Tab(text: 'Per Santri'),
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
                          _buildStudentBillingTab(),
                          _buildPaymentSettingsTab(),
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
                      if (_isSyncing && !_isLoading && !_isOfflineMode) ...[
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
                    Icon(
                      Icons.credit_card_rounded,
                      color: Colors.white,
                      size: 18,
                    ),
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

  Widget _buildPaymentList(
    List<Map<String, dynamic>> list,
    String emptyMessage,
  ) {
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

    return AppRefreshIndicator(
      onRefresh: () => _loadData(forceRefresh: true),
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
    final name =
        siswa?['nama']?.toString() ?? payment['atas_nama']?.toString() ?? '-';
    final atasNama =
        wali?['name']?.toString() ?? payment['atas_nama']?.toString() ?? '-';
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
    final paymentItems = _extractPaymentItems(payment);
    final deleteTarget = payment['delete_target'] is Map
        ? Map<String, dynamic>.from(payment['delete_target'] as Map)
        : null;
    final deleteKey = deleteTarget == null
        ? null
        : _deleteTargetKey(deleteTarget);
    final isDeletePending =
        deleteKey != null && _paymentDeletePendingKeys.contains(deleteKey);
    final siswaId =
        (siswa?['id'] as num?)?.toInt() ??
        (payment['siswa_id'] as num?)?.toInt();

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
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                ...paymentItems.map((item) {
                  final itemName = item['nama']?.toString() ?? jenis;
                  return _smallChip(itemName, _getJenisColor(itemName));
                }),
                _smallChip(via, viaColor, icon: _getViaIcon(via)),
                if (paymentType != null)
                  _smallChip(
                    paymentType['periode']?.toString() ?? '-',
                    const Color(0xFF6C5CE7),
                  ),
                _smallChip(status, statusColor),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (siswaId != null && _userId > 0) ...[
                  GestureDetector(
                    onTap: () => _exportStudentPaymentPdf(siswaId),
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF2E86DE).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Icon(
                        Icons.picture_as_pdf_rounded,
                        size: 14,
                        color: Color(0xFF2E86DE),
                      ),
                    ),
                  ),
                ],
                if (deleteTarget != null) ...[
                  const SizedBox(width: 6),
                  GestureDetector(
                    onTap: isDeletePending
                        ? null
                        : () => _confirmDeletePayment(deleteTarget, name),
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE65100).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: isDeletePending
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Color(0xFFE65100),
                              ),
                            )
                          : const Icon(
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

  Widget _buildStudentBillingTab() {
    final students = _filteredBillingStudents();
    final semesters = _semesterOptionsForBillingYear();

    return AppRefreshIndicator(
      onRefresh: _loadStudentBillingSummary,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFE1EFF7),
              borderRadius: BorderRadius.circular(22),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(Icons.search_rounded, color: Color(0xFF138F81)),
                    SizedBox(width: 8),
                    Text(
                      'Cek Tagihan Santri',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF2D3436),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _billingSearchController,
                  onChanged: (value) => setState(() {
                    final nextStudents = _filteredBillingStudents(value);
                    if (_billingSiswaId != null &&
                        !nextStudents.any(
                          (siswa) => siswa['id'] == _billingSiswaId,
                        )) {
                      _billingSiswaId = null;
                      _studentBillingSummary = null;
                    }
                  }),
                  decoration: _inputDecoration(
                    hint: 'Cari nama, NIS, atau kelas santri',
                  ),
                ),
                if (_billingSearchController.text.trim().isNotEmpty) ...[
                  const SizedBox(height: 8),
                  _buildStudentSearchResults(
                    students: students,
                    isLoading: false,
                    emptyMessage: 'Siswa tidak ditemukan',
                    onSelected: (siswa) {
                      setState(() {
                        _billingSiswaId = (siswa['id'] as num?)?.toInt();
                        _billingSearchController.clear();
                        _studentBillingSummary = null;
                      });
                      unawaited(_loadStudentBillingSummary());
                    },
                  ),
                ],
                const SizedBox(height: 10),
                _buildDropdownBox<int>(
                  value: students.any((siswa) => siswa['id'] == _billingSiswaId)
                      ? _billingSiswaId
                      : null,
                  hint: 'Pilih santri',
                  items: students.map((siswa) {
                    return DropdownMenuItem<int>(
                      value: (siswa['id'] as num).toInt(),
                      child: Text(
                        '${siswa['nama']} - ${siswa['kelas'] ?? '-'}',
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 12),
                      ),
                    );
                  }).toList(),
                  onChanged: (value) {
                    setState(() {
                      _billingSiswaId = value;
                      _studentBillingSummary = null;
                    });
                    if (value != null) {
                      unawaited(_loadStudentBillingSummary());
                    }
                  },
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _buildDropdownBox<int>(
                        value:
                            _academicPeriods.any(
                              (year) =>
                                  (year['id'] as num?)?.toInt() ==
                                  _billingAcademicYearId,
                            )
                            ? _billingAcademicYearId
                            : null,
                        hint: 'Tahun ajaran',
                        items: _academicPeriods.map((year) {
                          return DropdownMenuItem<int>(
                            value: (year['id'] as num).toInt(),
                            child: Text(
                              year['name']?.toString() ?? '-',
                              style: const TextStyle(fontSize: 12),
                            ),
                          );
                        }).toList(),
                        onChanged: (value) {
                          setState(() {
                            _billingAcademicYearId = value;
                            final nextSemesters =
                                _semesterOptionsForBillingYear();
                            _billingSemesterId = nextSemesters.isNotEmpty
                                ? (nextSemesters.first['id'] as num?)?.toInt()
                                : null;
                            _studentBillingSummary = null;
                          });
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _buildDropdownBox<int>(
                        value:
                            semesters.any(
                              (semester) =>
                                  (semester['id'] as num?)?.toInt() ==
                                  _billingSemesterId,
                            )
                            ? _billingSemesterId
                            : null,
                        hint: 'Semester',
                        items: semesters.map((semester) {
                          return DropdownMenuItem<int>(
                            value: (semester['id'] as num).toInt(),
                            child: Text(
                              semester['name']?.toString() ?? '-',
                              style: const TextStyle(fontSize: 12),
                            ),
                          );
                        }).toList(),
                        onChanged: (value) {
                          setState(() {
                            _billingSemesterId = value;
                            _studentBillingSummary = null;
                          });
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _buildDropdownBox<String>(
                        value: _billingStatus,
                        hint: 'Status',
                        items:
                            const [
                              'Semua',
                              'Lunas',
                              'Belum Lunas',
                              'Terlambat',
                              'Menunggu',
                            ].map((status) {
                              return DropdownMenuItem<String>(
                                value: status,
                                child: Text(
                                  status,
                                  style: const TextStyle(fontSize: 12),
                                ),
                              );
                            }).toList(),
                        onChanged: (value) {
                          setState(() {
                            _billingStatus = value ?? 'Semua';
                            _studentBillingSummary = null;
                          });
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _buildDropdownBox<int>(
                        value:
                            _paymentTypes.any(
                              (type) =>
                                  (type['id'] as num?)?.toInt() ==
                                  _billingPaymentTypeId,
                            )
                            ? _billingPaymentTypeId
                            : null,
                        hint: 'Tipe',
                        items: [
                          const DropdownMenuItem<int>(
                            value: 0,
                            child: Text(
                              'Semua',
                              style: TextStyle(fontSize: 12),
                            ),
                          ),
                          ..._paymentTypes.map((type) {
                            return DropdownMenuItem<int>(
                              value: (type['id'] as num).toInt(),
                              child: Text(
                                type['nama']?.toString() ?? '-',
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 12),
                              ),
                            );
                          }),
                        ],
                        onChanged: (value) {
                          setState(() {
                            _billingPaymentTypeId = value == null || value == 0
                                ? null
                                : value;
                            _studentBillingSummary = null;
                          });
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _isBillingLoading
                        ? null
                        : _loadStudentBillingSummary,
                    icon: _isBillingLoading
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.manage_search_rounded),
                    label: Text(
                      _isBillingLoading ? 'Memuat...' : 'Tampilkan Tagihan',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF138F81),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (_billingError != null) ...[
            const SizedBox(height: 10),
            Text(
              _billingError!,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Color(0xFFE65100),
              ),
            ),
          ],
          if (_studentBillingSummary != null) ...[
            const SizedBox(height: 12),
            _buildStudentBillingHeader(_studentBillingSummary!),
            const SizedBox(height: 12),
            BillingSummaryView(
              data: _studentBillingSummary!,
              formatCurrency: _formatRupiah,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStudentBillingHeader(Map<String, dynamic> data) {
    final student = data['student'] is Map
        ? Map<String, dynamic>.from(data['student'] as Map)
        : const <String, dynamic>{};
    final title = [
      student['nis']?.toString(),
      student['nama']?.toString(),
    ].where((value) => value != null && value.trim().isNotEmpty).join(' - ');

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(22),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xFFFFDC80),
              borderRadius: BorderRadius.circular(15),
            ),
            child: const Icon(Icons.person_rounded, color: Color(0xFF138F81)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title.isEmpty ? 'Santri' : title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF2D3436),
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  '${student['kelas'] ?? '-'} - Wali: ${student['wali_nama'] ?? '-'}',
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF636E72),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentSettingsTab() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
          child: Container(
            padding: const EdgeInsets.all(5),
            decoration: BoxDecoration(
              color: const Color(0xFFE1EFF7),
              borderRadius: BorderRadius.circular(18),
            ),
            child: Row(
              children: [
                _settingsTabButton(0, 'Tipe'),
                _settingsTabButton(1, 'Metode'),
                _settingsTabButton(2, 'Periode'),
              ],
            ),
          ),
        ),
        Expanded(
          child: IndexedStack(
            index: _paymentSettingsTab,
            children: [
              _buildPaymentTypeList(),
              _buildPaymentMethodList(),
              _buildPaymentPeriodList(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _settingsTabButton(int index, String label) {
    final selected = _paymentSettingsTab == index;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _paymentSettingsTab = index),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: selected ? const Color(0xFF138F81) : Colors.transparent,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: selected ? Colors.white : const Color(0xFF636E72),
            ),
          ),
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

    return AppRefreshIndicator(
      onRefresh: () => _loadData(forceRefresh: true),
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
          final id = (type['id'] as num?)?.toInt();
          final isStatusPending =
              id != null && _paymentTypeStatusPending.contains(id);
          final isDeletePending =
              id != null && _paymentTypeDeletePending.contains(id);
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
                      child: Icon(Icons.wallet_rounded, color: color, size: 22),
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
                    ...methods.map(
                      (method) => _smallChip(method, _getViaColor(method)),
                    ),
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
                        enabled: !isStatusPending && !isDeletePending,
                        onTap: () => unawaited(
                          _showPaymentTypeDialog(paymentType: type),
                        ),
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
                        busy: isStatusPending,
                        enabled: !isStatusPending && !isDeletePending,
                        onTap: () => _togglePaymentTypeStatus(type),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _actionButton(
                        label: 'Hapus',
                        icon: Icons.delete_rounded,
                        color: const Color(0xFFE65100),
                        busy: isDeletePending,
                        enabled: !isStatusPending && !isDeletePending,
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

  Widget _buildPaymentMethodList() {
    if (_paymentMethodRows.isEmpty) {
      return _emptyPaymentSetting(
        icon: Icons.account_balance_wallet_outlined,
        message: 'Belum ada metode pembayaran',
        actionLabel: 'Tambah Metode',
        onTap: () => unawaited(_showPaymentMethodDialog()),
      );
    }

    return AppRefreshIndicator(
      onRefresh: () => _loadData(forceRefresh: true),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        itemCount: _paymentMethodRows.length + 1,
        itemBuilder: (context, index) {
          if (index == 0) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _addSettingButton(
                label: 'Tambah Metode Pembayaran',
                icon: Icons.add_card_rounded,
                color: const Color(0xFF138F81),
                onTap: () => unawaited(_showPaymentMethodDialog()),
              ),
            );
          }
          final method = _paymentMethodRows[index - 1];
          final active = method['is_active'] != false;
          final name = method['name']?.toString() ?? '-';
          final color = _getViaColor(name);
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
                      child: Icon(_getViaIcon(name), color: color, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF2D3436),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            [
                              if ((method['code']?.toString() ?? '').isNotEmpty)
                                method['code'].toString(),
                              'urutan ${method['sort_order'] ?? 100}',
                            ].join(' • '),
                            style: const TextStyle(
                              fontSize: 10,
                              color: Color(0xFF636E72),
                            ),
                          ),
                        ],
                      ),
                    ),
                    _smallChip(
                      active ? 'Aktif' : 'Nonaktif',
                      active
                          ? const Color(0xFF138F81)
                          : const Color(0xFFE65100),
                    ),
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
                        onTap: () =>
                            unawaited(_showPaymentMethodDialog(method: method)),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _actionButton(
                        label: active ? 'Nonaktifkan' : 'Aktifkan',
                        icon: active
                            ? Icons.toggle_off_rounded
                            : Icons.toggle_on_rounded,
                        color: active
                            ? const Color(0xFFE65100)
                            : const Color(0xFF138F81),
                        onTap: () => _togglePaymentMethodStatus(method),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _actionButton(
                        label: 'Hapus',
                        icon: Icons.delete_rounded,
                        color: const Color(0xFFE65100),
                        onTap: () => _deletePaymentMethod(method),
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

  Widget _buildPaymentPeriodList() {
    if (_paymentPeriodTypes.isEmpty) {
      return _emptyPaymentSetting(
        icon: Icons.calendar_month_outlined,
        message: 'Belum ada periode pembayaran',
        actionLabel: 'Tambah Periode',
        onTap: () => unawaited(_showPaymentPeriodDialog()),
      );
    }

    return AppRefreshIndicator(
      onRefresh: () => _loadData(forceRefresh: true),
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        itemCount: _paymentPeriodTypes.length + 1,
        itemBuilder: (context, index) {
          if (index == 0) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _addSettingButton(
                label: 'Tambah Periode Pembayaran',
                icon: Icons.add_rounded,
                color: const Color(0xFF2E86DE),
                onTap: () => unawaited(_showPaymentPeriodDialog()),
              ),
            );
          }
          final period = _paymentPeriodTypes[index - 1];
          final active = period['is_active'] != false;
          final usesMonth = period['uses_month'] == true;
          final usesSemester = period['uses_semester'] == true;
          final monthMode = period['month_mode']?.toString() == 'full_year'
              ? 'Jan-Des'
              : 'Semester';
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
                        color: const Color(0xFF2E86DE).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.calendar_month_rounded,
                        color: Color(0xFF2E86DE),
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            period['name']?.toString() ?? '-',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF2D3436),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            [
                              period['code']?.toString() ?? '-',
                              if (period['due_day'] != null)
                                'jatuh tempo ${period['due_day']}',
                              'urutan ${period['sort_order'] ?? 100}',
                            ].join(' • '),
                            style: const TextStyle(
                              fontSize: 10,
                              color: Color(0xFF636E72),
                            ),
                          ),
                        ],
                      ),
                    ),
                    _smallChip(
                      active ? 'Aktif' : 'Nonaktif',
                      active
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
                      usesMonth ? 'Pakai bulan' : 'Tanpa bulan',
                      usesMonth
                          ? const Color(0xFF138F81)
                          : const Color(0xFF636E72),
                    ),
                    _smallChip(
                      usesSemester ? 'Semester' : 'Non semester',
                      const Color(0xFF6C5CE7),
                    ),
                    _smallChip(monthMode, const Color(0xFF2E86DE)),
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
                        onTap: () =>
                            unawaited(_showPaymentPeriodDialog(period: period)),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _actionButton(
                        label: active ? 'Nonaktifkan' : 'Aktifkan',
                        icon: active
                            ? Icons.toggle_off_rounded
                            : Icons.toggle_on_rounded,
                        color: active
                            ? const Color(0xFFE65100)
                            : const Color(0xFF138F81),
                        onTap: () => _togglePaymentPeriodStatus(period),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _actionButton(
                        label: 'Hapus',
                        icon: Icons.delete_rounded,
                        color: const Color(0xFFE65100),
                        onTap: () => _deletePaymentPeriod(period),
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

  Widget _addSettingButton({
    required String label,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: Colors.white, size: 18),
            const SizedBox(width: 8),
            Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _emptyPaymentSetting({
    required IconData icon,
    required String message,
    required String actionLabel,
    required VoidCallback onTap,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: const Color(0xFF636E72)),
            const SizedBox(height: 12),
            Text(
              message,
              style: const TextStyle(fontSize: 14, color: Color(0xFF636E72)),
            ),
            const SizedBox(height: 14),
            _addSettingButton(
              label: actionLabel,
              icon: Icons.add_rounded,
              color: const Color(0xFF138F81),
              onTap: onTap,
            ),
          ],
        ),
      ),
    );
  }

  Widget _choicePill({
    required String label,
    required bool selected,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 11),
        decoration: BoxDecoration(
          color: selected ? color : Colors.white,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: selected ? Colors.white : color,
            ),
          ),
        ),
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
    bool enabled = true,
    bool busy = false,
  }) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 9),
        decoration: BoxDecoration(
          color: color.withValues(alpha: enabled ? 0.1 : 0.05),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (busy)
              SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(strokeWidth: 2, color: color),
              )
            else
              Icon(icon, size: 14, color: color),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: color.withValues(alpha: enabled ? 1 : 0.55),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PaymentRequestResult {
  const _PaymentRequestResult._({this.data, this.error});

  final Map<String, dynamic>? data;
  final String? error;

  bool get isSuccess => data != null;

  factory _PaymentRequestResult.success(Map<String, dynamic> data) {
    return _PaymentRequestResult._(data: data);
  }

  factory _PaymentRequestResult.failure(String error) {
    return _PaymentRequestResult._(error: error);
  }
}
