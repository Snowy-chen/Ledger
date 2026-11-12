<script setup lang="ts">
import { formatYuanGrouped, type Summary, type Trend } from '@expense/shared';
import { computed } from 'vue';

const props = defineProps<{
  summary: Summary | null;
  trend: Trend | null;
}>();

const expenseTotal = computed(() => props.summary?.expenseCents ?? 0);

/** A category's share of the period's spending, for the bar width. */
function share(cents: number): number {
  return expenseTotal.value === 0 ? 0 : Math.round((cents / expenseTotal.value) * 100);
}

/**
 * The tallest bar in the window sets the scale, so the chart fills its box
 * whatever the amounts are. Floored at 1 to keep the division safe when the
 * window is empty or entirely zero.
 */
const peak = computed(() => {
  const rows = props.trend?.periods ?? [];
  return Math.max(1, ...rows.map((row) => Math.max(row.expenseCents, row.incomeCents)));
});

function barHeight(cents: number): string {
  return `${Math.round((cents / peak.value) * 100)}%`;
}

function monthLabel(period: string): string {
  return `${Number(period.slice(5))}月`;
}
</script>

<template>
  <div>
    <h2 class="section-title">分类占比</h2>

    <a-empty v-if="expenseTotal === 0" description="这个账期还没有支出。" />

    <section v-else class="card">
      <ul class="stats">
        <li v-for="row in summary?.byCategory ?? []" :key="row.category">
          <div class="stats__head">
            <span>{{ row.category }}</span>
            <span>¥ {{ formatYuanGrouped(row.totalCents) }} · {{ share(row.totalCents) }}%</span>
          </div>
          <div
            class="stats__bar"
            role="progressbar"
            :aria-valuenow="share(row.totalCents)"
            aria-valuemin="0"
            aria-valuemax="100"
            :aria-label="row.category"
          >
            <div class="stats__fill" :style="{ width: `${share(row.totalCents)}%` }"></div>
          </div>
        </li>
      </ul>
    </section>

    <h2 class="section-title">月度趋势</h2>

    <a-empty v-if="(trend?.periods.length ?? 0) === 0" description="暂无数据。" />

    <section v-else class="card">
      <div class="trend">
        <div v-for="row in trend?.periods ?? []" :key="row.period" class="trend__col">
          <div class="trend__bars">
            <div
              class="trend__bar trend__bar--expense"
              :style="{ height: barHeight(row.expenseCents) }"
              :title="`支出 ¥ ${formatYuanGrouped(row.expenseCents)}`"
            ></div>
            <div
              class="trend__bar trend__bar--income"
              :style="{ height: barHeight(row.incomeCents) }"
              :title="`收入 ¥ ${formatYuanGrouped(row.incomeCents)}`"
            ></div>
          </div>
          <span class="trend__label">{{ monthLabel(row.period) }}</span>
        </div>
      </div>
    </section>
  </div>
</template>
