<script setup lang="ts">
import { formatYuanGrouped, type Summary } from '@expense/shared';
import { computed } from 'vue';

const props = defineProps<{ summary: Summary | null }>();

/** Both figures are scoped to the selected 账期, unlike the balance above. */
const expense = computed(() => formatYuanGrouped(props.summary?.expenseCents ?? 0));
const income = computed(() => formatYuanGrouped(props.summary?.incomeCents ?? 0));
</script>

<template>
  <section class="card summary">
    <div class="summary__col">
      <span class="summary__label">支出</span>
      <strong class="summary__value summary__value--expense">¥ {{ expense }}</strong>
    </div>

    <div class="summary__rule" role="presentation"></div>

    <div class="summary__col summary__col--income">
      <span class="summary__label">收入</span>
      <strong class="summary__value">¥ {{ income }}</strong>
    </div>
  </section>
</template>
