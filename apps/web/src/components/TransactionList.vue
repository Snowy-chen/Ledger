<script setup lang="ts">
import { formatDayTime, formatYuanGrouped, type Transaction } from '@expense/shared';

defineProps<{
  transactions: readonly Transaction[];
  loading: boolean;
}>();

const emit = defineEmits<{ remove: [id: string] }>();

/** Fixed for the life of the list, so every row agrees on what "今天" is. */
const now = new Date();

/**
 * The subtitle is `分类 · 今天 12:30`. Income has no category (see CONTEXT.md),
 * so it is labelled by its kind instead — which is exactly what the Figma row
 * shows for 工资入账.
 */
function describe(transaction: Transaction): string {
  const label = transaction.kind === 'expense' ? transaction.category : '收入';
  return `${label} · ${formatDayTime(transaction.occurredOn, transaction.recordedAt, now)}`;
}

/** A missing note falls back to the same label the subtitle uses. */
function title(transaction: Transaction): string {
  const note = transaction.note?.trim() ?? '';
  if (note !== '') {
    return note;
  }
  return transaction.kind === 'expense' ? transaction.category : '收入';
}

/** Direction is a sign on the display only — `amountCents` is always positive. */
function amount(transaction: Transaction): string {
  const sign = transaction.kind === 'income' ? '+' : '-';
  return `${sign}¥ ${formatYuanGrouped(transaction.amountCents)}`;
}
</script>

<template>
  <a-spin v-if="loading" class="state" />

  <a-empty v-else-if="transactions.length === 0" description="这个账期还没有记录。" />

  <section v-else class="card">
    <ul class="list">
      <li v-for="transaction in transactions" :key="transaction.id" class="list__row">
        <span class="list__icon" aria-hidden="true"></span>

        <span class="list__info">
          <span class="list__title">{{ title(transaction) }}</span>
          <span class="list__meta">{{ describe(transaction) }}</span>
        </span>

        <span
          class="list__amount"
          :class="{ 'list__amount--income': transaction.kind === 'income' }"
        >
          {{ amount(transaction) }}
        </span>

        <!-- Transactions are immutable, so deleting and re-recording is the
             only way to fix a mistake (see CLAUDE.md). The Figma file has no
             affordance for it; this one is deliberate. It only asks — the
             confirmation dialog lives in App.vue. -->
        <button
          type="button"
          class="list__delete"
          :aria-label="`删除 ${title(transaction)}`"
          @click="emit('remove', transaction.id)"
        >
          删除
        </button>
      </li>
    </ul>
  </section>
</template>
