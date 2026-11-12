<script setup lang="ts">
import {
  TransactionInputSchema,
  toCents,
  toIsoDate,
  type Category,
  type Kind,
  type TransactionInput,
} from '@expense/shared';
import { computed, ref, watch } from 'vue';

import CategoryPicker from './CategoryPicker.vue';

const props = defineProps<{
  open: boolean;
  /** The category the quick-picker asked for, if it opened this sheet. */
  presetCategory: Category;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  submit: [input: TransactionInput];
}>();

const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
});

const formData = ref<any>({})

const kind = ref<Kind>('expense');
/**
 * Yuan, as typed into the InputNumber. Component-local UI state: it is
 * converted to cents at the submit edge and never leaves this component.
 */
const amountYuan = ref<number | null>(null);
const category = ref<Category>(props.presetCategory);
/** `YYYY-MM-DD`, straight out of the picker's `value-format` — not a dayjs. */
const occurredOn = ref(toIsoDate(new Date()));
const note = ref('');
const problem = ref<string | null>(null);

watch(
  () => props.presetCategory,
  (next) => {
    category.value = next;
  },
);

const kindOptions = [
  { label: '支出', value: 'expense' },
  { label: '收入', value: 'income' },
];

function onSubmit(): void {
  console.log("for test.....");
  problem.value = null;

  // The UI speaks yuan; the wire speaks cents. `toCents` is the only
  // conversion in the app, and it lives in @expense/shared.
  const yuan = amountYuan.value;
  const amountCents = yuan === null || !Number.isFinite(yuan) ? Number.NaN : toCents(yuan);
  const trimmed = note.value.trim() === '' ? null : note.value.trim();

  // The income payload has no `category` key at all, while the expense one
  // requires it — that asymmetry is the contract, not an oversight.
  const raw =
    kind.value === 'income'
      ? { kind: 'income' as const, amountCents, occurredOn: occurredOn.value, note: trimmed }
      : {
          kind: 'expense' as const,
          amountCents,
          category: category.value,
          occurredOn: occurredOn.value,
          note: trimmed,
        };

  const parsed = TransactionInputSchema.safeParse(raw);

  if (!parsed.success) {
    problem.value = parsed.error.issues[0]?.message ?? '输入有误';
    return;
  }

  emit('submit', parsed.data);
  amountYuan.value = null;
  note.value = '';
}

function finishFailed(error: unknown): void {
  console.log(`fail`, error)
}
</script>

<template>
  <a-drawer
    v-model:open="openModel"
    placement="bottom"
    :closable="false"
    :height="420"
    title="记一笔"
  >
    <a-form
      :model="formData"
      layout="vertical" @finish="onSubmit" @finishFailed="finishFailed">
      <a-form-item>
        <a-segmented v-model:value="kind" :options="kindOptions" block />
      </a-form-item>

      <a-form-item label="金额（元）" class="sheet__amount">
        <a-input-number
          v-model:value="amountYuan"
          :min="0.01"
          :precision="2"
          placeholder="12.50"
          style="width: 100%"
        />
      </a-form-item>

      <!-- Income has no category, so the grid would be a control with no
           effect. It is hidden rather than disabled. -->
      <a-form-item v-if="kind === 'expense'" label="分类">
        <CategoryPicker :active="category" @select="(next: Category) => (category = next)" />
      </a-form-item>

      <a-form-item label="发生日期">
        <a-date-picker
          v-model:value="occurredOn"
          value-format="YYYY-MM-DD"
          :allow-clear="false"
          style="width: 100%"
        />
      </a-form-item>

      <a-form-item label="备注">
        <a-input v-model:value="note" :maxlength="200" placeholder="午饭" />
      </a-form-item>

      <a-alert v-if="problem" type="error" :message="problem" show-icon class="sheet__problem" />

      <div class="sheet__actions">
        <a-button block @click="openModel = false">取消</a-button>
        <a-button type="primary" html-type="submit" block>记录</a-button>
      </div>
    </a-form>
  </a-drawer>
</template>
