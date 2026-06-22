import 'package:flutter/material.dart';

class BillingSummaryView extends StatelessWidget {
  const BillingSummaryView({
    super.key,
    required this.data,
    required this.formatCurrency,
  });

  final Map<String, dynamic> data;
  final String Function(int amount) formatCurrency;

  static const _teal = Color(0xFF138F81);
  static const _bluePanel = Color(0xFFE1EFF7);
  static const _text = Color(0xFF2D3436);
  static const _muted = Color(0xFF636E72);

  @override
  Widget build(BuildContext context) {
    final summary = _map(data['summary']);
    final groups = _list(data['groups']);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _summaryCards(summary),
        const SizedBox(height: 12),
        if (groups.isEmpty)
          _emptyCard()
        else
          ...groups.map((group) => _periodGroup(_map(group))),
      ],
    );
  }

  Widget _summaryCards(Map<String, dynamic> summary) {
    final items = [
      _Metric('Tagihan', summary['total_tagihan'], const Color(0xFF2E86DE)),
      _Metric('Dibayar', summary['total_dibayar'], _teal),
      _Metric('Kurang', summary['total_kurang_bayar'], const Color(0xFFD63031)),
      _Metric(
        'Menunggu',
        summary['total_menunggu_verifikasi'],
        const Color(0xFFE65100),
      ),
    ];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _bluePanel,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: items
            .map(
              (item) => Container(
                width: 142,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.label,
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: _muted,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      formatCurrency(_intValue(item.value)),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w800,
                        color: item.color,
                      ),
                    ),
                  ],
                ),
              ),
            )
            .toList(),
      ),
    );
  }

  Widget _periodGroup(Map<String, dynamic> group) {
    final monthly = _list(group['monthly']);
    final general = _list(group['general']);
    final title =
        group['period_badge']?.toString() ??
        '${group['tahun_ajaran'] ?? '-'} • ${group['semester'] ?? '-'}';

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _bluePanel,
        borderRadius: BorderRadius.circular(22),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.calendar_month_rounded, color: _teal, size: 18),
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: _text,
                  ),
                ),
              ),
            ],
          ),
          if (monthly.isNotEmpty) ...[
            const SizedBox(height: 12),
            const Text(
              'Pembayaran Bulanan',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: _text,
              ),
            ),
            const SizedBox(height: 8),
            _monthlyGrid(monthly),
          ],
          if (general.isNotEmpty) ...[
            const SizedBox(height: 12),
            const Text(
              'Pembayaran Umum',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: _text,
              ),
            ),
            const SizedBox(height: 8),
            ...general.map((item) => _generalCard(_map(item))),
          ],
        ],
      ),
    );
  }

  Widget _monthlyGrid(List<dynamic> monthly) {
    final labels = monthly.isNotEmpty
        ? _list(
            _map(monthly.first)['months'],
          ).map((month) => _map(month)['label']?.toString() ?? '-').toList()
        : _monthLabels();
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _gridHeader('Tipe', width: 118),
              ...labels.map((label) => _gridHeader(label)),
            ],
          ),
          ...monthly.map((raw) {
            final row = _map(raw);
            final months = _list(row['months']);
            return Row(
              children: [
                _gridCell(
                  row['name']?.toString() ?? 'Bulanan',
                  width: 118,
                  alignStart: true,
                ),
                ...months.map((month) {
                  final item = _map(month);
                  return _statusCell(item);
                }),
              ],
            );
          }),
        ],
      ),
    );
  }

  Widget _generalCard(Map<String, dynamic> item) {
    final status =
        item['display_status']?.toString() ?? item['status']?.toString() ?? '-';
    final color = _statusColor(status);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  item['payment_type_name']?.toString() ??
                      item['title']?.toString() ??
                      'Pembayaran',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                    color: _text,
                  ),
                ),
              ),
              _badge(status, color),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              _moneyChip('Tagihan', item['amount']),
              _moneyChip('Dibayar', item['paid_amount']),
              _moneyChip('Kurang', item['remaining_amount']),
              _badge(item['period_badge']?.toString() ?? '-', _teal),
            ],
          ),
        ],
      ),
    );
  }

  Widget _emptyCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _bluePanel,
        borderRadius: BorderRadius.circular(22),
      ),
      child: const Text(
        'Belum ada tagihan pada filter ini.',
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: _muted,
        ),
      ),
    );
  }

  Widget _gridHeader(String label, {double width = 46}) {
    return Container(
      width: width,
      height: 36,
      margin: const EdgeInsets.all(1),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: const Color(0xFFF2F4F6),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        textAlign: TextAlign.center,
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w800,
          color: _text,
        ),
      ),
    );
  }

  Widget _gridCell(String label, {double width = 46, bool alignStart = false}) {
    return Container(
      width: width,
      height: 40,
      margin: const EdgeInsets.all(1),
      padding: const EdgeInsets.symmetric(horizontal: 6),
      alignment: alignStart ? Alignment.centerLeft : Alignment.center,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        label,
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
        textAlign: alignStart ? TextAlign.left : TextAlign.center,
        style: const TextStyle(
          fontSize: 9,
          fontWeight: FontWeight.w700,
          color: _text,
        ),
      ),
    );
  }

  Widget _statusCell(Map<String, dynamic> item) {
    final bill = _map(item['bill']);
    final status =
        item['display_status']?.toString() ??
        bill['display_status']?.toString() ??
        item['status']?.toString() ??
        bill['status']?.toString() ??
        '';
    final isPaid =
        item['is_paid'] == true || bill['is_paid'] == true || status == 'Lunas';
    final color = _statusColor(status);
    final icon = isPaid ? Icons.check_rounded : _statusIcon(status);
    final effectiveColor = isPaid ? _teal : color;
    final isEmpty = status == 'Belum Ada Tagihan' || status.isEmpty;

    return Container(
      width: 46,
      height: 40,
      margin: const EdgeInsets.all(1),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: effectiveColor.withValues(alpha: isEmpty ? 0.12 : 1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(
        icon,
        size: 15,
        color: isEmpty ? effectiveColor : Colors.white,
      ),
    );
  }

  Widget _moneyChip(String label, dynamic value) {
    return _badge('$label ${formatCurrency(_intValue(value))}', _muted);
  }

  Widget _badge(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 9,
          fontWeight: FontWeight.w800,
          color: color,
        ),
      ),
    );
  }

  List<String> _monthLabels() {
    return const [
      'Jul',
      'Agu',
      'Sep',
      'Okt',
      'Nov',
      'Des',
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'Mei',
      'Jun',
    ];
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'Lunas':
        return _teal;
      case 'Belum Lunas':
        return const Color(0xFFD63031);
      case 'Kurang Bayar':
        return const Color(0xFFE65100);
      case 'Terlambat':
        return const Color(0xFFE65100);
      case 'Menunggu':
      case 'Menunggu Verifikasi':
        return const Color(0xFFF39C12);
      case 'Dibatalkan':
      case 'Belum Ada Tagihan':
        return _muted;
      default:
        return _muted;
    }
  }

  IconData _statusIcon(String status) {
    switch (status) {
      case 'Lunas':
        return Icons.check_rounded;
      case 'Belum Lunas':
      case 'Kurang Bayar':
        return Icons.close_rounded;
      case 'Terlambat':
        return Icons.priority_high_rounded;
      case 'Menunggu':
      case 'Menunggu Verifikasi':
        return Icons.hourglass_bottom_rounded;
      default:
        return Icons.remove_rounded;
    }
  }

  static Map<String, dynamic> _map(dynamic value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return <String, dynamic>{};
  }

  static List<dynamic> _list(dynamic value) {
    return value is List ? value : const <dynamic>[];
  }

  static int _intValue(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }
}

class _Metric {
  const _Metric(this.label, this.value, this.color);

  final String label;
  final dynamic value;
  final Color color;
}
