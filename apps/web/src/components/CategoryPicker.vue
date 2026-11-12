<script setup lang="ts">
import { CATEGORIES, type Category } from '@expense/shared';

defineProps<{
  /** Highlighted category, when this is acting as a form control. */
  active?: Category | null;
}>();

const emit = defineEmits<{ select: [category: Category] }>();
</script>

<template>
  <div class="picker">
    <button
      v-for="category in CATEGORIES"
      :key="category"
      type="button"
      class="picker__item"
      :aria-pressed="active === category"
      @click="emit('select', category)"
    >
      <!-- The Figma circles are unfilled placeholders; the label under each
           one is what actually identifies it. -->
      <span class="picker__dot" :class="{ 'picker__dot--active': active === category }"></span>
      <span class="picker__label">{{ category }}</span>
    </button>
  </div>
</template>
