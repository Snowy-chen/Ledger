import type { Category, Transaction, TransactionInput } from '@expense/shared';
import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted, ref } from 'vue';

import { useTransactionStore } from '../stores/transactionStore';

/** Which panel the bottom nav is showing. */
export type HomeTab = 'home' | 'stats';

/** The category the record sheet opens with when nothing preset it. */
const DEFAULT_CATEGORY: Category = '餐饮';

/**
 * The two halves of the split (see CLAUDE.md):
 *
 * 1. **Lifecycle.** The store lives for the whole app and cannot know when this
 *    screen appears or disappears. Loading on mount and aborting in-flight
 *    requests on unmount are ours.
 * 2. **Local UI state.** The active tab, whether the record sheet is open, and
 *    which category it opens on are nobody else's business, so they live here
 *    and die with the component rather than in the global store.
 *
 * Everything else — the transactions, the period, the mutations — belongs to
 * the store and is passed straight through.
 */
export function useTransactions() {
  const store = useTransactionStore();
  const { transactions, summary, balance, trend, period, loading, error } = storeToRefs(store);

  const activeTab = ref<HomeTab>('home');
  const sheetOpen = ref(false);
  const draftCategory = ref<Category>(DEFAULT_CATEGORY);
  /** The transaction the delete dialog is asking about; `null` when closed. */
  const pendingRemoval = ref<Transaction | null>(null);

  const controller = new AbortController();

  onMounted(() => {
    void store.load(controller.signal);
  });

  onUnmounted(() => {
    controller.abort();
  });

  function setTab(next: HomeTab): void {
    activeTab.value = next;
  }

  /** Tapping a quick-category both opens the sheet and preselects that one. */
  function openSheet(category?: Category): void {
    draftCategory.value = category ?? DEFAULT_CATEGORY;
    sheetOpen.value = true;
  }

  function closeSheet(): void {
    sheetOpen.value = false;
  }

  async function submit(input: TransactionInput): Promise<void> {
    await store.add(input);
    closeSheet();
  }

  /**
   * A delete is irreversible (see CLAUDE.md), so the list only asks; the
   * modal decides. Keeping this toggle here rather than in the store means it
   * dies with the screen.
   */
  function askRemove(id: string): void {
    pendingRemoval.value = transactions.value.find((item) => item.id === id) ?? null;
  }

  function cancelRemove(): void {
    pendingRemoval.value = null;
  }

  async function confirmRemove(): Promise<void> {
    const target = pendingRemoval.value;
    pendingRemoval.value = null;
    if (target !== null) {
      await store.remove(target.id);
    }
  }

  return {
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
    setPeriod: store.setPeriod,
  };
}
