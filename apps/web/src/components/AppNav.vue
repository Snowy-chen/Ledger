<script setup lang="ts">
import type { HomeTab } from '../composables/useTransactions';

defineProps<{ active: HomeTab }>();

const emit = defineEmits<{ select: [tab: HomeTab] }>();

/**
 * 首页 and 统计 only. The Figma file also has a 我的 tab, but this system has
 * no user concept at all (see CONTEXT.md, 词汇边界), so there is nothing for
 * that tab to show.
 */
const ITEMS: ReadonlyArray<{ key: HomeTab; label: string }> = [
  { key: 'home', label: '首页' },
  { key: 'stats', label: '统计' },
];
</script>

<template>
  <nav class="nav">
    <button
      v-for="item in ITEMS"
      :key="item.key"
      type="button"
      class="nav__item"
      :class="{ 'nav__item--active': active === item.key }"
      :aria-current="active === item.key ? 'page' : undefined"
      @click="emit('select', item.key)"
    >
      <!-- The Figma icons are unfilled placeholder blocks, as on the category
           circles; the label carries the meaning. -->
      <span class="nav__icon" aria-hidden="true"></span>
      {{ item.label }}
    </button>
  </nav>
</template>
