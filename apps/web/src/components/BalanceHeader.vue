<script setup lang="ts">
import { formatYuanGrouped, type Balance } from '@expense/shared';
import { computed } from 'vue';

const props = defineProps<{ balance: Balance | null }>();

/**
 * The greeting is UI copy, not a date format, so it lives here rather than in
 * `@expense/shared`. Only the hour matters, and the reader's local hour is the
 * right one — this is the user's own screen.
 */
function greetingFor(hour: number): string {
  if (hour < 6) {
    return '夜深了，记完早点休息';
  }
  if (hour < 12) {
    return '早上好，今天也要好好记账';
  }
  if (hour < 18) {
    return '下午好，今天也要好好记账';
  }
  return '晚上好，今天也要好好记账';
}

const greeting = computed(() => greetingFor(new Date().getHours()));

/**
 * The balance is cumulative — every transaction ever recorded — so it does not
 * change when the 账期 does. `netCents` is signed and may be negative, so the
 * sign is lifted out in front of the symbol (`-¥ 409.49`), the way the list
 * rows render it, rather than left trailing the `¥`.
 */
const netCents = computed(() => props.balance?.netCents ?? 0);
const sign = computed(() => (netCents.value < 0 ? '-' : ''));
const magnitude = computed(() => formatYuanGrouped(Math.abs(netCents.value)));
</script>

<template>
  <header class="header">
    <div class="header__top">
      <span class="header__greeting">{{ greeting }}</span>
      <!-- The 账期 picker, projected in so this stays presentational. -->
      <div class="header__period">
        <slot name="period" />
      </div>
    </div>

    <p class="header__balance">{{ sign }}¥ {{ magnitude }}</p>
  </header>
</template>
