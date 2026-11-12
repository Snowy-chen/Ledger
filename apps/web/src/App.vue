<script setup lang="ts">
import { PeriodSchema, type Category } from '@expense/shared';
import zhCN from 'ant-design-vue/es/locale/zh_CN';
import { computed } from 'vue';

import AppNav from './components/AppNav.vue';
import BalanceHeader from './components/BalanceHeader.vue';
import CategoryPicker from './components/CategoryPicker.vue';
import PeriodSummaryCard from './components/PeriodSummaryCard.vue';
import RecordSheet from './components/RecordSheet.vue';
import StatsPanel from './components/StatsPanel.vue';
import TransactionList from './components/TransactionList.vue';
import { useTransactions } from './composables/useTransactions';
import { themeConfig } from './theme';

const {
  transactions,
  summary,
  balance,
  trend,
  period,
  loading,
  error,
  activeTab,
  sheetOpen,
  draftCategory,
  pendingRemoval,
  setTab,
  openSheet,
  closeSheet,
  submit,
  askRemove,
  cancelRemove,
  confirmRemove,
  setPeriod,
} = useTransactions();

/**
 * The month picker is bound with `value-format="YYYY-MM"`, so `v-model` hands
 * us a plain `YYYY-MM` string — never a dayjs object (see
 * `.claude/rules/web.md`). It is still re-validated through `PeriodSchema`
 * before it reaches the store.
 */
const periodModel = computed({
  get: () => period.value,
  set: (value: string) => {
    const parsed = PeriodSchema.safeParse(value);
    if (parsed.success) {
      setPeriod(parsed.data);
    }
  },
});

/** The drawer can close itself (mask tap, Esc), so both directions matter. */
function onSheetToggle(value: boolean): void {
  if (value) {
    openSheet(draftCategory.value);
  } else {
    closeSheet();
  }
}

function onPickCategory(category: Category): void {
  openSheet(category);
}
</script>

<template>
  <a-config-provider :theme="themeConfig" :locale="zhCN">
    <div class="shell">
      <BalanceHeader :balance="balance">
        <template #period>
          <a-month-picker
            v-model:value="periodModel"
            value-format="YYYY-MM"
            :allow-clear="false"
            aria-label="账期"
          />
        </template>
      </BalanceHeader>

      <main class="shell__body">
        <a-alert v-if="error" type="error" :message="error" show-icon class="state" />

        <!-- `v-if`, never `<KeepAlive>`: keeping the panels alive would swap
             `onUnmounted` for `onDeactivated` and silently break the
             load-and-abort contract in the composable. -->
        <template v-if="activeTab === 'home'">
          <PeriodSummaryCard :summary="summary" />

          <CategoryPicker @select="onPickCategory" />

          <h2 class="section-title">最近交易</h2>

          <TransactionList
            :transactions="transactions"
            :loading="loading"
            @remove="askRemove"
          />
        </template>

        <StatsPanel v-else :summary="summary" :trend="trend" />
      </main>

      <button type="button" class="fab" aria-label="记一笔" @click="openSheet()">+</button>

      <AppNav :active="activeTab" @select="setTab" />

      <RecordSheet
        :open="sheetOpen"
        :preset-category="draftCategory"
        @update:open="onSheetToggle"
        @submit="submit"
      />

      <!-- A transaction cannot be edited, only deleted and re-recorded (see
           CLAUDE.md), so this dialog is the last chance to back out. -->
      <a-modal
        :open="pendingRemoval !== null"
        title="删除这笔交易？"
        ok-text="删除"
        cancel-text="取消"
        :ok-button-props="{ danger: true }"
        @ok="confirmRemove"
        @cancel="cancelRemove"
      >
        <p>删除后无法恢复，需要重新记录。</p>
      </a-modal>
    </div>
  </a-config-provider>
</template>
