<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('payment_bill_rules')) {
            Schema::create('payment_bill_rules', function (Blueprint $table) {
                $table->id();
                $table->foreignId('payment_type_id')->constrained('payment_types')->cascadeOnDelete();
                $table->string('name');
                $table->unsignedInteger('nominal');
                $table->string('billing_type', 30)->default('sekali')->index();
                $table->unsignedTinyInteger('due_day')->nullable();
                $table->string('target_type', 30)->default('all')->index();
                $table->foreignId('class_id')->nullable()->constrained('classes')->nullOnDelete();
                $table->date('starts_on')->nullable();
                $table->date('ends_on')->nullable();
                $table->boolean('is_active')->default(true)->index();
                $table->json('notification_settings')->nullable();
                $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('payment_bill_rule_student')) {
            Schema::create('payment_bill_rule_student', function (Blueprint $table) {
                $table->id();
                $table->foreignId('payment_bill_rule_id')->constrained('payment_bill_rules')->cascadeOnDelete();
                $table->foreignId('siswa_id')->constrained('siswa')->cascadeOnDelete();
                $table->timestamps();
                $table->unique(['payment_bill_rule_id', 'siswa_id'], 'payment_bill_rule_student_unique');
            });
        }

        if (!Schema::hasTable('payment_bills')) {
            Schema::create('payment_bills', function (Blueprint $table) {
                $table->id();
                $table->foreignId('payment_bill_rule_id')->nullable()->constrained('payment_bill_rules')->nullOnDelete();
                $table->foreignId('payment_type_id')->constrained('payment_types')->cascadeOnDelete();
                $table->foreignId('siswa_id')->constrained('siswa')->cascadeOnDelete();
                $table->foreignId('wali_id')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('class_id')->nullable()->constrained('classes')->nullOnDelete();
                $table->string('period_key', 32);
                $table->unsignedSmallInteger('period_year')->nullable();
                $table->unsignedTinyInteger('period_month')->nullable();
                $table->string('period_label')->nullable();
                $table->string('title');
                $table->unsignedInteger('amount');
                $table->date('due_date')->nullable()->index();
                $table->string('status', 30)->default('Belum Lunas')->index();
                $table->foreignId('payment_transaction_id')->nullable()->constrained('payment_transactions')->nullOnDelete();
                $table->timestamp('paid_at')->nullable();
                $table->timestamp('canceled_at')->nullable();
                $table->text('notes')->nullable();
                $table->timestamps();
                $table->unique(['payment_bill_rule_id', 'siswa_id', 'period_key'], 'payment_bills_rule_student_period_unique');
            });
        }

        if (!Schema::hasTable('payment_bill_notifications')) {
            Schema::create('payment_bill_notifications', function (Blueprint $table) {
                $table->id();
                $table->foreignId('payment_bill_id')->constrained('payment_bills')->cascadeOnDelete();
                $table->foreignId('recipient_user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('channel', 30)->default('in_app');
                $table->string('schedule_type', 50)->default('manual');
                $table->date('scheduled_for')->nullable();
                $table->timestamp('sent_at')->nullable();
                $table->string('status', 30)->default('pending')->index();
                $table->text('message')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();
            });
        }

        Schema::table('pembayaran', function (Blueprint $table) {
            if (!Schema::hasColumn('pembayaran', 'payment_bill_id')) {
                $table->foreignId('payment_bill_id')
                    ->nullable()
                    ->after('payment_type_id')
                    ->constrained('payment_bills')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('pembayaran', function (Blueprint $table) {
            if (Schema::hasColumn('pembayaran', 'payment_bill_id')) {
                $table->dropConstrainedForeignId('payment_bill_id');
            }
        });

        Schema::dropIfExists('payment_bill_notifications');
        Schema::dropIfExists('payment_bills');
        Schema::dropIfExists('payment_bill_rule_student');
        Schema::dropIfExists('payment_bill_rules');
    }
};
