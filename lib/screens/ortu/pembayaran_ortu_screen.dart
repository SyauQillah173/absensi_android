import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../services/api_service.dart';

class PembayaranOrtuScreen extends StatefulWidget {
  const PembayaranOrtuScreen({super.key});

  @override
  State<PembayaranOrtuScreen> createState() => _PembayaranOrtuScreenState();
}

class _PembayaranOrtuScreenState extends State<PembayaranOrtuScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _fadeIn;

  bool _isLoading = true;
  String _errorMessage = '';

  // Data anak
  List<Map<String, dynamic>> _anakList = [];
  int _activeSiswaId = 0;
  String _activeSiswaName = '';

  // Pembayaran data
  int _totalLunas = 0;
  int _totalBelumLunas = 0;
  List<dynamic> _summary = [];
  List<dynamic> _tagihan = [];
  List<dynamic> _riwayat = [];

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _fadeIn = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(parent: _animController, curve: Curves.easeOut));
    _animController.forward();
    _loadAnakData();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  Future<void> _loadAnakData() async {
    final prefs = await SharedPreferences.getInstance();
    final anakJson = prefs.getString('anak_list') ?? '[]';
    final anakList = List<Map<String, dynamic>>.from(
      (jsonDecode(anakJson) as List).map((a) => Map<String, dynamic>.from(a)),
    );
    final activeSiswaId = prefs.getInt('active_siswa_id') ?? 0;
    final activeSiswaName = prefs.getString('active_siswa_nama') ?? '';

    setState(() {
      _anakList = anakList;
      _activeSiswaId = activeSiswaId;
      _activeSiswaName = activeSiswaName;
    });

    if (_activeSiswaId > 0) {
      _loadPembayaran();
    } else {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Data anak tidak ditemukan';
      });
    }
  }

  Future<void> _loadPembayaran() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final result = await ApiService.getPembayaranAnak(_activeSiswaId);

      if (mounted) {
        if (result['success'] == true) {
          setState(() {
            _totalLunas = result['total_lunas'] ?? 0;
            _totalBelumLunas = result['total_belum_lunas'] ?? 0;
            _summary = List.from(result['summary'] ?? []);
            _tagihan = List.from(result['tagihan'] ?? []);
            _riwayat = List.from(result['data'] ?? []);
            _isLoading = false;
          });
        } else {
          setState(() {
            _errorMessage = result['message'] ?? 'Gagal memuat data';
            _isLoading = false;
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Tidak dapat terhubung ke server';
          _isLoading = false;
        });
      }
    }
  }

  String _formatRupiah(int amount) {
    String s = amount.toString();
    String result = '';
    int count = 0;
    for (int i = s.length - 1; i >= 0; i--) {
      count++;
      result = s[i] + result;
      if (count % 3 == 0 && i != 0) {
        result = '.$result';
      }
    }
    return 'Rp $result';
  }

  Color _getJenisColor(String jenis) {
    switch (jenis) {
      case 'SPP Bulanan':
        return const Color(0xFF138F81);
      case 'Ujian Semester':
        return const Color(0xFF2E86DE);
      case 'Buku & Kitab':
        return const Color(0xFF6C5CE7);
      case 'Daftar Ulang':
        return const Color(0xFFE65100);
      default:
        return const Color(0xFF636E72);
    }
  }

  IconData _getJenisIcon(String jenis) {
    switch (jenis) {
      case 'SPP Bulanan':
        return Icons.calendar_month_rounded;
      case 'Ujian Semester':
        return Icons.school_rounded;
      case 'Buku & Kitab':
        return Icons.menu_book_rounded;
      case 'Daftar Ulang':
        return Icons.how_to_reg_rounded;
      default:
        return Icons.receipt_long_rounded;
    }
  }

  Color _getViaColor(String via) {
    switch (via) {
      case 'Transfer Dana':
        return const Color(0xFF00B894);
      case 'Bank BRI':
        return const Color(0xFF0984E3);
      case 'Bank Mandiri':
        return const Color(0xFF2E86DE);
      case 'Bank BSI':
        return const Color(0xFF138F81);
      case 'Bank BCA':
        return const Color(0xFF0984E3);
      case 'Tunai':
        return const Color(0xFFE65100);
      default:
        return const Color(0xFF636E72);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFFFDC80),
      body: SafeArea(
        child: FadeTransition(
          opacity: _fadeIn,
          child: Column(
            children: [
              _buildProfileBar(),
              const SizedBox(height: 12),
              Expanded(
                child: RefreshIndicator(
                  onRefresh: _loadPembayaran,
                  color: const Color(0xFF138F81),
                  child: SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(
                      parent: BouncingScrollPhysics(),
                    ),
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Column(
                      children: [
                        if (_anakList.length > 1) _buildAnakSelector(),
                        if (_anakList.length > 1) const SizedBox(height: 10),
                        _buildCreditCard(),
                        const SizedBox(height: 14),
                        if (!_isLoading && _errorMessage.isEmpty) ...[
                          _buildTagihanSection(),
                          if (_tagihan.isNotEmpty) const SizedBox(height: 14),
                          _buildSummarySection(),
                          const SizedBox(height: 14),
                          _buildRiwayatSection(),
                        ],
                        if (_isLoading)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 40),
                            child: Center(
                              child: CircularProgressIndicator(
                                color: Color(0xFF138F81),
                              ),
                            ),
                          ),
                        if (_errorMessage.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 40),
                            child: Text(
                              _errorMessage,
                              style: const TextStyle(
                                color: Color(0xFF636E72),
                                fontSize: 13,
                              ),
                            ),
                          ),
                        const SizedBox(height: 20),
                      ],
                    ),
                  ),
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
                  const Text(
                    'Pembayaran',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  Text(
                    _activeSiswaName.isNotEmpty
                        ? _activeSiswaName
                        : 'Memuat...',
                    style: TextStyle(fontSize: 11, color: Colors.grey[600]),
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

  Widget _buildAnakSelector() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(16),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<int>(
          value: _activeSiswaId,
          isExpanded: true,
          icon: const Icon(Icons.keyboard_arrow_down_rounded),
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: Color(0xFF2D3436),
          ),
          items: _anakList.map((anak) {
            return DropdownMenuItem<int>(
              value: anak['id'] as int,
              child: Text(
                '${anak['nama']} — ${anak['kelas'] ?? ''}',
                style: const TextStyle(fontSize: 13),
              ),
            );
          }).toList(),
          onChanged: (value) async {
            if (value != null && value != _activeSiswaId) {
              final anak = _anakList.firstWhere((a) => a['id'] == value);
              final prefs = await SharedPreferences.getInstance();
              await prefs.setInt('active_siswa_id', value);
              await prefs.setString('active_siswa_nama', anak['nama'] ?? '');
              setState(() {
                _activeSiswaId = value;
                _activeSiswaName = anak['nama'] ?? '';
              });
              _loadPembayaran();
            }
          },
        ),
      ),
    );
  }

  Widget _buildCreditCard() {
    final totalKeseluruhan = _totalLunas + _totalBelumLunas;
    return Container(
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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    width: 40,
                    height: 28,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.25),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Icon(
                      Icons.credit_card_rounded,
                      color: Colors.white,
                      size: 18,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'Total Pembayaran',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w500,
                      color: Colors.white70,
                    ),
                  ),
                ],
              ),
              Container(
                width: 32,
                height: 24,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(4),
                  gradient: LinearGradient(
                    colors: [Colors.amber.shade300, Colors.amber.shade600],
                  ),
                ),
                child: Center(
                  child: Container(
                    width: 18,
                    height: 12,
                    decoration: BoxDecoration(
                      border: Border.all(
                        color: Colors.amber.shade800,
                        width: 1,
                      ),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            _formatRupiah(totalKeseluruhan),
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
                    'LUNAS',
                    style: TextStyle(
                      fontSize: 8,
                      fontWeight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.5),
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _formatRupiah(_totalLunas),
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    'BELUM LUNAS',
                    style: TextStyle(
                      fontSize: 8,
                      fontWeight: FontWeight.w600,
                      color: Colors.white.withValues(alpha: 0.5),
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    _formatRupiah(_totalBelumLunas),
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: _totalBelumLunas > 0
                          ? Colors.amber.shade200
                          : Colors.white,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSummarySection() {
    if (_summary.isEmpty) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: const Color(0xFF6C5CE7).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(7),
                ),
                child: const Icon(
                  Icons.pie_chart_rounded,
                  size: 14,
                  color: Color(0xFF6C5CE7),
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'Ringkasan Per Kategori',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF2D3436),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...List.generate(
            _summary.length,
            (index) => _buildSummaryItem(_summary[index], index),
          ),
        ],
      ),
    );
  }

  Widget _buildTagihanSection() {
    if (_tagihan.isEmpty) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: const Color(0xFFE65100).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(7),
                ),
                child: const Icon(
                  Icons.receipt_long_rounded,
                  size: 14,
                  color: Color(0xFFE65100),
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'Tagihan Aktif',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF2D3436),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...List.generate(
            _tagihan.length,
            (index) => _buildTagihanItem(_tagihan[index], index),
          ),
        ],
      ),
    );
  }

  Widget _buildTagihanItem(dynamic item, int index) {
    final nama = item['nama']?.toString() ?? '-';
    final periode = item['periode']?.toString() ?? '-';
    final nominal = item['nominal_default'] ?? 0;
    final statusTagihan = item['status_tagihan']?.toString() ?? 'Belum Ada Pembayaran';
    final jenisColor = _getJenisColor(nama);
    final isLunas = statusTagihan == 'Lunas';

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 350 + (index * 60)),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, 14 * (1 - value)),
            child: child,
          ),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: jenisColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                _getJenisIcon(nama),
                size: 18,
                color: jenisColor,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    nama,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '$periode • ${_formatRupiah(nominal is int ? nominal : 0)}',
                    style: const TextStyle(
                      fontSize: 10,
                      color: Color(0xFF636E72),
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: (isLunas
                        ? const Color(0xFF138F81)
                        : const Color(0xFFE65100))
                    .withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                statusTagihan,
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  color: isLunas
                      ? const Color(0xFF138F81)
                      : const Color(0xFFE65100),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryItem(dynamic item, int index) {
    final jenis = item['jenis']?.toString() ?? '';
    final totalBayar = item['total_bayar'] ?? 0;
    final totalBelum = item['total_belum'] ?? 0;
    final lunas = item['lunas'] ?? 0;
    final belumLunas = item['belum_lunas'] ?? 0;
    final jenisColor = _getJenisColor(jenis);
    final jenisIcon = _getJenisIcon(jenis);

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 400 + (index * 80)),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, 15 * (1 - value)),
            child: child,
          ),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: jenisColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(jenisIcon, size: 20, color: jenisColor),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    jenis,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF2D3436),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      if (lunas > 0)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          margin: const EdgeInsets.only(right: 4),
                          decoration: BoxDecoration(
                            color: const Color(
                              0xFF138F81,
                            ).withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '$lunas Lunas',
                            style: const TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF138F81),
                            ),
                          ),
                        ),
                      if (belumLunas > 0)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(
                              0xFFD63031,
                            ).withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            '$belumLunas Belum',
                            style: const TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFFD63031),
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (totalBayar > 0)
                  Text(
                    _formatRupiah(totalBayar),
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF138F81),
                    ),
                  ),
                if (totalBelum > 0)
                  Text(
                    _formatRupiah(totalBelum),
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFFD63031),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRiwayatSection() {
    if (_riwayat.isEmpty) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFE1EFF7),
        borderRadius: BorderRadius.circular(25),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Riwayat Transaksi',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF2D3436),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF138F81).withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '${_riwayat.length} Transaksi',
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF138F81),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            height: 1.5,
            color: const Color(0xFF2D3436).withValues(alpha: 0.15),
          ),
          const SizedBox(height: 10),
          ...List.generate(
            _riwayat.length,
            (index) => _buildRiwayatItem(_riwayat[index], index),
          ),
        ],
      ),
    );
  }

  Widget _buildRiwayatItem(dynamic item, int index) {
    final paymentType = item['payment_type'] is Map
        ? Map<String, dynamic>.from(item['payment_type'] as Map)
        : item['paymentType'] is Map
        ? Map<String, dynamic>.from(item['paymentType'] as Map)
        : null;
    final jenis =
        paymentType?['nama']?.toString() ?? item['jenis']?.toString() ?? '';
    final via = item['via']?.toString() ?? '';
    final jumlah = item['jumlah'] ?? 0;
    final tanggal = item['tanggal']?.toString() ?? '';
    final status = item['status']?.toString() ?? '';
    final jenisColor = _getJenisColor(jenis);
    final viaColor = _getViaColor(via);
    final isLunas = status == 'Lunas';

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: Duration(milliseconds: 400 + (index * 80)),
      curve: Curves.easeOutCubic,
      builder: (context, value, child) {
        return Opacity(
          opacity: value,
          child: Transform.translate(
            offset: Offset(0, 20 * (1 - value)),
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
                    child: Icon(
                      _getJenisIcon(jenis),
                      size: 18,
                      color: jenisColor,
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        jenis,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF2D3436),
                        ),
                      ),
                      const SizedBox(height: 1),
                      Text(
                        tanggal,
                        style: const TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w400,
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
                      _formatRupiah(jumlah is int ? jumlah : 0),
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: isLunas
                            ? const Color(0xFF138F81)
                            : const Color(0xFFD63031),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: viaColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    via,
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      color: viaColor,
                    ),
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: isLunas
                        ? const Color(0xFF138F81).withValues(alpha: 0.1)
                        : const Color(0xFFD63031).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        isLunas
                            ? Icons.check_circle_rounded
                            : Icons.pending_rounded,
                        size: 10,
                        color: isLunas
                            ? const Color(0xFF138F81)
                            : const Color(0xFFD63031),
                      ),
                      const SizedBox(width: 3),
                      Text(
                        status,
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w700,
                          color: isLunas
                              ? const Color(0xFF138F81)
                              : const Color(0xFFD63031),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
